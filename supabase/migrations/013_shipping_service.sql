-- Persist the UPS service the customer chose at checkout.

alter table public.orders
  add column if not exists shipping_service text,
  add column if not exists shipping_service_code text;

comment on column public.orders.shipping_service is
  'Customer-selected UPS service name at checkout.';
comment on column public.orders.shipping_service_code is
  'UPS service code used to quote and later print the matching label.';
