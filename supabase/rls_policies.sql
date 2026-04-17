-- ═══════════════════════════════════════════════════════════════
-- RADP SPACE — Row Level Security Migration
-- Run this once in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

-- ── Helper: check if the current JWT belongs to an admin ────────
-- After running this SQL, go to:
--   Authentication → Users → click your admin user → Edit
--   Set "app_metadata" to: {"is_admin": true}
--   Then click Save.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  )
$$;


-- ════════════════════════════════════════════════════════════════
-- 1. user_profiles
--    - Each user sees/edits only their own row
--    - Admins can see, edit, and delete all rows
-- ════════════════════════════════════════════════════════════════
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_profile"  ON user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile"  ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile"  ON user_profiles;
DROP POLICY IF EXISTS "admins_select_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admins_update_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admins_delete_profiles"    ON user_profiles;

CREATE POLICY "users_select_own_profile"  ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own_profile"  ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own_profile"  ON user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "admins_select_all_profiles" ON user_profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "admins_update_all_profiles" ON user_profiles
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins_delete_profiles"    ON user_profiles
  FOR DELETE USING (is_admin());


-- ════════════════════════════════════════════════════════════════
-- 2. assessments
--    - Users can only CRUD their own assessments
-- ════════════════════════════════════════════════════════════════
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_assessments" ON assessments;

CREATE POLICY "users_own_assessments" ON assessments
  FOR ALL
  USING     (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- 3. assessment_equipment
--    - Access allowed only if the linked assessment belongs to the user
-- ════════════════════════════════════════════════════════════════
ALTER TABLE assessment_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_assessment_equipment" ON assessment_equipment;

CREATE POLICY "users_own_assessment_equipment" ON assessment_equipment
  FOR ALL
  USING (
    assessment_id IN (
      SELECT id FROM assessments WHERE contractor_id = auth.uid()
    )
  )
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM assessments WHERE contractor_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════
-- 4. assessment_personnel
--    - Access allowed only if the linked assessment belongs to the user
-- ════════════════════════════════════════════════════════════════
ALTER TABLE assessment_personnel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_assessment_personnel" ON assessment_personnel;

CREATE POLICY "users_own_assessment_personnel" ON assessment_personnel
  FOR ALL
  USING (
    assessment_id IN (
      SELECT id FROM assessments WHERE contractor_id = auth.uid()
    )
  )
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM assessments WHERE contractor_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════
-- 5. equipment_items
--    - Users can only CRUD their own equipment
-- ════════════════════════════════════════════════════════════════
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_equipment_items" ON equipment_items;

CREATE POLICY "users_own_equipment_items" ON equipment_items
  FOR ALL
  USING     (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- 6. equipment_templates
--    - Any authenticated user can read templates
--    - Any authenticated user can add custom templates
-- ════════════════════════════════════════════════════════════════
ALTER TABLE equipment_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_equipment_templates"   ON equipment_templates;
DROP POLICY IF EXISTS "auth_insert_equipment_templates" ON equipment_templates;

CREATE POLICY "auth_read_equipment_templates" ON equipment_templates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_insert_equipment_templates" ON equipment_templates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════════════════════
-- 7. documents  (equipment documents)
--    - Access only if the linked equipment_item belongs to the user
-- ════════════════════════════════════════════════════════════════
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_documents" ON documents;

CREATE POLICY "users_own_documents" ON documents
  FOR ALL
  USING (
    equipment_item_id IN (
      SELECT id FROM equipment_items WHERE contractor_id = auth.uid()
    )
  )
  WITH CHECK (
    equipment_item_id IN (
      SELECT id FROM equipment_items WHERE contractor_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════
-- 8. personnel
--    - Users can only CRUD their own personnel records
-- ════════════════════════════════════════════════════════════════
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_personnel" ON personnel;

CREATE POLICY "users_own_personnel" ON personnel
  FOR ALL
  USING     (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- 9. personnel_documents
--    - Access only if the linked personnel record belongs to the user
-- ════════════════════════════════════════════════════════════════
ALTER TABLE personnel_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_personnel_documents" ON personnel_documents;

CREATE POLICY "users_own_personnel_documents" ON personnel_documents
  FOR ALL
  USING (
    personnel_id IN (
      SELECT id FROM personnel WHERE contractor_id = auth.uid()
    )
  )
  WITH CHECK (
    personnel_id IN (
      SELECT id FROM personnel WHERE contractor_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════
-- 10. companies
--     - Anyone (including unauthenticated / anon) can read
--       so the registration dropdown works before login
--     - Anyone can insert (needed during registration flow)
-- ════════════════════════════════════════════════════════════════
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_companies"  ON companies;
DROP POLICY IF EXISTS "public_insert_companies" ON companies;

CREATE POLICY "public_read_companies"  ON companies
  FOR SELECT USING (true);

CREATE POLICY "public_insert_companies" ON companies
  FOR INSERT WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════
-- 11. service_lines
--     - Anyone can read (needed for registration and assessment forms)
--     - Authenticated users can add custom service lines
-- ════════════════════════════════════════════════════════════════
ALTER TABLE service_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_service_lines"  ON service_lines;
DROP POLICY IF EXISTS "auth_insert_service_lines"  ON service_lines;

CREATE POLICY "public_read_service_lines" ON service_lines
  FOR SELECT USING (true);

CREATE POLICY "auth_insert_service_lines" ON service_lines
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════════════════════
-- 12. personnel_positions
--     - Authenticated users can read and add positions
-- ════════════════════════════════════════════════════════════════
ALTER TABLE personnel_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_personnel_positions"   ON personnel_positions;
DROP POLICY IF EXISTS "auth_insert_personnel_positions" ON personnel_positions;

CREATE POLICY "auth_read_personnel_positions" ON personnel_positions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_insert_personnel_positions" ON personnel_positions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════════════════════
-- 13. Storage buckets — restrict uploads & deletes to file owners
--     File paths are: equipment/{user_id}/... and personnel/{user_id}/...
--     Buckets remain public-readable so existing doc URLs keep working.
-- ════════════════════════════════════════════════════════════════

-- equipment-docs
DROP POLICY IF EXISTS "owner_upload_equipment_docs" ON storage.objects;
DROP POLICY IF EXISTS "owner_delete_equipment_docs" ON storage.objects;

CREATE POLICY "owner_upload_equipment_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'equipment-docs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "owner_delete_equipment_docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'equipment-docs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- personnel-docs
DROP POLICY IF EXISTS "owner_upload_personnel_docs" ON storage.objects;
DROP POLICY IF EXISTS "owner_delete_personnel_docs" ON storage.objects;

CREATE POLICY "owner_upload_personnel_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'personnel-docs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "owner_delete_personnel_docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'personnel-docs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );


-- ════════════════════════════════════════════════════════════════
-- DONE.
-- After running this SQL, do ONE manual step in the dashboard:
--
--   Authentication → Users → click your ADMIN user → Edit
--   Paste into "app_metadata":  {"is_admin": true}
--   Click Save.
--
-- This lets the admin panel see and manage all user profiles.
-- ════════════════════════════════════════════════════════════════
