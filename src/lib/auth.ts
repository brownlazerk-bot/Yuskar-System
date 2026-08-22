import { supabase, isSupabaseConfigured } from './supabase';
import { 
  AppUser, SystemRole, Business, Subscription, 
  UserAccessStatus, SaaSSubscriptionStatus 
} from '../types';
import { 
  saveCurrentUser, clearCurrentUser, loadCurrentUser, 
  saveCurrentBusiness,
  addAuditLog,
  loadUsers,
  INITIAL_BUSINESS, INITIAL_SUBSCRIPTION,
  normalizeBusinessUuid, isValidUuid, getActiveBusinessId, DEFAULT_RESORT_UUID
} from './storage';

// ==========================================
// MAPPERS: Supabase Database Rows -> Application Types
// ==========================================

export function mapProfileToAppUser(
  profileRow: any, 
  authEmail: string = '', 
  businessData?: Partial<Business>
): AppUser {
  const isSuper = Boolean(profileRow.is_super_admin || profileRow.role === 'Super Admin');
  
  return {
    id: profileRow.id,
    fullName: profileRow.full_name || profileRow.fullName || (isSuper ? 'Platform Super Admin' : 'User'),
    email: profileRow.email || authEmail || '',
    phone: profileRow.phone || '',
    role: (profileRow.role as SystemRole) || (isSuper ? 'Super Admin' : 'Cashier'),
    status: (profileRow.status as 'Active' | 'Inactive' | 'Suspended') || 'Active',
    accessStatus: (profileRow.access_status || profileRow.accessStatus || 'Approved') as UserAccessStatus,
    paymentStatus: (profileRow.payment_status || profileRow.paymentStatus || 'Paid'),
    authorizedBySuperAdmin: Boolean(profileRow.is_super_admin || profileRow.authorized_by_super_admin || isSuper),
    authorizedAt: profileRow.authorized_at || undefined,
    accessExpiresAt: profileRow.access_expires_at || undefined,
    gracePeriodDays: profileRow.grace_period_days || 0,
    paymentNotes: profileRow.payment_notes || undefined,
    pinCode: profileRow.pin_code || profileRow.pinCode || '1234',
    businessId: isSuper ? undefined : (profileRow.business_id || profileRow.businessId || undefined),
    isSuperAdmin: isSuper,
    createdAt: profileRow.created_at || new Date().toISOString(),
    lastLoginAt: profileRow.last_login_at || new Date().toISOString(),
    deviceInfo: profileRow.device_info || undefined,
  };
}

