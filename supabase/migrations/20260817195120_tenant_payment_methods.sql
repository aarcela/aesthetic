-- Per-clinic payment methods. Codes stay stable on historical rows;
-- labels, visibility, and extra methods are tenant-editable.

create table public.tenant_payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  label text not null,
  native_currency public.finance_native_currency not null,
  is_active boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_payment_methods_code_format check (code ~ '^[A-Z0-9_]+$'),
  constraint tenant_payment_methods_code_len check (char_length(code) between 2 and 50),
  constraint tenant_payment_methods_label_len check (char_length(label) between 1 and 80)
);

create unique index tenant_payment_methods_tenant_code_uidx
  on public.tenant_payment_methods (tenant_id, code);

create unique index tenant_payment_methods_tenant_label_active_uidx
  on public.tenant_payment_methods (tenant_id, lower(label))
  where is_active = true;

create index tenant_payment_methods_tenant_sort_idx
  on public.tenant_payment_methods (tenant_id, sort_order, label);

alter table public.tenant_payment_methods enable row level security;
alter table public.tenant_payment_methods force row level security;

create policy tenant_payment_methods_tenant_isolation
  on public.tenant_payment_methods
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

insert into public.tenant_payment_methods (
  tenant_id, code, label, native_currency, sort_order, is_system, is_active
)
select
  t.id,
  d.code,
  d.label,
  d.native_currency::public.finance_native_currency,
  d.sort_order,
  true,
  true
from public.tenants t
cross join (
  values
    ('ZELLE', 'Zelle (USD)', 'USD', 10),
    ('PAGO_MOVIL', 'Pago móvil (VES)', 'VES', 20),
    ('CASH_USD', 'Efectivo USD', 'USD', 30),
    ('CASH_VES', 'Efectivo VES', 'VES', 40),
    ('BINANCE_USDT', 'USDT / Binance', 'USDT', 50),
    ('POS_VES', 'Punto de venta (VES)', 'VES', 60)
) as d(code, label, native_currency, sort_order)
on conflict (tenant_id, code) do nothing;

alter table public.sale_payments
  alter column payment_method type text using payment_method::text;

alter table public.finance_movements
  alter column payment_method type text using payment_method::text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sale_payments_payment_method_fkey'
      and conrelid = 'public.sale_payments'::regclass
  ) then
    alter table public.sale_payments
      add constraint sale_payments_payment_method_fkey
      foreign key (tenant_id, payment_method)
      references public.tenant_payment_methods (tenant_id, code);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_movements_payment_method_fkey'
      and conrelid = 'public.finance_movements'::regclass
  ) then
    alter table public.finance_movements
      add constraint finance_movements_payment_method_fkey
      foreign key (tenant_id, payment_method)
      references public.tenant_payment_methods (tenant_id, code);
  end if;
end $$;

drop type public.payment_method;
