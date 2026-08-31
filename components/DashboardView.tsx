
import React, { useMemo, useState } from 'react';
import { Store, Product, Sale, Layaway, Seller, Role, View, Category, PaymentMethod, DailyNote, Incident, IncidentStatus, IncidentType, Payment, CartItem, Purchase, StockTake, Expense } from '../types';
import { formatCOP, COMMISSION_RATES } from '../constants';
import { DollarIcon, PackageIcon, ShareIcon, SwapIcon, CrossIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, EditIcon, TrashIcon, PrintIcon, AlertTriangleIcon, TruckIcon, SparklesIcon, ChartBarIcon, ReceiptIcon, TagIcon, UsersIcon, ClipboardListIcon, TagIcon as PriceIcon } from './Icons';
import { EditSaleModal } from './EditSaleModal';
import EditLayawayModal from './EditLayawayModal';
import { analyzeSalesData } from '../services/geminiService';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface DashboardViewProps {
  stores: Store[];
  allLayaways: Layaway[];
  allIncidents: Incident[];
  currentUser: Seller;
  roles: Role[];
  onSwitchStore: (storeId: string) => void;
  onNavigate: (view: View) => void;
  onOpenReports: () => void;
  sales: Sale[];
  layaways: Layaway[];
  expenses: Expense[];
  inventory: Product[];
  categories: Category[];
  sellers: Seller[];
  dailyNotes: DailyNote[];
  currentStore: Store | undefined;
  onUpdateSale: (updatedSale: Sale, originalSale: Sale) => void;
  onUpdateLayaway?: (updatedLayaway: Layaway, originalLayaway: Layaway) => void;
  onDeleteSale: (saleId: string) => void;
  onReprintSale: (sale: Sale) => void;
  onOpenVerification: () => void;
  purchases: Purchase[];
  allSales: Sale[];
  allInventory: Product[];
  allStockTakes: StockTake[];
}

interface UnifiedTransaction {
  id: string;
  date: string;
  type: 'Venta' | 'Venta de Bono' | 'Abono' | 'Recaudo Sistecredito' | 'Ajuste de Efectivo' | 'Excedente Cambio' | 'Ingreso Adicional';
  invoiceNumber: string | number;
  details: string;
  customer: string;
  seller: string;
  paymentMethod: PaymentMethod | string;
  amount: number;
}

interface PriceVariationItem {
  id: string;
  date: string;
  invoiceNumber: number;
  productName: string;
  seller: string;
  soldPrice: number;
  currentPrice: number;
  variation: number;
  quantity: number;
  totalVariation: number;
  status: 'markup' | 'discount' | 'normal';
  paymentMethods: (PaymentMethod | string)[];
}

type UnifiedSaleTransaction = (Sale & { transactionType: 'sale' }) | (Layaway & { transactionType: 'layaway', layawayStatus: Layaway['status'] });

