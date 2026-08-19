import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE, type Database } from './database.tokens.js';

type TenantTx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class TenantDb {
  constructor(@Inject(DATABASE) private readonly db: Database | null) {}

  async withTenant<T>(tenantId: string, work: (tx: TenantTx) => Promise<T>): Promise<T> {
    const db = this.requireDatabase();
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
      );
      return work(tx);
    });
  }

  private requireDatabase(): Database {
    if (!this.db) {
      throw new ServiceUnavailableException({
        code: 'DATABASE_NOT_CONFIGURED',
        message: 'DATABASE_URL is required.',
      });
    }
    return this.db;
  }
}
