import {
  Body,
  Controller,
  Get,
  Inject,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { updateFxSourceSchema } from '@aesthetic/shared';

import { AuthGuard } from '../auth/auth.guard.js';
import {
  assertTenantManager,
  type TenantContext,
} from '../tenants/tenant-context.js';
import { FxService } from './fx.service.js';

type TenantRequest = { tenantContext?: TenantContext };

@Controller('v1')
@UseGuards(AuthGuard)
export class FxController {
  constructor(@Inject(FxService) private readonly fxService: FxService) {}

  @Get('fx/rates')
  async getRates(@Req() request: TenantRequest) {
    const context = this.contextOf(request);
    return this.fxService.getTenantRateView(context.tenantId);
  }

  @Get('tenant-settings/fx-source')
  async getTenantSource(@Req() request: TenantRequest) {
    const context = this.contextOf(request);
    assertTenantManager(context);
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
      throw new Error('Tenant context was not attached by the auth guard.');
    }
    return request.tenantContext;
  }
}
