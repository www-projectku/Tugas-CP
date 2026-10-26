import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  onBack: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  title = 'Akses Terbatas: Khusus Administrator',
  message = 'Halaman ini hanya dapat diakses oleh Administrator / Pemilik Toko. Akun Petugas (Staff) hanya memiliki otorisasi untuk operasional kasir, penerimaan barang, dan peninjauan stok fisik.',
  onBack,
}) => {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl border border-rose-200/80 p-6 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-6">{message}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Dashboard</span>
        </button>
      </div>
    </div>
  );
};
