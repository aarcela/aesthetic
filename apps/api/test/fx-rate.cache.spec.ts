import { describe, expect, it } from 'vitest';

import { FxRateCache } from '../src/fx/fx-rate.cache.js';

describe('FxRateCache', () => {
  it('uses the in-memory fallback when REDIS_URL is not configured', async () => {
    const previous = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    const cache = new FxRateCache();

    await cache.set({
      fuente: 'oficial',
      vesPerUsd: '123.456000',
      providerUpdatedAt: new Date('2026-08-15T10:00:00.000Z'),
      fetchedAt: new Date('2026-08-15T10:01:00.000Z'),
    });

    await expect(cache.get('oficial')).resolves.toMatchObject({
      fuente: 'oficial',
      vesPerUsd: '123.456000',
    });

    if (previous) process.env.REDIS_URL = previous;
  });
});
