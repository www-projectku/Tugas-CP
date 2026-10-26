import React, { useState, useEffect, useCallback } from 'react';
import { api, setStoredToken, getStoredToken, getStoredUser, clearStoredToken } from './services/api.js';
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
import { SalesPosView } from './components/SalesPosView.js';
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

  // 2. Fetch Master and Operational Data via Unified Bootstrap (1 Single Roundtrip)
  const refreshAllData = useCallback(async () => {
    if (!currentUser) return;
    try {
      setDashboardLoading(true);
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

        if (dashboard) setDashboardData(dashboard);
        if (products) setProducts(products);
        if (categories) setCategories(categories);
        if (suppliers) setSuppliers(suppliers);
        if (stockInList) setStockInList(stockInList);
        if (salesList) setSalesList(salesList);
        if (stockMovements) setStockMovements(stockMovements);
        if (stockAdjustments) setStockAdjustments(stockAdjustments);
        if (settings) setSettings(settings);
      }
    } catch (err) {
      console.error('Error bootstrapping application data:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      refreshAllData();
    }
  }, [currentUser, refreshAllData]);

  // Enforce role-based access redirection if staff lands on restricted tab
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      if (activeTab === 'users' || activeTab === 'settings') {
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
        return 'Dashboard Persediaan Sembako';
      case 'products':
        return 'Data Barang & Master SKU';
      case 'categories':
        return 'Kategori Komoditas Sembako';
      case 'suppliers':
        return 'Data Pemasok & Distributor';
      case 'stock-in':
        return 'Transaksi Penerimaan Barang Masuk';
      case 'sales-pos':
        return 'Kasir Penjualan (Point of Sale)';
      case 'stock-opname':
        return 'Stok Opname & Penyesuaian Fisik';
      case 'stock-movements':
        return 'Buku Besar Pergerakan Stok (Audit Ledger)';
      case 'reports':
        return 'Pusat Laporan & Rekapitulasi';
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
              onNavigateToSales={() => setActiveTab('sales-pos')}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              user={currentUser}
              onRefresh={refreshAllData}
              onCreateProduct={async (data) => {
                await api.createProduct(data);
                refreshAllData();
              }}
              onUpdateProduct={async (id, data) => {
                await api.updateProduct(id, data);
                refreshAllData();
              }}
              onToggleStatus={async (id) => {
                await api.toggleProductStatus(id);
                refreshAllData();
              }}
              onDeleteProduct={async (id) => {
                await api.deleteProduct(id);
                refreshAllData();
              }}
              initialFilterStatus={productsInitialFilter}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              categories={categories}
              user={currentUser}
              onRefresh={refreshAllData}
              onCreateCategory={async (data) => {
                await api.createCategory(data);
                refreshAllData();
              }}
              onUpdateCategory={async (id, data) => {
                await api.updateCategory(id, data);
                refreshAllData();
              }}
              onDeleteCategory={async (id) => {
                await api.deleteCategory(id);
                refreshAllData();
              }}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              user={currentUser}
              onRefresh={refreshAllData}
              onCreateSupplier={async (data) => {
                await api.createSupplier(data);
                refreshAllData();
              }}
              onUpdateSupplier={async (id, data) => {
                await api.updateSupplier(id, data);
                refreshAllData();
              }}
              onToggleStatus={async (id) => {
                await api.toggleSupplierStatus(id);
                refreshAllData();
              }}
              onDeleteSupplier={async (id) => {
                await api.deleteSupplier(id);
                refreshAllData();
              }}
            />
          )}

          {activeTab === 'stock-in' && (
            <StockInView
              suppliers={suppliers}
              products={products}
              stockInList={stockInList}
              user={currentUser}
              onRefresh={refreshAllData}
              onCreateStockIn={async (data) => {
                await api.createStockIn(data);
                refreshAllData();
              }}
              onCancelStockIn={async (id, reason) => {
                await api.cancelStockIn(id, reason);
                refreshAllData();
              }}
            />
          )}

          {activeTab === 'sales-pos' && (
            <SalesPosView
              products={products}
              categories={categories}
              salesList={salesList}
              settings={settings}
              user={currentUser}
              onRefresh={refreshAllData}
              onCreateSale={async (data) => {
                const res = await api.createSale(data);
                refreshAllData();
                return res.data;
              }}
              onCancelSale={async (id, reason) => {
                await api.cancelSale(id, reason);
                refreshAllData();
              }}
            />
          )}

          {activeTab === 'stock-opname' && (
            <StockOpnameView
              products={products}
              adjustments={stockAdjustments}
              user={currentUser}
              onRefresh={refreshAllData}
              onCreateAdjustment={async (data) => {
                await api.createStockAdjustment(data);
                refreshAllData();
              }}
            />
          )}

          {activeTab === 'stock-movements' && (
            <StockMovementsView
              movements={stockMovements}
              products={products}
              onRefresh={refreshAllData}
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
                  refreshAllData();
                }}
                onRefresh={refreshAllData}
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
