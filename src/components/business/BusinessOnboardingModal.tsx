import React, { useState } from 'react';
import { 
  Building2, CheckCircle2, ChevronRight, ChevronLeft, Sparkles, 
  ShieldCheck, ArrowRight, Layers, HelpCircle, Check, Info, 
  ShoppingBag, Hotel, Utensils, Hammer, Scissors, Heart, DollarSign
} from 'lucide-react';
import { BusinessType, BusinessModuleKey, Business, AppUser } from '../../types';
import { ALL_BUSINESS_TYPES, BusinessTypeDefinition, getBusinessTypeConfig } from '../../lib/businessConfig';
import { registerBusinessUser } from '../../lib/auth';
import { formatCurrency } from '../../lib/currency';

interface BusinessOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AppUser, business: Business) => void;
  darkMode?: boolean;
}

export const BusinessOnboardingModal: React.FC<BusinessOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  darkMode = false
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: User Account Details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('1234');

  // Step 2: Business Profile
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('RWF');

  // Step 3: Business Type Selection
  const [selectedType, setSelectedType] = useState<BusinessType>('HOTEL');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  // Step 4: Modules Customization
  const [enabledModules, setEnabledModules] = useState<BusinessModuleKey[]>([]);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const currentTypeConfig = getBusinessTypeConfig(selectedType);

  const handleSelectType = (type: BusinessType) => {
    setSelectedType(type);
    const config = getBusinessTypeConfig(type);
    setEnabledModules([...config.defaultEnabledModules]);
  };

  const toggleModule = (modKey: BusinessModuleKey) => {
    setEnabledModules(prev => 
      prev.includes(modKey) ? prev.filter(m => m !== modKey) : [...prev, modKey]
    );
  };

  const handleNextFromTypeSelection = () => {
    if (enabledModules.length === 0) {
      setEnabledModules([...currentTypeConfig.defaultEnabledModules]);
    }
    setStep(4);
  };

  const handleCompleteRegistration = async () => {
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const result = await registerBusinessUser({
        businessName: businessName.trim(),
        businessType: selectedType,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: (phone || businessPhone).trim(),
        password: password.trim(),
        pinCode: pinCode.trim() || '1234',
        address: address.trim(),
        currency: currency || 'RWF',
        enabledModules: enabledModules.length > 0 ? enabledModules : currentTypeConfig.defaultEnabledModules,
        customCategories: currentTypeConfig.defaultCategories,
        customUnits: currentTypeConfig.defaultUnits
      });

      if (result.success && result.user && result.business) {
        onSuccess(result.user, result.business);
      } else {
        setErrorMessage(result.error || 'Failed to create business account.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during registration.');
      setIsSubmitting(false);
    }
  };

  const categories = ['All', 'Hospitality', 'Food & Beverage', 'Retail & Fashion', 'Trade & Construction', 'Services & Auto', 'Health & Beauty', 'General'];

  const filteredTypes = ALL_BUSINESS_TYPES.filter(b => {
    if (filterCategory === 'All') return true;
    return b.category === filterCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden my-6 transition-all ${
        darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Modal Header */}
        <div className={`p-6 border-b flex items-center justify-between ${
          darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Step {step} of 4
              </span>
              <span className="text-xs text-slate-400 font-medium">Business Onboarding</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black">
              {step === 1 && 'Create Manager Account'}
              {step === 2 && 'Business Profile & Details'}
              {step === 3 && 'Choose Your Business Type'}
              {step === 4 && 'Tailor Modules & Features'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-medium">
              {errorMessage}
            </div>
          )}

          {/* Step 1: User Account */}
          {step === 1 && (
            <div className="space-y-4 max-w-xl mx-auto py-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                  Manager / Owner Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. John Bosco Habimana"
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                    Email Address (Login) *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="manager@business.rw"
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                    Phone Number (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+250 780 000 000"
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                    Quick Staff PIN Code (4 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={pinCode}
                    onChange={e => setPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Business Profile */}
          {step === 2 && (
            <div className="space-y-4 max-w-xl mx-auto py-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                  Business / Trading Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. Modern Trend Boutique, Sky View Hotel, etc."
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                    Business Phone / Hotline
                  </label>
                  <input
                    type="tel"
                    value={businessPhone}
                    onChange={e => setBusinessPhone(e.target.value)}
                    placeholder="+250 788 123 456"
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                    Primary Currency
                  </label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="RWF">RWF - Rwandan Franc</option>
                    <option value="USD">USD - US Dollar ($)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="UGX">UGX - Ugandan Shilling</option>
                    <option value="KES">KES - Kenyan Shilling</option>
                    <option value="TZS">TZS - Tanzanian Shilling</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">
                  Physical Address / Location
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Kigali, Nyarugenge, Commercial Street No. 45"
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Step 3: Choose Business Type */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      filterCategory === cat
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : darkMode
                        ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Business Types Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {filteredTypes.map(bType => {
                  const isSelected = selectedType === bType.type;
                  return (
                    <div
                      key={bType.type}
                      onClick={() => handleSelectType(bType.type)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative flex flex-col justify-between ${
                        isSelected
                          ? darkMode 
                            ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50' 
                            : 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/40'
                          : darkMode
                          ? 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}

                      <div>
                        <div className="text-3xl mb-2">{bType.icon}</div>
                        <div className="text-sm font-bold tracking-tight mb-1">{bType.label}</div>
                        <p className={`text-xs line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {bType.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-700/30 flex items-center justify-between text-[11px] font-semibold text-indigo-400">
                        <span>{bType.category}</span>
                        <span>{bType.defaultEnabledModules.length} Modules</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Modules Review & Toggles */}
          {step === 4 && (
            <div className="space-y-6">
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                darkMode ? 'bg-indigo-950/30 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'
              }`}>
                <div className="text-3xl">{currentTypeConfig.icon}</div>
                <div>
                  <div className="text-sm font-bold">Selected: {currentTypeConfig.label}</div>
                  <p className="text-xs text-slate-400">
                    The platform has pre-configured recommended modules for your industry. You can customize them now or change them later in Settings.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Recommended & Optional Modules
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {Array.from(new Set([...currentTypeConfig.defaultEnabledModules, ...currentTypeConfig.optionalModules])).map(modKey => {
                    const isEnabled = enabledModules.includes(modKey);
                    const formattedName = modKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                    return (
                      <div
                        key={modKey}
                        onClick={() => toggleModule(modKey)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isEnabled
                            ? darkMode
                              ? 'bg-slate-800/80 border-indigo-500/50 text-white'
                              : 'bg-indigo-50/50 border-indigo-300 text-slate-900'
                            : darkMode
                            ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <span className="text-xs font-bold">{formattedName}</span>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                          isEnabled ? 'bg-indigo-600 text-white' : 'border border-slate-600 text-transparent'
                        }`}>
                          ✓
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className={`p-6 border-t flex items-center justify-between ${
          darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          {step > 1 ? (
            <button
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 1) {
                  if (!fullName.trim() || !email.trim() || !password.trim()) {
                    setErrorMessage('Please fill in Full Name, Email, and Password.');
                    return;
                  }
                  setErrorMessage('');
                  setStep(2);
                } else if (step === 2) {
                  if (!businessName.trim()) {
                    setErrorMessage('Please enter your Business Name.');
                    return;
                  }
                  setErrorMessage('');
                  setStep(3);
                } else if (step === 3) {
                  handleNextFromTypeSelection();
                }
              }}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCompleteRegistration}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Creating Business...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Launch Workspace
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
