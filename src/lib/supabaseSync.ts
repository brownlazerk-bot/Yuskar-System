import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { notifyDataChange } from './syncEngine';
import { mergeArraysByKey } from './serverSync';
import { 
  supabase as globalSupabaseClient, 
  getResolvedSupabaseConfig, 
  isSupabaseConfigured, 
  normalizeSupabaseUrl, 
  validateSupabaseConfig 
} from './supabase';
import { getActiveBusinessId, getScopedKey, saveToSupabaseStore } from './storage';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

const CONFIG_KEY = 'hotel_supabase_config';

const LOCAL_KEY_MAP: Record<string, string> = {
  menuItems: 'hotel_menu_items_prod',
  tables: 'hotel_tables_prod',
  waiters: 'hotel_waiters_prod',
  orders: 'hotel_orders_prod',
  kitchenTickets: 'hotel_kitchen_tickets_prod',
  stockLogs: 'hotel_stock_logs_prod',
  shifts: 'hotel_shifts_prod',
  currentShift: 'hotel_current_shift_prod',
  guestRooms: 'hotel_guest_rooms_prod',
  users: 'hotel_users_prod',
  auditLogs: 'hotel_audit_logs_prod',
  expenses: 'hotel_expenses_prod',
  cashMovements: 'hotel_cash_movements_prod',
  dailyClosings: 'hotel_daily_closings_prod',
  purchaseOrders: 'hotel_purchase_orders_prod',
  ingredients: 'hotel_kitchen_ingredients_prod',
  recipes: 'hotel_recipes_prod',
  stockMovements: 'hotel_stock_movement_records_prod',
  wasteRecords: 'hotel_kitchen_waste_records_prod',
  categories: 'hotel_categories_prod',
  inventoryItems: 'hotel_inventory_items_prod',
  businesses: 'hotel_businesses_prod'
};

