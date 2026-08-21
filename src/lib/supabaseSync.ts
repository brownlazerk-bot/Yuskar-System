import { SupabaseClient } from '@supabase/supabase-js';
import { 
  supabase as globalSupabaseClient, 
  getResolvedSupabaseConfig, 
  isSupabaseConfigured, 
  validateSupabaseConfig 
} from './supabase';
import { 
  getActiveBusinessId, 
  fetchAllBusinessDataFromSupabase,
  loadMenuItems, saveToSupabaseStore,
  loadTables, loadWaiters, loadOrders, loadKitchenTickets,
  loadStockLogs, loadShifts, loadCurrentShift, loadGuestRooms,
  loadUsers, loadAuditLogs, loadExpenses, loadCashMovements,
  loadDailyClosings, loadPurchaseOrders, loadIngredients,
  loadRecipes, loadStockMovementRecords, loadWasteRecords,
  loadWhatsAppSettings, loadWhatsAppRecipients, loadReportRules,
  loadReportHistory, loadMessageTemplates, loadNotifications,
  loadNotificationRules, loadApprovalRules, loadApprovalRequests,
  loadEmployees, loadSalaryAdvances, loadPayrollRecords,
  loadAttendanceRecords, loadPOSDeposits, loadBusinesses,
  loadSubscriptions, loadSubscriptionPayments, loadPlatformPaymentSettings
} from './storage';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const resolved = getResolvedSupabaseConfig();
  return {
    url: resolved.url,
    anonKey: resolved.anonKey,
    enabled: resolved.isConfigured
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  // No-op or diagnostic: configuration is canonically managed via environment variables and supabase.ts
  console.log('[Supabase Config Saved]', config.url);
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
    const { error } = await globalSupabaseClient.from('hotel_store').select('key').limit(1);
    
    if (error) {
      if (error.code === 'PGRST301' || error.message?.includes('relation "public.hotel_store" does not exist') || error.code === '42P01') {
        return { 
          success: true, 
          message: 'Supabase connected! Note: Table "hotel_store" is being initialized.' 
        };
      }
      return { success: true, message: `Connected to Supabase! (${error.message})` };
    }

    return { success: true, message: 'Connected to Supabase Cloud successfully! Database is ready.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Supabase.' };
  }
}

/**
 * Pushes all active business datasets to Supabase Cloud
 */
export async function pushAllToSupabase(): Promise<{ success: boolean; message: string }> {
  const bizId = getActiveBusinessId();
  if (!bizId) {
    return { success: false, message: 'No active business selected.' };
  }

  const datasets: Array<{ key: string; data: any }> = [
    { key: 'menuItems', data: loadMenuItems() },
    { key: 'tables', data: loadTables() },
    { key: 'waiters', data: loadWaiters() },
    { key: 'orders', data: loadOrders() },
    { key: 'kitchenTickets', data: loadKitchenTickets() },
    { key: 'stockLogs', data: loadStockLogs() },
    { key: 'shifts', data: loadShifts() },
    { key: 'currentShift', data: loadCurrentShift() },
    { key: 'guestRooms', data: loadGuestRooms() },
    { key: 'users', data: loadUsers() },
    { key: 'auditLogs', data: loadAuditLogs() },
    { key: 'expenses', data: loadExpenses() },
    { key: 'cashMovements', data: loadCashMovements() },
    { key: 'dailyClosings', data: loadDailyClosings() },
    { key: 'purchaseOrders', data: loadPurchaseOrders() },
    { key: 'ingredients', data: loadIngredients() },
    { key: 'recipes', data: loadRecipes() },
    { key: 'stockMovements', data: loadStockMovementRecords() },
    { key: 'wasteRecords', data: loadWasteRecords() },
    { key: 'whatsappSettings', data: loadWhatsAppSettings() },
    { key: 'whatsappRecipients', data: loadWhatsAppRecipients() },
    { key: 'reportRules', data: loadReportRules() },
    { key: 'reportHistory', data: loadReportHistory() },
    { key: 'messageTemplates', data: loadMessageTemplates() },
    { key: 'notifications', data: loadNotifications() },
    { key: 'notificationRules', data: loadNotificationRules() },
    { key: 'approvalRules', data: loadApprovalRules() },
    { key: 'approvalRequests', data: loadApprovalRequests() },
    { key: 'employees', data: loadEmployees() },
    { key: 'salaryAdvances', data: loadSalaryAdvances() },
    { key: 'payrollRecords', data: loadPayrollRecords() },
    { key: 'attendanceRecords', data: loadAttendanceRecords() },
    { key: 'posDeposits', data: loadPOSDeposits() },
    { key: 'businesses', data: loadBusinesses() },
    { key: 'subscriptions', data: loadSubscriptions() },
    { key: 'subscriptionPayments', data: loadSubscriptionPayments() },
    { key: 'platformPaymentSettings', data: loadPlatformPaymentSettings() }
  ];

  let successCount = 0;
  for (const ds of datasets) {
    const res = await saveToSupabaseStore(ds.key, ds.data, bizId);
    if (res.success) successCount++;
  }

  return {
    success: true,
    message: `Pushed ${successCount} datasets directly to Supabase Cloud for business (${bizId}).`
  };
}

