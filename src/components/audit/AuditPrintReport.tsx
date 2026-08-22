import React from 'react';
import { StockAudit, Business } from '../../types';
import { formatCurrency } from '../../lib/currency';
import { Printer, X, ShieldCheck, Building } from 'lucide-react';
import { calculateDepartmentSummaries } from '../../lib/auditEngine';

interface AuditPrintReportProps {
  audit: StockAudit;
  business?: Business | null;
  onClose: () => void;
  darkMode: boolean;
}

export const AuditPrintReport: React.FC<AuditPrintReportProps> = ({
  audit,
  business,
  onClose,
  darkMode
}) => {
  const departmentSummaries = calculateDepartmentSummaries(audit);
  const nowStr = new Date().toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md p-4 sm:p-8 flex justify-center">
      {/* Container */}
      <div className="relative w-full max-w-4xl bg-white text-slate-900 shadow-2xl rounded-2xl p-6 sm:p-10 my-auto print:m-0 print:p-6 print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Floating Action Controls (Hidden in Print) */}
        <div className="print:hidden flex items-center justify-between pb-6 mb-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600">Print Preview (A4 Formal Report)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer text-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 uppercase">
                {business?.name || 'HOTEL & RESORT MANAGEMENT'}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                {business?.address || 'Kigali, Rwanda'} &bull; Tel: {business?.phone || '+250 788 000 000'} &bull; TIN: {business?.tin || '102938475'}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 text-xs font-extrabold uppercase rounded bg-slate-900 text-white tracking-widest">
                OFFICIAL AUDIT REPORT
              </span>
              <div className="text-xs font-mono font-bold text-amber-600 mt-1.5">{audit.auditNumber}</div>
            </div>
          </div>
        </div>

        {/* Audit Metadata Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-xs mb-6">
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Audit Title</span>
            <strong className="text-slate-900 text-sm">{audit.name}</strong>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Scope / Department</span>
            <strong className="text-slate-900">{audit.department}</strong> ({audit.scopeType})
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Auditor In Charge</span>
            <strong className="text-slate-900">{audit.auditorName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Audit Date & Status</span>
            <strong className="text-slate-900">{audit.auditDate}</strong> &bull; <span className="font-bold text-amber-700">{audit.status}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Reconciliation Window</span>
            <span>{new Date(audit.startDate).toLocaleString()} to {new Date(audit.endDate).toLocaleString()}</span>
          </div>
          <div className="col-span-2 text-right">
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Printed Timestamp</span>
            <span>{nowStr}</span>
          </div>
        </div>

        {/* Executive Summary Financial Metrics */}
        <div className="mb-6">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            1. Executive Reconciliation Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Expected Stock Value</span>
              <span className="text-base font-extrabold text-slate-900 font-mono">{formatCurrency(audit.totalExpectedValue || 0)}</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Physical Count Value</span>
              <span className="text-base font-extrabold text-blue-700 font-mono">{formatCurrency(audit.totalPhysicalValue || 0)}</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-rose-50/60">
              <span className="text-[10px] font-bold uppercase text-rose-600 block">Stock Shortage Value</span>
              <span className="text-base font-extrabold text-rose-700 font-mono">-{formatCurrency(audit.estimatedLossValue || 0)}</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-emerald-50/60">
              <span className="text-[10px] font-bold uppercase text-emerald-600 block">Net Audit Variance</span>
              <span className={`text-base font-extrabold font-mono ${(audit.netVarianceValue || 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {(audit.netVarianceValue || 0) > 0 ? '+' : ''}{formatCurrency(audit.netVarianceValue || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Item Reconciliation Table */}
        <div className="mb-6">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            2. Detailed Item Reconciliation Schedule ({audit.items.length} Items)
          </h2>
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-200 text-slate-800 font-bold uppercase text-[10px]">
                <tr className="border-b border-slate-300">
                  <th className="py-2 px-2.5">Item Description</th>
                  <th className="py-2 px-2 text-right">Cost</th>
                  <th className="py-2 px-2 text-center">Opening</th>
                  <th className="py-2 px-2 text-center">+ In</th>
                  <th className="py-2 px-2 text-center">- Out</th>
                  <th className="py-2 px-2 text-center font-bold">Expected</th>
                  <th className="py-2 px-2 text-center font-bold bg-slate-300/60">Physical</th>
                  <th className="py-2 px-2 text-center font-bold">Diff</th>
                  <th className="py-2 px-2 text-right font-bold">Variance (RWF)</th>
                  <th className="py-2 px-2">Reason / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {audit.items.map((item, idx) => {
                  const totalIn = item.stockReceived + item.transfersIn + item.adjustmentsIn;
                  const totalOut = item.stockSoldOrUsed + item.transfersOut + item.wasteQuantity + item.damagedQuantity + item.adjustmentsOut;
                  const isShortage = item.difference < -0.001;
                  const isSurplus = item.difference > 0.001;

                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-1.5 px-2.5">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[9px] text-slate-500 font-mono">{item.itemCode || ''} &bull; {item.unit}</div>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{item.unitCost.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-center">{item.openingStock}</td>
                      <td className="py-1.5 px-2 text-center text-emerald-700">+{totalIn}</td>
                      <td className="py-1.5 px-2 text-center text-rose-700">-{totalOut}</td>
                      <td className="py-1.5 px-2 text-center font-bold">{item.theoreticalClosingStock}</td>
                      <td className="py-1.5 px-2 text-center font-bold bg-slate-100">
                        {item.physicalCount !== null ? item.physicalCount : '-'}
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold">
                        <span className={isShortage ? 'text-rose-700 font-bold' : isSurplus ? 'text-emerald-700 font-bold' : 'text-slate-700'}>
                          {item.difference > 0 ? `+${item.difference}` : item.difference}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold">
                        <span className={isShortage ? 'text-rose-700' : isSurplus ? 'text-emerald-700' : 'text-slate-600'}>
                          {item.varianceValue > 0 ? `+${item.varianceValue.toLocaleString()}` : item.varianceValue.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-[10px] text-slate-600">
                        {item.reason || item.investigationNotes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Summaries Table */}
        <div className="mb-6">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            3. Departmental Reconciliation Summary
          </h2>
          <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden border-collapse">
            <thead className="bg-slate-200 text-slate-800 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-1.5 px-3">Department</th>
                <th className="py-1.5 px-3 text-center">Items</th>
                <th className="py-1.5 px-3 text-right">Expected Stock</th>
                <th className="py-1.5 px-3 text-right">Physical Stock</th>
                <th className="py-1.5 px-3 text-right">Shortage Value</th>
                <th className="py-1.5 px-3 text-right">Surplus Value</th>
                <th className="py-1.5 px-3 text-right">Net Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {departmentSummaries.map((dept, idx) => (
                <tr key={idx}>
                  <td className="py-1.5 px-3 font-bold">{dept.department}</td>
                  <td className="py-1.5 px-3 text-center">{dept.itemsCount}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(dept.expectedStockValue)}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">{formatCurrency(dept.physicalStockValue)}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-rose-700">-{formatCurrency(dept.shortageValue)}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-emerald-700">+{formatCurrency(dept.surplusValue)}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">
                    {dept.netVariance > 0 ? '+' : ''}{formatCurrency(dept.netVariance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* General Audit Notes & Findings */}
        {audit.generalNotes && (
          <div className="mb-6 p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
            <span className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Auditor Findings & Observations:</span>
            <p className="text-slate-800">{audit.generalNotes}</p>
          </div>
        )}

        {/* Signatures & Approvals Grid */}
        <div className="pt-6 border-t-2 border-slate-900 mt-8">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-4 text-center">
            4. Official Verification & Authorizations
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-xs">
            <div>
              <div className="h-14 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                <span className="text-[10px] text-slate-400 italic">Signature</span>
              </div>
              <span className="block font-bold text-slate-900 mt-1">{audit.auditorName}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Stock Auditor</span>
            </div>

            <div>
              <div className="h-14 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                <span className="text-[10px] text-slate-400 italic">Signature</span>
              </div>
              <span className="block font-bold text-slate-900 mt-1">Storekeeper / Bar Head</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Custodian</span>
            </div>

            <div>
              <div className="h-14 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                <span className="text-[10px] text-slate-400 italic">Signature</span>
              </div>
              <span className="block font-bold text-slate-900 mt-1">{audit.reviewerName || 'Internal Auditor'}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Financial Reviewer</span>
            </div>

            <div>
              <div className="h-14 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                <span className="text-[10px] text-slate-400 italic">Signature</span>
              </div>
              <span className="block font-bold text-slate-900 mt-1">{audit.approverName || 'General Manager'}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">General Manager / Owner</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
