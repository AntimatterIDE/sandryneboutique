-- Dynamic product categories + optional subcategories (e.g. Tops → Tees).
-- Removes the hard-coded products.category check so admins can add new slugs.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  parent_id uuid references public.categories (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists categories_parent_id_idx
  on public.categories (parent_id);

create index if not exists categories_sort_order_idx
  on public.categories (sort_order, name);

comment on table public.categories is
  'Shop categories. parent_id null = top-level; children are subcategories.';

alter table public.categories enable row level security;

drop policy if exists "Categories are publicly readable" on public.categories;
create policy "Categories are publicly readable"
  on public.categories for select
  using (true);

drop policy if exists "Admins can insert categories" on public.categories;
create policy "Admins can insert categories"
  on public.categories for insert
  with check (private.is_admin());

drop policy if exists "Admins can update categories" on public.categories;
create policy "Admins can update categories"
  on public.categories for update
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Admins can delete categories" on public.categories;
create policy "Admins can delete categories"
  on public.categories for delete
  using (private.is_admin());

-- Seed the five original top-level categories (idempotent by slug).
insert into public.categories (slug, name, description, parent_id, sort_order)
values
  ('bottoms', 'Bottoms', 'Trousers, skirts, and denim.', null, 10),
  ('dresses', 'Dresses', 'Effortless silhouettes.', null, 20),
  ('tops', 'Tops', 'Modern minimal tops.', null, 30),
  ('active-wear', 'Active Wear', 'Performance meets polish.', null, 40),
  ('accessories-jewelry', 'Accessories & Jewelry', 'Finishing touches.', null, 50)
on conflict (slug) do nothing;

-- Drop enum-style check so new category slugs can be stored on products.
alter table public.products drop constraint if exists products_category_check;

alter table public.products
  add column if not exists subcategory text;

create index if not exists products_subcategory_idx
  on public.products (subcategory)
  where subcategory is not null;

comment on column public.products.category is
  'Top-level category slug (matches categories.slug where parent_id is null).';
comment on column public.products.subcategory is
  'Optional subcategory slug (matches categories.slug where parent_id is set).';
