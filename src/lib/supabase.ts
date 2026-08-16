import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedSupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'Vercel / Vite Environment' | 'Local Configuration' | 'Unconfigured';
  error?: string;
}

/**
 * Normalizes a Supabase Project URL:
 * - Strips leading/trailing whitespace & quotes
 * - Prepends https:// if protocol is missing
 * - Removes accidental API paths (/rest/v1, /auth/v1, /storage/v1, etc.)
 * - Returns only the root project URL: https://PROJECT_REF.supabase.co
 */
export function normalizeSupabaseUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let cleaned = rawUrl.trim().replace(/^["']+|["']+$/g, '');
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

    // Ensure there is a valid domain/host
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }

    // Always return root origin (e.g. https://ywwffomhbapzguaiyneg.supabase.co)
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

  const cleanKey = (rawKey || '').trim().replace(/^["']+|["']+$/g, '');
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

const FALLBACK_URL = 'https://placeholder-project.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

/**
 * Resolves Supabase configuration with strict priority:
 * 1. VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (Vercel / Vite Environment)
 * 2. Saved localStorage configuration (Only if environment variables are not provided)
 * 3. Safe fallback placeholder
 */
export function getResolvedSupabaseConfig(): ResolvedSupabaseConfig {
  // PRIORITY 1: Environment Variables (Vercel / Vite)
  const envRawUrl = (((import.meta as any).env?.VITE_SUPABASE_URL as string) || '').trim();
  const envRawKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '').trim();

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

  // PRIORITY 2: LocalStorage (Only if env vars not provided)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('hotel_supabase_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const validation = validateSupabaseConfig(parsed.url, parsed.anonKey);
          if (validation.valid && parsed.enabled !== false) {
            return {
              url: validation.normalizedUrl,
              anonKey: validation.cleanKey,
              isConfigured: true,
              source: 'Local Configuration'
            };
          }
        }
      }
    } catch {
      // Ignore localStorage parse error
    }
  }

  // PRIORITY 3: Safe Unconfigured Fallback
  return {
    url: FALLBACK_URL,
    anonKey: FALLBACK_KEY,
    isConfigured: false,
    source: 'Unconfigured'
  };
}

export const isSupabaseConfigured = (): boolean => {
  return getResolvedSupabaseConfig().isConfigured;
};

const resolved = getResolvedSupabaseConfig();

// Safe diagnostic logging (never exposes secret or full key)
if (typeof window !== 'undefined') {
  const maskedKey = resolved.anonKey && resolved.anonKey.length > 10
    ? `${resolved.anonKey.slice(0, 6)}...${resolved.anonKey.slice(-4)}`
    : 'none';

  console.log('%c[Supabase Config]', 'color: #0284c7; font-weight: bold;', {
    source: resolved.source,
    url: resolved.url,
    configured: resolved.isConfigured,
    keyMasked: maskedKey
  });
}

// Global Unified Supabase Client
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



