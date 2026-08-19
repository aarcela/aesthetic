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

- [x] Monorepo scaffold: `api` (Drizzle + NestJS); web still pending  
- [x] Auth (Supabase) + memberships + roles  
- [x] Tenants bootstrap + primary location + FX settings  
- [x] Patients CRUD  
- [x] Services CRUD  

**DoD:** Owner can invite receptionist; both only see own tenant patients. *(Invites still pending; CRUD + tenant isolation via RLS context are in place.)*

## Phase 2 — Agenda + Caja

- [x] Appointments + **appointment_items** (multi-service)  
- [x] Walk-in sales (no appointment)  
- [x] **sale_line_items** + split `sale_payments`  
- [x] DolarApi FX service + immutable sale snapshot on post  
- [x] Daily caja report  

**DoD:** Mixed Zelle + Cash VES checkout with 2+ line items posts correctly; day report matches legs.

## Phase 3 — Inventory + commissions

- [x] Inventory items, recipes  
- [x] Consume **per sale line** + movements ledger (on Pro sale post)  
- [x] Low-stock alerts  
- [x] Commission rules + entries + period report  

**DoD:** Completing a multi-service sale deducts ml per line and produces commission lines.

## Phase 4 — Media, consents, WhatsApp

- [x] Photo signed upload URLs + metadata  
- [x] Digital consents signed upload URLs + metadata  
- [x] Message outbox + reminder enqueue + stub processor (Pro)  
- [ ] Real WhatsApp Cloud API provider (deferred; outbox ready)  

**DoD:** Reminder jobs can be enqueued/processed; consent stored against patient.

## Phase 5 — Mobile floor polish + GTM readiness

- [ ] Expo / Next.js UI (frontend — not backend)  
- [x] Plan gating (Starter/Pro) on API  
- [ ] Concierge onboarding checklist UI  
- [ ] Staging demo seed script  

**DoD:** Pilot clinic can run a full day without spreadsheets *(requires UI)*.

## Phase 6 — Harden

- [x] Idempotency on sale post (`Idempotency-Key`)  
- [x] Plan/subscription suspension gate  
- [ ] Production monitoring/backups (ops)  
- [ ] Broader performance pass  

Backend API for clinic operations is feature-complete for MVP; remaining work is primarily **web/mobile UI** and a real WhatsApp provider.

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
