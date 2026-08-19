import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createCommissionRuleSchema } from '@aesthetic/shared';

import { AuthGuard } from '../auth/auth.guard.js';
import type { TenantContext } from '../tenants/tenant-context.js';
import { CommissionsService } from './commissions.service.js';

type AuthRequest = { tenantContext?: TenantContext };

@Controller('v1/commissions')
@UseGuards(AuthGuard)
export class CommissionsController {
  constructor(@Inject(CommissionsService) private readonly commissions: CommissionsService) {}

  @Get('rules')
  listRules(@Req() request: AuthRequest) {
    return this.commissions.listRules(this.context(request).tenantId);
  }

  @Post('rules')
  createRule(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createCommissionRuleSchema.parse(body);
    return this.commissions.createRule(this.context(request), input);
  }

  @Get('report')
  report(
    @Req() request: AuthRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.commissions.report(this.context(request).tenantId, from, to);
  }

  private context(request: AuthRequest): TenantContext {
    if (!request.tenantContext) {
      throw new Error('Tenant context missing.');
    }
    return request.tenantContext;
  }
}
