-- ============================================================================
-- PRODUCTION MULTI-TENANT ISOLATION MIGRATION
-- UUID NATIVE / NON-DESTRUCTIVE / SUPER ADMIN / REGISTRATION COMPATIBLE
-- Target Business: SEVEN TO SEVEN Sky View Resort
--
-- SAFE GUARANTEES:
--   - No DROP TABLE
--   - No TRUNCATE
--   - No DROP COLUMN
--   - No UUID -> TEXT conversion
--   - Existing non-NULL business_id values are NEVER overwritten
--   - Target business is NEVER created automatically
--   - Migration runs transactionally
--   - Tenant RLS is enforced
--   - Super Admin can access all tenants
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- 1. REQUIRED CORE TABLES
-- ============================================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND table_type = 'BASE TABLE'
    ) THEN
        RAISE EXCEPTION
            'Migration aborted: public.businesses does not exist.';
    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND table_type = 'BASE TABLE'
    ) THEN
        RAISE EXCEPTION
            'Migration aborted: public.profiles does not exist.';
    END IF;

END $$;


-- ============================================================================
-- 2. VERIFY CORE UUID STRUCTURE
-- ============================================================================

DO $$
DECLARE
    v_type TEXT;
BEGIN

    SELECT data_type
    INTO v_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'id';

    IF v_type IS DISTINCT FROM 'uuid' THEN
        RAISE EXCEPTION
            'Migration aborted: businesses.id must be UUID. Current type: %',
            v_type;
    END IF;


    SELECT data_type
    INTO v_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'business_id';

    IF v_type IS DISTINCT FROM 'uuid' THEN
        RAISE EXCEPTION
            'Migration aborted: profiles.business_id must be UUID. Current type: %',
            v_type;
    END IF;


    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'subscriptions'
    ) THEN

        SELECT data_type
        INTO v_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscriptions'
          AND column_name = 'business_id';

        IF v_type IS DISTINCT FROM 'uuid' THEN
            RAISE EXCEPTION
                'Migration aborted: subscriptions.business_id must be UUID. Current type: %',
                v_type;
        END IF;

    END IF;

END $$;


-- ============================================================================
-- 3. VERIFY EXACT TARGET BUSINESS
-- ============================================================================

DO $$
DECLARE
    v_count INTEGER;
    v_name TEXT;
    v_id UUID;
BEGIN

    SELECT COUNT(*)
    INTO v_count
    FROM public.businesses
    WHERE name ILIKE '%SEVEN TO SEVEN%'
       OR name ILIKE '%Sky View%';


    IF v_count = 0 THEN
        RAISE EXCEPTION
            'Migration aborted: SEVEN TO SEVEN Sky View Resort was not found.';
    END IF;


    IF v_count > 1 THEN
        RAISE EXCEPTION
            'Migration aborted: % businesses match SEVEN TO SEVEN / Sky View. Resolve duplicates first.',
            v_count;
    END IF;


    SELECT id, name
    INTO v_id, v_name
    FROM public.businesses
    WHERE name ILIKE '%SEVEN TO SEVEN%'
       OR name ILIKE '%Sky View%'
    LIMIT 1;


    RAISE NOTICE
        'Target business verified: % [%]',
        v_name,
        v_id;

END $$;


-- ============================================================================
-- 4. SECURITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
              p.role = 'Super Admin'
              OR COALESCE(p.is_super_admin, FALSE) = TRUE
          )
    );
$$;


CREATE OR REPLACE FUNCTION public.get_auth_business_id_raw()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT p.business_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION public.get_my_business_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT p.business_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
$$;


-- ============================================================================
-- 5. HOTEL_STORE
-- ============================================================================

