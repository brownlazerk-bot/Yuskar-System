import React, { useState } from 'react';
import { 
  ClipboardCheck, AlertTriangle, TrendingDown, TrendingUp, 
  CheckCircle2, Clock, ShieldAlert, Plus, Search, Filter,
  ArrowRight, FileText, BarChart3, GitCompare, RefreshCw, Printer,
  Building, Calendar, UserCheck
} from 'lucide-react';
import { StockAudit, UserRole } from '../../types';
import { formatCurrency } from '../../lib/currency';

interface AuditDashboardProps {
  audits: StockAudit[];
  onCreateNew: () => void;
  onOpenAudit: (audit: StockAudit) => void;
  onCompareAudits: () => void;
  onPrintAudit: (audit: StockAudit) => void;
  userRole: UserRole;
  darkMode: boolean;
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({
  audits,
  onCreateNew,
  onOpenAudit,
  onCompareAudits,
  onPrintAudit,
  userRole,
  darkMode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  const isSuperAdminOrManager = ['Super Admin', 'Admin', 'Manager', 'Accountant'].includes(userRole);

  // High-level statistics
  const totalAudits = audits.length;
  const openAudits = audits.filter(a => ['DRAFT', 'IN_PROGRESS', 'COUNT_COMPLETED', 'UNDER_REVIEW', 'INVESTIGATION'].includes(a.status)).length;
  const completedAudits = audits.filter(a => ['APPROVED', 'CLOSED'].includes(a.status)).length;
  const pendingReview = audits.filter(a => ['COUNT_COMPLETED', 'UNDER_REVIEW', 'INVESTIGATION'].includes(a.status)).length;

  const totalDiscrepancies = audits.reduce((acc, a) => acc + (a.totalDiscrepanciesCount || 0), 0);
  const totalShortages = audits.reduce((acc, a) => acc + (a.totalShortageCount || 0), 0);
  const totalSurpluses = audits.reduce((acc, a) => acc + (a.totalSurplusCount || 0), 0);

  const totalLossValue = audits.reduce((acc, a) => acc + (a.estimatedLossValue || 0), 0);
  const totalSurplusValue = audits.reduce((acc, a) => acc + (a.estimatedSurplusValue || 0), 0);
  const netVariance = totalSurplusValue - totalLossValue;

  // High Risk items identification
  const itemDiscrepancyFrequency: Record<string, { name: string; dept: string; count: number; totalLoss: number }> = {};
  audits.forEach(a => {
    a.items?.forEach(item => {
      if (item.difference < 0) {
        if (!itemDiscrepancyFrequency[item.itemId]) {
          itemDiscrepancyFrequency[item.itemId] = {
            name: item.name,
            dept: item.department,
            count: 0,
            totalLoss: 0
          };
        }
        itemDiscrepancyFrequency[item.itemId].count++;
        itemDiscrepancyFrequency[item.itemId].totalLoss += Math.abs(item.varianceValue || 0);
      }
    });
  });

  const highRiskItems = Object.values(itemDiscrepancyFrequency)
    .sort((a, b) => b.totalLoss - a.totalLoss)
    .slice(0, 5);

  // Departments with repeated discrepancies
  const deptDiscrepancies: Record<string, { count: number; loss: number }> = {};
  audits.forEach(a => {
    a.items?.forEach(item => {
      if (Math.abs(item.difference) > 0.001) {
        const dept = item.department || a.department || 'General';
        if (!deptDiscrepancies[dept]) {
          deptDiscrepancies[dept] = { count: 0, loss: 0 };
        }
        deptDiscrepancies[dept].count++;
        if (item.difference < 0) {
          deptDiscrepancies[dept].loss += Math.abs(item.varianceValue || 0);
        }
      }
    });
  });

  // Filtered audits
  const filteredAudits = audits.filter(a => {
    const matchesSearch = 
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.auditNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.auditorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesDept = deptFilter === 'ALL' || a.department.toLowerCase().includes(deptFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesDept;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20">Draft</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1"><Clock className="w-3 h-3 animate-spin" /> In Progress</span>;
      case 'COUNT_COMPLETED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">Count Completed</span>;
      case 'UNDER_REVIEW':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">Under Review</span>;
      case 'INVESTIGATION':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Discrepancy Investigation</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-600/20 text-slate-300 border border-slate-600/30 flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-emerald-400" /> Closed (Immutable)</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-500/10 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Stock Audit & Reconciliation</h1>
                <p className="text-sm text-slate-400">
                  Comprehensive theoretical vs. physical inventory reconciliation and loss control
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {audits.length >= 2 && (
              <button
                onClick={onCompareAudits}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border flex items-center gap-2 transition-all cursor-pointer ${
                  darkMode 
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
                    : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <GitCompare className="w-4 h-4 text-amber-400" />
                <span>Compare Audits</span>
              </button>
            )}

            {isSuperAdminOrManager && (
              <button
                onClick={onCreateNew}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create New Audit</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Total Audits</div>
          <div className="text-2xl font-extrabold">{totalAudits}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-blue-400 font-bold">{openAudits} active</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Pending Review</div>
          <div className="text-2xl font-extrabold text-amber-400">{pendingReview}</div>
          <div className="text-[11px] text-slate-500 mt-1">Requires manager review</div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Stock Shortages</div>
          <div className="text-2xl font-extrabold text-rose-400">{totalShortages}</div>
          <div className="text-[11px] text-slate-500 mt-1">Physical &lt; Theoretical</div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Stock Surpluses</div>
          <div className="text-2xl font-extrabold text-emerald-400">{totalSurpluses}</div>
          <div className="text-[11px] text-slate-500 mt-1">Physical &gt; Theoretical</div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Est. Shortage Value</div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-400">{formatCurrency(totalLossValue)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Potential stock loss</div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Net Variance</div>
          <div className={`text-xl sm:text-2xl font-extrabold ${netVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netVariance >= 0 ? '+' : ''}{formatCurrency(netVariance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Surplus minus shortage</div>
        </div>
      </div>

      {/* High-Risk Items & Department Overview Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* High Risk Items List */}
        <div className={`p-5 rounded-2xl border lg:col-span-2 ${darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <h3 className="font-bold text-sm sm:text-base">Frequent Discrepancy Items</h3>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Requires Management Review
            </span>
          </div>

          {highRiskItems.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/60" />
              No persistent stock shortages detected in recent audits.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {highRiskItems.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.dept} &bull; {item.count} shortage incident(s)</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-rose-400">-{formatCurrency(item.totalLoss)}</div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Estimated Loss</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Department Summary */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm sm:text-base">Department Summary</h3>
            </div>
          </div>

          <div className="space-y-3">
            {Object.keys(deptDiscrepancies).length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                No departmental variances recorded yet.
              </div>
            ) : (
              Object.entries(deptDiscrepancies).map(([dept, data], idx) => (
                <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  darkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <span className="font-bold">{dept}</span>
                    <div className="text-slate-400 mt-0.5">{data.count} variance line(s)</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-rose-400">-{formatCurrency(data.loss)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Audits List Section */}
      <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
        {/* Filters Header */}
        <div className={`p-4 border-b ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base">Audit History & Records</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">
              {filteredAudits.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search audits, staff, dept..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-9 pr-3 py-1.5 rounded-xl text-xs sm:text-sm border outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
                }`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm border outline-none ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
              }`}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COUNT_COMPLETED">Count Completed</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="INVESTIGATION">Investigation</option>
              <option value="APPROVED">Approved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm border outline-none ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
              }`}
            >
              <option value="ALL">All Departments</option>
              <option value="Bar">Bar / Beverage</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Pool">Pool</option>
              <option value="Sauna">Sauna</option>
              <option value="Main Store">Main Store</option>
            </select>
          </div>
        </div>

        {/* Audits Table */}
        {filteredAudits.length === 0 ? (
          <div className="text-center py-12 px-4">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <h3 className="text-base font-bold">No Audits Found</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
              No stock audits match your search criteria. Create a new audit to reconcile inventory and track discrepancies.
            </p>
            {isSuperAdminOrManager && (
              <button
                onClick={onCreateNew}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create First Audit
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={`text-xs uppercase font-semibold ${darkMode ? 'bg-slate-950/60 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                <tr>
                  <th className="py-3.5 px-4">Audit Ref & Name</th>
                  <th className="py-3.5 px-4">Department / Scope</th>
                  <th className="py-3.5 px-4">Auditor & Date</th>
                  <th className="py-3.5 px-4 text-center">Items Audited</th>
                  <th className="py-3.5 px-4 text-right">Shortage / Surplus</th>
                  <th className="py-3.5 px-4 text-right">Net Variance</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAudits.map((audit) => {
                  const itemsCount = audit.items?.length || 0;
                  const counted = audit.itemsCounted || 0;
                  const shortageVal = audit.estimatedLossValue || 0;
                  const surplusVal = audit.estimatedSurplusValue || 0;
                  const netVal = surplusVal - shortageVal;

                  return (
                    <tr 
                      key={audit.id}
                      className={`transition-colors hover:bg-amber-500/5 cursor-pointer`}
                      onClick={() => onOpenAudit(audit)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-amber-400 flex items-center gap-1.5">
                          <span>{audit.auditNumber}</span>
                          {audit.frequency && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {audit.frequency}
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-xs sm:text-sm mt-0.5 text-slate-200">{audit.name}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-xs sm:text-sm">{audit.department}</div>
                        <div className="text-[11px] text-slate-400 capitalize">{audit.scopeType.toLowerCase().replace('_', ' ')}</div>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-semibold text-slate-200 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          {audit.auditorName}
                        </div>
                        <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {audit.auditDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="font-bold text-xs">
                          {counted} / {itemsCount}
                        </div>
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                          <div 
                            className="bg-amber-500 h-full rounded-full" 
                            style={{ width: `${itemsCount > 0 ? (counted / itemsCount) * 100 : 0}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right text-xs">
                        {shortageVal > 0 && (
                          <div className="font-semibold text-rose-400">-{formatCurrency(shortageVal)}</div>
                        )}
                        {surplusVal > 0 && (
                          <div className="font-semibold text-emerald-400">+{formatCurrency(surplusVal)}</div>
                        )}
                        {shortageVal === 0 && surplusVal === 0 && (
                          <span className="text-slate-500">No variance</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-bold text-xs sm:text-sm ${
                          netVal < 0 ? 'text-rose-400' : netVal > 0 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {netVal > 0 ? '+' : ''}{formatCurrency(netVal)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(audit.status)}
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onPrintAudit(audit)}
                            title="Print A4 Audit Report"
                            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                              darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenAudit(audit)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
