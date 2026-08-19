import { ForbiddenException } from '@nestjs/common';
import {
  canAccessFinance,
  canAccessSettings,
  canManageOperations,
  canManageTeam,
  type TenantRole,
} from '@aesthetic/shared';

export type { TenantRole };

export type TenantContext = {
  tenantId: string;
  role: TenantRole;
  locationIds?: string[];
};

/** OWNER / ADMIN — configuration, billing, and team. Not MANAGER. */
export function assertTenantManager(context: TenantContext): void {
  if (!canAccessSettings(context.role)) {
    throw new ForbiddenException(
      'Solo dueño o admin pueden cambiar la configuración.',
    );
  }
}

export function assertTeamManager(context: TenantContext): void {
  if (!canManageTeam(context.role)) {
    throw new ForbiddenException('Solo dueño o admin pueden gestionar el equipo.');
  }
}

/** OWNER / ADMIN / MANAGER — catalog, inventory, and day-to-day clinic ops. */
export function assertOperationsManager(context: TenantContext): void {
  if (!canManageOperations(context.role)) {
    throw new ForbiddenException(
      'Solo dueño, admin o gerente pueden realizar esta acción.',
    );
  }
}

/** Finanzas cash book. Caja POS is separate. */
export function assertFinanceAccess(context: TenantContext): void {
  if (!canAccessFinance(context.role)) {
    throw new ForbiddenException('No tienes acceso a finanzas.');
  }
}

/** OWNER / ADMIN / MANAGER / RECEPTIONIST — visit materials and caja-adjacent writes. */
export function assertFinanceWriter(context: TenantContext): void {
  if (
    context.role !== 'OWNER' &&
    context.role !== 'ADMIN' &&
    context.role !== 'MANAGER' &&
    context.role !== 'RECEPTIONIST'
  ) {
    throw new ForbiddenException(
      'Solo dueño, admin, gerente o recepción pueden registrar este movimiento.',
    );
  }
}
