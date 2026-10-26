import { clientDb } from './clientDb.js';
import {
  User,
  Product,
  Category,
  Supplier,
  StockInTransaction,
  SaleTransaction,
  StockMovement,
  StockAdjustment,
  DashboardData,
  StoreSettings,
  BootstrapData
} from '../types/index.js';

const TOKEN_KEY = 'sembako_auth_token';
const USER_KEY = 'sembako_auth_user';

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

// Check if running on GitHub Pages or static host without backend
const isStaticHost =
  typeof window !== 'undefined' &&
  (window.location.hostname.endsWith('github.io') ||
   window.location.protocol === 'file:' ||
   window.location.pathname.includes('/CP-Tugas'));

let backendCheckPromise: Promise<boolean> | null = null;
let cachedBackendStatus: boolean | null = isStaticHost ? false : null;

export async function checkBackend(): Promise<boolean> {
  if (cachedBackendStatus !== null) return cachedBackendStatus;
  if (!backendCheckPromise) {
    backendCheckPromise = (async () => {
      try {
        const res = await fetch('/api/health');
        cachedBackendStatus = res.ok;
        return cachedBackendStatus;
      } catch {
        cachedBackendStatus = false;
        return false;
      } finally {
        // Allow re-checking after 15 seconds if server was rebooting
        setTimeout(() => {
          backendCheckPromise = null;
          if (cachedBackendStatus === false) cachedBackendStatus = null;
        }, 15000);
      }
    })();
  }
  return backendCheckPromise;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isOnline = await checkBackend();
  if (!isOnline) {
    throw new Error('BACKEND_UNAVAILABLE');
  }

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    cachedBackendStatus = false;
    throw new Error('BACKEND_UNAVAILABLE');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('BACKEND_UNAVAILABLE');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.message || `Permintaan gagal (${response.status})`, response.status);
  }

  return data;
}

