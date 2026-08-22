import { 
  MenuItem, Table, Waiter, Order, KitchenTicket, 
  StockAdjustmentLog, Shift, GuestRoom, AppUser, AuditLog,
  Expense, CashMovement, DailyClosingRecord, POSDepositRecord, PurchaseOrder, KitchenIngredient,
  StockMovementRecord, KitchenWasteRecord, Recipe,
  WhatsAppSettings, WhatsAppRecipient, ReportDeliveryRule, ReportDeliveryHistory,
  MessageTemplate, NotificationItem, NotificationRule, ApprovalRule, ApprovalRequest,
  Employee, SalaryAdvance, PayrollRecord, AttendanceRecord,
  Business, Subscription, SubscriptionPayment, SubscriptionOverrideRecord,
  PlatformPaymentSettings,
  StockAudit, AuditItemRecord, AuditAdjustmentRecord
} from '../types';
import { supabase } from './supabase';

export interface SyncStatusInfo {
  state: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
  lastSyncedAt?: string;
  lastError?: string;
}

export const DEFAULT_RESORT_UUID = '64843dc5-b24c-4af2-87d5-efaf91f5d5e3';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

export function normalizeBusinessUuid(id?: string | null): string {
  if (!id || typeof id !== 'string') return DEFAULT_RESORT_UUID;
  const clean = id.trim();
  if (UUID_REGEX.test(clean)) return clean.toLowerCase();

  // If it matches known aliases or slugs for the default business
  if (
    clean.includes('seven') || 
    clean.includes('sky-view') || 
    clean.includes('1786805821046') || 
    clean.includes('biz-1001') || 
    clean.includes('biz-1046') || 
    clean.includes('00000000-0000') ||
    clean === 'biz-primary-01'
  ) {
    return DEFAULT_RESORT_UUID;
  }

  // Deterministically map custom non-UUID strings to a standard UUID v4 representation
  let hex = '';
  for (let i = 0; i < clean.length; i++) {
    hex += clean.charCodeAt(i).toString(16);
  }
  hex = (hex + 'a1b2c3d4e5f67890123456789abcdef0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// Global in-memory data store for the active authenticated session
const memoryStore: Record<string, any> = {};
let activeBusinessId: string = DEFAULT_RESORT_UUID;
let currentUserSession: AppUser | null = null;
let currentBusinessSession: Business | null = null;

export function getActiveBusinessId(): string {
  return activeBusinessId;
}

export function setActiveBusinessId(id: string): void {
  activeBusinessId = normalizeBusinessUuid(id);
}

export function getScopedKey(baseKey: string, businessId?: string): string {
  const bizId = normalizeBusinessUuid(businessId || activeBusinessId);
  return `hotel_${bizId}_${baseKey.replace(/^hotel_/, '')}`;
}

// Sync Status Engine
let syncStatus: SyncStatusInfo = { state: 'idle' };
const syncStatusListeners = new Set<(status: SyncStatusInfo) => void>();
const dataChangeListeners = new Set<(key: string) => void>();

export function getSyncStatus(): SyncStatusInfo {
  return syncStatus;
}

export function updateSyncStatus(partial: Partial<SyncStatusInfo>): void {
  syncStatus = { ...syncStatus, ...partial };
  syncStatusListeners.forEach(fn => {
    try { fn(syncStatus); } catch (e) { console.error(e); }
  });
}

export function subscribeToSyncStatus(listener: (status: SyncStatusInfo) => void): () => void {
  syncStatusListeners.add(listener);
  listener(syncStatus);
  return () => syncStatusListeners.delete(listener);
}

export function subscribeToDataChanges(listener: (key: string) => void): () => void {
  dataChangeListeners.add(listener);
  return () => dataChangeListeners.delete(listener);
}

export function notifyDataChange(key: string): void {
  dataChangeListeners.forEach(fn => {
    try { fn(key); } catch (e) { console.error(e); }
  });
}

/**
 * Persists an operational dataset to Supabase public.hotel_store as the authoritative store.
 */
export async function saveToSupabaseStore(
  serverKey: string,
  data: any,
  targetBusinessId?: string | null
): Promise<{ success: boolean; data?: any; error?: any }> {
  const bizId = normalizeBusinessUuid(targetBusinessId || activeBusinessId);

  // 1. Update in-memory state immediately for instant responsive UI
  memoryStore[serverKey] = data;
  notifyDataChange(serverKey);

  // 2. Synchronize to local Express server database as a resilient fallback
  try {
    if (typeof fetch !== 'undefined') {
      fetch('/api/sync/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: serverKey, value: data, businessId: bizId })
      }).catch(() => {});
    }
  } catch (e) {
    // Non-blocking server sync
  }

  const payload = {
    business_id: bizId,
    key: serverKey,
    data: data,
    updated_at: new Date().toISOString()
  };

  try {
    updateSyncStatus({ state: 'syncing' });
    const { data: resData, error: upsertErr } = await supabase
      .from('hotel_store')
      .upsert([payload], { onConflict: 'business_id,key' });

    if (upsertErr) {
      if (upsertErr.code === '42501') {
        console.warn(`[Supabase Store RLS Notice] Key: "${serverKey}", Business: "${bizId}". Saved locally & in-memory. Note: Enable public RLS policy on hotel_store or authenticate user to sync to cloud.`, upsertErr);
        updateSyncStatus({ state: 'synced', lastSyncedAt: new Date().toISOString(), lastError: undefined });
        return { success: true, error: upsertErr };
      }

      console.error(`[Supabase Store Write Failed] Key: "${serverKey}", Business: "${bizId}"`, upsertErr);
      updateSyncStatus({ state: 'error', lastError: upsertErr.message || 'Supabase write error' });
      return { success: false, error: upsertErr };
    }

    console.log(`[Supabase Store Write Success] Key: "${serverKey}", Business: "${bizId}"`);
    updateSyncStatus({ state: 'synced', lastSyncedAt: new Date().toISOString(), lastError: undefined });
    return { success: true, data: resData };
  } catch (err: any) {
    console.error(`[Supabase Store Write Exception] Unexpected error on key "${serverKey}":`, err);
    updateSyncStatus({ state: 'error', lastError: err?.message || String(err) });
    return { success: false, error: err };
  }
}

/**
 * Loads a specific dataset from Supabase public.hotel_store
 */
export async function loadFromSupabaseStore(
  serverKey: string,
  targetBusinessId?: string | null
): Promise<{ success: boolean; data?: any; error?: any }> {
  const bizId = normalizeBusinessUuid(targetBusinessId || activeBusinessId);
  try {
    const { data, error } = await supabase
      .from('hotel_store')
      .select('data, updated_at')
      .eq('business_id', bizId)
      .eq('key', serverKey)
      .maybeSingle();

    if (error) {
      if (error.code === '42501') {
        console.warn(`[Supabase Store Read RLS Notice] Key: "${serverKey}". Using active in-memory cache.`);
        return { success: true, data: memoryStore[serverKey] || null };
      }
      console.error(`[Supabase Store Read Failed] Key: "${serverKey}", Business: "${bizId}"`, error);
      return { success: false, error };
    }

    if (data && data.data !== undefined) {
      memoryStore[serverKey] = data.data;
      notifyDataChange(serverKey);
      return { success: true, data: data.data };
    }

    return { success: true, data: null };
  } catch (err: any) {
    console.error(`[Supabase Store Read Exception] Key: "${serverKey}":`, err);
    return { success: false, error: err };
  }
}

/**
 * Fetches all business datasets from Supabase public.hotel_store for the active business
 */
export async function fetchAllBusinessDataFromSupabase(
  businessId?: string | null
): Promise<{ success: boolean; count: number; error?: any }> {
  const bizId = normalizeBusinessUuid(businessId || activeBusinessId);
  activeBusinessId = bizId;

  updateSyncStatus({ state: 'syncing' });
  try {
    const { data, error } = await supabase
      .from('hotel_store')
      .select('key, data, updated_at')
      .eq('business_id', bizId);

    if (error) {
      if (error.code === '42501') {
        console.warn(`[Supabase Load All RLS Notice] Business: "${bizId}". Falling back to server database.`, error);
        // Fallback to local server database state
        try {
          const resp = await fetch('/api/sync/all');
          if (resp.ok) {
            const serverJson = await resp.json();
            if (serverJson?.data) {
              let loadedCount = 0;
              Object.entries(serverJson.data).forEach(([key, val]) => {
                if (val !== undefined && key !== 'prodInit' && key !== 'lastUpdated') {
                  memoryStore[key] = val;
                  notifyDataChange(key);
                  loadedCount++;
                }
              });
              updateSyncStatus({ state: 'synced', lastSyncedAt: new Date().toISOString(), lastError: undefined });
              return { success: true, count: loadedCount };
            }
          }
        } catch (serverErr) {
          // Ignore server fetch error
        }
        updateSyncStatus({ state: 'synced', lastSyncedAt: new Date().toISOString(), lastError: undefined });
        return { success: true, count: 0 };
      }

      console.error(`[Supabase Load All Failed] Business: "${bizId}"`, error);
      updateSyncStatus({ state: 'error', lastError: error.message });
      return { success: false, count: 0, error };
    }

    let loadedCount = 0;
    if (data && Array.isArray(data)) {
      for (const row of data) {
        if (row.key && row.data !== undefined) {
          memoryStore[row.key] = row.data;
          notifyDataChange(row.key);
          loadedCount++;
        }
      }
    }

    console.log(`[Supabase Load All Success] Loaded ${loadedCount} datasets for business "${bizId}"`);
    updateSyncStatus({ state: 'synced', lastSyncedAt: new Date().toISOString(), lastError: undefined });
    return { success: true, count: loadedCount };
  } catch (err: any) {
    console.error(`[Supabase Load All Exception] Business: "${bizId}":`, err);
    updateSyncStatus({ state: 'error', lastError: err?.message || String(err) });
    return { success: false, count: 0, error: err };
  }
}

// ==========================================
// CANONICAL OPERATIONAL DATA ACCESSORS
// (Supabase is the ONLY authoritative source)
// ==========================================

export function loadMenuItems(): MenuItem[] {
  return (memoryStore['menuItems'] as MenuItem[]) || [];
}

export async function saveMenuItemsAsync(items: MenuItem[]): Promise<{ success: boolean; error?: any }> {
  return await saveToSupabaseStore('menuItems', items);
}

export function saveMenuItems(items: MenuItem[]): void {
  saveToSupabaseStore('menuItems', items);
}

export function loadTables(): Table[] {
  return (memoryStore['tables'] as Table[]) || [];
}

export function saveTables(tables: Table[]): void {
  saveToSupabaseStore('tables', tables);
}

export function loadWaiters(): Waiter[] {
  const explicitWaiters = (memoryStore['waiters'] as Waiter[]) || [];
  const users = (memoryStore['users'] as AppUser[]) || [];
  const employees = (memoryStore['employees'] as Employee[]) || [];

  const waiterMap = new Map<string, Waiter>();

  // 1. Explicit waiters from roster
  explicitWaiters.forEach(w => {
    if (w && w.id) {
      waiterMap.set(w.id, w);
    }
  });

  // 2. Staff user accounts with role 'Waiter'
  users.forEach(u => {
    if (u && (u.role === 'Waiter' || (u.role && u.role.toLowerCase().includes('waiter')))) {
      if (!waiterMap.has(u.id)) {
        const existingByName = Array.from(waiterMap.values()).find(
          w => w.name.trim().toLowerCase() === u.fullName.trim().toLowerCase()
        );
        if (!existingByName) {
          waiterMap.set(u.id, {
            id: u.id,
            name: u.fullName,
            employeeId: u.pinCode ? `PIN-${u.pinCode}` : u.id.slice(0, 8),
            phone: u.phone || '',
            shift: 'Morning',
            active: u.status !== 'Inactive' && u.status !== 'Suspended'
          });
        }
      }
    }
  });

  // 3. HR employees in Service / Waiters department or with Waiter role
  employees.forEach(e => {
    if (
      e &&
      (e.department === 'Service / Waiters' ||
        (e.role && e.role.toLowerCase().includes('waiter')))
    ) {
      if (!waiterMap.has(e.id)) {
        const existingByName = Array.from(waiterMap.values()).find(
          w => w.name.trim().toLowerCase() === e.fullName.trim().toLowerCase()
        );
        if (!existingByName) {
          waiterMap.set(e.id, {
            id: e.id,
            name: e.fullName,
            employeeId: e.employeeId || e.id.slice(0, 8),
            phone: e.phone || '',
            shift: 'Morning',
            active: e.status === 'Active'
          });
        }
      }
    }
  });

  return Array.from(waiterMap.values());
}

export function saveWaiters(waiters: Waiter[]): void {
  saveToSupabaseStore('waiters', waiters);

  // Synchronize waiters to staff user accounts and Supabase profiles table for immediate terminal & PIN login
  try {
    const bizId = getActiveBusinessId();
    const currentUsers = loadUsers();
    let usersModified = false;
    const updatedUsers = [...currentUsers];

    waiters.forEach(w => {
      const email = w.email || `${w.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'waiter'}@hotel.com`;
      const existingUserIdx = updatedUsers.findIndex(
        u => u.id === w.id || (u.email && u.email.toLowerCase() === email.toLowerCase())
      );

      if (existingUserIdx > -1) {
        updatedUsers[existingUserIdx] = {
          ...updatedUsers[existingUserIdx],
          fullName: w.name,
          phone: w.phone || updatedUsers[existingUserIdx].phone,
          pinCode: w.pinCode || updatedUsers[existingUserIdx].pinCode || '1234',
          role: 'Waiter',
          businessId: bizId,
          status: w.active === false ? 'Inactive' : 'Active'
        };
        usersModified = true;
      } else {
        updatedUsers.push({
          id: w.id,
          email,
          fullName: w.name,
          phone: w.phone || '',
          role: 'Waiter',
          businessId: bizId,
          isSuperAdmin: false,
          pinCode: w.pinCode || '1234',
          status: w.active === false ? 'Inactive' : 'Active',
          accessStatus: 'Approved',
          createdAt: new Date().toISOString()
        });
        usersModified = true;
      }

      // Upsert into Supabase public.profiles table if UUID or sync key
      if (isValidUuid(w.id)) {
        supabase.from('profiles').upsert({
          id: w.id,
          email,
          full_name: w.name,
          role: 'Waiter',
          business_id: bizId,
          pin_code: w.pinCode || '1234',
          phone: w.phone || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' }).then(({ error }) => {
          if (error) {
            console.warn('[Waiter Profile Sync to Supabase Notice]', error.message);
          }
        });
      }
    });

    if (usersModified) {
      saveUsers(updatedUsers);
    }
  } catch (e) {
    console.error('Error synchronizing waiters with staff accounts:', e);
  }
}

export function loadOrders(): Order[] {
  return (memoryStore['orders'] as Order[]) || [];
}

export function saveOrders(orders: Order[]): void {
  saveToSupabaseStore('orders', orders);
}

export function loadKitchenTickets(): KitchenTicket[] {
  return (memoryStore['kitchenTickets'] as KitchenTicket[]) || [];
}

export function saveKitchenTickets(tickets: KitchenTicket[]): void {
  saveToSupabaseStore('kitchenTickets', tickets);
}

export function loadStockLogs(): StockAdjustmentLog[] {
  return (memoryStore['stockLogs'] as StockAdjustmentLog[]) || [];
}

export function saveStockLogs(logs: StockAdjustmentLog[]): void {
  saveToSupabaseStore('stockLogs', logs);
}

export function loadShifts(): Shift[] {
  return (memoryStore['shifts'] as Shift[]) || [];
}

export function saveShifts(shifts: Shift[]): void {
  saveToSupabaseStore('shifts', shifts);
}

export function loadCurrentShift(): Shift | null {
  return (memoryStore['currentShift'] as Shift | null) || null;
}

export function saveCurrentShift(shift: Shift | null): void {
  saveToSupabaseStore('currentShift', shift);
}

export function loadGuestRooms(): GuestRoom[] {
  return (memoryStore['guestRooms'] as GuestRoom[]) || [];
}

export function saveGuestRooms(rooms: GuestRoom[]): void {
  saveToSupabaseStore('guestRooms', rooms);
}

export const INITIAL_STAFF_USERS: AppUser[] = [];

export function loadUsers(): AppUser[] {
  return (memoryStore['users'] as AppUser[]) || [];
}

export function saveUsers(users: AppUser[]): void {
  saveToSupabaseStore('users', users);
}

export function updateUserAccessAndPayment(userId: string, updates: Partial<AppUser>): void {
  const users = loadUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return;

  const updated = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  users[index] = updated;
  saveUsers(users);
}

export function grantUserGracePeriod(userId: string, days: number = 7, notes: string = 'Grace period granted by Super Admin'): void {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  updateUserAccessAndPayment(userId, {
    accessStatus: 'Grace Period',
    gracePeriodDays: days,
    accessExpiresAt: expiresAt,
    paymentNotes: notes
  });
}

export function approveUserPaymentAccess(userId: string, notes: string = 'Payment verified and full access authorized by Super Admin'): void {
  updateUserAccessAndPayment(userId, {
    accessStatus: 'Approved',
    paymentStatus: 'Paid',
    authorizedBySuperAdmin: true,
    authorizedAt: new Date().toISOString(),
    paymentNotes: notes
  });
}

export function lockUserAccess(userId: string, reason: string = 'Payment required / Account locked by Super Admin'): void {
  updateUserAccessAndPayment(userId, {
    accessStatus: 'Locked',
    paymentStatus: 'Unpaid',
    paymentNotes: reason
  });
}

export function revokeUserSession(userId: string): void {
  lockUserAccess(userId, 'Session revoked by administrator');
}

export function loadAuditLogs(): AuditLog[] {
  return (memoryStore['auditLogs'] as AuditLog[]) || [];
}

export function addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
  const logs = loadAuditLogs();
  const newLog: AuditLog = {
    ...log,
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString()
  };
  saveToSupabaseStore('auditLogs', [newLog, ...logs.slice(0, 199)]);
}

