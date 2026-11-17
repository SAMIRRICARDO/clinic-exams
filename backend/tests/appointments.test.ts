import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app';
import { getFixtures, futureSlot, prisma } from './setup';

/**
 * CENARIO 5 (obrigatorio): tentativa de agendar no passado e rejeitada.
 * Inclui tambem validacao de grade de 30 min e autorizacao por perfil.
 */
describe('Regras de agendamento', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('rejeita agendamento no passado com 422', async () => {
    const f = getFixtures();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Alinha ao slot para isolar a regra de passado da regra de grade.
    past.setUTCMinutes(0, 0, 0);

    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: {
        patientId: f.patientA.patientId,
        examTypeId: f.examTypes[0].id,
        scheduledAt: past.toISOString(),
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PAST_APPOINTMENT');
  });

  it('rejeita horario fora da grade de 30 minutos', async () => {
    const f = getFixtures();
    const slot = futureSlot(4, 9, 0);
    const misaligned = new Date(slot.getTime() + 7 * 60 * 1000);

    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: {
        patientId: f.patientA.patientId,
        examTypeId: f.examTypes[0].id,
        scheduledAt: misaligned.toISOString(),
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('SLOT_NOT_ALIGNED');
  });

  it('exige autenticacao em requisicao direta a API', async () => {
    const res = await app.inject({ method: 'GET', url: '/appointments' });
    expect(res.statusCode).toBe(401);
  });

  it('nega acesso de paciente a rota da clinica (403)', async () => {
    const f = getFixtures();
    const res = await app.inject({
      method: 'GET',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('filtra agendamentos por data e por paciente', async () => {
    const f = getFixtures();
    const slot = futureSlot(7, 11, 0);

    await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { patientId: f.patientA.patientId, examTypeId: f.examTypes[0].id, scheduledAt: slot.toISOString() },
    });

    const byPatient = await app.inject({
      method: 'GET',
      url: `/appointments?patientId=${f.patientA.patientId}`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });
    expect(byPatient.statusCode).toBe(200);
    expect(byPatient.json()).toHaveLength(1);

    const byOtherPatient = await app.inject({
      method: 'GET',
      url: `/appointments?patientId=${f.patientB.patientId}`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });
    expect(byOtherPatient.json()).toHaveLength(0);

    const dayKey = byPatient.json()[0].dayKey as string;
    const byDate = await app.inject({
      method: 'GET',
      url: `/appointments?date=${dayKey}`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });
    expect(byDate.json()).toHaveLength(1);
  });

  it('nao permite cancelar agendamento com laudo publicado', async () => {
    const f = getFixtures();
    const slot = futureSlot(8, 9, 30);

    const created = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { patientId: f.patientA.patientId, examTypeId: f.examTypes[0].id, scheduledAt: slot.toISOString() },
    });
    const apptId = created.json().id;

    const report = await app.inject({
      method: 'PUT',
      url: `/appointments/${apptId}/report`,
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { title: 'Laudo', body: 'Conteudo', professionalName: 'Dr. Teste' },
    });
    await app.inject({
      method: 'POST',
      url: `/reports/${report.json().id}/publish`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });

    const cancel = await app.inject({
      method: 'POST',
      url: `/appointments/${apptId}/cancel`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });
    expect(cancel.statusCode).toBe(409);
    expect(cancel.json().error.code).toBe('REPORT_PUBLISHED');
  });

  it('nao permite laudo em agendamento cancelado', async () => {
    const f = getFixtures();
    const slot = futureSlot(9, 15, 0);

    const created = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { patientId: f.patientA.patientId, examTypeId: f.examTypes[0].id, scheduledAt: slot.toISOString() },
    });
    const apptId = created.json().id;

    await app.inject({
      method: 'POST',
      url: `/appointments/${apptId}/cancel`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/appointments/${apptId}/report`,
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { title: 'Laudo', body: 'Conteudo', professionalName: 'Dr. Teste' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('APPOINTMENT_CANCELLED');
  });

  it('nao permite dois laudos no mesmo agendamento (upsert mantem um)', async () => {
    const f = getFixtures();
    const slot = futureSlot(10, 8, 30);

    const created = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { patientId: f.patientA.patientId, examTypeId: f.examTypes[0].id, scheduledAt: slot.toISOString() },
    });
    const apptId = created.json().id;

    await app.inject({
      method: 'PUT',
      url: `/appointments/${apptId}/report`,
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { title: 'V1', body: 'A', professionalName: 'Dr. X' },
    });
    const second = await app.inject({
      method: 'PUT',
      url: `/appointments/${apptId}/report`,
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { title: 'V2', body: 'B', professionalName: 'Dr. X' },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().title).toBe('V2');

    const count = await prisma.report.count({ where: { appointmentId: apptId } });
    expect(count).toBe(1);
  });

  describe('grade oficial da clinica (08:00-18:00)', () => {
    const post = (f: ReturnType<typeof getFixtures>, scheduledAt: string) =>
      app.inject({
        method: 'POST',
        url: '/appointments',
        headers: { authorization: `Bearer ${f.staffToken}` },
        payload: {
          patientId: f.patientA.patientId,
          examTypeId: f.examTypes[0].id,
          scheduledAt,
        },
      });

    it('rejeita horario antes das 08:00 (07:30) com 422', async () => {
      const f = getFixtures();
      const res = await post(f, futureSlot(11, 7, 30).toISOString());
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('OUT_OF_GRID');
    });

    it('rejeita horario as 18:00 com 422', async () => {
      const f = getFixtures();
      const res = await post(f, futureSlot(11, 18, 0).toISOString());
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('OUT_OF_GRID');
    });

    it('rejeita horario as 18:30 com 422', async () => {
      const f = getFixtures();
      const res = await post(f, futureSlot(11, 18, 30).toISOString());
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('OUT_OF_GRID');
    });

    it('aceita horario valido as 08:00', async () => {
      const f = getFixtures();
      const slot = futureSlot(11, 8, 0);
      const res = await post(f, slot.toISOString());
      expect(res.statusCode).toBe(201);
      expect(res.json().scheduledAt).toBe(slot.toISOString());
      expect(res.json().scheduledAtIso).toMatch(/T08:00:00-03:00$/);
    });

    it('aceita horario valido as 17:30', async () => {
      const f = getFixtures();
      const slot = futureSlot(11, 17, 30);
      const res = await post(f, slot.toISOString());
      expect(res.statusCode).toBe(201);
      expect(res.json().scheduledAt).toBe(slot.toISOString());
      expect(res.json().scheduledAtIso).toMatch(/T17:30:00-03:00$/);
    });

    it('normaliza payload com offset diferente de -03:00 sem alterar o horario da clinica', async () => {
      const f = getFixtures();
      const slot = futureSlot(12, 9, 0); // 09:00 na clinica = 12:00Z
      // Mesmo instante expresso em UTC (+00:00) em vez de -03:00.
      const res = await post(f, slot.toISOString());
      expect(res.statusCode).toBe(201);
      expect(res.json().scheduledAt).toBe(slot.toISOString());
      expect(res.json().scheduledAtIso).toMatch(/T09:00:00-03:00$/);
    });

    it('rejeita offset que desloca o horario para fora da grade da clinica', async () => {
      const f = getFixtures();
      const slot = futureSlot(12, 9, 0); // 09:00 na clinica = 12:00Z
      // "09:00Z" corresponde a 06:00 na clinica: o offset nao pode inventar uma 09:00 local.
      const shifted = new Date(slot.getTime() - 3 * 60 * 60 * 1000);
      const res = await post(f, shifted.toISOString());
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('OUT_OF_GRID');
    });

    it('persiste o instante UTC canonico correspondente ao horario da clinica', async () => {
      const f = getFixtures();
      const slot = futureSlot(13, 14, 0); // 14:00 na clinica = 17:00Z
      const res = await post(f, slot.toISOString());
      expect(res.statusCode).toBe(201);

      const view = res.json();
      expect(view.scheduledAt).toBe(slot.toISOString());
      expect(view.timeLabel).toBe('14:00');
      expect(view.scheduledAtIso).toMatch(/T14:00:00-03:00$/);

      const stored = await prisma.appointment.findUnique({ where: { id: view.id } });
      expect(stored?.scheduledAt.toISOString()).toBe(slot.toISOString());
      expect(stored?.scheduledAt.toISOString()).toMatch(/T17:00:00\.000Z$/);
    });
  });
});
