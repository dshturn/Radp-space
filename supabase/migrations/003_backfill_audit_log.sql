-- Backfill audit log for existing records in database
-- This creates audit entries for all personnel, equipment, assessments, operations, and document records

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
where not exists (select 1 from audit_log where entity_type = 'personnel' and entity_id = p.id::text);

-- Equipment items: log all existing equipment
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  up.id as actor_id,
  'equipment' as entity_type,
  ei.id::text as entity_id,
  'created' as action,
  ei.name as label,
  up.company,
  up.service_line,
  ei.created_at
from equipment_items ei
left join user_profiles up on ei.contractor_id = up.id
where not exists (select 1 from audit_log where entity_type = 'equipment' and entity_id = ei.id::text);

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
where not exists (select 1 from audit_log where entity_type = 'assessment' and entity_id = a.id::text);

-- Operation sites: log all existing operation sites
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  up.id as actor_id,
  'operations' as entity_type,
  os.id::text as entity_id,
  'created' as action,
  os.site_name as label,
  up.company,
  up.service_line,
  os.created_at
from operation_sites os
left join user_profiles up on os.created_by = up.id
where not exists (select 1 from audit_log where entity_type = 'operations' and entity_id = os.id::text);

-- Documents: log all existing documents
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  up.id as actor_id,
  'document' as entity_type,
  d.id::text as entity_id,
  'created' as action,
  d.document_name as label,
  up.company,
  up.service_line,
  d.created_at
from documents d
left join user_profiles up on d.uploaded_by = up.id
where not exists (select 1 from audit_log where entity_type = 'document' and entity_id = d.id::text);

