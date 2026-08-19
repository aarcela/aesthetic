# Domain Model & Business Rules

All monetary rules below are **product law** for MVP. Change them here before changing code.

## Tenants & locations

- A **tenant** is one legal/commercial clinic business (RIF, billing customer).  
- A tenant may have one or more **locations** (branches). MVP pricing: 1 location included.  
- All operational rows belong to exactly one `tenant_id`. Most also carry `location_id` when the event is physical (appointment, stock, caja).  
- SaaS subscription state lives on the tenant (`trialing | active | past_due | suspended`).

## Roles (tenant)

| Role | Capabilities (MVP) |
|------|-------------------|
| `OWNER` | Full access, billing contact, commission config, user invites |
| `ADMIN` | Same as owner except SaaS billing |
| `SPECIALIST` | Own calendar, patients for own appointments, photos, consents; no full caja config |
| `RECEPTIONIST` | Patients, booking, checkout, deposits; no commission config |

Platform role `SUPER_ADMIN` is outside tenant RLS (service role / separate admin app)—not a clinic user.

## Patients

- Identity keys: phone (E.164 preferred, e.g. `+58…`) and optional `national_id` (CI / passport).  
- Uniqueness: soft — `(tenant_id, phone)` unique when phone present.  
- `medical_alerts` is free text (allergies, contraindications)—not a full chart.  
- No ICD-10, no lab modules in MVP.

## Services & recipes

- Service has `base_price_usd` (list price in USD). Display may convert to VES using live rate for UI only.  
- **Recipe**: N rows mapping `service_id` → `inventory_item_id` + `quantity_required`.  
- Completing a **sale line** (or appointment item marked done) **must** consume that service’s recipes unless the service has zero recipe rows.  
- Override: `OWNER`/`ADMIN` may adjust consumed qty with a reason (partial syringe, etc.).

## Inventory

- Each item has a commercial presentation: `package_capacity` + `unit_of_measure` (e.g. 1000 ml, 50 g, 1 ml). Stock and recipes use that same unit.  
- **Kind** (`item_kind`):  
  - `MATERIAL` — consumed on a **visit** (fillers, toxinas, gasas). Never sold as a line of product.  
  - `RETAIL` — **producto para venta**. Sold in Finanzas (ingress “Venta de productos”); deducts stock as `RETAIL_SALE`. Not used on visits or recipes.  
- Retail items may store `sale_price_usd` (list price). Materials use `cost_per_unit_usd` for commission math.  
- Stock is stored in `inventory_items.current_stock` **and** every change is an `inventory_movements` row.  
- Movement types: `PURCHASE`, `ADJUSTMENT`, `PROCEDURE_CONSUME`, `PROCEDURE_REVERSE`, `RETAIL_SALE`, `RETAIL_REVERSE`, `TRANSFER` (post-MVP).  
- Procedure consume is linked to `sale_line_item_id` (and optionally `appointment_item_id`). Retail sale is linked to `finance_movement_id`.  
- Rule: refuse consume if resulting stock < 0 unless `allow_negative_stock` override with reason.  
- Cost for commissions: use `cost_per_unit_usd` on the item at time of consume (snapshot onto movement).

## Appointments & line items

Statuses:

```
SCHEDULED → CONFIRMED → COMPLETED
         ↘ CANCELLED
         ↘ NO_SHOW
```

- An appointment is a **header** (patient, location, time window, status, deposits).  
- **Visit** is not a separate table: it is the same appointment after the patient attended (`COMPLETED`). Photos, materials, and clinical notes attach to `appointment_id`.  
- Marking attendance (`COMPLETED`) or posting the linked sale **creates that visit**. Walk-in visit = appointment inserted already `COMPLETED` (no prior booking).  
- **`appointment_items`**: one or more rows — `service_id`, `specialist_id`, `unit_price_usd`, `sort_order`, optional notes.  
- Duration estimate = sum of item service durations (for calendar blocking).  
- Deposit may be required on the appointment header (`deposit_required_usd`, `deposit_status`: `none | pending | paid | waived`).  
- Completing an appointment (or posting its sale) triggers per-line inventory consume + commission entries.  
- Cancel / no-show are **not** visits and do not consume inventory; deposit policy is configurable (forfeit vs refund note—MVP: manual status only).

## Caja multi-moneda (payments)

### Sale

- A **sale** (`sales`) is the commercial header for an appointment checkout **or a walk-in** (`appointment_id` nullable).  
- **`sale_line_items`**: one or more services (copied/priced from appointment items or entered ad hoc for walk-ins).  
  - Fields: `service_id`, `specialist_id`, `quantity` (default 1), `unit_price_usd`, `line_total_usd`.  
- `amount_usd` on the sale = sum of line totals (before payments).  
- At checkout post, system snapshots FX from DolarApi (see FX section).  
- **Payment legs** (`sale_payments`): one or more rows summing to the sale total (in USD equivalent).