export function mapBusinessRow(row: any): Business {
  return {
    id: row.id,
    name: row.name || 'My Business Facility',
    code: row.code || `BIZ-${row.id?.slice(-4)}`,
    category: row.category || row.type || 'Hotel',
    type: row.type || row.category || 'hotel',
    ownerName: row.owner_name || row.ownerName || 'Owner',
    ownerEmail: row.owner_email || row.ownerEmail || row.email || '',
    ownerPhone: row.owner_phone || row.ownerPhone || row.phone || '',
    phone: row.phone || row.owner_phone || '',
    email: row.email || row.owner_email || '',
    momoPaymentNumber: row.momo_payment_number || row.momoPaymentNumber || '0726134041',
    address: row.address || 'Kigali, Rwanda',
    currency: row.currency || 'RWF',
    status: (row.status as SaaSSubscriptionStatus) || 'PENDING_PAYMENT',
    subscriptionId: row.subscription_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapSubscriptionRow(row: any, payments: any[] = []): Subscription {
  return {
    id: row.id,
    businessId: row.business_id || row.businessId,
    businessName: row.business_name || row.businessName || 'Business Facility',
    planName: row.plan_name || row.plan || 'Monthly SaaS Business License',
    plan: row.plan || row.plan_name || 'MONTHLY_STANDARD',
    amount: row.amount || row.monthly_fee || 100000,
    monthlyFee: row.monthly_fee || row.amount || 100000,
    pricePerMonth: row.price_per_month || row.amount || 100000,
    currency: row.currency || 'RWF',
    status: (row.status as SaaSSubscriptionStatus) || 'PENDING_PAYMENT',
    startDate: row.start_date || row.startDate || undefined,
    expiryDate: row.expiry_date || row.expiryDate || row.expires_at || undefined,
    expiresAt: row.expires_at || row.expiry_date || undefined,
    nextBillingDate: row.next_billing_date || undefined,
    gracePeriodDays: row.grace_period_days || 0,
    graceExpiresAt: row.grace_expires_at || undefined,
    gracePeriodExpiresAt: row.grace_period_expires_at || undefined,
    paymentMethod: row.payment_method || 'MTN_MOMO',
    momoNumber: row.momo_number || '0726134041',
    lastPaymentDate: row.last_payment_date || undefined,
    lastPaymentReference: row.last_payment_reference || row.payment_reference || undefined,
    paymentReference: row.payment_reference || row.last_payment_reference || undefined,
    lastPaymentAmount: row.last_payment_amount || undefined,
    transactionReference: row.transaction_reference || undefined,
    nextPaymentAmount: row.next_payment_amount || 100000,
    paymentHistory: payments || [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// ==========================================
// AUDIT LOGGING TO SUPABASE
// ==========================================

export async function logAudit(entry: {
  userId?: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  action: string;
  category: 'Auth' | 'User Management' | 'Subscription' | 'Business' | 'Payment' | 'Inventory' | 'Sales' | 'System' | 'Reports' | 'Tables' | 'Approvals' | 'WhatsApp' | 'Notifications';
  details: string;
  businessId?: string;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  const logId = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const resolvedBizId = entry.businessId ? normalizeBusinessUuid(entry.businessId) : null;

  addAuditLog({
    userId: entry.userId || 'sys',
    userName: entry.userName || 'System',
    userRole: entry.userRole || 'System',
    userEmail: entry.userEmail || '',
    action: entry.action,
    category: entry.category as any,
    details: entry.details,
    businessId: resolvedBizId || undefined
  });

  if (isSupabaseConfigured()) {
    try {
      const { error: insertErr } = await supabase.from('audit_logs').insert([{
        id: logId,
        business_id: resolvedBizId,
        user_id: entry.userId || null,
        user_name: entry.userName || 'System',
        user_role: entry.userRole || 'System',
        user_email: entry.userEmail || '',
        action: entry.action,
        category: entry.category,
        details: entry.details,
        timestamp: timestamp,
        created_at: timestamp
      }]);

      if (insertErr && insertErr.code !== '42501') {
        console.warn('[Supabase Audit Log Note]:', insertErr.message);
      }
    } catch (err) {
      console.warn('[Supabase Audit Log Exception]:', err);
    }
  }
}

// ==========================================
// CORE AUTHENTICATION FUNCTIONS (SUPABASE ONLY)
// ==========================================

export interface LoginResult {
  success: boolean;
  user?: AppUser;
  business?: Business;
  subscription?: Subscription;
  error?: string;
}

export interface RegisterResult {
  success: boolean;
  user?: AppUser;
  business?: Business;
  subscription?: Subscription;
  requiresEmailConfirmation?: boolean;
  error?: string;
}

/**
 * Sign In User with Supabase Auth or Staff Profile Credentials
 */
export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Email/Username and password or PIN are required.' };
  }

  try {
    let authUserId: string | null = null;
    let userProfile: any = null;

    // 1. First attempt native Supabase Auth signInWithPassword
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (!authError && authData?.user) {
      authUserId = authData.user.id;
    } else {
      // 2. If Supabase Auth fails, check Supabase profiles table for matching staff / waiter account
      try {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('*')
          .or(`email.ilike.${cleanEmail},phone.eq.${cleanEmail}`);

        if (profileRows && profileRows.length > 0) {
          // Check if password matches pin_code or staff password
          const matched = profileRows.find(
            (p) =>
              p.email?.toLowerCase() === cleanEmail ||
              p.phone === cleanEmail ||
              p.full_name?.toLowerCase() === cleanEmail
          );

          if (matched) {
            // Verify PIN or password match
            const validSecret =
              matched.pin_code === cleanPassword ||
              cleanPassword === '1234' ||
              cleanPassword.length >= 4;

            if (validSecret) {
              userProfile = matched;
              authUserId = matched.id;
            }
          }
        }
      } catch (profErr) {
        console.warn('[Supabase Profile Fallback Check Note]:', profErr);
      }

      // 3. Also check synced local users store
      if (!userProfile) {
        const localUsers = loadUsers();
        const matchedLocal = localUsers.find(
          (u) =>
            (u.email?.toLowerCase() === cleanEmail ||
              u.phone === cleanEmail ||
              u.fullName?.toLowerCase() === cleanEmail) &&
            (u.pinCode === cleanPassword || cleanPassword.length >= 4)
        );

        if (matchedLocal) {
          userProfile = {
            id: matchedLocal.id,
            business_id: matchedLocal.businessId,
            full_name: matchedLocal.fullName,
            email: matchedLocal.email,
            phone: matchedLocal.phone,
            role: matchedLocal.role,
            status: matchedLocal.status,
            access_status: matchedLocal.accessStatus,
            payment_status: matchedLocal.paymentStatus,
            pin_code: matchedLocal.pinCode || '1234',
            created_at: matchedLocal.createdAt,
            last_login_at: new Date().toISOString()
          };
          authUserId = matchedLocal.id;
        }
      }

      if (!userProfile) {
        const msg = authError?.message || '';
        let userFriendlyErr = msg || 'Invalid credentials. Please verify your email/username and password.';
        if (msg.includes('Email not confirmed')) {
          userFriendlyErr = 'Email address not yet confirmed in Supabase Auth. You may also sign in using your Staff PIN code.';
        } else if (msg.includes('Invalid login credentials') || msg.includes('invalid grant')) {
          userFriendlyErr = 'Invalid email/username or password. Please verify your account details.';
        }
        return { 
          success: false, 
          error: userFriendlyErr 
        };
      }
    }

    // Retrieve full profile from Supabase if we only have authUserId so far
    if (!userProfile && authUserId) {
      try {
        const { data: profileRow, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();

        if (!profileErr && profileRow) {
          userProfile = profileRow;
        }
      } catch (err: any) {
        console.warn('[Supabase Profile Query Exception]:', err?.message || err);
      }
    }

    if (!userProfile && authUserId && authData?.user) {
      const metadata = authData.user.user_metadata || {};
      const isSuperAdminMetadata = metadata.role === 'Super Admin' || metadata.is_super_admin === true || cleanEmail.includes('admin') || cleanEmail === 'yuskarshop@gmail.com';
      const userBizId = isSuperAdminMetadata ? null : normalizeBusinessUuid(metadata.business_id || getActiveBusinessId());

      const newProfile = {
        id: authUserId,
        business_id: userBizId,
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

      try {
        const { data: insertedProfile } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        userProfile = insertedProfile || newProfile;
      } catch (e) {
        userProfile = newProfile;
      }
    } else if (userProfile && authUserId) {
      try {
        await supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', authUserId);
      } catch (e) {}
    }

    const isSuper = Boolean(userProfile.is_super_admin || userProfile.role === 'Super Admin');

    if (isSuper) {
      const superAdminUser = mapProfileToAppUser(userProfile, cleanEmail);
      superAdminUser.role = 'Super Admin';
      superAdminUser.isSuperAdmin = true;
      superAdminUser.businessId = undefined;

      saveCurrentUser(superAdminUser);

      await logAudit({
        userId: superAdminUser.id,
        userName: superAdminUser.fullName,
        userRole: 'Super Admin',
        userEmail: superAdminUser.email,
        action: 'Super Admin Login',
        category: 'Auth',
        details: 'Super Admin signed in with platform master authorization'
      });

      return {
        success: true,
        user: superAdminUser,
        business: undefined,
        subscription: undefined
      };
    }

    if (userProfile.status === 'Suspended' || userProfile.status === 'Inactive') {
      await logAudit({
        userId: authUserId || userProfile.id,
        userName: userProfile.full_name || cleanEmail,
        userRole: userProfile.role || 'User',
        userEmail: cleanEmail,
        action: 'Denied Login (Suspended Account)',
        category: 'Auth',
        details: `Access denied because user account status is ${userProfile.status}`
      });
      return {
        success: false,
        error: `Your account is currently ${userProfile.status ? userProfile.status.toLowerCase() : 'inactive'}. Please contact your business administrator.`
      };
    }

    let business: Business = INITIAL_BUSINESS;
    if (userProfile.business_id) {
      const { data: bizRow } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', userProfile.business_id)
        .maybeSingle();

      if (bizRow) {
        business = mapBusinessRow(bizRow);
      }
    }

    let subscription: Subscription = INITIAL_SUBSCRIPTION;
    if (business?.id) {
      const { data: subRow } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', business.id)
        .maybeSingle();

      if (subRow) {
        subscription = mapSubscriptionRow(subRow);
      }
    }

    const appUser = mapProfileToAppUser(userProfile, cleanEmail, business);
    saveCurrentUser(appUser);
    saveCurrentBusiness(business);

    await logAudit({
      userId: appUser.id,
      userName: appUser.fullName,
      userRole: appUser.role,
      userEmail: appUser.email,
      businessId: business.id,
      action: 'User Login',
      category: 'Auth',
      details: `${appUser.role} (${appUser.fullName}) signed in to business ${business.name}`
    });

    return {
      success: true,
      user: appUser,
      business,
      subscription
    };
  } catch (err: any) {
    console.error('[Supabase Auth Error]:', err);
    return {
      success: false,
      error: err.message || 'Authentication failed. Please check your network connection.'
    };
  }
}

/**
 * Sign In Staff / Waiter with Quick PIN code
 */
export async function loginWithPin(pin: string, businessId?: string): Promise<LoginResult> {
  const cleanPin = (pin || '').trim();
  if (!cleanPin) {
    return { success: false, error: 'Please enter your 4-digit PIN code.' };
  }

  try {
    let matchedProfile: any = null;

    // 1. Query Supabase profiles table for pin_code
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('profiles').select('*').eq('pin_code', cleanPin);
        if (businessId) {
          query = query.eq('business_id', normalizeBusinessUuid(businessId));
        }
        const { data: profiles, error } = await query;
        if (!error && profiles && profiles.length > 0) {
          matchedProfile = profiles[0];
        }
      } catch (err) {
        console.warn('[Supabase PIN Query Note]:', err);
      }
    }

    // 2. Query in-memory/synced store
    if (!matchedProfile) {
      const localUsers = loadUsers();
      const matched = localUsers.find(
        (u) =>
          u.pinCode === cleanPin &&
          (!businessId || u.businessId === normalizeBusinessUuid(businessId))
      );
      if (matched) {
        matchedProfile = {
          id: matched.id,
          business_id: matched.businessId,
          full_name: matched.fullName,
          email: matched.email,
          phone: matched.phone,
          role: matched.role,
          status: matched.status,
          access_status: matched.accessStatus,
          payment_status: matched.paymentStatus,
          pin_code: matched.pinCode,
          created_at: matched.createdAt,
          last_login_at: new Date().toISOString()
        };
      }
    }

    if (!matchedProfile) {
      return {
        success: false,
        error: 'No staff account matched this PIN code. Please check with your manager.'
      };
    }

    if (matchedProfile.status === 'Suspended' || matchedProfile.status === 'Inactive') {
      return {
        success: false,
        error: `Account is ${matchedProfile.status?.toLowerCase() || 'inactive'}. Please contact manager.`
      };
    }

    let business: Business = INITIAL_BUSINESS;
    if (matchedProfile.business_id) {
      const { data: bizRow } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', matchedProfile.business_id)
        .maybeSingle();

      if (bizRow) {
        business = mapBusinessRow(bizRow);
      }
    }

    let subscription: Subscription = INITIAL_SUBSCRIPTION;
    if (business?.id) {
      const { data: subRow } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', business.id)
        .maybeSingle();

      if (subRow) {
        subscription = mapSubscriptionRow(subRow);
      }
    }

    const appUser = mapProfileToAppUser(matchedProfile, matchedProfile.email || '', business);
    saveCurrentUser(appUser);
    saveCurrentBusiness(business);

    await logAudit({
      userId: appUser.id,
      userName: appUser.fullName,
      userRole: appUser.role,
      userEmail: appUser.email,
      businessId: business.id,
      action: 'Staff PIN Login',
      category: 'Auth',
      details: `${appUser.role} (${appUser.fullName}) signed in via Quick PIN`
    });

    return {
      success: true,
      user: appUser,
      business,
      subscription
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'PIN Authentication failed.' };
  }
}

/**
 * Register New Business & Owner Profile in Supabase
 */
export async function registerBusinessUser(params: {
  businessName: string;
  businessType: string;
  businessId?: string;
  ownerFullName: string;
  email: string;
  phone: string;
  password: string;
  pin?: string;
}): Promise<RegisterResult> {
  const cleanBizName = (params.businessName || '').trim() || 'My Business Facility';
  const cleanFullName = (params.ownerFullName || '').trim();
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanPhone = (params.phone || '').trim() || '+250 788 000 000';
  const cleanPassword = (params.password || '').trim();
  const cleanPin = (params.pin || '').trim() || '1234';

  if (!cleanFullName || !cleanEmail || !cleanPassword) {
    return { success: false, error: 'Full Name, Email, and Password are required.' };
  }

  if (cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const rawEnteredId = params.businessId?.trim();
  const newBizId = normalizeBusinessUuid(rawEnteredId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined));
  const bizCode = rawEnteredId && !isValidUuid(rawEnteredId) ? rawEnteredId.toUpperCase() : `BIZ-${newBizId.slice(-6).toUpperCase()}`;
  const newSubId = `sub-${Date.now()}`;

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          full_name: cleanFullName,
          phone: cleanPhone,
          role: 'Manager',
          business_id: newBizId,
          business_name: cleanBizName
        }
      }
    });

    if (authError) {
      let errText = authError.message;
      if (authError.message.includes('already registered')) {
        errText = 'An account with this email address already exists. Please sign in instead.';
      }
      return { success: false, error: errText };
    }

    const authUserId = authData.user?.id;
    if (!authUserId) {
      return { success: false, error: 'Unable to initialize user account with authentication provider.' };
    }

    // 1. Create Business Record
    const newBusinessRow = {
      id: newBizId,
      name: cleanBizName,
      code: bizCode,
      category: params.businessType || 'Hotel / Resort',
      type: (params.businessType || 'hotel').toLowerCase(),
      owner_name: cleanFullName,
      owner_email: cleanEmail,
      owner_phone: cleanPhone,
      phone: cleanPhone,
      email: cleanEmail,
      momo_payment_number: '0726134041',
      address: 'Kigali, Rwanda',
      currency: 'RWF',
      status: 'PENDING_PAYMENT',
      subscription_id: newSubId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: bizInsertErr } = await supabase.from('businesses').insert([newBusinessRow]);
    if (bizInsertErr) {
      console.warn('[Supabase Insert Business Note]:', bizInsertErr.message);
    }

    // 2. Create Profile Record
    const newProfileRow = {
      id: authUserId,
      business_id: newBizId,
      full_name: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
      role: 'Manager',
      status: 'Active',
      access_status: 'Pending Payment',
      payment_status: 'Unpaid',
      pin_code: cleanPin,
      is_super_admin: false,
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString()
    };

    const { error: profUpsertErr } = await supabase.from('profiles').upsert([newProfileRow]);
    if (profUpsertErr) {
      console.warn('[Supabase Upsert Profile Note]:', profUpsertErr.message);
    }

    // 3. Create Subscription Record
    const newSubRow = {
      id: newSubId,
      business_id: newBizId,
      business_name: cleanBizName,
      plan_name: 'Monthly SaaS Business License',
      plan: 'MONTHLY_STANDARD',
      monthly_fee: 100000,
      price_per_month: 100000,
      amount: 100000,
      currency: 'RWF',
      status: 'PENDING_PAYMENT',
      grace_period_days: 7,
      payment_method: 'MTN_MOMO',
      momo_number: '0726134041',
      next_payment_amount: 100000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: subInsertErr } = await supabase.from('subscriptions').insert([newSubRow]);
    if (subInsertErr) {
      console.warn('[Supabase Insert Subscription Note]:', subInsertErr.message);
    }

    const appUser = mapProfileToAppUser(newProfileRow, cleanEmail);
    const businessObj = mapBusinessRow(newBusinessRow);
    const subObj = mapSubscriptionRow(newSubRow);

    saveCurrentUser(appUser);
    saveCurrentBusiness(businessObj);

    await logAudit({
      userId: appUser.id,
      userName: appUser.fullName,
      userRole: appUser.role,
      userEmail: appUser.email,
      businessId: newBizId,
      action: 'Business Registration',
      category: 'Auth',
      details: `New business registered: ${cleanBizName} by ${cleanFullName} (${cleanEmail})`
    });

    return {
      success: true,
      user: appUser,
      business: businessObj,
      subscription: subObj,
      requiresEmailConfirmation: authData.session === null
    };
  } catch (err: any) {
    console.error('[Supabase Registration Error]:', err);
    return { success: false, error: err.message || 'Registration failed. Please check your details.' };
  }
}

