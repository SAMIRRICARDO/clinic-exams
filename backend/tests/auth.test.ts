import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app';
import { getFixtures, TEST_PASSWORD } from './setup';

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
});
