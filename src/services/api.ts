import { supabase } from '../lib/supabaseClient.js';
import { clientDb } from './clientDb.js';
import {
  User,
  Product,
  Category,
  Supplier,
  StockInTransaction,
  StockInDetail,
  SaleTransaction,
  SaleDetail,
  StockMovement,
  StockAdjustment,
  DashboardData,
  StoreSettings,
  BootstrapData,
} from '../types/index.js';

const TOKEN_KEY = 'sembako_auth_token';
const USER_KEY = 'sembako_auth_user';
const LOGO_KEY = 'sembako_store_logo_url';
const EXTRA_USERS_KEY = 'sembako_users_registry_v1';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

function getStoredLogo(): string | undefined {
  try {
    const val = localStorage.getItem(LOGO_KEY);
    return val || undefined;
  } catch {
    return undefined;
  }
}

function setStoredLogo(logoUrl?: string): void {
  try {
    if (logoUrl) {
      localStorage.setItem(LOGO_KEY, logoUrl);
    } else {
      localStorage.removeItem(LOGO_KEY);
    }
  } catch {}
}

type StoredUserRecord = User & { password?: string; created_at?: string };

function loadUserRegistry(): StoredUserRecord[] {
  try {
    const raw = localStorage.getItem(EXTRA_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const seeded = clientDb.getData().users.map((u) => ({
    ...u,
    password: u.username.toLowerCase() === 'admin' ? 'admin123' : 'kasir123',
    created_at: new Date().toISOString(),
  }));
  saveUserRegistry(seeded);
  return seeded;
}

function saveUserRegistry(users: StoredUserRecord[]): void {
  try {
    localStorage.setItem(EXTRA_USERS_KEY, JSON.stringify(users));
  } catch {}
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function formatSupabaseError(err: any, fallback: string): string {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  if (
    code === '42501' ||
    msg.toLowerCase().includes('row-level security') ||
    msg.toLowerCase().includes('permission denied')
  ) {
    return 'Akses tulis ditolak oleh kebijakan Row-Level Security (RLS 42501) Supabase. Buka Pengaturan Toko -> Sinkronisasi Database Supabase untuk menyalin & menjalankan skrip SQL kebijakan RLS di SQL Editor Supabase.';
  }
  if (code === '23505' || msg.toLowerCase().includes('duplicate key')) {
    return 'Data dengan kode/ID yang sama sudah terdaftar di database Supabase.';
  }
  return msg || fallback;
}

function computeStockStatus(p: Product): 'AMAN' | 'MENIPIS' | 'HABIS' | 'NONAKTIF' {
  if (!p.is_active) return 'NONAKTIF';
  if (Number(p.current_stock) <= 0) return 'HABIS';
  if (Number(p.current_stock) <= Number(p.min_stock)) return 'MENIPIS';
  return 'AMAN';
}

function computeDashboard(
  products: Product[],
  stockInList: StockInTransaction[],
  salesList: SaleTransaction[]
): DashboardData {
  const active = products.filter((p) => p.is_active);
  const today = new Date().toISOString().split('T')[0];

  const lowStockItems = active.filter(
    (p) => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock)
  );
  const outOfStockItems = active.filter((p) => Number(p.current_stock) <= 0);

  const inventoryAssetValue = active.reduce(
    (acc, p) => acc + Number(p.current_stock) * Number(p.purchase_price),
    0
  );
  const potentialSalesValue = active.reduce(
    (acc, p) => acc + Number(p.current_stock) * Number(p.selling_price),
    0
  );

  const todayStockIns = stockInList.filter(
    (tx) => tx.status === 'completed' && tx.transaction_date === today
  );
  const todaySales = salesList.filter(
    (tx) => tx.status === 'completed' && tx.transaction_date === today
  );

  const todaySalesTotalAmount = todaySales.reduce((acc, tx) => acc + Number(tx.total_amount), 0);
  const todayStockInTotalAmount = todayStockIns.reduce((acc, tx) => acc + Number(tx.total_amount), 0);

  let todayHpp = 0;
  for (const sale of todaySales) {
    for (const item of sale.items || []) {
      todayHpp += Number(item.quantity) * Number(item.purchase_price_snapshot || 0);
    }
  }

  const last7Days: { date: string; displayDate: string; sales: number; stockIn: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const displayDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    const daySales = salesList
      .filter((tx) => tx.status === 'completed' && tx.transaction_date === dateStr)
      .reduce((sum, tx) => sum + Number(tx.total_amount), 0);

    const dayStockIn = stockInList
      .filter((tx) => tx.status === 'completed' && tx.transaction_date === dateStr)
      .reduce((sum, tx) => sum + Number(tx.total_amount), 0);

    last7Days.push({ date: dateStr, displayDate, sales: daySales, stockIn: dayStockIn });
  }

  const urgentReorders = [...outOfStockItems, ...lowStockItems].map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    current_stock: Number(p.current_stock),
    min_stock: Number(p.min_stock),
    shortage: Math.max(0, Number(p.min_stock) - Number(p.current_stock) + 5),
    status: (Number(p.current_stock) <= 0 ? 'HABIS' : 'MENIPIS') as 'HABIS' | 'MENIPIS',
  }));

  const recentActivities: DashboardData['recentActivities'] = [];
  for (const tx of stockInList.slice(0, 5)) {
    recentActivities.push({
      id: tx.id,
      type: 'IN',
      number: tx.transaction_number,
      date: tx.transaction_date,
      party: tx.supplier_name,
      amount: Number(tx.total_amount),
      status: tx.status,
      itemCount: (tx.items || []).reduce((s, i) => s + Number(i.quantity), 0),
    });
  }
  for (const sale of salesList.slice(0, 5)) {
    recentActivities.push({
      id: sale.id,
      type: 'SALE',
      number: sale.transaction_number,
      date: sale.transaction_date,
      party: sale.cashier_name,
      amount: Number(sale.total_amount),
      status: sale.status,
      itemCount: (sale.items || []).reduce((s, i) => s + Number(i.quantity), 0),
    });
  }

  return {
    totalProducts: active.length,
    totalUnits: active.reduce((acc, p) => acc + Number(p.current_stock), 0),
    lowStockCount: lowStockItems.length,
    outOfStockCount: outOfStockItems.length,
    inventoryAssetValue,
    potentialSalesValue,
    todayStockInTotalAmount,
    todayStockInCount: todayStockIns.length,
    todaySalesTotalAmount,
    todaySalesCount: todaySales.length,
    todayGrossProfit: todaySalesTotalAmount - todayHpp,
    last7Days,
    topSellingProducts: [],
    urgentReorders,
    recentActivities: recentActivities.slice(0, 8),
  };
}

export interface SupabaseTableCounts {
  products: number;
  categories: number;
  suppliers: number;
  stock_in_transactions: number;
  stock_in_details: number;
  sales_transactions: number;
  sales_details: number;
  stock_movements: number;
  stock_adjustments: number;
  store_settings: number;
  unsyncedProductsCount: number;
  rlsWriteAllowed: boolean | null;
}

export const SUPABASE_RLS_AND_SEED_SQL = `-- Jalankan di Supabase Dashboard -> SQL Editor untuk mengaktifkan akses baca/tulis (RLS) & Realtime sync pada 10 tabel
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories',
    'suppliers',
    'products',
    'stock_in_transactions',
    'stock_in_details',
    'sales_transactions',
    'sales_details',
    'stock_movements',
    'stock_adjustments',
    'store_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_anon_%s" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "allow_all_anon_%s" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t, t);
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;`;