export function loadCurrentUser(): AppUser | null {
  return currentUserSession;
}

export function saveCurrentUser(user: AppUser | null): void {
  currentUserSession = user;
  if (user?.businessId) {
    activeBusinessId = normalizeBusinessUuid(user.businessId);
  }
}

export function clearCurrentUser(): void {
  currentUserSession = null;
}

export function loadExpenses(): Expense[] {
  return (memoryStore['expenses'] as Expense[]) || [];
}

export function saveExpenses(expenses: Expense[]): void {
  saveToSupabaseStore('expenses', expenses);
}

export function addExpense(expense: Omit<Expense, 'id' | 'expenseNumber' | 'timestamp'>): Expense {
  const expenses = loadExpenses();
  const num = expenses.length + 1001;
  const newExpense: Expense = {
    ...expense,
    id: `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    expenseNumber: `EXP-${num}`,
    timestamp: new Date().toISOString()
  };
  saveExpenses([newExpense, ...expenses]);
  return newExpense;
}

export function loadCashMovements(): CashMovement[] {
  return (memoryStore['cashMovements'] as CashMovement[]) || [];
}

export function saveCashMovements(movements: CashMovement[]): void {
  saveToSupabaseStore('cashMovements', movements);
}

export function addCashMovement(movement: Omit<CashMovement, 'id' | 'timestamp' | 'date' | 'time'>): CashMovement {
  const movements = loadCashMovements();
  const now = new Date();
  const newMovement: CashMovement = {
    ...movement,
    id: `CM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    timestamp: now.toISOString()
  };
  saveCashMovements([newMovement, ...movements]);
  return newMovement;
}

