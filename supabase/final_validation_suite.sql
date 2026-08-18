-- ==============================================================================
-- FINAL POST-MIGRATION VALIDATION & SECURITY AUDIT SUITE
-- Run this in the Supabase SQL Editor immediately after executing the migration.
-- ==============================================================================

-- 1. Verify target business exists and has ACTIVE status
SELECT id, name, code, category, status 
FROM public.businesses 
WHERE id = 'biz-1786805821046';

-- 2. Verify hotel_store primary key structure and row distribution
SELECT 
  conname, 
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.hotel_store'::regclass AND contype = 'p';

SELECT business_id, COUNT(*) AS row_count
FROM public.hotel_store
GROUP BY business_id;

-- 3. Verify that NO operational tables have NULL or empty business_id
SELECT 
  table_name, 
  column_name, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND column_name = 'business_id'
ORDER BY table_name;

-- 4. Audit subscription_licenses for genuine orphan detection
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_licenses') THEN
    RAISE NOTICE '=== SUBSCRIPTION LICENSES AUDIT ===';
    PERFORM id, business_id, subscription_id FROM public.subscription_licenses WHERE business_id IS NULL;
    IF FOUND THEN
      RAISE WARNING 'Unassigned orphan subscription_licenses detected with NULL business_id!';
    ELSE
      RAISE NOTICE 'All subscription_licenses have valid business_id linkages.';
    END IF;
  END IF;
END $$;

-- 5. Audit all functions and security definitions
SELECT proname, prosecdef, proconfig
FROM pg_proc 
WHERE proname IN (
  'is_super_admin', 
  'get_auth_business_id', 
  'prevent_privilege_escalation', 
  'register_business_secure'
);

-- 6. Audit Row Level Security status on all public tables
SELECT 
  tablename, 
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 7. Audit exact active policy count per table
SELECT 
  tablename, 
  COUNT(*) AS total_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 8. Verify trigger status on profiles table
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';
