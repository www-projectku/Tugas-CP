import React from 'react';
import { DashboardData, User } from '../types/index.js';
import { formatRupiah, formatStock } from '../utils/format.js';
import { AlertTriangle, ArrowDownLeft } from 'lucide-react';

interface DashboardViewProps {
  data: DashboardData | null;
  loading: boolean;
  user?: User | null;
  onNavigateToStockIn: () => void;
  onNavigateToProducts: (filterStatus?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data, loading, onNavigateToStockIn, onNavigateToProducts }) => {
  if (loading) return <div className="p-12 text-center text-sm text-slate-500">Memuat data persediaan...</div>;
  if (!data) return <div className="p-12 text-center text-sm text-slate-500">Data persediaan belum tersedia.</div>;

  const cards = [
    { label: 'Jenis Barang', value: data.totalProducts.toLocaleString('id-ID'), detail: 'Barang terdaftar', icon: null, color: 'text-blue-700 bg-blue-50' },
    { label: 'Total Stok', value: formatStock(data.totalUnits), detail: 'Jumlah seluruh satuan', icon: null, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Stok Menipis', value: data.lowStockCount.toLocaleString('id-ID'), detail: 'Perlu segera diperiksa', icon: AlertTriangle, color: 'text-amber-700 bg-amber-50' },
    { label: 'Stok Habis', value: data.outOfStockCount.toLocaleString('id-ID'), detail: 'Stok kosong', icon: AlertTriangle, color: 'text-burgundi-700 bg-burgundi-50' },
  ];

  return <div className="max-w-7xl space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Dashboard Pengelolaan Stok</h2>
        <p className="mt-1 text-sm text-slate-500">Pantau jumlah dan kondisi persediaan barang toko sembako.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onNavigateToProducts('all')} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Lihat Data Barang</button>
        <button onClick={onNavigateToStockIn} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"><ArrowDownLeft className="h-4 w-4"/> Catat Barang Masuk</button>
      </div>
    </div>

   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
  {cards.map((card) => {
    const Icon = card.icon;

    return (
      <div
        key={card.label}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500">
            {card.label}
          </span>

          {Icon && (
            <span className={`rounded-lg p-2 ${card.color}`}>
              <Icon className="h-5 w-5" />
            </span>
          )}
        </div>

        <p className="mt-3 text-2xl font-bold text-slate-900">
          {card.value}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {card.detail}
        </p>
      </div>
    );
  })}
</div>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Ringkasan Persediaan</h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-sm text-slate-500">Estimasi nilai persediaan</span><strong className="text-sm text-slate-900">{formatRupiah(data.inventoryAssetValue)}</strong></div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-sm text-slate-500">Penerimaan barang hari ini</span><strong className="text-sm text-slate-900">{data.todayStockInCount} transaksi</strong></div>
          <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Nilai barang masuk hari ini</span><strong className="text-sm text-slate-900">{formatRupiah(data.todayStockInTotalAmount)}</strong></div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Barang Perlu Diperhatikan</h3><button onClick={() => onNavigateToProducts('critical')} className="text-xs font-semibold text-blue-700 hover:underline">Lihat semua</button></div>
        {data.urgentReorders.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Semua stok barang dalam kondisi aman.</p> : <div className="mt-3 divide-y divide-slate-100">
          {data.urgentReorders.slice(0, 6).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{item.name}</p><p className="text-xs text-slate-500">Kode: {item.sku}</p></div><div className="shrink-0 text-right"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.status === 'HABIS' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span><p className="mt-1 text-xs text-slate-500">Stok: {formatStock(item.current_stock, item.unit)}</p></div></div>)}
        </div>}
      </section>
    </div>
  </div>;
};
