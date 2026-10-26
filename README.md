# SISTEM INFORMASI MANAJEMEN STOK BARANG TOKO SEMBAKO BERBASIS WEB

Aplikasi Sistem Informasi Manajemen Persediaan dan Point of Sale (POS) Toko Sembako yang dirancang khusus untuk kebutuhan bisnis toko sembako di Indonesia serta memenuhi standar akademik Tugas Akhir (TA) Program Studi Sistem Informasi.

---

## 1. Ringkasan Fitur yang Telah Selesai

1. **Autentikasi & Otorisasi RBAC (Role-Based Access Control):**
   - Hak Akses **Administrator / Pemilik Toko**: Kendali penuh atas master barang, kategori, pemasok, transaksi, pembatalan/retur, stok opname, pengguna, dan konfigurasi toko.
   - Hak Akses **Petugas Kasir/Gudang**: Akses operasional kasir penjualan, penerimaan barang masuk, pencetakan struk, serta monitoring stok minimum.
   - Quick Demo Switcher untuk demonstrasi sidang tanpa logout manual.
   - Keamanan hashing password menggunakan algoritma kriptografi PBKDF2/scrypt.

2. **Dashboard Eksekutif & Analitik Real-Time:**
   - Metrik riil persediaan: Total jenis barang aktif, total unit fisik, barang menipis, barang habis, dan total nilai modal persediaan (IDR).
   - Metrik operasional harian: Nilai belanja barang masuk hari ini, omzet penjualan kasir hari ini, dan estimasi laba kotor hari ini.
   - Visualisasi grafik arus kas transaksi 7 hari terakhir (Penjualan vs Pembelian Masuk).
   - Tabel prioritas pengadaan (reorder recommendations) dan 5 barang sembako terlaris (*fast moving*).
   - Umpan aktivitas audit (*recent activity feed*) real-time.

3. **Manajemen Master Data Sembako:**
   - Dukungan satuan barang fleksibel: karung, kg, liter, pcs, dus, bungkus, botol, kaleng, pak, pouch (termasuk pecahan desimal seperti 15.5 kg).
   - Generator kode SKU otomatis unik.
   - Perlindungan integritas referensial: barang yang pernah memiliki transaksi dilindungi dari penghapusan permanen (otomatis dinonaktifkan/soft-delete).
   - Penyaringan berdasarkan kategori, pencarian teks nama/SKU, dan filter status stok.
   - Ekspor data barang ke format file CSV/Excel.

4. **Kategori Komoditas & Data Pemasok:**
   - Pengelompokan sembako (Beras, Minyak Goreng, Bumbu, Telur/Susu, Mi/Kebutuhan Pokok).
   - Pencegahan penghapusan kategori jika masih terhubung dengan barang aktif.
   - Direktori distributor sembako resmi lengkap dengan kontak PIC, nomor WhatsApp/telepon, dan alamat gudang.

5. **Modul Transaksi Barang Masuk (Pengadaan / Pembelian):**
   - Penomoran faktur otomatis berurutan (`TRX-IN-YYYYMMDD-XXX`).
   - Penambahan multi-barang sekaligus dengan kalkulasi harga modal dan subtotal otomatis.
   - Mutasi persediaan atomik (ACID): stok fisik bertambah dan langsung tercatat pada Buku Besar Mutasi Stok.
   - Fitur pembatalan faktur masuk dengan alasan wajib dan pembalikan stok.

6. **Modul Kasir POS (Point of Sale & Barang Keluar):**
   - Pencarian cepat barang etalase atau filter kategori.
   - **Validasi Anti-Stok-Negatif:** Kuantitas pembelian divalidasi ketat terhadap stok fisik tersedia; sistem menolak transaksi yang melampaui stok.
   - Snapshot harga modal (`purchase_price_snapshot`) saat transaksi dicatat untuk perhitungan Harga Pokok Penjualan (HPP) dan laba kotor.
   - Perhitungan otomatis kembalian tunai dan tombol nominal cepat (*quick cash chips*).
   - Dukungan metode pembayaran Tunai, QRIS, dan Transfer Bank.
   - **Pencetakan Struk Fisik Thermal 80mm:** Tampilan struk kasir profesional siap cetak (`window.print()`).
   - Riwayat penjualan dan retur barang dengan pengembalian stok ke etalase.

