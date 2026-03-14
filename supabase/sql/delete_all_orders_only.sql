-- Manual SQL script: delete all order records only
--
-- Run this in the Supabase SQL Editor when you want to clear order data.
--
-- What this deletes:
-- - public.orders
-- - dependent public.order_items rows via ON DELETE CASCADE, if that table exists
-- - dependent public.order_timeline rows via ON DELETE CASCADE, if that table exists
--
-- What this does NOT delete:
-- - customers / auth users / profiles
-- - products / variants / categories / collections
-- - carts / cart_items
-- - shipping_partners
-- - admin roles or settings
--
-- Why this is the correct script for this project:
-- 1. The app stores the main order record in public.orders
-- 2. Related line-item and timeline rows cascade from orders where those tables exist
-- 3. Some environments may not have public.order_items, so verification must stay dynamic
-- 4. Resetting orders_display_id_seq keeps admin/customer order numbering clean

begin;

-- Delete all orders. In this schema, child order tables are removed
-- automatically by foreign-key cascade where they exist.
delete from public.orders;

-- Reset the display/order-number sequence so the next order starts from 1 again.
alter sequence if exists public.orders_display_id_seq restart with 1;

commit;

-- Verification
do $$
declare
  v_orders_count bigint := 0;
  v_order_items_count bigint := 0;
  v_order_timeline_count bigint := 0;
begin
  select count(*) into v_orders_count
  from public.orders;

  if to_regclass('public.order_items') is not null then
    execute 'select count(*) from public.order_items'
      into v_order_items_count;
  end if;

  if to_regclass('public.order_timeline') is not null then
    execute 'select count(*) from public.order_timeline'
      into v_order_timeline_count;
  end if;

  raise notice
    'Verification complete. orders=%, order_items=%, order_timeline=%',
    v_orders_count,
    v_order_items_count,
    v_order_timeline_count;
end $$;