export function getSupabaseConfig(): SupabaseConfig {
  const resolved = getResolvedSupabaseConfig();
  return {
    url: resolved.url,
    anonKey: resolved.anonKey,
    enabled: resolved.isConfigured
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  const normalized = normalizeSupabaseUrl(config.url) || config.url.trim();
  const cleanKey = (config.anonKey || '').trim();
  
  localStorage.setItem(CONFIG_KEY, JSON.stringify({
    url: normalized,
    anonKey: cleanKey,
    enabled: config.enabled
  }));
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return globalSupabaseClient;
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  const validation = validateSupabaseConfig(url, anonKey);
  if (!validation.valid) {
    return { success: false, message: validation.error || 'Invalid Supabase Configuration.' };
  }

  try {
    const testClient = createClient(validation.normalizedUrl, validation.cleanKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Attempt a light ping request to check connection
    const { error } = await testClient.from('hotel_store').select('key').limit(1);
    
    if (error) {
      // If table hotel_store doesn't exist yet
      if (error.code === 'PGRST301' || error.message?.includes('relation "public.hotel_store" does not exist') || error.code === '42P01') {
        return { 
          success: true, 
          message: 'Supabase connected successfully! Note: Table "hotel_store" is not created yet. Run the SQL schema to enable multi-device sync.' 
        };
      }
      
      // Permission or auth error
      if (error.code === 'PGRST301' || error.message?.toLowerCase().includes('jwt') || error.message?.toLowerCase().includes('apikey') || error.code === 'PGRST300') {
        return { success: false, message: `Authentication Error: ${error.message}. Please verify your Anon API Key.` };
      }

      // RLS or other database error
      if (error.code?.startsWith('42') || error.message?.includes('permission')) {
        return { success: false, message: `Permission/RLS Notice: ${error.message}` };
      }

      return { success: true, message: `Connected to Supabase! (${error.message})` };
    }

    return { success: true, message: 'Connected to Supabase successfully! Ready for real-time multi-device sync.' };
  } catch (err: any) {
    if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
      return { success: false, message: `Network error: Could not reach Supabase endpoint at ${validation.normalizedUrl}. Check your internet connection.` };
    }
    return { success: false, message: err?.message || 'Failed to connect to Supabase.' };
  }
}

/**
  * SQL snippet to create hotel_store table in Supabase SQL editor:
  * 
  * CREATE TABLE IF NOT EXISTS public.hotel_store (
  *   key TEXT PRIMARY KEY,
  *   data JSONB NOT NULL,
  *   updated_at TIMESTAMPTZ DEFAULT NOW()
  * );
  * ALTER TABLE public.hotel_store ENABLE ROW LEVEL SECURITY;
  * CREATE POLICY "Allow public select/insert/update/delete" ON public.hotel_store FOR ALL USING (true) WITH CHECK (true);
  */
export const SUPABASE_SQL_SCHEMA = `
-- =========================================================================
-- COMPLETE COMPATIBLE SUPABASE SQL SCHEMA FOR YUSKAR MANAGEMENT SYSTEM
-- Compatible with all ID types (Text slugs & UUIDs) without FK conflicts
-- =========================================================================

-- 1. BUSINESSES TABLE (Multi-Tenant Business Registry)
CREATE TABLE IF NOT EXISTS public.businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  category TEXT DEFAULT 'Bar & Restaurant',
  type TEXT DEFAULT 'Bar & Restaurant',
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  logo_url TEXT,
  momo_payment_number TEXT DEFAULT '0726134041',
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'PENDING_PAYMENT',
  subscription_id TEXT,
  bonus_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure id column is TEXT even if table was previously created with UUID
DO $$ 
BEGIN
  ALTER TABLE public.businesses ALTER COLUMN id TYPE TEXT;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. PROFILES TABLE (Linked with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'Manager',
  status TEXT DEFAULT 'Active',
  access_status TEXT DEFAULT 'Approved',
  payment_status TEXT DEFAULT 'Paid',
  pin_code TEXT DEFAULT '1234',
  is_super_admin BOOLEAN DEFAULT FALSE,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SUBSCRIPTIONS TABLE (SaaS License Tracking)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  plan_name TEXT DEFAULT 'Monthly SaaS Business License',
  plan TEXT DEFAULT 'MONTHLY_STANDARD',
  monthly_fee NUMERIC DEFAULT 100000,
  price_per_month NUMERIC DEFAULT 100000,
  amount NUMERIC DEFAULT 100000,
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'PENDING_PAYMENT',
  start_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  grace_period_days INTEGER DEFAULT 7,
  grace_expires_at TIMESTAMPTZ,
  payment_method TEXT DEFAULT 'MTN_MOMO',
  momo_number TEXT DEFAULT '0726134041',
  last_payment_date TIMESTAMPTZ,
  last_payment_reference TEXT,
  last_payment_amount NUMERIC,
  transaction_reference TEXT,
  next_payment_amount NUMERIC DEFAULT 100000,
  bonus_days_granted INTEGER DEFAULT 0,
  bonus_reason TEXT,
  is_bonus_active BOOLEAN DEFAULT FALSE,
  auto_renew BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBSCRIPTION LICENSES TABLE (Activation Keys)
CREATE TABLE IF NOT EXISTS public.subscription_licenses (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  business_name TEXT,
  subscription_id TEXT,
  license_code TEXT NOT NULL UNIQUE,
  license_hash TEXT NOT NULL,
  plan TEXT DEFAULT 'MONTHLY',
  duration_days INTEGER DEFAULT 30,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'ACTIVE',
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'Super Admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SUBSCRIPTION PAYMENTS TABLE (MoMo/Cash History)
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  subscription_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT DEFAULT 'MTN_MOMO',
  payer_phone TEXT,
  recipient_phone TEXT DEFAULT '0726134041',
  payment_reference TEXT,
  transaction_reference TEXT,
  status TEXT DEFAULT 'SUCCESSFUL',
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by TEXT DEFAULT 'MTN MoMo Gateway',
  duration_months INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. HOTEL STORE (Multi-Tenant Key-Value Store for All Operational Data)
CREATE TABLE IF NOT EXISTS public.hotel_store (
  business_id TEXT NOT NULL,
  key TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (business_id, key)
);

-- 7. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  user_id TEXT,
  user_name TEXT,
  user_role TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  category TEXT,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT
);

-- 8. INGREDIENTS TABLE (Kitchen & Bar Inventory)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT,
  stock_quantity NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'Kg',
  purchase_unit TEXT,
  recipe_unit TEXT,
  conversion_rate NUMERIC DEFAULT 1,
  cost_per_unit NUMERIC DEFAULT 0,
  average_cost NUMERIC DEFAULT 0,
  min_stock_alert NUMERIC DEFAULT 5,
  supplier TEXT,
  expiry_date TEXT,
  batch_number TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Available',
  last_restocked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. RECIPES TABLE (Automated Bill of Materials & Stock Deduction)
CREATE TABLE IF NOT EXISTS public.recipes (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  code TEXT,
  name TEXT NOT NULL,
  linked_menu_item_id TEXT,
  linked_menu_item_name TEXT,
  instructions TEXT,
  yield_servings NUMERIC DEFAULT 1,
  ingredients JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Active',
  version NUMERIC DEFAULT 1,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- 10. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  code TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 18,
  kitchen_department TEXT,
  stock_quantity NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'Serving',
  status TEXT DEFAULT 'Available',
  is_food BOOLEAN DEFAULT FALSE,
  image TEXT,
  description TEXT,
  has_recipe BOOLEAN DEFAULT FALSE,
  recipe JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. STOCK MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  ingredient_id TEXT,
  ingredient_name TEXT,
  movement_type TEXT,
  quantity_in NUMERIC DEFAULT 0,
  quantity_out NUMERIC DEFAULT 0,
  remaining_balance NUMERIC DEFAULT 0,
  unit TEXT,
  cost NUMERIC DEFAULT 0,
  reference_number TEXT,
  recipe_id TEXT,
  menu_item_id TEXT,
  menu_item_name TEXT,
  user_name TEXT,
  department TEXT,
  reason TEXT,
  date TEXT,
  time TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 12. AUTOMATIC PROFILE TRIGGER ON SUPABASE AUTH SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    business_id,
    full_name,
    email,
    phone,
    role,
    status,
    access_status,
    payment_status,
    is_super_admin,
    created_at,
    last_login_at
  ) VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'business_id',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'Manager'),
    'Active',
    'Approved',
    'Paid',
    (NEW.raw_user_meta_data->>'role' = 'Super Admin' OR NEW.raw_user_meta_data->>'is_super_admin' = 'true'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    business_id = COALESCE(EXCLUDED.business_id, profiles.business_id),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = COALESCE(EXCLUDED.role, profiles.role),
    last_login_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. ENABLE ROW LEVEL SECURITY WITH SECURE MULTI-TENANT POLICIES
-- Helper function to verify business membership based on authenticated user's profile
CREATE OR REPLACE FUNCTION public.is_business_member(target_biz_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.business_id = target_biz_id
        OR p.business_id::text = target_biz_id::text
        OR p.is_super_admin = true
        OR p.role = 'Super Admin'
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- A. HOTEL STORE RLS POLICIES
ALTER TABLE public.hotel_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public & Auth Access HotelStore" ON public.hotel_store;
DROP POLICY IF EXISTS "hotel_store_select_policy" ON public.hotel_store;
CREATE POLICY "hotel_store_select_policy"
  ON public.hotel_store
  FOR SELECT
  TO authenticated
  USING (
    public.is_business_member(business_id)
  );

DROP POLICY IF EXISTS "hotel_store_insert_policy" ON public.hotel_store;
CREATE POLICY "hotel_store_insert_policy"
  ON public.hotel_store
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_business_member(business_id)
  );

DROP POLICY IF EXISTS "hotel_store_update_policy" ON public.hotel_store;
CREATE POLICY "hotel_store_update_policy"
  ON public.hotel_store
  FOR UPDATE
  TO authenticated
  USING (
    public.is_business_member(business_id)
  )
  WITH CHECK (
    public.is_business_member(business_id)
  );

DROP POLICY IF EXISTS "hotel_store_delete_policy" ON public.hotel_store;
CREATE POLICY "hotel_store_delete_policy"
  ON public.hotel_store
  FOR DELETE
  TO authenticated
  USING (
    public.is_business_member(business_id)
  );

-- B. PROFILES TABLE RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public & Auth Access Profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_super_admin = true OR p.role = 'Super Admin'))
  );

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_super_admin = true OR p.role = 'Super Admin'))
  );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_super_admin = true OR p.role = 'Super Admin'))
  )
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_super_admin = true OR p.role = 'Super Admin'))
  );

-- C. BUSINESSES TABLE RLS POLICIES
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public & Auth Access Businesses" ON public.businesses;
DROP POLICY IF EXISTS "businesses_select_policy" ON public.businesses;
CREATE POLICY "businesses_select_policy"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    id::text IN (SELECT p.business_id::text FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_super_admin = true OR p.role = 'Super Admin'))
  );

DROP POLICY IF EXISTS "businesses_insert_policy" ON public.businesses;
CREATE POLICY "businesses_insert_policy"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_super_admin = true OR p.role = 'Super Admin'))
    OR auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "businesses_update_policy" ON public.businesses;
CREATE POLICY "businesses_update_policy"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING (
    id::text IN (SELECT p.business_id::text FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_super_admin = true OR p.role = 'Super Admin'))
  )
  WITH CHECK (
    id::text IN (SELECT p.business_id::text FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_super_admin = true OR p.role = 'Super Admin'))
  );

-- D. SUBSCRIPTIONS RLS POLICIES
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public & Auth Access Subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_access_policy" ON public.subscriptions;
CREATE POLICY "subscriptions_access_policy"
  ON public.subscriptions
  FOR ALL
  TO authenticated
  USING (
    public.is_business_member(business_id)
  )
  WITH CHECK (
    public.is_business_member(business_id)
  );
`.trim();

/**
 * Push all local entity state to Supabase with tenant scoping
 */
export async function pushAllToSupabase(targetBusinessId?: string): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client is not configured or disabled.' };
  }

  const activeBizId = targetBusinessId || getActiveBusinessId();
  if (!activeBizId) {
    return { success: false, message: 'No active business context for tenant synchronization.' };
  }

  try {
    const rowsToUpsert: { business_id: string; key: string; data: any; updated_at: string }[] = [];

    Object.entries(LOCAL_KEY_MAP).forEach(([serverKey, baseLocalKey]) => {
      const scopedKey = getScopedKey(baseLocalKey, activeBizId);
      const raw = localStorage.getItem(scopedKey) || localStorage.getItem(baseLocalKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          rowsToUpsert.push({
            business_id: activeBizId,
            key: serverKey,
            data: parsed,
            updated_at: new Date().toISOString()
          });
        } catch (e) {
          // ignore parsing error
        }
      }
    });

    if (rowsToUpsert.length === 0) {
      return { success: true, message: 'No local data to push.' };
    }

    const { error } = await client.from('hotel_store').upsert(rowsToUpsert, { onConflict: 'business_id,key' });

    if (error) {
      throw error;
    }

    return { success: true, message: 'All local data successfully synchronized to Supabase Cloud for active business!' };
  } catch (err: any) {
    console.warn('[Supabase Sync]', { operation: 'push', table: 'hotel_store', error: err?.message || err });
    return { success: false, message: err?.message || 'Error pushing to Supabase.' };
  }
}

