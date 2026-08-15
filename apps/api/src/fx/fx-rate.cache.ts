import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { FxFuente, FxRateSnapshot } from '@aesthetic/shared';
import { Redis } from 'ioredis';

const CACHE_TTL_SECONDS = 300;

type CachedRate = {
  fuente: FxFuente;
  vesPerUsd: string;
  providerUpdatedAt: string;
  fetchedAt: string;
};

@Injectable()
export class FxRateCache implements OnModuleDestroy {
  private readonly logger = new Logger(FxRateCache.name);
  private readonly memory = new Map<FxFuente, CachedRate>();
  private readonly redis?: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    }
  }

  async get(fuente: FxFuente): Promise<FxRateSnapshot | null> {
    const key = this.key(fuente);
    const serialized = await this.getRedis(key);
    const cached = serialized ? this.parse(serialized) : this.memory.get(fuente);

    if (!cached) {
      return null;
    }

    return {
      fuente: cached.fuente,
      vesPerUsd: cached.vesPerUsd,
      providerUpdatedAt: new Date(cached.providerUpdatedAt),
      fetchedAt: new Date(cached.fetchedAt),
    };
  }

  async set(snapshot: FxRateSnapshot): Promise<void> {
    const cached: CachedRate = {
      fuente: snapshot.fuente,
      vesPerUsd: snapshot.vesPerUsd,
      providerUpdatedAt: snapshot.providerUpdatedAt.toISOString(),
      fetchedAt: snapshot.fetchedAt.toISOString(),
    };

    this.memory.set(snapshot.fuente, cached);
    await this.setRedis(this.key(snapshot.fuente), JSON.stringify(cached));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  private key(fuente: FxFuente): string {
    return `aesthetic:fx:dolarapi:${fuente}`;
  }

  private parse(serialized: string): CachedRate | null {
    try {
      const parsed = JSON.parse(serialized) as CachedRate;
      if (
        (parsed.fuente !== 'oficial' && parsed.fuente !== 'paralelo') ||
        !Number.isFinite(Number(parsed.vesPerUsd)) ||
        Number(parsed.vesPerUsd) <= 0 ||
        Number.isNaN(Date.parse(parsed.providerUpdatedAt)) ||
        Number.isNaN(Date.parse(parsed.fetchedAt))
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async getRedis(key: string): Promise<string | null> {
    if (!this.redis) return null;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`Redis unavailable; using in-memory FX cache: ${String(error)}`);
      return null;
    }
  }

  private async setRedis(key: string, value: string): Promise<void> {
    if (!this.redis) return;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await this.redis.set(key, value, 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Redis unavailable; retained FX rate in memory: ${String(error)}`);
    }
  }
}
