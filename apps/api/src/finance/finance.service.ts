import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';

import type { AuthenticatedMembership } from '../auth/auth.service.js';
import { financeMovements, financeTypes, inventoryItems, inventoryMovements } from '../database/schema.js';
import { TenantDb } from '../database/tenant-db.js';
import { SettingsService } from '../settings/settings.service.js';
import { FxService } from '../fx/fx.service.js';
import { roundMoney } from '../pos/payment-math.js';
import {
  assertFinanceAccess,
  assertTenantManager,
  type TenantContext,
} from '../tenants/tenant-context.js';

const DEFAULT_TYPES: Array<{
  direction: 'ingress' | 'egress';
  name: string;
  sortOrder: number;
}> = [
  { direction: 'ingress', name: 'Cobros varios', sortOrder: 10 },
  { direction: 'ingress', name: 'Venta de productos', sortOrder: 15 },
  { direction: 'ingress', name: 'Depósitos', sortOrder: 20 },
  { direction: 'ingress', name: 'Otros ingresos', sortOrder: 90 },
  { direction: 'egress', name: 'Insumos', sortOrder: 10 },
  { direction: 'egress', name: 'Alquiler', sortOrder: 20 },
  { direction: 'egress', name: 'Nómina', sortOrder: 30 },
  { direction: 'egress', name: 'Servicios (luz/agua/internet)', sortOrder: 40 },
  { direction: 'egress', name: 'Marketing', sortOrder: 50 },
  { direction: 'egress', name: 'Otros egresos', sortOrder: 90 },
];

