SELECT
  id,
  entity_id,
  metadata->>'label' as label,
  metadata->>'file_url' as file_url,
  created_at
FROM audit_log
WHERE entity_type = 'document'
  AND metadata->>'file_url' IS NULL;