import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app';
import { getFixtures, futureSlot, prisma } from './setup';

/**
 * CENARIOS 2, 3 e 4 (obrigatorios):
 *  2. paciente tenta consultar laudo de outro paciente -> negado
 *  3. paciente tenta acessar rascunho -> conteudo nao disponibilizado
 *  4. laudo publicado fica disponivel para o paciente correto
 */
describe('Acesso a laudos', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  async function createAppointmentWithReport(opts: {
    patientId: string;
    publish: boolean;
    slotHour?: number;
  }): Promise<{ appointmentId: string; reportId: string }> {
    const f = getFixtures();
    const slot = futureSlot(3, opts.slotHour ?? 9, 0);

    const created = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { patientId: opts.patientId, examTypeId: f.examTypes[0].id, scheduledAt: slot.toISOString() },
    });
    expect(created.statusCode).toBe(201);
    const appointmentId = created.json().id;

    const report = await app.inject({
      method: 'PUT',
      url: `/appointments/${appointmentId}/report`,
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: {
        title: 'Laudo de teste',
        body: 'Conteudo clinico confidencial do laudo.',
        professionalName: 'Dr. Responsavel',
      },
    });
    expect(report.statusCode).toBe(200);
    const reportId = report.json().id;

    if (opts.publish) {
      const pub = await app.inject({
        method: 'POST',
        url: `/reports/${reportId}/publish`,
        headers: { authorization: `Bearer ${f.staffToken}` },
      });
      expect(pub.statusCode).toBe(200);
    }

    return { appointmentId, reportId };
  }

  it('CENARIO 2: paciente nao acessa laudo de outro paciente', async () => {
    const f = getFixtures();
    // Laudo publicado do paciente A
    const { reportId } = await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: true });

    // Paciente B tenta ler
    const res = await app.inject({
      method: 'GET',
      url: `/me/reports/${reportId}`,
      headers: { authorization: `Bearer ${f.patientB.token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('REPORT_NOT_FOUND');
    // O conteudo do laudo nao pode vazar na resposta.
    expect(JSON.stringify(res.json())).not.toContain('Conteudo clinico confidencial');
  });

  it('CENARIO 2b: paciente nao ve agendamentos de outro paciente na listagem', async () => {
    const f = getFixtures();
    await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: true });

    const res = await app.inject({
      method: 'GET',
      url: '/me/appointments',
      headers: { authorization: `Bearer ${f.patientB.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('CENARIO 3: paciente nao acessa rascunho (conteudo indisponivel)', async () => {
    const f = getFixtures();
    // Rascunho do proprio paciente A
    const { reportId } = await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: false });

    const res = await app.inject({
      method: 'GET',
      url: `/me/reports/${reportId}`,
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('REPORT_NOT_PUBLISHED');
    expect(JSON.stringify(res.json())).not.toContain('Conteudo clinico confidencial');
  });

  it('CENARIO 3b: rascunho nao aparece na lista de laudos do paciente', async () => {
    const f = getFixtures();
    await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: false });

    const res = await app.inject({
      method: 'GET',
      url: '/me/reports',
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('CENARIO 4: laudo publicado fica disponivel para o paciente correto', async () => {
    const f = getFixtures();
    const { reportId } = await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: true });

    const res = await app.inject({
      method: 'GET',
      url: `/me/reports/${reportId}`,
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('PUBLISHED');
    expect(body.body).toContain('Conteudo clinico confidencial');
    expect(body.publishedAt).toBeTruthy();
    expect(body.publishedAtIso).toMatch(/-03:00$/);
  });

  it('CENARIO 4b: publicacao registra a data e o laudo passa a aparecer na lista', async () => {
    const f = getFixtures();
    const { reportId } = await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: false });

    const before = await app.inject({
      method: 'GET',
      url: '/me/reports',
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });
    expect(before.json()).toHaveLength(0);

    const pub = await app.inject({
      method: 'POST',
      url: `/reports/${reportId}/publish`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });
    expect(pub.statusCode).toBe(200);
    expect(pub.json().publishedAt).toBeTruthy();

    const after = await app.inject({
      method: 'GET',
      url: '/me/reports',
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });
    expect(after.json()).toHaveLength(1);
    expect(after.json()[0].id).toBe(reportId);
  });

  it('nao permite editar laudo publicado', async () => {
    const f = getFixtures();
    const { appointmentId } = await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: true });

    const res = await app.inject({
      method: 'PUT',
      url: `/appointments/${appointmentId}/report`,
      headers: { authorization: `Bearer ${f.staffToken}` },
      payload: { title: 'Alterado', body: 'Novo conteudo', professionalName: 'Dr. X' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REPORT_PUBLISHED');
  });

  it('staff consegue ler rascunho; paciente nao', async () => {
    const f = getFixtures();
    const { reportId } = await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: false });

    const staffRes = await app.inject({
      method: 'GET',
      url: `/reports/${reportId}`,
      headers: { authorization: `Bearer ${f.staffToken}` },
    });
    expect(staffRes.statusCode).toBe(200);
    expect(staffRes.json().status).toBe('DRAFT');

    const patientRes = await app.inject({
      method: 'GET',
      url: `/me/reports/${reportId}`,
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });
    expect(patientRes.statusCode).toBe(404);
  });

  it('paciente nao acessa rotas de laudo da clinica', async () => {
    const f = getFixtures();
    const { reportId } = await createAppointmentWithReport({ patientId: f.patientA.patientId, publish: true });

    const res = await app.inject({
      method: 'GET',
      url: `/reports/${reportId}`,
      headers: { authorization: `Bearer ${f.patientA.token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
