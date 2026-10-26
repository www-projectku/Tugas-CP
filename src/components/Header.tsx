import React, { useState, useRef, useEffect } from 'react';
import { User, StoreSettings } from '../types/index.js';
import { 
  Menu, 
  LogOut, 
  ChevronDown, 
  AlertTriangle,
  User as UserIcon
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  settings?: StoreSettings | null;
  onLogout: () => void;
  lowStockCount: number;
  onNavigateToLowStock: () => void;
  onToggleSidebarMobile: () => void;
  activeTabTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  settings,
  onLogout,
  lowStockCount,
  onNavigateToLowStock,
  onToggleSidebarMobile,
  activeTabTitle,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80">
      <div className="px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Clean Breadcrumb trail */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebarMobile}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md lg:hidden hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Buka navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs truncate">
            <span className="font-semibold text-slate-500 hidden sm:inline truncate">
              {settings?.store_name || 'Toko Sembako Berkah Mandiri'}
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
            <span className="font-bold text-slate-900 truncate text-sm">
              {activeTabTitle}
            </span>
          </nav>
        </div>

        {/* Right: Low Stock Alert & User Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Low Stock Indicator */}
          {lowStockCount > 0 ? (
            <button
              onClick={onNavigateToLowStock}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-md transition-colors cursor-pointer"
              title={`${lowStockCount} barang membutuhkan pemesanan ulang`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="tabular-nums font-semibold font-mono">{lowStockCount}</span>
              <span className="hidden sm:inline text-amber-800 font-medium">Stok Kritis</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Stok Aman</span>
            </div>
          )}

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* User Profile Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-left"
              aria-expanded={userDropdownOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[140px]">
                  {user?.name}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight capitalize">
                  {user?.role === 'admin' ? 'Administrator (Owner)' : 'Petugas Toko'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in-50 zoom-in-95">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">{user?.email}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                    {user?.role === 'admin' ? 'Hak Akses: Administrator (Owner)' : 'Hak Akses: Petugas Kasir/Gudang'}
                  </p>
                </div>

                <div className="p-1">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar dari Akun</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
