import { 
  loadMenuItems, saveMenuItems, loadOrders, saveOrders, 
  loadKitchenTickets, saveKitchenTickets, loadTables, saveTables, 
  loadWaiters, saveWaiters, loadStockLogs, saveStockLogs, 
  loadShifts, saveShifts, loadGuestRooms, saveGuestRooms, 
  loadExpenses, saveExpenses, loadCashMovements, saveCashMovements, 
  loadDailyClosings, saveDailyClosings, loadUsers, saveUsers, 
  loadAuditLogs, loadIngredients, saveIngredients, loadRecipes, saveRecipes, 
  loadPurchaseOrders, savePurchaseOrders, loadStockMovementRecords, 
  saveStockMovementRecords, loadWasteRecords, saveWasteRecords,
  getSyncStatus, subscribeToSyncStatus, notifyDataChange, subscribeToDataChanges,
  SyncStatusInfo
} from './storage';

export { getSyncStatus, subscribeToSyncStatus, notifyDataChange, type SyncStatusInfo };

export interface DatabaseBackup {
  id: string;
  createdAt: string;
  createdBy: string;
  version: string;
  data: {
    menuItems: any[];
    tables: any[];
    waiters: any[];
    orders: any[];
    kitchenTickets: any[];
    stockLogs: any[];
    shifts: any[];
    guestRooms: any[];
    expenses: any[];
    cashMovements: any[];
    dailyClosings: any[];
    users: any[];
    auditLogs: any[];
    ingredients?: any[];
    recipes?: any[];
    purchaseOrders?: any[];
    stockMovements?: any[];
    wasteRecords?: any[];
  };
}

let inMemoryBackups: DatabaseBackup[] = [];

/**
 * Subscribe to real-time data sync notifications across components
 */
export function subscribeToSync(onSync: (entityKey: string) => void): () => void {
  return subscribeToDataChanges(onSync);
}

export function queueOfflineTransaction(_actionType: string, _payload: any): void {
  // No-op for Supabase Cloud First architecture
}

export function getPendingOfflineCount(): number {
  return 0;
}

export function flushOfflineQueue(): void {
  // No-op for Supabase Cloud First architecture
}

/**
 * Creates an in-memory or downloadable snapshot backup of current business database
 */
export function createDailyBackup(userName: string = 'System Auto-Backup'): DatabaseBackup {
  const backup: DatabaseBackup = {
    id: `BKP-${new Date().toISOString().split('T')[0]}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    createdBy: userName,
    version: '2.0.0',
    data: {
      menuItems: loadMenuItems(),
      tables: loadTables(),
      waiters: loadWaiters(),
      orders: loadOrders(),
      kitchenTickets: loadKitchenTickets(),
      stockLogs: loadStockLogs(),
      shifts: loadShifts(),
      guestRooms: loadGuestRooms(),
      expenses: loadExpenses(),
      cashMovements: loadCashMovements(),
      dailyClosings: loadDailyClosings(),
      users: loadUsers(),
      auditLogs: loadAuditLogs(),
      ingredients: loadIngredients(),
      recipes: loadRecipes(),
      purchaseOrders: loadPurchaseOrders(),
      stockMovements: loadStockMovementRecords(),
      wasteRecords: loadWasteRecords()
    }
  };

  inMemoryBackups = [backup, ...inMemoryBackups].slice(0, 30);
  return backup;
}

export function loadBackups(): DatabaseBackup[] {
  return inMemoryBackups;
}

export function restoreBackupSnapshot(backup: DatabaseBackup): boolean {
  try {
    if (!backup || !backup.data) return false;

    if (Array.isArray(backup.data.menuItems)) saveMenuItems(backup.data.menuItems);
    if (Array.isArray(backup.data.tables)) saveTables(backup.data.tables);
    if (Array.isArray(backup.data.waiters)) saveWaiters(backup.data.waiters);
    if (Array.isArray(backup.data.orders)) saveOrders(backup.data.orders);
    if (Array.isArray(backup.data.kitchenTickets)) saveKitchenTickets(backup.data.kitchenTickets);
    if (Array.isArray(backup.data.stockLogs)) saveStockLogs(backup.data.stockLogs);
    if (Array.isArray(backup.data.shifts)) saveShifts(backup.data.shifts);
    if (Array.isArray(backup.data.guestRooms)) saveGuestRooms(backup.data.guestRooms);
    if (Array.isArray(backup.data.expenses)) saveExpenses(backup.data.expenses);
    if (Array.isArray(backup.data.cashMovements)) saveCashMovements(backup.data.cashMovements);
    if (Array.isArray(backup.data.dailyClosings)) saveDailyClosings(backup.data.dailyClosings);
    if (Array.isArray(backup.data.users)) saveUsers(backup.data.users);
    if (Array.isArray(backup.data.ingredients)) saveIngredients(backup.data.ingredients);
    if (Array.isArray(backup.data.recipes)) saveRecipes(backup.data.recipes);
    if (Array.isArray(backup.data.purchaseOrders)) savePurchaseOrders(backup.data.purchaseOrders);
    if (Array.isArray(backup.data.stockMovements)) saveStockMovementRecords(backup.data.stockMovements);
    if (Array.isArray(backup.data.wasteRecords)) saveWasteRecords(backup.data.wasteRecords);

    notifyDataChange('all');
    return true;
  } catch (e) {
    console.error('Failed to restore backup snapshot:', e);
    return false;
  }
}
