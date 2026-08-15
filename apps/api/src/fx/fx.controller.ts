import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { updateFxSourceSchema } from '@aesthetic/shared';

import {
  assertTenantManager,
  TenantContextGuard,
  type TenantContext,
} from '../tenants/tenant-context.js';
import { FxService } from './fx.service.js';

type TenantRequest = { tenantContext?: TenantContext };

@Controller('v1')
@UseGuards(TenantContextGuard)
export class FxController {
  constructor(private readonly fxService: FxService) {}

  @Get('fx/rates')
  async getRates(@Req() request: TenantRequest) {
    const context = this.contextOf(request);
    return this.fxService.getTenantRateView(context.tenantId);
  }

  @Get('tenant-settings/fx-source')
  async getTenantSource(@Req() request: TenantRequest) {
    const context = this.contextOf(request);
    const view = await this.fxService.getTenantRateView(context.tenantId);
    return {
      fuente: view.selectedFuente,
      selectedRate: view.rates[view.selectedFuente],
    };
  }

  @Put('tenant-settings/fx-source')
  async updateTenantSource(
    @Req() request: TenantRequest,
    @Body() body: unknown,
  ) {
    const context = this.contextOf(request);
    assertTenantManager(context);
    const input = updateFxSourceSchema.parse(body);
    const selectedRate = await this.fxService.updateTenantSource(
      context.tenantId,
      input.fuente,
    );
    return { fuente: input.fuente, selectedRate };
  }

  private contextOf(request: TenantRequest): TenantContext {
    if (!request.tenantContext) {
      // The guard always sets this; preserve a fail-closed guardrail.
      throw new Error('Tenant context was not attached by the guard.');
    }
    return request.tenantContext;
  }
}
