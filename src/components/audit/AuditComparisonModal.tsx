import React, { useState } from 'react';
import { StockAudit } from '../../types';
import { compareAudits } from '../../lib/auditEngine';
import { formatCurrency } from '../../lib/currency';
import { GitCompare, X, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface AuditComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  audits: StockAudit[];
  darkMode: boolean;
}

export const AuditComparisonModal: React.FC<AuditComparisonModalProps> = ({
  isOpen,
  onClose,
  audits,
  darkMode
}) => {
  if (!isOpen || audits.length < 2) return null;

  const [auditAId, setAuditAId] = useState<string>(audits[audits.length - 1]?.id || audits[1]?.id || '');
  const [auditBId, setAuditBId] = useState<string>(audits[0]?.id || '');

  const auditA = audits.find(a => a.id === auditAId) || audits[1] || audits[0];
  const auditB = audits.find(a => a.id === auditBId) || audits[0];

  const comparison = compareAudits(auditA, auditB);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className={`relative w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden my-8 ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg">Audit Discrepancy Trend Comparison</h2>
              <p className="text-xs text-slate-400">Compare variance trends and repeat shortages between two audit periods</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Selectors */}
        <div className={`p-4 border-b grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs ${
          darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div>
            <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Baseline Audit (A)</label>
            <select
              value={auditAId}
              onChange={(e) => setAuditAId(e.target.value)}
              className={`w-full p-2 rounded-xl border outline-none font-semibold ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
              }`}
            >
              {audits.map(a => (
                <option key={a.id} value={a.id}>
                  {a.auditNumber} - {a.name} ({a.auditDate})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Subsequent Audit (B)</label>
            <select
              value={auditBId}
              onChange={(e) => setAuditBId(e.target.value)}
              className={`w-full p-2 rounded-xl border outline-none font-semibold ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
              }`}
            >
              {audits.map(a => (
                <option key={a.id} value={a.id}>
                  {a.auditNumber} - {a.name} ({a.auditDate})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className={`p-3.5 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-slate-400 block font-semibold text-[10px]">Shortage Loss in Audit A</span>
              <strong className="text-base font-extrabold text-rose-400">-{formatCurrency(comparison.totalLossA)}</strong>
            </div>

            <div className={`p-3.5 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-slate-400 block font-semibold text-[10px]">Shortage Loss in Audit B</span>
              <strong className="text-base font-extrabold text-rose-400">-{formatCurrency(comparison.totalLossB)}</strong>
            </div>

            <div className={`p-3.5 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-slate-400 block font-semibold text-[10px]">Variance Change</span>
              <strong className={`text-base font-extrabold ${comparison.lossDifference > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {comparison.lossDifference > 0 ? `+${formatCurrency(comparison.lossDifference)} (Higher Loss)` : `${formatCurrency(comparison.lossDifference)} (Improved)`}
              </strong>
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            comparison.lossDifference > 0 
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' 
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
          }`}>
            {comparison.lossDifference > 0 ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{comparison.trendSummary}</span>
          </div>

          {/* Item comparisons table */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">Item Variance Trend Schedule</h3>
            <div className={`border rounded-xl overflow-hidden ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <table className="w-full text-left text-xs">
                <thead className={`text-[10px] uppercase font-bold ${darkMode ? 'bg-slate-950 text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-2 text-center">{auditA.auditNumber} Diff</th>
                    <th className="py-2.5 px-2 text-center">{auditB.auditNumber} Diff</th>
                    <th className="py-2.5 px-3 text-center">Trend</th>
                    <th className="py-2.5 px-3 text-right">Variance Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {comparison.itemComparisons.map((item, idx) => (
                    <tr key={idx} className="hover:bg-amber-500/5">
                      <td className="py-2.5 px-3 font-semibold">{item.name}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={item.auditADifference < 0 ? 'text-rose-400 font-bold' : item.auditADifference > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                          {item.auditADifference} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={item.auditBDifference < 0 ? 'text-rose-400 font-bold' : item.auditBDifference > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                          {item.auditBDifference} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.trend === 'INCREASING_SHORTAGE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Worsening Shortage
                          </span>
                        )}
                        {item.trend === 'DECREASING_SHORTAGE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Improving
                          </span>
                        )}
                        {item.trend === 'NEW_DISCREPANCY' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            New Discrepancy
                          </span>
                        )}
                        {item.trend === 'RESOLVED' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Resolved (0 Diff)
                          </span>
                        )}
                        {item.trend === 'STABLE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">
                            Stable
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={item.varianceChangeValue < 0 ? 'text-rose-400' : item.varianceChangeValue > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                          {item.varianceChangeValue > 0 ? `+${formatCurrency(item.varianceChangeValue)}` : formatCurrency(item.varianceChangeValue)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-end ${darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
