import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sale, Layaway, Expense, Store, PayrollRecord, Seller, ExpenseCategory, Product, Purchase } from '../types';
import { formatCOP } from '../constants';
import { SparklesIcon, DollarIcon, PlusCircleIcon, TrashIcon, ChartBarIcon, ReceiptIcon, EditIcon, CheckIcon, HistoryIcon, CrossIcon, SettingsIcon, PackageIcon } from './Icons';
import { getAccountingChatResponse } from '../services/geminiService';

interface SmartAccountantViewProps {
  sales: Sale[];
  layaways: Layaway[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  payrollHistory: PayrollRecord[];
  inventory: Product[];
  purchases: Purchase[];
  currentStore: Store | undefined;
  currentUser: Seller;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onAddExpenseCategory: (name: string) => void;
  onUpdateExpenseCategory: (id: string, name: string) => void;
  onDeleteExpenseCategory: (id: string) => void;
  chatMessages: ChatMessage[];
  onUpdateChatMessages: (messages: ChatMessage[]) => Promise<void>;
}

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const htmlContent = useMemo(() => {
        return content
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-gray-800 dark:text-text-light mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-accent mt-6 mb-3 border-b-2 border-accent/30 pb-1">$1</h2>')
            .replace(/^\* (.*$)/gim, '<li class="ml-5 list-disc">$1</li>')
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-accent">$1</strong>')
            .replace(/\n/g, '<br />')
            .replace(/<br \/><li>/g, '<li>') 
            .replace(/<\/li><br \/>/g, '</li>');
    }, [content]);

    return <div className="prose dark:prose-invert max-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const SmartAccountantView: React.FC<SmartAccountantViewProps> = ({
  sales,
  layaways,
  expenses,
  expenseCategories,
  payrollHistory,
  inventory,
  purchases,
  currentStore,
  currentUser,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddExpenseCategory,
  onUpdateExpenseCategory,
  onDeleteExpenseCategory,
  chatMessages,
  onUpdateChatMessages
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'expenses' | 'templates' | 'categories' | 'ai'>('summary');
  
  // Maestro de Periodo
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Form States
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState<'fixed' | 'variable'>('fixed');
  const [expenseCategory, setExpenseCategory] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Category Management States
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // Local state for immediate UI feedback in chat
  const [userInput, setUserInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const currentMonthName = monthNames[selectedMonth];

  // Sync isRecurring with Active Tab
  useEffect(() => {
    if (!editingExpense) {
      setIsRecurring(activeTab === 'templates');
    }
  }, [activeTab, editingExpense]);

  // Set default category
  useEffect(() => {
    if (!expenseCategory && expenseCategories.length > 0) {
        setExpenseCategory(expenseCategories[0].name);
    }
  }, [expenseCategories, expenseCategory]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isAiLoading, activeTab]);

