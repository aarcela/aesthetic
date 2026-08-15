import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { FxFuente } from '@aesthetic/shared';
import { desc, eq, sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.module.js';
import { exchangeRates, tenants } from '../database/schema.js';
import type { DolarApiObservation } from './dolar-api.client.js';

@Injectable()
export class FxRepository {
  constructor(@Inject(DATABASE) private readonly db: Database | null) {}

  async saveObservation(observation: DolarApiObservation): Promise<void> {
    const db = this.requireDatabase();
    await db
      .insert(exchangeRates)
      .values({
        provider: 'DOLARAPI',
        fuente: observation.fuente,
        vesPerUsd: observation.vesPerUsd,
        providerUpdatedAt: observation.providerUpdatedAt,
        fetchedAt: observation.fetchedAt,
        rawPayload: observation.rawPayload,
      })
      .onConflictDoNothing({
        target: [
          exchangeRates.provider,
          exchangeRates.fuente,
          exchangeRates.providerUpdatedAt,
        ],
      });
  }

  async getLatestObservation(fuente: FxFuente): Promise<DolarApiObservation | null> {
    const db = this.requireDatabase();
    const [row] = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.fuente, fuente))
      .orderBy(desc(exchangeRates.fetchedAt))
      .limit(1);

    return row
      ? {
          fuente,
          vesPerUsd: row.vesPerUsd,
          providerUpdatedAt: row.providerUpdatedAt,
          fetchedAt: row.fetchedAt,
          rawPayload: row.rawPayload,
        }
      : null;
  }

  async getTenantFxFuente(tenantId: string): Promise<FxFuente> {
    const db = this.requireDatabase();
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
      );
      const [tenant] = await tx
        .select({ fuente: tenants.defaultFxFuente })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        throw new ServiceUnavailableException('Tenant FX settings are unavailable.');
      }
      return tenant.fuente as FxFuente;
    });
  }

  async setTenantFxFuente(tenantId: string, fuente: FxFuente): Promise<void> {
    const db = this.requireDatabase();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
      );
      await tx
        .update(tenants)
        .set({ defaultFxFuente: fuente, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));
    });
  }

  private requireDatabase(): Database {
    if (!this.db) {
      throw new ServiceUnavailableException({
        code: 'DATABASE_NOT_CONFIGURED',
        message: 'DATABASE_URL is required for persistent FX operations.',
      });
    }
    return this.db;
  }
}
