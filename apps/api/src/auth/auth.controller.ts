import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';

import { AuthService } from './auth.service.js';

const bootstrapSchema = z.object({
  clinicName: z.string().min(2).max(255),
  fullName: z.string().min(2).max(255),
  taxId: z.string().min(3).max(50).optional(),
  defaultFxFuente: z.enum(['oficial', 'paralelo']).optional(),
});

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get('me')
  async me(@Req() request: { headers: Record<string, string | string[] | undefined> }) {
    return this.authService.getMe(this.bearer(request.headers.authorization));
  }

  @Post('bootstrap-tenant')
  async bootstrap(
    @Req() request: { headers: Record<string, string | string[] | undefined> },
    @Body() body: unknown,
  ) {
    const input = bootstrapSchema.parse(body);
    return this.authService.bootstrapTenant({
      accessToken: this.bearer(request.headers.authorization),
      clinicName: input.clinicName,
      fullName: input.fullName,
      taxId: input.taxId,
      defaultFxFuente: input.defaultFxFuente,
    });
  }

  private bearer(header: string | string[] | undefined): string {
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Authorization Bearer token is required.',
      });
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Authorization Bearer token is required.',
      });
    }
    return token;
  }
}
