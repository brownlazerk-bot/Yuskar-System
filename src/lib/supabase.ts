import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from standard environment variables
const envUrl = (((import.meta as any).env?.VITE_SUPABASE_URL as string) || '').trim();
const envKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '').trim();

const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    envUrl && 
    envUrl.startsWith('http') && 
    !envUrl.includes('placeholder') &&
    !envUrl.includes('xyzcompany') &&
    envKey && 
    envKey.length > 20
  );
};

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured() ? envUrl : FALLBACK_URL,
  isSupabaseConfigured() ? envKey : FALLBACK_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);


