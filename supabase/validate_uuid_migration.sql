-- ==============================================================================
-- POST-MIGRATION VALIDATION SUITE
-- PRODUCTION MULTI-TENANT / UUID NATIVE / RLS / SUPER ADMIN
-- ==============================================================================

-- ==============================================================================
-- 1. VERIFY CORE UUID STRUCTURE
-- ==============================================================================

SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
        (table_name = 'businesses' AND column_name = 'id')
        OR
        (table_name = 'profiles' AND column_name = 'business_id')
        OR
        (table_name = 'subscriptions' AND column_name = 'business_id')
        OR
        (table_name = 'payments' AND column_name = 'business_id')
        OR
        (table_name = 'audit_logs' AND column_name = 'business_id')
        OR
        (table_name = 'hotel_store' AND column_name = 'business_id')
      )
ORDER BY table_name, column_name;


-- ==============================================================================
-- 2. VERIFY TARGET BUSINESS
-- ==============================================================================

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


-- ==============================================================================
-- 3. VERIFY TARGET BUSINESS IS UNIQUE
-- ==============================================================================

SELECT
    COUNT(*) AS matching_businesses
FROM public.businesses
WHERE name ILIKE '%SEVEN TO SEVEN%'
   OR name ILIKE '%Sky View%';


-- ==============================================================================
-- 4. VERIFY HOTEL_STORE STRUCTURE
-- ==============================================================================

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hotel_store'
ORDER BY ordinal_position;


-- ==============================================================================
-- 5. VERIFY HOTEL_STORE BUSINESS_ID
-- ==============================================================================

SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (
        WHERE business_id IS NULL
    ) AS null_business_ids,
    COUNT(*) FILTER (
        WHERE business_id IS NOT NULL
    ) AS assigned_business_ids,
    COUNT(DISTINCT business_id) AS different_businesses
FROM public.hotel_store;


-- ==============================================================================
-- 6. VERIFY HOTEL_STORE PRIMARY KEY
-- MUST BE: (business_id, key)
-- ==============================================================================

SELECT
    tc.constraint_name,
    kcu.column_name,
    kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'hotel_store'
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY kcu.ordinal_position;


-- ==============================================================================
-- 7. VERIFY HOTEL_STORE FOREIGN KEY
-- ==============================================================================

SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.constraint_schema = rc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'hotel_store'
  AND tc.constraint_type = 'FOREIGN KEY';


-- ==============================================================================
-- 8. VERIFY AUDIT_LOGS
-- ==============================================================================

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
ORDER BY ordinal_position;


-- ==============================================================================
-- 9. VERIFY AUDIT_LOGS BUSINESS ISOLATION
-- ==============================================================================

SELECT
    COUNT(*) AS total_logs,
    COUNT(*) FILTER (
        WHERE business_id IS NULL
    ) AS null_business_ids,
    COUNT(DISTINCT business_id) AS different_businesses
FROM public.audit_logs;


-- ==============================================================================
-- 10. VERIFY BUSINESS_ID ON EXISTING OPERATIONAL TABLES
-- ==============================================================================

SELECT
    t.table_name,
    CASE
        WHEN c.column_name IS NULL THEN 'MISSING'
        ELSE 'PRESENT'
    END AS business_id_status,
    c.data_type,
    c.is_nullable
FROM (
    VALUES
        ('menu_items'),
        ('ingredients'),
        ('recipes'),
        ('categories'),
        ('inventory_items'),
        ('stock_movements'),
        ('orders'),
        ('order_items'),
        ('sales'),
        ('sale_items'),
        ('expenses'),
        ('purchase_orders'),
        ('purchase_order_items'),
        ('cash_movements'),
        ('shifts'),
        ('daily_closings'),
        ('tables'),
        ('kitchen_tickets'),
        ('guest_rooms'),
        ('room_bookings'),
        ('waiters'),
        ('staff'),
        ('employees'),
        ('payroll_records'),
        ('waste_records'),
        ('notifications'),
        ('suppliers'),
        ('users')
) AS t(table_name)
LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = t.table_name
   AND c.column_name = 'business_id'
ORDER BY t.table_name;


-- ==============================================================================
-- 11. VERIFY RLS STATUS
-- ==============================================================================

SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- ==============================================================================
-- 12. VERIFY CORE TABLE RLS
-- ==============================================================================

SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'businesses',
      'profiles',
      'subscriptions',
      'payments',
      'hotel_store',
      'audit_logs'
  )
ORDER BY tablename;


-- ==============================================================================
-- 13. VERIFY ALL POLICIES
-- ==============================================================================

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


-- ==============================================================================
-- 14. FIND DANGEROUS LEGACY POLICIES
-- THESE SHOULD RETURN ZERO ROWS AFTER MIGRATION
-- ==============================================================================

SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
       policyname IN (
           'Allow public access',
           'Allow auth users access businesses',
           'Allow auth users insert logs',
           'Allow auth users read profiles',
           'Allow auth users access subscriptions',
           'Users can view own business',
           'Users can view own payments',
           'Users can view own subscription',
           'Allow auth users update own profile',
           'Users can update own profile'
       )
       OR qual = 'true'
       OR with_check = 'true'
  )
ORDER BY tablename, policyname;


-- ==============================================================================
-- 15. VERIFY SECURITY FUNCTIONS
-- ==============================================================================

SELECT
    routine_schema,
    routine_name,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
      'is_super_admin',
      'get_auth_business_id_raw',
      'get_my_business_id',
      'prevent_privilege_escalation'
  )
ORDER BY routine_name;


-- ==============================================================================
-- 16. VERIFY PROFILE BUSINESS ASSIGNMENT
-- ==============================================================================

SELECT
    id,
    full_name,
    email,
    role,
    business_id,
    access_status,
    payment_status,
    is_super_admin,
    created_at
FROM public.profiles
ORDER BY created_at DESC;


-- ==============================================================================
-- 17. FIND NON-SUPER-ADMIN PROFILES WITHOUT BUSINESS
-- ==============================================================================

SELECT
    id,
    full_name,
    email,
    role,
    business_id,
    is_super_admin
FROM public.profiles
WHERE COALESCE(is_super_admin, FALSE) = FALSE
  AND business_id IS NULL
ORDER BY created_at DESC;


-- ==============================================================================
-- 18. VERIFY SUBSCRIPTIONS
-- ==============================================================================

SELECT
    id,
    business_id,
    plan,
    monthly_fee,
    price_per_month,
    currency,
    status,
    payment_method,
    momo_number,
    created_at,
    activated_at,
    expires_at
FROM public.subscriptions
ORDER BY created_at DESC;


-- ==============================================================================
-- 19. FIND INVALID SUBSCRIPTIONS
-- ==============================================================================

SELECT
    s.id,
    s.business_id,
    s.status,
    b.id AS matched_business_id,
    b.name AS business_name
FROM public.subscriptions s
LEFT JOIN public.businesses b
    ON b.id = s.business_id
WHERE b.id IS NULL;


-- ==============================================================================
-- 20. VERIFY PAYMENTS
-- ==============================================================================

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


-- ==============================================================================
-- 21. FIND INVALID PAYMENTS
-- ==============================================================================

SELECT
    p.id,
    p.business_id,
    p.subscription_id,
    p.amount,
    p.status
FROM public.payments p
LEFT JOIN public.businesses b
    ON b.id = p.business_id
WHERE b.id IS NULL;


-- ==============================================================================
-- 22. VERIFY ALL BUSINESS FOREIGN KEYS
-- ==============================================================================

SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.constraint_schema = rc.constraint_schema
WHERE tc.table_schema = 'public'
  AND kcu.column_name = 'business_id'
ORDER BY tc.table_name;


-- ==============================================================================
-- 23. FIND TABLES WITH BUSINESS_ID BUT WITHOUT RLS
-- ==============================================================================

SELECT
    c.table_name,
    c.column_name,
    pt.rowsecurity
FROM information_schema.columns c
JOIN pg_tables pt
    ON pt.schemaname = c.table_schema
   AND pt.tablename = c.table_name
WHERE c.table_schema = 'public'
  AND c.column_name = 'business_id'
  AND pt.rowsecurity = FALSE
ORDER BY c.table_name;


-- ==============================================================================
-- 24. FINAL SUMMARY
-- ==============================================================================

SELECT
    'BUSINESS COUNT' AS check_name,
    COUNT(*)::TEXT AS result
FROM public.businesses
WHERE name ILIKE '%SEVEN TO SEVEN%'
   OR name ILIKE '%Sky View%'

UNION ALL

SELECT
    'HOTEL_STORE TOTAL ROWS',
    COUNT(*)::TEXT
FROM public.hotel_store

UNION ALL

SELECT
    'HOTEL_STORE NULL BUSINESS_ID',
    COUNT(*)::TEXT
FROM public.hotel_store
WHERE business_id IS NULL

UNION ALL

SELECT
    'AUDIT_LOGS NULL BUSINESS_ID',
    COUNT(*)::TEXT
FROM public.audit_logs
WHERE business_id IS NULL

UNION ALL

SELECT
    'PROFILES WITHOUT BUSINESS',
    COUNT(*)::TEXT
FROM public.profiles
WHERE COALESCE(is_super_admin, FALSE) = FALSE
  AND business_id IS NULL;


-- ==============================================================================
-- END OF VALIDATION
-- ==============================================================================
