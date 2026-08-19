-- Materials are consumed on visits; retail products are sold (Finanzas).

create type public.inventory_item_kind as enum ('MATERIAL', 'RETAIL');

alter table public.inventory_items
  add column item_kind public.inventory_item_kind not null default 'MATERIAL';

alter table public.inventory_items
  add column sale_price_usd numeric(18, 4) not null default 0;

alter table public.inventory_items
  add constraint inventory_items_sale_price_nonnegative
  check (sale_price_usd >= 0);

create index inventory_items_tenant_kind_idx
  on public.inventory_items (tenant_id, item_kind)
  where deleted_at is null;

alter type public.inventory_movement_type add value if not exists 'RETAIL_SALE';
alter type public.inventory_movement_type add value if not exists 'RETAIL_REVERSE';

alter table public.finance_movements
  add column inventory_item_id uuid references public.inventory_items(id);

alter table public.finance_movements
  add column quantity numeric(18, 4);

alter table public.finance_movements
  add constraint finance_movements_retail_qty_positive
  check (inventory_item_id is null or quantity > 0);

create index finance_movements_inventory_item_idx
  on public.finance_movements (tenant_id, inventory_item_id)
  where inventory_item_id is not null;

alter table public.inventory_movements
  add column finance_movement_id uuid references public.finance_movements(id);

insert into public.finance_types (
  tenant_id, direction, name, sort_order, is_system, is_active
)
select
  t.id,
  'ingress',
  'Venta de productos',
  15,
  true,
  true
from public.tenants t
where not exists (
  select 1
  from public.finance_types ft
  where ft.tenant_id = t.id
    and lower(ft.name) = 'venta de productos'
    and ft.direction = 'ingress'
);
