-- Phase 3: procedure inventory + commissions.

create type public.inventory_movement_type as enum (
  'PURCHASE',
  'ADJUSTMENT',
  'PROCEDURE_CONSUME',
  'PROCEDURE_REVERSE'
);

create type public.commission_rule_type as enum (
  'PERCENT_GROSS',
  'PERCENT_NET_MATERIALS',
  'FLAT'
);

create type public.commission_entry_status as enum (
  'pending',
  'included_in_payout',
  'paid'
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  product_name text not null,
  unit_of_measure text not null,
  current_stock numeric(18, 4) not null default 0,
  min_stock_alert numeric(18, 4) not null default 5,
  cost_per_unit_usd numeric(18, 4) not null default 0 check (cost_per_unit_usd >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_tenant_id_idx on public.inventory_items (tenant_id);

create table public.service_inventory_recipes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_required numeric(18, 4) not null check (quantity_required > 0),
  created_at timestamptz not null default now(),
  unique (service_id, inventory_item_id)
);

create index service_inventory_recipes_tenant_id_idx
  on public.service_inventory_recipes (tenant_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id),
  inventory_item_id uuid not null references public.inventory_items(id),
  movement_type public.inventory_movement_type not null,
  quantity_delta numeric(18, 4) not null,
  unit_cost_usd_snapshot numeric(18, 4) not null default 0,
  sale_line_item_id uuid references public.sale_line_items(id),
  appointment_item_id uuid references public.appointment_items(id),
  reason text,
  created_by uuid references public.tenant_memberships(id),
  created_at timestamptz not null default now()
);

create index inventory_movements_tenant_item_idx
  on public.inventory_movements (tenant_id, inventory_item_id, created_at desc);

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  specialist_membership_id uuid references public.tenant_memberships(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  rule_type public.commission_rule_type not null,
  rate_percent numeric(8, 4),
  flat_usd numeric(18, 2),
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_rules_value_check check (
    (rule_type = 'FLAT' and flat_usd is not null and flat_usd >= 0)
    or (rule_type <> 'FLAT' and rate_percent is not null and rate_percent >= 0)
  )
);

create index commission_rules_tenant_id_idx on public.commission_rules (tenant_id);

create table public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_line_item_id uuid not null references public.sale_line_items(id) on delete cascade,
  specialist_membership_id uuid not null references public.tenant_memberships(id),
  rule_id uuid references public.commission_rules(id),
  gross_usd numeric(18, 2) not null,
  materials_usd numeric(18, 2) not null default 0,
  commission_usd numeric(18, 2) not null,
  status public.commission_entry_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index commission_entries_tenant_created_at_idx
  on public.commission_entries (tenant_id, created_at desc);

create index commission_entries_specialist_idx
  on public.commission_entries (tenant_id, specialist_membership_id);

alter table public.inventory_items enable row level security;
alter table public.service_inventory_recipes enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_entries enable row level security;
alter table public.inventory_items force row level security;
alter table public.service_inventory_recipes force row level security;
alter table public.inventory_movements force row level security;
alter table public.commission_rules force row level security;
alter table public.commission_entries force row level security;

create policy inventory_items_tenant_isolation on public.inventory_items
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

create policy service_inventory_recipes_tenant_isolation on public.service_inventory_recipes
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

create policy inventory_movements_tenant_isolation on public.inventory_movements
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

create policy commission_rules_tenant_isolation on public.commission_rules
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

create policy commission_entries_tenant_isolation on public.commission_entries
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
