-- Staff assigned to one or more clinic locations (sedes).
-- tenant_id is denormalized for RLS; application validates same-tenant FKs.

create table public.membership_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membership_id uuid not null references public.tenant_memberships(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint membership_locations_membership_location_key unique (membership_id, location_id)
);

create index membership_locations_tenant_id_idx
  on public.membership_locations (tenant_id);

create index membership_locations_membership_id_idx
  on public.membership_locations (membership_id);

create index membership_locations_location_id_idx
  on public.membership_locations (location_id);

alter table public.membership_locations enable row level security;
alter table public.membership_locations force row level security;

create policy membership_locations_tenant_isolation on public.membership_locations
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Existing staff keep access to every sede until an admin trims the list.
insert into public.membership_locations (tenant_id, membership_id, location_id)
select m.tenant_id, m.id, l.id
from public.tenant_memberships m
inner join public.locations l on l.tenant_id = m.tenant_id
on conflict (membership_id, location_id) do nothing;
