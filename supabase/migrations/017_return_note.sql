-- Customer exchange requests. The note is what they want instead of the item they bought.

alter table public.orders
  add column if not exists return_note text;

comment on column public.orders.return_note is
  'Exchange request: the size, color, or item the customer wants instead. Empty when they asked for a refund return.';
