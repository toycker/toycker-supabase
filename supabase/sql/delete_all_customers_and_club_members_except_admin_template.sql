-- Manual SQL template: delete all customer and club-member accounts
-- while keeping at least one verified admin account.
--
-- Run this in the Supabase SQL Editor.
--
-- This version does not require you to manually enter an admin email/phone/id.
-- It automatically keeps every admin-capable account in this project and deletes
-- only non-admin customers and club members.
--
-- Before:
-- - customers and club members exist in auth.users / public.profiles
-- - related customer data may exist in carts, addresses, rewards, reviews, wishlist, and orders
--
-- After:
-- - all non-admin customer accounts are removed
-- - their related rows are removed through existing ON DELETE CASCADE constraints
-- - all admin/staff accounts are preserved
-- - admin roles, payment methods, products, categories, club settings, shipping, and homepage content stay intact
--
-- Why this matches this project:
-- 1. The app deletes a single customer via supabase.auth.admin.deleteUser(id)
-- 2. Profiles, orders, carts, reviews, reward wallets, wishlist items, and addresses are linked to auth.users
-- 3. Club membership is not a separate user table here; it is stored on public.profiles.is_club_member
-- 4. Customers in the admin UI are effectively non-admin profiles
-- 5. Admin access in this project is identified by profiles.role = 'admin'
--    or profiles.admin_role_id is not null

begin;

do $$
declare
  v_preserved_admin_profiles bigint := 0;
  v_deleted_auth_users bigint := 0;
  v_home_reviews_detached bigint := 0;
begin
  select count(*)
  into v_preserved_admin_profiles
  from public.profiles p
  where p.role = 'admin'
     or p.admin_role_id is not null;

  if v_preserved_admin_profiles = 0 then
    raise exception
      'No admin/staff profile exists in public.profiles. Aborting to avoid deleting all accounts.';
  end if;

  -- Defensive cleanup: home_reviews.created_by does not explicitly cascade.
  -- Customer accounts should not normally own these rows, but null them out if present
  -- so auth user deletion cannot be blocked by unexpected legacy/test data.
  if to_regclass('public.home_reviews') is not null then
    update public.home_reviews
    set created_by = null
    where created_by in (
      select p.id
      from public.profiles p
      where coalesce(p.role, '') <> 'admin'
        and p.admin_role_id is null
    );

    get diagnostics v_home_reviews_detached = row_count;
  end if;

  -- Delete every non-admin account from auth.users.
  -- This follows the project's intended deletion path and lets the database cascade
  -- through profiles, addresses, rewards, reviews, wishlist items, carts, and orders.
  delete from auth.users au
  where not exists (
      select 1
      from public.profiles p
      where p.id = au.id
        and (
          p.role = 'admin'
          or p.admin_role_id is not null
        )
    );

  get diagnostics v_deleted_auth_users = row_count;

  raise notice
    'Customer cleanup complete. preserved_admin_profiles=%, deleted_auth_users=%, detached_home_reviews=%',
    v_preserved_admin_profiles,
    v_deleted_auth_users,
    v_home_reviews_detached;
end $$;

commit;

-- ============================================================
-- VERIFICATION
-- ============================================================
select
  (select count(*) from auth.users) as remaining_auth_users,
  (select count(*) from public.profiles) as remaining_profiles,
  (
    select count(*)
    from public.profiles
    where coalesce(role, '') <> 'admin'
      and admin_role_id is null
  ) as remaining_customers_and_club_members,
  (
    select count(*)
    from public.profiles
    where is_club_member = true
      and coalesce(role, '') <> 'admin'
  ) as remaining_club_members,
  (
    select count(*)
    from public.profiles
    where role = 'admin'
       or admin_role_id is not null
  ) as remaining_admin_or_staff_profiles;
