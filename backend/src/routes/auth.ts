import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, HttpError } from '../http';
import { signToken, verifyPassword } from '../auth';

const loginSchema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

/**
 * Hash bcrypt fixo (custo 10), calculado uma unica vez no carregamento do modulo.
 * Usado apenas para manter o custo da comparacao quando o e-mail nao existe,
 * evitando enumeracao de contas por diferenca de tempo de resposta.
 */
const DUMMY_PASSWORD_HASH = '$2a$10$s.dLJNssshIuKkDWjSixZO8fZPnoGCk2GzyS4PF/4lxvZ9IFX7lNe';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', async (req) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Dados invalidos.', 'VALIDATION_ERROR');
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { patient: true },
    });

    // Mensagem generica: nao revela se o e-mail existe.
    // O bcrypt (via verifyPassword) sempre executa: para e-mail inexistente
    // usamos o hash dummy fixo, mantendo o mesmo custo de CPU e o mesmo retorno.
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordValid = await verifyPassword(password, passwordHash);
    if (!user || !passwordValid) {
      throw new HttpError(401, 'E-mail ou senha invalidos.', 'INVALID_CREDENTIALS');
    }

    const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        patientId: user.patient?.id ?? null,
      },
    };
  });

  app.get('/auth/me', { preHandler: authenticate }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      include: { patient: true },
    });
    if (!user) throw new HttpError(401, 'Usuario nao encontrado.', 'UNAUTHENTICATED');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      patientId: user.patient?.id ?? null,
    };
  });
}
