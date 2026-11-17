import 'dotenv/config';
import { z } from 'zod';

/** Valida identificador IANA usando apenas o Intl nativo do Node. */
function isIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatoria'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  CLINIC_TIMEZONE: z
    .string()
    .default('America/Sao_Paulo')
    .refine(isIanaTimeZone, 'CLINIC_TIMEZONE invalido: identificador IANA nao reconhecido (ex.: America/Sao_Paulo)'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nConfiguracao invalida. Verifique seu arquivo .env:\n${issues}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  isTest: parsed.data.NODE_ENV === 'test',
};
