-- ═══════════════════════════════════════════════════════════
-- Helper Functions for Document Status & Timestamps
-- ═══════════════════════════════════════════════════════════

-- Function: Calculate document status based on expiry date
DROP FUNCTION IF EXISTS get_document_status(DATE);
CREATE OR REPLACE FUNCTION get_document_status(expiry_date DATE)
RETURNS TEXT AS $$
BEGIN
  IF expiry_date IS NULL THEN
    RETURN 'missing';
  END IF;

  IF expiry_date < CURRENT_DATE THEN
    RETURN 'expired';
  END IF;

  IF expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'expiring';
  END IF;

  RETURN 'valid';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Get days until expiry (for sorting/filtering)
DROP FUNCTION IF EXISTS days_until_expiry(DATE);
CREATE OR REPLACE FUNCTION days_until_expiry(expiry_date DATE)
RETURNS INTEGER AS $$
BEGIN
  IF expiry_date IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (expiry_date - CURRENT_DATE)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- View: Documents with calculated status
DROP VIEW IF EXISTS v_documents_with_status CASCADE;
CREATE VIEW v_documents_with_status AS
SELECT
  d.*,
  get_document_status(d.expiry_date) AS status,
  days_until_expiry(d.expiry_date) AS days_until,
  CASE
    WHEN d.expiry_date IS NULL THEN '🔴 Missing'
    WHEN d.expiry_date < CURRENT_DATE THEN '🔴 Expired'
    WHEN d.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN '🟡 Expiring'
    ELSE '🟢 Valid'
  END AS status_badge
FROM documents d;

-- View: Personnel documents with calculated status
DROP VIEW IF EXISTS v_personnel_documents_with_status CASCADE;
CREATE VIEW v_personnel_documents_with_status AS
SELECT
  pd.*,
  get_document_status(pd.expiry_date) AS status,
  days_until_expiry(pd.expiry_date) AS days_until,
  CASE
    WHEN pd.expiry_date IS NULL THEN '🔴 Missing'
    WHEN pd.expiry_date < CURRENT_DATE THEN '🔴 Expired'
    WHEN pd.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN '🟡 Expiring'
    ELSE '🟢 Valid'
  END AS status_badge
FROM personnel_documents pd;
