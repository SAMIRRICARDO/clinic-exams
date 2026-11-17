import { Prisma } from '@prisma/client';
import { lockAppointment, prisma } from '../db';
import { HttpError } from '../http';
import {
  CLINIC_TZ,
  OPENING_HOUR,
  CLOSING_HOUR,
  SLOT_MINUTES,
  clinicDayRange,
  clinicDayKey,
  clinicLocalToUtc,
  formatInClinicTz,
  generateDaySlots,
  utcToClinicParts,
} from '../time';

export interface AppointmentView {
  id: string;
  scheduledAt: string;
  scheduledAtIso: string;
  dayKey: string;
  timeLabel: string;
  status: 'ACTIVE' | 'CANCELLED';
  examType: { id: string; code: string; name: string };
  patient: { id: string; fullName: string; document: string };
  hasReport: boolean;
  reportStatus: 'DRAFT' | 'PUBLISHED' | null;
  canCancel: boolean;
}

const appointmentInclude = {
  examType: true,
  patient: true,
  report: { select: { id: true, status: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export function toAppointmentView(a: AppointmentWithRelations): AppointmentView {
  const p = utcToClinicParts(a.scheduledAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: a.id,
    scheduledAt: a.scheduledAt.toISOString(),
    scheduledAtIso: formatInClinicTz(a.scheduledAt),
    dayKey: clinicDayKey(a.scheduledAt),
    timeLabel: `${pad(p.hour)}:${pad(p.minute)}`,
    status: a.status,
    examType: { id: a.examType.id, code: a.examType.code, name: a.examType.name },
    patient: { id: a.patient.id, fullName: a.patient.fullName, document: a.patient.document },
    hasReport: Boolean(a.report),
    reportStatus: a.report?.status ?? null,
    // RN09: agendamento com laudo publicado nao pode ser cancelado
    canCancel: a.status === 'ACTIVE' && a.report?.status !== 'PUBLISHED',
  };
}

export interface CreateAppointmentInput {
  patientId: string;
  examTypeId: string;
  scheduledAt: Date;
  createdByUserId: string;
}

/**
 * Cria um agendamento aplicando as regras de negocio.
 *
 * Concorrencia (RN02): a checagem em memoria e apenas para devolver uma
 * mensagem amigavel. A garantia real e o indice unico parcial
 * "Appointment_active_slot_unique" no PostgreSQL: se duas requisicoes
 * simultaneas passarem pela checagem, o INSERT da segunda falha com
 * P2002 e convertemos em 409. Assim apenas uma e aceita.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentView> {
  const { patientId, examTypeId, createdByUserId } = input;

  // RN01: o instante recebido e interpretado no fuso da clinica. Um offset
  // arbitrario no ISO 8601 nao pode alterar o horario real da clinica: apenas
  // os componentes locais validados sao usados para reconstruir o instante UTC.
  const local = utcToClinicParts(input.scheduledAt);

  // RN01: horarios fixos de 30 minutos no fuso da clinica
  if (
    input.scheduledAt.getUTCSeconds() !== 0 ||
    input.scheduledAt.getUTCMilliseconds() !== 0 ||
    local.minute % SLOT_MINUTES !== 0
  ) {
    throw new HttpError(422, 'O horario deve estar alinhado a grade de 30 minutos.', 'SLOT_NOT_ALIGNED');
  }

  // RN01: a grade oficial vai das 08:00 as 18:00 (ultimo inicio as 17:30).
  const minutesOfDay = local.hour * 60 + local.minute;
  if (minutesOfDay < OPENING_HOUR * 60 || minutesOfDay >= CLOSING_HOUR * 60) {
    const opening = String(OPENING_HOUR).padStart(2, '0');
    const closing = String(CLOSING_HOUR).padStart(2, '0');
    throw new HttpError(
      422,
      `O horario deve estar entre ${opening}:00 e ${closing}:00 no fuso da clinica (${CLINIC_TZ}).`,
      'OUT_OF_GRID',
    );
  }

  // Normalizacao: reconstrui o instante canonico a partir da hora local da clinica.
  // E esse instante - nao o recebido - que sera usado na checagem de conflito,
  // na validacao de passado e na persistencia (sempre em UTC).
  const scheduledAt = clinicLocalToUtc(local.year, local.month, local.day, local.hour, local.minute);

  // RN04: nao permitir agendamentos no passado
  if (scheduledAt.getTime() <= Date.now()) {
    throw new HttpError(422, 'Nao e permitido agendar em data/hora no passado.', 'PAST_APPOINTMENT');
  }

  const [patient, examType] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    prisma.examType.findUnique({ where: { id: examTypeId } }),
  ]);

  if (!patient) throw new HttpError(404, 'Paciente nao encontrado.', 'PATIENT_NOT_FOUND');
  if (!examType || !examType.active) {
    throw new HttpError(404, 'Tipo de exame nao encontrado ou inativo.', 'EXAM_TYPE_NOT_FOUND');
  }

  // RN02 (checagem amigavel): ja existe agendamento ATIVO neste horario?
  const conflict = await prisma.appointment.findFirst({
    where: { scheduledAt, status: 'ACTIVE' },
    select: { id: true },
  });
  if (conflict) {
    throw new HttpError(409, 'Ja existe um agendamento ativo neste horario.', 'SLOT_TAKEN');
  }

  try {
    const created = await prisma.appointment.create({
      data: { patientId, examTypeId, scheduledAt, createdByUserId, status: 'ACTIVE' },
      include: appointmentInclude,
    });
    return toAppointmentView(created);
  } catch (err) {
    // Corrida perdida: o indice unico parcial barrou o segundo INSERT.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'Ja existe um agendamento ativo neste horario.', 'SLOT_TAKEN');
    }
    throw err;
  }
}

export interface ListAppointmentsFilter {
  date?: string; // YYYY-MM-DD no fuso da clinica
  patientId?: string;
  status?: 'ACTIVE' | 'CANCELLED';
}

export async function listAppointments(filter: ListAppointmentsFilter): Promise<AppointmentView[]> {
  const where: Prisma.AppointmentWhereInput = {};

  if (filter.date) {
    const { start, end } = clinicDayRange(filter.date);
    where.scheduledAt = { gte: start, lt: end };
  }
  if (filter.patientId) where.patientId = filter.patientId;
  if (filter.status) where.status = filter.status;

  const rows = await prisma.appointment.findMany({
    where,
    include: appointmentInclude,
    orderBy: { scheduledAt: 'asc' },
  });
  return rows.map(toAppointmentView);
}

export async function getAppointment(id: string): Promise<AppointmentView> {
  const row = await prisma.appointment.findUnique({ where: { id }, include: appointmentInclude });
  if (!row) throw new HttpError(404, 'Agendamento nao encontrado.', 'APPOINTMENT_NOT_FOUND');
  return toAppointmentView(row);
}

/**
 * Cancela um agendamento (RN09: bloqueado se houver laudo publicado).
 * A transacao + trava na linha do Appointment serializam esta operacao com
 * publishReport e upsertDraftReport, que travam a mesma linha antes de agir.
 */
export async function cancelAppointment(id: string): Promise<AppointmentView> {
  return prisma.$transaction(async (tx) => {
    await lockAppointment(tx, id);

    const row = await tx.appointment.findUnique({ where: { id }, include: appointmentInclude });
    if (!row) throw new HttpError(404, 'Agendamento nao encontrado.', 'APPOINTMENT_NOT_FOUND');

    if (row.status === 'CANCELLED') {
      throw new HttpError(409, 'Este agendamento ja esta cancelado.', 'ALREADY_CANCELLED');
    }
    if (row.report?.status === 'PUBLISHED') {
      throw new HttpError(409, 'Agendamento com laudo publicado nao pode ser cancelado.', 'REPORT_PUBLISHED');
    }

    const updated = await tx.appointment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: appointmentInclude,
    });
    return toAppointmentView(updated);
  });
}

/**
 * Grade de horarios de um dia, marcando cada slot como livre/ocupado.
 * Slots de agendamentos cancelados voltam a ficar livres (RN03).
 */
export async function getDayAvailability(dayKey: string) {
  const slots = generateDaySlots(dayKey);
  const { start, end } = clinicDayRange(dayKey);

  const active = await prisma.appointment.findMany({
    where: { scheduledAt: { gte: start, lt: end }, status: 'ACTIVE' },
    select: { scheduledAt: true, patient: { select: { fullName: true } } },
  });
  const taken = new Map(active.map((a) => [a.scheduledAt.getTime(), a.patient.fullName]));

  const now = Date.now();
  return slots.map((slot) => {
    const p = utcToClinicParts(slot);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      scheduledAt: slot.toISOString(),
      scheduledAtIso: formatInClinicTz(slot),
      timeLabel: `${pad(p.hour)}:${pad(p.minute)}`,
      available: !taken.has(slot.getTime()) && slot.getTime() > now,
      isPast: slot.getTime() <= now,
      occupiedBy: taken.get(slot.getTime()) ?? null,
    };
  });
}
