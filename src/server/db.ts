import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Types
export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'petugas';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  unit: string; // e.g. 'kg', 'liter', 'pcs', 'dus', 'bungkus', 'botol', 'pak'
  purchase_price: number; // Harga beli (modal)
  selling_price: number; // Harga jual
  current_stock: number; // Stok saat ini (bisa desimal)
  min_stock: number; // Batas stok minimum
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockInItem {
  product_id: string;
  quantity: number;
  purchase_price: number;
}

export interface StockInDetail {
  id: string;
  stock_in_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  unit: string;
  quantity: number;
  purchase_price: number;
  subtotal: number;
}

export interface StockInTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  supplier_id: string;
  supplier_name: string;
  user_id: string;
  user_name: string;
  total_amount: number;
  notes?: string;
  status: 'completed' | 'cancelled';
  items: StockInDetail[];
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  product_id: string;
  quantity: number;
}

export interface SaleDetail {
  id: string;
  sale_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  unit: string;
  quantity: number;
  selling_price: number;
  purchase_price_snapshot: number; // Untuk kalkulasi HPP dan laba kotor
  subtotal: number;
}

export interface SaleTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  user_id: string;
  cashier_name: string;
  payment_method: 'cash' | 'transfer' | 'qris';
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  notes?: string;
  status: 'completed' | 'cancelled';
  items: SaleDetail[];
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  movement_date: string;
  movement_type: 'IN' | 'SALE' | 'ADJUSTMENT' | 'CANCEL_SALE' | 'CANCEL_IN';
  quantity_in: number;
  quantity_out: number;
  balance_before: number;
  balance_after: number;
  reference_type: 'stock_in' | 'sale' | 'adjustment';
  reference_id: string;
  reference_number: string;
  user_id: string;
  user_name: string;
  notes?: string;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  adjustment_date: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  recorded_stock: number;
  physical_stock: number;
  difference: number;
  reason: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

export interface StoreSettings {
  store_name: string;
  address: string;
  phone: string;
  receipt_footer: string;
  default_min_stock: number;
  currency_symbol: string;
  logo_url?: string;
}

export interface DatabaseSchema {
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

// Simple asynchronous lock to guarantee transaction serialization
class Mutex {
  private mutex = Promise.resolve();