export function loadDailyClosings(): DailyClosingRecord[] {
  return (memoryStore['dailyClosings'] as DailyClosingRecord[]) || [];
}

export function saveDailyClosings(records: DailyClosingRecord[]): void {
  saveToSupabaseStore('dailyClosings', records);
}

export function addDailyClosing(record: Omit<DailyClosingRecord, 'id' | 'closedAt'>): DailyClosingRecord {
  const records = loadDailyClosings();
  const newRecord: DailyClosingRecord = {
    ...record,
    id: `DC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    closedAt: new Date().toISOString()
  };
  saveDailyClosings([newRecord, ...records]);
  return newRecord;
}

export function loadPurchaseOrders(): PurchaseOrder[] {
  return (memoryStore['purchaseOrders'] as PurchaseOrder[]) || [];
}

export function savePurchaseOrders(pos: PurchaseOrder[]): void {
  saveToSupabaseStore('purchaseOrders', pos);
}

export function loadIngredients(): KitchenIngredient[] {
  return (memoryStore['ingredients'] as KitchenIngredient[]) || [];
}

export function saveIngredients(ingredients: KitchenIngredient[]): void {
  saveToSupabaseStore('ingredients', ingredients);
}

export function loadStockMovementRecords(): StockMovementRecord[] {
  return (memoryStore['stockMovements'] as StockMovementRecord[]) || [];
}

export function saveStockMovementRecords(records: StockMovementRecord[]): void {
  saveToSupabaseStore('stockMovements', records);
}

export function addStockMovementRecord(rec: Omit<StockMovementRecord, 'id' | 'timestamp' | 'date' | 'time'>): StockMovementRecord {
  const records = loadStockMovementRecords();
  const now = new Date();
  const newRec: StockMovementRecord = {
    ...rec,
    id: `SM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    timestamp: now.toISOString()
  };
  saveStockMovementRecords([newRec, ...records]);
  return newRec;
}

