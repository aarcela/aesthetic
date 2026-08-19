import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';

import type { AuthenticatedMembership } from '../auth/auth.service.js';
import { CommissionsService } from '../commissions/commissions.service.js';
import {
  appointmentItems,
  appointments,
  saleLineItems,
  salePayments,
  sales,
} from '../database/schema.js';
import { TenantDb } from '../database/tenant-db.js';
import { FxService } from '../fx/fx.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PlansService } from '../plans/plans.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { TenantContext } from '../tenants/tenant-context.js';
import {
  paymentsMatchSaleTotal,
  roundMoney,
  usdEquivalent,
} from './payment-math.js';

type SaleLineInput = {
  serviceId: string;
  specialistId?: string;
  quantity: number;
  unitPriceUsd: number;
  appointmentItemId?: string;
};

@Injectable()
export class PosService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(FxService) private readonly fxService: FxService,
    @Inject(PlansService) private readonly plans: PlansService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(CommissionsService) private readonly commissions: CommissionsService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  createSale(
    membership: AuthenticatedMembership,
    input: {
      locationId: string;
      patientId?: string;
      appointmentId?: string;
      lines: SaleLineInput[];
    },
  ) {
    const amountUsd = roundMoney(
      input.lines.reduce(
        (sum, line) => sum + line.quantity * line.unitPriceUsd,
        0,
      ),
    );

    return this.tenantDb.withTenant(membership.tenantId, async (tx) => {
      if (input.appointmentId) {
        const [appointment] = await tx
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.id, input.appointmentId),
              eq(appointments.tenantId, membership.tenantId),
            ),
          )
          .limit(1);
        if (!appointment) {
          throw new BadRequestException({
            code: 'APPOINTMENT_NOT_FOUND',
            message: 'Cita no encontrada para la venta.',
          });
        }
      }

      const [sale] = await tx
        .insert(sales)
        .values({
          tenantId: membership.tenantId,
          locationId: input.locationId,
          appointmentId: input.appointmentId,
          patientId: input.patientId,
          createdBy: membership.membershipId,
          status: 'open',
          amountUsd: amountUsd.toFixed(2),
        })
        .returning();

      const lines = await tx
        .insert(saleLineItems)
        .values(
          input.lines.map((line) => ({
            tenantId: membership.tenantId,
            saleId: sale.id,
            appointmentItemId: line.appointmentItemId,
            serviceId: line.serviceId,
            specialistId: line.specialistId,
            quantity: line.quantity.toFixed(2),
            unitPriceUsd: line.unitPriceUsd.toFixed(2),
            lineTotalUsd: roundMoney(line.quantity * line.unitPriceUsd).toFixed(
              2,
            ),
          })),
        )
        .returning();

      return { ...sale, lines };
    });
  }

  createSaleFromAppointment(
    membership: AuthenticatedMembership,
    appointmentId: string,
  ) {
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
          message: 'Cita no encontrada.',
        });
      }

      const items = await tx
        .select()
        .from(appointmentItems)
        .where(eq(appointmentItems.appointmentId, appointmentId));

      if (items.length === 0) {
        throw new BadRequestException({
          code: 'APPOINTMENT_HAS_NO_ITEMS',
          message: 'La cita no tiene servicios para facturar.',
        });
      }

      const lines: SaleLineInput[] = items.map((item) => ({
        serviceId: item.serviceId,
        specialistId: item.specialistId,
        quantity: Number(item.quantity),
        unitPriceUsd: Number(item.unitPriceUsd),
        appointmentItemId: item.id,
      }));

      const amountUsd = roundMoney(
        lines.reduce((sum, line) => sum + line.quantity * line.unitPriceUsd, 0),
      );

      const [sale] = await tx
        .insert(sales)
        .values({
          tenantId: membership.tenantId,
          locationId: appointment.locationId,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          createdBy: membership.membershipId,
          status: 'open',
          amountUsd: amountUsd.toFixed(2),
        })
        .returning();

      const createdLines = await tx
        .insert(saleLineItems)
        .values(
          lines.map((line) => ({
            tenantId: membership.tenantId,
            saleId: sale.id,
            appointmentItemId: line.appointmentItemId,
            serviceId: line.serviceId,
            specialistId: line.specialistId,
            quantity: line.quantity.toFixed(2),
            unitPriceUsd: line.unitPriceUsd.toFixed(2),
            lineTotalUsd: roundMoney(line.quantity * line.unitPriceUsd).toFixed(
              2,
            ),
          })),
        )
        .returning();

      return { ...sale, lines: createdLines };
    });
  }

  async postSale(
    context: TenantContext,
    saleId: string,
    input: {
      payments: Array<{
        paymentMethod: string;
        amountNative: number;
        referenceNumber?: string;
        notes?: string;
      }>;
      fxFuenteOverride?: 'oficial' | 'paralelo';
    },
    membershipId?: string,
  ) {
    const snapshot = input.fxFuenteOverride
      ? await this.fxService.getSnapshotForFuente(input.fxFuenteOverride)
      : await this.fxService.createSaleSnapshot(context.tenantId);

    const fxRate = Number(snapshot.vesPerUsd);
    const catalog = await this.settings.listPaymentMethods(context.tenantId, true);
    const methodByCode = new Map(catalog.map((row) => [row.code, row]));
    const plan = await this.plans.getTenantPlan(context.tenantId);
    const useInventory =
      plan.planCode === 'pro' && plan.subscriptionStatus !== 'suspended';
    const useCommissions =
      plan.planCode === 'pro' && plan.subscriptionStatus !== 'suspended';

    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [sale] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, saleId), eq(sales.tenantId, context.tenantId)))
        .limit(1);

      if (!sale) {
        throw new NotFoundException({
          code: 'SALE_NOT_FOUND',
          message: 'Venta no encontrada.',
        });
      }
      if (sale.status !== 'open') {
        throw new BadRequestException({
          code: 'SALE_NOT_OPEN',
          message: 'Solo se pueden postear ventas abiertas.',
        });
      }

      const amountUsd = Number(sale.amountUsd ?? 0);
      const computedPayments = input.payments.map((payment) => {
        const method = methodByCode.get(payment.paymentMethod);
        if (!method) {
          throw new BadRequestException({
            code: 'PAYMENT_METHOD_UNKNOWN',
            message: 'Ese método de pago no está activo en esta clínica.',
          });
        }
        const amountUsdEquivalent = usdEquivalent({
          nativeCurrency: method.nativeCurrency,
          amountNative: payment.amountNative,
          fxRateVesPerUsd: fxRate,
        });
        return {
          tenantId: context.tenantId,
          saleId,
          paymentMethod: method.code,
          amountNative: payment.amountNative.toFixed(2),
          nativeCurrency: method.nativeCurrency,
          amountUsdEquivalent: amountUsdEquivalent.toFixed(2),
          referenceNumber: payment.referenceNumber,
          notes: payment.notes,
          amountUsdEquivalentNumber: amountUsdEquivalent,
        };
      });

      if (
        !paymentsMatchSaleTotal(
          amountUsd,
          computedPayments.map((payment) => payment.amountUsdEquivalentNumber),
        )
      ) {
        throw new BadRequestException({
          code: 'PAYMENT_TOTAL_MISMATCH',
          message:
            'La suma de pagos en USD no coincide con el total de la venta (±0.01).',
        });
      }

      const paymentRows = await tx
        .insert(salePayments)
        .values(
          computedPayments.map(
            ({ amountUsdEquivalentNumber: _ignored, ...row }) => row,
          ),
        )
        .returning();

      const [posted] = await tx
        .update(sales)
        .set({
          status: 'posted',
          fxFuente: snapshot.fuente,
          fxRate: snapshot.vesPerUsd,
          fxProviderUpdatedAt: snapshot.providerUpdatedAt,
          fxFetchedAt: snapshot.fetchedAt,
          postedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(sales.id, saleId), eq(sales.tenantId, context.tenantId)))
        .returning();

      if (sale.appointmentId) {
        await tx
          .update(appointments)
          .set({ status: 'COMPLETED', updatedAt: new Date() })
          .where(
            and(
              eq(appointments.id, sale.appointmentId),
              eq(appointments.tenantId, context.tenantId),
            ),
          );
      }

      const lines = await tx
        .select()
        .from(saleLineItems)
        .where(eq(saleLineItems.saleId, saleId));

      let materialsByLine = new Map<string, number>();
      let commissionRows: unknown[] = [];

      if (useInventory) {
        materialsByLine = await this.inventory.consumeForPostedSale(tx, {
          tenantId: context.tenantId,
          locationId: sale.locationId,
          membershipId: membershipId ?? sale.createdBy,
          lines: lines.map((line) => ({
            id: line.id,
            serviceId: line.serviceId,
            quantity: Number(line.quantity),
            appointmentItemId: line.appointmentItemId,
          })),
        });
      }

      if (useCommissions) {
        commissionRows = await this.commissions.createEntriesForPostedSale(tx, {
          tenantId: context.tenantId,
          lines: lines.map((line) => ({
            id: line.id,
            serviceId: line.serviceId,
            specialistId: line.specialistId,
            lineTotalUsd: Number(line.lineTotalUsd),
          })),
          materialsByLine,
        });
      }

      return {
        ...posted,
        lines,
        payments: paymentRows,
        commissions: commissionRows,
        materialsByLine: Object.fromEntries(materialsByLine),
      };
    });
  }

  async dailyCajaReport(
    context: TenantContext,
    input: { date: string; locationId?: string },
  ) {
    const dayStart = new Date(`${input.date}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'Use YYYY-MM-DD for the caja report date.',
      });
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const filters = [
        eq(sales.tenantId, context.tenantId),
        eq(sales.status, 'posted'),
        gte(sales.postedAt, dayStart),
        lt(sales.postedAt, dayEnd),
      ];
      if (input.locationId) {
        filters.push(eq(sales.locationId, input.locationId));
      }

      const postedSales = await tx.select().from(sales).where(and(...filters));
      const saleIds = postedSales.map((sale) => sale.id);
      if (saleIds.length === 0) {
        return {
          date: input.date,
          locationId: input.locationId ?? null,
          saleCount: 0,
          totalUsd: '0.00',
          byMethod: [],
        };
      }

      const payments = await tx
        .select()
        .from(salePayments)
        .where(
          and(
            eq(salePayments.tenantId, context.tenantId),
            inArray(salePayments.saleId, saleIds),
          ),
        );

      const byMethodMap = new Map<
        string,
        {
          paymentMethod: string;
          totalUsd: number;
          totalNative: number;
          count: number;
        }
      >();

      for (const payment of payments) {
        const key = payment.paymentMethod;
        const current = byMethodMap.get(key) ?? {
          paymentMethod: key,
          totalUsd: 0,
          totalNative: 0,
          count: 0,
        };
        current.totalUsd += Number(payment.amountUsdEquivalent);
        current.totalNative += Number(payment.amountNative);
        current.count += 1;
        byMethodMap.set(key, current);
      }

      const totalUsd = postedSales.reduce(
        (sum, sale) => sum + Number(sale.amountUsd ?? 0),
        0,
      );

      return {
        date: input.date,
        locationId: input.locationId ?? null,
        saleCount: postedSales.length,
        totalUsd: roundMoney(totalUsd).toFixed(2),
        byMethod: [...byMethodMap.values()].map((row) => ({
          paymentMethod: row.paymentMethod,
          count: row.count,
          totalUsd: roundMoney(row.totalUsd).toFixed(2),
          totalNative: roundMoney(row.totalNative).toFixed(2),
        })),
      };
    });
  }
}
