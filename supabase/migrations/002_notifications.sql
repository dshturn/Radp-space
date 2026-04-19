create table if not exists notifications (
  id            uuid        default gen_random_uuid() primary key,
  contractor_id uuid        not null references auth.users(id) on delete cascade,
  type          text        not null,  -- 'expiry_warning' | 'expiry_urgent' | 'expiry_critical'
  entity_type   text        not null,  -- 'personnel_document' | 'equipment_document'
  entity_id     text        not null,
  entity_label  text,                  -- e.g. "John Smith — Medical Report"
  days_until    integer,               -- negative = already expired
  read          boolean     default false,
  created_at    timestamptz default now(),
  -- One notification per contractor+entity+type combo (upsert target)
  unique(contractor_id, entity_id, type)
);

alter table notifications enable row level security;

-- Contractors can only read/write their own notifications
create policy "contractors manage own notifications"
  on notifications
  using (contractor_id = auth.uid())
  with check (contractor_id = auth.uid());

-- Service role (used by Edge Function) bypasses RLS automatically
