
import React, { useState, useMemo, useEffect } from 'react';
import { FinancialRecord, Store, Sale, Layaway, PaymentMethod, Payment, Seller, Expense, Incident, IncidentType } from '../types';
import { formatCOP } from '../constants';
import { DollarIcon, BuildingStorefrontIcon, PlusCircleIcon, TrashIcon, CheckIcon, CrossIcon, SearchIcon, HistoryIcon, ChartBarIcon, PlusIcon, SparklesIcon, AlertTriangleIcon, SwapIcon, TagIcon, EditIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from './Icons';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';

interface FinancialReconciliationViewProps {
  stores: Store[];
  sales: Sale[];
  layaways: Layaway[];
  expenses: Expense[];
  incidents: Incident[];
  currentUser: Seller;
}

type AccountType = 'cash' | 'qr' | 'bank';

interface ManualEntry {
    tempId: string;
    date: string;
    amount: string; // Almacenamos el string numérico sin formato
    otherAmount?: string; 
    description: string;
    accountType: AccountType;
    subCategory: string;
    debtStoreId?: string;
    isSplit?: boolean;
}

interface PaymentSummaryData {
    targetStoreId: string;
    targetStoreName: string;
    amount: number;
    sourceAccount: AccountType;
}

// Mapeo para categorización automática
const AUTO_CATEGORIES: Record<string, string[]> = {
    'Servicios': ['luz', 'agua', 'gas', 'internet', 'claro', 'tigo', 'movistar', 'energia', 'vanti', 'acueducto'],
    'Local/Arriendo': ['arriendo', 'canon', 'administracion', 'local', 'alquiler'],
    'Personal': ['nomina', 'sueldo', 'pago', 'bono', 'comision', 'auxilio'],
    'Mantenimiento': ['arreglo', 'reparacion', 'pintura', 'limpieza', 'aseo', 'insumos', 'bombillo'],
    'Papelería/Bolsas': ['bolsas', 'papel', 'lapicero', 'impresion', 'cinta', 'empaque'],
    'Logística': ['transporte', 'flete', 'domicilio', 'envio', 'servientrega', 'interrapidisimo', 'uber', 'taxi'],
    'Préstamo/Cruce': ['deuda', 'prestamo', 'abono sede', 'pago sede', 'cruce'],
    'Otros': []
};

const FinancialReconciliationView: React.FC<FinancialReconciliationViewProps> = ({ stores, sales, layaways, expenses, incidents, currentUser }) => {
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

  // Added years useMemo to fix "Cannot find name 'years'" error
  const years = useMemo(() => {
    const currentY = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentY - 2 + i);
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  
  const [editingRecord, setEditingRecord] = useState<(FinancialRecord & { amountString?: string }) | null>(null);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  useEffect(() => {
    if (!activeStoreId) return;
    const q = query(collection(db, 'financialRecords'), where('storeId', '==', activeStoreId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FinancialRecord));
        setRecords(list.sort((a, b) => b.date.localeCompare(a.date)));
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
          if (d >= startOfMonth && d <= endOfMonth && r.amount < 0) {
              const cat = r.subCategory || 'Sin Categoría';
              stats[cat] = (stats[cat] || 0) + Math.abs(r.amount);
          }
      });

      return Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }));
  }, [records, selectedMonth, selectedYear]);

  const interStoreBalances = useMemo(() => {
      const balances: Record<string, { total: number, cash: number, qr: number, bank: number, storeId: string, history: FinancialRecord[] }> = {};
      
      records.forEach(r => {
          if (r.debtStoreId) {
              const otherStoreId = r.debtStoreId;
              if (!balances[otherStoreId]) {
                  balances[otherStoreId] = { total: 0, cash: 0, qr: 0, bank: 0, storeId: otherStoreId, history: [] };
              }
              const amountToFlip = -r.amount; 
              balances[otherStoreId].total += amountToFlip;
              balances[otherStoreId].history.push(r);

              if (r.accountType === 'cash') balances[otherStoreId].cash += amountToFlip;
              else if (r.accountType === 'qr') balances[otherStoreId].qr += amountToFlip;
              else if (r.accountType === 'bank') balances[otherStoreId].bank += amountToFlip;
          }
      });

      return Object.entries(balances).map(([otherStoreId, stats]) => ({
          otherStoreName: stores.find(s => s.id === otherStoreId)?.name || 'Local',
          storeId: otherStoreId,
          ...stats,
          // Sort history by date descending
          history: stats.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
    const newRecord: FinancialRecord = {
        id: recordId,
        date: dateStr,
        storeId: activeStoreId,
        accountType: accountType as any,
        amount: amount,
        type: 'income_sales',
        description: `Cierre Diario ${typeLabel} (${dateStr})`,
        subCategory: 'Cierre Diario',
        registeredBy: currentUser.name,
        isConfirmed: true
    };
    await setDoc(doc(db, 'financialRecords', recordId), newRecord);
  };

  const handleAddRow = () => {
    const newEntry: ManualEntry = {
        tempId: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0],
        amount: '',
        otherAmount: '',
        description: '',
        accountType: activeTab,
        subCategory: '',
        debtStoreId: '',
        isSplit: false
    };
    setManualEntries([...manualEntries, newEntry]);
  };

  const initiateSettlement = (targetStoreId: string, targetStoreName: string, amount: number, sourceAccount: AccountType) => {
      setPaymentSummary({
          targetStoreId,
          targetStoreName,
          amount,
          sourceAccount
      });
  };

  const handlePreFillPayment = (targetStoreId: string, amountToPay: number) => {
      const targetStore = stores.find(s => s.id === targetStoreId);
      const newEntry: ManualEntry = {
          tempId: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString().split('T')[0],
          amount: (-amountToPay).toString(), // Suggest full payment (expense)
          otherAmount: '',
          description: `Pago deuda a ${targetStore?.name || 'Sede'}`,
          accountType: activeTab,
          subCategory: 'Cruce Sedes',
          debtStoreId: targetStoreId,
          isSplit: false
      };
      setManualEntries([newEntry]);
      setShowAddModal(true);
  };

  const handleConfirmSettlement = async () => {
      if (!paymentSummary) return;
      const { targetStoreId, targetStoreName, amount, sourceAccount } = paymentSummary;

      try {
          const batch = writeBatch(db);
          const activeStoreName = stores.find(s => s.id === activeStoreId)?.name || 'Local Actual';
          const date = new Date().toISOString().split('T')[0];

          // 1. Registro de Egreso en la tienda actual (Paga)
          const mainRef = doc(collection(db, 'financialRecords'));
          const mainRecord: FinancialRecord = {
              id: mainRef.id,
              date: date,
              storeId: activeStoreId,
              accountType: sourceAccount,
              amount: -amount,
              type: 'expense',
              description: `Pago de deuda a ${targetStoreName}`,
              subCategory: 'Cruce Sedes',
              registeredBy: currentUser.name,
              isConfirmed: true,
              debtStoreId: targetStoreId
          };

          // 2. Registro de Ingreso en la tienda destino (Recibe)
          const mirrorRef = doc(collection(db, 'financialRecords'));
          const mirrorRecord: FinancialRecord = {
              id: mirrorRef.id,
              date: date,
              storeId: targetStoreId,
              accountType: sourceAccount, // Asumimos que entra al mismo tipo de cuenta por defecto
              amount: amount,
              type: 'income_manual',
              description: `Pago recibido de ${activeStoreName}`,
              subCategory: 'Cruce Sedes',
              registeredBy: `${currentUser.name} (vía ${activeStoreName})`,
              isConfirmed: true,
              debtStoreId: activeStoreId,
              relatedRecordId: mainRef.id
          };
          
          // Vincular registros
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
            if (field === 'amount' || field === 'otherAmount') {
                finalValue = parseInputToNumber(value);
            }
            const updated = { ...e, [field]: finalValue };
            if (field === 'description') {
                updated.subCategory = autoCategorize(value);
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
    const activeStoreName = stores.find(s => s.id === activeStoreId)?.name || 'Local Actual';

    validEntries.forEach(e => {
        const totalAmountVal = parseFloat(e.amount);
        const type = totalAmountVal < 0 ? 'expense' : 'income_manual';
        const accountLabel = e.accountType === 'cash' ? 'Efectivo' : (e.accountType === 'qr' ? 'Bancolombia' : 'Otros Bancos');
        
        if (e.isSplit && e.debtStoreId && e.otherAmount) {
            const otherVal = parseFloat(e.otherAmount);
            const localVal = totalAmountVal - otherVal;
            const otherStoreName = stores.find(s => s.id === e.debtStoreId)?.name || 'Otro Local';

            if (Math.abs(localVal) > 0.01) {
                const localRef = doc(collection(db, 'financialRecords'));
                const localRecord: FinancialRecord = {
                    id: localRef.id,
                    date: e.date,
                    storeId: activeStoreId,
                    accountType: e.accountType as any,
                    amount: localVal,
                    type: localVal < 0 ? 'expense' : 'income_manual',
                    description: `${e.description} (Porción ${activeStoreName})`,
                    subCategory: e.subCategory || 'Manual',
                    registeredBy: currentUser.name,
                    isConfirmed: true
                };
                batch.set(localRef, localRecord);
            }

            const loanRef = doc(collection(db, 'financialRecords'));
            const mirrorRef = doc(collection(db, 'financialRecords'));
            
            const loanRecord: FinancialRecord = {
                id: loanRef.id,
                date: e.date,
                storeId: activeStoreId,
                accountType: e.accountType as any,
                amount: otherVal,
                type: otherVal < 0 ? 'expense' : 'income_manual',
                description: `${e.description} (Cruce con ${otherStoreName})`,
                subCategory: 'Cruce Sedes',
                registeredBy: currentUser.name,
                isConfirmed: true,
                debtStoreId: e.debtStoreId,
                relatedRecordId: mirrorRef.id
            };
            batch.set(loanRef, loanRecord);

            const mirrorRecord: FinancialRecord = {
                id: mirrorRef.id,
                date: e.date,
                storeId: e.debtStoreId,
                accountType: e.accountType as any,
                amount: -otherVal,
                type: (-otherVal) < 0 ? 'expense' : 'income_manual',
                description: `${e.description} (Cruce con ${activeStoreName})`,
                subCategory: 'Cruce Sedes',
                registeredBy: `${currentUser.name} (vía ${activeStoreName})`,
                isConfirmed: true,
                debtStoreId: activeStoreId,
                relatedRecordId: loanRef.id
            };
            batch.set(mirrorRef, mirrorRecord);

        } else {
            const mainRef = doc(collection(db, 'financialRecords'));
            const mirrorRef = e.debtStoreId ? doc(collection(db, 'financialRecords')) : null;
            const mainDescription = e.debtStoreId ? `${e.description} (Cruce con ${stores.find(s => s.id === e.debtStoreId)?.name})` : e.description;

            const newRecord: FinancialRecord = {
                id: mainRef.id,
                date: e.date,
                storeId: activeStoreId,
                accountType: e.accountType as any,
                amount: totalAmountVal,
                type: type as any,
                description: mainDescription,
                subCategory: e.subCategory || 'Manual',
                registeredBy: currentUser.name,
                isConfirmed: true,
            };

            // Conditionally add optional fields to avoid undefined values in Firestore
            if (e.debtStoreId) {
                newRecord.debtStoreId = e.debtStoreId;
            }
            if (mirrorRef) {
                newRecord.relatedRecordId = mirrorRef.id;
            }

            batch.set(mainRef, newRecord);

            if (mirrorRef && e.debtStoreId) {
                const mirrorAmount = -totalAmountVal;
                const mirrorType = mirrorAmount < 0 ? 'expense' : 'income_manual';
                const mirrorDescription = `${e.description} (Cruce ${accountLabel} con ${activeStoreName})`;
                const mirrorRecord: FinancialRecord = {
                    id: mirrorRef.id,
                    date: e.date,
                    storeId: e.debtStoreId,
                    accountType: e.accountType as any,
                    amount: mirrorAmount,
                    type: mirrorType as any,
                    description: mirrorDescription,
                    subCategory: 'Cruce Sedes',
                    registeredBy: `${currentUser.name} (vía ${activeStoreName})`,
                    isConfirmed: true,
                    debtStoreId: activeStoreId,
                    relatedRecordId: mainRef.id
                };
                batch.set(mirrorRef, mirrorRecord);
            }
        }
    });
    await batch.commit();
    setShowAddModal(false);
    setManualEntries([]);
  };

  const handleOpenEdit = (record: FinancialRecord) => {
    setEditingRecord({
        ...record,
        amountString: record.amount.toString()
    });
  };

  const handleUpdateSingleRecord = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingRecord) return;
      
      const { amountString, ...recordToSave } = editingRecord;
      // Eliminar propiedad runtime para que no se guarde
      if ('saldo' in recordToSave) delete (recordToSave as any).saldo;
      
      // Cleanup optional fields that might be undefined from state
      if (recordToSave.debtStoreId === undefined) delete recordToSave.debtStoreId;
      if (recordToSave.relatedRecordId === undefined) delete recordToSave.relatedRecordId;

      const amountVal = parseFloat(amountString || '0');
      recordToSave.amount = amountVal;
      recordToSave.type = amountVal < 0 ? 'expense' : 'income_manual';

      const recordRef = doc(db, 'financialRecords', recordToSave.id);
      await setDoc(recordRef, recordToSave, { merge: true });
      
      if (recordToSave.relatedRecordId) {
          if (window.confirm("Este registro tiene un movimiento espejo vinculado en otra sede. ¿Deseas intentar actualizar el monto y fecha del espejo también?")) {
              const mirrorRef = doc(db, 'financialRecords', recordToSave.relatedRecordId);
              await updateDoc(mirrorRef, {
                  amount: -amountVal,
                  date: recordToSave.date,
                  accountType: recordToSave.accountType
              });
          }
      }
      setEditingRecord(null);
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este registro del libro?")) {
        await deleteDoc(doc(db, 'financialRecords', id));
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
        const matchesAccount = r.accountType === activeTab;
        const matchesSearch = r.description.toLowerCase().includes(searchTerm.toLowerCase()) || (r.subCategory && r.subCategory.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesAccount && matchesSearch;
    });
  }, [records, activeTab, searchTerm]);

  const currentBalance = useMemo(() => filteredRecords.reduce((sum, r) => sum + r.amount, 0), [filteredRecords]);

  const recordsWithBalance = useMemo(() => {
    const sorted = [...filteredRecords].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let runningBalance = 0;
    return sorted.map(r => {
        runningBalance += r.amount;
        return { ...r, saldo: runningBalance };
    }).reverse();
  }, [filteredRecords]);

  const adjustEditingDate = (days: number) => {
      if (!editingRecord) return;
      const d = new Date(editingRecord.date + 'T12:00:00');
      d.setDate(d.getDate() + days);
      setEditingRecord({ ...editingRecord, date: d.toISOString().split('T')[0] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-secondary p-6 rounded-2xl shadow-lg border-b-4 border-accent">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-inner">
                    <ChartBarIcon className="w-10 h-10" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">Conciliación Financiera</h2>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Sincronización de Cuentas y Cruces entre Sedes</p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {stores.map(s => (
                    <button 
                        key={s.id} 
                        onClick={() => setActiveStoreId(s.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${activeStoreId === s.id ? 'bg-accent text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                    >
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
                        <SwapIcon className="w-5 h-5" /> Deudas y Créditos Inter-Sedes
                    </h3>
                    <div className="flex items-center gap-3">
                        {globalDebtsSummary.toCollect > 0 && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                                +{formatCOP(globalDebtsSummary.toCollect)}
                            </span>
                        )}
                        {globalDebtsSummary.toPay > 0 && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                -{formatCOP(globalDebtsSummary.toPay)}
                            </span>
                        )}
                        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isDebtsSectionOpen ? 'rotate-180' : ''} group-hover:text-accent`} />
                    </div>
                </div>
                
                {isDebtsSectionOpen && (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide animate-fade-in">
                        {interStoreBalances.length > 0 ? interStoreBalances.map((item, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between ${item.total > 0 ? 'bg-green-50 dark:bg-green-900/10 border-green-200' : 'bg-red-50 dark:bg-red-900/10 border-red-200'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase">Cruce con:</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase">{item.otherStoreName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Balance Neto:</p>
                                        <p className={`text-lg font-black ${item.total > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.total > 0 ? 'TE DEBE' : 'DEBES'} {formatCOP(Math.abs(item.total))}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                    {Math.abs(item.cash) > 0 && <p className="text-[10px] font-bold">Efectivo: <span className={item.cash > 0 ? 'text-green-600' : 'text-red-500'}>{formatCOP(item.cash)}</span></p>}
                                    {Math.abs(item.qr) > 0 && <p className="text-[10px] font-bold">Bancolombia: <span className={item.qr > 0 ? 'text-green-600' : 'text-red-500'}>{formatCOP(item.qr)}</span></p>}
                                    {Math.abs(item.bank) > 0 && <p className="text-[10px] font-bold">Otros: <span className={item.bank > 0 ? 'text-green-600' : 'text-red-500'}>{formatCOP(item.bank)}</span></p>}
                                </div>
                                
                                {/* Transaction History Expander */}
                                <div className="mt-2">
                                    <button 
                                        onClick={() => setExpandedDebtStoreId(expandedDebtStoreId === item.storeId ? null : item.storeId)}
                                        className="text-[9px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 w-full justify-center pt-1 border-t border-gray-100 dark:border-gray-700"
                                    >
                                        {expandedDebtStoreId === item.storeId ? 'Ocultar Detalles' : 'Ver Detalles'}
                                        <ChevronDownIcon className={`w-3 h-3 transition-transform ${expandedDebtStoreId === item.storeId ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {expandedDebtStoreId === item.storeId && (
                                        <div className="mt-2 space-y-1 bg-white/50 dark:bg-black/20 p-2 rounded-lg animate-fade-in">
                                            {item.history.slice(0, 5).map(record => (
                                                <div key={record.id} className="flex justify-between text-[9px] border-b border-gray-100 dark:border-gray-700 pb-1 last:border-0">
                                                    <span className="text-gray-600 dark:text-gray-400 truncate max-w-[60%]">{record.description}</span>
                                                    <span className={`font-bold ${record.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {record.amount < 0 ? '+' : ''}{formatCOP(Math.abs(record.amount))} 
                                                    </span>
                                                </div>
                                            ))}
                                            {item.history.length > 5 && <p className="text-[8px] text-center text-gray-400 italic">... y {item.history.length - 5} más</p>}
                                        </div>
                                    )}
                                </div>

                                {item.total < 0 && (
                                    <div className="mt-3 pt-3 border-t-2 border-dashed border-red-200 dark:border-red-900/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Saldar Deuda:</p>
                                            <button onClick={() => handlePreFillPayment(item.storeId, Math.abs(item.total))} className="text-[10px] text-accent font-bold hover:underline">Otro valor...</button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => initiateSettlement(item.storeId, item.otherStoreName, Math.abs(item.total), 'cash')} className="flex-1 bg-white dark:bg-gray-800 text-green-600 text-[10px] font-black py-1.5 rounded-lg border border-green-200 shadow-sm hover:bg-green-50">EFECTIVO</button>
                                            <button onClick={() => initiateSettlement(item.storeId, item.otherStoreName, Math.abs(item.total), 'qr')} className="flex-1 bg-white dark:bg-gray-800 text-blue-600 text-[10px] font-black py-1.5 rounded-lg border border-blue-200 shadow-sm hover:bg-blue-50">QR</button>
                                            <button onClick={() => initiateSettlement(item.storeId, item.otherStoreName, Math.abs(item.total), 'bank')} className="flex-1 bg-white dark:bg-gray-800 text-purple-600 text-[10px] font-black py-1.5 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-50">BANCOS</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )) : <p className="text-sm text-gray-400 italic">No hay préstamos ni pagos pendientes entre locales.</p>}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-secondary p-5 rounded-2xl shadow-md border border-accent/20">
                <h3 className="text-sm font-black text-accent uppercase tracking-widest flex items-center gap-2 mb-4">
                    <ChartBarIcon className="w-5 h-5" /> Gastos de {monthNames[selectedMonth]} por Categoría
                </h3>
                <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-hide">
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

        {/* PAYMENT SUMMARY MODAL */}
        {paymentSummary && (
            <div className="fixed inset-0 bg-black/60 z-[220] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white dark:bg-secondary rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-accent/20 flex flex-col">
                    <div className="p-4 bg-accent text-white flex justify-between items-center">
                        <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                            <CheckIcon className="w-6 h-6" /> Confirmar Pago
                        </h3>
                        <button onClick={() => setPaymentSummary(null)}><CrossIcon className="w-6 h-6" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Estás pagando a</p>
                            <p className="text-2xl font-black text-gray-800 dark:text-white uppercase">{paymentSummary.targetStoreName}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-gray-500 uppercase">Monto:</span>
                                <span className="text-xl font-black text-accent">{formatCOP(paymentSummary.amount)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-500 uppercase">Sale de:</span>
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase bg-white dark:bg-gray-700 px-2 py-1 rounded border">
                                    {paymentSummary.sourceAccount === 'cash' ? 'Caja Efectivo' : (paymentSummary.sourceAccount === 'qr' ? 'Bancolombia' : 'Bancos')}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center italic">
                            Se registrará un gasto en tu local y un ingreso en {paymentSummary.targetStoreName}.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setPaymentSummary(null)} className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-xs uppercase">Cancelar</button>
                            <button onClick={handleConfirmSettlement} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-xs uppercase hover:bg-green-700 shadow-lg">Confirmar Pago</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
                <div className="bg-white dark:bg-secondary p-5 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col h-full max-h-[800px]">
                    <div className="mb-4 flex flex-col gap-2">
                        <button 
                            onClick={() => setIsSystemLoadsOpen(!isSystemLoadsOpen)}
                            className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 hover:text-accent transition-colors w-full"
                        >
                            <HistoryIcon className="w-4 h-4 text-accent" /> 
                            Cargas del Sistema
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
                    <button onClick={() => setActiveTab('cash')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'cash' ? 'bg-accent text-white shadow-lg' : 'text-gray-400'}`}><DollarIcon className="w-5 h-5" /> Caja Efectivo</button>
                    <button onClick={() => setActiveTab('qr')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'qr' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}><BuildingStorefrontIcon className="w-5 h-5" /> Bancolombia (QR)</button>
                    <button onClick={() => setActiveTab('bank')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'bank' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400'}`}><BuildingStorefrontIcon className="w-5 h-5" /> Bancos / Otros</button>
                </div>

                <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-[600px]">
                    <div className="p-4 border-b dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-gray-900/50">
                        <div className="relative w-full sm:w-64">
                            <input type="text" placeholder="Filtrar libro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white dark:bg-gray-800 border-2 border-transparent focus:border-accent rounded-xl py-2 px-10 outline-none text-sm font-bold shadow-inner" />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Cuenta</p>
                                <p className={`text-xl font-black ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCOP(currentBalance)}</p>
                            </div>
                            <button onClick={() => { setManualEntries([{ tempId: Math.random().toString(36).substr(2, 9), date: new Date().toISOString().split('T')[0], amount: '', otherAmount: '', description: '', accountType: activeTab, subCategory: '', debtStoreId: '', isSplit: false }]); setShowAddModal(true); }} className="p-3 bg-accent text-white rounded-xl shadow-lg hover:scale-105 transition-all"><PlusCircleIcon className="w-6 h-6" /></button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead><tr className="bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500 border-b dark:border-gray-700"><th className="p-4">Fecha</th><th className="p-4">Descripción / Concepto</th><th className="p-4">Categoría</th><th className="p-4 text-right">Valor</th><th className="p-4 text-right">Saldo</th><th className="p-4 w-10"></th></tr></thead>
                            <tbody className="divide-y dark:divide-gray-800">
                                {recordsWithBalance.map(record => (
                                    <tr key={record.id} className="hover:bg-accent/5 transition-colors group">
                                        <td className="p-4 font-mono">{record.date}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-800 dark:text-gray-200 uppercase">{record.description}</p>
                                                {record.debtStoreId && <span className="px-2 py-0.5 bg-yellow-500 text-white font-black text-[8px] rounded uppercase">Cruce Sede</span>}
                                            </div>
                                            <p className="text-[9px] text-gray-400">Registró: {record.registeredBy}</p>
                                        </td>
                                        <td className="p-4 uppercase font-black text-[9px] text-gray-500">{record.subCategory || 'Varios'}</td>
                                        <td className={`p-4 text-right font-black ${record.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{record.amount >= 0 ? '+' : ''}{formatCOP(record.amount)}</td>
                                        <td className="p-4 text-right font-black bg-accent/5">{formatCOP(record.saldo)}</td>
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

        {/* MODAL DE EDICIÓN INDIVIDUAL (Existing) */}
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
                        <div className="flex items-center gap-1 justify-center bg-gray-100 dark:bg-gray-800 p-2 rounded-xl mb-2">
                            <button type="button" onClick={() => adjustEditingDate(-1)} className="p-2 hover:bg-accent/10 text-accent rounded-lg transition-all"><ChevronLeftIcon className="w-5 h-5" /></button>
                            <input type="date" value={editingRecord.date} onChange={e => setEditingRecord({...editingRecord, date: e.target.value})} className="flex-grow bg-white dark:bg-gray-700 p-2 rounded-xl border outline-none font-bold text-sm text-center" required />
                            <button type="button" onClick={() => adjustEditingDate(1)} className="p-2 hover:bg-accent/10 text-accent rounded-lg transition-all"><ChevronRightIcon className="w-5 h-5" /></button>
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Cuenta</label>
                            <select value={editingRecord.accountType} onChange={e => setEditingRecord({...editingRecord, accountType: e.target.value as any})} className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border outline-none font-bold text-xs uppercase">
                                <option value="cash">Caja Efectivo</option>
                                <option value="qr">Bancolombia (QR)</option>
                                <option value="bank">Bancos / Otros</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Concepto / Descripción</label>
                            <input type="text" value={editingRecord.description} onChange={e => setEditingRecord({...editingRecord, description: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border outline-none font-bold text-sm" required />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
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
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase">Sede Relacionada</label>
                                <select value={editingRecord.debtStoreId || ''} onChange={e => setEditingRecord({...editingRecord, debtStoreId: e.target.value || undefined})} className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border outline-none font-bold text-[10px] uppercase border-yellow-500/50">
                                    <option value="">Ninguna</option>
                                    {stores.filter(s => s.id !== activeStoreId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
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
                    <div className="p-6 bg-accent text-white flex justify-between items-center"><div className="flex items-center gap-3"><PlusCircleIcon className="w-8 h-8" /><h3 className="text-2xl font-black uppercase tracking-widest">Movimientos Manuales</h3></div><button onClick={() => setShowAddModal(false)}><CrossIcon className="w-8 h-8" /></button></div>
                    <div className="flex-grow overflow-auto p-6">
                        <div className="space-y-3">
                            <div className="hidden md:grid grid-cols-12 gap-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <div className="col-span-3">Fecha</div><div className="col-span-1">Cuenta</div><div className="col-span-1 text-center">Modo</div><div className="col-span-2">Concepto</div><div className="col-span-2">Categoría (Auto)</div><div className="col-span-2 text-right">Monto / Cruce</div><div className="col-span-1"></div>
                            </div>
                            {manualEntries.map((entry) => {
                                const amountVal = parseFloat(entry.amount);
                                const isExpense = amountVal < 0;
                                return (
                                <div key={entry.tempId} className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border transition-all ${entry.isSplit ? 'border-yellow-500 shadow-md ring-2 ring-yellow-500/10' : 'border-gray-100 dark:border-gray-700'} animate-fade-in`}>
                                    <div className="col-span-3 flex items-center gap-1">
                                        <button onClick={() => adjustEntryDate(entry.tempId, -1)} className="p-2 hover:bg-accent/10 text-accent rounded-lg transition-all"><ChevronLeftIcon className="w-5 h-5" /></button>
                                        <input type="date" value={entry.date} onChange={e => handleUpdateEntryField(entry.tempId, 'date', e.target.value)} className="flex-grow bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-sm text-center" />
                                        <button onClick={() => adjustEntryDate(entry.tempId, 1)} className="p-2 hover:bg-accent/10 text-accent rounded-lg transition-all"><ChevronRightIcon className="w-5 h-5" /></button>
                                    </div>
                                    <div className="col-span-1"><select value={entry.accountType} onChange={e => handleUpdateEntryField(entry.tempId, 'accountType', e.target.value as any)} className="w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-[10px] uppercase"><option value="cash">Efec</option><option value="qr">Banc</option><option value="bank">Otro</option></select></div>
                                    <div className="col-span-1 space-y-2">
                                        <label className="flex items-center justify-center gap-1 cursor-pointer">
                                            <input type="checkbox" checked={entry.isSplit} onChange={e => handleUpdateEntryField(entry.tempId, 'isSplit', e.target.checked)} className="rounded text-yellow-500 h-3 w-3" />
                                            <span className="text-[9px] font-black uppercase text-gray-500">Split</span>
                                        </label>
                                        <div className="text-center">
                                            {entry.amount && (
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${isExpense ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                                                    {isExpense ? 'Gasto' : 'Ingreso'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-2"><input type="text" value={entry.description} onChange={e => handleUpdateEntryField(entry.tempId, 'description', e.target.value)} placeholder="¿De qué trata?" className="w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-sm" /></div>
                                    <div className="col-span-2">
                                        <div className="relative group">
                                            <input type="text" value={entry.subCategory} onChange={e => handleUpdateEntryField(entry.tempId, 'subCategory', e.target.value)} placeholder="Categoría..." className="w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-bold text-[10px] uppercase text-accent border-accent/20" />
                                            <SparklesIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-accent animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <div className="relative">
                                            <input type="text" value={formatInputDisplay(entry.amount)} onChange={e => handleUpdateEntryField(entry.tempId, 'amount', e.target.value)} placeholder={entry.isSplit ? "Total Lote $" : "Monto $"} className={`w-full bg-white dark:bg-gray-800 p-2 rounded-xl border outline-none font-black text-sm text-right ${isExpense ? 'text-red-500' : 'text-green-600'}`} />
                                            {entry.isSplit && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-400 uppercase">Total</span>}
                                        </div>
                                        {entry.isSplit && (
                                            <div className="space-y-1 border-t pt-1 border-yellow-500/20">
                                                <div className="relative">
                                                    <input type="text" value={formatInputDisplay(entry.otherAmount || '')} onChange={e => handleUpdateEntryField(entry.tempId, 'otherAmount', e.target.value)} placeholder="Para la otra sede $" className="w-full bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-xl border border-yellow-500/30 outline-none font-black text-sm text-right text-yellow-600" />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-yellow-500 uppercase">Ajeno</span>
                                                </div>
                                                <select value={entry.debtStoreId} onChange={e => handleUpdateEntryField(entry.tempId, 'debtStoreId', e.target.value)} className="w-full bg-white dark:bg-gray-800 p-1 rounded-xl border outline-none font-bold text-[8px] uppercase border-yellow-500/50" required={entry.isSplit}>
                                                    <option value="">¿A qué sede?</option>
                                                    {stores.filter(s => s.id !== activeStoreId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                                {entry.amount && entry.otherAmount && (
                                                    <div className="flex justify-between px-2 text-[9px] font-black uppercase text-gray-400 italic">
                                                        <span>Local:</span>
                                                        <span>{formatCOP(parseFloat(entry.amount) - parseFloat(entry.otherAmount || '0'))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!entry.isSplit && (
                                            <select value={entry.debtStoreId} onChange={e => handleUpdateEntryField(entry.tempId, 'debtStoreId', e.target.value)} className="w-full bg-white dark:bg-gray-800 p-1 rounded-xl border outline-none font-bold text-[8px] uppercase border-yellow-500/50"><option value="">Sin cruce</option>{stores.filter(s => s.id !== activeStoreId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                                        )}
                                    </div>
                                    <div className="col-span-1 text-center"><button onClick={() => setManualEntries(manualEntries.filter(m => m.tempId !== entry.tempId))} className="p-2 text-gray-300 hover:text-red-500 transition-all"><TrashIcon className="w-5 h-5" /></button></div>
                                </div>
                            )})}
                        </div>
                        <button onClick={handleAddRow} className="w-full mt-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:text-accent hover:border-accent transition-all font-black uppercase tracking-widest"><PlusIcon className="w-6 h-6" /> Añadir otro movimiento</button>
                    </div>
                    <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800 flex justify-end gap-4"><button onClick={() => setShowAddModal(false)} className="px-6 py-4 text-gray-500 font-black uppercase tracking-widest text-xs">Cancelar</button><button onClick={handleSaveManualEntries} className="bg-accent text-white font-black py-4 px-12 rounded-2xl shadow-xl hover:bg-accent-hover transition-all active:scale-95 uppercase tracking-widest text-sm">Guardar Cambios</button></div>
                </div>
            </div>
        )}
    </div>
  );
};

export default FinancialReconciliationView;
