import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, HttpError, requireStaff } from '../http';
import {
  cancelAppointment,
  createAppointment,
  getAppointment,
  getDayAvailability,
  listAppointments,
} from '../services/appointments';

const createSchema = z.object({
  patientId: z.string().uuid('patientId invalido'),
  examTypeId: z.string().uuid('examTypeId invalido'),
  // ISO 8601 com offset, ex.: 2026-12-01T09:00:00-03:00
  scheduledAt: z.string().datetime({ offset: true, message: 'scheduledAt deve ser ISO 8601 com offset' }),
});

const listSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date deve ser YYYY-MM-DD').optional(),
  patientId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'CANCELLED']).optional(),
});

const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date deve ser YYYY-MM-DD'),
});

export async function appointmentRoutes(app: FastifyInstance): Promise<void> {
  // ---- Catalogo (staff) ----
  app.get('/patients', { preHandler: [authenticate, requireStaff] }, async () => {
    const patients = await prisma.patient.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, document: true, birthDate: true },
    });
    return patients;
  });

  app.get('/exam-types', { preHandler: authenticate }, async () => {
    return prisma.examType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, durationMinutes: true },
    });
  });

  // ---- Disponibilidade (staff) ----
  app.get('/appointments/availability', { preHandler: [authenticate, requireStaff] }, async (req) => {
    const parsed = availabilitySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Dados invalidos.', 'VALIDATION_ERROR');
    }
    return getDayAvailability(parsed.data.date);
  });

  // ---- Listagem (staff) ----
  app.get('/appointments', { preHandler: [authenticate, requireStaff] }, async (req) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Dados invalidos.', 'VALIDATION_ERROR');
    }
    return listAppointments(parsed.data);
  });

  app.get('/appointments/:id', { preHandler: [authenticate, requireStaff] }, async (req) => {
    const { id } = req.params as { id: string };
    return getAppointment(id);
  });

  // ---- Criacao (staff) ----
  app.post('/appointments', { preHandler: [authenticate, requireStaff] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Dados invalidos.', 'VALIDATION_ERROR');
    }
    const created = await createAppointment({
      patientId: parsed.data.patientId,
      examTypeId: parsed.data.examTypeId,
      scheduledAt: new Date(parsed.data.scheduledAt),
      createdByUserId: req.user!.sub,
    });
    return reply.code(201).send(created);
  });

  // ---- Cancelamento (staff) ----
  app.post('/appointments/:id/cancel', { preHandler: [authenticate, requireStaff] }, async (req) => {
    const { id } = req.params as { id: string };
    return cancelAppointment(id);
  });
}
