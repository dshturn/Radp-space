UPDATE audit_log al
SET metadata = metadata || jsonb_build_object('file_url', d.file_url)
FROM documents d
WHERE al.entity_type = 'document'
  AND d.id = CAST(al.entity_id AS INTEGER)
  AND d.file_url IS NOT NULL
  AND al.entity_id IN ('6', '17');

SELECT
  COUNT(*) as total_documents,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%equipment-docs%' THEN 1 END) as equipment_urls,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%personnel-docs%' THEN 1 END) as personnel_urls,
  COUNT(CASE WHEN metadata->>'file_url' IS NULL THEN 1 END) as null_urls
FROM audit_log
WHERE entity_type = 'document';