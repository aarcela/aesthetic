import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { z } from 'zod';

import {
  compactHomeRoutine,
  composePatientMedicalAlerts,
  createPatientSchema,
  filterAssignedLocations,
} from '@aesthetic/shared';
import { TenantDb } from '../database/tenant-db.js';
import {
  appointmentItems,
  appointments,
  digitalConsents,
  inventoryItems,
  inventoryMovements,
  locations,
  patientPhotos,
  patients,
  saleLineItems,
  salePayments,
  sales,
  services,
  tenantMemberships,
} from '../database/schema.js';
import { MediaService } from '../media/media.service.js';
import {
  assertOperationsManager,
  assertTenantManager,
  type TenantContext,
} from '../tenants/tenant-context.js';

type PatientInput = z.infer<typeof createPatientSchema>;

function blankToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function enumOrNull<T extends string>(value: T | '' | undefined): T | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

function patientClinicalPatch(input: Partial<PatientInput>, opts?: { composeAlerts?: boolean }) {
  const medicalKeysPresent = [
    'medicationAllergy',
    'currentMedications',
    'illnessNotes',
    'diabetes',
    'insulinResistance',
    'heartProblems',
    'smokes',
    'drinksAlcohol',
    'medicalAlerts',
  ].some((key) => input[key as keyof PatientInput] !== undefined);

  return {
    nationalId: blankToNull(input.nationalId),
    dateOfBirth: blankToNull(input.dateOfBirth),
    sex: enumOrNull(input.sex),
    maritalStatus: enumOrNull(input.maritalStatus),
    occupation: blankToNull(input.occupation),
    consultationReason: blankToNull(input.consultationReason),
    diagnosis: blankToNull(input.diagnosis),
    physicalActivity: blankToNull(input.physicalActivity),
    diet: blankToNull(input.diet),
    sleep: blankToNull(input.sleep),
    aestheticHistory: blankToNull(input.aestheticHistory),
    illnessNotes: blankToNull(input.illnessNotes),
    diabetes: input.diabetes,
    insulinResistance: input.insulinResistance,
    heartProblems: input.heartProblems,
    smokes: input.smokes,
    drinksAlcohol: input.drinksAlcohol,
    medicationAllergy: blankToNull(input.medicationAllergy),
    currentMedications: blankToNull(input.currentMedications),
    medicalAlerts:
      opts?.composeAlerts || medicalKeysPresent
        ? composePatientMedicalAlerts(input)
        : undefined,
    skinBiotype: enumOrNull(input.skinBiotype),
    phototype: enumOrNull(input.phototype),
    aging: blankToNull(input.aging),
    lesions: blankToNull(input.lesions),
    scars: blankToNull(input.scars),
    homeRoutineAm:
      input.homeRoutineAm === undefined
        ? undefined
        : compactHomeRoutine(input.homeRoutineAm),
    homeRoutinePm:
      input.homeRoutinePm === undefined
        ? undefined
        : compactHomeRoutine(input.homeRoutinePm),
    locationId: input.locationId,
  };
}

