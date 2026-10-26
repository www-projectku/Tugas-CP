import React from 'react';
import { User, StoreSettings } from '../types/index.js';
import { StoreLogo } from './StoreLogo.js';
import {
  LayoutDashboard,
  Package,
  Layers,
  Truck,
  ArrowDownLeft,
  ShoppingCart,
  Sliders,
  History,
  BarChart3,
  Users,
  Settings,
  X
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'suppliers'
  | 'stock-in'
  | 'sales-pos'
  | 'stock-opname'
  | 'stock-movements'
  | 'reports'
  | 'users'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: User | null;
  settings: StoreSettings | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  settings,
  isOpenMobile,
  onCloseMobile,
}) => {
  const isAdmin = user?.role === 'admin';

  const navItem = (
    tab: NavTab, 
    label: string, 
    Icon: React.ElementType, 
    adminOnly = false
  ) => {
    if (adminOnly && !isAdmin) return null;
    const isActive = activeTab === tab;

    return (
      <button
        key={tab}
        onClick={() => {
          onSelectTab(tab);
          onCloseMobile();
        }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
          isActive
            ? 'bg-slate-900 text-white font-semibold shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top: Logo & Store Brand */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="h-16 px-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <StoreLogo
                logoUrl={settings?.logo_url}
                storeName={settings?.store_name}
                size="md"
              />
              <div className="min-w-0">
                <h1 className="text-xs font-bold text-slate-900 tracking-tight leading-tight truncate">
                  {settings?.store_name || 'Berkah Mandiri'}
                </h1>
                <p className="text-[11px] text-emerald-700 font-medium">
                  Manajemen Sembako
                </p>
              </div>
            </div>

            {/* Close button for mobile */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md lg:hidden cursor-pointer"
              aria-label="Tutup navigasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-5 overflow-y-auto flex-1">
            {/* Nav Group: UTAMA */}
            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 mb-1">
                Ringkasan
              </p>
              <div className="space-y-0.5">
                {navItem('dashboard', 'Dashboard Persediaan', LayoutDashboard)}
              </div>
            </div>

            {/* Nav Group: OPERASIONAL & TRANSAKSI */}
            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 mb-1">
                Operasional Toko
              </p>
              <div className="space-y-0.5">
                {navItem('sales-pos', 'Kasir Penjualan (POS)', ShoppingCart)}
                {navItem('stock-in', 'Penerimaan Barang Masuk', ArrowDownLeft)}
                {/* Enabled for both staff and admin as requested */}
                {navItem('stock-opname', 'Stok Opname & Audit Fisik', Sliders, false)}
              </div>
            </div>

            {/* Nav Group: MASTER DATA */}
            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 mb-1">
                Master Data
              </p>
              <div className="space-y-0.5">
                {/* Full access for both staff and admin as requested */}
                {navItem('products', 'Daftar Barang & SKU', Package)}
                {navItem('categories', 'Kategori Komoditas', Layers)}
                {navItem('suppliers', 'Daftar Pemasok', Truck)}
              </div>
            </div>

            {/* Nav Group: AUDIT & LAPORAN */}
            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 mb-1">
                Audit & Laporan
              </p>
              <div className="space-y-0.5">
                {navItem('stock-movements', 'Buku Mutasi Stok', History)}
                {navItem('reports', 'Rekapitulasi & Laporan', BarChart3)}
              </div>
            </div>

            {/* Nav Group: PENGATURAN (Admin Only) */}
            {isAdmin && (
              <div>
                <p className="px-3 text-[11px] font-semibold text-slate-400 mb-1">
                  Pengaturan
                </p>
                <div className="space-y-0.5">
                  {navItem('users', 'Manajemen Pengguna', Users, true)}
                  {navItem('settings', 'Pengaturan Toko', Settings, true)}
                </div>
              </div>
            )}
          </nav>
        </div>

        {/* Bottom User Status */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-slate-600 px-2 py-1">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{user?.name || 'Pengguna'}</span>
            </span>
            <span className="text-slate-400 capitalize shrink-0">{user?.role === 'admin' ? 'Admin' : 'Petugas'}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
