import { 
  MenuItem, KitchenIngredient, StockMovementRecord, 
  KitchenWasteRecord, PurchaseOrder, Order, StockAdjustmentLog,
  StockAudit, AuditItemRecord, AuditScopeType, AuditFrequency,
  DiscrepancyStatus, DiscrepancyReason
} from '../types';
import { 
  loadMenuItems, loadIngredients, loadStockMovementRecords,
  loadWasteRecords, loadPurchaseOrders, loadOrders, loadStockLogs,
  getActiveBusinessId, saveStockLogs, saveMenuItems, saveIngredients,
  addStockMovementRecord
} from './storage';

export interface AuditDepartmentSummary {
  department: string;
  itemsCount: number;
  expectedStockValue: number;
  physicalStockValue: number;
  shortageValue: number;
  surplusValue: number;
  netVariance: number;
  discrepanciesCount: number;
}

export interface AuditComparisonResult {
  auditA: StockAudit;
  auditB: StockAudit;
  itemComparisons: {
    itemId: string;
    name: string;
    category: string;
    department: string;
    unit: string;
    auditADifference: number;
    auditBDifference: number;
    trend: 'INCREASING_SHORTAGE' | 'DECREASING_SHORTAGE' | 'STABLE' | 'NEW_DISCREPANCY' | 'RESOLVED';
    varianceChangeValue: number;
  }[];
  totalLossA: number;
  totalLossB: number;
  lossDifference: number;
  trendSummary: string;
}

/**
 * Builds the initial frozen item snapshot for an audit based on selected scope and time window
 */
