import React from 'react';
import { 
  DollarSign, TrendingUp, Sparkles, Scissors, Clock, Users, 
  Calendar, CheckCircle2, ArrowRight, ShieldCheck, UserCheck
} from 'lucide-react';
import { Order, MenuItem, Business, Shift, Expense } from '../../types';
import { TabType } from '../Navigation';
import { formatCurrency } from '../../lib/currency';

interface ServiceBusinessDashboardProps {
  business: Business;
  orders: Order[];
  menuItems: MenuItem[];
  expenses?: Expense[];
  currentShift?: Shift | null;
  setActiveTab: (tab: TabType) => void;
  darkMode: boolean;
}

export const ServiceBusinessDashboard: React.FC<ServiceBusinessDashboardProps> = ({
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

  // Service Breakdown
  const serviceSalesMap: Record<string, { count: number; revenue: number; category: string }> = {};
  todayOrders.forEach(o => {
    o.items.forEach(item => {
      if (!serviceSalesMap[item.name]) {
        serviceSalesMap[item.name] = { count: 0, revenue: 0, category: String(item.category || 'Service') };
      }
      serviceSalesMap[item.name].count += item.quantity;
      serviceSalesMap[item.name].revenue += item.totalPrice;
    });
  });

  const topServices = Object.entries(serviceSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const totalClientsServed = todayOrders.length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 border-purple-500/20 text-white' 
          : 'bg-gradient-to-r from-purple-50 via-white to-purple-50/50 border-purple-100 text-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">✨</span>
              <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Services & Appointments Dashboard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {business.name || 'Service Enterprise'}
            </h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Daily client sessions, service ticket invoicing, staff commission tracking, and customer loyalty.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('pos')}
              className="px-5 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer text-sm"
            >
              <Sparkles className="w-4 h-4" />
              New Service Ticket
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2.5 rounded-xl font-semibold border transition-all cursor-pointer text-sm flex items-center gap-2 ${
                darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-200' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Scissors className="w-4 h-4 text-purple-400" />
              Service Catalog
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Service Revenue */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Today's Service Takings
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
              From completed client services today
            </div>
          </div>
        </div>

        {/* Clients Served */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Clients Served Today
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400">
              {totalClientsServed}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Completed customer appointments
            </div>
          </div>
        </div>

        {/* Active Services */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Available Services
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">
              {menuItems.length}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Active service offerings on menu
            </div>
          </div>
        </div>

        {/* Shift Status */}
        <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Active Shift
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-extrabold text-emerald-400 truncate">
              {currentShift ? currentShift.cashierName : 'No Active Shift'}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {currentShift ? 'Register is open' : 'Start shift in Shift Manager'}
            </div>
          </div>
        </div>
      </div>

      {/* Top Services */}
      <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Top Requested Services Today
        </h2>

        {topServices.length === 0 ? (
          <div className={`py-12 text-center rounded-xl border border-dashed ${
            darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
          }`}>
            <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No service tickets recorded yet today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topServices.map((srv, idx) => (
              <div 
                key={srv.name}
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="text-sm font-bold">{srv.name}</div>
                    <div className="text-xs text-slate-400">{srv.category}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400">{formatCurrency(srv.revenue)}</div>
                  <div className="text-xs text-slate-400">{srv.count} sessions completed</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