7. **Stok Opname & Penyesuaian Persediaan (Inventory Adjustment):**
   - Sinkronisasi selisih fisik toko vs stok tercatat sistem.
   - Penghitungan otomatis selisih unit (+/-).
   - Kolom alasan penyesuaian wajib diisi untuk jejak audit (contoh: barang rusak, rembesan air, tercecer).
   - Pembaruan saldo dan pencatatan riwayat penyesuaian ke buku besar.

8. **Buku Besar Pergerakan Stok (Audit Trail Ledger):**
   - Buku besar kronologis yang mencatat mutasi: `IN` (Masuk), `SALE` (Penjualan), `ADJUSTMENT` (Opname), `CANCEL_SALE` (Retur Jual), `CANCEL_IN` (Batal Masuk).
   - Menampilkan kuantitas masuk, keluar, saldo sebelum, saldo sesudah, nomor referensi transaksi, dan petugas penanggung jawab.
   - Filter rentang tanggal, jenis mutasi, barang tertentu, serta ekspor CSV.

9. **Pusat Laporan & Rekapitulasi Terpadu:**
   - **Laporan Stok Saat Ini:** Posisi persediaan, batas aman, valuasi modal, potensi omzet, dan margin.
   - **Laporan Barang Masuk:** Rekapitulasi pembelian menurut distributor dan periode tanggal.
   - **Laporan Penjualan & Laba Kotor:** Pemisahan jelas antara total omzet, beban pokok penjualan (HPP), laba kotor, dan persentase margin.
   - **Laporan Stok Kritis & Rekomendasi Restock:** Deteksi barang habis dan menipis serta estimasi kebutuhan modal pengadaan.
   - Format cetak formal akademik dengan kop toko sembako dan ekspor data CSV.

10. **Alat Pendukung Sidang Tugas Akhir:**
    - **Uji Sistem Otomatis (16 Skenario):** Pengujian terintegrasi yang memverifikasi autentikasi, RBAC, CRUD, keunikan SKU, atomisitas ACID, anti-stok negatif, idempotensi, retur, opname, dan konsistensi buku besar dengan hasil 100% LULUS.
    - **Dokumentasi Akademik Interaktif:** Akses langsung ke analisis masalah, kebutuhan fungsional/non-fungsional, matriks otorisasi use case, flowchart transaksi, ERD, dan kamus data.

---

## 2. Struktur Database Relasional

Database dirancang dengan integritas relasional tinggi:

