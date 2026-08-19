import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_PAYMENT_METHODS } from '@aesthetic/shared';
import { and, asc, eq } from 'drizzle-orm';

import { TenantDb } from '../database/tenant-db.js';
import { tenantPaymentMethods, tenants } from '../database/schema.js';
import { assertTenantManager, type TenantContext } from '../tenants/tenant-context.js';

export type PaymentMethodRow = {
  id: string;
  code: string;
  label: string;
  nativeCurrency: 'USD' | 'VES' | 'USDT';
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
};

@Injectable()
export class SettingsService {
  constructor(@Inject(TenantDb) private readonly tenantDb: TenantDb) {}

  async getClinic(tenantId: string) {
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select({
          name: tenants.name,
          taxId: tenants.taxId,
          defaultFxFuente: tenants.defaultFxFuente,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!row) {
        throw new NotFoundException({
          code: 'TENANT_NOT_FOUND',
          message: 'Clínica no encontrada.',
        });
      }
      return row;
    });
  }

  async updateClinic(
    context: TenantContext,
    input: { name?: string; taxId?: string | null },
  ) {
    assertTenantManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .update(tenants)
        .set({
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.taxId !== undefined
            ? { taxId: input.taxId?.trim() || null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, context.tenantId))
        .returning({
          name: tenants.name,
          taxId: tenants.taxId,
          defaultFxFuente: tenants.defaultFxFuente,
        });
      return row;
    });
  }

  async listPaymentMethods(tenantId: string, activeOnly = true) {
    await this.ensureDefaultMethods(tenantId);
    return this.tenantDb.withTenant(tenantId, (tx) => {
      const filters = [eq(tenantPaymentMethods.tenantId, tenantId)];
      if (activeOnly) filters.push(eq(tenantPaymentMethods.isActive, true));
      return tx
        .select()
        .from(tenantPaymentMethods)
        .where(and(...filters))
        .orderBy(asc(tenantPaymentMethods.sortOrder), asc(tenantPaymentMethods.label));
    });
  }

  async requireActiveMethod(tenantId: string, code: string): Promise<PaymentMethodRow> {
    await this.ensureDefaultMethods(tenantId);
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(tenantPaymentMethods)
        .where(
          and(
            eq(tenantPaymentMethods.tenantId, tenantId),
            eq(tenantPaymentMethods.code, code),
            eq(tenantPaymentMethods.isActive, true),
          ),
        )
        .limit(1);
      if (!row) {
        throw new BadRequestException({
          code: 'PAYMENT_METHOD_UNKNOWN',
          message: 'Ese método de pago no está activo en esta clínica.',
        });
      }
      return {
        id: row.id,
        code: row.code,
        label: row.label,
        nativeCurrency: row.nativeCurrency,
        isActive: row.isActive,
        isSystem: row.isSystem,
        sortOrder: row.sortOrder,
      };
    });
  }

  async createPaymentMethod(
    context: TenantContext,
    input: { label: string; nativeCurrency: 'USD' | 'VES' | 'USDT'; sortOrder?: number },
  ) {
    assertTenantManager(context);
    await this.ensureDefaultMethods(context.tenantId);
    const label = input.label.trim();
    const code = await this.uniqueCode(context.tenantId, label, input.nativeCurrency);

    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      try {
        const [row] = await tx
          .insert(tenantPaymentMethods)
          .values({
            tenantId: context.tenantId,
            code,
            label,
            nativeCurrency: input.nativeCurrency,
            sortOrder: input.sortOrder ?? 100,
            isSystem: false,
            isActive: true,
          })
          .returning();
        return row;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: 'PAYMENT_METHOD_EXISTS',
            message: 'Ya existe un método activo con ese nombre.',
          });
        }
        throw error;
      }
    });
  }

  async updatePaymentMethod(
    context: TenantContext,
    methodId: string,
    input: { label?: string; isActive?: boolean; sortOrder?: number },
  ) {
    assertTenantManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(tenantPaymentMethods)
        .where(
          and(
            eq(tenantPaymentMethods.id, methodId),
            eq(tenantPaymentMethods.tenantId, context.tenantId),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new NotFoundException({
          code: 'PAYMENT_METHOD_NOT_FOUND',
          message: 'Método de pago no encontrado.',
        });
      }

      if (input.isActive === false) {
        const active = await tx
          .select({ id: tenantPaymentMethods.id })
          .from(tenantPaymentMethods)
          .where(
            and(
              eq(tenantPaymentMethods.tenantId, context.tenantId),
              eq(tenantPaymentMethods.isActive, true),
            ),
          );
        if (active.length <= 1) {
          throw new BadRequestException({
            code: 'PAYMENT_METHOD_REQUIRED',
            message: 'Debe quedar al menos un método de pago activo.',
          });
        }
      }

      try {
        const [row] = await tx
          .update(tenantPaymentMethods)
          .set({
            ...(input.label !== undefined ? { label: input.label.trim() } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tenantPaymentMethods.id, methodId),
              eq(tenantPaymentMethods.tenantId, context.tenantId),
            ),
          )
          .returning();
        return row;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: 'PAYMENT_METHOD_EXISTS',
            message: 'Ya existe un método activo con ese nombre.',
          });
        }
        throw error;
      }
    });
  }

  async ensureDefaultMethods(tenantId: string) {
    await this.tenantDb.withTenant(tenantId, async (tx) => {
      const existing = await tx
        .select({ id: tenantPaymentMethods.id })
        .from(tenantPaymentMethods)
        .where(eq(tenantPaymentMethods.tenantId, tenantId))
        .limit(1);
      if (existing.length > 0) return;

      await tx.insert(tenantPaymentMethods).values(
        DEFAULT_PAYMENT_METHODS.map((row) => ({
          tenantId,
          code: row.code,
          label: row.label,
          nativeCurrency: row.nativeCurrency,
          sortOrder: row.sortOrder,
          isSystem: true,
          isActive: true,
        })),
      );
    });
  }

  private async uniqueCode(
    tenantId: string,
    label: string,
    currency: string,
  ): Promise<string> {
    const base = slugCode(label, currency);
    const existing = await this.tenantDb.withTenant(tenantId, (tx) =>
      tx
        .select({ code: tenantPaymentMethods.code })
        .from(tenantPaymentMethods)
        .where(eq(tenantPaymentMethods.tenantId, tenantId)),
    );
    const taken = new Set(existing.map((row) => row.code));
    if (!taken.has(base)) return base;
    for (let i = 2; i < 50; i += 1) {
      const candidate = `${base}_${i}`.slice(0, 50);
      if (!taken.has(candidate)) return candidate;
    }
    return `${base}_${Date.now().toString(36).toUpperCase()}`.slice(0, 50);
  }
}

export function slugCode(label: string, currency: string): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'METODO';
  return `${base}_${currency}`.slice(0, 50);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
