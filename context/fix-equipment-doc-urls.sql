-- FIX: Correct equipment document URLs in audit_log metadata
-- Equipment documents should have file_urls from the documents table, not personnel-docs

-- Step 1: Verify current state - count equipment audit entries and their URLs
SELECT
  COUNT(*) as total_equip_audit,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%equipment-docs%' THEN 1 END) as has_correct_url,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%personnel-docs%' THEN 1 END) as has_wrong_url,
  COUNT(CASE WHEN metadata->>'file_url' IS NULL THEN 1 END) as missing_url
FROM audit_log
WHERE entity_type = 'document'
  AND (
    metadata->>'label' ILIKE '%Calibration%' OR
    metadata->>'label' ILIKE '%COC%' OR
    metadata->>'label' ILIKE '%Gauge%' OR
    metadata->>'label' ILIKE '%HT%' OR
    metadata->>'label' ILIKE '%Leak%' OR
    metadata->>'label' ILIKE '%Maintenance%' OR
    metadata->>'label' ILIKE '%MPI%' OR
    metadata->>'label' ILIKE '%P Inspection%' OR
    metadata->>'label' ILIKE '%Pressure%' OR
    metadata->>'label' ILIKE '%PRVs%' OR
    metadata->>'label' ILIKE '%Visual%'
  );

-- Step 2: Update equipment document URLs from documents table
UPDATE audit_log al
SET metadata = metadata || jsonb_build_object('file_url', d.file_url)
FROM documents d
WHERE al.entity_type = 'document'
  AND d.id = CAST(al.entity_id AS INTEGER)
  AND d.file_url IS NOT NULL
  AND (
    al.metadata->>'label' ILIKE '%Calibration%' OR
    al.metadata->>'label' ILIKE '%COC%' OR
    al.metadata->>'label' ILIKE '%Gauge%' OR
    al.metadata->>'label' ILIKE '%HT%' OR
    al.metadata->>'label' ILIKE '%Leak%' OR
    al.metadata->>'label' ILIKE '%Maintenance%' OR
    al.metadata->>'label' ILIKE '%MPI%' OR
    al.metadata->>'label' ILIKE '%P Inspection%' OR
    al.metadata->>'label' ILIKE '%Pressure%' OR
    al.metadata->>'label' ILIKE '%PRVs%' OR
    al.metadata->>'label' ILIKE '%Visual%'
  );

-- Step 3: Verify the fix - check updated state
SELECT
  COUNT(*) as total_equip_audit,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%equipment-docs%' THEN 1 END) as has_correct_url,
  COUNT(CASE WHEN metadata->>'file_url' LIKE '%personnel-docs%' THEN 1 END) as has_wrong_url,
  COUNT(CASE WHEN metadata->>'file_url' IS NULL THEN 1 END) as missing_url
FROM audit_log
WHERE entity_type = 'document'
  AND (
    metadata->>'label' ILIKE '%Calibration%' OR
    metadata->>'label' ILIKE '%COC%' OR
    metadata->>'label' ILIKE '%Gauge%' OR
    metadata->>'label' ILIKE '%HT%' OR
    metadata->>'label' ILIKE '%Leak%' OR
    metadata->>'label' ILIKE '%Maintenance%' OR
    metadata->>'label' ILIKE '%MPI%' OR
    metadata->>'label' ILIKE '%P Inspection%' OR
    metadata->>'label' ILIKE '%Pressure%' OR
    metadata->>'label' ILIKE '%PRVs%' OR
    metadata->>'label' ILIKE '%Visual%'
  );