  lock(): Promise<() => void> {
    let unlock: () => void = () => {};
    const next = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const current = this.mutex;
    this.mutex = current.then(() => next);
    return current.then(() => unlock);
  }
}

export class Database {
  private filePath: string;
  private data: DatabaseSchema;
  private mutex = new Mutex();

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'sembako.db.json');
    this.data = this.loadOrCreate();
  }

  public getFilePath(): string {
    return this.filePath;
  }

  private loadOrCreate(): DatabaseSchema {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Error reading database file, initializing fresh demo data:', err);
      }
    }

    const initialData = this.generateInitialSeed();
    this.saveDirect(initialData);
    return initialData;
  }

  private saveDirect(data: DatabaseSchema) {
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }

  public async runTransaction<T>(callback: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
    const unlock = await this.mutex.lock();
    try {
      // Deep clone snapshot for safe rollback
      const snapshot: DatabaseSchema = JSON.parse(JSON.stringify(this.data));
      try {
        const result = await callback(this.data);
        this.saveDirect(this.data);
        return result;
      } catch (err) {
        // Rollback state in memory
        this.data = snapshot;
        throw err;
      }
    } finally {
      unlock();
    }
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  // Helper for generating password hash using PBKDF2
  public static hashPassword(password: string): string {
    const salt = 'sembako_salt_2026';
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  }

  public static verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  // Pre-configured rich Indonesian sembako seed data
  private generateInitialSeed(): DatabaseSchema {
    const now = new Date();
    const isoNow = now.toISOString();

    const users: User[] = [
      {
        id: 'usr-1',
        username: 'admin',
        name: 'H. Sudirman (Pemilik Toko)',
        email: 'admin@toko-sembako.com',
        password_hash: Database.hashPassword('admin123'),
        role: 'admin',
        is_active: true,
        created_at: isoNow,
        updated_at: isoNow,
      },
      {
        id: 'usr-2',
        username: 'kasir',
        name: 'Siti Rahma (Petugas Kasir/Gudang)',
        email: 'kasir@toko-sembako.com',
        password_hash: Database.hashPassword('kasir123'),
        role: 'petugas',
        is_active: true,
        created_at: isoNow,
        updated_at: isoNow,
      },
    ];

    const categories: Category[] = [
      { id: 'cat-1', name: 'Beras & Biji-bijian', description: 'Aneka varietas beras premium, pulen, ketan, dan kacang-kacangan', created_at: isoNow, updated_at: isoNow },
      { id: 'cat-2', name: 'Minyak Goreng & Margarin', description: 'Minyak goreng kelapa sawit kemasan dan margarin serbaguna', created_at: isoNow, updated_at: isoNow },
      { id: 'cat-3', name: 'Gula, Garam & Bumbu', description: 'Gula pasir kristal, gula merah, garam beryodium, dan kaldu bumbu', created_at: isoNow, updated_at: isoNow },
      { id: 'cat-4', name: 'Telur & Susu', description: 'Telur ayam ras segar, susu kental manis, dan susu bubuk', created_at: isoNow, updated_at: isoNow },
      { id: 'cat-5', name: 'Tepung, Mi & Kebutuhan Pokok', description: 'Tepung terigu, tepung beras, aneka mi instan, kopi, dan teh', created_at: isoNow, updated_at: isoNow },
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
        created_at: isoNow,
        updated_at: isoNow,
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
        created_at: isoNow,
        updated_at: isoNow,
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
        created_at: isoNow,
        updated_at: isoNow,
      },
    ];

    const products: Product[] = [
      // Beras & Biji-bijian
      { id: 'prd-1', sku: 'BRS-001', name: 'Beras Rojo Lele Super 5kg', category_id: 'cat-1', unit: 'karung', purchase_price: 68000, selling_price: 76000, current_stock: 45, min_stock: 10, description: 'Beras pulen aroma alami ukuran 5 kg', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-2', sku: 'BRS-002', name: 'Beras Pandan Wangi Cianjur 5kg', category_id: 'cat-1', unit: 'karung', purchase_price: 78000, selling_price: 88000, current_stock: 32, min_stock: 8, description: 'Beras wangi pulen istimewa asli Cianjur', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-3', sku: 'BRS-003', name: 'Beras Setra Ramos 10kg', category_id: 'cat-1', unit: 'karung', purchase_price: 135000, selling_price: 152000, current_stock: 18, min_stock: 5, description: 'Kemasan 10kg kualitas medium-premium', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-4', sku: 'BRS-004', name: 'Beras Ketan Putih Curah (kg)', category_id: 'cat-1', unit: 'kg', purchase_price: 16000, selling_price: 19500, current_stock: 15.5, min_stock: 5, description: 'Ketan putih bersih untuk aneka kue', is_active: true, created_at: isoNow, updated_at: isoNow },

      // Minyak Goreng & Margarin
      { id: 'prd-5', sku: 'MYK-001', name: 'Minyak Goreng Bimoli 2 Liter Pouch', category_id: 'cat-2', unit: 'pouch', purchase_price: 34000, selling_price: 38500, current_stock: 28, min_stock: 12, description: 'Minyak kelapa sawit murni kemasan 2L', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-6', sku: 'MYK-002', name: 'Minyak Goreng Sania Royale 2L', category_id: 'cat-2', unit: 'pouch', purchase_price: 33500, selling_price: 37500, current_stock: 4, min_stock: 10, description: 'Stok menipis! Perlu reorder segera', is_active: true, created_at: isoNow, updated_at: isoNow }, // Low stock condition
      { id: 'prd-7', sku: 'MYK-003', name: 'Minyak Goreng Kita Botol 1L', category_id: 'cat-2', unit: 'botol', purchase_price: 14500, selling_price: 16500, current_stock: 40, min_stock: 15, description: 'Minyak goreng program pemerintah kemasan botol', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-8', sku: 'MYK-004', name: 'Blue Band Margarin Serbaguna 200g', category_id: 'cat-2', unit: 'bungkus', purchase_price: 8500, selling_price: 10500, current_stock: 24, min_stock: 8, description: 'Margarin kaya vitamin untuk olesan dan memasak', is_active: true, created_at: isoNow, updated_at: isoNow },

      // Gula, Garam & Bumbu
      { id: 'prd-9', sku: 'GLA-001', name: 'Gula Pasir Gulaku Tebu Hijau 1kg', category_id: 'cat-3', unit: 'bungkus', purchase_price: 15800, selling_price: 18000, current_stock: 50, min_stock: 15, description: 'Gula pasir premium higienis 1 kilogram', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-10', sku: 'GLA-002', name: 'Gula Merah Kelapa Cetak (kg)', category_id: 'cat-3', unit: 'kg', purchase_price: 22000, selling_price: 26000, current_stock: 8.5, min_stock: 5, description: 'Gula aren/kelapa murni rasa legit alami', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-11', sku: 'GRM-001', name: 'Garam Beryodium Cap Kapal 250g', category_id: 'cat-3', unit: 'bungkus', purchase_price: 2500, selling_price: 3500, current_stock: 0, min_stock: 20, description: 'Stok habis total! Perlu pemesanan ke pemasok', is_active: true, created_at: isoNow, updated_at: isoNow }, // Out of stock condition
      { id: 'prd-12', sku: 'BMB-001', name: 'Royco Kaldu Ayam Kemasan 230g', category_id: 'cat-3', unit: 'bungkus', purchase_price: 9000, selling_price: 11000, current_stock: 35, min_stock: 10, description: 'Bumbu penyedap rasa ekstrak daging ayam', is_active: true, created_at: isoNow, updated_at: isoNow },

      // Telur & Susu
      { id: 'prd-13', sku: 'TLR-001', name: 'Telur Ayam Ras Negeri (kg)', category_id: 'cat-4', unit: 'kg', purchase_price: 26500, selling_price: 30000, current_stock: 36.5, min_stock: 10, description: 'Telur segar pilihan dari peternakan terpercaya', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-14', sku: 'SSU-001', name: 'Susu Kental Manis Frisian Flag 370g', category_id: 'cat-4', unit: 'kaleng', purchase_price: 11500, selling_price: 13500, current_stock: 22, min_stock: 8, description: 'Susu kental manis bendera rasa coklat/putih', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-15', sku: 'SSU-002', name: 'Susu Bubuk Dancow Fortigro 390g', category_id: 'cat-4', unit: 'kotak', purchase_price: 39000, selling_price: 44000, current_stock: 12, min_stock: 5, description: 'Susu pertumbuhan gizi lengkap anak', is_active: true, created_at: isoNow, updated_at: isoNow },

      // Tepung, Mi & Kebutuhan Pokok
      { id: 'prd-16', sku: 'TPG-001', name: 'Tepung Terigu Segitiga Biru 1kg', category_id: 'cat-5', unit: 'bungkus', purchase_price: 11200, selling_price: 13000, current_stock: 60, min_stock: 20, description: 'Tepung terigu protein sedang serbaguna', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-17', sku: 'TPG-002', name: 'Tepung Beras Rose Brand 500g', category_id: 'cat-5', unit: 'bungkus', purchase_price: 6800, selling_price: 8500, current_stock: 30, min_stock: 10, description: 'Tepung beras putih berkualitas', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-18', sku: 'MIE-001', name: 'Indomie Goreng Original 85g (Dus 40 Pcs)', category_id: 'cat-5', unit: 'dus', purchase_price: 112000, selling_price: 124000, current_stock: 15, min_stock: 5, description: '1 Karton isi 40 bungkus mie goreng legendaris', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-19', sku: 'MIE-002', name: 'Indomie Goreng Eceran (Pcs)', category_id: 'cat-5', unit: 'pcs', purchase_price: 2800, selling_price: 3500, current_stock: 85, min_stock: 25, description: 'Indomie goreng satuan untuk eceran', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-20', sku: 'KOP-001', name: 'Kopi Kapal Api Special Merah 165g', category_id: 'cat-5', unit: 'bungkus', purchase_price: 13000, selling_price: 15500, current_stock: 25, min_stock: 8, description: 'Kopi bubuk murni mantap dan wangi', is_active: true, created_at: isoNow, updated_at: isoNow },
      { id: 'prd-21', sku: 'TEH-001', name: 'Teh Celup Sosro Kotak Isi 30 Kantong', category_id: 'cat-5', unit: 'kotak', purchase_price: 6500, selling_price: 8000, current_stock: 2, min_stock: 8, description: 'Stok menipis! Hanya tersisa 2 kotak', is_active: true, created_at: isoNow, updated_at: isoNow }, // Low stock condition
    ];

    const settings: StoreSettings = {
      store_name: 'Toko Sembako Berkah Mandiri',
      address: 'Jl. Pemuda Raya No. 108, Rawamangun, Jakarta Timur',
      phone: '0812-9876-5432',
      receipt_footer: 'Terima kasih atas kunjungan Anda di Toko Sembako Berkah Mandiri. Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
      default_min_stock: 10,
      currency_symbol: 'Rp',
    };

    // Prepopulate initial stock movement entries so ledger has transparent history from the beginning
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

    // If Garam Dolphin is 0, add an adjustment or sale that depleted it
    stock_movements.push({
      id: `mov-adj-depleted`,
      product_id: 'prd-11',
      product_sku: 'GRM-001',
      product_name: 'Garam Beryodium Cap Kapal 250g',
      movement_date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
      movement_type: 'ADJUSTMENT',
      quantity_in: 0,
      quantity_out: 10,
      balance_before: 10,
      balance_after: 0,
      reference_type: 'adjustment',
      reference_id: 'adj-001',
      reference_number: 'ADJ-20261021-001',
      user_id: 'usr-1',
      user_name: 'H. Sudirman (Pemilik Toko)',
      notes: 'Hasil stok opname: barang rusak terkena rembesan air hujan di gudang',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    });

    const stock_adjustments: StockAdjustment[] = [
      {
        id: 'adj-001',
        adjustment_number: 'ADJ-20261021-001',
        adjustment_date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
        product_id: 'prd-11',
        product_sku: 'GRM-001',
        product_name: 'Garam Beryodium Cap Kapal 250g',
        recorded_stock: 10,
        physical_stock: 0,
        difference: -10,
        reason: 'Hasil stok opname: barang rusak terkena rembesan air hujan di gudang',
        user_id: 'usr-1',
        user_name: 'H. Sudirman (Pemilik Toko)',
        created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
    ];

    // Seed 1 completed stock in transaction
    const sampleStockInDate = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];
    const stock_in_transactions: StockInTransaction[] = [
      {
        id: 'trx-in-1',
        transaction_number: 'TRX-IN-20261020-001',
        transaction_date: sampleStockInDate,
        supplier_id: 'sup-1',
        supplier_name: 'CV Berkah Pangan Nusantara',
        user_id: 'usr-1',
        user_name: 'H. Sudirman (Pemilik Toko)',
        total_amount: 3400000,
        notes: 'Pengiriman beras awal pekan dari Karawang',
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
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ];

    // Seed 2 sample sales transactions
    const sampleSaleDate = new Date().toISOString().split('T')[0];
    const sales_transactions: SaleTransaction[] = [
      {
        id: 'trx-sal-1',
        transaction_number: 'TRX-SAL-20261022-001',
        transaction_date: sampleSaleDate,
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
          {
            id: 'sal-det-3',
            sale_id: 'trx-sal-1',
            product_id: 'prd-19',
            product_sku: 'MIE-002',
            product_name: 'Indomie Goreng Eceran (Pcs)',
            unit: 'pcs',
            quantity: 6,
            selling_price: 3500,
            purchase_price_snapshot: 2800,
            subtotal: 21000,
          },
        ],
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'trx-sal-2',
        transaction_number: 'TRX-SAL-20261022-002',
        transaction_date: sampleSaleDate,
        user_id: 'usr-2',
        cashier_name: 'Siti Rahma (Petugas Kasir/Gudang)',
        payment_method: 'qris',
        total_amount: 98000,
        paid_amount: 98000,
        change_amount: 0,
        notes: 'Pembayaran QRIS via mobile banking',
        status: 'completed',
        items: [
          {
            id: 'sal-det-4',
            sale_id: 'trx-sal-2',
            product_id: 'prd-9',
            product_sku: 'GLA-001',
            product_name: 'Gula Pasir Gulaku Tebu Hijau 1kg',
            unit: 'bungkus',
            quantity: 2,
            selling_price: 18000,
            purchase_price_snapshot: 15800,
            subtotal: 36000,
          },
          {
            id: 'sal-det-5',
            sale_id: 'trx-sal-2',
            product_id: 'prd-13',
            product_sku: 'TLR-001',
            product_name: 'Telur Ayam Ras Negeri (kg)',
            unit: 'kg',
            quantity: 2,
            selling_price: 30000,
            purchase_price_snapshot: 26500,
            subtotal: 60000,
          },
          {
            id: 'sal-det-6',
            sale_id: 'trx-sal-2',
            product_id: 'prd-17',
            product_sku: 'TPG-002',
            product_name: 'Tepung Beras Rose Brand 500g',
            unit: 'bungkus',
            quantity: 1,
            selling_price: 8500,
            purchase_price_snapshot: 6800,
            subtotal: 8500,
          },
        ],
        created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
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
      stock_adjustments,
      settings,
    };
  }
}

export const dbInstance = new Database();
