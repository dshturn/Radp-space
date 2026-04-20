-- Reference table for custom personnel document types (e.g. "Offshore Survival Certificate").
-- Built-in types (CV, Medical Report, Fire Fighting, etc.) live in PERS_DOC_TYPES in JS —
-- this table only holds user-added ones so the dropdown can grow across the team.
-- Mirrors the personnel_positions pattern.

create table if not exists personnel_doc_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

alter table personnel_doc_types enable row level security;

drop policy if exists "auth_read_personnel_doc_types" on personnel_doc_types;
create policy "auth_read_personnel_doc_types"
  on personnel_doc_types for select
  using (auth.role() = 'authenticated');

drop policy if exists "auth_insert_personnel_doc_types" on personnel_doc_types;
create policy "auth_insert_personnel_doc_types"
  on personnel_doc_types for insert
  with check (auth.role() = 'authenticated');
