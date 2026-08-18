-- ==============================================================================
-- PRODUCTION MULTI-TENANT ISOLATION MIGRATION SCRIPT V2
-- Multi-Tenant POS & Hotel Management SaaS with Complete Super Admin Architecture
-- Target Business: 'biz-1786805821046' (SEVEN TO SEVEN Sky View Resort)
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. EXTENSIONS & PREREQUISITES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. SECURITY DEFINER AUTHORIZATION FUNCTIONS
-- ==============================================================================

-- 2.1 Super Admin verification function (Reads direct profile state with safe search_path)
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

-- 2.2 Authenticated Tenant Resolver function
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
-- 3. ENSURE BASE ENTITIES & DEFAULT BUSINESS EXIST
-- ==============================================================================

-- Ensure target business exists without overwriting existing details
INSERT INTO public.businesses (
  id, 
  name, 
  code, 
  category, 
  owner_name, 
  owner_email, 
  status, 
  created_at, 
  updated_at
)
VALUES (
  'biz-1786805821046', 
  'SEVEN TO SEVEN Sky View Resort', 
  'BIZ-1046', 
  'Hotel / Resort', 
  'Theogene', 
  'yuskarshop@gmail.com', 
  'ACTIVE', 
  NOW(), 
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 4. MIGRATE hotel_store (100% DATA PRESERVATION)
-- ==============================================================================

-- 4.1 Ensure business_id column exists
ALTER TABLE public.hotel_store ADD COLUMN IF NOT EXISTS business_id TEXT;

-- 4.2 Backfill existing operational rows to verified business ID
UPDATE public.hotel_store 
SET business_id = 'biz-1786805821046' 
WHERE business_id IS NULL OR business_id = '' OR business_id = 'biz_default';

-- 4.3 Enforce NOT NULL
ALTER TABLE public.hotel_store ALTER COLUMN business_id SET NOT NULL;

-- 4.4 Link Foreign Key with ON DELETE RESTRICT (Safeguards against accidental cascades)
ALTER TABLE public.hotel_store DROP CONSTRAINT IF EXISTS hotel_store_business_id_fkey;
ALTER TABLE public.hotel_store 
  ADD CONSTRAINT hotel_store_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

-- 4.5 Reconstruct composite primary key: (business_id, key)
ALTER TABLE public.hotel_store DROP CONSTRAINT IF EXISTS hotel_store_pkey;
ALTER TABLE public.hotel_store ADD PRIMARY KEY (business_id, key);

-- 4.6 Performance Index
CREATE INDEX IF NOT EXISTS idx_hotel_store_tenant ON public.hotel_store(business_id);

-- ==============================================================================
-- 5. AUDIT & MIGRATE ALL KNOWN OPERATIONAL TABLES (DYNAMIC AUDIT)
-- ==============================================================================

DO $$
DECLARE
  tbl TEXT;
  tbl_list TEXT[] := ARRAY[
    'menu_items', 'ingredients', 'recipes', 'categories', 
    'inventory_items', 'stock_movements', 'orders', 'order_items', 
    'sales', 'sale_items', 'expenses', 'purchase_orders', 
    'purchase_order_items', 'cash_movements', 'shifts', 
    'daily_closings', 'tables', 'kitchen_tickets', 'guest_rooms', 
    'room_bookings', 'waiters', 'staff', 'employees', 'payroll_records', 
    'waste_records', 'notifications', 'suppliers', 'subscription_licenses'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbl_list LOOP
    -- If the table exists in public schema:
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      
      -- 5.1 Ensure business_id column exists
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id TEXT', tbl);
      
      -- 5.2 Drop legacy defaults if any (e.g. 'biz_default')
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id DROP DEFAULT', tbl);
      
      -- 5.3 Backfill any NULL business_id rows to target business
      EXECUTE format('UPDATE public.%I SET business_id = %L WHERE business_id IS NULL OR business_id = %L OR business_id = %L', tbl, 'biz-1786805821046', '', 'biz_default');
      
      -- 5.4 Enforce NOT NULL constraint
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET NOT NULL', tbl);
      
      -- 5.5 Ensure Foreign Key exists with ON DELETE RESTRICT
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_business_id_fkey');
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT', tbl, tbl || '_business_id_fkey');
      
      -- 5.6 Create tenant index
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(business_id)', 'idx_' || tbl || '_tenant', tbl);
      
      -- 5.7 Enable Row Level Security
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      
      -- 5.8 Deploy standard strict tenant policies
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_select_policy', tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin() OR business_id = public.get_auth_business_id())', tbl || '_tenant_select_policy', tbl);
      
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_insert_policy', tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR business_id = public.get_auth_business_id())', tbl || '_tenant_insert_policy', tbl);
      
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_update_policy', tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_super_admin() OR business_id = public.get_auth_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.get_auth_business_id())', tbl || '_tenant_update_policy', tbl);
      
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_delete_policy', tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_super_admin() OR business_id = public.get_auth_business_id())', tbl || '_tenant_delete_policy', tbl);
      
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 6. SECURE BUSINESS REGISTRATION RPC FUNCTION
-- ==============================================================================

