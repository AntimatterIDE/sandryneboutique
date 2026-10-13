-- Seasonal homepage copy: the paragraph under the hero and the category intro.

alter table public.homepage_sections
  add column if not exists body text not null default '';

comment on column public.homepage_sections.body is
  'Longer homepage copy, such as the hero paragraph or the category intro.';

update public.homepage_sections
set body = 'Silk dresses, elevated essentials, and gold vermeil jewelry — curated in limited runs for women who dress with intention. New pieces land weekly, and the best sell out first.'
where id = 'hero' and body = '';

insert into public.homepage_sections (
  id, label, title, subtitle, body, cta_label, cta_href,
  product_ids, max_items, enabled, sort_order
) values (
  'category_intro',
  'Shop by category',
  'Shop by Category',
  '',
  'Tailored bottoms, fluid dresses, and crisp tops — every piece chosen to live together, effortlessly.',
  'Shop now',
  '/shop',
  '{}',
  1,
  true,
  2
)
on conflict (id) do nothing;
