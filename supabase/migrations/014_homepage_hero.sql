-- Hero image (and copy) for the homepage, editable under Admin → Homepage.

alter table public.homepage_sections
  add column if not exists image_url text;

comment on column public.homepage_sections.image_url is
  'Optional image for sections that show a photo (homepage hero).';

insert into public.homepage_sections (
  id, label, title, subtitle, cta_label, cta_href,
  product_ids, max_items, enabled, sort_order, image_url
) values (
  'hero',
  'Hero',
  'Summer, Elevated.',
  'The Summer ''26 Edit',
  'Explore Summer Collection',
  '/shop?category=new-arrivals',
  '{}',
  8,
  true,
  0,
  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=1600&auto=format&fit=crop'
)
on conflict (id) do nothing;
