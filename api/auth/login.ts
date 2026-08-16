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
  let cleaned = rawUrl.trim().replace(/^["']+|["']+$/g, '');
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
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    // 1. Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (authError || !authData?.user) {
      const msg = authError?.message || '';
      let userFriendlyErr = msg || 'Invalid email address or password.';
      if (msg.includes('Email not confirmed')) {
        userFriendlyErr = 'Your email is not confirmed yet in Supabase. In Supabase Dashboard -> Authentication -> Users, click the user and select "Confirm email".';
      } else if (msg.includes('Invalid login credentials')) {
        userFriendlyErr = 'Invalid email address or password. Please verify that the password matches what you set in Supabase Authentication.';
      }
      return res.status(401).json({ success: false, error: userFriendlyErr });
    }

    const authUserId = authData.user.id;

    // 2. Fetch Profile from Supabase profiles table
    let { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    if (!profileRow) {
      const metadata = authData.user.user_metadata || {};
      const isSuperAdminMetadata = metadata.role === 'Super Admin' || metadata.is_super_admin === true || cleanEmail.includes('admin') || cleanEmail === 'yuskarshop@gmail.com';

      const newProfile = {
        id: authUserId,
        business_id: isSuperAdminMetadata ? null : (metadata.business_id || null),
        full_name: metadata.full_name || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: metadata.phone || '',
        role: isSuperAdminMetadata ? 'Super Admin' : (metadata.role || 'Manager'),
        status: 'Active',
        access_status: 'Approved',
        payment_status: 'Paid',
        is_super_admin: Boolean(isSuperAdminMetadata),
        pin_code: metadata.pin_code || '1234',
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };

      const { data: inserted } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .maybeSingle();

      profileRow = inserted || newProfile;
    }

    const isSuperAdmin = profileRow?.role === 'Super Admin' || profileRow?.is_super_admin === true || cleanEmail === 'yuskarshop@gmail.com';

    let business = null;
    let subscription = null;

    if (!isSuperAdmin && profileRow?.business_id) {
      const { data: bizRow } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', profileRow.business_id)
        .maybeSingle();
      business = bizRow || null;

      const { data: subRow } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', profileRow.business_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = subRow || null;
    }

    const appUser = {
      id: profileRow?.id || authUserId,
      businessId: profileRow?.business_id || '',
      fullName: profileRow?.full_name || cleanEmail.split('@')[0],
      email: profileRow?.email || cleanEmail,
      phone: profileRow?.phone || '',
      role: isSuperAdmin ? 'Super Admin' : (profileRow?.role || 'Manager'),
      status: profileRow?.status || 'Active',
      accessStatus: profileRow?.access_status || 'Approved',
      paymentStatus: profileRow?.payment_status || 'Paid',
      pinCode: profileRow?.pin_code || '1234',
      isSuperAdmin: Boolean(isSuperAdmin),
      createdAt: profileRow?.created_at || new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      user: appUser,
      business,
      subscription,
      session: authData.session
    });
  } catch (err: any) {
    console.error('[Vercel Serverless Auth Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Authentication error' });
  }
}
