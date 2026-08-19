-- Phase 2: agenda (appointments + items) and caja (sale lines + payments).

create type public.appointment_status as enum (
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
);

create type public.deposit_status as enum (
  'none',
  'pending',
  'paid',
  'waived'
);

create type public.payment_method as enum (
  'ZELLE',
  'PAGO_MOVIL',
  'CASH_USD',
  'CASH_VES',
  'BINANCE_USDT',
  'POS_VES'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  patient_id uuid not null references public.patients(id),
  status public.appointment_status not null default 'SCHEDULED',
  scheduled_at timestamptz not null,
  notes text,
  deposit_required_usd numeric(18, 2) not null default 0 check (deposit_required_usd >= 0),
  deposit_status public.deposit_status not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_tenant_scheduled_at_idx
  on public.appointments (tenant_id, scheduled_at);

create index appointments_tenant_location_scheduled_at_idx
  on public.appointments (tenant_id, location_id, scheduled_at);

create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id),
  specialist_id uuid not null references public.tenant_memberships(id),
  quantity numeric(18, 2) not null default 1 check (quantity > 0),
  unit_price_usd numeric(18, 2) not null check (unit_price_usd >= 0),
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index appointment_items_appointment_id_idx
  on public.appointment_items (appointment_id);

create index appointment_items_tenant_id_idx
  on public.appointment_items (tenant_id);

alter table public.sales
  add column location_id uuid references public.locations(id),
  add column appointment_id uuid references public.appointments(id),
  add column patient_id uuid references public.patients(id),
  add column created_by uuid references public.tenant_memberships(id),
  add column updated_at timestamptz not null default now();

create index sales_tenant_location_posted_at_idx
  on public.sales (tenant_id, location_id, posted_at desc);

create table public.sale_line_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  appointment_item_id uuid references public.appointment_items(id),
  service_id uuid not null references public.services(id),
  specialist_id uuid references public.tenant_memberships(id),
  quantity numeric(18, 2) not null default 1 check (quantity > 0),
  unit_price_usd numeric(18, 2) not null check (unit_price_usd >= 0),
  line_total_usd numeric(18, 2) not null check (line_total_usd >= 0),
  created_at timestamptz not null default now()
);

create index sale_line_items_sale_id_idx on public.sale_line_items (sale_id);
create index sale_line_items_tenant_id_idx on public.sale_line_items (tenant_id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  payment_method public.payment_method not null,
  amount_native numeric(18, 2) not null check (amount_native > 0),
  native_currency text not null check (native_currency in ('USD', 'VES', 'USDT')),
  amount_usd_equivalent numeric(18, 2) not null check (amount_usd_equivalent > 0),
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

create index sale_payments_sale_id_idx on public.sale_payments (sale_id);
create index sale_payments_tenant_id_idx on public.sale_payments (tenant_id);

alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.sale_line_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.appointments force row level security;
alter table public.appointment_items force row level security;
alter table public.sale_line_items force row level security;
alter table public.sale_payments force row level security;

create policy appointments_tenant_isolation on public.appointments
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

create policy appointment_items_tenant_isolation on public.appointment_items
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

create policy sale_line_items_tenant_isolation on public.sale_line_items
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

create policy sale_payments_tenant_isolation on public.sale_payments
  for all
  using (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  with check (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );
