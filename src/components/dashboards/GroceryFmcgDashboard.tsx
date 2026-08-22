import React from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, Barcode, ShoppingCart, 
  Clock, Package, Calendar, CheckCircle2, ArrowRight, ShieldCheck
} from 'lucide-react';
import { Order, MenuItem, Business, Shift, Expense } from '../../types';
import { TabType } from '../Navigation';
import { formatCurrency } from '../../lib/currency';

interface GroceryFmcgDashboardProps {
  business: Business;
  orders: Order[];
  menuItems: MenuItem[];
  expenses?: Expense[];
  currentShift?: Shift | null;
  setActiveTab: (tab: TabType) => void;
  darkMode: boolean;
}

export const GroceryFmcgDashboard: React.FC<GroceryFmcgDashboardProps> = ({
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

  // Total valuation
  let totalStockValuation = 0;
  let totalUnits = 0;
  let lowStockProducts: { name: string; stock: number; min: number; category: string }[] = [];
  let nearExpiryProducts: { name: string; expiryDate: string; stock: number; category: string }[] = [];

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  menuItems.forEach(item => {
    totalUnits += item.stockQuantity;
    totalStockValuation += item.price * item.stockQuantity;

    if (item.stockQuantity <= (item.minStockAlert || 5)) {
      lowStockProducts.push({
        name: item.name,
        stock: item.stockQuantity,
        min: item.minStockAlert || 5,
        category: String(item.category)
      });
    }

    if (item.expiryDate && item.expiryDate <= thirtyDaysFromNow && item.stockQuantity > 0) {
      nearExpiryProducts.push({
        name: item.name,
        expiryDate: item.expiryDate,
        stock: item.stockQuantity,
        category: String(item.category)
      });
    }
  });

  // Fast moving items
  const itemMap: Record<string, { qty: number; revenue: number; category: string }> = {};
  todayOrders.forEach(o => {
    o.items.forEach(item => {
      if (!itemMap[item.name]) {
        itemMap[item.name] = { qty: 0, revenue: 0, category: String(item.category) };
      }
      itemMap[item.name].qty += item.quantity;
      itemMap[item.name].revenue += item.totalPrice;
    });
  });

  const fastMoving = Object.entries(itemMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border-emerald-500/20 text-white' 
          : 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 border-emerald-100 text-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏪</span>
              <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Supermarket, Grocery & Pharmacy Dashboard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {business.name || 'Supermarket & FMCG Store'}
            </h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              High-speed barcode scanning, fast SKU checkout, batch expiry alerts and inventory monitoring.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('pos')}
              className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              Barcode POS Checkout
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2.5 rounded-xl font-semibold border transition-all cursor-pointer text-sm flex items-center gap-2 ${
                darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-200' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Package className="w-4 h-4 text-emerald-400" />
              Manage Inventory
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Today's Gross Sales
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
              {todayOrders.length} cash register receipts
            </div>
          </div>
        </div>

        {/* Stock Valuation */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Shelf Stock Value
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">
              {formatCurrency(totalStockValuation)}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalUnits.toLocaleString()} units ({menuItems.length} products)
            </div>
          </div>
        </div>

        {/* Expiry Alerts */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Near Expiration (30d)
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              nearExpiryProducts.length > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-extrabold ${nearExpiryProducts.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {nearExpiryProducts.length}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {nearExpiryProducts.length > 0 ? 'Batches expiring within 30 days' : 'No near-expiry stock'}
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Low Stock Items
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              lowStockProducts.length > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-extrabold ${lowStockProducts.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {lowStockProducts.length}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {lowStockProducts.length > 0 ? 'Items below re-order trigger' : 'Sufficient stock on all shelves'}
            </div>
          </div>
        </div>
      </div>

      {/* Tables: Fast Moving & Expiry Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fast Moving Items */}
        <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Fastest Moving Products Today
          </h2>

          {fastMoving.length === 0 ? (
            <div className={`py-12 text-center rounded-xl border border-dashed ${
              darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
            }`}>
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No sales processed yet today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fastMoving.map((p, idx) => (
                <div 
                  key={p.name}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-sm font-bold">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-400">{formatCurrency(p.revenue)}</div>
                    <div className="text-xs text-slate-400">{p.qty} units sold</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiry Tracking */}
        <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-500" />
            Upcoming Expiry Dates
          </h2>

          {nearExpiryProducts.length === 0 ? (
            <div className={`py-12 text-center rounded-xl border border-dashed ${
              darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
            }`}>
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm">No products nearing expiration in the next 30 days.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {nearExpiryProducts.map((p, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-rose-50/50 border-rose-100'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">{p.name}</div>
                    <div className="text-[11px] text-rose-400">Expires: {p.expiryDate}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    {p.stock} in stock
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
