import { afterEach, describe, expect, it, vi } from 'vitest';

describe('configuracao', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('falha no carregamento quando CLINIC_TIMEZONE e invalido', async () => {
    vi.resetModules();
    vi.stubEnv('CLINIC_TIMEZONE', 'Invalido/Zona');

    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('PROCESS_EXIT_CALLED');
    }) as never);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(import('../src/config')).rejects.toThrow('PROCESS_EXIT_CALLED');

    expect(exit).toHaveBeenCalledWith(1);
    const message = consoleError.mock.calls.flat().join(' ');
    expect(message).toContain('CLINIC_TIMEZONE');
    expect(message).toContain('invalido');
  });
});
