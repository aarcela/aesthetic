import { z } from 'zod';

export const tenantRoles = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'SPECIALIST',
  'RECEPTIONIST',
] as const;

export const tenantRoleSchema = z.enum(tenantRoles);
export type TenantRole = z.infer<typeof tenantRoleSchema>;

export const assignableTenantRoles = [
  'ADMIN',
  'MANAGER',
  'SPECIALIST',
  'RECEPTIONIST',
] as const;

export const assignableTenantRoleSchema = z.enum(assignableTenantRoles);
export type AssignableTenantRole = z.infer<typeof assignableTenantRoleSchema>;

export const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Admin',
  MANAGER: 'Gerente',
  SPECIALIST: 'Especialista',
  RECEPTIONIST: 'Recepción',
};

export function tenantRoleLabel(role: string): string {
  return TENANT_ROLE_LABELS[role as TenantRole] ?? role;
}

/** Dueño y admin: configuración, finanzas y equipo. */
export function canAccessSettings(role: TenantRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/** Libro de dinero (Finanzas). Caja POS no entra aquí. */
export function canAccessFinance(role: TenantRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canManageTeam(role: TenantRole): boolean {
  return canAccessSettings(role);
}

/** Catálogo, inventario, pacientes y comisiones operativas. */
export function canManageOperations(role: TenantRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
}

export function canAccessNav(role: TenantRole, href: string): boolean {
  if (href === '/app/settings' || href.startsWith('/app/settings/')) {
    return canAccessSettings(role);
  }
  if (href === '/app/finanzas' || href.startsWith('/app/finanzas/')) {
    return canAccessFinance(role);
  }
  return true;
}

/** Dueño y admin ven todas las sedes; el resto solo las asignadas. */
export function filterAssignedLocations<T extends { id: string }>(
  role: TenantRole,
  assignedIds: string[],
  locations: T[],
): T[] {
  if (canAccessSettings(role)) return locations;
  const allowed = new Set(assignedIds);
  return locations.filter((row) => allowed.has(row.id));
}

export const locationIdListSchema = z.array(z.string().uuid()).min(1, 'Asigna al menos una sede');

export const inviteMemberSchema = z.object({
  email: z.string().trim().email('Correo inválido').max(255),
  fullName: z.string().trim().min(2).max(255),
  role: assignableTenantRoleSchema,
  locationIds: locationIdListSchema,
});

export type InviteMember = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z
  .object({
    fullName: z.string().trim().min(2).max(255).optional(),
    role: assignableTenantRoleSchema.optional(),
    isActive: z.boolean().optional(),
    locationIds: locationIdListSchema.optional(),
  })
  .refine(
    (value) =>
      value.fullName !== undefined ||
      value.role !== undefined ||
      value.isActive !== undefined ||
      value.locationIds !== undefined,
    { message: 'Nada que actualizar.' },
  );

export type UpdateMember = z.infer<typeof updateMemberSchema>;

export const fxFuenteSchema = z.enum(['oficial', 'paralelo']);
export type FxFuente = z.infer<typeof fxFuenteSchema>;

export const dollarApiRateSchema = z.object({
  moneda: z.literal('USD'),
  fuente: fxFuenteSchema,
  nombre: z.string(),
  compra: z.number().nullable(),
  venta: z.number().nullable(),
  promedio: z.number().positive(),
  fechaActualizacion: z.string().datetime({ offset: true }),
});

export const dollarApiRatesSchema = z.array(dollarApiRateSchema);

export const updateFxSourceSchema = z.object({
  fuente: fxFuenteSchema,
});

export type UpdateFxSource = z.infer<typeof updateFxSourceSchema>;

export type FxRateSnapshot = {
  fuente: FxFuente;
  vesPerUsd: string;
  providerUpdatedAt: Date;
  fetchedAt: Date;
};

export const createLocationSchema = z.object({
  name: z.string().min(1).max(255),
  timezone: z.string().min(3).max(100).default('America/Caracas'),
  isPrimary: z.boolean().optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

export const patientSexSchema = z.enum(['FEMALE', 'MALE']);
export type PatientSex = z.infer<typeof patientSexSchema>;

export const patientMaritalStatusSchema = z.enum([
  'SINGLE',
  'MARRIED',
  'COMMON_LAW',
  'DIVORCED',
  'WIDOWED',
]);
export type PatientMaritalStatus = z.infer<typeof patientMaritalStatusSchema>;

export const patientSkinBiotypeSchema = z.enum([
  'DRY',
  'OILY',
  'COMBINATION',
  'SENSITIVE',
  'NORMAL',
]);
export type PatientSkinBiotype = z.infer<typeof patientSkinBiotypeSchema>;

export const patientPhototypeSchema = z.enum(['I', 'II', 'III', 'IV', 'V', 'VI']);
export type PatientPhototype = z.infer<typeof patientPhototypeSchema>;

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalEnum = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.literal('')]).optional();

export const homeRoutineAmSchema = z.object({
  cleanser: optionalText(255),
  toner: optionalText(255),
  eyeContour: optionalText(255),
  serum: optionalText(255),
  moisturizer: optionalText(255),
  sunscreen: optionalText(255),
  lipProtection: optionalText(255),
  notes: optionalText(2000),
});
export type HomeRoutineAm = z.infer<typeof homeRoutineAmSchema>;

export const homeRoutinePmSchema = z.object({
  cleanser: optionalText(255),
  toner: optionalText(255),
  eyeContour: optionalText(255),
  serum: optionalText(255),
  moisturizer: optionalText(255),
  lipProtection: optionalText(255),
  doubleCleanser: optionalText(255),
  notes: optionalText(2000),
});
export type HomeRoutinePm = z.infer<typeof homeRoutinePmSchema>;

export function compactHomeRoutine<T extends Record<string, string | undefined>>(
  routine: T | null | undefined,
): T | Record<string, never> {
  if (!routine) return {};
  const compacted = Object.fromEntries(
    Object.entries(routine).flatMap(([key, value]) => {
      const trimmed = value?.trim();
      return trimmed ? [[key, trimmed]] : [];
    }),
  ) as T;
  return compacted;
}

export function composePatientMedicalAlerts(input: {
  medicationAllergy?: string | null;
  currentMedications?: string | null;
  illnessNotes?: string | null;
  diabetes?: boolean | null;
  insulinResistance?: boolean | null;
  heartProblems?: boolean | null;
  smokes?: boolean | null;
  drinksAlcohol?: boolean | null;
  medicalAlerts?: string | null;
}): string | null {
  const parts: string[] = [];
  if (input.medicationAllergy?.trim()) parts.push(`Alergia: ${input.medicationAllergy.trim()}`);
  if (input.currentMedications?.trim()) {
    parts.push(`Medicación: ${input.currentMedications.trim()}`);
  }
  if (input.illnessNotes?.trim()) parts.push(input.illnessNotes.trim());
  if (input.diabetes) parts.push('Diabetes');
  if (input.insulinResistance) parts.push('Resistencia a la insulina');
  if (input.heartProblems) parts.push('Problemas cardiacos');
  if (input.smokes) parts.push('Fuma');
  if (input.drinksAlcohol) parts.push('Consume alcohol');
  if (parts.length > 0) return parts.join(' · ');
  const fallback = input.medicalAlerts?.trim();
  return fallback || null;
}

export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  phoneNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^\d+]/g, ''))
    .refine((value) => value.replace(/\D/g, '').length >= 10, {
      message: 'Escribe el teléfono completo, no solo el prefijo (mín. 10 dígitos).',
    })
    .refine((value) => value.length <= 50, {
      message: 'El teléfono es demasiado largo.',
    }),
  nationalId: optionalText(50),
  dateOfBirth: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento inválida'), z.literal('')])
    .optional(),
  sex: optionalEnum(patientSexSchema),
  maritalStatus: optionalEnum(patientMaritalStatusSchema),
  occupation: optionalText(120),
  consultationReason: optionalText(2000),
  diagnosis: optionalText(2000),
  physicalActivity: optionalText(1000),
  diet: optionalText(1000),
  sleep: optionalText(1000),
  aestheticHistory: optionalText(2000),
  illnessNotes: optionalText(2000),
  diabetes: z.boolean().optional(),
  insulinResistance: z.boolean().optional(),
  heartProblems: z.boolean().optional(),
  smokes: z.boolean().optional(),
  drinksAlcohol: z.boolean().optional(),
  medicationAllergy: optionalText(2000),
  currentMedications: optionalText(2000),
  medicalAlerts: optionalText(2000),
  skinBiotype: optionalEnum(patientSkinBiotypeSchema),
  phototype: optionalEnum(patientPhototypeSchema),
  aging: optionalText(1000),
  lesions: optionalText(1000),
  scars: optionalText(1000),
  homeRoutineAm: homeRoutineAmSchema.optional(),
  homeRoutinePm: homeRoutinePmSchema.optional(),
  locationId: z.string().uuid().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  basePriceUsd: z.number().nonnegative(),
  estimatedDurationMinutes: z.number().int().positive().default(30),
  isActive: z.boolean().optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const paymentMethodCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[A-Z0-9_]+$/, 'Código de método inválido');

