import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const fxFuenteEnum = pgEnum('fx_fuente', ['oficial', 'paralelo', 'MANUAL']);
export const saleStatusEnum = pgEnum('sale_status', ['open', 'posted', 'void']);

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  taxId: text('tax_id'),
  primaryCurrency: text('primary_currency').notNull().default('USD'),
  defaultFxFuente: fxFuenteEnum('default_fx_fuente').notNull().default('oficial'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    status: saleStatusEnum('status').notNull().default('open'),
    amountUsd: numeric('amount_usd', { precision: 18, scale: 2 }),
    fxFuente: fxFuenteEnum('fx_fuente'),
    fxRate: numeric('fx_rate', { precision: 18, scale: 6 }),
    fxProviderUpdatedAt: timestamp('fx_provider_updated_at', { withTimezone: true }),
    fxFetchedAt: timestamp('fx_fetched_at', { withTimezone: true }),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sales_tenant_created_at_idx').on(table.tenantId, table.createdAt)],
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
