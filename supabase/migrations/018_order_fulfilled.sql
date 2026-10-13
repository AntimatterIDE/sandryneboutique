-- Fulfilled means the Heartland sale was invoiced. Shipped is still a later step.

alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'fulfilled', 'shipped', 'cancelled', 'returned'));
