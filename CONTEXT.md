# Aesthetic Clinic SaaS — Master Context

> **Status:** Spec / planning only. No application code yet.  
> **Product:** Multi-tenant B2B SaaS for aesthetic clinics, medspas, and beauty SMBs in Venezuela / LatAm.  
> **Working name:** Aesthetic (internal). Brand TBD.

This file is the **source of truth index**. Detailed specs live under [`docs/`](./docs/). The original dump is preserved as [`CONTEXT.md.txt`](./CONTEXT.md.txt).

---

## 1. One-sentence pitch

Stop financial leakage and operational chaos in cash-heavy aesthetic clinics by combining a **multi-currency caja**, **procedure-level inventory**, **WhatsApp booking with deposits**, and **commission payroll**—with strict **tenant isolation**.

## 2. Why this product exists

In Venezuela and similar markets, clinics lose money through:

| Leak | Product answer |
|------|----------------|
| Mixed USD / VES / Zelle / Pago Móvil / USDT with no single ledger | Multi-currency caja with rate locked at checkout |
| Filler / toxin / cartridge theft and waste | Recipe-based inventory deduction per procedure |
| No-shows | WhatsApp confirmations + deposit collection |
| Opaque specialist commissions | Rules engine: % of procedure minus material cost |
| Lost before/after evidence and unsigned consents | Photo vault + on-device digital consents |

## 3. Target customers

- Aesthetic clinics & medspas  
- Cosmetic dermatology centers  
- Independent aesthetic doctors; lash / skin specialists  

**Buyer:** clinic owner / admin.  
**Daily users:** receptionist, specialist, owner.

## 4. MVP vs explicitly out of scope

### MVP (build)

1. Multi-tenant auth + tenant onboarding  
2. Patients (lightweight) + appointments calendar  
3. Services catalog + multi-currency checkout (split payments)  
4. Procedure inventory recipes + stock movements  
5. Before/after photo vault + digital consent capture  
6. Basic commission calculation & report  
7. WhatsApp reminders / confirmations (queue-backed; provider pluggable)  
8. BCV (or configurable) FX rate snapshot at payment time  

### Not MVP (do not build yet)

- AI business advisory / heavy analytics  
- Full EMR / ICD-10 clinical charts  
- Long multi-page intake forms  
- Marketplace, franchise HQ dashboards, white-label reseller portal  
- Native fiscal e-invoicing integrations (SENIAT) beyond storing RIF / basic invoice metadata  

## 5. Locked architectural decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tenancy | Shared DB + shared schema + `tenant_id` + **Postgres RLS** | Cost-efficient; isolation enforced in DB |
| Backend | **NestJS** API | Clear modules, DI, queues; web stays thin |
| Web | **Next.js** (App Router, TypeScript) | Marketing site + authenticated app shell |
| Mobile / floor | **Expo (React Native)** | Photos, check-in, consents on tablet/phone |
| Data | **PostgreSQL via Supabase** | Auth, Storage, RLS, migrations |
| Cache / jobs | **Redis (Upstash)** | FX cache, WhatsApp jobs, rate limits |
| ORM | **Drizzle** | SQL-first, typed schema, clean migrations with RLS |
| FX rates | **[DolarApi Venezuela](https://dolarapi.com/docs/venezuela/)** (`ve.dolarapi.com`) | `oficial` + `paralelo`; snapshot `promedio` on each sale |
| UI | Tailwind + shadcn/ui | Fast, lightweight for weaker networks |

### Locked product decisions (2026-08-13)

| Topic | Decision |
|-------|----------|
| Walk-in sales | **Allowed** — `sales.appointment_id` nullable |
| Catalog on a visit | **Line items** — multiple services per appointment/sale |
| Photos on Starter | **Included** |
| Pro differentiators | WhatsApp automation, recipe inventory, commission reports |
| USDT (Binance) | Ledger as **USD face value** (1 USDT ≈ 1 USD). DolarApi has no USDT/P2P; VES legs use DolarApi only |

Still open before scaffold: brand name, WhatsApp provider (Cloud API vs BSP), SaaS fee collection automation details.

## 6. Documentation map

| Doc | Purpose |
|-----|---------|
| [docs/00-DECISIONS.md](./docs/00-DECISIONS.md) | Locked decisions log (ORM, FX, line items, tiers) |
| [docs/01-PRODUCT.md](./docs/01-PRODUCT.md) | Personas, jobs-to-be-done, UX principles, MVP stories |
| [docs/02-DOMAIN.md](./docs/02-DOMAIN.md) | Business rules: caja, inventory, commissions, deposits |
| [docs/03-ARCHITECTURE.md](./docs/03-ARCHITECTURE.md) | System topology, modules, tenancy request flow |
| [docs/04-DATA-MODEL.md](./docs/04-DATA-MODEL.md) | Entities, relationships, refined schema notes |
| [docs/05-SECURITY.md](./docs/05-SECURITY.md) | Auth, RLS, storage, PII, anti-patterns |
| [docs/06-MONETIZATION-GTM.md](./docs/06-MONETIZATION-GTM.md) | Pricing, onboarding fees, GTM |
| [docs/07-ROADMAP.md](./docs/07-ROADMAP.md) | Phased delivery & definition of done |
| [docs/08-FX-FOUNDATION.md](./docs/08-FX-FOUNDATION.md) | Implemented DolarApi FX selection, endpoints, and operating rules |

## 7. Critical gaps fixed vs original draft

The original `CONTEXT.md.txt` was a strong start. This rewrite addresses:

1. **Split payments** — one appointment can be paid with multiple methods; original `transactions` assumed one method.  
2. **Commissions** — core value prop had no tables or rules.  
3. **Inventory ledger** — stock must move via auditable `inventory_movements`, not silent `UPDATE`.  
4. **Locations** — pricing mentions “1 location”; schema had none.  
5. **Deposits & WhatsApp** — operational flows without entities.  
6. **FX history** — rate must be stored and reproducible.  
7. **Auth model** — Supabase Auth + `app_metadata` (never `user_metadata`) for `tenant_id` / role.  
8. **Platform vs tenant roles** — super-admin for SaaS ops vs clinic roles.  
9. **Stack ambiguity** — NestJS *or* Server Actions → **NestJS API + Next.js UI**.  
10. **RLS completeness** — `tenants` and all new tables need policies; `WITH CHECK` as well as `USING`.  
11. **Middleware correctness** — `set_config(..., true)` must run **inside the same DB transaction** as queries (pool-safe).  
12. **Indexes, soft delete, audit fields** — production readiness.

## 8. Non-negotiable product principles

1. **Tenant isolation is a security boundary**, not a filter in the app layer alone.  
2. **Money is append-only where possible** — corrections via reversing entries.  
3. **FX rate is immutable on a payment** once recorded (DolarApi `promedio` snapshot).  
4. **Inventory never goes negative** without an explicit override role + reason.  
5. **Photos and consents are PHI-adjacent** — private buckets, signed URLs, tenant-scoped paths.  
6. **MVP stays fast on mobile networks** — small payloads, optimistic UI only where safe.

## 9. How to use this repo (for now)

1. Read this file, then `01` → `07` in order.  
2. Challenge or amend domain rules in `02-DOMAIN.md` before any code.  
3. When ready to build, start with Phase 0 in `07-ROADMAP.md` (repo scaffold + auth + RLS proof).  
4. **Do not** invent features outside MVP without updating these docs first.

---

*Last updated: planning pass from original blueprint. Implementation not started.*
