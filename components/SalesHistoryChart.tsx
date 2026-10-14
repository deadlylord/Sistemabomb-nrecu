import React, { useState } from 'react';
import { formatCOP } from '../constants';
import { bogotaDateKey, type IncomeChartPoint } from '../services/incomeChart';

const SalesHistoryChart: React.FC<{
  seriesLabel?: string; data: IncomeChartPoint[]; viewMode: 'daily' | 'monthly' | 'all-months'; showPartial?: boolean;
}> = ({ data, viewMode, showPartial = false, seriesLabel = 'Ingresos del período' }) => {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const selected = data.find(point => point.label === selectedLabel);
  const max = Math.max(...data.map(point => point.total), 1000) * 1.15;
  const formatLabel = (label: string) => new Date(`${label}${viewMode === 'daily' ? '' : '-01'}T12:00:00Z`).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', ...(viewMode === 'daily' ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' })
  });
  const fullAmount = (value: number) => formatCOP(Math.round(value));
  if (!data.length) return <p className="py-12 text-center text-sm text-gray-500">No hay movimientos para mostrar.</p>;
  return <div className="w-full min-w-0">
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-600 dark:text-gray-400">
      <span><span className="inline-block w-3 h-3 rounded-sm bg-accent mr-1" />{seriesLabel}</span>
      {showPartial && <span>┄ Hasta el día {Number(bogotaDateKey(new Date()).slice(-2))} de cada mes</span>}
    </div>
    <div className="flex min-w-0 gap-2">
      <div className="shrink-0 flex flex-col justify-between pb-7 text-[10px] text-gray-500" aria-hidden="true">
        {[1, .75, .5, .25, 0].map(ratio => <span key={ratio}>{fullAmount(max * ratio)}</span>)}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-2" tabIndex={0} role="region" aria-label="Gráfico de barras. Desliza horizontalmente para ver más fechas">
        <div className="flex items-end gap-2" style={{ minWidth: `${Math.max(data.length * 112, 240)}px` }}>
          {data.map(point => <button type="button" key={point.label} onClick={() => setSelectedLabel(point.label)}
            aria-pressed={point.label === selectedLabel} aria-label={`${formatLabel(point.label)}: ${formatCOP(point.total)}${showPartial ? `; hasta el día actual: ${formatCOP(point.partialTotal)}` : ''}`}
            className="flex-1 min-w-0 rounded px-1 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <div className="relative h-[clamp(8rem,calc(100dvh-24rem),20rem)] border-b border-gray-300 dark:border-gray-600">
              {[.25, .5, .75, 1].map(ratio => <div key={ratio} className="absolute w-full border-t border-dashed border-gray-200 dark:border-gray-700" style={{ bottom: `${ratio * 100}%` }} />)}
              <div className="absolute inset-x-0 bottom-0 rounded-t bg-accent/70 hover:bg-accent" style={{ height: `${Math.max(0, point.total / max * 100)}%` }} />
              <span className="absolute inset-x-0 whitespace-nowrap text-[10px] font-bold text-gray-700 dark:text-gray-200" style={{ bottom: `${Math.max(0, point.total / max * 100)}%` }}>{fullAmount(point.total)}</span>
              {showPartial && <div className="absolute inset-x-0 border-t-2 border-dotted border-gray-700 dark:border-white" style={{ bottom: `${point.partialTotal / max * 100}%` }} />}
            </div>
            <span className="block pt-2 text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatLabel(point.label)}</span>
            {showPartial && <span className="block mt-1 text-[10px] font-semibold text-accent whitespace-nowrap">Al día {Number(bogotaDateKey(new Date()).slice(-2))}:<br />{formatCOP(point.partialTotal)}</span>}
          </button>)}
        </div>
      </div>
    </div>
    <p className="mt-2 text-xs text-gray-500" aria-live="polite">{selected ? `${formatLabel(selected.label)}: ${formatCOP(selected.total)}${showPartial ? ` · Hasta el día actual: ${formatCOP(selected.partialTotal)}` : ''}` : 'Toca una barra para ver el valor exacto. Desliza para ver más fechas.'}</p>
  </div>;
};

export default SalesHistoryChart;
