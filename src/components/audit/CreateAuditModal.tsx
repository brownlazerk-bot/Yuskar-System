import React, { useState, useMemo } from 'react';
import { 
  X, Plus, Calendar, Clock, Building, Layers, 
  CheckSquare, FileText, Sparkles, UserCheck, AlertCircle 
} from 'lucide-react';
import { 
  StockAudit, AuditScopeType, AuditFrequency, 
  AppUser, MenuItem, KitchenIngredient 
} from '../../types';
import { 
  loadMenuItems, loadIngredients, loadUsers, 
  getActiveBusinessId, addAuditLog 
} from '../../lib/storage';
import { buildAuditItemSnapshots, recalculateAuditSummary } from '../../lib/auditEngine';

interface CreateAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuditCreated: (audit: StockAudit) => void;
  currentUser: AppUser | null;
  darkMode: boolean;
}

export const CreateAuditModal: React.FC<CreateAuditModalProps> = ({
  isOpen,
  onClose,
  onAuditCreated,
  currentUser,
  darkMode
}) => {
  const menuItems = useMemo(() => loadMenuItems(), [isOpen]);
  const ingredients = useMemo(() => loadIngredients(), [isOpen]);
  const users = useMemo(() => loadUsers(), [isOpen]);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  // Default start date: beginning of today or 7 days ago
  const startDefault = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const endDefault = now.toISOString().slice(0, 16);

  const [name, setName] = useState('End of Day Bar Audit');
  const [frequency, setFrequency] = useState<AuditFrequency>('DAILY');
  const [auditDate, setAuditDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(startDefault);
  const [endDate, setEndDate] = useState(endDefault);
  const [scopeType, setScopeType] = useState<AuditScopeType>('DEPARTMENT');
  const [department, setDepartment] = useState('Bar / Beverage');
  const [category, setCategory] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [auditorName, setAuditorName] = useState(currentUser?.fullName || 'Duty Auditor');
  const [location, setLocation] = useState('Main Bar Counter');
  const [notes, setNotes] = useState('');
  const [searchItemTerm, setSearchItemTerm] = useState('');

  if (!isOpen) return null;

  // Preset quick titles
  const quickTitles = [
    { title: 'End of Day Bar Audit', dept: 'Bar / Beverage', freq: 'DAILY' as AuditFrequency, scope: 'DEPARTMENT' as AuditScopeType },
    { title: 'Weekly Main Store Audit', dept: 'Main Store', freq: 'WEEKLY' as AuditFrequency, scope: 'DEPARTMENT' as AuditScopeType },
    { title: 'Monthly Hotel Stock Audit', dept: 'Entire Business', freq: 'MONTHLY' as AuditFrequency, scope: 'ENTIRE_BUSINESS' as AuditScopeType },
    { title: 'Restaurant Kitchen Audit', dept: 'Kitchen', freq: 'DAILY' as AuditFrequency, scope: 'DEPARTMENT' as AuditScopeType },
    { title: 'Pool & Sauna Refreshments Audit', dept: 'Swimming Pool', freq: 'WEEKLY' as AuditFrequency, scope: 'DEPARTMENT' as AuditScopeType },
  ];

  // Calculate items count preview
  const previewItems = buildAuditItemSnapshots({
    scopeType,
    department: scopeType === 'DEPARTMENT' ? department : undefined,
    category: scopeType === 'CATEGORY' ? category : undefined,
    specificItemIds: scopeType === 'SPECIFIC_ITEMS' ? selectedItemIds : undefined,
    startDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate).toISOString()
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const startIso = new Date(startDate).toISOString();
    const endIso = new Date(endDate).toISOString();

    const snapshotItems = buildAuditItemSnapshots({
      scopeType,
      department: scopeType === 'DEPARTMENT' ? department : undefined,
      category: scopeType === 'CATEGORY' ? category : undefined,
      specificItemIds: scopeType === 'SPECIFIC_ITEMS' ? selectedItemIds : undefined,
      startDate: startIso,
      endDate: endIso
    });

    const activeBizId = getActiveBusinessId();

    const baseAudit: Omit<StockAudit, 'id' | 'auditNumber' | 'createdAt' | 'updatedAt'> = {
      businessId: activeBizId,
      name: name.trim(),
      auditDate,
      startDate: startIso,
      endDate: endIso,
      frequency,
      scopeType,
      department: scopeType === 'DEPARTMENT' ? department : (scopeType === 'ENTIRE_BUSINESS' ? 'Entire Business' : (category || 'General')),
      location: location.trim() || undefined,
      category: scopeType === 'CATEGORY' ? category : undefined,
      status: 'IN_PROGRESS',
      auditorId: currentUser?.id || 'auditor-01',
      auditorName: auditorName.trim() || currentUser?.fullName || 'Auditor',
      auditorRole: currentUser?.role || 'Storekeeper',
      totalItemsCount: snapshotItems.length,
      itemsCounted: 0,
      totalOpeningValue: 0,
      totalReceivedValue: 0,
      totalUsageValue: 0,
      totalExpectedValue: 0,
      totalPhysicalValue: 0,
      totalDiscrepanciesCount: 0,
      totalShortageCount: 0,
      totalSurplusCount: 0,
      totalMatchedCount: 0,
      estimatedLossValue: 0,
      estimatedSurplusValue: 0,
      netVarianceValue: 0,
      riskLevel: 'LOW',
      generalNotes: notes.trim() || undefined,
      items: snapshotItems
    };

    const finalizedAudit = recalculateAuditSummary(baseAudit as any);
    onAuditCreated(finalizedAudit);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        userEmail: currentUser.email,
        action: 'AUDIT_CREATED',
        category: 'Inventory',
        details: `Created stock audit "${name}" for ${baseAudit.department} (${snapshotItems.length} items snapshot frozen)`
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-8 ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg">Create New Stock Audit</h2>
              <p className="text-xs text-slate-400">Initialize a stock audit snapshot and calculate theoretical stock balances</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className={`px-5 py-3 border-b text-xs flex items-center gap-2 overflow-x-auto no-scrollbar ${
          darkMode ? 'border-slate-800/80 bg-slate-900/40' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <span className="text-slate-400 font-semibold flex items-center gap-1 whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets:
          </span>
          {quickTitles.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setName(preset.title);
                setDepartment(preset.dept);
                setFrequency(preset.freq);
                setScopeType(preset.scope);
              }}
              className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors cursor-pointer ${
                name === preset.title
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold'
                  : darkMode 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {preset.title}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
          {/* Audit Name & Frequency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Audit Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. End of Day Bar Audit"
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as AuditFrequency)}
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              >
                <option value="DAILY">Daily (End of Shift)</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ADHOC">Ad-hoc / Spot Check</option>
              </select>
            </div>
          </div>

          {/* Dates & Time Period */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Audit Date</label>
              <input
                type="date"
                required
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Period Start</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border outline-none text-xs ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Period End</label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border outline-none text-xs ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              />
            </div>
          </div>

          {/* Scope Type Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">Audit Scope</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'ENTIRE_BUSINESS', label: 'Entire Business' },
                { id: 'DEPARTMENT', label: 'By Department' },
                { id: 'CATEGORY', label: 'By Category' },
                { id: 'SPECIFIC_ITEMS', label: 'Specific Items' }
              ].map((scope) => (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setScopeType(scope.id as AuditScopeType)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    scopeType === scope.id
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                      : darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Scope Selectors */}
          {scopeType === 'DEPARTMENT' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Select Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              >
                <option value="Bar / Beverage">Bar / Beverage</option>
                <option value="Kitchen">Kitchen (Food & Raw Ingredients)</option>
                <option value="Restaurant">Restaurant POS</option>
                <option value="Swimming Pool">Swimming Pool</option>
                <option value="Sauna">Sauna</option>
                <option value="Room Service">Room Service</option>
                <option value="Main Store">Main Beverage & Food Store</option>
                <option value="Entire Business">All Departments</option>
              </select>
            </div>
          )}

          {scopeType === 'CATEGORY' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Select Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              >
                <option value="">-- Choose Category --</option>
                <option value="Beers">Beers</option>
                <option value="Soft Drinks">Soft Drinks</option>
                <option value="Wines">Wines</option>
                <option value="Whisky">Whisky / Spirits</option>
                <option value="Cocktails">Cocktails</option>
                <option value="Juices">Juices</option>
                <option value="Water">Water</option>
                <option value="Food">Food / Kitchen Dishes</option>
                <option value="Meat & Poultry">Meat & Poultry (Raw)</option>
                <option value="Grains & Rice">Grains & Rice (Raw)</option>
                <option value="Vegetables & Produce">Vegetables & Produce</option>
                <option value="Dairy & Eggs">Dairy & Eggs</option>
              </select>
            </div>
          )}

          {scopeType === 'SPECIFIC_ITEMS' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Select Specific Items ({selectedItemIds.length} selected)
              </label>
              <input
                type="text"
                placeholder="Filter items to select..."
                value={searchItemTerm}
                onChange={(e) => setSearchItemTerm(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              />
              <div className={`max-h-36 overflow-y-auto p-2 rounded-xl border space-y-1 ${
                darkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                {[...menuItems, ...ingredients]
                  .filter(item => !searchItemTerm || item.name.toLowerCase().includes(searchItemTerm.toLowerCase()))
                  .map((item) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedItemIds(selectedItemIds.filter(id => id !== item.id));
                          } else {
                            setSelectedItemIds([...selectedItemIds, item.id]);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-amber-500 text-slate-950 font-bold' 
                            : darkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        <span>{item.name}</span>
                        <span className="text-[10px] opacity-75">{item.category} &bull; {item.stockQuantity} {item.unit}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Auditor & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Auditor / Staff In Charge *</label>
              <input
                type="text"
                required
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                placeholder="Auditor Name"
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Location / Store Room</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Main Bar Counter, Cold Room"
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                }`}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Audit Notes / Directives</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Mandatory physical count after night shift close..."
              className={`w-full px-3 py-2 rounded-xl border outline-none text-xs ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
              }`}
            />
          </div>

          {/* Live Snapshot Summary Preview */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-amber-50/50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Items in Snapshot: <strong>{previewItems.length} inventory line(s)</strong></span>
            </div>
            <span className="text-[11px] text-slate-400">Values will be frozen upon creation</span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={previewItems.length === 0}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Initialize & Start Audit ({previewItems.length})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
