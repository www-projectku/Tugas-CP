import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, ClipboardList, PackageMinus } from 'lucide-react';
import { Product, User } from '../types/index.js';
import { formatStock } from '../utils/format.js';

interface StockOutViewProps {
  products: Product[];
  user: User | null;
  onCreateStockOut: (data: { product_id: string; quantity: number; reason: string; notes?: string; transaction_date: string }) => Promise<any>;
  onRefresh: () => void;
}

const reasons = ['Barang rusak', 'Barang kedaluwarsa', 'Barang hilang', 'Pemakaian internal toko', 'Lainnya'];

export const StockOutView: React.FC<StockOutViewProps> = ({ products, onCreateStockOut, onRefresh }) => {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState(reasons[0]);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setMessage('');
    if (!selected) return setError('Pilih barang terlebih dahulu.');
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return setError('Jumlah harus lebih dari 0.');
    if (qty > selected.current_stock) return setError(`Jumlah melebihi stok tersedia (${selected.current_stock} ${selected.unit}).`);
    setSaving(true);
    try {
      const result = await onCreateStockOut({ product_id: productId, quantity: qty, reason, notes: notes.trim(), transaction_date: date });
      setMessage(result?.message || 'Barang keluar berhasil dicatat.');
      setQuantity('1'); setNotes('');
      onRefresh();
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan barang keluar.');
    } finally { setSaving(false); }
  };

  return <div className="max-w-5xl space-y-5">
    <div>
      <h2 className="text-xl font-bold text-slate-900">Pencatatan Barang Keluar</h2>
      <p className="mt-1 text-sm text-slate-500">Catat pengurangan stok selain penjualan, seperti barang rusak, kedaluwarsa, atau pemakaian internal.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><PackageMinus className="h-5 w-5 text-amber-600"/><h3 className="font-semibold text-slate-800">Form Barang Keluar</h3></div>
        <label className="block text-sm font-medium text-slate-700">Pilih barang
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" required>
            <option value="">-- Pilih barang --</option>
            {products.filter((p) => p.is_active).sort((a,b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
          </select>
        </label>
        {selected && <div className="rounded-lg bg-slate-50 p-3 text-sm flex justify-between"><span className="text-slate-500">Stok tersedia</span><strong className="text-slate-900">{formatStock(selected.current_stock, selected.unit)}</strong></div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">Jumlah keluar
            <input type="number" min="0.01" step="any" max={selected?.current_stock} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" required />
          </label>
          <label className="block text-sm font-medium text-slate-700">Tanggal
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" required />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Alasan pengeluaran
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">{reasons.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label className="block text-sm font-medium text-slate-700">Keterangan (opsional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Tambahkan keterangan jika diperlukan..." className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
        {error && <div role="alert" className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5"/>{error}</div>}
        {message && <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        <button disabled={saving || !selected} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"><ArrowUpRight className="h-4 w-4"/>{saving ? 'Menyimpan...' : 'Simpan Barang Keluar'}</button>
      </form>
      <aside className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 h-fit">
        <div className="flex items-center gap-2 text-amber-800"><ClipboardList className="h-5 w-5"/><h3 className="font-semibold">Informasi</h3></div>
        <ul className="mt-3 space-y-2 text-sm text-amber-900/80 list-disc pl-5">
          <li>Stok akan berkurang setelah pencatatan berhasil.</li>
          <li>Jumlah keluar tidak boleh melebihi stok tersedia.</li>
          <li>Setiap pencatatan tersimpan dalam riwayat mutasi stok.</li>
          <li>Pilih alasan yang sesuai agar laporan persediaan mudah diperiksa.</li>
        </ul>
      </aside>
    </div>
  </div>;
};
