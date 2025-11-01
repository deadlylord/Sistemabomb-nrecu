import React, { useState, useMemo, useEffect } from 'react';
import { Seller, Sale, LoginRecord, PayrollRecord, Layaway } from '../types';
import { formatCOP } from '../constants';
import { SearchIcon, CrossIcon, TrashIcon } from './Icons';

interface PayrollViewProps {
  sellers: Seller[];
  sales: Sale[];
  layaways: Layaway[];
  loginHistory: LoginRecord[];
  payrollHistory: PayrollRecord[];
  onSavePayroll: (payrollData: Omit<PayrollRecord, 'id' | 'paidAt' | 'paidBy' | 'storeId'>) => void;
  currentUser: Seller;
}

interface PayrollResult {
  sellerName: string;
  period: string;
  baseSalary: number;
  daysWorked: number;
  adjustedBase: number;
  totalUnitsSold: number;
  totalCommissionableUnits: number;
  commissionAmount: number;
  totalToPay: number;
  dailyBreakdown: DailyBreakdown[];
}

interface DailyBreakdown {
  date: string;
  unitsSold: number;
  commissionableUnits: number;
  commissionEarned: number;
}

const PayrollView: React.FC<PayrollViewProps> = ({ sellers, sales, layaways, loginHistory, payrollHistory, onSavePayroll, currentUser }) => {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [baseSalary, setBaseSalary] = useState(() => localStorage.getItem('payrollBaseSalary') || '');
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const [loginDays, setLoginDays] = useState<{ date: string; unitsSold: number; logins: string[]; startTime?: string; endTime?: string; checked: boolean }[]>([]);
  const [deductions, setDeductions] = useState<{ reason: string; amount: number }[]>([]);
  const [newDeduction, setNewDeduction] = useState({ reason: '', amount: '' });

  const COMMISSION_FLOOR = 5;
  const COMMISSION_PER_UNIT = 1000;

  useEffect(() => {
    localStorage.setItem('payrollBaseSalary', baseSalary);
  }, [baseSalary]);
  
  useEffect(() => {
    setResult(null);
    setLoginDays([]);
    setDeductions([]);
  }, [selectedSeller, startDate, endDate]);

  const setFortnight = (fortnight: 'first' | 'second') => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
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

  const handleLoadDays = () => {
    if (!selectedSeller || !startDate || !endDate) {
      alert('Por favor, selecciona un vendedor y un periodo.');
      return;
    }
    const startFilterDate = new Date(startDate + 'T00:00:00');
    const endFilterDate = new Date(endDate + 'T23:59:59');

    // 1. Get all logins for the period and group by day
    const loginsByDay = new Map<string, LoginRecord[]>();
    loginHistory
      .filter(record => {
        const recordDate = new Date(record.date);
        return record.sellerName === selectedSeller && recordDate >= startFilterDate && recordDate <= endFilterDate;
      })
      .forEach(record => {
        const dateStr = toLocalDateString(new Date(record.date));
        if (!loginsByDay.has(dateStr)) {
          loginsByDay.set(dateStr, []);
        }
        loginsByDay.get(dateStr)!.push(record);
      });

    const salesAndLayawaysByDay = new Map<string, number>();

    // Direct sales
    sales.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return !sale.layawayId && sale.seller === selectedSeller && saleDate >= startFilterDate && saleDate <= endFilterDate;
    }).forEach(sale => {
        const dateStr = toLocalDateString(new Date(sale.createdAt));
        const saleUnits = sale.items.reduce((sum, item) => sum + item.quantity, 0);
        salesAndLayawaysByDay.set(dateStr, (salesAndLayawaysByDay.get(dateStr) || 0) + saleUnits);
    });

    // New active layaways
    layaways.filter(layaway => {
        const layawayDate = new Date(layaway.createdAt);
        return layaway.status === 'active' && layaway.seller === selectedSeller && layawayDate >= startFilterDate && layawayDate <= endFilterDate;
    }).forEach(layaway => {
        const dateStr = toLocalDateString(new Date(layaway.createdAt));
        const layawayUnits = layaway.items.reduce((sum, item) => sum + item.quantity, 0);
        salesAndLayawaysByDay.set(dateStr, (salesAndLayawaysByDay.get(dateStr) || 0) + layawayUnits);
    });

    // 3. Combine unique dates from both logins and sales
    const allDates = new Set<string>([...loginsByDay.keys(), ...salesAndLayawaysByDay.keys()]);

    // 4. Create the final list of days
    const combinedDays = Array.from(allDates)
      .map(dateStr => {
        const dayLogins = loginsByDay.get(dateStr) || [];
        let startTime, endTime;

        if (dayLogins.length > 0) {
          dayLogins.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const timeFormat: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
          startTime = new Date(dayLogins[0].date).toLocaleTimeString('es-CO', timeFormat);
          endTime = new Date(dayLogins[dayLogins.length - 1].date).toLocaleTimeString('es-CO', timeFormat);
        }

        return {
          date: dateStr,
          unitsSold: salesAndLayawaysByDay.get(dateStr) || 0,
          logins: dayLogins.map(l => new Date(l.date).toLocaleTimeString('es-CO')),
          startTime,
          endTime,
          checked: dayLogins.length > 0
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
      
    setLoginDays(combinedDays);
    setResult(null); // Clear previous results when loading new days
  };
  
  const handleToggleDay = (date: string) => {
    setLoginDays(prev => prev.map(day => day.date === date ? { ...day, checked: !day.checked } : day));
  };
  
  const handleCalculate = () => {
    if (!selectedSeller || !baseSalary) {
      alert('Por favor, selecciona un vendedor e ingresa el básico mensual.');
      return;
    }
    const checkedDays = loginDays.filter(day => day.checked);
    if (checkedDays.length === 0) {
      alert('Debes seleccionar al menos un día trabajado para calcular.');
      return;
    }
    const base = parseFloat(baseSalary);
    const calculatedDaysWorked = checkedDays.length;

    const dailyBreakdown = checkedDays.map(({ date, unitsSold }) => {
      const commissionableUnits = Math.max(0, unitsSold - COMMISSION_FLOOR);
      const commissionEarned = commissionableUnits * COMMISSION_PER_UNIT;
      return {
        date: new Date(date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }),
        unitsSold,
        commissionableUnits,
        commissionEarned
      };
    });

    const totals = dailyBreakdown.reduce((acc, day) => {
      acc.totalUnitsSold += day.unitsSold;
      acc.totalCommissionableUnits += day.commissionableUnits;
      acc.totalCommissionAmount += day.commissionEarned;
      return acc;
    }, { totalUnitsSold: 0, totalCommissionableUnits: 0, totalCommissionAmount: 0 });

    const adjustedBase = (base / 30) * calculatedDaysWorked;
    const totalToPay = adjustedBase + totals.totalCommissionAmount;

    setResult({
      sellerName: selectedSeller,
      period: `${new Date(startDate + 'T00:00:00').toLocaleDateString()} - ${new Date(endDate + 'T00:00:00').toLocaleDateString()}`,
      baseSalary: base,
      daysWorked: calculatedDaysWorked,
      adjustedBase,
      totalUnitsSold: totals.totalUnitsSold,
      totalCommissionableUnits: totals.totalCommissionableUnits,
      commissionAmount: totals.totalCommissionAmount,
      totalToPay,
      dailyBreakdown,
    });
    setDeductions([]); // Reset deductions on new calculation
  };

  const handleAddDeduction = () => {
    const amount = parseFloat(newDeduction.amount);
    if (newDeduction.reason.trim() && !isNaN(amount) && amount > 0) {
      setDeductions(prev => [...prev, { reason: newDeduction.reason, amount }]);
      setNewDeduction({ reason: '', amount: '' });
    } else {
      alert('Ingresa una razón y un monto válido para el descuento.');
    }
  };

  const handleRemoveDeduction = (indexToRemove: number) => {
    setDeductions(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const totalDeductions = useMemo(() => deductions.reduce((sum, d) => sum + d.amount, 0), [deductions]);

  const handleRegisterPayment = () => {
    if (result) {
      const finalTotal = result.totalToPay - totalDeductions;
      if (window.confirm(`¿Confirmas el registro del pago de ${formatCOP(finalTotal)} para ${result.sellerName}?`)) {
        const checkedLoginDays = loginDays.filter(day => day.checked);
        const loginAccesses = checkedLoginDays.map(day => ({ 
            date: day.date, 
            times: day.logins,
            startTime: day.startTime,
            endTime: day.endTime,
        }));

        onSavePayroll({
          ...result,
          totalToPay: finalTotal,
          deductions,
          totalDeductions,
          loginAccesses,
        });

        setResult(null);
        setLoginDays([]);
        setDeductions([]);
      }
    }
  };

  const filteredHistory = useMemo(() => {
    const lowerCaseSearchTerm = historySearchTerm.toLowerCase();
    return [...payrollHistory]
      .filter(record => {
        const recordDate = new Date(record.paidAt);
        const start = historyStartDate ? new Date(historyStartDate + 'T00:00:00') : null;
        const end = historyEndDate ? new Date(historyEndDate + 'T23:59:59') : null;
        const matchesSearch = record.sellerName.toLowerCase().includes(lowerCaseSearchTerm);
        const matchesStartDate = start ? recordDate >= start : true;
        const matchesEndDate = end ? recordDate <= end : true;
        return matchesSearch && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [payrollHistory, historySearchTerm, historyStartDate, historyEndDate]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Cálculo de Nómina</h2>
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="seller" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Vendedor</label>
              <select id="seller" value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700">
                <option value="" disabled>Selecciona un vendedor</option>
                {sellers.filter(s => !s.isDisabled).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Periodo</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-grow flex gap-2">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700"/>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700"/>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setFortnight('first')} className="w-full sm:w-auto px-3 py-2 text-xs bg-accent/20 text-accent rounded-md">1ra Quincena</button>
                    <button onClick={() => setFortnight('second')} className="w-full sm:w-auto px-3 py-2 text-xs bg-accent/20 text-accent rounded-md">2da Quincena</button>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="baseSalary" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Básico Mensual</label>
              <input type="number" id="baseSalary" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} placeholder="0" className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700"/>
            </div>
             <div className="md:col-span-2 lg:col-span-2">
                <button onClick={handleLoadDays} className="w-full bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors">
                    Cargar Días y Ventas
                </button>
             </div>
          </div>
        </div>

        {loginDays.length > 0 && (
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-text-light mb-2">Seleccionar Días a Pagar</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
              {loginDays.map(day => (
                <label key={day.date} className="flex flex-col p-3 bg-white dark:bg-secondary rounded-lg cursor-pointer border-2 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">{new Date(day.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <input type="checkbox" checked={day.checked} onChange={() => handleToggleDay(day.date)} className="h-4 w-4 rounded text-accent focus:ring-accent"/>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-text-dark mt-1">{day.unitsSold} uds vendidas</span>
                  {day.startTime ? (
                    <span className="text-xs text-blue-400 mt-1 font-mono">
                        {day.startTime === day.endTime ? day.startTime : `${day.startTime} - ${day.endTime}`}
                    </span>
                  ) : (
                    day.unitsSold > 0 && (
                        <span className="text-xs text-yellow-500 mt-1" title="Se registraron ventas este día, pero no un inicio de sesión.">
                            (Sin login)
                        </span>
                    )
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-center mt-4">
              <button onClick={handleCalculate} className="bg-accent text-white font-bold py-3 px-8 rounded-lg transition-transform duration-300 hover:scale-105 hover:bg-accent-hover shadow-lg shadow-accent/20">
                Calcular Nómina
              </button>
            </div>
          </div>
        )}

        {result && (
            <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg animate-fade-in mt-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Resultados para: <span className="text-accent">{result.sellerName}</span></h3>
            <p className="text-sm text-gray-500 dark:text-text-dark mb-4">Periodo: {result.period}</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-text-light mb-2">Desglose de Comisiones</h4>
                    <div className="overflow-x-auto max-h-72 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <table className="w-full text-left"><thead className="bg-gray-100 dark:bg-gray-800 sticky top-0"><tr><th className="p-2 text-xs font-semibold">Fecha</th><th className="p-2 text-xs font-semibold text-center">Uds.</th><th className="p-2 text-xs font-semibold text-center">Uds. Com.</th><th className="p-2 text-xs font-semibold text-right">Comisión</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{result.dailyBreakdown.map((day, index) => (<tr key={index}><td className="p-2 text-xs">{day.date}</td><td className="p-2 text-center text-xs font-semibold">{day.unitsSold}</td><td className={`p-2 text-center text-xs font-bold ${day.commissionableUnits > 0 ? 'text-green-500' : ''}`}>{day.commissionableUnits}</td><td className={`p-2 text-right text-xs font-bold ${day.commissionEarned > 0 ? 'text-accent' : ''}`}>{formatCOP(day.commissionEarned)}</td></tr>))
                        }</tbody></table>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="space-y-3 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex justify-between items-center text-sm"><span className="text-gray-600 dark:text-text-dark">Días Trabajados ({result.daysWorked}):</span><span className="font-semibold text-gray-800 dark:text-text-light">{formatCOP(result.adjustedBase)}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-gray-600 dark:text-text-dark">Comisiones ({result.totalCommissionableUnits} uds):</span><span className="font-semibold text-gray-800 dark:text-text-light">{formatCOP(result.commissionAmount)}</span></div>
                        <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 my-2"></div>
                        <div className="flex justify-between items-center text-lg font-extrabold pt-2"><span className="text-gray-800 dark:text-white">Subtotal:</span><span className="text-accent">{formatCOP(result.totalToPay)}</span></div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-text-light mb-2">Descuentos</h4>
                        <div className="space-y-2 mb-3">
                            {deductions.map((d, i) => (<div key={i} className="flex justify-between items-center text-sm"><span className="text-gray-600 dark:text-text-dark">{d.reason}</span><div className="flex items-center gap-2"><span className="font-semibold text-red-500">-{formatCOP(d.amount)}</span><button onClick={() => handleRemoveDeduction(i)} className="text-red-500"><TrashIcon className="w-4 h-4"/></button></div></div>))}
                        </div>
                        <div className="flex gap-2 items-end"><input type="text" placeholder="Razón" value={newDeduction.reason} onChange={e => setNewDeduction(p => ({...p, reason: e.target.value}))} className="w-full bg-white dark:bg-primary p-1.5 rounded-md text-sm"/><input type="number" placeholder="Monto" value={newDeduction.amount} onChange={e => setNewDeduction(p => ({...p, amount: e.target.value}))} className="w-28 bg-white dark:bg-primary p-1.5 rounded-md text-sm"/><button onClick={handleAddDeduction} className="bg-blue-600 text-white text-sm font-bold py-1.5 px-3 rounded-lg hover:bg-blue-700">+</button></div>
                        <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 my-2 pt-2 flex justify-between items-center text-lg font-extrabold"><span className="text-gray-800 dark:text-white">TOTAL A PAGAR:</span><span className="text-accent">{formatCOP(result.totalToPay - totalDeductions)}</span></div>
                    </div>
                     <div className="flex justify-end mt-4">
                        <button onClick={handleRegisterPayment} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors">Registrar Pago</button>
                    </div>
                </div>
            </div>
            </div>
        )}
      </div>

      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Historial de Pagos de Nómina</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative md:col-span-1"><input type="text" placeholder="Buscar por vendedor..." value={historySearchTerm} onChange={e => setHistorySearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10"/><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>{historySearchTerm && (<button onClick={() => setHistorySearchTerm('')} className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white" aria-label="Limpiar búsqueda"><CrossIcon className="w-5 h-5" /></button>)}</div>
            <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2" />
            <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2" />
        </div>
        <div className="space-y-4">
            {filteredHistory.length > 0 ? filteredHistory.map(record => {
                const totalDeductions = record.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0;
                return (
                <div key={record.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedHistoryId(expandedHistoryId === record.id ? null : record.id)}>
                        <div><p className="font-bold text-lg text-gray-900 dark:text-white">{record.sellerName}</p><p className="text-sm text-gray-500 dark:text-text-dark">Periodo: {record.period}</p><p className="text-xs text-gray-400">Pagado el {new Date(record.paidAt).toLocaleString()} por {record.paidBy}</p></div>
                        <div className="text-right"><p className="text-2xl font-bold text-accent">{formatCOP(record.totalToPay)}</p></div>
                    </div>
                    {expandedHistoryId === record.id && (
                        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700 text-sm">
                             <div className="space-y-2 bg-white dark:bg-gray-900/50 p-3 rounded-md">
                                <h4 className="font-bold text-center mb-2">Detalles del Pago</h4>
                                <div className="flex justify-between"><span>Básico Ajustado ({record.daysWorked} días):</span> <span>{formatCOP(record.adjustedBase)}</span></div>
                                <div className="flex justify-between"><span>Comisiones ({record.totalCommissionableUnits} uds):</span> <span>{formatCOP(record.commissionAmount)}</span></div>
                                {totalDeductions > 0 && <div className="flex justify-between text-red-500"><span>Descuentos:</span> <span>-{formatCOP(totalDeductions)}</span></div>}
                                <div className="flex justify-between font-bold text-base pt-2 border-t border-dashed"><span>Total Pagado:</span> <span>{formatCOP(record.totalToPay)}</span></div>
                                {record.loginAccesses && record.loginAccesses.length > 0 && (
                                  <div className="pt-2 border-t"><p className="text-xs font-semibold">Días pagados:</p><p className="text-xs text-gray-500">{record.loginAccesses.map(l => {
                                      const dateStr = new Date(l.date+'T00:00:00').toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit'});
                                      if (l.startTime) {
                                          const timeStr = l.startTime === l.endTime ? l.startTime : `${l.startTime} - ${l.endTime}`;
                                          return `${dateStr} (${timeStr})`;
                                      }
                                      return dateStr;
                                  }).join(', ')}</p></div>
                                )}
                             </div>
                        </div>
                    )}
                </div>
            )}) : <p className="text-center text-gray-500 dark:text-text-dark py-4">No hay pagos de nómina registrados.</p>}
        </div>
      </div>
    </div>
  );
};

export default PayrollView;