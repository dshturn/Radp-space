UPDATE audit_log
SET metadata = metadata || jsonb_build_object('file_url', 'https://fslleuedqlxpjnerruzt.supabase.co/storage/v1/object/public/equipment-docs/equipment/75cec816-46cd-453b-ae5e-253e52087ac0/21/1775598235627_Canon_LEGRIA_HF_R806.pdf')
WHERE entity_type = 'document' AND entity_id = '6';

UPDATE audit_log
SET metadata = metadata || jsonb_build_object('file_url', 'https://fslleuedqlxpjnerruzt.supabase.co/storage/v1/object/public/equipment-docs/equipment/367bd894-9c70-4995-82a7-ff08d19523c0/49/1776833387809_PU-012_WO_500103079_PM2_PM3_FEB-26.pdf')
WHERE entity_type = 'document' AND entity_id = '17';

SELECT
  COUNT(*) as total_documents,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%equipment-docs%' THEN 1 END) as equipment_urls,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%personnel-docs%' THEN 1 END) as personnel_urls,
  COUNT(CASE WHEN metadata->>'file_url' IS NULL THEN 1 END) as null_urls
FROM audit_log
WHERE entity_type = 'document';