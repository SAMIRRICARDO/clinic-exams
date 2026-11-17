import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { clinicLocalToUtc } from './time';

const prisma = new PrismaClient();

/**
 * Seed de dados ficticios.
 * Contas de demonstracao (senha unica: demo1234):
 *   staff@clinica.com      -> equipe da clinica
 *   ana.souza@email.com    -> paciente
 *   bruno.lima@email.com   -> paciente
 *   carla.mendes@email.com -> paciente
 */
const DEMO_PASSWORD = 'demo1234';

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- Tipos de exame (RN01: 30 min para todos) ----
  const examTypes = [
    { code: 'RAIO_X', name: 'Raio-X', durationMinutes: 30 },
    { code: 'ULTRASSOM', name: 'Ultrassom', durationMinutes: 30 },
    { code: 'RESSONANCIA', name: 'Ressonancia Magnetica', durationMinutes: 30 },
  ];
  for (const et of examTypes) {
    await prisma.examType.upsert({ where: { code: et.code }, update: et, create: et });
  }

  // ---- Equipe da clinica ----
  const staff = await prisma.user.upsert({
    where: { email: 'staff@clinica.com' },
    update: {},
    create: {
      email: 'staff@clinica.com',
      name: 'Dra. Helena Prado',
      passwordHash,
      role: 'STAFF',
    },
  });

  // ---- Pacientes ----
  const patientsData = [
    { email: 'ana.souza@email.com', name: 'Ana Souza', document: '111.222.333-44', birth: [1990, 4, 12] },
    { email: 'bruno.lima@email.com', name: 'Bruno Lima', document: '555.666.777-88', birth: [1985, 9, 3] },
    { email: 'carla.mendes@email.com', name: 'Carla Mendes', document: '999.888.777-66', birth: [1998, 1, 27] },
  ] as const;

  const patients: { id: string; fullName: string }[] = [];
  for (const p of patientsData) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: { email: p.email, name: p.name, passwordHash, role: 'PATIENT' },
    });
    const patient = await prisma.patient.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        fullName: p.name,
        document: p.document,
        birthDate: new Date(Date.UTC(p.birth[0], p.birth[1] - 1, p.birth[2])),
      },
    });
    patients.push({ id: patient.id, fullName: patient.fullName });
  }

  const types = await prisma.examType.findMany();
  const byCode = (code: string) => types.find((t) => t.code === code)!;

  // ---- Agendamentos de exemplo (dias futuros, fuso da clinica) ----
  const today = new Date();
  const base = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = base.getUTCDate();

  const existing = await prisma.appointment.count();
  if (existing === 0) {
    const a1 = await prisma.appointment.create({
      data: {
        patientId: patients[0].id,
        examTypeId: byCode('RAIO_X').id,
        scheduledAt: clinicLocalToUtc(y, m, d, 9, 0),
        createdByUserId: staff.id,
      },
    });
    const a2 = await prisma.appointment.create({
      data: {
        patientId: patients[1].id,
        examTypeId: byCode('ULTRASSOM').id,
        scheduledAt: clinicLocalToUtc(y, m, d, 10, 30),
        createdByUserId: staff.id,
      },
    });
    const a3 = await prisma.appointment.create({
      data: {
        patientId: patients[2].id,
        examTypeId: byCode('RESSONANCIA').id,
        scheduledAt: clinicLocalToUtc(y, m, d, 14, 0),
        createdByUserId: staff.id,
      },
    });

    // Laudo publicado (Ana) - visivel no portal do paciente
    await prisma.report.create({
      data: {
        appointmentId: a1.id,
        title: 'Raio-X de torax - resultado',
        body:
          'Radiografia de torax em PA e perfil. Campos pulmonares sem opacidades focais. ' +
          'Seios costofrenicos livres. Silhueta cardiaca de dimensoes normais. ' +
          'Estruturas osseas sem alteracoes significativas.\n\nConclusao: exame sem alteracoes relevantes.',
        professionalName: 'Dr. Ricardo Alves - CRM 12345',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // Laudo em rascunho (Bruno) - NAO visivel no portal do paciente
    await prisma.report.create({
      data: {
        appointmentId: a2.id,
        title: 'Ultrassom abdominal total',
        body:
          'Figado de dimensoes normais, contornos regulares, ecotextura homogenea. ' +
          'Vesicula biliar sem calculos. Rins de aspecto habitual.\n\n' +
          '(RASCUNHO - em revisao pelo profissional responsavel)',
        professionalName: 'Dra. Helena Prado - CRM 67890',
        status: 'DRAFT',
      },
    });

    // a3 fica sem laudo, para demonstrar o fluxo de criacao
    void a3;
  }

  // eslint-disable-next-line no-console
  console.log('Seed concluido.');
  // eslint-disable-next-line no-console
  console.log(`Contas de demonstracao (senha: ${DEMO_PASSWORD}):`);
  // eslint-disable-next-line no-console
  console.log('  staff@clinica.com | ana.souza@email.com | bruno.lima@email.com | carla.mendes@email.com');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
