import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config();

/**
 * As variaveis de ambiente precisam ser definidas AQUI, antes de qualquer
 * arquivo de teste carregar o PrismaClient. Definir DATABASE_URL dentro de um
 * setupFile nao funciona: os `import` sao hoisted para o topo do modulo
 * compilado, entao `import { prisma } from '../src/db'` executaria antes da
 * atribuicao e o Prisma seria construido com o banco de DESENVOLVIMENTO.
 * Esse era o bug que fazia os dados de teste vazarem para o banco de dev.
 */
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL nao definida. Copie backend/.env.example para backend/.env.');
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Aplicadas antes de os arquivos de teste serem importados.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testUrl,
    },
    // Os testes de concorrencia precisam de conexoes reais e paralelas;
    // rodamos os arquivos em sequencia para evitar disputa entre suites.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
