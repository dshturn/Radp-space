-- Audit log: immutable record of all significant actions in RADP
create table if not exists audit_log (
  id          uuid        default gen_random_uuid() primary key,
  actor_id    uuid        references auth.users(id) on delete set null,
  entity_type text        not null,  -- 'personnel' | 'equipment' | 'document' | 'assessment' | 'site' | 'user'
  entity_id   text,                  -- stringified id of the affected row
  action      text        not null,  -- 'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | 'assigned' | 'uploaded'
  label       text,                  -- human-readable: "John Smith — Medical Report"
  metadata    jsonb,                 -- optional snapshot of key fields at time of action
  created_at  timestamptz default now()
);

-- Admins can read all rows; contractors can read their own actions only
alter table audit_log enable row level security;

create policy "admins read all audit_log"
  on audit_log for select
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and status = 'admin'
    )
  );

create policy "contractors read own audit_log"
  on audit_log for select
  using (actor_id = auth.uid());

-- Anyone authenticated can insert (logAudit() is called client-side)
create policy "authenticated insert audit_log"
  on audit_log for insert
  with check (auth.uid() is not null);
