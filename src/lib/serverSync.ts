import { fetchAllBusinessDataFromSupabase, getActiveBusinessId } from './storage';

export function recordLocalWrite(_serverKey: string): void {
  // No-op in Supabase Cloud architecture
}

export function mergeArraysByKey(localData: any, incomingData: any): any {
  if (!Array.isArray(localData)) return incomingData;
  if (!Array.isArray(incomingData)) return localData;
  return incomingData;
}

export async function pullServerState(_businessId?: string): Promise<{ success: boolean; data?: any }> {
  const bizId = _businessId || getActiveBusinessId();
  const res = await fetchAllBusinessDataFromSupabase(bizId);
  return { success: res.success, data: res };
}

export async function pushServerState(_key: string, _data: any, _businessId?: string): Promise<{ success: boolean }> {
  return { success: true };
}

export function startServerSyncPolling(_intervalMs: number = 3000): () => void {
  return () => {};
}
