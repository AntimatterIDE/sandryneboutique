-- Order ops: persist Retail sync errors, tax/shipping breakdown, refunds, fulfillment.

alter table public.orders
  add column if not exists heartland_sync_error text,
  add column if not exists tax_amount numeric(10, 2) not null default 0,
  add column if not exists shipping_amount numeric(10, 2) not null default 0,
  add column if not exists tracking_number text,
  add column if not exists tracking_carrier text,
  add column if not exists shipping_label_url text,
  add column if not exists refunded_amount numeric(10, 2),
  add column if not exists refunded_at timestamptz;

comment on column public.orders.heartland_sync_error is
  'Last Heartland Retail sync error. Cleared when sync succeeds.';
comment on column public.orders.shipping_label_url is
  'Purchased UPS label URL (EasyPost).';
