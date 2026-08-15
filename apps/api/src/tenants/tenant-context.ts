import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

export const TENANT_CONTEXT = 'tenantContext';

export type TenantRole = 'OWNER' | 'ADMIN' | 'SPECIALIST' | 'RECEPTIONIST';

export type TenantContext = {
  tenantId: string;
  role: TenantRole;
};

/**
 * Temporary boundary adapter for the FX foundation.
 * The auth foundation will replace these headers with verified Supabase JWT
 * app_metadata claims before a public deployment.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException(
        'Supabase JWT authentication must be configured for production.',
      );
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      tenantContext?: TenantContext;
    }>();
    const tenantId = request.headers['x-tenant-id'];
    const role = request.headers['x-tenant-role'];

    if (typeof tenantId !== 'string' || typeof role !== 'string') {
      throw new UnauthorizedException('Missing tenant context.');
    }

    if (!['OWNER', 'ADMIN', 'SPECIALIST', 'RECEPTIONIST'].includes(role)) {
      throw new ForbiddenException('Invalid tenant role.');
    }

    request.tenantContext = { tenantId, role: role as TenantRole };
    return true;
  }
}

export function assertTenantManager(context: TenantContext): void {
  if (context.role !== 'OWNER' && context.role !== 'ADMIN') {
    throw new ForbiddenException('Only OWNER or ADMIN can change the FX source.');
  }
}
