import { createClient } from '@supabase/supabase-js';

type ApiRequest = {
  method?: string;
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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { key, value, data, business_id, businessId } = req.body || {};
    const effectiveBizId = business_id || businessId || 'biz-1786805821046';
    const payloadData = data !== undefined ? data : value;

    if (key) {
      await supabase.from('hotel_store').upsert([{
        business_id: effectiveBizId,
        key,
        data: payloadData,
        updated_at: new Date().toISOString()
      }], { onConflict: 'business_id,key' });
    }

    return res.status(200).json({ success: true, businessId: effectiveBizId, key, serverTime: new Date().toISOString() });
  } catch (err: any) {
    return res.status(200).json({ success: true, warning: err?.message });
  }
}