DO $$
DECLARE
    v_business_id UUID;
    v_null_count BIGINT;
    v_duplicate_count BIGINT;
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'hotel_store'
          AND table_type = 'BASE TABLE'
    ) THEN

        RAISE NOTICE
            'hotel_store does not exist. Skipping hotel_store migration.';

    ELSE

        SELECT id
        INTO v_business_id
        FROM public.businesses
        WHERE name ILIKE '%SEVEN TO SEVEN%'
           OR name ILIKE '%Sky View%'
        LIMIT 1;


        -- Add business_id only when missing
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'hotel_store'
              AND column_name = 'business_id'
        ) THEN

            ALTER TABLE public.hotel_store
                ADD COLUMN business_id UUID;

        END IF;


        -- Verify key exists
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'hotel_store'
              AND column_name = 'key'
        ) THEN

            RAISE EXCEPTION
                'Migration aborted: hotel_store.key does not exist.';

        END IF;


        -- Backfill ONLY NULL values
        UPDATE public.hotel_store
        SET business_id = v_business_id
        WHERE business_id IS NULL;


        SELECT COUNT(*)
        INTO v_null_count
        FROM public.hotel_store
        WHERE business_id IS NULL;


        IF v_null_count > 0 THEN
            RAISE EXCEPTION
                'Migration aborted: hotel_store has % rows without business_id.',
                v_null_count;
        END IF;


        -- Check composite key BEFORE changing primary key
        SELECT COUNT(*)
        INTO v_duplicate_count
        FROM (
            SELECT business_id, key
            FROM public.hotel_store
            GROUP BY business_id, key
            HAVING COUNT(*) > 1
        ) duplicates;


        IF v_duplicate_count > 0 THEN
            RAISE EXCEPTION
                'Migration aborted: hotel_store contains % duplicate (business_id,key) groups. No rows were deleted.',
                v_duplicate_count;
        END IF;


        -- Remove only our specific FK
        ALTER TABLE public.hotel_store
            DROP CONSTRAINT IF EXISTS hotel_store_business_id_fkey;


        ALTER TABLE public.hotel_store
            ADD CONSTRAINT hotel_store_business_id_fkey
            FOREIGN KEY (business_id)
            REFERENCES public.businesses(id)
            ON DELETE RESTRICT;


        -- Remove existing PK only after duplicate validation
        ALTER TABLE public.hotel_store
            DROP CONSTRAINT IF EXISTS hotel_store_pkey;


        ALTER TABLE public.hotel_store
            ADD CONSTRAINT hotel_store_pkey
            PRIMARY KEY (business_id, key);


        CREATE INDEX IF NOT EXISTS idx_hotel_store_business_id
            ON public.hotel_store(business_id);


        ALTER TABLE public.hotel_store
            ENABLE ROW LEVEL SECURITY;


        -- Remove unsafe known policies
        DROP POLICY IF EXISTS "Allow public access" ON public.hotel_store;
        DROP POLICY IF EXISTS "Allow public access to hotel_store" ON public.hotel_store;
        DROP POLICY IF EXISTS "Hotel store sync policy" ON public.hotel_store;
        DROP POLICY IF EXISTS "Tenant isolation for hotel_store" ON public.hotel_store;


        -- Strict policy
        CREATE POLICY "Tenant isolation for hotel_store"
        ON public.hotel_store
        FOR ALL
        TO authenticated
        USING (
            public.is_super_admin()
            OR business_id = public.get_auth_business_id_raw()
        )
        WITH CHECK (
            public.is_super_admin()
            OR business_id = public.get_auth_business_id_raw()
        );

    END IF;

END $$;


-- ============================================================================
-- 6. AUDIT LOGS
-- ============================================================================

DO $$
DECLARE
    v_business_id UUID;