@Injectable()
export class ClinicCoreService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(MediaService) private readonly media: MediaService,
  ) {}

  listLocations(context: TenantContext) {
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const rows = await tx.select().from(locations).orderBy(desc(locations.createdAt));
      return filterAssignedLocations(context.role, context.locationIds ?? [], rows);
    });
  }

  async createLocation(
    context: TenantContext,
    input: { name: string; timezone: string; isPrimary?: boolean },
  ) {
    assertTenantManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      if (input.isPrimary) {
        await tx
          .update(locations)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(locations.tenantId, context.tenantId));
      }

      const [row] = await tx
        .insert(locations)
        .values({
          tenantId: context.tenantId,
          name: input.name,
          timezone: input.timezone,
          isPrimary: input.isPrimary ?? false,
        })
        .returning();
      return row;
    });
  }

  listPatients(tenantId: string) {
    return this.tenantDb.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), isNull(patients.deletedAt)))
        .orderBy(desc(patients.createdAt)),
    );
  }

  async getPatient(tenantId: string, patientId: string) {
    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.id, patientId),
            eq(patients.tenantId, tenantId),
            isNull(patients.deletedAt),
          ),
        )
        .limit(1);
      if (!row) {
        throw new NotFoundException({
          code: 'PATIENT_NOT_FOUND',
          message: 'Paciente no encontrado.',
        });
      }
      return row;
    });
  }

  async getPatientHistory(tenantId: string, patientId: string) {
    const patient = await this.getPatient(tenantId, patientId);

    return this.tenantDb.withTenant(tenantId, async (tx) => {
      const appts = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, tenantId),
            eq(appointments.patientId, patientId),
          ),
        )
        .orderBy(desc(appointments.scheduledAt));

      const apptIds = appts.map((a) => a.id);
      const apptItems =
        apptIds.length === 0
          ? []
          : await tx
              .select()
              .from(appointmentItems)
              .where(
                and(
                  eq(appointmentItems.tenantId, tenantId),
                  inArray(appointmentItems.appointmentId, apptIds),
                ),
              )
              .orderBy(asc(appointmentItems.sortOrder));

      const patientSales = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.tenantId, tenantId), eq(sales.patientId, patientId)))
        .orderBy(desc(sales.createdAt));

      const saleIds = patientSales.map((s) => s.id);
      const lines =
        saleIds.length === 0
          ? []
          : await tx
              .select()
              .from(saleLineItems)
              .where(
                and(
                  eq(saleLineItems.tenantId, tenantId),
                  inArray(saleLineItems.saleId, saleIds),
                ),
              );

      const payments =
        saleIds.length === 0
          ? []
          : await tx
              .select()
              .from(salePayments)
              .where(
                and(
                  eq(salePayments.tenantId, tenantId),
                  inArray(salePayments.saleId, saleIds),
                ),
              );

      const lineIds = lines.map((l) => l.id);
      const saleMaterials =
        lineIds.length === 0
          ? []
          : await tx
              .select({
                id: inventoryMovements.id,
                createdAt: inventoryMovements.createdAt,
                quantityDelta: inventoryMovements.quantityDelta,
                unitCostUsdSnapshot: inventoryMovements.unitCostUsdSnapshot,
                movementType: inventoryMovements.movementType,
                saleLineItemId: inventoryMovements.saleLineItemId,
                appointmentItemId: inventoryMovements.appointmentItemId,
                productName: inventoryItems.productName,
                unitOfMeasure: inventoryItems.unitOfMeasure,
                serviceId: saleLineItems.serviceId,
                saleId: saleLineItems.saleId,
              })
              .from(inventoryMovements)
              .innerJoin(
                inventoryItems,
                eq(inventoryItems.id, inventoryMovements.inventoryItemId),
              )
              .innerJoin(
                saleLineItems,
                eq(saleLineItems.id, inventoryMovements.saleLineItemId),
              )
              .where(
                and(
                  eq(inventoryMovements.tenantId, tenantId),
                  eq(inventoryMovements.movementType, 'PROCEDURE_CONSUME'),
                  inArray(inventoryMovements.saleLineItemId, lineIds),
                ),
              )
              .orderBy(desc(inventoryMovements.createdAt));

      const apptItemIds = apptItems.map((i) => i.id);
      const visitMaterials =
        apptItemIds.length === 0
          ? []
          : await tx
              .select({
                id: inventoryMovements.id,
                createdAt: inventoryMovements.createdAt,
                quantityDelta: inventoryMovements.quantityDelta,
                unitCostUsdSnapshot: inventoryMovements.unitCostUsdSnapshot,
                movementType: inventoryMovements.movementType,
                saleLineItemId: inventoryMovements.saleLineItemId,
                appointmentItemId: inventoryMovements.appointmentItemId,
                productName: inventoryItems.productName,
                unitOfMeasure: inventoryItems.unitOfMeasure,
                reason: inventoryMovements.reason,
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
                  inArray(inventoryMovements.appointmentItemId, apptItemIds),
                  isNull(inventoryMovements.saleLineItemId),
                ),
              )
              .orderBy(desc(inventoryMovements.createdAt));

      const itemToAppointmentId = Object.fromEntries(
        apptItems.map((item) => [item.id, item.appointmentId]),
      );
      const serviceRows = await tx
        .select({ id: services.id, name: services.name })
        .from(services)
        .where(eq(services.tenantId, tenantId));
      const serviceName = Object.fromEntries(serviceRows.map((s) => [s.id, s.name]));

      const membershipRows = await tx
        .select({
          id: tenantMemberships.id,
          fullName: tenantMemberships.fullName,
        })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.tenantId, tenantId));
      const specialistName = Object.fromEntries(
        membershipRows.map((m) => [m.id, m.fullName]),
      );

      const photos = await tx
        .select()
        .from(patientPhotos)
        .where(
          and(
            eq(patientPhotos.tenantId, tenantId),
            eq(patientPhotos.patientId, patientId),
          ),
        )
        .orderBy(desc(patientPhotos.createdAt));

      const consents = await tx
        .select()
        .from(digitalConsents)
        .where(
          and(
            eq(digitalConsents.tenantId, tenantId),
            eq(digitalConsents.patientId, patientId),
          ),
        )
        .orderBy(desc(digitalConsents.signedAt));

      const photosWithUrls = await Promise.all(
        photos.map(async (photo) => ({
          ...photo,
          viewUrl: await this.media.signDownload(photo.storagePath),
        })),
      );

      const consentsWithUrls = await Promise.all(
        consents.map(async (consent) => ({
          ...consent,
          viewUrl: await this.media.signDownload(consent.signatureStoragePath),
        })),
      );

      const appointmentsOut = appts.map((appointment) => ({
        ...appointment,
        items: apptItems
          .filter((item) => item.appointmentId === appointment.id)
          .map((item) => ({
            ...item,
            serviceName: serviceName[item.serviceId] ?? null,
            specialistName: specialistName[item.specialistId] ?? null,
          })),
        photos: photosWithUrls.filter(
          (photo) => photo.appointmentId === appointment.id,
        ),
        materials: visitMaterials
          .filter(
            (row) =>
              row.appointmentItemId &&
              itemToAppointmentId[row.appointmentItemId] === appointment.id,
          )
          .map((row) => ({
            ...row,
            quantityUsed: Math.abs(Number(row.quantityDelta)),
          })),
      }));

      const salesOut = patientSales.map((sale) => ({
        ...sale,
        lines: lines
          .filter((line) => line.saleId === sale.id)
          .map((line) => ({
            ...line,
            serviceName: serviceName[line.serviceId] ?? null,
            specialistName: line.specialistId
              ? (specialistName[line.specialistId] ?? null)
              : null,
          })),
        payments: payments.filter((payment) => payment.saleId === sale.id),
      }));

      const postedSales = patientSales.filter((s) => s.status === 'posted');
      const totalSpentUsd = postedSales.reduce(
        (sum, sale) => sum + Number(sale.amountUsd ?? 0),
        0,
      );
      const completedVisits = appointmentsOut.filter(
        (appointment) => appointment.status === 'COMPLETED',
      );
      const lastVisitAt = completedVisits[0]?.scheduledAt ?? null;

      const timeline = [
        ...appointmentsOut.map((appointment) => ({
          kind: 'appointment' as const,
          at: appointment.scheduledAt,
          appointment,
        })),
        ...salesOut.map((sale) => ({
          kind: 'sale' as const,
          at: sale.postedAt ?? sale.createdAt,
          sale,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      return {
        patient,
        summary: {
          appointmentCount: appointmentsOut.length,
          visitCount: completedVisits.length,
          saleCount: postedSales.length,
          totalSpentUsd: totalSpentUsd.toFixed(2),
          photoCount: photosWithUrls.length,
          consentCount: consentsWithUrls.length,
          lastVisitAt,
        },
        timeline,
        appointments: appointmentsOut,
        sales: salesOut,
        materials: [
          ...saleMaterials.map((row) => ({
            ...row,
            source: 'sale' as const,
            serviceName: row.serviceId ? (serviceName[row.serviceId] ?? null) : null,
            quantityUsed: Math.abs(Number(row.quantityDelta)),
          })),
          ...visitMaterials.map((row) => {
            const appointmentId = row.appointmentItemId
              ? itemToAppointmentId[row.appointmentItemId]
              : null;
            const apptItem = apptItems.find((i) => i.id === row.appointmentItemId);
            return {
              ...row,
              source: 'visit' as const,
              appointmentId,
              serviceId: apptItem?.serviceId ?? null,
              serviceName: apptItem?.serviceId
                ? (serviceName[apptItem.serviceId] ?? null)
                : null,
              quantityUsed: Math.abs(Number(row.quantityDelta)),
            };
          }),
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        photos: photosWithUrls,
        consents: consentsWithUrls,
      };
    });
  }

  async createPatient(context: TenantContext, input: PatientInput) {
    const clinical = patientClinicalPatch(input);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      try {
        const [row] = await tx
          .insert(patients)
          .values({
            tenantId: context.tenantId,
            firstName: input.firstName,
            lastName: input.lastName,
            phoneNumber: input.phoneNumber,
            nationalId: clinical.nationalId,
            dateOfBirth: clinical.dateOfBirth,
            sex: clinical.sex,
            maritalStatus: clinical.maritalStatus,
            occupation: clinical.occupation,
            consultationReason: clinical.consultationReason,
            diagnosis: clinical.diagnosis,
            physicalActivity: clinical.physicalActivity,
            diet: clinical.diet,
            sleep: clinical.sleep,
            aestheticHistory: clinical.aestheticHistory,
            illnessNotes: clinical.illnessNotes,
            diabetes: clinical.diabetes ?? false,
            insulinResistance: clinical.insulinResistance ?? false,
            heartProblems: clinical.heartProblems ?? false,
            smokes: clinical.smokes ?? false,
            drinksAlcohol: clinical.drinksAlcohol ?? false,
            medicationAllergy: clinical.medicationAllergy,
            currentMedications: clinical.currentMedications,
            medicalAlerts: clinical.medicalAlerts,
            skinBiotype: clinical.skinBiotype,
            phototype: clinical.phototype,
            aging: clinical.aging,
            lesions: clinical.lesions,
            scars: clinical.scars,
            homeRoutineAm: clinical.homeRoutineAm ?? {},
            homeRoutinePm: clinical.homeRoutinePm ?? {},
            locationId: clinical.locationId,
          })
          .returning();
        return row;
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException({
            code: 'PATIENT_PHONE_EXISTS',
            message: 'Ya existe un paciente con ese teléfono en esta clínica.',
          });
        }
        throw error;
      }
    });
  }

  async updatePatient(
    context: TenantContext,
    patientId: string,
    input: Partial<PatientInput>,
  ) {
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const clinical = patientClinicalPatch(input);
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.firstName !== undefined) patch.firstName = input.firstName;
      if (input.lastName !== undefined) patch.lastName = input.lastName;
      if (input.phoneNumber !== undefined) patch.phoneNumber = input.phoneNumber;
      for (const [key, value] of Object.entries(clinical)) {
        if (value !== undefined) patch[key] = value;
      }

      const [row] = await tx
        .update(patients)
        .set(patch)
        .where(
          and(
            eq(patients.id, patientId),
            eq(patients.tenantId, context.tenantId),
            isNull(patients.deletedAt),
          ),
        )
        .returning();

      if (!row) {
        throw new NotFoundException({
          code: 'PATIENT_NOT_FOUND',
          message: 'Paciente no encontrado.',
        });
      }
      return row;
    });
  }

  async softDeletePatient(context: TenantContext, patientId: string) {
    assertOperationsManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .update(patients)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(patients.id, patientId),
            eq(patients.tenantId, context.tenantId),
            isNull(patients.deletedAt),
          ),
        )
        .returning();

      if (!row) {
        throw new NotFoundException({
          code: 'PATIENT_NOT_FOUND',
          message: 'Paciente no encontrado.',
        });
      }
      return row;
    });
  }

  listServices(tenantId: string) {
    return this.tenantDb.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(services)
        .where(and(eq(services.tenantId, tenantId), isNull(services.deletedAt)))
        .orderBy(desc(services.createdAt)),
    );
  }

  async createService(
    context: TenantContext,
    input: {
      name: string;
      basePriceUsd: number;
      estimatedDurationMinutes: number;
      isActive?: boolean;
    },
  ) {
    assertOperationsManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .insert(services)
        .values({
          tenantId: context.tenantId,
          name: input.name,
          basePriceUsd: input.basePriceUsd.toFixed(2),
          estimatedDurationMinutes: input.estimatedDurationMinutes,
          isActive: input.isActive ?? true,
        })
        .returning();
      return row;
    });
  }

  async updateService(
    context: TenantContext,
    serviceId: string,
    input: Partial<{
      name: string;
      basePriceUsd: number;
      estimatedDurationMinutes: number;
      isActive: boolean;
    }>,
  ) {
    assertOperationsManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.basePriceUsd !== undefined) {
        patch.basePriceUsd = input.basePriceUsd.toFixed(2);
      }
      if (input.estimatedDurationMinutes !== undefined) {
        patch.estimatedDurationMinutes = input.estimatedDurationMinutes;
      }
      if (input.isActive !== undefined) patch.isActive = input.isActive;

      const [row] = await tx
        .update(services)
        .set(patch)
        .where(
          and(
            eq(services.id, serviceId),
            eq(services.tenantId, context.tenantId),
            isNull(services.deletedAt),
          ),
        )
        .returning();

      if (!row) {
        throw new NotFoundException({
          code: 'SERVICE_NOT_FOUND',
          message: 'Servicio no encontrado.',
        });
      }
      return row;
    });
  }

  async softDeleteService(context: TenantContext, serviceId: string) {
    assertOperationsManager(context);
    return this.tenantDb.withTenant(context.tenantId, async (tx) => {
      const [row] = await tx
        .update(services)
        .set({
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(services.id, serviceId),
            eq(services.tenantId, context.tenantId),
            isNull(services.deletedAt),
          ),
        )
        .returning();

      if (!row) {
        throw new NotFoundException({
          code: 'SERVICE_NOT_FOUND',
          message: 'Servicio no encontrado.',
        });
      }
      return row;
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
