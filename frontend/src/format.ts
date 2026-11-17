/**
 * Formatacao de datas no fuso da clinica.
 *
 * O fuso e obtido do backend (GET /health -> CLINIC_TIMEZONE) no bootstrap da
 * aplicacao. Ate a resposta chegar - e apenas se a API estiver indisponivel -
 * usamos America/Sao_Paulo como fallback de inicializacao. O backend envia
 * scheduledAtIso/timeLabel/dayKey prontos; aqui apenas apresentamos datas.
 */

/** Fallback de inicializacao: usado somente antes do /health responder. */
const FALLBACK_CLINIC_TZ = 'America/Sao_Paulo';

let clinicTimezone = FALLBACK_CLINIC_TZ;
let clinicTimezoneLoaded = false;

interface ClinicFormatters {
  date: Intl.DateTimeFormat;
  longDate: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  dateTime: Intl.DateTimeFormat;
  today: Intl.DateTimeFormat;
}

function makeFormatters(timeZone: string): ClinicFormatters {
  return {
    date: new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    longDate: new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    }),
    time: new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    dateTime: new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    today: new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
  };
}

let formatters = makeFormatters(clinicTimezone);

/** Fuso da clinica em uso (informado pelo backend ou fallback). */
export function getClinicTimezone(): string {
  return clinicTimezone;
}

/** Indica se o fuso ja veio do backend (false apenas no fallback). */
export function isClinicTimezoneLoaded(): boolean {
  return clinicTimezoneLoaded;
}

/** Aplica o fuso informado pelo backend e reconstrui os formatadores. */
export function setClinicTimezone(timeZone: string): void {
  if (!timeZone) return;
  if (clinicTimezoneLoaded && timeZone === clinicTimezone) return;
  // Constroi/valida primeiro: makeFormatters lanca para uma zona IANA invalida.
  // Assim nenhum estado e mutado e o fallback permanece integral.
  const nextFormatters = makeFormatters(timeZone);
  clinicTimezone = timeZone;
  clinicTimezoneLoaded = true;
  formatters = nextFormatters;
}

export const formatDate = (iso: string): string => formatters.date.format(new Date(iso));
export const formatLongDate = (iso: string): string => formatters.longDate.format(new Date(iso));
export const formatTime = (iso: string): string => formatters.time.format(new Date(iso));
export const formatDateTime = (iso: string): string => formatters.dateTime.format(new Date(iso));

/** Chave YYYY-MM-DD de hoje no fuso da clinica. */
export function todayKey(): string {
  return formatters.today.format(new Date());
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

const longDayKeyFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});

/**
 * Rotulo longo de uma chave YYYY-MM-DD ja expressa no fuso da clinica.
 * Nao converte fuso nem introduz offset artificial: a chave e uma data civil.
 */
export function formatLongDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return longDayKeyFmt.format(new Date(Date.UTC(y, m - 1, d, 12)));
}