@Injectable()
export class FinanceService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(FxService) private readonly fx: FxService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  async listTypes(tenantId: string, direction?: 'ingress' | 'egress') {
    await this.ensureDefaultTypes(tenantId);
    return this.tenantDb.withTenant(tenantId, (tx) => {
      const filters = [
        eq(financeTypes.tenantId, tenantId),
        eq(financeTypes.isActive, true),
      ];
      if (direction) filters.push(eq(financeTypes.direction, direction));
      return tx
        .select()
        .from(financeTypes)
        .where(and(...filters))
        .orderBy(asc(financeTypes.sortOrder), asc(financeTypes.name));
    });
  }

  async createType(
    context: TenantContext,
    input: {
      direction: 'ingress' | 'egress';
      name: string;
      description?: string;
      sortOrder?: number;
    },
  ) {
    assertTenantManager(context);
    await this.ensureDefaultTypes(context.tenantId);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .insert(financeTypes)
        .values({
          tenantId: context.tenantId,
          direction: input.direction,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          sortOrder: input.sortOrder ?? 100,
          isSystem: false,
        })
        .returning();
      return row;
    });
  }

  async updateType(
    context: TenantContext,
    typeId: string,
    input: {
      name?: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    assertTenantManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(financeTypes)
        .where(
          and(
            eq(financeTypes.id, typeId),
            eq(financeTypes.tenantId, context.tenantId),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new NotFoundException({
          code: 'FINANCE_TYPE_NOT_FOUND',
          message: 'Tipo no encontrado.',
        });
      }

      const [row] = await tx
        .update(financeTypes)
        .set({
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(financeTypes.id, typeId),
            eq(financeTypes.tenantId, context.tenantId),
          ),
        )
        .returning();
      return row;
    });
  }

  async listMovements(
    tenantId: string,
    query: {
      from?: string;
      to?: string;
      direction?: 'ingress' | 'egress';
      typeId?: string;
    },
  ) {
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const filters = [
        eq(financeMovements.tenantId, tenantId),
        eq(financeMovements.status, 'posted'),
      ];
      if (query.from) {
        filters.push(gte(financeMovements.occurredAt, new Date(query.from)));
      }
      if (query.to) {
        filters.push(lte(financeMovements.occurredAt, new Date(query.to)));
      }
      if (query.direction) {
        filters.push(eq(financeMovements.direction, query.direction));
      }
      if (query.typeId) {
        filters.push(eq(financeMovements.typeId, query.typeId));
      }

      const rows = await tx
        .select({
          movement: financeMovements,
          typeName: financeTypes.name,
          typeDirection: financeTypes.direction,
          productName: inventoryItems.productName,
          unitOfMeasure: inventoryItems.unitOfMeasure,
        })
        .from(financeMovements)
        .innerJoin(financeTypes, eq(financeTypes.id, financeMovements.typeId))
        .leftJoin(
          inventoryItems,
          eq(inventoryItems.id, financeMovements.inventoryItemId),
        )
        .where(and(...filters))
        .orderBy(desc(financeMovements.occurredAt));

      return rows.map(({ movement, typeName, productName, unitOfMeasure }) => ({
        ...movement,
        typeName,
        productName,
        unitOfMeasure,
      }));
    });
  }

  async summary(tenantId: string, from: string, to: string) {
    const movements = await this.listMovements(tenantId, { from, to });
    let entraUsd = 0;
    let saleUsd = 0;
    const byTypeMap = new Map<
      string,
      { typeId: string; typeName: string; direction: string; totalUsd: number }
    >();

    for (const row of movements) {
      const amount = Number(row.amountUsdEquivalent);
      if (row.direction === 'ingress') entraUsd += amount;
      else saleUsd += amount;

      const existing = byTypeMap.get(row.typeId);
      if (existing) {
        existing.totalUsd += amount;
      } else {
        byTypeMap.set(row.typeId, {
          typeId: row.typeId,
          typeName: row.typeName,
          direction: row.direction,
          totalUsd: amount,
        });
      }
    }

    entraUsd = roundMoney(entraUsd);
    saleUsd = roundMoney(saleUsd);

    return {
      from,
      to,
      entraUsd: entraUsd.toFixed(2),
      saleUsd: saleUsd.toFixed(2),
      netoUsd: roundMoney(entraUsd - saleUsd).toFixed(2),
      byDirection: {
        ingress: entraUsd.toFixed(2),
        egress: saleUsd.toFixed(2),
      },
      byType: [...byTypeMap.values()]
        .map((row) => ({
          ...row,
          totalUsd: roundMoney(row.totalUsd).toFixed(2),
        }))
        .sort((a, b) => Number(b.totalUsd) - Number(a.totalUsd)),
    };
  }

  async createMovement(
    membership: AuthenticatedMembership,
    input: {
      typeId: string;
      occurredAt?: string;
      locationId?: string;
      amountNative: number;
      nativeCurrency: 'USD' | 'VES' | 'USDT';
      paymentMethod?: string;
      counterparty?: string;
      referenceNumber?: string;
      notes?: string;
      inventoryItemId?: string;
      quantity?: number;
    },
  ) {
    const context: TenantContext = {
      tenantId: membership.tenantId,
      role: membership.role,
    };
    assertFinanceAccess(context);

    let methodCode: string | undefined;
    let nativeCurrency = input.nativeCurrency;
    if (input.paymentMethod) {
      const method = await this.settings.requireActiveMethod(
        membership.tenantId,
        input.paymentMethod,
      );
      methodCode = method.code;
      nativeCurrency = method.nativeCurrency;
    }

    return this.tenantDb.withTenant(membership.tenantId, async (tx) => {
      const [type] = await tx
        .select()
        .from(financeTypes)
        .where(
          and(
            eq(financeTypes.id, input.typeId),
            eq(financeTypes.tenantId, membership.tenantId),
            eq(financeTypes.isActive, true),
          ),
        )
        .limit(1);
      if (!type) {
        throw new BadRequestException({
          code: 'FINANCE_TYPE_NOT_FOUND',
          message: 'Elige un tipo válido.',
        });
      }

      const priced = await this.priceAmount(
        membership.tenantId,
        input.amountNative,
        nativeCurrency,
      );

      let retailItem: typeof inventoryItems.$inferSelect | null = null;
      if (input.inventoryItemId) {
        if (type.direction !== 'ingress') {
          throw new BadRequestException({
            code: 'RETAIL_SALE_MUST_BE_INGRESS',
            message: 'La venta de producto se registra como dinero que entra.',
          });
        }
        if (!(input.quantity && input.quantity > 0)) {
          throw new BadRequestException({
            code: 'RETAIL_QTY_REQUIRED',
            message: 'Indica cuántas unidades del producto se vendieron.',
          });
        }
        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.id, input.inventoryItemId),
              eq(inventoryItems.tenantId, membership.tenantId),
              isNull(inventoryItems.deletedAt),
            ),
          )
          .limit(1);
        if (!item) {
          throw new NotFoundException({
            code: 'INVENTORY_ITEM_NOT_FOUND',
            message: 'Producto de inventario no encontrado.',
          });
        }
        if (item.itemKind !== 'RETAIL') {
          throw new BadRequestException({
            code: 'NOT_RETAIL_PRODUCT',
            message: `${item.productName} es material de visita. Los productos para venta se eligen aquí.`,
          });
        }
        const next = Number(item.currentStock) - input.quantity;
        if (next < 0) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente para ${item.productName} (hay ${item.currentStock} ${item.unitOfMeasure}).`,
          });
        }
        retailItem = item;
      }

      const [row] = await tx
        .insert(financeMovements)
        .values({
          tenantId: membership.tenantId,
          locationId: input.locationId,
          direction: type.direction,
          typeId: type.id,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          amountNative: input.amountNative.toFixed(2),
          nativeCurrency,
          amountUsdEquivalent: priced.amountUsd.toFixed(2),
          fxFuente: priced.fxFuente,
          fxRate: priced.fxRate,
          paymentMethod: methodCode,
          counterparty: input.counterparty?.trim() || null,
          referenceNumber: input.referenceNumber?.trim() || null,
          notes: input.notes?.trim() || null,
          inventoryItemId: retailItem?.id ?? null,
          quantity: retailItem && input.quantity ? input.quantity.toFixed(4) : null,
          createdBy: membership.membershipId,
        })
        .returning();

      if (retailItem && input.quantity) {
        const next = Number(retailItem.currentStock) - input.quantity;
        await tx
          .update(inventoryItems)
          .set({ currentStock: next.toFixed(4), updatedAt: new Date() })
          .where(eq(inventoryItems.id, retailItem.id));
        await tx.insert(inventoryMovements).values({
          tenantId: membership.tenantId,
          locationId: input.locationId ?? retailItem.locationId,
          inventoryItemId: retailItem.id,
          movementType: 'RETAIL_SALE',
          quantityDelta: (-input.quantity).toFixed(4),
          unitCostUsdSnapshot: retailItem.costPerUnitUsd,
          financeMovementId: row.id,
          createdBy: membership.membershipId,
          reason: `Venta Finanzas · ${type.name}`,
        });
      }

      return { ...row, typeName: type.name, productName: retailItem?.productName ?? null };
    });
  }

  async voidMovement(context: TenantContext, movementId: string) {
    assertTenantManager(context);

    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(financeMovements)
        .where(
          and(
            eq(financeMovements.id, movementId),
            eq(financeMovements.tenantId, context.tenantId),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new NotFoundException({
          code: 'FINANCE_MOVEMENT_NOT_FOUND',
          message: 'Registro no encontrado.',
        });
      }
      if (existing.status === 'void') {
        return existing;
      }

      if (existing.inventoryItemId && existing.quantity) {
        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.id, existing.inventoryItemId),
              eq(inventoryItems.tenantId, context.tenantId),
            ),
          )
          .limit(1);
        if (item) {
          const qty = Number(existing.quantity);
          const next = Number(item.currentStock) + qty;
          await tx
            .update(inventoryItems)
            .set({ currentStock: next.toFixed(4), updatedAt: new Date() })
            .where(eq(inventoryItems.id, item.id));
          await tx.insert(inventoryMovements).values({
            tenantId: context.tenantId,
            locationId: existing.locationId ?? item.locationId,
            inventoryItemId: item.id,
            movementType: 'RETAIL_REVERSE',
            quantityDelta: qty.toFixed(4),
            unitCostUsdSnapshot: item.costPerUnitUsd,
            financeMovementId: existing.id,
            reason: 'Anulación venta Finanzas',
          });
        }
      }

      const [row] = await tx
        .update(financeMovements)
        .set({ status: 'void', updatedAt: new Date() })
        .where(
          and(
            eq(financeMovements.id, movementId),
            eq(financeMovements.tenantId, context.tenantId),
          ),
        )
        .returning();
      return row;
    });
  }

  private async priceAmount(
    tenantId: string,
    amountNative: number,
    currency: 'USD' | 'VES' | 'USDT',
  ): Promise<{
    amountUsd: number;
    fxFuente: 'oficial' | 'paralelo' | null;
    fxRate: string | null;
  }> {
    if (currency === 'USD' || currency === 'USDT') {
      return {
        amountUsd: roundMoney(amountNative),
        fxFuente: null,
        fxRate: null,
      };
    }

    const snapshot = await this.fx.createSaleSnapshot(tenantId);
    const rate = Number(snapshot.vesPerUsd);
    if (!(rate > 0)) {
      throw new BadRequestException({
        code: 'FX_RATE_UNAVAILABLE',
        message: 'No hay tasa para convertir VES a USD.',
      });
    }
    return {
      amountUsd: roundMoney(amountNative / rate),
      fxFuente: snapshot.fuente,
      fxRate: snapshot.vesPerUsd,
    };
  }

  private async ensureDefaultTypes(tenantId: string) {
    await this.tenantDb.withTenant(tenantId, async (tx) => {
      const existing = await tx
        .select({ id: financeTypes.id })
        .from(financeTypes)
        .where(eq(financeTypes.tenantId, tenantId))
        .limit(1);
      if (existing.length > 0) return;

      await tx.insert(financeTypes).values(
        DEFAULT_TYPES.map((row) => ({
          tenantId,
          direction: row.direction,
          name: row.name,
          sortOrder: row.sortOrder,
          isSystem: true,
          isActive: true,
        })),
      );
    });
  }
}
