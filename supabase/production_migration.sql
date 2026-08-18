-- ==============================================================================
-- PRODUCTION MULTI-TENANT ISOLATION MIGRATION SCRIPT
-- Database: PostgreSQL / Supabase
-- Target Business for Backfill: 'biz-1786805821046' (SEVEN TO SEVEN Sky View Resort)
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. SECURITY DEFINER AUTHORIZATION FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'Super Admin' OR is_super_admin = TRUE)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_business_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ==============================================================================
-- 2. DROP LEGACY 'biz_default' COLUMN DEFAULTS IF PRESENT
-- ==============================================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ingredients', 'recipes', 'categories', 'inventory_items', 'stock_movements'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'business_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id DROP DEFAULT', tbl);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 3. MIGRATE hotel_store (100% DATA PRESERVATION)
-- ==============================================================================

-- 3.1 Ensure business_id column exists
ALTER TABLE public.hotel_store ADD COLUMN IF NOT EXISTS business_id TEXT;

-- 3.2 Backfill existing operational rows to verified business ID
UPDATE public.hotel_store 
SET business_id = 'biz-1786805821046' 
WHERE business_id IS NULL OR business_id = '' OR business_id = 'biz_default';

-- 3.3 Ensure the backfilled business entity exists
INSERT INTO public.businesses (id, name, code, category, owner_name, owner_email, status, created_at, updated_at)
VALUES ('biz-1786805821046', 'SEVEN TO SEVEN Sky View Resort', 'BIZ-1046', 'Hotel / Resort', 'Theogene', 'yuskarshop@gmail.com', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3.4 Enforce NOT NULL constraint
ALTER TABLE public.hotel_store ALTER COLUMN business_id SET NOT NULL;

-- 3.5 Re-link Foreign Key constraint
ALTER TABLE public.hotel_store DROP CONSTRAINT IF EXISTS hotel_store_business_id_fkey;
ALTER TABLE public.hotel_store 
  ADD CONSTRAINT hotel_store_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

-- 3.6 Reconstruct Primary Key as composite (business_id, key)
ALTER TABLE public.hotel_store DROP CONSTRAINT IF EXISTS hotel_store_pkey;
ALTER TABLE public.hotel_store ADD PRIMARY KEY (business_id, key);

-- 3.7 Index for fast tenant querying
CREATE INDEX IF NOT EXISTS idx_hotel_store_tenant ON public.hotel_store(business_id);

-- ==============================================================================
-- 4. PRIVILEGE ESCALATION PROTECTION TRIGGER ON PROFILES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If caller is NOT a verified Super Admin, strictly reject unauthorized self-modifications
  IF NOT public.is_super_admin() THEN
    -- Prevent self-elevating to Super Admin role
    IF NEW.role = 'Super Admin' AND (OLD.role IS NULL OR OLD.role <> 'Super Admin') THEN
      RAISE EXCEPTION 'Unauthorized: Only an existing Super Admin can assign the Super Admin role.';
    END IF;

    -- Prevent self-elevating is_super_admin flag
    IF NEW.is_super_admin = TRUE AND (OLD.is_super_admin IS NULL OR OLD.is_super_admin = FALSE) THEN
      RAISE EXCEPTION 'Unauthorized: Only an existing Super Admin can grant Super Admin privileges.';
    END IF;

    -- Prevent altering assigned business ID
    IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot change their assigned tenant business ID.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

-- ==============================================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_store ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['menu_items', 'ingredients', 'recipes', 'categories', 'inventory_items', 'stock_movements', 'orders', 'users'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 6. HARDENED ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- 6.1 HOTEL_STORE
DROP POLICY IF EXISTS "Hotel store sync policy" ON public.hotel_store;
DROP POLICY IF EXISTS "Allow public access" ON public.hotel_store;
DROP POLICY IF EXISTS "Allow public select/insert/update/delete" ON public.hotel_store;
DROP POLICY IF EXISTS "Tenant isolation for hotel_store" ON public.hotel_store;

CREATE POLICY "Tenant isolation for hotel_store"
ON public.hotel_store FOR ALL
TO authenticated
USING (
  business_id = public.get_auth_business_id() OR public.is_super_admin()
)
WITH CHECK (
  business_id = public.get_auth_business_id() OR public.is_super_admin()
);

-- 6.2 BUSINESSES (Protected against unauthorized creation)
DROP POLICY IF EXISTS "Businesses select policy" ON public.businesses;
DROP POLICY IF EXISTS "Businesses insert policy" ON public.businesses;
DROP POLICY IF EXISTS "Businesses update policy" ON public.businesses;
DROP POLICY IF EXISTS "Businesses delete policy" ON public.businesses;
DROP POLICY IF EXISTS "Allow public access on businesses" ON public.businesses;

CREATE POLICY "Businesses select policy"
ON public.businesses FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR id = public.get_auth_business_id()
);

CREATE POLICY "Businesses insert policy"
ON public.businesses FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
);

