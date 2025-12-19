import React, { useState, useMemo, useEffect } from 'react';
import { Seller, Sale, Layaway, LoginRecord, Role, Product, Store, PaymentMethod, Payment } from '../types';
import { formatCOP } from '../constants';
import { SparklesIcon, DollarIcon, BuildingStorefrontIcon } from './Icons';

interface ChristmasCommissionsViewProps {
  sellers: Seller[];
  sales: Sale[];
  layaways: Layaway[];
  loginHistory: LoginRecord[];
  roles: Role[];
  inventory: Product[];
  stores: Store[];
}

interface DailyResult {
  date: string;
  unitsSold: number;
  breakdown: string;
  dailyBase: number;
  commission: number;
  highValueBonus: number; // New field for the 1% bonus
  totalDay: number;
  isWorked: boolean;
}

interface SellerSummary {
    name: string;
    totalBase: number;
    totalCommission: number;
    totalHighValueBonus: number; // New field summary
    totalUnits: number;
    totalPay: number;
    daysWorked: number;
}

const ChristmasCommissionsView: React.FC<ChristmasCommissionsViewProps> = ({ 
    sellers = [], 
    sales = [], 
    layaways = [], 
    loginHistory = [], 
    roles = [], 
    inventory = [], 
    stores = [] 
}) => {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [baseDailySalary, setBaseDailySalary] = useState('45000');
  const [visibleSellerNames, setVisibleSellerNames] = useState<string[]>([]);

  // Filter out disabled sellers and administrators
  const eligibleSellers = useMemo(() => {
      if (!roles || !sellers) return [];
      const adminRole = roles.find(r => r.name === 'Administrator');
      const adminRoleId = adminRole?.id;
      return sellers.filter(s => !s.isDisabled && s.roleId !== adminRoleId);
  }, [sellers, roles]);

  useEffect(() => {
      if (eligibleSellers.length > 0 && visibleSellerNames.length === 0) {
          setVisibleSellerNames(eligibleSellers.map(s => s.name));
      }
  }, [eligibleSellers]);

  const toggleSellerVisibility = (name: string) => {
      setVisibleSellerNames(prev => 
          prev.includes(name) 
              ? prev.filter(n => n !== name) 
              : [...prev, name]
      );
  };

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
  
  // Calculate High Value Bonus (1% for Cash/QR sales > 500k)
  const calculateHighValueBonus = (transactionTotal: number, payments: Payment[], paymentMethod?: string) => {
      const HIGH_VALUE_THRESHOLD = 500000;
      const BONUS_PERCENTAGE = 0.01;

      if (transactionTotal <= HIGH_VALUE_THRESHOLD) return 0;

      let eligibleAmount = 0;
      
      // Check payments array first
      if (payments && payments.length > 0) {
          eligibleAmount = payments
              .filter(p => p.method === PaymentMethod.Efectivo || p.method === PaymentMethod.QR)
              .reduce((sum, p) => sum + p.amount, 0);
      } 
      // Fallback for legacy data
      else if (paymentMethod === PaymentMethod.Efectivo || paymentMethod === PaymentMethod.QR) {
          eligibleAmount = transactionTotal;
      }

      return eligibleAmount * BONUS_PERCENTAGE;
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
        const highValueBonusMap = new Map<string, number>();

        // Sales
        sales.filter(s => !s.layawayId && s.seller === sellerName).forEach(s => {
            const d = new Date(s.createdAt);
            if (d >= start && d <= end) {
                const dateStr = toLocalDateString(d);
                workedDates.add(dateStr);
                
                // Units
                const units = s.items.reduce((acc, item) => acc + (item.quantity || 0), 0);
                salesMap.set(dateStr, (salesMap.get(dateStr) || 0) + units);
                
                // High Value Bonus
                const bonus = calculateHighValueBonus(s.totalAmount, s.payments || [], s.paymentMethod ? String(s.paymentMethod) : undefined);
                if (bonus > 0) {
                     highValueBonusMap.set(dateStr, (highValueBonusMap.get(dateStr) || 0) + bonus);
                }
            }
        });

        // Layaways (Active)
        layaways.filter(l => l.status === 'active' && l.seller === sellerName).forEach(l => {
            const d = new Date(l.createdAt);
            if (d >= start && d <= end) {
                const dateStr = toLocalDateString(d);
                workedDates.add(dateStr);
                
                // Units
                const units = l.items.reduce((acc, item) => acc + (item.quantity || 0), 0);
                salesMap.set(dateStr, (salesMap.get(dateStr) || 0) + units);
                
                // High Value Bonus (Based on payments made so far or committed if logic requires, here we used paidAmount in payments for accuracy)
                const bonus = calculateHighValueBonus(l.totalAmount, l.payments || [], undefined);
                if (bonus > 0) {
                     highValueBonusMap.set(dateStr, (highValueBonusMap.get(dateStr) || 0) + bonus);
                }
            }
        });

        const sortedDates = Array.from(workedDates).sort();
        const results: DailyResult[] = sortedDates.map(dateStr => {
            const unitsSold = salesMap.get(dateStr) || 0;
            const highValueBonus = highValueBonusMap.get(dateStr) || 0;
            const { commission, breakdown } = calculateDailyCommission(unitsSold);
            
            return {
                date: dateStr,
                unitsSold,
                breakdown,
                dailyBase,
                commission,
                highValueBonus,
                totalDay: dailyBase + commission + highValueBonus,
                isWorked: true
            };
        });

        const totalStats = results.reduce((acc, curr) => ({
            totalBase: acc.totalBase + curr.dailyBase,
            totalCommission: acc.totalCommission + curr.commission,
            totalHighValueBonus: acc.totalHighValueBonus + curr.highValueBonus,
            totalUnits: acc.totalUnits + curr.unitsSold,
            totalPay: acc.totalPay + curr.totalDay,
            daysWorked: acc.daysWorked + 1
        }), { totalBase: 0, totalCommission: 0, totalHighValueBonus: 0, totalUnits: 0, totalPay: 0, daysWorked: 0 });

        return { dailyBreakdown: results, summary: totalStats };
  };

  const reportData = useMemo(() => {
    if (!selectedSeller || !startDate || !endDate) {
      return null;
    }

    const startFilterDate = new Date(startDate + 'T00:00:00');
    const endFilterDate = new Date(endDate + 'T23:59:59');

    if (selectedSeller === 'ALL') {
        // Use eligibleSellers instead of all sellers to exclude admins
        const sellersStats: SellerSummary[] = eligibleSellers.map(s => {
            const stats = calculateStatsForSeller(s.name, startFilterDate, endFilterDate);
            return { name: s.name, ...stats.summary };
        });
        
        const globalSummary = sellersStats.reduce((acc, curr) => ({
            totalBase: acc.totalBase + curr.totalBase,
            totalCommission: acc.totalCommission + curr.totalCommission,
            totalHighValueBonus: acc.totalHighValueBonus + curr.totalHighValueBonus,
            totalUnits: acc.totalUnits + curr.totalUnits,
            totalPay: acc.totalPay + curr.totalPay,
            daysWorked: acc.daysWorked + curr.daysWorked
        }), { totalBase: 0, totalCommission: 0, totalHighValueBonus: 0, totalUnits: 0, totalPay: 0, daysWorked: 0 });

        return { type: 'ALL', data: sellersStats, summary: globalSummary };
    } else {
        const stats = calculateStatsForSeller(selectedSeller, startFilterDate, endFilterDate);
        return { type: 'SINGLE', data: stats.dailyBreakdown, summary: stats.summary };
    }

  }, [selectedSeller, startDate, endDate, sales, layaways, loginHistory, baseDailySalary, eligibleSellers]);

  // Chart Data: Compare all sellers for the period
  const sellersChartData = useMemo(() => {
      if (!startDate || !endDate) return [];
      
      const startFilterDate = new Date(startDate + 'T00:00:00');
      const endFilterDate = new Date(endDate + 'T23:59:59');
      const sellerStats: Record<string, number> = {};
      
      // Initialize with 0 only for sellers visible in chart
      eligibleSellers.forEach(s => {
          if (visibleSellerNames.includes(s.name)) {
            sellerStats[s.name] = 0;
          }
      });

      const processTransaction = (sellerName: string, date: string, items: any[]) => {
          // Only process if seller is set to be visible
          if (!visibleSellerNames.includes(sellerName)) return;

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
  }, [startDate, endDate, sales, layaways, eligibleSellers, visibleSellerNames]);

  // Top Performers Logic (Value Added)
  const topPerformers = useMemo(() => {
    if (!startDate || !endDate || !inventory || !stores) return { sellers: [], stores: [] };

    const startFilterDate = new Date(startDate + 'T00:00:00');
    const endFilterDate = new Date(endDate + 'T23:59:59');

    const sellerOverprice: Record<string, number> = {};
    const storeOverprice: Record<string, number> = {};

    const processTransactionForOverprice = (transaction: any, transactionType: 'sale' | 'layaway') => {
        const d = new Date(transaction.createdAt);
        if (d < startFilterDate || d > endFilterDate) return;

        // Calculate Cash/QR payment amount for this transaction
        let cashQrPaid = 0;
        const payments: Payment[] = transaction.payments || 
                                    (transaction.paymentMethod ? [{ method: transaction.paymentMethod, amount: transaction.totalAmount }] : []);

        payments.forEach(p => {
            if (p.method === PaymentMethod.Efectivo || p.method === PaymentMethod.QR) {
                cashQrPaid += p.amount;
            }
        });

        if (cashQrPaid <= 0) return; // No contribution if not paid in Cash/QR

        // Calculate total transaction value to determine ratio
        const totalAmount = transaction.totalAmount || 0;
        if (totalAmount === 0) return;

        const ratio = cashQrPaid / totalAmount;

        // Calculate total price difference (Sold Price - System Price)
        let totalDiff = 0;
        if (transaction.items) {
            transaction.items.forEach((item: any) => {
                const product = inventory.find(p => p.id === item.id);
                if (product) {
                    const diffUnit = item.price - product.price;
                    if (diffUnit > 0) { // Only count positive markup/overprice
                        totalDiff += (diffUnit * item.quantity);
                    }
                }
            });
        }
        
        // Attribute proportional difference
        const valueToAdd = totalDiff * ratio;

        if (valueToAdd > 0) {
            const sellerName = transaction.seller;
            // Only attribute to eligible sellers (not admins, active)
            if (eligibleSellers.some(s => s.name === sellerName)) {
                 sellerOverprice[sellerName] = (sellerOverprice[sellerName] || 0) + valueToAdd;
            }

            const storeId = transaction.storeId;
            if (storeId) {
                storeOverprice[storeId] = (storeOverprice[storeId] || 0) + valueToAdd;
            }
        }
    };

    sales.filter(s => !s.layawayId).forEach(s => processTransactionForOverprice(s, 'sale'));
    layaways.filter(l => l.status === 'active' || l.status === 'completed').forEach(l => processTransactionForOverprice(l, 'layaway'));

    const topSellers = Object.entries(sellerOverprice)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    const topStores = Object.entries(storeOverprice)
        .map(([storeId, total]) => ({ 
            name: stores.find(s => s.id === storeId)?.name || 'Desconocida', 
            total 
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    return { sellers: topSellers, stores: topStores };

  }, [startDate, endDate, sales, layaways, inventory, eligibleSellers, stores]);


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
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vendedor (Tabla)</label>
              <select 
                value={selectedSeller} 
                onChange={e => setSelectedSeller(e.target.value)} 
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-md border border-gray-300 dark:border-gray-600"
              >
                <option value="" disabled>Selecciona...</option>
                <option value="ALL" className="font-bold text-accent">Todos los Vendedores</option>
                {eligibleSellers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg relative overflow-hidden md:col-span-2 lg:col-span-1">
                    <div className="absolute top-0 right-0 p-4 opacity-20"><SparklesIcon className="w-12 h-12" /></div>
                    <p className="text-green-100 text-sm font-medium mb-1">Total a Pagar {selectedSeller === 'ALL' ? '(Todos)' : ''}</p>
                    <p className="text-3xl font-extrabold">{formatCOP(reportData.summary.totalPay)}</p>
                    <p className="text-xs mt-2 text-green-100">Incluye Básico ({formatCOP(reportData.summary.totalBase)}) + Comisiones</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 text-sm font-medium mb-1">Comisión Unidades</p>
                    <p className="text-xl font-bold text-accent">{formatCOP(reportData.summary.totalCommission)}</p>
                    <p className="text-xs mt-2 text-gray-400">Por {reportData.summary.totalUnits} unidades vendidas</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 text-sm font-medium mb-1">Bono Alto Valor (1%)</p>
                    <p className="text-xl font-bold text-purple-500">{formatCOP(reportData.summary.totalHighValueBonus)}</p>
                    <p className="text-xs mt-2 text-gray-400">Por ventas Efec/QR {'>'} 500k</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 text-sm font-medium mb-1">Días Trabajados {selectedSeller === 'ALL' ? '(Suma)' : ''}</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{reportData.summary.daysWorked}</p>
                    <p className="text-xs mt-2 text-gray-400">
                        {selectedSeller === 'ALL' 
                            ? 'Días totales sumados' 
                            : `Promedio: ${(reportData.summary.totalUnits / (reportData.summary.daysWorked || 1)).toFixed(1)} uds/día`
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
                            <th className="px-4 py-3 text-left">Detalle Uds</th>
                            <th className="px-4 py-3 text-right">Comisión Uds</th>
                            <th className="px-4 py-3 text-right">Bono Alto Valor</th>
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
                                <td className="px-4 py-3 text-right font-semibold text-purple-500">{day.highValueBonus > 0 ? formatCOP(day.highValueBonus) : '-'}</td>
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
                            <th className="px-4 py-3 text-right">Comisión Uds</th>
                            <th className="px-4 py-3 text-right">Bono Alto Valor</th>
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
                                <td className="px-4 py-3 text-right font-semibold text-purple-500">{formatCOP(seller.totalHighValueBonus)}</td>
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2 sm:mb-0">Rendimiento de Vendedores Activos (Total Unidades)</h3>
                  
                  {/* Chart visibility toggles */}
                  <div className="flex flex-wrap gap-2 justify-end">
                      {eligibleSellers.map(s => (
                          <button
                              key={s.id}
                              onClick={() => toggleSellerVisibility(s.name)}
                              className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                                  visibleSellerNames.includes(s.name) 
                                      ? 'bg-accent/10 border-accent text-accent font-bold' 
                                      : 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                              }`}
                          >
                              {s.name}
                          </button>
                      ))}
                  </div>
              </div>

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
                  {sellersChartData.data.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                          Selecciona al menos un vendedor para ver el gráfico.
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Top Performers Cards */}
      {startDate && endDate && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Seller Card */}
              <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600">
                         <DollarIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Top Vendedores (Mayor Valor Agregado)</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Diferencia positiva entre precio sistema y venta final (Solo Efectivo/QR).
                  </p>
                  <div className="space-y-3">
                      {topPerformers.sellers.length > 0 ? (
                          topPerformers.sellers.map((seller, idx) => (
                              <div key={seller.name} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                          {idx + 1}
                                      </span>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">{seller.name}</span>
                                  </div>
                                  <span className="font-bold text-green-600 dark:text-green-400">{formatCOP(seller.total)}</span>
                              </div>
                          ))
                      ) : (
                          <p className="text-center text-gray-400 text-sm py-4">No hay datos suficientes.</p>
                      )}
                  </div>
              </div>

              {/* Top Store Card */}
              <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                         <BuildingStorefrontIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Top Tiendas (Mayor Valor Agregado)</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Total acumulado por tienda de diferencias positivas (Solo Efectivo/QR).
                  </p>
                  <div className="space-y-3">
                      {topPerformers.stores.length > 0 ? (
                          topPerformers.stores.map((store, idx) => (
                              <div key={store.name} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                          {idx + 1}
                                      </span>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">{store.name}</span>
                                  </div>
                                  <span className="font-bold text-blue-600 dark:text-blue-400">{formatCOP(store.total)}</span>
                              </div>
                          ))
                      ) : (
                          <p className="text-center text-gray-400 text-sm py-4">No hay datos suficientes.</p>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default ChristmasCommissionsView;