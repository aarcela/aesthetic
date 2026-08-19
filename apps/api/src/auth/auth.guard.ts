import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import type { TenantContext } from '../tenants/tenant-context.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      tenantContext?: TenantContext;
      authMembership?: Awaited<ReturnType<AuthService['resolveAccessToken']>>;
    }>();

    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Authorization Bearer token is required.',
      });
    }

    const accessToken = header.slice('Bearer '.length).trim();
    if (!accessToken) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Authorization Bearer token is required.',
      });
    }

    const membership = await this.authService.resolveAccessToken(accessToken);
    request.authMembership = membership;
    request.tenantContext = {
      tenantId: membership.tenantId,
      role: membership.role,
      locationIds: membership.locationIds,
    };
    return true;
  }
}
