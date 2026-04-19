-- Aramco org units live in their own reference table (aramco_departments),
-- distinct from service_lines which is contractor-only. Undoes the
-- is_aramco flag approach from 005.

-- NAWCOD moves from service_lines to aramco_departments.
delete from service_lines where name = 'NAWCOD';
alter table service_lines drop column if exists is_aramco;

create table if not exists aramco_departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

insert into aramco_departments (name)
  values ('NAWCOD')
  on conflict (name) do nothing;

-- Store Aramco users' chosen department separately from contractor's service_line.
alter table user_profiles add column if not exists aramco_department text;

-- RLS: allow unauthenticated read (register dropdown) and insert ("+ Add custom...").
alter table aramco_departments enable row level security;

drop policy if exists "anon select aramco_departments" on aramco_departments;
create policy "anon select aramco_departments"
  on aramco_departments for select using (true);

drop policy if exists "anon insert aramco_departments" on aramco_departments;
create policy "anon insert aramco_departments"
  on aramco_departments for insert with check (true);
