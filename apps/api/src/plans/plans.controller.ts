import { Body, Controller, Get, Inject, Put, Req, UseGuards } from '@nestjs/common';
import { updateTenantPlanSchema } from '@aesthetic/shared';

import { AuthGuard } from '../auth/auth.guard.js';
import { assertTenantManager, type TenantContext } from '../tenants/tenant-context.js';
import { PlansService } from './plans.service.js';

type AuthRequest = { tenantContext?: TenantContext };

@Controller('v1/tenant-settings/plan')
@UseGuards(AuthGuard)
export class PlansController {
  constructor(@Inject(PlansService) private readonly plans: PlansService) {}

  @Get()
  getPlan(@Req() request: AuthRequest) {
    assertTenantManager(this.context(request));
    return this.plans.getTenantPlan(this.context(request).tenantId);
  }

  @Put()
  updatePlan(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = updateTenantPlanSchema.parse(body);
    return this.plans.updatePlan(this.context(request), input);
  }

  private context(request: AuthRequest): TenantContext {
    if (!request.tenantContext) throw new Error('Tenant context missing.');
    return request.tenantContext;
  }
}
