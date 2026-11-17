import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app';
import { getFixtures, futureSlot, prisma } from './setup';

/**
 * Corridas entre cancelamento de agendamento, publicacao de laudo e escrita
 * de rascunho. As tres operacoes travam a mesma linha de Appointment dentro
 * de uma transacao, entao o estado final nunca pode combinar CANCELLED com
 * PUBLISHED, nem permitir edicao apos publicacao.
 */
describe('Corridas cancel/publish/upsert', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  async function seed(opts: { withReport?: boolean; publish?: boolean; hour?: number } = {}) {
    const f = getFixtures();
    const slot = futureSlot(15, opts.hour ?? 9, 0);
    const created = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(f.staffToken),
      payload: {
        patientId: f.patientA.patientId,
        examTypeId: f.examTypes[0].id,
        scheduledAt: slot.toISOString(),
      },
    });
    expect(created.statusCode).toBe(201);
    const appointmentId = created.json().id as string;

    let reportId: string | null = null;
    if (opts.withReport) {
      const draft = await app.inject({
        method: 'PUT',
        url: `/appointments/${appointmentId}/report`,
        headers: auth(f.staffToken),
        payload: { title: 'Original', body: 'CORPO_ORIGINAL', professionalName: 'Dr. Original' },
      });
      expect(draft.statusCode).toBe(200);
      reportId = draft.json().id as string;

      if (opts.publish) {
        const published = await app.inject({
          method: 'POST',
          url: `/reports/${reportId}/publish`,
          headers: auth(f.staffToken),
        });
        expect(published.statusCode).toBe(200);
      }
    }

    return { f, appointmentId, reportId: reportId as string };
  }

  it('cancel x publish: nunca resulta em agendamento cancelado com laudo publicado', async () => {
    const { f, appointmentId, reportId } = await seed({ withReport: true });

    const [cancel, publish] = await Promise.all([
      app.inject({ method: 'POST', url: `/appointments/${appointmentId}/cancel`, headers: auth(f.staffToken) }),
      app.inject({ method: 'POST', url: `/reports/${reportId}/publish`, headers: auth(f.staffToken) }),
    ]);

    // Uma operacao vence a trava; a outra deve ser rejeitada pela revalidacao.
    expect([cancel.statusCode, publish.statusCode].sort()).toEqual([200, 409]);

    const stored = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { report: true },
    });
    expect(stored?.status === 'CANCELLED' && stored.report?.status === 'PUBLISHED').toBe(false);
  });

  it('publish x cancel: ordem invertida produz o mesmo invariante', async () => {
    const { f, appointmentId, reportId } = await seed({ withReport: true });

    const [publish, cancel] = await Promise.all([
      app.inject({ method: 'POST', url: `/reports/${reportId}/publish`, headers: auth(f.staffToken) }),
      app.inject({ method: 'POST', url: `/appointments/${appointmentId}/cancel`, headers: auth(f.staffToken) }),
    ]);

    expect([publish.statusCode, cancel.statusCode].sort()).toEqual([200, 409]);

    const stored = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { report: true },
    });
    expect(stored?.status === 'CANCELLED' && stored.report?.status === 'PUBLISHED').toBe(false);
  });

  it('upsert x upsert: no maximo um laudo e nenhum 500', async () => {
    const { f, appointmentId } = await seed({ withReport: false });

    const [a, b] = await Promise.all([
      app.inject({
        method: 'PUT',
        url: `/appointments/${appointmentId}/report`,
        headers: auth(f.staffToken),
        payload: { title: 'A', body: 'CORPO_A', professionalName: 'Dr. A' },
      }),
      app.inject({
        method: 'PUT',
        url: `/appointments/${appointmentId}/report`,
        headers: auth(f.staffToken),
        payload: { title: 'B', body: 'CORPO_B', professionalName: 'Dr. B' },
      }),
    ]);

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(await prisma.report.count({ where: { appointmentId } })).toBe(1);
  });

  it('upsert x publish: laudo publicado nunca e editado concorrentemente', async () => {
    const { f, appointmentId, reportId } = await seed({ withReport: true });

    const [upsert, publish] = await Promise.all([
      app.inject({
        method: 'PUT',
        url: `/appointments/${appointmentId}/report`,
        headers: auth(f.staffToken),
        payload: { title: 'Editado', body: 'CORPO_EDITADO', professionalName: 'Dr. Ed' },
      }),
      app.inject({ method: 'POST', url: `/reports/${reportId}/publish`, headers: auth(f.staffToken) }),
    ]);

    const saved = await prisma.report.findUnique({ where: { id: reportId } });
    expect(saved?.status).toBe('PUBLISHED');
    expect(publish.statusCode).toBe(200);

    if (upsert.statusCode === 409) {
      expect(upsert.json().error.code).toBe('REPORT_PUBLISHED');
      expect(saved?.body).toBe('CORPO_ORIGINAL');
    } else {
      expect(upsert.statusCode).toBe(200);
      // A edicao ganhou a trava e ocorreu ANTES da publicacao.
    }
  });

  it('upsert x cancel: nenhum laudo e gravado depois do cancelamento', async () => {
    const { f, appointmentId } = await seed({ withReport: false });

    const [upsert, cancel] = await Promise.all([
      app.inject({
        method: 'PUT',
        url: `/appointments/${appointmentId}/report`,
        headers: auth(f.staffToken),
        payload: { title: 'Tardio', body: 'CORPO_TARDIO', professionalName: 'Dr. Tardio' },
      }),
      app.inject({ method: 'POST', url: `/appointments/${appointmentId}/cancel`, headers: auth(f.staffToken) }),
    ]);

    expect([upsert.statusCode, cancel.statusCode].every((s) => s === 200 || s === 409)).toBe(true);

    const stored = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { report: true },
    });
    if (upsert.statusCode === 409) {
      expect(upsert.json().error.code).toBe('APPOINTMENT_CANCELLED');
      expect(stored?.report).toBeNull();
    }
    expect(stored?.report?.status).not.toBe('PUBLISHED');
  });
});
