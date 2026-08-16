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
-- Business & Multi-Tenant Tables Schema for Supabase
CREATE TABLE IF NOT EXISTS public.businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  currency TEXT DEFAULT 'RWF',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  business_id TEXT DEFAULT 'biz_default',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'Cashier',
  status TEXT DEFAULT 'Active',
  password_hash TEXT,
  pin_code TEXT,
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ingredients (
  id TEXT PRIMARY KEY,
  business_id TEXT DEFAULT 'biz_default',
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

CREATE TABLE IF NOT EXISTS public.recipes (
  id TEXT PRIMARY KEY,
  business_id TEXT DEFAULT 'biz_default',
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

CREATE TABLE IF NOT EXISTS public.menu_items (
  id TEXT PRIMARY KEY,
  business_id TEXT DEFAULT 'biz_default',
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

CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  business_id TEXT DEFAULT 'biz_default',
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Menu',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id TEXT PRIMARY KEY,
  business_id TEXT DEFAULT 'biz_default',
  code TEXT,
  name TEXT NOT NULL,
  category TEXT,
  location TEXT,
  quantity NUMERIC DEFAULT 0,
  unit TEXT,
  reorder_level NUMERIC DEFAULT 10,
  cost_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT DEFAULT 'biz_default',
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

-- Store Backup Key-Value Store Table for Seamless Dynamic Sync
CREATE TABLE IF NOT EXISTS public.hotel_store (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) across all tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_store ENABLE ROW LEVEL SECURITY;

-- Note on RLS Security Architecture:
-- For production isolation, policy conditions can be scoped by business_id or authenticated user tokens.
DROP POLICY IF EXISTS "Business isolation policy for ingredients" ON public.ingredients;
CREATE POLICY "Business isolation policy for ingredients" ON public.ingredients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Business isolation policy for recipes" ON public.recipes;
CREATE POLICY "Business isolation policy for recipes" ON public.recipes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Business isolation policy for menu_items" ON public.menu_items;
CREATE POLICY "Business isolation policy for menu_items" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Business isolation policy for categories" ON public.categories;
CREATE POLICY "Business isolation policy for categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Business isolation policy for inventory_items" ON public.inventory_items;
CREATE POLICY "Business isolation policy for inventory_items" ON public.inventory_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Business isolation policy for stock_movements" ON public.stock_movements;
CREATE POLICY "Business isolation policy for stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access" ON public.hotel_store;
CREATE POLICY "Allow public access" ON public.hotel_store FOR ALL USING (true) WITH CHECK (true);
`.trim();

/**
 * Push all local entity state to Supabase
 */
export async function pushAllToSupabase(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client is not configured or disabled.' };
  }

  try {
    const rowsToUpsert: { key: string; data: any; updated_at: string }[] = [];

    Object.entries(LOCAL_KEY_MAP).forEach(([serverKey, localKey]) => {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          rowsToUpsert.push({
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

    const { error } = await client.from('hotel_store').upsert(rowsToUpsert, { onConflict: 'key' });

    if (error) {
      throw error;
    }

    return { success: true, message: 'All local data successfully synchronized to Supabase Cloud!' };
  } catch (err: any) {
    console.warn('[Supabase Sync]', { operation: 'push', table: 'hotel_store', error: err?.message || err });
    return { success: false, message: err?.message || 'Error pushing to Supabase.' };
  }
}

/**
 * Pull all cloud state from Supabase into local storage
 */
export async function pullAllFromSupabase(): Promise<{ success: boolean; count: number; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, message: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await client.from('hotel_store').select('*');

    if (error) {
      console.warn('[Supabase Sync]', { operation: 'pull', table: 'hotel_store', error: error.message || error });
      return { success: false, count: 0, message: error.message || 'Error pulling from Supabase.' };
    }

    if (!data || data.length === 0) {
      return { success: true, count: 0, message: 'Supabase cloud store is empty.' };
    }

    let updatedCount = 0;
    data.forEach((row: { key: string; data: any }) => {
      const localKey = LOCAL_KEY_MAP[row.key];
      if (localKey && row.data !== undefined) {
        const rawLocal = localStorage.getItem(localKey);
        let localData: any = null;
        try {
          if (rawLocal) localData = JSON.parse(rawLocal);
        } catch (e) {}

        if (Array.isArray(row.data)) {
          const isLocalEmpty = !localData || !Array.isArray(localData) || localData.length === 0;
          if (row.data.length === 0 && isLocalEmpty) {
            return;
          }

          const currentLocalArray = Array.isArray(localData) ? localData : [];
          const merged = mergeArraysByKey(currentLocalArray, row.data);
          const mergedStr = JSON.stringify(merged);
          const currentStr = JSON.stringify(currentLocalArray);

          if (mergedStr !== currentStr && merged.length > 0) {
            localStorage.setItem(localKey, mergedStr);
            updatedCount++;
          }

          // If local had items Supabase was missing, push merged data to Supabase
          if (merged.length > row.data.length) {
            Promise.resolve(
              client.from('hotel_store').upsert([{
                key: row.key,
                data: merged,
                updated_at: new Date().toISOString()
              }], { onConflict: 'key' })
            ).catch(() => {});
          }
        } else {
          const incomingStr = JSON.stringify(row.data);
          if (incomingStr !== rawLocal && incomingStr !== '[]' && incomingStr !== 'null') {
            localStorage.setItem(localKey, incomingStr);
            updatedCount++;
          }
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

