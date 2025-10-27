import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Seller, PaymentMethod, DailyNote, Layaway, Incident, IncidentType } from '../types';
import { formatCOP } from '../constants';
import { PlusCircleIcon } from './Icons';

interface DailySalesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  layaways: Layaway[];
  sellers: Seller[];
  dailyNotes: DailyNote[];
  incidents: Incident[];
  onAddDailyNote: (content: string, seller: string) => void;
  saleDate: Date;
  isAdmin: boolean;
}

const toYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};


const DailySalesReportModal: React.FC<DailySalesReportModalProps> = ({ isOpen, onClose, sales, layaways, sellers, dailyNotes, incidents, onAddDailyNote, saleDate, isAdmin }) => {
  const [newNote, setNewNote] = useState('');
  const [noteSeller, setNoteSeller] = useState('');
  const [reportDate, setReportDate] = useState(saleDate);

  useEffect(() => {
    if (isOpen) {
        setReportDate(saleDate);
    }
  }, [isOpen, saleDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    if (dateString) {
      const [year, month, day] = dateString.split('-').map(Number);
      // Create a new Date object in the user's local timezone.
      // Set time to noon to avoid any weird DST/timezone-boundary issues.
      setReportDate(new Date(year, month - 1, day, 12, 0, 0));
    }
  };

  const isWithinDay = useMemo(() => {
    const reportDateStart = new Date(reportDate);
    reportDateStart.setHours(0, 0, 0, 0);
    const startTimestamp = reportDateStart.getTime();

    const reportDateEnd = new Date(reportDate);
    reportDateEnd.setHours(23, 59, 59, 999);
    const endTimestamp = reportDateEnd.getTime();

    return (dateString: string) => {
        if (!dateString) return false;
        // The dateString from the database is an ISO string (UTC).
        // .getTime() gives the UTC epoch milliseconds, which is what we need for a direct comparison.
        const transactionTimestamp = new Date(dateString).getTime();
        return transactionTimestamp >= startTimestamp && transactionTimestamp <= endTimestamp;
    };
  }, [reportDate]);

  const reportData = useMemo(() => {
    const allTodaysSales = sales.filter(sale => isWithinDay(sale.createdAt));
    const allTodaysNewLayaways = layaways.filter(layaway => isWithinDay(layaway.createdAt) && layaway.status !== 'pre-order');

    const allTodaysLayawayPayments = layaways.flatMap(layaway =>
        layaway.payments.filter(p => isWithinDay(p.date)).map(p => ({
            ...p,
            layawayId: layaway.id,
            seller: p.seller || layaway.seller,
        }))
    );
    
    const todaysCashAdjustments = incidents.filter(i => 
        isWithinDay(i.createdAt) &&
        (i.type === IncidentType.CASH_ADJUSTMENT || i.type === IncidentType.RECAUDO)
    );

    const incomeAdjustments = todaysCashAdjustments
        .filter(i => {
            const isIncomeType = i.adjustmentType === 'income' || i.type === IncidentType.RECAUDO;
            if (!isIncomeType) return false;
            // If a payment method is specified, it MUST be cash. If not specified (legacy), assume it's a cash transaction.
            return i.paymentMethod ? i.paymentMethod === PaymentMethod.Efectivo : true;
        })
        .reduce((sum, i) => sum + (i.adjustmentAmount || 0), 0);
    
    const expenseAdjustments = todaysCashAdjustments
        .filter(i => i.adjustmentType === 'expense')
        .reduce((sum, i) => sum + (i.adjustmentAmount || 0), 0);

    // --- Per-Seller Breakdown Logic (for display purposes) ---
    const reportBySeller = sellers.reduce((acc, seller) => {
        acc[seller.name] = {
            totalCashSales: 0,
            totalCashLayaways: 0,
            totalUnitsSold: 0,
        };
        return acc;
    }, {} as Record<string, {
        totalCashSales: number,
        totalCashLayaways: number,
        totalUnitsSold: number,
    }>);

    allTodaysSales
      .filter(sale => !sale.layawayId)
      .forEach(sale => {
        const sellerReport = reportBySeller[sale.seller];
        if (sellerReport) {
            if (sale.payments && sale.payments.length > 0) {
                const cashAmount = sale.payments
                    .filter(p => p.method === PaymentMethod.Efectivo)
                    .reduce((sum, p) => sum + p.amount, 0);
                sellerReport.totalCashSales += cashAmount;
            } else if (sale.paymentMethod === PaymentMethod.Efectivo) { // Fallback for legacy
                sellerReport.totalCashSales += sale.totalAmount;
            }
        }
      });

    allTodaysLayawayPayments
        .filter(p => p.method === PaymentMethod.Efectivo)
        .forEach(payment => {
            const sellerReport = reportBySeller[payment.seller];
            if (sellerReport) {
                sellerReport.totalCashLayaways += payment.amount;
            }
        });

    const directSalesForUnits = allTodaysSales.filter(sale => !sale.layawayId);
    
    [...directSalesForUnits, ...allTodaysNewLayaways].forEach(transaction => {
        const sellerReport = reportBySeller[transaction.seller];
        if (sellerReport) {
            sellerReport.totalUnitsSold += transaction.items.reduce((sum, item) => sum + item.quantity, 0);
        }
    });
    
    const activeSellers = Object.entries(reportBySeller)
        .filter(([, data]) => {
            const d = data as { totalCashSales: number, totalCashLayaways: number, totalUnitsSold: number };
            return d.totalCashSales > 0 || d.totalCashLayaways > 0 || d.totalUnitsSold > 0
        })
        .map(([sellerName, data]) => ({ sellerName, ...(data as { totalCashSales: number, totalCashLayaways: number, totalUnitsSold: number }) }));

    // --- Direct Grand Total Calculation (for accuracy) ---
    const grandTotalCashSales = allTodaysSales
      .filter(sale => !sale.layawayId)
      .reduce((total, sale) => {
        let cashInThisSale = 0;
        if (sale.payments && sale.payments.length > 0) {
          cashInThisSale = sale.payments
            .filter(p => p.method === PaymentMethod.Efectivo)
            .reduce((sum, p) => sum + p.amount, 0);
        } else if (sale.paymentMethod === PaymentMethod.Efectivo) { // Legacy fallback
          cashInThisSale = sale.totalAmount;
        }
        return total + cashInThisSale;
      }, 0);

    const grandTotalCashLayaways = allTodaysLayawayPayments
        .filter(p => p.method === PaymentMethod.Efectivo)
        .reduce((sum, p) => sum + p.amount, 0);

    const grandTotalUnitsSold = [...allTodaysSales.filter(s => !s.layawayId), ...allTodaysNewLayaways]
        .flatMap(t => t.items)
        .reduce((sum, item) => sum + (item?.quantity || 0), 0);
        
    const grandTotals = {
        totalCashSales: grandTotalCashSales,
        totalCashLayaways: grandTotalCashLayaways,
        totalUnitsSold: grandTotalUnitsSold,
        incomeAdjustments: incomeAdjustments,
        expenseAdjustments: expenseAdjustments,
    };

    return { activeSellers, grandTotals, todaysCashAdjustments };
  }, [sales, layaways, sellers, incidents, isWithinDay]);

  const todaysSoldItems = useMemo(() => {
    const directSales = sales.filter(sale => isWithinDay(sale.createdAt) && !sale.layawayId);
    const newLayaways = layaways.filter(l => isWithinDay(l.createdAt) && l.status !== 'pre-order');
    const allTransactions = [...directSales, ...newLayaways];

    const itemsMap = new Map<string, { name: string, quantity: number, supplier?: string }>();

    allTransactions.forEach(transaction => {
        (transaction.items || []).forEach(item => {
            if (!item) return;
            const existing = itemsMap.get(item.id);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                itemsMap.set(item.id, { name: item.name, quantity: item.quantity, supplier: item.supplier });
            }
        });
    });

    return Array.from(itemsMap.values()).sort((a, b) => b.quantity - a.quantity);
  }, [sales, layaways, isWithinDay]);


  const todaysNotes = useMemo(() => {
    return dailyNotes.filter(note => isWithinDay(note.createdAt));
  }, [dailyNotes, isWithinDay]);

  const handleAddNote = () => {
    onAddDailyNote(newNote, noteSeller);
    setNewNote('');
    setNoteSeller('');
  };
  
  const todayFormatted = reportDate.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-3xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row justify-between sm:items-center">
            <div>
                <h2 className="text-2xl font-bold text-accent mb-1">Reporte de Caja</h2>
                <p className="text-gray-500 dark:text-text-dark pb-2">{todayFormatted}</p>
            </div>
            {isAdmin && (
                <div>
                    <label htmlFor="reportDate" className="block text-xs font-medium text-gray-500 dark:text-text-dark mb-1">Seleccionar Fecha</label>
                    <input
                        type="date"
                        id="reportDate"
                        value={toYYYYMMDD(reportDate)}
                        onChange={handleDateChange}
                        className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md py-1 px-3 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                    />
                </div>
            )}
        </div>
        <p className="text-sm text-center text-gray-500 dark:text-text-dark mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 -mt-2">Resumen de movimientos en EFECTIVO y Novedades de Caja para la fecha seleccionada.</p>
        
        <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Resumen por Vendedor</h3>
                {reportData.activeSellers.length > 0 ? (
                    reportData.activeSellers.map(report => (
                        <div key={report.sellerName} className="p-3 bg-white dark:bg-secondary rounded-md">
                            <p className="font-bold text-accent text-lg">{report.sellerName}</p>
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span>Ventas en Efectivo:</span>
                                    <span className="font-semibold">{formatCOP(report.totalCashSales)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Abonos en Efectivo:</span>
                                    <span className="font-semibold">{formatCOP(report.totalCashLayaways)}</span>
                                </div>
                            </div>
                             <div className="mt-2 pt-2 border-t-2 border-dashed border-accent/30">
                                <div className="flex justify-between font-bold text-gray-800 dark:text-text-light">
                                    <span>Unidades Vendidas (Total):</span>
                                    <span>{report.totalUnitsSold}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 dark:text-text-dark py-4">No hay actividad registrada para esta fecha.</p>
                )}
                 <div className="mt-4 pt-4 border-t-2 border-accent/30 font-bold text-lg space-y-2">
                    <h4 className="text-center mb-2">TOTAL EFECTIVO DEL DÍA</h4>
                     <div className="text-sm space-y-2">
                        <div className="flex justify-between pl-2">
                            <span>Total Ventas Efectivo:</span> <span className="font-semibold">{formatCOP(reportData.grandTotals.totalCashSales)}</span>
                        </div>
                        <div className="flex justify-between pl-2">
                            <span>Total Abonos Efectivo:</span> <span className="font-semibold">{formatCOP(reportData.grandTotals.totalCashLayaways)}</span>
                        </div>
                    </div>
                     <div className="text-center mt-4 pt-2 border-t border-gray-300 dark:border-gray-600 space-y-1">
                        <p className="text-sm text-green-500">Ingresos Extra (Caja): +{formatCOP(reportData.grandTotals.incomeAdjustments)}</p>
                        <p className="text-sm text-red-500">Gastos/Salidas (Caja): -{formatCOP(reportData.grandTotals.expenseAdjustments)}</p>
                        <p className="text-accent text-xl">Total Neto en Caja: {formatCOP(
                            reportData.grandTotals.totalCashSales +
                            reportData.grandTotals.totalCashLayaways +
                            reportData.grandTotals.incomeAdjustments -
                            reportData.grandTotals.expenseAdjustments
                        )}</p>
                         <p className="text-sm text-gray-800 dark:text-text-light">Unidades Vendidas (Total): {reportData.grandTotals.totalUnitsSold}</p>
                    </div>
                 </div>
                 <div className="mt-4 pt-4 border-t-2 border-accent/30">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-text-light mb-2">Resumen de Unidades Vendidas</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {todaysSoldItems.length > 0 ? (
                        todaysSoldItems.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm bg-white dark:bg-secondary p-2 rounded">
                            <div>
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-xs text-gray-400">{item.supplier || 'N/A'}</p>
                            </div>
                            <p className="font-bold text-accent">{item.quantity} uds</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-sm text-gray-500 dark:text-text-dark">No se vendieron unidades en esta fecha.</p>
                      )}
                    </div>
                </div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Novedades y Ajustes de Caja</h3>
                <div className="space-y-2 mb-4">
                  <select value={noteSeller} onChange={e => setNoteSeller(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700">
                    <option value="">Selecciona quién autoriza</option>
                    {sellers.filter(s => !s.isDisabled).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Escribe una novedad..." rows={2} className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700"></textarea>
                  <button onClick={handleAddNote} disabled={!newNote.trim() || !noteSeller} className="w-full bg-accent text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover disabled:bg-gray-600">
                    <PlusCircleIcon /><span>Agregar Novedad</span>
                  </button>
                </div>
                 {reportData.todaysCashAdjustments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold mb-2">Ajustes y Recaudos de Caja Registrados:</h4>
                        <div className="space-y-2 max-h-24 overflow-y-auto">
                            {reportData.todaysCashAdjustments.map(adj => (
                                <div key={adj.id} className="p-2 bg-white dark:bg-secondary rounded-md text-sm">
                                    <div className="flex justify-between items-center">
                                        <p className={`font-bold ${adj.adjustmentType === 'income' || adj.type === IncidentType.RECAUDO ? 'text-green-500' : 'text-red-500'}`}>
                                            {adj.type === IncidentType.RECAUDO ? 'RECAUDO' : (adj.adjustmentType === 'income' ? 'INGRESO' : 'GASTO')}: {formatCOP(adj.adjustmentAmount || 0)}
                                        </p>
                                        <span className="text-xs text-gray-400">Por: {adj.sellerName}</span>
                                    </div>
                                    <p className="text-gray-600 dark:text-text-dark text-xs">{adj.description}</p>
                                     {adj.type === IncidentType.RECAUDO && <p className="text-xs text-gray-500">Cliente: {adj.customerName}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {todaysNotes.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold mb-2">Novedades Generales:</h4>
                        {todaysNotes.map(note => (
                            <div key={note.id} className="p-2 bg-white dark:bg-secondary rounded-md text-sm">
                                <div className="flex justify-between items-center text-xs mb-1">
                                    <p className="font-semibold text-accent">Autoriza: {note.seller}</p>
                                    <p className="text-gray-500 dark:text-text-dark">{new Date(note.createdAt).toLocaleString('es-CO', { hour: 'numeric', minute: 'numeric', hour12: true })}</p>
                                </div>
                                <p className="text-gray-800 dark:text-text-light">{note.content}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-500 dark:text-text-dark py-2">No hay novedades generales registradas.</p>
                )}
            </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-text-light font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default DailySalesReportModal;