export function loadWasteRecords(): KitchenWasteRecord[] {
  return (memoryStore['wasteRecords'] as KitchenWasteRecord[]) || [];
}

export function saveWasteRecords(records: KitchenWasteRecord[]): void {
  saveToSupabaseStore('wasteRecords', records);
}

export function addWasteRecord(rec: Omit<KitchenWasteRecord, 'id' | 'timestamp' | 'date'>): KitchenWasteRecord {
  const records = loadWasteRecords();
  const now = new Date();
  const newRec: KitchenWasteRecord = {
    ...rec,
    id: `KW-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString()
  };
  saveWasteRecords([newRec, ...records]);
  return newRec;
}

export function loadRecipes(): Recipe[] {
  return (memoryStore['recipes'] as Recipe[]) || [];
}

export function saveRecipes(recipes: Recipe[]): void {
  saveToSupabaseStore('recipes', recipes);
}

export const INITIAL_WHATSAPP_SETTINGS: WhatsAppSettings = {
  apiUrl: 'https://graph.facebook.com/v19.0',
  accessToken: '',
  phoneNumberId: '',
  businessAccountId: '',
  webhookVerifyToken: 'hotel-verify-token',
  enabled: false,
  connected: false,
  defaultSenderNumber: '+250 726 134 041'
};

export function loadWhatsAppSettings(): WhatsAppSettings {
  return (memoryStore['whatsappSettings'] as WhatsAppSettings) || INITIAL_WHATSAPP_SETTINGS;
}

export function saveWhatsAppSettings(settings: WhatsAppSettings): void {
  saveToSupabaseStore('whatsappSettings', settings);
}

export function loadWhatsAppRecipients(): WhatsAppRecipient[] {
  return (memoryStore['whatsappRecipients'] as WhatsAppRecipient[]) || [];
}

export function saveWhatsAppRecipients(recipients: WhatsAppRecipient[]): void {
  saveToSupabaseStore('whatsappRecipients', recipients);
}

export function loadReportRules(): ReportDeliveryRule[] {
  return (memoryStore['reportRules'] as ReportDeliveryRule[]) || [];
}

export function saveReportRules(rules: ReportDeliveryRule[]): void {
  saveToSupabaseStore('reportRules', rules);
}

export function loadReportHistory(): ReportDeliveryHistory[] {
  return (memoryStore['reportHistory'] as ReportDeliveryHistory[]) || [];
}

export function saveReportHistory(history: ReportDeliveryHistory[]): void {
  saveToSupabaseStore('reportHistory', history);
}

export function addReportHistoryRecord(record: Omit<ReportDeliveryHistory, 'id' | 'createdAt'>): ReportDeliveryHistory {
  const history = loadReportHistory();
  const newRec: ReportDeliveryHistory = {
    ...record,
    id: `REP-LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString()
  };
  saveReportHistory([newRec, ...history]);
  return newRec;
}

