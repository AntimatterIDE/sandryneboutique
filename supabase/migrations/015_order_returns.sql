-- Customer return requests. Refund still happens only after the boutique
-- marks the package received (or an unshipped order is cancelled).

alter table public.orders
  add column if not exists return_requested_at timestamptz,
  add column if not exists return_received_at timestamptz;

comment on column public.orders.return_requested_at is
  'When the customer asked to return the order. Original shipping is not refunded.';
comment on column public.orders.return_received_at is
  'When the boutique confirmed the return package arrived. Card refund follows.';
