# Backend complete (Phases 3–6)

## Push all remaining migrations

```powershell
pnpm dlx supabase@latest db push
```

Creates:
- inventory + recipes + movements + commissions
- photos + consents + message_jobs
- `tenants.plan_code` / `subscription_status`
- `idempotency_keys`

## Create Storage bucket

Supabase → Storage → New bucket:
- Name: `patient-media` (or set `SUPABASE_MEDIA_BUCKET`)
- **Private**

## Upgrade a clinic to Pro (for inventory/commissions/WhatsApp)

```http
PUT /api/v1/tenant-settings/plan
{ "planCode": "pro", "subscriptionStatus": "active" }
```

Starter keeps: caja, appointments, patients, services, photos, consents.  
Pro adds: inventory recipes, commissions, WhatsApp outbox.

## Key endpoints

### Inventory (Pro)
- `GET/POST /api/v1/inventory/items`
- `POST /api/v1/inventory/items/:id/adjust`
- `GET/POST /api/v1/inventory/recipes`
- `GET /api/v1/inventory/low-stock`

### Commissions (Pro)
- `GET/POST /api/v1/commissions/rules`
- `GET /api/v1/commissions/report?from=&to=`

### Media (Starter+)
- `POST /api/v1/media/photos/upload-url`
- `GET /api/v1/media/photos?patientId=`
- `POST /api/v1/media/consents/upload-url`
- `GET /api/v1/media/consents?patientId=`

### WhatsApp outbox (Pro)
- `POST /api/v1/messages`
- `POST /api/v1/messages/reminders/tomorrow`
- `POST /api/v1/messages/process-due` (stub marks jobs `sent`)

### Idempotent sale post
```http
POST /api/v1/sales/:id/post
Idempotency-Key: checkout-2026-08-15-001
```

On Pro, posting a sale also consumes recipes and writes commission entries.

## Out of backend scope (still frontend)
- Next.js web UI
- Expo floor app
- Real WhatsApp Cloud API provider wiring (outbox + stub processor are ready)
