import React, { useState, useRef, useEffect } from 'react';
import { StoreSettings } from '../types/index.js';
import { StoreLogo } from './StoreLogo.js';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Store,
  Phone,
  MapPin,
  Receipt,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Info,
  Trash2
} from 'lucide-react';

interface SettingsViewProps {
  settings: StoreSettings | null;
  onUpdateSettings: (data: any) => Promise<void>;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onRefresh,
}) => {
  const [storeName, setStoreName] = useState(settings?.store_name || 'Toko Sembako Berkah Mandiri');
  const [address, setAddress] = useState(settings?.address || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [receiptFooter, setReceiptFooter] = useState(settings?.receipt_footer || '');
  const [defaultMinStock, setDefaultMinStock] = useState(settings?.default_min_stock || 10);
  const [logoUrl, setLogoUrl] = useState<string | null>(settings?.logo_url || null);

  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name || 'Toko Sembako Berkah Mandiri');
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
      setReceiptFooter(settings.receipt_footer || '');
      setDefaultMinStock(settings.default_min_stock || 10);
      setLogoUrl(settings.logo_url || null);
    }
  }, [settings]);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('File harus berupa gambar (PNG, JPG, SVG, atau WEBP).');
      return;
    }

    // Limit to 3MB
    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('Ukuran file logo maksimal 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setLogoUrl(result);
        setErrorMsg(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file gambar.');
    };
    reader.readAsDataURL(file);
  };

  const handleResetToDefault = () => {
    setLogoUrl(null);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!storeName.trim()) {
      setErrorMsg('Nama toko tidak boleh kosong.');
      return;
    }

    try {
      setSaving(true);
      await onUpdateSettings({
        store_name: storeName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        receipt_footer: receiptFooter.trim(),
        default_min_stock: Number(defaultMinStock),
        logo_url: logoUrl || '',
      });

      setSuccessMsg('Pengaturan dan logo toko berhasil diperbarui!');
      onRefresh();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            
            <span>Pengaturan Toko & Logo Usaha</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola nama toko, logo visual, alamat, kontak WhatsApp, dan format struk belanja pelanggan.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-2xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: Logo Toko */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>Logo Toko</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Format PNG, JPG, atau WEBP</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Left: Preview Box */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 flex flex-col items-center text-center">
                <span className="text-[11px] font-semibold text-slate-500 mb-3 uppercase tracking-wider">
                  Pratinjau Logo
                </span>
                
                {/* Logo Display */}
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs mb-3">
                  <StoreLogo
                    logoUrl={logoUrl}
                    storeName={storeName}
                    size="xl"
                  />
                </div>

                <div className="text-xs font-bold text-slate-900 truncate max-w-full">
                  {storeName || 'Toko Sembako'}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {logoUrl ? 'Menggunakan Logo Kustom' : 'Logo'}
                </div>

                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="mt-3.5 px-3 py-1.5 text-[11px] text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/80 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Logo Kustom</span>
                  </button>
                )}
              </div>

              {/* Right: Upload controls */}
              <div className="md:col-span-2 space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                  className="hidden"
                />

                <div className="p-5 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl bg-slate-50/40 hover:bg-slate-50/70 transition-all flex flex-col items-center text-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Unggah Logo Toko Anda
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pilih gambar dari komputer atau galeri ponsel (PNG, JPG, SVG, WEBP maks. 3 MB)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{logoUrl ? 'Ganti File Logo' : 'Pilih Gambar Logo'}</span>
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>Reset ke Default</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 flex items-start gap-2.5 text-slate-600">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <p className="font-medium text-slate-700">Petunjuk Logo:</p>
                    <p className="text-slate-500">
                      Gunakan gambar dengan rasio persegi (1:1) agar simetris. Logo ini akan otomatis tampil di header, struk kasir termal, serta lembar laporan resmi toko sembako Anda.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Identitas Toko */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Identitas & Profil Usaha</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Toko Sembako *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Toko Sembako Berkah Mandiri"
                className="w-full py-2.5 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">Nama ini akan tercantum di bagian atas aplikasi, struk kasir, dan laporan.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>No. Telepon / WhatsApp Toko</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812-9876-5432"
                  className="w-full py-2.5 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batas Default Stok Minimum Baru
                </label>
                <input
                  type="number"
                  min="1"
                  value={defaultMinStock}
                  onChange={(e) => setDefaultMinStock(Number(e.target.value))}
                  className="w-full py-2.5 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">Ambang batas acuan pengingat restock jika barang mulai menipis.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Alamat Lengkap Toko</span>
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Pemuda Raya No. 108, Rawamangun, Jakarta Timur..."
                className="w-full py-2.5 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
              />
            </div>
          </div>

          {/* SECTION 3: Struk Kasir */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              
              <span>Tampilan Struk Belanja Kasir</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Bawah Struk (Thermal Receipt Footer)
              </label>
              <textarea
                rows={2}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="Terima kasih atas kunjungan Anda di Toko Sembako Berkah Mandiri..."
                className="w-full py-2.5 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan Pengaturan...' : 'Simpan Perubahan & Logo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