const SalesHistoryChart: React.FC<{ data: { label: string; total: number; partialTotal: number }[], viewMode: 'daily' | 'monthly' | 'all-months' }> = ({ data, viewMode }) => {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.total), 0), [data]);
  const safeMaxValue = maxValue === 0 ? 100000 : maxValue * 1.1;

  const formatCompactCOP = (value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
    return value.toString();
  };

  const formatLabel = (label: string) => {
    if (viewMode === 'daily') return new Date(label + 'T12:00:00Z').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    const [year, month] = label.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
  };
  
  const yAxisLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= 4; i++) labels.push(safeMaxValue * (i / 4));
    return labels.reverse();
  }, [safeMaxValue]);

  if (data.length === 0) return <div className="h-96 flex items-center justify-center text-gray-500 dark:text-text-dark">No hay datos de ventas para mostrar en este periodo.</div>;

  return (
    <div className="h-96 w-full pt-4 pr-4 relative">
      <div className="absolute top-0 right-0 flex gap-4 text-xs">
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-accent rounded-sm"></div><span className="text-gray-600 dark:text-gray-400">Total Mes</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-0 border-t-2 border-dotted border-gray-500 dark:border-gray-300"></div><span className="text-gray-600 dark:text-gray-400">A la fecha actual</span></div>
      </div>
      <div className="h-full w-full flex">
        <div className="h-full flex flex-col justify-between text-xs text-gray-500 dark:text-text-dark pr-2 shrink-0">
          {yAxisLabels.map((label, i) => <div key={i} className={i === yAxisLabels.length - 1 ? "pb-6" : "-translate-y-1/2"}>{formatCOP(label).replace('$', '').replace(/\s/g, '').replace(',00', '')}</div>)}
        </div>
        <div className="flex-grow w-full pl-4 border-l border-gray-200 dark:border-gray-700">
          <div className="relative h-full w-full">
            {yAxisLabels.map((_, i) => <div key={i} className="absolute w-full border-t border-gray-200 dark:border-gray-700/50 border-dashed" style={{ bottom: `${(i / (yAxisLabels.length -1)) * 100}%` }}></div>)}
            <div className="absolute inset-0 flex items-end justify-around gap-2 px-2 pb-6">
                {data.map((d) => {
                    const barHeight = (d.total / safeMaxValue) * 100;
                    const partialHeight = (d.partialTotal / safeMaxValue) * 100;
                    return (
                    <div key={d.label} className="relative flex h-full w-full flex-col items-center justify-end group">
                        <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap shadow-lg">
                            <p className="font-bold">{formatLabel(d.label)}</p><p>Total: {formatCOP(d.total)}</p>{viewMode !== 'daily' && <p className="text-gray-300 text-[10px]">A la fecha: {formatCOP(d.partialTotal)}</p>}
                        </div>
                        <div className="text-xs font-bold text-gray-700 dark:text-text-dark mb-1 z-20">{d.total > 0 ? formatCompactCOP(d.total) : ''}</div>
                        <div className="relative w-full flex items-end h-full">
                            <div className="w-full rounded-t-md bg-accent/70 transition-all duration-300 group-hover:bg-accent absolute bottom-0 left-0" style={{ height: `${barHeight}%` }}></div>
                            {viewMode !== 'daily' && d.partialTotal > 0 && <div className="absolute w-full border-t-2 border-dotted border-gray-600 dark:border-white z-10 pointer-events-none" style={{ bottom: `${partialHeight}%`, height: '0px' }}></div>}
                        </div>
                    </div>
                )})}
            </div>
            <div className="absolute inset-0 flex items-end justify-around gap-2 px-2">
                {data.map((d) => <div key={d.label} className="w-full text-center text-[10px] text-gray-500 dark:text-text-dark">{formatLabel(d.label)}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
    return <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const toYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DashboardView: React.FC<DashboardViewProps> = (props) => {
  const {
    stores, allLayaways, allIncidents, currentUser, roles, onSwitchStore, onNavigate, onOpenReports,
    sales, layaways, expenses, inventory, currentStore, sellers, onUpdateSale, onUpdateLayaway, onDeleteSale, onReprintSale,
    onOpenVerification, purchases, allSales, allInventory, categories, allStockTakes
  } = props;

  const isAdmin = useMemo(() => {
    const adminRole = roles.find(r => (r.name || '').toLowerCase() === 'administrator' || (r.name || '').toLowerCase() === 'administrador');
    return currentUser.roleId === adminRole?.id || currentUser.roleId === '1';
  }, [currentUser, roles]);

  const latestStockTakeInconsistency = useMemo(() => {
    const pendingIncidents = allIncidents.filter(i => 
        i.type === IncidentType.INVENTORY_INCONSISTENCY && 
        i.status === IncidentStatus.REGISTRADO &&
        i.storeId === currentStore?.id
    );

    if (!allStockTakes || allStockTakes.length === 0) {
        // Fallback to incidents if no stock takes are loaded yet
        if (pendingIncidents.length > 0) {
            return {
                count: pendingIncidents.length,
                date: pendingIncidents[0].createdAt,
                seller: pendingIncidents[0].sellerName,
                isFromIncident: true
            };
        }
        return null;
    }
    
    // Filter by current store and sort by date
    const storeStockTakes = [...allStockTakes]
        .filter(st => st.storeId === currentStore?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (storeStockTakes.length === 0) {
        if (pendingIncidents.length > 0) {
            return {
                count: pendingIncidents.length,
                date: pendingIncidents[0].createdAt,
                seller: pendingIncidents[0].sellerName,
                isFromIncident: true
            };
        }
        return null;
    }
    
    const latest = storeStockTakes[0];
    const inconsistencies = latest.verification.filter(v => v.difference !== 0);
    
    // If the latest stock take is clean, we don't show the alert even if there are old incidents
    // as requested: "solo tenga en cuenta el último conteo"
    return inconsistencies.length > 0 ? {
        count: inconsistencies.length,
        date: latest.createdAt,
        seller: latest.seller,
        isFromIncident: false
    } : null;
  }, [allStockTakes, currentStore?.id, allIncidents]);

  const today = new Date();
  const [startDate, setStartDate] = useState(toYYYYMMDD(today));
  const [endDate, setEndDate] = useState(toYYYYMMDD(today));
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([]);
  const [isPaymentsReportVisible, setIsPaymentsReportVisible] = useState(true);
  const [isPriceAnalysisVisible, setIsPriceAnalysisVisible] = useState(false);
  const [isCashBreakdownVisible, setIsCashBreakdownVisible] = useState(false);
  const [isUnitsSoldExpanded, setIsUnitsSoldExpanded] = useState(false);
  const [isSalesHistoryVisible, setIsSalesHistoryVisible] = useState(true);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [salesSellerFilter, setSalesSellerFilter] = useState('');
  const [salesCategoryFilter, setSalesCategoryFilter] = useState('');
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editingLayaway, setEditingLayaway] = useState<Layaway | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [priceVariationSellerFilters, setPriceVariationSellerFilters] = useState<string[]>([]);
  const [priceVariationPaymentMethodFilters, setPriceVariationPaymentMethodFilters] = useState<string[]>([]);
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'monthly' | 'all-months'>('all-months');
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);
  const [isAIExpanded, setIsAIExpanded] = useState(false);
  const [activeAITab, setActiveAITab] = useState<'insights' | 'forecast' | 'clients' | 'query'>('insights');
  const [customAIQuery, setCustomAIQuery] = useState('');
  const [aiQueryResult, setAiQueryResult] = useState('');
  const [isAiQueryLoading, setIsAiQueryLoading] = useState(false);

  const calculateSaleProfit = (transaction: UnifiedSaleTransaction): number => {
    const itemsArray = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})) as CartItem[];
    const rawProfit = itemsArray.reduce((sum, item) => {
        if (!item || item.cost === undefined) return sum;
        return sum + ((item.price - item.cost) * item.quantity);
    }, 0);
    
    let totalCommission = 0;
    const paymentsArray = (Array.isArray(transaction.payments) ? transaction.payments : Object.values(transaction.payments || {})) as Payment[];
    
    if (paymentsArray && paymentsArray.length > 0) {
        paymentsArray.forEach(p => {
            if (p.method !== PaymentMethod.Bono) {
                const rate = COMMISSION_RATES[p.method as PaymentMethod];
                if (rate) totalCommission += (Number(p.amount) || 0) * rate;
            }
        });
    } else if ('paymentMethod' in transaction && transaction.paymentMethod) {
        const rate = COMMISSION_RATES[transaction.paymentMethod as PaymentMethod];
        if (rate) totalCommission += transaction.totalAmount * rate;
    }

    return rawProfit - totalCommission;
  };

  const renderPaymentMethods = (transaction: UnifiedSaleTransaction) => {
    const paymentsArray = (Array.isArray(transaction.payments) ? transaction.payments : Object.values(transaction.payments || {})) as Payment[];
    const methods = paymentsArray && paymentsArray.length > 0 
        ? [...new Set(paymentsArray.map(p => p.method))]
        : ('paymentMethod' in transaction && transaction.paymentMethod ? [transaction.paymentMethod] : []);

    if (methods.length === 0) return <span className="text-gray-500 dark:text-text-dark text-xs">N/A</span>;
    
    return (
        <div className="flex flex-wrap gap-1">
            {methods.map((method) => (
                <span key={method as string} className="px-2 py-1 text-[10px] font-bold rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap">
                    {method as string}
                </span>
            ))}
        </div>
    );
  };

  const isWithinRange = useMemo(() => {
    if (!startDate || !endDate) return () => true; 
    const [startY, startM, startD] = startDate.split('-').map(Number);
    const start = new Date(startY, startM - 1, startD, 0, 0, 0, 0);
    const [endY, endM, endD] = endDate.split('-').map(Number);
    const end = new Date(endY, endM - 1, endD, 23, 59, 59, 999);
    return (dateString: string) => {
      if (!dateString) return false;
      const date = new Date(dateString);
      return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
    };
  }, [startDate, endDate]);

  const handleCustomAIQuery = async () => {
    if (!customAIQuery.trim() || isAiQueryLoading) return;
    setIsAiQueryLoading(true);
    setAiQueryResult('');
    try {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        const salesToAnalyze = (isAdmin && allSales) ? allSales : sales;
        const inventoryToAnalyze = (isAdmin && allInventory) ? allInventory : inventory;
        const filteredSales = salesToAnalyze.filter(s => { const d = new Date(s.createdAt); return d >= start && d <= end; });
        const dataForAI = {
            periodo: { inicio: startDate, fin: endDate },
            resumenPorTienda: stores.map(store => {
                const storeSales = filteredSales.filter(s => s.storeId === store.id);
                const storeInventory = inventoryToAnalyze.filter(p => p.storeId === store.id);
                const productsSold = new Map<string, { name: string, quantity: number, revenue: number }>();
                
                let totalUnitsSold = 0;
                const biweeklyUnits = { q1: 0, q2: 0 };
                const firstQuincenaEnd = new Date(start.getFullYear(), start.getMonth(), 15, 23, 59, 59);

                storeSales.forEach(sale => { 
                    const saleDate = new Date(sale.createdAt);
                    const items = (sale.items || []) as CartItem[];
                    items.forEach(item => { 
                        if(!item) return; 
                        totalUnitsSold += (item.quantity || 0);
                        if (saleDate <= firstQuincenaEnd) biweeklyUnits.q1 += (item.quantity || 0);
                        else biweeklyUnits.q2 += (item.quantity || 0);

                        const existing = productsSold.get(item.id); 
                        if (existing) { 
                            existing.quantity += item.quantity; 
                            existing.revenue += item.price * item.quantity; 
                        } else { 
                            productsSold.set(item.id, { name: item.name, quantity: item.quantity, revenue: item.price * item.quantity }); 
                        } 
                    }); 
                });
                
                return { 
                    nombreTienda: store.name, 
                    totalVentas: storeSales.reduce((sum, s) => sum + s.totalAmount, 0), 
                    totalUnidadesVendidas: totalUnitsSold,
                    unidadesPorQuincena: biweeklyUnits,
                    productosVendidos: Array.from(productsSold.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 10), 
                    productosEstancados: storeInventory.filter(p => p.stock > 0 && !productsSold.has(p.id)).slice(0, 5).map(p => p.name) 
                };
            })
        };
        const result = await analyzeSalesData(dataForAI, customAIQuery);
        setAiQueryResult(result);
    } catch (e) { setAiQueryResult("Error al procesar la consulta. Intente nuevamente."); } finally { setIsAiQueryLoading(false); }
  };

  const aiInsights = useMemo(() => {
    if (!sales || !inventory || !purchases) return null;
    const startD = new Date(startDate + 'T00:00:00');
    const endD = new Date(endDate + 'T23:59:59');
    const periodLabel = `${startD.toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})} - ${endD.toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})}`;
    const daysInRange = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)));
    const allSoldItems: Record<string, { quantity: number, createdAt: string }[]> = {};
    const hourCounts: Record<number, number> = {};
    const filteredTransactions = [...sales, ...layaways.filter(l => l.status !== 'cancelled')].filter(t => isWithinRange(t.createdAt));

    filteredTransactions.forEach(t => {
        const tDate = new Date(t.createdAt);
        const hour = tDate.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        const items = (Array.isArray(t.items) ? t.items : Object.values(t.items || {})) as CartItem[];
        items.forEach(item => { if (!item) return; if (!allSoldItems[item.id]) allSoldItems[item.id] = []; allSoldItems[item.id].push({ quantity: item.quantity, createdAt: t.createdAt }); });
    });

    const sortedHours = Object.entries(hourCounts).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => b.count - a.count);
    const peak1 = sortedHours[0]; const peak2 = sortedHours[1];

    const insights = {
      period: periodLabel,
      peakHour1: peak1 ? { range: `${peak1.hour}:00 - ${peak1.hour + 1}:00`, count: peak1.count } : null,
      peakHour2: peak2 ? { range: `${peak2.hour}:00 - ${peak2.hour + 1}:00`, count: peak2.count } : null,
      highVelocity: [] as any[], 
      trending: [] as { id: string, name: string, quantity: number, context: string }[],
      restock: [] as { id: string, name: string, stock: number, velocity: number, daysLeft: number, lostSalesPotential?: number }[],
      stagnant: [] as { id: string, name: string, stock: number, cost: number, price: number, suggestedPrice: number, discount: number }[],
      atRisk: [] as { id: string, name: string, stock: number, soldQty: number, cost: number, price: number, suggestedPrice: number, discount: number }[]
    };

    inventory.forEach(p => {
      if (p.isDisabled) return;
      const soldInPeriod = (allSoldItems[p.id] || []).reduce((sum, s) => sum + s.quantity, 0);
      const unitsPerDay = soldInPeriod / daysInRange;
      
      if (unitsPerDay >= 0.7 || (p.stock === 0 && soldInPeriod > 0)) {
          insights.highVelocity.push({
              id: p.id,
              name: p.name,
              soldSinceQty: soldInPeriod,
              daysElapsed: daysInRange,
              unitsPerDay: unitsPerDay,
              isSoldOut: p.stock === 0,
              urgency: (p.stock === 0) ? 'critical' : (p.stock <= 2 ? 'high' : 'medium'),
              stockRemaining: p.stock,
              period: periodLabel
          });
      }

      if (soldInPeriod >= 5) insights.trending.push({ id: p.id, name: p.name, quantity: soldInPeriod, context: `Ventas sólidas: ${soldInPeriod} uds en el rango seleccionado.` });

      if (soldInPeriod >= 2) {
          if (p.stock === 0) {
              const lastSale = (allSoldItems[p.id] || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
              const daysSinceOut = lastSale ? Math.floor((new Date().getTime() - new Date(lastSale.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
              const lostSales = Math.floor(unitsPerDay * daysSinceOut);
              if (daysSinceOut < 30) {
                  insights.restock.push({ id: p.id, name: p.name, stock: p.stock, velocity: soldInPeriod, daysLeft: 0, lostSalesPotential: lostSales });
              }
          } else if (p.stock <= 3) {
              insights.restock.push({ id: p.id, name: p.name, stock: p.stock, velocity: soldInPeriod, daysLeft: Math.floor(p.stock / (unitsPerDay || 1)) });
          }
      }

      if (daysInRange >= 15 && p.stock >= 5 && soldInPeriod === 0) {
        const productPurchases = purchases.filter(purch => purch.productId === p.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const lastPurchaseDate = productPurchases.length > 0 ? new Date(productPurchases[0].createdAt) : null;
        if (lastPurchaseDate && (today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24) > 15) {
            const idealDiscount = 0.25; 
            let suggestedPrice = Math.round(p.price * (1 - idealDiscount));
            if (suggestedPrice < p.cost) suggestedPrice = p.cost; 
            insights.stagnant.push({ id: p.id, name: p.name, stock: p.stock, cost: p.cost, price: p.price, suggestedPrice, discount: Math.round(((p.price - suggestedPrice) / p.price) * 100) });
        }
      }
    });

    insights.highVelocity.sort((a, b) => (a.urgency === 'critical' ? 0 : 1) - (b.urgency === 'critical' ? 0 : 1) || b.unitsPerDay - a.unitsPerDay);
    insights.trending.sort((a, b) => b.quantity - a.quantity);
    insights.restock.sort((a, b) => (a.lostSalesPotential || 0) > (b.lostSalesPotential || 0) ? -1 : 1);
    return insights;
  }, [sales, inventory, purchases, layaways, startDate, endDate, isWithinRange]);

  const setDateRange = (start: Date, end: Date) => { setStartDate(toYYYYMMDD(start)); setEndDate(toYYYYMMDD(end)); };
  const setToday = () => setDateRange(new Date(), new Date());
  const setYesterday = () => { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); setDateRange(yesterday, yesterday); };
  const setLast7Days = () => { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 6); setDateRange(start, end); };
  const setThisMonth = () => { const end = new Date(); const start = new Date(end.getFullYear(), end.getMonth(), 1); setDateRange(start, end); };
  const handlePreviousDay = () => { const currentDate = new Date(startDate + 'T12:00:00'); currentDate.setDate(currentDate.getDate() - 1); setDateRange(currentDate, currentDate); };
  const handleNextDay = () => { const currentDate = new Date(endDate + 'T12:00:00'); currentDate.setDate(currentDate.getDate() + 1); setDateRange(currentDate, currentDate); };
  const isNextDayDisabled = useMemo(() => { const today = new Date(); today.setHours(0, 0, 0, 0); const currentSelectionEnd = new Date(endDate + 'T12:00:00'); currentSelectionEnd.setHours(0, 0, 0, 0); return currentSelectionEnd >= today; }, [endDate]);

    const metricsForCurrentStore = useMemo(() => {
        let totalDirectSalesValue = 0;
        let totalUnitsSold = 0;
        let totalGiftUnits = 0;
        let totalProfit = 0;
        let totalCogs = 0;
        const unitsBySeller: { [key: string]: number } = {};

        // Calculate Operating Expenses
        const EXCLUDED_OPERATING_CATEGORIES = ['MERCANCIA', 'COMPRA MERCANCIA', 'INVENTARIO', 'ACTIVOS', 'INVERSION'];
        const totalExpenses = (expenses || []).filter(e => {
            const isStoreMatch = !currentStore?.id || e.storeId === currentStore.id;
            if (!isStoreMatch || !isWithinRange(e.date)) return false;
            const cat = (e.category || '').toUpperCase();
            return !EXCLUDED_OPERATING_CATEGORIES.some(ex => cat.includes(ex));
        }).reduce((sum, e) => sum + e.amount, 0);

        // 1. Unidades vendidas y COGS: Basado en CREACIÓN (como el reporte diario)
        // Pero excluyendo ventas que vienen de apartados para no duplicar unidades
        const transactionsForUnits = [
            ...sales.filter(s => !s.layawayId), 
            ...layaways.filter(l => l.status !== 'cancelled' && l.status !== 'pre-order')
        ].filter(t => (!currentStore?.id || t.storeId === currentStore.id) && isWithinRange(t.createdAt));

        transactionsForUnits.forEach(t => {
            const items = (Array.isArray(t.items) ? t.items : Object.values(t.items || {})) as CartItem[];
            
            // Exclude gift products (price 0) from sales units
            const saleItems = items.filter(item => item && (item.price || 0) > 0);
            const giftItems = items.filter(item => item && (item.price || 0) === 0);
            
            const tUnits = saleItems.reduce((sum, item) => sum + (item?.quantity || 0), 0);
            const tGifts = giftItems.reduce((sum, item) => sum + (item?.quantity || 0), 0);
            
            totalUnitsSold += tUnits;
            totalGiftUnits += tGifts;
            
            const seller = t.seller;
            unitsBySeller[seller] = (unitsBySeller[seller] || 0) + tUnits;
        });

        // 2. Ingresos y Utilidad: Basado en PAGOS (como el reporte diario)
        const allTransactionsForRevenue = [...sales, ...layaways.filter(l => l.status !== 'cancelled')];
        const uniqueInvoicesInRange = new Set<string>();

        allTransactionsForRevenue.filter(t => !currentStore?.id || t.storeId === currentStore.id).forEach(t => {
            const payments = (Array.isArray(t.payments) ? t.payments : Object.values(t.payments || {})) as Payment[];
            const items = (Array.isArray(t.items) ? t.items : Object.values(t.items || {})) as CartItem[];
            
            // Exclude internal gift products from COGS calculations if needed (usually cost still counts, but user says ignore them everywhere)
            // But they were ALREADY filtered out from profit because price is 0. 
            // The user says "no debe sumar en el cierre ni en nómina ni en ninguna parte donde puedan afectar"
            const saleItems = items.filter(item => item && (item.price || 0) > 0);
            
            const totalTransactionAmount = Math.max(t.totalAmount, 1);
            const totalTransactionCost = saleItems.reduce((sum, item) => sum + ((item?.cost || 0) * (item?.quantity || 0)), 0);
            const rawTransactionProfit = saleItems.reduce((sum, item) => sum + (((item.price || 0) - (item.cost || 0)) * (item.quantity || 0)), 0);

            payments.forEach(p => {
                if (isWithinRange(p.date)) {
                    const amount = Number(p.amount) || 0;
                    const ratio = amount / totalTransactionAmount;
                    
                    if (p.method !== PaymentMethod.Bono) {
                        totalDirectSalesValue += amount;
                        uniqueInvoicesInRange.add(t.id);
                        
                        // Profit & COGS (Payment based)
                        const rate = COMMISSION_RATES[p.method as PaymentMethod] || 0;
                        const pCommission = amount * rate;
                        
                        totalProfit += (rawTransactionProfit * ratio) - pCommission;
                        totalCogs += (totalTransactionCost * ratio);
                    }
                }
            });
        });

        // Sumar Novedades de Caja (Recaudos e Ingresos)
        const revenueAdjustments = allIncidents.filter(i => 
            (!currentStore?.id || i.storeId === currentStore.id) && 
            isWithinRange(i.createdAt) &&
            (i.type === IncidentType.RECAUDO || (i.type === IncidentType.CASH_ADJUSTMENT && i.adjustmentType === 'income')) &&
            i.status !== IncidentStatus.PENDIENTE_APROBACION
        );

        revenueAdjustments.forEach(adj => {
            totalDirectSalesValue += (adj.adjustmentAmount || 0);
            totalProfit += (adj.adjustmentAmount || 0); // Todo lo de recaudo es utilidad neta
        });

        const sortedUnitsBySeller = Object.entries(unitsBySeller)
            .map(([sellerName, units]) => ({ sellerName, units: Number(units.toFixed(2)) }))
            .sort((a, b) => b.units - a.units);

        const averageTicketSize = uniqueInvoicesInRange.size > 0 ? totalDirectSalesValue / uniqueInvoicesInRange.size : 0;
        const totalInventoryValue = inventory.reduce((sum, p) => sum + (p.cost * p.stock), 0);
        const netProfit = totalProfit - totalExpenses;

        return { 
            totalUnitsSold: Math.round(totalUnitsSold), 
            totalGiftUnits: Math.round(totalGiftUnits),
            totalProfit, 
            averageTicketSize, 
            totalInventoryValue, 
            unitsBySeller: sortedUnitsBySeller, 
            totalDirectSalesValue, 
            totalExpenses, 
            totalCogs, 
            netProfit 
        };
    }, [sales, layaways, inventory, expenses, isWithinRange]);
  
  const cashBreakdown = useMemo(() => {
    const cashLikeMethods = [PaymentMethod.Efectivo];
    const currentStoreId = inventory[0]?.storeId;
    if (!currentStoreId) return null;
    const salesCash = sales.filter(sale => !sale.layawayId).flatMap(sale => (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})) as Payment[]).filter(p => p && isWithinRange(p.date) && cashLikeMethods.includes(p.method)).reduce((sum, p) => sum + p.amount, 0);
    const layawaysCash = layaways.flatMap(l => (Array.isArray(l.payments) ? l.payments : Object.values(l.payments || {})) as Payment[]).filter(p => p && isWithinRange(p.date) && cashLikeMethods.includes(p.method)).reduce((sum, p) => sum + p.amount, 0);
    const cashIncidents = allIncidents.filter(i => i.storeId === currentStoreId && isWithinRange(i.createdAt) && i.type === IncidentType.CASH_ADJUSTMENT && (i.paymentMethod ? i.paymentMethod === PaymentMethod.Efectivo : true) && !i.description.includes('Excedente pagado') && i.status !== IncidentStatus.PENDIENTE_APROBACION);
    const totalIncomeAdjustments = cashIncidents.filter(i => i.adjustmentType === 'income').reduce((sum, i) => sum + (i.adjustmentAmount || 0), 0);
    const totalExpenseAdjustments = cashIncidents.filter(i => i.adjustmentType === 'expense').reduce((sum, i) => sum + (i.adjustmentAmount || 0), 0);
    const exchangeSurplusesCashList = allIncidents.filter(i => i.storeId === currentStoreId && isWithinRange(i.createdAt) && i.type === IncidentType.PRODUCT_EXCHANGE && i.paymentMethod === PaymentMethod.Efectivo && (i.adjustmentAmount || 0) > 0 && i.status !== IncidentStatus.PENDIENTE_APROBACION);
    const totalExchangeSurplusesCash = exchangeSurplusesCashList.reduce((sum, i) => sum + (i.adjustmentAmount || 0), 0);
    return { salesCash, layawaysCash, totalExchangeSurplusesCash, incomeAdjustments: cashIncidents.filter(i => i.adjustmentType === 'income'), expenseAdjustments: cashIncidents.filter(i => i.adjustmentType === 'expense'), exchangeSurpluses: exchangeSurplusesCashList, netTotal: salesCash + layawaysCash + totalExchangeSurplusesCash + totalIncomeAdjustments - totalExpenseAdjustments };
  }, [sales, layaways, allIncidents, inventory, isWithinRange]);

  const detailedReportData = useMemo(() => {
    const totalsByMethod: { [key: string]: number } = {};
    const commissionsByMethod: { [key: string]: number } = {};
    const allPayments: UnifiedTransaction[] = [];
    const currentStoreId = inventory[0]?.storeId;
    sales.forEach(sale => {
      const paymentsArray: Payment[] = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})) as Payment[];
      if (!sale.layawayId && paymentsArray) {
        paymentsArray.forEach((payment, index) => {
          if (payment && isWithinRange(payment.date)) {
            const items = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {})) as CartItem[];
            const isVoucherSale = items.length > 0 && items.some(i => i && i.id && i.id.startsWith('voucher-'));
            const typeLabel: UnifiedTransaction['type'] = isVoucherSale ? 'Venta de Bono' : 'Venta';
            allPayments.push({
              id: `${sale.id}-${index}`,
              date: payment.date,
              type: typeLabel,
              invoiceNumber: sale.invoiceNumber,
              details: items.map(i => `${i.quantity}x ${i.name}`).join(', '),
              customer: sale.customerName,
              seller: payment.seller,
              paymentMethod: payment.method,
              amount: Number(payment.amount)
            });
          }
        });
      }
    });
    layaways.forEach(layaway => { const paymentsArray: Payment[] = (Array.isArray(layaway.payments) ? layaway.payments : Object.values(layaway.payments || {})) as Payment[]; paymentsArray.forEach((payment, index) => { if (payment && isWithinRange(payment.date)) { allPayments.push({ id: `${layaway.id}-${index}`, date: payment.date, type: 'Abono', invoiceNumber: layaway.invoiceNumber, details: index === 0 ? `Abono inicial para #${layaway.invoiceNumber}` : `Pago a abono #${layaway.invoiceNumber}`, customer: layaway.customerName, seller: payment.seller, paymentMethod: payment.method, amount: Number(payment.amount) }); } }); });
    allIncidents.forEach(incident => {
      if (incident.storeId === currentStoreId && isWithinRange(incident.createdAt)) {
        if (incident.status === IncidentStatus.PENDIENTE_APROBACION) return;

        if (incident.type === IncidentType.PRODUCT_EXCHANGE) {
          if ((incident.adjustmentAmount || 0) > 0 && incident.paymentMethod) {
            allPayments.push({
              id: incident.id,
              date: incident.createdAt,
              type: 'Excedente Cambio',
              invoiceNumber: incident.originalSaleInvoiceNumber || '-',
              details: incident.description || `Excedente por cambio de factura #${incident.originalSaleInvoiceNumber || '-'}`,
              customer: incident.customerName || 'N/A',
              seller: incident.sellerName,
              paymentMethod: incident.paymentMethod,
              amount: Number(incident.adjustmentAmount) || 0
            });
          }
          return;
        }

        if (incident.type === IncidentType.CASH_ADJUSTMENT && incident.description.includes('Excedente pagado')) return;

        const isIncome = (incident.type === IncidentType.RECAUDO || incident.type === IncidentType.ADDITIONAL_INCOME || (incident.type === IncidentType.CASH_ADJUSTMENT && incident.adjustmentType === 'income'));
        let paymentMethod: PaymentMethod | string | undefined = incident.paymentMethod;
        let type: UnifiedTransaction['type'] = 'Ajuste de Efectivo';
        if (incident.type === IncidentType.RECAUDO) {
          type = 'Recaudo Sistecredito';
          paymentMethod = 'Recaudo Sistecredito';
        } else if (incident.type === IncidentType.ADDITIONAL_INCOME) {
          type = 'Ingreso Adicional';
        }
        if (isIncome && paymentMethod && (incident.adjustmentAmount || 0) > 0) {
          allPayments.push({
            id: incident.id,
            date: incident.createdAt,
            type: type,
            invoiceNumber: incident.originalSaleInvoiceNumber || '-',
            details: incident.description,
            customer: incident.customerName || 'N/A',
            seller: incident.sellerName,
            paymentMethod: paymentMethod!,
            amount: incident.adjustmentAmount || 0
          });
        }
      }
    });
    
    allPayments.forEach((p: UnifiedTransaction) => { 
        const methodKey = String(p.paymentMethod);
        const amountValue: number = Number(p.amount) || 0;
        const currentTotalValue: number = Number(totalsByMethod[methodKey]) || 0;
        totalsByMethod[methodKey] = currentTotalValue + amountValue; 
        const rate = COMMISSION_RATES[p.paymentMethod as PaymentMethod]; 
        if (rate !== undefined) {
            const currentCommissionValue: number = Number(commissionsByMethod[methodKey]) || 0;
            commissionsByMethod[methodKey] = currentCommissionValue + (amountValue * rate); 
        }
    });

    allPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const filteredTransactions = paymentMethodFilter.length > 0 ? allPayments.filter(p => paymentMethodFilter.includes(String(p.paymentMethod))) : allPayments;
    const groupedTransactions: { [date: string]: { total: number; items: UnifiedTransaction[] } } = {};
    filteredTransactions.forEach(t => { const dateKey = new Date(t.date).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }); if (!groupedTransactions[dateKey]) groupedTransactions[dateKey] = { total: 0, items: [] }; if (t.paymentMethod !== PaymentMethod.Bono && t.paymentMethod !== 'Recaudo Sistecredito') groupedTransactions[dateKey].total += t.amount; groupedTransactions[dateKey].items.push(t); });
    
    // Sort grouped transactions by date for the detailed report
    const sortedGroups = Object.entries(groupedTransactions).sort((a, b) => {
        // Use the date from the first item to compare effectively
        const dateA = new Date(a[1].items[0].date).getTime();
        const dateB = new Date(b[1].items[0].date).getTime();
        return dateB - dateA; // Descending order (recent first)
    });

    return { totalsByMethod, commissionsByMethod, filteredTransactions, sortedGroups };
  }, [sales, layaways, allIncidents, inventory, isWithinRange, paymentMethodFilter]);

  const totalPeriodIncome = useMemo(() => Object.entries(detailedReportData.totalsByMethod).reduce((sum, [method, total]) => (method !== 'Recaudo Sistecredito' && method !== PaymentMethod.Bono) ? sum + (total as number) : sum, 0), [detailedReportData.totalsByMethod]);
  const totalRecaudos = useMemo(() => (detailedReportData.totalsByMethod['Recaudo Sistecredito'] as number) || 0, [detailedReportData.totalsByMethod]);

  const togglePaymentMethodFilter = (method: string) => {
    setPaymentMethodFilter(prev => 
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  const getDayTotalForFilteredMethods = (items: UnifiedTransaction[]) => {
      return items
        .filter(t => paymentMethodFilter.length === 0 || paymentMethodFilter.includes(String(t.paymentMethod)))
        .filter(t => t.paymentMethod !== PaymentMethod.Bono && t.paymentMethod !== 'Recaudo Sistecredito')
        .reduce((sum, item) => sum + item.amount, 0);
  };

  const priceVariationReportData = useMemo(() => {
    const reportItems: PriceVariationItem[] = [];
    sales.forEach(sale => {
      if (isWithinRange(sale.createdAt) && sale.items) {
        const paymentMethods = sale.payments && sale.payments.length > 0 ? [...new Set(sale.payments.map(p => p.method))] : (sale.paymentMethod ? [sale.paymentMethod] : []);
        const items = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {})) as CartItem[];
        items.forEach(item => {
          if (!item || (item.price || 0) === 0) return;
          const productInInventory = inventory.find(p => p.id === item.id);
          if (!productInInventory) return;

          // Resolve authorized system price taking into account promotional prices:
          const hasItemPromo = item.discountPrice !== undefined && item.discountPrice > 0;
          const hasInventoryPromo = productInInventory.discountPrice !== undefined && productInInventory.discountPrice > 0;
          
          let officialSystemPrice = productInInventory.price;
          let isPromo = false;

          if (hasItemPromo) {
            officialSystemPrice = item.discountPrice!;
            isPromo = item.discountPrice !== (item.basePrice || productInInventory.price);
          } else if (hasInventoryPromo && (item.price <= productInInventory.discountPrice! || item.price < productInInventory.price)) {
            officialSystemPrice = productInInventory.discountPrice!;
            isPromo = productInInventory.discountPrice !== productInInventory.price;
          }

          const variation = item.price - officialSystemPrice;
          const totalVariation = variation * item.quantity;

          reportItems.push({
            id: `${sale.id}-${item.id}`,
            date: sale.createdAt,
            invoiceNumber: sale.invoiceNumber,
            productName: isPromo ? `${item.name} 🏷️ (Promo)` : item.name,
            seller: sale.seller,
            soldPrice: item.price,
            currentPrice: officialSystemPrice,
            variation: variation,
            quantity: item.quantity,
            totalVariation: totalVariation,
            status: variation > 0 ? 'markup' : (variation < 0 ? 'discount' : 'normal'),
            paymentMethods: paymentMethods
          });
        });
      }
    });
    const filteredItems = reportItems.filter(item => (priceVariationSellerFilters.length > 0 ? priceVariationSellerFilters.includes(item.seller) : true) && (priceVariationPaymentMethodFilters.length > 0 ? item.paymentMethods.some(m => priceVariationPaymentMethodFilters.includes(String(m))) : true));
    const summary = filteredItems.reduce((acc, item) => { if (item.totalVariation > 0) acc.totalMarkup += item.totalVariation; else if (item.totalVariation < 0) acc.totalDiscount += item.totalVariation; return acc; }, { totalMarkup: 0, totalDiscount: 0 });
    return { items: filteredItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), summary: { ...summary, netDifference: summary.totalMarkup + summary.totalDiscount } };
  }, [sales, inventory, isWithinRange, priceVariationSellerFilters, priceVariationPaymentMethodFilters]);

  const categoryReport = useMemo(() => {
    const allTransactions = [...sales.filter(s => isWithinRange(s.createdAt)), ...layaways.filter(l => isWithinRange(l.createdAt))];
    const categoryData: { [key: string]: { totalSales: number; totalUnits: number, products: Record<string, {name: string, qty: number, revenue: number}> } } = {};
    allTransactions.forEach(transaction => { 
        const itemsArray = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})) as CartItem[];
        itemsArray.forEach((item: CartItem) => { 
            if (!item) return; 
            const categoryId = item.categoryId; 
            if (!categoryData[categoryId]) {
                categoryData[categoryId] = { totalSales: 0, totalUnits: 0, products: {} }; 
            }
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            categoryData[categoryId].totalSales += price * quantity; 
            categoryData[categoryId].totalUnits += quantity; 
            if (!categoryData[categoryId].products[item.id]) {
                categoryData[categoryId].products[item.id] = { name: item.name, qty: 0, revenue: 0 }; 
            }
            categoryData[categoryId].products[item.id].qty += quantity; 
            categoryData[categoryId].products[item.id].revenue += price * quantity; 
        }); 
    });
    return Object.entries(categoryData).map(([categoryId, data]) => ({ 
        categoryId, 
        categoryName: categories.find(c => c.id === categoryId)?.name || 'Sin Categoría', 
        ...data, 
        productList: Object.values(data.products).sort((a, b) => b.qty - a.qty) 
    })).sort((a, b) => b.totalSales - a.totalSales);
  }, [sales, layaways, categories, isWithinRange]);

    const topProductsReport = useMemo(() => {
        const allTransactions = [...sales.filter(s => isWithinRange(s.createdAt)), ...layaways.filter(l => isWithinRange(l.createdAt))];
        const productData: { [key: string]: { totalUnits: number; totalSales: number } } = {};
        allTransactions.forEach(transaction => { 
            const itemsArray = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})) as CartItem[];
            itemsArray.forEach((item: CartItem) => { 
                if (!item) return; 
                const productId = item.id; 
                if (!productData[productId]) {
                    productData[productId] = { totalUnits: 0, totalSales: 0 }; 
                }
                const price = Number(item.price) || 0;
                const quantity = Number(item.quantity) || 0;
                productData[productId].totalUnits += quantity; 
                productData[productId].totalSales += price * quantity; 
            }); 
        });
        return Object.entries(productData).map(([productId, data]) => ({ productId, productName: inventory.find(p => p.id === productId)?.name || 'Producto Desconocido', ...data })).sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 10);
    }, [sales, layaways, inventory, isWithinRange]);
    
    const forecastAnalysis = useMemo(() => {
        const now = new Date(); const currentDay = now.getDate(); const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const firstQuincenaEnd = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
        
        let totalPaymentsThisMonth = 0;
        let currentUnitsSold = 0;
        let q1Units = 0;
        let q2Units = 0;

        sales.forEach(sale => { 
            const payments = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})) as Payment[]; 
            if (payments) { 
                payments.forEach(p => { 
                    const paymentDate = new Date(p.date); 
                    if (paymentDate >= startOfMonth && paymentDate <= endOfMonth) totalPaymentsThisMonth += Number(p.amount); 
                }); 
            } else if (sale.paymentMethod && !sale.layawayId) { 
                const saleDate = new Date(sale.createdAt); 
                if (saleDate >= startOfMonth && saleDate <= endOfMonth) totalPaymentsThisMonth += sale.totalAmount; 
            } 

            const createdAt = new Date(sale.createdAt);
            if (createdAt >= startOfMonth && createdAt <= endOfMonth) {
                const items = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {})) as CartItem[];
                const units = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
                currentUnitsSold += units;
                if (createdAt <= firstQuincenaEnd) q1Units += units;
                else q2Units += units;
            }
        });

        layaways.forEach(layaway => { 
            const payments = (Array.isArray(layaway.payments) ? layaway.payments : Object.values(layaway.payments || {})) as Payment[]; 
            if (payments) { 
                payments.forEach(p => { 
                    const paymentDate = new Date(p.date); 
                    if (paymentDate >= startOfMonth && paymentDate <= endOfMonth) totalPaymentsThisMonth += Number(p.amount); 
                }); 
            } 
        });

        const dailyAverage = currentDay > 0 ? totalPaymentsThisMonth / currentDay : 0;
        const dailyUnitsAverage = currentDay > 0 ? currentUnitsSold / currentDay : 0;
        const projectedTotal = dailyAverage * totalDaysInMonth;
        const projectedUnits = Math.round(dailyUnitsAverage * totalDaysInMonth);

        return { 
            currentTotal: totalPaymentsThisMonth, 
            projectedTotal,
            ambitiousTotal: projectedTotal * 1.15,
            eliteTotal: projectedTotal * 1.30,
            currentUnits: currentUnitsSold,
            projectedUnits,
            ambitiousUnits: Math.round(projectedUnits * 1.15),
            eliteUnits: Math.round(projectedUnits * 1.30),
            q1Units,
            q2Units,
            dailyAverage, 
            monthProgress: (currentDay / totalDaysInMonth) * 100, 
            daysRemaining: totalDaysInMonth - currentDay, 
            incentives: [
                { tier: 'BASE', target: projectedTotal, reward: 'Bono Standard', units: projectedUnits },
                { tier: 'AMBICIOSA', target: projectedTotal * 1.15, reward: 'Incentivo 15% + Día Libre', units: Math.round(projectedUnits * 1.15) },
                { tier: 'ÉLITE', target: projectedTotal * 1.30, reward: 'Mega-Incentivo 30% + Premio Especial', units: Math.round(projectedUnits * 1.30) }
            ],
            strategies: currentDay <= 10 ? [{ title: "Impulso Inicial", desc: "Contacta a los 5 mejores clientes del mes pasado para mostrar novedades.", type: "marketing" as const }, { title: "Exhibición", desc: "Rota los maniquíes y vitrina para dar sensación de novedad total.", type: "sales" as const }, { title: "Metas Claras", desc: "Asegúrate que cada vendedor conozca su meta diaria para este mes.", type: "admin" as const }] : (currentDay <= 20 ? [{ title: "Movimiento de Stock", desc: "Identifica los 3 productos menos vendidos y ármalos en outfits atractivos.", type: "sales" as const }, { title: "Activación de Clientes", desc: "Envía mensajes de 'Te extrañamos' a clientes que no han venido en 2 meses.", type: "marketing" as const }, { title: "Revisión de Inventario", desc: "Haz un conteo rápido de las categorías más vendidas para evitar quiebres.", type: "admin" as const }] : [{ title: "Cierre de Mes", desc: "Enfócate en cerrar los abonos pendientes para sumar al flujo de caja.", type: "sales" as const }, { title: "Liquidación Express", desc: "Si la meta está lejos, considera una promo flash de fin de semana.", type: "marketing" as const }, { title: "Pre-Venta", desc: "Ofrece apartar prendas de la próxima colección para asegurar ventas futuras.", type: "sales" as const }]) 
        };
    }, [sales, layaways]);

  const churnAnalysis = useMemo(() => {
    const today = new Date(); const customerMap = new Map<string, { name: string; phone: string; lastPurchaseDate: Date; totalSpent: number; purchaseCount: number; paymentMethods: Record<string, number>; }>();
    const processTransaction = (customerName: string, customerPhone: string, date: string, amount: number, payments?: Payment[], paymentMethod?: string) => { 
      if (!customerName || customerName === 'Cliente Mostrador' || !customerPhone || customerPhone.length < 10) return; 
      const key = `${(customerName || '').toLowerCase()}-${customerPhone || ''}`; 
      const existing = customerMap.get(key); 
      const transactionDate = new Date(date); 
      const methodsUsed: string[] = []; 
      if (payments) payments.forEach(p => methodsUsed.push(p.method)); 
      else if (paymentMethod) methodsUsed.push(paymentMethod); 
      if (existing) { 
        existing.lastPurchaseDate = transactionDate > existing.lastPurchaseDate ? transactionDate : existing.lastPurchaseDate; 
        existing.totalSpent += amount; 
        existing.purchaseCount += 1; 
        methodsUsed.forEach(m => { existing.paymentMethods[m] = (existing.paymentMethods[m] || 0) + 1; }); 
      } else { 
        const initialMethods: Record<string, number> = {}; 
        methodsUsed.forEach(m => initialMethods[m] = 1); 
        customerMap.set(key, { name: customerName, phone: customerPhone, lastPurchaseDate: transactionDate, totalSpent: amount, purchaseCount: 1, paymentMethods: initialMethods }); 
      } 
    };
    sales.filter(s => !s.layawayId).forEach(sale => processTransaction(sale.customerName, sale.customerPhone, sale.createdAt, sale.totalAmount, sale.payments, sale.paymentMethod));
    layaways.filter(l => l.status === 'completed').forEach(layaway => processTransaction(layaway.customerName, layaway.customerPhone, layaway.createdAt, layaway.totalAmount, layaway.payments));
    return Array.from(customerMap.values()).filter(c => ((today.getTime() - c.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)) > 45 && c.purchaseCount > 1).map(c => { let preferredMethod = 'Desconocido'; let maxCount = 0; Object.entries(c.paymentMethods).forEach(([method, count]) => { if (count > maxCount) { maxCount = count; preferredMethod = method; } }); return { ...c, daysSince: Math.floor((today.getTime() - c.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)), preferredMethod }; }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);
  }, [sales, layaways]);

  const salesChartData = useMemo(() => {
    const dataMap = new Map<string, { total: number; partialTotal: number }>();
    const now = new Date();
    const allTransactions: (Sale | Layaway)[] = [...sales.filter(s => !s.layawayId), ...layaways.filter(l => l.status === 'active' || l.status === 'completed')];
    allTransactions.forEach(t => {
        const date = new Date(t.createdAt);
        let label = '';
        if (chartViewMode === 'daily') { label = date.toISOString().split('T')[0]; } else { label = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`; }
        const existing = dataMap.get(label) || { total: 0, partialTotal: 0 };
        existing.total += t.totalAmount;
        if (chartViewMode !== 'daily') { if (date.getDate() <= now.getDate()) { existing.partialTotal += t.totalAmount; } } else { existing.partialTotal = existing.total; }
        dataMap.set(label, existing);
    });
    return Array.from(dataMap.entries()).map(([label, { total, partialTotal }]) => ({ label, total, partialTotal })).sort((a, b) => a.label.localeCompare(b.label));
  }, [sales, layaways, chartViewMode]);

    const managedSales = useMemo(() => {
        const layawayIds = new Set(layaways.map(l => l.id));
        const cleanSales = sales.filter(s => !layawayIds.has(s.id));
        const allTransactions: UnifiedSaleTransaction[] = [...cleanSales.map(s => ({ ...s, transactionType: 'sale' as const })), ...layaways.map(l => ({ ...l, transactionType: 'layaway' as const, layawayStatus: l.status }))];
        return allTransactions.filter(transaction => { 
          const lowerCaseSearchTerm = (salesSearchTerm || '').toLowerCase(); 
          const itemsArray: CartItem[] = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})).filter(Boolean) as CartItem[]; 
          const invNum = (transaction.invoiceNumber ?? '').toString();
          const custName = (transaction.customerName || '').toLowerCase();
          const custPhone = transaction.customerPhone || '';
          const matchesSearch = invNum.includes(salesSearchTerm) || 
            custName.includes(lowerCaseSearchTerm) || 
            custPhone.includes(salesSearchTerm) || 
            itemsArray.some((item: CartItem) => item && ((item.name || '').toLowerCase().includes(lowerCaseSearchTerm) || (item.supplier && (item.supplier || '').toLowerCase().includes(lowerCaseSearchTerm)))); 
          const matchesSeller = salesSellerFilter ? transaction.seller === salesSellerFilter : true; 
          const matchesCategory = salesCategoryFilter ? itemsArray.some((item: CartItem) => item && item.categoryId === salesCategoryFilter) : true; 
          return matchesSearch && matchesSeller && isWithinRange(transaction.createdAt) && matchesCategory; 
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }, [sales, layaways, salesSearchTerm, salesSellerFilter, salesCategoryFilter, isWithinRange]);

  const handleShareCurrentStore = async () => {
    const { totalUnitsSold, totalProfit, averageTicketSize, totalDirectSalesValue } = metricsForCurrentStore;
    
    // 1. Detalle Diario Cronológico (Usando sortedGroups de detailedReportData)
    // Mostramos cronología ascendente para el reporte compartido (del más antiguo al más reciente)
    const dailyIncomeText = [...detailedReportData.sortedGroups]
        .reverse() 
        .map(([date, group]) => {
            // Calculamos el neto diario directo (sin contar recaudos externos si se prefiere separar)
            const dailyNet = group.items
                .filter(i => i.type !== 'Recaudo Sistecredito')
                .reduce((sum, item) => sum + item.amount, 0);
            return ` • *${date}:* ${formatCOP(dailyNet)}`;
        })
        .join('\n');

    // 2. Desglose por Método de Pago (Acumulado periodo)
    const paymentBreakdownText = Object.entries(detailedReportData.totalsByMethod)
        .map(([method, total]) => { 
            if (method === 'Recaudo Sistecredito') return null; 
            const commission = detailedReportData.commissionsByMethod[method]; 
            let line = ` • *${method}:* ${formatCOP(Number(total) || 0)}`; 
            if (commission > 0) line += ` (desc. ${formatCOP(Number(commission))})`; 
            return line; 
        })
        .filter(Boolean)
        .join('\n');

    const summaryText = `*Resumen de Rendimiento - ${currentStore?.name || 'Tienda Actual'}*\n` +
        `_Periodo: ${startDate} al ${endDate}_\n\n` +
        `🗓 *DETALLE DIARIO (Ingresos Netos):*\n${dailyIncomeText}\n\n` +
        `💰 *TOTALES POR MÉTODO (Periodo):*\n${paymentBreakdownText}\n\n` +
        `📈 *INGRESOS TOTALES (VENTAS):* ${formatCOP(totalDirectSalesValue)}\n` +
        `🧾 *TICKET PROMEDIO:* ${formatCOP(averageTicketSize)}\n` +
        `📦 *UNIDADES VENDIDAS:* ${totalUnitsSold}\n\n` +
        `-----------------------------------\n` +
        `💵 *NETO TOTAL PERIODO:* *${formatCOP(totalPeriodIncome)}*` +
        `${totalRecaudos > 0 ? `\n✳️ *RECAUDOS SISTECREDITO:* ${formatCOP(totalRecaudos)}` : ''}` +
        `\n-----------------------------------\n\n` +
        `_Informe generado por Sistema POS._`;

    try { 
        if (navigator.share) {
            await navigator.share({ title: `Reporte ${currentStore?.name || 'Ventas'}`, text: summaryText }); 
        } else { 
            await navigator.clipboard.writeText(summaryText); 
            alert('Resumen detallado copiado al portapapeles.'); 
        } 
    } catch (error) { 
        console.error('Error al compartir:', error); 
    }
  };

  const scrollToSection = (id: string) => { const element = document.getElementById(id); if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Control Panel */}
      <div className="bg-white dark:bg-secondary p-4 rounded-xl shadow-lg border border-accent/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button onClick={setToday} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Hoy</button>
                    <button onClick={setYesterday} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Ayer</button>
                    <button onClick={setLast7Days} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">7 Días</button>
                    <button onClick={setThisMonth} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Mes</button>
                </div>
                <div className="flex items-center gap-1 bg-accent/10 p-1 rounded-lg">
                    <button onClick={() => scrollToSection('payment-report')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><DollarIcon className="w-3 h-3"/> Pagos</button>
                    <button onClick={() => scrollToSection('price-analysis')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><PriceIcon className="w-3 h-3"/> Precios</button>
                    <button onClick={() => scrollToSection('sales-history')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><ReceiptIcon className="w-3 h-3"/> Historial</button>
                    <button onClick={() => scrollToSection('sales-chart')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><ChartBarIcon className="w-3 h-3"/> Gráficos</button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onOpenVerification} className="relative px-4 py-1.5 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-600/20">
                        <ClipboardListIcon className="w-4 h-4" />
                        <span>Verificar Inventario</span>
                    </button>

                    {isAdmin && latestStockTakeInconsistency && (
                        <div 
                            onClick={() => onNavigate(View.STOCK_TAKE_HISTORY)}
                            className="flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-lg cursor-pointer hover:bg-red-600 transition-all animate-pulse shadow-lg shadow-red-500/30"
                            title={`Último conteo por ${latestStockTakeInconsistency.seller} tiene descuadres`}
                        >
                            <AlertTriangleIcon className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-tighter">Descuadre Detectado</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2"><button onClick={handlePreviousDay} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeftIcon className="w-4 h-4" /></button><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm border-b border-gray-300 dark:border-gray-700 focus:border-accent outline-none w-32"/><span className="text-gray-400">-</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm border-b border-gray-300 dark:border-gray-700 focus:border-accent outline-none w-32"/><button onClick={handleNextDay} disabled={isNextDayDisabled} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><ChevronRightIcon className="w-4 h-4" /></button></div>
        </div>
      </div>

      {/* AI Insights Widget */}
      <div className="w-full transition-all duration-300 ease-in-out">
             <div className="bg-white dark:bg-secondary rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                 <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-accent via-purple-500 to-blue-500"></div>
                 <div onClick={() => setIsAIExpanded(!isAIExpanded)} className="p-2 px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex justify-between items-center">
                     <div className="flex items-center gap-2"><SparklesIcon className="w-4 h-4 text-accent" /><h3 className="font-bold text-gray-800 dark:text-text-light text-sm">IA POS <span className="hidden sm:inline text-gray-400 font-normal">- Asistente Inteligente</span></h3></div>
                     <div className="flex items-center gap-3">{aiInsights && !isAIExpanded && <span className="text-[10px] text-gray-400 animate-fade-in">{aiInsights.period}</span>}<span className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-bold uppercase tracking-wider">BETA</span><button className="text-gray-400 hover:text-accent transition-colors"><ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isAIExpanded ? 'rotate-180' : ''}`} /></button></div>
                 </div>
                 {isAIExpanded && (
                 <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20">
                    <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide">
                        <button onClick={() => setActiveAITab('insights')} className={`flex-1 min-w-[120px] py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${activeAITab === 'insights' ? 'bg-white dark:bg-gray-800 text-accent border-b-2 border-accent' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><PackageIcon className="w-3 h-3" /> Inventario</button>
                        <button onClick={() => setActiveAITab('forecast')} className={`flex-1 min-w-[120px] py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${activeAITab === 'forecast' ? 'bg-white dark:bg-gray-800 text-accent border-b-2 border-accent' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><ChartBarIcon className="w-3 h-3" /> Proyección</button>
                        <button onClick={() => setActiveAITab('clients')} className={`flex-1 min-w-[120px] py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${activeAITab === 'clients' ? 'bg-white dark:bg-gray-800 text-accent border-b-2 border-accent' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><UsersIcon className="w-3 h-3" /> Clientes</button>
                        <button onClick={() => setActiveAITab('query')} className={`flex-1 min-w-[120px] py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${activeAITab === 'query' ? 'bg-white dark:bg-gray-800 text-accent border-b-2 border-accent' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><SparklesIcon className="w-3 h-3" /> Consultar</button>
                    </div>
                    <div className="p-3 flex flex-col md:flex-row gap-3 min-h-[120px]">
                    {activeAITab === 'insights' ? (
                        <>
                            <div className="md:w-1/2 space-y-2 overflow-y-auto max-h-[180px] pr-1">
                            {aiInsights ? (
                                <>
                                    {aiInsights.highVelocity.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="font-black text-orange-600 dark:text-orange-400 text-[10px] uppercase tracking-widest flex items-center gap-1"><SparklesIcon className="w-3 h-3 animate-pulse" /> Movimiento Rápido</p>
                                            {aiInsights.highVelocity.map((item: any) => (
                                                <button key={item.id} onClick={() => setActiveInsightId(item.id)} className={`w-full text-left p-1.5 rounded border text-xs transition-colors flex justify-between items-center ${activeInsightId === item.id ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                                    <span className={`truncate ${item.urgency === 'critical' ? 'font-black text-red-600' : 'font-bold'}`}>{item.name} {item.isSoldOut && '(AGOTADO)'}</span>
                                                    <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/40 px-1 rounded">{item.unitsPerDay.toFixed(1)} uds/día</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {aiInsights.restock.length > 0 && (
                                        <div className="space-y-1 mt-2">
                                            <p className="font-bold text-red-600 dark:text-red-400 text-[10px] uppercase tracking-wide">⚠️ Alertas Stock</p>
                                            {aiInsights.restock.slice(0, 4).map((item: any) => (
                                                <button key={item.id} onClick={() => setActiveInsightId(item.id)} className={`w-full text-left p-1.5 rounded border text-xs transition-colors flex justify-between items-center ${activeInsightId === item.id ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                                    <span className="truncate font-medium">{item.name}</span>
                                                    <span className="text-gray-500 whitespace-nowrap">{item.stock === 0 ? 'SIN STOCK' : `Quedan: ${item.stock}`}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : <p className="text-xs text-gray-400">Cargando...</p>}
                            </div>
                            <div className="md:w-1/2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 flex flex-col justify-center relative min-h-[150px]">
                                {!activeInsightId ? <div className="text-center text-gray-400 text-xs"><SparklesIcon className="w-8 h-8 mx-auto mb-2 opacity-20" /><p>Selecciona un ítem.</p></div> : (
                                    (() => {
                                        const highVelItem = aiInsights?.highVelocity.find(i => i.id === activeInsightId);
                                        const restockItem = aiInsights?.restock.find(i => i.id === activeInsightId);
                                        const stagnantItem = aiInsights?.stagnant.find(i => i.id === activeInsightId);
                                        if (highVelItem) return (
                                            <div className="animate-fade-in text-sm">
                                                <h4 className={`font-black mb-1 flex items-center gap-1 ${highVelItem.isSoldOut ? 'text-red-600' : 'text-orange-600'}`}>{highVelItem.isSoldOut ? '🚨 OPORTUNIDAD PERDIDA' : '⚡ ALTA VELOCIDAD'}</h4>
                                                <p className="text-gray-700 dark:text-gray-300 text-xs leading-tight mb-2">
                                                    {highVelItem.isSoldOut 
                                                      ? `Este producto promediaba ${highVelItem.unitsPerDay.toFixed(1)} uds/día. ¡Llévalo de vuelta a stock para no perder más ventas!` 
                                                      : `Este ítem se mueve a ${highVelItem.unitsPerDay.toFixed(1)} uds/día.`}
                                                </p>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mb-3"><div className={`h-full ${highVelItem.isSoldOut ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: '100%' }}></div></div>
                                                <button onClick={() => onNavigate(View.PURCHASES)} className="w-full bg-accent text-white text-[10px] font-black uppercase py-1.5 rounded shadow-sm hover:opacity-90">Ir a Compras</button>
                                            </div>
                                        );
                                        if (restockItem) return (
                                            <div className="animate-fade-in text-sm">
                                                <h4 className="font-bold text-red-600 dark:text-red-400 mb-1">⚠️ Reposición Necesaria</h4>
                                                <p className="text-gray-700 dark:text-gray-300 mb-2 text-xs">
                                                    {restockItem.stock === 0 
                                                        ? `Has dejado de vender aprox. ${restockItem.lostSalesPotential} unidades desde que se agotó.`
                                                        : `Se agotará en aprox. ${restockItem.daysLeft} días.`}
                                                </p>
                                            </div>
                                        );
                                        if (stagnantItem) return <div className="animate-fade-in text-sm"><h4 className="font-bold text-gray-500 mb-1">💤 Capital Estancado</h4><p className="text-gray-700 dark:text-gray-300 mb-2 text-xs">Liquidación sugerida: <span className="text-red-500 font-bold">{formatCOP(stagnantItem.suggestedPrice)}</span> (-{stagnantItem.discount}%)</p></div>;
                                        return null;
                                    })()
                                )}
                            </div>
                        </>
                    ) : activeAITab === 'forecast' ? (
                        <div className="w-full animate-fade-in">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Escenarios de Cierre</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {forecastAnalysis.incentives.map((tier, idx) => (
                                            <div key={idx} className={`p-3 rounded-xl border transition-all ${idx === 0 ? 'bg-white dark:bg-gray-800 border-gray-100' : idx === 1 ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50' : 'bg-accent/5 dark:bg-accent/10 border-accent/20 shadow-sm'}`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${idx === 0 ? 'bg-gray-100 text-gray-500' : idx === 1 ? 'bg-amber-100 text-amber-600' : 'bg-accent text-white'}`}>
                                                        META {tier.tier}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-400">Objetivo: {tier.units} uds</span>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-xl font-black text-gray-800 dark:text-white leading-none">{formatCOP(tier.target)}</p>
                                                        <p className="text-[10px] font-bold text-accent mt-1 flex items-center gap-1">
                                                            <SparklesIcon className="w-2.5 h-2.5" />
                                                            Premio: {tier.reward}
                                                        </p>
                                                        <div className="mt-2 flex gap-2">
                                                            <span className="text-[9px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-1.5 py-0.5 rounded font-bold">Q1: {Math.round(tier.units / 2)} uds</span>
                                                            <span className="text-[9px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-1.5 py-0.5 rounded font-bold">Q2: {Math.round(tier.units / 2)} uds</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Faltante para Meta</p>
                                                        <p className={`text-xs font-black ${tier.target <= forecastAnalysis.currentTotal ? 'text-green-500' : 'text-gray-500'}`}>
                                                            {tier.target <= forecastAnalysis.currentTotal ? 'ALCANZADA ✓' : formatCOP(tier.target - forecastAnalysis.currentTotal)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 border-l-4 border-l-blue-500">
                                        <h4 className="text-[10px] font-black text-blue-500 uppercase mb-1 tracking-widest">Estado Actual de Unidades</h4>
                                        <div className="flex justify-between items-end">
                                            <p className="text-2xl font-black text-blue-600 leading-none">{forecastAnalysis.currentUnits} <span className="text-xs uppercase font-bold">uds vendidas</span></p>
                                            <p className="text-[10px] text-gray-400 font-bold">Quincena {new Date().getDate() <= 15 ? '1' : '2'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                            <span>Progreso Temporal del Mes</span>
                                            <span className="text-accent">{Math.round(forecastAnalysis.monthProgress)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                            <div className="bg-accent h-full rounded-full transition-all duration-1000" style={{ width: `${forecastAnalysis.monthProgress}%` }}></div>
                                        </div>
                                        <p className="text-[9px] text-gray-400 mt-1 italic text-right">Faltan {forecastAnalysis.daysRemaining} días. Promedio diario ideal: {formatCOP((forecastAnalysis.projectedTotal - forecastAnalysis.currentTotal) / Math.max(forecastAnalysis.daysRemaining, 1))}</p>
                                    </div>
                                    
                                    <div className="bg-gray-100/50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Desglose Quincenal de Unidades Real</h4>
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                                                <p className="text-[9px] font-black text-gray-400 uppercase">Q1 (1-15)</p>
                                                <p className="text-lg font-black text-gray-700 dark:text-gray-200">{forecastAnalysis.q1Units} <span className="text-[10px]">uds</span></p>
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                                                <p className="text-[9px] font-black text-gray-400 uppercase">Q2 (16-Fin)</p>
                                                <p className="text-lg font-black text-gray-700 dark:text-gray-200">{forecastAnalysis.q2Units} <span className="text-[10px]">uds</span></p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-accent/5 to-transparent p-3 rounded-lg border border-accent/10">
                                        <h4 className="font-black text-[10px] text-accent uppercase tracking-widest mb-2">Estrategias de Impulso IA</h4>
                                        <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 scrollbar-hide">
                                            {forecastAnalysis.strategies.map((strat, idx) => (
                                                <div key={idx} className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 flex gap-2 items-start shadow-sm">
                                                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${strat.type === 'marketing' ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-700 dark:text-gray-200 leading-tight">{strat.title}</p>
                                                        <p className="text-[9px] text-gray-500 leading-relaxed">{strat.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => { setActiveAITab('query'); setCustomAIQuery("Dame una proyección estratégica detallada de unidades para la próxima quincena basada en los datos actuales."); }}
                                        className="w-full py-2 bg-accent text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-accent/20 hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <SparklesIcon className="w-3 h-3" /> Generar Plan de Acción IA
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : activeAITab === 'clients' ? (
                        <div className="w-full animate-fade-in"><h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 mb-3">Clientes en Riesgo de Fuga</h4><div className="max-h-[200px] overflow-y-auto pr-2">{churnAnalysis.length > 0 ? churnAnalysis.map((client, index) => (<div key={index} className="bg-white dark:bg-gray-800 p-3 mb-2 rounded-lg border-l-4 border-l-red-500 flex justify-between items-center"><div><p className="font-bold text-sm">{client.name}</p><p className="text-xs text-gray-500">{client.phone}</p></div><div className="text-right"><p className="text-xs font-bold text-red-500">{client.daysSince} días</p><p className="text-[10px] text-gray-400">sin volver</p></div></div>)) : <p className="text-xs text-center text-gray-400">Todo bien por ahora.</p>}</div></div>
                    ) : (
                        <div className="w-full animate-fade-in flex flex-col gap-4"><div className="flex flex-col gap-2"><label className="text-xs font-black text-gray-500 uppercase tracking-widest">Consulta personalizada multi-tienda</label><div className="flex gap-2"><textarea value={customAIQuery} onChange={e => setCustomAIQuery(e.target.value)} placeholder="Ej: ¿Cuál ha sido el producto más vendido en las 3 tiendas este mes?" rows={2} className="flex-grow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent outline-none shadow-inner"/><button onClick={handleCustomAIQuery} disabled={isAiQueryLoading || !customAIQuery.trim()} className="bg-accent text-white px-6 rounded-xl hover:bg-accent-hover transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-accent/20">{isAiQueryLoading ? (<div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>) : (<SparklesIcon className="w-5 h-5" />)}</button></div></div><div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 min-h-[120px] max-h-[300px] overflow-y-auto">{aiQueryResult ? (<SimpleMarkdownRenderer content={aiQueryResult} />) : isAiQueryLoading ? (<div className="flex flex-col items-center justify-center h-full py-8 text-gray-400"><SparklesIcon className="w-8 h-8 animate-pulse mb-2 text-accent" /><p className="text-xs font-bold animate-pulse uppercase tracking-widest">La IA está analizando los datos multi-tienda...</p></div>) : (<div className="flex flex-col items-center justify-center h-full py-8 text-gray-300"><SearchIcon className="w-10 h-10 mb-2 opacity-20" /><p className="text-xs italic">Escribe una pregunta para obtener un resumen detallado del periodo filtrado.</p></div>)}</div></div>
                    )}
                    </div>
                 </div>
                 )}
             </div>
      </div>
      
      {/* Main Reports */}
      <div id="payment-report" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <div onClick={() => setIsPaymentsReportVisible(!isPaymentsReportVisible)} className="cursor-pointer flex justify-between items-center"><div className="flex items-center gap-4"><h2 className="text-2xl font-bold text-accent">Informe de Pagos: {currentStore?.name || 'Tienda Actual'}</h2><button onClick={(e) => { e.stopPropagation(); handleShareCurrentStore(); }} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700" aria-label={`Compartir resumen`}><ShareIcon className="w-5 h-5" /></button></div><ChevronDownIcon className={`w-6 h-6 transition-transform ${isPaymentsReportVisible ? 'rotate-180' : ''}`} /></div>
        {isPaymentsReportVisible && (
            <div className="mt-4 pt-4 border-t-2 border-accent/30 animate-fade-in">
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4 mb-6">
                    <div onClick={() => setIsUnitsSoldExpanded(!isUnitsSoldExpanded)} className="bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent hover:border-accent/30 group">
                        <div className="flex justify-between items-start">
                            <div className="text-left">
                                <p className="text-[8px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Unidades Vendidas</p>
                                <p className="text-lg sm:text-2xl font-black">{metricsForCurrentStore.totalUnitsSold}</p>
                                {metricsForCurrentStore.totalGiftUnits > 0 && (
                                    <p className="text-[10px] text-accent font-bold mt-1">+{metricsForCurrentStore.totalGiftUnits} obsequios</p>
                                )}
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isUnitsSoldExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-xl border border-transparent">
                        <div className="text-left">
                            <p className="text-[8px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Utilidad Bruta</p>
                            <p className={`text-lg sm:text-2xl font-black ${metricsForCurrentStore.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCOP(metricsForCurrentStore.totalProfit)}</p>
                        </div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-xl border border-transparent shadow-sm">
                        <div className="text-left text-red-500">
                            <p className="text-[8px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Gastos Op.</p>
                            <p className="text-lg sm:text-2xl font-black">{formatCOP(metricsForCurrentStore.totalExpenses)}</p>
                        </div>
                    </div>
                    <div className="bg-accent/5 dark:bg-accent/10 p-3 sm:p-4 rounded-xl border-2 border-accent shadow-lg shadow-accent/10 scale-[1.02] transform transition-transform">
                        <div className="text-left">
                            <p className="text-[8px] sm:text-[10px] text-accent font-black uppercase tracking-widest mb-1">Utilidad Neta</p>
                            <p className={`text-lg sm:text-2xl font-black ${metricsForCurrentStore.netProfit >= 0 ? 'text-accent' : 'text-red-500'}`}>{formatCOP(metricsForCurrentStore.netProfit)}</p>
                        </div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-xl border border-transparent">
                        <div className="text-left">
                            <p className="text-[8px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Costo Ventas (COGS)</p>
                            <p className="text-lg sm:text-2xl font-black text-orange-500">{formatCOP(metricsForCurrentStore.totalCogs)}</p>
                        </div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-xl border border-transparent">
                        <div className="text-left">
                            <p className="text-[8px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Ticket Prom.</p>
                            <p className="text-lg sm:text-2xl font-black">{formatCOP(metricsForCurrentStore.averageTicketSize)}</p>
                        </div>
                    </div>
                    <div 
                        onClick={() => {
                            sessionStorage.setItem('scroll_to_section', 'analysis-section');
                            onNavigate(View.INVENTORY);
                        }}
                        className="bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent hover:border-accent/30 group"
                        title="Ver gráfica del inventario"
                    >
                        <div className="flex justify-between items-start">
                            <div className="text-left">
                                <p className="text-[8px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Valor Inventario</p>
                                <p className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400">{formatCOP(metricsForCurrentStore.totalInventoryValue)}</p>
                            </div>
                            <ChartBarIcon className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                        </div>
                    </div>
                 </div>
                {isUnitsSoldExpanded && (<div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 animate-fade-in mb-6"><h4 className="font-bold text-sm mb-2 text-gray-700 dark:text-gray-200">Desglose por Vendedor</h4><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{metricsForCurrentStore.unitsBySeller.map((item) => (<div key={item.sellerName} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-2 rounded"><span className="text-xs font-medium">{item.sellerName}</span><span className="text-xs font-bold text-accent">{item.units}</span></div>))}</div></div>)}
                <div className="mb-6"><h3 className="text-lg font-semibold text-gray-800 dark:text-text-light mb-2">Desglose por Medio de Pago</h3><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"><div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-md text-left ring-2 ring-green-500/50"><p className="font-bold text-green-800 dark:text-green-300">Ingresos del Periodo</p><p className="text-2xl font-extrabold text-green-600 dark:text-green-400">{formatCOP(totalPeriodIncome)}</p></div><div className={`bg-white dark:bg-gray-900/50 p-3 rounded-md text-left transition-all duration-200 cursor-pointer ${paymentMethodFilter.includes('Efectivo') ? 'ring-2 ring-accent shadow-lg' : 'hover:shadow-md'}`} onClick={(e) => { e.stopPropagation(); togglePaymentMethodFilter('Efectivo'); if (!paymentMethodFilter.includes('Efectivo')) setIsCashBreakdownVisible(true); }}><div className="flex justify-between items-center"><p className="font-bold text-gray-800 dark:text-text-light">Efectivo (Neto)</p><button onClick={(e) => { e.stopPropagation(); setIsCashBreakdownVisible(!isCashBreakdownVisible); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><ChevronDownIcon className={`w-4 h-4 transition-transform ${isCashBreakdownVisible ? 'rotate-180' : ''}`} /></button></div><p className="text-2xl font-extrabold text-accent">{formatCOP(cashBreakdown?.netTotal || 0)}</p>{isCashBreakdownVisible && cashBreakdown && (<div className="mt-2 pt-2 border-t border-dashed text-xs space-y-1 animate-fade-in" onClick={e => e.stopPropagation()}><div className="flex justify-between"><span>Ventas:</span><span>{formatCOP(cashBreakdown.salesCash)}</span></div><div className="flex justify-between"><span>Abonos:</span><span>{formatCOP(cashBreakdown.layawaysCash)}</span></div>{cashBreakdown.totalExchangeSurplusesCash > 0 && (<div className="flex justify-between text-green-600 font-semibold"><span>Excedentes Cambios:</span><span>+{formatCOP(cashBreakdown.totalExchangeSurplusesCash)}</span></div>)}{cashBreakdown.incomeAdjustments.length > 0 && (<div className="flex justify-between text-green-600"><span>Ingresos Extra:</span><span>+{formatCOP(cashBreakdown.incomeAdjustments.reduce((sum, i) => sum + (i.adjustmentAmount || 0), 0))}</span></div>)}{cashBreakdown.expenseAdjustments.length > 0 && (<div className="flex justify-between text-red-500"><span>Gastos/Salidas:</span><span>-{formatCOP(cashBreakdown.expenseAdjustments.reduce((sum, i) => sum + (i.adjustmentAmount || 0), 0))}</span></div>)}</div>)}</div><button onClick={() => togglePaymentMethodFilter('Recaudo Sistecredito')} className={`bg-purple-100 dark:bg-purple-900/30 p-3 rounded-md text-left transition-all duration-200 ${paymentMethodFilter.includes('Recaudo Sistecredito') ? 'ring-2 ring-purple-500 shadow-lg' : 'hover:shadow-md'}`}><p className="font-bold text-purple-800 dark:text-purple-300">Recaudos Sistec.</p><p className="text-xl font-extrabold text-purple-600 dark:text-purple-400">{formatCOP(totalRecaudos)}</p></button>{Object.entries(detailedReportData.totalsByMethod).filter(([method]) => method !== 'Efectivo' && method !== 'Recaudo Sistecredito').map(([method, total]) => { return (<button key={method} onClick={() => togglePaymentMethodFilter(method)} className={`bg-white dark:bg-gray-900/50 p-3 rounded-md text-left transition-all duration-200 ${paymentMethodFilter.includes(method) ? 'ring-2 ring-accent shadow-lg' : 'hover:shadow-md'}`}><p className="font-bold text-gray-800 dark:text-text-light">{method}</p><p className="text-xl font-extrabold text-accent">{formatCOP(Number(total) || 0)}</p></button>)})}</div>{paymentMethodFilter.length > 0 && detailedReportData.sortedGroups.length > 0 && (<div className="mt-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700 animate-fade-in"><div className="flex justify-between items-center mb-4"><h4 className="font-bold text-lg text-accent">Detalle por Días: {paymentMethodFilter.join('+')}</h4><button onClick={(e) => { e.stopPropagation(); setPaymentMethodFilter([]); }} className="text-xs text-red-500 hover:underline">Limpiar Filtros</button></div><div className="max-h-96 overflow-y-auto space-y-4">{detailedReportData.sortedGroups.map(([date, group]) => { const dayTotal = getDayTotalForFilteredMethods(group.items); if (dayTotal === 0 && paymentMethodFilter.length > 0 && !group.items.some(i => paymentMethodFilter.includes(String(i.paymentMethod)))) return null; return (<div key={date} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"><div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 flex justify-between items-center border-b dark:border-gray-700"><span className="font-bold text-sm text-gray-700 dark:text-gray-200">{date}</span><span className="font-black text-sm text-accent">Total Seleccionado: {formatCOP(dayTotal)}</span></div><table className="w-full text-xs text-left"><thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500"><tr><th className="p-3">Hora</th><th className="p-3">Tipo / Factura</th><th className="p-3">Cliente</th><th className="p-3 text-right">Monto</th></tr></thead><tbody>{group.items.filter(i => paymentMethodFilter.length === 0 || paymentMethodFilter.includes(String(i.paymentMethod))).map(t => (<tr key={t.id} className="border-b dark:border-gray-800 last:border-0 hover:bg-accent/5 transition-colors"><td className="p-3 whitespace-nowrap text-gray-400 font-mono">{new Date(t.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}</td><td className="p-3"><p className="font-bold text-gray-600 dark:text-gray-300">{t.type}</p><p className="text-[10px] text-gray-400">{t.invoiceNumber !== '-' ? `Ref: #${t.invoiceNumber}` : ''}</p></td><td className="p-3"><p className="font-semibold">{t.customer}</p><p className="text-[10px] text-gray-400">{t.seller}</p></td><td className="p-3 text-right font-black text-accent">{formatCOP(t.amount)}</td></tr>))}</tbody></table></div>); })}</div></div>)}</div>
            </div>
        )}
      </div>

      <div id="price-analysis" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <div onClick={() => setIsPriceAnalysisVisible(!isPriceAnalysisVisible)} className="cursor-pointer flex justify-between items-center"><h2 className="text-2xl font-bold text-accent">Análisis de Precios y Diferencias</h2><ChevronDownIcon className={`w-6 h-6 transition-transform ${isPriceAnalysisVisible ? 'rotate-180' : ''}`} /></div>
        {isPriceAnalysisVisible && (
            <div className="mt-4 pt-4 border-t-2 border-accent/30 animate-fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"><div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-lg border-l-4 border-green-500"><p className="text-sm font-semibold text-green-700 dark:text-green-300 uppercase">Total Valorización (Markups)</p><p className="text-2xl font-extrabold text-green-600 dark:text-green-400">{formatCOP(priceVariationReportData.summary.totalMarkup)}</p></div><div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-lg border-l-4 border-red-500"><p className="text-sm font-semibold text-red-700 dark:text-red-300 uppercase">Total Descuentos (Discounts)</p><p className="text-2xl font-extrabold text-green-600 dark:text-green-400">{formatCOP(priceVariationReportData.summary.totalDiscount)}</p></div><div className={`p-4 rounded-lg border-l-4 ${priceVariationReportData.summary.netDifference >= 0 ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500' : 'bg-orange-100 dark:bg-orange-900/30 border-orange-500'}`}><p className="text-sm font-semibold uppercase">Diferencia Neta</p><p className={`text-2xl font-extrabold ${priceVariationReportData.summary.netDifference >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>{formatCOP(priceVariationReportData.summary.netDifference)}</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Filtrar por Vendedores</label>
        <div className="flex flex-wrap gap-1 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
            {sellers.map(s => (
                <button
                    key={s.id}
                    onClick={() => setPriceVariationSellerFilters(prev => prev.includes(s.name) ? prev.filter(f => f !== s.name) : [...prev, s.name])}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${priceVariationSellerFilters.includes(s.name) ? 'bg-accent text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                    {s.name}
                </button>
            ))}
            {priceVariationSellerFilters.length > 0 && (
                <button onClick={() => setPriceVariationSellerFilters([])} className="px-2 py-1 text-[10px] font-bold text-red-500 hover:underline ml-auto">Limpiar</button>
            )}
        </div>
    </div>
    <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Filtrar por Métodos de Pago</label>
        <div className="flex flex-wrap gap-1 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
            {Object.values(PaymentMethod).map(m => (
                <button
                    key={m}
                    onClick={() => setPriceVariationPaymentMethodFilters(prev => prev.includes(m) ? prev.filter(f => f !== m) : [...prev, m])}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${priceVariationPaymentMethodFilters.includes(m) ? 'bg-accent text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                    {m}
                </button>
            ))}
            {priceVariationPaymentMethodFilters.length > 0 && (
                <button onClick={() => setPriceVariationPaymentMethodFilters([])} className="px-2 py-1 text-[10px] font-bold text-red-500 hover:underline ml-auto">Limpiar</button>
            )}
        </div>
    </div>
</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-100 dark:bg-gray-800"><tr><th className="p-2 font-semibold">Fecha/Factura</th><th className="p-2 font-semibold">Producto</th><th className="p-2 font-semibold">Vendedor</th><th className="p-2 font-semibold text-right">P. Sistema</th><th className="p-2 font-semibold text-right">P. Venta</th><th className="p-2 font-semibold text-right">Dif. Unit</th><th className="p-2 font-semibold text-right">Dif. Total</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{priceVariationReportData.items.map(item => (<tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"><td className="p-2"><p className="font-mono text-xs">{new Date(item.date).toLocaleDateString()}</p><p className="text-accent font-bold">#{item.invoiceNumber}</p></td><td className="p-2 font-medium">{item.productName} <span className="text-gray-400">(x{item.quantity})</span></td><td className="p-2">{item.seller}</td><td className="p-2 text-right text-gray-500">{formatCOP(item.currentPrice)}</td><td className="p-2 text-right font-bold">{formatCOP(item.soldPrice)}</td><td className={`p-2 text-right font-bold ${item.variation > 0 ? 'text-green-500' : item.variation < 0 ? 'text-red-500' : ''}`}>{item.variation > 0 ? `+${formatCOP(item.variation)}` : formatCOP(item.variation)}</td><td className={`p-2 text-right font-bold ${item.totalVariation > 0 ? 'text-green-500' : item.totalVariation < 0 ? 'text-red-500' : ''}`}>{item.totalVariation > 0 ? `+${formatCOP(item.totalVariation)}` : formatCOP(item.totalVariation)}</td></tr>))}</tbody></table>{priceVariationReportData.items.length === 0 && <p className="text-center py-6 text-gray-500">Sin variaciones registradas.</p>}</div></div>
        )}
      </div>

      <div id="sales-history" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg"><div onClick={() => setIsSalesHistoryVisible(!isSalesHistoryVisible)} className="cursor-pointer flex justify-between items-center"><h2 className="text-2xl font-bold text-accent">Historial de Ventas</h2><ChevronDownIcon className={`w-6 h-6 transition-transform ${isSalesHistoryVisible ? 'rotate-180' : ''}`} /></div>{isSalesHistoryVisible && (<div className="mt-4 pt-4 border-t-2 border-accent/30 animate-fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"><div className="relative"><input type="text" placeholder="Factura, cliente, producto..." value={salesSearchTerm} onChange={e => setSalesSearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none" /><div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400"><SearchIcon /></div></div><select value={salesSellerFilter} onChange={e => setSalesSellerFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2"><option value="">Todos los vendedores</option>{sellers.map(seller => (<option key={seller.id} value={seller.name}>{seller.name}</option>))}</select><select value={salesCategoryFilter} onChange={e => setSalesCategoryFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2"><option value="">Todas las categorías</option>{categories.map(category => (<option key={category.id} value={category.id}>{category.name}</option>))}</select></div>{managedSales.length > 0 ? (<div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-gray-100 dark:bg-gray-800"><tr><th className="p-3 text-sm font-semibold">Factura</th><th className="p-3 text-sm font-semibold">Fecha y Hora</th><th className="p-3 text-sm font-semibold">Cliente</th><th className="p-3 text-sm font-semibold text-right">Total</th><th className="p-3 text-sm font-semibold text-right">Ganancia</th><th className="p-3 text-sm font-semibold">Medio Pago</th><th className="p-3 text-sm font-semibold">Vendedor</th><th className="p-3 text-sm font-semibold text-center">Acciones</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{managedSales.map((transaction) => { const profit = calculateSaleProfit(transaction); const isExpanded = expandedSaleId === transaction.id; const itemsArray: CartItem[] = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})).filter(Boolean) as CartItem[]; return (<React.Fragment key={transaction.id}><tr className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${isExpanded ? 'bg-accent/5' : ''}`} onClick={() => setExpandedSaleId(isExpanded ? null : transaction.id)}><td className="p-3 font-mono text-accent"><div className="flex items-center gap-2"><ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /><span>#{transaction.invoiceNumber}</span>{transaction.transactionType === 'layaway' && (<span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">ABONO</span>)}</div></td><td className="p-3 text-sm whitespace-nowrap">{new Date(transaction.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td><td className="p-3"><p className="font-medium text-sm">{transaction.customerName}</p><p className="text-[10px] text-gray-500">{transaction.customerPhone}</p></td><td className="p-3 text-right font-semibold">{formatCOP(transaction.totalAmount)}</td><td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCOP(profit)}</td><td className="p-3 text-sm">{renderPaymentMethods(transaction)}</td><td className="p-3 text-sm font-medium">{transaction.seller}</td><td className="p-3 text-center"><div className="flex items-center justify-center gap-1"><button onClick={(e) => { e.stopPropagation(); onReprintSale(transaction as Sale); }} className="text-gray-500 hover:text-blue-500 p-1.5 rounded-full hover:bg-blue-100 transition-colors" title="Reimprimir Factura"><PrintIcon className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); if (transaction.transactionType === 'layaway') { setEditingLayaway(transaction as unknown as Layaway); } else { setEditingSale(transaction as Sale); } }} className="text-gray-500 hover:text-accent p-1.5 rounded-full hover:bg-accent/10 transition-colors" title="Editar"><EditIcon className="w-4 h-4"/></button>{isAdmin && transaction.transactionType === 'sale' && (<button onClick={(e) => { e.stopPropagation(); setSaleToDelete(transaction as Sale); }} className="text-gray-500 hover:text-red-500 p-1.5 rounded-full hover:bg-red-100 transition-colors" title="Eliminar Venta"><TrashIcon className="w-4 h-4" /></button>)}</div></td></tr>{isExpanded && (<tr className="bg-gray-50 dark:bg-gray-800/40"><td colSpan={8} className="p-4 pt-0"><div className="bg-white dark:bg-secondary border border-accent/20 rounded-lg p-3 shadow-inner"><h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Productos en esta venta</h4><div className="space-y-2">{itemsArray.map((item, idx) => { const isPromo = (item.discountPrice !== undefined && item.discountPrice === item.price) || (item.basePrice !== undefined && item.basePrice > item.price); return (<div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-1 last:border-0"><div><span className="font-bold text-accent">{item.quantity}x</span> {item.name}{isPromo && (<span className="ml-2 px-1.5 py-0.5 text-[9px] font-black rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 uppercase">🏷️ Promoción</span>)}<p className="text-[10px] text-gray-400">{item.supplier || 'N/A'}</p></div><div className="text-right"><p className="font-semibold">{formatCOP(item.price * item.quantity)}</p><p className="text-[10px] text-gray-400">{formatCOP(item.price)} c/u{item.basePrice && item.basePrice > item.price && (<span className="line-through text-gray-400 ml-1">{formatCOP(item.basePrice)}</span>)}</p></div></div>); })}</div><div className="mt-3 pt-2 border-t border-dashed flex justify-between items-center"><p className="text-xs text-gray-500">Vendedor responsable: <span className="font-bold">{transaction.seller}</span></p><div className="flex gap-2">{renderPaymentMethods(transaction)}</div></div></div></td></tr>)}</React.Fragment>);})}</tbody></table></div>) : <p className="text-center text-gray-500 py-8">Sin resultados.</p>}</div>)}</div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg"><h3 className="text-xl font-bold text-accent mb-4">Ventas por Categoría</h3><div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">{categoryReport.map(cat => (<div key={cat.categoryId} className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden"><div onClick={() => setExpandedCategoryId(expandedCategoryId === cat.categoryId ? null : cat.categoryId)} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-accent/5 transition-colors"><div className="flex items-center gap-2"><ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${expandedCategoryId === cat.categoryId ? 'rotate-180' : ''}`} /><div><p className="font-bold">{cat.categoryName}</p><p className="text-xs text-gray-500">{cat.totalUnits} uds vendidas</p></div></div><p className="text-lg font-bold text-accent">{formatCOP(cat.totalSales)}</p></div>{expandedCategoryId === cat.categoryId && (<div className="p-3 bg-white dark:bg-secondary animate-fade-in"><div className="space-y-2">{cat.productList.map((prod, pidx) => (<div key={pidx} className="flex justify-between items-center text-sm p-2 border-b border-gray-50 dark:border-gray-800 last:border-0"><div className="flex items-center gap-3"><span className="bg-accent/10 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded">x{prod.qty}</span><span className="font-medium text-gray-700 dark:text-gray-300">{prod.name}</span></div><span className="font-bold text-gray-600 dark:text-gray-400">{formatCOP(prod.revenue)}</span></div>))}</div></div>)}</div>))}</div></div><div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg"><h3 className="text-xl font-bold text-accent mb-4">Top Productos</h3><div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">{topProductsReport.map((prod, index) => (<div key={prod.productId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"><div className="flex items-center gap-3"><span className="text-gray-400 font-bold">{index + 1}.</span><p className="font-bold">{prod.productName}</p></div><p className="text-lg font-bold text-accent">{prod.totalUnits} uds</p></div>))}</div></div></div>
        <div id="sales-chart" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg mt-8"><div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-accent">Análisis de Ventas</h2><div className="flex gap-2"><button onClick={() => setChartViewMode('daily')} className={`px-3 py-1 text-sm rounded-full font-semibold ${chartViewMode === 'daily' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Diario</button><button onClick={() => setChartViewMode('monthly')} className={`px-3 py-1 text-sm rounded-full font-semibold ${chartViewMode === 'monthly' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Mensual</button></div></div><SalesHistoryChart data={salesChartData} viewMode={chartViewMode} /></div>
        {editingSale && (<EditSaleModal isOpen={!!editingSale} onClose={() => setEditingSale(null)} sale={editingSale} sellers={sellers} inventory={inventory} onUpdateSale={onUpdateSale} />)}
        {editingLayaway && (<EditLayawayModal isOpen={!!editingLayaway} onClose={() => setEditingLayaway(null)} layaway={editingLayaway} sellers={sellers} inventory={inventory} onUpdateLayaway={onUpdateLayaway || (() => {})} />)}

        <DeleteConfirmationModal
            isOpen={!!saleToDelete}
            onClose={() => setSaleToDelete(null)}
            onConfirm={() => {
                if (saleToDelete) {
                    onDeleteSale(saleToDelete.id);
                    setSaleToDelete(null);
                }
            }}
            title="¿Eliminar Venta?"
            message="¿Estás seguro de que deseas eliminar esta venta? Las unidades vendidas volverán al inventario. Esta acción no se puede deshacer."
            itemName={`Factura #${saleToDelete?.invoiceNumber}`}
        />
    </div>
  );
};

export default DashboardView;
