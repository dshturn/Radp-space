-- Check what labels actually exist for document entries in audit_log
SELECT
  metadata->>'label' as label,
  COUNT(*) as count,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%equipment-docs%' THEN 1 END) as has_equip_url,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%personnel-docs%' THEN 1 END) as has_pers_url,
  COUNT(CASE WHEN metadata->>'file_url' IS NULL THEN 1 END) as has_no_url
FROM audit_log
WHERE entity_type = 'document'
GROUP BY metadata->>'label'
ORDER BY count DESC;
