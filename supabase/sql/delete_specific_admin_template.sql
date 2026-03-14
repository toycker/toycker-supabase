-- Manual SQL template: delete one specific admin/staff account safely
--
-- Run this in the Supabase SQL Editor.
--
-- Before:
-- - the target admin/staff account exists in auth.users / public.profiles
-- - related rows may exist in profiles, orders, carts, rewards, reviews, wishlist, addresses
--
-- After:
-- - only the selected admin/staff account is deleted
-- - its related rows are removed by existing user-delete cascades
-- - other admin/staff accounts remain untouched
-- - the script aborts if this would delete the last admin/staff account
--
-- Why this matches this project:
-- 1. Full account deletion in the app uses Supabase Auth Admin deletion
-- 2. Admin access is determined by public.profiles.role = 'admin'
--    or public.profiles.admin_role_id is not null
-- 3. User-linked data already cascades from auth.users in this schema
-- 4. removeStaffAccess() only removes admin access, but this script deletes the account itself

begin;

do $$
declare
  -- ============================================================
  -- EDIT ONE OF THESE VALUES
  -- Best option: user id
  -- ============================================================
  v_target_user_id uuid := null;
  v_target_email text := lower('kartavyatech@gmail.com');
  v_target_phone text := '919265348797';

  v_target_id uuid;
  v_target_role text;
  v_target_admin_role_id text;
  v_target_email_found text;
  v_target_phone_found text;
  v_matching_count bigint := 0;
  v_remaining_admin_profiles bigint := 0;
  v_home_reviews_detached bigint := 0;
begin
  if v_target_user_id is null
     and coalesce(btrim(v_target_email), '') = ''
     and coalesce(btrim(v_target_phone), '') = '' then
    raise exception
      'Set v_target_user_id, v_target_email, or v_target_phone before running this script.';
  end if;

  -- Resolve the target admin/staff profile.
  with matched_admins as (
    select
      p.id,
      p.role,
      p.admin_role_id,
      coalesce(nullif(btrim(p.contact_email), ''), nullif(btrim(p.email), ''), nullif(btrim(au.email), '')) as resolved_email,
      coalesce(nullif(btrim(p.phone), ''), nullif(btrim(au.phone), '')) as resolved_phone
    from public.profiles p
    left join auth.users au
      on au.id = p.id
    where (
        v_target_user_id is not null
        and p.id = v_target_user_id
      )
      or (
        coalesce(btrim(v_target_email), '') <> ''
        and (
          lower(coalesce(p.contact_email, '')) = v_target_email
          or lower(coalesce(p.email, '')) = v_target_email
          or lower(coalesce(au.email, '')) = v_target_email
        )
      )
      or (
        coalesce(btrim(v_target_phone), '') <> ''
        and regexp_replace(coalesce(nullif(p.phone, ''), nullif(au.phone, ''), ''), '\D', '', 'g')
            = regexp_replace(v_target_phone, '\D', '', 'g')
      )
  )
  select count(*)
  into v_matching_count
  from matched_admins;

  if v_matching_count = 0 then
    raise exception
      'No matching admin/staff profile was found. Check v_target_user_id / v_target_email / v_target_phone and try again.';
  end if;

  if v_matching_count > 1 then
    raise exception
      'More than one profile matched. Use v_target_user_id for an exact delete.';
  end if;

  select
    p.id,
    p.role,
    p.admin_role_id,
    coalesce(nullif(btrim(p.contact_email), ''), nullif(btrim(p.email), ''), nullif(btrim(au.email), '')),
    coalesce(nullif(btrim(p.phone), ''), nullif(btrim(au.phone), ''))
  into
    v_target_id,
    v_target_role,
    v_target_admin_role_id,
    v_target_email_found,
    v_target_phone_found
  from public.profiles p
  left join auth.users au
    on au.id = p.id
  where (
      v_target_user_id is not null
      and p.id = v_target_user_id
    )
    or (
      coalesce(btrim(v_target_email), '') <> ''
      and (
        lower(coalesce(p.contact_email, '')) = v_target_email
        or lower(coalesce(p.email, '')) = v_target_email
        or lower(coalesce(au.email, '')) = v_target_email
      )
    )
    or (
      coalesce(btrim(v_target_phone), '') <> ''
      and regexp_replace(coalesce(nullif(p.phone, ''), nullif(au.phone, ''), ''), '\D', '', 'g')
          = regexp_replace(v_target_phone, '\D', '', 'g')
    )
  limit 1;

  if coalesce(v_target_role, '') <> 'admin'
     and v_target_admin_role_id is null then
    raise exception
      'The matched account is not an admin/staff profile in this project. user_id=%, email=%, phone=%',
      v_target_id,
      coalesce(v_target_email_found, '<null>'),
      coalesce(v_target_phone_found, '<null>');
  end if;

  select count(*)
  into v_remaining_admin_profiles
  from public.profiles p
  where p.id <> v_target_id
    and (
      p.role = 'admin'
      or p.admin_role_id is not null
    );

  if v_remaining_admin_profiles = 0 then
    raise exception
      'Refusing to delete the last admin/staff account. Promote another admin first.';
  end if;

  -- Defensive cleanup for one non-cascading relation.
  if to_regclass('public.home_reviews') is not null then
    update public.home_reviews
    set created_by = null
    where created_by = v_target_id;

    get diagnostics v_home_reviews_detached = row_count;
  end if;

  -- Delete the account from auth.users.
  -- This cascades to linked profile/data in this project schema.
  delete from auth.users
  where id = v_target_id;

  raise notice
    'Admin deletion complete. deleted_user_id=%, email=%, phone=%, other_admin_profiles_remaining=%, detached_home_reviews=%',
    v_target_id,
    coalesce(v_target_email_found, '<null>'),
    coalesce(v_target_phone_found, '<null>'),
    v_remaining_admin_profiles,
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
    where role = 'admin'
       or admin_role_id is not null
  ) as remaining_admin_or_staff_profiles;
