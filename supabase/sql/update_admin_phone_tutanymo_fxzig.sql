-- Manual admin phone update for WhatsApp OTP login
-- Run this in Supabase SQL Editor.
-- Project behavior: phone login normalizes Indian numbers to 91XXXXXXXXXX.

-- 1. Safety check: confirm the target email and whether the new phone already exists.
select
  id,
  email,
  phone,
  role,
  admin_role_id
from public.profiles
where lower(email) = lower('tutanymo@fxzig.com')
   or phone in ('9265348797', '919265348797');

-- 2. Update the admin user's phone in normalized format.
update public.profiles
set
  phone = '919265348797',
  updated_at = now()
where lower(email) = lower('tutanymo@fxzig.com')
  and role = 'admin'
  and admin_role_id is not null;

-- 3. Verification: confirm the final stored phone value.
select
  id,
  email,
  phone,
  role,
  admin_role_id,
  updated_at
from public.profiles
where lower(email) = lower('tutanymo@fxzig.com');
