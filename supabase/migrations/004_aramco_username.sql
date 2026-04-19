-- Aramco user name, captured during registration for operations/assessor roles.
-- Nullable: contractors do not have one.
alter table user_profiles
  add column if not exists aramco_username text;
