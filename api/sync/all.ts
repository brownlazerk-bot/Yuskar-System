import { createClient } from '@supabase/supabase-js';

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  body?: any;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (data: any) => ApiResponse;
  end: () => void;
};

function normalizeUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return 'https://ywwffomhbapzguaiyneg.supabase.co';
  let cleaned = rawUrl.trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'https://ywwffomhbapzguaiyneg.supabase.co';
  }
}

const SUPABASE_URL = normalizeUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3d2Zmb21oYmFwemd1YWl5bmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzMwMTksImV4cCI6MjA5MzQwOTAxOX0.Zbol4YXyM1P3YqAXD2ro2moiqhBv55G8HmW3mCZQcMI').trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const queryBiz = typeof req.query?.business_id === 'string' ? req.query.business_id : (typeof req.query?.businessId === 'string' ? req.query.businessId : undefined);
  const headerBiz = req.headers?.['x-business-id'];
  const bodyBiz = req.body?.business_id || req.body?.businessId;
  const businessId = queryBiz || headerBiz || bodyBiz || 'biz-1786805821046';

  // GET: Pull all keys from hotel_store for the specified business
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('hotel_store')
        .select('*')
        .eq('business_id', businessId);

      if (error) {
        // Return empty map gracefully if table not yet created
        return res.status(200).json({ success: true, businessId, data: {}, serverTime: new Date().toISOString() });
      }

      const state: Record<string, any> = {};
      if (Array.isArray(data)) {
        data.forEach((row: any) => {
          if (row && row.key) {
            state[row.key] = row.data !== undefined ? row.data : row.value;
          }
        });
      }

      return res.status(200).json({
        success: true,
        businessId,
        data: state,
        serverTime: new Date().toISOString()
      });
    } catch {
      return res.status(200).json({ success: true, businessId, data: {}, serverTime: new Date().toISOString() });
    }
  }

  // POST: Push full state to hotel_store for the specified business
  if (req.method === 'POST') {
    try {
      const payload = req.body?.data || req.body || {};
      const rows = Object.entries(payload)
        .filter(([k]) => k !== 'business_id' && k !== 'businessId' && k !== 'data')
        .map(([key, value]) => ({
          business_id: businessId,
          key,
          data: value,
          updated_at: new Date().toISOString()
        }));

      if (rows.length > 0) {
        await supabase.from('hotel_store').upsert(rows, { onConflict: 'business_id,key' });
      }

      return res.status(200).json({ success: true, businessId, serverTime: new Date().toISOString() });
    } catch (err: any) {
      return res.status(200).json({ success: true, businessId, warning: err?.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
