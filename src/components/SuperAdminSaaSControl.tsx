import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldCheck, DollarSign, Users, AlertTriangle, 
  CheckCircle2, Clock, Search, Filter, KeyRound, Smartphone, 
  RefreshCw, Download, Settings, Sliders, ExternalLink, Calendar,
  ArrowUpRight, Plus, Eye, History, Lock, Unlock, Sparkles, MessageSquare,
  Landmark, Copy, Check, CreditCard, HelpCircle, PhoneCall, Mail, Save,
  Gift, Percent, Award
} from 'lucide-react';
import { 
  Business, Subscription, SubscriptionPayment, SubscriptionOverrideRecord, 
  MomoApiConfig, AppUser, PlatformPaymentSettings 
} from '../types';
import { 
  SAAS_MONTHLY_FEE, SAAS_MOMO_MERCHANT_NUMBER,
  loadBusinesses, saveBusinesses, loadSubscriptions, saveSubscriptions,
  loadSubscriptionPayments, saveSubscriptionPayments, loadSubscriptionOverrides,
  saveSubscriptionOverrides, apiSuperAdminGetSaaSStats, apiSuperAdminOverride,
  apiSuperAdminSetGracePeriod, apiSuperAdminGetMomoConfig, apiSuperAdminSaveMomoConfig,
  loadPlatformPaymentSettings, savePlatformPaymentSettings,
  apiSuperAdminGetPaymentSettings, apiSuperAdminSavePaymentSettings,
  apiSuperAdminGrantBonus, grantBusinessBonusDays,
  evaluateSubscriptionMetrics, addAuditLog
} from '../lib/storage';

interface SuperAdminSaaSControlProps {
  currentUser: AppUser;
  darkMode?: boolean;
}

