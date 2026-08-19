import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createLocationSchema,
  createPatientSchema,
  createServiceSchema,
  updatePatientSchema,
  updateServiceSchema,
} from '@aesthetic/shared';

import { AuthGuard } from '../auth/auth.guard.js';
import type { TenantContext } from '../tenants/tenant-context.js';
import { ClinicCoreService } from './clinic-core.service.js';

type TenantRequest = { tenantContext?: TenantContext };

@Controller('v1')
@UseGuards(AuthGuard)
export class ClinicCoreController {
  constructor(@Inject(ClinicCoreService) private readonly clinic: ClinicCoreService) {}

  @Get('locations')
  listLocations(@Req() request: TenantRequest) {
    return this.clinic.listLocations(this.context(request));
  }

  @Post('locations')
  createLocation(@Req() request: TenantRequest, @Body() body: unknown) {
    const input = createLocationSchema.parse(body);
    return this.clinic.createLocation(this.context(request), {
      name: input.name,
      timezone: input.timezone,
      isPrimary: input.isPrimary,
    });
  }

  @Get('patients')
  listPatients(@Req() request: TenantRequest) {
    return this.clinic.listPatients(this.context(request).tenantId);
  }

  @Get('patients/:id/history')
  getPatientHistory(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.clinic.getPatientHistory(this.context(request).tenantId, id);
  }

  @Get('patients/:id')
  getPatient(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.clinic.getPatient(this.context(request).tenantId, id);
  }

  @Post('patients')
  createPatient(@Req() request: TenantRequest, @Body() body: unknown) {
    const input = createPatientSchema.parse(body);
    return this.clinic.createPatient(this.context(request), input);
  }

  @Patch('patients/:id')
  updatePatient(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updatePatientSchema.parse(body);
    return this.clinic.updatePatient(this.context(request), id, input);
  }

  @Delete('patients/:id')
  deletePatient(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.clinic.softDeletePatient(this.context(request), id);
  }

  @Get('services')
  listServices(@Req() request: TenantRequest) {
    return this.clinic.listServices(this.context(request).tenantId);
  }

  @Post('services')
  createService(@Req() request: TenantRequest, @Body() body: unknown) {
    const input = createServiceSchema.parse(body);
    return this.clinic.createService(this.context(request), {
      name: input.name,
      basePriceUsd: input.basePriceUsd,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      isActive: input.isActive,
    });
  }

  @Patch('services/:id')
  updateService(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updateServiceSchema.parse(body);
    return this.clinic.updateService(this.context(request), id, input);
  }

  @Delete('services/:id')
  deleteService(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.clinic.softDeleteService(this.context(request), id);
  }

  private context(request: TenantRequest): TenantContext {
    if (!request.tenantContext) {
      throw new Error('Tenant context was not attached by the auth guard.');
    }
    return request.tenantContext;
  }
}