  const stats = useMemo(() => {
    const startOfSelected = new Date(selectedYear, selectedMonth, 1);
    const endOfSelected = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
    
    const monthlySalesPayments = sales
        .flatMap(s => (Array.isArray(s.payments) ? s.payments : Object.values(s.payments || {})) as any[])
        .filter(p => p && new Date(p.date) >= startOfSelected && new Date(p.date) <= endOfSelected)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const monthlyLayawayPayments = layaways
        .flatMap(l => (Array.isArray(l.payments) ? l.payments : Object.values(l.payments || {})) as any[])
        .filter(p => p && new Date(p.date) >= startOfSelected && new Date(p.date) <= endOfSelected)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const totalRevenue = monthlySalesPayments + monthlyLayawayPayments;

    const monthlyCogs = sales
        .filter(s => new Date(s.createdAt) >= startOfSelected && new Date(s.createdAt) <= endOfSelected)
        .reduce((sum, s) => {
            const itemsArray = (Array.isArray(s.items) ? s.items : Object.values(s.items || {})) as any[];
            return sum + itemsArray.reduce((iSum, item) => iSum + ((item.cost || 0) * (item.quantity || 0)), 0);
        }, 0);

    const monthlyManualExpenses = expenses
        .filter(e => {
            if (e.isRecurring) return false;
            const d = new Date(e.date);
            return !isNaN(d.getTime()) && d >= startOfSelected && d <= endOfSelected;
        })
        .reduce((sum, e) => sum + e.amount, 0);

    const monthlyPayroll = payrollHistory
        .filter(p => new Date(p.paidAt) >= startOfSelected && new Date(p.paidAt) <= endOfSelected)
        .reduce((sum, p) => sum + p.totalToPay, 0);

    const monthlyPurchases = purchases
        .filter(p => new Date(p.createdAt) >= startOfSelected && new Date(p.createdAt) <= endOfSelected)
        .reduce((sum, p) => sum + p.totalCost, 0);

    const totalExpenses = monthlyManualExpenses + monthlyPayroll;
    const grossProfit = totalRevenue - monthlyCogs;
    const netProfit = grossProfit - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Asset info
    const totalInventoryValue = inventory.reduce((sum, p) => sum + (p.cost * p.stock), 0);

    return { 
        periodo: `${currentMonthName} ${selectedYear}`,
        storeName: currentStore?.name,
        accountLabels: currentStore?.accountLabels,
        totalRevenue, 
        monthlyCogs, 
        grossProfit, 
        totalExpenses, 
        netProfit, 
        margin, 
        monthlyManualExpenses, 
        monthlyPayroll,
        monthlyPurchases,
        totalInventoryValue,
        expenseDetails: expenses.filter(e => !e.isRecurring && new Date(e.date) >= startOfSelected && new Date(e.date) <= endOfSelected).map(e => ({ desc: e.description, amount: e.amount, cat: e.category }))
    };
  }, [sales, layaways, expenses, payrollHistory, inventory, purchases, selectedMonth, selectedYear, currentMonthName]);

