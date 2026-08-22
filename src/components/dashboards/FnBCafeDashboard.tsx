import React from 'react';
import { 
  DollarSign, Utensils, ChefHat, Coffee, Wine, TrendingUp, 
  AlertTriangle, Clock, Users, ArrowRight, CheckCircle2
} from 'lucide-react';
import { Order, Table, KitchenTicket, MenuItem, Shift, Business } from '../../types';
import { TabType } from '../Navigation';
import { formatCurrency } from '../../lib/currency';

interface FnBCafeDashboardProps {
  business: Business;
  orders: Order[];
  tables: Table[];
  kitchenTickets: KitchenTicket[];
  menuItems: MenuItem[];
  currentShift?: Shift | null;
  setActiveTab: (tab: TabType) => void;
  darkMode: boolean;
}

export const FnBCafeDashboard: React.FC<FnBCafeDashboardProps> = ({
  business,
  orders,
  tables,
  kitchenTickets,
  menuItems,
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

  const occupiedTables = tables.filter(t => t.status === 'Occupied').length;
  const availableTables = tables.filter(t => t.status === 'Available').length;

  const pendingKitchen = kitchenTickets.filter(k => k.status === 'Pending' || k.status === 'Preparing').length;
  const readyKitchen = kitchenTickets.filter(k => k.status === 'Ready').length;

  const lowStock = menuItems.filter(m => m.stockQuantity <= (m.minStockAlert || 5) && m.status === 'Available');

  // Top Food & Beverage
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

  const topItems = Object.entries(itemMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border-amber-500/20 text-white' 
          : 'bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border-amber-100 text-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">☕</span>
              <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Restaurant, Coffee Shop & Bar Operations
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {business.name || 'Restaurant & Cafe'}
            </h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Table orders, kitchen KOT queue, ingredient consumption, and barista/bar sales.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('pos')}
              className="px-5 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 flex items-center gap-2 transition-all cursor-pointer text-sm"
            >
              <Utensils className="w-4 h-4" />
              New Table Order
            </button>
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`px-4 py-2.5 rounded-xl font-semibold border transition-all cursor-pointer text-sm flex items-center gap-2 ${
                darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-200' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <ChefHat className="w-4 h-4 text-amber-400" />
              Kitchen Tickets ({pendingKitchen})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Today's F&B Takings
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
              {todayOrders.length} dining bills served today
            </div>
          </div>
        </div>

        {/* Active Tables */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Table Occupancy
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              {occupiedTables} / {tables.length || 0}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {availableTables} tables currently free
            </div>
          </div>
        </div>

        {/* Kitchen KOT Prep Queue */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Kitchen KOT Orders
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">
              {pendingKitchen}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {readyKitchen} orders ready for dispatch
            </div>
          </div>
        </div>

        {/* Low Stock Bar & Kitchen */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Low Stock Warnings
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              lowStock.length > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-extrabold ${lowStock.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {lowStock.length}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Items needing replenishment
            </div>
          </div>
        </div>
      </div>

      {/* Top Menu Items */}
      <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          Top Selling Dishes & Beverages Today
        </h2>

        {topItems.length === 0 ? (
          <div className={`py-12 text-center rounded-xl border border-dashed ${
            darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
          }`}>
            <Utensils className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No orders recorded yet today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topItems.map((item, idx) => (
              <div 
                key={item.name}
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="text-sm font-bold">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.category}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400">{formatCurrency(item.revenue)}</div>
                  <div className="text-xs text-slate-400">{item.qty} servings ordered</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
