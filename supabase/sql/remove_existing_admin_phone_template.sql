-- Reusable manual SQL template for removing a WhatsApp OTP phone
-- from an existing admin/staff user.
--
-- Run this in Supabase SQL Editor.
-- Replace the email value in both places before running.
--
-- Behavior:
-- 1. Confirms the admin user exists
-- 2. Removes phone from auth.users
-- 3. Removes phone metadata from raw_user_meta_data
-- 4. Removes phone from public.profiles
-- 5. Shows verification output

-- ============================================================
-- EDIT THIS VALUE
-- ============================================================
do $$
declare
  v_admin_email text := lower('admin@toycker.com');
  v_user_id uuid;
begin
  select p.id
  into v_user_id
  from public.profiles p
  where lower(p.email) = v_admin_email
    and p.role = 'admin'
  limit 1;

  if v_user_id is null then
    raise exception 'No admin profile found for email: %', v_admin_email;
  end if;

  update auth.users u
  set
    phone = null,
    phone_confirmed_at = null,
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
      - 'phone'
      - 'phone_number',
    updated_at = now()
  where u.id = v_user_id;

  update public.profiles p
  set
    phone = null,
    updated_at = now()
  where p.id = v_user_id;

  raise notice 'Admin phone removed successfully. email=%, user_id=%',
    v_admin_email, v_user_id;
end $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
select
  p.id,
  p.email,
  p.phone as profile_phone,
  u.phone as auth_phone,
  p.role,
  p.admin_role_id,
  u.raw_user_meta_data,
  p.updated_at
from public.profiles p
left join auth.users u
  on u.id = p.id
where lower(p.email) = lower('admin@toycker.com');
