-- One Heartland restock per website order. Put stock back is a no-op after this.

alter table public.orders
  add column if not exists inventory_restocked_at timestamptz;

comment on column public.orders.inventory_restocked_at is
  'When Heartland inventory for this order was put back. Prevents adding qty twice.';
