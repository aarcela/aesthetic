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
import { createConsentSchema, createPhotoSchema } from '@aesthetic/shared';

import type { AuthenticatedMembership } from '../auth/auth.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { TenantContext } from '../tenants/tenant-context.js';
import { MediaService } from './media.service.js';

type AuthRequest = {
  tenantContext?: TenantContext;
  authMembership?: AuthenticatedMembership;
};

@Controller('v1/media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get('photos')
  listPhotos(
    @Req() request: AuthRequest,
    @Query('patientId') patientId: string,
  ) {
    return this.media.listPhotos(this.context(request).tenantId, patientId);
  }

  @Post('photos/upload-url')
  createPhoto(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createPhotoSchema.parse(body);
    return this.media.createPhotoUpload(this.membership(request), input);
  }

  @Get('consents')
  listConsents(
    @Req() request: AuthRequest,
    @Query('patientId') patientId: string,
  ) {
    return this.media.listConsents(this.context(request).tenantId, patientId);
  }

  @Post('consents/upload-url')
  createConsent(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createConsentSchema.parse(body);
    return this.media.createConsentUpload(this.membership(request), input);
  }

  private context(request: AuthRequest): TenantContext {
    if (!request.tenantContext) throw new Error('Tenant context missing.');
    return request.tenantContext;
  }

  private membership(request: AuthRequest): AuthenticatedMembership {
    if (!request.authMembership) throw new Error('Auth membership missing.');
    return request.authMembership;
  }
}
