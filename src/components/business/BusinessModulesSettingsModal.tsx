import React, { useState } from 'react';
import { Layers, CheckCircle2, Save, X, Sparkles, ShieldCheck } from 'lucide-react';
import { Business, BusinessModuleKey } from '../../types';
import { ALL_BUSINESS_TYPES, getBusinessTypeConfig, isModuleEnabled } from '../../lib/businessConfig';
import { saveBusinessConfig } from '../../lib/storage';

interface BusinessModulesSettingsModalProps {
  business: Business;
  isOpen: boolean;
  onClose: () => void;
  onUpdateBusiness: (updated: Business) => void;
  darkMode?: boolean;
}

export const BusinessModulesSettingsModal: React.FC<BusinessModulesSettingsModalProps> = ({
  business,
  isOpen,
  onClose,
  onUpdateBusiness,
  darkMode = false
}) => {
  const config = getBusinessTypeConfig(business);
  const [enabledModules, setEnabledModules] = useState<BusinessModuleKey[]>(
    business.enabledModules || config.defaultEnabledModules
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const toggleModule = (modKey: BusinessModuleKey) => {
    setEnabledModules(prev =>
      prev.includes(modKey) ? prev.filter(m => m !== modKey) : [...prev, modKey]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updatedBusiness: Business = {
      ...business,
      enabledModules,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await saveBusinessConfig(updatedBusiness);
    onUpdateBusiness(updatedBusiness);
    setIsSaving(false);
    onClose();
  };

  const allAvailableKeys = Array.from(
    new Set([...config.defaultEnabledModules, ...config.optionalModules, ...ALL_BUSINESS_TYPES.flatMap(b => b.defaultEnabledModules)])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden ${
        darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className={`p-5 border-b flex items-center justify-between ${
          darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold">Business Modules & Navigation Features</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
          <p className="text-xs text-slate-400">
            Customize the active navigation tabs and operational modules for <strong>{business.name}</strong>. Disabling a module hides it from navigation without deleting any historical data.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {allAvailableKeys.map(modKey => {
              const isEnabled = enabledModules.includes(modKey);
              const label = modKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

              return (
                <div
                  key={modKey}
                  onClick={() => toggleModule(modKey)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isEnabled
                      ? darkMode
                        ? 'bg-slate-800/90 border-indigo-500/50 text-white'
                        : 'bg-indigo-50 border-indigo-300 text-slate-900'
                      : darkMode
                      ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
                      : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  <span className="text-xs font-bold">{label}</span>
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

        <div className={`p-4 border-t flex items-center justify-end gap-3 ${
          darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving Changes...' : 'Save & Apply Modules'}
          </button>
        </div>
      </div>
    </div>
  );
};
