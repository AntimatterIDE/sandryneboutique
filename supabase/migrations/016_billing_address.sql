-- Store a separate card-statement address when it differs from shipping.

alter table public.orders
  add column if not exists billing_address jsonb;

comment on column public.orders.billing_address is
  'Card statement address from checkout. Falls back to shipping_address when null.';
