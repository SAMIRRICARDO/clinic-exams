import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken, type TokenPayload } from './auth';
import type { Role } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/**
 * Autenticacao: le o Bearer token e valida a assinatura.
 * A autorizacao e SEMPRE verificada aqui no backend - nunca no cliente.
 */
export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Token de autenticacao ausente.', 'UNAUTHENTICATED');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.user = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Token invalido ou expirado.', 'INVALID_TOKEN');
  }
}

/** Exige um dos perfis informados. */
export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      throw new HttpError(401, 'Nao autenticado.', 'UNAUTHENTICATED');
    }
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, 'Acesso negado para este perfil.', 'FORBIDDEN');
    }
  };
}

export const requireStaff = requireRole('STAFF');
export const requirePatient = requireRole('PATIENT');
