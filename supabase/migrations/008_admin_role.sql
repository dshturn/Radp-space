-- Add 'admin' as a valid role (not just account status).
-- Admins now log in through normal form and land on Users tab.

alter table user_profiles
  drop constraint if exists user_profiles_role_check;

alter table user_profiles
  add constraint user_profiles_role_check
  check (role in ('contractor', 'operations', 'assessor', 'admin'));

-- Migrate existing admin accounts: convert status='admin' → role='admin', status='approved'
update user_profiles
  set role = 'admin', status = 'approved'
  where status = 'admin';

-- Update audit_log RLS: admins identified by role, not status
drop policy if exists "admins read all audit_log" on audit_log;
create policy "admins read all audit_log"
  on audit_log for select
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- user_profiles: admin can read all rows (necessary for user management page)
drop policy if exists "admins read all user_profiles" on user_profiles;
create policy "admins read all user_profiles"
  on user_profiles for select
  using (
    auth.uid() = id or
    exists (
      select 1 from user_profiles p2
      where p2.id = auth.uid() and p2.role = 'admin'
    )
  );

-- user_profiles: admin can update any row
drop policy if exists "admins update any user_profile" on user_profiles;
create policy "admins update any user_profile"
  on user_profiles for update
  using (
    exists (
      select 1 from user_profiles p2
      where p2.id = auth.uid() and p2.role = 'admin'
    )
  );

-- user_profiles: admin can delete any row
drop policy if exists "admins delete any user_profile" on user_profiles;
create policy "admins delete any user_profile"
  on user_profiles for delete
  using (
    exists (
      select 1 from user_profiles p2
      where p2.id = auth.uid() and p2.role = 'admin'
    )
  );
