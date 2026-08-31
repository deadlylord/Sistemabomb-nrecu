
import React, { useState, useMemo, useEffect } from 'react';
import { FinancialRecord, Store, Sale, Layaway, PaymentMethod, Payment, Seller, Expense, Incident, IncidentType, View, CartItem } from '../types';
import { formatCOP } from '../constants';
import { DollarIcon, BuildingStorefrontIcon, PlusCircleIcon, TrashIcon, CheckIcon, CrossIcon, SearchIcon, HistoryIcon, ChartBarIcon, PlusIcon, SparklesIcon, AlertTriangleIcon, SwapIcon, TagIcon, EditIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, SettingsIcon, EyeIcon, CopyIcon, ArrowPathIcon } from './Icons';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';

interface FinancialReconciliationViewProps {
  stores: Store[];
  activeStoreId?: string;
  onSetActiveStoreId?: (id: string) => void;
  sales: Sale[];
  layaways: Layaway[];
  expenses: Expense[];
  incidents: Incident[];
  currentUser: Seller;
  onNavigate?: (view: View) => void;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateStore?: (store: Store) => void;
}

type AccountType = 'cash' | 'qr' | 'addi' | 'sistecredito';

interface TransactionDetail {
    id: string;
    time: string;
    amount: number;
    description: string;
    type: 'Venta' | 'Abono' | 'Ajuste';
}

interface DailySystemTotal {
    cash: number;
    qr: number;
    addi: number;
    sistecredito: number;
    date: string;
    details: string[];
    transactions: {
        cash: TransactionDetail[];
        qr: TransactionDetail[];
        addi: TransactionDetail[];
        sistecredito: TransactionDetail[];
    };
}

interface ManualEntry {
    tempId: string;
    date: string;
    time: string; 
    amount: string; 
    cruceAmount?: string; // Parte que corresponde al otro local
    description: string;
    accountType: AccountType;
    subCategory: string;
    debtStoreId?: string;
    mirrorCategory?: string; 
    physicalStoreId: string; 
}

interface PaymentSummaryData {
    targetStoreId: string;
    targetStoreName: string;
    amount: number;
    sourceAccount: AccountType;
    debtReferenceDates: string; 
    history: FinancialRecord[];
}

const STATIC_CATEGORIES: Record<string, string[]> = {
    'Servicios': ['luz', 'agua', 'gas', 'internet', 'claro', 'tigo', 'movistar', 'energia', 'vanti', 'acueducto'],
    'Local/Arriendo': ['arriendo', 'canon', 'administracion', 'local', 'alquiler'],
    'Personal': ['nomina', 'sueldo', 'pago', 'bono', 'comision', 'auxilio'],
    'Mantenimiento': ['arreglo', 'reparacion', 'pintura', 'limpieza', 'aseo', 'insumos', 'bombillo'],
    'Papelería/Bolsas': ['bolsas', 'papel', 'lapicero', 'impresion', 'cinta', 'empaque'],
    'Logística': ['transporte', 'flete', 'domicilio', 'envio', 'servientrega', 'interrapidisimo', 'uber', 'taxi'],
    'Mercancía/Compras': ['mercancia', 'prendas', 'ropa', 'pedido', 'compra', 'lote', 'proveedor'],
    'Otros': []
};

const EXCLUDED_OPERATING_CATEGORIES = ['MERCANCIA', 'COMPRA MERCANCIA', 'INVENTARIO', 'ACTIVOS', 'INVERSION'];

const cleanObject = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