async function fetchAllFromSupabase() {
  const [
    productsRes,
    categoriesRes,
    suppliersRes,
    stockInRes,
    stockInDetRes,
    salesRes,
    salesDetRes,
    movementsRes,
    adjustmentsRes,
    settingsRes,
  ] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('stock_in_transactions').select('*').order('created_at', { ascending: false }),
    supabase.from('stock_in_details').select('*'),
    supabase.from('sales_transactions').select('*').order('created_at', { ascending: false }),
    supabase.from('sales_details').select('*'),
    supabase.from('stock_movements').select('*').order('created_at', { ascending: false }),
    supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false }),
    supabase.from('store_settings').select('*').limit(1),
  ]);

  const firstError =
    productsRes.error ||
    categoriesRes.error ||
    suppliersRes.error ||
    stockInRes.error ||
    stockInDetRes.error ||
    salesRes.error ||
    salesDetRes.error ||
    movementsRes.error ||
    adjustmentsRes.error ||
    settingsRes.error;

  if (firstError) {
    throw new Error(formatSupabaseError(firstError, 'Gagal memuat data dari Supabase.'));
  }

  const rawCategories: Category[] =
    categoriesRes.data && categoriesRes.data.length > 0
      ? (categoriesRes.data as Category[])
      : clientDb.getData().categories;

  const rawSuppliers: Supplier[] =
    suppliersRes.data && suppliersRes.data.length > 0
      ? (suppliersRes.data as Supplier[])
      : clientDb.getData().suppliers;

  const catNameMap = new Map<string, string>(rawCategories.map((c) => [c.id, c.name]));
  const catCountMap = new Map<string, number>();

  const products: Product[] = (productsRes.data || []).map((row: any) => {
    const p: Product = {
      ...row,
      purchase_price: Number(row.purchase_price || 0),
      selling_price: Number(row.selling_price || 0),
      current_stock: Number(row.current_stock || 0),
      min_stock: Number(row.min_stock || 0),
      is_active: row.is_active !== false,
      category_name: catNameMap.get(row.category_id) || 'Umum',
    };
    p.stock_status = computeStockStatus(p);
    catCountMap.set(p.category_id, (catCountMap.get(p.category_id) || 0) + 1);
    return p;
  });

  const categories: Category[] = rawCategories.map((c) => ({
    ...c,
    product_count: catCountMap.get(c.id) || 0,
  }));

  const supplierNameMap = new Map<string, string>(rawSuppliers.map((s) => [s.id, s.name]));

  const stockInDetailsMap = new Map<string, StockInDetail[]>();
  for (const det of (stockInDetRes.data || []) as any[]) {
    const list = stockInDetailsMap.get(det.stock_in_id) || [];
    list.push({
      ...det,
      quantity: Number(det.quantity || 0),
      purchase_price: Number(det.purchase_price || 0),
      subtotal: Number(det.subtotal || 0),
    });
    stockInDetailsMap.set(det.stock_in_id, list);
  }

  const stockInList: StockInTransaction[] = (stockInRes.data || []).map((tx: any) => ({
    ...tx,
    supplier_name: tx.supplier_name || supplierNameMap.get(tx.supplier_id) || 'Pemasok',
    user_name: tx.user_name || 'Administrator',
    total_amount: Number(tx.total_amount || 0),
    items: stockInDetailsMap.get(tx.id) || [],
  }));

  const salesDetailsMap = new Map<string, SaleDetail[]>();
  for (const det of (salesDetRes.data || []) as any[]) {
    const list = salesDetailsMap.get(det.sale_id) || [];
    list.push({
      ...det,
      quantity: Number(det.quantity || 0),
      selling_price: Number(det.selling_price || 0),
      purchase_price_snapshot: Number(det.purchase_price_snapshot || 0),
      subtotal: Number(det.subtotal || 0),
    });
    salesDetailsMap.set(det.sale_id, list);
  }

  const salesList: SaleTransaction[] = (salesRes.data || []).map((tx: any) => ({
    ...tx,
    total_amount: Number(tx.total_amount || 0),
    paid_amount: Number(tx.paid_amount || 0),
    change_amount: Number(tx.change_amount || 0),
    items: salesDetailsMap.get(tx.id) || [],
  }));

  const stockMovements: StockMovement[] = (movementsRes.data || []).map((m: any) => ({
    ...m,
    quantity_in: Number(m.quantity_in || 0),
    quantity_out: Number(m.quantity_out || 0),
    balance_before: Number(m.balance_before || 0),
    balance_after: Number(m.balance_after || 0),
  }));

  const stockAdjustments: StockAdjustment[] = (adjustmentsRes.data || []).map((a: any) => ({
    ...a,
    recorded_stock: Number(a.recorded_stock || 0),
    physical_stock: Number(a.physical_stock || 0),
    difference: Number(a.difference || 0),
  }));

  const dbSettings = settingsRes.data?.[0];
  if (dbSettings) {
    setStoredLogo(dbSettings.logo_url || undefined);
  }
  const fallbackSettings = clientDb.getData().settings;
  const settings: StoreSettings = dbSettings
    ? {
        store_name: dbSettings.store_name || fallbackSettings.store_name,
        address: dbSettings.address || '',
        phone: dbSettings.phone || '',
        receipt_footer: dbSettings.receipt_footer || '',
        default_min_stock: Number(dbSettings.default_min_stock || 10),
        currency_symbol: dbSettings.currency_symbol || 'Rp',
        logo_url: dbSettings.logo_url || undefined,
      }
    : {
        ...fallbackSettings,
        logo_url: getStoredLogo() || fallbackSettings.logo_url,
      };

  const dashboard = computeDashboard(products, stockInList, salesList);

  return {
    settings,
    dashboard,
    products,
    categories,
    suppliers: rawSuppliers,
    stockInList,
    salesList,
    stockMovements,
    stockAdjustments,
    dbHasCategories: Boolean(categoriesRes.data && categoriesRes.data.length > 0),
    dbHasSuppliers: Boolean(suppliersRes.data && suppliersRes.data.length > 0),
    dbHasSettings: Boolean(dbSettings),
  };
}

