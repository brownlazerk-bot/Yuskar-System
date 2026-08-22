import React, { useState, useEffect } from 'react';
import { StockAudit, AppUser, UserRole, Business } from '../../types';
import { 
  loadStockAudits, saveStockAudits, addStockAudit, 
  updateStockAudit, loadCurrentBusiness 
} from '../../lib/storage';
import { buildAuditItemSnapshots, recalculateAuditSummary } from '../../lib/auditEngine';
import { AuditDashboard } from './AuditDashboard';
import { AuditDetailView } from './AuditDetailView';
import { CreateAuditModal } from './CreateAuditModal';
import { AuditPrintReport } from './AuditPrintReport';
import { AuditComparisonModal } from './AuditComparisonModal';

interface StockAuditModuleProps {
  currentUser: AppUser | null;
  userRole: UserRole;
  darkMode: boolean;
}

export const StockAuditModule: React.FC<StockAuditModuleProps> = ({
  currentUser,
  userRole,
  darkMode
}) => {
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [activeAudit, setActiveAudit] = useState<StockAudit | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [printAudit, setPrintAudit] = useState<StockAudit | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  // Load audits on mount and sync state
  useEffect(() => {
    const loadedAudits = loadStockAudits();
    const currentBiz = loadCurrentBusiness();
    setBusiness(currentBiz);

    if (loadedAudits.length > 0) {
      setAudits(loadedAudits);
    } else {
      // Initialize an initial sample audit for Bar / Beverage if completely fresh
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const snapshot = buildAuditItemSnapshots({
        scopeType: 'DEPARTMENT',
        department: 'Bar / Beverage',
        startDate: yesterday.toISOString(),
        endDate: now.toISOString()
      });

      if (snapshot.length > 0) {
        // Pre-count a few items to showcase discrepancy detection
        const preCounted = snapshot.map((item, idx) => {
          if (idx === 0) {
            const count = Math.max(0, item.theoreticalClosingStock - 2);
            return {
              ...item,
              physicalCount: count,
              difference: -2,
              varianceValue: -2 * item.unitCost,
              discrepancyStatus: 'SHORTAGE' as any,
              reason: 'UNRECORDED_SALE' as any,
              investigationNotes: 'Missing 2 bottles at shift handover'
            };
          } else if (idx === 1) {
            const count = item.theoreticalClosingStock;
            return {
              ...item,
              physicalCount: count,
              difference: 0,
              varianceValue: 0,
              discrepancyStatus: 'MATCHED' as any
            };
          }
          return item;
        });

        const initialAudit: Omit<StockAudit, 'id' | 'auditNumber' | 'createdAt' | 'updatedAt'> = {
          businessId: currentBiz?.id || 'default-biz',
          name: 'End of Day Bar Audit (Shift Closing)',
          auditDate: now.toISOString().split('T')[0],
          startDate: yesterday.toISOString(),
          endDate: now.toISOString(),
          frequency: 'DAILY',
          scopeType: 'DEPARTMENT',
          department: 'Bar / Beverage',
          location: 'Main Bar Counter',
          status: 'IN_PROGRESS',
          auditorId: currentUser?.id || 'auditor-01',
          auditorName: currentUser?.fullName || 'Duty Auditor',
          auditorRole: currentUser?.role || 'Storekeeper',
          totalItemsCount: preCounted.length,
          itemsCounted: 2,
          totalOpeningValue: 0,
          totalReceivedValue: 0,
          totalUsageValue: 0,
          totalExpectedValue: 0,
          totalPhysicalValue: 0,
          totalDiscrepanciesCount: 1,
          totalShortageCount: 1,
          totalSurplusCount: 0,
          totalMatchedCount: 1,
          estimatedLossValue: 0,
          estimatedSurplusValue: 0,
          netVarianceValue: 0,
          riskLevel: 'LOW',
          generalNotes: 'Shift closing bar audit and reconciliation record.',
          items: preCounted
        };

        const finalized = recalculateAuditSummary(initialAudit as any);
        const created = addStockAudit(finalized as any);
        setAudits([created]);
      }
    }
  }, []);

  const handleAuditCreated = (newAudit: StockAudit) => {
    const created = addStockAudit(newAudit);
    const updated = [created, ...audits.filter(a => a.id !== created.id)];
    setAudits(updated);
    setActiveAudit(created);
  };

  const handleUpdateAudit = (updatedAudit: StockAudit) => {
    updateStockAudit(updatedAudit);
    const updatedList = audits.map(a => a.id === updatedAudit.id ? updatedAudit : a);
    setAudits(updatedList);
    setActiveAudit(updatedAudit);
  };

  return (
    <div className="space-y-6">
      {activeAudit ? (
        <AuditDetailView
          audit={activeAudit}
          onUpdateAudit={handleUpdateAudit}
          onBack={() => setActiveAudit(null)}
          onPrint={(audit) => setPrintAudit(audit)}
          currentUser={currentUser}
          userRole={userRole}
          darkMode={darkMode}
        />
      ) : (
        <AuditDashboard
          audits={audits}
          onCreateNew={() => setIsCreateModalOpen(true)}
          onOpenAudit={(audit) => setActiveAudit(audit)}
          onCompareAudits={() => setIsCompareModalOpen(true)}
          onPrintAudit={(audit) => setPrintAudit(audit)}
          userRole={userRole}
          darkMode={darkMode}
        />
      )}

      {/* Create Audit Modal */}
      <CreateAuditModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAuditCreated={handleAuditCreated}
        currentUser={currentUser}
        darkMode={darkMode}
      />

      {/* Compare Audits Modal */}
      <AuditComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        audits={audits}
        darkMode={darkMode}
      />

      {/* Print Preview Modal */}
      {printAudit && (
        <AuditPrintReport
          audit={printAudit}
          business={business}
          onClose={() => setPrintAudit(null)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};