BEGIN

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND table_type = 'BASE TABLE'
    ) THEN

        SELECT id
        INTO v_business_id
        FROM public.businesses
        WHERE name ILIKE '%SEVEN TO SEVEN%'
           OR name ILIKE '%Sky View%'
        LIMIT 1;


        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'audit_logs'
              AND column_name = 'business_id'
        ) THEN

            ALTER TABLE public.audit_logs
                ADD COLUMN business_id UUID;

        END IF;


        UPDATE public.audit_logs
        SET business_id = v_business_id
        WHERE business_id IS NULL;


        ALTER TABLE public.audit_logs
            DROP CONSTRAINT IF EXISTS audit_logs_business_id_fkey;


        ALTER TABLE public.audit_logs
            ADD CONSTRAINT audit_logs_business_id_fkey
            FOREIGN KEY (business_id)
            REFERENCES public.businesses(id)
            ON DELETE RESTRICT;


        CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id
            ON public.audit_logs(business_id);


        ALTER TABLE public.audit_logs
            ENABLE ROW LEVEL SECURITY;


        DROP POLICY IF EXISTS "Allow auth users insert logs"
            ON public.audit_logs;

        DROP POLICY IF EXISTS "Audit Logs Select"
            ON public.audit_logs;

        DROP POLICY IF EXISTS "Users can view own audit logs"
            ON public.audit_logs;

        DROP POLICY IF EXISTS "Audit logs select policy"
            ON public.audit_logs;

        DROP POLICY IF EXISTS "Audit logs insert policy"
            ON public.audit_logs;

        DROP POLICY IF EXISTS "Audit logs update policy"
            ON public.audit_logs;

        DROP POLICY IF EXISTS "Audit logs delete policy"
            ON public.audit_logs;


        CREATE POLICY "Audit logs select policy"
        ON public.audit_logs
        FOR SELECT
        TO authenticated
        USING (
            public.is_super_admin()
            OR business_id = public.get_auth_business_id_raw()
        );


        CREATE POLICY "Audit logs insert policy"
        ON public.audit_logs
        FOR INSERT
        TO authenticated
        WITH CHECK (
            public.is_super_admin()
            OR (
                business_id = public.get_auth_business_id_raw()
                AND (
                    user_id IS NULL
                    OR user_id = auth.uid()
                )
            )
        );


        CREATE POLICY "Audit logs update policy"
        ON public.audit_logs
        FOR UPDATE
        TO authenticated
        USING (public.is_super_admin())
        WITH CHECK (public.is_super_admin());


        CREATE POLICY "Audit logs delete policy"
        ON public.audit_logs
        FOR DELETE
        TO authenticated
        USING (public.is_super_admin());

    ELSE

        RAISE NOTICE
            'audit_logs does not exist. Skipping audit_logs migration.';

    END IF;

END $$;


-- ============================================================================
-- 7. OPERATIONAL TABLES
-- ============================================================================

DO $$
DECLARE
    v_business_id UUID;
    v_table TEXT;
    v_null_count BIGINT;

    v_tables TEXT[] := ARRAY[
        'menu_items',
        'ingredients',
        'recipes',
        'categories',
        'inventory_items',
        'stock_movements',
        'orders',
        'order_items',
        'sales',
        'sale_items',
        'expenses',
        'purchase_orders',
        'purchase_order_items',
        'cash_movements',
        'shifts',
        'daily_closings',
        'tables',
        'kitchen_tickets',
        'guest_rooms',
        'room_bookings',
        'waiters',
        'staff',
        'employees',
        'payroll_records',
        'waste_records',
        'notifications',
        'suppliers',
        'users'
    ];

