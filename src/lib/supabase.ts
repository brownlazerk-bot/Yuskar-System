import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedSupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'Vercel / Vite Environment' | 'Default Project Configuration' | 'Unconfigured';
  error?: string;
}

export const DEFAULT_PROJECT_URL = 'https://ywwffomhbapzguaiyneg.supabase.co';
export const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3d2Zmb21oYmFwemd1YWl5bmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzMwMTksImV4cCI6MjA5MzQwOTAxOX0.Zbol4YXyM1P3YqAXD2ro2moiqhBv55G8HmW3mCZQcMI';

/**
 * Normalizes a Supabase Project URL:
 * - Strips leading/trailing whitespace, quotes, backticks
 * - Prepends https:// if protocol is missing
 * - Drops all subpaths, including /rest/v1, /auth/v1, /storage/v1, etc.
 * - Guarantees the return value is strictly the root origin: https://<project-ref>.supabase.co
 */
export function normalizeSupabaseUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let cleaned = rawUrl.trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!cleaned) return null;

  // Add https protocol if omitted
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    // Filter out obvious placeholder hosts
    if (parsed.hostname.includes('placeholder') || parsed.hostname.includes('xyzcompany')) {
      return null;
    }

    // Ensure there is a valid domain/host with at least one dot
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }

    // ALWAYS return strictly the origin (protocol + host)
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Validates a Supabase URL and Anon Key combination
 */
export function validateSupabaseConfig(
  rawUrl: string | null | undefined,
  rawKey: string | null | undefined
): { valid: boolean; normalizedUrl: string; cleanKey: string; error?: string } {
  const normalizedUrl = normalizeSupabaseUrl(rawUrl);
  if (!normalizedUrl) {
    return {
      valid: false,
      normalizedUrl: '',
      cleanKey: '',
      error: 'Invalid Supabase Project URL. Expected format: https://your-project.supabase.co'
    };
  }

  const cleanKey = (rawKey || '').trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!cleanKey || cleanKey.length < 20 || cleanKey.includes('placeholder')) {
    return {
      valid: false,
      normalizedUrl,
      cleanKey: '',
      error: 'Invalid Supabase Anon API Key. Key must be a valid Supabase JWT token.'
    };
  }

  return {
    valid: true,
    normalizedUrl,
    cleanKey,
  };
}

/**
 * Resolves canonical Supabase configuration:
 * 1. Environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * 2. Default Project Configuration (https://ywwffomhbapzguaiyneg.supabase.co)
 */
export function getResolvedSupabaseConfig(): ResolvedSupabaseConfig {
  const envRawUrl = (((import.meta as any).env?.VITE_SUPABASE_URL as string) || ((import.meta as any).env?.SUPABASE_URL as string) || '').trim();
  const envRawKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || ((import.meta as any).env?.SUPABASE_ANON_KEY as string) || '').trim();

  if (envRawUrl && envRawKey) {
    const validation = validateSupabaseConfig(envRawUrl, envRawKey);
    if (validation.valid) {
      return {
        url: validation.normalizedUrl,
        anonKey: validation.cleanKey,
        isConfigured: true,
        source: 'Vercel / Vite Environment'
      };
    }
  }

  // Canonical Default Project Configuration
  const defaultValidation = validateSupabaseConfig(DEFAULT_PROJECT_URL, DEFAULT_ANON_KEY);
  if (defaultValidation.valid) {
    return {
      url: defaultValidation.normalizedUrl,
      anonKey: defaultValidation.cleanKey,
      isConfigured: true,
      source: 'Default Project Configuration'
    };
  }

  return {
    url: DEFAULT_PROJECT_URL,
    anonKey: DEFAULT_ANON_KEY,
    isConfigured: false,
    source: 'Unconfigured'
  };
}

export const isSupabaseConfigured = (): boolean => {
  return getResolvedSupabaseConfig().isConfigured;
};

const resolved = getResolvedSupabaseConfig();

// Single Canonical Supabase Client instance for the browser application
export const supabase: SupabaseClient = createClient(
  resolved.url,
  resolved.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

export function getSupabase(): SupabaseClient {
  return supabase;
}




