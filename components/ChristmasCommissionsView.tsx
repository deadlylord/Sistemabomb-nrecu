import React, { useState, useMemo } from 'react';
import { Seller, Sale, Layaway, LoginRecord } from '../types';
import { formatCOP } from '../constants';
import { SparklesIcon } from './Icons';

interface ChristmasCommissionsViewProps {
  sellers: Seller[];
  sales: Sale[];
  layaways: Layaway[];
  loginHistory: LoginRecord[];
}

interface DailyResult {
  date: string;
  unitsSold: number;
  breakdown: string;
  dailyBase: number;
  commission: number;
  totalDay: number;
  isWorked: boolean;
}

interface SellerSummary {
    name: string;
    totalBase: number;
    totalCommission: number;
    totalUnits: number;
    totalPay: number;
    daysWorked: number;
}

const ChristmasCommissionsView: React.FC<ChristmasCommissionsViewProps> = ({ sellers, sales, layaways, loginHistory }) => {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [baseDailySalary, setBaseDailySalary] = useState('45000');

  const setFortnight = (fortnight: 'first' | 'second') => {
    const today = new Date();
    const year = today.getFullYear();
    const month = 11; // December is 11 (0-indexed)
    
    if (fortnight === 'first') {
      const firstDay = new Date(year, month, 1);
      const fifteenthDay = new Date(year, month, 15);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(fifteenthDay.toISOString().split('T')[0]);
    } else {
      const sixteenthDay = new Date(year, month, 16);
      const lastDay = new Date(year, month + 1, 0);
      setStartDate(sixteenthDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    }
  };

  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calculateDailyCommission = (units: number) => {
    let commission = 0;
    const parts: string[] = [];

    // Tier 1: 0-5 units ($0)
    const countTier1 = Math.min(units, 5);
    if (countTier1 > 0) {
        parts.push(`${countTier1} x $0`);
    }

    // Tier 2: 6-10 units ($1,000 each)
    if (units > 5) {
        const countTier2 = Math.min(units, 10) - 5;
        commission += countTier2 * 1000;
        parts.push(`${countTier2} x $1.000`);
    }

    // Tier 3: 11-15 units ($1,500 each)
    if (units > 10) {
        const countTier3 = Math.min(units, 15) - 10;
        commission += countTier3 * 1500;
        parts.push(`${countTier3} x $1.500`);
    }

    // Tier 4: 16+ units ($2,000 each)
    if (units > 15) {
        const countTier4 = units - 15;
        commission += countTier4 * 2000;
        parts.push(`${countTier4} x $2.000`);
    }

    return { commission, breakdown: parts.join(' + ') };
  };

  const calculateStatsForSeller = (sellerName: string, start: Date, end: Date) => {
        const dailyBase = parseFloat(baseDailySalary) || 0;
        const workedDates = new Set<string>();
        
        // Logins
        loginHistory.filter(l => l.sellerName === sellerName).forEach(l => {
           const d = new Date(l.date);
           if (d >= start && d <= end) workedDates.add(toLocalDateString(d));
        });

        const salesMap = new Map<string, number>();

        // Sales
        sales.filter(s => !s.layawayId && s.seller === sellerName).forEach(s => {
            const d = new Date(s.createdAt);
            if (d >= start && d <= end) {
                const dateStr = toLocalDateString(d);
                workedDates.add(dateStr);
                const units = s.items.reduce((acc, item) => acc + (item.quantity || 0), 0);
                salesMap.set(dateStr, (salesMap.get(dateStr) || 0) + units);
            }
        });

        // Layaways
        layaways.filter(l => l.status === 'active' && l.seller === sellerName).forEach(l => {
            const d = new Date(l.createdAt);
            if (d >= start && d <= end) {
                const dateStr = toLocalDateString(d);
                workedDates.add(dateStr);
                const units = l.items.reduce((acc, item) => acc + (item.quantity || 0), 0);
                salesMap.set(dateStr, (salesMap.get(dateStr) || 0) + units);
            }
        });

        const sortedDates = Array.from(workedDates).sort();
        const results: DailyResult[] = sortedDates.map(dateStr => {
            const unitsSold = salesMap.get(dateStr) || 0;
            const { commission, breakdown } = calculateDailyCommission(unitsSold);
            return {
                date: dateStr,
                unitsSold,
                breakdown,
                dailyBase,
                commission,
                totalDay: dailyBase + commission,
                isWorked: true
            };
        });

        const totalStats = results.reduce((acc, curr) => ({
            totalBase: acc.totalBase + curr.dailyBase,
            totalCommission: acc.totalCommission + curr.commission,
            totalUnits: acc.totalUnits + curr.unitsSold,
            totalPay: acc.totalPay + curr.totalDay,
            daysWorked: acc.daysWorked + 1
        }), { totalBase: 0, totalCommission: 0, totalUnits: 0, totalPay: 0, daysWorked: 0 });

        return { dailyBreakdown: results, summary: totalStats };
  };

  const reportData = useMemo(() => {
    if (!selectedSeller || !startDate || !endDate) {
      return null;
    }

    const startFilterDate = new Date(startDate + 'T00:00:00');
    const endFilterDate = new Date(endDate + 'T23:59:59');

    if (selectedSeller === 'ALL') {
        const sellersStats: SellerSummary[] = sellers.filter(s => !s.isDisabled).map(s => {
            const stats = calculateStatsForSeller(s.name, startFilterDate, endFilterDate);
            return { name: s.name, ...stats.summary };
        });
        
        const globalSummary = sellersStats.reduce((acc, curr) => ({
            totalBase: acc.totalBase + curr.totalBase,
            totalCommission: acc.totalCommission + curr.totalCommission,
            totalUnits: acc.totalUnits + curr.totalUnits,
            totalPay: acc.totalPay + curr.totalPay,
            daysWorked: acc.daysWorked + curr.daysWorked
        }), { totalBase: 0, totalCommission: 0, totalUnits: 0, totalPay: 0, daysWorked: 0 });

        return { type: 'ALL', data: sellersStats, summary: globalSummary };
    } else {
        const stats = calculateStatsForSeller(selectedSeller, startFilterDate, endFilterDate);
        return { type: 'SINGLE', data: stats.dailyBreakdown, summary: stats.summary };
    }

  }, [selectedSeller, startDate, endDate, sales, layaways, loginHistory, baseDailySalary, sellers]);

  // Chart Data: Compare all sellers for the period
  const sellersChartData = useMemo(() => {
      if (!startDate || !endDate) return [];
      
      const startFilterDate = new Date(startDate + 'T00:00:00');
      const endFilterDate = new Date(endDate + 'T23:59:59');
      const sellerStats: Record<string, number> = {};
      
      // Get list of active sellers to filter chart
      const activeSellerNames = new Set(sellers.filter(s => !s.isDisabled).map(s => s.name));

      // Initialize with 0 only for active sellers
      sellers.forEach(s => {
          if (!s.isDisabled) {
            sellerStats[s.name] = 0;
          }
      });

      const processTransaction = (sellerName: string, date: string, items: any[]) => {
          // Only process if seller is currently active
          if (!activeSellerNames.has(sellerName)) return;

          const d = new Date(date);
          if (d >= startFilterDate && d <= endFilterDate) {
              const units = items.reduce((acc, item) => acc + (item.quantity || 0), 0);
              sellerStats[sellerName] = (sellerStats[sellerName] || 0) + units;
          }
      };

      sales.filter(s => !s.layawayId).forEach(s => processTransaction(s.seller, s.createdAt, s.items));
      layaways.filter(l => l.status === 'active').forEach(l => processTransaction(l.seller, l.createdAt, l.items));

      const data = Object.entries(sellerStats).map(([name, total]) => ({ name, total }));
      const maxVal = Math.max(...data.map(d => d.total), 1); // Avoid division by zero

      return { data, maxVal };
  }, [startDate, endDate, sales, layaways, sellers]);


  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg border-t-4 border-red-500">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-500">
                <SparklesIcon className="w-8 h-8" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-accent">Comisiones Temporada Navideña</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Cálculo progresivo por rangos de ventas diarias + Básico</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vendedor</label>
              <select 
                value={selectedSeller} 
                onChange={e => setSelectedSeller(e.target.value)} 
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-md border border-gray-300 dark:border-gray-600"
              >
                <option value="" disabled>Selecciona...</option>
                <option value="ALL" className="font-bold text-accent">Todos los Vendedores</option>
                {sellers.filter(s => !s.isDisabled).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-2">
                <div className="flex-grow">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desde</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white dark:bg-gray-700 p-2 rounded-md border border-gray-300 dark:border-gray-600"/>
                </div>
                <div className="flex-grow">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hasta</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-white dark:bg-gray-700 p-2 rounded-md border border-gray-300 dark:border-gray-600"/>
                </div>
            </div>

            <div className="flex gap-1">
                 <button onClick={() => setFortnight('first')} className="flex-1 px-2 py-2 text-xs font-bold bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors">1ª Dic</button>
                 <button onClick={() => setFortnight('second')} className="flex-1 px-2 py-2 text-xs font-bold bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">2ª Dic</button>
            </div>
        </div>
        
        {/* Basic salary config (optional visualization) */}
        <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
            <span>Básico Diario: </span>
            <input 
                type="number" 
                value={baseDailySalary} 
                onChange={e => setBaseDailySalary(e.target.value)}
                className="w-20 bg-transparent border-b border-gray-300 text-right focus:outline-none focus:border-accent"
            />
        </div>

        {reportData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20"><SparklesIcon className="w-12 h-12" /></div>
                    <p className="text-green-100 text-sm font-medium mb-1">Total a Pagar {selectedSeller === 'ALL' ? '(Todos)' : ''}</p>
                    <p className="text-3xl font-extrabold">{formatCOP(reportData.summary.totalPay)}</p>
                    <p className="text-xs mt-2 text-green-100">Incluye Básico ({formatCOP(reportData.summary.totalBase)}) + Comisiones</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 text-sm font-medium mb-1">Total Comisiones</p>
                    <p className="text-2xl font-bold text-accent">{formatCOP(reportData.summary.totalCommission)}</p>
                    <p className="text-xs mt-2 text-gray-400">Por {reportData.summary.totalUnits} unidades vendidas</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 text-sm font-medium mb-1">Días Trabajados {selectedSeller === 'ALL' ? '(Suma Total)' : ''}</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{reportData.summary.daysWorked}</p>
                    <p className="text-xs mt-2 text-gray-400">
                        {selectedSeller === 'ALL' 
                            ? 'Suma de días trabajados por todos los vendedores' 
                            : `Promedio ventas: ${(reportData.summary.totalUnits / (reportData.summary.daysWorked || 1)).toFixed(1)} uds/día`
                        }
                    </p>
                </div>
            </div>
        )}

        {reportData && reportData.type === 'SINGLE' ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3 text-center">Unidades</th>
                            <th className="px-4 py-3 text-left">Detalle Cálculo</th>
                            <th className="px-4 py-3 text-right">Comisión</th>
                            <th className="px-4 py-3 text-right">Total Día</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(reportData.data as DailyResult[]).map((day, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                    {new Date(day.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 rounded-full font-bold text-xs ${day.unitsSold >= 16 ? 'bg-green-100 text-green-700' : day.unitsSold >= 6 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {day.unitsSold}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-left text-xs text-gray-500 font-mono">{day.breakdown}</td>
                                <td className="px-4 py-3 text-right font-semibold text-accent">{formatCOP(day.commission)}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{formatCOP(day.totalDay)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : reportData && reportData.type === 'ALL' ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Vendedor</th>
                            <th className="px-4 py-3 text-center">Días Trab.</th>
                            <th className="px-4 py-3 text-center">Total Uds.</th>
                            <th className="px-4 py-3 text-right">Total Comisión</th>
                            <th className="px-4 py-3 text-right">Total a Pagar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(reportData.data as SellerSummary[]).map((seller, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{seller.name}</td>
                                <td className="px-4 py-3 text-center">{seller.daysWorked}</td>
                                <td className="px-4 py-3 text-center font-bold">{seller.totalUnits}</td>
                                <td className="px-4 py-3 text-right font-semibold text-accent">{formatCOP(seller.totalCommission)}</td>
                                <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400">{formatCOP(seller.totalPay)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            selectedSeller && <p className="text-center py-8 text-gray-500">No hay registros de actividad para este rango de fechas.</p>
        )}
      </div>

      {/* Sellers Comparison Chart */}
      {startDate && endDate && sellersChartData.data.length > 0 && (
          <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Rendimiento de Vendedores Activos (Total Unidades)</h3>
              <div className="h-64 flex items-end gap-4 px-2 relative pt-6">
                  {/* Y-Axis Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                      <div key={pct} className="absolute w-full border-t border-dashed border-gray-200 dark:border-gray-700 left-0" style={{ bottom: `${pct * 100}%` }}></div>
                  ))}
                  
                  {sellersChartData.data.map((item) => {
                      const heightPct = (item.total / sellersChartData.maxVal) * 100;
                      return (
                          <div key={item.name} className="flex-1 flex flex-col items-center z-10 group h-full justify-end">
                              <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                  {item.total}
                              </div>
                              <div 
                                className={`w-full max-w-[60px] rounded-t-md transition-all duration-500 ${item.name === selectedSeller ? 'bg-accent shadow-[0_0_15px_rgba(255,0,127,0.5)]' : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'}`}
                                style={{ height: `${heightPct}%` }}
                              ></div>
                              <div className={`mt-2 text-xs font-medium truncate w-full text-center ${item.name === selectedSeller ? 'text-accent font-bold' : 'text-gray-500'}`}>
                                  {item.name}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

    </div>
  );
};

export default ChristmasCommissionsView;