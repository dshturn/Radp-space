-- Backfill audit log for existing records in database
-- Creates audit entries for all personnel, equipment, assessments, operations, and document records

-- Personnel: log all existing personnel records
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  p.contractor_id as actor_id,
  'personnel' as entity_type,
  p.id::text as entity_id,
  'created' as action,
  p.full_name as label,
  (select company from user_profiles where id = p.contractor_id) as company,
  (select service_line from user_profiles where id = p.contractor_id) as service_line,
  p.created_at
from personnel p
where not exists (select 1 from audit_log where entity_type = 'personnel' and entity_id = p.id::text);

-- Equipment items: log all existing equipment
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  ei.contractor_id as actor_id,
  'equipment' as entity_type,
  ei.id::text as entity_id,
  'created' as action,
  ei.name as label,
  (select company from user_profiles where id = ei.contractor_id) as company,
  (select service_line from user_profiles where id = ei.contractor_id) as service_line,
  ei.created_at
from equipment_items ei
where not exists (select 1 from audit_log where entity_type = 'equipment' and entity_id = ei.id::text);

-- Assessments: log all existing assessment records
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  a.contractor_id as actor_id,
  'assessment' as entity_type,
  a.id::text as entity_id,
  'created' as action,
  concat(a.field_well, ' - ', a.type_of_job) as label,
  (select company from user_profiles where id = a.contractor_id) as company,
  (select service_line from user_profiles where id = a.contractor_id) as service_line,
  a.created_at
from assessments a
where not exists (select 1 from audit_log where entity_type = 'assessment' and entity_id = a.id::text);

-- Operation sites: log all existing operation sites
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  os.contractor_id as actor_id,
  'operations' as entity_type,
  os.id::text as entity_id,
  'created' as action,
  os.title as label,
  (select company from user_profiles where id = os.contractor_id) as company,
  (select service_line from user_profiles where id = os.contractor_id) as service_line,
  os.created_at
from operation_sites os
where not exists (select 1 from audit_log where entity_type = 'operations' and entity_id = os.id::text);

-- Documents: log all existing documents
insert into audit_log (actor_id, entity_type, entity_id, action, label, company, service_line, created_at)
select
  null::uuid as actor_id,
  'document' as entity_type,
  d.id::text as entity_id,
  'created' as action,
  d.doc_type_name as label,
  null as company,
  null as service_line,
  d.uploaded_at
from documents d
where not exists (select 1 from audit_log where entity_type = 'document' and entity_id = d.id::text);

