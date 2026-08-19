-- Phase 5/6: plan gating fields + idempotency for money/stock posts.

create type public.plan_code as enum ('starter', 'pro');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'suspended'
);

alter table public.tenants
  add column plan_code public.plan_code not null default 'starter',
  add column subscription_status public.subscription_status not null default 'trialing';

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  route text not null,
  request_hash text not null,
  response_status integer not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create index idempotency_keys_tenant_created_at_idx
  on public.idempotency_keys (tenant_id, created_at desc);

alter table public.idempotency_keys enable row level security;
alter table public.idempotency_keys force row level security;

create policy idempotency_keys_tenant_isolation on public.idempotency_keys
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
