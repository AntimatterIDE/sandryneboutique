-- Track when a product was marked as a New Arrival so newest toggles sort first.
alter table public.products
  add column if not exists is_new_at timestamptz;

comment on column public.products.is_new_at is
  'Set when is_new becomes true; used to order New Arrivals (most recently marked first).';

-- Backfill existing new-arrival flags from created_at.
update public.products
set is_new_at = created_at
where is_new = true
  and is_new_at is null;

create index if not exists products_is_new_at_idx
  on public.products (is_new_at desc nulls last)
  where is_new = true;
