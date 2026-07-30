-- Heartland Retail size/color variants.
-- Each Heartland Item Grid maps to one storefront product; every sellable
-- size/color combination is a row in product_variants with its own Item #,
-- internal id, price, and inventory.

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  heartland_item_id bigint not null unique,
  heartland_public_id text not null unique,
  heartland_grid_id bigint,
  size text,
  color text,
  price numeric(10, 2) not null check (price >= 0),
  inventory_count integer not null default 0 check (inventory_count >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_id_idx
  on public.product_variants (product_id);

create index if not exists product_variants_public_id_idx
  on public.product_variants (heartland_public_id);

create index if not exists product_variants_grid_id_idx
  on public.product_variants (heartland_grid_id)
  where heartland_grid_id is not null;

create unique index if not exists product_variants_product_size_color_uidx
  on public.product_variants (
    product_id,
    coalesce(size, ''),
    coalesce(color, '')
  );

comment on table public.product_variants is
  'Per-size/color Heartland Retail items belonging to a storefront product.';
comment on column public.product_variants.heartland_item_id is
  'Heartland Retail internal item id (GET /api/items/{id}).';
comment on column public.product_variants.heartland_public_id is
  'Heartland Retail Item # / public_id.';
comment on column public.product_variants.heartland_grid_id is
  'Heartland Retail Item Grid id when the item belongs to a grid.';

alter table public.product_variants enable row level security;

drop policy if exists "Product variants are publicly readable" on public.product_variants;
create policy "Product variants are publicly readable"
  on public.product_variants for select
  using (true);

drop policy if exists "Admins can insert product variants" on public.product_variants;
create policy "Admins can insert product variants"
  on public.product_variants for insert
  with check (private.is_admin());

drop policy if exists "Admins can update product variants" on public.product_variants;
create policy "Admins can update product variants"
  on public.product_variants for update
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Admins can delete product variants" on public.product_variants;
create policy "Admins can delete product variants"
  on public.product_variants for delete
  using (private.is_admin());

-- Keep parent product sizes / colors / inventory_count mirrored from variants.
create or replace function private.sync_product_from_variants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_product_id uuid;
begin
  target_product_id := coalesce(new.product_id, old.product_id);

  update public.products p
  set
    inventory_count = coalesce((
      select sum(v.inventory_count)::integer
      from public.product_variants v
      where v.product_id = target_product_id
        and v.active = true
    ), 0),
    sizes = coalesce((
      select array_agg(s order by s)
      from (
        select distinct v.size as s
        from public.product_variants v
        where v.product_id = target_product_id
          and v.active = true
          and v.size is not null
          and v.size <> ''
      ) sizes
    ), '{}'),
    colors = coalesce((
      select array_agg(c order by c)
      from (
        select distinct v.color as c
        from public.product_variants v
        where v.product_id = target_product_id
          and v.active = true
          and v.color is not null
          and v.color <> ''
      ) colors
    ), '{}'),
    heartland_item_id = coalesce((
      select v.heartland_item_id
      from public.product_variants v
      where v.product_id = target_product_id
        and v.active = true
      order by v.sort_order, v.created_at
      limit 1
    ), p.heartland_item_id),
    heartland_public_id = coalesce((
      select v.heartland_public_id
      from public.product_variants v
      where v.product_id = target_product_id
        and v.active = true
      order by v.sort_order, v.created_at
      limit 1
    ), p.heartland_public_id)
  where p.id = target_product_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists product_variants_sync_product on public.product_variants;
create trigger product_variants_sync_product
  after insert or update or delete on public.product_variants
  for each row execute function private.sync_product_from_variants();

create or replace function public.decrement_variant_inventory(
  p_variant_id uuid,
  p_quantity integer
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.product_variants
  set
    inventory_count = inventory_count - p_quantity,
    updated_at = now()
  where id = p_variant_id
    and active = true
    and inventory_count >= p_quantity;

  if not found then
    raise exception 'Insufficient inventory for variant %', p_variant_id;
  end if;
end;
$$;

revoke execute on function public.decrement_variant_inventory(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.decrement_variant_inventory(uuid, integer)
  to service_role;
