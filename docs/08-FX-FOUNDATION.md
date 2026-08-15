# Tenant-Selectable FX Foundation

## Implemented scope

- NestJS API scaffold at `apps/api`
- Drizzle schema for tenant settings, FX audit records, and future sale snapshots
- Supabase migration: `supabase/migrations/20260815160352_fx_foundation.sql`
- DolarApi Venezuela integration: `GET https://ve.dolarapi.com/v1/dolares`
- Tenant selection between `oficial` and `paralelo`
- Redis cache with local in-memory fallback
- Immutable snapshot value object for future POS posting

## Financial rule

1. Every tenant selects `default_fx_fuente`: `oficial` or `paralelo`.
2. DolarApi's positive `promedio` is the only VES-per-USD value used; nullable
   `compra` and `venta` are ignored.
3. On future sale posting, `FxService.createSaleSnapshot(tenantId)` returns:
   `fuente`, `vesPerUsd`, `providerUpdatedAt`, and `fetchedAt`.
4. The POS module must copy those values into the sale row exactly once. It must
   never recalculate a posted sale after DolarApi refreshes.
5. VES payment conversion will be `amount_ves / fx_rate_snapshot`; USD, Zelle,
   and USDT continue using the product rules defined in `02-DOMAIN.md`.

## API

All endpoints are currently protected by a temporary development tenant-context
adapter. Send these headers:

```http
X-Tenant-Id: <tenant UUID>
X-Tenant-Role: OWNER | ADMIN | SPECIALIST | RECEPTIONIST
```

This adapter is deliberately fail-closed but **is not authentication**. The auth
foundation must replace it with verified Supabase JWT `app_metadata` claims
before production.

| Method | Route | Access | Result |
|--------|-------|--------|--------|
| `GET` | `/api/v1/fx/rates` | Any tenant role | Both current sources + selected source |
| `GET` | `/api/v1/tenant-settings/fx-source` | Any tenant role | Selected source + current selected rate |
| `PUT` | `/api/v1/tenant-settings/fx-source` | `OWNER`, `ADMIN` | Change selection; body `{ "fuente": "oficial" }` or `paralelo` |

Rates refresh lazily when no fresh cache exists. A cached rate older than 10
minutes is rejected if DolarApi cannot refresh it. The API caches values for 5
minutes. Successful provider observations are retained in `private.exchange_rates`
using an idempotent provider/source/timestamp key.

## Setup

1. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL`.
2. Apply the Supabase migration to a local or linked Supabase project.
3. Start Redis if desired; omit `REDIS_URL` for local in-memory cache only.
4. Run `pnpm dev:api`.

## Verification

```bash
pnpm build
pnpm test
```

The tests cover DolarApi validation, both available sources, tenant-specific
snapshot selection, snapshot value immutability, authorization, and the
in-memory cache fallback.
