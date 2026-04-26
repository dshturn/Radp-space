SELECT
  entity_id,
  metadata->>'file_url' as file_url
FROM audit_log
WHERE entity_type = 'document'
  AND entity_id IN ('6', '17');