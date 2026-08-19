import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ClinicCoreService } from '../src/clinic/clinic-core.service.js';

describe('ClinicCoreService authorization', () => {
  it('blocks receptionists from creating services', async () => {
    const tenantDb = { withTenant: vi.fn() };
    const service = new ClinicCoreService(tenantDb as never);

    await expect(
      service.createService(
        { tenantId: 'tenant-a', role: 'RECEPTIONIST' },
        {
          name: 'Botox',
          basePriceUsd: 120,
          estimatedDurationMinutes: 30,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenantDb.withTenant).not.toHaveBeenCalled();
  });

  it('allows managers to create services', async () => {
    const tenantDb = {
      withTenant: vi.fn(async (_tenantId: string, work: (tx: unknown) => Promise<unknown>) =>
        work({
          insert: () => ({
            values: () => ({
              returning: async () => [{ id: 'svc-1', name: 'Botox' }],
            }),
          }),
        }),
      ),
    };
    const service = new ClinicCoreService(tenantDb as never);

    await expect(
      service.createService(
        { tenantId: 'tenant-a', role: 'MANAGER' },
        {
          name: 'Botox',
          basePriceUsd: 120,
          estimatedDurationMinutes: 30,
        },
      ),
    ).resolves.toMatchObject({ id: 'svc-1', name: 'Botox' });
  });
});
