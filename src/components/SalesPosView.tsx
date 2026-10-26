import React, { useState, useMemo } from 'react';
import { Product, Category, SaleTransaction, User, StoreSettings } from '../types/index.js';
import { formatRupiah, formatStock, formatDateIndo, formatDateTimeIndo } from '../utils/format.js';
import { StoreLogo } from './StoreLogo.js';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Printer,
  History,
  RotateCcw,
  X,
  CreditCard,
  QrCode,
  Banknote,
  Eye,
  Store
} from 'lucide-react';

interface SalesPosViewProps {
  products: Product[];
  categories: Category[];
  salesList: SaleTransaction[];
  settings: StoreSettings | null;
  user: User | null;
  onRefresh: () => void;
  onCreateSale: (data: any) => Promise<SaleTransaction>;
  onCancelSale: (id: string, reason: string) => Promise<void>;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const SalesPosView: React.FC<SalesPosViewProps> = ({
  products,
  categories,
  salesList,
  settings,
  user,
  onRefresh,
  onCreateSale,
  onCancelSale,
}) => {
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');

  // POS State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Completed Receipt Modal State
  const [receiptTx, setReceiptTx] = useState<SaleTransaction | null>(null);

  // Cancellation Modal State
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Filter available products
  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      const matchActive = p.is_active;
      const matchCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
      const matchSearch =
        searchTerm === '' ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());

      return matchActive && matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    setErrorMsg(null);
    if (product.current_stock <= 0) {
      setErrorMsg(`Stok "${product.name}" habis. Tidak dapat ditambahkan ke keranjang.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          setErrorMsg(`Jumlah keranjang mencapai stok maksimal yang tersedia (${product.current_stock} ${product.unit}).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setErrorMsg(null);
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.product.current_stock) {
              setErrorMsg(`Stok tidak mencukupi. Maksimal ${item.product.current_stock} ${item.product.unit}.`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setErrorMsg(null);
  };

  // Calculations
  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.product.selling_price, 0);
  const paid = Number(cashAmount) || 0;
  const changeAmount = paymentMethod === 'cash' ? Math.max(0, paid - totalAmount) : 0;

  // Set quick cash helper buttons
  const handleQuickCash = (amount: number) => {
    setCashAmount(amount.toString());
  };

  // Submit Sale
  const handleProcessSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('Keranjang belanja masih kosong.');
      return;
    }

    if (paymentMethod === 'cash' && paid < totalAmount) {
      setErrorMsg(
        `Uang pembayaran (${formatRupiah(paid)}) kurang dari total belanja (${formatRupiah(totalAmount)}).`
      );
      return;
    }

