-- Backfill audit log for existing records in database
-- This creates audit entries for all personnel, equipment, assessments, and operations records

-- Personnel: log all existing personnel records
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  up.id as actor_id,
  'personnel' as entity_type,
  p.id::text as entity_id,
  'created' as action,
  p.full_name as label,
  up.company,
  up.service_line,
  p.created_at
from personnel p
left join user_profiles up on p.contractor_id = up.id
on conflict do nothing;

-- Equipment: log all existing equipment records
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  up.id as actor_id,
  'equipment' as entity_type,
  e.id::text as entity_id,
  'created' as action,
  e.equipment_name as label,
  up.company,
  up.service_line,
  e.created_at
from equipment e
left join user_profiles up on e.contractor_id = up.id
on conflict do nothing;

-- Assessments: log all existing assessment records
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  up.id as actor_id,
  'assessment' as entity_type,
  a.id::text as entity_id,
  'created' as action,
  concat(p.full_name, ' - ', a.assessment_type) as label,
  up.company,
  up.service_line,
  a.created_at
from assessments a
left join personnel p on a.personnel_id = p.id
left join user_profiles up on p.contractor_id = up.id
on conflict do nothing;

-- Operations: log all existing operation sites
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  up.id as actor_id,
  'operations' as entity_type,
  o.id::text as entity_id,
  'created' as action,
  o.site_name as label,
  up.company,
  up.service_line,
  o.created_at
from operations_sites o
left join user_profiles up on o.created_by = up.id
on conflict do nothing;

