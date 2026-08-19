import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, ne, sql } from 'drizzle-orm';

import { TenantDb } from '../database/tenant-db.js';
import {
  appointmentItems,
  appointments,
  services,
  tenantMemberships,
} from '../database/schema.js';
import type { TenantContext } from '../tenants/tenant-context.js';

@Injectable()
export class SchedulingService {
  constructor(@Inject(TenantDb) private readonly tenantDb: TenantDb) {}

  listAppointments(tenantId: string, from?: string, to?: string) {
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const filters = [eq(appointments.tenantId, tenantId)];
      if (from) filters.push(gte(appointments.scheduledAt, new Date(from)));
      if (to) filters.push(lte(appointments.scheduledAt, new Date(to)));

      const rows = await tx
        .select()
        .from(appointments)
        .where(and(...filters))
        .orderBy(asc(appointments.scheduledAt));

      const items = await tx
        .select()
        .from(appointmentItems)
        .where(eq(appointmentItems.tenantId, tenantId));

      return rows.map((appointment) => ({
        ...appointment,
        items: items.filter((item) => item.appointmentId === appointment.id),
      }));
    });
  }

  async createAppointment(
    context: TenantContext,
    input: {
      locationId: string;
      patientId: string;
      scheduledAt: string;
      notes?: string;
      visitDiagnosis?: string;
      requestedExams?: string;
      depositRequiredUsd?: number;
      status?:
        | 'SCHEDULED'
        | 'CONFIRMED'
        | 'COMPLETED'
        | 'CANCELLED'
        | 'NO_SHOW';
      items: Array<{
        serviceId: string;
        specialistId: string;
        quantity: number;
        unitPriceUsd?: number;
        notes?: string;
      }>;
    },
  ) {
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const pricedItems = [];
      for (const [index, item] of input.items.entries()) {
        const [service] = await tx
          .select()
          .from(services)
          .where(
            and(
              eq(services.id, item.serviceId),
              eq(services.tenantId, context.tenantId),
            ),
          )
          .limit(1);
        if (!service || service.deletedAt) {
          throw new BadRequestException({
            code: 'SERVICE_NOT_FOUND',
            message: `Servicio no válido: ${item.serviceId}`,
          });
        }

        const [specialist] = await tx
          .select()
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.id, item.specialistId),
              eq(tenantMemberships.tenantId, context.tenantId),
              eq(tenantMemberships.isActive, true),
            ),
          )
          .limit(1);
        if (!specialist) {
          throw new BadRequestException({
            code: 'SPECIALIST_NOT_FOUND',
            message: `Especialista no válido: ${item.specialistId}`,
          });
        }

        const unitPrice =
          item.unitPriceUsd ?? Number(service.basePriceUsd);
        pricedItems.push({
          tenantId: context.tenantId,
          serviceId: item.serviceId,
          specialistId: item.specialistId,
          quantity: item.quantity.toFixed(2),
          unitPriceUsd: unitPrice.toFixed(2),
          sortOrder: index,
          notes: item.notes,
        });
      }

      const deposit = input.depositRequiredUsd ?? 0;
      const [appointment] = await tx
        .insert(appointments)
        .values({
          tenantId: context.tenantId,
          locationId: input.locationId,
          patientId: input.patientId,
          scheduledAt: new Date(input.scheduledAt),
          notes: input.notes,
          visitDiagnosis: input.visitDiagnosis,
          requestedExams: input.requestedExams,
          status: input.status ?? 'SCHEDULED',
          depositRequiredUsd: deposit.toFixed(2),
          depositStatus: deposit > 0 ? 'pending' : 'none',
        })
        .returning();

      const createdItems = await tx
        .insert(appointmentItems)
        .values(
          pricedItems.map((item) => ({
            ...item,
            appointmentId: appointment.id,
          })),
        )
        .returning();

      return { ...appointment, items: createdItems };
    });
  }

  async updateAppointment(
    context: TenantContext,
    appointmentId: string,
    input: {
      locationId?: string;
      patientId?: string;
      scheduledAt?: string;
      notes?: string | null;
      visitDiagnosis?: string | null;
      requestedExams?: string | null;
      status?:
        | 'SCHEDULED'
        | 'CONFIRMED'
        | 'COMPLETED'
        | 'CANCELLED'
        | 'NO_SHOW';
      items?: Array<{
        serviceId: string;
        specialistId: string;
        quantity: number;
        unitPriceUsd?: number;
        notes?: string;
      }>;
    },
  ) {
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.tenantId, context.tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Cita no encontrada.',
        });
      }

      const [row] = await tx
        .update(appointments)
        .set({
          ...(input.locationId ? { locationId: input.locationId } : {}),
          ...(input.patientId ? { patientId: input.patientId } : {}),
          ...(input.scheduledAt
            ? { scheduledAt: new Date(input.scheduledAt) }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.visitDiagnosis !== undefined
            ? { visitDiagnosis: input.visitDiagnosis }
            : {}),
          ...(input.requestedExams !== undefined
            ? { requestedExams: input.requestedExams }
            : {}),
          ...(input.status ? { status: input.status } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.tenantId, context.tenantId),
          ),
        )
        .returning();

      let items = await tx
        .select()
        .from(appointmentItems)
        .where(
          and(
            eq(appointmentItems.appointmentId, appointmentId),
            eq(appointmentItems.tenantId, context.tenantId),
          ),
        );

      if (input.items?.length) {
        await tx
          .delete(appointmentItems)
          .where(
            and(
              eq(appointmentItems.appointmentId, appointmentId),
              eq(appointmentItems.tenantId, context.tenantId),
            ),
          );

        const pricedItems = [];
        for (const [index, item] of input.items.entries()) {
          const [service] = await tx
            .select()
            .from(services)
            .where(
              and(
                eq(services.id, item.serviceId),
                eq(services.tenantId, context.tenantId),
              ),
            )
            .limit(1);
          if (!service || service.deletedAt) {
            throw new BadRequestException({
              code: 'SERVICE_NOT_FOUND',
              message: `Servicio no válido: ${item.serviceId}`,
            });
          }
          const unitPrice = item.unitPriceUsd ?? Number(service.basePriceUsd);
          pricedItems.push({
            tenantId: context.tenantId,
            appointmentId,
            serviceId: item.serviceId,
            specialistId: item.specialistId,
            quantity: item.quantity.toFixed(2),
            unitPriceUsd: unitPrice.toFixed(2),
            sortOrder: index,
            notes: item.notes,
          });
        }

        items = await tx.insert(appointmentItems).values(pricedItems).returning();
      }

      return { ...row, items };
    });
  }

  async updateStatus(
    context: TenantContext,
    appointmentId: string,
    status:
      | 'SCHEDULED'
      | 'CONFIRMED'
      | 'COMPLETED'
      | 'CANCELLED'
      | 'NO_SHOW',
  ) {
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .update(appointments)
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.tenantId, context.tenantId),
          ),
        )
        .returning();

      if (!row) {
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Cita no encontrada.',
        });
      }
      return row;
    });
  }

  getLatestVisitNotes(tenantId: string, patientId: string, excludeId?: string) {
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const filters = [
        eq(appointments.tenantId, tenantId),
        eq(appointments.patientId, patientId),
        eq(appointments.status, 'COMPLETED'),
        sql`(
          coalesce(btrim(${appointments.notes}), '') <> ''
          or coalesce(btrim(${appointments.visitDiagnosis}), '') <> ''
          or coalesce(btrim(${appointments.requestedExams}), '') <> ''
        )`,
      ];
      if (excludeId) filters.push(ne(appointments.id, excludeId));

      const [row] = await tx
        .select({
          id: appointments.id,
          notes: appointments.notes,
          visitDiagnosis: appointments.visitDiagnosis,
          requestedExams: appointments.requestedExams,
          scheduledAt: appointments.scheduledAt,
        })
        .from(appointments)
        .where(and(...filters))
        .orderBy(desc(appointments.scheduledAt))
        .limit(1);

      return {
        appointmentId: row?.id ?? null,
        notes: row?.notes ?? null,
        visitDiagnosis: row?.visitDiagnosis ?? null,
        requestedExams: row?.requestedExams ?? null,
        scheduledAt: row?.scheduledAt ?? null,
      };
    });
  }
}