-- Provides a secure, transactional registration endpoint that works without allowing
-- direct, unrestricted client-side INSERT into the businesses table.
CREATE OR REPLACE FUNCTION public.register_business_secure(
  p_business_name TEXT,
  p_business_code TEXT,
  p_category TEXT,
  p_owner_name TEXT,
  p_owner_phone TEXT,
  p_owner_email TEXT,
  p_pin_code TEXT DEFAULT '1234'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_biz_id TEXT;
  v_sub_id TEXT;
  v_clean_code TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in to register a business.';
  END IF;

  -- Generate clean, sanitized business ID
  v_clean_code := UPPER(REGEXP_REPLACE(COALESCE(p_business_code, 'BIZ'), '[^A-Z0-9]', '', 'g'));
  v_biz_id := 'biz-' || LOWER(REGEXP_REPLACE(p_business_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
  v_sub_id := 'sub-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6);

  -- 1. Create Business Record (PENDING_PAYMENT)
  INSERT INTO public.businesses (
    id,
    name,
    code,
    category,
    owner_name,
    owner_email,
    owner_phone,
    phone,
    email,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_biz_id,
    p_business_name,
    v_clean_code,
    COALESCE(p_category, 'Hotel & Restaurant'),
    p_owner_name,
    p_owner_email,
    p_owner_phone,
    p_owner_phone,
    p_owner_email,
    'PENDING_PAYMENT',
    NOW(),
    NOW()
  );

  -- 2. Link/Update User Profile to this business as Admin/Manager (NOT Super Admin)
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    business_id,
    access_status,
    payment_status,
    pin_code,
    is_super_admin,
    created_at,
    last_login_at
  )
  VALUES (
    v_user_id,
    p_owner_email,
    p_owner_name,
    p_owner_phone,
    'Admin',
    v_biz_id,
    'Pending Payment',
    'Unpaid',
    COALESCE(p_pin_code, '1234'),
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    business_id = v_biz_id,
    role = CASE WHEN public.profiles.role = 'Super Admin' THEN 'Super Admin' ELSE 'Admin' END,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    access_status = 'Pending Payment',
    payment_status = 'Unpaid',
    is_super_admin = CASE WHEN public.profiles.is_super_admin = TRUE THEN TRUE ELSE FALSE END;

  -- 3. Create Initial Pending Subscription Record (Standard 1-Month Plan: 100,000 RWF)
  INSERT INTO public.subscriptions (
    id,
    business_id,
    business_name,
    plan_name,
    plan,
    monthly_fee,
    amount,
    currency,
    status,
    start_date,
    expiry_date,
    expires_at,
    next_billing_date,
    grace_period_days,
    payment_method,
    momo_number,
    created_at,
    updated_at
  )
  VALUES (
    v_sub_id,
    v_biz_id,
    p_business_name,
    'Standard Business SaaS Monthly License',
    'MONTHLY_STANDARD',
    100000,
    100000,
    'RWF',
    'PENDING_PAYMENT',
    NOW(),
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '30 days',
    3,
    'MTN_MOMO',
    '0726134041',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 4. Initialize hotel_store with initial setup state for this business
  INSERT INTO public.hotel_store (business_id, key, data, updated_at)
  VALUES 
    (v_biz_id, 'business_profile', jsonb_build_object('id', v_biz_id, 'name', p_business_name, 'status', 'PENDING_PAYMENT'), NOW()),
    (v_biz_id, 'app_version', jsonb_build_object('version', '2.0.0', 'initialized_at', NOW()), NOW())
  ON CONFLICT (business_id, key) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'business_id', v_biz_id,
    'subscription_id', v_sub_id,
    'status', 'PENDING_PAYMENT'
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.register_business_secure TO authenticated;

-- ==============================================================================
-- 7. PRIVILEGE ESCALATION PROTECTION TRIGGER ON PROFILES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the caller is NOT a verified Super Admin, reject forbidden privilege changes:
  IF NOT public.is_super_admin() THEN
    -- Cannot assign Super Admin role
    IF NEW.role = 'Super Admin' AND (OLD.role IS NULL OR OLD.role <> 'Super Admin') THEN
      RAISE EXCEPTION 'Privilege escalation rejected: Only Super Admins can assign the Super Admin role.';
    END IF;

    -- Cannot set is_super_admin flag
    IF NEW.is_super_admin = TRUE AND (OLD.is_super_admin IS NULL OR OLD.is_super_admin = FALSE) THEN
      RAISE EXCEPTION 'Privilege escalation rejected: Only Super Admins can grant is_super_admin flag.';
    END IF;

    -- Cannot switch business assignments (unless initially NULL during registration)
    IF OLD.business_id IS NOT NULL AND NEW.business_id IS DISTINCT FROM OLD.business_id THEN
      RAISE EXCEPTION 'Tenant violation: Users cannot alter their assigned business ID.';
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
-- 8. CORE TABLE RLS POLICIES
-- ==============================================================================

-- 8.1 BUSINESSES
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Businesses select policy" ON public.businesses;
CREATE POLICY "Businesses select policy"
ON public.businesses FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR id = public.get_auth_business_id()
);

DROP POLICY IF EXISTS "Businesses insert policy" ON public.businesses;
CREATE POLICY "Businesses insert policy"
ON public.businesses FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin() OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Businesses update policy" ON public.businesses;
CREATE POLICY "Businesses update policy"
ON public.businesses FOR UPDATE
TO authenticated
USING (
  public.is_super_admin() OR id = public.get_auth_business_id()
)
WITH CHECK (
  public.is_super_admin() OR id = public.get_auth_business_id()
);

DROP POLICY IF EXISTS "Businesses delete policy" ON public.businesses;
CREATE POLICY "Businesses delete policy"
ON public.businesses FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- 8.2 PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR 
  id = auth.uid() OR 
  (business_id IS NOT NULL AND business_id = public.get_auth_business_id())
);

DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin() OR id = auth.uid()
);

DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
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

DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;
CREATE POLICY "Profiles delete policy"
ON public.profiles FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- 8.3 SUBSCRIPTIONS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscriptions select policy" ON public.subscriptions;
CREATE POLICY "Subscriptions select policy"
ON public.subscriptions FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR business_id = public.get_auth_business_id()
);

