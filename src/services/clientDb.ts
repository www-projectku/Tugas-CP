import { Product, Category, Supplier, StockInTransaction, SaleTransaction, StockMovement, StockAdjustment, StoreSettings, User, DashboardData, BootstrapData } from '../types/index.js';

const STORAGE_KEY = 'sembako_local_client_db_v1';

export interface ClientDatabaseSchema {
  users: User[];
  categories: Category[];
  products: Product[];
  suppliers: Supplier[];
  stock_in_transactions: StockInTransaction[];
  sales_transactions: SaleTransaction[];
  stock_movements: StockMovement[];
  stock_adjustments: StockAdjustment[];
  settings: StoreSettings;
}

function getInitialData(): ClientDatabaseSchema {
  const now = new Date();
  const isoNow = now.toISOString();

  const users: User[] = [
    {
      id: 'usr-1',
      username: 'admin',
      name: 'H. Sudirman (Pemilik Toko)',
      email: 'admin@toko-sembako.com',
      role: 'admin',
      is_active: true,
    },
    {
      id: 'usr-2',
      username: 'kasir',
      name: 'Siti Rahma (Petugas Kasir/Gudang)',
      email: 'kasir@toko-sembako.com',
      role: 'petugas',
      is_active: true,
    },
  ];

  const categories: Category[] = [
    { id: 'cat-1', name: 'Beras & Biji-bijian', description: 'Aneka varietas beras premium, pulen, ketan, dan kacang-kacangan', created_at: isoNow },
    { id: 'cat-2', name: 'Minyak Goreng & Margarin', description: 'Minyak goreng kelapa sawit kemasan dan margarin serbaguna', created_at: isoNow },
    { id: 'cat-3', name: 'Gula, Garam & Bumbu', description: 'Gula pasir kristal, gula merah, garam beryodium, dan kaldu bumbu', created_at: isoNow },
    { id: 'cat-4', name: 'Telur & Susu', description: 'Telur ayam ras segar, susu kental manis, dan susu bubuk', created_at: isoNow },
    { id: 'cat-5', name: 'Tepung, Mi & Kebutuhan Pokok', description: 'Tepung terigu, tepung beras, aneka mi instan, kopi, dan teh', created_at: isoNow },
  ];

  const suppliers: Supplier[] = [
    {
      id: 'sup-1',
      code: 'SUP-001',
      name: 'CV Berkah Pangan Nusantara',
      contact_person: 'Bpk. Hendra Gunawan',
      phone: '0812-8899-7711',
      address: 'Jl. Pergudangan Indah No. 12, Karawang, Jawa Barat',
      notes: 'Pemasok utama beras Cianjur, Rojolele, dan kacang-kacangan',
      is_active: true,
    },
    {
      id: 'sup-2',
      code: 'SUP-002',
      name: 'PT Sumber Sembako Makmur',
      contact_person: 'Ibu Ratna Dewi',
      phone: '0813-7722-3344',
      address: 'Kawasan Industri Sentra Distribusi Blok B4, Cikarang',
      notes: 'Distributor resmi minyak goreng Bimoli, Sania, dan tepung kemasan',
      is_active: true,
    },
    {
      id: 'sup-3',
      code: 'SUP-003',
      name: 'UD Jaya Telur & Hasil Bumi',
      contact_person: 'Bpk. Ahmad Fauzi',
      phone: '0857-4411-9900',
      address: 'Jl. Peternakan Unggas No. 8, Blitar - Kantor Distribusi Jakarta',
      notes: 'Pemasok harian telur ayam negeri segar dan gula pasir lokal',
      is_active: true,
    },
  ];

  const products: Product[] = [
    { id: 'prd-1', sku: 'BRS-001', name: 'Beras Rojo Lele Super 5kg', category_id: 'cat-1', unit: 'karung', purchase_price: 68000, selling_price: 76000, current_stock: 45, min_stock: 10, description: 'Beras pulen aroma alami ukuran 5 kg', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-2', sku: 'BRS-002', name: 'Beras Pandan Wangi Cianjur 5kg', category_id: 'cat-1', unit: 'karung', purchase_price: 78000, selling_price: 88000, current_stock: 32, min_stock: 8, description: 'Beras wangi pulen istimewa asli Cianjur', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-3', sku: 'BRS-003', name: 'Beras Setra Ramos 10kg', category_id: 'cat-1', unit: 'karung', purchase_price: 135000, selling_price: 152000, current_stock: 18, min_stock: 5, description: 'Kemasan 10kg kualitas medium-premium', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-4', sku: 'BRS-004', name: 'Beras Ketan Putih Curah (kg)', category_id: 'cat-1', unit: 'kg', purchase_price: 16000, selling_price: 19500, current_stock: 15.5, min_stock: 5, description: 'Ketan putih bersih untuk aneka kue', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-5', sku: 'MYK-001', name: 'Minyak Goreng Bimoli 2 Liter Pouch', category_id: 'cat-2', unit: 'pouch', purchase_price: 34000, selling_price: 38500, current_stock: 28, min_stock: 12, description: 'Minyak kelapa sawit murni kemasan 2L', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-6', sku: 'MYK-002', name: 'Minyak Goreng Sania Royale 2L', category_id: 'cat-2', unit: 'pouch', purchase_price: 33500, selling_price: 37500, current_stock: 4, min_stock: 10, description: 'Stok menipis! Perlu reorder segera', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-7', sku: 'MYK-003', name: 'Minyak Goreng Kita Botol 1L', category_id: 'cat-2', unit: 'botol', purchase_price: 14500, selling_price: 16500, current_stock: 40, min_stock: 15, description: 'Minyak goreng program pemerintah kemasan botol', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-8', sku: 'MYK-004', name: 'Blue Band Margarin Serbaguna 200g', category_id: 'cat-2', unit: 'bungkus', purchase_price: 8500, selling_price: 10500, current_stock: 24, min_stock: 8, description: 'Margarin kaya vitamin untuk olesan dan memasak', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-9', sku: 'GLA-001', name: 'Gula Pasir Gulaku Tebu Hijau 1kg', category_id: 'cat-3', unit: 'bungkus', purchase_price: 15800, selling_price: 18000, current_stock: 50, min_stock: 15, description: 'Gula pasir premium higienis 1 kilogram', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-10', sku: 'GLA-002', name: 'Gula Merah Kelapa Cetak (kg)', category_id: 'cat-3', unit: 'kg', purchase_price: 22000, selling_price: 26000, current_stock: 8.5, min_stock: 5, description: 'Gula aren/kelapa murni rasa legit alami', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-11', sku: 'GRM-001', name: 'Garam Beryodium Cap Kapal 250g', category_id: 'cat-3', unit: 'bungkus', purchase_price: 2500, selling_price: 3500, current_stock: 0, min_stock: 20, description: 'Stok habis total! Perlu pemesanan ke pemasok', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-12', sku: 'BMB-001', name: 'Royco Kaldu Ayam Kemasan 230g', category_id: 'cat-3', unit: 'bungkus', purchase_price: 9000, selling_price: 11000, current_stock: 35, min_stock: 10, description: 'Bumbu penyedap rasa ekstrak daging ayam', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-13', sku: 'TLR-001', name: 'Telur Ayam Ras Negeri (kg)', category_id: 'cat-4', unit: 'kg', purchase_price: 26500, selling_price: 30000, current_stock: 36.5, min_stock: 10, description: 'Telur segar pilihan dari peternakan terpercaya', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-14', sku: 'SSU-001', name: 'Susu Kental Manis Frisian Flag 370g', category_id: 'cat-4', unit: 'kaleng', purchase_price: 11500, selling_price: 13500, current_stock: 22, min_stock: 8, description: 'Susu kental manis bendera rasa coklat/putih', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-15', sku: 'SSU-002', name: 'Susu Bubuk Dancow Fortigro 390g', category_id: 'cat-4', unit: 'kotak', purchase_price: 39000, selling_price: 44000, current_stock: 12, min_stock: 5, description: 'Susu pertumbuhan gizi lengkap anak', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-16', sku: 'TPG-001', name: 'Tepung Terigu Segitiga Biru 1kg', category_id: 'cat-5', unit: 'bungkus', purchase_price: 11200, selling_price: 13000, current_stock: 60, min_stock: 20, description: 'Tepung terigu protein sedang serbaguna', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-17', sku: 'TPG-002', name: 'Tepung Beras Rose Brand 500g', category_id: 'cat-5', unit: 'bungkus', purchase_price: 6800, selling_price: 8500, current_stock: 30, min_stock: 10, description: 'Tepung beras putih berkualitas', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-18', sku: 'MIE-001', name: 'Indomie Goreng Original 85g (Dus 40 Pcs)', category_id: 'cat-5', unit: 'dus', purchase_price: 112000, selling_price: 124000, current_stock: 15, min_stock: 5, description: '1 Karton isi 40 bungkus mie goreng legendaris', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-19', sku: 'MIE-002', name: 'Indomie Goreng Eceran (Pcs)', category_id: 'cat-5', unit: 'pcs', purchase_price: 2800, selling_price: 3500, current_stock: 85, min_stock: 25, description: 'Indomie goreng satuan untuk eceran', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-20', sku: 'KOP-001', name: 'Kopi Kapal Api Special Merah 165g', category_id: 'cat-5', unit: 'bungkus', purchase_price: 13000, selling_price: 15500, current_stock: 25, min_stock: 8, description: 'Kopi bubuk murni mantap dan wangi', is_active: true, created_at: isoNow, updated_at: isoNow },
    { id: 'prd-21', sku: 'TEH-001', name: 'Teh Celup Sosro Kotak Isi 30 Kantong', category_id: 'cat-5', unit: 'kotak', purchase_price: 6500, selling_price: 8000, current_stock: 2, min_stock: 8, description: 'Stok menipis! Hanya tersisa 2 kotak', is_active: true, created_at: isoNow, updated_at: isoNow },
  ];

  const settings: StoreSettings = {
    store_name: 'Toko Sembako Berkah Mandiri',
    address: 'Jl. Pemuda Raya No. 108, Rawamangun, Jakarta Timur',
    phone: '0812-9876-5432',
    receipt_footer: 'Terima kasih atas kunjungan Anda di Toko Sembako Berkah Mandiri. Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
    default_min_stock: 10,
    currency_symbol: 'Rp',
  };

  const stock_movements: StockMovement[] = products.map((p, idx) => ({
    id: `mov-init-${idx + 1}`,
    product_id: p.id,
    product_sku: p.sku,
    product_name: p.name,
    movement_date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
    movement_type: 'IN',
    quantity_in: p.current_stock > 0 ? p.current_stock : 10,
    quantity_out: 0,
    balance_before: 0,
    balance_after: p.current_stock > 0 ? p.current_stock : 10,
    reference_type: 'stock_in',
    reference_id: 'trx-in-initial',
    reference_number: 'TRX-IN-SALDO-AWAL',
    user_id: 'usr-1',
    user_name: 'H. Sudirman (Pemilik Toko)',
    notes: 'Saldo awal pencatatan persediaan toko sembako',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  }));

  const sampleDate = new Date().toISOString().split('T')[0];
  const stock_in_transactions: StockInTransaction[] = [
    {
      id: 'trx-in-1',
      transaction_number: 'TRX-IN-20261020-001',
      transaction_date: sampleDate,
      supplier_id: 'sup-1',
      supplier_name: 'CV Berkah Pangan Nusantara',
      user_id: 'usr-1',
      user_name: 'H. Sudirman (Pemilik Toko)',
      total_amount: 3400000,
      notes: 'Pengiriman beras awal pekan',
      status: 'completed',
      items: [
        {
          id: 'sin-det-1',
          stock_in_id: 'trx-in-1',
          product_id: 'prd-1',
          product_sku: 'BRS-001',
          product_name: 'Beras Rojo Lele Super 5kg',
          unit: 'karung',
          quantity: 50,
          purchase_price: 68000,
          subtotal: 3400000,
        },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  const sales_transactions: SaleTransaction[] = [
    {
      id: 'trx-sal-1',
      transaction_number: 'TRX-SAL-20261022-001',
      transaction_date: sampleDate,
      user_id: 'usr-2',
      cashier_name: 'Siti Rahma (Petugas Kasir/Gudang)',
      payment_method: 'cash',
      total_amount: 174000,
      paid_amount: 200000,
      change_amount: 26000,
      notes: 'Pelanggan warung Bu Yati',
      status: 'completed',
      items: [
        {
          id: 'sal-det-1',
          sale_id: 'trx-sal-1',
          product_id: 'prd-1',
          product_sku: 'BRS-001',
          product_name: 'Beras Rojo Lele Super 5kg',
          unit: 'karung',
          quantity: 1,
          selling_price: 76000,
          purchase_price_snapshot: 68000,
          subtotal: 76000,
        },
        {
          id: 'sal-det-2',
          sale_id: 'trx-sal-1',
          product_id: 'prd-5',
          product_sku: 'MYK-001',
          product_name: 'Minyak Goreng Bimoli 2 Liter Pouch',
          unit: 'pouch',
          quantity: 2,
          selling_price: 38500,
          purchase_price_snapshot: 34000,
          subtotal: 77000,
        },
      ],
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ];

  return {
    users,
    categories,
    products,
    suppliers,
    stock_in_transactions,
    sales_transactions,
    stock_movements,
    stock_adjustments: [],
    settings,
  };
}

export class ClientDatabase {
  private data: ClientDatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): ClientDatabaseSchema {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    const initial = getInitialData();
    this.save(initial);
    return initial;
  }

  private save(data: ClientDatabaseSchema) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.data = data;
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  public getData(): ClientDatabaseSchema {
    return this.data;
  }

  public getBootstrapData(): BootstrapData {
    const catMap = new Map(this.data.categories.map((c) => [c.id, c.name]));
    const catCountMap = new Map<string, number>();
    for (const p of this.data.products) {
      catCountMap.set(p.category_id, (catCountMap.get(p.category_id) || 0) + 1);
    }
    const products = this.data.products.map((p) => ({
      ...p,
      category_name: catMap.get(p.category_id) || 'Tanpa Kategori',
      stock_status: (!p.is_active
        ? 'NONAKTIF'
        : p.current_stock <= 0
        ? 'HABIS'
        : p.current_stock <= p.min_stock
        ? 'MENIPIS'
        : 'AMAN') as 'AMAN' | 'HABIS' | 'MENIPIS' | 'NONAKTIF',
    }));
    const categories = this.data.categories.map((c) => ({
      ...c,
      product_count: catCountMap.get(c.id) || 0,
    }));
    return {
      settings: this.data.settings,
      dashboard: this.getDashboardSummary(),
      products,
      categories,
      suppliers: this.data.suppliers,
      stockInList: this.data.stock_in_transactions,
      salesList: this.data.sales_transactions,
      stockMovements: this.data.stock_movements,
      stockAdjustments: this.data.stock_adjustments || [],
    };
  }

  // Dashboard
  public getDashboardSummary(): DashboardData {
    const active = this.data.products.filter((p) => p.is_active);
    const today = new Date().toISOString().split('T')[0];

    const lowStockItems = active.filter((p) => p.current_stock > 0 && p.current_stock <= p.min_stock);
    const outOfStockItems = active.filter((p) => p.current_stock <= 0);

    const inventoryAssetValue = active.reduce((acc, p) => acc + p.current_stock * p.purchase_price, 0);
    const potentialSalesValue = active.reduce((acc, p) => acc + p.current_stock * p.selling_price, 0);

    const todayStockIns = this.data.stock_in_transactions.filter((tx) => tx.status === 'completed' && tx.transaction_date === today);
    const todaySales = this.data.sales_transactions.filter((tx) => tx.status === 'completed' && tx.transaction_date === today);

    const todaySalesTotalAmount = todaySales.reduce((acc, tx) => acc + tx.total_amount, 0);
    const todayStockInTotalAmount = todayStockIns.reduce((acc, tx) => acc + tx.total_amount, 0);

    let todayHpp = 0;
    for (const sale of todaySales) {
      for (const item of sale.items) {
        todayHpp += item.quantity * (item.purchase_price_snapshot || 0);
      }
    }

    const last7Days: { date: string; displayDate: string; sales: number; stockIn: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

      const daySales = this.data.sales_transactions
        .filter((tx) => tx.status === 'completed' && tx.transaction_date === dateStr)
        .reduce((sum, tx) => sum + tx.total_amount, 0);

      const dayStockIn = this.data.stock_in_transactions
        .filter((tx) => tx.status === 'completed' && tx.transaction_date === dateStr)
        .reduce((sum, tx) => sum + tx.total_amount, 0);

      last7Days.push({ date: dateStr, displayDate, sales: daySales, stockIn: dayStockIn });
    }

    const urgentReorders = [...outOfStockItems, ...lowStockItems].map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      current_stock: p.current_stock,
      min_stock: p.min_stock,
      shortage: Math.max(0, p.min_stock - p.current_stock + 5),
      status: (p.current_stock <= 0 ? 'HABIS' : 'MENIPIS') as 'HABIS' | 'MENIPIS',
    }));

    const recentActivities: any[] = [];
    for (const sale of this.data.sales_transactions.slice(-5).reverse()) {
      recentActivities.push({
        id: sale.id,
        type: 'SALE',
        number: sale.transaction_number,
        date: sale.transaction_date,
        party: sale.cashier_name,
        amount: sale.total_amount,
        status: sale.status,
        itemCount: sale.items.reduce((s, i) => s + i.quantity, 0),
      });
    }

    return {
      totalProducts: active.length,
      totalUnits: active.reduce((acc, p) => acc + p.current_stock, 0),
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      inventoryAssetValue,
      potentialSalesValue,
      todayStockInTotalAmount,
      todayStockInCount: todayStockIns.length,
      todaySalesTotalAmount,
      todaySalesCount: todaySales.length,
      todayGrossProfit: todaySalesTotalAmount - todayHpp,
      last7Days,
      topSellingProducts: [],
      urgentReorders,
      recentActivities,
    };
  }

  // Products
  public getProducts(params?: { category_id?: string; stock_status?: string; search?: string }): Product[] {
    const catMap = new Map(this.data.categories.map((c) => [c.id, c.name]));
    let list = this.data.products.map((p) => ({
      ...p,
      category_name: catMap.get(p.category_id) || '-',
    }));

    if (params?.category_id && params.category_id !== 'all') {
      list = list.filter((p) => p.category_id === params.category_id);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (params?.stock_status === 'safe' || params?.stock_status === 'normal') {
      list = list.filter((p) => p.is_active && p.current_stock > p.min_stock);
    } else if (params?.stock_status === 'critical' || params?.stock_status === 'kritis') {
      list = list.filter((p) => p.is_active && p.current_stock <= p.min_stock);
    } else if (params?.stock_status === 'low') {
      list = list.filter((p) => p.is_active && p.current_stock > 0 && p.current_stock <= p.min_stock);
    } else if (params?.stock_status === 'out') {
      list = list.filter((p) => p.is_active && p.current_stock <= 0);
    } else if (params?.stock_status === 'inactive') {
      list = list.filter((p) => !p.is_active);
    }

    return list;
  }

  public createProduct(data: any): Product {
    const existing = this.data.products.find((p) => p.sku === data.sku);
    if (existing) throw new Error(`SKU ${data.sku} sudah ada.`);

    const now = new Date().toISOString();
    const newProduct: Product = {
      id: `prd-${Date.now()}`,
      sku: data.sku.toUpperCase(),
      name: data.name,
      category_id: data.category_id,
      unit: data.unit,
      purchase_price: Number(data.purchase_price) || 0,
      selling_price: Number(data.selling_price) || 0,
      current_stock: Number(data.current_stock) || 0,
      min_stock: Number(data.min_stock) || 0,
      description: data.description || '',
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    this.data.products.push(newProduct);
    this.save(this.data);
    return newProduct;
  }

  public updateProduct(id: string, data: any): Product {
    const p = this.data.products.find((i) => i.id === id);
    if (!p) throw new Error('Barang tidak ditemukan.');
    if (data.name) p.name = data.name;
    if (data.sku) p.sku = data.sku.toUpperCase();
    if (data.category_id) p.category_id = data.category_id;
    if (data.unit) p.unit = data.unit;
    if (data.purchase_price !== undefined) p.purchase_price = Number(data.purchase_price);
    if (data.selling_price !== undefined) p.selling_price = Number(data.selling_price);
    if (data.min_stock !== undefined) p.min_stock = Number(data.min_stock);
    if (data.description !== undefined) p.description = data.description;
    p.updated_at = new Date().toISOString();
    this.save(this.data);
    return p;
  }

  public toggleProductStatus(id: string): Product {
    const p = this.data.products.find((i) => i.id === id);
    if (!p) throw new Error('Barang tidak ditemukan.');
    p.is_active = !p.is_active;
    this.save(this.data);
    return p;
  }

  public deleteProduct(id: string): void {
    const p = this.data.products.find((i) => i.id === id);
    if (!p) throw new Error('Barang tidak ditemukan.');
    p.is_active = false;
    this.save(this.data);
  }

  // Stock In
  public createStockIn(payload: any, user: User | null): StockInTransaction {
    const sup = this.data.suppliers.find((s) => s.id === payload.supplier_id);
    const dateStr = payload.transaction_date.replace(/-/g, '');
    const txNum = `TRX-IN-${dateStr}-${String(this.data.stock_in_transactions.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    let total = 0;
    const items = payload.items.map((it: any) => {
      const prod = this.data.products.find((p) => p.id === it.product_id)!;
      const subtotal = Number(it.quantity) * Number(it.purchase_price);
      total += subtotal;

      const before = prod.current_stock;
      prod.current_stock += Number(it.quantity);
      prod.purchase_price = Number(it.purchase_price);

      this.data.stock_movements.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        movement_date: payload.transaction_date,
        movement_type: 'IN',
        quantity_in: Number(it.quantity),
        quantity_out: 0,
        balance_before: before,
        balance_after: prod.current_stock,
        reference_type: 'stock_in',
        reference_id: txNum,
        reference_number: txNum,
        user_id: user?.id || 'usr-1',
        user_name: user?.name || 'Administrator',
        notes: payload.notes || `Penerimaan dari ${sup?.name || 'Pemasok'}`,
        created_at: now,
      });

      return {
        id: `sindet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        stock_in_id: txNum,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        unit: prod.unit,
        quantity: Number(it.quantity),
        purchase_price: Number(it.purchase_price),
        subtotal,
      };
    });

    const tx: StockInTransaction = {
      id: `sin-${Date.now()}`,
      transaction_number: txNum,
      transaction_date: payload.transaction_date,
      supplier_id: payload.supplier_id,
      supplier_name: sup?.name || 'Pemasok',
      user_id: user?.id || 'usr-1',
      user_name: user?.name || 'Administrator',
      total_amount: total,
      notes: payload.notes,
      status: 'completed',
      items,
      created_at: now,
    };

    this.data.stock_in_transactions.push(tx);
    this.save(this.data);
    return tx;
  }

  // Sales POS
  public createSale(payload: any, user: User | null): SaleTransaction {
    const today = new Date().toISOString().split('T')[0];
    const dateStr = today.replace(/-/g, '');
    const txNum = `TRX-SAL-${dateStr}-${String(this.data.sales_transactions.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    let total = 0;
    const items = payload.items.map((it: any) => {
      const prod = this.data.products.find((p) => p.id === it.product_id)!;
      const requested = Number(it.quantity);
      if (prod.current_stock < requested) {
        throw new Error(`Stok "${prod.name}" tidak mencukupi (Tersedia: ${prod.current_stock}).`);
      }

      const subtotal = requested * prod.selling_price;
      total += subtotal;

      const before = prod.current_stock;
      prod.current_stock -= requested;

      this.data.stock_movements.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        movement_date: today,
        movement_type: 'SALE',
        quantity_in: 0,
        quantity_out: requested,
        balance_before: before,
        balance_after: prod.current_stock,
        reference_type: 'sale',
        reference_id: txNum,
        reference_number: txNum,
        user_id: user?.id || 'usr-2',
        user_name: user?.name || 'Kasir',
        notes: `Penjualan kasir [${txNum}]`,
        created_at: now,
      });

      return {
        id: `saldet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sale_id: txNum,
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        unit: prod.unit,
        quantity: requested,
        selling_price: prod.selling_price,
        purchase_price_snapshot: prod.purchase_price,
        subtotal,
      };
    });

    const paid = Number(payload.paid_amount) || total;
    const sale: SaleTransaction = {
      id: `sal-${Date.now()}`,
      transaction_number: txNum,
      transaction_date: today,
      user_id: user?.id || 'usr-2',
      cashier_name: user?.name || 'Kasir',
      payment_method: payload.payment_method || 'cash',
      total_amount: total,
      paid_amount: paid,
      change_amount: Math.max(0, paid - total),
      notes: payload.notes,
      status: 'completed',
      items,
      created_at: now,
    };

    this.data.sales_transactions.push(sale);
    this.save(this.data);
    return sale;
  }

  // Stock Opname
  public createAdjustment(payload: any, user: User | null): StockAdjustment {
    const prod = this.data.products.find((p) => p.id === payload.product_id)!;
    const recorded = prod.current_stock;
    const physical = Number(payload.physical_stock);
    const diff = physical - recorded;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const adjNum = `ADJ-${today.replace(/-/g, '')}-${String(this.data.stock_adjustments.length + 1).padStart(3, '0')}`;

    prod.current_stock = physical;

    const adj: StockAdjustment = {
      id: `adj-${Date.now()}`,
      adjustment_number: adjNum,
      adjustment_date: today,
      product_id: prod.id,
      product_sku: prod.sku,
      product_name: prod.name,
      recorded_stock: recorded,
      physical_stock: physical,
      difference: diff,
      reason: payload.reason,
      user_id: user?.id || 'usr-1',
      user_name: user?.name || 'Administrator',
      created_at: now,
    };

    this.data.stock_movements.push({
      id: `mov-${Date.now()}`,
      product_id: prod.id,
      product_sku: prod.sku,
      product_name: prod.name,
      movement_date: today,
      movement_type: 'ADJUSTMENT',
      quantity_in: diff > 0 ? diff : 0,
      quantity_out: diff < 0 ? Math.abs(diff) : 0,
      balance_before: recorded,
      balance_after: physical,
      reference_type: 'adjustment',
      reference_id: adjNum,
      reference_number: adjNum,
      user_id: user?.id || 'usr-1',
      user_name: user?.name || 'Administrator',
      notes: `PENYESUAIAN: ${payload.reason}`,
      created_at: now,
    });

    this.data.stock_adjustments.push(adj);
    this.save(this.data);
    return adj;
  }
}

export const clientDb = new ClientDatabase();