export function buildAuditItemSnapshots(params: {
  scopeType: AuditScopeType;
  department?: string;
  category?: string;
  specificItemIds?: string[];
  startDate: string;
  endDate: string;
}): AuditItemRecord[] {
  const menuItems = loadMenuItems();
  const ingredients = loadIngredients();
  const stockMovements = loadStockMovementRecords();
  const wasteRecords = loadWasteRecords();
  const purchaseOrders = loadPurchaseOrders();
  const orders = loadOrders();
  const stockLogs = loadStockLogs();

  const startMs = new Date(params.startDate).getTime();
  const endMs = new Date(params.endDate).getTime();

  const candidateItems: {
    itemId: string;
    itemType: 'BEVERAGE_MENU' | 'KITCHEN_INGREDIENT';
    itemCode?: string;
    name: string;
    category: string;
    department: string;
    unit: string;
    unitCost: number;
    currentStock: number;
  }[] = [];

  // Filter Menu Items (Bar & Beverages, Food, etc.)
  menuItems.forEach(m => {
    let dept = m.kitchenDepartment || (m.isFood ? 'Kitchen' : 'Bar / Beverage');
    if (m.productSection === 'Swimming Pool') dept = 'Swimming Pool';
    if (m.productSection === 'Sauna') dept = 'Sauna';
    if (m.productSection === 'Room Services') dept = 'Room Service';

    let match = true;
    if (params.scopeType === 'DEPARTMENT' && params.department && params.department !== 'Entire Business') {
      match = dept.toLowerCase().includes(params.department.toLowerCase()) || params.department.toLowerCase().includes(dept.toLowerCase());
    } else if (params.scopeType === 'CATEGORY' && params.category) {
      match = m.category.toLowerCase() === params.category.toLowerCase();
    } else if (params.scopeType === 'SPECIFIC_ITEMS' && params.specificItemIds && params.specificItemIds.length > 0) {
      match = params.specificItemIds.includes(m.id);
    }

    if (match) {
      candidateItems.push({
        itemId: m.id,
        itemType: 'BEVERAGE_MENU',
        itemCode: m.code || m.barcode || `BAR-${m.id.slice(-4)}`,
        name: m.name,
        category: m.category,
        department: dept,
        unit: m.unit || 'Bottle',
        unitCost: m.costPrice && m.costPrice > 0 ? m.costPrice : Math.round(m.price * 0.65),
        currentStock: m.stockQuantity || 0
      });
    }
  });

  // Filter Kitchen Ingredients (Raw Materials, Kitchen items)
  ingredients.forEach(ing => {
    const dept = ing.storageLocation || 'Kitchen Main Store';
    let match = true;
    if (params.scopeType === 'DEPARTMENT' && params.department && params.department !== 'Entire Business') {
      match = params.department.toLowerCase().includes('kitchen') || dept.toLowerCase().includes(params.department.toLowerCase());
    } else if (params.scopeType === 'CATEGORY' && params.category) {
      match = ing.category.toLowerCase() === params.category.toLowerCase();
    } else if (params.scopeType === 'SPECIFIC_ITEMS' && params.specificItemIds && params.specificItemIds.length > 0) {
      match = params.specificItemIds.includes(ing.id);
    }

    if (match) {
      candidateItems.push({
        itemId: ing.id,
        itemType: 'KITCHEN_INGREDIENT',
        itemCode: ing.code || `ING-${ing.id.slice(-4)}`,
        name: ing.name,
        category: ing.category,
        department: dept,
        unit: ing.unit || 'Kg',
        unitCost: ing.costPerUnit || ing.averageCost || 1000,
        currentStock: ing.stockQuantity || 0
      });
    }
  });

  // Build calculations for each item
  return candidateItems.map((candidate, idx) => {
    // 1. Calculate Movements within the audit time window [startDate, endDate]
    let stockReceived = 0;
    let transfersIn = 0;
    let adjustmentsIn = 0;
    let stockSoldOrUsed = 0;
    let transfersOut = 0;
    let wasteQuantity = 0;
    let damagedQuantity = 0;
    let adjustmentsOut = 0;

    // Movement records
    stockMovements.forEach(sm => {
      const isTarget = sm.ingredientId === candidate.itemId || 
                       (sm.menuItemId && sm.menuItemId === candidate.itemId) ||
                       (sm.ingredientName && sm.ingredientName.toLowerCase() === candidate.name.toLowerCase());
      if (!isTarget) return;

      const t = new Date(sm.timestamp || `${sm.date}T${sm.time || '00:00:00'}`).getTime();
      if (t >= startMs && t <= endMs) {
        if (sm.movementType === 'Purchase' || sm.movementType === 'Production' || sm.movementType === 'Return') {
          stockReceived += sm.quantityIn || 0;
        } else if (sm.movementType === 'Transfer') {
          if (sm.quantityIn > 0) transfersIn += sm.quantityIn;
          if (sm.quantityOut > 0) transfersOut += sm.quantityOut;
        } else if (sm.movementType === 'Waste' || sm.movementType === 'Spoilage' || sm.movementType === 'Expired Items') {
          wasteQuantity += sm.quantityOut || 0;
        } else if (sm.movementType === 'Kitchen Consumption' || sm.movementType === 'Recipe Consumption') {
          stockSoldOrUsed += sm.quantityOut || 0;
        } else if (sm.movementType === 'Stock Adjustment' || sm.movementType === 'Manual Correction') {
          if (sm.quantityIn > 0) adjustmentsIn += sm.quantityIn;
          if (sm.quantityOut > 0) adjustmentsOut += sm.quantityOut;
        }
      }
    });

    // Waste records
    wasteRecords.forEach(w => {
      const isTarget = w.ingredientId === candidate.itemId || 
                       (w.ingredientName && w.ingredientName.toLowerCase() === candidate.name.toLowerCase());
      if (!isTarget) return;

      const t = new Date(w.timestamp || `${w.date}T00:00:00`).getTime();
      if (t >= startMs && t <= endMs) {
        wasteQuantity += w.quantity || 0;
      }
    });

    // Purchase Orders received in window
    purchaseOrders.forEach(po => {
      if (po.status === 'Received' || po.status === 'Partially Received') {
        const poDate = po.receivedAt || po.timestamp || po.date;
        const t = new Date(poDate).getTime();
        if (t >= startMs && t <= endMs) {
          po.items.forEach(poi => {
            if (poi.itemId === candidate.itemId || poi.itemName.toLowerCase() === candidate.name.toLowerCase()) {
              const qty = poi.receivedQuantity !== undefined ? poi.receivedQuantity : (poi.received ? poi.quantity : 0);
              stockReceived += qty;
            }
          });
        }
      }
    });

    // Sales Orders in window (for beverage / menu items)
    if (candidate.itemType === 'BEVERAGE_MENU') {
      orders.forEach(ord => {
        if (ord.status === 'Cancelled') return;
        const t = new Date(ord.createdAt).getTime();
        if (t >= startMs && t <= endMs) {
          ord.items.forEach(oi => {
            if (oi.itemId === candidate.itemId || oi.name.toLowerCase() === candidate.name.toLowerCase()) {
              stockSoldOrUsed += oi.quantity || 0;
            }
          });
        }
      });
    }

    // Stock Adjustment logs
    stockLogs.forEach(sl => {
      if (sl.itemId === candidate.itemId || sl.itemName.toLowerCase() === candidate.name.toLowerCase()) {
        const t = new Date(sl.timestamp).getTime();
        if (t >= startMs && t <= endMs) {
          if (sl.type === 'Waste') wasteQuantity += Math.abs(sl.quantityChange);
          else if (sl.type === 'Damaged') damagedQuantity += Math.abs(sl.quantityChange);
          else if (sl.type === 'Purchase') stockReceived += Math.max(0, sl.quantityChange);
          else if (sl.type === 'Transfer') {
            if (sl.quantityChange > 0) transfersIn += sl.quantityChange;
            else transfersOut += Math.abs(sl.quantityChange);
          } else if (sl.type === 'Adjustment') {
            if (sl.quantityChange > 0) adjustmentsIn += sl.quantityChange;
            else adjustmentsOut += Math.abs(sl.quantityChange);
          }
        }
      }
    });

    // Opening Stock estimation:
    // If movements exist after startDate, Opening = currentStock - (MovementsIn since start) + (MovementsOut since start)
    // To ensure consistency, calculate opening stock accurately from current stock baseline:
    const netMovementsSinceStart = 
      (stockReceived + transfersIn + adjustmentsIn) - 
      (stockSoldOrUsed + transfersOut + wasteQuantity + damagedQuantity + adjustmentsOut);

    const calculatedOpening = Math.max(0, Math.round((candidate.currentStock - netMovementsSinceStart) * 100) / 100);
    const openingStock = calculatedOpening >= 0 ? calculatedOpening : candidate.currentStock;

    // Theoretical Closing Stock Formula
    const theoreticalClosingStock = Math.max(
      0,
      Math.round(
        (openingStock + stockReceived + transfersIn + adjustmentsIn - stockSoldOrUsed - transfersOut - wasteQuantity - damagedQuantity - adjustmentsOut) * 100
      ) / 100
    );

    return {
      id: `ai-${Date.now()}-${idx + 1}`,
      itemId: candidate.itemId,
      itemType: candidate.itemType,
      itemCode: candidate.itemCode,
      name: candidate.name,
      category: candidate.category,
      department: candidate.department,
      unit: candidate.unit,
      unitCost: candidate.unitCost,

      openingStock,
      openingStockTimestamp: params.startDate,
      openingStockSource: 'System Operational Stock History',

      stockReceived,
      transfersIn,
      adjustmentsIn,

      stockSoldOrUsed,
      transfersOut,
      wasteQuantity,
      damagedQuantity,
      adjustmentsOut,

      theoreticalClosingStock,
      physicalCount: null,
      difference: 0,
      varianceValue: 0,
      discrepancyStatus: 'PENDING_INVESTIGATION'
    };
  });
}

