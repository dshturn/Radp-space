-- Simple check: show all document audit entries
SELECT
  id,
  entity_id,
  metadata->>'label' as label,
  metadata->>'file_url' as file_url
FROM audit_log
WHERE entity_type = 'document'
ORDER BY created_at DESC
LIMIT 20;