BEGIN

    SELECT id
    INTO v_business_id
    FROM public.businesses
    WHERE name ILIKE '%SEVEN TO SEVEN%'
       OR name ILIKE '%Sky View%'
    LIMIT 1;


    FOREACH v_table IN ARRAY v_tables
    LOOP

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = v_table
              AND table_type = 'BASE TABLE'
        ) THEN

            -- Add business_id only if missing
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = v_table
                  AND column_name = 'business_id'
            ) THEN

                EXECUTE format(
                    'ALTER TABLE public.%I ADD COLUMN business_id UUID',
                    v_table
                );

            END IF;


            -- Backfill NULL only
            EXECUTE format(
                'UPDATE public.%I
                 SET business_id = $1
                 WHERE business_id IS NULL',
                v_table
            )
            USING v_business_id;


            EXECUTE format(
                'SELECT COUNT(*)
                 FROM public.%I
                 WHERE business_id IS NULL',
                v_table
            )
            INTO v_null_count;


            IF v_null_count > 0 THEN

                RAISE EXCEPTION
                    'Migration aborted: % contains % rows without business_id.',
                    v_table,
                    v_null_count;

            END IF;


            -- Existing default must not override tenant assignment
            EXECUTE format(
                'ALTER TABLE public.%I
                 ALTER COLUMN business_id DROP DEFAULT',
                v_table
            );


            EXECUTE format(
                'ALTER TABLE public.%I
                 ALTER COLUMN business_id SET NOT NULL',
                v_table
            );


            -- Specific FK only
            EXECUTE format(
                'ALTER TABLE public.%I
                 DROP CONSTRAINT IF EXISTS %I',
                v_table,
                v_table || '_business_id_fkey'
            );


            EXECUTE format(
                'ALTER TABLE public.%I
                 ADD CONSTRAINT %I
                 FOREIGN KEY (business_id)
                 REFERENCES public.businesses(id)
                 ON DELETE RESTRICT',
                v_table,
                v_table || '_business_id_fkey'
            );


            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I
                 ON public.%I(business_id)',
                'idx_' || v_table || '_business_id',
                v_table
            );


            EXECUTE format(
                'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
                v_table
            );


            -- Remove known unsafe legacy policies
            EXECUTE format(
                'DROP POLICY IF EXISTS "Allow all for authenticated"
                 ON public.%I',
                v_table
            );

            EXECUTE format(
                'DROP POLICY IF EXISTS "Public access"
                 ON public.%I',
                v_table
            );

            EXECUTE format(
                'DROP POLICY IF EXISTS "Allow public access"
                 ON public.%I',
                v_table
            );

            EXECUTE format(
                'DROP POLICY IF EXISTS "Tenant isolation"
                 ON public.%I',
                v_table
            );


            -- Remove policies created by this migration if rerunning
            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON public.%I',
                v_table || '_tenant_select_policy',
                v_table
            );

            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON public.%I',
                v_table || '_tenant_insert_policy',
                v_table
            );

            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON public.%I',
                v_table || '_tenant_update_policy',
                v_table
            );

            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON public.%I',
                v_table || '_tenant_delete_policy',
                v_table
            );


            EXECUTE format(
                'CREATE POLICY %I
                 ON public.%I
                 FOR SELECT
                 TO authenticated
                 USING (
                     public.is_super_admin()
                     OR business_id = public.get_auth_business_id_raw()
                 )',
                v_table || '_tenant_select_policy',
                v_table
            );


            EXECUTE format(
                'CREATE POLICY %I
                 ON public.%I
                 FOR INSERT
                 TO authenticated
                 WITH CHECK (
                     public.is_super_admin()
                     OR business_id = public.get_auth_business_id_raw()
                 )',
                v_table || '_tenant_insert_policy',
                v_table
            );


            EXECUTE format(
                'CREATE POLICY %I
                 ON public.%I
                 FOR UPDATE
                 TO authenticated
                 USING (
                     public.is_super_admin()
                     OR business_id = public.get_auth_business_id_raw()
                 )
                 WITH CHECK (
                     public.is_super_admin()
                     OR business_id = public.get_auth_business_id_raw()
                 )',
                v_table || '_tenant_update_policy',
                v_table
            );


            EXECUTE format(
                'CREATE POLICY %I
                 ON public.%I
                 FOR DELETE
                 TO authenticated
                 USING (
                     public.is_super_admin()
                     OR business_id = public.get_auth_business_id_raw()
                 )',
                v_table || '_tenant_delete_policy',
                v_table
            );

        END IF;

    END LOOP;

END $$;


-- ============================================================================
-- 8. PROFILES SECURITY
-- ============================================================================

ALTER TABLE public.profiles
    ENABLE ROW LEVEL SECURITY;


-- Remove unsafe legacy policies
DROP POLICY IF EXISTS "Allow auth users read profiles"
    ON public.profiles;

DROP POLICY IF EXISTS "Allow auth users update own profile"
    ON public.profiles;

DROP POLICY IF EXISTS "Profiles Select"
    ON public.profiles;

DROP POLICY IF EXISTS "Users can view own profile"
    ON public.profiles;

DROP POLICY IF EXISTS "Users can update own profile"
    ON public.profiles;

DROP POLICY IF EXISTS "Users can view own profile"
    ON public.profiles;

DROP POLICY IF EXISTS "Super Admin Update Profiles"
    ON public.profiles;

DROP POLICY IF EXISTS "Profiles tenant select"
    ON public.profiles;

DROP POLICY IF EXISTS "Profiles secure update"
    ON public.profiles;

DROP POLICY IF EXISTS "Profiles insert policy"
    ON public.profiles;


-- SELECT
CREATE POLICY "Profiles tenant select"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    public.is_super_admin()
    OR id = auth.uid()
);