export const api = {
  // ----------------------------------------------------
  // UNIFIED BOOTSTRAP (1 HTTP Call for 10x Performance)
  // ----------------------------------------------------
  bootstrap: async (): Promise<{ success: boolean; data: BootstrapData }> => {
    try {
      return await request<{ success: boolean; data: BootstrapData }>('/bootstrap');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Static fallback
      return {
        success: true,
        data: clientDb.getBootstrapData(),
      };
    }
  },

  // ----------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------
  login: async (credentials: { username: string; password: string }) => {
    try {
      const res = await request<{ success: boolean; token: string; user: User; message: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      setStoredToken(res.token);
      setStoredUser(res.user);
      return res;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Fallback for static host
      const users = clientDb.getData().users;
      const user = users.find(
        (u) =>
          u.username.toLowerCase() === credentials.username.toLowerCase() ||
          u.email.toLowerCase() === credentials.username.toLowerCase()
      );
      if (!user) throw new Error('Username atau password salah.');
      const token = `tok_${user.role}_${user.id}_static_${Date.now()}`;
      setStoredToken(token);
      setStoredUser(user);
      return { success: true, token, user, message: 'Login berhasil.' };
    }
  },

  getCurrentUser: async () => {
    try {
      const res = await request<{ success: boolean; user: User }>('/auth/me');
      setStoredUser(res.user);
      return res;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearStoredToken();
        throw err;
      }
      const cached = getStoredUser();
      if (cached) return { success: true, user: cached };
      const admin = clientDb.getData().users[0];
      setStoredUser(admin);
      return { success: true, user: admin };
    }
  },

  logout: async () => {
    try {
      await request<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' });
    } catch {}
    clearStoredToken();
    return { success: true, message: 'Logout berhasil.' };
  },

  // ----------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------
  getDashboardSummary: async () => {
    try {
      return await request<{ success: boolean; data: DashboardData }>('/dashboard/summary');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return { success: true, data: clientDb.getDashboardSummary() };
    }
  },

  // ----------------------------------------------------
  // PRODUCTS & MASTER SKU
  // ----------------------------------------------------
  getProducts: async (params?: { category_id?: string; stock_status?: string; search?: string }) => {
    try {
      const q = new URLSearchParams();
      if (params?.category_id) q.set('category_id', params.category_id);
      if (params?.stock_status) q.set('stock_status', params.stock_status);
      if (params?.search) q.set('search', params.search);
      return await request<{ success: boolean; data: Product[]; total: number }>(`/products?${q.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const list = clientDb.getProducts(params);
      return { success: true, data: list, total: list.length };
    }
  },

  getProductDetail: async (id: string) => {
    try {
      return await request<{ success: boolean; data: Product & { movements: StockMovement[] } }>(`/products/${id}`);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const p = clientDb.getData().products.find((i) => i.id === id);
      const cat = clientDb.getData().categories.find((c) => c.id === p?.category_id);
      const movements = clientDb.getData().stock_movements
        .filter((m) => m.product_id === id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { success: true, data: { ...p!, category_name: cat?.name, movements } };
    }
  },

  createProduct: async (data: any) => {
    try {
      return await request<{ success: boolean; message: string; data: Product }>('/products', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const p = clientDb.createProduct(data);
      return { success: true, message: 'Barang berhasil disimpan.', data: p };
    }
  },

  updateProduct: async (id: string, data: any) => {
    try {
      return await request<{ success: boolean; message: string; data: Product }>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const p = clientDb.updateProduct(id, data);
      return { success: true, message: 'Barang berhasil diperbarui.', data: p };
    }
  },

  toggleProductStatus: async (id: string) => {
    try {
      return await request<{ success: boolean; message: string; data: Product }>(`/products/${id}/toggle-status`, {
        method: 'PATCH',
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const p = clientDb.toggleProductStatus(id);
      return { success: true, message: 'Status barang diubah.', data: p };
    }
  },

  deleteProduct: async (id: string) => {
    try {
      return await request<{ success: boolean; message: string }>(`/products/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      clientDb.deleteProduct(id);
      return { success: true, message: 'Barang berhasil dinonaktifkan.' };
    }
  },

  // ----------------------------------------------------
  // CATEGORIES
  // ----------------------------------------------------
  getCategories: async () => {
    try {
      return await request<{ success: boolean; data: Category[] }>('/categories');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const cats = clientDb.getData().categories.map((c) => ({
        ...c,
        product_count: clientDb.getData().products.filter((p) => p.category_id === c.id).length,
      }));
      return { success: true, data: cats };
    }
  },

  createCategory: async (data: { name: string; description?: string }) => {
    try {
      return await request<{ success: boolean; message: string; data: Category }>('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const newCat: Category = {
        id: `cat-${Date.now()}`,
        name: data.name,
        description: data.description || '',
        created_at: new Date().toISOString(),
      };
      clientDb.getData().categories.push(newCat);
      return { success: true, message: 'Kategori berhasil ditambahkan.', data: newCat };
    }
  },

  updateCategory: async (id: string, data: { name: string; description?: string }) => {
    try {
      return await request<{ success: boolean; message: string; data: Category }>(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const c = clientDb.getData().categories.find((cat) => cat.id === id);
      if (c) {
        c.name = data.name;
        if (data.description !== undefined) c.description = data.description;
      }
      return { success: true, message: 'Kategori berhasil diubah.', data: c! };
    }
  },

  deleteCategory: async (id: string) => {
    try {
      return await request<{ success: boolean; message: string }>(`/categories/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const idx = clientDb.getData().categories.findIndex((cat) => cat.id === id);
      if (idx !== -1) clientDb.getData().categories.splice(idx, 1);
      return { success: true, message: 'Kategori berhasil dihapus.' };
    }
  },

  // ----------------------------------------------------
  // SUPPLIERS
  // ----------------------------------------------------
  getSuppliers: async () => {
    try {
      return await request<{ success: boolean; data: Supplier[] }>('/suppliers');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return { success: true, data: clientDb.getData().suppliers };
    }
  },

  createSupplier: async (data: any) => {
    try {
      return await request<{ success: boolean; message: string; data: Supplier }>('/suppliers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        code: data.code || `SUP-${String(clientDb.getData().suppliers.length + 1).padStart(3, '0')}`,
        name: data.name,
        contact_person: data.contact_person,
        phone: data.phone,
        address: data.address || '',
        notes: data.notes || '',
        is_active: true,
      };
      clientDb.getData().suppliers.push(newSup);
      return { success: true, message: 'Pemasok berhasil ditambahkan.', data: newSup };
    }
  },

  updateSupplier: async (id: string, data: any) => {
    try {
      return await request<{ success: boolean; message: string; data: Supplier }>(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const s = clientDb.getData().suppliers.find((sup) => sup.id === id);
      if (s) {
        if (data.name) s.name = data.name;
        if (data.contact_person) s.contact_person = data.contact_person;
        if (data.phone) s.phone = data.phone;
        if (data.address !== undefined) s.address = data.address;
        if (data.notes !== undefined) s.notes = data.notes;
        if (data.is_active !== undefined) s.is_active = Boolean(data.is_active);
      }
      return { success: true, message: 'Pemasok berhasil diubah.', data: s! };
    }
  },

  toggleSupplierStatus: async (id: string) => {
    try {
      return await request<{ success: boolean; message: string; data: Supplier }>(`/suppliers/${id}/toggle-status`, {
        method: 'PATCH',
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const s = clientDb.getData().suppliers.find((sup) => sup.id === id);
      if (s) s.is_active = !s.is_active;
      return { success: true, message: 'Status pemasok diubah.', data: s! };
    }
  },

  deleteSupplier: async (id: string) => {
    try {
      return await request<{ success: boolean; message: string }>(`/suppliers/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const idx = clientDb.getData().suppliers.findIndex((sup) => sup.id === id);
      if (idx !== -1) clientDb.getData().suppliers.splice(idx, 1);
      return { success: true, message: 'Pemasok berhasil dihapus.' };
    }
  },

  // ----------------------------------------------------
  // STOCK IN (PENGADAAN SEMBAKO)
  // ----------------------------------------------------
  getStockInList: async (params?: { start_date?: string; end_date?: string }) => {
    try {
      const q = new URLSearchParams();
      if (params?.start_date) q.set('start_date', params.start_date);
      if (params?.end_date) q.set('end_date', params.end_date);
      return await request<{ success: boolean; data: StockInTransaction[] }>(`/stock-in?${q.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return { success: true, data: clientDb.getData().stock_in_transactions };
    }
  },

  createStockIn: async (data: any) => {
    try {
      return await request<{ success: boolean; message: string; data: StockInTransaction }>('/stock-in', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const user = getStoredUser();
      const tx = clientDb.createStockIn(data, user);
      return { success: true, message: 'Barang masuk berhasil disimpan.', data: tx };
    }
  },

  cancelStockIn: async (id: string, reason: string) => {
    try {
      return await request<{ success: boolean; message: string; data: StockInTransaction }>(`/stock-in/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const tx = clientDb.getData().stock_in_transactions.find((t) => t.id === id);
      if (tx) tx.status = 'cancelled';
      return { success: true, message: 'Transaksi dibatalkan.', data: tx! };
    }
  },

  // ----------------------------------------------------
  // SALES (KASIR POS)
  // ----------------------------------------------------
  getSalesList: async (params?: { start_date?: string; end_date?: string }) => {
    try {
      const q = new URLSearchParams();
      if (params?.start_date) q.set('start_date', params.start_date);
      if (params?.end_date) q.set('end_date', params.end_date);
      return await request<{ success: boolean; data: SaleTransaction[] }>(`/sales?${q.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return { success: true, data: clientDb.getData().sales_transactions };
    }
  },

  createSale: async (data: any) => {
    try {
      return await request<{ success: boolean; message: string; data: SaleTransaction }>('/sales', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const user = getStoredUser();
      const sale = clientDb.createSale(data, user);
      return { success: true, message: 'Penjualan berhasil disimpan.', data: sale };
    }
  },

  cancelSale: async (id: string, reason: string) => {
    try {
      return await request<{ success: boolean; message: string; data: SaleTransaction }>(`/sales/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const s = clientDb.getData().sales_transactions.find((t) => t.id === id);
      if (s) s.status = 'cancelled';
      return { success: true, message: 'Penjualan dibatalkan.', data: s! };
    }
  },

  // ----------------------------------------------------
  // STOCK ADJUSTMENTS & OPNAME
  // ----------------------------------------------------
  getStockAdjustments: async () => {
    try {
      return await request<{ success: boolean; data: StockAdjustment[] }>('/stock/adjustments');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return { success: true, data: clientDb.getData().stock_adjustments || [] };
    }
  },

  createStockAdjustment: async (data: { product_id: string; physical_stock: number; reason: string }) => {
    try {
      return await request<{ success: boolean; message: string; data: StockAdjustment }>('/stock/adjustments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const user = getStoredUser();
      const adj = clientDb.createAdjustment(data, user);
      return { success: true, message: 'Penyesuaian stok berhasil disimpan.', data: adj };
    }
  },

  // ----------------------------------------------------
  // STOCK MOVEMENTS (BUKU BESAR MUTASI LEDGER)
  // ----------------------------------------------------
  getStockMovements: async (params?: { product_id?: string; movement_type?: string; start_date?: string; end_date?: string }) => {
    try {
      const q = new URLSearchParams();
      if (params?.product_id) q.set('product_id', params.product_id);
      if (params?.movement_type) q.set('movement_type', params.movement_type);
      if (params?.start_date) q.set('start_date', params.start_date);
      if (params?.end_date) q.set('end_date', params.end_date);
      return await request<{ success: boolean; data: StockMovement[] }>(`/stock/movements?${q.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      let list = [...clientDb.getData().stock_movements];
      if (params?.product_id && params.product_id !== 'all') list = list.filter((m) => m.product_id === params.product_id);
      if (params?.movement_type && params.movement_type !== 'all') list = list.filter((m) => m.movement_type === params.movement_type);
      return { success: true, data: list };
    }
  },

  // ----------------------------------------------------
  // REPORTS
  // ----------------------------------------------------
  getCurrentStockReport: async (category_id?: string) => {
    try {
      const q = new URLSearchParams();
      if (category_id) q.set('category_id', category_id);
      return await request<{ success: boolean; data: any }>(`/reports/current-stock?${q.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const catMap = new Map(clientDb.getData().categories.map((c) => [c.id, c.name]));
      let prods = clientDb.getData().products.filter((p) => p.is_active);
      if (category_id && category_id !== 'all') prods = prods.filter((p) => p.category_id === category_id);
      const items = prods.map((p) => ({
        sku: p.sku,
        name: p.name,
        category: catMap.get(p.category_id) || '-',
        unit: p.unit,
        current_stock: p.current_stock,
        min_stock: p.min_stock,
        purchase_price: p.purchase_price,
        selling_price: p.selling_price,
        valuation: p.current_stock * p.purchase_price,
        potentialRevenue: p.current_stock * p.selling_price,
        potentialMargin: p.current_stock * (p.selling_price - p.purchase_price),
        status: p.current_stock <= 0 ? 'HABIS' : p.current_stock <= p.min_stock ? 'MENIPIS' : 'AMAN',
      }));
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
    }
  },

  getStockInReport: async (params?: { start_date?: string; end_date?: string; supplier_id?: string }) => {
    try {
      const q = new URLSearchParams();
      if (params?.start_date) q.set('start_date', params.start_date);
      if (params?.end_date) q.set('end_date', params.end_date);
      if (params?.supplier_id) q.set('supplier_id', params.supplier_id);
      return await request<{ success: boolean; data: any }>(`/reports/stock-in?${q.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const txs = clientDb.getData().stock_in_transactions.filter((t) => t.status === 'completed');
      const flat: any[] = [];
      let total = 0;
      let qty = 0;
      for (const t of txs) {
        for (const it of t.items) {
          flat.push({
            transaction_number: t.transaction_number,
            transaction_date: t.transaction_date,
            supplier_name: t.supplier_name,
            user_name: t.user_name,
            sku: it.product_sku,
            name: it.product_name,
            unit: it.unit,
            quantity: it.quantity,
            purchase_price: it.purchase_price,
            subtotal: it.subtotal,
          });
          total += it.subtotal;
          qty += it.quantity;
        }
      }
      return { success: true, data: { items: flat, summary: { totalTransactions: txs.length, totalQuantity: qty, totalAmount: total } } };
    }
  },

  getSalesReport: async (params?: { start_date?: string; end_date?: string }) => {
    try {
      const q = new URLSearchParams();
      if (params?.start_date) q.set('start_date', params.start_date);
      if (params?.end_date) q.set('end_date', params.end_date);
      return await request<{ success: boolean; data: any }>(`/reports/sales?${q.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const txs = clientDb.getData().sales_transactions.filter((t) => t.status === 'completed');
      const flat: any[] = [];
      let totalRev = 0;
      let totalHpp = 0;
      let totalQty = 0;
      for (const t of txs) {
        for (const it of t.items) {
          const hpp = (it.purchase_price_snapshot || 0) * it.quantity;
          flat.push({
            transaction_number: t.transaction_number,
            transaction_date: t.transaction_date,
            cashier_name: t.cashier_name,
            payment_method: t.payment_method,
            sku: it.product_sku,
            name: it.product_name,
            unit: it.unit,
            quantity: it.quantity,
            selling_price: it.selling_price,
            purchase_price: it.purchase_price_snapshot || 0,
            subtotal: it.subtotal,
            hpp,
            profit: it.subtotal - hpp,
          });
          totalRev += it.subtotal;
          totalHpp += hpp;
          totalQty += it.quantity;
        }
      }
      return {
        success: true,
        data: {
          items: flat,
          summary: {
            totalTransactions: txs.length,
            totalQuantity: totalQty,
            totalRevenue: totalRev,
            totalHpp,
            grossProfit: totalRev - totalHpp,
            marginPercentage: totalRev > 0 ? Number((((totalRev - totalHpp) / totalRev) * 100).toFixed(2)) : 0,
          },
        },
      };
    }
  },

  getLowStockReport: async () => {
    try {
      return await request<{ success: boolean; data: any }>('/reports/low-stock');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const catMap = new Map(clientDb.getData().categories.map((c) => [c.id, c.name]));
      const items = clientDb.getData().products
        .filter((p) => p.is_active && p.current_stock <= p.min_stock)
        .map((p) => ({
          sku: p.sku,
          name: p.name,
          category: catMap.get(p.category_id) || '-',
          unit: p.unit,
          current_stock: p.current_stock,
          min_stock: p.min_stock,
          deficit: Math.max(0, p.min_stock - p.current_stock),
          recommended_order: Math.max(10, p.min_stock - p.current_stock + 15),
          estimated_cost: Math.max(10, p.min_stock - p.current_stock + 15) * p.purchase_price,
          status: p.current_stock <= 0 ? 'HABIS' : 'MENIPIS',
        }));
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
    }
  },

  // ----------------------------------------------------
  // USERS & SETTINGS
  // ----------------------------------------------------
  getUsers: async () => {
    try {
      return await request<{ success: boolean; data: User[] }>('/users');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return { success: true, data: clientDb.getData().users };
    }
  },

  createUser: async (data: any) => {
    try {
      return await request<{ success: boolean; message: string; data: User }>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const newUser: User = {
        id: `usr-${Date.now()}`,
        username: data.username,
        name: data.name,
        email: data.email,
        role: data.role || 'petugas',
        is_active: true,
      };
      clientDb.getData().users.push(newUser);
      return { success: true, message: 'Pengguna berhasil dibuat.', data: newUser };
    }
  },

  toggleUserStatus: async (id: string) => {
    try {
      return await request<{ success: boolean; message: string }>(`/users/${id}/toggle-status`, {
        method: 'PATCH',
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const u = clientDb.getData().users.find((user) => user.id === id);
      if (u) u.is_active = !u.is_active;
      return { success: true, message: 'Status pengguna diubah.' };
    }
  },

  deleteUser: async (id: string) => {
    try {
      return await request<{ success: boolean; message: string }>(`/users/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const idx = clientDb.getData().users.findIndex((user) => user.id === id);
      if (idx !== -1) clientDb.getData().users.splice(idx, 1);
      return { success: true, message: 'Pengguna berhasil dihapus.' };
    }
  },

  resetPassword: async (id: string, new_password: string) => {
    try {
      return await request<{ success: boolean; message: string }>(`/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password }),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return { success: true, message: 'Password berhasil direset.' };
    }
  },

  getSettings: async () => {
    try {
      return await request<{ success: boolean; data: StoreSettings }>('/settings');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return { success: true, data: clientDb.getData().settings };
    }
  },

  updateSettings: async (data: any) => {
    try {
      return await request<{ success: boolean; message: string; data: StoreSettings }>('/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const s = clientDb.getData().settings;
      if (data.store_name) s.store_name = data.store_name;
      if (data.address) s.address = data.address;
      if (data.phone) s.phone = data.phone;
      if (data.receipt_footer) s.receipt_footer = data.receipt_footer;
      if (data.default_min_stock) s.default_min_stock = Number(data.default_min_stock);
      if (data.logo_url !== undefined) s.logo_url = data.logo_url;
      return { success: true, message: 'Pengaturan disimpan.', data: s };
    }
  },
};
