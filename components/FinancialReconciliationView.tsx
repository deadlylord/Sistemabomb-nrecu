
import React, { useState, useMemo, useEffect } from 'react';
import { FinancialRecord, Store, Sale, Layaway, PaymentMethod, Payment, Seller, Expense, Incident, IncidentType, View } from '../types';
import { formatCOP } from '../constants';
import { DollarIcon, BuildingStorefrontIcon, PlusCircleIcon, TrashIcon, CheckIcon, CrossIcon, SearchIcon, HistoryIcon, ChartBarIcon, PlusIcon, SparklesIcon, AlertTriangleIcon, SwapIcon, TagIcon, EditIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, SettingsIcon } from './Icons';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';

interface FinancialReconciliationViewProps {
  stores: Store[];
  sales: Sale[];
  layaways: Layaway[];
  expenses: Expense[];
  incidents: Incident[];
  currentUser: Seller;
  onNavigate?: (view: View) => void;
}

type AccountType = 'cash' | 'qr' | 'bank';

interface ManualEntry {
    tempId: string;
    date: string;
    time: string; 
    amount: string; 
    description: string;
    accountType: AccountType;
    subCategory: string;
    debtStoreId?: string;
    mirrorCategory?: string; 
    affectsMirrorBalance: boolean; 
}

interface PaymentSummaryData {
    targetStoreId: string;
    targetStoreName: string;
    amount: number;
    sourceAccount: AccountType;
    debtReferenceDates: string; 
}

const AUTO_CATEGORIES: Record<string, string[]> = {
    'Servicios': ['luz', 'agua', 'gas', 'internet', 'claro', 'tigo', 'movistar', 'energia', 'vanti', 'acueducto'],
    'Local/Arriendo': ['arriendo', 'canon', 'administracion', 'local', 'alquiler'],
    'Personal': ['nomina', 'sueldo', 'pago', 'bono', 'comision', 'auxilio'],
    'Mantenimiento': ['arreglo', 'reparacion', 'pintura', 'limpieza', 'aseo', 'insumos', 'bombillo'],
    'Papelería/Bolsas': ['bolsas', 'papel', 'lapicero', 'impresion', 'cinta', 'empaque'],
    'Logística': ['transporte', 'flete', 'domicilio', 'envio', 'servientrega', 'interrapidisimo', 'uber', 'taxi'],
    'Mercancía/Compras': ['mercancia', 'prendas', 'ropa', 'pedido', 'compra', 'lote', 'proveedor'],
    'Otros': []
};

