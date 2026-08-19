import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { idempotencyKeys } from '../database/schema.js';
import { TenantDb } from '../database/tenant-db.js';

@Injectable()
export class IdempotencyService {
  constructor(@Inject(TenantDb) private readonly tenantDb: TenantDb) {}

  hashRequest(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  }

  async find(tenantId: string, key: string) {
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.tenantId, tenantId),
            eq(idempotencyKeys.key, key),
          ),
        )
        .limit(1);
      return row ?? null;
    });
  }

  async save(input: {
    tenantId: string;
    key: string;
    route: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
  }) {
    return this.tenantDb.withTenant(input.tenantId, async (tx) => {
      const [row] = await tx
        .insert(idempotencyKeys)
        .values({
          tenantId: input.tenantId,
          key: input.key,
          route: input.route,
          requestHash: input.requestHash,
          responseStatus: input.responseStatus,
          responseBody: input.responseBody as object,
        })
        .onConflictDoNothing()
        .returning();
      return row;
    });
  }
}
