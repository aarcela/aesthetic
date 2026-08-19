import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';

import {
  commissionEntries,
  commissionRules,
} from '../database/schema.js';
import { TenantDb } from '../database/tenant-db.js';
import { PlansService } from '../plans/plans.service.js';
import { roundMoney } from '../pos/payment-math.js';
import { assertOperationsManager, type TenantContext } from '../tenants/tenant-context.js';

@Injectable()
export class CommissionsService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(PlansService) private readonly plans: PlansService,
  ) {}

  async listRules(tenantId: string) {
    await this.plans.assertFeature(tenantId, 'commissions');
    return this.tenantDb.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(commissionRules)
        .where(
          and(
            eq(commissionRules.tenantId, tenantId),
            eq(commissionRules.isActive, true),
          ),
        )
        .orderBy(asc(commissionRules.priority)),
    );
  }

  async createRule(
    context: TenantContext,
    input: {
      specialistMembershipId?: string;
      serviceId?: string;
      ruleType: 'PERCENT_GROSS' | 'PERCENT_NET_MATERIALS' | 'FLAT';
      ratePercent?: number;
      flatUsd?: number;
      priority?: number;
    },
  ) {
    assertOperationsManager(context);
    await this.plans.assertFeature(context.tenantId, 'commissions');
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .insert(commissionRules)
        .values({
          tenantId: context.tenantId,
          specialistMembershipId: input.specialistMembershipId,
          serviceId: input.serviceId,
          ruleType: input.ruleType,
          ratePercent:
            input.ratePercent === undefined
              ? undefined
              : input.ratePercent.toFixed(4),
          flatUsd:
            input.flatUsd === undefined ? undefined : input.flatUsd.toFixed(2),
          priority: input.priority ?? 100,
        })
        .returning();
      return row;
    });
  }

  async report(tenantId: string, from: string, to: string) {
    await this.plans.assertFeature(tenantId, 'commissions');
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(commissionEntries)
        .where(
          and(
            eq(commissionEntries.tenantId, tenantId),
            gte(commissionEntries.createdAt, new Date(from)),
            lte(commissionEntries.createdAt, new Date(to)),
          ),
        )
        .orderBy(desc(commissionEntries.createdAt));

      const total = rows.reduce(
        (sum, row) => sum + Number(row.commissionUsd),
        0,
      );
      return {
        from,
        to,
        totalCommissionUsd: roundMoney(total).toFixed(2),
        entries: rows,
      };
    });
  }

  async createEntriesForPostedSale(
    tx: Parameters<Parameters<TenantDb['withTenant']>[1]>[0],
    input: {
      tenantId: string;
      lines: Array<{
        id: string;
        serviceId: string;
        specialistId: string | null;
        lineTotalUsd: number;
      }>;
      materialsByLine: Map<string, number>;
    },
  ) {
    const rules = await tx
      .select()
      .from(commissionRules)
      .where(
        and(
          eq(commissionRules.tenantId, input.tenantId),
          eq(commissionRules.isActive, true),
        ),
      )
      .orderBy(asc(commissionRules.priority));

    const created = [];
    for (const line of input.lines) {
      if (!line.specialistId) continue;
      const rule = rules.find((candidate) => {
        const specialistOk =
          !candidate.specialistMembershipId ||
          candidate.specialistMembershipId === line.specialistId;
        const serviceOk =
          !candidate.serviceId || candidate.serviceId === line.serviceId;
        return specialistOk && serviceOk;
      });
      if (!rule) continue;

      const materials = input.materialsByLine.get(line.id) ?? 0;
      const gross = line.lineTotalUsd;
      let commission = 0;
      if (rule.ruleType === 'FLAT') {
        commission = Number(rule.flatUsd ?? 0);
      } else if (rule.ruleType === 'PERCENT_GROSS') {
        commission = (gross * Number(rule.ratePercent ?? 0)) / 100;
      } else {
        commission =
          (Math.max(gross - materials, 0) * Number(rule.ratePercent ?? 0)) /
          100;
      }

      const [entry] = await tx
        .insert(commissionEntries)
        .values({
          tenantId: input.tenantId,
          saleLineItemId: line.id,
          specialistMembershipId: line.specialistId,
          ruleId: rule.id,
          grossUsd: gross.toFixed(2),
          materialsUsd: materials.toFixed(2),
          commissionUsd: roundMoney(commission).toFixed(2),
        })
        .returning();
      created.push(entry);
    }
    return created;
  }
}
