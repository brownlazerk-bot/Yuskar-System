import React, { useState } from 'react';
import { AuditItemRecord, DiscrepancyReason } from '../../types';
import { formatCurrency } from '../../lib/currency';
import { 
  X, Save, ArrowDownLeft, ArrowUpRight, Calculator, 
  HelpCircle, AlertTriangle, CheckCircle2, RotateCcw,
  Sparkles, Layers, Package
} from 'lucide-react';
import { recalculateAuditItem } from '../../lib/auditEngine';

interface AuditItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: AuditItemRecord | null;
  onSave: (updatedItem: AuditItemRecord) => void;
  darkMode: boolean;
}

export const AuditItemEditModal: React.FC<AuditItemEditModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  darkMode
}) => {
  if (!isOpen || !item) return null;

  // Local editable state
  const [openingStock, setOpeningStock] = useState<number>(item.openingStock || 0);
  const [unitCost, setUnitCost] = useState<number>(item.unitCost || 0);

  // In movements
  const [stockReceived, setStockReceived] = useState<number>(item.stockReceived || 0);
  const [transfersIn, setTransfersIn] = useState<number>(item.transfersIn || 0);
  const [adjustmentsIn, setAdjustmentsIn] = useState<number>(item.adjustmentsIn || 0);

  // Out movements
  const [stockSoldOrUsed, setStockSoldOrUsed] = useState<number>(item.stockSoldOrUsed || 0);
  const [transfersOut, setTransfersOut] = useState<number>(item.transfersOut || 0);
  const [wasteQuantity, setWasteQuantity] = useState<number>(item.wasteQuantity || 0);
  const [damagedQuantity, setDamagedQuantity] = useState<number>(item.damagedQuantity || 0);
  const [adjustmentsOut, setAdjustmentsOut] = useState<number>(item.adjustmentsOut || 0);

  // Count & Notes
  const [physicalCount, setPhysicalCount] = useState<string>(
    item.physicalCount !== null && item.physicalCount !== undefined ? String(item.physicalCount) : ''
  );
  const [reason, setReason] = useState<DiscrepancyReason | ''>(item.reason || '');
  const [investigationNotes, setInvestigationNotes] = useState<string>(item.investigationNotes || '');

  // Calculate live preview
  const countNum = physicalCount === '' ? null : Math.max(0, parseFloat(physicalCount) || 0);
  
  const previewItem = recalculateAuditItem({
    ...item,
    openingStock,
    unitCost,
    stockReceived,
    transfersIn,
    adjustmentsIn,
    stockSoldOrUsed,
    transfersOut,
    wasteQuantity,
    damagedQuantity,
    adjustmentsOut,
    physicalCount: countNum,
    reason: reason ? (reason as DiscrepancyReason) : undefined,
    investigationNotes
  });

  const totalIn = stockReceived + transfersIn + adjustmentsIn;
  const totalOut = stockSoldOrUsed + transfersOut + wasteQuantity + damagedQuantity + adjustmentsOut;

  const handleSave = () => {
    onSave(previewItem);
    onClose();
  };

  const isShortage = previewItem.difference < -0.001;
  const isSurplus = previewItem.difference > 0.001;
  const isMatched = previewItem.physicalCount !== null && Math.abs(previewItem.difference) < 0.001;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-6 ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Modal Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          darkMode ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg">{item.name}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {item.itemCode || 'SKU'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {item.department} &bull; {item.category} &bull; Unit: <span className="font-bold text-slate-200">{item.unit}</span>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* SECTION 1: Baseline Opening Stock & Unit Cost */}
          <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  1. Opening Stock Baseline & Unit Cost
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Audit Start Baseline</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  Opening Stock ({item.unit}) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold text-sm ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500' : 'bg-white border-slate-300 text-blue-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-1">Starting balance at the beginning of audit</span>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  Unit Cost (RWF) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-mono font-bold text-sm ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-amber-500' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-1">Used to calculate total financial variance</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Inbound Movements (+ IN) */}
          <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  2. Inbound Product Stock Movements (+ IN)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Total In: +{totalIn} {item.unit}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Stock Received / Purchases</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={stockReceived}
                  onChange={(e) => setStockReceived(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-emerald-400 focus:border-emerald-500' : 'bg-white border-emerald-300 text-emerald-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Purchases & deliveries</span>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Transfers In</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={transfersIn}
                  onChange={(e) => setTransfersIn(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-emerald-400 focus:border-emerald-500' : 'bg-white border-emerald-300 text-emerald-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">From other store / location</span>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Adjustments In (+)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={adjustmentsIn}
                  onChange={(e) => setAdjustmentsIn(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-emerald-400 focus:border-emerald-500' : 'bg-white border-emerald-300 text-emerald-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Found stock / manual plus</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: Outbound Movements (- OUT) */}
          <div className={`p-4 rounded-xl border ${darkMode ? 'bg-rose-950/20 border-rose-500/20' : 'bg-rose-50/50 border-rose-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-rose-500/20 text-rose-400">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-400">
                  3. Outbound Product Stock Movements (- OUT)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Total Out: -{totalOut} {item.unit}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Stock Sold / POS Usage</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={stockSoldOrUsed}
                  onChange={(e) => setStockSoldOrUsed(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-rose-400 focus:border-rose-500' : 'bg-white border-rose-300 text-rose-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Sales & recipes</span>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Transfers Out</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={transfersOut}
                  onChange={(e) => setTransfersOut(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-rose-400 focus:border-rose-500' : 'bg-white border-rose-300 text-rose-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">To other bar/department</span>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Waste Quantity</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={wasteQuantity}
                  onChange={(e) => setWasteQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-rose-400 focus:border-rose-500' : 'bg-white border-rose-300 text-rose-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Kitchen/bar waste</span>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Damaged / Broken</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={damagedQuantity}
                  onChange={(e) => setDamagedQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-rose-400 focus:border-rose-500' : 'bg-white border-rose-300 text-rose-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Broken bottles/goods</span>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Adjustments Out (-)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={adjustmentsOut}
                  onChange={(e) => setAdjustmentsOut(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-bold ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-rose-400 focus:border-rose-500' : 'bg-white border-rose-300 text-rose-700'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Manual negative adj.</span>
              </div>
            </div>
          </div>

          {/* SECTION 4: Live Formula & Count Result */}
          <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  4. Live Inventory Reconciliation Formula & Physical Count
                </h3>
              </div>
            </div>

            {/* Formula visual calculation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs mb-4">
              <div className={`p-2.5 rounded-lg border ${darkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200'}`}>
                <span className="text-[10px] text-slate-500 block">Opening Stock</span>
                <strong className="text-base font-extrabold text-blue-400">{openingStock}</strong>
              </div>

              <div className={`p-2.5 rounded-lg border ${darkMode ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
                <span className="text-[10px] text-emerald-500 block">+ Total In</span>
                <strong className="text-base font-extrabold text-emerald-400">+{totalIn}</strong>
              </div>

              <div className={`p-2.5 rounded-lg border ${darkMode ? 'bg-rose-950/40 border-rose-500/30' : 'bg-rose-50 border-rose-200'}`}>
                <span className="text-[10px] text-rose-500 block">- Total Out</span>
                <strong className="text-base font-extrabold text-rose-400">-{totalOut}</strong>
              </div>

              <div className={`p-2.5 rounded-lg border bg-blue-500/10 border-blue-500/30`}>
                <span className="text-[10px] text-blue-400 block font-bold">Theoretical Closing</span>
                <strong className="text-base font-extrabold text-blue-300">{previewItem.theoreticalClosingStock}</strong>
              </div>
            </div>

            {/* Physical Count Input and Difference Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-amber-400 font-bold mb-1">
                  Physical Count ({item.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Enter physical count"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-extrabold text-sm ${
                    darkMode ? 'bg-slate-900 border-amber-500/60 text-amber-300 focus:border-amber-400' : 'bg-white border-amber-500 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <span className="block text-slate-400 font-bold mb-1">Difference (Count - Theoretical)</span>
                <div className={`px-3 py-2 rounded-xl font-extrabold text-sm border flex items-center justify-between ${
                  isShortage 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                    : isSurplus 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                      : isMatched 
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' 
                        : darkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                }`}>
                  <span>{previewItem.difference > 0 ? `+${previewItem.difference}` : previewItem.difference} {item.unit}</span>
                  <span className="text-[10px] font-bold uppercase">{previewItem.discrepancyStatus}</span>
                </div>
              </div>

              <div>
                <span className="block text-slate-400 font-bold mb-1">Variance Financial Impact</span>
                <div className={`px-3 py-2 rounded-xl font-mono font-extrabold text-sm border ${
                  isShortage 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                    : isSurplus 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                      : darkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  {previewItem.varianceValue > 0 ? `+${formatCurrency(previewItem.varianceValue)}` : formatCurrency(previewItem.varianceValue)}
                </div>
              </div>
            </div>

            {/* Discrepancy Reason & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-3 pt-3 border-t border-slate-700/60">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Discrepancy Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as DiscrepancyReason)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
                  }`}
                >
                  <option value="">-- Select Reason --</option>
                  <option value="COUNTING_ERROR">Counting Error</option>
                  <option value="UNRECORDED_SALE">Unrecorded Sale</option>
                  <option value="WASTE">Kitchen / Bar Waste</option>
                  <option value="DAMAGED">Damaged / Broken Bottle</option>
                  <option value="SPOILAGE">Spoilage / Expired</option>
                  <option value="TRANSFER_ERROR">Inter-department Transfer</option>
                  <option value="SYSTEM_ERROR">System / POS Error</option>
                  <option value="THEFT_SUSPECTED">Theft Suspected (Under Investigation)</option>
                  <option value="OTHER">Other Discrepancy</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Investigation / Reconciliation Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Adjusted opening based on verified handover sheet"
                  value={investigationNotes}
                  onChange={(e) => setInvestigationNotes(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          darkMode ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            onClick={() => {
              setOpeningStock(item.openingStock);
              setUnitCost(item.unitCost);
              setStockReceived(item.stockReceived);
              setTransfersIn(item.transfersIn);
              setAdjustmentsIn(item.adjustmentsIn);
              setStockSoldOrUsed(item.stockSoldOrUsed);
              setTransfersOut(item.transfersOut);
              setWasteQuantity(item.wasteQuantity);
              setDamagedQuantity(item.damagedQuantity);
              setAdjustmentsOut(item.adjustmentsOut);
              setPhysicalCount(item.physicalCount !== null && item.physicalCount !== undefined ? String(item.physicalCount) : '');
              setReason(item.reason || '');
              setInvestigationNotes(item.investigationNotes || '');
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Inputs</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Update Audit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
