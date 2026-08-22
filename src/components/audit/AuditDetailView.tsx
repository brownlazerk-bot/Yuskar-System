import React, { useState } from 'react';
import { 
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, 
  ShieldAlert, Printer, Check, RefreshCw, Save,
  Search, Filter, Plus, Edit3, MessageSquare, AlertCircle,
  FileCheck, Shield, ChevronRight, BarChart2, Layers,
  SlidersHorizontal, ArrowDownLeft, ArrowUpRight, Zap
} from 'lucide-react';
import { 
  StockAudit, AuditItemRecord, UserRole, 
  AppUser, DiscrepancyReason, DiscrepancyStatus,
  AuditAdjustmentRecord
} from '../../types';
import { formatCurrency } from '../../lib/currency';
import { 
  recalculateAuditSummary, recalculateAuditItem, calculateDepartmentSummaries,
  applyApprovedAuditStockAdjustment 
} from '../../lib/auditEngine';
import { addAuditLog } from '../../lib/storage';
import { AuditItemEditModal } from './AuditItemEditModal';

interface AuditDetailViewProps {
  audit: StockAudit;
  onUpdateAudit: (audit: StockAudit) => void;
  onBack: () => void;
  onPrint: (audit: StockAudit) => void;
  onPrintThermal?: (audit: StockAudit) => void;
  currentUser: AppUser | null;
  userRole: UserRole;
  darkMode: boolean;
}