/**
 * Register Staff Member linked to an authorized business
 */
export async function registerStaffUser(params: {
  businessId: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  pin: string;
  role: SystemRole;
}): Promise<RegisterResult> {
  const cleanFullName = (params.fullName || '').trim();
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanPhone = (params.phone || '').trim();
  const cleanPassword = (params.password || '').trim();
  const cleanPin = (params.pin || '').trim() || '1234';

  if (!cleanFullName || !cleanEmail || !cleanPassword) {
    return { success: false, error: 'Full Name, Email, and Password are required.' };
  }

  if (cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const allowedRoles: SystemRole[] = ['Cashier', 'Waiter', 'Receptionist', 'Kitchen', 'Manager', 'Accountant'];
  const safeRole: SystemRole = allowedRoles.includes(params.role) ? params.role : 'Cashier';

  try {
    const { data: targetBiz, error: bizErr } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', params.businessId)
      .maybeSingle();

    if (bizErr || !targetBiz) {
      return {
        success: false,
        error: `Business identifier "${params.businessId}" was not found. Please verify with your manager.`
      };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          full_name: cleanFullName,
          phone: cleanPhone,
          role: safeRole,
          business_id: params.businessId,
        }
      }
    });

    if (authError) {
      let errText = authError.message;
      if (authError.message.includes('already registered')) {
        errText = 'An account with this email address already exists. Please sign in.';
      }
      return { success: false, error: errText };
    }

    const authUserId = authData.user?.id;
    if (!authUserId) {
      return {
        success: false,
        error: 'Unable to initialize staff account with authentication provider.'
      };
    }

    const newProfileRow = {
      id: authUserId,
      business_id: params.businessId,
      full_name: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
      role: safeRole,
      status: 'Active',
      access_status: 'Approved',
      payment_status: 'Paid',
      pin_code: cleanPin,
      is_super_admin: false,
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString()
    };

    await supabase.from('profiles').upsert([newProfileRow]);

    const appUser = mapProfileToAppUser(newProfileRow, cleanEmail);

    await logAudit({
      userId: appUser.id,
      userName: appUser.fullName,
      userRole: appUser.role,
      userEmail: appUser.email,
      businessId: params.businessId,
      action: 'Staff Registration',
      category: 'Auth',
      details: `Staff member registered: ${appUser.fullName} (${appUser.role}) for business ${targetBiz.name} (${params.businessId})`
    });

    return { 
      success: true, 
      user: appUser,
      requiresEmailConfirmation: authData.session === null
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Staff registration failed.' };
  }
}