export const SuperAdminSaaSControl: React.FC<SuperAdminSaaSControlProps> = ({
  currentUser,
  darkMode = false
}) => {
  const [businesses, setBusinesses] = useState<Business[]>(() => loadBusinesses());
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => loadSubscriptions());
  const [payments, setPayments] = useState<SubscriptionPayment[]>(() => loadSubscriptionPayments());
  const [overrides, setOverrides] = useState<SubscriptionOverrideRecord[]>(() => loadSubscriptionOverrides());
  const [paymentSettings, setPaymentSettings] = useState<PlatformPaymentSettings>(() => loadPlatformPaymentSettings());
  const [momoConfig, setMomoConfig] = useState<MomoApiConfig>({
    primarySubscriptionKey: 'momo-rw-sub-key-2026',
    apiUser: 'momo-rw-api-user-01',
    apiKey: '••••••••••••••••',
    environment: 'sandbox',
    merchantNumber: SAAS_MOMO_MERCHANT_NUMBER,
    subscriptionAmount: SAAS_MONTHLY_FEE
  });

  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'PAYMENTS' | 'OVERRIDES' | 'MOMO_CONFIG'>('DIRECTORY');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Selected Business for Override Modal
  const [selectedBizForOverride, setSelectedBizForOverride] = useState<Business | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideDays, setOverrideDays] = useState(14);
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  // Selected Business for Bonus / Free Days Modal
  const [selectedBizForBonus, setSelectedBizForBonus] = useState<Business | null>(null);
  const [bonusDaysInput, setBonusDaysInput] = useState(14);
  const [bonusReasonInput, setBonusReasonInput] = useState('Complimentary Promotion / Free Activation Bonus');
  const [isSubmittingBonus, setIsSubmittingBonus] = useState(false);
  const [bonusSuccessMsg, setBonusSuccessMsg] = useState('');

  // Selected Business for Grace Period Modal
  const [selectedBizForGrace, setSelectedBizForGrace] = useState<Business | null>(null);
  const [graceDaysInput, setGraceDaysInput] = useState(0);

  // New Business Modal
  const [showAddBizModal, setShowAddBizModal] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [newBizOwner, setNewBizOwner] = useState('');
  const [newBizPhone, setNewBizPhone] = useState('');
  const [newBizEmail, setNewBizEmail] = useState('');
  const [newBizCategory, setNewBizCategory] = useState<'Hotel' | 'Restaurant' | 'Bar' | 'Resort' | 'Cafe'>('Hotel');

  // Load from backend if available
  useEffect(() => {
    fetchBackendStats();
    fetchPaymentSettings();
  }, []);

  const fetchBackendStats = async () => {
    try {
      const data = await apiSuperAdminGetSaaSStats();
      if (data.success) {
        if (data.businesses) setBusinesses(data.businesses);
        if (data.subscriptions) setSubscriptions(data.subscriptions);
        if (data.payments) setPayments(data.payments);
        if (data.overrides) setOverrides(data.overrides);
        if (data.momoConfig) {
          setMomoConfig(data.momoConfig);
        }
      }
    } catch (err) {
      console.warn('Using local SaaS database state:', err);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const data = await apiSuperAdminGetPaymentSettings();
      if (data.success && data.settings) {
        setPaymentSettings(data.settings);
        savePlatformPaymentSettings(data.settings);
      }
    } catch (err) {
      console.warn('Using local payment settings:', err);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Handle Save Payment Receiving Accounts & Bank Details
  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      savePlatformPaymentSettings(paymentSettings);
      
      // Also update momoConfig merchantNumber in sync
      const updatedMomo = {
        ...momoConfig,
        merchantNumber: paymentSettings.momoNumber,
        subscriptionAmount: paymentSettings.monthlyFee || momoConfig.subscriptionAmount || SAAS_MONTHLY_FEE
      };
      setMomoConfig(updatedMomo);
      await apiSuperAdminSaveMomoConfig(updatedMomo);

      const res = await apiSuperAdminSavePaymentSettings(paymentSettings);
      if (res.success) {
        setSaveSuccessMsg('Payment receiving accounts and bank details updated and live across all businesses!');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } else {
        setSaveSuccessMsg('Saved locally and in active database.');
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
      savePlatformPaymentSettings(paymentSettings);
      setSaveSuccessMsg('Saved to local storage and active session.');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  // KPI Calculations
  const totalBusinesses = businesses.length;
  const activeSubs = subscriptions.filter(s => s.status === 'ACTIVE').length;
  const pendingSubs = subscriptions.filter(s => s.status === 'PENDING_PAYMENT').length;
  const expiredSubs = subscriptions.filter(s => s.status === 'EXPIRED').length;
  const totalRevenue = payments
    .filter(p => p.status === 'SUCCESSFUL')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const monthlyRecurringRevenue = activeSubs * SAAS_MONTHLY_FEE;

  // Filtered Businesses
  const filteredBusinesses = businesses.filter(b => {
    const sub = subscriptions.find(s => s.businessId === b.id);
    const metrics = evaluateSubscriptionMetrics(sub);
    
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = 
      (b.name || '').toLowerCase().includes(q) ||
      (b.code || '').toLowerCase().includes(q) ||
      (b.ownerName || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q);

    const matchesStatus = 
      statusFilter === 'ALL' || 
      metrics.status === statusFilter ||
      b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handle Manual Override
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizForOverride) return;

    if (!adminPassword || !overrideReason.trim()) {
      setOverrideError('Super Admin password and justification reason are strictly required.');
      return;
    }

    setIsSubmittingOverride(true);
    setOverrideError('');

    try {
      const res = await apiSuperAdminOverride({
        businessId: selectedBizForOverride.id,
        adminEmail: currentUser.email || '',
        adminPassword: adminPassword.trim(),
        reason: overrideReason.trim(),
        daysGranted: overrideDays
      });

      if (res.success) {
        alert(`Emergency override granted to ${selectedBizForOverride.name} for ${overrideDays} days.`);
        setSelectedBizForOverride(null);
        setAdminPassword('');
        setOverrideReason('');
        fetchBackendStats();
      } else {
        setOverrideError(res.error || 'Failed to authorize override.');
      }
    } catch (err: any) {
      setOverrideError(err.message || 'Error granting override.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Handle Granting Client Free Bonus Days
  const handleGrantBonusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizForBonus) return;

    setIsSubmittingBonus(true);
    try {
      // 1. Local storage & state update
      const res = grantBusinessBonusDays(
        selectedBizForBonus.id,
        bonusDaysInput,
        bonusReasonInput.trim() || 'Complimentary Activation Bonus',
        currentUser
      );

      // 2. Server API sync
      try {
        await apiSuperAdminGrantBonus({
          businessId: selectedBizForBonus.id,
          bonusDays: bonusDaysInput,
          reason: bonusReasonInput.trim() || 'Complimentary Activation Bonus',
          adminName: currentUser.fullName,
          adminEmail: currentUser.email
        });
      } catch (backendErr) {
        console.warn('Backend bonus sync note:', backendErr);
      }

      setBonusSuccessMsg(`✓ Successfully granted ${bonusDaysInput} free bonus days to ${selectedBizForBonus.name}!`);
      
      // Refresh list
      setBusinesses(loadBusinesses());
      setSubscriptions(loadSubscriptions());
      setOverrides(loadSubscriptionOverrides());
      fetchBackendStats();

      setTimeout(() => {
        setSelectedBizForBonus(null);
        setBonusSuccessMsg('');
      }, 1400);
    } catch (err: any) {
      alert(err.message || 'Failed to grant bonus days.');
    } finally {
      setIsSubmittingBonus(false);
    }
  };

  // Handle Grace Period Update
  const handleUpdateGracePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizForGrace) return;

    try {
      const res = await apiSuperAdminSetGracePeriod(selectedBizForGrace.id, graceDaysInput);
      if (res.success) {
        alert(`Grace period for ${selectedBizForGrace.name} updated to ${graceDaysInput} days.`);
        setSelectedBizForGrace(null);
        fetchBackendStats();
      }
    } catch (err) {
      alert('Failed to update grace period.');
    }
  };

  // Handle Save MoMo Gateway Config
  const handleSaveMomoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiSuperAdminSaveMomoConfig(momoConfig);
      if (res.success) {
        alert('MTN MoMo Gateway settings updated successfully!');
      }
    } catch (err) {
      alert('Failed to save MoMo configuration.');
    }
  };

  // Create Business
  const handleCreateBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBizName.trim() || !newBizOwner.trim()) {
      alert('Business name and owner name are required.');
      return;
    }

    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`;
    const subId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${String(Date.now() + 1).slice(-12).padStart(12, '0')}`;
    const code = `BIZ-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBiz: Business = {
      id: newId,
      name: newBizName.trim(),
      code,
      category: newBizCategory,
      ownerName: newBizOwner.trim(),
      phone: newBizPhone.trim() || '+250 780 000 000',
      email: newBizEmail.trim() || `${code.toLowerCase()}@hotel.rw`,
      momoPaymentNumber: SAAS_MOMO_MERCHANT_NUMBER,
      currency: 'RWF',
      status: 'PENDING_PAYMENT',
      subscriptionId: subId,
      createdAt: new Date().toISOString()
    };

    const newSub: Subscription = {
      id: subId,
      businessId: newId,
      businessName: newBiz.name,
      planName: 'Monthly SaaS Business License',
      amount: SAAS_MONTHLY_FEE,
      currency: 'RWF',
      status: 'PENDING_PAYMENT',
      gracePeriodDays: 0,
      nextPaymentAmount: SAAS_MONTHLY_FEE,
      createdAt: new Date().toISOString()
    };

    const updatedBizList = [newBiz, ...businesses];
    const updatedSubList = [newSub, ...subscriptions];

    setBusinesses(updatedBizList);
    setSubscriptions(updatedSubList);
    saveBusinesses(updatedBizList);
    saveSubscriptions(updatedSubList);

    setShowAddBizModal(false);
    setNewBizName('');
    setNewBizOwner('');
    setNewBizPhone('');
    setNewBizEmail('');
    alert(`Business "${newBiz.name}" created with status PENDING_PAYMENT. It will require 100,000 RWF MoMo payment to activate.`);
  };

  return (
    <div className={`space-y-6 max-w-7xl mx-auto ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">Super Admin SaaS Control Panel</h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                MASTER ROOT ACCESS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Multi-Tenant Subscriptions, MTN MoMo Gateway (0726134041) & Financial Revenue Operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddBizModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Register Business Tenant</span>
          </button>
          <button
            onClick={fetchBackendStats}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh All Database Stats"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* Total Businesses */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Tenants</span>
          <div className="text-2xl font-extrabold text-white mt-1">{totalBusinesses}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Registered properties</p>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Active</span>
          <div className="text-2xl font-extrabold text-emerald-300 mt-1">{activeSubs}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Paid & operational</p>
        </div>

        {/* Pending Payment */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pending</span>
          <div className="text-2xl font-extrabold text-amber-300 mt-1">{pendingSubs}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Awaiting first MoMo</p>
        </div>

        {/* Expired Subscriptions */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Expired</span>
          <div className="text-2xl font-extrabold text-rose-300 mt-1">{expiredSubs}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Restricted access</p>
        </div>

        {/* Monthly Recurring Revenue */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg">
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Est. MRR</span>
          <div className="text-lg font-extrabold text-white mt-1 font-mono">
            {(monthlyRecurringRevenue / 1000).toLocaleString()}k <span className="text-xs text-blue-400">RWF</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Monthly revenue base</p>
        </div>

        {/* Total Collected */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Total Revenue</span>
          <div className="text-lg font-extrabold text-amber-300 mt-1 font-mono">
            {totalRevenue.toLocaleString()} <span className="text-xs">RWF</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Lifetime MoMo settled</p>
        </div>

      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('DIRECTORY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'DIRECTORY'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Tenant Subscriptions Directory ({businesses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'PAYMENTS'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>All MoMo Payment Transactions ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('OVERRIDES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'OVERRIDES'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Super Admin Override Logs ({overrides.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MOMO_CONFIG')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'MOMO_CONFIG'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>Payment Accounts & MoMo Gateway</span>
        </button>
      </div>

      {/* TAB 1: BUSINESS TENANT DIRECTORY */}
      {activeTab === 'DIRECTORY' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          
          {/* Filter and Search Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search business, owner, phone..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-400">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active (Paid)</option>
                <option value="PENDING_PAYMENT">Pending Payment</option>
                <option value="EXPIRED">Expired</option>
                <option value="GRACE_PERIOD">Grace Period</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Business Tenant</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Owner & Contact</th>
                  <th className="p-3.5">Subscription Status</th>
                  <th className="p-3.5">Expiry Date</th>
                  <th className="p-3.5">Days Left</th>
                  <th className="p-3.5">Grace Period</th>
                  <th className="p-3.5 rounded-r-xl text-right">Master Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBusinesses.map((b) => {
                  const sub = subscriptions.find(s => s.businessId === b.id);
                  const metrics = evaluateSubscriptionMetrics(sub);

                  return (
                    <tr key={b.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-white text-sm">{b.name}</div>
                        <div className="font-mono text-[10px] text-amber-400">{b.code || b.id}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                          {b.category || 'Hotel'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-200 font-medium">{b.ownerName || 'Admin'}</div>
                        <div className="text-slate-400 text-[11px]">{b.phone}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] w-fit ${
                            metrics.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : metrics.status === 'GRACE_PERIOD'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {metrics.status.replace('_', ' ')}
                          </span>
                          {(sub?.isBonusActive || (b.bonusDays && b.bonusDays > 0)) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold w-fit">
                              <Gift className="w-2.5 h-2.5" />
                              <span>+{b.bonusDays || sub?.bonusDaysGranted || 0}d Bonus</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {sub?.expiryDate ? new Date(sub.expiryDate).toLocaleDateString() : 'None'}
                      </td>
                      <td className="p-3.5 font-bold">
                        <span className={metrics.daysRemaining > 3 ? 'text-emerald-400' : 'text-rose-400'}>
                          {metrics.daysRemaining}d
                        </span>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => {
                            setSelectedBizForGrace(b);
                            setGraceDaysInput(sub?.gracePeriodDays || 0);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 font-mono"
                        >
                          {sub?.gracePeriodDays || 0} Days
                        </button>
                      </td>
                      <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedBizForBonus(b);
                            setBonusDaysInput(14);
                            setBonusReasonInput('Complimentary Promotion / Free Activation Bonus');
                            setBonusSuccessMsg('');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition shadow-sm"
                          title="Grant Client Bonus Days / Free Access"
                        >
                          <Gift className="w-3.5 h-3.5 text-purple-400" />
                          <span>Give Bonus Days</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedBizForOverride(b);
                            setOverrideDays(14);
                            setOverrideReason('');
                            setOverrideError('');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Emergency Override</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ALL MOMO PAYMENTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <span>All Multi-Tenant Subscription Payments</span>
            </h3>
            <span className="text-xs text-slate-400">Total: {payments.length} Transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Timestamp</th>
                  <th className="p-3.5">Business Name</th>
                  <th className="p-3.5">Amount (RWF)</th>
                  <th className="p-3.5">Payer Phone</th>
                  <th className="p-3.5">Recipient (MoMo)</th>
                  <th className="p-3.5">Payment Reference</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 rounded-r-xl">Verified By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-mono text-slate-300">
                      {new Date(p.paidAt || p.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-bold text-white">{p.businessName || 'Hotel Tenant'}</td>
                    <td className="p-3.5 font-bold text-amber-400 font-mono">
                      {p.amount.toLocaleString()} RWF
                    </td>
                    <td className="p-3.5 font-mono">{p.payerPhone || 'N/A'}</td>
                    <td className="p-3.5 font-mono text-yellow-400">{p.recipientPhone || SAAS_MOMO_MERCHANT_NUMBER}</td>
                    <td className="p-3.5 font-mono text-slate-300">{p.paymentReference}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                        p.status === 'SUCCESSFUL'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">{p.verifiedBy || 'Gateway API'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: OVERRIDE LOGS */}
      {activeTab === 'OVERRIDES' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <span>Super Admin Manual Override Audit Trail</span>
            </h3>
            <span className="text-xs text-slate-400">Strict Immutable Ledger</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Date & Time</th>
                  <th className="p-3.5">Business</th>
                  <th className="p-3.5">Authorized By</th>
                  <th className="p-3.5">Days Granted</th>
                  <th className="p-3.5 rounded-r-xl">Mandatory Justification Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {overrides.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      No manual overrides recorded. System has operated strictly on automated MoMo payments.
                    </td>
                  </tr>
                ) : (
                  overrides.map((ov) => (
                    <tr key={ov.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5 font-mono text-slate-300">
                        {new Date(ov.grantedAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-bold text-white">{ov.businessId}</td>
                      <td className="p-3.5 font-mono text-amber-400">{ov.authorizedBy}</td>
                      <td className="p-3.5 font-bold text-emerald-400">{ov.daysGranted} Days</td>
                      <td className="p-3.5 text-slate-300 italic">"{ov.reason}"</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PAYMENT ACCOUNTS & MOMO GATEWAY CONFIG */}
      {activeTab === 'MOMO_CONFIG' && (
        <div className="space-y-6">
          {saveSuccessMsg && (
            <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-xs font-semibold animate-fade-in shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSavePaymentSettings} className="space-y-6">
                
                {/* 1. Mobile Money Receiving Details */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-7 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">1. Mobile Money Receiving Accounts</h3>
                        <p className="text-[11px] text-slate-400">Direct phone numbers and merchant codes where subscribers send subscription funds.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Primary MTN MoMo Number <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.momoNumber}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, momoNumber: e.target.value })}
                        placeholder="e.g. 0726134041"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        MTN Account Holder / Registered Name <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.momoAccountName}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, momoAccountName: e.target.value })}
                        placeholder="e.g. Theogene / YusKar Empire"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        MoMo Merchant / Paybill Code (Optional)
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.momoMerchantCode || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, momoMerchantCode: e.target.value })}
                        placeholder="e.g. 0726134041 or 123456"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Quick USSD Dial String (Optional)
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.momoUssdCode || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, momoUssdCode: e.target.value })}
                        placeholder="e.g. *182*8*1*0726134041#"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Airtel Money Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.airtelMoneyNumber || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, airtelMoneyNumber: e.target.value })}
                        placeholder="e.g. +250 730 000 000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Airtel Registered Account Name
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.airtelAccountName || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, airtelAccountName: e.target.value })}
                        placeholder="e.g. YusKar Empire"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Bank Account Receiving Details */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-7 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-400/10 border border-blue-400/30 flex items-center justify-center text-blue-400">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">2. Bank Transfer Receiving Accounts</h3>
                        <p className="text-[11px] text-slate-400">Official bank accounts for direct wire transfer and corporate billing deposits.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Primary Bank Name <span className="text-amber-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.primaryBankName}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, primaryBankName: e.target.value })}
                          placeholder="e.g. Bank of Kigali (BK)"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-blue-400 focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Account Number <span className="text-amber-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.primaryBankAccount}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, primaryBankAccount: e.target.value })}
                          placeholder="e.g. 00040-0694038-34"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono font-bold text-amber-300 focus:border-blue-400 focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Account Name <span className="text-amber-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.primaryAccountName}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, primaryAccountName: e.target.value })}
                          placeholder="e.g. YUSKAR EMPIRE LTD"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-blue-400 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Branch Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.primaryBranch || ''}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, primaryBranch: e.target.value })}
                          placeholder="e.g. Kigali Head Office / Remera Branch"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-blue-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          SWIFT / BIC Code (Optional)
                        </label>
                        <input
                          type="text"
                          value={paymentSettings.primarySwiftCode || ''}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, primarySwiftCode: e.target.value })}
                          placeholder="e.g. BKRWRWRW"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:border-blue-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Secondary Bank Option */}
                    <div className="pt-3 border-t border-slate-800/80">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                        Secondary / Alternative Bank Account (Optional)
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Secondary Bank Name</label>
                          <input
                            type="text"
                            value={paymentSettings.secondaryBankName || ''}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, secondaryBankName: e.target.value })}
                            placeholder="e.g. Equity Bank Rwanda"
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Secondary Account Number</label>
                          <input
                            type="text"
                            value={paymentSettings.secondaryBankAccount || ''}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, secondaryBankAccount: e.target.value })}
                            placeholder="e.g. 4001211234567"
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Secondary Account Name</label>
                          <input
                            type="text"
                            value={paymentSettings.secondaryAccountName || ''}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, secondaryAccountName: e.target.value })}
                            placeholder="e.g. YUSKAR EMPIRE LTD"
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Online Credit / Debit Card Payment Gateway */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-7 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">3. Credit / Debit Card & Online Payment Gateway</h3>
                        <p className="text-[11px] text-slate-400">Enable Visa, Mastercard, Flutterwave, or Stripe payment links for automated client billing.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentSettings.enableCardPayment ?? true}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, enableCardPayment: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      <span className="ml-2 text-xs font-semibold text-slate-300">
                        {paymentSettings.enableCardPayment ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Card Gateway Display Name
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.cardGatewayName || 'Visa / Mastercard / Online Card Checkout'}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, cardGatewayName: e.target.value })}
                        placeholder="e.g. Visa, Mastercard & Online Gateway"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Card Payment / Direct Checkout URL Link
                      </label>
                      <input
                        type="url"
                        value={paymentSettings.cardPaymentLink || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, cardPaymentLink: e.target.value })}
                        placeholder="https://checkout.yuskar.rw/pay or https://flutterwave.com/pay/yuskar"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-mono focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Card Payment Instructions for Clients
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.cardInstructions || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, cardInstructions: e.target.value })}
                        placeholder="Click checkout to pay online with Visa, Mastercard or International Debit Card."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Client Free Bonus & Promotional Activation Defaults */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-7 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-400/10 border border-purple-400/30 flex items-center justify-center text-purple-400">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">4. Client Free Bonus & Promotional Days Policy</h3>
                        <p className="text-[11px] text-slate-400">Configure default free trial / promotional bonus days given to newly activated businesses.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentSettings.autoGrantBonusOnRegistration ?? true}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, autoGrantBonusOnRegistration: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                      <span className="ml-2 text-xs font-semibold text-slate-300">
                        {paymentSettings.autoGrantBonusOnRegistration ? 'Auto-Bonus On' : 'Manual Only'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Default Free Bonus Days for New Clients
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={paymentSettings.defaultBonusDays ?? 14}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, defaultBonusDays: Number(e.target.value) })}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-purple-300 font-mono font-bold text-xs focus:border-purple-400 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Free Days</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Bonus Campaign / Offer Name
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.bonusPromotionTitle || '14 Days Free Launch Trial'}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, bonusPromotionTitle: e.target.value })}
                        placeholder="e.g. 14 Days Free Activation Bonus"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Subscription Rate, Support & Instructions */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-7 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">5. Pricing, Support Contact & Subscriber Instructions</h3>
                        <p className="text-[11px] text-slate-400">Monthly billing tariff and customer support contact details shown on lock screen.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Monthly Subscription Fee (RWF) <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={paymentSettings.monthlyFee || 100000}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, monthlyFee: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono font-bold text-emerald-400 focus:border-emerald-400 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Support Phone Hotline</label>
                      <input
                        type="text"
                        value={paymentSettings.supportPhone || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, supportPhone: e.target.value })}
                        placeholder="+250 726 134 041"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:border-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Support Email</label>
                      <input
                        type="email"
                        value={paymentSettings.supportEmail || ''}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, supportEmail: e.target.value })}
                        placeholder="yuskarshop@gmail.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-emerald-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Custom Payment Instructions for Subscribers</label>
                    <textarea
                      value={paymentSettings.paymentInstructions || ''}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, paymentInstructions: e.target.value })}
                      rows={2}
                      placeholder="Please make payment using MTN Mobile Money, Airtel Money, Bank Transfer or Online Card Payment. Enter your Business Name as reference."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 6. Automated MTN MoMo Collections Gateway API */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-7 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-400/10 border border-purple-400/30 flex items-center justify-center text-purple-400">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">6. Automated MTN MoMo Collections Gateway API</h3>
                        <p className="text-[11px] text-slate-400">Optional developer credentials for automated STK Push / USSD payment triggers.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">MTN Primary Subscription Key</label>
                      <input
                        type="password"
                        value={momoConfig.primarySubscriptionKey || ''}
                        onChange={(e) => setMomoConfig({ ...momoConfig, primarySubscriptionKey: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">API User (X-Reference-Id)</label>
                      <input
                        type="text"
                        value={momoConfig.apiUser || ''}
                        onChange={(e) => setMomoConfig({ ...momoConfig, apiUser: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">API Key / Secret</label>
                      <input
                        type="password"
                        value={momoConfig.apiKey || ''}
                        onChange={(e) => setMomoConfig({ ...momoConfig, apiKey: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Gateway Environment</label>
                      <select
                        value={momoConfig.environment || 'sandbox'}
                        onChange={(e) => setMomoConfig({ ...momoConfig, environment: e.target.value as any })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                      >
                        <option value="sandbox">Sandbox (Testing / Demo Simulation)</option>
                        <option value="production">Production (Live MTN MoMo Rwanda)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Submit button bar */}
                <div className="flex items-center justify-between p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
                  <span className="text-xs text-slate-400">
                    Changes apply immediately to all active businesses and payment lock screens.
                  </span>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save & Deploy Payment Details</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Live Preview Card */}
            <div className="space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl sticky top-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span>Subscriber Payment View (Live Preview)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    LIVE
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  This is exactly how your payment receiving accounts appear to business owners when making their subscription payments:
                </p>

                {/* Promotional Bonus Preview Banner */}
                {(paymentSettings.defaultBonusDays || 0) > 0 && (
                  <div className="bg-purple-950/60 border border-purple-500/40 rounded-2xl p-3 text-xs flex items-center gap-2 text-purple-300">
                    <Gift className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <span className="font-bold">{paymentSettings.bonusPromotionTitle || `${paymentSettings.defaultBonusDays} Free Bonus Days`}</span>
                      <p className="text-[10px] text-purple-200">New accounts receive +{paymentSettings.defaultBonusDays} days complementary trial!</p>
                    </div>
                  </div>
                )}

                {/* Preview: MTN MoMo Card */}
                <div className="bg-slate-800/80 border border-yellow-500/30 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-yellow-400/20 text-yellow-400 flex items-center justify-center font-black text-[10px]">
                        M
                      </div>
                      <span className="font-bold text-xs text-white">MTN Mobile Money (Rwanda)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-yellow-400/10 text-yellow-300 border border-yellow-400/20">
                      RECOMMENDED
                    </span>
                  </div>

                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Payment Number</div>
                      <div className="font-mono font-bold text-amber-400 text-sm">{paymentSettings.momoNumber || '0726134041'}</div>
                      <div className="text-[10px] text-slate-300">{paymentSettings.momoAccountName || 'Theogene / YusKar Empire'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentSettings.momoNumber, 'prev-momo')}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      title="Copy Number"
                    >
                      {copiedKey === 'prev-momo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {paymentSettings.momoUssdCode && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between bg-slate-900/50 p-2 rounded-lg">
                      <span>Dial: <strong className="font-mono text-slate-200">{paymentSettings.momoUssdCode}</strong></span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(paymentSettings.momoUssdCode || '', 'prev-ussd')}
                        className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                      >
                        {copiedKey === 'prev-ussd' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Preview: Airtel Money (if configured) */}
                {paymentSettings.airtelMoneyNumber && (
                  <div className="bg-slate-800/80 border border-red-500/30 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-red-400/20 text-red-400 flex items-center justify-center font-black text-[10px]">
                          A
                        </div>
                        <span className="font-bold text-xs text-white">Airtel Money (Rwanda)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-400/10 text-red-300 border border-red-400/20">
                        AIRTEL
                      </span>
                    </div>

                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Airtel Number</div>
                        <div className="font-mono font-bold text-red-300 text-sm">{paymentSettings.airtelMoneyNumber}</div>
                        <div className="text-[10px] text-slate-300">{paymentSettings.airtelAccountName || 'YusKar Empire'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(paymentSettings.airtelMoneyNumber || '', 'prev-airtel')}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      >
                        {copiedKey === 'prev-airtel' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview: Bank Account Card */}
                <div className="bg-slate-800/80 border border-blue-500/30 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-400/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                      BK
                    </div>
                    <span className="font-bold text-xs text-white">{paymentSettings.primaryBankName || 'Bank of Kigali (BK)'}</span>
                  </div>

                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Account Number</div>
                      <div className="font-mono font-bold text-blue-300 text-xs">{paymentSettings.primaryBankAccount || '00040-0694038-34'}</div>
                      <div className="text-[10px] text-slate-300 font-medium">{paymentSettings.primaryAccountName || 'YUSKAR EMPIRE LTD'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentSettings.primaryBankAccount, 'prev-bank')}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      title="Copy Account"
                    >
                      {copiedKey === 'prev-bank' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Preview: Credit / Debit Card (if enabled) */}
                {(paymentSettings.enableCardPayment ?? true) && (
                  <div className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-cyan-400/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
                          <CreditCard className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs text-white">
                          {paymentSettings.cardGatewayName || 'Visa / Mastercard / Card Gateway'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                        ONLINE
                      </span>
                    </div>

                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                      <div className="text-xs text-slate-300">
                        <div className="font-semibold text-cyan-300">Online Card Checkout Portal</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                          {paymentSettings.cardPaymentLink || 'https://checkout.yuskar.rw/subscription'}
                        </div>
                      </div>
                      {paymentSettings.cardPaymentLink ? (
                        <a
                          href={paymentSettings.cardPaymentLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 transition"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">Link active</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Rate Summary */}
                <div className="bg-slate-800/40 rounded-2xl p-3 border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Monthly Subscription:</span>
                    <strong className="text-emerald-400">{(paymentSettings.monthlyFee || 100000).toLocaleString()} RWF / Month</strong>
                  </div>
                  {paymentSettings.supportPhone && (
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Support Hotline:</span>
                      <strong className="text-slate-200">{paymentSettings.supportPhone}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GRANT FREE BONUS DAYS */}
      {selectedBizForBonus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                <Gift className="w-5 h-5" />
                <span>Grant Client Free Bonus Days</span>
              </div>
              <button 
                onClick={() => {
                  setSelectedBizForBonus(null);
                  setBonusSuccessMsg('');
                }} 
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {bonusSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{bonusSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleGrantBonusSubmit} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-1">
                  <div className="text-xs text-purple-300 font-semibold">Target Business Account:</div>
                  <div className="text-base font-bold text-white">{selectedBizForBonus.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">ID: {selectedBizForBonus.id} | Code: {selectedBizForBonus.code || 'N/A'}</div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Quick Bonus Days Presets
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[7, 14, 30, 60].map((days) => (
                      <button
                        type="button"
                        key={days}
                        onClick={() => setBonusDaysInput(days)}
                        className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                          bonusDaysInput === days
                            ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        +{days} Days
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Bonus Days to Grant <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={bonusDaysInput}
                    onChange={(e) => setBonusDaysInput(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono font-bold text-sm focus:border-purple-400 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Extends the client's subscription expiration date and automatically activates the business in ACTIVE state.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Promotion / Bonus Reason Note
                  </label>
                  <input
                    type="text"
                    value={bonusReasonInput}
                    onChange={(e) => setBonusReasonInput(e.target.value)}
                    placeholder="e.g. Free Activation Bonus / Customer Appreciation Promotion"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:border-purple-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedBizForBonus(null)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBonus || bonusDaysInput <= 0}
                    className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl transition shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Gift className="w-4 h-4" />
                    <span>{isSubmittingBonus ? 'Activating Bonus...' : `Activate +${bonusDaysInput} Free Days`}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: EMERGENCY OVERRIDE */}
      {selectedBizForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <KeyRound className="w-5 h-5" />
                <span>Super Admin Emergency Override</span>
              </div>
              <button onClick={() => setSelectedBizForOverride(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveOverride} className="mt-4 space-y-4">
              <p className="text-xs text-slate-300">
                Grant temporary license to <strong>{selectedBizForOverride.name}</strong> without automated MoMo verification.
              </p>

              {overrideError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-700 text-rose-300 text-xs">
                  {overrideError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Super Admin Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Pksquare@1"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Duration Granted</label>
                <select
                  value={overrideDays}
                  onChange={(e) => setOverrideDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                >
                  <option value={3}>3 Days Emergency Extension</option>
                  <option value={7}>7 Days One-Week License</option>
                  <option value={14}>14 Days Grace Override</option>
                  <option value={30}>30 Days Full Month Access</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mandatory Justification Reason</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Paid in Cash / Bank transfer confirmation received"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedBizForOverride(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride}
                  className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition"
                >
                  {isSubmittingOverride ? 'Authorizing...' : 'Authorize Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GRACE PERIOD */}
      {selectedBizForGrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Set Grace Period Days</h4>
              <button onClick={() => setSelectedBizForGrace(null)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleUpdateGracePeriod} className="mt-4 space-y-3">
              <p className="text-xs text-slate-400">
                Set allowable grace days after expiration for <strong>{selectedBizForGrace.name}</strong> (Default: 0 days).
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Grace Period Days</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={graceDaysInput}
                  onChange={(e) => setGraceDaysInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBizForGrace(null)}
                  className="px-3 py-1.5 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl"
                >
                  Save Grace Days
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW BUSINESS */}
      {showAddBizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Register New Business Tenant</h4>
              <button onClick={() => setShowAddBizModal(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateBusiness} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Business / Property Name</label>
                <input
                  type="text"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  placeholder="e.g. Serena Vista Hotel & Lounge"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={newBizCategory}
                  onChange={(e) => setNewBizCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                >
                  <option value="Hotel">Hotel</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Bar">Bar & Lounge</option>
                  <option value="Resort">Resort & Spa</option>
                  <option value="Cafe">Cafe & Bistro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Owner / Manager Full Name</label>
                <input
                  type="text"
                  value={newBizOwner}
                  onChange={(e) => setNewBizOwner(e.target.value)}
                  placeholder="e.g. Jean Paul Mugisha"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Owner Contact Phone</label>
                <input
                  type="tel"
                  value={newBizPhone}
                  onChange={(e) => setNewBizPhone(e.target.value)}
                  placeholder="+250 788 123 456"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Owner Email</label>
                <input
                  type="email"
                  value={newBizEmail}
                  onChange={(e) => setNewBizEmail(e.target.value)}
                  placeholder="manager@hotel.rw"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                ℹ️ The new business will be created in <strong>PENDING_PAYMENT</strong> status and must pay 100,000 RWF via MTN MoMo to activate.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddBizModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl"
                >
                  Register Business
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
