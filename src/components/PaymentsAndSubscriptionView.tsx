import React, { useState, useEffect } from 'react';
import { 
  CreditCard, ShieldCheck, Clock, Calendar, CheckCircle2, AlertTriangle, 
  RotateCw, Smartphone, Download, FileText, ArrowUpRight, History, 
  Building2, Phone, Hash, RefreshCw, Zap, Sparkles, KeyRound,
  Copy, Check, PhoneCall, Lock, Landmark, Edit3, Sliders, Plus, Trash2, Save, RotateCcw
} from 'lucide-react';
import { Business, Subscription, SubscriptionPayment, AppUser, SubscriptionLicense, PlatformPaymentSettings, SubscriptionPlanDuration } from '../types';
import { 
  loadCurrentBusiness, loadSubscriptions, loadSubscriptionPayments, 
  saveSubscriptions, saveCurrentBusiness, evaluateSubscriptionMetrics,
  loadPlatformPaymentSettings, apiSuperAdminGetPaymentSettings 
} from '../lib/storage';
import { 
  activateBusinessWithLicense, 
  loadStoredLicenses, SubscriptionPlanConfig,
  loadSubscriptionPlansConfig, saveSubscriptionPlansConfig, DEFAULT_SUBSCRIPTION_PLANS
} from '../lib/license';

interface PaymentsAndSubscriptionViewProps {
  currentUser: AppUser;
  darkMode?: boolean;
}

