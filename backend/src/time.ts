import { env } from './config';

/**
 * Utilitarios de fuso horario.
 *
 * Decisao: TODAS as datas sao persistidas em UTC (coluna TIMESTAMPTZ).
 * A clinica opera em America/Sao_Paulo (UTC-3, sem horario de verao desde 2019).
 * A conversao para o fuso da clinica acontece na borda: ao gerar os slots
 * disponiveis e ao formatar a resposta para o cliente.
 */

export const CLINIC_TZ = env.CLINIC_TIMEZONE;

/** Offset em minutos do fuso da clinica para um instante UTC. */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second'),
  );
  // Zera os milissegundos: o offset e sempre um numero inteiro de minutos.
  const base = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - base) / 60000);
}

/**
 * Converte uma data/hora "de parede" no fuso da clinica para o instante UTC.
 * Ex.: 2026-12-01 09:00 em America/Sao_Paulo -> 2026-12-01T12:00:00.000Z
 */
export function clinicLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Duas passadas resolvem o offset mesmo em transicoes de horario de verao.
  let guess = new Date(naive - tzOffsetMinutes(new Date(naive), CLINIC_TZ) * 60000);
  const offset2 = tzOffsetMinutes(guess, CLINIC_TZ);
  guess = new Date(naive - offset2 * 60000);
  return guess;
}

/** Extrai os componentes de data/hora de um instante UTC no fuso da clinica. */
export function utcToClinicParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) === 24 ? 0 : Number(get('hour')),
    minute: Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/** Formata um instante UTC como string ISO com offset da clinica (ex.: 2026-12-01T09:00:00-03:00). */
export function formatInClinicTz(date: Date): string {
  const p = utcToClinicParts(date);
  const offset = tzOffsetMinutes(date, CLINIC_TZ);
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00${sign}${hh}:${mm}`;
}

/** Chave de dia no fuso da clinica (YYYY-MM-DD) - usada para agrupar/filtrar. */
export function clinicDayKey(date: Date): string {
  const p = utcToClinicParts(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Intervalo [inicio, fim) em UTC que cobre um dia inteiro no fuso da clinica. */
export function clinicDayRange(dayKey: string): { start: Date; end: Date } {
  const [y, m, d] = dayKey.split('-').map(Number);
  const start = clinicLocalToUtc(y, m, d, 0, 0);
  const end = clinicLocalToUtc(y, m, d + 1, 0, 0);
  return { start, end };
}

/**
 * Gera os horarios fixos de 30 minutos de um dia (RN01: sala unica).
 * Grade de 08:00 as 18:00, ultimo inicio 17:30.
 */
export const SLOT_MINUTES = 30;
export const OPENING_HOUR = 8;
export const CLOSING_HOUR = 18;

export function generateDaySlots(dayKey: string): Date[] {
  const [y, m, d] = dayKey.split('-').map(Number);
  const slots: Date[] = [];
  for (let minutes = OPENING_HOUR * 60; minutes < CLOSING_HOUR * 60; minutes += SLOT_MINUTES) {
    slots.push(clinicLocalToUtc(y, m, d, Math.floor(minutes / 60), minutes % 60));
  }
  return slots;
}

/** Normaliza um instante para o inicio do slot de 30 min (em UTC). */
export function floorToSlot(date: Date): Date {
  const ms = SLOT_MINUTES * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

/** Verifica se o instante esta alinhado a grade de 30 minutos. */
export function isAlignedToSlot(date: Date): boolean {
  return date.getTime() % (SLOT_MINUTES * 60 * 1000) === 0;
}
