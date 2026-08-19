import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  foreignKey,
  date,
} from 'drizzle-orm/pg-core';

export const fxFuenteEnum = pgEnum('fx_fuente', ['oficial', 'paralelo', 'MANUAL']);
export const saleStatusEnum = pgEnum('sale_status', ['open', 'posted', 'void']);
export const tenantRoleEnum = pgEnum('tenant_role', [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'SPECIALIST',
  'RECEPTIONIST',
]);
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export const depositStatusEnum = pgEnum('deposit_status', [
  'none',
  'pending',
  'paid',
  'waived',
]);
export const inventoryMovementTypeEnum = pgEnum('inventory_movement_type', [
  'PURCHASE',
  'ADJUSTMENT',
  'PROCEDURE_CONSUME',
  'PROCEDURE_REVERSE',
  'RETAIL_SALE',
  'RETAIL_REVERSE',
]);
export const inventoryItemKindEnum = pgEnum('inventory_item_kind', [
  'MATERIAL',
  'RETAIL',
]);
export const commissionRuleTypeEnum = pgEnum('commission_rule_type', [
  'PERCENT_GROSS',
  'PERCENT_NET_MATERIALS',
  'FLAT',
]);
export const commissionEntryStatusEnum = pgEnum('commission_entry_status', [
  'pending',
  'included_in_payout',
  'paid',
]);
export const photoTypeEnum = pgEnum('photo_type', ['BEFORE', 'AFTER', 'OTHER']);
export const patientSexEnum = pgEnum('patient_sex', ['FEMALE', 'MALE']);
export const patientMaritalStatusEnum = pgEnum('patient_marital_status', [
  'SINGLE',
  'MARRIED',
  'COMMON_LAW',
  'DIVORCED',
  'WIDOWED',
]);
export const patientSkinBiotypeEnum = pgEnum('patient_skin_biotype', [
  'DRY',
  'OILY',
  'COMBINATION',
  'SENSITIVE',
  'NORMAL',
]);
export const patientPhototypeEnum = pgEnum('patient_phototype', [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
]);
export const planCodeEnum = pgEnum('plan_code', ['starter', 'pro']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'suspended',
]);
export const financeDirectionEnum = pgEnum('finance_direction', ['ingress', 'egress']);
export const financeNativeCurrencyEnum = pgEnum('finance_native_currency', [
  'USD',
  'VES',
  'USDT',
]);
export const financeMovementStatusEnum = pgEnum('finance_movement_status', [
  'posted',
  'void',
]);

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  taxId: text('tax_id'),
  primaryCurrency: text('primary_currency').notNull().default('USD'),
  defaultFxFuente: fxFuenteEnum('default_fx_fuente').notNull().default('oficial'),
  planCode: planCodeEnum('plan_code').notNull().default('starter'),
  subscriptionStatus: subscriptionStatusEnum('subscription_status')
    .notNull()
    .default('trialing'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    authUserId: uuid('auth_user_id').notNull(),
    fullName: text('full_name').notNull(),
    role: tenantRoleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('tenant_memberships_tenant_user_key').on(table.tenantId, table.authUserId),
    uniqueIndex('tenant_memberships_one_active_tenant_per_user_idx')
      .on(table.authUserId)
      .where(sql`is_active = true`),
    index('tenant_memberships_tenant_id_idx').on(table.tenantId),
    index('tenant_memberships_auth_user_id_idx').on(table.authUserId),
  ],
);

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    timezone: text('timezone').notNull().default('America/Caracas'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('locations_one_primary_per_tenant_idx')
      .on(table.tenantId)
      .where(sql`is_primary = true`),
    index('locations_tenant_id_idx').on(table.tenantId),
  ],
);

export const membershipLocations = pgTable(
  'membership_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => tenantMemberships.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('membership_locations_membership_location_key').on(
      table.membershipId,
      table.locationId,
    ),
    index('membership_locations_tenant_id_idx').on(table.tenantId),
    index('membership_locations_membership_id_idx').on(table.membershipId),
    index('membership_locations_location_id_idx').on(table.locationId),
  ],
);

