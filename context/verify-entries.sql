SELECT
  entity_id,
  COUNT(*) as count
FROM audit_log
WHERE entity_type = 'document'
  AND entity_id IN ('6', '17')
GROUP BY entity_id;