export function loadMessageTemplates(): MessageTemplate[] {
  return (memoryStore['messageTemplates'] as MessageTemplate[]) || [];
}

export function saveMessageTemplates(templates: MessageTemplate[]): void {
  saveToSupabaseStore('messageTemplates', templates);
}

export function loadNotifications(): NotificationItem[] {
  return (memoryStore['notifications'] as NotificationItem[]) || [];
}

export function saveNotifications(notifications: NotificationItem[]): void {
  saveToSupabaseStore('notifications', notifications);
}

export function addNotificationItem(item: Omit<NotificationItem, 'id' | 'createdAt'>): NotificationItem {
  const notifications = loadNotifications();
  const newItem: NotificationItem = {
    ...item,
    id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString()
  };
  saveNotifications([newItem, ...notifications]);
  return newItem;
}

export function loadNotificationRules(): NotificationRule[] {
  return (memoryStore['notificationRules'] as NotificationRule[]) || [];
}

export function saveNotificationRules(rules: NotificationRule[]): void {
  saveToSupabaseStore('notificationRules', rules);
}

export function loadApprovalRules(): ApprovalRule[] {
  return (memoryStore['approvalRules'] as ApprovalRule[]) || [];
}

export function saveApprovalRules(rules: ApprovalRule[]): void {
  saveToSupabaseStore('approvalRules', rules);
}

export function loadApprovalRequests(): ApprovalRequest[] {
  return (memoryStore['approvalRequests'] as ApprovalRequest[]) || [];
}

export function saveApprovalRequests(requests: ApprovalRequest[]): void {
  saveToSupabaseStore('approvalRequests', requests);
}

