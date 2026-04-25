-- Backfill document audit log entries with file_url metadata
-- This allows existing documents to be clickable in the audit log viewer

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
