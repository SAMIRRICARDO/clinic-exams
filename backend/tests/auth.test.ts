import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app';
import { signToken } from '../src/auth';
import { getFixtures, TEST_PASSWORD, prisma } from './setup';

describe('Autenticacao', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('autentica com credenciais validas e retorna o perfil', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'staff@test.com', password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('STAFF');
  });

  it('rejeita senha incorreta com 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'staff@test.com', password: 'senha-errada' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejeita token invalido com 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer token.invalido.aqui' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('retorna o usuario atual a partir do token', async () => {
    const f = getFixtures();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe('PATIENT');
    expect(res.json().patientId).toBe(f.patientA.patientId);
  });

  describe('revalidacao do role no banco', () => {
    const staffRoute = (token: string) =>
      app.inject({
        method: 'GET',
        url: '/appointments',
        headers: { authorization: `Bearer ${token}` },
      });

    const payload = (sub: string, role: 'STAFF' | 'PATIENT', email: string) => ({
      sub,
      role,
      email,
      name: 'Usuario Teste',
    });

    it('STAFF com token antigo e role alterada para PATIENT recebe 403', async () => {
      const f = getFixtures();
      await prisma.user.update({ where: { id: f.staffId }, data: { role: 'PATIENT' } });

      const res = await staffRoute(f.staffToken);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('PATIENT com token antigo e role alterada para STAFF recebe 200', async () => {
      const f = getFixtures();
      await prisma.user.update({ where: { id: f.patientA.userId }, data: { role: 'STAFF' } });

      const res = await staffRoute(f.patientA.token);
      expect(res.statusCode).toBe(200);
    });

    it('token valido com sub inexistente recebe 401', async () => {
      const token = signToken(
        payload('00000000-0000-4000-8000-000000000000', 'STAFF', 'ghost@test.com'),
      );

      const res = await staffRoute(token);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHENTICATED');
    });

    it('token com assinatura invalida continua recebendo 401', async () => {
      const f = getFixtures();
      const token = jwt.sign(
        payload(f.staffId, 'STAFF', 'staff@test.com'),
        'segredo-errado-com-mais-de-16-caracteres',
        { expiresIn: '8h' },
      );

      const res = await staffRoute(token);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('INVALID_TOKEN');
    });

    it('token expirado continua recebendo 401', async () => {
      const f = getFixtures();
      const token = jwt.sign(payload(f.staffId, 'STAFF', 'staff@test.com'), process.env.JWT_SECRET!, {
        expiresIn: '-1s',
      });

      const res = await staffRoute(token);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('INVALID_TOKEN');
    });

    it('STAFF sem alteracao continua autorizado', async () => {
      const f = getFixtures();
      const res = await staffRoute(f.staffToken);
      expect(res.statusCode).toBe(200);
    });

    it('PATIENT continua sem acesso as rotas STAFF', async () => {
      const f = getFixtures();
      const res = await staffRoute(f.patientA.token);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('/exam-types continua funcionando para qualquer role autenticado', async () => {
      const f = getFixtures();
      for (const token of [f.staffToken, f.patientA.token]) {
        const res = await app.inject({
          method: 'GET',
          url: '/exam-types',
          headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
      }
    });
  });
});