export const api = {
  // ----------------------------------------------------
  // UNIFIED BOOTSTRAP (Direct Supabase Parallel Fetch)
  // ----------------------------------------------------
  bootstrap: async (): Promise<{ success: boolean; data: BootstrapData }> => {
    const data = await fetchAllFromSupabase();
    return {
      success: true,
      data: {
        settings: data.settings,
        dashboard: data.dashboard,
        products: data.products,
        categories: data.categories,
        suppliers: data.suppliers,
        stockInList: data.stockInList,
        salesList: data.salesList,
        stockMovements: data.stockMovements,
        stockAdjustments: data.stockAdjustments,
      },
    };
  },

  // ----------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------
  login: async (credentials: { username: string; password: string }) => {
    const input = credentials.username.trim();
    const password = credentials.password;

    if (input.includes('@')) {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: input,
        password,
      });
      if (!authErr && authData?.user) {
        const metaRole = authData.user.user_metadata?.role;
        const user: User = {
          id: authData.user.id,
          username: authData.user.email?.split('@')[0] || input,
          name: authData.user.user_metadata?.name || authData.user.email || 'Pengguna Supabase',
          email: authData.user.email || input,
          role: metaRole === 'petugas' ? 'petugas' : 'admin',
          is_active: true,
        };
        const token = authData.session?.access_token || `sb_${user.id}_${Date.now()}`;
        setStoredToken(token);
        setStoredUser(user);
        return { success: true, token, user, message: 'Login berhasil.' };
      }
    }

    const users = loadUserRegistry();
    const found = users.find(
      (u) =>
        u.username.toLowerCase() === input.toLowerCase() ||
        u.email.toLowerCase() === input.toLowerCase()
    );

    if (!found) {
      throw new Error('Username atau kata sandi tidak sesuai.');
    }
    if (!found.is_active) {
      throw new Error('Akun pengguna ini sedang dinonaktifkan oleh Administrator.');
    }

    const expectedPassword =
      found.password || (found.username.toLowerCase() === 'admin' ? 'admin123' : 'kasir123');
    if (password !== expectedPassword) {
      throw new Error('Username atau kata sandi tidak sesuai.');
    }

    const cleanUser: User = {
      id: found.id,
      username: found.username,
      name: found.name,
      email: found.email,
      role: found.role,
      is_active: found.is_active,
    };
    const token = `tok_${cleanUser.role}_${cleanUser.id}_${Date.now()}`;
    setStoredToken(token);
    setStoredUser(cleanUser);
    return { success: true, token, user: cleanUser, message: 'Login berhasil.' };
  },

  getCurrentUser: async () => {
    const cached = getStoredUser();
    const token = getStoredToken();
    if (cached && token) {
      return { success: true, user: cached };
    }
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      const user: User = {
        id: data.user.id,
        username: data.user.email?.split('@')[0] || 'admin',
        name: data.user.user_metadata?.name || data.user.email || 'Admin',
        email: data.user.email || '',
        role: data.user.user_metadata?.role === 'petugas' ? 'petugas' : 'admin',
        is_active: true,
      };
      setStoredUser(user);
      return { success: true, user };
    }
    clearStoredToken();
    return { success: false, user: null as unknown as User };
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    clearStoredToken();
    return { success: true, message: 'Logout berhasil.' };
  },

  // ----------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------
  getDashboardSummary: async () => {
    const data = await fetchAllFromSupabase();
    return { success: true, data: data.dashboard };
  },

  // ----------------------------------------------------
  // PRODUCTS & MASTER SKU (Supabase `products`)
  // ----------------------------------------------------
  getProducts: async (params?: { category_id?: string; stock_status?: string; search?: string }) => {
    let query = supabase.from('products').select('*', { count: 'exact' }).order('name');

    if (params?.category_id && params.category_id !== 'all') {
      query = query.eq('category_id', params.category_id);
    }
    if (params?.search) {
      query = query.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%`);
    }

    const [prodRes, catRes] = await Promise.all([query, supabase.from('categories').select('id,name')]);
    if (prodRes.error) {
      throw new Error(formatSupabaseError(prodRes.error, 'Gagal mengambil data barang.'));
    }

    const fallbackCats = clientDb.getData().categories;
    const catMap = new Map<string, string>(
      (catRes.data && catRes.data.length > 0 ? catRes.data : fallbackCats).map((c: any) => [
        c.id,
        c.name,
      ])
    );

    let list: Product[] = (prodRes.data || []).map((row: any) => {
      const p: Product = {
        ...row,
        purchase_price: Number(row.purchase_price || 0),
        selling_price: Number(row.selling_price || 0),
        current_stock: Number(row.current_stock || 0),
        min_stock: Number(row.min_stock || 0),
        is_active: row.is_active !== false,
        category_name: catMap.get(row.category_id) || 'Umum',
      };
      p.stock_status = computeStockStatus(p);
      return p;
    });

    if (params?.stock_status === 'safe' || params?.stock_status === 'normal') {
      list = list.filter((p) => p.is_active && p.current_stock > p.min_stock);
    } else if (params?.stock_status === 'critical' || params?.stock_status === 'kritis') {
      list = list.filter((p) => p.is_active && p.current_stock <= p.min_stock);
    } else if (params?.stock_status === 'low') {
      list = list.filter((p) => p.is_active && p.current_stock > 0 && p.current_stock <= p.min_stock);
    } else if (params?.stock_status === 'out') {
      list = list.filter((p) => p.is_active && p.current_stock <= 0);
    } else if (params?.stock_status === 'inactive') {
      list = list.filter((p) => !p.is_active);
    }

    return {
      success: true,
      data: list,
      total: prodRes.count ?? list.length,
    };
  },

  getProductDetail: async (id: string) => {
    const [prodRes, movRes, catRes] = await Promise.all([
      supabase.from('products').select('*').eq('id', id).single(),
      supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('id,name'),
    ]);

    if (prodRes.error || !prodRes.data) {
      throw new Error(formatSupabaseError(prodRes.error, 'Barang tidak ditemukan di Supabase.'));
    }

    const fallbackCats = clientDb.getData().categories;
    const catList = catRes.data && catRes.data.length > 0 ? catRes.data : fallbackCats;
    const cat = catList.find((c: any) => c.id === prodRes.data.category_id);

    const product: Product = {
      ...(prodRes.data as any),
      purchase_price: Number(prodRes.data.purchase_price || 0),
      selling_price: Number(prodRes.data.selling_price || 0),
      current_stock: Number(prodRes.data.current_stock || 0),
      min_stock: Number(prodRes.data.min_stock || 0),
      is_active: prodRes.data.is_active !== false,
      category_name: cat?.name || 'Umum',
    };
    product.stock_status = computeStockStatus(product);

    const movements: StockMovement[] = (movRes.data || []).map((m: any) => ({
      ...m,
      quantity_in: Number(m.quantity_in || 0),
      quantity_out: Number(m.quantity_out || 0),
      balance_before: Number(m.balance_before || 0),
      balance_after: Number(m.balance_after || 0),
    }));

    return {
      success: true,
      data: { ...product, movements },
    };
  },

  createProduct: async (data: any) => {
    const now = new Date().toISOString();
    const id = `prd-${Date.now()}`;
    const sku = String(data.sku || '').trim().toUpperCase();
    const initialStock = Number(data.current_stock) || 0;

    const payload = {
      id,
      sku,
      name: String(data.name || '').trim(),
      category_id: data.category_id,
      unit: data.unit,
      purchase_price: Number(data.purchase_price) || 0,
      selling_price: Number(data.selling_price) || 0,
      current_stock: initialStock,
      min_stock: Number(data.min_stock) || 0,
      description: data.description || '',
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { data: inserted, error } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal menyimpan barang baru ke Supabase.'));
    }

    if (initialStock > 0) {
      const user = getStoredUser();
      const { error: movErr } = await supabase.from('stock_movements').insert({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product_id: id,
        product_sku: sku,
        product_name: payload.name,
        movement_date: now.slice(0, 10),
        movement_type: 'IN',
        quantity_in: initialStock,
        quantity_out: 0,
        balance_before: 0,
        balance_after: initialStock,
        reference_type: 'stock_in',
        reference_id: id,
        reference_number: `INIT-${sku}`,
        user_id: user?.id || 'usr-1',
        user_name: user?.name || 'Administrator',
        notes: 'Stok awal saat penambahan barang',
        created_at: now,
      });
      if (movErr) {
        throw new Error(formatSupabaseError(movErr, 'Barang tersimpan, namun gagal mencatat saldo awal ke stock_movements.'));
      }
    }

    return { success: true, message: 'Barang berhasil disimpan ke Supabase.', data: inserted as Product };
  },

  updateProduct: async (id: string, data: any) => {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updatePayload.name = String(data.name).trim();
    if (data.sku !== undefined) updatePayload.sku = String(data.sku).trim().toUpperCase();
    if (data.category_id !== undefined) updatePayload.category_id = data.category_id;
    if (data.unit !== undefined) updatePayload.unit = data.unit;
    if (data.purchase_price !== undefined) updatePayload.purchase_price = Number(data.purchase_price);
    if (data.selling_price !== undefined) updatePayload.selling_price = Number(data.selling_price);
    if (data.min_stock !== undefined) updatePayload.min_stock = Number(data.min_stock);
    if (data.description !== undefined) updatePayload.description = data.description;

    const { data: updated, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal memperbarui barang di Supabase.'));
    }

    return { success: true, message: 'Barang berhasil diperbarui.', data: updated as Product };
  },

  toggleProductStatus: async (id: string) => {
    const { data: current, error: fetchErr } = await supabase
      .from('products')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      throw new Error(formatSupabaseError(fetchErr, 'Barang tidak ditemukan.'));
    }

    const { data: updated, error } = await supabase
      .from('products')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal mengubah status barang.'));
    }

    return { success: true, message: 'Status barang diubah.', data: updated as Product };
  },

  deleteProduct: async (id: string) => {
    const [{ count: movCount }, { count: sinCount }, { count: salCount }] = await Promise.all([
      supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', id),
      supabase.from('stock_in_details').select('id', { count: 'exact', head: true }).eq('product_id', id),
      supabase.from('sales_details').select('id', { count: 'exact', head: true }).eq('product_id', id),
    ]);

    const hasHistory = (movCount || 0) + (sinCount || 0) + (salCount || 0) > 0;
    if (hasHistory) {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        throw new Error(formatSupabaseError(error, 'Gagal menonaktifkan barang.'));
      }
      return { success: true, message: 'Barang memiliki riwayat transaksi sehingga dinonaktifkan.' };
    }

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal menghapus barang dari Supabase.'));
    }
    return { success: true, message: 'Barang berhasil dihapus.' };
  },

  // ----------------------------------------------------
  // CATEGORIES (Supabase `categories`)
  // ----------------------------------------------------
  getCategories: async () => {
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('products').select('category_id'),
    ]);

    if (catRes.error) {
      throw new Error(formatSupabaseError(catRes.error, 'Gagal mengambil kategori.'));
    }

    const counts = new Map<string, number>();
    for (const p of prodRes.data || []) {
      counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
    }

    const base =
      catRes.data && catRes.data.length > 0 ? catRes.data : clientDb.getData().categories;
    const list: Category[] = base.map((c: any) => ({
      ...c,
      product_count: counts.get(c.id) || 0,
    }));

    return { success: true, data: list };
  },

  createCategory: async (data: { name: string; description?: string }) => {
    const now = new Date().toISOString();
    const newCat = {
      id: `cat-${Date.now()}`,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      created_at: now,
      updated_at: now,
    };
    const { data: inserted, error } = await supabase
      .from('categories')
      .insert(newCat)
      .select()
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal menambahkan kategori ke Supabase.'));
    }
    return { success: true, message: 'Kategori berhasil ditambahkan.', data: inserted as Category };
  },

  updateCategory: async (id: string, data: { name: string; description?: string }) => {
    const { data: updated, error } = await supabase
      .from('categories')
      .update({
        name: data.name.trim(),
        description: data.description?.trim() || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal memperbarui kategori di Supabase.'));
    }
    return { success: true, message: 'Kategori berhasil diubah.', data: updated as Category };
  },

  deleteCategory: async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal menghapus kategori dari Supabase.'));
    }
    return { success: true, message: 'Kategori berhasil dihapus.' };
  },

  // ----------------------------------------------------
  // SUPPLIERS (Supabase `suppliers`)
  // ----------------------------------------------------
  getSuppliers: async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal memuat daftar pemasok.'));
    }
    const list =
      data && data.length > 0 ? (data as Supplier[]) : clientDb.getData().suppliers;
    return { success: true, data: list };
  },

  createSupplier: async (data: any) => {
    const now = new Date().toISOString();
    const { count } = await supabase.from('suppliers').select('id', { count: 'exact', head: true });
    const newSup = {
      id: `sup-${Date.now()}`,
      code: data.code?.trim() || `SUP-${String((count || 0) + 1).padStart(3, '0')}`,
      name: String(data.name || '').trim(),
      contact_person: String(data.contact_person || '').trim(),
      phone: String(data.phone || '').trim(),
      address: String(data.address || '').trim(),
      notes: String(data.notes || '').trim(),
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { data: inserted, error } = await supabase
      .from('suppliers')
      .insert(newSup)
      .select()
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal menambahkan pemasok ke Supabase.'));
    }
    return { success: true, message: 'Pemasok berhasil ditambahkan.', data: inserted as Supplier };
  },

  updateSupplier: async (id: string, data: any) => {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) payload.name = data.name;
    if (data.contact_person !== undefined) payload.contact_person = data.contact_person;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.address !== undefined) payload.address = data.address;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);

    const { data: updated, error } = await supabase
      .from('suppliers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal memperbarui pemasok di Supabase.'));
    }
    return { success: true, message: 'Pemasok berhasil diubah.', data: updated as Supplier };
  },

  toggleSupplierStatus: async (id: string) => {
    const { data: current, error: fetchErr } = await supabase
      .from('suppliers')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      throw new Error(formatSupabaseError(fetchErr, 'Pemasok tidak ditemukan di Supabase.'));
    }

    const { data: updated, error } = await supabase
      .from('suppliers')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal mengubah status pemasok.'));
    }
    return { success: true, message: 'Status pemasok diubah.', data: updated as Supplier };
  },

  deleteSupplier: async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal menghapus pemasok dari Supabase.'));
    }
    return { success: true, message: 'Pemasok berhasil dihapus.' };
  },

  // ----------------------------------------------------
  // STOCK IN (Supabase `stock_in_transactions` + `stock_in_details` + `stock_movements`)
  // ----------------------------------------------------
  getStockInList: async (params?: { start_date?: string; end_date?: string }) => {
    let query = supabase
      .from('stock_in_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (params?.start_date) query = query.gte('transaction_date', params.start_date);
    if (params?.end_date) query = query.lte('transaction_date', params.end_date);

    const [txRes, detRes, supRes] = await Promise.all([
      query,
      supabase.from('stock_in_details').select('*'),
      supabase.from('suppliers').select('id,name'),
    ]);
    if (txRes.error) {
      throw new Error(formatSupabaseError(txRes.error, 'Gagal memuat riwayat barang masuk.'));
    }

    const supMap = new Map<string, string>((supRes.data || []).map((s: any) => [s.id, s.name]));
    const detMap = new Map<string, StockInDetail[]>();
    for (const det of (detRes.data || []) as any[]) {
      const list = detMap.get(det.stock_in_id) || [];
      list.push({
        ...det,
        quantity: Number(det.quantity || 0),
        purchase_price: Number(det.purchase_price || 0),
        subtotal: Number(det.subtotal || 0),
      });
      detMap.set(det.stock_in_id, list);
    }

    const list: StockInTransaction[] = (txRes.data || []).map((tx: any) => ({
      ...tx,
      supplier_name: tx.supplier_name || supMap.get(tx.supplier_id) || 'Pemasok',
      user_name: tx.user_name || 'Administrator',
      total_amount: Number(tx.total_amount || 0),
      items: detMap.get(tx.id) || [],
    }));

    return { success: true, data: list };
  },

  createStockIn: async (payload: {
    supplier_id: string;
    transaction_date: string;
    notes?: string;
    items: { product_id: string; quantity: number; purchase_price: number }[];
  }) => {
    const user = getStoredUser();
    const now = new Date().toISOString();
    const txId = `sin-${Date.now()}`;
    const dateStr = payload.transaction_date.replace(/-/g, '');
    const txNum = `TRX-IN-${dateStr}-${String(Math.floor(Math.random() * 900) + 100)}`;

    // Resolve supplier name (Supabase first, fallback to clientDb list)
    const { data: supRow } = await supabase
      .from('suppliers')
      .select('id,name')
      .eq('id', payload.supplier_id)
      .maybeSingle();
    const fallbackSup = clientDb.getData().suppliers.find((s) => s.id === payload.supplier_id);
    const supplierName = supRow?.name || fallbackSup?.name || 'Pemasok';

    // Load live products from Supabase
    const productIds = payload.items.map((i) => i.product_id);
    const { data: prodRows, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (prodErr || !prodRows) {
      throw new Error(formatSupabaseError(prodErr, 'Gagal memverifikasi data barang di Supabase.'));
    }

    const prodMap = new Map<string, any>(prodRows.map((p: any) => [p.id, p]));
    let totalAmount = 0;
    const detailsToInsert: any[] = [];
    const movementsToInsert: any[] = [];
    const stockUpdates: { id: string; current_stock: number; purchase_price: number }[] = [];

    for (const item of payload.items) {
      const prod = prodMap.get(item.product_id);
      if (!prod) throw new Error('Salah satu barang tidak ditemukan di Supabase.');
      const qty = Number(item.quantity);
      const price = Number(item.purchase_price);
      const subtotal = qty * price;
      totalAmount += subtotal;

      const before = Number(prod.current_stock || 0);
      const after = before + qty;
      prod.current_stock = after;

      detailsToInsert.push({
        id: `sindet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        stock_in_id: txId,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        unit: prod.unit,
        quantity: qty,
        purchase_price: price,
        subtotal,
      });

      movementsToInsert.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        movement_date: payload.transaction_date,
        movement_type: 'IN',
        quantity_in: qty,
        quantity_out: 0,
        balance_before: before,
        balance_after: after,
        reference_type: 'stock_in',
        reference_id: txId,
        reference_number: txNum,
        user_id: user?.id || 'usr-1',
        user_name: user?.name || 'Administrator',
        notes: payload.notes || `Penerimaan dari ${supplierName}`,
        created_at: now,
      });

      stockUpdates.push({ id: prod.id, current_stock: after, purchase_price: price });
    }

    const headerPayload = {
      id: txId,
      transaction_number: txNum,
      transaction_date: payload.transaction_date,
      supplier_id: payload.supplier_id,
      supplier_name: supplierName,
      user_id: user?.id || 'usr-1',
      user_name: user?.name || 'Administrator',
      total_amount: totalAmount,
      notes: payload.notes || '',
      status: 'completed',
      created_at: now,
      updated_at: now,
    };

    const { error: txErr } = await supabase.from('stock_in_transactions').insert(headerPayload);
    if (txErr) {
      throw new Error(formatSupabaseError(txErr, 'Gagal menyimpan faktur barang masuk.'));
    }

    const { error: detErr } = await supabase.from('stock_in_details').insert(detailsToInsert);
    if (detErr) {
      throw new Error(formatSupabaseError(detErr, 'Gagal menyimpan rincian barang masuk.'));
    }

    for (const upd of stockUpdates) {
      const { error: updErr } = await supabase
        .from('products')
        .update({
          current_stock: upd.current_stock,
          purchase_price: upd.purchase_price,
          updated_at: now,
        })
        .eq('id', upd.id);
      if (updErr) {
        throw new Error(formatSupabaseError(updErr, 'Gagal memperbarui stok barang.'));
      }
    }

    const { error: movErr } = await supabase.from('stock_movements').insert(movementsToInsert);
    if (movErr) {
      throw new Error(formatSupabaseError(movErr, 'Gagal mencatat mutasi stok masuk.'));
    }

    const tx: StockInTransaction = {
      ...headerPayload,
      status: 'completed',
      items: detailsToInsert,
    };
    return { success: true, message: 'Barang masuk berhasil disimpan ke Supabase.', data: tx };
  },

  cancelStockIn: async (id: string, reason: string) => {
    const user = getStoredUser();
    const now = new Date().toISOString();

    const [{ data: tx, error: txErr }, { data: details }] = await Promise.all([
      supabase.from('stock_in_transactions').select('*').eq('id', id).single(),
      supabase.from('stock_in_details').select('*').eq('stock_in_id', id),
    ]);

    if (txErr || !tx) {
      throw new Error(formatSupabaseError(txErr, 'Transaksi barang masuk tidak ditemukan.'));
    }
    if (tx.status === 'cancelled') {
      throw new Error('Transaksi ini sudah dibatalkan sebelumnya.');
    }

    for (const det of details || []) {
      const { data: prod } = await supabase
        .from('products')
        .select('id,sku,name,current_stock')
        .eq('id', det.product_id)
        .single();
      if (prod) {
        const before = Number(prod.current_stock || 0);
        const qty = Number(det.quantity || 0);
        const after = Math.max(0, before - qty);

        const { error: prodUpdErr } = await supabase
          .from('products')
          .update({ current_stock: after, updated_at: now })
          .eq('id', prod.id);
        if (prodUpdErr) {
          throw new Error(formatSupabaseError(prodUpdErr, 'Gagal mengembalikan stok barang saat pembatalan.'));
        }

        const { error: movErr } = await supabase.from('stock_movements').insert({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_id: prod.id,
          product_sku: prod.sku,
          product_name: prod.name,
          movement_date: now.slice(0, 10),
          movement_type: 'CANCEL_IN',
          quantity_in: 0,
          quantity_out: qty,
          balance_before: before,
          balance_after: after,
          reference_type: 'stock_in',
          reference_id: tx.id,
          reference_number: tx.transaction_number,
          user_id: user?.id || 'usr-1',
          user_name: user?.name || 'Administrator',
          notes: `BATAL MASUK: ${reason}`,
          created_at: now,
        });
        if (movErr) {
          throw new Error(formatSupabaseError(movErr, 'Gagal mencatat mutasi pembatalan barang masuk.'));
        }
      }
    }

    const { data: updatedTx, error: updErr } = await supabase
      .from('stock_in_transactions')
      .update({
        status: 'cancelled',
        notes: `${tx.notes || ''} [DIBATALKAN: ${reason}]`.trim(),
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      throw new Error(formatSupabaseError(updErr, 'Gagal membatalkan transaksi barang masuk.'));
    }

    return {
      success: true,
      message: 'Transaksi barang masuk dibatalkan.',
      data: { ...(updatedTx as any), items: details || [] } as StockInTransaction,
    };
  },

  // ----------------------------------------------------
  // STOCK OUT (Barang Rusak / Kedaluwarsa / Pemakaian Internal)
  // ----------------------------------------------------
  createStockOut: async (data: {
    product_id: string;
    quantity: number;
    reason: string;
    notes?: string;
    transaction_date: string;
  }) => {
    const user = getStoredUser();
    const now = new Date().toISOString();
    const qty = Number(data.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Jumlah barang keluar harus lebih dari 0.');
    }

    const { data: prod, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', data.product_id)
      .single();

    if (prodErr || !prod) {
      throw new Error(formatSupabaseError(prodErr, 'Barang tidak ditemukan di Supabase.'));
    }

    const before = Number(prod.current_stock || 0);
    if (qty > before) {
      throw new Error(`Stok ${prod.name} tidak mencukupi. Stok tersedia: ${before} ${prod.unit}.`);
    }

    const after = before - qty;
    const txDate = data.transaction_date || now.slice(0, 10);
    const refNum = `OUT-${txDate.replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`;

    const { error: updErr } = await supabase
      .from('products')
      .update({ current_stock: after, updated_at: now })
      .eq('id', prod.id);

    if (updErr) {
      throw new Error(formatSupabaseError(updErr, 'Gagal memperbarui stok barang keluar.'));
    }

    const movementPayload = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product_id: prod.id,
      product_sku: prod.sku,
      product_name: prod.name,
      movement_date: txDate,
      movement_type: 'ADJUSTMENT',
      quantity_in: 0,
      quantity_out: qty,
      balance_before: before,
      balance_after: after,
      reference_type: 'adjustment',
      reference_id: refNum,
      reference_number: refNum,
      user_id: user?.id || 'usr-1',
      user_name: user?.name || 'Administrator',
      notes: `BARANG KELUAR (${data.reason})${data.notes ? ` - ${data.notes}` : ''}`,
      created_at: now,
    };

    const { data: insertedMov, error: movErr } = await supabase
      .from('stock_movements')
      .insert(movementPayload)
      .select()
      .single();

    if (movErr) {
      await supabase
        .from('products')
        .update({ current_stock: before, updated_at: now })
        .eq('id', prod.id);
      throw new Error(formatSupabaseError(movErr, 'Gagal mencatat riwayat barang keluar.'));
    }

    return {
      success: true,
      message: `Barang keluar (${qty} ${prod.unit}) berhasil dicatat ke Supabase.`,
      data: insertedMov as StockMovement,
    };
  },

  // ----------------------------------------------------
  // SALES POS (Supabase `sales_transactions` + `sales_details`)
  // ----------------------------------------------------
  getSalesList: async () => {
    const [txRes, detRes] = await Promise.all([
      supabase.from('sales_transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('sales_details').select('*'),
    ]);
    if (txRes.error) {
      throw new Error(formatSupabaseError(txRes.error, 'Gagal memuat data penjualan.'));
    }

    const detMap = new Map<string, SaleDetail[]>();
    for (const det of (detRes.data || []) as any[]) {
      const list = detMap.get(det.sale_id) || [];
      list.push({
        ...det,
        quantity: Number(det.quantity || 0),
        selling_price: Number(det.selling_price || 0),
        purchase_price_snapshot: Number(det.purchase_price_snapshot || 0),
        subtotal: Number(det.subtotal || 0),
      });
      detMap.set(det.sale_id, list);
    }

    const list: SaleTransaction[] = (txRes.data || []).map((tx: any) => ({
      ...tx,
      total_amount: Number(tx.total_amount || 0),
      paid_amount: Number(tx.paid_amount || 0),
      change_amount: Number(tx.change_amount || 0),
      items: detMap.get(tx.id) || [],
    }));
    return { success: true, data: list };
  },

  createSale: async (payload: any) => {
    const user = getStoredUser();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const saleId = `sal-${Date.now()}`;
    const txNum = `TRX-SAL-${today.replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`;

    const productIds = (payload.items || []).map((i: any) => i.product_id);
    const { data: prodRows, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (prodErr || !prodRows) {
      throw new Error(formatSupabaseError(prodErr, 'Gagal memverifikasi stok barang.'));
    }

    const prodMap = new Map<string, any>(prodRows.map((p: any) => [p.id, p]));
    let totalAmount = 0;
    const detailsToInsert: any[] = [];
    const movementsToInsert: any[] = [];
    const updates: { id: string; current_stock: number }[] = [];

    for (const it of payload.items || []) {
      const prod = prodMap.get(it.product_id);
      if (!prod) throw new Error('Barang tidak ditemukan.');
      const requested = Number(it.quantity);
      const before = Number(prod.current_stock || 0);
      if (before < requested) {
        throw new Error(`Stok "${prod.name}" tidak mencukupi (Tersedia: ${before}).`);
      }
      const after = before - requested;
      const sellingPrice = Number(prod.selling_price || 0);
      const subtotal = requested * sellingPrice;
      totalAmount += subtotal;

      detailsToInsert.push({
        id: `saldet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sale_id: saleId,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        unit: prod.unit,
        quantity: requested,
        selling_price: sellingPrice,
        purchase_price_snapshot: Number(prod.purchase_price || 0),
        subtotal,
      });

      movementsToInsert.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        movement_date: today,
        movement_type: 'SALE',
        quantity_in: 0,
        quantity_out: requested,
        balance_before: before,
        balance_after: after,
        reference_type: 'sale',
        reference_id: saleId,
        reference_number: txNum,
        user_id: user?.id || 'usr-2',
        user_name: user?.name || 'Kasir',
        notes: `Penjualan kasir [${txNum}]`,
        created_at: now,
      });

      updates.push({ id: prod.id, current_stock: after });
    }

    const paid = Number(payload.paid_amount) || totalAmount;
    const headerPayload = {
      id: saleId,
      transaction_number: txNum,
      transaction_date: today,
      user_id: user?.id || 'usr-2',
      cashier_name: user?.name || 'Kasir',
      payment_method: payload.payment_method || 'cash',
      total_amount: totalAmount,
      paid_amount: paid,
      change_amount: Math.max(0, paid - totalAmount),
      notes: payload.notes || '',
      status: 'completed',
      created_at: now,
      updated_at: now,
    };

    const { error: txErr } = await supabase.from('sales_transactions').insert(headerPayload);
    if (txErr) throw new Error(formatSupabaseError(txErr, 'Gagal menyimpan transaksi penjualan.'));

    const { error: detErr } = await supabase.from('sales_details').insert(detailsToInsert);
    if (detErr) throw new Error(formatSupabaseError(detErr, 'Gagal menyimpan rincian penjualan.'));

    for (const u of updates) {
      const { error: updErr } = await supabase
        .from('products')
        .update({ current_stock: u.current_stock, updated_at: now })
        .eq('id', u.id);
      if (updErr) throw new Error(formatSupabaseError(updErr, 'Gagal memperbarui stok barang penjualan.'));
    }

    const { error: movErr } = await supabase.from('stock_movements').insert(movementsToInsert);
    if (movErr) throw new Error(formatSupabaseError(movErr, 'Gagal mencatat mutasi stok penjualan.'));

    return {
      success: true,
      message: 'Transaksi penjualan berhasil.',
      data: { ...headerPayload, items: detailsToInsert } as SaleTransaction,
    };
  },

  cancelSale: async (id: string, reason: string) => {
    const user = getStoredUser();
    const now = new Date().toISOString();

    const [{ data: sale, error: sErr }, { data: details }] = await Promise.all([
      supabase.from('sales_transactions').select('*').eq('id', id).single(),
      supabase.from('sales_details').select('*').eq('sale_id', id),
    ]);

    if (sErr || !sale) {
      throw new Error(formatSupabaseError(sErr, 'Transaksi penjualan tidak ditemukan.'));
    }

    for (const det of details || []) {
      const { data: prod } = await supabase
        .from('products')
        .select('id,sku,name,current_stock')
        .eq('id', det.product_id)
        .single();
      if (prod) {
        const before = Number(prod.current_stock || 0);
        const qty = Number(det.quantity || 0);
        const after = before + qty;
        const { error: prodUpdErr } = await supabase
          .from('products')
          .update({ current_stock: after, updated_at: now })
          .eq('id', prod.id);
        if (prodUpdErr) throw new Error(formatSupabaseError(prodUpdErr, 'Gagal mengembalikan stok retur penjualan.'));

        const { error: movErr } = await supabase.from('stock_movements').insert({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_id: prod.id,
          product_sku: prod.sku,
          product_name: prod.name,
          movement_date: now.slice(0, 10),
          movement_type: 'CANCEL_SALE',
          quantity_in: qty,
          quantity_out: 0,
          balance_before: before,
          balance_after: after,
          reference_type: 'sale',
          reference_id: sale.id,
          reference_number: sale.transaction_number,
          user_id: user?.id || 'usr-1',
          user_name: user?.name || 'Administrator',
          notes: `RETUR PENJUALAN: ${reason}`,
          created_at: now,
        });
        if (movErr) throw new Error(formatSupabaseError(movErr, 'Gagal mencatat mutasi retur penjualan.'));
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('sales_transactions')
      .update({
        status: 'cancelled',
        notes: `${sale.notes || ''} [DIBATALKAN: ${reason}]`.trim(),
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      throw new Error(formatSupabaseError(updErr, 'Gagal membatalkan transaksi penjualan.'));
    }

    return {
      success: true,
      message: 'Transaksi penjualan dibatalkan.',
      data: { ...(updated as any), items: details || [] } as SaleTransaction,
    };
  },

  // ----------------------------------------------------
  // STOCK MOVEMENTS & OPNAME (Supabase `stock_movements` & `stock_adjustments`)
  // ----------------------------------------------------
  getStockMovements: async (params?: {
    product_id?: string;
    movement_type?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    let query = supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false });

    if (params?.product_id && params.product_id !== 'all') {
      query = query.eq('product_id', params.product_id);
    }
    if (params?.movement_type && params.movement_type !== 'all') {
      query = query.eq('movement_type', params.movement_type);
    }
    if (params?.start_date) {
      query = query.gte('movement_date', params.start_date);
    }
    if (params?.end_date) {
      query = query.lte('movement_date', params.end_date);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal memuat buku besar mutasi stok.'));
    }

    const list: StockMovement[] = (data || []).map((m: any) => ({
      ...m,
      quantity_in: Number(m.quantity_in || 0),
      quantity_out: Number(m.quantity_out || 0),
      balance_before: Number(m.balance_before || 0),
      balance_after: Number(m.balance_after || 0),
    }));
    return { success: true, data: list };
  },

  getStockAdjustments: async () => {
    const { data, error } = await supabase
      .from('stock_adjustments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal memuat riwayat stok opname.'));
    }

    const list: StockAdjustment[] = (data || []).map((a: any) => ({
      ...a,
      recorded_stock: Number(a.recorded_stock || 0),
      physical_stock: Number(a.physical_stock || 0),
      difference: Number(a.difference || 0),
    }));
    return { success: true, data: list };
  },

  createStockAdjustment: async (data: {
    product_id: string;
    physical_stock: number;
    reason: string;
  }) => {
    const user = getStoredUser();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const { data: prod, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', data.product_id)
      .single();

    if (prodErr || !prod) {
      throw new Error(formatSupabaseError(prodErr, 'Barang tidak ditemukan di Supabase.'));
    }

    const recorded = Number(prod.current_stock || 0);
    const physical = Number(data.physical_stock);
    const difference = physical - recorded;
    const adjId = `adj-${Date.now()}`;
    const adjNum = `ADJ-${today.replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`;

    const adjPayload = {
      id: adjId,
      adjustment_number: adjNum,
      adjustment_date: today,
      product_id: prod.id,
      product_sku: prod.sku,
      product_name: prod.name,
      recorded_stock: recorded,
      physical_stock: physical,
      difference,
      reason: data.reason,
      user_id: user?.id || 'usr-1',
      user_name: user?.name || 'Administrator',
      created_at: now,
    };

    const { data: insertedAdj, error: adjErr } = await supabase
      .from('stock_adjustments')
      .insert(adjPayload)
      .select()
      .single();

    if (adjErr) {
      throw new Error(formatSupabaseError(adjErr, 'Gagal menyimpan hasil stok opname ke Supabase.'));
    }

    const { error: updErr } = await supabase
      .from('products')
      .update({ current_stock: physical, updated_at: now })
      .eq('id', prod.id);

    if (updErr) {
      throw new Error(formatSupabaseError(updErr, 'Gagal memperbarui stok fisik barang.'));
    }

    const { error: movErr } = await supabase.from('stock_movements').insert({
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product_id: prod.id,
      product_sku: prod.sku,
      product_name: prod.name,
      movement_date: today,
      movement_type: 'ADJUSTMENT',
      quantity_in: difference > 0 ? difference : 0,
      quantity_out: difference < 0 ? Math.abs(difference) : 0,
      balance_before: recorded,
      balance_after: physical,
      reference_type: 'adjustment',
      reference_id: adjId,
      reference_number: adjNum,
      user_id: user?.id || 'usr-1',
      user_name: user?.name || 'Administrator',
      notes: `PENYESUAIAN: ${data.reason}`,
      created_at: now,
    });

    if (movErr) {
      await supabase
        .from('products')
        .update({ current_stock: recorded, updated_at: now })
        .eq('id', prod.id);
      throw new Error(formatSupabaseError(movErr, 'Gagal mencatat mutasi penyesuaian stok.'));
    }

    return {
      success: true,
      message: 'Penyesuaian stok opname berhasil disimpan ke Supabase.',
      data: insertedAdj as StockAdjustment,
    };
  },

  // ----------------------------------------------------
  // REPORTS (Live Supabase Queries)
  // ----------------------------------------------------
  getCurrentStockReport: async (category_id?: string) => {
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('name'),
      supabase.from('categories').select('*'),
    ]);

    if (prodRes.error) {
      throw new Error(formatSupabaseError(prodRes.error, 'Gagal memuat laporan stok.'));
    }

    const cats = catRes.data && catRes.data.length > 0 ? catRes.data : clientDb.getData().categories;
    const catMap = new Map<string, string>(cats.map((c: any) => [c.id, c.name]));

    let prods = (prodRes.data || []) as any[];
    if (category_id && category_id !== 'all') {
      prods = prods.filter((p) => p.category_id === category_id);
    }

    const items = prods.map((p) => {
      const current = Number(p.current_stock || 0);
      const min = Number(p.min_stock || 0);
      const buy = Number(p.purchase_price || 0);
      const sell = Number(p.selling_price || 0);
      return {
        sku: p.sku,
        name: p.name,
        category: catMap.get(p.category_id) || 'Umum',
        unit: p.unit,
        current_stock: current,
        min_stock: min,
        purchase_price: buy,
        selling_price: sell,
        valuation: current * buy,
        potentialRevenue: current * sell,
        potentialMargin: current * (sell - buy),
        status: current <= 0 ? 'HABIS' : current <= min ? 'MENIPIS' : 'AMAN',
      };
    });

    return {
      success: true,
      data: {
        items,
        summary: {
          totalItems: items.length,
          totalStockUnits: items.reduce((s, i) => s + i.current_stock, 0),
          totalValuation: items.reduce((s, i) => s + i.valuation, 0),
          totalPotentialRevenue: items.reduce((s, i) => s + i.potentialRevenue, 0),
        },
      },
    };
  },

  getStockInReport: async (params?: { start_date?: string; end_date?: string; supplier_id?: string }) => {
    let query = supabase
      .from('stock_in_transactions')
      .select('*')
      .eq('status', 'completed')
      .order('transaction_date', { ascending: false });

    if (params?.start_date) query = query.gte('transaction_date', params.start_date);
    if (params?.end_date) query = query.lte('transaction_date', params.end_date);
    if (params?.supplier_id) query = query.eq('supplier_id', params.supplier_id);

    const [txRes, detRes, supRes] = await Promise.all([
      query,
      supabase.from('stock_in_details').select('*'),
      supabase.from('suppliers').select('id,name'),
    ]);
    if (txRes.error) {
      throw new Error(formatSupabaseError(txRes.error, 'Gagal memuat laporan barang masuk.'));
    }

    const supMap = new Map<string, string>((supRes.data || []).map((s: any) => [s.id, s.name]));
    const detMap = new Map<string, any[]>();
    for (const d of detRes.data || []) {
      const arr = detMap.get(d.stock_in_id) || [];
      arr.push(d);
      detMap.set(d.stock_in_id, arr);
    }

    const flat: any[] = [];
    let total = 0;
    let qty = 0;
    for (const t of txRes.data || []) {
      for (const it of detMap.get(t.id) || []) {
        const sub = Number(it.subtotal || 0);
        const q = Number(it.quantity || 0);
        flat.push({
          transaction_number: t.transaction_number,
          transaction_date: t.transaction_date,
          supplier_name: t.supplier_name || supMap.get(t.supplier_id) || 'Pemasok',
          user_name: t.user_name || 'Administrator',
          sku: it.product_sku,
          name: it.product_name,
          unit: it.unit,
          quantity: q,
          purchase_price: Number(it.purchase_price || 0),
          subtotal: sub,
        });
        total += sub;
        qty += q;
      }
    }

    return {
      success: true,
      data: {
        items: flat,
        summary: {
          totalTransactions: (txRes.data || []).length,
          totalQuantity: qty,
          totalAmount: total,
        },
      },
    };
  },

  getSalesReport: async (params?: { start_date?: string; end_date?: string }) => {
    let query = supabase
      .from('sales_transactions')
      .select('*')
      .eq('status', 'completed')
      .order('transaction_date', { ascending: false });

    if (params?.start_date) query = query.gte('transaction_date', params.start_date);
    if (params?.end_date) query = query.lte('transaction_date', params.end_date);

    const [txRes, detRes] = await Promise.all([query, supabase.from('sales_details').select('*')]);
    if (txRes.error) {
      throw new Error(formatSupabaseError(txRes.error, 'Gagal memuat laporan penjualan.'));
    }

    const detMap = new Map<string, any[]>();
    for (const d of detRes.data || []) {
      const arr = detMap.get(d.sale_id) || [];
      arr.push(d);
      detMap.set(d.sale_id, arr);
    }

    const flat: any[] = [];
    let totalRev = 0;
    let totalHpp = 0;
    let totalQty = 0;
    for (const t of txRes.data || []) {
      for (const it of detMap.get(t.id) || []) {
        const q = Number(it.quantity || 0);
        const sub = Number(it.subtotal || 0);
        const hpp = Number(it.purchase_price_snapshot || 0) * q;
        flat.push({
          transaction_number: t.transaction_number,
          transaction_date: t.transaction_date,
          cashier_name: t.cashier_name,
          payment_method: t.payment_method,
          sku: it.product_sku,
          name: it.product_name,
          unit: it.unit,
          quantity: q,
          selling_price: Number(it.selling_price || 0),
          purchase_price: Number(it.purchase_price_snapshot || 0),
          subtotal: sub,
          hpp,
          profit: sub - hpp,
        });
        totalRev += sub;
        totalHpp += hpp;
        totalQty += q;
      }
    }

    return {
      success: true,
      data: {
        items: flat,
        summary: {
          totalTransactions: (txRes.data || []).length,
          totalQuantity: totalQty,
          totalRevenue: totalRev,
          totalHpp,
          grossProfit: totalRev - totalHpp,
          marginPercentage: totalRev > 0 ? Number((((totalRev - totalHpp) / totalRev) * 100).toFixed(2)) : 0,
        },
      },
    };
  },

  getLowStockReport: async () => {
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('current_stock'),
      supabase.from('categories').select('*'),
    ]);

    if (prodRes.error) {
      throw new Error(formatSupabaseError(prodRes.error, 'Gagal memuat laporan stok kritis.'));
    }

    const cats = catRes.data && catRes.data.length > 0 ? catRes.data : clientDb.getData().categories;
    const catMap = new Map<string, string>(cats.map((c: any) => [c.id, c.name]));

    const items = (prodRes.data || [])
      .filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 0))
      .map((p: any) => {
        const current = Number(p.current_stock || 0);
        const min = Number(p.min_stock || 0);
        const buy = Number(p.purchase_price || 0);
        const recommended = Math.max(10, min - current + 15);
        return {
          sku: p.sku,
          name: p.name,
          category: catMap.get(p.category_id) || 'Umum',
          unit: p.unit,
          current_stock: current,
          min_stock: min,
          deficit: Math.max(0, min - current),
          recommended_order: recommended,
          estimated_cost: recommended * buy,
          status: current <= 0 ? 'HABIS' : 'MENIPIS',
        };
      });

    return {
      success: true,
      data: {
        items,
        summary: {
          totalAlerts: items.length,
          outOfStockCount: items.filter((i) => i.status === 'HABIS').length,
          lowStockCount: items.filter((i) => i.status === 'MENIPIS').length,
          totalEstimatedRestockCost: items.reduce((acc, i) => acc + i.estimated_cost, 0),
        },
      },
    };
  },

  // ----------------------------------------------------
  // USERS & SETTINGS
  // ----------------------------------------------------
  getUsers: async () => {
    const users = loadUserRegistry().map(({ password: _p, ...u }) => u);
    return { success: true, data: users };
  },

  createUser: async (data: any) => {
    const registry = loadUserRegistry();
    if (
      registry.some(
        (u) =>
          u.username.toLowerCase() === String(data.username).trim().toLowerCase() ||
          u.email.toLowerCase() === String(data.email).trim().toLowerCase()
      )
    ) {
      throw new Error('Username atau email sudah digunakan oleh akun lain.');
    }

    const newUser: StoredUserRecord = {
      id: `usr-${Date.now()}`,
      username: String(data.username).trim(),
      name: String(data.name).trim(),
      email: String(data.email).trim(),
      role: data.role === 'admin' ? 'admin' : 'petugas',
      is_active: true,
      password: data.password || 'kasir123',
      created_at: new Date().toISOString(),
    };
    registry.push(newUser);
    saveUserRegistry(registry);

    const { password: _p, ...clean } = newUser;
    return { success: true, message: 'Pengguna berhasil dibuat.', data: clean as User };
  },

  toggleUserStatus: async (id: string) => {
    const registry = loadUserRegistry();
    const u = registry.find((user) => user.id === id);
    if (!u) throw new Error('Pengguna tidak ditemukan.');
    u.is_active = !u.is_active;
    saveUserRegistry(registry);
    return { success: true, message: 'Status pengguna diubah.' };
  },

  deleteUser: async (id: string) => {
    const registry = loadUserRegistry();
    const filtered = registry.filter((user) => user.id !== id);
    saveUserRegistry(filtered);
    return { success: true, message: 'Pengguna berhasil dihapus.' };
  },

  resetPassword: async (id: string, new_password: string) => {
    const registry = loadUserRegistry();
    const u = registry.find((user) => user.id === id);
    if (!u) throw new Error('Pengguna tidak ditemukan.');
    u.password = new_password;
    saveUserRegistry(registry);
    return { success: true, message: 'Password berhasil direset.' };
  },

  getSettings: async () => {
    const { data, error } = await supabase.from('store_settings').select('*').limit(1);
    if (error) {
      throw new Error(formatSupabaseError(error, 'Gagal memuat pengaturan toko.'));
    }
    const row = data?.[0];
    if (row) {
      setStoredLogo(row.logo_url || undefined);
    }
    const fallback = clientDb.getData().settings;
    const settings: StoreSettings = row
      ? {
          store_name: row.store_name || fallback.store_name,
          address: row.address || '',
          phone: row.phone || '',
          receipt_footer: row.receipt_footer || '',
          default_min_stock: Number(row.default_min_stock || 10),
          currency_symbol: row.currency_symbol || 'Rp',
          logo_url: row.logo_url || undefined,
        }
      : { ...fallback, logo_url: getStoredLogo() || fallback.logo_url };
    return { success: true, data: settings };
  },

  updateSettings: async (data: any) => {
    if (data.logo_url !== undefined) {
      setStoredLogo(data.logo_url || undefined);
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1);
    if (fetchErr) {
      throw new Error(formatSupabaseError(fetchErr, 'Gagal memeriksa pengaturan toko di Supabase.'));
    }

    const logoVal = data.logo_url !== undefined ? data.logo_url || null : existing?.[0]?.logo_url || null;
    const payload = {
      store_name: data.store_name || 'Toko Sembako Berkah Mandiri',
      address: data.address || '',
      phone: data.phone || '',
      receipt_footer: data.receipt_footer || '',
      default_min_stock: Number(data.default_min_stock) || 10,
      currency_symbol: data.currency_symbol || 'Rp',
      logo_url: logoVal,
    };

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('store_settings')
        .update(payload)
        .eq('id', existing[0].id);
      if (error) {
        throw new Error(formatSupabaseError(error, 'Gagal memperbarui pengaturan toko ke Supabase.'));
      }
    } else {
      const { error } = await supabase.from('store_settings').insert({
        id: true,
        ...payload,
      });
      if (error) {
        throw new Error(formatSupabaseError(error, 'Gagal menyimpan pengaturan toko ke Supabase.'));
      }
    }

    return {
      success: true,
      message: 'Pengaturan toko & logo berhasil disimpan ke Supabase.',
      data: {
        store_name: payload.store_name,
        address: payload.address,
        phone: payload.phone,
        receipt_footer: payload.receipt_footer,
        default_min_stock: payload.default_min_stock,
        currency_symbol: payload.currency_symbol,
        logo_url: logoVal || getStoredLogo(),
      } as StoreSettings,
    };
  },

  // ----------------------------------------------------
  // SUPABASE DIAGNOSTICS & FULL TABLE RECONCILIATION
  // ----------------------------------------------------
  getSupabaseStatus: async (): Promise<SupabaseTableCounts> => {
    const tables = [
      'products',
      'categories',
      'suppliers',
      'stock_in_transactions',
      'stock_in_details',
      'sales_transactions',
      'sales_details',
      'stock_movements',
      'stock_adjustments',
      'store_settings',
    ] as const;

    const results = await Promise.all(
      tables.map((t) => supabase.from(t).select('id', { count: 'exact', head: true }))
    );

    const counts: Record<string, number> = {};
    tables.forEach((t, idx) => {
      counts[t] = results[idx].count ?? 0;
    });

    // Check which products have no movement record yet
    const [prodIdsRes, movProdIdsRes] = await Promise.all([
      supabase.from('products').select('id'),
      supabase.from('stock_movements').select('product_id'),
    ]);
    const movSet = new Set((movProdIdsRes.data || []).map((m: any) => m.product_id));
    const unsyncedProductsCount = (prodIdsRes.data || []).filter((p: any) => !movSet.has(p.id)).length;

    let rlsWriteAllowed: boolean | null = null;
    const { data: catProbe } = await supabase.from('categories').select('*').limit(1);
    if (catProbe && catProbe[0]) {
      const { error: probeErr } = await supabase
        .from('categories')
        .update({ name: catProbe[0].name })
        .eq('id', catProbe[0].id);
      rlsWriteAllowed = !probeErr;
    }

    return {
      products: counts.products,
      categories: counts.categories,
      suppliers: counts.suppliers,
      stock_in_transactions: counts.stock_in_transactions,
      stock_in_details: counts.stock_in_details,
      sales_transactions: counts.sales_transactions,
      sales_details: counts.sales_details,
      stock_movements: counts.stock_movements,
      stock_adjustments: counts.stock_adjustments,
      store_settings: counts.store_settings,
      unsyncedProductsCount,
      rlsWriteAllowed,
    };
  },

  syncDefaultsToSupabase: async (): Promise<{ message: string }> => {
    const defaults = clientDb.getData();
    const now = new Date().toISOString();
    const actions: string[] = [];

    // 1. Seed categories if empty
    const { count: catCount } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true });
    if ((catCount ?? 0) === 0) {
      const { error } = await supabase.from('categories').upsert(
        defaults.categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          created_at: c.created_at,
          updated_at: now,
        })),
        { onConflict: 'id' }
      );
      if (error) {
        throw new Error(formatSupabaseError(error, 'Gagal menyinkronkan tabel categories ke Supabase.'));
      }
      actions.push('kategori awal');
    }

    // 2. Seed suppliers if empty
    const { count: supCount } = await supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true });
    if ((supCount ?? 0) === 0) {
      const { error } = await supabase.from('suppliers').upsert(
        defaults.suppliers.map((s) => ({ ...s, created_at: now, updated_at: now })),
        { onConflict: 'id' }
      );
      if (error) {
        throw new Error(formatSupabaseError(error, 'Gagal menyinkronkan tabel suppliers ke Supabase.'));
      }
      actions.push('pemasok awal');
    }

    // 3. Seed store_settings if empty (boolean id = true)
    const { count: setCount } = await supabase
      .from('store_settings')
      .select('id', { count: 'exact', head: true });
    if ((setCount ?? 0) === 0) {
      const { error } = await supabase.from('store_settings').insert({
        id: true,
        store_name: defaults.settings.store_name,
        address: defaults.settings.address,
        phone: defaults.settings.phone,
        receipt_footer: defaults.settings.receipt_footer,
        default_min_stock: defaults.settings.default_min_stock,
        currency_symbol: defaults.settings.currency_symbol,
        logo_url: getStoredLogo() || null,
      });
      if (error) {
        throw new Error(formatSupabaseError(error, 'Gagal menyinkronkan tabel store_settings ke Supabase.'));
      }
      actions.push('pengaturan toko');
    }

    // 4. Reconcile products added directly in Supabase Table Editor without initial stock_movements
    const [{ data: allProds }, { data: allMovs }, { data: allSups }, { data: allSin }] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('stock_movements').select('product_id'),
      supabase.from('suppliers').select('id,name'),
      supabase.from('stock_in_transactions').select('*'),
    ]);

    const movProdSet = new Set((allMovs || []).map((m: any) => m.product_id));
    const missingMovements = (allProds || [])
      .filter((p: any) => !movProdSet.has(p.id))
      .map((p: any) => ({
        id: `mov-awal-${p.id}`,
        product_id: p.id,
        product_sku: p.sku,
        product_name: p.name,
        movement_date: (p.created_at || now).slice(0, 10),
        movement_type: 'IN',
        quantity_in: Number(p.current_stock || 0),
        quantity_out: 0,
        balance_before: 0,
        balance_after: Number(p.current_stock || 0),
        reference_type: 'stock_in',
        reference_id: 'trx-in-initial',
        reference_number: 'TRX-IN-SALDO-AWAL',
        user_id: 'usr-1',
        user_name: 'H. Sudirman (Pemilik Toko)',
        notes: 'Sinkronisasi saldo awal produk dari Supabase Table Editor',
        created_at: p.created_at || now,
      }));

    if (missingMovements.length > 0) {
      const { error: movInsErr } = await supabase.from('stock_movements').upsert(missingMovements, { onConflict: 'id' });
      if (movInsErr) {
        throw new Error(formatSupabaseError(movInsErr, 'Gagal menyinkronkan saldo awal mutasi stok.'));
      }
      actions.push(`${missingMovements.length} saldo awal mutasi stok`);
    }

    // 5. Fill any null supplier_name / user_name on stock_in_transactions
    const supNameMap = new Map((allSups || []).map((s: any) => [s.id, s.name]));
    let repairedTxCount = 0;
    for (const tx of allSin || []) {
      if (!tx.supplier_name || !tx.user_name) {
        const { error: txFixErr } = await supabase
          .from('stock_in_transactions')
          .update({
            supplier_name: tx.supplier_name || supNameMap.get(tx.supplier_id) || 'Pemasok',
            user_id: tx.user_id || 'usr-1',
            user_name: tx.user_name || 'H. Sudirman (Pemilik Toko)',
            updated_at: now,
          })
          .eq('id', tx.id);
        if (!txFixErr) repairedTxCount++;
      }
    }
    if (repairedTxCount > 0) {
      actions.push(`${repairedTxCount} data transaksi barang masuk`);
    }

    return {
      message:
        actions.length > 0
          ? `Sinkronisasi Supabase selesai (${actions.join(', ')} telah diselaraskan).`
          : 'Seluruh 10 tabel Supabase dan isiannya sudah dalam kondisi sinkron.',
    };
  },
};
