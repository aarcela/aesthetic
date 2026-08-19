import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedMembership } from '../auth/auth.service.js';
import {
  appointmentItems,
  appointments,
  inventoryItems,
  inventoryMovements,
  serviceInventoryRecipes,
} from '../database/schema.js';
import { TenantDb } from '../database/tenant-db.js';
import { PlansService } from '../plans/plans.service.js';
import { assertFinanceWriter, assertOperationsManager, type TenantContext } from '../tenants/tenant-context.js';
import { roundMoney } from '../pos/payment-math.js';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(PlansService) private readonly plans: PlansService,
  ) {}

  async listItems(tenantId: string, kind?: 'MATERIAL' | 'RETAIL') {
    await this.plans.assertFeature(tenantId, 'inventory');
    return this.tenantDb.withTenant(tenantId, (tx) => {
      const filters = [
        eq(inventoryItems.tenantId, tenantId),
        isNull(inventoryItems.deletedAt),
      ];
      if (kind) filters.push(eq(inventoryItems.itemKind, kind));
      return tx
        .select()
        .from(inventoryItems)
        .where(and(...filters))
        .orderBy(asc(inventoryItems.productName));
    });
  }

  async createItem(
    context: TenantContext,
    input: {
      productName: string;
      itemKind: 'MATERIAL' | 'RETAIL';
      unitOfMeasure: string;
      packageCapacity: number;
      currentStock: number;
      minStockAlert: number;
      costPerUnitUsd: number;
      salePriceUsd: number;
      locationId?: string;
    },
  ) {
    assertOperationsManager(context);
    await this.plans.assertFeature(context.tenantId, 'inventory');
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .insert(inventoryItems)
        .values({
          tenantId: context.tenantId,
          productName: input.productName,
          itemKind: input.itemKind,
          unitOfMeasure: input.unitOfMeasure,
          packageCapacity: input.packageCapacity.toFixed(4),
          currentStock: input.currentStock.toFixed(4),
          minStockAlert: input.minStockAlert.toFixed(4),
          costPerUnitUsd: input.costPerUnitUsd.toFixed(4),
          salePriceUsd: input.salePriceUsd.toFixed(4),
          locationId: input.locationId,
        })
        .returning();
      return row;
    });
  }

  async updateItem(
    context: TenantContext,
    itemId: string,
    input: Partial<{
      productName: string;
      itemKind: 'MATERIAL' | 'RETAIL';
      unitOfMeasure: string;
      packageCapacity: number;
      minStockAlert: number;
      costPerUnitUsd: number;
      salePriceUsd: number;
      locationId: string | null;
    }>,
  ) {
    assertOperationsManager(context);
    await this.plans.assertFeature(context.tenantId, 'inventory');
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.productName !== undefined) patch.productName = input.productName;
      if (input.itemKind !== undefined) patch.itemKind = input.itemKind;
      if (input.unitOfMeasure !== undefined) patch.unitOfMeasure = input.unitOfMeasure;
      if (input.packageCapacity !== undefined) {
        patch.packageCapacity = input.packageCapacity.toFixed(4);
      }
      if (input.minStockAlert !== undefined) {
        patch.minStockAlert = input.minStockAlert.toFixed(4);
      }
      if (input.costPerUnitUsd !== undefined) {
        patch.costPerUnitUsd = input.costPerUnitUsd.toFixed(4);
      }
      if (input.salePriceUsd !== undefined) {
        patch.salePriceUsd = input.salePriceUsd.toFixed(4);
      }
      if (input.locationId !== undefined) patch.locationId = input.locationId;

      const [row] = await tx
        .update(inventoryItems)
        .set(patch)
        .where(
          and(
            eq(inventoryItems.id, itemId),
            eq(inventoryItems.tenantId, context.tenantId),
            isNull(inventoryItems.deletedAt),
          ),
        )
        .returning();

      if (!row) {
        throw new NotFoundException({
          code: 'INVENTORY_ITEM_NOT_FOUND',
          message: 'Producto de inventario no encontrado.',
        });
      }
      return row;
    });
  }

  async softDeleteItem(context: TenantContext, itemId: string) {
    assertOperationsManager(context);
    await this.plans.assertFeature(context.tenantId, 'inventory');
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .update(inventoryItems)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryItems.id, itemId),
            eq(inventoryItems.tenantId, context.tenantId),
            isNull(inventoryItems.deletedAt),
          ),
        )
        .returning();

      if (!row) {
        throw new NotFoundException({
          code: 'INVENTORY_ITEM_NOT_FOUND',
          message: 'Producto de inventario no encontrado.',
        });
      }
      return row;
    });
  }

  async adjustStock(
    membership: AuthenticatedMembership,
    itemId: string,
    input: {
      quantityDelta: number;
      reason: string;
      movementType: 'PURCHASE' | 'ADJUSTMENT';
    },
  ) {
    assertOperationsManager(membership);
    await this.plans.assertFeature(membership.tenantId, 'inventory');
    return this.tenantDb.withTenant(membership.tenantId, async (tx) => {
      const [item] = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.id, itemId),
            eq(inventoryItems.tenantId, membership.tenantId),
            isNull(inventoryItems.deletedAt),
          ),
        )
        .limit(1);
      if (!item) {
        throw new NotFoundException({ code: 'INVENTORY_ITEM_NOT_FOUND' });
      }

      const next = Number(item.currentStock) + input.quantityDelta;
      if (next < 0) {
        throw new BadRequestException({
          code: 'NEGATIVE_STOCK',
          message: 'El ajuste dejaría el stock negativo.',
        });
      }

      const [updated] = await tx
        .update(inventoryItems)
        .set({ currentStock: next.toFixed(4), updatedAt: new Date() })
        .where(eq(inventoryItems.id, itemId))
        .returning();

      await tx.insert(inventoryMovements).values({
        tenantId: membership.tenantId,
        locationId: item.locationId,
        inventoryItemId: item.id,
        movementType: input.movementType,
        quantityDelta: input.quantityDelta.toFixed(4),
        unitCostUsdSnapshot: item.costPerUnitUsd,
        reason: input.reason,
        createdBy: membership.membershipId,
      });

      return updated;
    });
  }

  async createRecipe(
    context: TenantContext,
    input: { serviceId: string; inventoryItemId: string; quantityRequired: number },
  ) {
    assertOperationsManager(context);
    await this.plans.assertFeature(context.tenantId, 'inventory');
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [item] = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.id, input.inventoryItemId),
            eq(inventoryItems.tenantId, context.tenantId),
            isNull(inventoryItems.deletedAt),
          ),
        )
        .limit(1);
      if (!item) {
        throw new NotFoundException({
          code: 'INVENTORY_ITEM_NOT_FOUND',
          message: 'Ítem de inventario no encontrado.',
        });
      }
      if (item.itemKind !== 'MATERIAL') {
        throw new BadRequestException({
          code: 'NOT_VISIT_MATERIAL',
          message: 'Solo materiales de visita entran en recetas. Los productos se venden en Finanzas.',
        });
      }

      const [row] = await tx
        .insert(serviceInventoryRecipes)
        .values({
          tenantId: context.tenantId,
          serviceId: input.serviceId,
          inventoryItemId: input.inventoryItemId,
          quantityRequired: input.quantityRequired.toFixed(4),
        })
        .returning();
      return row;
    });
  }

  async listRecipes(tenantId: string, serviceId?: string) {
    await this.plans.assertFeature(tenantId, 'inventory');
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const filters = [eq(serviceInventoryRecipes.tenantId, tenantId)];
      if (serviceId) filters.push(eq(serviceInventoryRecipes.serviceId, serviceId));
      return tx.select().from(serviceInventoryRecipes).where(and(...filters));
    });
  }

  async listLowStock(tenantId: string) {
    await this.plans.assertFeature(tenantId, 'inventory');
    return this.tenantDb.withTenant(tenantId, async (tx) =>
      tx
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.tenantId, tenantId),
            isNull(inventoryItems.deletedAt),
            sql`${inventoryItems.currentStock} <= ${inventoryItems.minStockAlert}`,
          ),
        ),
    );
  }

  /**
   * Consumes recipes for each sale line inside an existing tenant transaction.
   * Returns materials cost per sale line id.
   */
  async consumeForPostedSale(
    tx: Parameters<Parameters<TenantDb['withTenant']>[1]>[0],
    input: {
      tenantId: string;
      locationId: string | null;
      membershipId: string | null;
      lines: Array<{
        id: string;
        serviceId: string;
        quantity: number;
        appointmentItemId: string | null;
      }>;
      allowNegative?: boolean;
    },
  ): Promise<Map<string, number>> {
    const materialsByLine = new Map<string, number>();

    for (const line of input.lines) {
      const recipes = await tx
        .select()
        .from(serviceInventoryRecipes)
        .where(
          and(
            eq(serviceInventoryRecipes.tenantId, input.tenantId),
            eq(serviceInventoryRecipes.serviceId, line.serviceId),
          ),
        );

      let materials = 0;
      for (const recipe of recipes) {
        const qty = Number(recipe.quantityRequired) * line.quantity;
        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, recipe.inventoryItemId))
          .limit(1);
        if (!item || item.itemKind !== 'MATERIAL') continue;

        const next = Number(item.currentStock) - qty;
        if (next < 0 && !input.allowNegative) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente para ${item.productName}.`,
          });
        }

        await tx
          .update(inventoryItems)
          .set({ currentStock: next.toFixed(4), updatedAt: new Date() })
          .where(eq(inventoryItems.id, item.id));

        await tx.insert(inventoryMovements).values({
          tenantId: input.tenantId,
          locationId: input.locationId,
          inventoryItemId: item.id,
          movementType: 'PROCEDURE_CONSUME',
          quantityDelta: (-qty).toFixed(4),
          unitCostUsdSnapshot: item.costPerUnitUsd,
          saleLineItemId: line.id,
          appointmentItemId: line.appointmentItemId,
          createdBy: input.membershipId,
          reason: 'Sale post consume',
        });

        materials += qty * Number(item.costPerUnitUsd);
      }

      materialsByLine.set(line.id, roundMoney(materials));
    }

    return materialsByLine;
  }

  async listVisitMaterials(tenantId: string, appointmentId: string) {
    await this.plans.assertFeature(tenantId, 'inventory');
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const items = await tx
        .select({ id: appointmentItems.id })
        .from(appointmentItems)
        .where(
          and(
            eq(appointmentItems.tenantId, tenantId),
            eq(appointmentItems.appointmentId, appointmentId),
          ),
        );
      const itemIds = items.map((i) => i.id);
      if (itemIds.length === 0) return [];

      const rows = await tx
        .select({
          id: inventoryMovements.id,
          createdAt: inventoryMovements.createdAt,
          quantityDelta: inventoryMovements.quantityDelta,
          unitCostUsdSnapshot: inventoryMovements.unitCostUsdSnapshot,
          reason: inventoryMovements.reason,
          appointmentItemId: inventoryMovements.appointmentItemId,
          inventoryItemId: inventoryMovements.inventoryItemId,
          productName: inventoryItems.productName,
          unitOfMeasure: inventoryItems.unitOfMeasure,
        })
        .from(inventoryMovements)
        .innerJoin(
          inventoryItems,
          eq(inventoryItems.id, inventoryMovements.inventoryItemId),
        )
        .where(
          and(
            eq(inventoryMovements.tenantId, tenantId),
            eq(inventoryMovements.movementType, 'PROCEDURE_CONSUME'),
            inArray(inventoryMovements.appointmentItemId, itemIds),
            isNull(inventoryMovements.saleLineItemId),
          ),
        )
        .orderBy(asc(inventoryMovements.createdAt));

      return rows.map((row) => ({
        ...row,
        quantityUsed: Math.abs(Number(row.quantityDelta)),
      }));
    });
  }

  /**
   * Manual materials used on a visit (appointment). Deducts stock and links
   * movements to the appointment's first line item.
   */
  async consumeForVisit(
    membership: AuthenticatedMembership,
    appointmentId: string,
    input: {
      materials: Array<{
        inventoryItemId: string;
        quantity: number;
        notes?: string;
      }>;
      allowNegative?: boolean;
    },
  ) {
    assertFinanceWriter({
      tenantId: membership.tenantId,
      role: membership.role,
    });
    await this.plans.assertFeature(membership.tenantId, 'inventory');

    return this.tenantDb.withTenant(membership.tenantId, async (tx) => {
      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.tenantId, membership.tenantId),
          ),
        )
        .limit(1);
      if (!appointment) {
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Visita no encontrada.',
        });
      }

      const apptItems = await tx
        .select()
        .from(appointmentItems)
        .where(
          and(
            eq(appointmentItems.appointmentId, appointmentId),
            eq(appointmentItems.tenantId, membership.tenantId),
          ),
        )
        .orderBy(asc(appointmentItems.sortOrder));
      const appointmentItemId = apptItems[0]?.id;
      if (!appointmentItemId) {
        throw new BadRequestException({
          code: 'APPOINTMENT_HAS_NO_ITEMS',
          message: 'La visita no tiene procedimiento para asociar materiales.',
        });
      }

      const created = [];
      for (const mat of input.materials) {
        if (!(mat.quantity > 0)) {
          throw new BadRequestException({
            code: 'INVALID_QUANTITY',
            message: 'La cantidad debe ser positiva.',
          });
        }

        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.id, mat.inventoryItemId),
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
        if (item.itemKind !== 'MATERIAL') {
          throw new BadRequestException({
            code: 'NOT_VISIT_MATERIAL',
            message: `${item.productName} es un producto de venta. Los materiales de visita se cargan aquí; los productos se venden en Finanzas.`,
          });
        }

        const next = Number(item.currentStock) - mat.quantity;
        if (next < 0 && !input.allowNegative) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente para ${item.productName} (hay ${item.currentStock} ${item.unitOfMeasure}).`,
          });
        }

        await tx
          .update(inventoryItems)
          .set({ currentStock: next.toFixed(4), updatedAt: new Date() })
          .where(eq(inventoryItems.id, item.id));

        const [movement] = await tx
          .insert(inventoryMovements)
          .values({
            tenantId: membership.tenantId,
            locationId: appointment.locationId ?? item.locationId,
            inventoryItemId: item.id,
            movementType: 'PROCEDURE_CONSUME',
            quantityDelta: (-mat.quantity).toFixed(4),
            unitCostUsdSnapshot: item.costPerUnitUsd,
            appointmentItemId,
            createdBy: membership.membershipId,
            reason: mat.notes?.trim() || 'Material usado en visita',
          })
          .returning();

        created.push({
          ...movement,
          productName: item.productName,
          unitOfMeasure: item.unitOfMeasure,
          quantityUsed: mat.quantity,
        });
      }

      return created;
    });
  }
}
