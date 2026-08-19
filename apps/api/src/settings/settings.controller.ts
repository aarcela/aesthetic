import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createPaymentMethodSchema,
  updateClinicProfileSchema,
  updatePaymentMethodSchema,
} from '@aesthetic/shared';

import { AuthGuard } from '../auth/auth.guard.js';
import { assertTenantManager, type TenantContext } from '../tenants/tenant-context.js';
import { SettingsService } from './settings.service.js';

type AuthRequest = { tenantContext?: TenantContext };

@Controller('v1')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get('payment-methods')
  listActiveMethods(@Req() request: AuthRequest) {
    return this.settings.listPaymentMethods(this.context(request).tenantId, true);
  }

  @Get('tenant-settings/clinic')
  getClinic(@Req() request: AuthRequest) {
    assertTenantManager(this.context(request));
    return this.settings.getClinic(this.context(request).tenantId);
  }

  @Patch('tenant-settings/clinic')
  updateClinic(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = updateClinicProfileSchema.parse(body);
    return this.settings.updateClinic(this.context(request), input);
  }

  @Get('tenant-settings/payment-methods')
  listAllMethods(@Req() request: AuthRequest) {
    assertTenantManager(this.context(request));
    return this.settings.listPaymentMethods(this.context(request).tenantId, false);
  }

  @Post('tenant-settings/payment-methods')
  createMethod(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createPaymentMethodSchema.parse(body);
    return this.settings.createPaymentMethod(this.context(request), input);
  }

  @Patch('tenant-settings/payment-methods/:id')
  updateMethod(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updatePaymentMethodSchema.parse(body);
    return this.settings.updatePaymentMethod(this.context(request), id, input);
  }

  private context(request: AuthRequest): TenantContext {
    if (!request.tenantContext) {
      throw new Error('Tenant context was not attached by the auth guard.');
    }
    return request.tenantContext;
  }
}