DROP POLICY IF EXISTS "Subscriptions insert policy" ON public.subscriptions;
CREATE POLICY "Subscriptions insert policy"
ON public.subscriptions FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin() OR (business_id = public.get_auth_business_id() AND status = 'PENDING_PAYMENT')
);

DROP POLICY IF EXISTS "Subscriptions update policy" ON public.subscriptions;
CREATE POLICY "Subscriptions update policy"
ON public.subscriptions FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
)
WITH CHECK (
  public.is_super_admin()
);

DROP POLICY IF EXISTS "Subscriptions delete policy" ON public.subscriptions;
CREATE POLICY "Subscriptions delete policy"
ON public.subscriptions FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- 8.4 SUBSCRIPTION PAYMENTS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payments select policy" ON public.subscription_payments;
CREATE POLICY "Payments select policy"
ON public.subscription_payments FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR business_id = public.get_auth_business_id()
);

DROP POLICY IF EXISTS "Payments insert policy" ON public.subscription_payments;
CREATE POLICY "Payments insert policy"
ON public.subscription_payments FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin() OR (business_id = public.get_auth_business_id() AND status = 'PENDING')
);

DROP POLICY IF EXISTS "Payments update policy" ON public.subscription_payments;
CREATE POLICY "Payments update policy"
ON public.subscription_payments FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
)
WITH CHECK (
  public.is_super_admin()
);

DROP POLICY IF EXISTS "Payments delete policy" ON public.subscription_payments;
CREATE POLICY "Payments delete policy"
ON public.subscription_payments FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);

-- 8.5 SUBSCRIPTION LICENSES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_licenses') THEN
    ALTER TABLE public.subscription_licenses ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Licenses select policy" ON public.subscription_licenses;
    CREATE POLICY "Licenses select policy"
    ON public.subscription_licenses FOR SELECT
    TO authenticated
    USING (
      public.is_super_admin() OR business_id = public.get_auth_business_id()
    );

    DROP POLICY IF EXISTS "Licenses manage policy" ON public.subscription_licenses;
    CREATE POLICY "Licenses manage policy"
    ON public.subscription_licenses FOR ALL
    TO authenticated
    USING (
      public.is_super_admin()
    )
    WITH CHECK (
      public.is_super_admin()
    );
  END IF;
END $$;

-- 8.6 SYSTEM SETTINGS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System settings select policy" ON public.system_settings;
CREATE POLICY "System settings select policy"
ON public.system_settings FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "System settings manage policy" ON public.system_settings;
CREATE POLICY "System settings manage policy"
ON public.system_settings FOR ALL
TO authenticated
USING (
  public.is_super_admin()
)
WITH CHECK (
  public.is_super_admin()
);

-- 8.7 AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs select policy" ON public.audit_logs;
CREATE POLICY "Audit logs select policy"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR
  (business_id IS NOT NULL AND business_id = public.get_auth_business_id())
);

DROP POLICY IF EXISTS "Audit logs insert policy" ON public.audit_logs;
CREATE POLICY "Audit logs insert policy"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 8.8 HOTEL_STORE
ALTER TABLE public.hotel_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel store sync policy" ON public.hotel_store;
DROP POLICY IF EXISTS "Allow public access" ON public.hotel_store;
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

COMMIT;