const FinancialReconciliationView: React.FC<FinancialReconciliationViewProps> = ({ stores, sales, layaways, expenses, incidents, currentUser, onNavigate }) => {
  const [activeStoreId, setActiveStoreId] = useState<string>(currentUser.storeId || stores[0]?.id || '');
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [activeTab, setActiveTab] = useState<AccountType>('cash');
  const [searchTerm, setSearchTerm] = useState('');
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isSystemLoadsOpen, setIsSystemLoadsOpen] = useState(true);
  const [isDebtsSectionOpen, setIsDebtsSectionOpen] = useState(true);
  const [expandedDebtStoreId, setExpandedDebtStoreId] = useState<string | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummaryData | null>(null);

  const activeStore = useMemo(() => stores.find(s => s.id === activeStoreId), [activeStoreId, stores]);
  const isAdmin = currentUser.roleId === '1';

  const years = useMemo(() => {
    const currentY = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentY - 2 + i);
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  
  const [editingRecord, setEditingRecord] = useState<(FinancialRecord & { amountString?: string, timeString?: string }) | null>(null);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  useEffect(() => {
    if (!activeStoreId) return;
    const q = query(collection(db, 'financialRecords'), where('storeId', '==', activeStoreId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FinancialRecord));
        // ORDEN CRONOLÓGICO ESTRICTO: Más reciente primero utilizando timestamp numérico
        setRecords(list.sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            return timeB - timeA || b.id.localeCompare(a.id);
        }));
    });
    return () => unsubscribe();
  }, [activeStoreId]);

  const autoCategorize = (desc: string): string => {
      const lowerDesc = desc.toLowerCase();
      for (const [cat, keywords] of Object.entries(AUTO_CATEGORIES)) {
          if (keywords.some(k => lowerDesc.includes(k))) return cat;
      }
      return 'Otros';
  };

  const categoryExpensesStats = useMemo(() => {
      const stats: Record<string, number> = {};
      const startOfMonth = new Date(selectedYear, selectedMonth, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      records.forEach(r => {
          const d = new Date(r.date);
          if (d >= startOfMonth && d <= endOfMonth && r.amount < 0 && r.subCategory !== 'Cruce Sedes') {
              const cat = r.subCategory || 'Sin Categoría';
              stats[cat] = (stats[cat] || 0) + Math.abs(r.amount);
          }
      });

      return Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }));
  }, [records, selectedMonth, selectedYear]);

  // Lógica de Balances entre sedes con ORDEN CRONOLÓGICO ESTRICTO
  const interStoreBalances = useMemo(() => {
      const balances: Record<string, { total: number, cash: number, qr: number, bank: number, storeId: string, history: FinancialRecord[] }> = {};
      
      records.forEach(r => {
          if (r.debtStoreId) {
              const otherStoreId = r.debtStoreId;
              if (!balances[otherStoreId]) {
                  balances[otherStoreId] = { total: 0, cash: 0, qr: 0, bank: 0, storeId: otherStoreId, history: [] };
              }

              let netImpact = 0;
              if (r.subCategory === 'Préstamo a Sede' || r.subCategory === 'Cruce Sedes') {
                  netImpact = -r.amount; 
              } else {
                  netImpact = r.amount; 
              }

              balances[otherStoreId].total += netImpact;
              balances[otherStoreId].history.push({ ...r, netImpact } as any);

              if (r.accountType === 'cash') balances[otherStoreId].cash += netImpact;
              else if (r.accountType === 'qr') balances[otherStoreId].qr += netImpact;
              else if (r.accountType === 'bank') balances[otherStoreId].bank += netImpact;
          }
      });

      return Object.entries(balances).map(([otherStoreId, stats]) => ({
          otherStoreName: stores.find(s => s.id === otherStoreId)?.name || 'Local',
          storeId: otherStoreId,
          ...stats,
          // Orden cronológico: Más reciente primero (Time-based sort)
          history: stats.history.sort((a, b) => {
              const timeA = new Date(a.date).getTime();
              const timeB = new Date(b.date).getTime();
              return timeB - timeA || b.id.localeCompare(a.id);
          })
      })).filter(s => Math.abs(s.total) > 0.1);
  }, [records, stores]);

  const globalDebtsSummary = useMemo(() => {
      let toCollect = 0;
      let toPay = 0;
      interStoreBalances.forEach(b => {
          if (b.total > 0) toCollect += b.total;
          else toPay += Math.abs(b.total);
      });
      return { toCollect, toPay };
  }, [interStoreBalances]);

  const dailySystemTotals = useMemo(() => {
    const totalsMap = new Map<string, { cash: number, qr: number, bank: number, date: string, details: string[] }>();
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

    const getExisting = (dateStr: string) => {
        return totalsMap.get(dateStr) || { cash: 0, qr: 0, bank: 0, date: dateStr, details: [] };
    }

    const processPayment = (p: Payment) => {
        const pDate = new Date(p.date);
        if (pDate < startOfMonth || pDate > endOfMonth) return;
        const dateStr = p.date.split('T')[0];
        const existing = getExisting(dateStr);
        if (p.method === PaymentMethod.Efectivo) existing.cash += (Number(p.amount) || 0);
        else if ([PaymentMethod.Nequi, PaymentMethod.Daviplata, PaymentMethod.QR].includes(p.method)) existing.qr += (Number(p.amount) || 0);
        else if ([PaymentMethod.Tarjeta, PaymentMethod.Sistecredito, PaymentMethod.Addi].includes(p.method)) existing.bank += (Number(p.amount) || 0);
        totalsMap.set(dateStr, existing);
    };

    sales.filter(s => s.storeId === activeStoreId).forEach(sale => {
        const payments = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})) as Payment[];
        if (payments.length > 0) payments.forEach(processPayment);
        else if (sale.paymentMethod) processPayment({ amount: sale.totalAmount, method: sale.paymentMethod, date: sale.createdAt, seller: sale.seller });
    });

    layaways.filter(l => l.storeId === activeStoreId).forEach(layaway => {
        const payments = (Array.isArray(layaway.payments) ? layaway.payments : Object.values(layaway.payments || {})) as Payment[];
        payments.forEach(processPayment);
    });

    expenses.filter(e => e.storeId === activeStoreId && !e.isRecurring).forEach(expense => {
        const d = new Date(expense.date);
        if (d < startOfMonth || d > endOfMonth) return;
        const dateStr = expense.date.split('T')[0];
        const existing = getExisting(dateStr);
        existing.cash -= (Number(expense.amount) || 0);
        existing.details.push(`Gasto: ${expense.description} (-${formatCOP(expense.amount)})`);
        totalsMap.set(dateStr, existing);
    });

    incidents.filter(i => i.storeId === activeStoreId && i.adjustmentAmount && i.adjustmentAmount > 0).forEach(incident => {
        const d = new Date(incident.createdAt);
        if (d < startOfMonth || d > endOfMonth) return;
        const dateStr = incident.createdAt.split('T')[0];
        const existing = getExisting(dateStr);
        const amount = Number(incident.adjustmentAmount);
        const isExpense = incident.adjustmentType === 'expense';
        const finalAmount = isExpense ? -amount : amount;
        const method = incident.paymentMethod || PaymentMethod.Efectivo;
        if (method === PaymentMethod.Efectivo) existing.cash += finalAmount;
        else if ([PaymentMethod.Nequi, PaymentMethod.Daviplata, PaymentMethod.QR].includes(method)) existing.qr += finalAmount;
        else existing.bank += finalAmount;
        existing.details.push(`Ajuste ${incident.type}: ${isExpense ? '-' : '+'}${formatCOP(amount)}`);
        totalsMap.set(dateStr, existing);
    });

    return Array.from(totalsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, layaways, expenses, incidents, activeStoreId, selectedMonth, selectedYear]);

  const confirmDailyTotal = async (dateStr: string, amount: number, accountType: AccountType) => {
    const recordId = `daily_auto_${activeStoreId}_${accountType}_${dateStr}`;
    const existing = records.find(r => r.id === recordId);
    if (existing) {
        alert("Este total diario ya fue conciliado.");
        return;
    }
    let typeLabel = accountType === 'cash' ? "Efectivo" : (accountType === 'qr' ? "Bancolombia (QR)" : "Bancos / Otros");
    const dateTime = `${dateStr}T23:59:59`;
    const newRecord: FinancialRecord = {
        id: recordId,
        date: dateTime,
        storeId: activeStoreId,
        accountType: accountType as any,
        amount: amount,
        type: 'income_sales',
        description: `Cierre Diario ${typeLabel} (${dateStr})`,
        subCategory: 'Cierre Diario',
        registeredBy: currentUser.name,
        isConfirmed: true,
        affectsCashBalance: true
    };
    await setDoc(doc(db, 'financialRecords', recordId), newRecord);
  };

  const initialBalanceValue = useMemo(() => {
    if (!activeStore || !activeStore.initialBalances) return 0;
    return activeStore.initialBalances[activeTab] || 0;
  }, [activeStore, activeTab]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
        const matchesAccount = r.accountType === activeTab;
        const matchesSearch = r.description.toLowerCase().includes(searchTerm.toLowerCase()) || (r.subCategory && r.subCategory.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesAccount && matchesSearch;
    });
  }, [records, activeTab, searchTerm]);

  const currentBalance = useMemo(() => {
      const recordsSum = filteredRecords
        .filter(r => r.affectsCashBalance !== false)
        .reduce((sum, r) => sum + r.amount, 0);
      return initialBalanceValue + recordsSum;
  }, [filteredRecords, initialBalanceValue]);

  const recordsWithBalance = useMemo(() => {
    // Para calcular el saldo acumulado debemos ir de pasado a presente (ascendente) usando timestamps numéricos
    const sorted = [...filteredRecords].sort((a,b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return timeA - timeB || a.id.localeCompare(b.id);
    });

    let runningBalance = initialBalanceValue;
    return sorted.map(r => {
        if (r.affectsCashBalance !== false) {
            runningBalance += r.amount;
        }
        return { ...r, saldo: runningBalance };
    }).reverse(); // Revertimos para que la UI muestre de presente a pasado (más reciente arriba)
  }, [filteredRecords, initialBalanceValue]);

  const handleAddRow = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const newEntry: ManualEntry = {
        tempId: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0],
        time: currentTime,
        amount: '',
        description: '',
        accountType: activeTab,
        subCategory: '',
        debtStoreId: '',
        mirrorCategory: '',
        affectsMirrorBalance: false 
    };
    setManualEntries([...manualEntries, newEntry]);
  };

  const handlePreFillPayment = (targetStoreId: string, amount: number) => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const targetStoreName = stores.find(s => s.id === targetStoreId)?.name || '';
    
    const newEntry: ManualEntry = {
        tempId: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0],
        time: currentTime,
        amount: (-Math.abs(amount)).toString(), 
        description: `Pago saldo a sede ${targetStoreName}`,
        accountType: activeTab,
        subCategory: 'Cruce Sedes',
        debtStoreId: targetStoreId,
        mirrorCategory: 'Cruce Sedes',
        affectsMirrorBalance: true 
    };
    setManualEntries([...manualEntries, newEntry]);
    setShowAddModal(true);
  };

  const initiateSettlement = (targetStoreId: string, targetStoreName: string, amount: number, sourceAccount: AccountType, history: FinancialRecord[]) => {
      const lastDebtDate = history.length > 0 ? history[0].date.split('T')[0] : new Date().toISOString().split('T')[0];
      setPaymentSummary({
          targetStoreId,
          targetStoreName,
          amount: Math.abs(amount),
          sourceAccount,
          debtReferenceDates: lastDebtDate
      });
  };

  const handleConfirmSettlement = async () => {
      if (!paymentSummary) return;
      const { targetStoreId, targetStoreName, amount, sourceAccount, debtReferenceDates } = paymentSummary;

      try {
          const batch = writeBatch(db);
          const activeStoreName = activeStore?.name || 'Local Actual';
          const nowIso = new Date().toISOString();

          const mainRef = doc(collection(db, 'financialRecords'));
          const mainRecord: FinancialRecord = {
              id: mainRef.id,
              date: nowIso,
              storeId: activeStoreId,
              accountType: sourceAccount,
              amount: -amount,
              type: 'expense',
              description: `Saldar deuda de ref. ${debtReferenceDates} con ${targetStoreName}`,
              subCategory: 'Cruce Sedes',
              registeredBy: currentUser.name,
              isConfirmed: true,
              debtStoreId: targetStoreId,
              affectsCashBalance: true
          };

          const mirrorRef = doc(collection(db, 'financialRecords'));
          const mirrorRecord: FinancialRecord = {
              id: mirrorRef.id,
              date: nowIso,
              storeId: targetStoreId,
              accountType: sourceAccount, 
              amount: amount, 
              type: 'income_manual',
              description: `Recibo de pago deuda ref. ${debtReferenceDates} de ${activeStoreName}`,
              subCategory: 'Cruce Sedes',
              registeredBy: `${currentUser.name} (vía ${activeStoreName})`,
              isConfirmed: true,
              debtStoreId: activeStoreId,
              relatedRecordId: mainRef.id,
              affectsCashBalance: true
          };
          
          mainRecord.relatedRecordId = mirrorRef.id;

          batch.set(mainRef, mainRecord);
          batch.set(mirrorRef, mirrorRecord);

          await batch.commit();
          setPaymentSummary(null);
      } catch (error) {
          console.error("Error settling debt:", error);
          alert("Hubo un error al registrar el pago.");
      }
  };

  const parseInputToNumber = (val: string) => val.replace(/[^0-9-]/g, '');
  const formatInputDisplay = (val: string) => {
      if (!val) return '';
      if (val === '-') return '-';
      const num = parseInt(val, 10);
      if (isNaN(num)) return '';
      return num.toLocaleString('es-CO');
  };

  const handleUpdateEntryField = (tempId: string, field: keyof ManualEntry, value: any) => {
    setManualEntries(manualEntries.map(e => {
        if (e.tempId === tempId) {
            let finalValue = value;
            if (field === 'amount') {
                finalValue = parseInputToNumber(value);
            }
            const updated = { ...e, [field]: finalValue };
            if (field === 'description' && !e.subCategory) {
                updated.subCategory = autoCategorize(value);
                updated.mirrorCategory = updated.subCategory;
            }
            return updated;
        }
        return e;
    }));
  };

  const adjustEntryDate = (tempId: string, days: number) => {
      setManualEntries(manualEntries.map(e => {
          if (e.tempId === tempId) {
              const d = new Date(e.date + 'T12:00:00');
              d.setDate(d.getDate() + days);
              return { ...e, date: d.toISOString().split('T')[0] };
          }
          return e;
      }));
  };

  const handleSaveManualEntries = async () => {
    const validEntries = manualEntries.filter(e => e.amount && e.description);
    if (validEntries.length === 0) return;
    const batch = writeBatch(db);
    const activeStoreName = activeStore?.name || 'Local Actual';

    validEntries.forEach(e => {
        const totalAmountVal = parseFloat(e.amount);
        const type = totalAmountVal < 0 ? 'expense' : 'income_manual';
        const dateTime = `${e.date}T${e.time}:00`;

        const mainRef = doc(collection(db, 'financialRecords'));
        const mirrorRef = e.debtStoreId ? doc(collection(db, 'financialRecords')) : null;

        const mainRecord: FinancialRecord = {
            id: mainRef.id,
            date: dateTime,
            storeId: activeStoreId,
            accountType: e.accountType as any,
            amount: totalAmountVal,
            type: type as any,
            description: e.description,
            subCategory: e.debtStoreId && e.subCategory !== 'Cruce Sedes' ? 'Préstamo a Sede' : e.subCategory || 'Manual',
            registeredBy: currentUser.name,
            isConfirmed: true,
            affectsCashBalance: true, 
            debtStoreId: e.debtStoreId || undefined
        };

        if (mirrorRef) mainRecord.relatedRecordId = mirrorRef.id;
        batch.set(mainRef, mainRecord);

        if (mirrorRef && e.debtStoreId) {
            const mirrorAmount = e.subCategory === 'Cruce Sedes' ? -totalAmountVal : totalAmountVal;
            
            const mirrorRecord: FinancialRecord = {
                id: mirrorRef.id,
                date: dateTime,
                storeId: e.debtStoreId,
                accountType: e.accountType as any,
                amount: mirrorAmount,
                type: mirrorAmount < 0 ? 'expense' : 'income_manual',
                description: `${e.description} (Vía ${activeStoreName})`,
                subCategory: e.mirrorCategory || e.subCategory || 'Varios',
                registeredBy: `${currentUser.name} (vía ${activeStoreName})`,
                isConfirmed: true,
                debtStoreId: activeStoreId,
                relatedRecordId: mainRef.id,
                affectsCashBalance: e.affectsMirrorBalance 
            };
            batch.set(mirrorRef, mirrorRecord);
        }
    });
    await batch.commit();
    setShowAddModal(false);
    setManualEntries([]);
  };

  const handleOpenEdit = (record: FinancialRecord) => {
    const [date, time] = record.date.split('T');
    setEditingRecord({
        ...record,
        amountString: record.amount.toString(),
        timeString: time ? time.slice(0, 5) : '12:00'
    });
  };

  const handleUpdateSingleRecord = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingRecord) return;
      
      const { amountString, timeString, ...recordToSave } = editingRecord;
      if ('saldo' in recordToSave) delete (recordToSave as any).saldo;
      
      const amountVal = parseFloat(amountString || '0');
      const [datePart] = recordToSave.date.split('T');
      recordToSave.date = `${datePart}T${timeString}:00`;
      recordToSave.amount = amountVal;

      const recordRef = doc(db, 'financialRecords', recordToSave.id);
      await setDoc(recordRef, recordToSave, { merge: true });
      setEditingRecord(null);
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este registro del libro? Si es un préstamo, se recomienda eliminar también el registro espejo en la otra sede.")) {
        await deleteDoc(doc(db, 'financialRecords', id));
    }
  };

  const adjustEditingDate = (days: number) => {
      if (!editingRecord) return;
      const [datePart] = editingRecord.date.split('T');
      const d = new Date(datePart + 'T12:00:00');
      d.setDate(d.getDate() + days);
      setEditingRecord({ ...editingRecord, date: d.toISOString().split('T')[0] + 'T' + (editingRecord.timeString || '12:00') + ':00' });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-secondary p-6 rounded-2xl shadow-lg border-b-8" style={{ borderBottomColor: activeStore?.accentColor || '#ff007f' }}>
            <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-inner">
                    <ChartBarIcon className="w-10 h-10" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase leading-none">Conciliación Financiera</h2>
                    <p className="text-sm font-black text-accent uppercase tracking-widest mt-2 flex items-center gap-2">
                        <BuildingStorefrontIcon className="w-4 h-4" /> SEDE ACTUAL: <span className="text-gray-900 dark:text-white px-2 py-0.5 bg-accent/5 rounded border border-accent/20">{activeStore?.name}</span>
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {stores.map(s => (
                    <button 
                        key={s.id} 
                        onClick={() => setActiveStoreId(s.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all flex items-center gap-2 ${activeStoreId === s.id ? 'bg-accent text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-60 hover:opacity-100'}`}
                    >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.accentColor }}></div>
                        {s.name}
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-secondary p-5 rounded-2xl shadow-md border border-accent/20">
                <div 
                    onClick={() => setIsDebtsSectionOpen(!isDebtsSectionOpen)}
                    className="flex justify-between items-center cursor-pointer mb-4 group"
                >
                    <h3 className="text-sm font-black text-accent uppercase tracking-widest flex items-center gap-2">
                        <SwapIcon className="w-5 h-5" /> Saldos e Intercambios con otras Sedes
                    </h3>
                    <div className="flex items-center gap-3">
                        {globalDebtsSummary.toCollect > 0 && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                                POR COBRAR: {formatCOP(globalDebtsSummary.toCollect)}
                            </span>
                        )}
                        {globalDebtsSummary.toPay > 0 && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                POR PAGAR: {formatCOP(globalDebtsSummary.toPay)}
                            </span>
                        )}
                        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isDebtsSectionOpen ? 'rotate-180' : ''} group-hover:text-accent`} />
                    </div>
                </div>
                
                {isDebtsSectionOpen && (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide animate-fade-in">
                        {interStoreBalances.length > 0 ? interStoreBalances.map((item, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between ${item.total > 0 ? 'bg-green-50 dark:bg-green-900/10 border-green-200' : 'bg-red-50 dark:bg-red-900/10 border-red-200'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase">Estado con:</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase">{item.otherStoreName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Balance Neto:</p>
                                        <p className={`text-lg font-black ${item.total > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.total > 0 ? 'TE DEBE' : 'LE DEBES'} {formatCOP(Math.abs(item.total))}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="mt-2">
                                    <button 
                                        onClick={() => setExpandedDebtStoreId(expandedDebtStoreId === item.storeId ? null : item.storeId)}
                                        className="text-[9px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 w-full justify-center pt-1 border-t border-gray-100 dark:border-gray-700"
                                    >
                                        {expandedDebtStoreId === item.storeId ? 'Ocultar Detalles' : 'Ver Historial de Préstamos'}
                                        <ChevronDownIcon className={`w-3 h-3 transition-transform ${expandedDebtStoreId === item.storeId ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {expandedDebtStoreId === item.storeId && (
                                        <div className="mt-2 space-y-1 bg-white/50 dark:bg-black/20 p-2 rounded-lg animate-fade-in">
                                            {item.history.map(record => {
                                                const impact = (record as any).netImpact || 0;
                                                return (
                                                <div key={record.id} className="flex justify-between text-[10px] border-b border-gray-100 dark:border-gray-700 pb-1.5 last:border-0 items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-gray-400 font-black uppercase text-[8px]">{record.date.split('T')[0]} <span className="text-accent">{record.date.split('T')[1]?.slice(0, 5)}</span></span>
                                                        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[150px] font-bold">{record.description}</span>
                                                    </div>
                                                    <span className={`font-black text-sm ${impact > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {impact > 0 ? '+' : ''}{formatCOP(impact)} 
                                                    </span>
                                                </div>
                                            )})}
                                        </div>
                                    )}
                                </div>

                                {item.total < 0 && (
                                    <div className="mt-3 pt-3 border-t-2 border-dashed border-red-200 dark:border-red-900/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Saldar Deuda:</p>
                                            <button onClick={() => handlePreFillPayment(item.storeId, Math.abs(item.total))} className="text-[10px] text-accent font-bold hover:underline">Abono parcial...</button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => initiateSettlement(item.storeId, item.otherStoreName, Math.abs(item.total), 'cash', item.history)} className="flex-1 bg-white dark:bg-gray-800 text-green-600 text-[10px] font-black py-1.5 rounded-lg border border-green-200 shadow-sm hover:bg-green-50 transition-all active:scale-95">EFECTIVO</button>
                                            <button onClick={() => initiateSettlement(item.storeId, item.otherStoreName, Math.abs(item.total), 'qr', item.history)} className="flex-1 bg-white dark:bg-gray-800 text-blue-600 text-[10px] font-black py-1.5 rounded-lg border border-blue-200 shadow-sm hover:bg-blue-50 transition-all active:scale-95">QR</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )) : <p className="text-sm text-gray-400 italic text-center py-4">No hay préstamos ni saldos pendientes.</p>}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-secondary p-5 rounded-2xl shadow-md border border-accent/20">
                <h3 className="text-sm font-black text-accent uppercase tracking-widest flex items-center gap-2 mb-4">
                    <ChartBarIcon className="w-5 h-5" /> Gastos del Mes por Categoría
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                    {categoryExpensesStats.length > 0 ? (
                        categoryExpensesStats.map((cat, idx) => {
                            const maxVal = categoryExpensesStats[0].value;
                            const percentage = (cat.value / maxVal) * 100;
                            return (
                                <div key={idx} className="space-y-1">
                                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                                        <span className="text-gray-600 dark:text-gray-300">{cat.name}</span>
                                        <span className="text-accent">{formatCOP(cat.value)}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                        <div className="bg-accent h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 opacity-30">
                            <TagIcon className="w-12 h-12 mb-2" />
                            <p className="text-xs font-bold uppercase italic">Sin gastos registrados en este mes</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* SALDOS INICIALES */}
        <div className="bg-white dark:bg-secondary p-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <DollarIcon className="w-5 h-5 text-accent" /> Saldos de Apertura Actuales
                </h3>
                {isAdmin && (
                    <button 
                        onClick={() => onNavigate && onNavigate(View.SETTINGS)}
                        className="flex items-center gap-1 text-[10px] font-black text-accent uppercase hover:underline"
                    >
                        <SettingsIcon className="w-3.5 h-3.5" /> Ajustar iniciales
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Efectivo Inicial</p>
                    <p className="text-xl font-black text-gray-700 dark:text-white">{formatCOP(activeStore?.initialBalances?.cash || 0)}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Bancolombia (QR) Inicial</p>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">{formatCOP(activeStore?.initialBalances?.qr || 0)}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
                    <p className="text-[10px] font-black text-purple-400 uppercase mb-1">Otros Bancos Inicial</p>
                    <p className="text-xl font-black text-purple-600 dark:text-purple-400">{formatCOP(activeStore?.initialBalances?.bank || 0)}</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
                <div className="bg-white dark:bg-secondary p-5 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col h-full max-h-[800px]">
                    <div className="mb-4 flex flex-col gap-2">
                        <button 
                            onClick={() => setIsSystemLoadsOpen(!isSystemLoadsOpen)}
                            className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 hover:text-accent transition-colors w-full"
                        >
                            <HistoryIcon className="w-4 h-4 text-accent" /> 
                            Cierres de Caja (Cargas Sistema)
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isSystemLoadsOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        <div className="flex gap-2">
                             <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="flex-grow bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-xs font-bold outline-none">
                                {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-xs font-bold outline-none">
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {isSystemLoadsOpen && (
                        <div className="space-y-3 overflow-y-auto pr-2 scrollbar-hide animate-fade-in">
                            {dailySystemTotals.map((item) => {
                                const isCashConfirmed = records.some(r => r.id === `daily_auto_${activeStoreId}_cash_${item.date}`);
                                const isQrConfirmed = records.some(r => r.id === `daily_auto_${activeStoreId}_qr_${item.date}`);
                                return (
                                    <div key={item.date} className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl space-y-3">
                                        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                                            <p className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">{item.date}</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div><p className="text-[9px] font-black text-gray-400 uppercase">Efectivo:</p><p className={`text-sm font-black ${item.cash >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCOP(item.cash)}</p></div>
                                            <button onClick={() => confirmDailyTotal(item.date, item.cash, 'cash')} disabled={isCashConfirmed || item.cash === 0} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${isCashConfirmed ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-700 text-accent border border-accent/20'}`}>{isCashConfirmed ? <CheckIcon className="w-3 h-3" /> : 'CONCILIAR'}</button>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div><p className="text-[9px] font-black text-gray-400 uppercase">QR (Bancolombia):</p><p className={`text-sm font-black ${item.qr >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCOP(item.qr)}</p></div>
                                            <button onClick={() => confirmDailyTotal(item.date, item.qr, 'qr')} disabled={isQrConfirmed || item.qr === 0} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${isQrConfirmed ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-700 text-accent border border-accent/20'}`}>{isQrConfirmed ? <CheckIcon className="w-3 h-3" /> : 'CONCILIAR'}</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
                <div className="bg-white dark:bg-secondary p-2 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <button onClick={() => setActiveTab('cash')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'cash' ? 'bg-accent text-white shadow-lg' : 'text-gray-400'}`}><DollarIcon className="w-5 h-5" /> Libro Efectivo</button>
                    <button onClick={() => setActiveTab('qr')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'qr' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}><BuildingStorefrontIcon className="w-5 h-5" /> Libro QR</button>
                    <button onClick={() => setActiveTab('bank')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'bank' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400'}`}><BuildingStorefrontIcon className="w-5 h-5" /> Libro Bancos</button>
                </div>

                <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-[600px]">
                    <div className="p-4 border-b dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-gray-900/50">
                        <div className="relative w-full sm:w-64">
                            <input type="text" placeholder="Filtrar libro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white dark:bg-gray-800 border-2 border-transparent focus:border-accent rounded-xl py-2 px-10 outline-none text-sm font-bold shadow-inner" />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Real en {activeTab.toUpperCase()}</p>
                                <p className={`text-xl font-black ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCOP(currentBalance)}</p>
                            </div>
                            <button onClick={() => { handleAddRow(); setShowAddModal(true); }} className="p-3 bg-accent text-white rounded-xl shadow-lg hover:scale-105 transition-all"><PlusCircleIcon className="w-6 h-6" /></button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead><tr className="bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500 border-b dark:border-gray-700"><th className="p-4">Fecha / Hora</th><th className="p-4">Concepto</th><th className="p-4">Categoría</th><th className="p-4 text-right">Monto</th><th className="p-4 text-right">Saldo Caja</th><th className="p-4 w-10"></th></tr></thead>
                            <tbody className="divide-y dark:divide-gray-800">
                                <tr className="bg-accent/5 font-black italic">
                                    <td className="p-4 text-gray-400">---</td>
                                    <td className="p-4 text-accent uppercase tracking-widest">Saldo Inicial de Sede</td>
                                    <td className="p-4 text-gray-400">APERTURA</td>
                                    <td className="p-4 text-right">{formatCOP(initialBalanceValue)}</td>
                                    <td className="p-4 text-right bg-accent/10">{formatCOP(initialBalanceValue)}</td>
                                    <td className="p-4"></td>
                                </tr>
                                {recordsWithBalance.map(record => (
                                    <tr key={record.id} className={`hover:bg-accent/5 transition-colors group ${record.affectsCashBalance === false ? 'opacity-50 italic' : ''}`}>
                                        <td className="p-4 font-mono text-gray-500 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span>{record.date.split('T')[0]}</span>
                                                <span className="text-[10px] font-black text-accent">{record.date.split('T')[1]?.slice(0, 5) || '--:--'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-800 dark:text-gray-200 uppercase">{record.description}</p>
                                                {record.debtStoreId && <span className="px-2 py-0.5 bg-yellow-500 text-white font-black text-[8px] rounded uppercase shadow-sm">Préstamo / Cruce</span>}
                                            </div>
                                            <p className="text-[9px] text-gray-400">Por: {record.registeredBy}</p>
                                        </td>
                                        <td className="p-4 uppercase font-black text-[9px] text-gray-500">{record.subCategory || 'Varios'}</td>
                                        <td className={`p-4 text-right font-black ${record.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {record.amount >= 0 ? '+' : ''}{formatCOP(record.amount)}
                                        </td>
                                        <td className="p-4 text-right font-black bg-accent/5">
                                            {record.affectsCashBalance !== false ? formatCOP(record.saldo) : '--'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleOpenEdit(record)} className="p-2 text-gray-400 hover:text-accent transition-colors"><EditIcon className="w-5 h-5" /></button>
                                                <button onClick={() => handleDeleteRecord(record.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {/* MODAL DE CONFIRMACIÓN DE PAGO (SETTLEMENT) */}
        {paymentSummary && (
            <div className="fixed inset-0 bg-black/60 z-[220] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-secondary rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-accent/20">
                    <div className="p-6 bg-accent text-white text-center">
                        <CheckIcon className="w-16 h-16 mx-auto mb-2" />
                        <h3 className="text-xl font-black uppercase tracking-widest">Confirmar Pago</h3>
                    </div>
                    <div className="p-6 space-y-4 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Vas a registrar un pago de deuda con la sede:</p>
                        <p className="text-2xl font-black text-gray-800 dark:text-white uppercase">{paymentSummary.targetStoreName}</p>
                        <div className="p-3 bg-accent/5 rounded-xl border border-accent/20">
                            <p className="text-xs font-bold text-gray-400 uppercase">Monto a Liquidar</p>
                            <p className="text-3xl font-black text-accent">{formatCOP(paymentSummary.amount)}</p>
                            <p className="text-[10px] font-black text-gray-500 uppercase mt-1">Modo: {paymentSummary.sourceAccount === 'cash' ? 'EFECTIVO' : 'QR'}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 flex gap-3">
                        <button onClick={() => setPaymentSummary(null)} className="flex-1 px-4 py-3 text-gray-500 font-black uppercase text-xs">Cancelar</button>
                        <button onClick={handleConfirmSettlement} className="flex-1 bg-accent text-white font-black py-3 rounded-xl shadow-lg active:scale-95 uppercase text-xs">CONFIRMAR PAGO</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL EDICIÓN */}
        {editingRecord && (
            <div className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white dark:bg-secondary rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-accent/20 flex flex-col">
                    <div className="p-6 bg-accent text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <EditIcon className="w-8 h-8" />
                            <h3 className="text-2xl font-black uppercase tracking-widest">Editar Movimiento</h3>
                        </div>
                        <button onClick={() => setEditingRecord(null)}><CrossIcon className="w-8 h-8" /></button>
                    </div>
                    <form onSubmit={handleUpdateSingleRecord} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-1 justify-center bg-gray-100 dark:bg-gray-800 p-2 rounded-xl">
                                <button type="button" onClick={() => adjustEditingDate(-1)} className="p-2 hover:bg-accent/10 text-accent rounded-lg transition-all"><ChevronLeftIcon className="w-5 h-5" /></button>
                                <input type="date" value={editingRecord.date.split('T')[0]} onChange={e => setEditingRecord({...editingRecord, date: e.target.value + 'T' + (editingRecord.timeString || '12:00') + ':00'})} className="flex-grow bg-white dark:bg-gray-700 p-2 rounded-xl border outline-none font-bold text-sm text-center" required />
                                <button type="button" onClick={() => adjustEditingDate(1)} className="p-2 hover:bg-accent/10 text-accent rounded-lg transition-all"><ChevronRightIcon className="w-5 h-5" /></button>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1">Hora</label>
                                <input type="time" value={editingRecord.timeString} onChange={e => setEditingRecord({...editingRecord, timeString: e.target.value})} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-xl border outline-none font-bold text-sm text-center" />
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Concepto / Descripción</label>
                            <input type="text" value={editingRecord.description} onChange={e => setEditingRecord({...editingRecord, description: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border outline-none font-bold text-sm" required />
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Monto ($)</label>
                            <input 
                                type="text" 
                                value={formatInputDisplay(editingRecord.amountString || '')} 
                                onChange={e => setEditingRecord({...editingRecord, amountString: parseInputToNumber(e.target.value)})} 
                                className={`w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border outline-none font-black text-lg text-right ${(parseFloat(editingRecord.amountString || '0') < 0) ? 'text-red-500' : 'text-green-600'}`} 
                                required 
                            />
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800 flex justify-end gap-4 mt-6">
                            <button type="button" onClick={() => setEditingRecord(null)} className="px-6 py-3 text-gray-500 font-black uppercase tracking-widest text-xs">Cerrar</button>
                            <button type="submit" className="bg-accent text-white font-black py-3 px-8 rounded-xl shadow-xl hover:bg-accent-hover transition-all active:scale-95 uppercase tracking-widest text-xs">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {showAddModal && (
            <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white dark:bg-secondary rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden border border-accent/20 flex flex-col max-h-[90vh]">
                    <div className="p-6 bg-accent text-white flex justify-between items-center"><div className="flex items-center gap-3"><PlusCircleIcon className="w-8 h-8" /><h3 className="text-2xl font-black uppercase tracking-widest">Ingresar Movimientos Manuales</h3></div><button onClick={() => setShowAddModal(false)}><CrossIcon className="w-8 h-8" /></button></div>
                    
                    <div className="p-4 bg-gray-100 dark:bg-gray-800 border-b-2 dark:border-gray-700 flex justify-center items-center gap-6 shadow-inner">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">REGISTRANDO EN SEDE:</p>
                            <p className="text-xl font-black text-accent uppercase tracking-tighter">{activeStore?.name}</p>
                        </div>
                        <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">MODO DE DINERO:</p>
                            <p className="text-xl font-black text-gray-700 dark:text-white uppercase">{activeTab === 'cash' ? 'EFECTIVO' : (activeTab === 'qr' ? 'BANCOLOMBIA QR' : 'BANCOS')}</p>
                        </div>
                    </div>

                    <div className="flex-grow overflow-auto p-6">
                        <div className="space-y-3">
                            <div className="hidden md:grid grid-cols-12 gap-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <div className="col-span-2">Fecha y Hora</div><div className="col-span-1">Cuenta</div><div className="col-span-2">Concepto local</div><div className="col-span-2">Categoría Local</div><div className="col-span-1 text-right">Monto $</div><div className="col-span-3 text-center border-l border-gray-300 dark:border-gray-600">Configuración Cruzada (Préstamo para otro Local)</div><div className="col-span-1"></div>
                            </div>
                            {manualEntries.map((entry) => {
                                const amountVal = parseFloat(entry.amount);
                                const isExpense = amountVal < 0;
                                return (
                                <div key={entry.tempId} className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border transition-all ${entry.debtStoreId ? 'border-yellow-500 shadow-md ring-2 ring-yellow-500/10' : 'border-gray-100 dark:border-gray-700'} animate-fade-in`}>
                                    <div className="col-span-2 space-y-1">
                                        <div className="flex items-center gap-1">
                                            <input type="date" value={entry.date} onChange={e => handleUpdateEntryField(entry.tempId, 'date', e.target.value)} className="flex-grow bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-sm text-center" />
                                        </div>
                                        <input type="time" value={entry.time} onChange={e => handleUpdateEntryField(entry.tempId, 'time', e.target.value)} className="w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-xs text-center" />
                                    </div>
                                    <div className="col-span-1"><select value={entry.accountType} onChange={e => handleUpdateEntryField(entry.tempId, 'accountType', e.target.value as any)} className="w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-[10px] uppercase"><option value="cash">Efec</option><option value="qr">Banc</option><option value="bank">Otro</option></select></div>
                                    <div className="col-span-2"><input type="text" value={entry.description} onChange={e => handleUpdateEntryField(entry.tempId, 'description', e.target.value)} placeholder="¿De qué trata?" className="w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-sm" /></div>
                                    <div className="col-span-2">
                                        <input type="text" value={entry.subCategory} onChange={e => handleUpdateEntryField(entry.tempId, 'subCategory', e.target.value)} placeholder="Categoría..." className="w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-[10px] uppercase text-accent border-accent/20" />
                                    </div>
                                    <div className="col-span-1">
                                        <input type="text" value={formatInputDisplay(entry.amount)} onChange={e => handleUpdateEntryField(entry.tempId, 'amount', e.target.value)} placeholder="Monto $" className={`w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-black text-sm text-right ${isExpense ? 'text-red-500' : 'text-green-600'}`} />
                                    </div>
                                    
                                    {/* SECCIÓN CRUZADA */}
                                    <div className="col-span-3 grid grid-cols-1 gap-2 border-l border-gray-300 dark:border-gray-600 pl-4">
                                        <select value={entry.debtStoreId} onChange={e => handleUpdateEntryField(entry.tempId, 'debtStoreId', e.target.value)} className="w-full bg-white dark:bg-gray-800 p-2 rounded border outline-none font-bold text-[10px] uppercase border-yellow-500/50">
                                            <option value="">¿Es un pago por otro local?</option>
                                            {stores.filter(s => s.id !== activeStoreId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        
                                        {entry.debtStoreId && (
                                            <div className="space-y-2 bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg border border-yellow-200">
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-yellow-600">Categoría del gasto en {stores.find(s => s.id === entry.debtStoreId)?.name}</label>
                                                    <input 
                                                        type="text" 
                                                        value={entry.mirrorCategory || ''} 
                                                        onChange={e => handleUpdateEntryField(entry.tempId, 'mirrorCategory', e.target.value)} 
                                                        placeholder="Elegir categoría real (ej: Mercancía)..." 
                                                        className="w-full bg-white dark:bg-gray-800 p-1.5 rounded text-[10px] font-bold border-yellow-500/30 outline-none"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[7px] font-black uppercase text-gray-500">¿Resta caja física en la otra sede ahora?</p>
                                                    <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                        <input type="checkbox" checked={entry.affectsMirrorBalance} onChange={e => handleUpdateEntryField(entry.tempId, 'affectsMirrorBalance', e.target.checked)} className="sr-only peer" />
                                                        <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-accent"></div>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="col-span-1 text-center"><button onClick={() => setManualEntries(manualEntries.filter(m => m.tempId !== entry.tempId))} className="p-2 text-gray-300 hover:text-red-500 transition-all"><TrashIcon className="w-5 h-5" /></button></div>
                                </div>
                            )})}
                        </div>
                        <button onClick={handleAddRow} className="w-full mt-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:text-accent hover:border-accent transition-all font-black uppercase tracking-widest"><PlusIcon className="w-6 h-6" /> Añadir otro movimiento al lote</button>
                    </div>
                    <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-[10px] font-bold text-gray-400 italic max-w-md">
                            💡 Tip: Si pagas mercancía de otra sede, selecciona "Mercancía" en categoría cruzada. Así en la otra sede aparecerá el gasto pero NO le restará dinero físico hasta que te lo paguen.
                        </div>
                        <div className="flex gap-4 w-full sm:w-auto">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 sm:flex-none px-6 py-4 text-gray-500 font-black uppercase tracking-widest text-xs">Cancelar</button>
                            <button onClick={handleSaveManualEntries} className="flex-1 sm:flex-none bg-accent text-white font-black py-4 px-12 rounded-2xl shadow-xl hover:bg-accent-hover transition-all active:scale-95 uppercase tracking-widest text-sm">PROCESAR LOTE</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default FinancialReconciliationView;
