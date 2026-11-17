import { describe, it, expect } from 'vitest';
import {
  clinicDayKey,
  clinicDayRange,
  clinicLocalToUtc,
  formatInClinicTz,
  generateDaySlots,
  isAlignedToSlot,
  utcToClinicParts,
} from '../src/time';

/**
 * Testes unitarios dos utilitarios de fuso horario.
 * Fuso adotado: America/Sao_Paulo (UTC-3, sem horario de verao desde 2019).
 */
describe('Utilitarios de fuso horario', () => {
  it('converte 09:00 local da clinica para 12:00 UTC', () => {
    const utc = clinicLocalToUtc(2026, 12, 1, 9, 0);
    expect(utc.toISOString()).toBe('2026-12-01T12:00:00.000Z');
  });

  it('formata um instante UTC com offset -03:00', () => {
    const utc = new Date('2026-12-01T12:00:00.000Z');
    expect(formatInClinicTz(utc)).toBe('2026-12-01T09:00:00-03:00');
  });

  it('extrai componentes locais corretamente', () => {
    const utc = new Date('2026-12-01T12:30:00.000Z');
    const p = utcToClinicParts(utc);
    expect(p).toMatchObject({ year: 2026, month: 12, day: 1, hour: 9, minute: 30 });
  });

  it('gera 20 slots de 30 min entre 08:00 e 18:00', () => {
    const slots = generateDaySlots('2026-12-01');
    expect(slots).toHaveLength(20);
    expect(formatInClinicTz(slots[0])).toBe('2026-12-01T08:00:00-03:00');
    expect(formatInClinicTz(slots[slots.length - 1])).toBe('2026-12-01T17:30:00-03:00');
  });

  it('o intervalo do dia cobre exatamente 24h no fuso da clinica', () => {
    const { start, end } = clinicDayRange('2026-12-01');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(formatInClinicTz(start)).toBe('2026-12-01T00:00:00-03:00');
  });

  it('a chave do dia respeita o fuso da clinica (nao UTC)', () => {
    // 2026-12-02T01:00Z = 2026-12-01T22:00 em Sao Paulo
    const utc = new Date('2026-12-02T01:00:00.000Z');
    expect(clinicDayKey(utc)).toBe('2026-12-01');
  });

  it('valida alinhamento a grade de 30 minutos', () => {
    expect(isAlignedToSlot(new Date('2026-12-01T12:00:00.000Z'))).toBe(true);
    expect(isAlignedToSlot(new Date('2026-12-01T12:30:00.000Z'))).toBe(true);
    expect(isAlignedToSlot(new Date('2026-12-01T12:15:00.000Z'))).toBe(false);
  });
});