-- UPDATE
CREATE POLICY "Profiles secure update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    public.is_super_admin()
    OR id = auth.uid()
)
WITH CHECK (
    public.is_super_admin()
    OR (
        id = auth.uid()
        AND business_id IS NOT DISTINCT FROM public.get_auth_business_id_raw()
        AND COALESCE(is_super_admin, FALSE) = FALSE
        AND role <> 'Super Admin'
    )
);


-- ============================================================================
-- 9. PRIVILEGE ESCALATION PROTECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

    -- Super Admin may manage privileged fields
    IF public.is_super_admin() THEN
        RETURN NEW;
    END IF;


    IF NEW.role = 'Super Admin'
       AND COALESCE(OLD.role, '') <> 'Super Admin'
    THEN
        RAISE EXCEPTION
            'Privilege escalation rejected: Super Admin role cannot be self-assigned.';
    END IF;


    IF COALESCE(NEW.is_super_admin, FALSE) = TRUE
       AND COALESCE(OLD.is_super_admin, FALSE) = FALSE
    THEN
        RAISE EXCEPTION
            'Privilege escalation rejected: is_super_admin cannot be self-enabled.';
    END IF;


    IF OLD.business_id IS NOT NULL
       AND NEW.business_id IS DISTINCT FROM OLD.business_id
    THEN
        RAISE EXCEPTION
            'Tenant violation: business_id cannot be changed by a normal user.';
    END IF;


    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation
ON public.profiles;


CREATE TRIGGER trg_prevent_privilege_escalation
BEFORE UPDATE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_privilege_escalation();


-- ============================================================================
-- 10. BUSINESSES SECURITY
-- ============================================================================

ALTER TABLE public.businesses
    ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Allow auth users access businesses"
    ON public.businesses;

DROP POLICY IF EXISTS "Businesses Select"
    ON public.businesses;

DROP POLICY IF EXISTS "Users can view own business"
    ON public.businesses;

DROP POLICY IF EXISTS "Super Admin Update Businesses"
    ON public.businesses;

DROP POLICY IF EXISTS "Businesses insert policy"
    ON public.businesses;

DROP POLICY IF EXISTS "Businesses update policy"
    ON public.businesses;

DROP POLICY IF EXISTS "Businesses delete policy"
    ON public.businesses;

DROP POLICY IF EXISTS "Allow public access on businesses"
    ON public.businesses;

DROP POLICY IF EXISTS "Businesses select policy"
    ON public.businesses;


-- SELECT
CREATE POLICY "Businesses select policy"
ON public.businesses
FOR SELECT
TO authenticated
USING (
    public.is_super_admin()
    OR id = public.get_auth_business_id_raw()
);


-- INSERT
--
-- Registration-compatible:
-- The authenticated user may create a PENDING_PAYMENT business
-- belonging to the email of the currently authenticated user.
--
CREATE POLICY "Businesses registration insert"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (
    owner_email = (
        SELECT email
        FROM auth.users
        WHERE id = auth.uid()
    )
    AND status = 'PENDING_PAYMENT'
);


-- UPDATE
CREATE POLICY "Businesses update policy"
ON public.businesses
FOR UPDATE
TO authenticated
USING (
    public.is_super_admin()
)
WITH CHECK (
    public.is_super_admin()
);


-- DELETE
CREATE POLICY "Businesses delete policy"
ON public.businesses
FOR DELETE
TO authenticated
USING (
    public.is_super_admin()
);


-- ============================================================================
-- 11. PROFILE INSERT / REGISTRATION
-- ============================================================================

DROP POLICY IF EXISTS "Profiles registration insert"
    ON public.profiles;


CREATE POLICY "Profiles registration insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
    AND COALESCE(is_super_admin, FALSE) = FALSE
    AND role <> 'Super Admin'
    AND business_id IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM public.businesses b
        WHERE b.id = business_id
          AND b.owner_email = (
              SELECT email
              FROM auth.users
              WHERE id = auth.uid()
          )
          AND b.status = 'PENDING_PAYMENT'
    )
);


-- ============================================================================
-- 12. SUBSCRIPTIONS
-- ============================================================================