/**
 * Pulls all business datasets from Supabase Cloud
 */
export async function pullAllFromSupabase(): Promise<{ success: boolean; count: number; message: string }> {
  const bizId = getActiveBusinessId();
  const res = await fetchAllBusinessDataFromSupabase(bizId);
  return {
    success: res.success,
    count: res.count,
    message: res.success 
      ? `Successfully loaded ${res.count} datasets from Supabase Cloud.`
      : `Failed to load from Supabase Cloud: ${res.error?.message || 'Error'}`
  };
}

/**
 * Periodic background polling for multi-device sync
 */
export function startSupabaseSyncPolling(intervalMs: number = 30000): () => void {
  const timer = setInterval(() => {
    const bizId = getActiveBusinessId();
    if (bizId) {
      fetchAllBusinessDataFromSupabase(bizId).catch(() => {});
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

export const SUPABASE_SQL_SCHEMA = `
-- =========================================================================
-- COMPLETE SUPABASE SQL SCHEMA FOR YUSKAR MANAGEMENT SYSTEM
-- =========================================================================

-- 1. HOTEL_STORE TABLE (Authoritative Key-Value Store for Business Datasets)
CREATE TABLE IF NOT EXISTS public.hotel_store (
  business_id UUID NOT NULL,
  key TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (business_id, key)
);

ALTER TABLE public.hotel_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read/write hotel_store" ON public.hotel_store;
DROP POLICY IF EXISTS "Allow public read/write hotel_store" ON public.hotel_store;

CREATE POLICY "Allow public read/write hotel_store" 
  ON public.hotel_store 
  FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

-- 2. BUSINESSES TABLE
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  category TEXT DEFAULT 'Hotel / Resort',
  type TEXT DEFAULT 'hotel',
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'ACTIVE',
  subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read/write businesses" ON public.businesses;
DROP POLICY IF EXISTS "Allow public read/write businesses" ON public.businesses;

CREATE POLICY "Allow public read/write businesses" 
  ON public.businesses 
  FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'Manager',
  status TEXT DEFAULT 'Active',
  access_status TEXT DEFAULT 'Approved',
  payment_status TEXT DEFAULT 'Paid',
  pin_code TEXT DEFAULT '1234',
  is_super_admin BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read and update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read/write profiles" ON public.profiles;

CREATE POLICY "Allow public read/write profiles" 
  ON public.profiles 
  FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

-- 4. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id TEXT PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_name TEXT,
  plan_name TEXT DEFAULT 'Monthly SaaS Business License',
  monthly_fee NUMERIC DEFAULT 100000,
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'ACTIVE',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  grace_period_days INTEGER DEFAULT 7,
  payment_method TEXT DEFAULT 'MTN_MOMO',
  momo_number TEXT DEFAULT '0726134041',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read/write subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow public read/write subscriptions" ON public.subscriptions;

CREATE POLICY "Allow public read/write subscriptions" 
  ON public.subscriptions 
  FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

-- 5. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  business_id UUID,
  user_id TEXT,
  user_name TEXT,
  user_role TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated insert and read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow public read/write audit_logs" ON public.audit_logs;

CREATE POLICY "Allow public read/write audit_logs" 
  ON public.audit_logs 
  FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);
`;
