import { PrismaClient, type Prisma } from '@prisma/client';

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

/**
 * Trava a linha do Appointment dentro de uma transacao interativa.
 *
 * cancelAppointment, publishReport e upsertDraftReport adquirem esta trava
 * como PRIMEIRA operacao da transacao. Como todos travam a mesma linha "pai",
 * as tres maquinas de estado ficam serializadas entre si: apos a espera, a
 * releitura feita com `tx` ve o estado ja comitado pela requisicao anterior.
 * Isso elimina a janela read -> check -> write entre cancel/publish/upsert
 * sem exigir qualquer mudanca de schema.
 */
export async function lockAppointment(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${id} FOR UPDATE`;
}
