import { afterEach, describe, expect, it, vi } from 'vitest';

import { DolarApiClient } from '../src/fx/dolar-api.client.js';

const validPayload = [
  {
    moneda: 'USD',
    fuente: 'oficial',
    nombre: 'Dólar',
    compra: null,
    venta: null,
    promedio: 100.1234,
    fechaActualizacion: '2026-08-15T10:00:00-04:00',
  },
  {
    moneda: 'USD',
    fuente: 'paralelo',
    nombre: 'Paralelo',
    compra: null,
    venta: null,
    promedio: 110.9876,
    fechaActualizacion: '2026-08-15T10:01:00-04:00',
  },
];

describe('DolarApiClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps oficial and paralelo using promedio, not null compra/venta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(validPayload), { status: 200 }),
      ),
    );

    const rates = await new DolarApiClient().fetchRates();

    expect(rates.get('oficial')).toMatchObject({ vesPerUsd: '100.123400' });
    expect(rates.get('paralelo')).toMatchObject({ vesPerUsd: '110.987600' });
  });

  it('rejects invalid or non-positive DolarApi averages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { ...validPayload[0], promedio: 0 },
            validPayload[1],
          ]),
          { status: 200 },
        ),
      ),
    );

    await expect(new DolarApiClient().fetchRates()).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        code: 'FX_PROVIDER_INVALID_RESPONSE',
      }),
    });
  });

  it('fails when an expected source is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([validPayload[0]]), { status: 200 }),
      ),
    );

    await expect(new DolarApiClient().fetchRates()).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        code: 'FX_PROVIDER_MISSING_SOURCE',
      }),
    });
  });
});