const FinancialReconciliationView: React.FC<FinancialReconciliationViewProps> = ({ stores, activeStoreId: propsActiveStoreId, onSetActiveStoreId, sales, layaways, expenses, incidents, currentUser, onNavigate, onAddExpense }) => {
  const filteredStores = useMemo(() => stores.filter(s => !(s.name || '').toLowerCase().includes('training')), [stores]);
  const [internalActiveStoreId, setInternalActiveStoreId] = useState<string>(currentUser.storeId || filteredStores[0]?.id || '');
  
  const activeStoreId = propsActiveStoreId || internalActiveStoreId;
  const setActiveStoreId = onSetActiveStoreId || setInternalActiveStoreId;

  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [allRecords, setAllRecords] = useState<FinancialRecord[]>([]);
  const [activeTab, setActiveTab] = useState<AccountType>('cash');
  const [closuresActiveTab, setClosuresActiveTab] = useState<AccountType>('cash');
  const [sisteRangeStart, setSisteRangeStart] = useState('');
  const [sisteRangeEnd, setSisteRangeEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtros de fecha adicionales para la tabla principal
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  // Filtro de tipo de movimiento (Ingreso / Egreso) sincronizado con las pestañas de resumen
  const [financeTypeFilter, setFinanceTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [summaryActiveTab, setSummaryActiveTab] = useState<'expense' | 'income'>('expense');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isSystemLoadsOpen, setIsSystemLoadsOpen] = useState(true);
  const [isDebtsSectionOpen, setIsDebtsSectionOpen] = useState(true);
  const [showBothClosures, setShowBothClosures] = useState(false);
  const [showGlobalSummary, setShowGlobalSummary] = useState(false);
  const [expandedDebtStoreId, setExpandedDebtStoreId] = useState<string | null>(null);
  const [expandedSystemLoadId, setExpandedSystemLoadId] = useState<string | null>(null); 
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummaryData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const [isEditingNames, setIsEditingNames] = useState(false);
  const [tempAccountNames, setTempAccountNames] = useState({ cash: '', qr: '', addi: '' });
  const [tempInitialBalances, setTempInitialBalances] = useState({ cash: 0, qr: 0, addi: 0 });

  // Historial y restauración de auditoría para el libro mayor
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyActionFilter, setHistoryActionFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'restore'>('all');

  const getLocalDateString = (dateInput: string | Date) => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && dateInput.length === 10 && dateInput.includes('-') && !dateInput.includes('T')) {
        return dateInput;
    }
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const activeStore = useMemo(() => stores.find(s => s.id === activeStoreId), [activeStoreId, stores]);
  const isAdmin = currentUser.roleId === '1';

  const years = useMemo(() => {
    const currentY = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentY - 2 + i);
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  
  const [editingRecord, setEditingRecord] = useState<(FinancialRecord & { amountString?: string, timeString?: string, dateString?: string }) | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FinancialRecord | null>(null);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  useEffect(() => {
    const q = query(collection(db, 'financialRecords'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FinancialRecord));
        setAllRecords(list);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'financialRecordsHistory'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        setHistoryLogs(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeStoreId) return;
    const list = allRecords.filter(r => r.storeId === activeStoreId);
    setRecords(list.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return timeB - timeA || b.id.localeCompare(a.id);
    }));
  }, [activeStoreId, allRecords]);

  const learnedKnowledge = useMemo(() => {
    const directMap: Record<string, string> = {};
    const keywordWeight: Record<string, Record<string, number>> = {};

    records.forEach(r => {
        if (!r.subCategory || r.subCategory === 'Cierre Diario' || r.subCategory === 'Manual') return;
        const desc = r.description.toLowerCase().trim();
        directMap[desc] = r.subCategory;
        const words = desc.split(/\s+/).filter(w => w.length > 3);
        words.forEach(word => {
            if (!keywordWeight[word]) keywordWeight[word] = {};
            keywordWeight[word][r.subCategory] = (keywordWeight[word][r.subCategory] || 0) + 1;
        });
    });
    return { directMap, keywordWeight };
  }, [records]);

  const autoCategorize = (desc: string): string => {
      const lowerDesc = desc.toLowerCase().trim();
      if (!lowerDesc) return '';
      if (learnedKnowledge.directMap[lowerDesc]) return learnedKnowledge.directMap[lowerDesc];
      const words = lowerDesc.split(/\s+/).filter(w => w.length > 3);
      for (const word of words) {
          if (learnedKnowledge.keywordWeight[word]) {
              const bestCat = Object.entries(learnedKnowledge.keywordWeight[word])
                  .sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0][0];
              return bestCat;
          }
      }
      for (const [cat, keywords] of Object.entries(STATIC_CATEGORIES)) {
          if (keywords.some(k => lowerDesc.includes(k))) return cat;
      }
      return 'Otros';
  };

  const categoryStats = useMemo(() => {
      const expenseStats: Record<string, { total: number, accounts: Record<string, number> }> = {};
      const incomeStats: Record<string, { total: number, accounts: Record<string, number> }> = {};
      const startOfMonth = new Date(selectedYear, selectedMonth, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      records.forEach(r => {
          const d = new Date(r.date);
          if (d.getTime() >= startOfMonth.getTime() && d.getTime() <= endOfMonth.getTime()) {
              const rawCat = r.subCategory || 'Sin Categoría';
              // Normalizar categoría (Mayúsculas y sin espacios extra)
              const cat = rawCat.trim().toUpperCase();
              const account = r.accountType || 'cash';
              
              if (r.amount < 0 && r.subCategory !== 'Cruce Sedes') {
                if (!expenseStats[cat]) expenseStats[cat] = { total: 0, accounts: {} };
                expenseStats[cat].total += Math.abs(r.amount);
                expenseStats[cat].accounts[account] = (expenseStats[cat].accounts[account] || 0) + Math.abs(r.amount);
              } else if (r.amount > 0 && r.subCategory !== 'Cruce Sedes') {
                if (!incomeStats[cat]) incomeStats[cat] = { total: 0, accounts: {} };
                incomeStats[cat].total += r.amount;
                incomeStats[cat].accounts[account] = (incomeStats[cat].accounts[account] || 0) + r.amount;
              }
          }
      });

      const transform = (stats: Record<string, { total: number, accounts: Record<string, number> }>) => Object.entries(stats)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, data]) => ({ 
            name, 
            value: data.total, 
            accounts: data.accounts 
        }));

      return {
          expenses: transform(expenseStats),
          incomes: transform(incomeStats)
      };
  }, [records, selectedMonth, selectedYear]);

  const interStoreBalances = useMemo(() => {
      const balances: Record<string, { total: number, cash: number, qr: number, storeId: string, history: FinancialRecord[] }> = {};
      records.forEach(r => {
          const otherStoreId = r.debtStoreId;
          if (otherStoreId) {
              if (!balances[otherStoreId]) balances[otherStoreId] = { total: 0, cash: 0, qr: 0, storeId: otherStoreId, history: [] };
              const b = balances[otherStoreId]!;
              const subCatLower = (r.subCategory || '').toLowerCase();
              const isInterStore = subCatLower === 'préstamo a sede' || 
                                  subCatLower === 'cruce sedes' || 
                                  subCatLower.startsWith('cruce') || 
                                  subCatLower.includes('préstamo');
              const netImpact = isInterStore ? -r.amount : r.amount;
              b.total += netImpact;
              b.history.push({ ...r, netImpact } as any);
              if (r.accountType === 'cash') b.cash += netImpact;
              else if (r.accountType === 'qr' || r.accountType === 'addi') b.qr += netImpact;
          }
      });
      return Object.entries(balances).map(([otherStoreId, stats]) => {
          const sortedHistory = stats.history.sort((a: any, b: any) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime() || a.id.localeCompare(b.id));
          let runningBalance = 0;
          const historyWithBalance = sortedHistory.map(r => {
              runningBalance += (r as any).netImpact || 0;
              return { ...r, runningBalance };
          });

          return {
              otherStoreName: filteredStores.find(s => s.id === otherStoreId)?.name || 'Local',
              storeId: otherStoreId,
              ...stats,
              history: historyWithBalance.sort((a: any, b: any) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime() || b.id.localeCompare(a.id))
          };
      }).filter(s => Math.abs(s.total) > 0.1);
  }, [records, filteredStores]);

  const globalDebtsSummary = useMemo(() => {
      let toCollect = 0; let toPay = 0;
      interStoreBalances.forEach(b => { if (b.total > 0) toCollect += b.total; else toPay += Math.abs(b.total); });
      return { toCollect, toPay };
  }, [interStoreBalances]);

  const globalStoreSummaries = useMemo(() => {
    return filteredStores.map(store => {
      const storeRecords = allRecords.filter(r => r.storeId === store.id);
      
      const cashBalance = (store.initialBalances?.cash || 0) + 
        storeRecords.filter(r => r.accountType === 'cash' && r.affectsCashBalance !== false)
                    .reduce((acc, r) => acc + r.amount, 0);
                    
      const qrBalance = (store.initialBalances?.qr || 0) + (store.initialBalances?.addi || 0) + 
        storeRecords.filter(r => (r.accountType === 'qr' || r.accountType === 'addi') && r.affectsCashBalance !== false)
                    .reduce((acc, r) => acc + r.amount, 0);

      let totalToCollect = 0;
      let totalDebts = 0;
      
      const balances: Record<string, number> = {};
      storeRecords.forEach(r => {
        if (r.debtStoreId) {
          const subCatLower = (r.subCategory || '').toLowerCase();
          const isInterStore = subCatLower === 'préstamo a sede' || 
                              subCatLower === 'cruce sedes' || 
                              subCatLower.startsWith('cruce') || 
                              subCatLower.includes('préstamo');
          const netImpact = isInterStore ? -r.amount : r.amount;
          balances[r.debtStoreId] = (balances[r.debtStoreId] || 0) + netImpact;
        }
      });
      
      Object.values(balances).forEach(val => {
        if (val > 0) totalToCollect += val;
        else totalDebts += Math.abs(val);
      });

      const storeBalances: { storeId: string, storeName: string, balance: number }[] = [];
      Object.entries(balances).forEach(([id, val]) => {
          const s = stores.find(st => st.id === id);
          if (s) storeBalances.push({ storeId: id, storeName: s.name, balance: val });
      });

      return {
        storeId: store.id,
        storeName: store.name,
        cashBalance,
        qrBalance,
        totalDebts,
        totalToCollect,
        storeBalances,
        netBalance: cashBalance + qrBalance + totalToCollect - totalDebts
      };
    });
  }, [filteredStores, allRecords]);

  const dailySystemTotals = useMemo(() => {
    const totalsMap = new Map<string, DailySystemTotal>();
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

    const getExisting = (dateStr: string): DailySystemTotal => {
        return totalsMap.get(dateStr) || { 
            cash: 0, qr: 0, addi: 0, sistecredito: 0, date: dateStr, details: [], 
            transactions: { cash: [], qr: [], addi: [], sistecredito: [] } 
        };
    }

    const processPayment = (p: Payment, type: 'Venta' | 'Abono', refId: string, customer: string, index: number) => {
        const pDate = new Date(p.date);
        let reconciliationDate = new Date(pDate);
        let amount = Number(p.amount) || 0;
        let description = `${type} [${p.method.toUpperCase()}] ${customer}`;

        // Aplicar comisión si existe para el medio de pago
        const commission = activeStore?.paymentCommissions?.[p.method] || 0;
        if (commission > 0) {
            const originalAmount = amount;
            amount = amount * (1 - commission);
            description = `${type} [${p.method.toUpperCase()}] ${customer} (Venta: ${getLocalDateString(p.date)}) - Valor: ${formatCOP(originalAmount)} | Neto: ${formatCOP(amount)}`;
        }

        if (reconciliationDate.getTime() < startOfMonth.getTime() || reconciliationDate.getTime() > endOfMonth.getTime()) return;
        
        const dateStr = getLocalDateString(reconciliationDate);
        const existing = getExisting(dateStr);
        const time = p.date.split('T')[1]?.slice(0, 5) || '--:--';
        
        const detail: TransactionDetail = {
            id: `${refId}_${index}`,
            time,
            amount,
            description,
            type
        };

        if (p.method === PaymentMethod.Efectivo) {
            existing.cash += amount;
            existing.transactions.cash.push(detail);
        } else if (p.method === PaymentMethod.QR) {
            existing.qr += amount;
            existing.transactions.qr.push(detail);
        } else if (p.method === PaymentMethod.Addi) {
            existing.addi += amount;
            existing.transactions.addi.push(detail);
        } else if (p.method === PaymentMethod.Sistecredito) {
            existing.sistecredito += amount;
            existing.transactions.sistecredito.push(detail);
        }
        totalsMap.set(dateStr, existing);
    };

    sales.filter(s => s.storeId === activeStoreId).forEach(sale => {
        const payments = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})) as Payment[];
        if (payments.length > 0) payments.forEach((p, idx) => processPayment(p, 'Venta', sale.id, sale.customerName, idx));
        else if (sale.paymentMethod) processPayment({ amount: sale.totalAmount, method: sale.paymentMethod, date: sale.createdAt, seller: sale.seller }, 'Venta', sale.id, sale.customerName, 0);
    });

    layaways.filter(l => l.storeId === activeStoreId).forEach(layaway => {
        const payments = (Array.isArray(layaway.payments) ? layaway.payments : Object.values(layaway.payments || {})) as Payment[];
        payments.forEach((p, idx) => processPayment(p, 'Abono', layaway.id, layaway.customerName, idx));
    });

    incidents.filter(i => i.storeId === activeStoreId && i.adjustmentAmount && i.adjustmentAmount > 0).forEach(incident => {
        const d = new Date(incident.createdAt);
        if (d.getTime() < startOfMonth.getTime() || d.getTime() > endOfMonth.getTime()) return;
        const dateStr = getLocalDateString(incident.createdAt);
        const existing = getExisting(dateStr);
        const amount = Number(incident.adjustmentAmount);
        const isExpense = incident.adjustmentType === 'expense';
        const finalAmount = isExpense ? -amount : amount;
        const method = incident.paymentMethod || PaymentMethod.Efectivo;
        const time = incident.createdAt.split('T')[1]?.slice(0, 5) || '--:--';
        
        const detail: TransactionDetail = {
            id: incident.id,
            time,
            amount: finalAmount,
            description: `Ajuste ${incident.type}`,
            type: 'Ajuste'
        };

        if (method === PaymentMethod.Efectivo) {
            existing.cash += finalAmount;
            existing.transactions.cash.push(detail);
        } else if (method === PaymentMethod.QR) {
            existing.qr += finalAmount;
            existing.transactions.qr.push(detail);
        }
        existing.details.push(`Ajuste ${incident.type}: ${isExpense ? '-' : '+'}${formatCOP(amount)}`);
        totalsMap.set(dateStr, existing);
    });

    return Array.from(totalsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, layaways, incidents, activeStoreId, selectedMonth, selectedYear, stores]);

  const hasMismatches = useMemo(() => {
    return dailySystemTotals.some(item => {
        const cashRecord = records.find(r => r.id === `daily_auto_${activeStoreId}_cash_${item.date}`);
        const qrRecord = records.find(r => r.id === `daily_auto_${activeStoreId}_qr_${item.date}`);
        const addiRecord = records.find(r => r.id === `daily_auto_${activeStoreId}_addi_${item.date}`);
        const sisteRecord = records.find(r => r.id === `daily_auto_${activeStoreId}_sistecredito_${item.date}`);
        
        return (cashRecord && Math.abs(cashRecord.amount - item.cash) > 0.1) ||
               (qrRecord && Math.abs(qrRecord.amount - item.qr) > 0.1) ||
               (addiRecord && Math.abs(addiRecord.amount - item.addi) > 0.1) ||
               (sisteRecord && Math.abs(sisteRecord.amount - item.sistecredito) > 0.1);
    });
  }, [dailySystemTotals, records, activeStoreId]);

  const syncAllMismatches = async () => {
    if (!window.confirm('¿Deseas actualizar todos los cierres que tienen diferencias con el sistema para este mes?')) return;
    
    const batch = writeBatch(db);
    let count = 0;

    dailySystemTotals.forEach(item => {
        const checkAndUpdate = (type: AccountType, amount: number, idPrefix?: string) => {
            const recordId = `daily_auto_${activeStoreId}_${idPrefix || type}_${item.date}`;
            const existing = records.find(r => r.id === recordId);
            if (existing && Math.abs(existing.amount - amount) > 0.1) {
                const updatedFields = { 
                    amount: amount,
                    description: `Cierre Diario ${idPrefix === 'addi' ? 'Addi' : (idPrefix === 'sistecredito' ? 'Sistecredito' : getAccountName(type))} (${item.date}) [SINCRONIZADO]`
                };
                batch.update(doc(db, 'financialRecords', recordId), updatedFields);

                const historyRef = doc(collection(db, 'financialRecordsHistory'));
                batch.set(historyRef, {
                    id: historyRef.id,
                    recordId: recordId,
                    action: 'update',
                    timestamp: new Date().toISOString(),
                    changedBy: currentUser.name,
                    previousState: existing,
                    newState: { ...existing, ...updatedFields },
                    storeId: activeStoreId,
                    accountType: type
                });
                count++;
            }
        };

        checkAndUpdate('cash', item.cash);
        checkAndUpdate('qr', item.qr);
        checkAndUpdate('qr', item.addi, 'addi');
        checkAndUpdate('qr', item.sistecredito, 'sistecredito');
    });

    if (count > 0) {
        try {
            await batch.commit();
            alert(`${count} registros actualizados correctamente.`);
        } catch (error) {
            console.error("Error syncing mismatches:", error);
            alert("Error al sincronizar los registros.");
        }
    } else {
        alert("No se encontraron diferencias para actualizar.");
    }
  };

  const getAccountName = (type: AccountType): string => {
    if (type === 'addi') return 'Addi';
    if (type === 'sistecredito') return 'Sistecredito';
    if (activeStore?.accountNames?.[type as any]) return (activeStore.accountNames as any)[type];
    if (type === 'cash') return 'Efectivo';
    if (type === 'qr') return 'Bancolombia (QR)';
    return 'Bancos';
  };

  const handleOpenEditNames = () => {
    setTempAccountNames({
        cash: activeStore?.accountNames?.cash || 'Efectivo',
        qr: activeStore?.accountNames?.qr || 'Bancolombia (QR)',
        addi: activeStore?.accountNames?.addi || 'Addi'
    });
    setTempInitialBalances({
        cash: activeStore?.initialBalances?.cash || 0,
        qr: activeStore?.initialBalances?.qr || 0,
        addi: activeStore?.initialBalances?.addi || 0,
        sistecredito: (activeStore?.initialBalances as any)?.sistecredito || 0
    });
    setIsEditingNames(true);
  };

  const handleSaveAccountNames = async () => {
    if (!activeStoreId) return;
    try {
        await updateDoc(doc(db, 'stores', activeStoreId), {
            accountNames: tempAccountNames,
            initialBalances: tempInitialBalances
        });
        setIsEditingNames(false);
    } catch (error) {
        console.error("Error saving account settings:", error);
        alert("Error al guardar los ajustes de la sede.");
    }
  };

  const confirmDailyTotal = async (dateStr: string, amount: number, accountType: AccountType, transaction?: TransactionDetail, idPrefix?: string) => {
    const recordId = transaction 
        ? `trans_auto_${transaction.id}`
        : `daily_auto_${activeStoreId}_${idPrefix || accountType}_${dateStr}`;
    
    const existing = allRecords.find(r => r.id === recordId);
    
    if (existing) {
        // Si el monto o la cuenta cambiaron, permitimos actualizar el registro
        if (existing.amount !== amount || (existing.accountType !== accountType && !idPrefix)) {
            const diffMsg = existing.amount !== amount 
                ? `El monto del sistema (${formatCOP(amount)}) es diferente al conciliado (${formatCOP(existing.amount)}).`
                : `La cuenta del sistema (${accountType}) es diferente a la conciliada (${existing.accountType}).`;

            if (window.confirm(`${diffMsg} ¿Deseas actualizar el registro de conciliación?`)) {
                const updatedFields = { 
                    amount: amount,
                    accountType: accountType,
                    description: transaction 
                        ? `${transaction.description} (${getAccountName(accountType)}) [ACTUALIZADO]`
                        : `Cierre Diario ${idPrefix === 'addi' ? 'Addi' : (idPrefix === 'sistecredito' ? 'Sistecredito' : getAccountName(accountType))} (${dateStr}) [ACTUALIZADO]`
                };
                await updateDoc(doc(db, 'financialRecords', recordId), updatedFields);

                const historyRef = doc(collection(db, 'financialRecordsHistory'));
                await setDoc(historyRef, {
                    id: historyRef.id,
                    recordId: recordId,
                    action: 'update',
                    timestamp: new Date().toISOString(),
                    changedBy: currentUser.name,
                    previousState: existing,
                    newState: { ...existing, ...updatedFields },
                    storeId: activeStoreId,
                    accountType: accountType
                });
            }
            return;
        }
        
        if (transaction) {
            alert("Esta transacción ya fue conciliada y coincide con el sistema.");
            return;
        }
        
        alert("Este total diario ya fue conciliado y coincide con el sistema."); 
        return; 
    }

    let typeLabel = idPrefix === 'addi' ? 'Addi' : (idPrefix === 'sistecredito' ? 'Sistecredito' : getAccountName(accountType));
    const dateTime = transaction ? `${dateStr}T${transaction.time}:00` : `${dateStr}T23:59:59`;
    const description = transaction 
        ? `${transaction.description} (${typeLabel})`
        : `Cierre Diario ${typeLabel} (${dateStr})`;

    const newRecord: FinancialRecord = { 
        id: recordId, 
        date: dateTime, 
        storeId: activeStoreId, 
        accountType: accountType as any, 
        amount: amount, 
        type: 'income_sales', 
        description: description, 
        subCategory: transaction ? 'Venta Individual' : (idPrefix === 'addi' ? 'Cierre Addi' : 'Cierre Diario'), 
        registeredBy: currentUser.name, 
        isConfirmed: true, 
        affectsCashBalance: true 
    };
    await setDoc(doc(db, 'financialRecords', recordId), newRecord);

    const historyRef = doc(collection(db, 'financialRecordsHistory'));
    await setDoc(historyRef, {
        id: historyRef.id,
        recordId: recordId,
        action: 'create',
        timestamp: new Date().toISOString(),
        changedBy: currentUser.name,
        newState: newRecord,
        storeId: activeStoreId,
        accountType: accountType
    });
  };

  const initialBalanceValue = useMemo(() => {
    if (!activeStore || !activeStore.initialBalances) return 0;
    return activeStore.initialBalances[activeTab] || 0;
  }, [activeStore, activeTab]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
        const matchesAccount = r.accountType === activeTab;
        const matchesSearch = r.description.toLowerCase().includes(searchTerm.toLowerCase()) || (r.subCategory && r.subCategory.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Filtro de rango de fechas
        const rDate = new Date(r.date);
        const start = ledgerStartDate ? new Date(ledgerStartDate + 'T00:00:00') : null;
        const end = ledgerEndDate ? new Date(ledgerEndDate + 'T23:59:59') : null;
        const matchesDate = (!start || rDate >= start) && (!end || rDate <= end);

        // Filtro de tipo (Ingreso / Egreso)
        let matchesType = true;
        if (financeTypeFilter === 'income') matchesType = r.amount > 0;
        else if (financeTypeFilter === 'expense') matchesType = r.amount < 0;

        return matchesAccount && matchesSearch && matchesDate && matchesType;
    });
  }, [records, activeTab, searchTerm, ledgerStartDate, ledgerEndDate, financeTypeFilter]);

  const currentBalance = useMemo(() => {
      // El saldo real se calcula siempre sobre TODOS los registros de la cuenta para ser consistente
      const recordsSum = records
        .filter(r => r.accountType === activeTab && r.affectsCashBalance !== false)
        .reduce((sum, r) => sum + r.amount, 0);
      return initialBalanceValue + recordsSum;
  }, [records, activeTab, initialBalanceValue]);

  // Totales visibles (para el pie de tabla)
  const visibleTotals = useMemo(() => {
    return filteredRecords.reduce((acc, r) => {
        if (r.amount > 0) acc.income += r.amount;
        else acc.expense += Math.abs(r.amount);
        acc.net += r.amount;
        return acc;
    }, { income: 0, expense: 0, net: 0 });
  }, [filteredRecords]);

  const recordsWithBalance = useMemo(() => {
    const sorted = [...filteredRecords].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id));
    let runningBalance = initialBalanceValue;
    
    // Para mostrar el saldo dinámico, necesitamos calcularlo basado en el historial completo de la cuenta
    // no solo en los filtrados, o de lo contrario el saldo "salta" visualmente.
    const accountHistory = records
        .filter(r => r.accountType === activeTab)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id));

    const balanceMap = new Map<string, number>();
    let rolling = initialBalanceValue;
    accountHistory.forEach(r => {
        if (r.affectsCashBalance !== false) rolling += r.amount;
        balanceMap.set(r.id, rolling);
    });

    return filteredRecords.map(r => ({ ...r, saldo: balanceMap.get(r.id) || 0 })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id.localeCompare(a.id));
  }, [filteredRecords, records, activeTab, initialBalanceValue]);

  const handleAddRow = () => {
    const lastEntry = manualEntries[manualEntries.length - 1];
    const date = lastEntry ? lastEntry.date : getLocalDateString(new Date());
    const time = lastEntry ? lastEntry.time : new Date().toTimeString().slice(0, 5);

    setManualEntries([...manualEntries, {
        tempId: Math.random().toString(36).substr(2, 9),
        date: date,
        time: time,
        amount: '',
        cruceAmount: '',
        description: '',
        accountType: activeTab,
        subCategory: '',
        debtStoreId: '',
        mirrorCategory: '',
        physicalStoreId: activeStoreId 
    }]);
  };

  const handleDuplicateRow = (tempId: string) => {
    const index = manualEntries.findIndex(e => e.tempId === tempId);
    if (index === -1) return;
    
    const entryToClone = manualEntries[index];
    const newEntries = [...manualEntries];
    newEntries.splice(index + 1, 0, {
        ...entryToClone,
        tempId: Math.random().toString(36).substr(2, 9),
    });
    
    setManualEntries(newEntries);
  };

  const initiateSettlement = (targetStoreId: string, targetStoreName: string, amount: number, sourceAccount: AccountType, history: FinancialRecord[]) => {
      const dates = [...new Set(history.map(h => getLocalDateString(h.date)))].sort().join(', ');
      setPaymentSummary({
          targetStoreId,
          targetStoreName,
          amount,
          sourceAccount,
          debtReferenceDates: dates,
          history
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
          const mirrorRef = doc(collection(db, 'financialRecords'));
          const mainRecord: FinancialRecord = { id: mainRef.id, date: nowIso, storeId: activeStoreId, accountType: sourceAccount, amount: -amount, type: 'expense', description: `Cruce ${targetStoreName}: Pago deuda ref. ${debtReferenceDates}`, subCategory: 'Cruce Sedes', registeredBy: currentUser.name, isConfirmed: true, debtStoreId: targetStoreId, affectsCashBalance: true };
          const mirrorRecord: FinancialRecord = { id: mirrorRef.id, date: nowIso, storeId: targetStoreId, accountType: sourceAccount, amount: amount, type: 'income_manual', description: `Cruce ${activeStoreName}: Recibo pago deuda ref. ${debtReferenceDates}`, subCategory: 'Cruce Sedes', registeredBy: `${currentUser.name} (vía ${activeStoreName})`, isConfirmed: true, debtStoreId: activeStoreId, relatedRecordId: mainRef.id, affectsCashBalance: true };
          mainRecord.relatedRecordId = mirrorRef.id;
          
          batch.set(mainRef, mainRecord); 
          batch.set(mirrorRef, mirrorRecord);

          // Log history
          const hMainRef = doc(collection(db, 'financialRecordsHistory'));
          batch.set(hMainRef, {
              id: hMainRef.id,
              recordId: mainRef.id,
              action: 'create',
              timestamp: nowIso,
              changedBy: currentUser.name,
              newState: cleanObject(mainRecord),
              storeId: activeStoreId,
              accountType: sourceAccount
          });

          const hMirrorRef = doc(collection(db, 'financialRecordsHistory'));
          batch.set(hMirrorRef, {
              id: hMirrorRef.id,
              recordId: mirrorRef.id,
              action: 'create',
              timestamp: nowIso,
              changedBy: `${currentUser.name} (vía ${activeStoreName})`,
              newState: cleanObject(mirrorRecord),
              storeId: targetStoreId,
              accountType: sourceAccount
          });

          await batch.commit();
          setPaymentSummary(null);
      } catch (error) { alert("Hubo un error al registrar el pago."); }
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
            if (field === 'amount' || field === 'cruceAmount') finalValue = parseInputToNumber(value);
            const updated = { ...e, [field]: finalValue };
            if (field === 'description') { const suggestedCat = autoCategorize(value); if (suggestedCat) updated.subCategory = suggestedCat; }
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
              return { ...e, date: getLocalDateString(d) };
          }
          return e;
      }));
  };

  const handleSaveManualEntries = async () => {
    if (manualEntries.length === 0) { alert("Agrega al menos un movimiento antes de procesar."); return; }
    const incompleteEntry = manualEntries.find(e => !e.amount.trim() || !e.description.trim());
    if (incompleteEntry) {
        if (!incompleteEntry.amount.trim() && !incompleteEntry.description.trim()) alert("Hay una fila vacía. Por favor, llénala o elimínala antes de procesar.");
        else if (!incompleteEntry.amount.trim()) alert(`Falta ingresar el MONTO para el movimiento: "${incompleteEntry.description}"`);
        else alert(`Falta ingresar la DESCRIPCIÓN para el movimiento de: ${formatCOP(parseFloat(incompleteEntry.amount))}`);
        return;
    }
    const batch = writeBatch(db);
    const activeStoreName = activeStore?.name || 'Local Actual';
    manualEntries.forEach(e => {
        const totalAmountVal = parseFloat(e.amount);
        const cruceAmountVal = e.cruceAmount ? parseFloat(e.cruceAmount) : totalAmountVal;
        const localAmountVal = totalAmountVal - cruceAmountVal;
        const dateTime = `${e.date}T${e.time}:00`;
        const activeStoreName = activeStore?.name || 'Local Actual';
        const targetStoreName = e.debtStoreId ? filteredStores.find(s => s.id === e.debtStoreId)?.name || 'Otra Sede' : '';

        // 1. Registro Local (si hay remanente)
        if (localAmountVal !== 0 || !e.debtStoreId) {
            const localRef = doc(collection(db, 'financialRecords'));
            const localRecord: FinancialRecord = { 
                id: localRef.id, 
                date: dateTime, 
                storeId: activeStoreId, 
                accountType: e.accountType as any, 
                amount: e.debtStoreId ? localAmountVal : totalAmountVal, 
                type: (e.debtStoreId ? localAmountVal : totalAmountVal) < 0 ? 'expense' : 'income_manual', 
                description: e.description, 
                subCategory: e.subCategory || 'Manual', 
                registeredBy: currentUser.name, 
                isConfirmed: true, 
                affectsCashBalance: true 
            };
            batch.set(localRef, cleanObject(localRecord));

            const historyRef = doc(collection(db, 'financialRecordsHistory'));
            batch.set(historyRef, {
                id: historyRef.id,
                recordId: localRef.id,
                action: 'create',
                timestamp: new Date().toISOString(),
                changedBy: currentUser.name,
                newState: cleanObject(localRecord),
                storeId: activeStoreId,
                accountType: e.accountType
            });
        }

        // 2. Registro de Cruce (si hay deuda)
        if (e.debtStoreId && cruceAmountVal !== 0) {
            const mainRef = doc(collection(db, 'financialRecords'));
            const mirrorRef = doc(collection(db, 'financialRecords'));
            
            const mainSubCategory = e.subCategory === 'Cruce Sedes' ? 'Cruce Sedes' : `Cruce ${targetStoreName}`;
            const affectsMainBalance = e.physicalStoreId === activeStoreId;

            const mainDescription = e.description 
                ? `Cruce ${targetStoreName}: ${e.description}` 
                : `Cruce ${targetStoreName}`;

            const mainRecord: FinancialRecord = { 
                id: mainRef.id, 
                date: dateTime, 
                storeId: activeStoreId, 
                accountType: e.accountType as any, 
                amount: cruceAmountVal, 
                type: cruceAmountVal < 0 ? 'expense' : 'income_manual', 
                description: mainDescription, 
                subCategory: mainSubCategory, 
                registeredBy: currentUser.name, 
                isConfirmed: true, 
                affectsCashBalance: affectsMainBalance, 
                debtStoreId: e.debtStoreId,
                relatedRecordId: mirrorRef.id
            };
            batch.set(mainRef, cleanObject(mainRecord));

            const mainHistoryRef = doc(collection(db, 'financialRecordsHistory'));
            batch.set(mainHistoryRef, {
                id: mainHistoryRef.id,
                recordId: mainRef.id,
                action: 'create',
                timestamp: new Date().toISOString(),
                changedBy: currentUser.name,
                newState: cleanObject(mainRecord),
                storeId: activeStoreId,
                accountType: e.accountType
            });

            const isPureTransfer = !e.subCategory || e.subCategory === 'Cruce Sedes' || e.subCategory === 'Préstamo a Sede' || (e.subCategory && e.subCategory.toLowerCase().startsWith('cruce'));
            const mirrorAmount = isPureTransfer ? -cruceAmountVal : cruceAmountVal;
            const affectsMirrorBalance = e.physicalStoreId === e.debtStoreId;
            const mirrorDescription = e.description ? `Cruce ${activeStoreName}: ${e.description}` : `Cruce ${activeStoreName}`;
            
            const mirrorSubCategory = isPureTransfer 
                ? (e.subCategory === 'Cruce Sedes' ? 'Cruce Sedes' : `Cruce ${activeStoreName}`)
                : (e.subCategory || 'Varios');
            
            const mirrorRecord = { 
                id: mirrorRef.id, 
                date: dateTime, 
                storeId: e.debtStoreId, 
                accountType: e.accountType as any, 
                amount: mirrorAmount, 
                type: mirrorAmount < 0 ? 'expense' : 'income_manual', 
                description: mirrorDescription, 
                subCategory: mirrorSubCategory, 
                registeredBy: `${currentUser.name} (vía ${activeStoreName})`, 
                isConfirmed: true, 
                debtStoreId: activeStoreId, 
                relatedRecordId: mainRef.id, 
                affectsCashBalance: affectsMirrorBalance 
            };
            batch.set(mirrorRef, cleanObject(mirrorRecord));

            const mirrorHistoryRef = doc(collection(db, 'financialRecordsHistory'));
            batch.set(mirrorHistoryRef, {
                id: mirrorHistoryRef.id,
                recordId: mirrorRef.id,
                action: 'create',
                timestamp: new Date().toISOString(),
                changedBy: `${currentUser.name} (vía ${activeStoreName})`,
                newState: cleanObject(mirrorRecord),
                storeId: e.debtStoreId,
                accountType: e.accountType
            });
        }
    });
    await batch.commit();
    setShowAddModal(false); setManualEntries([]);
  };

  const handleOpenEdit = (record: FinancialRecord) => {
      const datePart = getLocalDateString(record.date);
      const timePart = record.date.includes('T') ? record.date.split('T')[1]?.slice(0, 5) : '12:00';
      setEditingRecord({
          ...record,
          amountString: record.amount.toString(),
          dateString: datePart,
          timeString: timePart
      });
  };

  const handleUpdateSingleRecord = async (e: React.FormEvent) => {
      e.preventDefault(); if (!editingRecord) return;
      const { amountString, timeString, dateString, ...recordToSave } = editingRecord;
      if ('saldo' in recordToSave) delete (recordToSave as any).saldo;
      const amountVal = parseFloat(amountString || '0');
      const dateTime = `${dateString || getLocalDateString(new Date())}T${timeString || '12:00'}:00`;
      recordToSave.date = dateTime; recordToSave.amount = amountVal;

      const originalRecord = allRecords.find(r => r.id === recordToSave.id);
      await setDoc(doc(db, 'financialRecords', recordToSave.id), recordToSave, { merge: true });

      if (originalRecord) {
          const historyRef = doc(collection(db, 'financialRecordsHistory'));
          await setDoc(historyRef, {
              id: historyRef.id,
              recordId: recordToSave.id,
              action: 'update',
              timestamp: new Date().toISOString(),
              changedBy: currentUser.name,
              previousState: originalRecord,
              newState: recordToSave,
              storeId: recordToSave.storeId || activeStoreId,
              accountType: recordToSave.accountType
          });
      }

      setEditingRecord(null);
  };

  const handleDeleteRecord = (record: FinancialRecord) => { setRecordToDelete(record); };

  const confirmDelete = async () => {
      if (recordToDelete) {
          const historyRef = doc(collection(db, 'financialRecordsHistory'));
          await setDoc(historyRef, {
              id: historyRef.id,
              recordId: recordToDelete.id,
              action: 'delete',
              timestamp: new Date().toISOString(),
              changedBy: currentUser.name,
              previousState: recordToDelete,
              storeId: recordToDelete.storeId || activeStoreId,
              accountType: recordToDelete.accountType
          });

          await deleteDoc(doc(db, 'financialRecords', recordToDelete.id));
          setRecordToDelete(null);
      }
  };

  const handleRestoreRecord = async (log: any) => {
      const confirmMsg = log.action === 'delete' 
          ? `¿Estás seguro de que deseas restaurar este registro? Se volverá a registrar exactamente como estaba en el libro de caja.`
          : `¿Estás seguro de que deseas volver este registro a su versión anterior? Esto revertirá los cambios hechos por ${log.changedBy}.`;
      if (!window.confirm(confirmMsg)) return;

      try {
          const recordId = log.recordId;
          const recordToRestore = log.previousState;
          if (!recordToRestore) {
              alert("No hay estado anterior capturado para restaurar.");
              return;
          }

          // Fetch the current record first to see if it still exists (and log current state as previousState in the restore log)
          const currentRecord = allRecords.find(r => r.id === recordId);

          // Restore record in Firestore
          await setDoc(doc(db, 'financialRecords', recordId), recordToRestore);

          // Log restore action
          const historyRef = doc(collection(db, 'financialRecordsHistory'));
          await setDoc(historyRef, {
              id: historyRef.id,
              recordId: recordId,
              action: 'restore',
              timestamp: new Date().toISOString(),
              changedBy: currentUser.name,
              previousState: currentRecord || null,
              newState: recordToRestore,
              storeId: log.storeId,
              accountType: log.accountType,
              description: `Restaurado a la versión modificada el ${new Date(log.timestamp).toLocaleString()}`
          });

          alert("Registro restaurado exitosamente.");
      } catch (error) {
          console.error("Error restoring record:", error);
          alert("Hubo un error al restaurar el registro.");
      }
  };

  const handleExportCategoryToAccounting = (name: string, value: number) => {
      if (window.confirm(`¿Deseas exportar el gasto total de "${name}" (${formatCOP(value)}) al módulo de Contabilidad IA para el periodo actual?`)) {
          const targetDate = new Date(selectedYear, selectedMonth + 1, 0, 12, 0, 0).toISOString();
          onAddExpense({ description: `[AUTO-CONCILIADO] Consolidado ${name} ${monthNames[selectedMonth]}`, amount: value, type: 'variable', category: name, date: targetDate, storeId: activeStoreId, registeredBy: `${currentUser.name} (vía Conciliación)`, isRecurring: false });
          alert("Gasto exportado exitosamente. Lo verás reflejado en el reporte PyG.");
      }
  };

  const handleFilterBySummary = (type: 'income' | 'expense', catName: string | null) => {
      setFinanceTypeFilter(type);
      setSearchTerm(catName || '');
  }

  const changeMonth = (delta: number) => {
      let newMonth = selectedMonth + delta;
      let newYear = selectedYear;
      if (newMonth < 0) {
          newMonth = 11;
          newYear--;
      } else if (newMonth > 11) {
          newMonth = 0;
          newYear++;
      }
      setSelectedMonth(newMonth);
      setSelectedYear(newYear);
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-4 lg:px-8">
        {/* Modal de Edición de Nombres de Cuentas */}
        {isEditingNames && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-secondary w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-accent/20">
                    <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-lg font-black text-accent uppercase tracking-widest flex items-center gap-2">
                            <SettingsIcon className="w-5 h-5" /> Nombres de Cuentas
                        </h3>
                        <button onClick={() => setIsEditingNames(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><CrossIcon className="w-6 h-6" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">Personaliza los nombres de las cuentas y sus saldos iniciales para esta sede.</p>
                        
                        <div className="space-y-6">
                            <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30 space-y-4">
                                <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest">Cuenta Efectivo</h4>
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Nombre Personalizado</label>
                                    <input 
                                        type="text" 
                                        value={tempAccountNames.cash} 
                                        onChange={e => setTempAccountNames({...tempAccountNames, cash: e.target.value})}
                                        className="w-full bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-bold text-sm focus:border-green-500"
                                        placeholder="Efectivo"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Saldo Inicial $</label>
                                    <input 
                                        type="number" 
                                        value={tempInitialBalances.cash} 
                                        onChange={e => setTempInitialBalances({...tempInitialBalances, cash: parseFloat(e.target.value) || 0})}
                                        className="w-full bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-black text-sm text-green-600 focus:border-green-500"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Cuenta QR</h4>
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Nombre Personalizado</label>
                                    <input 
                                        type="text" 
                                        value={tempAccountNames.qr} 
                                        onChange={e => setTempAccountNames({...tempAccountNames, qr: e.target.value})}
                                        className="w-full bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-bold text-sm focus:border-blue-500"
                                        placeholder="Bancolombia (QR)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Saldo Inicial $</label>
                                    <input 
                                        type="number" 
                                        value={tempInitialBalances.qr} 
                                        onChange={e => setTempInitialBalances({...tempInitialBalances, qr: parseFloat(e.target.value) || 0})}
                                        className="w-full bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-black text-sm text-blue-600 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Cuenta Addi</h4>
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Nombre Personalizado</label>
                                    <input 
                                        type="text" 
                                        value={tempAccountNames.addi} 
                                        onChange={e => setTempAccountNames({...tempAccountNames, addi: e.target.value})}
                                        className="w-full bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-bold text-sm focus:border-indigo-500"
                                        placeholder="Addi"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Saldo Inicial $</label>
                                    <input 
                                        type="number" 
                                        value={tempInitialBalances.addi} 
                                        onChange={e => setTempInitialBalances({...tempInitialBalances, addi: parseFloat(e.target.value) || 0})}
                                        className="w-full bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-black text-sm text-indigo-600 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button onClick={() => setIsEditingNames(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 transition-all">Cancelar</button>
                            <button onClick={handleSaveAccountNames} className="flex-1 py-3 text-[10px] font-black uppercase text-white bg-accent rounded-xl shadow-lg shadow-accent/20 hover:scale-105 transition-all">Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* Modal de Estado General Global */}
        {showGlobalSummary && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-secondary w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-accent/20 flex flex-col max-h-[90vh]">
                    <div className="p-4 sm:p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 shrink-0">
                        <div>
                            <h3 className="text-lg sm:text-xl font-black text-accent uppercase tracking-widest flex items-center gap-2">
                                <ChartBarIcon className="w-6 h-6" /> Estado General de Sedes
                            </h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Resumen consolidado de saldos y deudas por tienda</p>
                        </div>
                        <button onClick={() => setShowGlobalSummary(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-white dark:bg-gray-800 rounded-full shadow-sm"><CrossIcon className="w-6 h-6" /></button>
                    </div>
                    
                    <div className="p-4 sm:p-6 overflow-y-auto scrollbar-hide space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {globalStoreSummaries.map(summary => (
                                <div key={summary.storeId} className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-accent/30 transition-all group">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase truncate max-w-[150px]">{summary.storeName}</h4>
                                        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${summary.netBalance >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            Neto: {formatCOP(summary.netBalance)}
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-gray-400 font-bold uppercase">Efectivo:</span>
                                            <span className="font-black text-green-600">{formatCOP(summary.cashBalance)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-gray-400 font-bold uppercase">QR:</span>
                                            <span className="font-black text-blue-600">{formatCOP(summary.qrBalance)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-gray-400 font-bold uppercase">Addi:</span>
                                            <span className="font-black text-indigo-600">{formatCOP((summary as any).addiBalance)}</span>
                                        </div>
                                        <div className="h-px bg-gray-200 dark:bg-gray-800 my-1"></div>
                                        
                                        <div className="space-y-1 mt-2">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Saldos Individuales:</p>
                                            {summary.storeBalances.length > 0 ? summary.storeBalances.map(sb => (
                                                <div key={sb.storeId} className="flex justify-between items-center text-[9px]">
                                                    <span className="text-gray-500 font-medium truncate max-w-[100px]">{sb.storeName}:</span>
                                                    <span className={`font-black ${sb.balance > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {sb.balance > 0 ? '+' : ''}{formatCOP(sb.balance)}
                                                    </span>
                                                </div>
                                            )) : <p className="text-[8px] text-gray-400 italic">Sin saldos con otras sedes</p>}
                                        </div>
                                        
                                        <div className="h-px bg-gray-200 dark:bg-gray-800 my-1"></div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-gray-400 font-bold uppercase">Total Por Cobrar:</span>
                                            <span className="font-black text-green-500">+{formatCOP(summary.totalToCollect)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-gray-400 font-bold uppercase">Total Por Pagar:</span>
                                            <span className="font-black text-red-500">-{formatCOP(summary.totalDebts)}</span>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => { setActiveStoreId(summary.storeId); setShowGlobalSummary(false); }}
                                        className="w-full mt-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[9px] font-black uppercase text-gray-500 hover:text-accent hover:border-accent transition-all"
                                    >
                                        Ir a Conciliación
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/80 border-t dark:border-gray-800 flex justify-between items-center shrink-0">
                        <div className="flex gap-4">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-gray-400 uppercase">Total Efectivo Global</span>
                                <span className="text-sm font-black text-green-600">{formatCOP(globalStoreSummaries.reduce((acc, s) => acc + s.cashBalance, 0))}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-gray-400 uppercase">Total QR Global</span>
                                <span className="text-sm font-black text-blue-600">{formatCOP(globalStoreSummaries.reduce((acc, s) => acc + s.qrBalance, 0))}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-gray-400 uppercase">Total Addi Global</span>
                                <span className="text-sm font-black text-indigo-600">{formatCOP(globalStoreSummaries.reduce((acc, s) => acc + (s as any).addiBalance, 0))}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[8px] font-black text-gray-400 uppercase">Balance Neto Red</span>
                            <span className="text-lg font-black text-accent">{formatCOP(globalStoreSummaries.reduce((acc, s) => acc + s.netBalance, 0))}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Historial de Auditoría y Restauración */}
        {showHistoryModal && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-secondary w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-accent/20 flex flex-col max-h-[90vh]">
                    <div className="p-4 sm:p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 shrink-0">
                        <div>
                            <h3 className="text-lg sm:text-xl font-black text-accent uppercase tracking-widest flex items-center gap-2">
                                <HistoryIcon className="w-6 h-6" /> Historial de Auditoría y Restauración
                            </h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Control de modificaciones, eliminaciones y restauración de todas las cuentas del Libro Mayor</p>
                        </div>
                        <button onClick={() => setShowHistoryModal(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-white dark:bg-gray-800 rounded-full shadow-sm"><CrossIcon className="w-6 h-6" /></button>
                    </div>

                    {/* Filtros de Historial */}
                    <div className="p-4 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 flex flex-col sm:flex-row gap-3 items-center shrink-0 w-full">
                        <div className="relative w-full sm:w-64">
                            <input 
                                type="text" 
                                placeholder="Buscar por concepto o usuario..." 
                                value={historySearchTerm} 
                                onChange={e => setHistorySearchTerm(e.target.value)} 
                                className="w-full bg-white dark:bg-gray-800 border-2 border-transparent outline-none focus:border-accent rounded-xl py-1.5 px-8 text-xs font-bold shadow-inner" 
                            />
                            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        </div>
                        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto scrollbar-hide">
                            {(['all', 'create', 'update', 'delete', 'restore'] as const).map(action => {
                                const actionLabels = {
                                    all: 'TODOS',
                                    create: 'CREACIONES',
                                    update: 'EDICIONES',
                                    delete: 'ELIMINACIONES',
                                    restore: 'RESTAURACIONES'
                                };
                                const colors = {
                                    all: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                                    create: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                                    update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
                                    delete: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
                                    restore: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                                };
                                const activeColors = {
                                    all: 'bg-gray-800 text-white dark:bg-gray-200 dark:text-black',
                                    create: 'bg-green-600 text-white border-green-700',
                                    update: 'bg-blue-600 text-white border-blue-700',
                                    delete: 'bg-red-600 text-white border-red-700',
                                    restore: 'bg-purple-600 text-white border-purple-700'
                                };
                                const isActive = historyActionFilter === action;
                                return (
                                    <button
                                        key={action}
                                        onClick={() => setHistoryActionFilter(action)}
                                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${isActive ? activeColors[action] : colors[action]} hover:scale-[1.02] border border-transparent shrink-0`}
                                    >
                                        {actionLabels[action]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Lista de Registros */}
                    <div className="p-4 sm:p-6 overflow-y-auto scrollbar-hide flex-grow space-y-3">
                        {historyLogs.filter(log => {
                            const matchesAction = historyActionFilter === 'all' || log.action === historyActionFilter;
                            const desc = (log.newState?.description || log.previousState?.description || log.description || '').toLowerCase();
                            const user = (log.changedBy || '').toLowerCase();
                            const matchesSearch = desc.includes(historySearchTerm.toLowerCase()) || user.includes(historySearchTerm.toLowerCase());
                            return matchesAction && matchesSearch;
                        }).length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-xs text-gray-400 italic">No se encontraron registros de auditoría que coincidan con los filtros.</p>
                            </div>
                        ) : (
                            historyLogs.filter(log => {
                                const matchesAction = historyActionFilter === 'all' || log.action === historyActionFilter;
                                const desc = (log.newState?.description || log.previousState?.description || log.description || '').toLowerCase();
                                const user = (log.changedBy || '').toLowerCase();
                                const matchesSearch = desc.includes(historySearchTerm.toLowerCase()) || user.includes(historySearchTerm.toLowerCase());
                                return matchesAction && matchesSearch;
                            }).map(log => {
                                const logDate = new Date(log.timestamp);
                                const actionColors = {
                                    create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200',
                                    update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200',
                                    delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200',
                                    restore: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200'
                                };
                                const actionLabels = {
                                    create: 'CREADO',
                                    update: 'MODIFICADO',
                                    delete: 'ELIMINADO',
                                    restore: 'RESTAURADO'
                                };
                                const stateToShow = log.newState || log.previousState;

                                // Compare fields for updates to show dynamic audit diffs
                                const showDiffs = log.action === 'update' && log.previousState && log.newState;
                                const diffList = [];
                                if (showDiffs) {
                                    if (log.previousState.amount !== log.newState.amount) {
                                        diffList.push({ field: 'Monto', from: formatCOP(log.previousState.amount), to: formatCOP(log.newState.amount) });
                                    }
                                    if (log.previousState.description !== log.newState.description) {
                                        diffList.push({ field: 'Concepto', from: log.previousState.description, to: log.newState.description });
                                    }
                                    if (log.previousState.accountType !== log.newState.accountType) {
                                        diffList.push({ field: 'Cuenta', from: getAccountName(log.previousState.accountType), to: getAccountName(log.newState.accountType) });
                                    }
                                    if (log.previousState.subCategory !== log.newState.subCategory) {
                                        diffList.push({ field: 'Categoría', from: log.previousState.subCategory, to: log.newState.subCategory });
                                    }
                                    if (log.previousState.date !== log.newState.date) {
                                        diffList.push({ field: 'Fecha', from: new Date(log.previousState.date).toLocaleString(), to: new Date(log.newState.date).toLocaleString() });
                                    }
                                }

                                return (
                                    <div key={log.id} className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border border-gray-100 dark:border-gray-800/80 flex flex-col md:flex-row justify-between gap-4 hover:border-accent/10 transition-all items-start md:items-center">
                                        <div className="flex flex-col space-y-1.5 flex-grow min-w-0 pr-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg ${actionColors[log.action as 'create' | 'update' | 'delete' | 'restore']}`}>
                                                    {actionLabels[log.action as 'create' | 'update' | 'delete' | 'restore']}
                                                </span>
                                                <span className="text-[7px] sm:text-[9px] font-black text-gray-400 uppercase">
                                                    {logDate.toLocaleDateString()} a las {logDate.toLocaleTimeString()}
                                                </span>
                                                <span className="text-[7px] sm:text-[9px] text-accent font-black uppercase">
                                                    POR: {log.changedBy}
                                                </span>
                                                {log.storeId && (
                                                    <span className="text-[7px] sm:text-[9px] text-gray-400 font-extrabold bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded uppercase">
                                                        Sede: {stores.find(s => s.id === log.storeId)?.name || 'Sede Local'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Concepto / Actividad:</span>
                                                <p className="truncate sm:whitespace-normal font-black">{stateToShow?.description || log.description || 'Sin concepto'}</p>
                                            </div>

                                            {showDiffs && diffList.length > 0 ? (
                                                <div className="mt-2 p-3 bg-white dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-gray-800 text-[10px] space-y-1.5">
                                                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest block mb-1">Cambios realizados en edición:</span>
                                                    {diffList.map((d, i) => (
                                                        <div key={i} className="flex justify-between gap-2 border-b border-gray-50 dark:border-gray-900/50 pb-1 last:border-none last:pb-0">
                                                            <span className="font-extrabold text-gray-400 uppercase text-[8px]">{d.field}:</span>
                                                            <span className="text-gray-600 dark:text-gray-400 truncate max-w-[40%] font-semibold italic">{d.from}</span>
                                                            <span className="text-gray-400">➡️</span>
                                                            <span className="text-gray-800 dark:text-white font-black truncate max-w-[40%]">{d.to}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] bg-white dark:bg-slate-900/40 p-2 rounded-xl mt-1.5 max-w-fit">
                                                    <div>
                                                        <span className="text-gray-400 font-bold uppercase">Monto: </span>
                                                        <span className={`font-black ${stateToShow?.amount < 0 ? 'text-red-500' : 'text-green-600'}`}>{formatCOP(stateToShow?.amount || 0)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400 font-bold uppercase">Cuenta: </span>
                                                        <span className="font-black uppercase text-gray-600 dark:text-gray-300">{getAccountName(stateToShow?.accountType || 'cash')}</span>
                                                    </div>
                                                    {stateToShow?.subCategory && (
                                                        <div>
                                                            <span className="text-gray-400 font-bold uppercase">Categoría: </span>
                                                            <span className="font-black uppercase text-blue-500">{stateToShow.subCategory}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="shrink-0 flex items-center md:self-stretch">
                                            {(log.action === 'delete' || log.action === 'update') ? (
                                                <button
                                                    onClick={() => handleRestoreRecord(log)}
                                                    className="w-full md:w-auto px-4 py-2 bg-accent hover:bg-accent/80 text-white text-[10px] font-black uppercase rounded-2xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-105"
                                                >
                                                    <ArrowPathIcon className="w-4 h-4" /> Restaurar
                                                </button>
                                            ) : (
                                                <span className="text-[8px] font-bold text-gray-400 italic uppercase">No restaurable</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        )}

        <div className="sticky top-0 z-[60] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm -mx-2 px-2 py-3 mb-4 shadow-md sm:mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-secondary p-4 sm:p-6 rounded-2xl shadow-lg border-b-8" style={{ borderBottomColor: activeStore?.accentColor || '#ff007f' }}>
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-accent/10 rounded-2xl text-accent shadow-inner"><ChartBarIcon className="w-8 h-8 sm:w-10 sm:h-10" /></div>
                    <div>
                        <h2 className="text-xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase leading-none">Libro de Caja / Conciliación</h2>
                        <p className="text-[10px] sm:text-sm font-black text-gray-400 uppercase tracking-widest mt-1 sm:mt-2 flex items-center gap-1.5">
                             INFORMACIÓN DE SEDE CONSOLIDADA
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5 w-full md:w-auto items-center">
                    {isAdmin && (
                        <div className="flex gap-1.5">
                            <button 
                                onClick={() => onNavigate?.(View.ACCOUNTING)}
                                className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-accent rounded-xl transition-colors flex items-center gap-1.5 border border-transparent hover:border-accent/20"
                                title="Ir a Contabilidad Inteligente"
                            >
                                <SparklesIcon className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase hidden sm:inline">Contabilidad</span>
                            </button>
                            <button 
                                onClick={() => setShowGlobalSummary(true)}
                                className="p-2 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-xl transition-all flex items-center gap-1.5 shadow-sm border border-accent/20"
                                title="Ver estado general de todas las sedes"
                            >
                                <ChartBarIcon className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase hidden sm:inline">Estado General</span>
                            </button>
                            <button 
                                onClick={() => setShowHistoryModal(true)}
                                className="p-2 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-xl transition-all flex items-center gap-1.5 shadow-sm border border-accent/20"
                                title="Historial de Auditoría y Restauración"
                            >
                                <HistoryIcon className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase hidden sm:inline">Historial/Auditoría</span>
                            </button>
                            <button 
                                onClick={handleOpenEditNames}
                                className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-accent rounded-xl transition-colors"
                                title="Editar nombres de cuentas"
                            >
                                <SettingsIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white dark:bg-secondary p-4 sm:p-5 rounded-2xl shadow-md border border-accent/20">
                <div onClick={() => setIsDebtsSectionOpen(!isDebtsSectionOpen)} className="flex justify-between items-center cursor-pointer mb-3 group">
                    <h3 className="text-[10px] sm:text-sm font-black text-accent uppercase tracking-widest flex items-center gap-2"><SwapIcon className="w-4 h-4 sm:w-5 h-5" /> Intercambios Sedes</h3>
                    <div className="flex items-center gap-1.5 sm:gap-3">
                        {globalDebtsSummary.toCollect > 0 && <span className="text-[8px] sm:text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded truncate max-w-[100px]">COBRAR: {formatCOP(globalDebtsSummary.toCollect)}</span>}
                        <ChevronDownIcon className={`w-4 h-4 sm:w-5 h-5 text-gray-400 transition-transform ${isDebtsSectionOpen ? 'rotate-180' : ''} group-hover:text-accent`} />
                    </div>
                </div>
                {isDebtsSectionOpen && (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-hide animate-fade-in">
                        {interStoreBalances.length > 0 ? interStoreBalances.map((item, idx) => (
                            <div key={idx} className={`p-3 sm:p-4 rounded-xl border-2 flex flex-col justify-between transition-all hover:scale-[1.01] ${item.total > 0 ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800 shadow-sm' : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800 shadow-sm'}`}>
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Sede Involucrada:</p>
                                        <p className={`text-xs sm:text-sm font-black uppercase truncate ${item.total > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{item.otherStoreName}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-[9px] sm:text-[10px] font-black uppercase mb-0.5 ${item.total > 0 ? 'text-green-500' : 'text-red-500'}`}>{item.total > 0 ? 'POR COBRAR' : 'POR PAGAR'}</p>
                                        <p className={`text-sm sm:text-lg font-black ${item.total > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCOP(Math.abs(item.total))}</p>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <button onClick={() => setExpandedDebtStoreId(expandedDebtStoreId === item.storeId ? null : item.storeId)} className="text-[8px] sm:text-[9px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 w-full justify-center pt-1 border-t border-gray-100 dark:border-gray-700">{expandedDebtStoreId === item.storeId ? 'Ocultar' : 'Historial'}<ChevronDownIcon className={`w-3 h-3 transition-transform ${expandedDebtStoreId === item.storeId ? 'rotate-180' : ''}`} /></button>
                                    {expandedDebtStoreId === item.storeId && (
                                        <div className="mt-2 space-y-1 bg-white/50 dark:bg-black/20 p-2 rounded-lg animate-fade-in">
                                            {item.history.map(record => {
                                                const impact = (record as any).netImpact || 0;
                                                const running = (record as any).runningBalance || 0;
                                                const methodLabel = record.accountType === 'cash' ? 'EFEC' : (record.accountType === 'qr' ? 'QR' : 'BANCO');
                                                const methodColor = record.accountType === 'cash' ? 'text-green-600 dark:text-green-400' : (record.accountType === 'qr' ? 'text-blue-500' : 'text-purple-500');
                                                return (
                                                    <div key={record.id} className="flex justify-between text-[9px] border-b border-gray-100 dark:border-gray-700 pb-1.5 last:border-0 items-center">
                                                        <div className="flex flex-col min-w-0 pr-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 font-black uppercase text-[7px]">{getLocalDateString(record.date)}</span>
                                                                    <span className="text-[6px] font-bold text-accent">{record.date.includes('T') ? record.date.split('T')[1]?.slice(0, 5) : '--:--'}</span>
                                                                </div>
                                                                <span className={`text-[7px] font-black uppercase px-1 border border-current rounded ${methodColor}`}>{methodLabel}</span>
                                                            </div>
                                                            <span className="text-gray-600 dark:text-gray-400 truncate font-bold">{record.description}</span>
                                                            {record.subCategory && <span className="text-[7px] text-accent uppercase font-black">{record.subCategory}</span>}
                                                        </div>
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <span className={`font-black ${impact > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact > 0 ? '+' : ''}{formatCOP(impact)}
                                                            </span>
                                                            <span className="text-[7px] font-bold text-gray-400 uppercase">
                                                                Saldo: {formatCOP(Math.abs(running))} {running > 0 ? '(Favor)' : running < 0 ? '(Deuda)' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                                {item.total < 0 && (
                                    <div className="mt-2 pt-2 border-t-2 border-dashed border-red-200 dark:border-red-900/50">
                                        <div className="flex gap-1.5">
                                            <button onClick={() => initiateSettlement(item.storeId, item.otherStoreName, Math.abs(item.total), 'cash', item.history)} className="flex-1 bg-white dark:bg-gray-800 text-green-600 text-[8px] sm:text-[9px] font-black py-1.5 rounded-lg border border-green-200 shadow-sm">PAGAR EFECTIVO</button>
                                            <button onClick={() => initiateSettlement(item.storeId, item.otherStoreName, Math.abs(item.total), 'qr', item.history)} className="flex-1 bg-white dark:bg-gray-800 text-blue-600 text-[8px] sm:text-[9px] font-black py-1.5 rounded-lg border border-blue-200 shadow-sm">PAGAR QR</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )) : <p className="text-[10px] text-gray-400 italic text-center py-4">Sin saldos pendientes.</p>}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-secondary rounded-2xl shadow-md border border-accent/20 overflow-hidden flex flex-col">
                <div className="flex bg-gray-50 dark:bg-gray-800 p-1 border-b dark:border-gray-700">
                    <button 
                        onClick={() => setSummaryActiveTab('expense')}
                        className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${summaryActiveTab === 'expense' ? 'bg-white dark:bg-gray-700 text-red-500 shadow-sm' : 'text-gray-400'}`}
                    >
                        Gastos Mensuales
                    </button>
                    <button 
                        onClick={() => setSummaryActiveTab('income')}
                        className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${summaryActiveTab === 'income' ? 'bg-white dark:bg-gray-700 text-green-500 shadow-sm' : 'text-gray-400'}`}
                    >
                        Ingresos Mensuales
                    </button>
                </div>
                
                <div className="p-4 sm:p-5 flex-grow">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-[10px] sm:text-sm font-black text-accent uppercase tracking-widest flex items-center gap-2">
                            {summaryActiveTab === 'expense' ? <ChartBarIcon className="w-4 h-4" /> : <PlusCircleIcon className="w-4 h-4" />}
                            Resumen de {summaryActiveTab === 'expense' ? 'Gastos' : 'Ingresos'}
                        </h3>
                        <button 
                            onClick={() => handleFilterBySummary(summaryActiveTab === 'expense' ? 'expense' : 'income', null)}
                            className="text-[9px] font-black text-gray-400 uppercase hover:text-accent underline"
                        >
                            Ver Todo
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide animate-fade-in">
                        {categoryStats[summaryActiveTab === 'expense' ? 'expenses' : 'incomes'].length > 0 ? categoryStats[summaryActiveTab === 'expense' ? 'expenses' : 'incomes'].map((cat, idx) => {
                            const maxVal = categoryStats[summaryActiveTab === 'expense' ? 'expenses' : 'incomes'][0].value;
                            const percentage = (cat.value / maxVal) * 100;
                            const colorClass = summaryActiveTab === 'expense' ? 'bg-red-500' : 'bg-green-500';
                            const textColorClass = summaryActiveTab === 'expense' ? 'text-red-500' : 'text-green-500';
                            const isDirectCost = summaryActiveTab === 'expense' && EXCLUDED_OPERATING_CATEGORIES.some(ex => cat.name.toUpperCase().includes(ex));

                            return (
                                <div key={idx} className="space-y-0.5 group">
                                    <div 
                                        className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-accent/5 p-1 rounded transition-all"
                                        onClick={() => {
                                            const key = `${summaryActiveTab}_${cat.name}`;
                                            setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));
                                        }}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <ChevronDownIcon className={`w-3 h-3 text-gray-400 transition-transform ${expandedCategories[`${summaryActiveTab}_${cat.name}`] ? 'rotate-180' : ''}`} />
                                            <div className="flex flex-col">
                                                <span className="text-gray-600 dark:text-gray-300 truncate">{cat.name}</span>
                                                {isDirectCost && (
                                                    <span className="text-[6px] text-orange-500 font-black tracking-[0.1em]">COSTO DIRECTO (P&L)</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className={textColorClass}>{formatCOP(cat.value)}</span>
                                            {summaryActiveTab === 'expense' && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleExportCategoryToAccounting(cat.name, cat.value); }}
                                                    className="p-1 font-black text-accent bg-accent/10 rounded hover:bg-accent hover:text-white transition-all text-[7px]"
                                                    title="Exportar a Contabilidad"
                                                >
                                                    <SparklesIcon className="w-2.5 h-2.5 inline mr-0.5"/> EXP
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-1 rounded-full overflow-hidden mb-1">
                                        <div className={`${isDirectCost ? 'bg-orange-400' : colorClass} h-full rounded-full transition-all duration-1000`} style={{ width: `${percentage}%` }}></div>
                                    </div>
                                    
                                    {expandedCategories[`${summaryActiveTab}_${cat.name}`] && (
                                        <div className="ml-4 mt-1 mb-3 space-y-1 bg-gray-50 dark:bg-gray-800/40 p-2 rounded-xl border border-gray-100 dark:border-gray-800 animate-slide-in-top">
                                            {isDirectCost && (
                                                <div className="mb-2 p-1.5 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/20">
                                                    <p className="text-[7px] text-orange-600 dark:text-orange-400 font-black">ℹ️ ESTA CATEGORÍA SE EXCLUYE DE GASTOS OPERATIVOS</p>
                                                    <p className="text-[6px] text-orange-400">Se considera inversión en activos o costo directo de venta.</p>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-200 dark:border-gray-700">
                                                <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Desglose por Cuenta</span>
                                                <button onClick={() => handleFilterBySummary(summaryActiveTab === 'expense' ? 'expense' : 'income', cat.name)} className="text-[7px] font-black text-accent hover:underline uppercase">Ver en Libro</button>
                                            </div>
                                            {Object.entries(cat.accounts).map(([acc, val]) => (
                                                <div key={acc} className="flex justify-between items-center text-[9px]">
                                                    <span className="text-gray-500 font-bold uppercase">{getAccountName(acc as AccountType)}:</span>
                                                    <span className="font-black text-gray-700 dark:text-gray-200">{formatCOP(val as number)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }) : (
                            <div className="flex flex-col items-center justify-center py-8 opacity-20">
                                <TagIcon className="w-8 h-8 mb-1" />
                                <p className="text-[9px] font-bold uppercase italic">Sin registros</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
            {isSystemLoadsOpen && (
                <div className="lg:col-span-4 space-y-4 animate-fade-in">
                    <div className="bg-white dark:bg-secondary p-4 sm:p-5 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col h-full lg:max-h-[800px]">
                        <div className="mb-4 flex flex-col gap-3">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                                <button onClick={() => setIsSystemLoadsOpen(!isSystemLoadsOpen)} className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2 hover:text-accent transition-colors"><HistoryIcon className="w-4 h-4 text-accent" /> Cierres de Caja <ChevronDownIcon className={`w-4 h-4 transition-transform ${isSystemLoadsOpen ? 'rotate-180' : ''}`} /></button>
                                {isSystemLoadsOpen && hasMismatches && (
                                    <button 
                                        onClick={syncAllMismatches}
                                        className="px-2 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[8px] font-black uppercase rounded-lg shadow-sm animate-pulse flex items-center gap-1 shrink-0"
                                        title="Sincronizar todos los cierres con diferencias"
                                    >
                                        <ArrowPathIcon className="w-3 h-3" /> Sincronizar Todo
                                    </button>
                                )}
                            </div>

                            {/* Combined and Responsive Date Picker ("la fecha") */}
                            <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">Filtrar por Mes/Año</span>
                               <div className="flex items-center justify-between gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg text-accent transition-all" title="Mes Anterior">
                                     <ChevronLeftIcon className="w-4 h-4"/>
                                  </button>
                                  <div className="flex gap-1 text-center flex-grow justify-center min-w-0">
                                     <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent text-slate-700 dark:text-slate-200 text-xs font-black outline-none border-0 text-center uppercase cursor-pointer max-w-[100px]">{monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                                     <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-transparent text-slate-700 dark:text-slate-200 text-xs font-black outline-none border-0 text-center cursor-pointer">{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                                  </div>
                                  <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg text-accent transition-all" title="Siguiente Mes">
                                     <ChevronRightIcon className="w-4 h-4"/>
                                  </button>
                               </div>
                            </div>

                            {/* Toggle Account Visibility */}
                            <div className="flex items-center justify-between gap-2">
                                 <button 
                                    onClick={() => setShowBothClosures(!showBothClosures)}
                                    className={`flex-grow py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5
                                      ${showBothClosures 
                                        ? 'bg-accent/10 border-accent/20 text-accent shadow-sm' 
                                        : 'bg-slate-50 dark:bg-slate-850 text-slate-400 border-slate-100 dark:border-slate-750 hover:text-accent'}`}
                                    title="Ver todas las cuentas al tiempo o solo la seleccionada"
                                  >
                                    <SwapIcon className="w-3.5 h-3.5" />
                                    {showBothClosures ? 'Mostrar solo activa' : 'Mostrar todas las cuentas'}
                                  </button>
                            </div>

                            {/* Highly Responsive Tab Grid (Efectivo, QR, Addi, Sistecredito) */}
                            <div className="space-y-1">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">Seleccionar Cuenta</span>
                               <div className="grid grid-cols-2 gap-1.5">
                                   <button 
                                     onClick={() => setClosuresActiveTab('cash')} 
                                     className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border
                                       ${closuresActiveTab === 'cash' 
                                         ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/15' 
                                         : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'}`}
                                   >
                                     <span className="text-xs">💵</span> Efectivo
                                   </button>
                                   <button 
                                     onClick={() => setClosuresActiveTab('qr')} 
                                     className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border
                                       ${closuresActiveTab === 'qr' 
                                         ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/15' 
                                         : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'}`}
                                   >
                                     <span className="text-xs">📱</span> Pago QR
                                   </button>
                                   <button 
                                     onClick={() => setClosuresActiveTab('addi')} 
                                     className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border
                                       ${closuresActiveTab === 'addi' 
                                         ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/15' 
                                         : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'}`}
                                   >
                                     <span className="text-xs">💎</span> Addi
                                   </button>
                                   <button 
                                     onClick={() => setClosuresActiveTab('sistecredito')} 
                                     className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border
                                       ${closuresActiveTab === 'sistecredito' 
                                         ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/15' 
                                         : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'}`}
                                   >
                                     <span className="text-xs">💳</span> Sistecredito
                                   </button>
                               </div>
                            </div>
                        </div>
                    {closuresActiveTab === 'sistecredito' && (
                        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 animate-fade-in">
                            <p className="text-[10px] font-black text-orange-600 uppercase mb-2 flex items-center gap-1"><HistoryIcon className="w-3 h-3"/> Conciliación por Rango (Sistecredito)</p>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div>
                                    <label className="text-[7px] font-bold text-gray-400 uppercase block mb-1">Desde</label>
                                    <input type="date" value={sisteRangeStart} onChange={e => setSisteRangeStart(e.target.value)} className="w-full bg-white dark:bg-gray-800 p-1.5 rounded-lg text-[9px] border outline-none font-bold" />
                                </div>
                                <div>
                                    <label className="text-[7px] font-bold text-gray-400 uppercase block mb-1">Hasta</label>
                                    <input type="date" value={sisteRangeEnd} onChange={e => setSisteRangeEnd(e.target.value)} className="w-full bg-white dark:bg-gray-800 p-1.5 rounded-lg text-[9px] border outline-none font-bold" />
                                </div>
                            </div>
                            {sisteRangeStart && sisteRangeEnd && (() => {
                                const start = new Date(sisteRangeStart);
                                const end = new Date(sisteRangeEnd);
                                let rangeTotal = 0;
                                let rangeOriginalTotal = 0;
                                let rangeCount = 0;
                                
                                dailySystemTotals.forEach(item => {
                                    const itemDate = new Date(item.date);
                                    if (itemDate >= start && itemDate <= end) {
                                        rangeTotal += item.sistecredito;
                                        item.transactions.sistecredito.forEach(t => {
                                            // Extraer valor original de la descripción si es posible
                                            const match = t.description.match(/Valor: \$([\d.,]+)/);
                                            if (match) {
                                                const val = parseFloat(match[1].replace(/\./g, '').replace(/,/g, ''));
                                                rangeOriginalTotal += val;
                                            } else {
                                                rangeOriginalTotal += t.amount;
                                            }
                                            rangeCount++;
                                        });
                                    }
                                });

                                const rangeId = `range_siste_${activeStoreId}_${sisteRangeStart}_${sisteRangeEnd}`;
                                const isRangeConfirmed = allRecords.some(r => r.id === rangeId);

                                return (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end border-b border-orange-200 dark:border-orange-800 pb-2">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-bold text-gray-500 uppercase">Total Bruto ({rangeCount})</span>
                                                <span className="text-xs font-black text-gray-700 dark:text-gray-300">{formatCOP(rangeOriginalTotal)}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-bold text-orange-600 uppercase">Total Neto (A Consignar)</span>
                                                <span className="text-sm font-black text-orange-600">{formatCOP(rangeTotal)}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={async () => {
                                                if (rangeTotal === 0) return;
                                                const description = `Conciliación Sistecredito Rango: ${sisteRangeStart} al ${sisteRangeEnd} (${rangeCount} ventas)`;
                                                const record: FinancialRecord = {
                                                    id: rangeId,
                                                    date: sisteRangeEnd,
                                                    storeId: activeStoreId,
                                                    accountType: 'qr', // Se concilia en QR por defecto
                                                    amount: rangeTotal,
                                                    type: 'income_sales',
                                                    description,
                                                    registeredBy: currentUser.name,
                                                    isConfirmed: true
                                                };
                                                try {
                                                    await setDoc(doc(db, 'financialRecords', rangeId), record);
                                                    alert("Rango de Sistecredito conciliado correctamente en la cuenta QR.");
                                                } catch (e) {
                                                    console.error(e);
                                                    alert("Error al conciliar el rango.");
                                                }
                                            }}
                                            disabled={isRangeConfirmed || rangeTotal === 0}
                                            className={`w-full py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isRangeConfirmed ? 'bg-green-500 text-white' : 'bg-orange-600 text-white shadow-lg hover:bg-orange-700'}`}
                                        >
                                            {isRangeConfirmed ? 'RANGO CONCILIADO OK' : 'CONCILIAR TODO EL RANGO'}
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                        <div className="space-y-3 overflow-y-auto pr-1 scrollbar-hide animate-fade-in max-h-[300px] lg:max-h-none">
                            {dailySystemTotals.map((item) => {
                                const cashRecord = records.find(r => r.id === `daily_auto_${activeStoreId}_cash_${item.date}`);
                                const isCashConfirmed = !!cashRecord;
                                const isCashMismatch = isCashConfirmed && cashRecord.amount !== item.cash;

                                const qrRecord = records.find(r => r.id === `daily_auto_${activeStoreId}_qr_${item.date}`);
                                const isQrConfirmed = !!qrRecord;
                                const isQrMismatch = isQrConfirmed && qrRecord.amount !== item.qr;

                                const addiRecord = records.find(r => r.id === `daily_auto_${activeStoreId}_addi_${item.date}`);
                                const isAddiConfirmed = !!addiRecord;
                                const isAddiMismatch = isAddiConfirmed && addiRecord.amount !== item.addi;

                                const sisteRecord = records.find(r => r.id === `daily_auto_${activeStoreId}_sistecredito_${item.date}`);
                                const isSisteConfirmed = !!sisteRecord;
                                const isSisteMismatch = isSisteConfirmed && sisteRecord.amount !== item.sistecredito;

                                const isExpanded = expandedSystemLoadId === item.date;
                                
                                return (
                                    <div key={item.date} className="p-3 sm:p-4 bg-gray-5 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl space-y-2.5 transition-all">
                                        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-1">
                                            <p className="text-[9px] sm:text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">{item.date}</p>
                                        </div>
                                        {(showBothClosures || closuresActiveTab === 'cash') && (
                                            <div className="flex justify-between items-center">
                                                <div className="min-w-0"><p className="text-[8px] font-black text-gray-400 uppercase">EFEC:</p><p className={`text-xs sm:text-sm font-black ${item.cash >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCOP(item.cash)}</p></div>
                                                <button onClick={() => confirmDailyTotal(item.date, item.cash, 'cash')} disabled={(!isCashMismatch && isCashConfirmed) || item.cash === 0} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${isCashMismatch ? 'bg-red-500 text-white shadow-lg animate-pulse' : (isCashConfirmed ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-700 text-accent border border-accent/20')}`}>{isCashMismatch ? 'DIFERENCIA' : (isCashConfirmed ? 'OK' : 'CONCILIAR')}</button>
                                            </div>
                                        )}
                                        {(showBothClosures || closuresActiveTab === 'qr') && (
                                            <div className="flex justify-between items-center">
                                                <div className="min-w-0"><p className="text-[8px] font-black text-gray-400 uppercase">QR:</p><p className={`text-xs sm:text-sm font-black ${item.qr >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCOP(item.qr)}</p></div>
                                                <button onClick={() => confirmDailyTotal(item.date, item.qr, 'qr')} disabled={(!isQrMismatch && isQrConfirmed) || item.qr === 0} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${isQrMismatch ? 'bg-red-500 text-white shadow-lg animate-pulse' : (isQrConfirmed ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-700 text-accent border border-accent/20')}`}>{isQrMismatch ? 'DIFERENCIA' : (isQrConfirmed ? 'OK' : 'CONCILIAR')}</button>
                                            </div>
                                        )}
                                        {(showBothClosures || closuresActiveTab === 'addi') && (
                                            <div className="flex justify-between items-center">
                                                <div className="min-w-0"><p className="text-[8px] font-black text-gray-400 uppercase">ADDI:</p><p className={`text-xs sm:text-sm font-black ${item.addi >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{formatCOP(item.addi)}</p></div>
                                                <button onClick={() => confirmDailyTotal(item.date, item.addi, 'qr', undefined, 'addi')} disabled={(!isAddiMismatch && isAddiConfirmed) || item.addi === 0} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${isAddiMismatch ? 'bg-red-500 text-white shadow-lg animate-pulse' : (isAddiConfirmed ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-700 text-accent border border-accent/20')}`}>{isAddiMismatch ? 'DIFERENCIA' : (isAddiConfirmed ? 'OK' : 'CONCILIAR')}</button>
                                            </div>
                                        )}
                                        {(showBothClosures || closuresActiveTab === 'sistecredito') && (
                                            <div className="flex justify-between items-center">
                                                <div className="min-w-0"><p className="text-[8px] font-black text-gray-400 uppercase">SISTE:</p><p className={`text-xs sm:text-sm font-black ${item.sistecredito >= 0 ? 'text-orange-600' : 'text-red-500'}`}>{formatCOP(item.sistecredito)}</p></div>
                                                <button onClick={() => confirmDailyTotal(item.date, item.sistecredito, 'qr', undefined, 'sistecredito')} disabled={(!isSisteMismatch && isSisteConfirmed) || item.sistecredito === 0} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${isSisteMismatch ? 'bg-red-500 text-white shadow-lg animate-pulse' : (isSisteConfirmed ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-700 text-accent border border-accent/20')}`}>{isSisteMismatch ? 'DIFERENCIA' : (isSisteConfirmed ? 'OK' : 'CONCILIAR')}</button>
                                            </div>
                                        )}

                                        <div className="mt-3 space-y-3 pt-3 border-t border-dashed border-gray-300 dark:border-gray-600 animate-fade-in">
                                            {/* Sección QR */}
                                                {(showBothClosures || closuresActiveTab === 'qr') && (
                                                    <div>
                                                        <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                            <BuildingStorefrontIcon className="w-2.5 h-2.5" /> Desglose QR ({item.transactions.qr.length})
                                                        </p>
                                                        <div className="space-y-1">
                                                            {item.transactions.qr.length > 0 ? item.transactions.qr.map(t => {
                                                                const recordId = `trans_auto_${t.id}`;
                                                                const existingRecord = allRecords.find(r => r.id === recordId);
                                                                const isTransConfirmed = !!existingRecord;
                                                                const isAmountMismatch = isTransConfirmed && existingRecord.amount !== t.amount;
                                                                const isAccountMismatch = isTransConfirmed && existingRecord.accountType !== 'qr';

                                                                return (
                                                                    <div key={t.id} className={`flex justify-between items-center text-[9px] p-1.5 rounded-lg border ${isAmountMismatch || isAccountMismatch ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-white dark:bg-black/20 border-gray-100 dark:border-gray-800'}`}>
                                                                        <div className="min-w-0 flex items-center gap-2">
                                                                            <span className="text-gray-400 font-mono">{t.time}</span>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-gray-700 dark:text-gray-300 truncate inline-block max-w-[100px]">{t.description}</span>
                                                                                {isAmountMismatch && <span className="text-[7px] text-red-500 font-bold">Conciliado: {formatCOP(existingRecord.amount)}</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black text-blue-600">{formatCOP(t.amount)}</span>
                                                                            <div className="flex flex-col items-end gap-1">
                                                                                <button 
                                                                                    onClick={() => confirmDailyTotal(item.date, t.amount, 'qr', t)}
                                                                                    className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase transition-all ${isTransConfirmed ? (isAmountMismatch || isAccountMismatch ? 'bg-red-500 text-white' : 'bg-green-500 text-white') : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white'}`}
                                                                                >
                                                                                    {isTransConfirmed ? (isAmountMismatch ? 'DIFERENCIA' : (isAccountMismatch ? 'OTRA CUENTA' : 'OK')) : 'CONCILIAR'}
                                                                                </button>
                                                                                {isTransConfirmed && (isAmountMismatch || isAccountMismatch) && (
                                                                                    <button 
                                                                                        onClick={() => confirmDailyTotal(item.date, t.amount, 'qr', t)}
                                                                                        className="text-[7px] text-blue-500 font-bold hover:underline"
                                                                                    >
                                                                                        ACTUALIZAR
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }) : <p className="text-[8px] text-gray-400 italic pl-1">Sin transacciones QR</p>}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Sección ADDI */}
                                                {(showBothClosures || closuresActiveTab === 'addi') && (
                                                    <div>
                                                        <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                            <PlusCircleIcon className="w-2.5 h-2.5" /> Desglose ADDI ({item.transactions.addi.length})
                                                        </p>
                                                        <div className="space-y-1">
                                                            {item.transactions.addi.length > 0 ? item.transactions.addi.map(t => {
                                                                const recordId = `trans_auto_${t.id}`;
                                                                const existingRecord = allRecords.find(r => r.id === recordId);
                                                                const isTransConfirmed = !!existingRecord;
                                                                const isAmountMismatch = isTransConfirmed && existingRecord.amount !== t.amount;
                                                                const isAccountMismatch = isTransConfirmed && existingRecord.accountType !== 'qr';

                                                                return (
                                                                    <div key={t.id} className={`flex justify-between items-center text-[9px] p-1.5 rounded-lg border ${isAmountMismatch || isAccountMismatch ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-white dark:bg-black/20 border-gray-100 dark:border-gray-800'}`}>
                                                                        <div className="min-w-0 flex items-center gap-2">
                                                                            <span className="text-gray-400 font-mono">{t.time}</span>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-gray-700 dark:text-gray-300 truncate inline-block max-w-[100px]">{t.description}</span>
                                                                                {isAmountMismatch && <span className="text-[7px] text-red-500 font-bold">Conciliado: {formatCOP(existingRecord.amount)}</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`font-black text-indigo-600`}>{formatCOP(t.amount)}</span>
                                                                            <div className="flex flex-col items-end gap-1">
                                                                                <button 
                                                                                    onClick={() => confirmDailyTotal(item.date, t.amount, 'qr', t)}
                                                                                    className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase transition-all ${isTransConfirmed ? (isAmountMismatch || isAccountMismatch ? 'bg-red-500 text-white' : 'bg-green-500 text-white') : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white'}`}
                                                                                >
                                                                                    {isTransConfirmed ? (isAmountMismatch ? 'DIFERENCIA' : (isAccountMismatch ? 'OTRA CUENTA' : 'OK')) : 'CONCILIAR'}
                                                                                </button>
                                                                                {isTransConfirmed && (isAmountMismatch || isAccountMismatch) && (
                                                                                    <button 
                                                                                        onClick={() => confirmDailyTotal(item.date, t.amount, 'qr', t)}
                                                                                        className="text-[7px] text-blue-500 font-bold hover:underline"
                                                                                    >
                                                                                        ACTUALIZAR
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }) : <p className="text-[8px] text-gray-400 italic pl-1">Sin transacciones Addi</p>}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Sección SISTECREDITO */}
                                                {(showBothClosures || closuresActiveTab === 'sistecredito') && (
                                                    <div>
                                                        <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                            <PlusCircleIcon className="w-2.5 h-2.5" /> Desglose SISTECREDITO ({item.transactions.sistecredito.length})
                                                        </p>
                                                        <div className="space-y-1">
                                                            {item.transactions.sistecredito.length > 0 ? item.transactions.sistecredito.map(t => {
                                                                const recordId = `trans_auto_${t.id}`;
                                                                const existingRecord = allRecords.find(r => r.id === recordId);
                                                                const isTransConfirmed = !!existingRecord;
                                                                const isAmountMismatch = isTransConfirmed && existingRecord.amount !== t.amount;
                                                                const isAccountMismatch = isTransConfirmed && existingRecord.accountType !== 'qr';

                                                                return (
                                                                    <div key={t.id} className={`flex justify-between items-center text-[9px] p-1.5 rounded-lg border ${isAmountMismatch || isAccountMismatch ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-white dark:bg-black/20 border-gray-100 dark:border-gray-800'}`}>
                                                                        <div className="min-w-0 flex items-center gap-2">
                                                                            <span className="text-gray-400 font-mono">{t.time}</span>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-gray-700 dark:text-gray-300 truncate inline-block max-w-[100px]">{t.description}</span>
                                                                                {isAmountMismatch && <span className="text-[7px] text-red-500 font-bold">Conciliado: {formatCOP(existingRecord.amount)}</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`font-black text-orange-600`}>{formatCOP(t.amount)}</span>
                                                                            <div className="flex flex-col items-end gap-1">
                                                                                <button 
                                                                                    onClick={() => confirmDailyTotal(item.date, t.amount, 'qr', t)}
                                                                                    className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase transition-all ${isTransConfirmed ? (isAmountMismatch || isAccountMismatch ? 'bg-red-500 text-white' : 'bg-green-500 text-white') : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-600 hover:text-white'}`}
                                                                                >
                                                                                    {isTransConfirmed ? (isAmountMismatch ? 'DIFERENCIA' : (isAccountMismatch ? 'OTRA CUENTA' : 'OK')) : 'CONCILIAR'}
                                                                                </button>
                                                                                {isTransConfirmed && (isAmountMismatch || isAccountMismatch) && (
                                                                                    <button 
                                                                                        onClick={() => confirmDailyTotal(item.date, t.amount, 'qr', t)}
                                                                                        className="text-[7px] text-blue-500 font-bold hover:underline"
                                                                                    >
                                                                                        ACTUALIZAR
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }) : <p className="text-[8px] text-gray-400 italic pl-1">Sin transacciones Sistecredito</p>}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Sección Efectivo */}
                                                {(showBothClosures || closuresActiveTab === 'cash') && (
                                                    <div>
                                                        <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                            <DollarIcon className="w-2.5 h-2.5" /> Desglose EFECTIVO ({item.transactions.cash.length})
                                                        </p>
                                                        <div className="space-y-1">
                                                            {item.transactions.cash.length > 0 ? item.transactions.cash.map(t => {
                                                                const recordId = `trans_auto_${t.id}`;
                                                                const existingRecord = allRecords.find(r => r.id === recordId);
                                                                const isTransConfirmed = !!existingRecord;
                                                                const isAmountMismatch = isTransConfirmed && existingRecord.amount !== t.amount;
                                                                const isAccountMismatch = isTransConfirmed && existingRecord.accountType !== 'cash';

                                                                return (
                                                                    <div key={t.id} className={`flex justify-between items-center text-[9px] p-1.5 rounded-lg border ${isAmountMismatch || isAccountMismatch ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-white dark:bg-black/20 border-gray-100 dark:border-gray-800'}`}>
                                                                        <div className="min-w-0 flex items-center gap-2">
                                                                            <span className="text-gray-400 font-mono">{t.time}</span>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-gray-700 dark:text-gray-300 truncate inline-block max-w-[100px]">{t.description}</span>
                                                                                {isAmountMismatch && <span className="text-[7px] text-red-500 font-bold">Conciliado: {formatCOP(existingRecord.amount)}</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`font-black ${t.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCOP(t.amount)}</span>
                                                                            <div className="flex flex-col items-end gap-1">
                                                                                <button 
                                                                                    onClick={() => confirmDailyTotal(item.date, t.amount, 'cash', t)}
                                                                                    className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase transition-all ${isTransConfirmed ? (isAmountMismatch || isAccountMismatch ? 'bg-red-500 text-white' : 'bg-green-500 text-white') : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-600 hover:text-white'}`}
                                                                                >
                                                                                    {isTransConfirmed ? (isAmountMismatch ? 'DIFERENCIA' : (isAccountMismatch ? 'OTRA CUENTA' : 'OK')) : 'CONCILIAR'}
                                                                                </button>
                                                                                {isTransConfirmed && (isAmountMismatch || isAccountMismatch) && (
                                                                                    <button 
                                                                                        onClick={() => confirmDailyTotal(item.date, t.amount, 'cash', t)}
                                                                                        className="text-[7px] text-blue-500 font-bold hover:underline"
                                                                                    >
                                                                                        ACTUALIZAR
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }) : <p className="text-[8px] text-gray-400 italic pl-1">Sin transacciones efectivo</p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                    </div>
                                );
                            })}
                            {dailySystemTotals.length === 0 && <p className="text-[10px] text-center text-gray-400 italic py-4">Sin datos en este periodo.</p>}
                        </div>
                </div>
            </div>
            )}

            <div className={`${isSystemLoadsOpen ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4 transition-all duration-300`}>
                <div className="sticky top-[120px] md:top-[120px] z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm -mx-1 px-1 py-2">
                    <div className="bg-white dark:bg-secondary p-2 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 sm:gap-2">
                        {!isSystemLoadsOpen && (
                            <button 
                                onClick={() => setIsSystemLoadsOpen(true)}
                                className="p-2 sm:p-2.5 bg-accent/10 text-accent rounded-xl hover:bg-accent hover:text-white transition-all flex items-center gap-1.5 border border-accent/20 h-full"
                                title="Mostrar Cierres de Caja"
                            >
                                <HistoryIcon className="w-4 h-4 sm:w-5 h-5" />
                                <span className="text-[10px] font-black uppercase hidden sm:inline">Cierres</span>
                            </button>
                        )}
                        <button onClick={() => setActiveTab('cash')} className={`flex-1 py-2 sm:py-3 rounded-xl text-[8px] sm:text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'cash' ? 'bg-accent text-white shadow-lg' : 'text-gray-400'}`}><DollarIcon className="w-4 h-4 sm:w-5 h-5" /> {getAccountName('cash')}</button>
                        <button onClick={() => setActiveTab('qr')} className={`flex-1 py-2 sm:py-3 rounded-xl text-[8px] sm:text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'qr' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}><BuildingStorefrontIcon className="w-4 h-4 sm:w-5 h-5" /> {getAccountName('qr')}</button>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-4 border-b dark:border-slate-800 flex flex-col gap-4 bg-gray-50 dark:bg-gray-900/50">
                        {/* Filtros Superiores del Libro */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="relative w-full md:w-64">
                                <input type="text" placeholder="Filtrar libro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white dark:bg-gray-800 border-2 border-transparent focus:border-accent rounded-xl py-2 px-10 outline-none text-xs sm:text-sm font-bold shadow-inner" />
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 h-5" />
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner flex-grow">
                                    <input type="date" value={ledgerStartDate} onChange={e => setLedgerStartDate(e.target.value)} className="bg-transparent text-[10px] sm:text-xs font-bold outline-none uppercase w-full" />
                                    <span className="text-gray-300">|</span>
                                    <input type="date" value={ledgerEndDate} onChange={e => setLedgerEndDate(e.target.value)} className="bg-transparent text-[10px] sm:text-xs font-bold outline-none uppercase w-full" />
                                </div>
                                <button onClick={() => { setLedgerStartDate(''); setLedgerEndDate(''); setSearchTerm(''); setFinanceTypeFilter('all'); }} className="p-2 text-gray-400 hover:text-red-500" title="Limpiar filtros"><CrossIcon className="w-5 h-5" /></button>
                            </div>
                        </div>

                        {/* Totales Rápidos de la Vista Filtrada */}
                        <div className="flex justify-between items-center">
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setFinanceTypeFilter(financeTypeFilter === 'income' ? 'all' : 'income')}
                                    className={`flex flex-col px-3 py-1 rounded-xl transition-all border ${financeTypeFilter === 'income' ? 'bg-green-500 text-white border-green-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}
                                >
                                    <span className="text-[8px] font-black uppercase opacity-80">Visible Ingresos</span>
                                    <span className="text-xs font-black">{formatCOP(visibleTotals.income)}</span>
                                </button>
                                <button 
                                    onClick={() => setFinanceTypeFilter(financeTypeFilter === 'expense' ? 'all' : 'expense')}
                                    className={`flex flex-col px-3 py-1 rounded-xl transition-all border ${financeTypeFilter === 'expense' ? 'bg-red-500 text-white border-red-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}
                                >
                                    <span className="text-[8px] font-black uppercase opacity-80">Visible Gastos</span>
                                    <span className="text-xs font-black">{formatCOP(visibleTotals.expense)}</span>
                                </button>
                            </div>

                            <div className="text-right">
                                <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Saldo Real Cuenta</p>
                                <p className={`text-sm sm:text-xl font-black leading-none ${currentBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCOP(currentBalance)}</p>
                            </div>
                            <button onClick={() => { handleAddRow(); setShowAddModal(true); }} className="p-2.5 sm:p-3 bg-accent text-white rounded-xl shadow-lg hover:scale-105 transition-all"><PlusCircleIcon className="w-5 h-5 sm:w-6 h-6" /></button>
                        </div>
                    </div>
                    
                    <div className="flex-grow overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[10px] sm:text-xs">
                            <thead><tr className="bg-gray-100 dark:bg-gray-800 text-[8px] sm:text-[10px] font-black uppercase text-gray-500 border-b dark:border-gray-700"><th className="p-3 sm:p-4">Fecha</th><th className="p-3 sm:p-4">Concepto</th><th className="p-3 sm:p-4">Cat.</th><th className="p-3 sm:p-4 text-right">Monto</th><th className="p-3 sm:p-4 text-right">Saldo</th><th className="p-3 sm:p-4 w-8"></th></tr></thead>
                            <tbody className="divide-y dark:divide-gray-800">
                                {(!ledgerStartDate || new Date(ledgerStartDate) <= new Date(records[records.length-1]?.date || Date.now())) && searchTerm === '' && financeTypeFilter === 'all' && (
                                    <tr className="bg-accent/5 font-black italic">
                                        <td className="p-3 sm:p-4 text-gray-400">---</td>
                                        <td className="p-3 sm:p-4 text-accent uppercase tracking-widest">Saldo Inicial Apertura</td>
                                        <td className="p-3 sm:p-4 text-gray-400">APERTURA</td>
                                        <td className="p-3 sm:p-4 text-right">{formatCOP(initialBalanceValue)}</td>
                                        <td className="p-3 sm:p-4 text-right bg-accent/10">{formatCOP(initialBalanceValue)}</td>
                                        <td className="p-3 sm:p-4"></td>
                                    </tr>
                                )}
                                {recordsWithBalance.map(record => (
                                    <tr key={record.id} className={`hover:bg-accent/5 transition-colors group ${record.affectsCashBalance === false ? 'opacity-50 italic' : ''}`}>
                                        <td className="p-3 sm:p-4 font-mono text-gray-500 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span>{getLocalDateString(record.date)}</span>
                                                <span className="text-[8px] sm:text-[10px] font-black text-accent">{record.date.includes('T') ? record.date.split('T')[1]?.slice(0, 5) : '--:--'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 sm:p-4 min-w-[120px] sm:min-w-[200px]">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="font-bold text-gray-800 dark:text-gray-200 uppercase text-[9px] sm:text-[11px] leading-snug break-words flex-grow">{record.description}</p>
                                                    {record.debtStoreId && (
                                                        <span className="px-1.5 py-0.5 bg-yellow-500 text-white font-black text-[7px] rounded uppercase shrink-0 whitespace-nowrap">
                                                            CRUCE {filteredStores.find(s => s.id === record.debtStoreId)?.name || 'SEDE'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[8px] text-gray-400">Por: {record.registeredBy}</p>
                                            </div>
                                        </td>
                                        <td className="p-3 sm:p-4 uppercase font-black text-[8px] sm:text-[9px] text-gray-500 truncate max-w-[60px]">{record.subCategory || 'Varios'}</td>
                                        <td className={`p-3 sm:p-4 text-right font-black ${record.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {record.amount >= 0 ? '+' : ''}{formatCOP(record.amount)}
                                        </td>
                                        <td className="p-3 sm:p-4 text-right font-black bg-accent/5">
                                            {record.affectsCashBalance !== false ? formatCOP(record.saldo) : '--'}
                                        </td>
                                        <td className="p-3 sm:p-4 text-center">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => handleOpenEdit(record)} className="p-1.5 text-gray-400 hover:text-accent"><EditIcon className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteRecord(record)} className="p-1.5 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
                                <tr className="font-black">
                                    <td className="p-3 sm:p-4 text-gray-400 uppercase text-[8px]">TOTALES VISIBLES</td>
                                    <td className="p-3 sm:p-4">
                                        <div className="flex gap-4 text-[9px] uppercase">
                                            <span className="text-green-600">IN: {formatCOP(visibleTotals.income)}</span>
                                            <span className="text-red-500">OUT: {formatCOP(visibleTotals.expense)}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 sm:p-4 text-right text-gray-400 uppercase text-[8px]">NETO:</td>
                                    <td className={`p-3 sm:p-4 text-right ${visibleTotals.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {formatCOP(visibleTotals.net)}
                                    </td>
                                    <td className="p-3 sm:p-4"></td>
                                    <td className="p-3 sm:p-4"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {/* MODAL INGRESOS MANUALES */}
        {showAddModal && (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-2 sm:p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white dark:bg-secondary rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden border border-accent/20 flex flex-col max-h-[95vh]">
                    <div className="p-4 sm:p-6 bg-accent text-white flex justify-between items-center shrink-0"><div className="flex items-center gap-2 sm:gap-3"><PlusCircleIcon className="w-6 h-6 sm:w-8 sm:h-8" /><h3 className="text-lg sm:text-2xl font-black uppercase tracking-widest">Ingresar Lote</h3></div><button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-white/20 rounded-full transition-all"><CrossIcon className="w-6 h-6 sm:w-8 sm:h-8" /></button></div>
                    <div className="p-3 sm:p-4 bg-gray-100 dark:bg-gray-800 border-b-2 dark:border-gray-700 flex justify-center items-center gap-4 sm:gap-6 shadow-inner shrink-0"><div className="text-center"><p className="text-[7px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">SEDE:</p><p className="text-sm sm:text-xl font-black text-accent uppercase tracking-tighter">{activeStore?.name}</p></div><div className="h-6 sm:h-8 w-px bg-gray-300 dark:bg-gray-600"></div><div className="text-center"><p className="text-[7px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">CUENTA:</p><p className="text-sm sm:text-xl font-black text-gray-700 dark:text-white uppercase">{activeTab.toUpperCase()}</p></div></div>
                    <div className="flex-grow overflow-y-auto p-3 sm:p-6 bg-gray-50/50 dark:bg-gray-900/50">
                        <div className="space-y-4">
                            <div className="hidden md:grid grid-cols-12 gap-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"><div className="col-span-2">Fecha y Hora</div><div className="col-span-1">Cuenta</div><div className="col-span-2">Descripción</div><div className="col-span-2">Categoría</div><div className="col-span-1 text-right">Monto $</div><div className="col-span-3 text-center border-l border-gray-300 dark:border-gray-600">Conf. Cruzada</div><div className="col-span-1"></div></div>
                            {manualEntries.map((entry) => {
                                const amountVal = parseFloat(entry.amount); const isExpense = amountVal < 0;
                                return (
                                <div key={entry.tempId} className={`grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-3 items-center bg-white dark:bg-gray-800 p-3 md:p-4 rounded-2xl border transition-all ${entry.debtStoreId ? 'border-yellow-500 shadow-md ring-2 ring-yellow-500/10' : 'border-gray-200 dark:border-gray-700'} animate-fade-in relative group`}>
                                    <div className="col-span-2 md:hidden flex justify-between items-center mb-1 pb-1 border-b border-gray-100 dark:border-gray-700">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Movimiento #{manualEntries.indexOf(entry) + 1}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => handleDuplicateRow(entry.tempId)} className="p-1.5 bg-accent/10 text-accent rounded-xl" title="Duplicar"><CopyIcon className="w-4 h-4" /></button>
                                            <button onClick={() => setManualEntries(manualEntries.filter(m => m.tempId !== entry.tempId))} className="p-1.5 bg-red-50 text-red-500 rounded-xl"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    
                                    <div className="col-span-2 md:col-span-2 w-full flex flex-row md:flex-col gap-1">
                                        <div className="flex-grow flex items-center gap-1 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <button onClick={() => adjustEntryDate(entry.tempId, -1)} className="p-1 hover:bg-accent/10 rounded"><ChevronLeftIcon className="w-3 h-3 text-accent"/></button>
                                            <input type="date" value={entry.date} onChange={e => handleUpdateEntryField(entry.tempId, 'date', e.target.value)} className="flex-grow bg-transparent text-center font-bold text-[10px] outline-none" />
                                            <button onClick={() => adjustEntryDate(entry.tempId, 1)} className="p-1 hover:bg-accent/10 rounded"><ChevronLeftIcon className="w-3 h-3 text-accent rotate-180"/></button>
                                        </div>
                                        <input type="time" value={entry.time} onChange={e => handleUpdateEntryField(entry.tempId, 'time', e.target.value)} className="w-20 md:w-full bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700 font-bold text-[10px] text-center outline-none" />
                                    </div>

                                    <div className="col-span-1 md:col-span-1 w-full">
                                        <label className="md:hidden text-[7px] font-black uppercase text-gray-400 ml-1">Cuenta</label>
                                        <select value={entry.accountType} onChange={e => handleUpdateEntryField(entry.tempId, 'accountType', e.target.value as any)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 font-bold text-sm uppercase outline-none focus:border-accent">
                                            <option value="cash">Efec</option>
                                            <option value="qr">QR</option>
                                            <option value="addi">Addi</option>
                                        </select>
                                    </div>

                                    <div className="col-span-1 md:hidden w-full">
                                        <label className="md:hidden text-[7px] font-black uppercase text-gray-400 ml-1">Valor</label>
                                        <input type="text" inputMode="decimal" value={formatInputDisplay(entry.amount)} onChange={e => handleUpdateEntryField(entry.tempId, 'amount', e.target.value)} placeholder="Monto $" className={`w-full bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-700 outline-none font-black text-[11px] text-right ${isExpense ? 'text-red-500' : 'text-green-600'}`} />
                                    </div>

                                    <div className="col-span-2 md:col-span-2 w-full">
                                        <label className="md:hidden text-[7px] font-black uppercase text-gray-400 ml-1">Descripción</label>
                                        <input type="text" value={entry.description} onChange={e => handleUpdateEntryField(entry.tempId, 'description', e.target.value)} placeholder="Concepto..." className="w-full bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-700 outline-none font-bold text-[11px] focus:border-accent" />
                                    </div>

                                    <div className="col-span-2 md:col-span-2 w-full">
                                        <label className="md:hidden text-[7px] font-black uppercase text-gray-400 ml-1">Categoría</label>
                                        <input type="text" value={entry.subCategory} onChange={e => handleUpdateEntryField(entry.tempId, 'subCategory', e.target.value)} placeholder="Ej: Servicios..." className="w-full bg-accent/5 dark:bg-accent/10 p-2 rounded-xl border border-accent/20 outline-none font-black text-[10px] uppercase text-accent" />
                                    </div>

                                    <div className="hidden md:block col-span-1 w-full">
                                        <input type="text" inputMode="decimal" value={formatInputDisplay(entry.amount)} onChange={e => handleUpdateEntryField(entry.tempId, 'amount', e.target.value)} placeholder="Monto $" className={`w-full bg-gray-50 dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 outline-none font-black text-xs text-right ${isExpense ? 'text-red-500' : 'text-green-600'}`} />
                                    </div>

                                    <div className="col-span-2 md:col-span-3 w-full border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 pt-2 md:pt-0 md:pl-4">
                                        <label className="md:hidden text-[7px] font-black uppercase text-gray-400 ml-1 mb-0.5 block">¿Pago por otro local?</label>
                                        <select value={entry.debtStoreId} onChange={e => handleUpdateEntryField(entry.tempId, 'debtStoreId', e.target.value)} className="w-full bg-yellow-50 dark:bg-yellow-900/10 p-1.5 rounded-xl border border-yellow-200 dark:border-yellow-900/50 outline-none font-bold text-[9px] uppercase text-yellow-700 dark:text-yellow-400">
                                            <option value="">No es préstamo</option>
                                            {stores.filter(s => s.id !== activeStoreId && !(s.name || '').toLowerCase().includes('training')).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        {entry.debtStoreId && (
                                            <div className="mt-1.5 space-y-2 bg-yellow-100/30 dark:bg-yellow-900/5 p-2 rounded-xl border border-yellow-100">
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-[7px] font-black uppercase text-gray-500 leading-tight">Valor que es Cruce $</p>
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal" 
                                                        value={formatInputDisplay(entry.cruceAmount || '')} 
                                                        onChange={e => handleUpdateEntryField(entry.tempId, 'cruceAmount', e.target.value)} 
                                                        placeholder="Monto Cruce $" 
                                                        className="w-full bg-white dark:bg-gray-800 p-1.5 rounded border border-yellow-200 outline-none font-black text-[10px] text-right text-yellow-700 dark:text-yellow-400" 
                                                    />
                                                    <p className="text-[6px] text-gray-400 italic">Si se deja vacío, se asume el total.</p>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-[7px] font-black uppercase text-gray-500 leading-tight">¿De qué caja física salió/entró?</p>
                                                    <select value={entry.physicalStoreId || activeStoreId} onChange={e => handleUpdateEntryField(entry.tempId, 'physicalStoreId', e.target.value)} className="w-full bg-white dark:bg-gray-800 p-1 rounded border border-yellow-200 outline-none font-bold text-[8px] uppercase text-gray-700 dark:text-gray-300">
                                                        <option value={activeStoreId}>{activeStore?.name || 'Local Actual'}</option>
                                                        <option value={entry.debtStoreId}>{stores.find(s => s.id === entry.debtStoreId)?.name || 'Otra Sede'}</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-1 hidden md:flex justify-center items-center gap-2">
                                        <button onClick={() => handleDuplicateRow(entry.tempId)} className="p-2 text-gray-300 hover:text-accent transition-all" title="Duplicar registro"><CopyIcon className="w-5 h-5" /></button>
                                        <button onClick={() => setManualEntries(manualEntries.filter(m => m.tempId !== entry.tempId))} className="p-2 text-gray-300 hover:text-red-500 transition-all" title="Eliminar registro"><TrashIcon className="w-5 h-5" /></button>
                                    </div>
                                </div>
                                )})}
                        </div>
                        <button onClick={handleAddRow} className="w-full mt-4 py-4 sm:py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:text-accent hover:border-accent transition-all font-black uppercase tracking-widest text-[10px] sm:text-xs"><PlusIcon className="w-5 h-5 sm:w-6 h-6" /> Añadir otro movimiento</button>
                    </div>
                    <div className="p-4 sm:p-6 bg-gray-5 dark:bg-gray-900 border-t dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0"><div className="text-[8px] sm:text-[10px] font-bold text-gray-400 italic text-center sm:text-left max-w-sm hidden sm:block">💡 Tip: Usa la "Configuración Cruzada" para pagar facturas de otros locales sin descuadrar tu propio arqueo final.</div><div className="flex gap-2 w-full sm:w-auto"><button onClick={() => setShowAddModal(false)} className="flex-1 sm:flex-none px-6 py-3.5 text-gray-500 font-black uppercase text-[10px] sm:text-xs">Cancelar</button><button onClick={handleSaveManualEntries} className="flex-[2] sm:flex-none bg-accent text-white font-black py-3.5 px-8 sm:px-12 rounded-2xl shadow-xl hover:bg-accent-hover transition-all active:scale-95 uppercase text-xs sm:text-sm">PROCESAR LOTE</button></div></div>
                </div>
            </div>
        )}
        
        {editingRecord && (
             <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white dark:bg-secondary rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden border border-accent/20 animate-scale-up">
                    <div className="p-3.5 bg-accent text-white flex justify-between items-center"><h3 className="font-black uppercase tracking-widest text-xs sm:text-sm">Editar Movimiento</h3><button onClick={() => setEditingRecord(null)} className="hover:bg-white/20 p-1 rounded-full"><CrossIcon className="w-4 h-4" /></button></div>
                    <form onSubmit={handleUpdateSingleRecord} className="p-4 sm:p-5 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-0.5 block">Fecha</label>
                                <input type="date" value={editingRecord.dateString} onChange={e => setEditingRecord({...editingRecord, dateString: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border dark:border-gray-700 font-bold text-xs outline-none focus:border-accent"/>
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-0.5 block">Hora</label>
                                <input type="time" value={editingRecord.timeString} onChange={e => setEditingRecord({...editingRecord, timeString: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border dark:border-gray-700 font-bold text-xs outline-none focus:border-accent" />
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-0.5 block">Cuenta</label>
                                <select value={editingRecord.accountType} onChange={e => setEditingRecord({...editingRecord, accountType: e.target.value as AccountType})} className="w-full bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border dark:border-gray-700 font-bold text-xs uppercase outline-none focus:border-accent" >
                                    <option value="cash">Efectivo</option>
                                    <option value="qr">QR</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-0.5 block">Monto $</label>
                                <input type="number" inputMode="decimal" value={editingRecord.amountString} onChange={e => setEditingRecord({...editingRecord, amountString: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border dark:border-gray-700 font-black text-xs text-right outline-none focus:border-accent" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-0.5 block">Categoría</label>
                                <input type="text" value={editingRecord.subCategory} onChange={e => setEditingRecord({...editingRecord, subCategory: e.target.value})} className="w-full bg-accent/5 dark:bg-accent/10 p-1.5 rounded-lg border border-accent/20 font-bold text-xs uppercase text-accent outline-none" placeholder="Ej: SERVICIOS, NOMINA..."/>
                            </div>
                            <div className="col-span-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-0.5 block">Descripción</label>
                                <input type="text" value={editingRecord.description} onChange={e => setEditingRecord({...editingRecord, description: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border dark:border-gray-700 font-medium text-xs outline-none focus:border-accent" />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-3 border-t dark:border-gray-700">
                            <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 p-2 text-gray-500 font-bold uppercase text-[10px] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancelar</button>
                            <button type="submit" className="flex-1 bg-accent text-white font-black p-2 rounded-xl shadow-lg hover:bg-accent-hover transition-colors uppercase text-[10px]">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
             </div>
        )}

        {paymentSummary && (
             <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                 <div className="bg-white dark:bg-secondary rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-accent/20">
                     <div className="p-6 text-center space-y-4">
                         <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-2">
                             <CheckIcon className="w-10 h-10" />
                         </div>
                         <h3 className="text-xl font-black uppercase tracking-tighter">Confirmar Pago</h3>
                         <p className="text-sm text-gray-500">
                             ¿Deseas registrar el pago de la sede <span className="font-bold text-gray-800 dark:text-white">{activeStore?.name}</span> hacia <span className="font-bold text-gray-800 dark:text-white">{paymentSummary.targetStoreName}</span>?
                         </p>
                         
                         <div className="space-y-3 text-left">
                             <div>
                                 <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Monto a Pagar</label>
                                 <input 
                                     type="text" 
                                     value={formatInputDisplay(paymentSummary.amount.toString())}
                                     onChange={(e) => {
                                         const val = parseInputToNumber(e.target.value);
                                         setPaymentSummary({ ...paymentSummary, amount: parseInt(val, 10) || 0 });
                                     }}
                                     className="w-full bg-gray-100 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-black text-lg text-accent focus:border-accent"
                                 />
                             </div>
                             
                             <div className="flex gap-2">
                                 <button 
                                     onClick={() => setPaymentSummary({ ...paymentSummary, sourceAccount: 'cash' })}
                                     className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${paymentSummary.sourceAccount === 'cash' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                                 >
                                     Efectivo
                                 </button>
                                 <button 
                                     onClick={() => setPaymentSummary({ ...paymentSummary, sourceAccount: 'qr' })}
                                     className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${paymentSummary.sourceAccount === 'qr' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                                 >
                                     QR
                                 </button>
                             </div>
                             
                             <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl space-y-1">
                                 <p className="text-[9px] font-black text-gray-400 uppercase">Referencia de deuda: <span className="text-accent">{paymentSummary.debtReferenceDates}</span></p>
                             </div>
                         </div>
                         
                         <div className="flex gap-2 pt-4">
                             <button onClick={() => setPaymentSummary(null)} className="flex-1 p-3 text-gray-500 font-bold uppercase text-xs">Cancelar</button>
                             <button onClick={handleConfirmSettlement} className="flex-1 bg-accent text-white font-bold p-3 rounded-xl shadow-lg uppercase text-xs">REGISTRAR PAGO</button>
                         </div>
                     </div>
                 </div>
             </div>
        )}

        {recordToDelete && (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white dark:bg-secondary rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-500/20">
                    <div className="p-6 text-center space-y-4">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                            <TrashIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-red-600">¿Eliminar Registro?</h3>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl text-left space-y-1 border border-gray-100 dark:border-gray-800">
                            <p className="text-[10px] font-black text-gray-400 uppercase">Concepto:</p>
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase truncate">{recordToDelete.description}</p>
                            <div className="flex justify-between items-end mt-2">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase">Monto:</p>
                                    <p className={`text-sm font-black ${recordToDelete.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCOP(recordToDelete.amount)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase">Fecha:</p>
                                    <p className="text-[10px] font-bold text-gray-500">{getLocalDateString(recordToDelete.date)}</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 italic">Esta acción no se puede deshacer y afectará los saldos de conciliación.</p>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setRecordToDelete(null)} className="flex-1 p-3 text-gray-500 font-bold uppercase text-[10px] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancelar</button>
                            <button onClick={confirmDelete} className="flex-1 bg-red-500 text-white font-black p-3 rounded-xl shadow-lg hover:bg-red-600 transition-colors uppercase text-[10px]">ELIMINAR AHORA</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default FinancialReconciliationView;
