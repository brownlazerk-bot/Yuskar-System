import { getSupabaseClient } from './supabaseSync';
import { getActiveBusinessId, getScopedKey, loadMenuItems, saveMenuItems, normalizeBusinessUuid, DEFAULT_RESORT_UUID } from './storage';
import { MenuItem } from '../types';

export interface LocalInspectionResult {
  businessId: string;
  foundInScopedKey: boolean;
  foundInBaseKey: boolean;
  activeKeyUsed: string;
  itemCount: number;
  items: any[];
  firstFewItems: { id: string; name: string; price: number; category: string }[];
  lastFewItems: { id: string; name: string; price: number; category: string }[];
  idTypesSummary: {
    uuidCount: number;
    customIdCount: number;
    numericStringCount: number;
    sampleIds: string[];
  };
}

export interface SupabaseInspectionResult {
  businessId: string;
  exists: boolean;
  itemCount: number;
  updatedAt: string | null;
  items: any[];
  firstFewItems: { id: string; name: string; price: number; category: string }[];
  sampleIds: string[];
}

export interface MergeAnalysisResult {
  localCount: number;
  supabaseCount: number;
  overlapCount: number;
  localAlreadyIncludesSupabase: boolean;
  finalMergedCount: number;
  duplicateIdsFound: string[];
  mergedItems: any[];
  backupKey: string;
}

export interface SafeMigrationResult {
  success: boolean;
  businessId: string;
  backupKey: string;
  localCount: number;
  supabaseOldCount: number;
  mergedCount: number;
  upsertResult?: any;
  error?: any;
  verifiedDatabaseCount?: number;
  verifiedUpdatedAt?: string;
  timestamp: string;
}

const MENU_ITEMS_BASE_KEY = 'hotel_menu_items_prod';

/**
 * Inspects browser localStorage for menu items under scoped and base keys.
 */
export function inspectLocalMenuItems(businessId?: string): LocalInspectionResult {
  const resolvedBizId = normalizeBusinessUuid(businessId || getActiveBusinessId());
  const scopedKey = `hotel_${resolvedBizId}_menu_items_prod`;
  const rawScoped = typeof localStorage !== 'undefined' ? localStorage.getItem(scopedKey) : null;
  const rawBase = typeof localStorage !== 'undefined' ? localStorage.getItem(MENU_ITEMS_BASE_KEY) : null;

  let chosenKey = '';
  let rawData: string | null = null;

  if (rawScoped && rawScoped.trim().length > 2) {
    chosenKey = scopedKey;
    rawData = rawScoped;
  } else if (rawBase && rawBase.trim().length > 2) {
    chosenKey = MENU_ITEMS_BASE_KEY;
    rawData = rawBase;
  } else {
    chosenKey = scopedKey;
  }

  let items: any[] = [];
  if (rawData) {
    try {
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        items = parsed;
      }
    } catch (e) {
      console.error('[Migration Inspector] Failed to parse local menu items:', e);
    }
  }

  // Fallback to storage helper if both empty
  if (items.length === 0) {
    try {
      items = loadMenuItems();
    } catch {}
  }

  const sampleCount = Math.min(3, items.length);
  const firstFew = items.slice(0, sampleCount).map(i => ({
    id: String(i.id || ''),
    name: String(i.name || ''),
    price: Number(i.price || 0),
    category: String(i.category || '')
  }));

  const lastFew = items.slice(-sampleCount).map(i => ({
    id: String(i.id || ''),
    name: String(i.name || ''),
    price: Number(i.price || 0),
    category: String(i.category || '')
  }));

  let uuidCount = 0;
  let numericStringCount = 0;
  let customIdCount = 0;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  items.forEach(i => {
    const idStr = String(i.id || '');
    if (uuidRegex.test(idStr)) {
      uuidCount++;
    } else if (/^\d+$/.test(idStr)) {
      numericStringCount++;
    } else {
      customIdCount++;
    }
  });

  return {
    businessId,
    foundInScopedKey: !!rawScoped,
    foundInBaseKey: !!rawBase,
    activeKeyUsed: chosenKey,
    itemCount: items.length,
    items,
    firstFewItems: firstFew,
    lastFewItems: lastFew,
    idTypesSummary: {
      uuidCount,
      customIdCount,
      numericStringCount,
      sampleIds: items.slice(0, 5).map(i => String(i.id))
    }
  };
}

/**
 * Fetches the existing menuItems record directly from Supabase public.hotel_store
 */
