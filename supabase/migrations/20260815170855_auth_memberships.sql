-- Auth memberships: maps Supabase auth.users to a tenant + role.
-- Authorization source of truth is this table (not user_metadata).

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  role public.tenant_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_memberships_tenant_user_key unique (tenant_id, auth_user_id)
);

create unique index tenant_memberships_one_active_tenant_per_user_idx
  on public.tenant_memberships (auth_user_id)
  where is_active = true;

create index tenant_memberships_tenant_id_idx
  on public.tenant_memberships (tenant_id);

create index tenant_memberships_auth_user_id_idx
  on public.tenant_memberships (auth_user_id);

alter table public.tenant_memberships enable row level security;
alter table public.tenant_memberships force row level security;

create policy tenant_memberships_tenant_isolation on public.tenant_memberships
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Allows a signed-in user to read their own membership via the Data API
-- before Nest has established app.current_tenant_id.
create policy tenant_memberships_self_select on public.tenant_memberships
  for select
  using (auth_user_id = auth.uid());
