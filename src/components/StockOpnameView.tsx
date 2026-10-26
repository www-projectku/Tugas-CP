import React, { useState } from 'react';
import { Product, StockAdjustment, User } from '../types/index.js';
import { formatStock, formatDateIndo, formatDateTimeIndo, exportToCsv } from '../utils/format.js';
import {
  Sliders,
  AlertCircle,
  CheckCircle2,
  FileText,
  History,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Download
} from 'lucide-react';

interface StockOpnameViewProps {
  products: Product[];
  adjustments: StockAdjustment[];
  user: User | null;
  onRefresh: () => void;
  onCreateAdjustment: (data: { product_id: string; physical_stock: number; reason: string }) => Promise<void>;
}

export const StockOpnameView: React.FC<StockOpnameViewProps> = ({
  products,
  adjustments,
  user,
  onRefresh,
  onCreateAdjustment,
}) => {
  const activeProducts = products.filter((p) => p.is_active);

  const [selectedProductId, setSelectedProductId] = useState(activeProducts[0]?.id || '');
  const [physicalCount, setPhysicalCount] = useState<number | string>('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const recordedStock = selectedProduct ? selectedProduct.current_stock : 0;
  const numPhysical = physicalCount !== '' ? Number(physicalCount) : recordedStock;
  const difference = numPhysical - recordedStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedProductId) {
      setErrorMsg('Pilih barang yang akan disesuaikan.');
      return;
    }

    if (physicalCount === '' || Number(physicalCount) < 0) {
      setErrorMsg('Jumlah stok fisik tidak boleh kosong atau negatif.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Alasan penyesuaian wajib diisi untuk kebutuhan audit akademik.');
      return;
    }

    if (difference === 0) {
      setErrorMsg('Jumlah fisik sama dengan stok tercatat saat ini. Tidak ada selisih yang perlu disesuaikan.');
      return;
    }

    try {
      setSubmitting(true);
      await onCreateAdjustment({
        product_id: selectedProductId,
        physical_stock: Number(physicalCount),
        reason: reason.trim(),
      });

      setSuccessMsg(`Stok "${selectedProduct?.name}" berhasil disesuaikan menjadi ${physicalCount} ${selectedProduct?.unit}.`);
      setPhysicalCount('');
      setReason('');
      onRefresh();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan penyesuaian stok.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            
            <span>Stok Opname & Penyesuaian Persediaan Fisik</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sinkronisasi perbedaan antara jumlah stok pada sistem komputer dengan hasil perhitungan fisik di gudang toko.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: Input Penyesuaian (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">Formulir Rekonsiliasi Stok Opname</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Setiap penyesuaian fisik wajib menyertakan alasan demi integritas audit.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih Barang Sembako *
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setPhysicalCount('');
                }}
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
              >
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} (Tercatat: {p.current_stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Stok Tercatat di Sistem:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatStock(selectedProduct.current_stock, selectedProduct.unit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Harga Modal Terkini:</span>
                  <span className="font-mono text-slate-700">
                    Rp {selectedProduct.purchase_price.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hasil Hitung Fisik Sebenarnya *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  placeholder="Masukkan jumlah fisik..."
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  className="w-full py-2 px-3 text-sm font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                />
                <span className="text-xs text-slate-500 font-medium shrink-0">
                  {selectedProduct?.unit}
                </span>
              </div>
            </div>

            {/* Calculated Variance Preview */}
            {physicalCount !== '' && (
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                difference > 0
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : difference < 0
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center gap-2">
                  {difference > 0 ? (
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  ) : difference < 0 ? (
                    <TrendingDown className="w-4 h-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Selisih Rekonsiliasi:</span>
                </div>
                <span className="font-mono font-bold text-sm">
                  {difference > 0 ? `+${difference}` : difference} {selectedProduct?.unit}
                  {difference < 0 && ' (Kurang/Hilang)'}
                  {difference > 0 && ' (Lebih/Ditemukan)'}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Penyesuaian (Wajib Diisi untuk Audit) *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Contoh: Hasil stok opname akhir bulan; ditemukan 2 kg beras rusak terkena lembap di sudut gudang."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || physicalCount === ''}
              className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{submitting ? 'Menyimpan Penyesuaian...' : 'Simpan Penyesuaian Stok'}</span>
            </button>
          </form>
        </div>

        {/* Right Table: Log Penyesuaian (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>Riwayat Penyesuaian & Stok Opname</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Catatan historis selisih stok fisik yang telah diverifikasi
              </p>
            </div>
            {adjustments.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const headers = ['No. Penyesuaian', 'Tanggal', 'Kode SKU', 'Nama Barang', 'Tercatat', 'Fisik', 'Selisih', 'Alasan', 'Petugas'];
                  const rows = adjustments.map((a) => [
                    a.adjustment_number,
                    a.adjustment_date,
                    a.product_sku,
                    a.product_name,
                    a.recorded_stock,
                    a.physical_stock,
                    a.difference,
                    a.reason,
                    a.user_name,
                  ]);
                  exportToCsv(`rekapitulasi-stok-opname-${new Date().toISOString().split('T')[0]}`, headers, rows);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                title="Unduh riwayat stok opname format CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">No. Penyesuaian</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Barang Sembako</th>
                  <th className="py-2.5 px-2 text-right">Tercatat</th>
                  <th className="py-2.5 px-2 text-right">Fisik</th>
                  <th className="py-2.5 px-2 text-right">Selisih</th>
                  <th className="py-2.5 px-3">Alasan & Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada catatan penyesuaian stok opname.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-medium text-slate-800 text-[11px]">
                        {adj.adjustment_number}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {formatDateIndo(adj.adjustment_date)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{adj.product_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{adj.product_sku}</div>
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-600">
                        {adj.recorded_stock}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-slate-900">
                        {adj.physical_stock}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-bold">
                        <span className={adj.difference >= 0 ? 'text-blue-700' : 'text-amber-700'}>
                          {adj.difference > 0 ? `+${adj.difference}` : adj.difference}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <p className="text-slate-800 text-[11px] line-clamp-2">{adj.reason}</p>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">Oleh: {adj.user_name}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