export const tenantPaymentMethods = pgTable(
  'tenant_payment_methods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    code: text('code').notNull(),
    label: text('label').notNull(),
    nativeCurrency: financeNativeCurrencyEnum('native_currency').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isSystem: boolean('is_system').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('tenant_payment_methods_tenant_code_uidx').on(table.tenantId, table.code),
    index('tenant_payment_methods_tenant_sort_idx').on(
      table.tenantId,
      table.sortOrder,
      table.label,
    ),
  ],
);

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    locationId: uuid('location_id').references(() => locations.id),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phoneNumber: text('phone_number').notNull(),
    nationalId: text('national_id'),
    dateOfBirth: date('date_of_birth', { mode: 'string' }),
    sex: patientSexEnum('sex'),
    maritalStatus: patientMaritalStatusEnum('marital_status'),
    occupation: text('occupation'),
    consultationReason: text('consultation_reason'),
    diagnosis: text('diagnosis'),
    physicalActivity: text('physical_activity'),
    diet: text('diet'),
    sleep: text('sleep'),
    aestheticHistory: text('aesthetic_history'),
    illnessNotes: text('illness_notes'),
    diabetes: boolean('diabetes').notNull().default(false),
    insulinResistance: boolean('insulin_resistance').notNull().default(false),
    heartProblems: boolean('heart_problems').notNull().default(false),
    smokes: boolean('smokes').notNull().default(false),
    drinksAlcohol: boolean('drinks_alcohol').notNull().default(false),
    medicationAllergy: text('medication_allergy'),
    currentMedications: text('current_medications'),
    medicalAlerts: text('medical_alerts'),
    skinBiotype: patientSkinBiotypeEnum('skin_biotype'),
    phototype: patientPhototypeEnum('phototype'),
    aging: text('aging'),
    lesions: text('lesions'),
    scars: text('scars'),
    homeRoutineAm: jsonb('home_routine_am')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    homeRoutinePm: jsonb('home_routine_pm')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('patients_tenant_phone_key').on(table.tenantId, table.phoneNumber),
    index('patients_tenant_created_at_idx').on(table.tenantId, table.createdAt),
    index('patients_tenant_name_idx').on(table.tenantId, table.lastName, table.firstName),
  ],
);

export const services = pgTable(
  'services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    basePriceUsd: numeric('base_price_usd', { precision: 18, scale: 2 }).notNull(),
    estimatedDurationMinutes: integer('estimated_duration_minutes').notNull().default(30),
    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('services_tenant_active_idx').on(table.tenantId, table.isActive),
    index('services_tenant_name_idx').on(table.tenantId, table.name),
  ],
);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    locationId: uuid('location_id').references(() => locations.id),
    appointmentId: uuid('appointment_id'),
    patientId: uuid('patient_id').references(() => patients.id),
    createdBy: uuid('created_by').references(() => tenantMemberships.id),
    status: saleStatusEnum('status').notNull().default('open'),
    amountUsd: numeric('amount_usd', { precision: 18, scale: 2 }),
    fxFuente: fxFuenteEnum('fx_fuente'),
    fxRate: numeric('fx_rate', { precision: 18, scale: 6 }),
    fxProviderUpdatedAt: timestamp('fx_provider_updated_at', { withTimezone: true }),
    fxFetchedAt: timestamp('fx_fetched_at', { withTimezone: true }),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sales_tenant_created_at_idx').on(table.tenantId, table.createdAt),
    index('sales_tenant_location_posted_at_idx').on(
      table.tenantId,
      table.locationId,
      table.postedAt,
    ),
  ],
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    status: appointmentStatusEnum('status').notNull().default('SCHEDULED'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    notes: text('notes'),
    visitDiagnosis: text('visit_diagnosis'),
    requestedExams: text('requested_exams'),
    depositRequiredUsd: numeric('deposit_required_usd', { precision: 18, scale: 2 })
      .notNull()
      .default('0'),
    depositStatus: depositStatusEnum('deposit_status').notNull().default('none'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('appointments_tenant_scheduled_at_idx').on(table.tenantId, table.scheduledAt),
    index('appointments_tenant_location_scheduled_at_idx').on(
      table.tenantId,
      table.locationId,
      table.scheduledAt,
    ),
  ],
);

