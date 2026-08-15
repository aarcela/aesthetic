-- Tenant-selectable FX foundation.
-- All monetary values use NUMERIC; never FLOAT/REAL.

create extension if not exists "pgcrypto";

create type public.tenant_role as enum ('OWNER', 'ADMIN', 'SPECIALIST', 'RECEPTIONIST');
create type public.fx_fuente as enum ('oficial', 'paralelo', 'MANUAL');
create type public.sale_status as enum ('open', 'posted', 'void');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  primary_currency text not null default 'USD' check (primary_currency = 'USD'),
  default_fx_fuente public.fx_fuente not null default 'oficial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Platform reference data is not tenant-owned and stays outside the exposed
-- public schema. Application code reads it with the server database role only.
create schema if not exists private;

create table private.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'DOLARAPI' check (provider = 'DOLARAPI'),
  fuente public.fx_fuente not null check (fuente in ('oficial', 'paralelo')),
  ves_per_usd numeric(18, 6) not null check (ves_per_usd > 0),
  provider_updated_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb not null,
  constraint exchange_rates_provider_source_updated_key
    unique (provider, fuente, provider_updated_at)
);

create index exchange_rates_source_fetched_at_idx
  on private.exchange_rates (fuente, fetched_at desc);

-- Foundation only: this creates the immutable fields the future POS module
-- will write on posting. No POS endpoint is introduced in this migration.
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status public.sale_status not null default 'open',
  amount_usd numeric(18, 2),
  fx_fuente public.fx_fuente,
  fx_rate numeric(18, 6),
  fx_provider_updated_at timestamptz,
  fx_fetched_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint posted_sales_require_fx_snapshot check (
    status <> 'posted'
    or (
      fx_fuente in ('oficial', 'paralelo', 'MANUAL')
      and fx_rate is not null
      and fx_rate > 0
      and fx_provider_updated_at is not null
      and fx_fetched_at is not null
    )
  )
);

create index sales_tenant_created_at_idx
  on public.sales (tenant_id, created_at desc);

alter table public.tenants enable row level security;
alter table public.sales enable row level security;
alter table public.tenants force row level security;
alter table public.sales force row level security;

create policy tenants_tenant_isolation on public.tenants
  for all
  using (
    id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

create policy sales_tenant_isolation on public.sales
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