CREATE POLICY "Businesses update policy"
ON public.businesses FOR UPDATE
TO authenticated
USING (
  public.is_super_admin() OR id = public.get_auth_business_id()
)
WITH CHECK (
  public.is_super_admin() OR id = public.get_auth_business_id()
);

CREATE POLICY "Businesses delete policy"
ON public.businesses FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- 6.3 PROFILES
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;

CREATE POLICY "Profiles select policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR 
  id = auth.uid() OR 
  (business_id IS NOT NULL AND business_id = public.get_auth_business_id())
);

CREATE POLICY "Profiles insert policy"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin() OR id = auth.uid()
);

CREATE POLICY "Profiles update policy"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  public.is_super_admin() OR id = auth.uid()
)
WITH CHECK (
  public.is_super_admin() OR (
    id = auth.uid() AND 
    (business_id IS NOT DISTINCT FROM public.get_auth_business_id()) AND 
    is_super_admin = FALSE AND 
    role <> 'Super Admin'
  )
);

CREATE POLICY "Profiles delete policy"
ON public.profiles FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- 6.4 SUBSCRIPTIONS
DROP POLICY IF EXISTS "Subscriptions select policy" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions insert policy" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions update policy" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions delete policy" ON public.subscriptions;

CREATE POLICY "Subscriptions select policy"
ON public.subscriptions FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR business_id = public.get_auth_business_id()
);

CREATE POLICY "Subscriptions insert policy"
ON public.subscriptions FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
);

CREATE POLICY "Subscriptions update policy"
ON public.subscriptions FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
)
WITH CHECK (
  public.is_super_admin()
);

CREATE POLICY "Subscriptions delete policy"
ON public.subscriptions FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- 6.5 SUBSCRIPTION PAYMENTS
DROP POLICY IF EXISTS "Payments select policy" ON public.subscription_payments;
DROP POLICY IF EXISTS "Payments insert policy" ON public.subscription_payments;
DROP POLICY IF EXISTS "Payments update policy" ON public.subscription_payments;
DROP POLICY IF EXISTS "Payments delete policy" ON public.subscription_payments;

CREATE POLICY "Payments select policy"
ON public.subscription_payments FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR business_id = public.get_auth_business_id()
);

CREATE POLICY "Payments insert policy"
ON public.subscription_payments FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
);

CREATE POLICY "Payments update policy"
ON public.subscription_payments FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
)
WITH CHECK (
  public.is_super_admin()
);

CREATE POLICY "Payments delete policy"
ON public.subscription_payments FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- 6.6 SYSTEM SETTINGS (Restricted to Super Admin)
DROP POLICY IF EXISTS "System settings select policy" ON public.system_settings;
DROP POLICY IF EXISTS "System settings manage policy" ON public.system_settings;

CREATE POLICY "System settings select policy"
ON public.system_settings FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
);

CREATE POLICY "System settings manage policy"
ON public.system_settings FOR ALL
TO authenticated
USING (
  public.is_super_admin()
)
WITH CHECK (
  public.is_super_admin()
);

-- 6.7 AUDIT LOGS
DROP POLICY IF EXISTS "Audit logs select policy" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs insert policy" ON public.audit_logs;

CREATE POLICY "Audit logs select policy"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR
  (business_id IS NOT NULL AND business_id = public.get_auth_business_id())
);

CREATE POLICY "Audit logs insert policy"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

COMMIT;
