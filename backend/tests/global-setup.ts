import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Prepara o banco de testes uma unica vez por execucao:
 * aplica as migrations do zero no TEST_DATABASE_URL.
 */
export default function globalSetup(): void {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL nao definida. Copie .env.example para .env.');
  }

  const root = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: testUrl };

  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: root,
    env,
    stdio: 'pipe',
  });

  if (!existsSync(path.join(root, 'node_modules', '.prisma', 'client'))) {
    execSync('npx prisma generate', { cwd: root, env, stdio: 'pipe' });
  }
}
