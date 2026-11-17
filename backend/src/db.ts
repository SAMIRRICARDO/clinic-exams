import { PrismaClient } from '@prisma/client';

/**
 * Instancia unica do PrismaClient.
 * Em ambiente de teste o DATABASE_URL aponta para o banco de testes
 * (ver tests/setup.ts), garantindo isolamento total do banco de dev.
 */
export const prisma = new PrismaClient({
  // Em teste nao logamos erros: o teste de concorrencia provoca de proposito
  // uma violacao de constraint unica, e o ruido no log confunde a leitura.
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
});
