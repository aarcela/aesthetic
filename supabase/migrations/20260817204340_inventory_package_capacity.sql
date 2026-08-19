-- Commercial package size on each inventory SKU (1000 ml, 50 g, 1 ml syringe).
-- Stock and recipes stay in the same unit of measure.

alter table public.inventory_items
  add column package_capacity numeric(18, 4) not null default 1;

alter table public.inventory_items
  add constraint inventory_items_package_capacity_positive
  check (package_capacity > 0);
