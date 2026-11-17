import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, HttpError, requireStaff } from '../http';
import {
  getReportForStaff,
  publishReport,
  toReportSummary,
  upsertDraftReport,
} from '../services/reports';

const upsertSchema = z.object({
  title: z.string().min(1, 'Titulo obrigatorio').max(200),
  body: z.string().min(1, 'Texto do laudo obrigatorio'),
  professionalName: z.string().min(1, 'Nome do profissional obrigatorio').max(200),
});

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // Lista todos os laudos (staff) - inclui rascunhos
  app.get('/reports', { preHandler: [authenticate, requireStaff] }, async () => {
    const rows = await prisma.report.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        appointment: {
          select: {
            scheduledAt: true,
            patient: { select: { fullName: true } },
            examType: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      ...toReportSummary(r),
      patientName: r.appointment.patient.fullName,
      examTypeName: r.appointment.examType.name,
      scheduledAt: r.appointment.scheduledAt.toISOString(),
    }));
  });

  // Cria/atualiza rascunho (staff)
  app.put('/appointments/:id/report', { preHandler: [authenticate, requireStaff] }, async (req) => {
    const { id } = req.params as { id: string };
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Dados invalidos.', 'VALIDATION_ERROR');
    }
    return upsertDraftReport({ appointmentId: id, ...parsed.data });
  });

  // Leitura pela clinica (staff) - rascunho ou publicado
  app.get('/reports/:id', { preHandler: [authenticate, requireStaff] }, async (req) => {
    const { id } = req.params as { id: string };
    return getReportForStaff(id);
  });

  // Publicacao (staff)
  app.post('/reports/:id/publish', { preHandler: [authenticate, requireStaff] }, async (req) => {
    const { id } = req.params as { id: string };
    return publishReport(id);
  });
}
