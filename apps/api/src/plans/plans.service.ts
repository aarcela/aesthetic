import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { TenantDb } from '../database/tenant-db.js';
import { tenants } from '../database/schema.js';
import { assertTenantManager, type TenantContext } from '../tenants/tenant-context.js';

export type PlanCode = 'starter' | 'pro';
export type PlanFeature = 'inventory' | 'commissions';

const PRO_FEATURES: PlanFeature[] = ['inventory', 'commissions'];

@Injectable()
export class PlansService {
  constructor(@Inject(TenantDb) private readonly tenantDb: TenantDb) {}

  async getTenantPlan(tenantId: string) {
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const [tenant] = await tx
        .select({
          planCode: tenants.planCode,
          subscriptionStatus: tenants.subscriptionStatus,
          name: tenants.name,
          defaultFxFuente: tenants.defaultFxFuente,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) {
        throw new ServiceUnavailableException('Tenant not found.');
      }
      return tenant;
    });
  }

  async assertFeature(tenantId: string, feature: PlanFeature): Promise<PlanCode> {
    const plan = await this.getTenantPlan(tenantId);
    if (plan.subscriptionStatus === 'suspended') {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_SUSPENDED',
        message: 'La suscripción de la clínica está suspendida.',
      });
    }
    if (plan.planCode === 'starter' && PRO_FEATURES.includes(feature)) {
      throw new ForbiddenException({
        code: 'PLAN_UPGRADE_REQUIRED',
        message: `La función ${feature} requiere plan Pro.`,
      });
    }
    return plan.planCode;
  }

  async updatePlan(
    context: TenantContext,
    input: {
      planCode: PlanCode;
      subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'suspended';
    },
  ) {
    assertTenantManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .update(tenants)
        .set({
          planCode: input.planCode,
          subscriptionStatus: input.subscriptionStatus,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, context.tenantId))
        .returning({
          planCode: tenants.planCode,
          subscriptionStatus: tenants.subscriptionStatus,
        });
      return row;
    });
  }
}
