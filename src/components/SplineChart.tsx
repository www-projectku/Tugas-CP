import React, { useState, useMemo } from 'react';
import { formatRupiah } from '../utils/format.js';
import { TrendingUp, ArrowDownLeft, ShoppingCart, Calendar } from 'lucide-react';

export interface DailyDataPoint {
  date: string;
  displayDate: string;
  sales: number;
  stockIn: number;
}

interface SplineChartProps {
  data: DailyDataPoint[];
}

export const SplineChart: React.FC<SplineChartProps> = ({ data }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'sales' | 'stockIn'>('all');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Totals for the 7-day period
  const totalSales = useMemo(() => data.reduce((acc, d) => acc + d.sales, 0), [data]);
  const totalStockIn = useMemo(() => data.reduce((acc, d) => acc + d.stockIn, 0), [data]);
  const netCashFlow = totalSales - totalStockIn;

  // Chart dimensions & padding
  const svgWidth = 720;
  const svgHeight = 220;
  const padding = { top: 20, right: 30, bottom: 35, left: 65 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Max value calculation for Y-scale with buffer
  const rawMax = Math.max(
    ...data.map((d) => {
      if (activeFilter === 'sales') return d.sales;
      if (activeFilter === 'stockIn') return d.stockIn;
      return Math.max(d.sales, d.stockIn);
    }),
    500000
  );
  // Round up to nice number
  const roundFactor = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const maxY = Math.ceil((rawMax * 1.15) / roundFactor) * roundFactor;

  // Coordinates mapping
  const points = useMemo(() => {
    if (data.length === 0) return { salesPoints: [], stockInPoints: [] };
    const step = graphWidth / Math.max(data.length - 1, 1);

    const salesPoints = data.map((d, i) => ({
      x: padding.left + i * step,
      y: padding.top + graphHeight - (d.sales / maxY) * graphHeight,
      val: d.sales,
      date: d.displayDate,
      raw: d,
    }));

    const stockInPoints = data.map((d, i) => ({
      x: padding.left + i * step,
      y: padding.top + graphHeight - (d.stockIn / maxY) * graphHeight,
      val: d.stockIn,
      date: d.displayDate,
      raw: d,
    }));

    return { salesPoints, stockInPoints };
  }, [data, graphWidth, graphHeight, maxY, padding.left, padding.top]);

  // Smooth Bezier Spline Path Generator
  const createSplinePath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      // Tension factor 0.2 gives natural, organic smoothness without overshoot
      const cp1x = p1.x + (p2.x - p0.x) * 0.18;
      const cp1y = p1.y + (p2.y - p0.y) * 0.18;
      const cp2x = p2.x - (p3.x - p1.x) * 0.18;
      const cp2y = p2.y - (p3.y - p1.y) * 0.18;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const createAreaPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    const spline = createSplinePath(pts);
    const bottomY = padding.top + graphHeight;
    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    return `${spline} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
  };

  const salesLine = useMemo(() => createSplinePath(points.salesPoints), [points.salesPoints]);
  const salesArea = useMemo(() => createAreaPath(points.salesPoints), [points.salesPoints, padding.top, graphHeight]);

  const stockInLine = useMemo(() => createSplinePath(points.stockInPoints), [points.stockInPoints]);
  const stockInArea = useMemo(() => createAreaPath(points.stockInPoints), [points.stockInPoints, padding.top, graphHeight]);

  // Y-Axis tick formatting
  const yTicks = [0, maxY * 0.33, maxY * 0.66, maxY];
  const formatTick = (val: number) => {
    if (val === 0) return 'Rp 0';
    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)} jt`;
    if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)} rb`;
    return `Rp ${val}`;
  };

  const activeDay = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="space-y-4">
      {/* Chart Header: Title, Totals, and Fluid Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tren Arus Nilai Transaksi (7 Hari Terakhir)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Garis kurva perbandingan omzet kasir dengan belanja pengadaan barang
          </p>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-lg self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Garis
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('sales')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'sales'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Penjualan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('stockIn')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'stockIn'
                ? 'bg-sky-600 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-sky-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Barang Masuk</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-800 font-medium">Total Omzet 7 Hari</p>
              <p className="font-bold text-emerald-950 tabular-nums">{formatRupiah(totalSales)}</p>
            </div>
          </div>
        </div>

        <div className="p-2.5 bg-sky-50/70 rounded-lg border border-sky-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sky-600 text-white flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-sky-800 font-medium">Total Belanja Masuk</p>
              <p className="font-bold text-sky-950 tabular-nums">{formatRupiah(totalStockIn)}</p>
            </div>
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-slate-700 text-white flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-600 font-medium">Arus Kas Bersih (Net)</p>
              <p className={`font-bold tabular-nums ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {netCashFlow >= 0 ? '+' : ''}{formatRupiah(netCashFlow)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Spline SVG Chart */}
      <div className="relative bg-white rounded-lg pt-2 pb-1 overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible font-sans"
        >
          <defs>
            {/* Sales soft gradient fill */}
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#10b981" stopOpacity="0.01" />
            </linearGradient>

            {/* StockIn soft gradient fill */}
            <linearGradient id="stockInGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.18" />
              <stop offset="85%" stopColor="#0284c7" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((val, idx) => {
            const y = padding.top + graphHeight - (val / maxY) * graphHeight;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  className="fill-slate-600 font-medium tabular-nums"
                >
                  {formatTick(val)}
                </text>
              </g>
            );
          })}

          {/* Area Fills */}
          {(activeFilter === 'all' || activeFilter === 'stockIn') && (
            <path d={stockInArea} fill="url(#stockInGrad)" className="transition-all duration-300" />
          )}
          {(activeFilter === 'all' || activeFilter === 'sales') && (
            <path d={salesArea} fill="url(#salesGrad)" className="transition-all duration-300" />
          )}

          {/* Smooth Curved Spline Lines */}
          {(activeFilter === 'all' || activeFilter === 'stockIn') && (
            <path
              d={stockInLine}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300 drop-shadow-xs"
            />
          )}

          {(activeFilter === 'all' || activeFilter === 'sales') && (
            <path
              d={salesLine}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300 drop-shadow-xs"
            />
          )}

          {/* Hover guideline */}
          {hoverIndex !== null && points.salesPoints[hoverIndex] && (
            <line
              x1={points.salesPoints[hoverIndex].x}
              y1={padding.top}
              x2={points.salesPoints[hoverIndex].x}
              y2={padding.top + graphHeight}
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className="animate-in fade-in"
            />
          )}

          {/* Data Points */}
          {data.map((_, i) => {
            const sp = points.salesPoints[i];
            const sip = points.stockInPoints[i];
            const isHovered = hoverIndex === i;

            return (
              <g key={i}>
                {/* Stock In Circle */}
                {(activeFilter === 'all' || activeFilter === 'stockIn') && sip && (
                  <circle
                    cx={sip.x}
                    cy={sip.y}
                    r={isHovered ? 5.5 : 3.5}
                    fill="#ffffff"
                    stroke="#0284c7"
                    strokeWidth={isHovered ? 2.5 : 2}
                    className="transition-all duration-150 cursor-pointer"
                  />
                )}

                {/* Sales Circle */}
                {(activeFilter === 'all' || activeFilter === 'sales') && sp && (
                  <circle
                    cx={sp.x}
                    cy={sp.y}
                    r={isHovered ? 6 : 4}
                    fill="#ffffff"
                    stroke="#10b981"
                    strokeWidth={isHovered ? 3 : 2}
                    className="transition-all duration-150 cursor-pointer"
                  />
                )}

                {/* X-Axis Day Labels */}
                {sp && (
                  <text
                    x={sp.x}
                    y={svgHeight - 12}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={isHovered ? '700' : '500'}
                    className={`transition-colors tabular-nums ${
                      isHovered ? 'fill-slate-900' : 'fill-slate-500'
                    }`}
                  >
                    {sp.date}
                  </text>
                )}

                {/* Invisible hover slice for responsive touch/mouse */}
                <rect
                  x={sp ? sp.x - graphWidth / (data.length * 2) : 0}
                  y={padding.top}
                  width={graphWidth / Math.max(data.length - 1, 1)}
                  height={graphHeight + padding.bottom}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Rich Interactive Floating Tooltip */}
        {activeDay && hoverIndex !== null && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-lg shadow-xl text-xs transition-all duration-150 border border-slate-700/60"
            style={{
              left: `${Math.min(
                Math.max(points.salesPoints[hoverIndex]?.x || 0, 110),
                svgWidth - 140
              )}px`,
              top: '8px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-bold text-[11px] text-slate-300 pb-1.5 mb-1.5 border-b border-slate-700/80 flex items-center justify-between gap-4">
              <span>{activeDay.displayDate}</span>
              <span className="text-[10px] text-slate-400 font-normal">Audit Harian</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Penjualan:</span>
                </span>
                <span className="font-bold text-white tabular-nums">
                  {formatRupiah(activeDay.sales)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-sky-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>Barang Masuk:</span>
                </span>
                <span className="font-bold text-white tabular-nums">
                  {formatRupiah(activeDay.stockIn)}
                </span>
              </div>

              <div className="pt-1.5 mt-1 border-t border-slate-700/60 flex items-center justify-between gap-4 text-[11px]">
                <span className="text-slate-400 font-medium">Selisih Kasir:</span>
                <span
                  className={`font-bold tabular-nums ${
                    activeDay.sales - activeDay.stockIn >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {activeDay.sales - activeDay.stockIn >= 0 ? '+' : ''}
                  {formatRupiah(activeDay.sales - activeDay.stockIn)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Footer: Legend with Friendly Explanations */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500 border-t border-slate-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span className="font-medium text-slate-700">Garis Hijau:</span>
            <span>Omzet Penjualan Kasir</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 rounded-full bg-sky-500 inline-block" />
            <span className="font-medium text-slate-700">Garis Biru:</span>
            <span>Nilai Belanja Modal Masuk</span>
          </div>
        </div>
        <span className="text-[11px] text-slate-400">
          Arahkan kursor ke titik grafik untuk melihat rincian per tanggal
        </span>
      </div>
    </div>
  );
};
