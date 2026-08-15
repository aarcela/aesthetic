# Architecture

## High-level topology

```
┌─────────────────┐     ┌─────────────────┐
│  Next.js Web    │     │  Expo App       │
│  (admin + web)  │     │  (floor / photos)│
└────────┬────────┘     └────────┬────────┘
         │  HTTPS + JWT          │
         └──────────┬────────────┘
                    ▼
            ┌───────────────┐
            │  NestJS API   │
            │  modules/guards│
            └───────┬───────┘
         ┌──────────┼──────────┐
         ▼          ▼          ▼
   PostgreSQL    Redis      Supabase
   + RLS         queues     Storage
   (Supabase)    FX cache   (photos)
```

Marketing/landing can be Next.js public routes; authenticated app talks to NestJS (not Server Actions for core domain writes).

## Why NestJS + Next.js (not Server Actions only)

- Clear **module boundaries** (tenants, caja, inventory, messaging).  
- Background workers and WhatsApp retries live naturally in Nest.  
- Expo and web share one API contract.  
- RLS session variables are set in a controlled Unit of Work per request.

## Repository layout (target, when scaffolding)

```
/apps
  /web          → Next.js
  /mobile       → Expo
  /api          → NestJS
/packages
  /shared       → Zod schemas, DTO types, constants
/docs           → this documentation
/supabase       → migrations, RLS policies (when implemented)
```

Monorepo (pnpm workspaces or Turborepo) recommended; not mandatory for Phase 0 spike.

## NestJS module map (MVP)

| Module | Responsibility |
|--------|----------------|
| `AuthModule` | Validate Supabase JWT, load membership, attach `RequestContext` |
| `TenantsModule` | Tenant profile, locations, subscription flags |
| `UsersModule` | Invites, roles |
| `PatientsModule` | CRUD patients |
| `SchedulingModule` | Appointments, availability (simple) |
| `CatalogModule` | Services + recipes |
| `InventoryModule` | Items, movements, alerts |
| `BillingPosModule` | Sales, sale_payments, FX snapshot (“caja”) |
| `CommissionsModule` | Rules + entries + reports |
| `MediaModule` | Signed upload URLs, photo metadata |
| `ConsentsModule` | Consent records |
| `MessagingModule` | WhatsApp job producers |
| `FxModule` | DolarApi VE (`oficial`/`paralelo`) fetch, Redis cache, sale snapshots |
| `ReportsModule` | Daily caja, low stock, commissions |

## Request / tenancy flow

1. Client sends `Authorization: Bearer <supabase_access_token>`.  
2. API verifies JWT (JWKS).  
3. Read `tenant_id` and `role` from **`app_metadata`** (never `user_metadata`).  
4. Optional header `X-Location-Id` validated as belonging to tenant.  
5. Open DB transaction → `set_config('app.current_tenant_id', tenantId, true)` → run queries → commit.  
6. RLS policies enforce `tenant_id` match; API still filters by location where needed.

**Critical:** `set_config(..., is_local := true)` is transaction-local. With connection pooling, never set tenant on a connection and return it to the pool without transaction scoping.

## Auth model

- **Supabase Auth** for identities (email/password or magic link MVP).  
- Membership table `tenant_memberships` maps `auth_user_id` → `tenant_id` + `role`.  
- JWT custom claims via Supabase hook / Auth hook writing to `app_metadata`: `{ tenant_id, role }`.  
- Multi-tenant users (one person, two clinics): defer to post-MVP; MVP assumes one active tenant per user.

## Storage

- Private bucket `patient-media`.  
- Upload: API issues signed URL after authz check.  
- Path always prefixed with `tenant_id`.  
- Storage RLS / policies mirror tenant ownership.

## Jobs

| Queue | Jobs |
|-------|------|
| `whatsapp` | send template, retry |
| `fx` | refresh BCV rate |
| `inventory` | low-stock digest (email/WhatsApp to owner) |

## Environments

| Env | Purpose |
|-----|---------|
| `local` | Docker Postgres or Supabase local + Redis |
| `staging` | Shared demo tenants |
| `production` | Paying clinics |

## API conventions

- REST (or tRPC later)—MVP: versioned REST `/v1/...`.  
- Validation: Zod or class-validator at boundary.  
- Errors: stable `code` + Spanish `message` for UI.  
- Pagination: cursor or limit/offset; default page size small.  
- All mutating POS endpoints support idempotency keys where money/stock moves.

## Observability (MVP minimal)

- Structured logs with `tenant_id`, `request_id` (never log full PHI).  
- Error tracking (Sentry).  
- Metrics later: checkout latency, queue depth.

## Explicit non-goals of architecture (MVP)

- Database-per-tenant.  
- GraphQL federation.  
- Event sourcing.  
- Multi-region active-active.