export const PaymentsAndSubscriptionView: React.FC<PaymentsAndSubscriptionViewProps> = ({
  currentUser,
  darkMode = false
}) => {
  const [business, setBusiness] = useState<Business>(() => loadCurrentBusiness());
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => loadSubscriptions());
  const [payments, setPayments] = useState<SubscriptionPayment[]>(() => loadSubscriptionPayments());
  const [licenses, setLicenses] = useState<SubscriptionLicense[]>(() => loadStoredLicenses());
  const [paymentSettings, setPaymentSettings] = useState<PlatformPaymentSettings>(() => loadPlatformPaymentSettings());
  const [plansConfig, setPlansConfig] = useState<Record<SubscriptionPlanDuration, SubscriptionPlanConfig>>(() => loadSubscriptionPlansConfig());
  
  // Current subscription for active business
  const currentSub = subscriptions.find(s => s.businessId === business.id) || subscriptions[0];
  const metrics = evaluateSubscriptionMetrics(currentSub);

  // License Activation Modal State
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseInput, setLicenseInput] = useState('');
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [licenseFeedback, setLicenseFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Plan Customization & Editing State
  const [showPlanEditorModal, setShowPlanEditorModal] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<SubscriptionPlanDuration>('MONTHLY');
  const [editPlanDraft, setEditPlanDraft] = useState<SubscriptionPlanConfig>(() => ({ ...plansConfig.MONTHLY }));
  const [newFeatureInput, setNewFeatureInput] = useState('');
  const [planSaveFeedback, setPlanSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    apiSuperAdminGetPaymentSettings()
      .then(res => {
        if (res.success && res.settings) {
          setPaymentSettings(res.settings);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Open Plan Editor for a specific plan
  const handleOpenPlanEditor = (planKey?: SubscriptionPlanDuration) => {
    const targetKey = planKey || 'MONTHLY';
    setSelectedPlanKey(targetKey);
    setEditPlanDraft({ ...(plansConfig[targetKey] || DEFAULT_SUBSCRIPTION_PLANS[targetKey]) });
    setNewFeatureInput('');
    setPlanSaveFeedback(null);
    setShowPlanEditorModal(true);
  };

  // Handle switching active tab in plan editor modal
  const handleSelectEditPlanTab = (key: SubscriptionPlanDuration) => {
    setSelectedPlanKey(key);
    setEditPlanDraft({ ...(plansConfig[key] || DEFAULT_SUBSCRIPTION_PLANS[key]) });
    setNewFeatureInput('');
    setPlanSaveFeedback(null);
  };

  // Add feature bullet point
  const handleAddFeature = () => {
    if (!newFeatureInput.trim()) return;
    const existingFeatures = editPlanDraft.features || [];
    setEditPlanDraft({
      ...editPlanDraft,
      features: [...existingFeatures, newFeatureInput.trim()]
    });
    setNewFeatureInput('');
  };

  // Remove feature bullet point
  const handleRemoveFeature = (index: number) => {
    const updated = (editPlanDraft.features || []).filter((_, i) => i !== index);
    setEditPlanDraft({
      ...editPlanDraft,
      features: updated
    });
  };

  // Save current edited plan
  const handleSavePlanChanges = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPlans = {
      ...plansConfig,
      [selectedPlanKey]: {
        ...editPlanDraft,
        amount: Number(editPlanDraft.amount) || 0,
        durationDays: Number(editPlanDraft.durationDays) || 30
      }
    };
    setPlansConfig(updatedPlans);
    saveSubscriptionPlansConfig(updatedPlans);
    setPlanSaveFeedback(`"${editPlanDraft.name}" saved and updated successfully!`);
    setTimeout(() => {
      setPlanSaveFeedback(null);
    }, 3000);
  };

  // Reset to default factory plans
  const handleResetPlansToDefault = () => {
    if (window.confirm('Reset all subscription plans and pricing back to platform defaults?')) {
      setPlansConfig(DEFAULT_SUBSCRIPTION_PLANS);
      saveSubscriptionPlansConfig(DEFAULT_SUBSCRIPTION_PLANS);
      setEditPlanDraft({ ...DEFAULT_SUBSCRIPTION_PLANS[selectedPlanKey] });
      setPlanSaveFeedback('All plans restored to default pricing!');
      setTimeout(() => setPlanSaveFeedback(null), 3000);
    }
  };

  // Business licenses list
  const businessLicenses = licenses.filter(l => l.businessId === business.id);

  // Format license input with dashes
  const handleLicenseInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 12) val = val.slice(0, 12);
    const parts = [];
    for (let i = 0; i < val.length; i += 4) {
      parts.push(val.slice(i, i + 4));
    }
    setLicenseInput(parts.join('-'));
  };

  const handleActivateLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseInput.trim()) return;

    setIsActivatingLicense(true);
    setLicenseFeedback(null);

    try {
      const res = await activateBusinessWithLicense(business.id, licenseInput.trim(), currentUser);
      if (res.success && res.business && res.subscription) {
        setLicenseFeedback({ type: 'success', text: res.message || 'License activated successfully!' });
        setBusiness(res.business);
        setSubscriptions(loadSubscriptions());
        setLicenses(loadStoredLicenses());
        setTimeout(() => {
          setShowLicenseModal(false);
          setLicenseInput('');
          setLicenseFeedback(null);
        }, 1500);
      } else {
        setLicenseFeedback({ type: 'error', text: res.error || 'Failed to activate license.' });
      }
    } catch (err: any) {
      setLicenseFeedback({ type: 'error', text: err.message || 'License verification failed.' });
    } finally {
      setIsActivatingLicense(false);
    }
  };

  const plansList = Object.values(plansConfig) as SubscriptionPlanConfig[];

  // Days calculation
  const expiryDate = currentSub?.expiryDate ? new Date(currentSub.expiryDate) : null;
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  const isExpiringSoon = daysLeft <= 5 && daysLeft > 0;
  const isExpired = daysLeft <= 0 && Boolean(expiryDate);

  return (
    <div className={`p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Business License Authority
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Business Subscription & Licensing</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized SaaS license status, plan renewals, and payment verification for <strong>{business.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenPlanEditor()}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-amber-400 border border-slate-700 font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>Edit Plans & Pricing</span>
          </button>

          <button
            onClick={() => setShowLicenseModal(true)}
            className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>Renew / Enter License Code</span>
          </button>
        </div>
      </div>

      {/* Main License Overview Card */}
      <div className={`p-6 sm:p-8 rounded-3xl border ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      } shadow-xl relative overflow-hidden`}>
        
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          
          {/* Left info */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black">{business.name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                  <span>Business ID: {business.code || business.id}</span>
                  <span>•</span>
                  <span>{business.category || 'Hotel & Hospitality'}</span>
                </div>
              </div>
            </div>

            {/* Single subscription policy */}
            <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
              darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100">Enterprise Unified License: </span>
                <span>
                  All staff members (Cashiers, Waiters, Accountants, Receptionists, Kitchen staff) inherit access from this single business subscription.
                </span>
              </div>
            </div>
          </div>

          {/* Right Status Block */}
          <div className={`lg:col-span-5 p-6 rounded-2xl border ${
            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          } flex flex-col justify-between space-y-4`}>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subscription Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                business.status === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : business.status === 'PENDING_PAYMENT'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}>
                {business.status || 'ACTIVE'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black tracking-tight">
                  {daysLeft > 0 ? `${daysLeft} Days` : isExpired ? 'Expired' : 'Active'}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {expiryDate ? `Expires: ${expiryDate.toLocaleDateString()}` : 'Standard Active'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    isExpired ? 'bg-rose-500 w-full' : isExpiringSoon ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(10, (daysLeft / 30) * 100))}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setShowLicenseModal(true)}
              className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Enter New License Code</span>
            </button>
          </div>

        </div>
      </div>

      {/* Subscription Plans Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight">Available Subscription Plans</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Configurable
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select or customize duration tiers. Pay via MTN MoMo, Card or Bank Transfer and enter your license code.
            </p>
          </div>

          <button
            onClick={() => handleOpenPlanEditor()}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Plans & Pricing</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plansList.map(plan => (
            <div 
              key={plan.id}
              className={`p-6 rounded-3xl border flex flex-col justify-between transition-all relative group ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              } hover:border-amber-500/50 hover:shadow-lg`}
            >
              {/* Quick Edit Button on Top Right */}
              <button
                type="button"
                onClick={() => handleOpenPlanEditor(plan.id)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-slate-400 transition cursor-pointer shadow-sm"
                title={`Edit ${plan.name}`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <div>
                <div className="flex items-center justify-between mb-3 pr-8">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    {plan.badge || `${plan.durationDays} Days`}
                  </span>
                  {plan.id === 'YEARLY' && (
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Best Value
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">{plan.amount.toLocaleString()}</span>
                    <span className="text-xs font-bold text-amber-500">RWF</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{plan.description}</p>
                </div>

                {/* Features List */}
                <ul className="space-y-1.5 text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
                  {(plan.features || ['All Employees Included', 'Multi-Device Sync', 'Cloud Backup & Sync']).map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 mt-5">
                <button
                  onClick={() => setShowLicenseModal(true)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 dark:hover:bg-amber-500 dark:hover:text-slate-950 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Renew with this Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPlanEditor(plan.id)}
                  className="w-full py-1.5 text-[11px] text-slate-500 hover:text-amber-400 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Customize Plan</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Official Payment Accounts (MoMo & Bank Transfer) */}
      <div className={`p-6 rounded-3xl border ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      } space-y-4 shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Payment Channels
            </span>
            <h3 className="font-bold text-sm">Official Subscription Receiving Accounts</h3>
          </div>
          <a
            href={`https://wa.me/${(paymentSettings.supportPhone || '250726134041').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Super Admin, I have paid the subscription for ${business.name}`)}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Support on WhatsApp</span>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MoMo Card */}
          <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
            <div className="flex items-center justify-between text-xs font-bold text-amber-500">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                MTN Mobile Money (Rwanda)
              </span>
              <button
                type="button"
                onClick={() => handleCopy(paymentSettings.momoNumber, 'view-momo')}
                className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'view-momo' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'view-momo' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-xl font-mono font-black tracking-wider text-amber-500">{paymentSettings.momoNumber || '0726134041'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Account Name: <strong>{paymentSettings.momoAccountName || 'Theogene / YusKar Empire'}</strong>
            </p>
            {paymentSettings.momoUssdCode && (
              <p className="text-[11px] font-mono text-slate-400">USSD: <strong>{paymentSettings.momoUssdCode}</strong></p>
            )}
          </div>

          {/* Bank Account Card */}
          <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
            <div className="flex items-center justify-between text-xs font-bold text-blue-500">
              <span className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4" />
                {paymentSettings.primaryBankName || 'Bank of Kigali (BK)'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(paymentSettings.primaryBankAccount, 'view-bank')}
                className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'view-bank' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'view-bank' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-sm font-mono font-black tracking-wider text-blue-400">{paymentSettings.primaryBankAccount || '00040-0694038-34'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Account Name: <strong>{paymentSettings.primaryAccountName || 'YUSKAR EMPIRE LTD'}</strong>
            </p>
            {paymentSettings.primaryBranch && (
              <p className="text-[11px] text-slate-400">
                Branch: <strong>{paymentSettings.primaryBranch}</strong> {paymentSettings.primarySwiftCode ? `(${paymentSettings.primarySwiftCode})` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* License History Table */}
      {businessLicenses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-black tracking-tight">Issued Business Licenses</h2>
          <div className={`border rounded-2xl overflow-hidden shadow-sm ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">License Code</th>
                  <th className="py-3 px-4">Duration Tier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Activated Date</th>
                  <th className="py-3 px-4">Expiration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {businessLicenses.map(lic => (
                  <tr key={lic.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-amber-500">
                      {lic.licenseCode}
                    </td>
                    <td className="py-3 px-4">
                      {lic.plan} ({lic.durationDays} Days)
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        lic.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'
                      }`}>
                        {lic.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {lic.activatedAt ? new Date(lic.activatedAt).toLocaleDateString() : 'Pending'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOMIZE & EDIT SUBSCRIPTION PLANS */}
      {showPlanEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-2xl rounded-3xl border p-6 sm:p-8 shadow-2xl space-y-6 ${
            darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Customize Subscription Plans & Pricing</h3>
                  <p className="text-xs text-slate-400">Modify plan duration, pricing tiers, badges, and features.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanEditorModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Plan Tier Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'] as SubscriptionPlanDuration[]).map((key) => {
                const plan = plansConfig[key] || DEFAULT_SUBSCRIPTION_PLANS[key];
                const isSelected = selectedPlanKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectEditPlanTab(key)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold text-center transition border cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <div>{plan.name}</div>
                    <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-slate-900 font-black' : 'text-amber-400'}`}>
                      {plan.amount.toLocaleString()} RWF
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Feedback notification */}
            {planSaveFeedback && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{planSaveFeedback}</span>
              </div>
            )}

            {/* Edit Form */}
            <form onSubmit={handleSavePlanChanges} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Plan Display Title <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editPlanDraft.name}
                    onChange={(e) => setEditPlanDraft({ ...editPlanDraft, name: e.target.value })}
                    placeholder="e.g. Monthly License"
                    className="w-full px-3.5 py-2.5 rounded-xl border font-bold text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-white focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Subscription Fee (RWF) <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={editPlanDraft.amount}
                    onChange={(e) => setEditPlanDraft({ ...editPlanDraft, amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border font-mono font-bold text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-amber-400 focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Duration in Days <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={editPlanDraft.durationDays}
                    onChange={(e) => setEditPlanDraft({ ...editPlanDraft, durationDays: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border font-mono font-bold text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-white focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    value={editPlanDraft.badge}
                    onChange={(e) => setEditPlanDraft({ ...editPlanDraft, badge: e.target.value })}
                    placeholder="e.g. 30 Days / Popular / Best Value"
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Plan Description
                </label>
                <input
                  type="text"
                  value={editPlanDraft.description}
                  onChange={(e) => setEditPlanDraft({ ...editPlanDraft, description: e.target.value })}
                  placeholder="e.g. Standard monthly operations terminal access"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Feature Points Management */}
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Included Feature Bullet Points
                </label>
                <div className="space-y-2 mb-2 max-h-36 overflow-y-auto">
                  {(editPlanDraft.features || []).map((feat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{feat}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Remove feature"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFeatureInput}
                    onChange={(e) => setNewFeatureInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                    placeholder="Add feature item (e.g. 24/7 Priority Support)..."
                    className="flex-1 px-3 py-2 rounded-xl border text-xs bg-slate-950 border-slate-700 text-white focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs flex items-center gap-1 border border-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleResetPlansToDefault}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Defaults</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPlanEditorModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save {editPlanDraft.name}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW / ENTER LICENSE MODAL */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl border p-6 sm:p-8 shadow-2xl ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold">Activate License Code</h3>
              </div>
              <button
                onClick={() => { setShowLicenseModal(false); setLicenseFeedback(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleActivateLicenseSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  12-Character License Code
                </label>
                <input
                  type="text"
                  value={licenseInput}
                  onChange={handleLicenseInputChange}
                  placeholder="e.g. SVR7-X92K-4M8P"
                  className="w-full px-4 py-3 rounded-xl border-2 font-mono text-base font-bold tracking-widest uppercase bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-amber-500 focus:outline-none text-center"
                  maxLength={14}
                  required
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Single-use code issued by the Super Admin upon verified MoMo payment.
                </p>
              </div>

              {licenseFeedback && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  licenseFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}>
                  {licenseFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{licenseFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isActivatingLicense || !licenseInput.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isActivatingLicense ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validating Authority...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Apply License Activation</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