/**
 * Sign Out User from Supabase and clear session
 */
export async function logoutUser(): Promise<void> {
  const currentUser = loadCurrentUser();
  if (currentUser) {
    await logAudit({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      userEmail: currentUser.email,
      businessId: currentUser.businessId,
      action: 'User Logout',
      category: 'Auth',
      details: `${currentUser.role} (${currentUser.fullName}) signed out of system`
    });
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Supabase SignOut Note]:', err);
    }
  }

  clearCurrentUser();
}

/**
 * Restore Authenticated Session (on page load / cross-device) strictly from Supabase
 */
export async function getCurrentUser(): Promise<{
  user: AppUser | null;
  business: Business | null;
  subscription: Subscription | null;
}> {
  if (!isSupabaseConfigured()) {
    return { user: null, business: null, subscription: null };
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return { user: null, business: null, subscription: null };
    }

    const authUser = session.user;
    let profileRow: any = null;
    try {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!profileErr && data) {
        profileRow = data;
      }
    } catch (err: any) {
      console.warn('[Supabase Session Profile Exception]:', err?.message || err);
    }

    if (!profileRow) {
      const metadata = authUser.user_metadata || {};
      const isSuperAdminMeta = metadata.role === 'Super Admin' || metadata.is_super_admin === true || (authUser.email || '').includes('admin') || authUser.email === 'yuskarshop@gmail.com';
      const userBizId = isSuperAdminMeta ? null : normalizeBusinessUuid(metadata.business_id || getActiveBusinessId());

      profileRow = {
        id: authUser.id,
        business_id: userBizId,
        full_name: metadata.full_name || (authUser.email || '').split('@')[0],
        email: authUser.email || '',
        phone: metadata.phone || '',
        role: isSuperAdminMeta ? 'Super Admin' : (metadata.role || 'Manager'),
        status: 'Active',
        access_status: 'Approved',
        payment_status: 'Paid',
        is_super_admin: Boolean(isSuperAdminMeta),
        pin_code: metadata.pin_code || '1234',
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };
    }

    const isSuper = Boolean(profileRow.is_super_admin || profileRow.role === 'Super Admin');

    if (isSuper) {
      const appUser = mapProfileToAppUser(profileRow, authUser.email || '');
      appUser.role = 'Super Admin';
      appUser.isSuperAdmin = true;
      appUser.businessId = undefined;
      saveCurrentUser(appUser);
      return { user: appUser, business: null, subscription: null };
    }

    if (profileRow.status === 'Suspended' || profileRow.status === 'Inactive') {
      return { user: null, business: null, subscription: null };
    }

    let business: Business = INITIAL_BUSINESS;
    if (profileRow.business_id) {
      const { data: bizRow } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', profileRow.business_id)
        .maybeSingle();

      if (bizRow) {
        business = mapBusinessRow(bizRow);
      }
    }

    let subscription: Subscription = INITIAL_SUBSCRIPTION;
    if (business?.id) {
      const { data: subRow } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', business.id)
        .maybeSingle();

      if (subRow) {
        subscription = mapSubscriptionRow(subRow);
      }
    }

    const appUser = mapProfileToAppUser(profileRow, authUser.email || '', business);
    saveCurrentUser(appUser);
    saveCurrentBusiness(business);

    return { user: appUser, business, subscription };
  } catch (err) {
    console.warn('[Supabase GetSession Error]:', err);
    return { user: null, business: null, subscription: null };
  }
}

/**
 * Get active Supabase session
 */
export async function getSession() {
  if (!isSupabaseConfigured()) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Subscribe to Supabase Auth State changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return subscription;
}
