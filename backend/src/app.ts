import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { env } from './config';
import { HttpError } from './http';
import { authRoutes } from './routes/auth';
import { appointmentRoutes } from './routes/appointments';
import { reportRoutes } from './routes/reports';
import { patientRoutes } from './routes/patient';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.isTest ? false : { level: 'info' },
  });

  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
  });

  app.get('/health', async () => ({ status: 'ok', timezone: env.CLINIC_TIMEZONE }));

  // IMPORTANTE: os handlers de erro/404 sao registrados ANTES das rotas.
  // O Fastify aplica um handler apenas aos contextos criados depois dele;
  // registrando depois, as rotas ja encapsuladas usariam o handler padrao.
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code ?? 'ERROR', message: error.message },
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dados invalidos.' },
      });
    }
    if ((error as { statusCode?: number }).statusCode === 400) {
      return reply.code(400).send({
        error: { code: 'BAD_REQUEST', message: error.message },
      });
    }
    // eslint-disable-next-line no-console
    console.error(error);
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Rota nao encontrada.' } });
  });

  await app.register(authRoutes);
  await app.register(appointmentRoutes);
  await app.register(reportRoutes);
  await app.register(patientRoutes);

  return app;
}