/**
 * Recomputes theoretical closing stock, differences, and variance value for a single item record
 */
export function recalculateAuditItem(item: AuditItemRecord): AuditItemRecord {
  const opening = typeof item.openingStock === 'number' && !isNaN(item.openingStock) ? item.openingStock : 0;
  const received = typeof item.stockReceived === 'number' && !isNaN(item.stockReceived) ? item.stockReceived : 0;
  const trIn = typeof item.transfersIn === 'number' && !isNaN(item.transfersIn) ? item.transfersIn : 0;
  const adjIn = typeof item.adjustmentsIn === 'number' && !isNaN(item.adjustmentsIn) ? item.adjustmentsIn : 0;
  
  const soldOrUsed = typeof item.stockSoldOrUsed === 'number' && !isNaN(item.stockSoldOrUsed) ? item.stockSoldOrUsed : 0;
  const trOut = typeof item.transfersOut === 'number' && !isNaN(item.transfersOut) ? item.transfersOut : 0;
  const waste = typeof item.wasteQuantity === 'number' && !isNaN(item.wasteQuantity) ? item.wasteQuantity : 0;
  const damaged = typeof item.damagedQuantity === 'number' && !isNaN(item.damagedQuantity) ? item.damagedQuantity : 0;
  const adjOut = typeof item.adjustmentsOut === 'number' && !isNaN(item.adjustmentsOut) ? item.adjustmentsOut : 0;

  const totalIn = received + trIn + adjIn;
  const totalOut = soldOrUsed + trOut + waste + damaged + adjOut;
  
  // Theoretical Closing = Opening + In - Out
  const theoretical = Math.max(0, Math.round((opening + totalIn - totalOut) * 100) / 100);

  const isCounted = item.physicalCount !== null && item.physicalCount !== undefined && !isNaN(Number(item.physicalCount));
  const count = isCounted ? Number(item.physicalCount) : null;
  const diff = isCounted && count !== null ? Math.round((count - theoretical) * 100) / 100 : 0;
  const unitCost = typeof item.unitCost === 'number' && !isNaN(item.unitCost) ? item.unitCost : 0;
  const varianceVal = Math.round(diff * unitCost);

  let status: DiscrepancyStatus = item.discrepancyStatus;
  if (isCounted && count !== null) {
    if (Math.abs(diff) < 0.001) {
      status = 'MATCHED';
    } else if (diff < 0) {
      status = status === 'EXPLAINED' || status === 'APPROVED' || status === 'RESOLVED' ? status : 'SHORTAGE';
    } else {
      status = status === 'EXPLAINED' || status === 'APPROVED' || status === 'RESOLVED' ? status : 'SURPLUS';
    }
  } else {
    status = 'PENDING_INVESTIGATION';
  }

  return {
    ...item,
    openingStock: opening,
    stockReceived: received,
    transfersIn: trIn,
    adjustmentsIn: adjIn,
    stockSoldOrUsed: soldOrUsed,
    transfersOut: trOut,
    wasteQuantity: waste,
    damagedQuantity: damaged,
    adjustmentsOut: adjOut,
    theoreticalClosingStock: theoretical,
    physicalCount: count,
    difference: diff,
    varianceValue: varianceVal,
    discrepancyStatus: status
  };
}

