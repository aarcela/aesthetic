import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createSaleSchema, postSaleSchema } from '@aesthetic/shared';

import type { AuthenticatedMembership } from '../auth/auth.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { IdempotencyService } from '../common/idempotency.service.js';
import type { TenantContext } from '../tenants/tenant-context.js';
import { PosService } from './pos.service.js';

type AuthRequest = {
  tenantContext?: TenantContext;
  authMembership?: AuthenticatedMembership;
};

@Controller('v1')
@UseGuards(AuthGuard)
export class PosController {
  constructor(
    @Inject(PosService) private readonly pos: PosService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Post('sales')
  createSale(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createSaleSchema.parse(body);
    return this.pos.createSale(this.membership(request), input);
  }

  @Post('appointments/:id/sales')
  createSaleFromAppointment(
    @Req() request: AuthRequest,
    @Param('id') appointmentId: string,
  ) {
    return this.pos.createSaleFromAppointment(
      this.membership(request),
      appointmentId,
    );
  }

  @Post('sales/:id/post')
  async postSale(
    @Req() request: AuthRequest,
    @Param('id') saleId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const input = postSaleSchema.parse(body);
    const membership = this.membership(request);
    const route = `POST /api/v1/sales/${saleId}/post`;

    if (idempotencyKey) {
      const existing = await this.idempotency.find(
        membership.tenantId,
        idempotencyKey,
      );
      if (existing) {
        return existing.responseBody;
      }
    }

    const result = await this.pos.postSale(
      this.context(request),
      saleId,
      input,
      membership.membershipId,
    );

    if (idempotencyKey) {
      await this.idempotency.save({
        tenantId: membership.tenantId,
        key: idempotencyKey,
        route,
        requestHash: this.idempotency.hashRequest(body),
        responseStatus: 201,
        responseBody: result,
      });
    }

    return result;
  }

  @Get('reports/caja/daily')
  dailyCaja(
    @Req() request: AuthRequest,
    @Query('date') date: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.pos.dailyCajaReport(this.context(request), {
      date,
      locationId,
    });
  }

  private context(request: AuthRequest): TenantContext {
    if (!request.tenantContext) {
      throw new Error('Tenant context was not attached by the auth guard.');
    }
    return request.tenantContext;
  }

  private membership(request: AuthRequest): AuthenticatedMembership {
    if (!request.authMembership) {
      throw new Error('Auth membership was not attached by the auth guard.');
    }
    return request.authMembership;
  }
}
