-- Restore stock on refund. Service role only.

create or replace function public.increment_inventory(p_product_id uuid, p_quantity integer)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  update public.products
  set inventory_count = inventory_count + p_quantity
  where id = p_product_id;
end;
$$;

revoke execute on function public.increment_inventory(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_inventory(uuid, integer) to service_role;

create or replace function public.increment_variant_inventory(
  p_variant_id uuid,
  p_quantity integer
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  update public.product_variants
  set
    inventory_count = inventory_count + p_quantity,
    updated_at = now()
  where id = p_variant_id;
end;
$$;

revoke execute on function public.increment_variant_inventory(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.increment_variant_inventory(uuid, integer)
  to service_role;
