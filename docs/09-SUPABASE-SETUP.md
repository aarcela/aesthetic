# Connect your Supabase project

You created the cloud project. Do these steps next.

## 1. Copy secrets from the dashboard

In [Supabase Dashboard](https://supabase.com/dashboard) → your project:

| Where | Copy into `apps/api/.env` as |
|-------|------------------------------|
| **Settings → API → Project URL** | `SUPABASE_URL` |
| **Settings → API → `anon` `public`** | `SUPABASE_ANON_KEY` |
| **Settings → API → `service_role` `secret`** | `SUPABASE_SERVICE_ROLE_KEY` |
| **Settings → Database → Connection string → URI** | `DATABASE_URL` |

Never commit `service_role` or `DATABASE_URL` passwords. `.env` is gitignored.

Also set:

```env
ALLOW_TENANT_BOOTSTRAP=true
PORT=3001
NODE_ENV=development
```

Copy from example:

```bash
cp apps/api/.env.example apps/api/.env
```

Then paste your real values.

## 2. Link the CLI and push migrations

From the repo root (PowerShell):

```powershell
pnpm dlx supabase@latest login
pnpm dlx supabase@latest link --project-ref YOUR_PROJECT_REF
pnpm dlx supabase@latest db push
```

`YOUR_PROJECT_REF` is the subdomain in `https://YOUR_PROJECT_REF.supabase.co`.

This applies:

1. `20260815160352_fx_foundation.sql`
2. `20260815170855_auth_memberships.sql`

## 3. Create your first Auth user

Dashboard → **Authentication → Users → Add user** (email + password),  
or sign up from a client later.

## 4. Start the API

```powershell
pnpm dev:api
```

## 5. Bootstrap your first clinic

1. Sign in with Supabase Auth and get an `access_token` (Auth user session).
2. Call:

```http
POST /api/v1/auth/bootstrap-tenant
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "clinicName": "Clínica Demo",
  "fullName": "Owner Name",
  "defaultFxFuente": "oficial"
}
```

This also creates a primary location (`Sede principal`).

3. Then clinic + FX endpoints work with the same Bearer token:

```http
GET /api/v1/locations
Authorization: Bearer <access_token>
```

```http
POST /api/v1/patients
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "Ana",
  "lastName": "Pérez",
  "phoneNumber": "+584121234567"
}
```

```http
POST /api/v1/services
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Labios 1ml",
  "basePriceUsd": 250,
  "estimatedDurationMinutes": 45
}
```

```http
GET /api/v1/fx/rates
Authorization: Bearer <access_token>
```

## After pulling new migrations

Whenever new SQL lands in `supabase/migrations`, run again:

```powershell
pnpm dlx supabase@latest db push
```

## 6. Optional: authenticate Supabase MCP in Cursor

In Cursor desktop IDE, authenticate the **Supabase** MCP server so the agent can run SQL/advisors against your project. This environment cannot complete interactive MCP login for you.

## What this unlocks next

After migrations are applied and bootstrap works:

- Patients / services CRUD (Phase 1)
- Agenda + caja using the selected FX rate (Phase 2)