  const handleAddOrUpdateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount || !expenseCategory) return;
    
    const amount = parseFloat(expenseAmount);
    const dateToSave = new Date(expenseDate + "T12:00:00").toISOString();

    if (editingExpense) {
        onUpdateExpense({
            ...editingExpense,
            description: expenseDesc,
            amount,
            type: expenseType,
            category: expenseCategory,
            isRecurring: isRecurring,
            date: isRecurring ? 'TEMPLATE' : dateToSave 
        });
        setEditingExpense(null);
    } else {
        onAddExpense({
          description: expenseDesc,
          amount,
          type: expenseType,
          category: expenseCategory,
          date: isRecurring ? 'TEMPLATE' : dateToSave,
          storeId: currentStore?.id || '',
          registeredBy: currentUser.name,
          isRecurring: isRecurring,
        });
    }
    
    setExpenseDesc('');
    setExpenseAmount('');
    setEditingExpense(null);
  };

  const handleEditClick = (expense: Expense) => {
      setEditingExpense(expense);
      setExpenseDesc(expense.description);
      setExpenseAmount(expense.amount.toString());
      setExpenseType(expense.type);
      setExpenseCategory(expense.category);
      if (!expense.isRecurring) {
          setExpenseDate(new Date(expense.date).toISOString().split('T')[0]);
      }
      setIsRecurring(!!expense.isRecurring);
      setActiveTab(expense.isRecurring ? 'templates' : 'expenses');
  };

  const handleApplyTemplates = () => {
    const templates = expenses.filter(e => e.isRecurring);
    if (templates.length === 0) {
        alert("No hay plantillas de gastos fijos creadas.");
        return;
    }
    if (window.confirm(`¿Seguro que deseas aplicar ${templates.length} gastos fijos a ${currentMonthName} ${selectedYear}?`)) {
        // Usar el primer día del mes seleccionado
        const targetDate = new Date(selectedYear, selectedMonth, 1, 12, 0, 0).toISOString();
        
        templates.forEach(t => {
            onAddExpense({
                description: `[FIJO] ${t.description}`,
                amount: t.amount,
                type: 'fixed',
                category: t.category,
                date: targetDate,
                storeId: currentStore?.id || '',
                registeredBy: currentUser.name,
                isRecurring: false 
            });
        });
        alert("Plantillas aplicadas correctamente al mes seleccionado.");
        setActiveTab('expenses');
    }
  };

  // Category CRUD
  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
        onAddExpenseCategory(newCatName.trim());
        setNewCatName('');
    }
  };

  const handleUpdateCat = (id: string) => {
    if (editingCatName.trim()) {
        onUpdateExpenseCategory(id, editingCatName.trim());
        setEditingCatId(null);
        setEditingCatName('');
    }
  };

  const handleDeleteCat = (id: string, name: string) => {
    const inUse = expenses.some(e => e.category === name);
    if (inUse) {
        if (!window.confirm(`La categoría "${name}" está siendo usada por algunos gastos. ¿Seguro que deseas eliminarla?`)) return;
    } else {
        if (!window.confirm(`¿Deseas eliminar la categoría "${name}"?`)) return;
    }
    onDeleteExpenseCategory(id);
  };

  // --- Chat Functions ---
  const requestSpecialReport = async (query: string) => {
    setIsAiLoading(true);
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: query }];
    await onUpdateChatMessages(newMessages);

    try {
        const apiHistory = chatMessages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        }));

        const response = await getAccountingChatResponse(stats, apiHistory, query);
        const finalMessages: ChatMessage[] = [...newMessages, { role: 'model', content: response }];
        await onUpdateChatMessages(finalMessages);
    } catch (error) {
        const errorMessages: ChatMessage[] = [...newMessages, { role: 'model', content: "Error al generar el reporte solicitado." }];
        await onUpdateChatMessages(errorMessages);
    } finally {
        setIsAiLoading(false);
    }
  }

  const handleStartAudit = async () => {
    setIsAiLoading(true);
    const initialQuery = `Haz una auditoría detallada de mis números de ${currentMonthName} ${selectedYear} y dame consejos estratégicos para mejorar.`;
    
    try {
        const response = await getAccountingChatResponse(stats, [], initialQuery);
        const finalMessages: ChatMessage[] = [
            { role: 'user', content: initialQuery },
            { role: 'model', content: response }
        ];
        await onUpdateChatMessages(finalMessages);
    } catch (error) {
        console.error(error);
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isAiLoading) return;

    const userMsg = userInput.trim();
    setUserInput('');
    
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMsg }];
    await onUpdateChatMessages(newMessages);
    setIsAiLoading(true);

    try {
        const apiHistory = chatMessages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        }));

        const response = await getAccountingChatResponse(stats, apiHistory, userMsg);
        const finalMessages: ChatMessage[] = [...newMessages, { role: 'model', content: response }];
        await onUpdateChatMessages(finalMessages);
    } catch (error) {
        const errorMessages: ChatMessage[] = [...newMessages, { role: 'model', content: "Hubo un problema procesando tu mensaje. Revisa tu conexión." }];
        await onUpdateChatMessages(errorMessages);
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleResetChat = async () => {
      if (window.confirm("¿Deseas reiniciar la conversación con el contador? Esto borrará el historial de la nube para todos los dispositivos de esta sede.")) {
          await onUpdateChatMessages([]);
          setUserInput('');
      }
  }

  const filteredExpensesList = useMemo(() => {
    if (activeTab === 'templates') {
        return expenses.filter(e => e.isRecurring === true);
    }
    return expenses.filter(e => {
        if (e.isRecurring) return false;
        const d = new Date(e.date);
        return !isNaN(d.getTime()) && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, activeTab, selectedMonth, selectedYear]);

  const years = useMemo(() => {
    const currentY = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentY - 2 + i);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      
      {/* Selector de Periodo Global */}
      <div className="bg-accent/10 border border-accent/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
              <div className="p-2 bg-accent text-white rounded-xl">
                  <ChartBarIcon className="w-5 h-5" />
              </div>
              <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tighter">Analizando Periodo:</h3>
          </div>
          <div className="flex items-center gap-2">
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                className="bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-accent/30 font-bold outline-none focus:ring-2 focus:ring-accent"
              >
                  {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select 
                value={selectedYear} 
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-accent/30 font-bold outline-none focus:ring-2 focus:ring-accent"
              >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
          </div>
      </div>

      {/* KPI Panel */}
      <div className="bg-white dark:bg-secondary p-6 rounded-2xl shadow-xl border-l-8 border-accent">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-inner">
              <DollarIcon className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">Contador Inteligente</h2>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">{currentStore?.name} • {currentMonthName} {selectedYear}</p>
            </div>
          </div>
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1.5 rounded-xl shadow-inner w-full md:w-auto overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveTab('summary')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'summary' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Resumen</button>
            <button onClick={() => setActiveTab('expenses')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'expenses' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Gastos del Mes</button>
            <button onClick={() => setActiveTab('templates')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'templates' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Plantillas Fijas</button>
            <button onClick={() => setActiveTab('categories')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'categories' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Categorías</button>
            <button onClick={() => setActiveTab('ai')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'ai' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Auditoría IA Chat</button>
          </div>
        </div>

        {activeTab === 'summary' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/10 dark:to-gray-800 p-5 rounded-2xl border border-green-100 dark:border-green-800/30 shadow-sm">
                <p className="text-xs font-black text-green-600 dark:text-green-400 uppercase mb-2">Ingresos Reales</p>
                <p className="text-3xl font-black text-green-600">{formatCOP(stats.totalRevenue)}</p>
                <div className="mt-2 h-1 w-full bg-green-200 dark:bg-green-900/50 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{width: '100%'}}></div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/10 dark:to-gray-800 p-5 rounded-2xl border border-orange-100 dark:border-orange-800/30 shadow-sm">
                <p className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase mb-2">Inversión en Compras</p>
                <p className="text-3xl font-black text-orange-600">{formatCOP(stats.monthlyPurchases)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Nuevos ingresos de mercancía</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-800 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/30 shadow-sm">
                <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase mb-2">Valor de Inventario</p>
                <p className="text-3xl font-black text-blue-600">{formatCOP(stats.totalInventoryValue)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Activo actual en bodega</p>
              </div>
              <div className="bg-accent/5 p-5 rounded-2xl border-2 border-accent/20 shadow-lg ring-4 ring-accent/5">
                <p className="text-xs font-black text-accent uppercase mb-2">Utilidad Neta</p>
                <p className={`text-3xl font-black ${stats.netProfit >= 0 ? 'text-accent' : 'text-red-600'}`}>{formatCOP(stats.netProfit)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Dinero real en bolsillo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 dark:bg-gray-800/40 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h3 className="font-black text-lg mb-6 flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <ChartBarIcon className="w-6 h-6 text-accent"/> 
                        Desglose de Costos de Operación
                    </h3>
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-bold">
                                <span>Gastos Registrados Manualmente</span>
                                <span className="text-accent">{formatCOP(stats.monthlyManualExpenses)}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{width: `${(stats.monthlyManualExpenses / (stats.totalExpenses || 1)) * 100}%`}}></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-bold">
                                <span>Nómina del Mes</span>
                                <span className="text-accent">{formatCOP(stats.monthlyPayroll)}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                                <div className="bg-purple-500 h-full rounded-full transition-all duration-1000" style={{width: `${(stats.monthlyPayroll / (stats.totalExpenses || 1)) * 100}%`}}></div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 italic pt-2">Total gastos operativos: {formatCOP(stats.totalExpenses)}</p>
                    </div>
                </div>
                
                <div className="bg-accent/5 p-8 rounded-2xl border border-accent/10 flex flex-col justify-center items-center text-center relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 opacity-5">
                        <SparklesIcon className="w-40 h-40 text-accent" />
                    </div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Rentabilidad Operativa</p>
                    <p className={`text-7xl font-black ${stats.margin > 20 ? 'text-green-500' : 'text-accent'} tracking-tighter`}>
                        {stats.margin.toFixed(1)}<span className="text-3xl">%</span>
                    </p>
                    <div className="mt-4 px-4 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-bold text-gray-500 shadow-sm border border-gray-100 dark:border-gray-700">
                        {stats.margin > 20 ? '💎 Negocio Brillante' : stats.margin > 10 ? '✅ En buen camino' : '🔥 Revisar estructura'}
                    </div>
                </div>
            </div>
          </div>
        )}

        {(activeTab === 'expenses' || activeTab === 'templates') && (
          <div className="space-y-8 animate-fade-in">
            <div className={`bg-gray-50 dark:bg-slate-800/50 p-6 rounded-2xl border-2 border-dashed ${editingExpense ? 'border-yellow-500 bg-yellow-500/5 shadow-xl ring-4 ring-yellow-500/10' : 'border-gray-300 dark:border-gray-600'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        {editingExpense ? <EditIcon className="w-5 h-5 text-yellow-500"/> : <PlusCircleIcon className="w-5 h-5 text-accent"/>}
                        {editingExpense ? `Editando: ${editingExpense.description}` : (activeTab === 'templates' ? 'Nueva Plantilla de Gasto Fijo' : 'Registrar Nuevo Gasto')}
                    </h3>
                    {editingExpense && (
                        <button onClick={() => {setEditingExpense(null); setExpenseDesc(''); setExpenseAmount('');}} className="p-1 text-red-500 hover:bg-red-50 rounded-full transition-all" title="Cancelar edición">
                            <CrossIcon className="w-6 h-6" />
                        </button>
                    )}
                </div>
                <form onSubmit={handleAddOrUpdateExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2">
                        <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="Descripción (Arriendo, Internet, Servicios...)" className="w-full p-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-accent font-medium shadow-sm" required />
                    </div>
                    <div>
                        <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Monto $" className="w-full p-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-accent font-bold shadow-sm" required />
                    </div>
                    <div>
                        <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-bold shadow-sm" required>
                            {expenseCategories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                            {expenseCategories.length === 0 && <option value="" disabled>Cargando categorías...</option>}
                        </select>
                    </div>
                    
                    {!isRecurring ? (
                        <div>
                             <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-bold shadow-sm" required />
                        </div>
                    ) : <div></div>}

                    <div className="flex flex-col gap-2 lg:col-span-1">
                        <button type="submit" className={`${editingExpense ? 'bg-yellow-600' : 'bg-accent'} text-white font-black rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 py-3 h-full`}>
                            {editingExpense ? <CheckIcon className="w-6 h-6"/> : <PlusCircleIcon className="w-6 h-6"/>}
                            {editingExpense ? 'GUARDAR CAMBIOS' : 'AGREGAR'}
                        </button>
                        {!editingExpense && (
                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded text-accent h-4 w-4" />
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">¿Guardar como Plantilla Fija?</span>
                             </label>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800/20 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 flex justify-between items-center border-b dark:border-gray-700">
                    <h4 className="font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        {activeTab === 'templates' ? <HistoryIcon className="w-5 h-5 text-accent"/> : <ReceiptIcon className="w-5 h-5 text-accent"/>}
                        {activeTab === 'templates' ? 'Lista de Gastos Fijos (Plantillas)' : `Gastos Reales de ${currentMonthName} ${selectedYear}`}
                    </h4>
                    {activeTab === 'templates' && filteredExpensesList.length > 0 && (
                        <button onClick={handleApplyTemplates} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-md active:scale-95">
                            <CheckIcon className="w-4 h-4"/> Aplicar plantillas a {currentMonthName}
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4">Información</th>
                                <th className="px-6 py-4">Descripción</th>
                                <th className="px-6 py-4">Categoría</th>
                                <th className="px-6 py-4 text-right">Monto</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {filteredExpensesList.map(e => (
                                <tr key={e.id} className="hover:bg-accent/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        {e.isRecurring ? (
                                            <span className="px-2 py-0.5 bg-accent/10 text-accent font-black rounded-md text-[10px]">FIJO</span>
                                        ) : (
                                            <span className="text-xs text-gray-400 font-mono">{new Date(e.date).toLocaleDateString()}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{e.description}</p>
                                        <p className="text-[10px] text-gray-400">Por: {e.registeredBy}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] uppercase font-black tracking-widest text-gray-500 dark:text-gray-400">
                                            {e.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-red-500">{formatCOP(e.amount)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => handleEditClick(e)} className="text-gray-400 hover:text-accent p-2 rounded-full hover:bg-accent/10" title="Editar"><EditIcon className="w-5 h-5"/></button>
                                            <button onClick={() => onDeleteExpense(e.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50" title="Eliminar"><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredExpensesList.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                        <ReceiptIcon className="w-16 h-16 mx-auto text-gray-200" />
                        <p className="text-gray-400 font-bold italic">
                            {activeTab === 'templates' ? 'No tienes plantillas creadas. Agrega los pagos fijos aquí.' : `No hay gastos registrados en ${currentMonthName} ${selectedYear}.`}
                        </p>
                    </div>
                )}
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
            <div className="animate-fade-in space-y-6">
                <div className="bg-gray-50 dark:bg-slate-800/50 p-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-4">
                        <PlusCircleIcon className="w-5 h-5 text-accent"/>
                        Agregar Nueva Categoría de Gastos
                    </h3>
                    <form onSubmit={handleAddCat} className="flex gap-4">
                        <input 
                            type="text" 
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            placeholder="Nombre de la categoría (ej: Papelería, Transporte...)"
                            className="flex-grow p-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-accent font-medium shadow-sm"
                            required
                        />
                        <button type="submit" className="bg-accent text-white font-black px-8 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95">
                            <PlusCircleIcon className="w-6 h-6"/>
                            CREAR
                        </button>
                    </form>
                </div>

                <div className="bg-white dark:bg-gray-800/20 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 flex items-center gap-2 border-b dark:border-gray-700">
                        <SettingsIcon className="w-5 h-5 text-accent"/>
                        <h4 className="font-bold text-gray-600 dark:text-gray-300">Categorías Disponibles</h4>
                    </div>
                    <div className="divide-y dark:divide-gray-800">
                        {expenseCategories.map(cat => (
                            <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors group">
                                {editingCatId === cat.id ? (
                                    <div className="flex-grow flex gap-2">
                                        <input 
                                            type="text"
                                            value={editingCatName}
                                            onChange={e => setEditingCatName(e.target.value)}
                                            className="flex-grow p-2 rounded-lg bg-white dark:bg-gray-700 border border-accent focus:ring-2 focus:ring-accent outline-none font-bold"
                                            autoFocus
                                        />
                                        <button onClick={() => handleUpdateCat(cat.id)} className="p-2 text-green-500 hover:bg-green-50 rounded-full">
                                            <CheckIcon className="w-6 h-6"/>
                                        </button>
                                        <button onClick={() => setEditingCatId(null)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                                            <CrossIcon className="w-6 h-6"/>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{cat.name}</p>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }} className="text-gray-400 hover:text-accent p-2 rounded-full hover:bg-accent/10" title="Editar">
                                                <EditIcon className="w-5 h-5"/>
                                            </button>
                                            <button onClick={() => handleDeleteCat(cat.id, cat.name)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50" title="Eliminar">
                                                <TrashIcon className="w-5 h-5"/>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'ai' && (
          <div className="animate-fade-in flex flex-col h-[800px]">
            <div className="bg-gradient-to-br from-slate-900 to-accent/20 rounded-3xl border border-white/10 shadow-2xl flex flex-col h-full overflow-hidden">
                {/* Header del Chat */}
                <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/20 backdrop-blur-md gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-accent/20 rounded-xl">
                            <SparklesIcon className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-tight">Consultoría Contable IA</h3>
                            <p className="text-[10px] text-accent font-bold uppercase tracking-widest">Auditoría de {currentMonthName} {selectedYear}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => requestSpecialReport(`Genera un Estado de Resultados (PyG) detallado de ${currentMonthName} ${selectedYear}.`)} className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-lg text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">PyG</button>
                        <button onClick={() => requestSpecialReport(`Genera un Balance General proyectado a finales de ${currentMonthName} ${selectedYear}.`)} className="flex-1 sm:flex-none px-3 py-1.5 bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded-lg text-[10px] font-black uppercase hover:bg-purple-600 hover:text-white transition-all">Balance</button>
                        <button onClick={() => requestSpecialReport(`Analiza el Flujo de Caja (entradas vs salidas reales) de ${currentMonthName} ${selectedYear}.`)} className="flex-1 sm:flex-none px-3 py-1.5 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg text-[10px] font-black uppercase hover:bg-green-600 hover:text-white transition-all">Flujo</button>
                        {chatMessages.length > 0 && (
                            <button onClick={handleResetChat} className="p-2 text-gray-400 hover:text-white transition-colors" title="Reiniciar conversación globalmente">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Área de Mensajes */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-hide bg-black/10">
                    {chatMessages.length === 0 && !isAiLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                                <SparklesIcon className="w-12 h-12 text-accent" />
                            </div>
                            <div className="max-w-md">
                                <h4 className="text-white font-bold text-lg mb-2">Análisis Financiero Especializado</h4>
                                <p className="text-gray-400 text-sm mb-8">El contador IA analizará tus ventas, el valor de tu inventario, tus compras y gastos de <strong>{currentMonthName} {selectedYear}</strong> para darte reportes reales.</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleStartAudit} className="col-span-2 bg-accent text-white font-black px-10 py-4 rounded-2xl hover:scale-105 transition-all shadow-xl shadow-accent/20 active:scale-95 uppercase tracking-widest">
                                        Auditoría General del Periodo
                                    </button>
                                    <button onClick={() => requestSpecialReport(`Genera un Estado de Resultados (PyG) de ${currentMonthName}.`)} className="bg-white/5 text-white font-bold p-3 rounded-xl border border-white/10 hover:bg-white/10 text-xs">Ver PyG (Ganancias)</button>
                                    <button onClick={() => requestSpecialReport(`Analiza mi patrimonio a ${currentMonthName}: Caja + Valor de Inventario.`)} className="bg-white/5 text-white font-bold p-3 rounded-xl border border-white/10 hover:bg-white/10 text-xs">Balance de Activos</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {chatMessages.map((msg, index) => (
                                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                    <div className={`max-w-[90%] p-5 rounded-3xl shadow-lg ${
                                        msg.role === 'user' 
                                            ? 'bg-accent text-white rounded-tr-none' 
                                            : 'bg-white/10 dark:bg-slate-800/80 backdrop-blur-md text-white rounded-tl-none border border-white/10'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-2 opacity-60">
                                            {msg.role === 'model' && <SparklesIcon className="w-3 h-3 text-accent" />}
                                            <span className="text-[10px] font-black uppercase tracking-tighter">
                                                {msg.role === 'user' ? currentUser.name : 'Director Financiero IA'}
                                            </span>
                                        </div>
                                        {msg.role === 'model' ? (
                                            <SimpleMarkdownRenderer content={msg.content} />
                                        ) : (
                                            <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isAiLoading && (
                                <div className="flex justify-start animate-pulse">
                                    <div className="bg-white/5 p-4 rounded-3xl border border-white/10 flex items-center gap-3">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-accent rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        </div>
                                        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Calculando balances contables...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input de Chat */}
                {(chatMessages.length > 0 || isAiLoading) && (
                    <div className="p-4 bg-black/40 backdrop-blur-xl border-t border-white/10">
                        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
                            <input 
                                type="text" 
                                value={userInput}
                                onChange={e => setUserInput(e.target.value)}
                                placeholder="Pide un reporte contable o haz una consulta..."
                                className="flex-grow bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-accent transition-all font-medium"
                                disabled={isAiLoading}
                            />
                            <button 
                                type="submit" 
                                disabled={isAiLoading || !userInput.trim()}
                                className="bg-accent text-white p-4 rounded-2xl hover:scale-105 transition-all shadow-lg shadow-accent/20 disabled:opacity-50 active:scale-95"
                            >
                                <CheckIcon className="w-6 h-6" />
                            </button>
                        </form>
                    </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartAccountantView;