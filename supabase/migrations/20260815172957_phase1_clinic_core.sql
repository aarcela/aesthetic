-- Phase 1 clinic core: locations, patients, services.

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Caracas',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index locations_one_primary_per_tenant_idx
  on public.locations (tenant_id)
  where is_primary = true;

create index locations_tenant_id_idx on public.locations (tenant_id);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone_number text not null,
  national_id text,
  medical_alerts text,
  whatsapp_opt_in boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_tenant_phone_key unique (tenant_id, phone_number)
);

create index patients_tenant_created_at_idx
  on public.patients (tenant_id, created_at desc);

create index patients_tenant_name_idx
  on public.patients (tenant_id, last_name, first_name);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  base_price_usd numeric(18, 2) not null check (base_price_usd >= 0),
  estimated_duration_minutes integer not null default 30 check (estimated_duration_minutes > 0),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_tenant_active_idx
  on public.services (tenant_id, is_active)
  where deleted_at is null;

create index services_tenant_name_idx
  on public.services (tenant_id, name);

alter table public.locations enable row level security;
alter table public.patients enable row level security;
alter table public.services enable row level security;
alter table public.locations force row level security;
alter table public.patients force row level security;
alter table public.services force row level security;

create policy locations_tenant_isolation on public.locations
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

create policy patients_tenant_isolation on public.patients
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

create policy services_tenant_isolation on public.services
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );
