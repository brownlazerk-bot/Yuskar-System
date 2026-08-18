-- ==============================================================================
-- POST-MIGRATION VALIDATION AUDIT (READ-ONLY)
-- Run this in the Supabase SQL Editor after executing the migration.
-- ==============================================================================

-- 1. Confirm composite primary key on hotel_store
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.hotel_store'::regclass;

-- 2. Verify all 17 hotel_store rows are assigned to biz-1786805821046
SELECT business_id, COUNT(*) AS total_rows
FROM public.hotel_store
GROUP BY business_id;

-- 3. Confirm target business entity exists
SELECT id, name, code, status 
FROM public.businesses 
WHERE id = 'biz-1786805821046';

-- 4. Check for any leftover NULL business_id columns across public tables
SELECT 
  table_name, 
  column_name, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND column_name = 'business_id'
ORDER BY table_name;

-- 5. Verify security functions and execution permissions
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname IN ('get_auth_business_id', 'is_super_admin', 'prevent_privilege_escalation', 'register_business_secure');

-- 6. Verify Row Level Security status on all tables
SELECT 
  tablename, 
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 7. Count active policies per table
SELECT 
  tablename, 
  COUNT(*) AS active_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