DO $$
BEGIN

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'subscriptions'
          AND table_type = 'BASE TABLE'
    ) THEN

        ALTER TABLE public.subscriptions
            ENABLE ROW LEVEL SECURITY;


        DROP POLICY IF EXISTS "Allow auth users access subscriptions"
            ON public.subscriptions;

        DROP POLICY IF EXISTS "Subscriptions Select"
            ON public.subscriptions;

        DROP POLICY IF EXISTS "Users can view own subscription"
            ON public.subscriptions;

        DROP POLICY IF EXISTS "Subscriptions insert policy"
            ON public.subscriptions;

        DROP POLICY IF EXISTS "Subscriptions update policy"
            ON public.subscriptions;

        DROP POLICY IF EXISTS "Subscriptions delete policy"
            ON public.subscriptions;

        DROP POLICY IF EXISTS "Subscriptions select policy"
            ON public.subscriptions;


        CREATE POLICY "Subscriptions select policy"
        ON public.subscriptions
        FOR SELECT
        TO authenticated
        USING (
            public.is_super_admin()
            OR business_id = public.get_auth_business_id_raw()
        );


        CREATE POLICY "Subscriptions insert policy"
        ON public.subscriptions
        FOR INSERT
        TO authenticated
        WITH CHECK (
            public.is_super_admin()
            OR (
                business_id = public.get_auth_business_id_raw()
                AND status = 'PENDING_PAYMENT'
            )
        );


        CREATE POLICY "Subscriptions update policy"
        ON public.subscriptions
        FOR UPDATE
        TO authenticated
        USING (
            public.is_super_admin()
        )
        WITH CHECK (
            public.is_super_admin()
        );


        CREATE POLICY "Subscriptions delete policy"
        ON public.subscriptions
        FOR DELETE
        TO authenticated
        USING (
            public.is_super_admin()
        );

    ELSE

        RAISE NOTICE
            'subscriptions table does not exist. Skipping.';

    END IF;

END $$;


-- ============================================================================
-- 13. PAYMENTS
-- ============================================================================

DO $$
BEGIN

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'payments'
          AND table_type = 'BASE TABLE'
    ) THEN

        ALTER TABLE public.payments
            ENABLE ROW LEVEL SECURITY;


        DROP POLICY IF EXISTS "Payments Select"
            ON public.payments;

        DROP POLICY IF EXISTS "Users can view own payments"
            ON public.payments;

        DROP POLICY IF EXISTS "Super Admin Update Payments"
            ON public.payments;

        DROP POLICY IF EXISTS "Payments insert policy"
            ON public.payments;

        DROP POLICY IF EXISTS "Payments update policy"
            ON public.payments;

        DROP POLICY IF EXISTS "Payments delete policy"
            ON public.payments;

        DROP POLICY IF EXISTS "Payments select policy"
            ON public.payments;


        CREATE POLICY "Payments select policy"
        ON public.payments
        FOR SELECT
        TO authenticated
        USING (
            public.is_super_admin()
            OR business_id = public.get_auth_business_id_raw()
        );


        CREATE POLICY "Payments insert policy"
        ON public.payments
        FOR INSERT
        TO authenticated
        WITH CHECK (
            public.is_super_admin()
            OR business_id = public.get_auth_business_id_raw()
        );


        CREATE POLICY "Payments update policy"
        ON public.payments
        FOR UPDATE
        TO authenticated
        USING (
            public.is_super_admin()
        )
        WITH CHECK (
            public.is_super_admin()
        );


        CREATE POLICY "Payments delete policy"
        ON public.payments
        FOR DELETE
        TO authenticated
        USING (
            public.is_super_admin()
        );

    ELSE

        RAISE NOTICE
            'payments table does not exist. Skipping.';

    END IF;

END $$;


-- ============================================================================
-- 14. SYSTEM SETTINGS
-- ============================================================================

DO $$
BEGIN

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'system_settings'
          AND table_type = 'BASE TABLE'
    ) THEN

        ALTER TABLE public.system_settings
            ENABLE ROW LEVEL SECURITY;


        DROP POLICY IF EXISTS "System settings select policy"
            ON public.system_settings;

        DROP POLICY IF EXISTS "System settings manage policy"
            ON public.system_settings;


        CREATE POLICY "System settings select policy"
        ON public.system_settings
        FOR SELECT
        TO authenticated
        USING (
            public.is_super_admin()
        );


        CREATE POLICY "System settings manage policy"
        ON public.system_settings
        FOR ALL
        TO authenticated
        USING (
            public.is_super_admin()
        )
        WITH CHECK (
            public.is_super_admin()
        );

    END IF;

