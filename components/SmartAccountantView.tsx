
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Layaway, Expense, Store, PayrollRecord, Seller } from '../types';
import { formatCOP } from '../constants';
import { SparklesIcon, DollarIcon, PlusCircleIcon, TrashIcon, ChartBarIcon, ReceiptIcon, EditIcon, CheckIcon, HistoryIcon, CrossIcon } from './Icons';
import { analyzeAccountingData } from '../services/geminiService';

interface SmartAccountantViewProps {
  sales: Sale[];
  layaways: Layaway[];
  expenses: Expense[];
  payrollHistory: PayrollRecord[];
  currentStore: Store | undefined;
  currentUser: Seller;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

const SmartAccountantView: React.FC<SmartAccountantViewProps> = ({
  sales,
  layaways,
  expenses,
  payrollHistory,
  currentStore,
  currentUser,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'expenses' | 'templates' | 'ai'>('summary');
  
  // Form States
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState<'fixed' | 'variable'>('fixed');
  const [expenseCategory, setExpenseCategory] = useState<Expense['category']>('Other');
  const [isRecurring, setIsRecurring] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Date constants
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const currentMonthName = monthNames[currentMonthIdx];

  // Sync isRecurring with Active Tab
  useEffect(() => {
    if (!editingExpense) {
      setIsRecurring(activeTab === 'templates');
    }
  }, [activeTab, editingExpense]);

  const stats = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonthIdx, 1);
    
    // Revenue: Sum of all payments received this month
    const monthlySalesPayments = sales
        .flatMap(s => (Array.isArray(s.payments) ? s.payments : Object.values(s.payments || {})) as any[])
        .filter(p => p && new Date(p.date) >= firstDay)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const monthlyLayawayPayments = layaways
        .flatMap(l => (Array.isArray(l.payments) ? l.payments : Object.values(l.payments || {})) as any[])
        .filter(p => p && new Date(p.date) >= firstDay)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const totalRevenue = monthlySalesPayments + monthlyLayawayPayments;

    // COGS: Cost value of items sold this month
    const monthlyCogs = sales
        .filter(s => new Date(s.createdAt) >= firstDay)
        .reduce((sum, s) => {
            const itemsArray = (Array.isArray(s.items) ? s.items : Object.values(s.items || {})) as any[];
            return sum + itemsArray.reduce((iSum, item) => iSum + ((item.cost || 0) * (item.quantity || 0)), 0);
        }, 0);

    // Monthly Expenses (Excluding templates)
    const monthlyManualExpenses = expenses
        .filter(e => {
            if (e.isRecurring) return false;
            const d = new Date(e.date);
            return !isNaN(d.getTime()) && d >= firstDay;
        })
        .reduce((sum, e) => sum + e.amount, 0);

    // Payroll paid this month
    const monthlyPayroll = payrollHistory
        .filter(p => new Date(p.paidAt) >= firstDay)
        .reduce((sum, p) => sum + p.totalToPay, 0);

    const totalExpenses = monthlyManualExpenses + monthlyPayroll;
    const grossProfit = totalRevenue - monthlyCogs;
    const netProfit = grossProfit - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, monthlyCogs, grossProfit, totalExpenses, netProfit, margin, monthlyManualExpenses, monthlyPayroll };
  }, [sales, layaways, expenses, payrollHistory, currentMonthIdx, currentYear]);

  const handleAddOrUpdateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount) return;
    
    const amount = parseFloat(expenseAmount);

    if (editingExpense) {
        onUpdateExpense({
            ...editingExpense,
            description: expenseDesc,
            amount,
            type: expenseType,
            category: expenseCategory,
            isRecurring: isRecurring,
            // If it's a template, we keep the special date tag, otherwise we keep its original date
            date: isRecurring ? 'TEMPLATE' : editingExpense.date 
        });
        setEditingExpense(null);
    } else {
        onAddExpense({
          description: expenseDesc,
          amount,
          type: expenseType,
          category: expenseCategory,
          date: isRecurring ? 'TEMPLATE' : new Date().toISOString(),
          storeId: currentStore?.id || '',
          registeredBy: currentUser.name,
          isRecurring: isRecurring,
        });
    }
    
    // Reset Form
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
      setIsRecurring(!!expense.isRecurring);
      // Stay or move to appropriate tab
      setActiveTab(expense.isRecurring ? 'templates' : 'expenses');
  };

  const handleApplyTemplates = () => {
    const templates = expenses.filter(e => e.isRecurring);
    if (templates.length === 0) {
        alert("No hay plantillas de gastos fijos creadas.");
        return;
    }
    if (window.confirm(`¿Seguro que deseas aplicar ${templates.length} gastos fijos a este mes (${currentMonthName})?`)) {
        templates.forEach(t => {
            onAddExpense({
                description: `[FIJO] ${t.description}`,
                amount: t.amount,
                type: 'fixed',
                category: t.category,
                date: new Date().toISOString(),
                storeId: currentStore?.id || '',
                registeredBy: currentUser.name,
                isRecurring: false 
            });
        });
        alert("Plantillas aplicadas como gastos del mes correctamente.");
        setActiveTab('expenses');
    }
  };

  const askAI = async () => {
    setIsAiLoading(true);
    try {
        const dataForAI = {
            currentMonth: currentMonthName,
            metrics: stats,
            expensesCount: expenses.filter(e => !e.isRecurring && new Date(e.date).getMonth() === currentMonthIdx).length,
            storeName: currentStore?.name
        };
        const response = await analyzeAccountingData(dataForAI);
        setAiResponse(response);
    } catch (error) {
        setAiResponse("Lo siento, no pude generar el análisis contable en este momento.");
    } finally {
        setIsAiLoading(false);
    }
  };

  const filteredExpensesList = useMemo(() => {
    if (activeTab === 'templates') {
        return expenses.filter(e => e.isRecurring === true);
    }
    return expenses.filter(e => {
        if (e.isRecurring) return false;
        const d = new Date(e.date);
        return !isNaN(d.getTime()) && d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, activeTab, currentMonthIdx, currentYear]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* KPI Panel */}
      <div className="bg-white dark:bg-secondary p-6 rounded-2xl shadow-xl border-l-8 border-accent">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-inner">
              <DollarIcon className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">Contador Inteligente</h2>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">{currentStore?.name} • {currentMonthName} {currentYear}</p>
            </div>
          </div>
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1.5 rounded-xl shadow-inner w-full md:w-auto overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveTab('summary')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'summary' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Resumen</button>
            <button onClick={() => setActiveTab('expenses')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'expenses' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Gastos del Mes</button>
            <button onClick={() => setActiveTab('templates')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'templates' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Plantillas Fijas</button>
            <button onClick={() => setActiveTab('ai')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'ai' ? 'bg-white dark:bg-gray-700 text-accent shadow-md scale-105' : 'text-gray-500'}`}>Auditoría IA</button>
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
                <p className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase mb-2">Costo Mercancía</p>
                <p className="text-3xl font-black text-orange-600">{formatCOP(stats.monthlyCogs)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Lo que te costó lo vendido</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/10 dark:to-gray-800 p-5 rounded-2xl border border-red-100 dark:border-red-800/30 shadow-sm">
                <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase mb-2">Gastos Totales</p>
                <p className="text-3xl font-black text-red-600">{formatCOP(stats.totalExpenses)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Gastos Mes + Nómina</p>
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
                        Desglose Operativo
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
                    </div>
                </div>
                
                <div className="bg-accent/5 p-8 rounded-2xl border border-accent/10 flex flex-col justify-center items-center text-center relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 opacity-5">
                        <SparklesIcon className="w-40 h-40 text-accent" />
                    </div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Margen Neto de Rentabilidad</p>
                    <p className={`text-7xl font-black ${stats.margin > 20 ? 'text-green-500' : 'text-accent'} tracking-tighter`}>
                        {stats.margin.toFixed(1)}<span className="text-3xl">%</span>
                    </p>
                    <div className="mt-4 px-4 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-bold text-gray-500 shadow-sm border border-gray-100 dark:border-gray-700">
                        {stats.margin > 20 ? '💎 Excelente' : stats.margin > 10 ? '✅ Saludable' : '🔥 Alerta Costos'}
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
                        <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value as any)} className="w-full p-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-bold shadow-sm">
                            <option value="Rent">Arriendo</option>
                            <option value="Utilities">Servicios</option>
                            <option value="Marketing">Publicidad</option>
                            <option value="Supplies">Insumos</option>
                            <option value="Maintenance">Mantenimiento</option>
                            <option value="Other">Otro</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
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
                        {activeTab === 'templates' ? 'Lista de Gastos Fijos (Plantillas)' : `Gastos Reales de ${currentMonthName}`}
                    </h4>
                    {activeTab === 'templates' && filteredExpensesList.length > 0 && (
                        <button onClick={handleApplyTemplates} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-md active:scale-95">
                            <CheckIcon className="w-4 h-4"/> Aplicar plantillas a este mes
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
                            {activeTab === 'templates' ? 'No tienes plantillas creadas. Agrega los pagos fijos aquí.' : 'No hay gastos reales registrados este mes.'}
                        </p>
                    </div>
                )}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="animate-fade-in">
            <div className="bg-gradient-to-br from-slate-900 to-accent/20 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="flex flex-col md:flex-row items-center gap-6 mb-10 relative z-10">
                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-xl">
                        <SparklesIcon className="w-12 h-12 text-accent animate-pulse" />
                    </div>
                    <div className="text-center md:text-left">
                        <h3 className="text-3xl font-black text-white tracking-tight">Estrategia Financiera IA</h3>
                        <p className="text-accent font-bold uppercase tracking-widest text-xs">Análisis de Rentabilidad Mensual</p>
                    </div>
                </div>

                {!aiResponse ? (
                    <div className="text-center py-12 relative z-10">
                        <button onClick={askAI} disabled={isAiLoading} className="group relative bg-white text-slate-900 font-black px-10 py-5 rounded-2xl shadow-2xl hover:scale-105 transition-all flex items-center gap-4 mx-auto disabled:opacity-50 active:scale-95">
                            {isAiLoading ? (
                                <><div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full"></div> Analizando tus números...</>
                            ) : (
                                <><SparklesIcon className="w-6 h-6 text-accent" /> Generar Informe de Auditoría</>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-8 rounded-2xl border border-white/20 shadow-2xl relative z-10">
                        <div className="prose dark:prose-invert max-w-none">
                            <div className="whitespace-pre-wrap text-slate-800 dark:text-slate-100 leading-relaxed font-medium">
                                {aiResponse}
                            </div>
                        </div>
                        <button onClick={() => setAiResponse('')} className="mt-8 text-xs font-black text-accent uppercase tracking-widest hover:underline">Solicitar nueva auditoría</button>
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
