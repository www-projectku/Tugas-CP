import React from 'react';
import { DashboardData, User } from '../types/index.js';
import { formatRupiah, formatStock } from '../utils/format.js';
import { SplineChart } from './SplineChart.js';
import {
  ArrowDownLeft,
  ShoppingCart,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface DashboardViewProps {
  data: DashboardData | null;
  loading: boolean;
  user?: User | null;
  onNavigateToStockIn: () => void;
  onNavigateToProducts: (filterStatus?: string) => void;
  onNavigateToSales: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  loading,
  onNavigateToStockIn,
  onNavigateToProducts,
  onNavigateToSales,
}) => {
  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
        <p className="mt-3 text-xs text-slate-500 font-medium">Memuat data persediaan toko...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Data persediaan tidak tersedia atau gagal dimuat.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Dashboard Persediaan & Kasir Toko
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan persediaan sembako, perputaran stok masuk, dan transaksi penjualan kasir secara langsung.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            onClick={onNavigateToStockIn}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-2"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>+ Catat Barang Masuk</span>
          </button>
          <button
            onClick={onNavigateToSales}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-2"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Buka Kasir Penjualan</span>
          </button>
        </div>
      </div>

      {/* Row 1: KPI Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Laporan Stok Saat Ini */}
        <div
          onClick={() => onNavigateToProducts('all')}
          className="bg-white p-4.5 rounded-xl border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="mb-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Laporan Stok Saat Ini
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {data.totalProducts}
            </span>
            <span className="text-xs text-slate-500 font-medium">Jenis Barang</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Total Fisik di Toko:</span>
            <span className="font-semibold text-slate-800 tabular-nums">
              {formatStock(data.totalUnits)} unit
            </span>
          </div>
        </div>

        {/* KPI 2: Laporan Barang Masuk & Pengadaan */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="mb-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Laporan Barang Masuk & Modal
            </span>
          </div>
          <div className="flex items-baseline">
            <span className="text-xl font-bold tabular-nums text-slate-900 truncate">
              {formatRupiah(data.inventoryAssetValue)}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Estimasi Nilai Jual:</span>
            <span className="font-semibold text-slate-700 tabular-nums truncate max-w-[140px]">
              {formatRupiah(data.potentialSalesValue)}
            </span>
          </div>
        </div>

        {/* KPI 3: Penjualan & Laba Kotor */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="mb-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Penjualan & Laba Kotor
            </span>
          </div>
          <div className="flex items-baseline">
            <span className="text-xl font-bold tabular-nums text-slate-900 truncate">
              {formatRupiah(data.todaySalesTotalAmount)}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
            <span>{data.todaySalesCount} transaksi kasir</span>
            <span className="font-semibold text-emerald-700 tabular-nums">
              +{formatRupiah(data.todayGrossProfit)} laba
            </span>
          </div>
        </div>

        {/* KPI 4: Stok Kritis & Restock */}
        <div
          onClick={() => onNavigateToProducts('critical')}
          className="bg-white p-4.5 rounded-xl border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="mb-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Stok Kritis & Restock
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tabular-nums ${
              data.outOfStockCount > 0 ? 'text-rose-700' : data.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}>
              {data.lowStockCount + data.outOfStockCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">Perlu Dipesan</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
            <span className="text-rose-700 font-semibold">{data.outOfStockCount} habis total</span>
            <span className="text-amber-800 font-semibold">{data.lowStockCount} menipis</span>
          </div>
        </div>
      </div>

      {/* Row 2: Operational Charts & Fast Moving */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Smooth Bezier Spline Curve Graph */}
        <div className="lg:col-span-2">
          <SplineChart data={data.last7Days} />
        </div>

        {/* Right 1 Col: Top Selling Commodities (Fast Moving Sembako) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Komoditas Terlaris
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">Fast Moving</span>
            </div>

            <div className="space-y-3">
              {data.topSellingProducts.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center font-medium">
                  Belum ada transaksi penjualan terdata.
                </p>
              ) : (
                data.topSellingProducts.map((p, idx) => (
                  <div key={p.sku} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-500">{p.sku}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-900 tabular-nums">
                        {p.quantity} item
                      </span>
                      <p className="text-[10px] text-emerald-700 font-semibold tabular-nums">
                        {formatRupiah(p.revenue)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 text-right">
            <button
              onClick={() => onNavigateToProducts('all')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Semua Katalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Actionable Restock List & Audit Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Urgent Reorders Alert Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <span>Daftar Barang Wajib Restock</span>
                {data.urgentReorders.length > 0 && (
                  <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold">
                    {data.urgentReorders.length} Kritis
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Barang dengan stok fisik yang sudah mencapai atau di bawah batas minimum
              </p>
            </div>

            <button
              onClick={() => onNavigateToProducts('critical')}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Semua Kritis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {data.urgentReorders.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800">Semua persediaan sembako dalam batas aman</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Tidak ada barang yang memerlukan pemesanan darurat saat ini.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Nama Barang</th>
                    <th className="py-2.5 px-3 text-right">Stok Fisik</th>
                    <th className="py-2.5 px-3 text-right">Ambang Min.</th>
                    <th className="py-2.5 px-3 text-right">Defisit</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.urgentReorders.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {prod.name}
                        <span className="block text-[10px] text-slate-400 font-mono">{prod.sku}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums">
                        <span className={prod.current_stock <= 0 ? 'text-rose-700' : 'text-amber-700'}>
                          {formatStock(prod.current_stock, prod.unit)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 tabular-nums">
                        {prod.min_stock} {prod.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-700 tabular-nums">
                        -{prod.shortage} {prod.unit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            prod.status === 'HABIS'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {prod.status === 'HABIS' ? 'Habis Total' : 'Menipis'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={onNavigateToStockIn}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors cursor-pointer shadow-2xs"
                        >
                          Catat Masuk
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right 1 Col: Audit Log */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Log Transaksi Terakhir
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Audit trail kasir dan penerimaan barang
              </p>
            </div>

            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {data.recentActivities.length === 0 ? (
                <p className="p-6 text-xs text-slate-400 text-center font-medium">Belum ada mutasi.</p>
              ) : (
                data.recentActivities.map((act) => (
                  <div key={act.id} className="p-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-900">{act.number}</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatRupiah(act.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{act.type === 'SALE' ? 'Penjualan' : 'Penerimaan'} · {act.party}</span>
                      <span className="text-[10px] text-slate-400">
                        {act.date.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>Status Transaksi</span>
              <span className="text-emerald-700 font-semibold">Sinkron</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