export const appointmentItems = pgTable(
  'appointment_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    specialistId: uuid('specialist_id')
      .notNull()
      .references(() => tenantMemberships.id),
    quantity: numeric('quantity', { precision: 18, scale: 2 }).notNull().default('1'),
    unitPriceUsd: numeric('unit_price_usd', { precision: 18, scale: 2 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('appointment_items_appointment_id_idx').on(table.appointmentId),
    index('appointment_items_tenant_id_idx').on(table.tenantId),
  ],
);

export const saleLineItems = pgTable(
  'sale_line_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    appointmentItemId: uuid('appointment_item_id').references(() => appointmentItems.id),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    specialistId: uuid('specialist_id').references(() => tenantMemberships.id),
    quantity: numeric('quantity', { precision: 18, scale: 2 }).notNull().default('1'),
    unitPriceUsd: numeric('unit_price_usd', { precision: 18, scale: 2 }).notNull(),
    lineTotalUsd: numeric('line_total_usd', { precision: 18, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sale_line_items_sale_id_idx').on(table.saleId),
    index('sale_line_items_tenant_id_idx').on(table.tenantId),
  ],
);

export const salePayments = pgTable(
  'sale_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    paymentMethod: text('payment_method').notNull(),
    amountNative: numeric('amount_native', { precision: 18, scale: 2 }).notNull(),
    nativeCurrency: text('native_currency').notNull(),
    amountUsdEquivalent: numeric('amount_usd_equivalent', { precision: 18, scale: 2 }).notNull(),
    referenceNumber: text('reference_number'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sale_payments_sale_id_idx').on(table.saleId),
    index('sale_payments_tenant_id_idx').on(table.tenantId),
    foreignKey({
      name: 'sale_payments_payment_method_fkey',
      columns: [table.tenantId, table.paymentMethod],
      foreignColumns: [tenantPaymentMethods.tenantId, tenantPaymentMethods.code],
    }),
  ],
);

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    locationId: uuid('location_id').references(() => locations.id),
    productName: text('product_name').notNull(),
    itemKind: inventoryItemKindEnum('item_kind').notNull().default('MATERIAL'),
    unitOfMeasure: text('unit_of_measure').notNull(),
    packageCapacity: numeric('package_capacity', { precision: 18, scale: 4 }).notNull().default('1'),
    currentStock: numeric('current_stock', { precision: 18, scale: 4 }).notNull().default('0'),
    minStockAlert: numeric('min_stock_alert', { precision: 18, scale: 4 }).notNull().default('5'),
    costPerUnitUsd: numeric('cost_per_unit_usd', { precision: 18, scale: 4 }).notNull().default('0'),
    salePriceUsd: numeric('sale_price_usd', { precision: 18, scale: 4 }).notNull().default('0'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('inventory_items_tenant_id_idx').on(table.tenantId)],
);

export const serviceInventoryRecipes = pgTable(
  'service_inventory_recipes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    serviceId: uuid('service_id').notNull().references(() => services.id),
    inventoryItemId: uuid('inventory_item_id').notNull().references(() => inventoryItems.id),
    quantityRequired: numeric('quantity_required', { precision: 18, scale: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('service_inventory_recipes_service_item_key').on(
      table.serviceId,
      table.inventoryItemId,
    ),
    index('service_inventory_recipes_tenant_id_idx').on(table.tenantId),
  ],
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    locationId: uuid('location_id').references(() => locations.id),
    inventoryItemId: uuid('inventory_item_id').notNull().references(() => inventoryItems.id),
    movementType: inventoryMovementTypeEnum('movement_type').notNull(),
    quantityDelta: numeric('quantity_delta', { precision: 18, scale: 4 }).notNull(),
    unitCostUsdSnapshot: numeric('unit_cost_usd_snapshot', { precision: 18, scale: 4 })
      .notNull()
      .default('0'),
    saleLineItemId: uuid('sale_line_item_id').references(() => saleLineItems.id),
    appointmentItemId: uuid('appointment_item_id').references(() => appointmentItems.id),
    financeMovementId: uuid('finance_movement_id'),
    reason: text('reason'),
    createdBy: uuid('created_by').references(() => tenantMemberships.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('inventory_movements_tenant_item_idx').on(
      table.tenantId,
      table.inventoryItemId,
      table.createdAt,
    ),
  ],
);

export const commissionRules = pgTable(
  'commission_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    specialistMembershipId: uuid('specialist_membership_id').references(
      () => tenantMemberships.id,
    ),
    serviceId: uuid('service_id').references(() => services.id),
    ruleType: commissionRuleTypeEnum('rule_type').notNull(),
    ratePercent: numeric('rate_percent', { precision: 8, scale: 4 }),
    flatUsd: numeric('flat_usd', { precision: 18, scale: 2 }),
    priority: integer('priority').notNull().default(100),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('commission_rules_tenant_id_idx').on(table.tenantId)],
);

