
import React, { useState, useMemo, useEffect } from 'react';
import { Seller, Sale, LoginRecord, PayrollRecord, Layaway, Store } from '../types';
import { formatCOP } from '../constants';
import { SearchIcon, CrossIcon, TrashIcon, PlusCircleIcon, DollarIcon, UsersIcon, ShieldCheckIcon, WhatsAppIcon, PrintIcon } from './Icons';

interface PayrollViewProps {
  sellers: Seller[];
  sales: Sale[];
  layaways: Layaway[];
  loginHistory: LoginRecord[];
  payrollHistory: PayrollRecord[];
  onSavePayroll: (payrollData: Omit<PayrollRecord, 'id' | 'paidAt' | 'paidBy' | 'storeId'>) => Promise<void>;
  currentUser: Seller;
  currentStore: Store | undefined;
}

interface PayrollResult {
  sellerName: string;
  period: string;
  paymentType: 'nomina' | 'admin' | 'utilidad';
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

const PayrollReceiptModal: React.FC<{
    receipt: any;
    store: Store | undefined;
    onClose: () => void;
}> = ({ receipt, store, onClose }) => {
    if (!receipt || !store) return null;

    const receiptText = `*${store.receiptName || store.name}*\n` +
        `📄 *COMPROBANTE DE PAGO*\n\n` +
        `*Beneficiario:* ${receipt.sellerName}\n` +
        `*Tipo:* ${receipt.paymentType === 'nomina' ? 'Nómina' : (receipt.paymentType === 'admin' ? 'Salario Admin' : 'Utilidades')}\n` +
        `*Periodo:* ${receipt.period}\n` +
        `*Fecha de Pago:* ${new Date().toLocaleDateString()}\n` +
        `-----------------------------------\n` +
        `*Base / Subtotal:* ${formatCOP(receipt.adjustedBase)}\n` +
        (receipt.commissionAmount > 0 ? `*Comisiones:* ${formatCOP(receipt.commissionAmount)}\n` : '') +
        (receipt.totalBonuses > 0 ? `*Bonificaciones:* +${formatCOP(receipt.totalBonuses)}\n` : '') +
        (receipt.totalDeductions > 0 ? `*Descuentos:* -${formatCOP(receipt.totalDeductions)}\n` : '') +
        `-----------------------------------\n` +
        `*NETO PAGADO: ${formatCOP(receipt.totalToPay)}*\n\n` +
        `_${store.whatsappFooterText}_\n\n` +
        `${store.contactInfo}`;

    const handleWhatsAppSend = () => {
        const encodedText = encodeURIComponent(receiptText);
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-secondary rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-accent/10">
                    <h2 className="text-xl font-bold text-accent">Comprobante de Pago</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                        <CrossIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 bg-white dark:bg-primary font-mono text-sm space-y-4">
                    <div className="text-center border-b pb-4">
                        <h3 className="text-lg font-bold text-accent">{store.receiptName || store.name}</h3>
                        <p className="text-xs text-gray-500">{store.contactInfo}</p>
                    </div>
                    <div className="space-y-1">
                        <p><strong>Para:</strong> {receipt.sellerName}</p>
                        <p><strong>Periodo:</strong> {receipt.period}</p>
                        <p><strong>Fecha:</strong> {new Date().toLocaleString()}</p>
                    </div>
                    <div className="border-t border-b border-dashed py-3 space-y-1">
                        <div className="flex justify-between"><span>Base/Ajuste:</span> <span>{formatCOP(receipt.adjustedBase)}</span></div>
                        {receipt.commissionAmount > 0 && <div className="flex justify-between"><span>Comisiones:</span> <span>{formatCOP(receipt.commissionAmount)}</span></div>}
                        {receipt.totalBonuses > 0 && <div className="flex justify-between text-green-600"><span>Bonos:</span> <span>+{formatCOP(receipt.totalBonuses)}</span></div>}
                        {receipt.totalDeductions > 0 && <div className="flex justify-between text-red-600"><span>Dctos:</span> <span>-{formatCOP(receipt.totalDeductions)}</span></div>}
                    </div>
                    <div className="text-right pt-2">
                        <p className="text-xl font-black text-accent">Total: {formatCOP(receipt.totalToPay)}</p>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 grid grid-cols-2 gap-3">
                    <button onClick={handleWhatsAppSend} className="bg-green-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 transition-all">
                        <WhatsAppIcon className="w-5 h-5"/> WhatsApp
                    </button>
                    <button onClick={() => window.print()} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-text-light font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-300">
                        <PrintIcon className="w-5 h-5"/> Imprimir
                    </button>
                </div>
            </div>
        </div>
    );
};

const PayrollView: React.FC<PayrollViewProps> = ({ sellers, sales, layaways, loginHistory, payrollHistory, onSavePayroll, currentUser, currentStore }) => {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [baseSalary, setBaseSalary] = useState(() => localStorage.getItem('payrollBaseSalary') || '1500000');
  const [paymentType, setPaymentType] = useState<'nomina' | 'admin' | 'utilidad'>('nomina');
  const [manualAmount, setManualAmount] = useState('');
  
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [receiptToShow, setReceiptToShow] = useState<any | null>(null);

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const [loginDays, setLoginDays] = useState<{ date: string; unitsSold: number; logins: string[]; startTime?: string; endTime?: string; checked: boolean }[]>([]);
  const [deductions, setDeductions] = useState<{ reason: string; amount: number }[]>([]);
  const [bonuses, setBonuses] = useState<{ reason: string; amount: number }[]>([]);
  const [newDeduction, setNewDeduction] = useState({ reason: '', amount: '' });
  const [newBonus, setNewBonus] = useState({ reason: '', amount: '' });

  const COMMISSION_FLOOR = 0; 
  const COMMISSION_PER_UNIT = 1000;

  useEffect(() => {
    localStorage.setItem('payrollBaseSalary', baseSalary);
  }, [baseSalary]);
  
  useEffect(() => {
    setResult(null);
    setLoginDays([]);
    setDeductions([]);
    setBonuses([]);
    setManualAmount('');
  }, [selectedSeller, startDate, endDate, paymentType]);

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
      alert('Por favor, selecciona un destinatario y un periodo.');
      return;
    }