export const DEFAULT_PAYMENT_METHODS = [
  { code: 'ZELLE', label: 'Zelle (USD)', nativeCurrency: 'USD' as const, sortOrder: 10 },
  { code: 'PAGO_MOVIL', label: 'Pago móvil (VES)', nativeCurrency: 'VES' as const, sortOrder: 20 },
  { code: 'CASH_USD', label: 'Efectivo USD', nativeCurrency: 'USD' as const, sortOrder: 30 },
  { code: 'CASH_VES', label: 'Efectivo VES', nativeCurrency: 'VES' as const, sortOrder: 40 },
  { code: 'BINANCE_USDT', label: 'USDT / Binance', nativeCurrency: 'USDT' as const, sortOrder: 50 },
  { code: 'POS_VES', label: 'Punto de venta (VES)', nativeCurrency: 'VES' as const, sortOrder: 60 },
] as const;

/** @deprecated Use tenant payment methods; kept for older clients. */
export const paymentMethodSchema = z.enum([
  'ZELLE',
  'PAGO_MOVIL',
  'CASH_USD',
  'CASH_VES',
  'BINANCE_USDT',
  'POS_VES',
]);

export const appointmentStatusSchema = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

export const appointmentItemInputSchema = z.object({
  serviceId: z.string().uuid(),
  specialistId: z.string().uuid(),
  quantity: z.number().positive().default(1),
  unitPriceUsd: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

export const createAppointmentSchema = z.object({
  locationId: z.string().uuid(),
  patientId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  notes: z.string().max(4000).optional(),
  visitDiagnosis: z.string().max(4000).optional(),
  requestedExams: z.string().max(4000).optional(),
  depositRequiredUsd: z.number().nonnegative().optional(),
  status: appointmentStatusSchema.optional(),
  items: z.array(appointmentItemInputSchema).min(1),
});

export const updateAppointmentStatusSchema = z.object({
  status: appointmentStatusSchema,
});

export const updateAppointmentSchema = z.object({
  locationId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(4000).optional().nullable(),
  visitDiagnosis: z.string().max(4000).optional().nullable(),
  requestedExams: z.string().max(4000).optional().nullable(),
  status: appointmentStatusSchema.optional(),
  items: z.array(appointmentItemInputSchema).min(1).optional(),
});

export const saleLineInputSchema = z.object({
  serviceId: z.string().uuid(),
  specialistId: z.string().uuid().optional(),
  quantity: z.number().positive().default(1),
  unitPriceUsd: z.number().nonnegative(),
  appointmentItemId: z.string().uuid().optional(),
});

export const createSaleSchema = z.object({
  locationId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  lines: z.array(saleLineInputSchema).min(1),
});

export const salePaymentInputSchema = z.object({
  paymentMethod: paymentMethodCodeSchema,
  amountNative: z.number().positive(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const postSaleSchema = z.object({
  payments: z.array(salePaymentInputSchema).min(1),
  fxFuenteOverride: fxFuenteSchema.optional(),
});

export const planCodeSchema = z.enum(['starter', 'pro']);

export const inventoryItemKindSchema = z.enum(['MATERIAL', 'RETAIL']);

export const createInventoryItemSchema = z.object({
  productName: z.string().min(1).max(255),
  itemKind: inventoryItemKindSchema.default('MATERIAL'),
  unitOfMeasure: z.string().min(1).max(50),
  packageCapacity: z.number().positive().default(1),
  currentStock: z.number().nonnegative().default(0),
  minStockAlert: z.number().nonnegative().default(5),
  costPerUnitUsd: z.number().nonnegative().default(0),
  salePriceUsd: z.number().nonnegative().default(0),
  locationId: z.string().uuid().optional(),
});

export const updateInventoryItemSchema = z.object({
  productName: z.string().min(1).max(255).optional(),
  itemKind: inventoryItemKindSchema.optional(),
  unitOfMeasure: z.string().min(1).max(50).optional(),
  packageCapacity: z.number().positive().optional(),
  minStockAlert: z.number().nonnegative().optional(),
  costPerUnitUsd: z.number().nonnegative().optional(),
  salePriceUsd: z.number().nonnegative().optional(),
  locationId: z.string().uuid().optional().nullable(),
});

export const adjustInventorySchema = z.object({
  quantityDelta: z.number(),
  reason: z.string().min(1).max(500),
  movementType: z.enum(['PURCHASE', 'ADJUSTMENT']),
});

export const createRecipeSchema = z.object({
  serviceId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  quantityRequired: z.number().positive(),
});

export const recordVisitMaterialsSchema = z.object({
  materials: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        quantity: z.number().positive(),
        notes: z.string().max(500).optional(),
      }),
    )
    .min(1),
  allowNegative: z.boolean().optional(),
});

export const createCommissionRuleSchema = z.object({
  specialistMembershipId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  ruleType: z.enum(['PERCENT_GROSS', 'PERCENT_NET_MATERIALS', 'FLAT']),
  ratePercent: z.number().nonnegative().optional(),
  flatUsd: z.number().nonnegative().optional(),
  priority: z.number().int().optional(),
});

export const createPhotoSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  photoType: z.enum(['BEFORE', 'AFTER', 'OTHER']),
  fileName: z.string().min(1).max(255),
  notes: z.string().max(1000).optional(),
});

