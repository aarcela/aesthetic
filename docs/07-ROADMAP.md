# Roadmap

No application code until Phase 0 decisions below are accepted.

## Phase 0 — Align & spike (docs + proofs)

**Goal:** Prove tenancy isolation and stack choices without building the full product.

- [x] Consolidate product/tech docs  
- [x] Lock ORM, walk-ins, line items, FX provider, tier gates (`00-DECISIONS.md`)  
- [ ] Confirm remaining open questions in `04-DATA-MODEL.md` (photo retention; FX override UX)  
- [ ] Choose WhatsApp provider  
- [ ] Supabase project + local CLI workflow  
- [ ] Spike: two tenants, RLS policy, NestJS + Drizzle transaction `set_config`, negative cross-tenant test  
- [ ] Spike: DolarApi fetch (`oficial` + `paralelo`) → Redis cache → persist `exchange_rates`  
- [ ] Spike: private storage upload with tenant-prefixed path  

**Exit:** Written “go” on architecture; failing cross-tenant test would block Phase 1.

## Phase 1 — Foundation

- Monorepo scaffold: `api`, `web` (Drizzle + NestJS + Next.js)  
- Auth (Supabase) + memberships + roles  
- Tenants + locations CRUD (`default_fx_fuente`)  
- Patients CRUD  
- Services CRUD  

**DoD:** Owner can invite receptionist; both only see own tenant patients.

## Phase 2 — Agenda + Caja

- Appointments + **appointment_items** (multi-service)  
- Walk-in sales (no appointment)  
- **sale_line_items** + split `sale_payments`  
- DolarApi FX service + immutable sale snapshot  
- Daily caja report  

**DoD:** Mixed Zelle + Cash VES checkout with 2+ line items posts correctly; day report matches legs.

## Phase 3 — Inventory + commissions

- Inventory items, recipes  
- Consume **per sale line** + movements ledger  
- Low-stock alerts  
- Commission rules + entries + period report  

**DoD:** Completing a multi-service sale deducts ml per line and produces commission lines.

## Phase 4 — Media, consents, WhatsApp

- Photo upload flows (web + Expo start) — available on Starter+  
- Digital consents  
- Message outbox + reminders (Pro gate)  
- Deposit status fields wired to messaging  

**DoD:** Reminder job sends for tomorrow’s appointments; consent stored against patient.

## Phase 5 — Mobile floor polish + GTM readiness

- Expo: today’s list, capture before/after, sign consent, quick checkout assist  
- Plan gating (Starter/Pro) as locked in `06-MONETIZATION-GTM.md`  
- Concierge onboarding checklist  
- Staging demo tenant with seed data  

**DoD:** Pilot clinic can run a full day without spreadsheets.

## Phase 6 — Harden

- Idempotency everywhere money/stock moves  
- Security checklist from `05-SECURITY.md`  
- Backups, monitoring, suspension workflow  
- Performance pass on agenda queries  

## Suggested build order inside each phase

1. Schema migration + RLS  
2. API module + tests (including cross-tenant denial)  
3. Web screens  
4. Mobile only when floor workflow is stable on web  

## Definition of ready for coding

You are ready to write code when:

1. These docs are accepted (or amended) by you.  
2. Remaining open questions answered (or explicitly deferred).  
3. Phase 0 spikes pass.  
4. You explicitly ask to start scaffolding.

---

## Still open (optional before scaffold)

1. Photo soft-delete / retention when patient removed  
2. Who may override `oficial` vs `paralelo` per sale  
3. WhatsApp provider  
4. Brand name
