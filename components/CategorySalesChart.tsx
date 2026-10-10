import React, { useState } from 'react';
import { formatCOP } from '../constants';

interface CategorySales {
  categoryId: string;
  categoryName: string;
  totalSales: number;
  totalUnits: number;
}

const COLORS = ['#a855f7', '#ec4899', '#38bdf8', '#14b8a6', '#f59e0b', '#6366f1', '#f97316', '#84cc16', '#e879f9', '#06b6d4'];

export default function CategorySalesChart({ data, scopeKey }: { data: CategorySales[]; scopeKey: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = data.filter(row => Number.isFinite(row.totalSales) && row.totalSales > 0);
  const total = rows.reduce((sum, row) => sum + row.totalSales, 0);
  const selected = rows.find(row => `${scopeKey}:${row.categoryId}` === selectedId);
  let offset = 0;

  if (!total) return <p className="py-6 text-center text-sm text-gray-500">Sin ventas por categorías en este período.</p>;

  return (
    <div className="min-w-0 rounded-xl border border-accent/20 bg-accent/5 p-3 mb-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Participación por valor vendido · período seleccionado</p>
      <div className="flex flex-col xl:flex-row items-center gap-4 min-w-0">
        <div className="relative w-56 max-w-full shrink-0">
          <svg viewBox="0 0 200 200" className="w-full h-auto" role="img" aria-label="Distribución del valor vendido por categoría">
            <title>Ventas por categoría</title>
            {rows.map((row, index) => {
              const share = row.totalSales / total * 100;
              const start = offset;
              offset += share;
              return <circle key={row.categoryId} cx="100" cy="100" r="76" fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="32" pathLength="100" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-start} transform="rotate(-90 100 100)" opacity={selected && selected.categoryId !== row.categoryId ? 0.3 : 1}>
                <title>{row.categoryName}: {formatCOP(row.totalSales)} ({share.toFixed(1)}%)</title>
              </circle>;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-12 text-center" aria-live="polite">
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{selected?.categoryName || 'Total categorías'}</p>
            <p className="text-sm font-bold text-accent break-all">{formatCOP(selected?.totalSales ?? total)}</p>
            {selected && <p className="text-xs text-gray-500">{(selected.totalSales / total * 100).toFixed(1)}%</p>}
          </div>
        </div>
        <div className="w-full min-w-0 space-y-1 max-h-64 overflow-y-auto">
          {rows.map((row, index) => <button key={row.categoryId} type="button" aria-pressed={selected?.categoryId === row.categoryId} onClick={() => setSelectedId(selected?.categoryId === row.categoryId ? null : `${scopeKey}:${row.categoryId}`)} className={`flex w-full min-w-0 items-center gap-2 rounded-lg p-2 text-left text-xs transition-colors ${selected?.categoryId === row.categoryId ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-accent/10'}`}>
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span className="flex-1 min-w-0 break-words"><span className="font-semibold">{row.categoryName}</span><span className="block text-gray-500 dark:text-gray-400">{formatCOP(row.totalSales)} · {row.totalUnits} uds</span></span>
            <span className="font-bold shrink-0">{(row.totalSales / total * 100).toFixed(1)}%</span>
          </button>)}
        </div>
      </div>
    </div>
  );
}