export const commissionEntries = pgTable(
  'commission_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    saleLineItemId: uuid('sale_line_item_id').notNull().references(() => saleLineItems.id),
    specialistMembershipId: uuid('specialist_membership_id')
      .notNull()
      .references(() => tenantMemberships.id),
    ruleId: uuid('rule_id').references(() => commissionRules.id),
    grossUsd: numeric('gross_usd', { precision: 18, scale: 2 }).notNull(),
    materialsUsd: numeric('materials_usd', { precision: 18, scale: 2 }).notNull().default('0'),
    commissionUsd: numeric('commission_usd', { precision: 18, scale: 2 }).notNull(),
    status: commissionEntryStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('commission_entries_tenant_created_at_idx').on(table.tenantId, table.createdAt),
    index('commission_entries_specialist_idx').on(
      table.tenantId,
      table.specialistMembershipId,
    ),
  ],
);

export const patientPhotos = pgTable(
  'patient_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    appointmentId: uuid('appointment_id'),
    photoType: photoTypeEnum('photo_type').notNull(),
    storagePath: text('storage_path').notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => tenantMemberships.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('patient_photos_tenant_patient_idx').on(
      table.tenantId,
      table.patientId,
      table.createdAt,
    ),
  ],
);

export const digitalConsents = pgTable(
  'digital_consents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    appointmentId: uuid('appointment_id'),
    procedureName: text('procedure_name').notNull(),
    signatureStoragePath: text('signature_storage_path').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => tenantMemberships.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('digital_consents_tenant_patient_idx').on(
      table.tenantId,
      table.patientId,
      table.signedAt,
    ),
  ],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    key: text('key').notNull(),
    route: text('route').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('idempotency_keys_tenant_key').on(table.tenantId, table.key),
    index('idempotency_keys_tenant_created_at_idx').on(table.tenantId, table.createdAt),
  ],
);

export const financeTypes = pgTable(
  'finance_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    direction: financeDirectionEnum('direction').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(100),
    isActive: boolean('is_active').notNull().default(true),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('finance_types_tenant_direction_idx').on(
      table.tenantId,
      table.direction,
      table.sortOrder,
    ),
  ],
);

export const financeMovements = pgTable(
  'finance_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    locationId: uuid('location_id').references(() => locations.id),
    direction: financeDirectionEnum('direction').notNull(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => financeTypes.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    amountNative: numeric('amount_native', { precision: 18, scale: 2 }).notNull(),
    nativeCurrency: financeNativeCurrencyEnum('native_currency').notNull(),
    amountUsdEquivalent: numeric('amount_usd_equivalent', {
      precision: 18,
      scale: 2,
    }).notNull(),
    fxFuente: fxFuenteEnum('fx_fuente'),
    fxRate: numeric('fx_rate', { precision: 18, scale: 6 }),
    paymentMethod: text('payment_method'),
    counterparty: text('counterparty'),
    referenceNumber: text('reference_number'),
    notes: text('notes'),
    saleId: uuid('sale_id').references(() => sales.id),
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id),
    quantity: numeric('quantity', { precision: 18, scale: 4 }),
    status: financeMovementStatusEnum('status').notNull().default('posted'),
    createdBy: uuid('created_by').references(() => tenantMemberships.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('finance_movements_tenant_occurred_at_idx').on(
      table.tenantId,
      table.occurredAt,
    ),
    index('finance_movements_tenant_direction_occurred_at_idx').on(
      table.tenantId,
      table.direction,
      table.occurredAt,
    ),
    index('finance_movements_tenant_type_idx').on(table.tenantId, table.typeId),
    foreignKey({
      name: 'finance_movements_payment_method_fkey',
      columns: [table.tenantId, table.paymentMethod],
      foreignColumns: [tenantPaymentMethods.tenantId, tenantPaymentMethods.code],
    }),
  ],
);

const privateSchema = pgSchema('private');

export const exchangeRates = privateSchema.table(
  'exchange_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull().default('DOLARAPI'),
    fuente: fxFuenteEnum('fuente').notNull(),
    vesPerUsd: numeric('ves_per_usd', { precision: 18, scale: 6 }).notNull(),
    providerUpdatedAt: timestamp('provider_updated_at', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    rawPayload: jsonb('raw_payload').notNull(),
  },
  (table) => [
    unique('exchange_rates_provider_source_updated_key').on(
      table.provider,
      table.fuente,
      table.providerUpdatedAt,
    ),
    index('exchange_rates_source_fetched_at_idx').on(table.fuente, table.fetchedAt),
  ],
);
