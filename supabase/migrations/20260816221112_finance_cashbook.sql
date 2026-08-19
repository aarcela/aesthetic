-- Finance cash book: editable ingress/egress types + movements ledger.

create type public.finance_direction as enum ('ingress', 'egress');
create type public.finance_native_currency as enum ('USD', 'VES', 'USDT');
create type public.finance_movement_status as enum ('posted', 'void');

create table public.finance_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  direction public.finance_direction not null,
  name text not null,
  description text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index finance_types_tenant_direction_name_active_uidx
  on public.finance_types (tenant_id, direction, lower(name))
  where is_active = true;

create index finance_types_tenant_direction_idx
  on public.finance_types (tenant_id, direction, sort_order);

alter table public.finance_types enable row level security;
alter table public.finance_types force row level security;

create policy finance_types_tenant_isolation on public.finance_types
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

create table public.finance_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id),
  direction public.finance_direction not null,
  type_id uuid not null references public.finance_types(id),
  occurred_at timestamptz not null default now(),
  amount_native numeric(18, 2) not null,
  native_currency public.finance_native_currency not null,
  amount_usd_equivalent numeric(18, 2) not null,
  fx_fuente public.fx_fuente,
  fx_rate numeric(18, 6),
  payment_method public.payment_method,
  counterparty text,
  reference_number text,
  notes text,
  sale_id uuid references public.sales(id),
  status public.finance_movement_status not null default 'posted',
  created_by uuid references public.tenant_memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_movements_amount_native_positive check (amount_native > 0),
  constraint finance_movements_amount_usd_positive check (amount_usd_equivalent > 0)
);

create index finance_movements_tenant_occurred_at_idx
  on public.finance_movements (tenant_id, occurred_at desc);

create index finance_movements_tenant_direction_occurred_at_idx
  on public.finance_movements (tenant_id, direction, occurred_at desc);

create index finance_movements_tenant_type_idx
  on public.finance_movements (tenant_id, type_id);

alter table public.finance_movements enable row level security;
alter table public.finance_movements force row level security;

create policy finance_movements_tenant_isolation on public.finance_movements
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
