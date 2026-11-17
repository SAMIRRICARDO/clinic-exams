import { Prisma } from '@prisma/client';
import { lockAppointment, prisma } from '../db';
import { HttpError } from '../http';
import { formatInClinicTz } from '../time';

export interface ReportView {
  id: string;
  appointmentId: string;
  title: string;
  body: string;
  professionalName: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  publishedAtIso: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSummary {
  id: string;
  appointmentId: string;
  title: string;
  professionalName: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  publishedAtIso: string | null;
}

type ReportRow = {
  id: string;
  appointmentId: string;
  title: string;
  body: string;
  professionalName: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toReportView(r: ReportRow): ReportView {
  return {
    id: r.id,
    appointmentId: r.appointmentId,
    title: r.title,
    body: r.body,
    professionalName: r.professionalName,
    status: r.status,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    publishedAtIso: r.publishedAt ? formatInClinicTz(r.publishedAt) : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toReportSummary(r: ReportRow): ReportSummary {
  return {
    id: r.id,
    appointmentId: r.appointmentId,
    title: r.title,
    professionalName: r.professionalName,
    status: r.status,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    publishedAtIso: r.publishedAt ? formatInClinicTz(r.publishedAt) : null,
  };
}

export interface UpsertReportInput {
  appointmentId: string;
  title: string;
  body: string;
  professionalName: string;
}

/**
 * Cria ou atualiza o laudo (rascunho) de um agendamento.
 * RN05: um laudo por agendamento (unique em appointmentId).
 * RN06: rascunho editavel; RN08: publicado nao pode ser editado.
 * RN07: agendamento cancelado nao recebe laudo.
 */
export async function upsertDraftReport(input: UpsertReportInput): Promise<ReportView> {
  return prisma.$transaction(async (tx) => {
    await lockAppointment(tx, input.appointmentId);

    const appointment = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      include: { report: true },
    });
    if (!appointment) throw new HttpError(404, 'Agendamento nao encontrado.', 'APPOINTMENT_NOT_FOUND');

    if (appointment.status === 'CANCELLED') {
      throw new HttpError(409, 'Agendamento cancelado nao pode receber laudo.', 'APPOINTMENT_CANCELLED');
    }
    if (appointment.report?.status === 'PUBLISHED') {
      throw new HttpError(409, 'Laudo publicado nao pode ser editado.', 'REPORT_PUBLISHED');
    }

    const data = {
      title: input.title,
      body: input.body,
      professionalName: input.professionalName,
    };

    try {
      const saved = appointment.report
        ? await tx.report.update({ where: { id: appointment.report.id }, data })
        : await tx.report.create({ data: { ...data, appointmentId: input.appointmentId, status: 'DRAFT' } });

      return toReportView(saved);
    } catch (err) {
      // Defesa residual: a trava ja impede dois creates concorrentes, mas o
      // indice unico em appointmentId continua sendo a garantia final.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new HttpError(409, 'Ja existe um laudo para este agendamento.', 'REPORT_CONFLICT');
      }
      throw err;
    }
  });
}

/** Publica um laudo (RN10: registra a data de publicacao). */
export async function publishReport(reportId: string): Promise<ReportView> {
  return prisma.$transaction(async (tx) => {
    // O id do agendamento e imutavel: esta primeira leitura so localiza a
    // linha a ser travada. As checagens reais sao refeitas depois do lock.
    const target = await tx.report.findUnique({
      where: { id: reportId },
      select: { appointmentId: true },
    });
    if (!target) throw new HttpError(404, 'Laudo nao encontrado.', 'REPORT_NOT_FOUND');

    await lockAppointment(tx, target.appointmentId);

    const report = await tx.report.findUnique({
      where: { id: reportId },
      include: { appointment: true },
    });
    if (!report) throw new HttpError(404, 'Laudo nao encontrado.', 'REPORT_NOT_FOUND');
    if (report.status === 'PUBLISHED') {
      throw new HttpError(409, 'Este laudo ja esta publicado.', 'ALREADY_PUBLISHED');
    }
    if (report.appointment.status === 'CANCELLED') {
      throw new HttpError(409, 'Agendamento cancelado nao pode ter laudo publicado.', 'APPOINTMENT_CANCELLED');
    }

    const updated = await tx.report.update({
      where: { id: reportId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    return toReportView(updated);
  });
}

/** Leitura pela clinica: qualquer laudo, inclusive rascunho. */
export async function getReportForStaff(reportId: string): Promise<ReportView> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new HttpError(404, 'Laudo nao encontrado.', 'REPORT_NOT_FOUND');
  return toReportView(report);
}

/**
 * Leitura pelo paciente.
 * RN11: so o proprio paciente, e somente laudos PUBLICADOS.
 * Um laudo de outro paciente responde 404 (nao revela existencia);
 * um rascunho do proprio paciente responde 404 (conteudo indisponivel).
 */
export async function getReportForPatient(reportId: string, patientId: string): Promise<ReportView> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { appointment: { select: { patientId: true } } },
  });

  if (!report) throw new HttpError(404, 'Laudo nao encontrado.', 'REPORT_NOT_FOUND');
  if (report.appointment.patientId !== patientId) {
    throw new HttpError(404, 'Laudo nao encontrado.', 'REPORT_NOT_FOUND');
  }
  if (report.status !== 'PUBLISHED') {
    throw new HttpError(404, 'Laudo nao disponivel.', 'REPORT_NOT_PUBLISHED');
  }
  return toReportView(report);
}
