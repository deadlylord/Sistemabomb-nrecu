
import React, { useMemo } from 'react';
import { formatCOP } from '../constants';
import { Store } from '../types';

interface SalesChartProps {
  data: { date: string; incomes: { [storeId: string]: number } }[];
  stores: Store[];
}

const STORE_COLORS = ['#ff007f', '#00aaff', '#ffaa00', '#00ff7f', '#aa00ff', '#ff5555'];

const SalesChart: React.FC<SalesChartProps> = ({ data, stores }) => {
  const maxValue = useMemo(() => {
    return Math.max(
      ...data.flatMap(d => Object.values(d.incomes)),
      0
    );
  }, [data]);
  
  const getSafeMaxValue = () => {
    if (maxValue === 0) return 100000;
    const orderOfMagnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
    return Math.ceil(maxValue / orderOfMagnitude) * orderOfMagnitude;
  };
  const safeMaxValue = getSafeMaxValue();

  const yAxisLabels = [
      safeMaxValue,
      safeMaxValue * 0.75,
      safeMaxValue * 0.5,
      safeMaxValue * 0.25,
      0
  ];
  
  const formatYAxisLabel = (value: number) => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace('.0', '')}M`;
      if (value >= 1000) return `${Math.round(value / 1000)}k`;
      return value;
  };

  const storeColorMap = useMemo(() => new Map(stores.map((store, index) => [store.id, STORE_COLORS[index % STORE_COLORS.length]])), [stores]);

  return (
    <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Comparativa de Ingresos por Tienda</h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        {stores.map(store => (
          <div key={store.id} className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: storeColorMap.get(store.id) }}></div>
            <span className="text-gray-600 dark:text-text-dark">{store.name}</span>
          </div>
        ))}
      </div>
      <div className="flex h-72">
        {/* Y-Axis */}
        <div className="flex flex-col justify-between text-xs text-gray-500 dark:text-text-dark pr-4 border-r border-gray-200 dark:border-gray-700 shrink-0">
            {yAxisLabels.map((label, index) => (
                <div key={index} className={index === yAxisLabels.length - 1 ? "" : "-translate-y-1/2"}>
                    {formatYAxisLabel(label)}
                </div>
            ))}
        </div>
        
        {/* Chart Bars */}
        <div className="flex-grow flex items-end justify-around pl-4 gap-2">
            {data.length > 0 && safeMaxValue > 0 ? (
                data.map(({ date, incomes }) => {
                    const formattedDate = new Date(date + 'T12:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                    return (
                        <div key={date} className="h-full flex flex-col items-center justify-end" style={{ flex: '1 1 0%' }}>
                            <div className="flex items-end h-full w-full gap-px">
                                {stores.map(store => {
                                    const income = incomes[store.id] || 0;
                                    const heightPercentage = safeMaxValue > 0 ? (income / safeMaxValue) * 100 : 0;
                                    return (
                                        <div key={store.id} className="flex-1 h-full flex items-end relative group/bar">
                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                                <p className="font-bold">{store.name}</p>
                                                <p>{formatCOP(income)}</p>
                                            </div>
                                            <div
                                                className="w-full transition-all duration-300 rounded-t-sm hover:opacity-80"
                                                style={{ height: `${heightPercentage}%`, backgroundColor: storeColorMap.get(store.id) }}
                                            ></div>
                                        </div>
                                    );
                                })}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-text-dark mt-1 whitespace-nowrap">{formattedDate}</span>
                        </div>
                    );
                })
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-text-dark">
                    No hay datos de ingresos para el periodo seleccionado.
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SalesChart;