export function addApprovalRequestRecord(req: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt' | 'referenceNo'>): ApprovalRequest {
  const requests = loadApprovalRequests();
  const now = new Date().toISOString();
  const count = requests.length + 101;
  const newReq: ApprovalRequest = {
    ...req,
    id: `APR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    referenceNo: `REQ-${count}`,
    createdAt: now,
    updatedAt: now
  };
  saveApprovalRequests([newReq, ...requests]);
  return newReq;
}

export function loadEmployees(): Employee[] {
  return (memoryStore['employees'] as Employee[]) || [];
}

export function saveEmployees(employees: Employee[]): void {
  saveToSupabaseStore('employees', employees);
}

export function loadSalaryAdvances(): SalaryAdvance[] {
  return (memoryStore['salaryAdvances'] as SalaryAdvance[]) || [];
}

export function saveSalaryAdvances(advances: SalaryAdvance[]): void {
  saveToSupabaseStore('salaryAdvances', advances);
}

export function loadPayrollRecords(): PayrollRecord[] {
  return (memoryStore['payrollRecords'] as PayrollRecord[]) || [];
}

export function savePayrollRecords(records: PayrollRecord[]): void {
  saveToSupabaseStore('payrollRecords', records);
}

export function loadAttendanceRecords(): AttendanceRecord[] {
  return (memoryStore['attendanceRecords'] as AttendanceRecord[]) || [];
}

export function saveAttendanceRecords(records: AttendanceRecord[]): void {
  saveToSupabaseStore('attendanceRecords', records);
}

export function loadPOSDeposits(): POSDepositRecord[] {
  return (memoryStore['posDeposits'] as POSDepositRecord[]) || [];
}

export function savePOSDeposits(deposits: POSDepositRecord[]): void {
  saveToSupabaseStore('posDeposits', deposits);
}

export function addPOSDeposit(dep: Omit<POSDepositRecord, 'id' | 'depositNumber' | 'timestamp'>): POSDepositRecord {
  const deposits = loadPOSDeposits();
  const num = deposits.length + 1001;
  const newDep: POSDepositRecord = {
    ...dep,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
    depositNumber: `DEP-${num}`,
    timestamp: new Date().toISOString()
  };
  savePOSDeposits([newDep, ...deposits]);
  return newDep;
}

// ==========================================
// STOCK AUDIT & RECONCILIATION STORE
// ==========================================

export function loadStockAudits(): StockAudit[] {
  return (memoryStore['stockAudits'] as StockAudit[]) || [];
}

export function saveStockAudits(audits: StockAudit[]): void {
  saveToSupabaseStore('stockAudits', audits);
}

export function addStockAudit(audit: Omit<StockAudit, 'id' | 'auditNumber' | 'createdAt' | 'updatedAt'>): StockAudit {
  const audits = loadStockAudits();
  const num = audits.length + 1001;
  const now = new Date().toISOString();
  const newAudit: StockAudit = {
    ...audit,
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    auditNumber: `AUD-${num}`,
    createdAt: now,
    updatedAt: now
  };
  saveStockAudits([newAudit, ...audits]);
  return newAudit;
}

export function updateStockAudit(audit: StockAudit): void {
  const audits = loadStockAudits();
  const index = audits.findIndex(a => a.id === audit.id);
  const now = new Date().toISOString();
  if (index > -1) {
    const updated = {
      ...audit,
      updatedAt: now
    };
    audits[index] = updated;
    saveStockAudits([...audits]);
  } else {
    saveStockAudits([{ ...audit, updatedAt: now }, ...audits]);
  }
}

export function recordAuditAdjustment(
  auditId: string,
  adjustment: Omit<AuditAdjustmentRecord, 'id' | 'auditId' | 'correctedAt'>
): StockAudit | null {
  const audits = loadStockAudits();
  const index = audits.findIndex(a => a.id === auditId);
  if (index === -1) return null;

  const audit = audits[index];
  const now = new Date().toISOString();
  const newAdjustment: AuditAdjustmentRecord = {
    ...adjustment,
    id: `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    auditId,
    correctedAt: now
  };

  const updatedAdjustments = [...(audit.adjustments || []), newAdjustment];
  const updatedItems = audit.items.map(item => {
    if (item.id === adjustment.auditItemId) {
      const diff = adjustment.correctedPhysicalCount - item.theoreticalClosingStock;
      const variance = diff * item.unitCost;
      let status = item.discrepancyStatus;
      if (Math.abs(diff) < 0.0001) status = 'MATCHED';
      else if (diff < 0) status = 'SHORTAGE';
      else status = 'SURPLUS';

      return {
        ...item,
        physicalCount: adjustment.correctedPhysicalCount,
        difference: diff,
        varianceValue: variance,
        discrepancyStatus: status,
        reason: 'COUNTING_ERROR' as any,
        investigationNotes: `${item.investigationNotes ? item.investigationNotes + ' | ' : ''}Adjustment: ${adjustment.reason}`
      };
    }
    return item;
  });

  const updatedAudit: StockAudit = {
    ...audit,
    items: updatedItems,
    adjustments: updatedAdjustments,
    updatedAt: now
  };

  audits[index] = updatedAudit;
  saveStockAudits([...audits]);
  return updatedAudit;
}

export function resetAllDataToDefault(initiatingUser?: AppUser | null): boolean {
  const user = initiatingUser || loadCurrentUser();
  const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'Super Admin');

  if (!isSuperAdmin) {
    console.error('Unauthorized attempt to reset all system data. Only Super Admin can reset data.');
    return false;
  }

  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  return true;
}

// ==========================================
// SAAS SUBSCRIPTION & PLATFORM SETTINGS
// ==========================================

export const INITIAL_PLATFORM_PAYMENT_SETTINGS: PlatformPaymentSettings = {
  enableMomo: true,
  momoNumber: '0726134041',
  momoAccountName: 'Theogene / YusKar Empire',
  momoMerchantCode: '0726134041',
  momoUssdCode: '*182*8*1*0726134041#',
  enableAirtel: true,
  airtelMoneyNumber: '+250 730 000 000',
  airtelAccountName: 'YusKar Empire',
  enableBankTransfer: true,
  primaryBankName: 'Bank of Kigali (BK)',
  primaryBankAccount: '00040-0694038-34',
  primaryAccountName: 'YUSKAR EMPIRE LTD',
  primaryBranch: 'Kigali Head Office',
  primarySwiftCode: 'BKRWRWRW',
  secondaryBankName: 'Equity Bank Rwanda',
  secondaryBankAccount: '4001211234567',
  secondaryAccountName: 'YUSKAR EMPIRE LTD',
  enableCardPayment: true,
  cardGatewayName: 'Visa, Mastercard & Online Card Terminal',
  cardPaymentLink: 'https://pay.yuskar.rw/checkout',
  cardInstructions: 'Instant card payment via Visa, Mastercard, or UnionPay with instant automated system activation.',
  defaultBonusDays: 14,
  enableAutoBonusOnRegister: true,
  supportPhone: '+250 726 134 041',
  supportEmail: 'yuskarshop@gmail.com',
  paymentInstructions: 'Please make payment using MTN Mobile Money, Airtel Money, Bank Transfer, or Credit/Debit Card to the official platform accounts.',
  monthlyFee: 100000,
  currency: 'RWF',
  updatedAt: '2026-08-18T10:00:00.000Z'
};

export function loadPlatformPaymentSettings(): PlatformPaymentSettings {
  return (memoryStore['platformPaymentSettings'] as PlatformPaymentSettings) || INITIAL_PLATFORM_PAYMENT_SETTINGS;
}

export function savePlatformPaymentSettings(settings: PlatformPaymentSettings): void {
  saveToSupabaseStore('platformPaymentSettings', settings);
}

export const SAAS_MONTHLY_FEE = 100000;
export const SAAS_MOMO_MERCHANT_NUMBER = '0726134041';

