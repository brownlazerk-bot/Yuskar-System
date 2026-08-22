import React from 'react';
import { 
  LayoutDashboard, Receipt, ShoppingCart, UtensilsCrossed, ChefHat, 
  Waves, PackageCheck, ReceiptText, FileBarChart, Settings, Users, ShieldCheck,
  Package, Boxes, Utensils, BookOpen, MessageSquare, Bell, CheckSquare,
  UserCheck, Banknote, Briefcase, CreditCard, KeyRound, Globe, ClipboardCheck
} from 'lucide-react';
import { Business, UserRole } from '../types';
import { Language, getTranslation } from '../lib/translations';
import { isModuleEnabled, getBusinessTypeConfig } from '../lib/businessConfig';

export type TabType = 
  | 'dashboard' 
  | 'order_center'
  | 'accountant_control'
  | 'pos' 
  | 'tables' 
  | 'kitchen' 
  | 'ingredients'
  | 'recipe_management'
  | 'menu_management'
  | 'pool_sauna' 
  | 'stock' 
  | 'stock_audit'
  | 'shifts'
  | 'report' 
  | 'hr_payroll'
  | 'whatsapp_reports'
  | 'notifications'
  | 'approvals'
  | 'subscriptions'
  | 'saas_admin'
  | 'products_services'
  | 'users'
  | 'audit_logs'
  | 'settings';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingKitchenCount: number;
  unpaidOrdersCount?: number;
  lowStockCount: number;
  userRole: UserRole;
  business?: Business | null;
  darkMode: boolean;
  language?: Language;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  pendingKitchenCount,
  unpaidOrdersCount = 0,
  lowStockCount,
  userRole,
  business,
  darkMode,
  language = 'rw'
}) => {
  const isManagerOrAdmin = userRole === 'Manager' || userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Accountant';
  const isSuperAdmin = userRole === 'Super Admin';
  const t = getTranslation(language);
  const config = getBusinessTypeConfig(business);

  const isRetailOrTrade = config.dashboardArchetype === 'retail_fashion' || config.dashboardArchetype === 'trade_materials' || config.dashboardArchetype === 'grocery_fmcg';

  const navItems = [
    { id: 'dashboard' as TabType, moduleKey: 'dashboard' as const, label: t.dashboard, icon: LayoutDashboard },
    { 
      id: 'order_center' as TabType, 
      moduleKey: 'order_center' as const,
      label: isRetailOrTrade ? 'Sales & Invoices' : t.orderCenter, 
      icon: Receipt,
      badge: unpaidOrdersCount > 0 ? unpaidOrdersCount : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    { id: 'accountant_control' as TabType, moduleKey: 'accountant_control' as const, label: 'Accountant Control', icon: Briefcase, managerOnly: true },
    { id: 'pos' as TabType, moduleKey: 'pos' as const, label: isRetailOrTrade ? 'Cashier POS' : t.pos, icon: ShoppingCart },
    { id: 'tables' as TabType, moduleKey: 'tables' as const, label: t.tables, icon: UtensilsCrossed },
    { 
      id: 'kitchen' as TabType, 
      moduleKey: 'kitchen' as const,
      label: t.kitchen, 
      icon: ChefHat, 
      badge: pendingKitchenCount > 0 ? pendingKitchenCount : null,
      badgeColor: 'bg-rose-500 text-white'
    },
    { id: 'ingredients' as TabType, moduleKey: 'ingredients' as const, label: 'Ingredients', icon: Boxes },
    { id: 'recipe_management' as TabType, moduleKey: 'recipes' as const, label: 'Recipes', icon: Utensils },
    { id: 'menu_management' as TabType, moduleKey: 'menu' as const, label: isRetailOrTrade ? 'Catalog & Products' : 'Menu', icon: BookOpen },
    { id: 'pool_sauna' as TabType, moduleKey: 'pool_sauna' as const, label: t.poolSauna, icon: Waves },
    { 
      id: 'stock' as TabType, 
      moduleKey: 'inventory' as const,
      label: isRetailOrTrade ? 'Stock Inventory' : t.barStock, 
      icon: PackageCheck,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    { id: 'stock_audit' as TabType, moduleKey: 'stock_audit' as const, label: 'Stock Audit', icon: ClipboardCheck, managerOnly: true },
    { id: 'shifts' as TabType, moduleKey: 'shifts' as const, label: t.shifts, icon: ReceiptText },
    { id: 'report' as TabType, moduleKey: 'reports' as const, label: t.dailyReport, icon: FileBarChart },
    { id: 'hr_payroll' as TabType, moduleKey: 'hr_payroll' as const, label: 'HR & Payroll', icon: UserCheck, managerOnly: true },
    { id: 'whatsapp_reports' as TabType, moduleKey: 'whatsapp_reports' as const, label: 'WhatsApp Automation', icon: MessageSquare, managerOnly: true },
    { id: 'notifications' as TabType, moduleKey: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'approvals' as TabType, moduleKey: 'approvals' as const, label: 'Approvals Engine', icon: CheckSquare },
    { id: 'subscriptions' as TabType, moduleKey: 'subscriptions' as const, label: 'Payments & Subscription', icon: CreditCard, managerOnly: true },
    { id: 'products_services' as TabType, moduleKey: 'products' as const, label: t.productsServices, icon: Package, managerOnly: true },
    { id: 'users' as TabType, moduleKey: 'users' as const, label: t.userAdmin, icon: Users, managerOnly: true },
    { id: 'audit_logs' as TabType, moduleKey: 'audit_logs' as const, label: t.auditLogs, icon: ShieldCheck, managerOnly: true },
    { id: 'settings' as TabType, moduleKey: 'settings' as const, label: t.settings, icon: Settings, managerOnly: true },
  ];

  return (
    <nav className={`border-b sticky top-16 z-20 transition-colors ${
      darkMode 
        ? 'bg-slate-900/95 border-slate-800 text-slate-300 backdrop-blur-md' 
        : 'bg-slate-50/95 border-slate-200 text-slate-700 backdrop-blur-md'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar py-2">
          {navItems.map((item) => {
            if (item.managerOnly && !isManagerOrAdmin) return null;
            if (item.moduleKey && !isModuleEnabled(business, item.moduleKey)) return null;
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                    : darkMode
                      ? 'hover:bg-slate-800 text-slate-300'
                      : 'hover:bg-slate-200/60 text-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