### Payment methods (per clinic)

Each tenant has an editable catalog (`tenant_payment_methods`). Defaults seed as:

`ZELLE | PAGO_MOVIL | CASH_USD | CASH_VES | BINANCE_USDT | POS_VES`

OWNER/ADMIN may rename, hide, or add methods. Conversion is by **native currency**, not by code:

| Native currency | Amount entered | USD equivalent |
|-----------------|----------------|----------------|
| `USD` | USD | as entered |
| `USDT` | USDT | **1:1 with USD** (DolarApi has no USDT rate; face value) |
| `VES` | VES | `amount_ves / fx_rate_snapshot` |

- `fx_rate_snapshot` = DolarApi `promedio` for the tenant’s chosen `fuente` (`oficial` or `paralelo`) at post time.  
- Sum of USD equivalents of legs must equal `sales.amount_usd` within 0.01 USD tolerance.  
- Each leg may store `reference_number` (Pago Móvil ref, Zelle note, etc.).  
- FX fields on the sale are **immutable** after first successful payment posting.

### Daily close (MVP light)

- Report: sum by method for date + location; USD total; VES total collected.  
- Full “arqueo” with expected cash drawer is Phase 2.

## Finanzas (cash book)

- **Caja** = patient checkout (services + split payments).  
- **Finanzas** = clinic libro de dinero for money that **entra** (ingress) or **sale** (egress), with editable types per direction.  
- Product sales (cremas, kits, retail) are recorded as Finanzas **entra**, optionally linked to a `RETAIL` inventory item so stock drops. Materials used on visits never go through Finanzas as a sale.  
- Each movement stores `amount_native` + `amount_usd_equivalent` (VES via FX snapshot; USDT 1:1).  
- Soft-void keeps audit. Optional `sale_id` reserved for later auto-link from posted sales.  
- UI language: Entra / Sale / Neto — no debit/credit jargon.

## Commissions

### Rule shapes (MVP)

1. `% of service price`  
2. `% of (service price − material cost)` ← primary marketing claim  
3. Flat fee per completed service  

Rules attach to: specialist, or (specialist + service), with specificity winning.

### Calculation

Per **completed sale line** (specialist on that line):

```
material_cost_usd = Σ (qty_consumed × cost_per_unit_usd_snapshot) for that line’s service recipe
commissionable_base = according to rule (gross line_total or net of materials)
commission_usd = f(rule, commissionable_base)
```

Persist `commission_entries` (one per sale line / rule application).  
Payout batches (`commission_payouts`) are optional MVP+: mark entries as `pending | included_in_payout | paid`.

## WhatsApp messaging

Events (MVP):

- `APPOINTMENT_CREATED`  
- `APPOINTMENT_REMINDER` (default T-24h)  
- `DEPOSIT_REQUEST` / `DEPOSIT_RECEIVED`  

Rules:

- Messages are **queued** (Redis/BullMQ), never sent inline in HTTP request.  
- Template content is tenant-configurable later; MVP may use global Spanish templates.  
- Failures retry with backoff; surface `failed` in admin UI.  
- Opt-out / patient messaging preferences: store flag on patient if provider requires.

## Photos & consents

- Photo types: `BEFORE | AFTER | OTHER`.  
- Storage path pattern: `{tenant_id}/{patient_id}/{uuid}.jpg` (private bucket).  
- Consent: procedure name/version text hash optional; signature image path; `signed_at`; link `patient_id` + optional `appointment_id`.  
- Deleting a patient soft-deletes; media retention policy TBD (default: retain while tenant active).

## FX rates (DolarApi Venezuela)

Provider locked: [DolarApi Venezuela](https://dolarapi.com/docs/venezuela/).

| Item | Value |
|------|--------|
| Base URL | `https://ve.dolarapi.com` |
| List | `GET /v1/dolares` |
| Oficial (BCV) | `GET /v1/dolares/oficial` |
| Paralelo | `GET /v1/dolares/paralelo` |
| Rate field | `promedio` (VES per 1 USD); ignore null `compra`/`venta` |

Rules:

- `FxModule` polls/caches both `oficial` and `paralelo` in Redis; persists rows in `exchange_rates`.  
- Tenant setting `default_fx_fuente`: `oficial` (default) or `paralelo`. Reception may override per sale before post if allowed by role.  
- Each posted sale stores: `fx_fuente`, `fx_rate` (`promedio`), `fx_fuente_updated_at`, `fx_fetched_at`.  
- Manual admin override rate allowed as `fuente = MANUAL` with reason (outage fallback).  
- UI may show live rates; **posted sales never recalculate**.

## Idempotency

- Checkout, inventory consume, and WhatsApp send accept an `Idempotency-Key` (or derive from `appointment_id` + action) to prevent double charge / double deduct.