export async function fetchSupabaseMenuItems(businessId?: string): Promise<SupabaseInspectionResult> {
  const resolvedBizId = normalizeBusinessUuid(businessId || getActiveBusinessId());
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await client
    .from('hotel_store')
    .select('key, business_id, data, updated_at')
    .eq('business_id', resolvedBizId)
    .eq('key', 'menuItems')
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  if (!data || !data.data) {
    return {
      businessId: resolvedBizId,
      exists: false,
      itemCount: 0,
      updatedAt: null,
      items: [],
      firstFewItems: [],
      sampleIds: []
    };
  }

  const items = Array.isArray(data.data) ? data.data : [];
  const firstFew = items.slice(0, 3).map((i: any) => ({
    id: String(i.id || ''),
    name: String(i.name || ''),
    price: Number(i.price || 0),
    category: String(i.category || '')
  }));

  return {
    businessId,
    exists: true,
    itemCount: items.length,
    updatedAt: data.updated_at,
    items,
    firstFewItems: firstFew,
    sampleIds: items.map((i: any) => String(i.id))
  };
}

/**
 * Safely creates a recoverable backup of both Supabase and Local datasets before writing.
 */
export function createRecoverableBackup(
  businessId: string,
  supabaseData: any,
  localData: any
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupKey = `hotel_migration_backup_${businessId}_${timestamp}`;

  const payload = {
    backupKey,
    createdAt: new Date().toISOString(),
    businessId,
    supabaseRecord: supabaseData,
    localData: localData,
    meta: {
      supabaseItemCount: Array.isArray(supabaseData?.items) ? supabaseData.items.length : 0,
      localItemCount: Array.isArray(localData) ? localData.length : 0
    }
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(backupKey, JSON.stringify(payload));
      localStorage.setItem(`hotel_latest_backup_pointer_${businessId}`, backupKey);
    }
    console.log(`[Safety Backup] Saved recoverable backup to "${backupKey}".`);
  } catch (err) {
    console.error('[Safety Backup] Error writing localStorage backup:', err);
  }

  return backupKey;
}

/**
 * Compares local vs Supabase items, detects overlap, and merges without duplicates.
 */
export function safeMergeMenuItems(
  supabaseItems: any[],
  localItems: any[],
  businessId: string
): MergeAnalysisResult {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const merged: any[] = [];
  const duplicateIds: string[] = [];
  let overlapCount = 0;

  // Index Supabase items
  const supabaseIdMap = new Map<string, any>();
  const supabaseNameMap = new Map<string, any>();
  supabaseItems.forEach(item => {
    if (item.id) supabaseIdMap.set(String(item.id), item);
    if (item.name) supabaseNameMap.set(String(item.name).trim().toLowerCase(), item);
  });

  // Check how many Supabase items are already present in local
  supabaseItems.forEach(sItem => {
    const sId = String(sItem.id || '');
    const sName = String(sItem.name || '').trim().toLowerCase();
    const inLocal = localItems.some(lItem => 
      (sId && String(lItem.id) === sId) || 
      (sName && String(lItem.name).trim().toLowerCase() === sName)
    );
    if (inLocal) {
      overlapCount++;
    }
  });

  const localAlreadyIncludesSupabase = overlapCount === supabaseItems.length;

  // Add all local items first (since local items have latest edits/new products)
  localItems.forEach(item => {
    const idKey = String(item.id || '');
    const nameKey = String(item.name || '').trim().toLowerCase();

    if (idKey && seenIds.has(idKey)) {
      duplicateIds.push(idKey);
      return;
    }
    if (nameKey && seenNames.has(nameKey)) {
      return; // Skip duplicate name
    }

    if (idKey) seenIds.add(idKey);
    if (nameKey) seenNames.add(nameKey);
    merged.push(item);
  });

  // If any Supabase item was missing from local, add it to merged
  supabaseItems.forEach(sItem => {
    const idKey = String(sItem.id || '');
    const nameKey = String(sItem.name || '').trim().toLowerCase();

    if (idKey && seenIds.has(idKey)) return;
    if (nameKey && seenNames.has(nameKey)) return;

    if (idKey) seenIds.add(idKey);
    if (nameKey) seenNames.add(nameKey);
    merged.push(sItem);
  });

  const backupKey = createRecoverableBackup(businessId, { items: supabaseItems }, localItems);

  return {
    localCount: localItems.length,
    supabaseCount: supabaseItems.length,
    overlapCount,
    localAlreadyIncludesSupabase,
    finalMergedCount: merged.length,
    duplicateIdsFound: duplicateIds,
    mergedItems: merged,
    backupKey
  };
}

