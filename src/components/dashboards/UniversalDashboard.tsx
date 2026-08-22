import React from 'react';
import { Business, Order, Table, KitchenTicket, MenuItem, Shift, Expense } from '../../types';
import { TabType } from '../Navigation';
import { getBusinessTypeConfig } from '../../lib/businessConfig';
import { Dashboard as HospitalityDashboard } from '../Dashboard';
import { RetailFashionDashboard } from './RetailFashionDashboard';
import { TradeMaterialsDashboard } from './TradeMaterialsDashboard';
import { GroceryFmcgDashboard } from './GroceryFmcgDashboard';
import { FnBCafeDashboard } from './FnBCafeDashboard';
import { ServiceBusinessDashboard } from './ServiceBusinessDashboard';
import { Language } from '../../lib/translations';

interface UniversalDashboardProps {
  business: Business;
  orders: Order[];
  tables: Table[];
  kitchenTickets: KitchenTicket[];
  menuItems: MenuItem[];
  expenses?: Expense[];
  currentShift?: Shift | null;
  setActiveTab: (tab: TabType) => void;
  darkMode: boolean;
  language?: Language;
}

export const UniversalDashboard: React.FC<UniversalDashboardProps> = ({
  business,
  orders,
  tables,
  kitchenTickets,
  menuItems,
  expenses = [],
  currentShift,
  setActiveTab,
  darkMode,
  language = 'rw'
}) => {
  const config = getBusinessTypeConfig(business);

  switch (config.dashboardArchetype) {
    case 'retail_fashion':
      return (
        <RetailFashionDashboard
          business={business}
          orders={orders}
          menuItems={menuItems}
          expenses={expenses}
          currentShift={currentShift}
          setActiveTab={setActiveTab}
          darkMode={darkMode}
        />
      );

    case 'trade_materials':
      return (
        <TradeMaterialsDashboard
          business={business}
          orders={orders}
          menuItems={menuItems}
          expenses={expenses}
          currentShift={currentShift}
          setActiveTab={setActiveTab}
          darkMode={darkMode}
        />
      );

    case 'grocery_fmcg':
      return (
        <GroceryFmcgDashboard
          business={business}
          orders={orders}
          menuItems={menuItems}
          expenses={expenses}
          currentShift={currentShift}
          setActiveTab={setActiveTab}
          darkMode={darkMode}
        />
      );

    case 'fnb_cafe':
      return (
        <FnBCafeDashboard
          business={business}
          orders={orders}
          tables={tables}
          kitchenTickets={kitchenTickets}
          menuItems={menuItems}
          currentShift={currentShift}
          setActiveTab={setActiveTab}
          darkMode={darkMode}
        />
      );

    case 'services':
      return (
        <ServiceBusinessDashboard
          business={business}
          orders={orders}
          menuItems={menuItems}
          expenses={expenses}
          currentShift={currentShift}
          setActiveTab={setActiveTab}
          darkMode={darkMode}
        />
      );

    case 'hospitality':
    case 'general':
    default:
      // Default to the full hotel/hospitality dashboard
      return (
        <HospitalityDashboard
          orders={orders}
          tables={tables}
          kitchenTickets={kitchenTickets}
          menuItems={menuItems}
          currentShift={currentShift}
          setActiveTab={setActiveTab}
          darkMode={darkMode}
          language={language}
        />
      );
  }
};
