import React from 'react';

export interface StoreLogoProps {
  logoUrl?: string | null;
  storeName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const LetterTIcon: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} drop-shadow-xs`}
  >
    {/* Modern bold monogram Letter T */}
    <path
      d="M6 8.5C6 7.12 7.12 6 8.5 6H23.5C24.88 6 26 7.12 26 8.5C26 9.88 24.88 11 23.5 11H18.5V24.5C18.5 25.88 17.38 27 16 27C14.62 27 13.5 25.88 13.5 24.5V11H8.5C7.12 11 6 9.88 6 8.5Z"
      fill="currentColor"
    />
    {/* Subtle modern brand accent mark */}
    <circle cx="23.5" cy="8.5" r="1.5" fill="#34D399" />
  </svg>
);

export const PRESET_LOGOS = [
  {
    id: 'preset-emerald',
    name: 'Hijau Berkah (Huruf T Sembako)',
    color: 'from-emerald-600 via-teal-600 to-emerald-800',
    icon: <LetterTIcon className="w-full h-full text-white" />,
  },
  {
    id: 'preset-amber',
    name: 'Kuning Emas (Huruf T Rezeki)',
    color: 'from-amber-500 via-orange-500 to-amber-700',
    icon: <LetterTIcon className="w-full h-full text-white" />,
  },
  {
    id: 'preset-indigo',
    name: 'Biru Modern (Huruf T Profesional)',
    color: 'from-blue-600 via-indigo-600 to-indigo-800',
    icon: <LetterTIcon className="w-full h-full text-white" />,
  },
  {
    id: 'preset-slate',
    name: 'Dark Slate (Huruf T Minimalis)',
    color: 'from-slate-800 via-slate-900 to-black',
    icon: <LetterTIcon className="w-full h-full text-white" />,
  },
];

export const StoreLogo: React.FC<StoreLogoProps> = ({
  logoUrl,
  storeName = 'Berkah Mandiri',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }[size];

  // If a custom image URL or Base64 is stored
  if (logoUrl && !logoUrl.startsWith('preset:')) {
    return (
      <div className={`relative shrink-0 overflow-hidden rounded-lg bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center p-0.5 ${sizeClasses} ${className}`}>
        <img
          src={logoUrl}
          alt={storeName}
          className="w-full h-full object-contain rounded-md"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // If a preset was selected
  if (logoUrl && logoUrl.startsWith('preset:')) {
    const presetId = logoUrl.replace('preset:', '');
    const found = PRESET_LOGOS.find((p) => p.id === presetId) || PRESET_LOGOS[0];
    return (
      <div
        className={`relative shrink-0 rounded-xl bg-gradient-to-br ${found.color} shadow-2xs flex items-center justify-center p-2 text-white ${sizeClasses} ${className}`}
        title={storeName}
      >
        {found.icon}
      </div>
    );
  }

  // Default: Logo Huruf T Modern Toko Sembako in Emerald Gradient
  return (
    <div
      className={`relative shrink-0 rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 shadow-xs flex items-center justify-center p-1.5 text-white ring-1 ring-emerald-500/20 ${sizeClasses} ${className}`}
      title={storeName}
    >
      <LetterTIcon className="w-full h-full text-white" />
    </div>
  );
};
