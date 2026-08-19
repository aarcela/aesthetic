import { describe, expect, it } from 'vitest';
import {
  canAccessFinance,
  canAccessNav,
  canAccessSettings,
  canManageOperations,
  filterAssignedLocations,
} from '@aesthetic/shared';

describe('tenant role access', () => {
  it('lets admin see configuration and finances', () => {
    expect(canAccessSettings('ADMIN')).toBe(true);
    expect(canAccessFinance('ADMIN')).toBe(true);
    expect(canAccessNav('ADMIN', '/app/settings')).toBe(true);
    expect(canAccessNav('ADMIN', '/app/finanzas')).toBe(true);
  });

  it('hides configuration and finances from manager', () => {
    expect(canAccessSettings('MANAGER')).toBe(false);
    expect(canAccessFinance('MANAGER')).toBe(false);
    expect(canAccessNav('MANAGER', '/app/settings')).toBe(false);
    expect(canAccessNav('MANAGER', '/app/finanzas')).toBe(false);
    expect(canAccessNav('MANAGER', '/app/agenda')).toBe(true);
    expect(canAccessNav('MANAGER', '/app/caja')).toBe(true);
    expect(canManageOperations('MANAGER')).toBe(true);
  });

  it('limits non-admin staff to assigned sedes', () => {
    const locations = [
      { id: 'a', name: 'Centro' },
      { id: 'b', name: 'Este' },
    ];
    expect(filterAssignedLocations('ADMIN', ['a'], locations)).toEqual(locations);
    expect(filterAssignedLocations('MANAGER', ['a'], locations)).toEqual([
      { id: 'a', name: 'Centro' },
    ]);
  });
});
