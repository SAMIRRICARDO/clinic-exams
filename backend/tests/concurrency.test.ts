import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app';
import { getFixtures, futureSlot, prisma } from './setup';

/**
 * CENARIO 1 (obrigatorio): duas tentativas SIMULTANEAS de agendamento no
 * mesmo horario - apenas uma deve ser aceita.
 *
 * Disparamos duas requisicoes HTTP concorrentes com Promise.all. A garantia
 * vem do indice unico parcial no PostgreSQL, nao de uma checagem em memoria.
 */
describe('Concorrencia no agendamento', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('aceita apenas um de dois agendamentos simultaneos no mesmo horario', async () => {
    const f = getFixtures();
    const slot = futureSlot(5, 9, 0);

    const payload = (patientId: string) => ({
      patientId,
      examTypeId: f.examTypes[0].id,
      scheduledAt: slot.toISOString(),
    });

    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/appointments',
        headers: { authorization: `Bearer ${f.staffToken}` },
        payload: payload(f.patientA.patientId),
      }),
      app.inject({
        method: 'POST',
        url: '/appointments',
        headers: { authorization: `Bearer ${f.staffToken}` },
        payload: payload(f.patientB.patientId),
      }),
    ]);

    const statuses = [r1.statusCode, r2.statusCode].sort();
    expect(statuses).toEqual([201, 409]);

    // Exatamente um agendamento ativo persistido naquele horario.
    const count = await prisma.appointment.count({
      where: { scheduledAt: slot, status: 'ACTIVE' },
    });
    expect(count).toBe(1);

    const rejected = r1.statusCode === 409 ? r1 : r2;
    expect(rejected.json().error.code).toBe('SLOT_TAKEN');
  });

  it('permite reutilizar o horario de um agendamento cancelado', async () => {
    const f = getFixtures();
    const slot = futureSlot(6, 10, 0);

    const first = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { patientId: f.patientA.patientId, examTypeId: f.examTypes[0].id, scheduledAt: slot.toISOString() },
    });
    expect(first.statusCode).toBe(201);

    const cancel = await app.inject({
      method: 'POST',
      url: `/appointments/${first.json().id}/cancel`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });
    expect(cancel.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { patientId: f.patientB.patientId, examTypeId: f.examTypes[1].id, scheduledAt: slot.toISOString() },
    });
    expect(second.statusCode).toBe(201);
  });
});
