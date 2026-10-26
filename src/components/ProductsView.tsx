import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../services/api.js';
import { Product, Category, User } from '../types/index.js';
import { formatRupiah, formatStock, exportToCsv, formatDateTimeIndo } from '../utils/format.js';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  X,
  History,
  ShieldCheck,
  Power,
  RotateCw
} from 'lucide-react';

interface ProductsViewProps {
  products: Product[];
  categories: Category[];
  user: User | null;
  onRefresh: () => void;
  onCreateProduct: (data: any) => Promise<void>;
  onUpdateProduct: (id: string, data: any) => Promise<void>;
  onToggleStatus: (id: string) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  initialFilterStatus?: string;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  categories,
  user,
  onRefresh,
  onCreateProduct,
  onUpdateProduct,
  onToggleStatus,
  onDeleteProduct,
  initialFilterStatus = 'all',
}) => {
  const isAdmin = user?.role === 'admin';

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilterStatus);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sync initialFilterStatus prop changes (e.g. clicking header notification or dashboard card)
  useEffect(() => {
    if (initialFilterStatus) {
      setSelectedStatus(initialFilterStatus);
      setCurrentPage(1);
    }
  }, [initialFilterStatus]);

  // Dynamic stock counts memo for accurate options and status badges
  const stockCounts = useMemo(() => {
    const active = products.filter((p) => p.is_active);
    const critical = active.filter((p) => p.current_stock <= p.min_stock).length;
    const low = active.filter((p) => p.current_stock > 0 && p.current_stock <= p.min_stock).length;
    const out = active.filter((p) => p.current_stock <= 0).length;
    const safe = active.filter((p) => p.current_stock > p.min_stock).length;
    const inactive = products.filter((p) => !p.is_active).length;
    return { total: products.length, critical, low, out, safe, inactive };
  }, [products]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const handleViewProduct = async (prod: Product) => {
    setViewingProduct(prod);
    setLoadingMovements(true);
    try {
      const res = await api.getProductDetail(prod.id);
      if (res && res.data) {
        setViewingProduct(res.data);
      }
    } catch (err) {
      console.error('Failed to load product details:', err);
    } finally {
      setLoadingMovements(false);
    }
  };
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form inputs
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [purchasePrice, setPurchasePrice] = useState<number | string>('');
  const [sellingPrice, setSellingPrice] = useState<number | string>('');
  const [initialStock, setInitialStock] = useState<number | string>('0');
  const [minStock, setMinStock] = useState<number | string>('10');
  const [description, setDescription] = useState('');

  // Units list commonly used in Indonesian sembako
  const unitOptions = ['kg', 'liter', 'pcs', 'bungkus', 'dus', 'botol', 'kaleng', 'pak', 'karung', 'kotak', 'pouch'];

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      const matchSearch =
        searchTerm === '' ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());

      // Category
      const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory;

      // Status
      let matchStatus = true;
      if (selectedStatus === 'safe') {
        matchStatus = p.is_active && p.current_stock > p.min_stock;
      } else if (selectedStatus === 'critical' || selectedStatus === 'kritis') {
        matchStatus = p.is_active && p.current_stock <= p.min_stock;
      } else if (selectedStatus === 'low') {
        matchStatus = p.is_active && p.current_stock > 0 && p.current_stock <= p.min_stock;
      } else if (selectedStatus === 'out') {
        matchStatus = p.is_active && p.current_stock <= 0;
      } else if (selectedStatus === 'inactive') {
        matchStatus = !p.is_active;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  // Open add modal
  const handleOpenAdd = () => {
    setSku(`BRG-${Math.floor(1000 + Math.random() * 9000)}`);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setUnit('pcs');
    setPurchasePrice('');
    setSellingPrice('');
    setInitialStock('0');
    setMinStock('10');
    setDescription('');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setSku(p.sku);
    setName(p.name);
    setCategoryId(p.category_id);
    setUnit(p.unit);
    setPurchasePrice(p.purchase_price);
    setSellingPrice(p.selling_price);
    setMinStock(p.min_stock);
    setDescription(p.description || '');
    setFormError(null);
  };

  // Submit Add
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!sku.trim() || !name.trim() || !categoryId) {
      setFormError('Kode SKU, Nama Barang, dan Kategori wajib diisi.');
      return;
    }
    try {
      setSubmitting(true);
      await onCreateProduct({
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category_id: categoryId,
        unit,
        purchase_price: Number(purchasePrice) || 0,
        selling_price: Number(sellingPrice) || 0,
        current_stock: Number(initialStock) || 0,
        min_stock: Number(minStock) || 0,
        description: description.trim(),
      });
      setIsAddModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menambahkan barang.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setFormError(null);
    try {
      setSubmitting(true);
      await onUpdateProduct(editingProduct.id, {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category_id: categoryId,
        unit,
        purchase_price: Number(purchasePrice) || 0,
        selling_price: Number(sellingPrice) || 0,
        min_stock: Number(minStock) || 0,
        description: description.trim(),
      });
      setEditingProduct(null);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal memperbarui data barang.');
    } finally {
      setSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = ['Kode SKU', 'Nama Barang', 'Kategori', 'Satuan', 'Harga Beli (Modal)', 'Harga Jual', 'Stok Saat Ini', 'Batas Minimum', 'Status'];
    const rows = filteredProducts.map((p) => [
      p.sku,
      p.name,
      p.category_name || '-',
      p.unit,
      p.purchase_price,
      p.selling_price,
      p.current_stock,
      p.min_stock,
      !p.is_active ? 'NONAKTIF' : p.current_stock <= 0 ? 'HABIS' : p.current_stock <= p.min_stock ? 'MENIPIS' : 'AMAN'
    ]);
    exportToCsv(`data-barang-sembako-${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            
            <span>Katalog Barang & Master SKU</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola master data sembako, kode SKU, harga pokok pembelian (HPP), harga eceran, dan ambang batas minimum.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition-colors cursor-pointer flex items-center gap-1.5"
            title="Download data barang ke format file CSV/Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Barang</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-1 lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama barang atau kode SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-3 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-3 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
            >
              <option value="all">Semua Status Stok ({stockCounts.total})</option>
              <option value="critical">Stok Kritis ({stockCounts.critical}) - Butuh Restock</option>
              <option value="safe">Stok Aman ({stockCounts.safe})</option>
              <option value="low">Stok Menipis ({stockCounts.low})</option>
              <option value="out">Stok Habis ({stockCounts.out})</option>
              <option value="inactive">Status Nonaktif ({stockCounts.inactive})</option>
            </select>
          </div>
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div>
            Menampilkan <span className="font-semibold text-slate-800 font-mono tabular-nums">{filteredProducts.length}</span> barang
            {searchTerm && ` untuk pencarian "${searchTerm}"`}
            {(selectedStatus === 'critical' || selectedStatus === 'kritis') && (
              <span className="ml-2 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Mode Filter: Stok Kritis (Defisit ≤ Batas Min)
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Aman ({stockCounts.safe})
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              Menipis ({stockCounts.low})
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              Habis ({stockCounts.out})
            </span>
          </div>
        </div>
      </div>

      {/* Critical Stock Alert Banner when filtering critical */}
      {(selectedStatus === 'critical' || selectedStatus === 'kritis') && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Menampilkan <strong>{filteredProducts.length} barang</strong> stok kritis yang butuh restock segera ({stockCounts.out} habis total, {stockCounts.low} mendekati batas minimum).
            </span>
          </div>
          <button
            onClick={() => setSelectedStatus('all')}
            className="text-amber-800 hover:text-amber-950 font-semibold underline underline-offset-2 shrink-0 cursor-pointer text-xs"
          >
            Tampilkan Semua Barang
          </button>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4 font-mono w-10">No</th>
                <th className="py-2.5 px-4 font-mono">Kode SKU</th>
                <th className="py-2.5 px-4">Nama Komoditas</th>
                <th className="py-2.5 px-4">Kategori</th>
                <th className="py-2.5 px-3 text-right">Harga Modal</th>
                <th className="py-2.5 px-3 text-right">Harga Jual</th>
                <th className="py-2.5 px-3 text-right">Stok Fisik</th>
                <th className="py-2.5 px-3 text-right">Min</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-mono">
                    Tidak ada barang yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p, index) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  const isLow = p.current_stock > 0 && p.current_stock <= p.min_stock;
                  const isOut = p.current_stock <= 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        !p.is_active ? 'bg-slate-50/30 opacity-70' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{rowNumber}</td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-700 text-[11px]">{p.sku}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-1">{p.description}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{p.category_name || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                        {formatRupiah(p.purchase_price)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(p.selling_price)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                        <span
                          className={
                            !p.is_active
                              ? 'text-slate-400'
                              : isOut
                              ? 'text-rose-700 font-bold'
                              : isLow
                              ? 'text-amber-800'
                              : 'text-slate-800'
                          }
                        >
                          {formatStock(p.current_stock, p.unit)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 tabular-nums">
                        {p.min_stock} {p.unit}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        {!p.is_active ? (
                          <span className="text-slate-400 font-medium text-xs">Nonaktif</span>
                        ) : isOut ? (
                          <span className="text-rose-700 font-semibold text-xs flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" /> Habis
                          </span>
                        ) : isLow ? (
                          <span className="text-amber-800 font-semibold text-xs flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" /> Menipis
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium text-xs flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Aman
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewProduct(p)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Lihat riwayat pergerakan stok"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Edit barang"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onToggleStatus(p.id)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              p.is_active
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={p.is_active ? 'Nonaktifkan barang' : 'Aktifkan barang'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingProductId(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Hapus barang"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Halaman {currentPage} dari {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
              >
                Sebelumnya
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded text-xs font-medium cursor-pointer ${
                    currentPage === i + 1
                      ? 'bg-slate-900 text-white font-bold'
                      : 'border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Tambah Barang */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Tambah Barang Sembako Baru</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAdd} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kode SKU *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full py-2 px-3 text-xs font-mono uppercase rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                    placeholder="Contoh: BRS-005"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori *</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Barang Sembako *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  placeholder="Contoh: Beras Rojo Lele Super 5kg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan *</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
                  >
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Modal (Rp) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full py-2 px-3 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                    placeholder="68000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full py-2 px-3 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                    placeholder="76000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stok Awal Fisik (Bisa Desimal)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    className="w-full py-2 px-3 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                    placeholder="Contoh: 15.5 atau 20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batas Stok Minimum *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full py-2 px-3 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                    placeholder="10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan / Deskripsi (Opsional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  placeholder="Contoh: Beras pulen kualitas premium asli Cianjur"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Barang */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Ubah Data Barang</h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kode SKU *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full py-2 px-3 text-xs font-mono uppercase rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori *</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Barang *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
                  >
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Modal (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full py-2 px-3 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full py-2 px-3 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batas Stok Minimum</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full py-2 px-3 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700">Stok Saat Ini:</span>
                  <p className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                    {formatStock(editingProduct.current_stock, editingProduct.unit)}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    (Ubah stok melalui menu Stok Opname atau Transaksi)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting ? 'Memperbarui...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detail Barang & Log Mutasi */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-800">
                    {viewingProduct.sku}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">{viewingProduct.name}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Kategori: {viewingProduct.category_name}</p>
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Stok Tersedia</span>
                <p className="font-mono text-lg font-bold text-slate-900 mt-0.5">
                  {formatStock(viewingProduct.current_stock, viewingProduct.unit)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Harga Modal</span>
                <p className="font-mono text-sm font-bold text-slate-700 mt-0.5">
                  {formatRupiah(viewingProduct.purchase_price)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Harga Jual</span>
                <p className="font-mono text-sm font-bold text-emerald-700 mt-0.5">
                  {formatRupiah(viewingProduct.selling_price)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Margin Laba</span>
                <p className="font-mono text-sm font-bold text-indigo-700 mt-0.5">
                  {formatRupiah(viewingProduct.selling_price - viewingProduct.purchase_price)}
                </p>
              </div>
            </div>

            {/* Riwayat Mutasi Spesifik Barang Ini */}
            <div className="mt-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>Audit Trail Pergerakan Stok Barang Ini</span>
              </h4>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Waktu</th>
                      <th className="py-2 px-3">Jenis</th>
                      <th className="py-2 px-2 text-right">Masuk</th>
                      <th className="py-2 px-2 text-right">Keluar</th>
                      <th className="py-2 px-2 text-right">Saldo</th>
                      <th className="py-2 px-3">Petugas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingMovements ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <RotateCw className="w-5 h-5 text-indigo-600 animate-spin" />
                            <span className="text-xs">Memuat histori mutasi stok dari database...</span>
                          </div>
                        </td>
                      </tr>
                    ) : viewingProduct.movements && viewingProduct.movements.length > 0 ? (
                      viewingProduct.movements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-[11px] text-slate-500">{formatDateTimeIndo(m.created_at)}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                m.movement_type === 'IN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : m.movement_type === 'SALE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {m.movement_type}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-blue-700">
                            {m.quantity_in > 0 ? `+${m.quantity_in}` : '-'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-red-600">
                            {m.quantity_out > 0 ? `-${m.quantity_out}` : '-'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                            {m.balance_after}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-600 truncate max-w-[120px]">
                            {m.user_name}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Belum ada catatan mutasi untuk barang ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingProduct(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete / Deactivate */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Perlindungan Integritas Data Transaksi</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Sesuai standar Sistem Informasi Akademik, barang yang telah memiliki riwayat penjualan, barang masuk, atau pergerakan buku besar tidak boleh dihapus secara permanen untuk menjaga keaslian jejak audit.
            </p>
            <p className="text-xs text-slate-600 mt-2 font-medium">
              Jika barang ini memiliki riwayat transaksi, sistem akan otomatis mengubah statusnya menjadi <b>NONAKTIF</b> agar tidak muncul di kasir penjualan namun histori laporan tetap valid.
            </p>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  const id = deletingProductId;
                  setDeletingProductId(null);
                  try {
                    await onDeleteProduct(id);
                    onRefresh();
                  } catch (e: any) {
                    alert(e.message);
                    onRefresh();
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