    try {
      setSubmitting(true);
      const sale = await onCreateSale({
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        payment_method: paymentMethod,
        paid_amount: paymentMethod === 'cash' ? paid : totalAmount,
        notes,
      });

      // Show receipt modal
      setReceiptTx(sale);
      // Clear cart
      setCart([]);
      setCashAmount('');
      setNotes('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses transaksi penjualan.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Return / Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingSaleId || !cancelReason.trim()) {
      alert('Alasan pembatalan/retur wajib diisi.');
      return;
    }
    try {
      await onCancelSale(cancellingSaleId, cancelReason.trim());
      setCancellingSaleId(null);
      setCancelReason('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            
            <span>Kasir Penjualan (Point of Sale)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan transaksi eceran kasir dengan pengurangan stok otomatis dan penerbitan struk belanja.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'pos' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Terminal Kasir
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Riwayat Nota ({salesList.length})
          </button>
        </div>
      </div>

      {/* View 1: POS Interface */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Product Catalog & Search (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search and Category Quick Filters */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Ketik nama sembako atau kode SKU barang..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>

              {/* Category Segmented Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  Semua ({products.filter((p) => p.is_active).length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === c.id
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {availableProducts.length === 0 ? (
                <div className="col-span-full bg-white p-8 rounded-lg border border-slate-200/80 text-center text-slate-400 text-xs font-mono">
                  Tidak ada komoditas sembako yang cocok dengan filter.
                </div>
              ) : (
                availableProducts.map((p) => {
                  const isOut = p.current_stock <= 0;
                  const isLow = p.current_stock > 0 && p.current_stock <= p.min_stock;
                  const cartQty = cart.find((i) => i.product.id === p.id)?.quantity || 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOut && handleAddToCart(p)}
                      className={`bg-white p-3 rounded-lg border transition-all text-left flex flex-col justify-between select-none ${
                        isOut
                          ? 'border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed'
                          : 'border-slate-200/90 hover:border-slate-400 hover:shadow-2xs cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-mono text-slate-400 text-[10px]">{p.sku}</span>
                          <span
                            className={`font-mono text-[10px] font-medium tabular-nums ${
                              isOut
                                ? 'text-rose-600 font-bold'
                                : isLow
                                ? 'text-amber-800'
                                : 'text-slate-500'
                            }`}
                          >
                            Stok: {formatStock(p.current_stock, p.unit)}
                          </span>
                        </div>
                        <h4 className="font-semibold text-xs text-slate-900 line-clamp-2 leading-snug">
                          {p.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-slate-900 tabular-nums">
                          {formatRupiah(p.selling_price)}
                        </span>
                        {cartQty > 0 ? (
                          <span className="w-5 h-5 rounded bg-slate-900 text-white text-[11px] font-mono font-bold flex items-center justify-center">
                            {cartQty}
                          </span>
                        ) : (
                          <div className="w-5 h-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center text-xs">
                            <Plus className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Shopping Cart & Checkout (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-600" />
                <span>Keranjang Belanja ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Cart Items List */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>Keranjang masih kosong.</p>
                  <p className="text-[11px] mt-0.5">Pilih barang sembako di sebelah kiri untuk menjual.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{item.product.name}</p>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {formatRupiah(item.product.selling_price)} / {item.product.unit}
                      </div>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.product.id, -1)}
                        className="w-6 h-6 rounded bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center cursor-pointer text-slate-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-mono font-bold text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.product.id, 1)}
                        className="w-6 h-6 rounded bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center cursor-pointer text-slate-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right w-20 shrink-0 font-mono font-bold text-slate-900">
                      {formatRupiah(item.quantity * item.product.selling_price)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.product.id)}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Total Section */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Tagihan</span>
                <span className="text-2xl font-extrabold text-slate-900 font-mono">
                  {formatRupiah(totalAmount)}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1.5">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setCashAmount(totalAmount.toString());
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                      paymentMethod === 'cash'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Tunai
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('qris');
                      setCashAmount(totalAmount.toString());
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                      paymentMethod === 'qris'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('transfer');
                      setCashAmount(totalAmount.toString());
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                      paymentMethod === 'transfer'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Transfer
                  </button>
                </div>
              </div>

              {/* Cash payment specific input */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <label className="block text-xs font-semibold text-slate-700">Nominal Uang Diterima (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Contoh: 100000"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="w-full py-2 px-3 text-sm font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
                  />

                  {/* Quick cash denomination chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleQuickCash(totalAmount)}
                      className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      Uang Pas
                    </button>
                    {[20000, 50000, 100000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickCash(amt)}
                        className="px-2 py-1 text-[11px] font-mono bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        {amt.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Kembalian:</span>
                    <span className="font-mono text-base font-extrabold text-emerald-700">
                      {formatRupiah(changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <input
                  type="text"
                  placeholder="Catatan transaksi (opsional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={handleProcessSale}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>{submitting ? 'Memproses Transaksi...' : `Bayar & Cetak Struk (${formatRupiah(totalAmount)})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Sales History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">No. Transaksi</th>
                  <th className="py-3 px-4">Tanggal & Waktu</th>
                  <th className="py-3 px-4">Kasir</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-3 text-right">Total Item</th>
                  <th className="py-3 px-3 text-right">Total Belanja</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Belum ada catatan transaksi penjualan.
                    </td>
                  </tr>
                ) : (
                  salesList.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{sale.transaction_number}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDateTimeIndo(sale.created_at)}</td>
                      <td className="py-3 px-4 text-slate-700">{sale.cashier_name}</td>
                      <td className="py-3 px-4 uppercase font-semibold text-slate-600">{sale.payment_method}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        {sale.items.reduce((s, i) => s + i.quantity, 0)} unit
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(sale.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            sale.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {sale.status === 'completed' ? 'SUKSES' : 'DIRETUR'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setReceiptTx(sale)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Buka struk cetak"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && sale.status === 'completed' && (
                            <button
                              onClick={() => setCancellingSaleId(sale.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              title="Batalkan/retur transaksi dan kembalikan stok ke etalase"
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

      {/* Printable Thermal Receipt Modal */}
      {receiptTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 my-8">
            {/* Action buttons (hidden when printing) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Transaksi Berhasil
              </span>
              <button onClick={() => setReceiptTx(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Preview Area (Format Struk Thermal 80mm) */}
            <div id="printable-receipt" className="p-4 my-2 font-mono text-xs text-slate-900 bg-slate-50/50 rounded-xl border border-slate-200">
              <div className="text-center pb-3 border-b border-dashed border-slate-300 flex flex-col items-center">
                <div className="mb-2">
                  <StoreLogo
                    logoUrl={settings?.logo_url}
                    storeName={settings?.store_name}
                    size="sm"
                  />
                </div>
                <h3 className="font-bold text-sm tracking-tight">{settings?.store_name || 'TOKO SEMBAKO BERKAH MANDIRI'}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{settings?.address || 'Jl. Pemuda Raya No. 108, Jakarta'}</p>
                <p className="text-[10px] text-slate-500">Telp: {settings?.phone || '0812-9876-5432'}</p>
              </div>

              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Transaksi:</span>
                  <span className="font-bold">{receiptTx.transaction_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu:</span>
                  <span>{formatDateTimeIndo(receiptTx.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kasir:</span>
                  <span>{receiptTx.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Bayar:</span>
                  <span className="uppercase font-semibold">{receiptTx.payment_method}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-2">
                {receiptTx.items.map((it) => (
                  <div key={it.id}>
                    <div className="font-bold text-slate-900">{it.product_name}</div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>{it.quantity} {it.unit} x {formatRupiah(it.selling_price)}</span>
                      <span className="font-bold text-slate-900">{formatRupiah(it.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between text-xs font-extrabold text-slate-900">
                  <span>TOTAL:</span>
                  <span>{formatRupiah(receiptTx.total_amount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Bayar:</span>
                  <span>{formatRupiah(receiptTx.paid_amount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Kembali:</span>
                  <span>{formatRupiah(receiptTx.change_amount)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 text-center text-[10px] text-slate-500">
                <p>{settings?.receipt_footer || 'Terima kasih atas kunjungan Anda.'}</p>
                <p className="mt-1 font-sans text-[9px] text-slate-400">=== Bukti Pembayaran Sah Toko Sembako ===</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk Fisik</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptTx(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation / Refund Modal */}
      {cancellingSaleId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Batalkan / Retur Penjualan Kasir</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Membatalkan penjualan akan mengembalikan seluruh barang yang dibeli ke etalase toko dan mencatat mutasi pembalik pada buku besar.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Retur / Pembatalan *
              </label>
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Barang rusak saat dibawa pelanggan / salah input nominal"
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setCancellingSaleId(null);
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
                Konfirmasi Pembatalan & Kembalikan Stok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
