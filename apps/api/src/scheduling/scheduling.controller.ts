import {
  BadRequestException,
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
  createAppointmentSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
} from '@aesthetic/shared';

import { AuthGuard } from '../auth/auth.guard.js';
import type { TenantContext } from '../tenants/tenant-context.js';
import { SchedulingService } from './scheduling.service.js';

type TenantRequest = { tenantContext?: TenantContext };

@Controller('v1/appointments')
@UseGuards(AuthGuard)
export class SchedulingController {
  constructor(@Inject(SchedulingService) private readonly scheduling: SchedulingService) {}

  @Get()
  list(
    @Req() request: TenantRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.scheduling.listAppointments(
      this.context(request).tenantId,
      from,
      to,
    );
  }

  @Get('latest-notes')
  latestNotes(
    @Req() request: TenantRequest,
    @Query('patientId') patientId?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    if (!patientId) {
      throw new BadRequestException({
        code: 'PATIENT_ID_REQUIRED',
        message: 'Indica el paciente para cargar la indicación anterior.',
      });
    }
    return this.scheduling.getLatestVisitNotes(
      this.context(request).tenantId,
      patientId,
      excludeId,
    );
  }

  @Post()
  create(@Req() request: TenantRequest, @Body() body: unknown) {
    const input = createAppointmentSchema.parse(body);
    return this.scheduling.createAppointment(this.context(request), {
      locationId: input.locationId,
      patientId: input.patientId,
      scheduledAt: input.scheduledAt,
      notes: input.notes,
      visitDiagnosis: input.visitDiagnosis,
      requestedExams: input.requestedExams,
      depositRequiredUsd: input.depositRequiredUsd,
      status: input.status,
      items: input.items,
    });
  }

  @Patch(':id')
  update(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updateAppointmentSchema.parse(body);
    return this.scheduling.updateAppointment(this.context(request), id, input);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updateAppointmentStatusSchema.parse(body);
    return this.scheduling.updateStatus(this.context(request), id, input.status);
  }

  private context(request: TenantRequest): TenantContext {
    if (!request.tenantContext) {
      throw new Error('Tenant context was not attached by the auth guard.');
    }
    return request.tenantContext;
  }
}
