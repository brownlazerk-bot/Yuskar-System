import React from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, Users, Package, 
  Truck, ShieldAlert, FileText, CheckCircle2, ArrowRight,
  Boxes, Scale, Hammer, CreditCard
} from 'lucide-react';
import { Order, MenuItem, Business, Shift, Expense } from '../../types';
import { TabType } from '../Navigation';
import { formatCurrency } from '../../lib/currency';

interface TradeMaterialsDashboardProps {
  business: Business;
  orders: Order[];
  menuItems: MenuItem[];
  expenses?: Expense[];
  currentShift?: Shift | null;
  setActiveTab: (tab: TabType) => void;
  darkMode: boolean;
}

export const TradeMaterialsDashboard: React.FC<TradeMaterialsDashboardProps> = ({
  business,
  orders,
  menuItems,
  expenses = [],
  currentShift,
  setActiveTab,
  darkMode
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.createdAt.startsWith(todayStr) && o.status !== 'Cancelled');

  const todaySalesTotal = todayOrders.reduce((sum, o) => {
    if (o.amountPaid !== undefined) return sum + o.amountPaid;
    return o.status === 'Paid' ? sum + o.total : sum;
  }, 0);

  // Contractor & Customer Outstanding Debts / Credit
  const totalOutstandingCredit = orders
    .filter(o => o.paymentStatus === 'CREDIT' || o.paymentStatus === 'PARTIALLY PAID' || (o.balance && o.balance > 0))
    .reduce((sum, o) => sum + (o.balance || 0), 0);

  // Bulk Inventory Stock and Low Stock
  let totalStockValuation = 0;
  let lowStockMaterials: { name: string; stock: number; unit: string; min: number; category: string }[] = [];
  const unitSummary: Record<string, number> = {};

  menuItems.forEach(item => {
    totalStockValuation += (item.price || 0) * (item.stockQuantity || 0);
    const unit = item.unit || 'Piece';
    unitSummary[unit] = (unitSummary[unit] || 0) + item.stockQuantity;

    if (item.stockQuantity <= (item.minStockAlert || 10)) {
      lowStockMaterials.push({
        name: item.name,
        stock: item.stockQuantity,
        unit: item.unit || 'Unit',
        min: item.minStockAlert || 10,
        category: String(item.category)
      });
    }
  });

  // Top Volume Materials Sold Today
  const materialSalesMap: Record<string, { qty: number; revenue: number; unit: string; category: string }> = {};
  todayOrders.forEach(o => {
    o.items.forEach(item => {
      if (!materialSalesMap[item.name]) {
        materialSalesMap[item.name] = { 
          qty: 0, 
          revenue: 0, 
          unit: item.unit || 'Unit',
          category: String(item.category || 'General') 
        };
      }
      materialSalesMap[item.name].qty += item.quantity;
      materialSalesMap[item.name].revenue += item.totalPrice;
    });
  });

  const topMaterials = Object.entries(materialSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border-amber-500/20 text-white' 
          : 'bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border-amber-100 text-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🔨</span>
              <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Construction Materials & Hardware Dashboard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {business.name || 'Construction & Trade Store'}
            </h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Bulk volume sales, multi-unit stock (Tons, Bags, Meters), contractor credit ledgers and supplier restocks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('pos')}
              className="px-5 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 flex items-center gap-2 transition-all cursor-pointer text-sm"
            >
              <DollarSign className="w-4 h-4" />
              New Invoice / Dispatch
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2.5 rounded-xl font-semibold border transition-all cursor-pointer text-sm flex items-center gap-2 ${
                darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-200' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Boxes className="w-4 h-4 text-amber-400" />
              Material Inventory
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className={`p-5 rounded-2xl border transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Today's Dispatched Sales
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-500">
              {formatCurrency(todaySalesTotal)}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {todayOrders.length} customer invoices completed today
            </div>
          </div>
        </div>

        {/* Total Stock Valuation */}
        <div className={`p-5 rounded-2xl border transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Warehouse Inventory Value
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              {formatCurrency(totalStockValuation)}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {menuItems.length} active trade SKUs & materials
            </div>
          </div>
        </div>

        {/* Contractor Credit / Receivables */}
        <div className={`p-5 rounded-2xl border transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Contractor Debt & Credit
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-400">
              {formatCurrency(totalOutstandingCredit)}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Total outstanding balances owed by clients
            </div>
          </div>
        </div>

        {/* Re-order Warning */}
        <div className={`p-5 rounded-2xl border transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Reorder Alerts
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              lowStockMaterials.length > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-extrabold ${lowStockMaterials.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {lowStockMaterials.length}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {lowStockMaterials.length > 0 ? 'Materials below safety stock' : 'Adequate supply in warehouse'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Top Materials Sold & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Sold Materials */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold">Fastest Moving Materials Today</h2>
            </div>
            <button
              onClick={() => setActiveTab('order_center')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              All Invoices <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {topMaterials.length === 0 ? (
            <div className={`py-12 text-center rounded-xl border border-dashed ${
              darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
            }`}>
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No material dispatches recorded today yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topMaterials.map((m, idx) => (
                <div 
                  key={m.name}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{m.name}</div>
                      <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Category: {m.category}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-extrabold text-emerald-400">
                      {formatCurrency(m.revenue)}
                    </div>
                    <div className={`text-xs font-semibold ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                      {m.qty} {m.unit}s dispatched
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reorder Alerts */}
        <div className={`p-6 rounded-2xl border ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold">Safety Stock Alerts</h2>
            </div>
            <button
              onClick={() => setActiveTab('stock')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
            >
              Order Restock
            </button>
          </div>

          {lowStockMaterials.length === 0 ? (
            <div className={`py-12 text-center rounded-xl border border-dashed ${
              darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
            }`}>
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-medium">All material quantities are at safe levels.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {lowStockMaterials.slice(0, 8).map((mat, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-amber-50/50 border-amber-100'
                  }`}
                >
                  <div className="pr-2">
                    <div className="text-xs font-bold truncate max-w-[170px]">{mat.name}</div>
                    <div className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Min alert: {mat.min} {mat.unit}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {mat.stock} {mat.unit} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
