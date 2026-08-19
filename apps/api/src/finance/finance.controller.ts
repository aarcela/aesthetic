import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createFinanceMovementSchema,
  createFinanceTypeSchema,
  financeDirectionSchema,
  updateFinanceTypeSchema,
} from '@aesthetic/shared';

import type { AuthenticatedMembership } from '../auth/auth.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import {
  assertFinanceAccess,
  type TenantContext,
} from '../tenants/tenant-context.js';
import { FinanceService } from './finance.service.js';

type AuthRequest = {
  tenantContext?: TenantContext;
  authMembership?: AuthenticatedMembership;
};

@Controller('v1/finance')
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Get('types')
  listTypes(
    @Req() request: AuthRequest,
    @Query('direction') direction?: string,
  ) {
    const parsed = direction
      ? financeDirectionSchema.parse(direction)
      : undefined;
    return this.finance.listTypes(this.context(request).tenantId, parsed);
  }

  @Post('types')
  createType(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createFinanceTypeSchema.parse(body);
    return this.finance.createType(this.context(request), input);
  }

  @Patch('types/:id')
  updateType(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updateFinanceTypeSchema.parse(body);
    return this.finance.updateType(this.context(request), id, input);
  }

  @Get('movements')
  listMovements(
    @Req() request: AuthRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('direction') direction?: string,
    @Query('typeId') typeId?: string,
  ) {
    const parsed = direction
      ? financeDirectionSchema.parse(direction)
      : undefined;
    return this.finance.listMovements(this.context(request).tenantId, {
      from,
      to,
      direction: parsed,
      typeId,
    });
  }

  @Get('summary')
  summary(
    @Req() request: AuthRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.finance.summary(this.context(request).tenantId, from, to);
  }

  @Post('movements')
  createMovement(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createFinanceMovementSchema.parse(body);
    return this.finance.createMovement(this.membership(request), input);
  }

  @Post('movements/:id/void')
  voidMovement(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.finance.voidMovement(this.context(request), id);
  }

  private context(request: AuthRequest): TenantContext {
    if (!request.tenantContext) {
      throw new Error('Tenant context was not attached by the auth guard.');
    }
    assertFinanceAccess(request.tenantContext);
    return request.tenantContext;
  }

  private membership(request: AuthRequest): AuthenticatedMembership {
    if (!request.authMembership) {
      throw new Error('Auth membership was not attached by the auth guard.');
    }
    return request.authMembership;
  }
}