    if (paymentType !== 'nomina') {
        handleCalculate();
        return;
    }

    const startFilterDate = new Date(startDate + 'T00:00:00');
    const endFilterDate = new Date(endDate + 'T23:59:59');

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

    sales.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return !sale.layawayId && sale.seller === selectedSeller && saleDate >= startFilterDate && saleDate <= endFilterDate;
    }).forEach(sale => {
        const dateStr = toLocalDateString(new Date(sale.createdAt));
        const saleUnits = sale.items.reduce((sum, item) => sum + item.quantity, 0);
        salesAndLayawaysByDay.set(dateStr, (salesAndLayawaysByDay.get(dateStr) || 0) + saleUnits);
    });

    layaways.filter(layaway => {
        const layawayDate = new Date(layaway.createdAt);
        return layaway.status === 'active' && layaway.seller === selectedSeller && layawayDate >= startFilterDate && layawayDate <= endFilterDate;
    }).forEach(layaway => {
        const dateStr = toLocalDateString(new Date(layaway.createdAt));
        const layawayUnits = layaway.items.reduce((sum, item) => sum + item.quantity, 0);
        salesAndLayawaysByDay.set(dateStr, (salesAndLayawaysByDay.get(dateStr) || 0) + layawayUnits);
    });

    const allDates = new Set<string>([...loginsByDay.keys(), ...salesAndLayawaysByDay.keys()]);

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
    setResult(null);
  };
  
  const handleToggleDay = (date: string) => {
    setLoginDays(prev => prev.map(day => day.date === date ? { ...day, checked: !day.checked } : day));
  };
  
  const handleCalculate = () => {
    if (!selectedSeller) {
      alert('Por favor, selecciona un destinatario.');
      return;
    }

    if (paymentType === 'nomina') {
        const checkedDays = loginDays.filter(day => day.checked);
        if (checkedDays.length === 0) {
            alert('Debes seleccionar al menos un día trabajado para calcular nómina.');
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
            paymentType: 'nomina',
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
    } else {
        const amount = parseFloat(manualAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Por favor, ingresa el monto a pagar.');
            return;
        }

        setResult({
            sellerName: selectedSeller,
            paymentType: paymentType,
            period: `${new Date(startDate + 'T00:00:00').toLocaleDateString()} - ${new Date(endDate + 'T00:00:00').toLocaleDateString()}`,
            baseSalary: amount,
            daysWorked: 0,
            adjustedBase: amount,
            totalUnitsSold: 0,
            totalCommissionableUnits: 0,
            commissionAmount: 0,
            totalToPay: amount,
            dailyBreakdown: [],
        });
    }
  };

  const handleAddDeduction = () => {
    const amount = parseFloat(newDeduction.amount);
    if (newDeduction.reason.trim() && !isNaN(amount) && amount > 0) {
      setDeductions(prev => [...prev, { reason: newDeduction.reason, amount }]);
      setNewDeduction({ reason: '', amount: '' });
    }
  };

  const handleAddBonus = () => {
    const amount = parseFloat(newBonus.amount);
    if (newBonus.reason.trim() && !isNaN(amount) && amount > 0) {
      setBonuses(prev => [...prev, { reason: newBonus.reason, amount }]);
      setNewBonus({ reason: '', amount: '' });
    }
  };

  const totalDeductions = useMemo(() => deductions.reduce((sum, d) => sum + d.amount, 0), [deductions]);
  const totalBonuses = useMemo(() => bonuses.reduce((sum, b) => sum + b.amount, 0), [bonuses]);

  const handleRegisterPayment = async () => {
    if (result && !isSaving) {
      const finalTotal = result.totalToPay + totalBonuses - totalDeductions;
      const typeLabel = result.paymentType === 'nomina' ? 'nómina' : (result.paymentType === 'admin' ? 'salario administrativo' : 'pago de utilidades');
      
      if (window.confirm(`¿Confirmas el registro del ${typeLabel} de ${formatCOP(finalTotal)} para ${result.sellerName}?`)) {
        setIsSaving(true);
        try {
            const checkedLoginDays = loginDays.filter(day => day.checked);
            const loginAccesses = checkedLoginDays.map(day => ({ 
                date: day.date, 
                times: day.logins,
                startTime: day.startTime,
                endTime: day.endTime,
            }));

            const finalData = {
              ...result,
              totalToPay: finalTotal,
              deductions,
              totalDeductions,
              bonuses,
              totalBonuses,
              loginAccesses,
            };

            await onSavePayroll(finalData);

            // Set receipt before clearing
            setReceiptToShow(finalData);
            
            // Clear calculation state
            setResult(null);
            setLoginDays([]);
            setDeductions([]);
            setBonuses([]);
            setManualAmount('');
            alert("Pago registrado correctamente.");
        } catch (error) {
            console.error("Error saving payroll:", error);
            alert("Error al guardar el pago. Por favor intenta de nuevo.");
        } finally {
            setIsSaving(false);
        }
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
        <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Gestión de Pagos y Nómina</h2>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-inner mb-6 overflow-x-auto scrollbar-hide">
            <button 
                onClick={() => setPaymentType('nomina')}
                className={`flex-1 min-w-[140px] py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${paymentType === 'nomina' ? 'bg-white dark:bg-gray-700 text-accent shadow-md' : 'text-gray-500'}`}
            >
                <UsersIcon className="w-4 h-4"/> Nómina Vendedores
            </button>
            <button 
                onClick={() => setPaymentType('admin')}
                className={`flex-1 min-w-[140px] py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${paymentType === 'admin' ? 'bg-white dark:bg-gray-700 text-accent shadow-md' : 'text-gray-500'}`}
            >
                <ShieldCheckIcon className="w-4 h-4"/> Salario Administrativo
            </button>
            <button 
                onClick={() => setPaymentType('utilidad')}
                className={`flex-1 min-w-[140px] py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${paymentType === 'utilidad' ? 'bg-white dark:bg-gray-700 text-accent shadow-md' : 'text-gray-500'}`}
            >
                <DollarIcon className="w-4 h-4"/> Pago Utilidades
            </button>
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="seller" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">
                  {paymentType === 'utilidad' ? 'Socio / Dueño' : 'Destinatario'}
              </label>
              <select id="seller" value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700">
                <option value="" disabled>Selecciona...</option>
                {sellers.filter(s => !s.isDisabled).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Periodo Correspondiente</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-grow flex gap-2">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700"/>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700"/>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setFortnight('first')} className="w-full sm:w-auto px-3 py-2 text-xs bg-accent/20 text-accent rounded-md font-bold">1ra Qna</button>
                    <button onClick={() => setFortnight('second')} className="w-full sm:w-auto px-3 py-2 text-xs bg-accent/20 text-accent rounded-md font-bold">2da Qna</button>
                </div>
              </div>
            </div>
            {paymentType === 'nomina' ? (
                <>
                    <div>
                    <label htmlFor="baseSalary" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Sueldo Básico Mensual</label>
                    <input type="number" id="baseSalary" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} placeholder="1500000" className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700 font-bold"/>
                    </div>
                    <div className="md:col-span-2 lg:col-span-2">
                        <button onClick={handleLoadDays} className="w-full bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                            Cargar Asistencia y Ventas
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div>
                    <label htmlFor="manualAmount" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Monto a Pagar</label>
                    <input type="number" id="manualAmount" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="Monto $" className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700 font-bold"/>
                    </div>
                    <div className="md:col-span-2 lg:col-span-2">
                        <button onClick={handleLoadDays} className="w-full bg-accent text-white font-bold py-2 px-6 rounded-lg hover:bg-accent-hover transition-colors shadow-md">
                            Preparar Comprobante de Pago
                        </button>
                    </div>
                </>
            )}
          </div>
        </div>

        {loginDays.length > 0 && paymentType === 'nomina' && (
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-text-light mb-2">Seleccionar Días Trabajados</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
              {loginDays.map(day => (
                <label key={day.date} className="flex flex-col p-3 bg-white dark:bg-secondary rounded-lg cursor-pointer border-2 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">{new Date(day.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <input type="checkbox" checked={day.checked} onChange={() => handleToggleDay(day.date)} className="h-4 w-4 rounded text-accent focus:ring-accent"/>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-text-dark mt-1 font-bold">{day.unitsSold} uds vendidas</span>
                  {day.startTime ? (
                    <span className="text-[10px] text-blue-400 mt-1 font-mono">
                        {day.startTime === day.endTime ? day.startTime : `${day.startTime} - ${day.endTime}`}
                    </span>
                  ) : (
                    day.unitsSold > 0 && (
                        <span className="text-[10px] text-yellow-500 mt-1 italic">(Ventas sin login)</span>
                    )
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-center mt-4">
              <button onClick={handleCalculate} className="bg-accent text-white font-black py-3 px-12 rounded-xl transition-all duration-300 hover:scale-105 hover:bg-accent-hover shadow-lg shadow-accent/20 active:scale-95">
                GENERAR PRE-NÓMINA
              </button>
            </div>
          </div>
        )}

        {result && (
            <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg animate-fade-in mt-8 border-2 border-accent/20">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 underline decoration-accent">
                {result.paymentType === 'nomina' ? 'Liquidación de Nómina' : (result.paymentType === 'admin' ? 'Pago Salario Administrativo' : 'Entrega de Utilidades')} para: {result.sellerName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-text-dark mb-6">Periodo: <span className="font-mono">{result.period}</span></p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    {result.paymentType === 'nomina' ? (
                        <>
                            <h4 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-3">Detalle de Ventas</h4>
                            <div className="overflow-x-auto max-h-96 border border-gray-200 dark:border-gray-700 rounded-lg shadow-inner">
                                <table className="w-full text-left"><thead className="bg-gray-100 dark:bg-gray-800 sticky top-0"><tr><th className="p-2 text-xs font-black uppercase">Fecha</th><th className="p-2 text-xs font-black uppercase text-center">Vtas</th><th className="p-2 text-xs font-black uppercase text-right">Comisión</th></tr></thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{result.dailyBreakdown.map((day, index) => (<tr key={index} className="hover:bg-accent/5"><td className="p-2 text-xs font-medium">{day.date}</td><td className="p-2 text-center text-xs font-black text-accent">{day.unitsSold}</td><td className={`p-2 text-right text-xs font-bold text-green-600`}>{formatCOP(day.commissionEarned)}</td></tr>))
                                }</tbody></table>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-800/20 rounded-2xl p-8 text-center border border-dashed border-gray-200 dark:border-gray-700">
                            <div className="p-4 bg-accent/10 rounded-full mb-4">
                                {result.paymentType === 'admin' ? <ShieldCheckIcon className="w-12 h-12 text-accent"/> : <DollarIcon className="w-12 h-12 text-accent"/>}
                            </div>
                            <h4 className="text-lg font-black text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-tighter">Resumen Directo</h4>
                            <p className="text-sm text-gray-500">Este es un registro de pago manual para personal administrativo o retiro de utilidades de socios.</p>
                        </div>
                    )}
                </div>
                <div className="space-y-6">
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                        {result.paymentType === 'nomina' ? (
                            <>
                                <div className="flex justify-between items-center text-sm font-bold"><span className="text-gray-500">Días Trabajados ({result.daysWorked}):</span><span className="text-gray-800 dark:text-text-light">{formatCOP(result.adjustedBase)}</span></div>
                                <div className="flex justify-between items-center text-sm font-bold"><span className="text-gray-500">Total Comisiones ({result.totalUnitsSold} uds):</span><span className="text-green-600 font-black">{formatCOP(result.commissionAmount)}</span></div>
                            </>
                        ) : (
                            <div className="flex justify-between items-center text-sm font-bold"><span className="text-gray-500">Monto Base de Pago:</span><span className="text-gray-800 dark:text-text-light">{formatCOP(result.adjustedBase)}</span></div>
                        )}
                        <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 my-2"></div>
                        <div className="flex justify-between items-center text-xl font-black pt-2"><span className="text-gray-800 dark:white">Subtotal:</span><span className="text-accent">{formatCOP(result.totalToPay)}</span></div>
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-2xl border border-green-100 dark:border-green-800/30">
                        <h4 className="text-sm font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-3">Bonificaciones (+)</h4>
                        <div className="space-y-2 mb-3">
                            {bonuses.map((b, i) => (<div key={i} className="flex justify-between items-center text-sm"><span className="text-green-600 dark:text-green-500 font-medium">{b.reason}</span><div className="flex items-center gap-2"><span className="font-black text-green-600">+{formatCOP(b.amount)}</span><button onClick={() => setBonuses(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:scale-110 transition-transform"><TrashIcon className="w-4 h-4"/></button></div></div>))}
                        </div>
                        <div className="flex gap-2 items-end"><input type="text" placeholder="Concepto Bono" value={newBonus.reason} onChange={e => setNewBonus(p => ({...p, reason: e.target.value}))} className="w-full bg-white dark:bg-primary p-2 rounded-lg text-sm border focus:ring-accent"/><input type="number" placeholder="$" value={newBonus.amount} onChange={e => setNewBonus(p => ({...p, amount: e.target.value}))} className="w-24 bg-white dark:bg-primary p-2 rounded-lg text-sm border"/><button onClick={handleAddBonus} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 shadow-md"><PlusCircleIcon className="w-5 h-5"/></button></div>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-800/30">
                        <h4 className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-3">Descuentos (-)</h4>
                        <div className="space-y-2 mb-3">
                            {deductions.map((d, i) => (<div key={i} className="flex justify-between items-center text-sm"><span className="text-red-600 dark:text-red-500 font-medium">{d.reason}</span><div className="flex items-center gap-2"><span className="font-black text-red-600">-{formatCOP(d.amount)}</span><button onClick={() => setDeductions(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:scale-110 transition-transform"><TrashIcon className="w-4 h-4"/></button></div></div>))}
                        </div>
                        <div className="flex gap-2 items-end"><input type="text" placeholder="Razón Descuento" value={newDeduction.reason} onChange={e => setNewDeduction(p => ({...p, reason: e.target.value}))} className="w-full bg-white dark:bg-primary p-2 rounded-lg text-sm border"/><input type="number" placeholder="$" value={newDeduction.amount} onChange={e => setNewDeduction(p => ({...p, amount: e.target.value}))} className="w-24 bg-white dark:bg-primary p-2 rounded-lg text-sm border"/><button onClick={handleAddDeduction} className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 shadow-md"><PlusCircleIcon className="w-5 h-5"/></button></div>
                    </div>

                    <div className="bg-accent p-6 rounded-2xl shadow-xl shadow-accent/20">
                         <div className="flex justify-between items-center text-white mb-4">
                            <span className="text-lg font-black uppercase tracking-tighter">NETO A PAGAR:</span>
                            <span className="text-3xl font-black">{formatCOP(result.totalToPay + totalBonuses - totalDeductions)}</span>
                        </div>
                        <button onClick={handleRegisterPayment} disabled={isSaving} className="w-full bg-white text-accent font-black py-4 rounded-xl hover:bg-gray-100 transition-all shadow-lg active:scale-95 uppercase tracking-widest disabled:opacity-50">
                            {isSaving ? 'REGISTRANDO...' : 'REGISTRAR PAGO EN SISTEMA'}
                        </button>
                    </div>
                </div>
            </div>
            </div>
        )}
      </div>

      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Historial de Pagos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative md:col-span-1"><input type="text" placeholder="Buscar por destinatario..." value={historySearchTerm} onChange={e => setHistorySearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10"/><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>{historySearchTerm && (<button onClick={() => setHistorySearchTerm('')} className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white" aria-label="Limpiar búsqueda"><CrossIcon className="w-5 h-5" /></button>)}</div>
            <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2" />
            <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2" />
        </div>
        <div className="space-y-4">
            {filteredHistory.length > 0 ? filteredHistory.map(record => {
                const totalDed = record.totalDeductions || 0;
                const totalBon = record.totalBonuses || 0;
                const typeLabel = record.paymentType === 'nomina' ? 'NÓMINA' : (record.paymentType === 'admin' ? 'ADMIN' : 'UTILIDAD');
                const typeColor = record.paymentType === 'nomina' ? 'bg-blue-100 text-blue-600' : (record.paymentType === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600');

                return (
                <div key={record.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors border border-transparent hover:border-accent/20">
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedHistoryId(expandedHistoryId === record.id ? null : record.id)}>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest ${typeColor}`}>{typeLabel}</span>
                                <p className="font-black text-lg text-gray-900 dark:text-white leading-none">{record.sellerName}</p>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-text-dark">Periodo: {record.period}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Pagado el {new Date(record.paidAt).toLocaleString()} por {record.paidBy}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-2xl font-black text-accent">{formatCOP(record.totalToPay)}</p>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setReceiptToShow(record); }} 
                                className="p-2 bg-green-500/10 text-green-500 rounded-full hover:bg-green-500 hover:text-white transition-all"
                                title="Reenviar Comprobante"
                            >
                                <WhatsAppIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                    {expandedHistoryId === record.id && (
                        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700 text-sm animate-fade-in">
                             <div className="space-y-2 bg-white dark:bg-gray-900/50 p-4 rounded-xl shadow-inner border border-gray-100 dark:border-gray-800">
                                <h4 className="font-black text-center mb-3 text-gray-400 text-xs uppercase tracking-widest">Resumen del Pago</h4>
                                {record.paymentType === 'nomina' ? (
                                    <>
                                        <div className="flex justify-between"><span>Sueldo Base Ajustado ({record.daysWorked} días):</span> <span>{formatCOP(record.adjustedBase)}</span></div>
                                        <div className="flex justify-between"><span>Comisiones ({record.totalUnitsSold} uds):</span> <span className="text-green-600 font-bold">{formatCOP(record.commissionAmount)}</span></div>
                                    </>
                                ) : (
                                    <div className="flex justify-between"><span>Monto Principal:</span> <span>{formatCOP(record.adjustedBase)}</span></div>
                                )}
                                {totalBon > 0 && <div className="flex justify-between text-blue-500 font-bold"><span>Bonificaciones:</span> <span>+{formatCOP(totalBon)}</span></div>}
                                {totalDed > 0 && <div className="flex justify-between text-red-500 font-bold"><span>Descuentos:</span> <span>-{formatCOP(totalDed)}</span></div>}
                                <div className="flex justify-between font-black text-lg pt-3 border-t-2 border-dashed border-gray-100 dark:border-gray-800"><span>TOTAL PAGADO:</span> <span className="text-accent">{formatCOP(record.totalToPay)}</span></div>
                                {record.loginAccesses && record.loginAccesses.length > 0 && record.paymentType === 'nomina' && (
                                  <div className="pt-3 border-t mt-2"><p className="text-[10px] font-black uppercase text-gray-400 mb-1">Días Validados:</p><p className="text-xs text-gray-500">{record.loginAccesses.map(l => {
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
            )}) : <p className="text-center text-gray-500 dark:text-text-dark py-10 italic">No se han registrado pagos para el criterio de búsqueda.</p>}
        </div>
      </div>
      
      {receiptToShow && (
          <PayrollReceiptModal 
            receipt={receiptToShow} 
            store={currentStore} 
            onClose={() => setReceiptToShow(null)} 
          />
      )}
    </div>
  );
};

export default PayrollView;
