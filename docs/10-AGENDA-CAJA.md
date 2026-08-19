# Phase 2 — Agenda + Caja

## Push the migration

```powershell
pnpm dlx supabase@latest db push
```

Applies `supabase/migrations/20260815173948_phase2_agenda_caja.sql`.

## Endpoints

All require `Authorization: Bearer <supabase_access_token>`.

### Appointments

```http
POST /api/v1/appointments
{
  "locationId": "...",
  "patientId": "...",
  "scheduledAt": "2026-08-16T15:00:00-04:00",
  "items": [
    {
      "serviceId": "...",
      "specialistId": "<tenant_memberships.id>",
      "quantity": 1
    }
  ]
}
```

```http
GET /api/v1/appointments?from=2026-08-16T00:00:00.000Z&to=2026-08-17T00:00:00.000Z
PATCH /api/v1/appointments/:id/status
{ "status": "CONFIRMED" }
```

`specialistId` is the **membership id** of the specialist (`tenant_memberships.id`), not the Auth user id. After bootstrap, use your OWNER membership id from `GET /api/v1/auth/me` → `membershipId` for testing.

### Walk-in or appointment checkout

```http
POST /api/v1/sales
{
  "locationId": "...",
  "patientId": "...",
  "lines": [
    {
      "serviceId": "...",
      "specialistId": "...",
      "quantity": 1,
      "unitPriceUsd": 100
    }
  ]
}
```

```http
POST /api/v1/appointments/:id/sales
```

Creates an open sale from appointment line items.

### Post payment (locks FX snapshot)

Uses the tenant `default_fx_fuente` (`oficial` / `paralelo`) unless `fxFuenteOverride` is set.

```http
POST /api/v1/sales/:id/post
{
  "payments": [
    { "paymentMethod": "ZELLE", "amountNative": 60, "referenceNumber": "abc" },
    { "paymentMethod": "CASH_VES", "amountNative": 4000 }
  ]
}
```

If FX rate is 100 VES/USD, the VES leg = $40 USD and total must match sale `amount_usd` within ±0.01.

Posted sales store immutable `fx_fuente`, `fx_rate`, timestamps. Linked appointments become `COMPLETED`.

### Daily caja

```http
GET /api/v1/reports/caja/daily?date=2026-08-15&locationId=...
```

## Financial rules locked here

- Split payments supported
- VES → USD via DolarApi snapshot on the sale
- USDT = USD face value
- Posted FX never recalculates