END $$;


-- ============================================================================
-- 15. FINAL VALIDATION
-- ============================================================================

DO $$
DECLARE
    v_business_id UUID;
    v_business_count INTEGER;
    v_null_count BIGINT;
BEGIN

    SELECT COUNT(*)
    INTO v_business_count
    FROM public.businesses
    WHERE name ILIKE '%SEVEN TO SEVEN%'
       OR name ILIKE '%Sky View%';


    IF v_business_count <> 1 THEN
        RAISE EXCEPTION
            'Final validation failed: expected exactly one target business, found %.',
            v_business_count;
    END IF;


    SELECT id
    INTO v_business_id
    FROM public.businesses
    WHERE name ILIKE '%SEVEN TO SEVEN%'
       OR name ILIKE '%Sky View%'
    LIMIT 1;


    -- hotel_store
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'hotel_store'
    ) THEN

        SELECT COUNT(*)
        INTO v_null_count
        FROM public.hotel_store
        WHERE business_id IS NULL;


        IF v_null_count > 0 THEN
            RAISE EXCEPTION
                'Final validation failed: hotel_store has % NULL business_id rows.',
                v_null_count;
        END IF;

    END IF;


    -- audit_logs
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
    ) THEN

        SELECT COUNT(*)
        INTO v_null_count
        FROM public.audit_logs
        WHERE business_id IS NULL;


        IF v_null_count > 0 THEN
            RAISE EXCEPTION
                'Final validation failed: audit_logs has % NULL business_id rows.',
                v_null_count;
        END IF;

    END IF;


    -- Verify helper functions
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'is_super_admin'
          AND pronamespace = 'public'::regnamespace
    ) THEN

        RAISE EXCEPTION
            'Final validation failed: is_super_admin() is missing.';

    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'get_auth_business_id_raw'
          AND pronamespace = 'public'::regnamespace
    ) THEN

        RAISE EXCEPTION
            'Final validation failed: get_auth_business_id_raw() is missing.';

    END IF;


    RAISE NOTICE
        '============================================================';

    RAISE NOTICE
        'PRODUCTION MULTI-TENANT MIGRATION VALIDATION PASSED';

    RAISE NOTICE
        'Target Business UUID: %',
        v_business_id;

    RAISE NOTICE
        '============================================================';

END $$;


-- ============================================================================
-- 16. COMMIT
-- ============================================================================

COMMIT;


-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- Run after successful COMMIT
-- ============================================================================


-- Target business
SELECT
    id AS business_uuid,
    name,
    type,
    owner_name,
    owner_email,
    owner_phone,
    currency,
    status,
    created_at
FROM public.businesses
WHERE name ILIKE '%SEVEN TO SEVEN%'
   OR name ILIKE '%Sky View%';


-- Hotel store structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hotel_store'
ORDER BY ordinal_position;


-- Hotel store primary key
SELECT
    tc.constraint_name,
    kcu.ordinal_position,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'hotel_store'
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY kcu.ordinal_position;


-- Hotel store data validation
SELECT
    COUNT(*) AS total_rows,
    COUNT(DISTINCT key) AS distinct_keys,
    COUNT(*) - COUNT(DISTINCT key) AS duplicate_key_difference,
    COUNT(*) FILTER (
        WHERE business_id IS NULL
    ) AS null_business_ids
FROM public.hotel_store;


-- Audit logs structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
ORDER BY ordinal_position;


-- Profiles
SELECT
    id,
    full_name,
    email,
    role,
    business_id,
    status,
    access_status,
    payment_status,
    is_super_admin
FROM public.profiles
ORDER BY created_at DESC;


-- Subscriptions
SELECT
    id,
    business_id,
    plan,
    monthly_fee,
    price_per_month,
    currency,
    status,
    payment_method,
    activated_at,
    expires_at
FROM public.subscriptions
ORDER BY created_at DESC;


-- Payments
SELECT
    id,
    business_id,
    subscription_id,
    amount,
    currency,
    payment_method,
    transaction_reference,
    status,
    paid_at,
    created_at
FROM public.payments
ORDER BY created_at DESC;


-- RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- RLS status
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;