export const AuditDetailView: React.FC<AuditDetailViewProps> = ({
  audit,
  onUpdateAudit,
  onBack,
  onPrint,
  onPrintThermal,
  currentUser,
  userRole,
  darkMode
}) => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'DEPARTMENTS' | 'ADJUSTMENTS' | 'INVESTIGATION'>('ITEMS');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiscrepancy, setFilterDiscrepancy] = useState<string>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Full movements edit modal state
  const [editingItem, setEditingItem] = useState<AuditItemRecord | null>(null);
  const [isBulkEditMode, setIsBulkEditMode] = useState<boolean>(false);

  // Correction Modal State (for correcting closed audits)
  const [correctionItem, setCorrectionItem] = useState<AuditItemRecord | null>(null);
  const [correctedCountInput, setCorrectedCountInput] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // Stock adjustment confirmation modal
  const [showApplyAdjustmentModal, setShowApplyAdjustmentModal] = useState(false);
  const [adjustmentFeedback, setAdjustmentFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const isSuperAdminOrManager = ['Super Admin', 'Admin', 'Manager', 'Accountant'].includes(userRole);
  const isGeneralManagerOrOwner = ['Super Admin', 'Admin', 'Manager'].includes(userRole);
  const isClosed = audit.status === 'CLOSED';
  const canEditCounts = !isClosed && (audit.status === 'IN_PROGRESS' || audit.status === 'DRAFT' || isSuperAdminOrManager);

  // Handle live count change on an item
  const handleCountChange = (itemId: string, val: string) => {
    if (!canEditCounts) return;

    const countNum = val === '' ? null : Math.max(0, parseFloat(val) || 0);

    const updatedItems = audit.items.map(item => {
      if (item.id === itemId) {
        return recalculateAuditItem({
          ...item,
          physicalCount: countNum,
          countedAt: new Date().toISOString(),
          countedBy: currentUser?.fullName || 'Auditor'
        });
      }
      return item;
    });

    const updatedAudit = recalculateAuditSummary({
      ...audit,
      items: updatedItems
    });

    onUpdateAudit(updatedAudit);
  };

  // Handle Opening Stock Inline Change
  const handleOpeningStockChange = (itemId: string, val: string) => {
    if (!canEditCounts) return;
    const num = Math.max(0, parseFloat(val) || 0);
    const updatedItems = audit.items.map(item => {
      if (item.id === itemId) {
        return recalculateAuditItem({
          ...item,
          openingStock: num
        });
      }
      return item;
    });

    const updatedAudit = recalculateAuditSummary({
      ...audit,
      items: updatedItems
    });
    onUpdateAudit(updatedAudit);
  };

  // Handle Total In Direct Change
  const handleTotalInChange = (itemId: string, val: string) => {
    if (!canEditCounts) return;
    const num = Math.max(0, parseFloat(val) || 0);
    const updatedItems = audit.items.map(item => {
      if (item.id === itemId) {
        return recalculateAuditItem({
          ...item,
          stockReceived: num,
          transfersIn: 0,
          adjustmentsIn: 0
        });
      }
      return item;
    });

    const updatedAudit = recalculateAuditSummary({
      ...audit,
      items: updatedItems
    });
    onUpdateAudit(updatedAudit);
  };

  // Handle Total Out Direct Change
  const handleTotalOutChange = (itemId: string, val: string) => {
    if (!canEditCounts) return;
    const num = Math.max(0, parseFloat(val) || 0);
    const updatedItems = audit.items.map(item => {
      if (item.id === itemId) {
        return recalculateAuditItem({
          ...item,
          stockSoldOrUsed: num,
          transfersOut: 0,
          wasteQuantity: 0,
          damagedQuantity: 0,
          adjustmentsOut: 0
        });
      }
      return item;
    });

    const updatedAudit = recalculateAuditSummary({
      ...audit,
      items: updatedItems
    });
    onUpdateAudit(updatedAudit);
  };

  // Save Item from Full Breakdown Edit Modal
  const handleSaveEditedItem = (updatedItem: AuditItemRecord) => {
    const updatedItems = audit.items.map(item => item.id === updatedItem.id ? updatedItem : item);
    const updatedAudit = recalculateAuditSummary({
      ...audit,
      items: updatedItems
    });
    onUpdateAudit(updatedAudit);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        userEmail: currentUser.email,
        action: 'AUDIT_ITEM_UPDATED',
        category: 'Inventory',
        details: `Audit ${audit.auditNumber}: Updated stock movements and opening for ${updatedItem.name} (Opening: ${updatedItem.openingStock}, Theoretical: ${updatedItem.theoreticalClosingStock}, Count: ${updatedItem.physicalCount})`
      });
    }
  };

  // Handle Reason Change
  const handleReasonChange = (itemId: string, reason: DiscrepancyReason) => {
    const updatedItems = audit.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          reason,
          discrepancyStatus: item.discrepancyStatus === 'SHORTAGE' || item.discrepancyStatus === 'SURPLUS' ? 'EXPLAINED' : item.discrepancyStatus
        };
      }
      return item;
    });

    const updatedAudit = recalculateAuditSummary({
      ...audit,
      items: updatedItems
    });
    onUpdateAudit(updatedAudit);
  };

  // Handle Investigation Notes Change
  const handleNotesChange = (itemId: string, notes: string) => {
    const updatedItems = audit.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          investigationNotes: notes
        };
      }
      return item;
    });
    const updatedAudit = recalculateAuditSummary({
      ...audit,
      items: updatedItems
    });
    onUpdateAudit(updatedAudit);
  };

  // Workflow transitions
  const handleSubmitForReview = () => {
    const updated = recalculateAuditSummary({
      ...audit,
      status: 'UNDER_REVIEW',
      reviewerId: currentUser?.id,
      reviewerName: currentUser?.fullName
    });
    onUpdateAudit(updated);
    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        userEmail: currentUser.email,
        action: 'AUDIT_SUBMITTED',
        category: 'Inventory',
        details: `Audit ${audit.auditNumber} submitted for management review (${audit.itemsCounted}/${audit.totalItemsCount} items counted)`
      });
    }
  };

  const handleApproveAudit = () => {
    const updated = recalculateAuditSummary({
      ...audit,
      status: 'APPROVED',
      approverId: currentUser?.id,
      approverName: currentUser?.fullName,
      approvedAt: new Date().toISOString()
    });
    onUpdateAudit(updated);
    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        userEmail: currentUser.email,
        action: 'AUDIT_APPROVED',
        category: 'Inventory',
        details: `Audit ${audit.auditNumber} formally approved by ${currentUser.fullName}`
      });
    }
  };

  const handleCloseAudit = () => {
    const updated = recalculateAuditSummary({
      ...audit,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      closedBy: currentUser?.fullName || 'Manager'
    });
    onUpdateAudit(updated);
    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        userEmail: currentUser.email,
        action: 'AUDIT_CLOSED',
        category: 'Inventory',
        details: `Audit ${audit.auditNumber} closed and locked as immutable record`
      });
    }
  };

  // Apply approved inventory stock adjustment
  const handleExecuteStockAdjustment = () => {
    const result = applyApprovedAuditStockAdjustment(audit, currentUser?.fullName || 'Manager');
    setAdjustmentFeedback(result);
    if (result.success) {
      const updatedAudit: StockAudit = {
        ...audit,
        inventoryAdjusted: true,
        inventoryAdjustedAt: new Date().toISOString(),
        inventoryAdjustedBy: currentUser?.fullName || 'Manager'
      };
      onUpdateAudit(updatedAudit);
      if (currentUser) {
        addAuditLog({
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          userEmail: currentUser.email,
          action: 'AUDIT_ADJUSTMENT_CREATED',
          category: 'Inventory',
          details: `Applied formal inventory adjustment for audit ${audit.auditNumber} (${result.adjustedCount} items synchronized)`
        });
      }
    }
  };

  // Record an audit correction on an item
  const handleSaveCorrection = () => {
    if (!correctionItem || !correctedCountInput.trim()) return;
    const newCount = parseFloat(correctedCountInput) || 0;
    const oldDiff = correctionItem.difference;
    const newDiff = newCount - correctionItem.theoreticalClosingStock;

    const newAdjustmentRecord: AuditAdjustmentRecord = {
      id: `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      auditId: audit.id,
      auditItemId: correctionItem.id,
      itemName: correctionItem.name,
      originalPhysicalCount: correctionItem.physicalCount || 0,
      correctedPhysicalCount: newCount,
      originalDifference: oldDiff,
      correctedDifference: newDiff,
      reason: correctionReason.trim() || 'Auditor count correction',
      correctedBy: currentUser?.fullName || 'Manager',
      correctedByRole: currentUser?.role || 'Manager',
      correctedAt: new Date().toISOString()
    };

    const updatedAdjustments = [...(audit.adjustments || []), newAdjustmentRecord];
    const updatedItems = audit.items.map(it => {
      if (it.id === correctionItem.id) {
        return {
          ...it,
          physicalCount: newCount,
          difference: newDiff,
          varianceValue: newDiff * it.unitCost,
          discrepancyStatus: (Math.abs(newDiff) < 0.001 ? 'MATCHED' : newDiff < 0 ? 'SHORTAGE' : 'SURPLUS') as DiscrepancyStatus,
          investigationNotes: `${it.investigationNotes ? it.investigationNotes + ' | ' : ''}Correction: ${correctionReason}`
        };
      }
      return it;
    });

    const updated = recalculateAuditSummary({
      ...audit,
      items: updatedItems,
      adjustments: updatedAdjustments
    });

    onUpdateAudit(updated);
    setCorrectionItem(null);
    setCorrectedCountInput('');
    setCorrectionReason('');

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        userEmail: currentUser.email,
        action: 'AUDIT_CORRECTED',
        category: 'Inventory',
        details: `Corrected physical count for "${correctionItem.name}" from ${correctionItem.physicalCount} to ${newCount} in audit ${audit.auditNumber}`
      });
    }
  };

  // Filter items
  const filteredItems = audit.items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.itemCode && item.itemCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = selectedDeptFilter === 'ALL' || item.department.toLowerCase().includes(selectedDeptFilter.toLowerCase());

    let matchesDiscrepancy = true;
    if (filterDiscrepancy === 'SHORTAGE') matchesDiscrepancy = item.difference < -0.001;
    else if (filterDiscrepancy === 'SURPLUS') matchesDiscrepancy = item.difference > 0.001;
    else if (filterDiscrepancy === 'MATCHED') matchesDiscrepancy = item.physicalCount !== null && Math.abs(item.difference) < 0.001;
    else if (filterDiscrepancy === 'UNCOUNTED') matchesDiscrepancy = item.physicalCount === null;

    return matchesSearch && matchesDept && matchesDiscrepancy;
  });

  const departmentSummaries = calculateDepartmentSummaries(audit);

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onBack}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-extrabold text-amber-500 text-lg sm:text-xl">{audit.auditNumber}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300">
                  {audit.frequency}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {audit.department}
                </span>
                {audit.inventoryAdjusted && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Stock Adjusted
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{audit.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Auditor: <strong>{audit.auditorName}</strong> &bull; Date: {audit.auditDate} &bull; Window: {new Date(audit.startDate).toLocaleDateString()} to {new Date(audit.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Workflow Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onPrint(audit)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print A4 Report</span>
            </button>

            {audit.status === 'IN_PROGRESS' && (
              <button
                onClick={handleSubmitForReview}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Submit for Review</span>
              </button>
            )}

            {(audit.status === 'UNDER_REVIEW' || audit.status === 'INVESTIGATION' || audit.status === 'COUNT_COMPLETED') && isGeneralManagerOrOwner && (
              <button
                onClick={handleApproveAudit}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Approve Audit</span>
              </button>
            )}

            {audit.status === 'APPROVED' && isGeneralManagerOrOwner && (
              <button
                onClick={handleCloseAudit}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Close & Lock (Immutable)</span>
              </button>
            )}

            {(audit.status === 'APPROVED' || audit.status === 'CLOSED') && !audit.inventoryAdjusted && isGeneralManagerOrOwner && (
              <button
                onClick={() => setShowApplyAdjustmentModal(true)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                <span>Synchronize Inventory</span>
              </button>
            )}
          </div>
        </div>

        {/* Workflow Progress Steps */}
        <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between overflow-x-auto no-scrollbar text-xs">
          {[
            { id: 'IN_PROGRESS', label: '1. Stock Count' },
            { id: 'UNDER_REVIEW', label: '2. Discrepancy Review' },
            { id: 'APPROVED', label: '3. Manager Approved' },
            { id: 'CLOSED', label: '4. Closed & Locked' }
          ].map((step, idx) => {
            const stepOrder = ['DRAFT', 'IN_PROGRESS', 'COUNT_COMPLETED', 'UNDER_REVIEW', 'INVESTIGATION', 'APPROVED', 'CLOSED'];
            const currentIdx = stepOrder.indexOf(audit.status);
            const thisIdx = stepOrder.indexOf(step.id);
            const isDone = currentIdx >= thisIdx;
            const isCurrent = (audit.status === step.id) || (audit.status === 'COUNT_COMPLETED' && step.id === 'IN_PROGRESS') || (audit.status === 'INVESTIGATION' && step.id === 'UNDER_REVIEW');

            return (
              <div key={step.id} className="flex items-center gap-2 whitespace-nowrap">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border ${
                  isCurrent
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : isDone
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : darkMode ? 'bg-slate-800/40 border-slate-800 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{step.label}</span>
                </div>
                {idx < 3 && <ChevronRight className="w-4 h-4 text-slate-600 mx-1" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI Financial & Discrepancy Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Items Counted</div>
          <div className="text-2xl font-extrabold">{audit.itemsCounted} / {audit.totalItemsCount}</div>
          <div className="text-[11px] text-amber-400 mt-1 font-semibold">
            {audit.totalItemsCount > 0 ? Math.round((audit.itemsCounted / audit.totalItemsCount) * 100) : 0}% Complete
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Expected Stock Value</div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-400">{formatCurrency(audit.totalExpectedValue || 0)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Theoretical Closing Value</div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Physical Stock Value</div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-400">{formatCurrency(audit.totalPhysicalValue || 0)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total count on hand</div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Shortage Discrepancies</div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-400">-{formatCurrency(audit.estimatedLossValue || 0)}</div>
          <div className="text-[11px] text-rose-400/80 mt-1">{audit.totalShortageCount || 0} item line(s) missing</div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Surplus Discrepancies</div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400">+{formatCurrency(audit.estimatedSurplusValue || 0)}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1">{audit.totalSurplusCount || 0} item line(s) surplus</div>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-xs font-semibold text-slate-400 mb-1">Net Audit Variance</div>
          <div className={`text-xl sm:text-2xl font-extrabold ${(audit.netVarianceValue || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {(audit.netVarianceValue || 0) > 0 ? '+' : ''}{formatCurrency(audit.netVarianceValue || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {audit.riskLevel === 'HIGH' ? (
              <span className="text-rose-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> High Risk</span>
            ) : audit.riskLevel === 'MEDIUM' ? (
              <span className="text-amber-400 font-bold">Medium Risk</span>
            ) : (
              <span className="text-emerald-400 font-bold">Low Risk</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('ITEMS')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ITEMS'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Item Reconciliation Table ({audit.items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('DEPARTMENTS')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'DEPARTMENTS'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Department Summary</span>
        </button>

        <button
          onClick={() => setActiveTab('ADJUSTMENTS')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ADJUSTMENTS'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Corrections & Audit Adjustments ({audit.adjustments?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: ITEM RECONCILIATION TABLE */}
      {activeTab === 'ITEMS' && (
        <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
          {/* Table Filters Header */}
          <div className={`p-4 border-b ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'} flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item, code, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-9 pr-3 py-1.5 rounded-xl text-xs sm:text-sm border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
                  }`}
                />
              </div>

              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm border outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300'
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

              {/* Quick Bulk Movement & Opening Edit Toggle */}
              {canEditCounts && (
                <button
                  onClick={() => setIsBulkEditMode(!isBulkEditMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isBulkEditMode
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : darkMode 
                        ? 'bg-slate-800/80 hover:bg-slate-800 text-amber-400 border-amber-500/30' 
                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                  title="Toggle inline inputs for Opening Stock, Stock In, and Stock Out across all items"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isBulkEditMode ? 'Close Bulk In/Out Edit' : 'Quick In/Out & Opening Edit'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All Items' },
                { id: 'SHORTAGE', label: `Shortages (${audit.totalShortageCount || 0})` },
                { id: 'SURPLUS', label: `Surpluses (${audit.totalSurplusCount || 0})` },
                { id: 'MATCHED', label: `Matched (${audit.totalMatchedCount || 0})` },
                { id: 'UNCOUNTED', label: `Uncounted (${audit.totalItemsCount - audit.itemsCounted})` }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterDiscrepancy(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterDiscrepancy === f.id
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Edit Notification Banner */}
          {isBulkEditMode && canEditCounts && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>
                  <strong>Quick Edit Mode Active:</strong> You can edit <strong>Opening Stock</strong>, <strong>+ In (Total Received)</strong>, <strong>- Out (Total Sold/Used)</strong>, and <strong>Physical Count</strong> directly inside the table cells. Click the <strong>Pencil (Edit)</strong> icon on any item for full granular sub-breakdowns (Transfers, Waste, Damaged, Adjustments).
                </span>
              </div>
              <button 
                onClick={() => setIsBulkEditMode(false)}
                className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className={`text-[11px] uppercase font-semibold ${darkMode ? 'bg-slate-950/60 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                <tr>
                  <th className="py-3 px-3">Item Description</th>
                  <th className="py-3 px-2 text-right">Unit Cost</th>
                  <th className="py-3 px-2 text-center text-blue-400">Opening</th>
                  <th className="py-3 px-2 text-center text-emerald-400">+ In Movements</th>
                  <th className="py-3 px-2 text-center text-rose-400">- Out Movements</th>
                  <th className="py-3 px-2 text-center text-blue-300 bg-blue-500/5">Theoretical</th>
                  <th className="py-3 px-2 text-center bg-amber-500/10 text-amber-400 font-bold">Physical Count</th>
                  <th className="py-3 px-2 text-center">Difference</th>
                  <th className="py-3 px-3 text-right">Variance Value</th>
                  <th className="py-3 px-3">Reason / Notes</th>
                  <th className="py-3 px-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500">
                      No items match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const totalIn = item.stockReceived + item.transfersIn + item.adjustmentsIn;
                    const totalOut = item.stockSoldOrUsed + item.transfersOut + item.wasteQuantity + item.damagedQuantity + item.adjustmentsOut;
                    const isShortage = item.difference < -0.001;
                    const isSurplus = item.difference > 0.001;
                    const isMatched = item.physicalCount !== null && Math.abs(item.difference) < 0.001;

                    return (
                      <tr 
                        key={item.id}
                        className={`transition-colors ${
                          isShortage 
                            ? 'bg-rose-500/5 hover:bg-rose-500/10' 
                            : isSurplus 
                              ? 'bg-emerald-500/5 hover:bg-emerald-500/10' 
                              : isMatched 
                                ? 'bg-slate-900/30 hover:bg-slate-900/50' 
                                : ''
                        }`}
                      >
                        {/* Description */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-200">{item.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-amber-400/80">{item.itemCode || 'SKU'}</span>
                            <span>&bull;</span>
                            <span>{item.department}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-slate-300">{item.unit}</span>
                          </div>
                        </td>

                        {/* Unit Cost */}
                        <td className="py-3 px-2 text-right font-mono text-xs">
                          {formatCurrency(item.unitCost)}
                        </td>

                        {/* Opening Stock (Editable inline or bulk) */}
                        <td className="py-2 px-2 text-center">
                          {isBulkEditMode && canEditCounts ? (
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.openingStock}
                              onChange={(e) => handleOpeningStockChange(item.id, e.target.value)}
                              className={`w-16 px-1.5 py-1 text-center font-bold rounded-lg border outline-none text-xs ${
                                darkMode ? 'bg-slate-800 border-blue-500/60 text-blue-400' : 'bg-white border-blue-400 text-blue-700'
                              }`}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingItem(item)}
                              className="group flex items-center justify-center gap-1 mx-auto font-bold text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded hover:bg-blue-500/10 transition-colors cursor-pointer"
                              title="Click to edit opening stock & movements"
                            >
                              <span>{item.openingStock}</span>
                              {canEditCounts && <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />}
                            </button>
                          )}
                        </td>

                        {/* + In Movements (Editable inline or bulk) */}
                        <td className="py-2 px-2 text-center">
                          {isBulkEditMode && canEditCounts ? (
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={totalIn}
                              onChange={(e) => handleTotalInChange(item.id, e.target.value)}
                              className={`w-16 px-1.5 py-1 text-center font-bold rounded-lg border outline-none text-xs ${
                                darkMode ? 'bg-slate-800 border-emerald-500/60 text-emerald-400' : 'bg-white border-emerald-400 text-emerald-700'
                              }`}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingItem(item)}
                              className="group flex items-center justify-center gap-1 mx-auto font-medium text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              title={`Received: ${item.stockReceived}, Transfers In: ${item.transfersIn}, Adjustments In: ${item.adjustmentsIn}. Click to edit.`}
                            >
                              <span>+{totalIn}</span>
                              {canEditCounts && <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500/60" />}
                            </button>
                          )}
                        </td>

                        {/* - Out Movements (Editable inline or bulk) */}
                        <td className="py-2 px-2 text-center">
                          {isBulkEditMode && canEditCounts ? (
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={totalOut}
                              onChange={(e) => handleTotalOutChange(item.id, e.target.value)}
                              className={`w-16 px-1.5 py-1 text-center font-bold rounded-lg border outline-none text-xs ${
                                darkMode ? 'bg-slate-800 border-rose-500/60 text-rose-400' : 'bg-white border-rose-400 text-rose-700'
                              }`}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingItem(item)}
                              className="group flex items-center justify-center gap-1 mx-auto font-medium text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title={`Sold/Used: ${item.stockSoldOrUsed}, Transfers Out: ${item.transfersOut}, Waste: ${item.wasteQuantity}, Damaged: ${item.damagedQuantity}, Adjustments Out: ${item.adjustmentsOut}. Click to edit.`}
                            >
                              <span>-{totalOut}</span>
                              {canEditCounts && <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500/60" />}
                            </button>
                          )}
                        </td>

                        {/* Theoretical Expected */}
                        <td className="py-3 px-2 text-center font-bold text-blue-400 bg-blue-500/5">
                          {item.theoreticalClosingStock}
                        </td>

                        {/* Interactive Physical Count Input */}
                        <td className="py-2 px-2 text-center bg-amber-500/5">
                          {canEditCounts ? (
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.physicalCount !== null && item.physicalCount !== undefined ? item.physicalCount : ''}
                              onChange={(e) => handleCountChange(item.id, e.target.value)}
                              placeholder="0"
                              className={`w-20 px-2 py-1 text-center font-bold rounded-lg border outline-none text-xs sm:text-sm ${
                                isShortage 
                                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-300' 
                                  : isSurplus 
                                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                                    : darkMode ? 'bg-slate-800 border-amber-500/50 text-amber-300' : 'bg-white border-amber-500 text-slate-900'
                              }`}
                            />
                          ) : (
                            <span className="font-bold text-sm">
                              {item.physicalCount !== null ? item.physicalCount : '-'}
                            </span>
                          )}
                        </td>

                        {/* Difference */}
                        <td className="py-3 px-2 text-center">
                          {item.physicalCount === null ? (
                            <span className="text-slate-500 text-xs italic">Uncounted</span>
                          ) : (
                            <span className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
                              isShortage 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                : isSurplus 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-slate-700 text-slate-300'
                            }`}>
                              {item.difference > 0 ? `+${item.difference}` : item.difference} {item.unit}
                            </span>
                          )}
                        </td>

                        {/* Variance Value */}
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {item.physicalCount === null ? (
                            <span className="text-slate-500">-</span>
                          ) : (
                            <span className={isShortage ? 'text-rose-400' : isSurplus ? 'text-emerald-400' : 'text-slate-400'}>
                              {item.varianceValue > 0 ? `+${formatCurrency(item.varianceValue)}` : formatCurrency(item.varianceValue)}
                            </span>
                          )}
                        </td>

                        {/* Discrepancy Reason & Investigation Notes */}
                        <td className="py-2 px-3">
                          {Math.abs(item.difference) > 0.001 ? (
                            <div className="space-y-1">
                              <select
                                disabled={!canEditCounts && !isSuperAdminOrManager}
                                value={item.reason || ''}
                                onChange={(e) => handleReasonChange(item.id, e.target.value as DiscrepancyReason)}
                                className={`w-full px-2 py-1 rounded text-[11px] border outline-none ${
                                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
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
                                <option value="THEFT_SUSPECTED">Theft Suspected (Investigate)</option>
                                <option value="OTHER">Other Discrepancy</option>
                              </select>

                              <input
                                type="text"
                                disabled={!canEditCounts && !isSuperAdminOrManager}
                                placeholder="Investigation notes..."
                                value={item.investigationNotes || ''}
                                onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                className={`w-full px-2 py-0.5 rounded text-[10px] border outline-none ${
                                  darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200'
                                }`}
                              />
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">Reconciled</span>
                          )}
                        </td>

                        {/* Action Column: Full In/Out/Opening Edit Button */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canEditCounts && (
                              <button
                                onClick={() => setEditingItem(item)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-slate-950 border border-blue-500/20 transition-all flex items-center gap-1 cursor-pointer"
                                title="Edit Opening Stock, In Movements (Received, Transfers, Adjustments) & Out Movements (Sales, Waste, Damaged)"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span className="hidden sm:inline">Edit In/Out</span>
                              </button>
                            )}

                            {isClosed && isSuperAdminOrManager && (
                              <button
                                onClick={() => {
                                  setCorrectionItem(item);
                                  setCorrectedCountInput(String(item.physicalCount || 0));
                                  setCorrectionReason('');
                                }}
                                className="px-2 py-1 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/20 transition-colors cursor-pointer"
                              >
                                Correct
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENT SUMMARY */}
      {activeTab === 'DEPARTMENTS' && (
        <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-4`}>
          <h2 className="font-bold text-base sm:text-lg">Departmental Stock & Variance Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={`text-xs uppercase font-semibold ${darkMode ? 'bg-slate-950/60 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Expected Stock Value</th>
                  <th className="py-3 px-4 text-right">Physical Count Value</th>
                  <th className="py-3 px-4 text-right text-rose-400">Shortage Value</th>
                  <th className="py-3 px-4 text-right text-emerald-400">Surplus Value</th>
                  <th className="py-3 px-4 text-right">Net Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {departmentSummaries.map((dept, idx) => (
                  <tr key={idx} className="hover:bg-amber-500/5">
                    <td className="py-3.5 px-4 font-bold">{dept.department}</td>
                    <td className="py-3.5 px-4 text-center font-semibold">{dept.itemsCount}</td>
                    <td className="py-3.5 px-4 text-right font-mono">{formatCurrency(dept.expectedStockValue)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-400">{formatCurrency(dept.physicalStockValue)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-400">
                      {dept.shortageValue > 0 ? `-${formatCurrency(dept.shortageValue)}` : '0 RWF'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      {dept.surplusValue > 0 ? `+${formatCurrency(dept.surplusValue)}` : '0 RWF'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      <span className={dept.netVariance < 0 ? 'text-rose-400' : dept.netVariance > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                        {dept.netVariance > 0 ? '+' : ''}{formatCurrency(dept.netVariance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CORRECTIONS & AUDIT ADJUSTMENTS */}
      {activeTab === 'ADJUSTMENTS' && (
        <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base sm:text-lg">Audit Correction Audit Trail</h2>
              <p className="text-xs text-slate-400">Immutable record of changes and adjustments made after initial counts</p>
            </div>
          </div>

          {(!audit.adjustments || audit.adjustments.length === 0) ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/60" />
              No post-audit corrections have been logged. All counts match initial record.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {audit.adjustments.map((adj, idx) => (
                <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-bold text-amber-400">{adj.itemName}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Corrected by <strong>{adj.correctedBy}</strong> ({adj.correctedByRole}) on {new Date(adj.correctedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 italic mt-1">&ldquo;{adj.reason}&rdquo;</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs">
                      Count: <span className="line-through text-slate-500">{adj.originalPhysicalCount}</span> &rarr; <span className="font-bold text-emerald-400">{adj.correctedPhysicalCount}</span>
                    </div>
                    <div className="text-xs font-mono mt-0.5">
                      Diff: <span className="text-rose-400">{adj.originalDifference}</span> &rarr; <span className="text-emerald-400">{adj.correctedDifference}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Correct Closed Audit Item */}
      {correctionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="font-bold text-base sm:text-lg">Log Official Audit Count Correction</h3>
            <p className="text-xs text-slate-400">
              Item: <strong>{correctionItem.name}</strong> (Theoretical: {correctionItem.theoreticalClosingStock})
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">New Physical Count *</label>
              <input
                type="number"
                step="any"
                min="0"
                value={correctedCountInput}
                onChange={(e) => setCorrectedCountInput(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-bold text-sm outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Reason for Count Correction *</label>
              <textarea
                rows={2}
                required
                placeholder="Explain why this count is being modified..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                }`}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCorrectionItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCorrection}
                disabled={!correctedCountInput || !correctionReason.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 cursor-pointer"
              >
                Save Correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Apply Approved Stock Adjustment */}
      {showApplyAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg">Synchronize Approved Inventory</h3>
                <p className="text-xs text-slate-400">Update actual operational stock balances to reflect this approved audit</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border text-xs space-y-2 ${
              darkMode ? 'bg-slate-950/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex justify-between">
                <span>Audit Reference:</span>
                <strong className="text-amber-400">{audit.auditNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span>Items with Discrepancies to Adjust:</span>
                <strong>{audit.totalDiscrepanciesCount || 0} item(s)</strong>
              </div>
              <div className="flex justify-between">
                <span>Net Financial Impact:</span>
                <strong className={(audit.netVarianceValue || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {(audit.netVarianceValue || 0) > 0 ? '+' : ''}{formatCurrency(audit.netVarianceValue || 0)}
                </strong>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              This action will generate official <strong>Stock Adjustment Logs</strong> and align stock levels in the Beverage and Kitchen inventories with the audited physical counts.
            </p>

            {adjustmentFeedback && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                adjustmentFeedback.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {adjustmentFeedback.message}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowApplyAdjustmentModal(false);
                  setAdjustmentFeedback(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                {adjustmentFeedback?.success ? 'Close' : 'Cancel'}
              </button>

              {!adjustmentFeedback?.success && (
                <button
                  onClick={handleExecuteStockAdjustment}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm & Synchronize Stock</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Full Product Movements & Opening Stock Editor */}
      <AuditItemEditModal
        isOpen={Boolean(editingItem)}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEditedItem}
        darkMode={darkMode}
      />
    </div>
  );
};
