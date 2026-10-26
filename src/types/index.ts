export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'petugas';
  is_active: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  product_count?: number;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  category_name?: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  current_stock: number;
  min_stock: number;
  description?: string;
  is_active: boolean;
  stock_status?: 'AMAN' | 'MENIPIS' | 'HABIS' | 'NONAKTIF';
  created_at: string;
  updated_at: string;
  movements?: StockMovement[];
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  notes?: string;
  is_active: boolean;
}

export interface StockInDetail {
  id: string;
  stock_in_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  unit: string;
  quantity: number;
  purchase_price: number;
  subtotal: number;
}

export interface StockInTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  supplier_id: string;
  supplier_name: string;
  user_id: string;
  user_name: string;
  total_amount: number;
  notes?: string;
  status: 'completed' | 'cancelled';
  items: StockInDetail[];
  created_at: string;
}

export interface SaleDetail {
  id: string;
  sale_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  unit: string;
  quantity: number;
  selling_price: number;
  purchase_price_snapshot: number;
  subtotal: number;
}

export interface SaleTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  user_id: string;
  cashier_name: string;
  payment_method: 'cash' | 'transfer' | 'qris';
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  notes?: string;
  status: 'completed' | 'cancelled';
  items: SaleDetail[];
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  movement_date: string;
  movement_type: 'IN' | 'SALE' | 'ADJUSTMENT' | 'CANCEL_SALE' | 'CANCEL_IN';
  quantity_in: number;
  quantity_out: number;
  balance_before: number;
  balance_after: number;
  reference_type: string;
  reference_id: string;
  reference_number: string;
  user_id: string;
  user_name: string;
  notes?: string;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  adjustment_date: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  recorded_stock: number;
  physical_stock: number;
  difference: number;
  reason: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

export interface DashboardData {
  totalProducts: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryAssetValue: number;
  potentialSalesValue: number;
  todayStockInTotalAmount: number;
  todayStockInCount: number;
  todaySalesTotalAmount: number;
  todaySalesCount: number;
  todayGrossProfit: number;
  last7Days: { date: string; displayDate: string; sales: number; stockIn: number }[];
  topSellingProducts: { sku: string; name: string; quantity: number; revenue: number }[];
  urgentReorders: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    current_stock: number;
    min_stock: number;
    shortage: number;
    status: 'HABIS' | 'MENIPIS';
  }[];
  recentActivities: {
    id: string;
    type: 'IN' | 'SALE';
    number: string;
    date: string;
    party: string;
    amount: number;
    status: string;
    itemCount: number;
  }[];
}

export interface StoreSettings {
  store_name: string;
  address: string;
  phone: string;
  receipt_footer: string;
  default_min_stock: number;
  currency_symbol: string;
  logo_url?: string;
}

export interface BootstrapData {
  settings: StoreSettings;
  dashboard: DashboardData;
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  stockInList: StockInTransaction[];
  salesList: SaleTransaction[];
  stockMovements: StockMovement[];
  stockAdjustments: StockAdjustment[];
}
