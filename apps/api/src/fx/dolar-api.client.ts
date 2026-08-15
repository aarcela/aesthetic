import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  dollarApiRatesSchema,
  type FxFuente,
  type FxRateSnapshot,
} from '@aesthetic/shared';
import { z } from 'zod';

const DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares';

export type DolarApiObservation = FxRateSnapshot & {
  rawPayload: unknown;
};

@Injectable()
export class DolarApiClient {
  async fetchRates(): Promise<Map<FxFuente, DolarApiObservation>> {
    let payload: unknown;

    try {
      const response = await fetch(DOLAR_API_URL, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        throw new Error(`DolarApi returned ${response.status}.`);
      }

      payload = await response.json();
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'FX_PROVIDER_UNAVAILABLE',
        message: 'No fue posible obtener tasas de DolarApi.',
        cause: error instanceof Error ? error.message : undefined,
      });
    }

    const result = dollarApiRatesSchema.safeParse(payload);
    if (!result.success) {
      throw new ServiceUnavailableException({
        code: 'FX_PROVIDER_INVALID_RESPONSE',
        message: 'DolarApi devolvió una respuesta inválida.',
        details: z.treeifyError(result.error),
      });
    }

    const observations = new Map<FxFuente, DolarApiObservation>();
    for (const rate of result.data) {
      observations.set(rate.fuente, {
        fuente: rate.fuente,
        vesPerUsd: rate.promedio.toFixed(6),
        providerUpdatedAt: new Date(rate.fechaActualizacion),
        fetchedAt: new Date(),
        rawPayload: rate,
      });
    }

    for (const fuente of ['oficial', 'paralelo'] as const) {
      if (!observations.has(fuente)) {
        throw new ServiceUnavailableException({
          code: 'FX_PROVIDER_MISSING_SOURCE',
          message: `DolarApi no devolvió la tasa ${fuente}.`,
        });
      }
    }

    return observations;
  }
}
