-- RLS for audit_log: contractors see only their company + service line
-- Admins see all

-- Enable RLS if not already enabled
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- DROP existing policies if they exist (optional, comment out if you want to keep them)
-- DROP POLICY IF EXISTS "Contractors see own company/service line" ON audit_log;
-- DROP POLICY IF EXISTS "Admins see all" ON audit_log;

-- Policy for contractors: see audit log for their company + service line
CREATE POLICY "Contractors see own company/service line"
ON audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'contractor'
    AND company = audit_log.company
    AND service_line = audit_log.service_line
  )
);

-- Policy for admins: see all audit log entries
CREATE POLICY "Admins see all audit log"
ON audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
