# Data Model

Specification only — **do not treat as applied migrations yet**. When implementing, create migrations via Supabase CLI (`supabase migration new ...`).

## ER overview (MVP)

```
tenants ─┬─ locations
         ├─ tenant_memberships ── users (auth.users)
         ├─ patients ─┬─ patient_photos
         │            └─ digital_consents
         ├─ services ── service_inventory_recipes ── inventory_items
         │                                            │
         ├─ appointments ── appointment_items ────────┤
         │                       │                    │
         │                       ▼                    │
         ├─ sales ── sale_line_items ── inventory_movements
         │    │            │
         │    │            └─ commission_entries
         │    └─ sale_payments
         ├─ commission_rules
         ├─ exchange_rates
         └─ message_jobs
```

## Entity dictionary

| Entity | Purpose |
|--------|---------|
| `tenants` | Clinic business; RIF; primary currency; subscription; `default_fx_fuente` |
| `locations` | Physical branch; timezone; address |
| `tenant_memberships` | Links Supabase `auth.users` to tenant + role |
| `patients` | Lightweight CRM |
| `patient_photos` | Before/after metadata + storage path |
| `digital_consents` | Signed liability records |
| `services` | Sellable procedures |
| `inventory_items` | Stocked consumables |
| `service_inventory_recipes` | BOM per service |
| `appointments` | Schedule header + status + deposit fields |
| `appointment_items` | Line items: service + specialist + price |
| `sales` | Checkout header + FX snapshot; walk-in if no appointment |
| `sale_line_items` | Services sold (from appointment or ad hoc) |
| `sale_payments` | Split payment legs |
| `inventory_movements` | Append-only stock ledger (per line) |
| `commission_rules` | How to pay specialists |
| `commission_entries` | Calculated lines per sale line |
| `exchange_rates` | DolarApi (and manual) FX observations |
| `message_jobs` | WhatsApp outbox |

## Design changes vs original DDL

| Original | Improved |
|----------|----------|
| Single `transactions` row = one method | `sales` + `sale_payments` for splits |
| One service per appointment | `appointment_items` + `sale_line_items` |
| Appointment required for money | Walk-ins: `sales.appointment_id` nullable |
| Stock only on `current_stock` | + `inventory_movements` ledger |
| No commissions | `commission_rules` + `commission_entries` |
| No locations | `locations` |
| No FX history | `exchange_rates` from DolarApi |
| Single `bcv_exchange_rate` | Snapshot `fx_fuente` + `fx_rate` (`oficial` \| `paralelo` \| `MANUAL`) |
| `users` table owns email auth | Prefer Supabase `auth.users` + `tenant_memberships` |
| Photos `appointment_id` without FK | Proper FK + nullable |
| No soft delete | `deleted_at` on patients/services/items |
| RLS USING only | Add `WITH CHECK`; cover all tables |
| `tenants` without RLS | Restrict carefully (members see own tenant) |

## Suggested columns (logical DDL notes)

### tenants

- `id`, `name`, `tax_id` (RIF), `primary_currency` default `USD`  
- `default_fx_fuente` (`oficial` \| `paralelo`) default `oficial`  
- `subscription_status`, `plan_code` (`starter` \| `pro`)  
- `created_at`, `updated_at`

### locations

- `id`, `tenant_id`, `name`, `timezone`, `is_primary`, timestamps  

### tenant_memberships

- `id`, `tenant_id`, `auth_user_id` (uuid), `full_name`, `role`, `is_active`  
- `UNIQUE(tenant_id, auth_user_id)`

### patients

- Original fields + `location_id` optional + `whatsapp_opt_in` + `deleted_at`  
- `UNIQUE(tenant_id, phone_number)`

### appointments

- Header: patient, location, status, scheduled window, deposits  
- `deposit_required_usd`, `deposit_status`, `deposit_sale_id` nullable  
- Indexes: `(tenant_id, scheduled_at)`, `(tenant_id, location_id, scheduled_at)`

### appointment_items

- `id`, `tenant_id`, `appointment_id`, `service_id`, `specialist_id`  
- `unit_price_usd`, `quantity` (default 1), `sort_order`, `notes`  
- At least one item required per appointment

### sales

- `id`, `tenant_id`, `location_id`, `appointment_id` **nullable** (walk-in), `patient_id`  
- `amount_usd`, `status` (`open` \| `posted` \| `void`)  
- FX snapshot: `fx_fuente` (`oficial` \| `paralelo` \| `MANUAL`), `fx_rate`, `fx_fuente_updated_at`, `fx_fetched_at`  
- `created_by`, `created_at`  
- Voiding creates compensating inventory/commission logic (document before coding).

### sale_line_items

- `id`, `tenant_id`, `sale_id`  
- `appointment_item_id` nullable, `service_id`, `specialist_id`  
- `quantity`, `unit_price_usd`, `line_total_usd`  
- Walk-in lines have no `appointment_item_id`

### sale_payments

- `id`, `tenant_id`, `sale_id`  
- `payment_method`, `amount_usd_equivalent`, `amount_native`, `native_currency`  
- `reference_number`, `notes`, `created_at`

### inventory_movements

- `id`, `tenant_id`, `location_id`, `inventory_item_id`  
- `movement_type`, `quantity_delta` (negative for consume)  
- `unit_cost_usd_snapshot`, `sale_line_item_id`, `appointment_item_id` nullable  
- `reason`, `created_by`, `created_at`

### commission_rules

- `id`, `tenant_id`, `specialist_membership_id` nullable, `service_id` nullable  
- `rule_type` (`PERCENT_GROSS` \| `PERCENT_NET_MATERIALS` \| `FLAT`)  
- `rate_percent` or `flat_usd`, `priority`, `is_active`

### commission_entries

- `id`, `tenant_id`, `sale_line_item_id`, `specialist_membership_id`, `rule_id`  
- `gross_usd`, `materials_usd`, `commission_usd`, `status`, `created_at`

### exchange_rates

- `id`, `source` (`DOLARAPI`), `fuente` (`oficial` \| `paralelo` \| `MANUAL`)  
- `ves_per_usd` (from `promedio`), `provider_updated_at`, `fetched_at`  
- Optional raw JSON for audit

### message_jobs

- `id`, `tenant_id`, `patient_id`, `channel` (`WHATSAPP`), `template_key`  
- `payload` jsonb, `status`, `attempts`, `provider_message_id`, `scheduled_for`, `created_at`

## Indexing (minimum)

- All FKs used in filters: `(tenant_id, …)` composite first.  
- Partial indexes for `deleted_at IS NULL` where soft delete exists.  
- Unique business keys as above.

## RLS strategy (summary)

See [05-SECURITY.md](./05-SECURITY.md). Pattern:

```sql
USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
```

Prefer reading tenant from JWT claim helper function when using Supabase Data API; NestJS path uses `set_config`.

## Reference: original schema

The first-pass SQL remains in [`../CONTEXT.md.txt`](../CONTEXT.md.txt) for archaeology. **Do not apply it as-is**—use this document + future Supabase migrations.

## Open data questions (remaining)

1. Soft-delete vs hard-delete for photos when patient removed? (Recommend soft-delete + retain media while tenant active.)  
2. May reception override `fx_fuente` per sale, or only tenant default? (Recommend: OWNER/ADMIN/RECEPTIONIST can pick oficial vs paralelo before post.)

### Resolved (see `00-DECISIONS.md`)

- Walk-ins: **yes**  
- Line items: **yes**  
- FX: **DolarApi** (`oficial` / `paralelo`); USDT face = USD 1:1  
- ORM: **Drizzle**  
- Photos on Starter: **yes**