/**
 * Recomputes all totals, discrepancy counts, financial variances, and risk evaluation for an audit
 */
export function recalculateAuditSummary(audit: StockAudit): StockAudit {
  let totalOpeningValue = 0;
  let totalReceivedValue = 0;
  let totalUsageValue = 0;
  let totalExpectedValue = 0;
  let totalPhysicalValue = 0;

  let itemsCounted = 0;
  let totalDiscrepanciesCount = 0;
  let totalShortageCount = 0;
  let totalSurplusCount = 0;
  let totalMatchedCount = 0;

  let estimatedLossValue = 0;
  let estimatedSurplusValue = 0;

  const riskFactors: string[] = [];

  const updatedItems = audit.items.map(rawItem => {
    const item = recalculateAuditItem(rawItem);
    const isCounted = item.physicalCount !== null && item.physicalCount !== undefined;
    const count = isCounted ? Number(item.physicalCount) : null;
    const diff = item.difference;
    const varianceVal = item.varianceValue;

    if (isCounted && count !== null) {
      itemsCounted++;
      if (Math.abs(diff) < 0.001) {
        totalMatchedCount++;
      } else if (diff < 0) {
        totalShortageCount++;
        totalDiscrepanciesCount++;
        estimatedLossValue += Math.abs(varianceVal);
      } else {
        totalSurplusCount++;
        totalDiscrepanciesCount++;
        estimatedSurplusValue += varianceVal;
      }
    }

    totalOpeningValue += (item.openingStock || 0) * item.unitCost;
    totalReceivedValue += (item.stockReceived + item.transfersIn + item.adjustmentsIn) * item.unitCost;
    totalUsageValue += (item.stockSoldOrUsed + item.transfersOut + item.wasteQuantity + item.damagedQuantity + item.adjustmentsOut) * item.unitCost;
    totalExpectedValue += item.theoreticalClosingStock * item.unitCost;
    if (isCounted && count !== null) {
      totalPhysicalValue += count * item.unitCost;
    }

    return item;
  });

  const netVarianceValue = estimatedSurplusValue - estimatedLossValue;

  // Evaluate Risk Level (Non-accusatory, labeled "Requires Management Review")
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (estimatedLossValue > 40000 || totalShortageCount >= 5) {
    riskLevel = 'HIGH';
    if (estimatedLossValue > 40000) riskFactors.push(`High financial shortage value (${estimatedLossValue.toLocaleString()} RWF)`);
    if (totalShortageCount >= 5) riskFactors.push(`Multiple stock shortage lines (${totalShortageCount} items)`);
  } else if (estimatedLossValue > 15000 || totalShortageCount >= 2 || totalSurplusCount >= 3) {
    riskLevel = 'MEDIUM';
    if (estimatedLossValue > 15000) riskFactors.push(`Moderate variance value (${estimatedLossValue.toLocaleString()} RWF)`);
    if (totalShortageCount >= 2) riskFactors.push(`Repeated shortages found (${totalShortageCount} items)`);
    if (totalSurplusCount >= 3) riskFactors.push(`Unrecorded stock surplus detected (${totalSurplusCount} items)`);
  } else {
    riskLevel = 'LOW';
  }

  // Update audit status if all items counted
  let currentStatus = audit.status;
  if (currentStatus === 'IN_PROGRESS' && itemsCounted === updatedItems.length && updatedItems.length > 0) {
    currentStatus = 'COUNT_COMPLETED';
  }

  return {
    ...audit,
    items: updatedItems,
    status: currentStatus,
    totalItemsCount: updatedItems.length,
    itemsCounted,
    totalOpeningValue: Math.round(totalOpeningValue),
    totalReceivedValue: Math.round(totalReceivedValue),
    totalUsageValue: Math.round(totalUsageValue),
    totalExpectedValue: Math.round(totalExpectedValue),
    totalPhysicalValue: Math.round(totalPhysicalValue),
    totalDiscrepanciesCount,
    totalShortageCount,
    totalSurplusCount,
    totalMatchedCount,
    estimatedLossValue: Math.round(estimatedLossValue),
    estimatedSurplusValue: Math.round(estimatedSurplusValue),
    netVarianceValue: Math.round(netVarianceValue),
    riskLevel,
    riskFactors
  };
}

