# Web app (Aesthetic)

Spanish-first clinic floor UI for Venezuela aesthetic clinics.

## Design direction

- Brand: **Aesthetic** (hero-level on landing and shell)
- Palette: botanical teal, mist green backgrounds, soft petal blush, brass accents
- Type: Cormorant Garamond (display) + Manrope (UI)
- Atmosphere: layered gradients + subtle grid — not flat white, not purple SaaS
- Skills applied: `web-design-guidelines` (a11y/focus/forms) + `vercel-react-best-practices` (`Promise.all`, `useTransition`)
- Mobile: bottom nav for floor ops (Hoy / Agenda / Caja / Finanzas / Config.)

## Setup

```powershell
copy apps\web\.env.example apps\web\.env.local
```

Fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL=http://localhost:3001/api` (staging: Render API URL + `/api`, see [docs/13-RENDER.md](./13-RENDER.md))

Run API + web:

```powershell
pnpm dev:api
pnpm dev:web
```

Open http://localhost:3000

## Screens

| Route | Purpose |
|-------|---------|
| `/` | Brand landing |
| `/login` | Supabase email/password |
| `/bootstrap` | First clinic + FX source |
| `/app` | Hoy: agenda, caja, tasa |
| `/app/agenda` | Book appointments |
| `/app/patients` | Patient CRM |
| `/app/patients/[id]` | Patient historial (visits, materials, photos, consents, profile) |
| `/app/caja` | Mixed-payment walk-in checkout |
| `/app/finanzas` | Cash book: Entra / Sale / Neto + editable types |
| `/app/services` | Catalog |
| `/app/inventory` | Pro inventory |
| `/app/commissions` | Pro commissions |
| `/app/messages` | Pro WhatsApp outbox |
| `/app/settings` | Configuración: clínica, métodos de pago, sedes, tasa, plan |

## Seed demo clinic

With API running (`ALLOW_TENANT_BOOTSTRAP=true`) **and a real `DATABASE_URL`** (not placeholders):

```powershell
pnpm seed:demo
```

Creates `demo@aesthetic.local` / `AestheticDemo123!` with Pro plan, services, patient, inventory recipe, commission rule, and a near-term appointment.

If seed fails on `/v1/tenant-settings/plan` with DB errors, open Supabase → **Settings → Database → Connection string (URI)**, paste into `apps/api/.env` as `DATABASE_URL` (URL-encode special characters in the password), then restart `pnpm dev:api`.
