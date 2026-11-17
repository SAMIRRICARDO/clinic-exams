import { beforeAll, afterAll, beforeEach } from 'vitest';

// DATABASE_URL e NODE_ENV ja foram fixados em vitest.config.ts (`test.env`),
// antes de este modulo (e o PrismaClient) ser carregado. Aqui apenas
// confirmamos que o apontamento e para o banco de TESTES, como rede de
// seguranca: nunca queremos uma suite rodando contra o banco de dev.
if (process.env.NODE_ENV !== 'test') {
  throw new Error('NODE_ENV deveria ser "test" durante a suite.');
}
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error(
    `A suite aponta para um banco que nao parece ser de teste: ${process.env.DATABASE_URL}`,
  );
}
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-com-pelo-menos-16-chars';

import { prisma } from '../src/db';
import { hashPassword } from '../src/auth';
import { clinicLocalToUtc } from '../src/time';

export const TEST_PASSWORD = 'senha-teste-123';

export interface TestFixtures {
  staffId: string;
  staffToken: string;
  patientA: { userId: string; patientId: string; token: string };
  patientB: { userId: string; patientId: string; token: string };
  examTypes: { id: string; code: string }[];
}

let fixtures: TestFixtures;

export function getFixtures(): TestFixtures {
  return fixtures;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Limpa apenas as tabelas de negocio, preservando a estrutura.
  await prisma.report.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.examType.deleteMany();

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const staff = await prisma.user.create({
    data: { email: 'staff@test.com', name: 'Staff Teste', passwordHash, role: 'STAFF' },
  });

  const mkPatient = async (email: string, name: string, doc: string) => {
    const user = await prisma.user.create({
      data: { email, name, passwordHash, role: 'PATIENT' },
    });
    const patient = await prisma.patient.create({
      data: { userId: user.id, fullName: name, document: doc },
    });
    return { userId: user.id, patientId: patient.id };
  };

  const pA = await mkPatient('ana@test.com', 'Ana Teste', '000.000.000-01');
  const pB = await mkPatient('bruno@test.com', 'Bruno Teste', '000.000.000-02');

  const examTypes = await Promise.all(
    [
      { code: 'RAIO_X', name: 'Raio-X' },
      { code: 'ULTRASSOM', name: 'Ultrassom' },
      { code: 'RESSONANCIA', name: 'Ressonancia Magnetica' },
    ].map((e) => prisma.examType.create({ data: { ...e, durationMinutes: 30 } })),
  );

  // Tokens reais assinados com o mesmo segredo da API.
  const { signToken } = await import('../src/auth');
  fixtures = {
    staffId: staff.id,
    staffToken: signToken({ sub: staff.id, role: 'STAFF', email: staff.email, name: staff.name }),
    patientA: {
      ...pA,
      token: signToken({ sub: pA.userId, role: 'PATIENT', email: 'ana@test.com', name: 'Ana Teste' }),
    },
    patientB: {
      ...pB,
      token: signToken({ sub: pB.userId, role: 'PATIENT', email: 'bruno@test.com', name: 'Bruno Teste' }),
    },
    examTypes: examTypes.map((e) => ({ id: e.id, code: e.code })),
  };
});

/** Retorna um horario futuro alinhado a grade de 30 min, no fuso da clinica. */
export function futureSlot(daysAhead = 3, hour = 9, minute = 0): Date {
  const base = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return clinicLocalToUtc(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    hour,
    minute,
  );
}

export { prisma };
