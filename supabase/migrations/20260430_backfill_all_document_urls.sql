-- Backfill ALL document audit log entries with file_url metadata
-- Handles both personnel_documents and equipment_documents

-- Personnel documents
update audit_log
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{file_url}',
  to_jsonb(pd.file_url)
)
from personnel_documents pd
where audit_log.entity_type = 'document'
  and audit_log.entity_id = pd.id::text
  and (metadata is null or metadata->>'file_url' is null)
  and pd.file_url is not null;

-- Equipment documents
update audit_log
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{file_url}',
  to_jsonb(ed.file_url)
)
from equipment_documents ed
where audit_log.entity_type = 'document'
  and audit_log.entity_id = ed.id::text
  and (metadata is null or metadata->>'file_url' is null)
  and ed.file_url is not null;
