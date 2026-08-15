# Security & Multi-Tenant Isolation

## Threat model (short)

| Threat | Mitigation |
|--------|------------|
| Cross-tenant data read/write | Postgres RLS + tenant claim; never trust client-sent `tenant_id` alone |
| Privilege escalation via editable JWT metadata | Put authz only in `app_metadata` / server-side membership table |
| PHI leak via public storage URLs | Private buckets + short-lived signed URLs |
| Double checkout / double stock deduct | Idempotency keys + DB constraints |
| Connection pool tenant bleed | Transaction-local `set_config` only |
| Service role key in browser | Never; server-only |

## Authentication

- Supabase Auth issues JWTs.  
- NestJS validates signature and expiry on every request.  
- Authorization attributes:
  - **Source of truth:** `tenant_memberships`  
  - **JWT cache:** `app_metadata.tenant_id`, `app_metadata.role`  
- **Forbidden:** using `user_metadata` for tenant or role (user-editable in Supabase).

## Authorization matrix (MVP)

| Action | OWNER | ADMIN | SPECIALIST | RECEPTIONIST |
|--------|:-----:|:-----:|:----------:|:------------:|
| Manage users | ✓ | ✓ | | |
| Configure commissions | ✓ | ✓ | | |
| Adjust inventory / purchases | ✓ | ✓ | | |
| Void sale | ✓ | ✓ | | |
| Checkout / caja | ✓ | ✓ | | ✓ |
| Manage appointments | ✓ | ✓ | own | ✓ |
| Upload photos / consents | ✓ | ✓ | ✓ | limited |
| View all commissions | ✓ | ✓ | own only | |

Enforce in API guards **and** keep RLS as last line of defense for row isolation (role nuance can be API-level initially).

## Row Level Security

### Rules

1. Enable RLS on **every** table in `public` (including `tenants`, `locations`).  
2. Policies must include both `USING` and `WITH CHECK` for write paths.  
3. `UPDATE` requires a visible `SELECT` policy (Postgres behavior).  
4. Views: use `security_invoker = true` (PG15+) or keep views out of exposed API.  
5. No `SECURITY DEFINER` functions in exposed schemas unless audited and locked down.

### NestJS + pooled connections

```text
BEGIN;
SELECT set_config('app.current_tenant_id', '<uuid>', true);
-- all tenant queries
COMMIT;  -- clears local settings
```

Do not set tenant config on a connection and release it to the pool outside a transaction.

### Supabase Data API (if used)

Prefer policies based on `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` (or a stable custom claim).  
If NestJS is the only writer for sensitive tables, still enable RLS so accidental Data API exposure fails closed.

## Storage

- Bucket: private.  
- Path: `{tenant_id}/...`  
- Policies: user may only read/write objects under their tenant prefix.  
- Upsert needs INSERT + SELECT + UPDATE grants/policies.  
- Strip EXIF GPS if feasible on upload (privacy).

## Secrets & keys

| Key | Where |
|-----|-------|
| `anon` / publishable | Web/mobile (RLS enforced) |
| `service_role` | NestJS server only |
| WhatsApp tokens | Server / secrets manager |
| Redis URL | Server |

Never commit `.env` with production secrets.

## PII / PHI handling

- Patients, photos, consents, medical alerts are sensitive.  
- Logs: hash or omit names/phones; keep `patient_id` only if needed.  
- Backups inherit tenant isolation obligations.  
- Export/delete requests (future): plan tenant-scoped export.

## Session notes (Supabase)

- Deleting a user does not revoke existing access tokens automatically — revoke sessions / keep short JWT TTL for sensitive ops.  
- After role/tenant changes in `app_metadata`, user may need token refresh before claims update.

## Security checklist before production

- [ ] RLS enabled on all public tables  
- [ ] Policies tested with two tenants (positive + negative cases)  
- [ ] No `service_role` in client bundles  
- [ ] Signed URL TTL reviewed  
- [ ] Idempotent checkout tested  
- [ ] Admin/superuser path isolated from clinic JWT  
- [ ] Dependency audit + Sentry without PHI in breadcrumbs  

## Original middleware note

The snippet in `CONTEXT.md.txt` is directionally correct but incomplete: it must run inside the **same transaction** as queries, and the typo `@Injectable admonition` must not be copied. Prefer a Nest interceptor / unit-of-work wrapper over a naive middleware that sets config without transactional binding.
