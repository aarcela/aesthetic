import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { assertTenantManager } from '../src/tenants/tenant-context.js';
import { FxRateCache } from '../src/fx/fx-rate.cache.js';
import { FxService } from '../src/fx/fx.service.js';

const now = new Date();

function observation(
  fuente: 'oficial' | 'paralelo',
  vesPerUsd: string,
) {
  return {
    fuente,
    vesPerUsd,
    providerUpdatedAt: now,
    fetchedAt: now,
    rawPayload: { fuente, promedio: Number(vesPerUsd) },
  };
}

function createService(selectedFuente: 'oficial' | 'paralelo' = 'oficial') {
  const observations = new Map([
    ['oficial', observation('oficial', '100.000000')],
    ['paralelo', observation('paralelo', '110.000000')],
  ]);
  const dolarApi = { fetchRates: vi.fn().mockResolvedValue(observations) };
  const repository = {
    saveObservation: vi.fn().mockResolvedValue(undefined),
    getTenantFxFuente: vi.fn().mockResolvedValue(selectedFuente),
    setTenantFxFuente: vi.fn().mockResolvedValue(undefined),
  };
  const cache = new FxRateCache();

  return {
    service: new FxService(dolarApi as never, cache, repository as never),
    repository,
    cache,
  };
}

describe('FxService', () => {
  it('uses each tenant selected source when producing financial snapshots', async () => {
    const official = createService('oficial');
    const parallel = createService('paralelo');

    await expect(official.service.createSaleSnapshot('tenant-a')).resolves.toMatchObject({
      fuente: 'oficial',
      vesPerUsd: '100.000000',
    });
    await expect(parallel.service.createSaleSnapshot('tenant-b')).resolves.toMatchObject({
      fuente: 'paralelo',
      vesPerUsd: '110.000000',
    });
  });

  it('returns immutable value objects after later rate refreshes', async () => {
    const { service, cache } = createService('oficial');
    const initial = await service.createSaleSnapshot('tenant-a');

    await cache.set({
      fuente: 'oficial',
      vesPerUsd: '200.000000',
      providerUpdatedAt: new Date(),
      fetchedAt: new Date(),
    });

    expect(initial.vesPerUsd).toBe('100.000000');
    expect(initial).not.toBe(await service.createSaleSnapshot('tenant-a'));
  });

  it('rejects non-manager roles from changing the source', () => {
    expect(() =>
      assertTenantManager({ tenantId: 'tenant-a', role: 'RECEPTIONIST' }),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertTenantManager({ tenantId: 'tenant-a', role: 'SPECIALIST' }),
    ).toThrow(ForbiddenException);
  });
});
