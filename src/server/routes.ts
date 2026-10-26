import { Router, Response } from 'express';
import { dbInstance, Database, Product, StockInDetail, SaleDetail, StockMovement, User } from './db.js';
import { AuthenticatedRequest, authenticate, requireAuth, requireAdmin, generateToken, revokeToken } from './auth.js';

export const apiRouter = Router();

apiRouter.use(authenticate);

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

apiRouter.post('/auth/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    }

    const data = dbInstance.getData();
    const user = data.users.find(
      (u) => (u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase())
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Akun Anda telah dinonaktifkan. Silakan hubungi Administrator.' });
    }

    const isMatch = Database.verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    const token = generateToken(user);
    return res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const user = data.users.find((u) => u.id === req.user?.userId);
  if (!user || !user.is_active) {
    return res.status(401).json({ success: false, message: 'Pengguna tidak ditemukan atau tidak aktif.' });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

apiRouter.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    revokeToken(authHeader.substring(7));
  }
  return res.json({ success: true, message: 'Logout berhasil.' });
});

// ==========================================
// UNIFIED BOOTSTRAP ENDPOINT (INSTANT 1-ROUNDTRIP LOAD)
// ==========================================
apiRouter.get('/bootstrap', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = dbInstance.getData();
    const catMap = new Map(data.categories.map((c) => [c.id, c.name]));
    const catCountMap = new Map<string, number>();
    for (const p of data.products) {
      catCountMap.set(p.category_id, (catCountMap.get(p.category_id) || 0) + 1);
    }

    const products = data.products.map((p) => ({
      ...p,
      category_name: catMap.get(p.category_id) || 'Tanpa Kategori',
      stock_status: !p.is_active
        ? 'NONAKTIF'
        : p.current_stock <= 0
        ? 'HABIS'
        : p.current_stock <= p.min_stock
        ? 'MENIPIS'
        : 'AMAN',
    }));

    const categories = data.categories.map((c) => ({
      ...c,
      product_count: catCountMap.get(c.id) || 0,
    }));

    const today = new Date().toISOString().split('T')[0];
    const activeProducts = data.products.filter((p) => p.is_active);
    const totalProducts = activeProducts.length;
    const totalUnits = activeProducts.reduce((acc, p) => acc + p.current_stock, 0);
    const lowStockItems = activeProducts.filter((p) => p.current_stock > 0 && p.current_stock <= p.min_stock);
    const outOfStockItems = activeProducts.filter((p) => p.current_stock <= 0);
    const inventoryAssetValue = activeProducts.reduce((acc, p) => acc + (p.current_stock * p.purchase_price), 0);
    const potentialSalesValue = activeProducts.reduce((acc, p) => acc + (p.current_stock * p.selling_price), 0);
    const todayStockIns = data.stock_in_transactions.filter((tx) => tx.status === 'completed' && tx.transaction_date === today);
    const todayStockInTotalAmount = todayStockIns.reduce((acc, tx) => acc + tx.total_amount, 0);
    const todaySales = data.sales_transactions.filter((tx) => tx.status === 'completed' && tx.transaction_date === today);
    const todaySalesTotalAmount = todaySales.reduce((acc, tx) => acc + tx.total_amount, 0);

    let todayHpp = 0;
    for (const sale of todaySales) {
      for (const item of sale.items) {
        todayHpp += item.quantity * (item.purchase_price_snapshot || 0);
      }
    }
    const todayGrossProfit = todaySalesTotalAmount - todayHpp;

    const last7Days: { date: string; displayDate: string; sales: number; stockIn: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      const daySales = data.sales_transactions
        .filter((tx) => tx.status === 'completed' && tx.transaction_date === dateStr)
        .reduce((sum, tx) => sum + tx.total_amount, 0);
      const dayStockIn = data.stock_in_transactions
        .filter((tx) => tx.status === 'completed' && tx.transaction_date === dateStr)
        .reduce((sum, tx) => sum + tx.total_amount, 0);
      last7Days.push({ date: dateStr, displayDate, sales: daySales, stockIn: dayStockIn });
    }

    const productSalesMap = new Map<string, { sku: string; name: string; quantity: number; revenue: number }>();
    for (const sale of data.sales_transactions.filter((tx) => tx.status === 'completed')) {
      for (const item of sale.items) {
        const existing = productSalesMap.get(item.product_id) || {
          sku: item.product_sku,
          name: item.product_name,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += item.quantity;
        existing.revenue += item.subtotal;
        productSalesMap.set(item.product_id, existing);
      }
    }
    const topSellingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

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
    for (const sale of data.sales_transactions.slice(-5).reverse()) {
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
    for (const sin of data.stock_in_transactions.slice(-5).reverse()) {
      recentActivities.push({
        id: sin.id,
        type: 'IN',
        number: sin.transaction_number,
        date: sin.transaction_date,
        party: sin.supplier_name,
        amount: sin.total_amount,
        status: sin.status,
        itemCount: sin.items.reduce((s, i) => s + i.quantity, 0),
      });
    }

    const dashboard = {
      totalProducts,
      totalUnits,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      inventoryAssetValue,
      potentialSalesValue,
      todayStockInTotalAmount,
      todayStockInCount: todayStockIns.length,
      todaySalesTotalAmount,
      todaySalesCount: todaySales.length,
      todayGrossProfit,
      last7Days,
      topSellingProducts,
      urgentReorders,
      recentActivities: recentActivities.slice(0, 8),
    };

    return res.json({
      success: true,
      data: {
        settings: data.settings,
        dashboard,
        products,
        categories,
        suppliers: data.suppliers,
        stockInList: [...data.stock_in_transactions].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        salesList: [...data.sales_transactions].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        stockMovements: [...data.stock_movements].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        stockAdjustments: [...data.stock_adjustments].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. DASHBOARD ENDPOINTS
// ==========================================

apiRouter.get('/dashboard/summary', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = dbInstance.getData();
    const today = new Date().toISOString().split('T')[0];

    const activeProducts = data.products.filter((p) => p.is_active);
    const totalProducts = activeProducts.length;

    // Total physical units available across all active items
    const totalUnits = activeProducts.reduce((acc, p) => acc + p.current_stock, 0);

    // Low stock: > 0 and <= min_stock
    const lowStockItems = activeProducts.filter((p) => p.current_stock > 0 && p.current_stock <= p.min_stock);

    // Out of stock: <= 0
    const outOfStockItems = activeProducts.filter((p) => p.current_stock <= 0);

    // Total Inventory Asset Valuation (Nilai Persediaan berdasarkan harga modal/beli)
    const inventoryAssetValue = activeProducts.reduce((acc, p) => acc + (p.current_stock * p.purchase_price), 0);

    // Potential Sales Value
    const potentialSalesValue = activeProducts.reduce((acc, p) => acc + (p.current_stock * p.selling_price), 0);

    // Today's Stock-In transactions
    const todayStockIns = data.stock_in_transactions.filter((tx) => tx.status === 'completed' && tx.transaction_date === today);
    const todayStockInTotalAmount = todayStockIns.reduce((acc, tx) => acc + tx.total_amount, 0);

    // Today's Sales transactions
    const todaySales = data.sales_transactions.filter((tx) => tx.status === 'completed' && tx.transaction_date === today);
    const todaySalesTotalAmount = todaySales.reduce((acc, tx) => acc + tx.total_amount, 0);

    // Today's Gross Profit (Laba Kotor = Penjualan - HPP)
    let todayCostOfGoodsSold = 0;
    for (const sale of todaySales) {
      for (const item of sale.items) {
        todayCostOfGoodsSold += item.quantity * (item.purchase_price_snapshot || 0);
      }
    }
    const todayGrossProfit = todaySalesTotalAmount - todayCostOfGoodsSold;

    // Last 7 days trend for chart
    const last7Days: { date: string; displayDate: string; sales: number; stockIn: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

      const daySales = data.sales_transactions
        .filter((tx) => tx.status === 'completed' && tx.transaction_date === dateStr)
        .reduce((sum, tx) => sum + tx.total_amount, 0);

      const dayStockIn = data.stock_in_transactions
        .filter((tx) => tx.status === 'completed' && tx.transaction_date === dateStr)
        .reduce((sum, tx) => sum + tx.total_amount, 0);

      last7Days.push({
        date: dateStr,
        displayDate,
        sales: daySales,
        stockIn: dayStockIn,
      });
    }

    // Top 5 fast moving items by sales volume
    const productSalesMap = new Map<string, { sku: string; name: string; quantity: number; revenue: number }>();
    for (const sale of data.sales_transactions.filter((tx) => tx.status === 'completed')) {
      for (const item of sale.items) {
        const existing = productSalesMap.get(item.product_id) || {
          sku: item.product_sku,
          name: item.product_name,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += item.quantity;
        existing.revenue += item.subtotal;
        productSalesMap.set(item.product_id, existing);
      }
    }
    const topSellingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Urgent reorder alerts (items out of stock or <= min_stock)
    const urgentReorders = [...outOfStockItems, ...lowStockItems].map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      current_stock: p.current_stock,
      min_stock: p.min_stock,
      shortage: Math.max(0, p.min_stock - p.current_stock + 5), // Suggested restock target
      status: p.current_stock <= 0 ? 'HABIS' : 'MENIPIS',
    }));

    // Recent 10 transactions (mixed sales and stock in)
    const recentActivities: {
      id: string;
      type: 'IN' | 'SALE';
      number: string;
      date: string;
      party: string;
      amount: number;
      status: string;
      itemCount: number;
    }[] = [];

    for (const sale of data.sales_transactions.slice(-5).reverse()) {
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

    for (const sin of data.stock_in_transactions.slice(-5).reverse()) {
      recentActivities.push({
        id: sin.id,
        type: 'IN',
        number: sin.transaction_number,
        date: sin.transaction_date,
        party: sin.supplier_name,
        amount: sin.total_amount,
        status: sin.status,
        itemCount: sin.items.reduce((s, i) => s + i.quantity, 0),
      });
    }

    return res.json({
      success: true,
      data: {
        totalProducts,
        totalUnits,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        inventoryAssetValue,
        potentialSalesValue,
        todayStockInTotalAmount,
        todayStockInCount: todayStockIns.length,
        todaySalesTotalAmount,
        todaySalesCount: todaySales.length,
        todayGrossProfit,
        last7Days,
        topSellingProducts,
        urgentReorders,
        recentActivities: recentActivities.slice(0, 8),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. PRODUCT MANAGEMENT ENDPOINTS
// ==========================================

apiRouter.get('/products', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = dbInstance.getData();
    let list = [...data.products];

    // Filter by category
    const categoryId = req.query.category_id as string;
    if (categoryId && categoryId !== 'all') {
      list = list.filter((p) => p.category_id === categoryId);
    }

    // Filter by stock status
    const stockStatus = req.query.stock_status as string;
    if (stockStatus === 'normal' || stockStatus === 'safe') {
      list = list.filter((p) => p.current_stock > p.min_stock && p.is_active);
    } else if (stockStatus === 'critical' || stockStatus === 'kritis') {
      list = list.filter((p) => p.current_stock <= p.min_stock && p.is_active);
    } else if (stockStatus === 'low') {
      list = list.filter((p) => p.current_stock > 0 && p.current_stock <= p.min_stock && p.is_active);
    } else if (stockStatus === 'out') {
      list = list.filter((p) => p.current_stock <= 0 && p.is_active);
    } else if (stockStatus === 'inactive') {
      list = list.filter((p) => !p.is_active);
    }

    // Search query
    const search = (req.query.search as string || '').toLowerCase().trim();
    if (search) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)
      );
    }

    // Attach category name
    const categoriesMap = new Map(data.categories.map((c) => [c.id, c.name]));
    const enriched = list.map((p) => ({
      ...p,
      category_name: categoriesMap.get(p.category_id) || 'Tanpa Kategori',
      stock_status: !p.is_active
        ? 'NONAKTIF'
        : p.current_stock <= 0
        ? 'HABIS'
        : p.current_stock <= p.min_stock
        ? 'MENIPIS'
        : 'AMAN',
    }));

    return res.json({
      success: true,
      data: enriched,
      total: enriched.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/products/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const product = data.products.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
  }

  const category = data.categories.find((c) => c.id === product.category_id);
  const movements = data.stock_movements
    .filter((m) => m.product_id === product.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  return res.json({
    success: true,
    data: {
      ...product,
      category_name: category ? category.name : '-',
      movements,
    },
  });
});

apiRouter.post('/products', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sku, name, category_id, unit, purchase_price, selling_price, current_stock, min_stock, description } = req.body;

    if (!sku || !name || !category_id || !unit) {
      return res.status(400).json({ success: false, message: 'Kode SKU, nama barang, kategori, dan satuan wajib diisi.' });
    }

    const pPrice = Number(purchase_price) || 0;
    const sPrice = Number(selling_price) || 0;
    const stock = Number(current_stock) || 0;
    const mStock = Number(min_stock) || 0;

    if (pPrice < 0 || sPrice < 0 || stock < 0 || mStock < 0) {
      return res.status(400).json({ success: false, message: 'Harga dan stok tidak boleh bernilai negatif.' });
    }

    const createdProduct = await dbInstance.runTransaction((db) => {
      // Validate unique SKU
      const existingSku = db.products.find((p) => p.sku.trim().toUpperCase() === sku.trim().toUpperCase());
      if (existingSku) {
        throw new Error(`Kode barang/SKU "${sku}" sudah digunakan oleh barang lain.`);
      }

      // Validate category exists
      const categoryExists = db.categories.some((c) => c.id === category_id);
      if (!categoryExists) {
        throw new Error('Kategori yang dipilih tidak valid.');
      }

      const now = new Date().toISOString();
      const newProduct: Product = {
        id: `prd-${Date.now()}`,
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category_id,
        unit: unit.trim().toLowerCase(),
        purchase_price: pPrice,
        selling_price: sPrice,
        current_stock: stock,
        min_stock: mStock,
        description: description ? description.trim() : '',
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      db.products.push(newProduct);

      // Record initial stock movement if initial stock > 0
      if (stock > 0) {
        const movement: StockMovement = {
          id: `mov-${Date.now()}`,
          product_id: newProduct.id,
          product_sku: newProduct.sku,
          product_name: newProduct.name,
          movement_date: now.split('T')[0],
          movement_type: 'IN',
          quantity_in: stock,
          quantity_out: 0,
          balance_before: 0,
          balance_after: stock,
          reference_type: 'stock_in',
          reference_id: 'init-product',
          reference_number: 'SALDO-AWAL-BARU',
          user_id: req.user?.userId || 'system',
          user_name: req.user?.name || 'Administrator',
          notes: 'Pencatatan saldo awal saat barang baru ditambahkan',
          created_at: now,
        };
        db.stock_movements.push(movement);
      }

      return newProduct;
    });

    return res.status(201).json({
      success: true,
      message: `Barang "${createdProduct.name}" berhasil ditambahkan.`,
      data: createdProduct,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.put('/products/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sku, name, category_id, unit, purchase_price, selling_price, min_stock, description } = req.body;
    const { id } = req.params;

    const updated = await dbInstance.runTransaction((db) => {
      const product = db.products.find((p) => p.id === id);
      if (!product) {
        throw new Error('Barang tidak ditemukan.');
      }

      // Check SKU uniqueness if changed
      if (sku && sku.trim().toUpperCase() !== product.sku) {
        const conflict = db.products.find(
          (p) => p.id !== id && p.sku.trim().toUpperCase() === sku.trim().toUpperCase()
        );
        if (conflict) {
          throw new Error(`Kode barang/SKU "${sku}" sudah digunakan oleh barang lain.`);
        }
        product.sku = sku.trim().toUpperCase();
      }

      if (name) product.name = name.trim();
      if (category_id) product.category_id = category_id;
      if (unit) product.unit = unit.trim().toLowerCase();
      if (purchase_price !== undefined) product.purchase_price = Math.max(0, Number(purchase_price));
      if (selling_price !== undefined) product.selling_price = Math.max(0, Number(selling_price));
      if (min_stock !== undefined) product.min_stock = Math.max(0, Number(min_stock));
      if (description !== undefined) product.description = description.trim();
      product.updated_at = new Date().toISOString();

      return product;
    });

    return res.json({
      success: true,
      message: `Data barang "${updated.name}" berhasil diperbarui.`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.patch('/products/:id/toggle-status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await dbInstance.runTransaction((db) => {
      const product = db.products.find((p) => p.id === id);
      if (!product) throw new Error('Barang tidak ditemukan.');
      product.is_active = !product.is_active;
      product.updated_at = new Date().toISOString();
      return product;
    });

    return res.json({
      success: true,
      message: `Status barang diubah menjadi ${updated.is_active ? 'AKTIF' : 'NONAKTIF'}.`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Safe delete: Checks if referenced in transactions; if so, prompts to deactivate instead of permanently destroying history
apiRouter.delete('/products/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await dbInstance.runTransaction((db) => {
      const productIdx = db.products.findIndex((p) => p.id === id);
      if (productIdx === -1) throw new Error('Barang tidak ditemukan.');

      // Check transactions
      const hasStockIn = db.stock_in_transactions.some((tx) => tx.items.some((it) => it.product_id === id));
      const hasSales = db.sales_transactions.some((tx) => tx.items.some((it) => it.product_id === id));
      const hasMovements = db.stock_movements.some((m) => m.product_id === id);

      if (hasStockIn || hasSales || hasMovements) {
        // Enforce data integrity: soft delete / deactivate
        db.products[productIdx].is_active = false;
        db.products[productIdx].updated_at = new Date().toISOString();
        throw new Error(
          'Integritas data terlindungi: Barang ini memiliki riwayat transaksi/pergerakan stok, sehingga tidak boleh dihapus permanen. Barang telah otomatis diubah menjadi NONAKTIF.'
        );
      }

      // If pristine with no transactions, permit permanent removal
      db.products.splice(productIdx, 1);
      return true;
    });

    return res.json({ success: true, message: 'Barang berhasil dihapus permanen.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. CATEGORIES ENDPOINTS
// ==========================================

apiRouter.get('/categories', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const counts = new Map<string, number>();
  for (const p of data.products) {
    counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
  }

  const result = data.categories.map((c) => ({
    ...c,
    product_count: counts.get(c.id) || 0,
  }));

  return res.json({ success: true, data: result });
});

apiRouter.post('/categories', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi.' });
    }

    const created = await dbInstance.runTransaction((db) => {
      const normalized = name.trim().toLowerCase();
      const existing = db.categories.find((c) => c.name.toLowerCase() === normalized);
      if (existing) {
        throw new Error(`Kategori "${name}" sudah ada.`);
      }

      const now = new Date().toISOString();
      const newCategory = {
        id: `cat-${Date.now()}`,
        name: name.trim(),
        description: description ? description.trim() : '',
        created_at: now,
        updated_at: now,
      };

      db.categories.push(newCategory);
      return newCategory;
    });

    return res.status(201).json({ success: true, message: 'Kategori berhasil ditambahkan.', data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.put('/categories/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const { id } = req.params;

    const updated = await dbInstance.runTransaction((db) => {
      const cat = db.categories.find((c) => c.id === id);
      if (!cat) throw new Error('Kategori tidak ditemukan.');

      if (name) {
        const normalized = name.trim().toLowerCase();
        const existing = db.categories.find((c) => c.id !== id && c.name.toLowerCase() === normalized);
        if (existing) throw new Error(`Kategori "${name}" sudah ada.`);
        cat.name = name.trim();
      }
      if (description !== undefined) cat.description = description.trim();
      cat.updated_at = new Date().toISOString();
      return cat;
    });

    return res.json({ success: true, message: 'Kategori berhasil diperbarui.', data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/categories/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await dbInstance.runTransaction((db) => {
      const hasProducts = db.products.some((p) => p.category_id === id);
      if (hasProducts) {
        throw new Error('Kategori ini masih digunakan oleh barang aktif. Pindahkan barang ke kategori lain terlebih dahulu.');
      }
      const idx = db.categories.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('Kategori tidak ditemukan.');
      db.categories.splice(idx, 1);
    });

    return res.json({ success: true, message: 'Kategori berhasil dihapus.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. SUPPLIERS ENDPOINTS
// ==========================================

apiRouter.get('/suppliers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  return res.json({ success: true, data: data.suppliers });
});

apiRouter.post('/suppliers', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, name, contact_person, phone, address, notes } = req.body;
    if (!name || !contact_person || !phone) {
      return res.status(400).json({ success: false, message: 'Nama pemasok, nama kontak, dan no telepon wajib diisi.' });
    }

    const created = await dbInstance.runTransaction((db) => {
      const supCode = (code || `SUP-${String(db.suppliers.length + 1).padStart(3, '0')}`).trim().toUpperCase();
      const existing = db.suppliers.find((s) => s.code === supCode);
      if (existing) throw new Error(`Kode pemasok "${supCode}" sudah terdaftar.`);

      const now = new Date().toISOString();
      const newSupplier = {
        id: `sup-${Date.now()}`,
        code: supCode,
        name: name.trim(),
        contact_person: contact_person.trim(),
        phone: phone.trim(),
        address: address ? address.trim() : '',
        notes: notes ? notes.trim() : '',
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      db.suppliers.push(newSupplier);
      return newSupplier;
    });

    return res.status(201).json({ success: true, message: 'Pemasok berhasil ditambahkan.', data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.put('/suppliers/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, contact_person, phone, address, notes, is_active } = req.body;
    const { id } = req.params;

    const updated = await dbInstance.runTransaction((db) => {
      const sup = db.suppliers.find((s) => s.id === id);
      if (!sup) throw new Error('Pemasok tidak ditemukan.');

      if (name) sup.name = name.trim();
      if (contact_person) sup.contact_person = contact_person.trim();
      if (phone) sup.phone = phone.trim();
      if (address !== undefined) sup.address = address.trim();
      if (notes !== undefined) sup.notes = notes.trim();
      if (is_active !== undefined) sup.is_active = Boolean(is_active);
      sup.updated_at = new Date().toISOString();
      return sup;
    });

    return res.json({ success: true, message: 'Data pemasok berhasil diperbarui.', data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.patch('/suppliers/:id/toggle-status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await dbInstance.runTransaction((db) => {
      const sup = db.suppliers.find((s) => s.id === id);
      if (!sup) throw new Error('Pemasok tidak ditemukan.');
      sup.is_active = !sup.is_active;
      sup.updated_at = new Date().toISOString();
      return sup;
    });
    return res.json({ success: true, message: `Status pemasok diubah menjadi ${updated.is_active ? 'AKTIF' : 'NONAKTIF'}.`, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/suppliers/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await dbInstance.runTransaction((db) => {
      const supIdx = db.suppliers.findIndex((s) => s.id === id);
      if (supIdx === -1) throw new Error('Pemasok tidak ditemukan.');
      const hasStockIn = db.stock_in_transactions.some((tx) => tx.supplier_id === id);
      if (hasStockIn) {
        db.suppliers[supIdx].is_active = false;
        db.suppliers[supIdx].updated_at = new Date().toISOString();
        throw new Error('Pemasok ini memiliki histori faktur pengadaan sembako. Demi integritas audit akademik, data pemasok telah dinonaktifkan (bukan dihapus permanen).');
      }
      db.suppliers.splice(supIdx, 1);
      return true;
    });
    return res.json({ success: true, message: 'Pemasok berhasil dihapus permanen.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// 6. TRANSAKSI BARANG MASUK (STOCK IN)
// ==========================================

apiRouter.get('/stock-in', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  let list = [...data.stock_in_transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  if (startDate) {
    list = list.filter((t) => t.transaction_date >= startDate);
  }
  if (endDate) {
    list = list.filter((t) => t.transaction_date <= endDate);
  }

  return res.json({ success: true, data: list });
});

apiRouter.post('/stock-in', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { supplier_id, transaction_date, notes, items } = req.body;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pemasok dan minimal 1 item barang masuk wajib disertakan.',
      });
    }

    const txDate = transaction_date || new Date().toISOString().split('T')[0];
    const user = req.user;

    const completedTx = await dbInstance.runTransaction((db) => {
      const supplier = db.suppliers.find((s) => s.id === supplier_id);
      if (!supplier) throw new Error('Pemasok tidak ditemukan.');

      const dateStr = txDate.replace(/-/g, '');
      const dayCount = db.stock_in_transactions.filter((t) => t.transaction_date === txDate).length + 1;
      const transactionNumber = `TRX-IN-${dateStr}-${String(dayCount).padStart(3, '0')}`;

      let totalAmount = 0;
      const processedDetails: StockInDetail[] = [];
      const stockInId = `sin-${Date.now()}`;
      const now = new Date().toISOString();

      // Process each item and update stock atomically
      for (const item of items) {
        const product = db.products.find((p) => p.id === item.product_id);
        if (!product) throw new Error(`Barang dengan ID "${item.product_id}" tidak ditemukan.`);
        if (!product.is_active) throw new Error(`Barang "${product.name}" sedang nonaktif.`);

        const qty = Number(item.quantity);
        const pPrice = Number(item.purchase_price !== undefined ? item.purchase_price : product.purchase_price);

        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Jumlah masuk untuk "${product.name}" harus lebih dari 0.`);
        }
        if (isNaN(pPrice) || pPrice < 0) {
          throw new Error(`Harga beli untuk "${product.name}" tidak valid.`);
        }

        const subtotal = qty * pPrice;
        totalAmount += subtotal;

        const balanceBefore = product.current_stock;
        const balanceAfter = balanceBefore + qty;

        // Update product stock and optionally update last purchase price
        product.current_stock = balanceAfter;
        product.purchase_price = pPrice; // Update latest purchase cost
        product.updated_at = now;

        processedDetails.push({
          id: `sindet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          stock_in_id: stockInId,
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          unit: product.unit,
          quantity: qty,
          purchase_price: pPrice,
          subtotal,
        });

        // Record in stock movements ledger
        const movement: StockMovement = {
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          movement_date: txDate,
          movement_type: 'IN',
          quantity_in: qty,
          quantity_out: 0,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_type: 'stock_in',
          reference_id: stockInId,
          reference_number: transactionNumber,
          user_id: user?.userId || 'system',
          user_name: user?.name || 'Petugas',
          notes: notes || `Penerimaan dari pemasok: ${supplier.name}`,
          created_at: now,
        };
        db.stock_movements.push(movement);
      }

      const newTx: any = {
        id: stockInId,
        transaction_number: transactionNumber,
        transaction_date: txDate,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        user_id: user?.userId || 'system',
        user_name: user?.name || 'Petugas',
        total_amount: totalAmount,
        notes: notes ? notes.trim() : '',
        status: 'completed',
        items: processedDetails,
        created_at: now,
        updated_at: now,
      };

      db.stock_in_transactions.push(newTx);
      return newTx;
    });

    return res.status(201).json({
      success: true,
      message: `Penerimaan barang masuk ${completedTx.transaction_number} berhasil disimpan.`,
      data: completedTx,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Cancel stock-in transaction with safe stock reversal
apiRouter.post('/stock-in/:id/cancel', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Alasan pembatalan wajib diisi.' });
    }

    const cancelled = await dbInstance.runTransaction((db) => {
      const tx = db.stock_in_transactions.find((t) => t.id === id);
      if (!tx) throw new Error('Transaksi barang masuk tidak ditemukan.');
      if (tx.status === 'cancelled') throw new Error('Transaksi ini sudah dibatalkan sebelumnya.');

      const now = new Date().toISOString();

      // Check if reversing stock will cause negative stock
      for (const item of tx.items) {
        const prod = db.products.find((p) => p.id === item.product_id);
        if (prod && prod.current_stock < item.quantity) {
          throw new Error(
            `Tidak dapat membatalkan: Stok "${prod.name}" saat ini (${prod.current_stock}) lebih kecil dari jumlah yang ingin dibalikkan (${item.quantity}). Kemungkinan barang sudah terjual.`
          );
        }
      }

      // Revert stock
      for (const item of tx.items) {
        const prod = db.products.find((p) => p.id === item.product_id);
        if (prod) {
          const before = prod.current_stock;
          const after = before - item.quantity;
          prod.current_stock = after;
          prod.updated_at = now;

          // Record reverse movement
          db.stock_movements.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            product_id: prod.id,
            product_sku: prod.sku,
            product_name: prod.name,
            movement_date: now.split('T')[0],
            movement_type: 'CANCEL_IN',
            quantity_in: 0,
            quantity_out: item.quantity,
            balance_before: before,
            balance_after: after,
            reference_type: 'stock_in',
            reference_id: tx.id,
            reference_number: tx.transaction_number,
            user_id: req.user?.userId || 'system',
            user_name: req.user?.name || 'Administrator',
            notes: `PEMBATALAN: ${reason}`,
            created_at: now,
          });
        }
      }

      tx.status = 'cancelled';
      tx.notes = `${tx.notes ? tx.notes + ' | ' : ''}[DIBATALKAN: ${reason}]`;
      tx.updated_at = now;
      return tx;
    });

    return res.json({
      success: true,
      message: `Transaksi ${cancelled.transaction_number} berhasil dibatalkan dan stok dikembalikan.`,
      data: cancelled,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// 7. TRANSAKSI PENJUALAN / KASIR (SALES & POS)
// ==========================================

apiRouter.get('/sales', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  let list = [...data.sales_transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  if (startDate) {
    list = list.filter((t) => t.transaction_date >= startDate);
  }
  if (endDate) {
    list = list.filter((t) => t.transaction_date <= endDate);
  }

  return res.json({ success: true, data: list });
});

apiRouter.post('/sales', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items, payment_method, paid_amount, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Keranjang belanja minimal berisi 1 barang.' });
    }

    const payMethod = payment_method || 'cash';
    const user = req.user;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const completedSale = await dbInstance.runTransaction((db) => {
      // 1. Verify all products and check stock availability strictly
      for (const item of items) {
        const product = db.products.find((p) => p.id === item.product_id);
        if (!product) throw new Error(`Barang dengan ID ${item.product_id} tidak ditemukan.`);
        if (!product.is_active) throw new Error(`Barang "${product.name}" sedang dinonaktifkan.`);

        const requestedQty = Number(item.quantity);
        if (isNaN(requestedQty) || requestedQty <= 0) {
          throw new Error(`Jumlah pembelian untuk "${product.name}" harus lebih dari 0.`);
        }

        // Strict non-negative check
        if (product.current_stock < requestedQty) {
          throw new Error(
            `Stok tidak mencukupi untuk "${product.name}". Tersedia: ${product.current_stock} ${product.unit}, diminta: ${requestedQty} ${product.unit}. Transaksi dibatalkan untuk mencegah stok negatif.`
          );
        }
      }

      // 2. Generate unique sequential invoice number
      const dateStr = today.replace(/-/g, '');
      const daySalesCount = db.sales_transactions.filter((t) => t.transaction_date === today).length + 1;
      const transactionNumber = `TRX-SAL-${dateStr}-${String(daySalesCount).padStart(3, '0')}`;
      const saleId = `sal-${Date.now()}`;

      // 3. Process items, calculate server-verified totals, snapshot prices, decrement stock, and log movements
      let calculatedTotal = 0;
      const saleDetails: SaleDetail[] = [];

      for (const item of items) {
        const product = db.products.find((p) => p.id === item.product_id)!;
        const qty = Number(item.quantity);
        const sellingPrice = product.selling_price; // Always trust server pricing!
        const subtotal = qty * sellingPrice;
        calculatedTotal += subtotal;

        const balanceBefore = product.current_stock;
        const balanceAfter = balanceBefore - qty;

        // Mutate product stock
        product.current_stock = balanceAfter;
        product.updated_at = now;

        saleDetails.push({
          id: `saldet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          sale_id: saleId,
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          unit: product.unit,
          quantity: qty,
          selling_price: sellingPrice,
          purchase_price_snapshot: product.purchase_price, // Saved for HPP / profit analysis
          subtotal,
        });

        // Add ledger record
        db.stock_movements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          movement_date: today,
          movement_type: 'SALE',
          quantity_in: 0,
          quantity_out: qty,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_type: 'sale',
          reference_id: saleId,
          reference_number: transactionNumber,
          user_id: user?.userId || 'system',
          user_name: user?.name || 'Kasir',
          notes: `Penjualan kasir ke pelanggan [${transactionNumber}]`,
          created_at: now,
        });
      }

      // 4. Validate payment
      const paid = Number(paid_amount) || calculatedTotal;
      if (payMethod === 'cash' && paid < calculatedTotal) {
        throw new Error(
          `Nominal uang yang dibayarkan (Rp ${paid.toLocaleString('id-ID')}) kurang dari total tagihan (Rp ${calculatedTotal.toLocaleString('id-ID')}).`
        );
      }
      const change = Math.max(0, paid - calculatedTotal);

      const newSale: any = {
        id: saleId,
        transaction_number: transactionNumber,
        transaction_date: today,
        user_id: user?.userId || 'system',
        cashier_name: user?.name || 'Kasir',
        payment_method: payMethod,
        total_amount: calculatedTotal,
        paid_amount: paid,
        change_amount: change,
        notes: notes ? notes.trim() : '',
        status: 'completed',
        items: saleDetails,
        created_at: now,
        updated_at: now,
      };

      db.sales_transactions.push(newSale);
      return newSale;
    });

    return res.status(201).json({
      success: true,
      message: `Transaksi penjualan ${completedSale.transaction_number} berhasil diproses.`,
      data: completedSale,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Cancel sale with refund and return stock
apiRouter.post('/sales/:id/cancel', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Alasan pembatalan/retur penjualan wajib diisi.' });
    }

    const cancelled = await dbInstance.runTransaction((db) => {
      const sale = db.sales_transactions.find((s) => s.id === id);
      if (!sale) throw new Error('Transaksi penjualan tidak ditemukan.');
      if (sale.status === 'cancelled') throw new Error('Transaksi penjualan ini sudah dibatalkan sebelumnya.');

      const now = new Date().toISOString();

      // Return items to inventory
      for (const item of sale.items) {
        const prod = db.products.find((p) => p.id === item.product_id);
        if (prod) {
          const before = prod.current_stock;
          const after = before + item.quantity;
          prod.current_stock = after;
          prod.updated_at = now;

          // Add refund movement to ledger
          db.stock_movements.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            product_id: prod.id,
            product_sku: prod.sku,
            product_name: prod.name,
            movement_date: now.split('T')[0],
            movement_type: 'CANCEL_SALE',
            quantity_in: item.quantity,
            quantity_out: 0,
            balance_before: before,
            balance_after: after,
            reference_type: 'sale',
            reference_id: sale.id,
            reference_number: sale.transaction_number,
            user_id: req.user?.userId || 'system',
            user_name: req.user?.name || 'Administrator',
            notes: `PEMBATALAN/RETUR: ${reason}`,
            created_at: now,
          });
        }
      }

      sale.status = 'cancelled';
      sale.notes = `${sale.notes ? sale.notes + ' | ' : ''}[DIBATALKAN: ${reason}]`;
      sale.updated_at = now;
      return sale;
    });

    return res.json({
      success: true,
      message: `Penjualan ${cancelled.transaction_number} berhasil dibatalkan dan stok dikembalikan ke etalase/gudang.`,
      data: cancelled,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// 8. STOK OPNAME & PENYESUAIAN (ADJUSTMENT)
// ==========================================

apiRouter.post('/stock/adjustments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { product_id, physical_stock, reason } = req.body;

    if (!product_id) return res.status(400).json({ success: false, message: 'Barang harus dipilih.' });
    if (physical_stock === undefined || physical_stock === null || physical_stock < 0) {
      return res.status(400).json({ success: false, message: 'Jumlah fisik barang tidak boleh negatif.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Alasan penyesuaian (misal: barang rusak, selisih opname, kadaluarsa) wajib dicantumkan untuk jejak audit.',
      });
    }

    const adjustmentResult = await dbInstance.runTransaction((db) => {
      const product = db.products.find((p) => p.id === product_id);
      if (!product) throw new Error('Barang tidak ditemukan.');

      const recorded = product.current_stock;
      const physical = Number(physical_stock);
      const difference = physical - recorded;

      if (difference === 0) {
        throw new Error('Jumlah fisik sama persis dengan stok tercatat. Tidak ada perubahan yang perlu disesuaikan.');
      }

      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const adjCount = db.stock_adjustments.filter((a) => a.adjustment_date === today).length + 1;
      const adjNumber = `ADJ-${today.replace(/-/g, '')}-${String(adjCount).padStart(3, '0')}`;

      // Update product current stock
      product.current_stock = physical;
      product.updated_at = now;

      const newAdjustment = {
        id: `adj-${Date.now()}`,
        adjustment_number: adjNumber,
        adjustment_date: today,
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        recorded_stock: recorded,
        physical_stock: physical,
        difference,
        reason: reason.trim(),
        user_id: req.user?.userId || 'system',
        user_name: req.user?.name || 'Administrator',
        created_at: now,
      };

      db.stock_adjustments.push(newAdjustment);

      // Record in movements ledger
      db.stock_movements.push({
        id: `mov-${Date.now()}`,
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        movement_date: today,
        movement_type: 'ADJUSTMENT',
        quantity_in: difference > 0 ? difference : 0,
        quantity_out: difference < 0 ? Math.abs(difference) : 0,
        balance_before: recorded,
        balance_after: physical,
        reference_type: 'adjustment',
        reference_id: newAdjustment.id,
        reference_number: adjNumber,
        user_id: req.user?.userId || 'system',
        user_name: req.user?.name || 'Administrator',
        notes: `PENYESUAIAN STOK: ${reason.trim()}`,
        created_at: now,
      });

      return newAdjustment;
    });

    return res.status(201).json({
      success: true,
      message: `Penyesuaian stok "${adjustmentResult.product_name}" berhasil dicatat.`,
      data: adjustmentResult,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.get('/stock/adjustments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const list = [...data.stock_adjustments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return res.json({ success: true, data: list });
});

// ==========================================
// 9. RIWAYAT PERGERAKAN STOK (AUDIT LEDGER)
// ==========================================

apiRouter.get('/stock/movements', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  let list = [...data.stock_movements].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const productId = req.query.product_id as string;
  if (productId && productId !== 'all') {
    list = list.filter((m) => m.product_id === productId);
  }

  const movementType = req.query.movement_type as string;
  if (movementType && movementType !== 'all') {
    list = list.filter((m) => m.movement_type === movementType);
  }

  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  if (startDate) {
    list = list.filter((m) => m.movement_date >= startDate);
  }
  if (endDate) {
    list = list.filter((m) => m.movement_date <= endDate);
  }

  return res.json({ success: true, data: list });
});

// ==========================================
// 10. LAPORAN-LAPORAN (REPORTS)
// ==========================================

// 10.1 Laporan Stok Saat Ini (Current Stock)
apiRouter.get('/reports/current-stock', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const categoryId = req.query.category_id as string;
  let products = data.products.filter((p) => p.is_active);

  if (categoryId && categoryId !== 'all') {
    products = products.filter((p) => p.category_id === categoryId);
  }

  const catMap = new Map(data.categories.map((c) => [c.id, c.name]));
  const rows = products.map((p) => {
    const valuation = p.current_stock * p.purchase_price;
    const potentialRevenue = p.current_stock * p.selling_price;
    const potentialMargin = potentialRevenue - valuation;
    return {
      sku: p.sku,
      name: p.name,
      category: catMap.get(p.category_id) || '-',
      unit: p.unit,
      current_stock: p.current_stock,
      min_stock: p.min_stock,
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      valuation,
      potentialRevenue,
      potentialMargin,
      status: p.current_stock <= 0 ? 'HABIS' : p.current_stock <= p.min_stock ? 'MENIPIS' : 'AMAN',
    };
  });

  const totalStockUnits = rows.reduce((s, r) => s + r.current_stock, 0);
  const totalValuation = rows.reduce((s, r) => s + r.valuation, 0);
  const totalPotentialRevenue = rows.reduce((s, r) => s + r.potentialRevenue, 0);

  return res.json({
    success: true,
    data: {
      items: rows,
      summary: {
        totalItems: rows.length,
        totalStockUnits,
        totalValuation,
        totalPotentialRevenue,
      },
    },
  });
});

// 10.2 Laporan Barang Masuk (Purchases / Stock In)
apiRouter.get('/reports/stock-in', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const startDate = req.query.start_date as string || '2000-01-01';
  const endDate = req.query.end_date as string || '2099-12-31';
  const supplierId = req.query.supplier_id as string;

  let txs = data.stock_in_transactions.filter(
    (t) => t.status === 'completed' && t.transaction_date >= startDate && t.transaction_date <= endDate
  );

  if (supplierId && supplierId !== 'all') {
    txs = txs.filter((t) => t.supplier_id === supplierId);
  }

  const flatItems: any[] = [];
  let totalGrand = 0;
  let totalQty = 0;

  for (const t of txs) {
    for (const item of t.items) {
      flatItems.push({
        transaction_number: t.transaction_number,
        transaction_date: t.transaction_date,
        supplier_name: t.supplier_name,
        user_name: t.user_name,
        sku: item.product_sku,
        name: item.product_name,
        unit: item.unit,
        quantity: item.quantity,
        purchase_price: item.purchase_price,
        subtotal: item.subtotal,
      });
      totalGrand += item.subtotal;
      totalQty += item.quantity;
    }
  }

  return res.json({
    success: true,
    data: {
      items: flatItems,
      summary: {
        totalTransactions: txs.length,
        totalQuantity: totalQty,
        totalAmount: totalGrand,
      },
    },
  });
});

// 10.3 Laporan Penjualan & Laba Kotor (Sales & Gross Profit)
apiRouter.get('/reports/sales', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const startDate = req.query.start_date as string || '2000-01-01';
  const endDate = req.query.end_date as string || '2099-12-31';

  const txs = data.sales_transactions.filter(
    (t) => t.status === 'completed' && t.transaction_date >= startDate && t.transaction_date <= endDate
  );

  const flatItems: any[] = [];
  let totalRevenue = 0;
  let totalHpp = 0;
  let totalQty = 0;

  for (const t of txs) {
    for (const item of t.items) {
      const hpp = (item.purchase_price_snapshot || 0) * item.quantity;
      const profit = item.subtotal - hpp;
      flatItems.push({
        transaction_number: t.transaction_number,
        transaction_date: t.transaction_date,
        cashier_name: t.cashier_name,
        payment_method: t.payment_method,
        sku: item.product_sku,
        name: item.product_name,
        unit: item.unit,
        quantity: item.quantity,
        selling_price: item.selling_price,
        purchase_price: item.purchase_price_snapshot || 0,
        subtotal: item.subtotal,
        hpp,
        profit,
      });
      totalRevenue += item.subtotal;
      totalHpp += hpp;
      totalQty += item.quantity;
    }
  }

  const grossProfit = totalRevenue - totalHpp;
  const marginPercentage = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return res.json({
    success: true,
    data: {
      items: flatItems,
      summary: {
        totalTransactions: txs.length,
        totalQuantity: totalQty,
        totalRevenue,
        totalHpp,
        grossProfit,
        marginPercentage: Number(marginPercentage.toFixed(2)),
      },
    },
  });
});

// 10.4 Laporan Stok Minimum dan Habis (Restock Recommendation)
apiRouter.get('/reports/low-stock', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const catMap = new Map(data.categories.map((c) => [c.id, c.name]));

  const critical = data.products
    .filter((p) => p.is_active && p.current_stock <= p.min_stock)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      category: catMap.get(p.category_id) || '-',
      unit: p.unit,
      current_stock: p.current_stock,
      min_stock: p.min_stock,
      deficit: Math.max(0, p.min_stock - p.current_stock),
      recommended_order: Math.max(10, (p.min_stock - p.current_stock) + 15),
      estimated_cost: (Math.max(10, (p.min_stock - p.current_stock) + 15)) * p.purchase_price,
      status: p.current_stock <= 0 ? 'HABIS' : 'MENIPIS',
    }));

  return res.json({
    success: true,
    data: {
      items: critical,
      summary: {
        totalAlerts: critical.length,
        outOfStockCount: critical.filter((c) => c.status === 'HABIS').length,
        lowStockCount: critical.filter((c) => c.status === 'MENIPIS').length,
        totalEstimatedRestockCost: critical.reduce((acc, c) => acc + c.estimated_cost, 0),
      },
    },
  });
});

// ==========================================
// 11. PENGELOLAAN PENGGUNA (USERS)
// ==========================================

apiRouter.get('/users', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  const safeUsers = data.users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    is_active: u.is_active,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }));
  return res.json({ success: true, data: safeUsers });
});

apiRouter.post('/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, name, email, password, role } = req.body;
    if (!username || !name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi.' });
    }

    const created = await dbInstance.runTransaction((db) => {
      const uNormalized = username.trim().toLowerCase();
      const eNormalized = email.trim().toLowerCase();

      if (db.users.some((u) => u.username.toLowerCase() === uNormalized)) {
        throw new Error(`Username "${username}" sudah digunakan.`);
      }
      if (db.users.some((u) => u.email.toLowerCase() === eNormalized)) {
        throw new Error(`Email "${email}" sudah digunakan.`);
      }

      const now = new Date().toISOString();
      const newUser: User = {
        id: `usr-${Date.now()}`,
        username: username.trim(),
        name: name.trim(),
        email: email.trim(),
        password_hash: Database.hashPassword(password),
        role: role === 'admin' ? 'admin' : 'petugas',
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      db.users.push(newUser);
      return newUser;
    });

    return res.status(201).json({
      success: true,
      message: `Pengguna "${created.name}" berhasil ditambahkan.`,
      data: {
        id: created.id,
        username: created.username,
        name: created.name,
        email: created.email,
        role: created.role,
        is_active: created.is_active,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.patch('/users/:id/toggle-status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' });
    }

    const updated = await dbInstance.runTransaction((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new Error('Pengguna tidak ditemukan.');
      user.is_active = !user.is_active;
      user.updated_at = new Date().toISOString();
      return user;
    });

    return res.json({
      success: true,
      message: `Status akun diubah menjadi ${updated.is_active ? 'AKTIF' : 'NONAKTIF'}.`,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.post('/users/:id/reset-password', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 5) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 5 karakter.' });
    }

    await dbInstance.runTransaction((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new Error('Pengguna tidak ditemukan.');
      user.password_hash = Database.hashPassword(new_password);
      user.updated_at = new Date().toISOString();
    });

    return res.json({ success: true, message: 'Password pengguna berhasil direset.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/users/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
    }
    await dbInstance.runTransaction((db) => {
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) throw new Error('Pengguna tidak ditemukan.');
      const user = db.users[idx];
      if (user.role === 'admin') {
        const adminCount = db.users.filter((u) => u.role === 'admin' && u.is_active).length;
        if (adminCount <= 1) {
          throw new Error('Tidak dapat menghapus Administrator terakhir. Sistem wajib memiliki minimal 1 Administrator aktif.');
        }
      }
      db.users.splice(idx, 1);
    });
    return res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ==========================================
// 12. PENGATURAN TOKO (SETTINGS)
// ==========================================

apiRouter.get('/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = dbInstance.getData();
  return res.json({ success: true, data: data.settings });
});

apiRouter.put('/settings', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { store_name, address, phone, receipt_footer, default_min_stock, logo_url } = req.body;
    const updated = await dbInstance.runTransaction((db) => {
      if (store_name) db.settings.store_name = store_name.trim();
      if (address !== undefined) db.settings.address = address.trim();
      if (phone !== undefined) db.settings.phone = phone.trim();
      if (receipt_footer !== undefined) db.settings.receipt_footer = receipt_footer.trim();
      if (default_min_stock !== undefined) db.settings.default_min_stock = Number(default_min_stock) || 10;
      if (logo_url !== undefined) db.settings.logo_url = logo_url;
      return db.settings;
    });

    return res.json({ success: true, message: 'Pengaturan toko berhasil disimpan.', data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});