export const createConsentSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  procedureName: z.string().min(1).max(255),
  fileName: z.string().min(1).max(255),
});

export const updateTenantPlanSchema = z.object({
  planCode: planCodeSchema,
  subscriptionStatus: z
    .enum(['trialing', 'active', 'past_due', 'suspended'])
    .optional(),
});

export const updateClinicProfileSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  taxId: z.string().trim().min(3).max(50).optional().nullable(),
});

export const financeDirectionSchema = z.enum(['ingress', 'egress']);
export type FinanceDirection = z.infer<typeof financeDirectionSchema>;

export const financeNativeCurrencySchema = z.enum(['USD', 'VES', 'USDT']);
export type FinanceNativeCurrency = z.infer<typeof financeNativeCurrencySchema>;

export const createPaymentMethodSchema = z.object({
  label: z.string().trim().min(1).max(80),
  nativeCurrency: financeNativeCurrencySchema,
  sortOrder: z.number().int().optional(),
});

export const updatePaymentMethodSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const createFinanceTypeSchema = z.object({
  direction: financeDirectionSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateFinanceTypeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const createFinanceMovementSchema = z.object({
  typeId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  locationId: z.string().uuid().optional(),
  amountNative: z.number().positive(),
  nativeCurrency: financeNativeCurrencySchema,
  paymentMethod: paymentMethodCodeSchema.optional(),
  counterparty: z.string().max(255).optional(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  inventoryItemId: z.string().uuid().optional(),
  quantity: z.number().positive().optional(),
});
