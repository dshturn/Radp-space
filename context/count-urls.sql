SELECT
  COUNT(*) as total_documents,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%equipment-docs%' THEN 1 END) as equipment_urls,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%personnel-docs%' THEN 1 END) as personnel_urls,
  COUNT(CASE WHEN metadata->>'file_url' IS NULL THEN 1 END) as null_urls
FROM audit_log
WHERE entity_type = 'document';