/**
 * Calculates departmental audit breakdown
 */
export function calculateDepartmentSummaries(audit: StockAudit): AuditDepartmentSummary[] {
  const deptMap: Record<string, AuditDepartmentSummary> = {};

  audit.items.forEach(item => {
    const dept = item.department || 'General Store';
    if (!deptMap[dept]) {
      deptMap[dept] = {
        department: dept,
        itemsCount: 0,
        expectedStockValue: 0,
        physicalStockValue: 0,
        shortageValue: 0,
        surplusValue: 0,
        netVariance: 0,
        discrepanciesCount: 0
      };
    }

    const d = deptMap[dept];
    d.itemsCount++;
    d.expectedStockValue += item.theoreticalClosingStock * item.unitCost;
    if (item.physicalCount !== null && item.physicalCount !== undefined) {
      d.physicalStockValue += item.physicalCount * item.unitCost;
      if (item.difference < 0) {
        d.shortageValue += Math.abs(item.varianceValue);
        d.discrepanciesCount++;
      } else if (item.difference > 0) {
        d.surplusValue += item.varianceValue;
        d.discrepanciesCount++;
      }
    }
  });

  return Object.values(deptMap).map(d => ({
    ...d,
    expectedStockValue: Math.round(d.expectedStockValue),
    physicalStockValue: Math.round(d.physicalStockValue),
    shortageValue: Math.round(d.shortageValue),
    surplusValue: Math.round(d.surplusValue),
    netVariance: Math.round(d.surplusValue - d.shortageValue)
  }));
}

/**
 * Compares two audits to highlight recurring discrepancies and variance trends
 */
export function compareAudits(auditA: StockAudit, auditB: StockAudit): AuditComparisonResult {
  const itemComparisons: AuditComparisonResult['itemComparisons'] = [];

  const itemMapB: Record<string, AuditItemRecord> = {};
  auditB.items.forEach(item => {
    itemMapB[item.itemId] = item;
  });

  auditA.items.forEach(itemA => {
    const itemB = itemMapB[itemA.itemId];
    if (itemB) {
      const diffA = itemA.difference || 0;
      const diffB = itemB.difference || 0;

      let trend: AuditComparisonResult['itemComparisons'][0]['trend'] = 'STABLE';
      if (diffA < 0 && diffB < diffA) {
        trend = 'INCREASING_SHORTAGE';
      } else if (diffA < 0 && diffB > diffA) {
        trend = 'DECREASING_SHORTAGE';
      } else if (diffA === 0 && diffB !== 0) {
        trend = 'NEW_DISCREPANCY';
      } else if (diffA !== 0 && diffB === 0) {
        trend = 'RESOLVED';
      }

      itemComparisons.push({
        itemId: itemA.itemId,
        name: itemA.name,
        category: itemA.category,
        department: itemA.department,
        unit: itemA.unit,
        auditADifference: diffA,
        auditBDifference: diffB,
        trend,
        varianceChangeValue: (diffB - diffA) * itemA.unitCost
      });
    }
  });

  const totalLossA = auditA.estimatedLossValue || 0;
  const totalLossB = auditB.estimatedLossValue || 0;
  const lossDifference = totalLossB - totalLossA;

  let trendSummary = 'Stock discrepancies are stable across both audit periods.';
  if (lossDifference > 5000) {
    trendSummary = `Estimated shortage loss increased by ${lossDifference.toLocaleString()} RWF in the subsequent audit.`;
  } else if (lossDifference < -5000) {
    trendSummary = `Estimated shortage loss decreased by ${Math.abs(lossDifference).toLocaleString()} RWF, showing improved stock reconciliation.`;
  }

  return {
    auditA,
    auditB,
    itemComparisons,
    totalLossA,
    totalLossB,
    lossDifference,
    trendSummary
  };
}

