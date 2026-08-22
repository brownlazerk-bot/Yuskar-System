import { BusinessType, BusinessModuleKey, Business, UserRole } from '../types';

export interface BusinessTypeDefinition {
  type: BusinessType;
  label: string;
  category: 'Hospitality' | 'Food & Beverage' | 'Retail & Fashion' | 'Trade & Construction' | 'Services & Auto' | 'Health & Beauty' | 'General';
  description: string;
  icon: string; // Emoji / Icon descriptor
  dashboardArchetype: 'hospitality' | 'retail_fashion' | 'fnb_cafe' | 'trade_materials' | 'grocery_fmcg' | 'services' | 'general';
  defaultEnabledModules: BusinessModuleKey[];
  optionalModules: BusinessModuleKey[];
  defaultCategories: string[];
  defaultUnits: string[];
  features: {
    hasVariants?: boolean;
    hasBarcode?: boolean;
    hasExpiryDates?: boolean;
    hasTables?: boolean;
    hasKitchen?: boolean;
    hasRooms?: boolean;
    hasPoolSauna?: boolean;
    hasRecipes?: boolean;
    hasIngredients?: boolean;
    hasCreditTracking?: boolean;
    hasSupplierPurchases?: boolean;
  };
}

export const ALL_BUSINESS_TYPES: BusinessTypeDefinition[] = [
  {
    type: 'HOTEL',
    label: 'Hotel & Resort',
    category: 'Hospitality',
    description: 'Rooms, front desk, housekeeping, restaurant, bar, pool, sauna, and comprehensive multi-department operations.',
    icon: '🏨',
    dashboardArchetype: 'hospitality',
    defaultEnabledModules: [
      'dashboard', 'pos', 'order_center', 'tables', 'kitchen', 'ingredients', 'recipes', 'menu',
      'rooms_hotel', 'pool_sauna', 'inventory', 'stock_audit', 'shifts', 'expenses', 'purchases',
      'accountant_control', 'reports', 'hr_payroll', 'whatsapp_reports', 'notifications', 'approvals',
      'subscriptions', 'users', 'audit_logs', 'settings'
    ],
    optionalModules: ['barcode', 'product_variants', 'customers', 'suppliers'],
    defaultCategories: ['Beers', 'Soft Drinks', 'Wines', 'Whisky', 'Cocktails', 'Juices', 'Water', 'Coffee', 'Tea', 'Food', 'Room Services', 'Apartment Services', 'Pool Services', 'Sauna Services', 'Other Services'],
    defaultUnits: ['Bottle', 'Glass', 'Portion', 'Serving', 'Cup', 'Shot', 'Pass', 'Hour', 'Day', 'Service'],
    features: {
      hasRooms: true,
      hasPoolSauna: true,
      hasTables: true,
      hasKitchen: true,
      hasRecipes: true,
      hasIngredients: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'GUEST_HOUSE',
    label: 'Guest House & B&B',
    category: 'Hospitality',
    description: 'Accommodation management, breakfast service, room cleaning, reservations, and guest invoicing.',
    icon: '🏡',
    dashboardArchetype: 'hospitality',
    defaultEnabledModules: [
      'dashboard', 'pos', 'order_center', 'menu', 'rooms_hotel', 'inventory', 'stock_audit',
      'shifts', 'expenses', 'purchases', 'accountant_control', 'reports', 'hr_payroll',
      'notifications', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['tables', 'kitchen', 'ingredients', 'recipes', 'pool_sauna', 'whatsapp_reports'],
    defaultCategories: ['Room Services', 'Breakfast', 'Drinks', 'Laundry Services', 'Snacks', 'Beverages'],
    defaultUnits: ['Day', 'Night', 'Hour', 'Piece', 'Bottle', 'Serving'],
    features: {
      hasRooms: true,
      hasTables: false,
      hasKitchen: true,
      hasCreditTracking: true,
      hasSupplierPurchases: true
    }
  },
  {
    type: 'LODGE',
    label: 'Safari Lodge & Camp',
    category: 'Hospitality',
    description: 'Boutique eco-lodging, tour packages, restaurant, bar, curated dining, and inventory management.',
    icon: '🏕️',
    dashboardArchetype: 'hospitality',
    defaultEnabledModules: [
      'dashboard', 'pos', 'order_center', 'tables', 'kitchen', 'menu', 'rooms_hotel', 'inventory',
      'stock_audit', 'shifts', 'expenses', 'purchases', 'reports', 'hr_payroll', 'notifications', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['pool_sauna', 'ingredients', 'recipes', 'whatsapp_reports', 'approvals'],
    defaultCategories: ['Cottages', 'Buffet & Dining', 'Bar & Spirits', 'Safari Tours', 'Beverages', 'Activities'],
    defaultUnits: ['Night', 'Pax', 'Bottle', 'Glass', 'Portion', 'Trip'],
    features: {
      hasRooms: true,
      hasTables: true,
      hasKitchen: true,
      hasSupplierPurchases: true
    }
  },
  {
    type: 'RESTAURANT',
    label: 'Restaurant & Dining',
    category: 'Food & Beverage',
    description: 'Table dining, kitchen order tickets (KOT), recipe costing, inventory control, and staff shifts.',
    icon: '🍽️',
    dashboardArchetype: 'fnb_cafe',
    defaultEnabledModules: [
      'dashboard', 'pos', 'order_center', 'tables', 'kitchen', 'ingredients', 'recipes', 'menu',
      'inventory', 'stock_audit', 'shifts', 'expenses', 'purchases', 'accountant_control',
      'reports', 'hr_payroll', 'whatsapp_reports', 'notifications', 'approvals', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['barcode', 'customers', 'suppliers'],
    defaultCategories: ['Main Dishes', 'Starters', 'Fast Food', 'Breakfast', 'Desserts', 'Beers', 'Wines', 'Soft Drinks', 'Hot Drinks', 'Mocktails'],
    defaultUnits: ['Portion', 'Plate', 'Piece', 'Serving', 'Bottle', 'Glass', 'Kg', 'Gram', 'Litre'],
    features: {
      hasTables: true,
      hasKitchen: true,
      hasRecipes: true,
      hasIngredients: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'COFFEE_SHOP',
    label: 'Coffee Shop & Cafe',
    category: 'Food & Beverage',
    description: 'Specialty espresso, barista orders, pastry inventory, ingredient deduction, and quick POS.',
    icon: '☕',
    dashboardArchetype: 'fnb_cafe',
    defaultEnabledModules: [
      'dashboard', 'pos', 'order_center', 'tables', 'menu', 'ingredients', 'recipes', 'inventory',
      'stock_audit', 'shifts', 'expenses', 'purchases', 'reports', 'hr_payroll', 'notifications', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['kitchen', 'barcode', 'customers', 'suppliers', 'whatsapp_reports'],
    defaultCategories: ['Hot Coffee', 'Iced Coffee', 'Specialty Teas', 'Pastries & Bakery', 'Sandwiches', 'Smoothies & Juices', 'Snacks', 'Packaged Beans'],
    defaultUnits: ['Cup', 'Piece', 'Serving', 'Pack', 'Bottle', 'Gram', 'Litre', 'Kg'],
    features: {
      hasTables: true,
      hasKitchen: false,
      hasRecipes: true,
      hasIngredients: true,
      hasSupplierPurchases: true
    }
  },
  {
    type: 'BAR',
    label: 'Bar, Pub & Lounge',
    category: 'Food & Beverage',
    description: 'High-speed drink dispensing, bottle stock, cocktail recipes, cashier daily closing, and waiter orders.',
    icon: '🍺',
    dashboardArchetype: 'fnb_cafe',
    defaultEnabledModules: [
      'dashboard', 'pos', 'order_center', 'tables', 'menu', 'inventory', 'stock_audit',
      'shifts', 'expenses', 'purchases', 'accountant_control', 'reports', 'hr_payroll', 'notifications', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['kitchen', 'ingredients', 'recipes', 'whatsapp_reports', 'approvals'],
    defaultCategories: ['Beers & Ciders', 'Wines & Champagne', 'Whisky & Scotch', 'Vodka & Gin', 'Liqueurs & Shots', 'Cocktails', 'Soft Drinks', 'Energy Drinks', 'Bar Bites'],
    defaultUnits: ['Bottle', 'Glass', 'Shot', 'Can', 'Pitcher', 'Bucket', 'Serving'],
    features: {
      hasTables: true,
      hasKitchen: false,
      hasIngredients: false,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'CLOTHING_SHOP',
    label: 'Clothing Boutique & Fashion',
    category: 'Retail & Fashion',
    description: 'Multi-variant apparel management (Sizes S-XXL, Colors, Styles), barcode scanning, customer accounts, and stock valuation.',
    icon: '👕',
    dashboardArchetype: 'retail_fashion',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'product_variants', 'inventory', 'barcode', 'customers',
      'suppliers', 'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['hr_payroll', 'notifications', 'approvals', 'whatsapp_reports'],
    defaultCategories: ["Men's Wear", "Women's Wear", "Children & Kids", "Dresses & Gowns", "Shirts & Tops", "Jeans & Trousers", "Jackets & Coats", "Accessories & Belts", "Underwear & Socks"],
    defaultUnits: ['Piece', 'Pair', 'Set', 'Pack', 'Dozen', 'Box'],
    features: {
      hasVariants: true,
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'SHOE_SHOP',
    label: 'Shoe & Footwear Store',
    category: 'Retail & Fashion',
    description: 'Size-based inventory (EU/US sizing), brands, material variants, box inventory, and retail sales.',
    icon: '👟',
    dashboardArchetype: 'retail_fashion',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'product_variants', 'inventory', 'barcode', 'customers',
      'suppliers', 'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['hr_payroll', 'notifications', 'approvals'],
    defaultCategories: ["Men's Formal Shoes", "Men's Sneakers", "Women's Heels", "Women's Flats", "Sports & Running", "Boots", "Sandals & Slippers", "Kids Shoes", "Shoe Care & Laces"],
    defaultUnits: ['Pair', 'Box', 'Piece', 'Set'],
    features: {
      hasVariants: true,
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'ELECTRONICS_SHOP',
    label: 'Electronics & Gadgets',
    category: 'Retail & Fashion',
    description: 'Serial numbers, warranty tracking, barcode lookup, accessory inventory, and installment / credit sales.',
    icon: '📱',
    dashboardArchetype: 'retail_fashion',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'customers', 'suppliers',
      'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['product_variants', 'hr_payroll', 'notifications', 'approvals'],
    defaultCategories: ['Smartphones', 'Laptops & Computers', 'Audio & Speakers', 'TVs & Screens', 'Cables & Chargers', 'Phone Cases & Covers', 'Power Banks', 'Home Appliances', 'Storage & Flash Drives'],
    defaultUnits: ['Piece', 'Set', 'Box', 'Pack'],
    features: {
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'SUPERMARKET',
    label: 'Supermarket & Mart',
    category: 'Retail & Fashion',
    description: 'High-speed barcode checkout, thousands of SKUs, batch expiry monitoring, and bulk supplier replenishment.',
    icon: '🛒',
    dashboardArchetype: 'grocery_fmcg',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'suppliers', 'purchases',
      'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['customers', 'hr_payroll', 'notifications', 'approvals', 'whatsapp_reports'],
    defaultCategories: ['Dairy & Eggs', 'Bakery & Bread', 'Fresh Produce & Fruits', 'Beverages & Juices', 'Snacks & Sweets', 'Canned & Dry Foods', 'Personal Care', 'Cleaning & Household', 'Frozen Foods', 'Baby Products'],
    defaultUnits: ['Piece', 'Pack', 'Box', 'Carton', 'Kg', 'Gram', 'Litre', 'Bottle', 'Can', 'Dozen'],
    features: {
      hasBarcode: true,
      hasExpiryDates: true,
      hasSupplierPurchases: true
    }
  },
  {
    type: 'ALIMENTATION_GROCERY',
    label: 'Alimentation & Grocery Store',
    category: 'Retail & Fashion',
    description: 'Neighborhood grocery, food staples, perishables, barcode scanning, fast retail POS, and supplier restocks.',
    icon: '🏪',
    dashboardArchetype: 'grocery_fmcg',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'suppliers', 'purchases',
      'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['customers', 'hr_payroll', 'notifications'],
    defaultCategories: ['Rice, Flour & Grains', 'Cooking Oil & Spices', 'Milk & Dairy', 'Bread & Bakery', 'Sugar, Tea & Coffee', 'Soaps & Detergents', 'Drinks & Water', 'Eggs & Fresh Items', 'Canned Goods'],
    defaultUnits: ['Piece', 'Kg', 'Gram', 'Litre', 'Bottle', 'Pack', 'Box', 'Carton', 'Bag'],
    features: {
      hasBarcode: true,
      hasExpiryDates: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'GENERAL_SHOP',
    label: 'General Retail Shop',
    category: 'Retail & Fashion',
    description: 'All-in-one general merchandise store, varied goods, fast customer invoicing, and local credit ledgers.',
    icon: '🏬',
    dashboardArchetype: 'general',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'customers', 'suppliers',
      'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['product_variants', 'hr_payroll', 'notifications'],
    defaultCategories: ['Household Goods', 'Stationery & Books', 'Toiletries', 'Packaged Foods', 'Hardware & Tools', 'Beverages', 'Clothing Basics', 'Electronics Accessories'],
    defaultUnits: ['Piece', 'Pack', 'Box', 'Dozen', 'Kg', 'Litre', 'Pair'],
    features: {
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'CONSTRUCTION_MATERIALS_SHOP',
    label: 'Construction Materials Store',
    category: 'Trade & Construction',
    description: 'Heavy materials (Cement, Iron bars, Sand, Gravel, Timber), multi-unit sales (Tons, Bags, Meters, Pieces), contractor credit & debt tracking.',
    icon: '🔨',
    dashboardArchetype: 'trade_materials',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'customers', 'suppliers', 'purchases',
      'expenses', 'reports', 'shifts', 'stock_audit', 'accountant_control', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['barcode', 'hr_payroll', 'notifications', 'approvals'],
    defaultCategories: ['Cement & Aggregates', 'Steel, Iron Bars & Wire', 'Roofing Sheets & Nails', 'Plumbing & PVC Pipes', 'Electrical & Wiring', 'Paints & Finishes', 'Timber & Boards', 'Masonry & Blocks', 'Tiles & Ceramics', 'Hardware & Fasteners'],
    defaultUnits: ['Bag', 'Piece', 'Meter', 'Kg', 'Ton', 'Roll', 'Sheet', 'Trip', 'Bucket', 'Bundle', 'Box'],
    features: {
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'HARDWARE_SHOP',
    label: 'Hardware & Tools Store',
    category: 'Trade & Construction',
    description: 'Power tools, plumbing fittings, electrical components, fasteners, paint, and trade supplies.',
    icon: '🔩',
    dashboardArchetype: 'trade_materials',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'customers', 'suppliers',
      'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['hr_payroll', 'notifications', 'approvals'],
    defaultCategories: ['Hand Tools', 'Power Tools & Bits', 'Fasteners, Screws & Bolts', 'Plumbing Fittings', 'Electrical Switches & Cables', 'Paints, Brushes & Rollers', 'Safety & Protective Gear', 'Adhesives & Sealants', 'Locks & Security'],
    defaultUnits: ['Piece', 'Set', 'Box', 'Pack', 'Meter', 'Roll', 'Kg', 'Litre', 'Dozen'],
    features: {
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'PHARMACY',
    label: 'Pharmacy & Drugstore',
    category: 'Health & Beauty',
    description: 'Prescription medicines, OTC products, dosage units, batch and expiration tracking, and supplier receipts.',
    icon: '💊',
    dashboardArchetype: 'grocery_fmcg',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'customers', 'suppliers',
      'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['hr_payroll', 'notifications', 'approvals'],
    defaultCategories: ['Antibiotics & Prescriptions', 'Pain Relief & Fever', 'Cold, Flu & Cough', 'Vitamins & Supplements', 'First Aid & Bandages', 'Baby Care', 'Skin Care & Dermatology', 'Medical Equipment & Tests', 'Hygiene & Sanitizers'],
    defaultUnits: ['Box', 'Pack', 'Bottle', 'Strip', 'Tablet', 'Piece', 'Tube', 'Vial'],
    features: {
      hasBarcode: true,
      hasExpiryDates: true,
      hasSupplierPurchases: true
    }
  },
  {
    type: 'BEAUTY_COSMETICS',
    label: 'Beauty, Cosmetics & Perfume',
    category: 'Health & Beauty',
    description: 'Skincare, luxury fragrances, makeup shades, hair care, variant shades/sizes, and customer loyalty.',
    icon: '💄',
    dashboardArchetype: 'retail_fashion',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'product_variants', 'inventory', 'barcode', 'customers',
      'suppliers', 'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['hr_payroll', 'notifications'],
    defaultCategories: ['Perfumes & Fragrances', 'Makeup & Face', 'Lipsticks & Lip Care', 'Skincare & Lotions', 'Hair Care & Extensions', 'Nail Polish & Care', 'Beauty Tools & Brushes', 'Soaps & Bath'],
    defaultUnits: ['Piece', 'Bottle', 'Box', 'Set', 'Pack', 'Tube', 'Jar'],
    features: {
      hasVariants: true,
      hasBarcode: true,
      hasSupplierPurchases: true
    }
  },
  {
    type: 'SALON_BARBERSHOP',
    label: 'Salon, Barbershop & Spa',
    category: 'Services & Auto',
    description: 'Hairdressing, grooming services, appointments, product usage, stylist commissions, and retail sales.',
    icon: '💇',
    dashboardArchetype: 'services',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'customers', 'expenses',
      'reports', 'shifts', 'hr_payroll', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['suppliers', 'purchases', 'notifications'],
    defaultCategories: ['Haircut & Grooming', 'Beard Styling', 'Hair Coloring & Braiding', 'Facials & Skin Treatment', 'Manicure & Pedicure', 'Massage & Spa', 'Hair Care Products (Retail)'],
    defaultUnits: ['Service', 'Session', 'Hour', 'Piece', 'Bottle'],
    features: {
      hasSupplierPurchases: true
    }
  },
  {
    type: 'LAUNDRY',
    label: 'Laundry & Dry Cleaning',
    category: 'Services & Auto',
    description: 'Garment intake, washing/dry cleaning status tracking, pick-up notifications, and weight/item billing.',
    icon: '🧺',
    dashboardArchetype: 'services',
    defaultEnabledModules: [
      'dashboard', 'pos', 'order_center', 'products', 'inventory', 'customers',
      'expenses', 'reports', 'shifts', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['suppliers', 'purchases', 'notifications', 'hr_payroll'],
    defaultCategories: ['Shirts & Blouses', 'Suits & Blazers', 'Trousers & Jeans', 'Dresses & Gowns', 'Bedding & Blankets', 'Curtains & Drapes', 'Bulk Wash (Kg)', 'Ironing Only'],
    defaultUnits: ['Piece', 'Pair', 'Kg', 'Set', 'Item'],
    features: {
      hasSupplierPurchases: true
    }
  },
  {
    type: 'CAR_RENTAL',
    label: 'Car Rental & Fleet',
    category: 'Services & Auto',
    description: 'Fleet bookings, vehicle maintenance records, daily/weekly rental rates, fuel logs, and customer agreements.',
    icon: '🚗',
    dashboardArchetype: 'services',
    defaultEnabledModules: [
      'dashboard', 'pos', 'order_center', 'products', 'customers', 'expenses',
      'reports', 'shifts', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['suppliers', 'purchases', 'notifications', 'hr_payroll'],
    defaultCategories: ['Sedan Cars', 'SUVs & 4x4', 'Vans & Minibuses', 'Luxury Vehicles', 'Chauffeur Services', 'Airport Transfers', 'Self-Drive Rentals'],
    defaultUnits: ['Day', 'Week', 'Month', 'Hour', 'Trip', 'Km'],
    features: {
      hasCreditTracking: true
    }
  },
  {
    type: 'GARAGE_AUTO',
    label: 'Auto Garage & Spare Parts',
    category: 'Services & Auto',
    description: 'Vehicle repair job cards, auto spare parts inventory, mechanics labor billing, and parts procurement.',
    icon: '🔧',
    dashboardArchetype: 'trade_materials',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'customers', 'suppliers',
      'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['hr_payroll', 'notifications', 'approvals'],
    defaultCategories: ['Engine Oil & Fluids', 'Brake Pads & Discs', 'Filters (Oil, Air, Fuel)', 'Batteries & Electrical', 'Tires & Wheels', 'Suspension & Steering', 'Mechanical Labor & Repair', 'Diagnostic Inspection'],
    defaultUnits: ['Piece', 'Set', 'Litre', 'Hour', 'Pair', 'Job', 'Service'],
    features: {
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'WHOLESALE',
    label: 'Wholesale & Distribution',
    category: 'General',
    description: 'Bulk carton & pallet sales, multi-tier pricing, trade customer credit, delivery notes, and supplier replenishment.',
    icon: '📦',
    dashboardArchetype: 'trade_materials',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'customers', 'suppliers',
      'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'accountant_control', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['product_variants', 'hr_payroll', 'notifications', 'approvals'],
    defaultCategories: ['Fast Moving Consumer Goods', 'Beverages & Cartons', 'Dry Food Staples', 'Household Bulk Items', 'Hygiene & Paper Goods', 'Packaging Materials'],
    defaultUnits: ['Carton', 'Box', 'Pallet', 'Bag', 'Ton', 'Dozen', 'Pack', 'Kg'],
    features: {
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'RETAIL',
    label: 'Retail Store',
    category: 'General',
    description: 'Versatile retail Point-of-Sale, product catalog, customer management, inventory alerts, and shift accounting.',
    icon: '🛍️',
    dashboardArchetype: 'general',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'barcode', 'customers', 'suppliers',
      'purchases', 'expenses', 'reports', 'shifts', 'stock_audit', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: ['product_variants', 'hr_payroll', 'notifications', 'approvals'],
    defaultCategories: ['Popular Items', 'Electronics', 'Clothing', 'Home Essentials', 'Stationery', 'Beverages', 'Accessories'],
    defaultUnits: ['Piece', 'Pack', 'Box', 'Set', 'Pair', 'Dozen', 'Kg'],
    features: {
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  },
  {
    type: 'OTHER',
    label: 'Custom Business Enterprise',
    category: 'General',
    description: 'Fully customizable enterprise management with modular capability toggles tailored to your unique workflow.',
    icon: '🏢',
    dashboardArchetype: 'general',
    defaultEnabledModules: [
      'dashboard', 'pos', 'products', 'inventory', 'customers', 'suppliers',
      'purchases', 'expenses', 'reports', 'shifts', 'subscriptions', 'users', 'settings'
    ],
    optionalModules: [
      'barcode', 'product_variants', 'order_center', 'tables', 'kitchen', 'ingredients',
      'recipes', 'menu', 'rooms_hotel', 'pool_sauna', 'accountant_control', 'hr_payroll',
      'whatsapp_reports', 'notifications', 'approvals', 'audit_logs'
    ],
    defaultCategories: ['General Products', 'Custom Services', 'Merchandise', 'Supplies', 'Consulting & Labor'],
    defaultUnits: ['Piece', 'Unit', 'Hour', 'Service', 'Box', 'Kg', 'Pack'],
    features: {
      hasBarcode: true,
      hasSupplierPurchases: true,
      hasCreditTracking: true
    }
  }
];

// Helper: Resolve Business Type from string or fallback to HOTEL
export function resolveBusinessType(rawType?: string | null): BusinessType {
  if (!rawType) return 'HOTEL';
  const clean = rawType.trim().toUpperCase().replace(/[\s\/-]+/g, '_');
  
  const found = ALL_BUSINESS_TYPES.find(b => b.type === clean);
  if (found) return found.type;

  // Partial match checks
  if (clean.includes('HOTEL') || clean.includes('RESORT')) return 'HOTEL';
  if (clean.includes('RESTAURANT') || clean.includes('DINING')) return 'RESTAURANT';
  if (clean.includes('COFFEE') || clean.includes('CAFE')) return 'COFFEE_SHOP';
  if (clean.includes('BAR') || clean.includes('PUB') || clean.includes('LOUNGE')) return 'BAR';
  if (clean.includes('GUEST')) return 'GUEST_HOUSE';
  if (clean.includes('LODGE')) return 'LODGE';
  if (clean.includes('SUPERMARKET')) return 'SUPERMARKET';
  if (clean.includes('CLOTH') || clean.includes('FASHION') || clean.includes('BOUTIQUE')) return 'CLOTHING_SHOP';
  if (clean.includes('SHOE') || clean.includes('FOOTWEAR')) return 'SHOE_SHOP';
  if (clean.includes('ELECTRONIC')) return 'ELECTRONICS_SHOP';
  if (clean.includes('CONSTRUCT') || clean.includes('CEMENT') || clean.includes('BUILD')) return 'CONSTRUCTION_MATERIALS_SHOP';
  if (clean.includes('HARDWARE')) return 'HARDWARE_SHOP';
  if (clean.includes('ALIMENTATION') || clean.includes('GROCERY')) return 'ALIMENTATION_GROCERY';
  if (clean.includes('PHARM') || clean.includes('DRUG')) return 'PHARMACY';
  if (clean.includes('BEAUTY') || clean.includes('COSMETIC')) return 'BEAUTY_COSMETICS';
  if (clean.includes('SALON') || clean.includes('BARBER')) return 'SALON_BARBERSHOP';
  if (clean.includes('LAUNDRY')) return 'LAUNDRY';
  if (clean.includes('RENTAL') || clean.includes('CAR_RENT')) return 'CAR_RENTAL';
  if (clean.includes('GARAGE') || clean.includes('AUTO')) return 'GARAGE_AUTO';
  if (clean.includes('WHOLESALE')) return 'WHOLESALE';
  if (clean.includes('RETAIL') || clean.includes('SHOP')) return 'RETAIL';

  return 'OTHER';
}

// Helper: Get Config definition for a business type
export function getBusinessTypeConfig(typeOrBusiness?: BusinessType | Business | string | null): BusinessTypeDefinition {
  let resolvedType: BusinessType = 'HOTEL';
  if (typeof typeOrBusiness === 'string') {
    resolvedType = resolveBusinessType(typeOrBusiness);
  } else if (typeOrBusiness && typeof typeOrBusiness === 'object') {
    resolvedType = resolveBusinessType(typeOrBusiness.businessType || typeOrBusiness.business_type || typeOrBusiness.category || typeOrBusiness.type);
  }
  return ALL_BUSINESS_TYPES.find(b => b.type === resolvedType) || ALL_BUSINESS_TYPES[0];
}

// Helper: Check if a module is enabled for a given business
export function isModuleEnabled(business: Business | null | undefined, moduleKey: BusinessModuleKey): boolean {
  if (!business) return true; // Default to true if not yet loaded
  
  // 1. If business has explicitly defined enabledModules array
  if (Array.isArray(business.enabledModules) && business.enabledModules.length > 0) {
    return business.enabledModules.includes(moduleKey);
  }

  // 2. Otherwise compute from its businessType configuration
  const config = getBusinessTypeConfig(business);
  return config.defaultEnabledModules.includes(moduleKey);
}

// Helper: Get available units for a business type
export function getAvailableUnitsForBusiness(business?: Business | null): string[] {
  const config = getBusinessTypeConfig(business);
  const standard = config.defaultUnits || ['Piece', 'Box', 'Kg', 'Litre', 'Bottle', 'Pack'];
  if (business?.customUnits && Array.isArray(business.customUnits)) {
    return Array.from(new Set([...standard, ...business.customUnits]));
  }
  return standard;
}

// Helper: Get default categories for a business type
export function getCategoriesForBusiness(business?: Business | null): string[] {
  const config = getBusinessTypeConfig(business);
  const standard = config.defaultCategories || ['General', 'Products', 'Services'];
  if (business?.customCategories && Array.isArray(business.customCategories)) {
    return Array.from(new Set([...standard, ...business.customCategories]));
  }
  return standard;
}
