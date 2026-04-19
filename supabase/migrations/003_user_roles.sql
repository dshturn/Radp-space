-- User roles: separates functional role (contractor | operations | assessor)
-- from account status ('pending' | 'approved' | 'rejected' | 'admin').
-- Admins remain identified by user_profiles.status = 'admin'.

alter table user_profiles
  add column if not exists role text not null default 'contractor';

alter table user_profiles
  drop constraint if exists user_profiles_role_check;

alter table user_profiles
  add constraint user_profiles_role_check
  check (role in ('contractor', 'operations', 'assessor'));