1. **`users`**: `id`, `username`, `name`, `email`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`.
2. **`categories`**: `id`, `name`, `description`, `created_at`, `updated_at`.
3. **`products`**: `id`, `sku (UNIQUE)`, `name`, `category_id (FK)`, `unit`, `purchase_price`, `selling_price`, `current_stock`, `min_stock`, `description`, `is_active`, `created_at`, `updated_at`.
4. **`suppliers`**: `id`, `code (UNIQUE)`, `name`, `contact_person`, `phone`, `address`, `notes`, `is_active`, `created_at`, `updated_at`.
5. **`stock_in_transactions`**: `id`, `transaction_number (UNIQUE)`, `transaction_date`, `supplier_id (FK)`, `supplier_name`, `user_id (FK)`, `user_name`, `total_amount`, `notes`, `status`, `created_at`, `updated_at`.
6. **`stock_in_details`**: `id`, `stock_in_id (FK)`, `product_id (FK)`, `product_sku`, `product_name`, `unit`, `quantity`, `purchase_price`, `subtotal`.
7. **`sales_transactions`**: `id`, `transaction_number (UNIQUE)`, `transaction_date`, `user_id (FK)`, `cashier_name`, `payment_method`, `total_amount`, `paid_amount`, `change_amount`, `notes`, `status`, `created_at`, `updated_at`.
8. **`sales_details`**: `id`, `sale_id (FK)`, `product_id (FK)`, `product_sku`, `product_name`, `unit`, `quantity`, `selling_price`, `purchase_price_snapshot`, `subtotal`.
9. **`stock_movements`**: `id`, `product_id (FK)`, `product_sku`, `product_name`, `movement_date`, `movement_type`, `quantity_in`, `quantity_out`, `balance_before`, `balance_after`, `reference_type`, `reference_id`, `reference_number`, `user_id`, `user_name`, `notes`, `created_at`.
10. **`stock_adjustments`**: `id`, `adjustment_number`, `adjustment_date`, `product_id (FK)`, `product_sku`, `product_name`, `recorded_stock`, `physical_stock`, `difference`, `reason`, `user_id`, `user_name`, `created_at`.
11. **`settings`**: `store_name`, `address`, `phone`, `receipt_footer`, `default_min_stock`, `currency_symbol`.

---

## 3. Akun Demo untuk Pengujian & Sidang

| Peran (Role) | Username | Password | Deskripsi Wewenang |
| :--- | :--- | :--- | :--- |
| **Administrator / Owner** | `admin` | `admin123` | Akses penuh master data, transaksi, penyesuaian opname, retur, pengguna, dan pengaturan. |
| **Petugas Kasir / Gudang** | `kasir` | `kasir123` | Akses kasir POS penjualan, pencatatan barang masuk, dan monitoring stok minimum. |

*Tersedia juga tombol 1-Click Demo Switcher pada pojok kanan atas aplikasi untuk berpindah peran secara instan.*

---

## 4. Hasil Pengujian Aktual (16 Skenario Terverifikasi)

Seluruh 16 skenario pengujian telah diuji dan diverifikasi secara otomatis:

1. **Autentikasi Pengguna:** Login berhasil dengan kredensial valid, ditolak dengan kredensial salah (**PASSED**).
2. **Otorisasi Hak Akses (RBAC):** Petugas kasir diblokir dari endpoint administratif (**PASSED**).
3. **Master Data Barang:** Penambahan barang baru dan pembaruan harga modal/jual berhasil (**PASSED**).
4. **Pencegahan SKU Duplikat:** Penambahan kode SKU yang sama ditolak oleh sistem (**PASSED**).
5. **Barang Masuk:** Saldo persediaan bertambah sesuai kuantitas faktur pemasok (**PASSED**).
6. **Penjualan Kasir:** Saldo persediaan berkurang sesuai nota penjualan (**PASSED**).
7. **Pencegahan Stok Negatif:** Permintaan penjualan melebihi persediaan fisik ditolak (**PASSED**).
8. **Atomisitas Transaksi (ACID):** Rollback otomatis membatalkan seluruh perubahan jika terjadi kegagalan sistem (**PASSED**).
9. **Idempotensi Transaksi:** Nomor transaksi unik mencegah klik ganda pada antarmuka (**PASSED**).
10. **Retur & Pembatalan:** Pengembalian stok tercatat sebagai mutasi pembalik di buku besar (**PASSED**).
11. **Stok Opname:** Penyelarasan stok fisik dengan alasan wajib tersimpan di log audit (**PASSED**).
12. **Pusat Laporan:** Penyaringan periode tanggal awal dan akhir presisi (**PASSED**).
13. **Dashboard Real-Time:** Nilai valuasi modal dan total unit dihitung dari agregasi tabel produk (**PASSED**).
14. **Keamanan Peran Server:** Middleware sisi server menolak akses unauthorized secara permanen (**PASSED**).
15. **Validasi Input:** Kuantitas atau harga bernilai negatif/kosong ditolak sebelum diproses (**PASSED**).
16. **Konsistensi Buku Besar:** Saldo produk akhir selalu identik dengan saldo mutasi terakhir (**PASSED**).

---

## 5. Cara Menjalankan Aplikasi Langkah demi Langkah

```bash
# 1. Pastikan dependensi Node.js terpasang
npm install

# 2. Jalankan server aplikasi full-stack (Express + Vite)
npm run dev

# 3. Buka peramban pada URL
http://localhost:3000
```

---

## 6. Keterbatasan & Saran Pengembangan Selanjutnya

- **Keterbatasan:**
  - Koneksi printer thermal saat ini memanfaatkan dialog cetak bawaan peramban (*browser print dialog*); belum terhubung langsung via serial/USB ESC/POS native driver.
  - Pembayaran non-tunai (QRIS & Transfer) saat ini mencatat status pembayaran secara manual/simulasi; belum terhubung ke payment gateway pihak ketiga (Midtrans/Xendit).
- **Saran Pengembangan:**
  - Integrasi barcode scanner fisik berbasis USB/Bluetooth untuk scanning cepat SKU barang sembako di meja kasir.
  - Implementasi metode peramalan persediaan lanjutan seperti *Economic Order Quantity* (EOQ) atau *Safety Stock Reorder Point* (ROP) berbasis kecerdasan data penjualan masa lalu.
