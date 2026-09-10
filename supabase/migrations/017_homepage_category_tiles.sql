-- Homepage "Shop by category" tiles — admin-picked product photos.

insert into public.homepage_sections (
  id, label, title, subtitle, cta_label, cta_href,
  product_ids, max_items, enabled, sort_order, image_url
) values
  (
    'category_tile_bottoms',
    'Category tile — Bottoms',
    'Bottoms',
    'Shop by Category',
    'Shop now',
    '/shop?category=bottoms',
    '{}',
    1,
    true,
    3,
    null
  ),
  (
    'category_tile_dresses',
    'Category tile — Dresses',
    'Dresses',
    'Shop by Category',
    'Shop now',
    '/shop?category=dresses',
    '{}',
    1,
    true,
    4,
    null
  ),
  (
    'category_tile_tops',
    'Category tile — Tops',
    'Tops',
    'Shop by Category',
    'Shop now',
    '/shop?category=tops',
    '{}',
    1,
    true,
    5,
    null
  )
on conflict (id) do nothing;
