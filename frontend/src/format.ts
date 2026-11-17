/**
 * Formatacao de datas no fuso da clinica (America/Sao_Paulo).
 * O backend ja envia scheduledAtIso com offset -03:00; aqui apenas
 * apresentamos de forma legivel, sempre no mesmo fuso.
 */

export const CLINIC_TZ = 'America/Sao_Paulo';

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CLINIC_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const longDateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CLINIC_TZ,
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});

const timeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CLINIC_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CLINIC_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const formatDate = (iso: string): string => dateFmt.format(new Date(iso));
export const formatLongDate = (iso: string): string => longDateFmt.format(new Date(iso));
export const formatTime = (iso: string): string => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso));

/** Chave YYYY-MM-DD de hoje no fuso da clinica. */
export function todayKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA ja retorna YYYY-MM-DD
}

/** Soma dias a uma chave YYYY-MM-DD. */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Rotulo curto de um dia (ex.: "seg, 01/12"). */
export function dayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(dt);
}