export const INITIAL_BUSINESS: Business = {
  id: '64843dc5-b24c-4af2-87d5-efaf91f5d5e3',
  name: 'SEVEN TO SEVEN Sky View Resort',
  code: 'BIZ-1046',
  category: 'Hotel / Resort',
  ownerName: 'Theogene',
  phone: '+250 726 134 041',
  email: 'yuskarshop@gmail.com',
  momoPaymentNumber: '0726134041',
  address: 'Kigali, Rwanda',
  currency: 'RWF',
  status: 'ACTIVE',
  subscriptionId: 'sub-64843dc5-b24c-4af2-87d5-efaf91f5d5e3',
  createdAt: '2026-08-14T00:00:00.000Z'
};

export const INITIAL_SUBSCRIPTION: Subscription = {
  id: 'sub-64843dc5-b24c-4af2-87d5-efaf91f5d5e3',
  businessId: '64843dc5-b24c-4af2-87d5-efaf91f5d5e3',
  businessName: 'SEVEN TO SEVEN Sky View Resort',
  planName: 'Monthly SaaS Business License',
  amount: 100000,
  currency: 'RWF',
  status: 'ACTIVE',
  startDate: '2026-08-14T00:00:00.000Z',
  expiryDate: '2027-09-14T00:00:00.000Z',
  gracePeriodDays: 0,
  lastPaymentDate: '2026-08-14T00:00:00.000Z',
  paymentReference: 'MOMO-RW-20260814-INIT',
  transactionReference: 'TXN-MOMO-RW-20260814-INIT',
  nextPaymentAmount: 100000,
  createdAt: '2026-08-14T00:00:00.000Z'
};

export function loadBusinesses(): Business[] {
  return (memoryStore['businesses'] as Business[]) || [INITIAL_BUSINESS];
}

export function saveBusinesses(businesses: Business[]): void {
  saveToSupabaseStore('businesses', businesses);
}

export function loadCurrentBusiness(): Business {
  if (currentBusinessSession) return currentBusinessSession;
  const list = loadBusinesses();
  return list[0] || INITIAL_BUSINESS;
}

export function saveCurrentBusiness(business: Business): void {
  currentBusinessSession = business;
  if (business?.id) {
    activeBusinessId = normalizeBusinessUuid(business.id);
  }
}

export function loadSubscriptions(): Subscription[] {
  return (memoryStore['subscriptions'] as Subscription[]) || [INITIAL_SUBSCRIPTION];
}

export function saveSubscriptions(subscriptions: Subscription[]): void {
  saveToSupabaseStore('subscriptions', subscriptions);
}

export function loadSubscriptionPayments(): SubscriptionPayment[] {
  return (memoryStore['subscriptionPayments'] as SubscriptionPayment[]) || [];
}

export function saveSubscriptionPayments(payments: SubscriptionPayment[]): void {
  saveToSupabaseStore('subscriptionPayments', payments);
}

export function loadSubscriptionOverrides(): SubscriptionOverrideRecord[] {
  return (memoryStore['subscriptionOverrides'] as SubscriptionOverrideRecord[]) || [];
}

export function saveSubscriptionOverrides(overrides: SubscriptionOverrideRecord[]): void {
  saveToSupabaseStore('subscriptionOverrides', overrides);
}