/**
 * Creates an authorized stock adjustment from an approved audit to update inventory
 * (Strictly only triggered on explicit manager action)
 */
export function applyApprovedAuditStockAdjustment(
  audit: StockAudit,
  authorizedBy: string
): { success: boolean; adjustedCount: number; message: string } {
  if (audit.status !== 'APPROVED' && audit.status !== 'CLOSED') {
    return {
      success: false,
      adjustedCount: 0,
      message: 'Audit must be Approved by management before stock adjustments can be applied.'
    };
  }

  const menuItems = loadMenuItems();
  const ingredients = loadIngredients();
  const currentLogs = loadStockLogs();
  const newLogs: StockAdjustmentLog[] = [];

  let adjustedCount = 0;

  audit.items.forEach(item => {
    if (item.physicalCount === null || item.physicalCount === undefined) return;
    if (Math.abs(item.difference) < 0.001) return;

    if (item.itemType === 'BEVERAGE_MENU') {
      const idx = menuItems.findIndex(m => m.id === item.itemId);
      if (idx > -1) {
        const prev = menuItems[idx].stockQuantity;
        const newStock = Math.max(0, item.physicalCount);
        menuItems[idx] = {
          ...menuItems[idx],
          stockQuantity: newStock,
          status: newStock <= 0 ? 'Out of Stock' : 'Available'
        };

        newLogs.push({
          id: `ADJ-LOG-${Date.now()}-${adjustedCount + 1}`,
          itemId: item.itemId,
          itemName: item.name,
          type: 'Adjustment',
          quantityChange: item.difference,
          previousStock: prev,
          newStock: newStock,
          reason: `Approved audit adjustment (${audit.auditNumber} - ${item.reason || 'Reconciliation'})`,
          timestamp: new Date().toISOString(),
          actor: authorizedBy
        });

        adjustedCount++;
      }
    } else if (item.itemType === 'KITCHEN_INGREDIENT') {
      const idx = ingredients.findIndex(g => g.id === item.itemId);
      if (idx > -1) {
        const prev = ingredients[idx].stockQuantity;
        const newStock = Math.max(0, item.physicalCount);
        ingredients[idx] = {
          ...ingredients[idx],
          stockQuantity: newStock,
          status: newStock <= 0 ? 'Out of Stock' : (newStock <= ingredients[idx].minStockAlert ? 'Low Stock' : 'Available')
        };

        newLogs.push({
          id: `ADJ-LOG-${Date.now()}-${adjustedCount + 1}`,
          itemId: item.itemId,
          itemName: item.name,
          type: 'Adjustment',
          quantityChange: item.difference,
          previousStock: prev,
          newStock: newStock,
          reason: `Approved audit adjustment (${audit.auditNumber} - ${item.reason || 'Reconciliation'})`,
          timestamp: new Date().toISOString(),
          actor: authorizedBy
        });

        addStockMovementRecord({
          ingredientId: item.itemId,
          ingredientName: item.name,
          movementType: 'Stock Adjustment',
          quantityIn: item.difference > 0 ? item.difference : 0,
          quantityOut: item.difference < 0 ? Math.abs(item.difference) : 0,
          remainingBalance: newStock,
          unit: item.unit,
          cost: Math.abs(item.varianceValue),
          referenceNumber: audit.auditNumber,
          user: authorizedBy,
          department: item.department,
          reason: `Approved audit reconciliation for ${audit.name}`
        });

        adjustedCount++;
      }
    }
  });

  if (adjustedCount > 0) {
    saveMenuItems(menuItems);
    saveIngredients(ingredients);
    saveStockLogs([...newLogs, ...currentLogs]);
  }

  return {
    success: true,
    adjustedCount,
    message: `Successfully synchronized ${adjustedCount} inventory item(s) to match approved audit counts.`
  };
}
