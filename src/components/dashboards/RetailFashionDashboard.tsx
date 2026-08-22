import React from 'react';
import { 
  TrendingUp, ShoppingBag, AlertTriangle, Layers, Users, 
  DollarSign, PackageCheck, Tag, BarChart3, Clock, ArrowRight,
  Sparkles, CheckCircle2, ShieldAlert, Boxes
} from 'lucide-react';
import { Order, MenuItem, Business, Shift, Expense } from '../../types';
import { TabType } from '../Navigation';
import { formatCurrency } from '../../lib/currency';

interface RetailFashionDashboardProps {
  business: Business;
  orders: Order[];
  menuItems: MenuItem[];
  expenses?: Expense[];
  currentShift?: Shift | null;
  setActiveTab: (tab: TabType) => void;
  darkMode: boolean;
}

export const RetailFashionDashboard: React.FC<RetailFashionDashboardProps> = ({
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

  const todayUnpaidCredit = todayOrders
    .filter(o => o.paymentStatus === 'CREDIT' || o.paymentStatus === 'PARTIALLY PAID')
    .reduce((sum, o) => sum + (o.balance || 0), 0);

  // Total Inventory Valuation (Cost & Retail)
  let totalStockUnits = 0;
  let totalInventoryCost = 0;
  let totalInventoryRetail = 0;
  let lowStockProducts: { name: string; stock: number; min: number; category: string; variantInfo?: string }[] = [];
  let variantCount = 0;

  menuItems.forEach(item => {
    if (item.hasVariants && item.variants && item.variants.length > 0) {
      item.variants.forEach(v => {
        variantCount++;
        totalStockUnits += v.stockQuantity;
        totalInventoryCost += (v.costPrice || item.costPrice || 0) * v.stockQuantity;
        totalInventoryRetail += (v.price || item.price) * v.stockQuantity;

        if (v.stockQuantity <= (v.minStockAlert || item.minStockAlert || 3)) {
          lowStockProducts.push({
            name: `${item.name} (${v.size || ''} ${v.color || ''})`.trim(),
            stock: v.stockQuantity,
            min: v.minStockAlert || item.minStockAlert || 3,
            category: String(item.category),
            variantInfo: `Size: ${v.size || 'N/A'}, Color: ${v.color || 'N/A'}`
          });
        }
      });
    } else {
      totalStockUnits += item.stockQuantity;
      totalInventoryCost += (item.costPrice || 0) * item.stockQuantity;
      totalInventoryRetail += item.price * item.stockQuantity;

      if (item.stockQuantity <= (item.minStockAlert || 5)) {
        lowStockProducts.push({
          name: item.name,
          stock: item.stockQuantity,
          min: item.minStockAlert || 5,
          category: String(item.category)
        });
      }
    }
  });

  // Top Selling Products & Categories
  const productSalesMap: Record<string, { qty: number; revenue: number; category: string }> = {};
  const categorySalesMap: Record<string, number> = {};

  todayOrders.forEach(o => {
    o.items.forEach(item => {
      if (!productSalesMap[item.name]) {
        productSalesMap[item.name] = { qty: 0, revenue: 0, category: String(item.category) };
      }
      productSalesMap[item.name].qty += item.quantity;
      productSalesMap[item.name].revenue += item.totalPrice;

      const cat = String(item.category || 'General');
      categorySalesMap[cat] = (categorySalesMap[cat] || 0) + item.totalPrice;
    });
  });

  const topProducts = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const topCategories = Object.entries(categorySalesMap)
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  const todayExpensesTotal = expenses
    .filter(e => e.date === todayStr)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const estimatedGrossProfit = todaySalesTotal - todayExpensesTotal;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-indigo-500/20 text-white' 
          : 'bg-gradient-to-r from-indigo-50 via-white to-indigo-50/50 border-indigo-100 text-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">👕</span>
              <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Fashion & Retail Store Dashboard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {business.name || 'Fashion Boutique'}
            </h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Real-time apparel inventory, size & color variants, today's sales and customer receivables.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('pos')}
              className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer text-sm"
            >
              <ShoppingBag className="w-4 h-4" />
              New Sale / POS
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2.5 rounded-xl font-semibold border transition-all cursor-pointer text-sm flex items-center gap-2 ${
                darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-200' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <PackageCheck className="w-4 h-4 text-indigo-400" />
              Manage Stock
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
              Today's Sales Revenue
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-500">
              {formatCurrency(todaySalesTotal)}
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>{todayOrders.length} completed transactions today</span>
            </div>
          </div>
        </div>

        {/* Stock Valuation */}
        <div className={`p-5 rounded-2xl border transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Total Stock Valuation
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">
              {formatCurrency(totalInventoryRetail)}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalStockUnits.toLocaleString()} units ({menuItems.length} products{variantCount > 0 ? `, ${variantCount} variants` : ''})
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className={`p-5 rounded-2xl border transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Low Stock Alerts
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              lowStockProducts.length > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-extrabold ${lowStockProducts.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {lowStockProducts.length}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {lowStockProducts.length > 0 ? 'Items below minimum threshold' : 'All sizes & items in healthy stock'}
            </div>
          </div>
        </div>

        {/* Customer Receivables / Credit */}
        <div className={`p-5 rounded-2xl border transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Customer Receivables
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-500">
              {formatCurrency(todayUnpaidCredit)}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Outstanding customer credit balance
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Top Sellers & Low Stock Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Products */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold">Top Selling Products Today</h2>
            </div>
            <button
              onClick={() => setActiveTab('order_center')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              View all sales <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {topProducts.length === 0 ? (
            <div className={`py-12 text-center rounded-xl border border-dashed ${
              darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
            }`}>
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No sales recorded yet today.</p>
              <button
                onClick={() => setActiveTab('pos')}
                className="mt-3 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white cursor-pointer hover:bg-indigo-500"
              >
                Create First Sale
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div 
                  key={p.name}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{p.name}</div>
                      <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Category: {p.category}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-extrabold text-emerald-400">
                      {formatCurrency(p.revenue)}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {p.qty} sold
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Category Performance Breakdown */}
          {topCategories.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Sales by Department / Category
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {topCategories.map(cat => (
                  <div 
                    key={cat.category}
                    className={`p-3 rounded-xl border ${
                      darkMode ? 'bg-slate-800/40 border-slate-700/40' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="text-xs text-slate-400 truncate">{cat.category}</div>
                    <div className="text-sm font-bold text-indigo-400 mt-1">
                      {formatCurrency(cat.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Low Stock & Variant Reorder Alerts */}
        <div className={`p-6 rounded-2xl border ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h2 className="text-base font-bold">Needs Reordering</h2>
            </div>
            <button
              onClick={() => setActiveTab('stock')}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
            >
              Restock
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className={`py-12 text-center rounded-xl border border-dashed ${
              darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
            }`}>
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-medium">All items have healthy inventory.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {lowStockProducts.slice(0, 8).map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-rose-50/50 border-rose-100'
                  }`}
                >
                  <div className="pr-2">
                    <div className="text-xs font-bold truncate max-w-[170px]">{item.name}</div>
                    {item.variantInfo && (
                      <div className="text-[11px] text-indigo-400">{item.variantInfo}</div>
                    )}
                    <div className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Alert threshold: {item.min}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {item.stock} left
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