export function grantBusinessBonusDays(
  businessId: string,
  days: number,
  reason: string = 'Complimentary Promotion / Free Bonus Days',
  adminUser?: AppUser
): { success: boolean; business?: Business; subscription?: Subscription; error?: string } {
  const businesses = loadBusinesses();
  const subscriptions = loadSubscriptions();
  
  const bizIndex = businesses.findIndex(b => b.id === businessId);
  if (bizIndex === -1) {
    return { success: false, error: 'Business not found' };
  }

  const biz = businesses[bizIndex];
  const subIndex = subscriptions.findIndex(s => s.businessId === businessId);
  const sub = subIndex > -1 ? subscriptions[subIndex] : null;

  const now = new Date();
  let baseExpiry = now.getTime();
  if (sub && sub.expiryDate) {
    const existingExp = new Date(sub.expiryDate).getTime();
    if (existingExp > now.getTime()) {
      baseExpiry = existingExp;
    }
  }

  const newExpiryTime = baseExpiry + (days * 24 * 60 * 60 * 1000);
  const newExpiryDate = new Date(newExpiryTime).toISOString();

  const updatedBiz: Business = {
    ...biz,
    status: 'ACTIVE',
    bonusDays: (biz.bonusDays || 0) + days,
    updatedAt: now.toISOString()
  };
  businesses[bizIndex] = updatedBiz;
  saveBusinesses(businesses);

  const updatedSub: Subscription = {
    ...(sub || {
      id: `SUB-${Date.now()}`,
      businessId: biz.id,
      businessName: biz.name,
      amount: 100000,
      monthlyFee: 100000,
      currency: 'RWF',
      createdAt: now.toISOString()
    }),
    status: 'ACTIVE',
    startDate: sub?.startDate || now.toISOString(),
    expiryDate: newExpiryDate,
    expiresAt: newExpiryDate,
    bonusDaysGranted: ((sub?.bonusDaysGranted || 0) + days),
    bonusReason: reason,
    isBonusActive: true,
    paymentMethod: sub?.paymentMethod || 'BONUS_GRANT',
    updatedAt: now.toISOString()
  };

  if (subIndex > -1) {
    subscriptions[subIndex] = updatedSub;
  } else {
    subscriptions.unshift(updatedSub);
  }
  saveSubscriptions(subscriptions);

  const overrides = loadSubscriptionOverrides();
  const overrideRec: SubscriptionOverrideRecord = {
    id: `bonus-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    businessId: biz.id,
    businessName: biz.name,
    grantedByAdmin: adminUser?.fullName || 'Super Admin',
    adminEmail: adminUser?.email || 'yuskar@gmail.com',
    reason: `[BONUS DAYS ACTIVATION] ${reason}`,
    startDate: now.toISOString(),
    expiryDate: newExpiryDate,
    daysGranted: days,
    isBonus: true,
    timestamp: now.toISOString()
  };
  overrides.unshift(overrideRec);
  saveSubscriptionOverrides(overrides);

  addAuditLog({
    userId: adminUser?.id || 'super-admin-01',
    userName: adminUser?.fullName || 'Super Admin',
    userRole: 'Super Admin',
    userEmail: adminUser?.email || 'yuskar@gmail.com',
    businessId: biz.id,
    action: 'Grant Bonus Days',
    category: 'Subscription',
    details: `Granted ${days} free bonus days to "${biz.name}". Subscription valid until ${new Date(newExpiryTime).toLocaleDateString()}. Note: ${reason}`
  });

  return {
    success: true,
    business: updatedBiz,
    subscription: updatedSub
  };
}

export function evaluateSubscriptionMetrics(sub?: Subscription | null) {
  if (!sub || sub.status === 'PENDING_PAYMENT') {
    return {
      status: 'PENDING_PAYMENT' as const,
      daysRemaining: 0,
      isGrace: false,
      warningLevel: 'expired' as const,
      message: 'Initial subscription payment required (100,000 RWF via MTN MoMo 0726134041).'
    };
  }

  if (!sub.expiryDate) {
    return {
      status: 'EXPIRED' as const,
      daysRemaining: 0,
      isGrace: false,
      warningLevel: 'expired' as const,
      message: 'Subscription has expired. Please renew for 100,000 RWF.'
    };
  }

  const now = Date.now();
  const exp = new Date(sub.expiryDate).getTime();
  const diffTime = exp - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const graceDays = sub.gracePeriodDays || 0;
  const graceExp = exp + (graceDays * 24 * 60 * 60 * 1000);

  if (now <= exp) {
    let warningLevel: '7days' | '3days' | '1day' | 'none' = 'none';
    let message = `Subscription active. ${diffDays} days remaining.`;

    if (diffDays <= 1) {
      warningLevel = '1day';
      message = 'Your subscription expires tomorrow! Please renew for 100,000 RWF to avoid service interruption.';
    } else if (diffDays <= 3) {
      warningLevel = '3days';
      message = `Your subscription expires in ${diffDays} days. Please renew for 100,000 RWF to avoid interruption.`;
    } else if (diffDays <= 7) {
      warningLevel = '7days';
      message = `Your subscription expires in ${diffDays} days. Early renewal available.`;
    }

    return {
      status: 'ACTIVE' as const,
      daysRemaining: Math.max(0, diffDays),
      isGrace: false,
      warningLevel,
      message
    };
  } else if (now <= graceExp) {
    const graceDiffDays = Math.ceil((graceExp - now) / (1000 * 60 * 60 * 24));
    return {
      status: 'GRACE_PERIOD' as const,
      daysRemaining: Math.max(0, graceDiffDays),
      isGrace: true,
      warningLevel: '1day' as const,
      message: `Account in Grace Period (${graceDiffDays} days remaining). Please settle payment of 100,000 RWF.`
    };
  } else {
    return {
      status: 'EXPIRED' as const,
      daysRemaining: 0,
      isGrace: false,
      warningLevel: 'expired' as const,
      message: 'Your subscription has expired. Please renew for 100,000 RWF to continue using the system.'
    };
  }
}

// Backend API helpers
export async function apiRegisterBusiness(data: {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  category?: string;
  address?: string;
}) {
  const res = await fetch('/api/subscription/register-business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function apiInitiateMomoPayment(businessId: string, payerPhone: string) {
  const res = await fetch('/api/subscription/momo/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId, payerPhone })
  });
  return await res.json();
}

export async function apiVerifyMomoPayment(paymentReference: string) {
  const res = await fetch(`/api/subscription/momo/verify/${encodeURIComponent(paymentReference)}`);
  return await res.json();
}

export async function apiGetBusinessSubscription(businessId: string) {
  const res = await fetch(`/api/subscription/business/${encodeURIComponent(businessId)}`);
  return await res.json();
}

export async function apiSuperAdminOverride(data: {
  businessId: string;
  adminEmail: string;
  adminPassword: string;
  reason: string;
  daysGranted: number;
}) {
  const res = await fetch('/api/subscription/super-admin/override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function apiSuperAdminSetGracePeriod(businessId: string, graceDays: number) {
  const res = await fetch('/api/subscription/super-admin/set-grace-period', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId, graceDays })
  });
  return await res.json();
}

export async function apiSuperAdminGetSaaSStats() {
  const res = await fetch('/api/subscription/super-admin/all-subscriptions');
  return await res.json();
}

export async function apiSuperAdminGetMomoConfig() {
  const res = await fetch('/api/subscription/super-admin/momo-config');
  return await res.json();
}

export async function apiSuperAdminSaveMomoConfig(config: any) {
  const res = await fetch('/api/subscription/super-admin/momo-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return await res.json();
}

export async function apiSuperAdminGetPaymentSettings() {
  const res = await fetch('/api/subscription/super-admin/payment-accounts');
  return await res.json();
}

export async function apiSuperAdminSavePaymentSettings(settings: PlatformPaymentSettings) {
  const res = await fetch('/api/subscription/super-admin/payment-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return await res.json();
}

export async function apiSuperAdminGrantBonus(data: {
  businessId: string;
  bonusDays: number;
  reason?: string;
  adminName?: string;
  adminEmail?: string;
}) {
  const res = await fetch('/api/subscription/super-admin/grant-bonus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}
