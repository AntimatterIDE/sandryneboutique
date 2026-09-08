-- Returned is a completed refund + Heartland return, distinct from cancelled.

alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'shipped', 'cancelled', 'returned'));
