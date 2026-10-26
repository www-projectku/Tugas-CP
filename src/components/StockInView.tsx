import React, { useState } from 'react';
import { Supplier, Product, StockInTransaction, User } from '../types/index.js';
import { formatRupiah, formatStock, formatDateIndo, formatDateTimeIndo } from '../utils/format.js';
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Truck,
  RotateCcw,
  X,
  Eye,
  Printer
} from 'lucide-react';

interface StockInViewProps {
  suppliers: Supplier[];
  products: Product[];
  stockInList: StockInTransaction[];
  user: User | null;
  onRefresh: () => void;
  onCreateStockIn: (data: any) => Promise<void>;
  onCancelStockIn: (id: string, reason: string) => Promise<void>;
}

interface ItemRow {
  product_id: string;
  quantity: number | string;
  purchase_price: number | string;
}

export const StockInView: React.FC<StockInViewProps> = ({
  suppliers,
  products,
  stockInList,
  user,
  onRefresh,
  onCreateStockIn,
  onCancelStockIn,
}) => {
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Form state
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { product_id: products[0]?.id || '', quantity: 10, purchase_price: products[0]?.purchase_price || 0 },
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [viewingTx, setViewingTx] = useState<StockInTransaction | null>(null);

  // Cancel modal
  const [cancellingTxId, setCancellingTxId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Active products only for selection
  const activeProducts = products.filter((p) => p.is_active);

  // Row operations
  const handleAddItemRow = () => {
    const defaultProduct = activeProducts[0];
    setItems((prev) => [
      ...prev,
      {
        product_id: defaultProduct ? defaultProduct.id : '',
        quantity: 1,
        purchase_price: defaultProduct ? defaultProduct.purchase_price : 0,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, newProdId: string) => {
    const selected = products.find((p) => p.id === newProdId);
    setItems((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              product_id: newProdId,
              purchase_price: selected ? selected.purchase_price : row.purchase_price,
            }
          : row
      )
    );
  };

  const handleQuantityChange = (index: number, qty: string) => {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, quantity: qty } : row))
    );
  };

  const handlePriceChange = (index: number, price: string) => {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, purchase_price: price } : row))
    );
  };

  // Grand total calculation
  const grandTotal = items.reduce((acc, row) => {
    const q = Number(row.quantity) || 0;
    const p = Number(row.purchase_price) || 0;
    return acc + q * p;
  }, 0);

  // Submit Stock In
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!supplierId) {
      setErrorMsg('Pemasok wajib dipilih.');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Minimal sertakan satu baris barang.');
      return;
    }

    for (const row of items) {
      const q = Number(row.quantity);
      const p = Number(row.purchase_price);
      if (isNaN(q) || q <= 0) {
        setErrorMsg('Jumlah barang harus berupa angka lebih dari 0.');
        return;
      }
      if (isNaN(p) || p < 0) {
        setErrorMsg('Harga beli tidak boleh bernilai negatif.');
        return;
      }
    }

    try {
      setSubmitting(true);
      await onCreateStockIn({
        supplier_id: supplierId,
        transaction_date: transactionDate,
        notes,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: Number(it.quantity),
          purchase_price: Number(it.purchase_price),
        })),
      });

      setSuccessMsg('Transaksi penerimaan barang masuk berhasil disimpan dan stok bertambah.');
      // Reset form
      setNotes('');
      setItems([{ product_id: activeProducts[0]?.id || '', quantity: 10, purchase_price: activeProducts[0]?.purchase_price || 0 }]);
      onRefresh();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan transaksi barang masuk.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingTxId || !cancelReason.trim()) {
      alert('Alasan pembatalan wajib diisi.');
      return;
    }
    try {
      await onCancelStockIn(cancellingTxId, cancelReason.trim());
      setCancellingTxId(null);
      setCancelReason('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            
            <span>Transaksi Barang Masuk (Pengadaan Sembako)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan faktur penerimaan sembako dari distributor dan penambahan stok secara terverifikasi.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'create' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Formulir Penerimaan
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Riwayat Nota ({stockInList.length})
          </button>
        </div>
      </div>

      {/* View 1: Formulir Penerimaan */}
      {activeTab === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Header Info */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                <span>Pemasok / Distributor *</span>
              </label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Tanggal Penerimaan Barang *</span>
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Catatan / No. Surat Jalan Distributor</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: SJ-2026/10/18 dari Karawang"
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Daftar Barang yang Diterima</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tambahkan barang, jumlah unit fisik, dan harga modal pembelian dari supplier
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItemRow}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris Barang</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Barang Sembako</th>
                    <th className="py-2.5 px-3 w-28 text-right">Jumlah Unit</th>
                    <th className="py-2.5 px-3 w-36 text-right">Harga Beli / Satuan</th>
                    <th className="py-2.5 px-3 w-36 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 w-12 text-center">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, index) => {
                    const selectedProduct = products.find((p) => p.id === row.product_id);
                    const subtotal = (Number(row.quantity) || 0) * (Number(row.purchase_price) || 0);

                    return (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 text-slate-400 font-mono">{index + 1}</td>
                        <td className="py-3 px-3">
                          <select
                            value={row.product_id}
                            onChange={(e) => handleProductChange(index, e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-800 bg-white"
                          >
                            {activeProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.sku}] {p.name} ({formatStock(p.current_stock, p.unit)} tersedia)
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              required
                              value={row.quantity}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              className="w-20 py-1.5 px-2 text-xs font-mono text-right rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-800"
                            />
                            <span className="text-[11px] text-slate-400 w-8">{selectedProduct?.unit || ''}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            required
                            value={row.purchase_price}
                            onChange={(e) => handlePriceChange(index, e.target.value)}
                            className="w-28 py-1.5 px-2 text-xs font-mono text-right rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-800"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(subtotal)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveRow(index)}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-slate-700">
                      Total Nilai Faktur Pembelian:
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-base font-extrabold text-blue-700">
                      {formatRupiah(grandTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Actions Bar */}
            <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Stok barang akan otomatis diakumulasikan ke persediaan setelah transaksi dikonfirmasi.
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{submitting ? 'Menyimpan Transaksi...' : 'Konfirmasi & Tambah Stok'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* View 2: Riwayat Nota Penerimaan */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">No. Transaksi</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Pemasok</th>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-3 text-right">Total Item</th>
                  <th className="py-3 px-3 text-right">Nilai Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockInList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Belum ada catatan transaksi barang masuk.
                    </td>
                  </tr>
                ) : (
                  stockInList.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{tx.transaction_number}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDateIndo(tx.transaction_date)}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{tx.supplier_name}</td>
                      <td className="py-3 px-4 text-slate-500">{tx.user_name}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        {tx.items.reduce((s, i) => s + i.quantity, 0)} unit
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(tx.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            tx.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {tx.status === 'completed' ? 'SUKSES' : 'DIBATALKAN'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingTx(tx)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            title="Lihat detail nota"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && tx.status === 'completed' && (
                            <button
                              onClick={() => setCancellingTxId(tx.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              title="Batalkan transaksi dan kembalikan stok"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-bold text-blue-700">{viewingTx.transaction_number}</span>
                <h3 className="text-base font-bold text-slate-900">Faktur Penerimaan Barang Masuk</h3>
              </div>
              <button onClick={() => setViewingTx(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs my-4 bg-slate-50 p-3 rounded-xl">
              <div>
                <span className="text-slate-400">Pemasok:</span>
                <p className="font-semibold text-slate-800">{viewingTx.supplier_name}</p>
              </div>
              <div>
                <span className="text-slate-400">Tanggal:</span>
                <p className="font-semibold text-slate-800">{formatDateIndo(viewingTx.transaction_date)}</p>
              </div>
              <div>
                <span className="text-slate-400">Petugas Pencatat:</span>
                <p className="font-semibold text-slate-800">{viewingTx.user_name}</p>
              </div>
              <div>
                <span className="text-slate-400">Catatan:</span>
                <p className="font-semibold text-slate-800">{viewingTx.notes || '-'}</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden my-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Nama Barang</th>
                    <th className="py-2 px-2 text-right">Kuantitas</th>
                    <th className="py-2 px-2 text-right">Harga Modal</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingTx.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-900">{it.product_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{it.product_sku}</div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{it.quantity} {it.unit}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatRupiah(it.purchase_price)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-right font-bold text-slate-700">Total:</td>
                    <td className="py-2 px-3 text-right font-mono font-extrabold text-blue-700">
                      {formatRupiah(viewingTx.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Cetak Faktur Penerimaan</span>
              </button>
              <button
                onClick={() => setViewingTx(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Transaction Modal */}
      {cancellingTxId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Batalkan Transaksi Barang Masuk</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Membatalkan transaksi akan membalikkan penambahan stok dan mencatat jurnal pembalik pada Buku Besar Mutasi Stok.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Pembatalan (Wajib Dicatat) *
              </label>
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Kesalahan input nomor faktur / pengembalian retur ke supplier"
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setCancellingTxId(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
              >
                Konfirmasi Pembatalan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
