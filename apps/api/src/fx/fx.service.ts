import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { FxFuente, FxRateSnapshot } from '@aesthetic/shared';

import { DolarApiClient, type DolarApiObservation } from './dolar-api.client.js';
import { FxRateCache } from './fx-rate.cache.js';
import { FxRepository } from './fx.repository.js';

const MAX_RATE_AGE_MS = 10 * 60 * 1_000;
const SOURCES: FxFuente[] = ['oficial', 'paralelo'];

@Injectable()
export class FxService {
  constructor(
    private readonly dolarApi: DolarApiClient,
    private readonly cache: FxRateCache,
    private readonly repository: FxRepository,
  ) {}

  async getCurrentRates(): Promise<Record<FxFuente, FxRateSnapshot>> {
    const cached = await Promise.all(SOURCES.map((fuente) => this.cache.get(fuente)));

    if (cached.every((rate) => rate && this.isFresh(rate))) {
      return this.toRecord(cached as FxRateSnapshot[]);
    }

    return this.refreshRates();
  }

  async refreshRates(): Promise<Record<FxFuente, FxRateSnapshot>> {
    const observations = await this.dolarApi.fetchRates();

    await Promise.all(
      SOURCES.map(async (fuente) => {
        const observation = observations.get(fuente);
        if (!observation) {
          throw this.missingRate(fuente);
        }
        await this.repository.saveObservation(observation);
        await this.cache.set(observation);
      }),
    );

    return this.toRecord(
      SOURCES.map((fuente) => {
        const observation = observations.get(fuente);
        if (!observation) throw this.missingRate(fuente);
        return observation;
      }),
    );
  }

  async getTenantRateView(tenantId: string): Promise<{
    selectedFuente: FxFuente;
    rates: Record<FxFuente, FxRateSnapshot>;
  }> {
    const [selectedFuente, rates] = await Promise.all([
      this.repository.getTenantFxFuente(tenantId),
      this.getCurrentRates(),
    ]);
    return { selectedFuente, rates };
  }

  async updateTenantSource(tenantId: string, fuente: FxFuente): Promise<FxRateSnapshot> {
    await this.repository.setTenantFxFuente(tenantId, fuente);
    return this.getRateSnapshotForFuente(fuente);
  }

  /**
   * Returns a value object intended to be copied into a sale exactly once at
   * posting time. Later refreshes never mutate an existing sale's fields.
   */
  async createSaleSnapshot(tenantId: string): Promise<FxRateSnapshot> {
    const fuente = await this.repository.getTenantFxFuente(tenantId);
    return this.getRateSnapshotForFuente(fuente);
  }

  private async getRateSnapshotForFuente(fuente: FxFuente): Promise<FxRateSnapshot> {
    const rates = await this.getCurrentRates();
    const rate = rates[fuente];
    if (!rate || !this.isFresh(rate)) {
      throw this.missingRate(fuente);
    }
    return { ...rate };
  }

  private isFresh(rate: FxRateSnapshot): boolean {
    return Date.now() - rate.fetchedAt.getTime() <= MAX_RATE_AGE_MS;
  }

  private missingRate(fuente: FxFuente): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'FX_RATE_STALE_OR_MISSING',
      message: `No hay una tasa ${fuente} reciente disponible.`,
    });
  }

  private toRecord(rates: FxRateSnapshot[]): Record<FxFuente, FxRateSnapshot> {
    const record = {} as Record<FxFuente, FxRateSnapshot>;
    for (const rate of rates) {
      record[rate.fuente] = { ...rate };
    }
    return record;
  }
}
