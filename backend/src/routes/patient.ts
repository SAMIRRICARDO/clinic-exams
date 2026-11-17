import type { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import { authenticate, HttpError, requirePatient } from '../http';
import { toAppointmentView } from '../services/appointments';
import { getReportForPatient, toReportSummary } from '../services/reports';

/**
 * Portal do paciente.
 * Todas as consultas sao escopadas pelo patientId do token - o paciente
 * nunca informa de quem quer ver os dados, o backend resolve pelo token.
 */
export async function patientRoutes(app: FastifyInstance): Promise<void> {
  async function resolvePatientId(userId: string): Promise<string> {
    const patient = await prisma.patient.findUnique({ where: { userId }, select: { id: true } });
    if (!patient) throw new HttpError(403, 'Perfil de paciente nao encontrado.', 'PATIENT_PROFILE_MISSING');
    return patient.id;
  }

  // Meus agendamentos
  app.get('/me/appointments', { preHandler: [authenticate, requirePatient] }, async (req) => {
    const patientId = await resolvePatientId(req.user!.sub);
    const rows = await prisma.appointment.findMany({
      where: { patientId },
      include: {
        examType: true,
        patient: true,
        report: { select: { id: true, status: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
    return rows.map(toAppointmentView);
  });

  // Meus laudos publicados (nunca rascunhos)
  app.get('/me/reports', { preHandler: [authenticate, requirePatient] }, async (req) => {
    const patientId = await resolvePatientId(req.user!.sub);
    const rows = await prisma.report.findMany({
      where: { status: 'PUBLISHED', appointment: { patientId } },
      orderBy: { publishedAt: 'desc' },
      include: {
        appointment: {
          select: {
            scheduledAt: true,
            examType: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      ...toReportSummary(r),
      examTypeName: r.appointment.examType.name,
      scheduledAt: r.appointment.scheduledAt.toISOString(),
    }));
  });

  // Leitura de um laudo publicado do proprio paciente
  app.get('/me/reports/:id', { preHandler: [authenticate, requirePatient] }, async (req) => {
    const { id } = req.params as { id: string };
    const patientId = await resolvePatientId(req.user!.sub);
    return getReportForPatient(id, patientId);
  });
}
