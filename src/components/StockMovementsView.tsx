import React, { useState, useMemo } from 'react';
import { StockMovement, Product } from '../types/index.js';
import { formatDateTimeIndo, formatStock, exportToCsv } from '../utils/format.js';
import { History, Download, Filter, Search, Calendar, ArrowDownLeft, ShoppingCart, Sliders, RotateCcw } from 'lucide-react';

interface StockMovementsViewProps {
  movements: StockMovement[];
  products: Product[];
  onRefresh: () => void;
}

export const StockMovementsView: React.FC<StockMovementsViewProps> = ({
  movements,
  products,
  onRefresh,
}) => {
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchProduct = selectedProduct === 'all' || m.product_id === selectedProduct;
      const matchType = selectedType === 'all' || m.movement_type === selectedType;
      const matchStart = !startDate || m.movement_date >= startDate;
      const matchEnd = !endDate || m.movement_date <= endDate;
      const matchSearch =
        !searchTerm ||
        m.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.reference_number.toLowerCase().includes(searchTerm.toLowerCase());

      return matchProduct && matchType && matchStart && matchEnd && matchSearch;
    });
  }, [movements, selectedProduct, selectedType, startDate, endDate, searchTerm]);

  // Aggregate stats
  const totalIn = filteredMovements.reduce((acc, m) => acc + m.quantity_in, 0);
  const totalOut = filteredMovements.reduce((acc, m) => acc + m.quantity_out, 0);

  const handleExportCsv = () => {
    const headers = [
      'Waktu & Tanggal',
      'Kode SKU',
      'Nama Barang',
      'Jenis Mutasi',
      'Qty Masuk',
      'Qty Keluar',
      'Saldo Sebelum',
      'Saldo Sesudah',
      'No. Referensi',
      'Petugas',
      'Catatan',
    ];
    const rows = filteredMovements.map((m) => [
      m.created_at,
      m.product_sku,
      m.product_name,
      m.movement_type,
      m.quantity_in,
      m.quantity_out,
      m.balance_before,
      m.balance_after,
      m.reference_number,
      m.user_name,
      m.notes || '',
    ]);
    exportToCsv(`buku-besar-mutasi-stok-${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'IN':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
            <ArrowDownLeft className="w-3 h-3" />
            MASUK
          </span>
        );
      case 'SALE':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
            <ShoppingCart className="w-3 h-3" />
            PENJUALAN
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
            <Sliders className="w-3 h-3" />
            PENYESUAIAN
          </span>
        );
      case 'CANCEL_SALE':
      case 'CANCEL_IN':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700">
            <RotateCcw className="w-3 h-3" />
            PEMBATALAN
          </span>
        );
      default:
        return <span className="text-[10px] font-mono">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            
            <span>Buku Besar Pergerakan Stok (Audit Trail Ledger)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Jejak kronologis saldo persediaan barang yang mencatat mutasi masuk, keluar, penjualan, dan penyesuaian.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
        >
          <Download className="w-4 h-4" />
          <span>Ekspor Buku Besar CSV</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Baris Mutasi</span>
          <p className="font-mono text-xl font-bold text-slate-900 mt-0.5">{filteredMovements.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Akumulasi Masuk</span>
          <p className="font-mono text-xl font-bold text-blue-700 mt-0.5">+{totalIn.toFixed(1)} unit</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Akumulasi Keluar (Terjual/Opname)</span>
          <p className="font-mono text-xl font-bold text-red-600 mt-0.5">-{totalOut.toFixed(1)} unit</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search */}
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari SKU, nama barang, nomor transaksi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
          />
        </div>

        {/* Product Filter */}
        <div>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
          >
            <option value="all">Semua Barang</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.sku}] {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Movement Type Filter */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
          >
            <option value="all">Semua Jenis Mutasi</option>
            <option value="IN">Barang Masuk (IN)</option>
            <option value="SALE">Penjualan Kasir (SALE)</option>
            <option value="ADJUSTMENT">Stok Opname (ADJUSTMENT)</option>
            <option value="CANCEL_SALE">Retur Penjualan</option>
            <option value="CANCEL_IN">Batal Barang Masuk</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-1/2 py-2 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none text-slate-700"
            title="Tanggal Awal"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-1/2 py-2 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none text-slate-700"
            title="Tanggal Akhir"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Waktu & Tanggal</th>
                <th className="py-3 px-4">Kode SKU</th>
                <th className="py-3 px-4 min-w-[200px]">Barang Sembako</th>
                <th className="py-3 px-3">Jenis Mutasi</th>
                <th className="py-3 px-2 text-right">Masuk</th>
                <th className="py-3 px-2 text-right">Keluar</th>
                <th className="py-3 px-2 text-right">Sebelum</th>
                <th className="py-3 px-2 text-right font-bold">Saldo Akhir</th>
                <th className="py-3 px-3">No. Referensi</th>
                <th className="py-3 px-3">Petugas</th>
                <th className="py-3 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    Tidak ada catatan mutasi pergerakan stok yang cocok.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {formatDateTimeIndo(m.created_at)}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800 text-[11px]">
                      {m.product_sku}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {m.product_name}
                    </td>
                    <td className="py-2.5 px-3">
                      {getMovementBadge(m.movement_type)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-blue-700">
                      {m.quantity_in > 0 ? `+${m.quantity_in}` : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-red-600">
                      {m.quantity_out > 0 ? `-${m.quantity_out}` : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                      {m.balance_before}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                      {m.balance_after}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                      {m.reference_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate max-w-[120px]">
                      {m.user_name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-[220px] truncate" title={m.notes}>
                      {m.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
