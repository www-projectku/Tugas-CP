import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, setStoredToken, getStoredToken, getStoredUser, clearStoredToken } from './services/api.js';
import { supabase } from './lib/supabaseClient.js';
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
  StoreSettings
} from './types/index.js';
import { Header } from './components/Header.js';
import { Sidebar, NavTab } from './components/Sidebar.js';
import { DashboardView } from './components/DashboardView.js';
import { ProductsView } from './components/ProductsView.js';
import { CategoriesView } from './components/CategoriesView.js';
import { SuppliersView } from './components/SuppliersView.js';
import { StockInView } from './components/StockInView.js';
import { StockOutView } from './components/StockOutView.js';
import { StockOpnameView } from './components/StockOpnameView.js';
import { StockMovementsView } from './components/StockMovementsView.js';
import { ReportsView } from './components/ReportsView.js';
import { UsersView } from './components/UsersView.js';
import { SettingsView } from './components/SettingsView.js';
import { LoginModal } from './components/LoginModal.js';
import { AccessDenied } from './components/AccessDenied.js';

export default function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [productsInitialFilter, setProductsInitialFilter] = useState('all');

  // Application Data States
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockInList, setStockInList] = useState<StockInTransaction[]>([]);
  const [salesList, setSalesList] = useState<SaleTransaction[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // 1. Initial State: Restore active session if stored, else show login
  useEffect(() => {
    const token = getStoredToken();
    const cachedUser = getStoredUser();

    if (token && cachedUser) {
      api.getCurrentUser()
        .then((res) => {
          if (res?.user) {
            setCurrentUser(res.user);
          } else {
            clearStoredToken();
            setCurrentUser(null);
          }
        })
        .catch(() => {
          // If offline / local dev
          setCurrentUser(cachedUser);
        })
        .finally(() => {
          setAuthChecked(true);
        });
    } else {
      clearStoredToken();
      setCurrentUser(null);
      setAuthChecked(true);
    }
  }, []);

  const lastSyncRef = useRef<number>(0);

  // 2. Fetch Master and Operational Data via Unified Bootstrap (1 Single Roundtrip)
  const refreshAllData = useCallback(async (silent = false) => {
    if (!currentUser) return;
    try {
      if (!silent) setDashboardLoading(true);
      const res = await api.bootstrap();
      if (res && res.data) {
        const {
          dashboard,
          products,
          categories,
          suppliers,
          stockInList,
          salesList,
          stockMovements,
          stockAdjustments,
          settings,
        } = res.data;

        if (dashboard) {
          setDashboardData(dashboard);
        }
        if (products) setProducts(products);
        if (categories) setCategories(categories);
        if (suppliers) setSuppliers(suppliers);
        if (stockInList) setStockInList(stockInList);
        if (salesList) setSalesList(salesList);
        if (stockMovements) setStockMovements(stockMovements);
        if (stockAdjustments) setStockAdjustments(stockAdjustments);
        if (settings) setSettings(settings);
        setBootstrapError(null);
        lastSyncRef.current = Date.now();
      }
    } catch (err: any) {
      console.error('Error bootstrapping application data:', err);
      setBootstrapError(err?.message || 'Gagal memuat data dari Supabase.');
    } finally {
      if (!silent) setDashboardLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    refreshAllData(false);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSilentRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refreshAllData(true);
      }, 400);
    };

    // Realtime sync from Supabase Table Editor or other devices
    const channel = supabase
      .channel('app-db-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_in_transactions' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_in_details' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_transactions' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_details' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_adjustments' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, scheduleSilentRefresh)
      .subscribe();

    // Auto re-sync when returning to tab (e.g. after editing in Supabase Table Editor)
    const handleFocusSync = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastSyncRef.current > 3000) {
        refreshAllData(true);
      }
    };
    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);

    // Fallback background sync every 8s while tab is visible (handles edits from Table Editor even if Realtime publication is off)
    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshAllData(true);
      }
    }, 8000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleFocusSync);
      supabase.removeChannel(channel);
    };
  }, [currentUser, refreshAllData]);

  // Enforce role-based access redirection if staff lands on restricted tab
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      if (activeTab === 'stock-opname' || activeTab === 'users' || activeTab === 'settings') {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser, activeTab]);

  // Auth actions
  const handleLogin = async (credentials: { username: string; password: string }) => {
    const res = await api.login(credentials);
    setStoredToken(res.token);
    setCurrentUser(res.user);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    clearStoredToken();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Tab Title helper
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard Stok Barang';
      case 'products':
        return 'Data Barang';
      case 'categories':
        return 'Kategori Barang';
      case 'suppliers':
        return 'Data Pemasok & Distributor';
      case 'stock-in':
        return 'Pencatatan Barang Masuk';
      case 'stock-out':
        return 'Pencatatan Barang Keluar';
      case 'stock-opname':
        return 'Stok Opname';
      case 'stock-movements':
        return 'Riwayat Stok';
      case 'reports':
        return 'Laporan Stok';
      case 'users':
        return 'Manajemen Pengguna & Otorisasi RBAC';
      case 'settings':
        return 'Pengaturan & Profil Toko';
      default:
        return 'Sistem Informasi Manajemen Stok';
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400">Memuat Sistem Informasi Toko Sembako...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show manual login form
  if (!currentUser) {
    return <LoginModal onLogin={handleLogin} />;
  }

  // Calculate low stock alert count
  const lowStockCount = (dashboardData?.lowStockCount || 0) + (dashboardData?.outOfStockCount || 0);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={currentUser}
        settings={settings}
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          user={currentUser}
          settings={settings}
          onLogout={handleLogout}
          lowStockCount={lowStockCount}
          onNavigateToLowStock={() => {
            setProductsInitialFilter('critical');
            setActiveTab('products');
          }}
          onToggleSidebarMobile={() => setIsSidebarMobileOpen((prev) => !prev)}
          activeTabTitle={getTabTitle()}
        />

        {/* View Router */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1">
          {bootstrapError && (
            <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-wrap items-center justify-between gap-3">
              <span>{bootstrapError}</span>
              <button
                type="button"
                onClick={() => refreshAllData(false)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
              >
                Muat Ulang Data
              </button>
            </div>
          )}
          {activeTab === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              loading={dashboardLoading}
              user={currentUser}
              onNavigateToStockIn={() => setActiveTab('stock-in')}
              onNavigateToProducts={(status) => {
                setProductsInitialFilter(status || 'all');
                setActiveTab('products');
              }}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              user={currentUser}
              onRefresh={() => refreshAllData(true)}
              onCreateProduct={async (data) => {
                await api.createProduct(data);
                await refreshAllData(true);
              }}
              onUpdateProduct={async (id, data) => {
                await api.updateProduct(id, data);
                await refreshAllData(true);
              }}
              onToggleStatus={async (id) => {
                await api.toggleProductStatus(id);
                await refreshAllData(true);
              }}
              onDeleteProduct={async (id) => {
                await api.deleteProduct(id);
                await refreshAllData(true);
              }}
              initialFilterStatus={productsInitialFilter}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              categories={categories}
              user={currentUser}
              onRefresh={() => refreshAllData(true)}
              onCreateCategory={async (data) => {
                await api.createCategory(data);
                await refreshAllData(true);
              }}
              onUpdateCategory={async (id, data) => {
                await api.updateCategory(id, data);
                await refreshAllData(true);
              }}
              onDeleteCategory={async (id) => {
                await api.deleteCategory(id);
                await refreshAllData(true);
              }}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              user={currentUser}
              onRefresh={() => refreshAllData(true)}
              onCreateSupplier={async (data) => {
                await api.createSupplier(data);
                await refreshAllData(true);
              }}
              onUpdateSupplier={async (id, data) => {
                await api.updateSupplier(id, data);
                await refreshAllData(true);
              }}
              onToggleStatus={async (id) => {
                await api.toggleSupplierStatus(id);
                await refreshAllData(true);
              }}
              onDeleteSupplier={async (id) => {
                await api.deleteSupplier(id);
                await refreshAllData(true);
              }}
            />
          )}

          {activeTab === 'stock-in' && (
            <StockInView
              suppliers={suppliers}
              products={products}
              stockInList={stockInList}
              user={currentUser}
              onRefresh={() => refreshAllData(true)}
              onCreateStockIn={async (data) => {
                await api.createStockIn(data);
                await refreshAllData(true);
              }}
              onCancelStockIn={async (id, reason) => {
                await api.cancelStockIn(id, reason);
                await refreshAllData(true);
              }}
            />
          )}

          {activeTab === 'stock-out' && (
            <StockOutView
              products={products}
              user={currentUser}
              onRefresh={() => refreshAllData(true)}
              onCreateStockOut={async (data) => {
                const result = await api.createStockOut(data);
                await refreshAllData(true);
                return result;
              }}
            />
          )}

          {activeTab === 'stock-opname' && (
            currentUser.role === 'admin' ? (
              <StockOpnameView
                products={products}
                adjustments={stockAdjustments}
                user={currentUser}
                onRefresh={() => refreshAllData(true)}
                onCreateAdjustment={async (data) => {
                  await api.createStockAdjustment(data);
                  await refreshAllData(true);
                }}
              />
            ) : (
              <AccessDenied
                title="Akses Terbatas: Khusus Administrator"
                message="Stok opname dan penyesuaian persediaan hanya dapat dilakukan oleh Admin. Petugas dapat melaporkan hasil pemeriksaan fisik kepada Admin."
                onBack={() => setActiveTab('dashboard')}
              />
            )
          )}

          {activeTab === 'stock-movements' && (
            <StockMovementsView
              movements={stockMovements}
              products={products}
              onRefresh={() => refreshAllData(true)}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView categories={categories} settings={settings} user={currentUser} />
          )}

          {activeTab === 'users' && (
            currentUser?.role === 'admin' ? (
              <UsersView currentUser={currentUser} />
            ) : (
              <AccessDenied
                title="Akses Terbatas: Khusus Administrator"
                message="Manajemen Pengguna dan Penugasan Hak Akses Petugas hanya dapat diakses oleh Pemilik Toko (Admin)."
                onBack={() => setActiveTab('dashboard')}
              />
            )
          )}

          {activeTab === 'settings' && (
            currentUser?.role === 'admin' ? (
              <SettingsView
                settings={settings}
                onUpdateSettings={async (data) => {
                  await api.updateSettings(data);
                  await refreshAllData(true);
                }}
                onRefresh={() => refreshAllData(true)}
              />
            ) : (
              <AccessDenied
                title="Akses Terbatas: Khusus Administrator"
                message="Pengaturan Profil Toko, Alamat, dan Format Struk Cetak hanya dapat diubah oleh Pemilik Toko (Admin)."
                onBack={() => setActiveTab('dashboard')}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
}
