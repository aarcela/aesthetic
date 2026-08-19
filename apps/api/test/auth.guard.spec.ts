import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../src/auth/auth.guard.js';
import {
  assertFinanceAccess,
  assertOperationsManager,
  assertTenantManager,
} from '../src/tenants/tenant-context.js';

describe('AuthGuard', () => {
  it('rejects missing bearer tokens', async () => {
    const authService = { resolveAccessToken: vi.fn() };
    const guard = new AuthGuard(authService as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches tenant context from a verified membership', async () => {
    const authService = {
      resolveAccessToken: vi.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        role: 'OWNER',
        authUserId: 'user-1',
        membershipId: 'mem-1',
        fullName: 'Owner',
        locationIds: ['loc-1'],
      }),
    };
    const request: {
      headers: Record<string, string>;
      tenantContext?: { tenantId: string; role: string };
    } = {
      headers: { authorization: 'Bearer test-token' },
    };
    const guard = new AuthGuard(authService as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request.tenantContext).toEqual({
      tenantId: 'tenant-1',
      role: 'OWNER',
      locationIds: ['loc-1'],
    });
  });
});

describe('assertTenantManager', () => {
  it('rejects non-manager roles from changing the FX source', () => {
    expect(() =>
      assertTenantManager({ tenantId: 'tenant-a', role: 'RECEPTIONIST' }),
    ).toThrow(ForbiddenException);
  });

  it('rejects MANAGER from configuration', () => {
    expect(() =>
      assertTenantManager({ tenantId: 'tenant-a', role: 'MANAGER' }),
    ).toThrow(ForbiddenException);
  });

  it('allows ADMIN to change configuration', () => {
    expect(() =>
      assertTenantManager({ tenantId: 'tenant-a', role: 'ADMIN' }),
    ).not.toThrow();
  });
});

describe('assertFinanceAccess', () => {
  it('blocks MANAGER from the finance cash book', () => {
    expect(() =>
      assertFinanceAccess({ tenantId: 'tenant-a', role: 'MANAGER' }),
    ).toThrow(ForbiddenException);
  });

  it('allows ADMIN to view finances', () => {
    expect(() =>
      assertFinanceAccess({ tenantId: 'tenant-a', role: 'ADMIN' }),
    ).not.toThrow();
  });
});

describe('assertOperationsManager', () => {
  it('allows MANAGER to run clinic operations', () => {
    expect(() =>
      assertOperationsManager({ tenantId: 'tenant-a', role: 'MANAGER' }),
    ).not.toThrow();
  });

  it('blocks receptionists from catalog writes', () => {
    expect(() =>
      assertOperationsManager({ tenantId: 'tenant-a', role: 'RECEPTIONIST' }),
    ).toThrow(ForbiddenException);
  });
});
