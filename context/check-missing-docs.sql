SELECT
  'personnel_documents' as source,
  id,
  file_url
FROM personnel_documents
WHERE id IN (3, 5, 6, 17, 24)
UNION ALL
SELECT
  'documents' as source,
  id,
  file_url
FROM documents
WHERE id IN (3, 5, 6, 17, 24)
ORDER BY id;