/**
 * Executes the complete safe migration to Supabase public.hotel_store with verification.
 */
export async function executeSafeMenuItemsMigration(
  businessId?: string
): Promise<SafeMigrationResult> {
  const resolvedBizId = normalizeBusinessUuid(businessId || getActiveBusinessId());
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      businessId: resolvedBizId,
      backupKey: '',
      localCount: 0,
      supabaseOldCount: 0,
      mergedCount: 0,
      error: 'Supabase client is not configured',
      timestamp: new Date().toISOString()
    };
  }

  // 1. Inspect Local
  const localInspection = inspectLocalMenuItems(resolvedBizId);

  // 2. Fetch Supabase existing record
  const supabaseInspection = await fetchSupabaseMenuItems(resolvedBizId);

  // 3. Safely Merge and Backup
  const mergeAnalysis = safeMergeMenuItems(
    supabaseInspection.items,
    localInspection.items,
    resolvedBizId
  );

  const mergedPayload = {
    business_id: resolvedBizId,
    key: 'menuItems',
    data: mergeAnalysis.mergedItems,
    updated_at: new Date().toISOString()
  };

  // 4. Write to Supabase with onConflict and explicit error inspection
  const { data: upsertData, error: upsertError } = await client
    .from('hotel_store')
    .upsert([mergedPayload], { onConflict: 'business_id,key' });

  if (upsertError) {
    console.error('[Migration Error] Supabase upsert failed:', upsertError);
    return {
      success: false,
      businessId: resolvedBizId,
      backupKey: mergeAnalysis.backupKey,
      localCount: mergeAnalysis.localCount,
      supabaseOldCount: mergeAnalysis.supabaseCount,
      mergedCount: mergeAnalysis.finalMergedCount,
      error: upsertError,
      timestamp: new Date().toISOString()
    };
  }

  // 5. Update active in-memory store with merged dataset
  try {
    saveMenuItems(mergeAnalysis.mergedItems);
  } catch (e) {
    console.warn('[Migration Warning] Could not update storage cache:', e);
  }

  // 6. Direct Verification Query
  const { data: verifyData } = await client
    .from('hotel_store')
    .select('key, business_id, data, updated_at')
    .eq('business_id', resolvedBizId)
    .eq('key', 'menuItems')
    .single();

  const verifiedDatabaseCount = verifyData && Array.isArray(verifyData.data)
    ? verifyData.data.length
    : (verifyData?.data ? 1 : 0);

  return {
    success: true,
    businessId: resolvedBizId,
    backupKey: mergeAnalysis.backupKey,
    localCount: mergeAnalysis.localCount,
    supabaseOldCount: mergeAnalysis.supabaseCount,
    mergedCount: mergeAnalysis.finalMergedCount,
    upsertResult: upsertData,
    verifiedDatabaseCount,
    verifiedUpdatedAt: verifyData?.updated_at,
    timestamp: new Date().toISOString()
  };
}

/**
 * General multi-dataset verification for active business
 */
export async function verifySupabaseBusinessData(businessId?: string): Promise<{
  success: boolean;
  businessId: string;
  rows: { key: string; count: number; updatedAt: string; dataSample?: any }[];
  error?: string;
}> {
  const resolvedBizId = normalizeBusinessUuid(businessId || getActiveBusinessId());
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, businessId: resolvedBizId, rows: [], error: 'Supabase client not configured' };
  }

  try {
    const { data, error } = await client
      .from('hotel_store')
      .select('key, business_id, updated_at, data')
      .eq('business_id', resolvedBizId)
      .order('updated_at', { ascending: false });

    if (error) {
      return { success: false, businessId: resolvedBizId, rows: [], error: error.message };
    }

    const rows = (data || []).map(r => ({
      key: r.key,
      count: Array.isArray(r.data) ? r.data.length : (r.data ? 1 : 0),
      updatedAt: r.updated_at,
      dataSample: Array.isArray(r.data) ? r.data.slice(0, 2) : r.data
    }));

    return { success: true, businessId: resolvedBizId, rows };
  } catch (err: any) {
    return { success: false, businessId: resolvedBizId, rows: [], error: err.message || String(err) };
  }
}