/**
 * Pull all cloud state from Supabase into local storage for the active business
 */
export async function pullAllFromSupabase(targetBusinessId?: string): Promise<{ success: boolean; count: number; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, message: 'Supabase client is not configured.' };
  }

  const activeBizId = targetBusinessId || getActiveBusinessId();
  if (!activeBizId) {
    return { success: false, count: 0, message: 'No active business context for tenant synchronization.' };
  }

  try {
    const { data, error } = await client
      .from('hotel_store')
      .select('*')
      .eq('business_id', activeBizId);

    if (error) {
      console.warn('[Supabase Sync]', { operation: 'pull', table: 'hotel_store', error: error.message || error });
      return { success: false, count: 0, message: error.message || 'Error pulling from Supabase.' };
    }

    if (!data || data.length === 0) {
      return { success: true, count: 0, message: 'Supabase cloud store is empty for this business.' };
    }

    let updatedCount = 0;
    data.forEach((row: { business_id: string; key: string; data: any }) => {
      const baseLocalKey = LOCAL_KEY_MAP[row.key];
      if (baseLocalKey && row.data !== undefined) {
        const scopedKey = getScopedKey(baseLocalKey, activeBizId);
        const incomingStr = JSON.stringify(row.data);
        const currentScopedStr = localStorage.getItem(scopedKey);

        if (incomingStr !== currentScopedStr) {
          localStorage.setItem(scopedKey, incomingStr);
          localStorage.setItem(baseLocalKey, incomingStr);
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      notifyDataChange('all');
    }

    return { 
      success: true, 
      count: updatedCount, 
      message: `Successfully pulled ${updatedCount} updated datasets from Supabase Cloud.` 
    };
  } catch (err: any) {
    console.warn('[Supabase Sync]', { operation: 'pull', table: 'hotel_store', error: err?.message || err });
    return { success: false, count: 0, message: err?.message || 'Error pulling from Supabase.' };
  }
}

let consecutiveSyncErrors = 0;
const MAX_CONSECUTIVE_SYNC_ERRORS = 4;

/**
 * Start Supabase Background Polling (Every 4 seconds)
 */
export function startSupabaseSyncPolling(intervalMs: number = 4000): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  consecutiveSyncErrors = 0;

  // Initial pull
  pullAllFromSupabase().then((res) => {
    if (!res.success && res.message) {
      consecutiveSyncErrors++;
    } else {
      consecutiveSyncErrors = 0;
    }
  });

  const timer = setInterval(async () => {
    if (consecutiveSyncErrors >= MAX_CONSECUTIVE_SYNC_ERRORS) {
      // Pause polling if repeatedly failing to avoid spamming console/network
      return;
    }

    const res = await pullAllFromSupabase();
    if (!res.success && res.message) {
      consecutiveSyncErrors++;
      if (consecutiveSyncErrors >= MAX_CONSECUTIVE_SYNC_ERRORS) {
        console.warn(`[Supabase Sync] Background polling paused after ${MAX_CONSECUTIVE_SYNC_ERRORS} consecutive failures. Polling will resume on next manual sync or page refresh.`);
      }
    } else {
      consecutiveSyncErrors = 0;
    }
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
}

