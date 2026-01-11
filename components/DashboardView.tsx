
import React, { useMemo, useState } from 'react';
import { Store, Product, Sale, Layaway, Seller, Role, View, Category, PaymentMethod, DailyNote, Incident, IncidentStatus, IncidentType, Payment, CartItem, Purchase } from '../types';
import { formatCOP, COMMISSION_RATES } from '../constants';
import { DollarIcon, PackageIcon, ShareIcon, SwapIcon, CrossIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, EditIcon, TrashIcon, PrintIcon, AlertTriangleIcon, TruckIcon, SparklesIcon, ChartBarIcon, ReceiptIcon, TagIcon, UsersIcon, ClipboardListIcon } from './Icons';
import { EditSaleModal } from './EditSaleModal';


interface DashboardViewProps {
  stores: Store[];
  allLayaways: Layaway[];
  allIncidents: Incident[];
  currentUser: Seller;
  roles: Role[];
  onSwitchStore: (storeId: string) => void;
  onNavigate: (view: View) => void;
  onOpenReports: () => void;
  // Current store data
  sales: Sale[];
  layaways: Layaway[];
  inventory: Product[];
  categories: Category[];
  sellers: Seller[];
  dailyNotes: DailyNote[];
  currentStore?: Store;
  // From SalesView
  onUpdateSale: (updatedSale: Sale, originalSale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  onReprintSale: (sale: Sale) => void;
  onOpenVerification: () => void;
  purchases: Purchase[];
}

interface UnifiedTransaction {
  id: string;
  date: string;
  type: 'Venta' | 'Abono' | 'Recaudo Sistecredito' | 'Ajuste de Efectivo' | 'Excedente Cambio' | 'Ingreso Adicional';
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
  variation: number; // per unit variation
  quantity: number;
  totalVariation: number;
  status: 'markup' | 'discount' | 'normal';
  paymentMethods: (PaymentMethod | string)[];
}

type UnifiedSaleTransaction = (Sale & { transactionType: 'sale' }) | (Layaway & { transactionType: 'layaway', layawayStatus: Layaway['status'] });

const SalesHistoryChart: React.FC<{ data: { label: string; total: number; partialTotal: number }[], viewMode: 'daily' | 'monthly' | 'all-months' }> = ({ data, viewMode }) => {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.total), 0), [data]);
  const safeMaxValue = maxValue === 0 ? 100000 : maxValue * 1.1; // Add 10% padding

  const formatCompactCOP = (value: number): string => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
    }
    if (value >= 1_000) {
      return `${Math.round(value / 1_000)}k`;
    }
    return value.toString();
  };

  const formatLabel = (label: string) => {
    if (viewMode === 'daily') {
      return new Date(label + 'T12:00:00Z').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    }
    const [year, month] = label.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
  };
  
  const yAxisLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= 4; i++) {
        labels.push(safeMaxValue * (i / 4));
    }
    return labels.reverse();
  }, [safeMaxValue]);

  if (data.length === 0) {
    return <div className="h-96 flex items-center justify-center text-gray-500 dark:text-text-dark">No hay datos de ventas para mostrar en este periodo.</div>;
  }

  return (
    <div className="h-96 w-full pt-4 pr-4 relative">
      <div className="absolute top-0 right-0 flex gap-4 text-xs">
        <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-accent rounded-sm"></div>
            <span className="text-gray-600 dark:text-gray-400">Total Mes</span>
        </div>
        <div className="flex items-center gap-1">
            <div className="w-3 h-0 border-t-2 border-dotted border-gray-500 dark:border-gray-300"></div>
            <span className="text-gray-600 dark:text-gray-400">A la fecha actual</span>
        </div>
      </div>

      <div className="h-full w-full flex">
        <div className="h-full flex flex-col justify-between text-xs text-gray-500 dark:text-text-dark pr-2 shrink-0">
          {yAxisLabels.map((label, i) => (
            <div key={i} className={i === yAxisLabels.length - 1 ? "pb-6" : "-translate-y-1/2"}>
              {formatCOP(label).replace('$', '').replace(/\s/g, '').replace(',00', '')}
            </div>
          ))}
        </div>

        <div className="flex-grow w-full pl-4 border-l border-gray-200 dark:border-gray-700">
          <div className="relative h-full w-full">
            {yAxisLabels.map((_, i) => (
                <div key={i} className="absolute w-full border-t border-gray-200 dark:border-gray-700/50 border-dashed" style={{ bottom: `${(i / (yAxisLabels.length -1)) * 100}%` }}></div>
            ))}
            
            <div className="absolute inset-0 flex items-end justify-around gap-2 px-2 pb-6">
                {data.map((d) => {
                    const barHeight = (d.total / safeMaxValue) * 100;
                    const partialHeight = (d.partialTotal / safeMaxValue) * 100;

                    return (
                    <div key={d.label} className="relative flex h-full w-full flex-col items-center justify-end group">
                        
                        <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap shadow-lg">
                            <p className="font-bold">{formatLabel(d.label)}</p>
                            <p>Total: {formatCOP(d.total)}</p>
                            {viewMode !== 'daily' && (
                                <p className="text-gray-300 text-[10px]">A la fecha: {formatCOP(d.partialTotal)}</p>
                            )}
                        </div>
                        
                        <div className="text-xs font-bold text-gray-700 dark:text-text-dark mb-1 transition-opacity duration-300 z-20">
                           {d.total > 0 ? formatCompactCOP(d.total) : ''}
                        </div>
                        
                        <div className="relative w-full flex items-end h-full">
                            <div
                                className="w-full rounded-t-md bg-accent/70 transition-all duration-300 group-hover:bg-accent absolute bottom-0 left-0"
                                style={{ height: `${barHeight}%` }}
                            ></div>
                            
                            {viewMode !== 'daily' && d.partialTotal > 0 && (
                                <div 
                                    className="absolute w-full border-t-2 border-dotted border-gray-600 dark:border-white z-10 pointer-events-none"
                                    style={{ bottom: `${partialHeight}%`, height: '0px' }}
                                ></div>
                            )}
                        </div>

                    </div>
                )})}
            </div>
            <div className="absolute inset-0 flex items-end justify-around gap-2 px-2">
                {data.map((d) => (
                    <div key={d.label} className="w-full text-center text-[10px] text-gray-500 dark:text-text-dark">
                        {formatLabel(d.label)}
                    </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
    sales, layaways, inventory, currentStore, sellers, onUpdateSale, onDeleteSale, onReprintSale,
    onOpenVerification, purchases
  } = props;
  
  const today = new Date();
  const [startDate, setStartDate] = useState(toYYYYMMDD(today));
  const [endDate, setEndDate] = useState(toYYYYMMDD(today));
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string | null>(null);
  const [isPaymentsReportVisible, setIsPaymentsReportVisible] = useState(true);
  const [isPriceAnalysisVisible, setIsPriceAnalysisVisible] = useState(false);
  const [isCashBreakdownVisible, setIsCashBreakdownVisible] = useState(false);
  const [isUnitsSoldExpanded, setIsUnitsSoldExpanded] = useState(false);
  const [isSalesHistoryVisible, setIsSalesHistoryVisible] = useState(true);
  
  // Sales History State
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [salesSellerFilter, setSalesSellerFilter] = useState('');
  const [salesCategoryFilter, setSalesCategoryFilter] = useState('');
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // Price Variation Filter State
  const [priceVariationSellerFilter, setPriceVariationSellerFilter] = useState('');
  const [priceVariationPaymentMethodFilter, setPriceVariationPaymentMethodFilter] = useState('');

  // Sales Chart State
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'monthly' | 'all-months'>('all-months');
  
  // AI Insights Interaction State
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);
  const [isAIExpanded, setIsAIExpanded] = useState(false);
  const [activeAITab, setActiveAITab] = useState<'insights' | 'forecast' | 'clients'>('insights');

  const adminRole = useMemo(() => roles.find(r => r.name === 'Administrator'), [roles]);
  const isAdmin = useMemo(() => currentUser.roleId === adminRole?.id, [currentUser, adminRole]);
  
  const aiInsights = useMemo(() => {
    if (!sales || !inventory || !purchases) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const periodLabel = `${thirtyDaysAgo.toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})} - ${now.toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})}`;

    // Helper for velocity calculation
    const allSoldItems: Record<string, { quantity: number, createdAt: string }[]> = {};
    [...sales, ...layaways.filter(l => l.status !== 'cancelled')].forEach(t => {
        (t.items || []).forEach(item => {
            if (!item) return;
            if (!allSoldItems[item.id]) allSoldItems[item.id] = [];
            allSoldItems[item.id].push({ quantity: item.quantity, createdAt: t.createdAt });
        });
    });

    const insights = {
      period: periodLabel,
      highVelocity: [] as any[], // Integrated high speed sales
      trending: [] as { id: string, name: string, quantity: number, context: string }[],
      restock: [] as { id: string, name: string, stock: number, velocity: number, daysLeft: number }[],
      stagnant: [] as { id: string, name: string, stock: number, cost: number, price: number, suggestedPrice: number, discount: number }[],
      atRisk: [] as { id: string, name: string, stock: number, soldQty: number, cost: number, price: number, suggestedPrice: number, discount: number }[]
    };

    inventory.forEach(p => {
      if (p.isDisabled) return;
      const soldQtyInMonth = (allSoldItems[p.id] || [])
          .filter(s => new Date(s.createdAt) >= thirtyDaysAgo)
          .reduce((sum, s) => sum + s.quantity, 0);
      
      // 1. HIGH VELOCITY LOGIC (INTEGRATED)
      const lastPurchase = [...purchases]
          .filter(pur => pur.productId === p.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (lastPurchase) {
          const purchaseDate = new Date(lastPurchase.createdAt);
          const daysElapsed = Math.max(1, Math.ceil((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)));
          const soldSinceQty = (allSoldItems[p.id] || [])
              .filter(sale => new Date(sale.createdAt) >= purchaseDate)
              .reduce((sum, s) => sum + s.quantity, 0);

          if (soldSinceQty > 0) {
              const unitsPerDay = soldSinceQty / daysElapsed;
              const percentageOfBatchGone = (soldSinceQty / lastPurchase.quantity) * 100;
              
              if ((percentageOfBatchGone >= 60 && daysElapsed <= 7) || (unitsPerDay >= 0.8 && daysElapsed <= 10) || (p.stock === 0 && daysElapsed <= 14)) {
                  insights.highVelocity.push({
                      id: p.id,
                      name: p.name,
                      soldSinceQty,
                      daysElapsed,
                      unitsPerDay,
                      isSoldOut: p.stock === 0,
                      urgency: (p.stock === 0 || percentageOfBatchGone > 85) ? 'high' : 'medium',
                      stockRemaining: p.stock,
                      percentageOfBatchGone
                  });
              }
          }
      }

      // 2. Trending
      if (soldQtyInMonth >= 3) {
        insights.trending.push({ id: p.id, name: p.name, quantity: soldQtyInMonth, context: `Ventas sólidas: ${soldQtyInMonth} uds en el último mes.` });
      }

      // 3. Restock
      if (p.stock <= 3 && soldQtyInMonth >= 2) {
        const velocityPerDay = soldQtyInMonth / 30;
        insights.restock.push({ id: p.id, name: p.name, stock: p.stock, velocity: soldQtyInMonth, daysLeft: velocityPerDay > 0 ? Math.floor(p.stock / velocityPerDay) : 99 });
      }

      // 4. Stagnant
      if (p.stock >= 5 && soldQtyInMonth === 0) {
        const idealDiscount = 0.25; 
        let suggestedPrice = Math.round(p.price * (1 - idealDiscount));
        if (suggestedPrice < p.cost) suggestedPrice = p.cost; 
        insights.stagnant.push({ id: p.id, name: p.name, stock: p.stock, cost: p.cost, price: p.price, suggestedPrice, discount: Math.round(((p.price - suggestedPrice) / p.price) * 100) });
      }

      // 5. At Risk
      if (p.stock >= 5 && soldQtyInMonth > 0 && soldQtyInMonth <= 2) {
         const idealDiscount = 0.15;
         let suggestedPrice = Math.round(p.price * (1 - idealDiscount));
         const minPrice = p.cost * 1.1;
         if (suggestedPrice < minPrice) suggestedPrice = Math.max(minPrice, p.cost);
         insights.atRisk.push({ id: p.id, name: p.name, stock: p.stock, soldQty: soldQtyInMonth, cost: p.cost, price: p.price, suggestedPrice, discount: Math.round(((p.price - suggestedPrice) / p.price) * 100) });
      }
    });

    insights.highVelocity.sort((a, b) => b.unitsPerDay - a.unitsPerDay);
    insights.trending.sort((a, b) => b.quantity - a.quantity);
    insights.restock.sort((a, b) => a.daysLeft - b.daysLeft);

    return insights;
  }, [sales, inventory, purchases, layaways]);

  const setDateRange = (start: Date, end: Date) => {
    setStartDate(toYYYYMMDD(start));
    setEndDate(toYYYYMMDD(end));
  };
  
  const setToday = () => setDateRange(new Date(), new Date());
  
  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDateRange(yesterday, yesterday);
  };

  const setLast7Days = () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      setDateRange(start, end);
  };
  const setThisMonth = () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      setDateRange(start, end);
  };

  const handlePreviousDay = () => {
    const currentDate = new Date(startDate + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() - 1);
    setDateRange(currentDate, currentDate);
  };

  const handleNextDay = () => {
    const currentDate = new Date(endDate + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() + 1);
    setDateRange(currentDate, currentDate);
  };

  const isNextDayDisabled = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentSelectionEnd = new Date(endDate + 'T12:00:00');
    currentSelectionEnd.setHours(0, 0, 0, 0);
    return currentSelectionEnd >= today;
  }, [endDate]);

  const isWithinRange = useMemo(() => {
    if (!startDate || !endDate) {
      return () => true; 
    }
    
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

    const metricsForCurrentStore = useMemo(() => {
        const directSalesInRange = sales.filter(s => isWithinRange(s.createdAt) && !s.layawayId);
        const newActiveLayawaysInRange = layaways.filter(l => isWithinRange(l.createdAt) && l.status === 'active');

        const directSaleItems = directSalesInRange.flatMap(s => s.items || []).filter(Boolean);
        const newLayawayItems = newActiveLayawaysInRange.flatMap(l => l.items || []).filter(Boolean);
        const allSoldItems = [...directSaleItems, ...newLayawayItems];
        
        const unitsBySeller: { [key: string]: number } = {};
        const allTransactions = [...directSalesInRange, ...newActiveLayawaysInRange];
        allTransactions.forEach(transaction => {
            const seller = transaction.seller;
            if (!unitsBySeller[seller]) {
                unitsBySeller[seller] = 0;
            }
            const transactionUnits = (transaction.items || []).reduce((sum, item) => sum + (item?.quantity || 0), 0);
            unitsBySeller[seller] += transactionUnits;
        });
        const sortedUnitsBySeller = Object.entries(unitsBySeller)
            .map(([sellerName, units]) => ({ sellerName, units }))
            .sort((a, b) => b.units - a.units);


        const totalUnitsSold = allSoldItems.reduce((sum, item) => sum + item.quantity, 0);

        const totalProfit = directSalesInRange.reduce((sum, sale) => {
            const rawProfit = (sale.items || []).reduce((itemSum, item) => {
                if (!item || item.cost === undefined) return itemSum;
                return itemSum + ((item.price - item.cost) * item.quantity);
            }, 0);

            let saleCommission = 0;
            if (sale.payments && sale.payments.length > 0) {
                sale.payments.forEach(payment => {
                    const rate = COMMISSION_RATES[payment.method as PaymentMethod];
                    if (rate) {
                        saleCommission += payment.amount * rate;
                    }
                });
            } else if (sale.paymentMethod) {
                const rate = COMMISSION_RATES[sale.paymentMethod as PaymentMethod];
                if (rate) {
                    saleCommission += sale.totalAmount * rate;
                }
            }
            
            return sum + (rawProfit - saleCommission);
        }, 0);

        const numberOfDirectSales = directSalesInRange.length;
        const totalDirectSalesValue = directSalesInRange.reduce((sum, s) => sum + s.totalAmount, 0);
        const averageTicketSize = numberOfDirectSales > 0 ? totalDirectSalesValue / numberOfDirectSales : 0;
        
        const totalInventoryValue = inventory.reduce((sum, p) => sum + (p.cost * p.stock), 0);
        
        return { totalUnitsSold, totalProfit, averageTicketSize, totalInventoryValue, unitsBySeller: sortedUnitsBySeller, totalDirectSalesValue };
    }, [sales, layaways, inventory, isWithinRange]);
  
  const cashBreakdown = useMemo(() => {
    const cashLikeMethods = [PaymentMethod.Efectivo];
    const currentStoreId = inventory[0]?.storeId;
    if (!currentStoreId) return null;

    const salesCash = sales
        .filter(sale => !sale.layawayId)
        .flatMap(sale => (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})) as Payment[])
        .filter(p => p && isWithinRange(p.date) && cashLikeMethods.includes(p.method))
        .reduce((sum, p) => sum + p.amount, 0);

    const layawaysCash = layaways
        .flatMap(l => (Array.isArray(l.payments) ? l.payments : Object.values(l.payments || {})) as Payment[])
        .filter(p => p && isWithinRange(p.date) && cashLikeMethods.includes(p.method))
        .reduce((sum, p) => sum + p.amount, 0);

    const cashIncidents = allIncidents.filter(i =>
        i.storeId === currentStoreId &&
        isWithinRange(i.createdAt) &&
        (i.type === IncidentType.CASH_ADJUSTMENT || i.type === IncidentType.RECAUDO) &&
        (i.paymentMethod ? i.paymentMethod === PaymentMethod.Efectivo : true) &&
        !i.description.includes('Excedente pagado por cambio')
    );

    const incomeAdjustments = cashIncidents.filter(i => i.adjustmentType === 'income');
    const expenseAdjustments = cashIncidents.filter(i => i.adjustmentType === 'expense');

    const totalIncomeAdjustments = incomeAdjustments.reduce((sum: number, i) => sum + (i.adjustmentAmount || 0), 0);
    const totalExpenseAdjustments = expenseAdjustments.reduce((sum: number, i) => sum + (i.adjustmentAmount || 0), 0);
    
    const exchangeSurpluses = allIncidents.filter(i =>
        i.storeId === currentStoreId &&
        isWithinRange(i.createdAt) &&
        i.type === IncidentType.PRODUCT_EXCHANGE &&
        i.paymentMethod === PaymentMethod.Efectivo &&
        i.adjustmentAmount && i.adjustmentAmount > 0
    );

    const netTotal = salesCash + layawaysCash + totalIncomeAdjustments - totalExpenseAdjustments;

    return {
        salesCash,
        layawaysCash,
        incomeAdjustments,
        expenseAdjustments,
        exchangeSurpluses,
        netTotal
    };
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
                    allPayments.push({
                        id: `${sale.id}-${index}`,
                        date: payment.date,
                        type: 'Venta',
                        invoiceNumber: sale.invoiceNumber,
                        details: (sale.items || []).map(i => `${i.quantity}x ${i.name}`).join(', '),
                        customer: sale.customerName,
                        seller: payment.seller,
                        paymentMethod: payment.method,
                        amount: Number((payment as Payment).amount),
                    });
                }
            });
        }
    });

    layaways.forEach(layaway => {
        const paymentsArray: Payment[] = (Array.isArray(layaway.payments) ? layaway.payments : Object.values(layaway.payments || {})) as Payment[];
        paymentsArray.forEach((payment, index) => {
            if (payment && isWithinRange(payment.date)) {
                 allPayments.push({
                    id: `${layaway.id}-${index}`,
                    date: payment.date,
                    type: 'Abono',
                    invoiceNumber: layaway.invoiceNumber,
                    details: index === 0 ? `Abono inicial para #${layaway.invoiceNumber}` : `Pago a abono #${layaway.invoiceNumber}`,
                    customer: layaway.customerName,
                    seller: payment.seller,
                    paymentMethod: payment.method,
                    amount: Number((payment as Payment).amount),
                });
            }
        });
    });

    allIncidents.forEach(incident => {
        if (incident.storeId === currentStoreId && isWithinRange(incident.createdAt)) {
            if (incident.type === IncidentType.PRODUCT_EXCHANGE) return;
            if (incident.type === IncidentType.CASH_ADJUSTMENT && incident.description.includes('Excedente pagado por cambio')) return;

            const isIncome = (
                incident.type === IncidentType.RECAUDO ||
                incident.type === IncidentType.ADDITIONAL_INCOME ||
                (incident.type === IncidentType.CASH_ADJUSTMENT && incident.adjustmentType === 'income')
            );
            
            let paymentMethod: PaymentMethod | string | undefined = incident.paymentMethod;
            let type: UnifiedTransaction['type'] = 'Ajuste de Efectivo';

            if(incident.type === IncidentType.RECAUDO) {
                type = 'Recaudo Sistecredito';
                paymentMethod = 'Recaudo Sistecredito';
            } else if (incident.type === IncidentType.ADDITIONAL_INCOME) {
                type = 'Ingreso Adicional';
            }
            
            if (isIncome && paymentMethod && incident.adjustmentAmount) {
                allPayments.push({
                    id: incident.id,
                    date: incident.createdAt,
                    type: type,
                    invoiceNumber: incident.originalSaleInvoiceNumber || '-',
                    details: incident.description,
                    customer: incident.customerName || 'N/A',
                    seller: incident.sellerName,
                    paymentMethod: paymentMethod,
                    amount: incident.adjustmentAmount,
                });
            }
        }
    });

    allPayments.forEach(p => {
        totalsByMethod[p.paymentMethod] = (totalsByMethod[p.paymentMethod] || 0) + p.amount;
        const rate = COMMISSION_RATES[p.paymentMethod as PaymentMethod];
        if (rate) {
          commissionsByMethod[p.paymentMethod] = (commissionsByMethod[p.paymentMethod] || 0) + (Number(p.amount) * rate);
        }
    });

    allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const filteredTransactions = paymentMethodFilter 
        ? allPayments.filter(p => p.paymentMethod === paymentMethodFilter)
        : allPayments;

    return { totalsByMethod, commissionsByMethod, filteredTransactions };

  }, [sales, layaways, allIncidents, inventory, isWithinRange, paymentMethodFilter]);

  const totalPeriodIncome = useMemo(() => {
    return Object.entries(detailedReportData.totalsByMethod)
        .reduce((sum, [method, total]) => {
            if (method !== 'Recaudo Sistecredito' && typeof total === 'number') {
                return sum + total;
            }
            return sum;
        }, 0);
  }, [detailedReportData.totalsByMethod]);

  const totalRecaudos = useMemo(() => {
      return detailedReportData.totalsByMethod['Recaudo Sistecredito'] || 0;
  }, [detailedReportData.totalsByMethod]);

  const priceVariationReportData = useMemo(() => {
    const reportItems: PriceVariationItem[] = [];

    sales.forEach(sale => {
        if (isWithinRange(sale.createdAt) && sale.items) {
            const paymentMethods = sale.payments && sale.payments.length > 0
                ? [...new Set(sale.payments.map(p => p.method))]
                : (sale.paymentMethod ? [sale.paymentMethod] : []);
            
            sale.items.forEach(item => {
                if (!item) return;

                const productInInventory = inventory.find(p => p.id === item.id);
                
                if (!productInInventory) return;

                const variation = item.price - productInInventory.price;
                const totalVariation = variation * item.quantity;
                let status: 'markup' | 'discount' | 'normal';
                if (variation > 0) {
                    status = 'markup';
                } else if (variation < 0) {
                    status = 'discount';
                } else {
                    status = 'normal';
                }

                reportItems.push({
                    id: `${sale.id}-${item.id}`,
                    date: sale.createdAt,
                    invoiceNumber: sale.invoiceNumber,
                    productName: item.name,
                    seller: sale.seller,
                    soldPrice: item.price,
                    currentPrice: productInInventory.price,
                    variation: variation,
                    quantity: item.quantity,
                    totalVariation: totalVariation,
                    status: status,
                    paymentMethods: paymentMethods,
                });
            });
        }
    });

    const filteredItems = reportItems.filter(item => {
        const sellerMatch = priceVariationSellerFilter ? item.seller === priceVariationSellerFilter : true;
        const paymentMethodMatch = priceVariationPaymentMethodFilter
            ? item.paymentMethods.includes(priceVariationPaymentMethodFilter as PaymentMethod)
            : true;
        return sellerMatch && paymentMethodMatch;
    });

    const summary = {
        totalMarkup: 0,
        totalDiscount: 0,
    };

    filteredItems.forEach(item => {
        if (item.totalVariation > 0) {
            summary.totalMarkup += item.totalVariation;
        } else if (item.totalVariation < 0) {
            summary.totalDiscount += item.totalVariation;
        }
    });
    
    const sortedItems = filteredItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return {
        items: sortedItems,
        summary: {
            ...summary,
            netDifference: summary.totalMarkup + summary.totalDiscount
        }
    };
}, [sales, inventory, isWithinRange, priceVariationSellerFilter, priceVariationPaymentMethodFilter]);

  const categoryReport = useMemo(() => {
    const salesInRange = sales.filter(s => isWithinRange(s.createdAt));
    const layawaysInRange = layaways.filter(l => isWithinRange(l.createdAt));
    const allTransactions = [...salesInRange, ...layawaysInRange];

    const categoryData: { [key: string]: { totalSales: number; totalUnits: number } } = {};

    allTransactions.forEach(transaction => {
        ((transaction.items as CartItem[]) || []).forEach(item => {
            if (!item) return;
            const categoryId = item.categoryId;
            if (!categoryData[categoryId]) {
                categoryData[categoryId] = { totalSales: 0, totalUnits: 0 };
            }
            categoryData[categoryId].totalSales += item.price * item.quantity;
            categoryData[categoryId].totalUnits += item.quantity;
        });
    });

    return Object.entries(categoryData)
        .map(([categoryId, data]) => {
            const categoryInfo = props.categories.find(c => c.id === categoryId);
            return {
                categoryId,
                categoryName: categoryInfo?.name || 'Sin Categoría',
                ...data,
            };
        })
        .sort((a, b) => b.totalSales - a.totalSales);
    }, [sales, layaways, props.categories, isWithinRange]);

    const topProductsReport = useMemo(() => {
        const salesInRange = sales.filter(s => isWithinRange(s.createdAt));
        const layawaysInRange = layaways.filter(l => isWithinRange(l.createdAt));
        const allTransactions = [...salesInRange, ...layawaysInRange];

        const productData: { [key: string]: { totalUnits: number; totalSales: number } } = {};

        allTransactions.forEach(transaction => {
            ((transaction.items as CartItem[]) || []).forEach(item => {
                if (!item) return;
                const productId = item.id;
                if (!productData[productId]) {
                    productData[productId] = { totalUnits: 0, totalSales: 0 };
                }
                productData[productId].totalUnits += item.quantity;
                productData[productId].totalSales += item.price * item.quantity;
            });
        });

        return Object.entries(productData)
            .map(([productId, data]) => {
                const productInfo = inventory.find(p => p.id === productId);
                return {
                    productId,
                    productName: productInfo?.name || 'Producto Desconocido',
                    ...data,
                };
            })
            .sort((a, b) => b.totalUnits - a.totalUnits)
            .slice(0, 10);
    }, [sales, layaways, inventory, isWithinRange]);
    
    const forecastAnalysis = useMemo(() => {
        const now = new Date();
        const currentDay = now.getDate();
        const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysRemaining = totalDaysInMonth - currentDay;
        const monthProgress = (currentDay / totalDaysInMonth) * 100;

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        let totalPaymentsThisMonth = 0;

        sales.forEach(sale => {
            const payments = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})) as Payment[];
            if (payments) {
                payments.forEach(p => {
                    const paymentDate = new Date(p.date);
                    if (paymentDate >= startOfMonth && paymentDate <= endOfMonth) {
                        totalPaymentsThisMonth += Number(p.amount);
                    }
                });
            } else if (sale.paymentMethod && !sale.layawayId) {
                 const saleDate = new Date(sale.createdAt);
                 if (saleDate >= startOfMonth && saleDate <= endOfMonth) {
                     totalPaymentsThisMonth += sale.totalAmount;
                 }
            }
        });

        layaways.forEach(layaway => {
             const payments = (Array.isArray(layaway.payments) ? layaway.payments : Object.values(layaway.payments || {})) as Payment[];
             if (payments) {
                 payments.forEach(p => {
                     const paymentDate = new Date(p.date);
                     if (paymentDate >= startOfMonth && paymentDate <= endOfMonth) {
                         totalPaymentsThisMonth += Number(p.amount);
                     }
                 });
             }
        });
        
        const dailyAverage = currentDay > 0 ? totalPaymentsThisMonth / currentDay : 0;
        const projectedTotal = dailyAverage * totalDaysInMonth;

        let strategies: { title: string, desc: string, type: 'marketing' | 'sales' | 'admin' }[] = [];

        if (currentDay <= 10) {
            strategies = [
                { title: "Impulso Inicial", desc: "Contacta a los 5 mejores clientes del mes pasado para mostrar novedades.", type: "marketing" },
                { title: "Exhibición", desc: "Rota los maniquíes y vitrina para dar sensación de novedad total.", type: "sales" },
                { title: "Metas Claras", desc: "Asegúrate que cada vendedor conozca su meta diaria para este mes.", type: "admin" }
            ];
        } else if (currentDay <= 20) {
            strategies = [
                { title: "Movimiento de Stock", desc: "Identifica los 3 productos menos vendidos y ármalos en outfits atractivos.", type: "sales" },
                { title: "Activación de Clientes", desc: "Envía mensajes de 'Te extrañamos' a clientes que no han venido en 2 meses.", type: "marketing" },
                { title: "Revisión de Inventario", desc: "Haz un conteo rápido de las categorías más vendidas para evitar quiebres.", type: "admin" }
            ];
        } else {
            strategies = [
                { title: "Cierre de Mes", desc: "Enfócate en cerrar los abonos pendientes para sumar al flujo de caja.", type: "sales" },
                { title: "Liquidación Express", desc: "Si la meta está lejos, considera una promo flash de fin de semana.", type: "marketing" },
                { title: "Pre-Venta", desc: "Ofrece apartar prendas de la próxima colección para asegurar ventas futuras.", type: "sales" }
            ];
        }

        return {
            currentTotal: totalPaymentsThisMonth,
            projectedTotal,
            dailyAverage,
            monthProgress,
            daysRemaining,
            strategies
        };
    }, [sales, layaways]);

  const churnAnalysis = useMemo(() => {
    const today = new Date();
    const customerMap = new Map<string, {
      name: string;
      phone: string;
      lastPurchaseDate: Date;
      totalSpent: number;
      purchaseCount: number;
      paymentMethods: Record<string, number>;
    }>();

    const processTransaction = (customerName: string, customerPhone: string, date: string, amount: number, payments?: Payment[], paymentMethod?: string) => {
      if (!customerName || customerName === 'Cliente Mostrador' || !customerPhone || customerPhone.length < 10) return;

      const key = `${customerName.toLowerCase()}-${customerPhone}`;
      const existing = customerMap.get(key);
      const transactionDate = new Date(date);

      const methodsUsed: string[] = [];
      if (payments) {
        payments.forEach(p => methodsUsed.push(p.method));
      } else if (paymentMethod) {
        methodsUsed.push(paymentMethod);
      }

      if (existing) {
        existing.lastPurchaseDate = transactionDate > existing.lastPurchaseDate ? transactionDate : existing.lastPurchaseDate;
        existing.totalSpent += amount;
        existing.purchaseCount += 1;
        methodsUsed.forEach(m => {
          existing.paymentMethods[m] = (existing.paymentMethods[m] || 0) + 1;
        });
      } else {
        const initialMethods: Record<string, number> = {};
        methodsUsed.forEach(m => initialMethods[m] = 1);
        customerMap.set(key, {
          name: customerName,
          phone: customerPhone,
          lastPurchaseDate: transactionDate,
          totalSpent: amount,
          purchaseCount: 1,
          paymentMethods: initialMethods
        });
      }
    };

    sales.forEach(sale => {
      if (!sale.layawayId) {
        processTransaction(sale.customerName, sale.customerPhone, sale.createdAt, sale.totalAmount, sale.payments, sale.paymentMethod);
      }
    });

    layaways.forEach(layaway => {
      if (layaway.status === 'completed') {
        processTransaction(layaway.customerName, layaway.customerPhone, layaway.createdAt, layaway.totalAmount, layaway.payments);
      }
    });

    const churnedCustomers = Array.from(customerMap.values())
      .filter(c => {
        const daysSinceLastPurchase = (today.getTime() - c.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastPurchase > 45 && c.purchaseCount > 1;
      })
      .map(c => {
        let preferredMethod = 'Desconocido';
        let maxCount = 0;
        Object.entries(c.paymentMethods).forEach(([method, count]) => {
          if (count > maxCount) {
            maxCount = count;
            preferredMethod = method;
          }
        });

        return {
          ...c,
          daysSince: Math.floor((today.getTime() - c.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)),
          preferredMethod
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 20);

    return churnedCustomers;
  }, [sales, layaways]);


    const managedSales = useMemo(() => {
        const allTransactions: UnifiedSaleTransaction[] = [
          ...sales.map(s => ({ ...s, transactionType: 'sale' as const })),
          ...layaways.map(l => ({ ...l, transactionType: 'layaway' as const, layawayStatus: l.status }))
        ];

        return allTransactions.filter(transaction => {
          const lowerCaseSearchTerm = salesSearchTerm.toLowerCase();
          const itemsArray: CartItem[] = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})).filter(Boolean) as CartItem[];
    
          const matchesSearch =
            transaction.invoiceNumber.toString().includes(salesSearchTerm) ||
            transaction.customerName.toLowerCase().includes(lowerCaseSearchTerm) ||
            transaction.customerPhone.includes(salesSearchTerm) ||
            itemsArray.some((item: CartItem) =>
                item && (
                    item.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                    (item.supplier && item.supplier.toLowerCase().includes(lowerCaseSearchTerm))
                )
            );
          
          const matchesSeller = salesSellerFilter ? transaction.seller === salesSellerFilter : true;
    
          const matchesCategory = salesCategoryFilter
            ? itemsArray.some((item: CartItem) => item && item.categoryId === salesCategoryFilter)
            : true;
    
          return matchesSearch && matchesSeller && isWithinRange(transaction.createdAt) && matchesCategory;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }, [sales, layaways, salesSearchTerm, salesSellerFilter, salesCategoryFilter, isWithinRange]);

      const calculateSaleProfit = (transaction: UnifiedSaleTransaction): number => {
        if (!transaction?.items) return 0;
        
        const itemsArray: CartItem[] = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})).filter(Boolean) as CartItem[];
        
        const rawProfit = itemsArray.reduce((profit, item: CartItem) => {
          if (!item || item.cost === undefined) return profit;
          const itemProfit = (item.price - item.cost) * item.quantity;
          return profit + itemProfit;
        }, 0);
    
        let totalCommission = 0;
        if (transaction.payments && transaction.payments.length > 0) {
          for (const payment of transaction.payments) {
            const rate = COMMISSION_RATES[payment.method as PaymentMethod];
            if (rate) {
              totalCommission += payment.amount * rate;
            }
          }
        } else if ('paymentMethod' in transaction && transaction.paymentMethod) {
          const rate = COMMISSION_RATES[transaction.paymentMethod as PaymentMethod];
          if (rate) {
            totalCommission += transaction.totalAmount * rate;
          }
        }
    
        return rawProfit - totalCommission;
      };

      const renderPaymentMethods = (transaction: UnifiedSaleTransaction) => {
        const methods: string[] = transaction.payments && transaction.payments.length > 0 
          ? [...new Set(transaction.payments.map(p => p.method))]
          : ('paymentMethod' in transaction && transaction.paymentMethod ? [transaction.paymentMethod] : []);
    
        if (methods.length === 0) {
          return <span className="text-gray-500 dark:text-text-dark text-xs">N/A</span>;
        }
    
        return (
          <div className="flex flex-wrap gap-1 justify-start">
            {methods.map(method => (
              <span key={method} className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-text-light whitespace-nowrap">
                {method}
              </span>
            ))}
          </div>
        );
      };

    const salesChartData = useMemo(() => {
        const transactions = [
            ...sales.map(s => ({ date: s.createdAt, amount: s.totalAmount })),
            ...layaways.filter(l => l.status !== 'pre-order').map(l => ({ date: l.createdAt, amount: l.totalAmount }))
        ];

        const currentDayOfMonth = new Date().getDate();

        const dataToProcess = chartViewMode === 'all-months' 
            ? transactions
            : transactions.filter(t => isWithinRange(t.date));

        const groupedData: { [key: string]: { total: number, progress: number } } = {};

        dataToProcess.forEach(transaction => {
            const date = new Date(transaction.date);
            let key: string;

            if (chartViewMode === 'daily') {
                key = date.toISOString().split('T')[0];
            } else {
                key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            }
            
            if (!groupedData[key]) {
                groupedData[key] = { total: 0, progress: 0 };
            }

            groupedData[key].total += transaction.amount;

            if (chartViewMode !== 'daily' && date.getDate() <= currentDayOfMonth) {
                groupedData[key].progress += transaction.amount;
            }
        });

        return Object.entries(groupedData)
            .map(([label, { total, progress }]) => ({ label, total, partialTotal: progress }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [sales, layaways, chartViewMode, isWithinRange]);

  const handleShareCurrentStore = async () => {
    const { totalUnitsSold, totalProfit, averageTicketSize } = metricsForCurrentStore;
    
    const paymentBreakdownText = Object.entries(detailedReportData.totalsByMethod)
        .map(([method, total]) => {
            if (method === 'Recaudo Sistecredito') return null;
            const commission = detailedReportData.commissionsByMethod[method];
            let line = ` • *${method}:* ${formatCOP(Number(total) || 0)}`;
            if (commission > 0) {
                line += ` (desc. ${formatCOP(Number(commission))})`;
            }
            return line;
        })
        .filter(Boolean)
        .join('\n');
    
    let recaudosText = '';
    if (totalRecaudos > 0) {
        recaudosText = `\n\n✳️ *Recaudos Sistecredito (Aparte):* ${formatCOP(totalRecaudos)}`;
    }

    const summaryText = `*Resumen de Rendimiento - ${currentStore?.name || 'Tienda Actual'}*\n` +
      `_Periodo: ${startDate} al ${endDate}_\n\n` +
      `💰 *Ingresos Totales:* ${formatCOP(totalPeriodIncome)}\n` +
      `📈 *Ganancia (Ventas Directas):* ${formatCOP(totalProfit)}\n` +
      `🧾 *Ticket Promedio (Ventas Directas):* ${formatCOP(averageTicketSize)}\n` +
      `📦 *Unidades Vendidas:* ${totalUnitsSold}` +
      `${recaudosText}\n\n` +
      `------\n*Desglose de Ingresos:*\n` +
      `${paymentBreakdownText}\n` +
      `------\n\n` +
      `Informe generado por Facturacion Bombon.`;
      
      try {
          if (navigator.share) { 
              await navigator.share({ title: `Resumen de ${currentStore?.name || 'Tienda Actual'}`, text: summaryText }); 
          } else { 
              await navigator.clipboard.writeText(summaryText); 
              alert('Resumen copiado al portapeles.'); 
          }
      } catch (error) { 
          console.error('Error al compartir:', error); 
      }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Control Panel: Filters & Smart Access */}
      <div className="bg-white dark:bg-secondary p-4 rounded-xl shadow-lg border border-accent/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button onClick={setToday} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Hoy</button>
                    <button onClick={setYesterday} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Ayer</button>
                    <button onClick={setLast7Days} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">7 Días</button>
                    <button onClick={setThisMonth} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Mes</button>
                </div>

                {/* Quick Navigation Anchors - RESTORED */}
                <div className="flex items-center gap-1 bg-accent/10 p-1 rounded-lg">
                    <button onClick={() => scrollToSection('payment-report')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><DollarIcon className="w-3 h-3"/> Pagos</button>
                    <button onClick={() => scrollToSection('sales-history')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><ReceiptIcon className="w-3 h-3"/> Historial</button>
                    <button onClick={() => scrollToSection('sales-chart')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><ChartBarIcon className="w-3 h-3"/> Gráficos</button>
                </div>

                <button 
                  onClick={onOpenVerification}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-600/20"
                >
                  <ClipboardListIcon className="w-4 h-4" />
                  <span>Verificar Inventario</span>
                </button>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <button onClick={handlePreviousDay} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeftIcon className="w-4 h-4" /></button>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm border-b border-gray-300 dark:border-gray-700 focus:border-accent outline-none w-32"/>
                    <span className="text-gray-400">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm border-b border-gray-300 dark:border-gray-700 focus:border-accent outline-none w-32"/>
                    <button onClick={handleNextDay} disabled={isNextDayDisabled} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><ChevronRightIcon className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
      </div>

      {/* AI Insights Widget - NOW INCLUDES HIGH VELOCITY SALES */}
      <div className="w-full transition-all duration-300 ease-in-out">
             <div className="bg-white dark:bg-secondary rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                 <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-accent via-purple-500 to-blue-500"></div>
                 <div 
                    onClick={() => setIsAIExpanded(!isAIExpanded)}
                    className="p-2 px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex justify-between items-center"
                 >
                     <div className="flex items-center gap-2">
                         <SparklesIcon className="w-4 h-4 text-accent" />
                         <h3 className="font-bold text-gray-800 dark:text-text-light text-sm">Street AI <span className="hidden sm:inline text-gray-400 font-normal">- Asistente Inteligente</span></h3>
                     </div>
                     <div className="flex items-center gap-3">
                        {aiInsights && !isAIExpanded && (
                            <span className="text-[10px] text-gray-400 animate-fade-in">
                                {aiInsights.period}
                            </span>
                        )}
                         <span className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-bold uppercase tracking-wider">BETA</span>
                         <button className="text-gray-400 hover:text-accent transition-colors">
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isAIExpanded ? 'rotate-180' : ''}`} />
                         </button>
                     </div>
                 </div>

                 {isAIExpanded && (
                 <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20">
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button onClick={() => setActiveAITab('insights')} className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${activeAITab === 'insights' ? 'bg-white dark:bg-gray-800 text-accent border-b-2 border-accent' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <PackageIcon className="w-3 h-3" /> Inventario & Insights
                        </button>
                        <button onClick={() => setActiveAITab('forecast')} className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${activeAITab === 'forecast' ? 'bg-white dark:bg-gray-800 text-accent border-b-2 border-accent' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <ChartBarIcon className="w-3 h-3" /> Proyección de Cierre
                        </button>
                        <button onClick={() => setActiveAITab('clients')} className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${activeAITab === 'clients' ? 'bg-white dark:bg-gray-800 text-accent border-b-2 border-accent' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <UsersIcon className="w-3 h-3" /> Retención & Fuga
                        </button>
                    </div>

                    <div className="p-3 flex flex-col md:flex-row gap-3 min-h-[120px]">
                    {activeAITab === 'insights' ? (
                        <>
                            <div className="md:w-1/2 space-y-2 overflow-y-auto max-h-[180px] pr-1">
                            {aiInsights ? (
                                <>
                                    {/* HIGH VELOCITY FIRST */}
                                    {aiInsights.highVelocity.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="font-black text-orange-600 dark:text-orange-400 text-[10px] uppercase tracking-widest flex items-center gap-1">
                                                <SparklesIcon className="w-3 h-3 animate-pulse" /> Venta Relámpago
                                            </p>
                                            {aiInsights.highVelocity.map((item) => (
                                                <button key={item.id} onClick={() => setActiveInsightId(item.id)} className={`w-full text-left p-1.5 rounded border text-xs transition-colors flex justify-between items-center ${activeInsightId === item.id ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                                    <span className="truncate font-black">{item.name}</span>
                                                    <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/40 px-1 rounded">{item.unitsPerDay.toFixed(1)} uds/día</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {aiInsights.restock.length > 0 && (
                                        <div className="space-y-1 mt-2">
                                            <p className="font-bold text-red-600 dark:text-red-400 text-[10px] uppercase tracking-wide">⚠️ Reabastecer</p>
                                            {aiInsights.restock.slice(0, 2).map((item) => (
                                                <button key={item.id} onClick={() => setActiveInsightId(item.id)} className={`w-full text-left p-1.5 rounded border text-xs transition-colors flex justify-between items-center ${activeInsightId === item.id ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                                    <span className="truncate font-medium">{item.name}</span>
                                                    <span className="text-gray-500 whitespace-nowrap">Quedan: {item.stock}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {aiInsights.trending.length > 0 && (
                                        <div className="space-y-1 mt-2">
                                            <p className="font-bold text-green-600 dark:text-green-400 text-[10px] uppercase tracking-wide">🔥 Tendencia</p>
                                            {aiInsights.trending.slice(0, 3).map((item) => (
                                                <button key={item.id} onClick={() => setActiveInsightId(item.id)} className={`w-full text-left p-1.5 rounded border text-xs transition-colors flex justify-between items-center ${activeInsightId === item.id ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                                    <span className="truncate font-medium">{item.name}</span>
                                                    <span className="text-gray-500 whitespace-nowrap">{item.quantity} vendidos</span>
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
                                        const trendingItem = aiInsights?.trending.find(i => i.id === activeInsightId);
                                        const restockItem = aiInsights?.restock.find(i => i.id === activeInsightId);
                                        const atRiskItem = aiInsights?.atRisk.find(i => i.id === activeInsightId);
                                        const stagnantItem = aiInsights?.stagnant.find(i => i.id === activeInsightId);

                                        if (highVelItem) return (
                                            <div className="animate-fade-in text-sm">
                                                <h4 className="font-black text-orange-600 dark:text-orange-400 mb-1 flex items-center gap-1">⚡ VENTA RELÁMPAGO</h4>
                                                <p className="text-gray-700 dark:text-gray-300 text-xs leading-tight mb-2">
                                                    Este ítem se está moviendo a <span className="font-bold text-accent">{highVelItem.unitsPerDay.toFixed(1)} uds/día</span>.
                                                    Has vendido el <span className="font-bold">{Math.round(highVelItem.percentageOfBatchGone)}%</span> del último lote en solo {highVelItem.daysElapsed} días.
                                                </p>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mb-3">
                                                    <div className={`h-full ${highVelItem.urgency === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`} style={{ width: `${highVelItem.percentageOfBatchGone}%` }}></div>
                                                </div>
                                                <button onClick={() => onNavigate(View.PURCHASES)} className="w-full bg-orange-500 text-white text-[10px] font-black uppercase py-1.5 rounded shadow-sm hover:bg-orange-600 transition-colors">Reposición Prioritaria</button>
                                            </div>
                                        );

                                        if (trendingItem) return <div className="animate-fade-in text-sm"><h4 className="font-bold text-green-600 dark:text-green-400 mb-1">🔥 Alto Rendimiento</h4><p className="text-gray-700 dark:text-gray-300 mb-2 text-xs">{trendingItem.context}</p></div>;
                                        if (restockItem) return <div className="animate-fade-in text-sm"><h4 className="font-bold text-red-600 dark:text-red-400 mb-1">⚠️ Stock Crítico</h4><p className="text-gray-700 dark:text-gray-300 mb-2 text-xs">Agotamiento en <strong>{restockItem.daysLeft} días</strong> al ritmo actual.</p></div>;
                                        if (atRiskItem) return <div className="animate-fade-in text-sm"><h4 className="font-bold text-orange-500 dark:text-orange-400 mb-1">⚠️ Rotación Lenta</h4><p className="text-gray-700 dark:text-gray-300 mb-2 text-xs">Sugerido: <span className="text-accent font-bold">{formatCOP(atRiskItem.suggestedPrice)}</span> (-{atRiskItem.discount}%)</p></div>;
                                        if (stagnantItem) return <div className="animate-fade-in text-sm"><h4 className="font-bold text-gray-500 mb-1">💤 Capital Estancado</h4><p className="text-gray-700 dark:text-gray-300 mb-2 text-xs">Liquidación: <span className="text-red-500 font-bold">{formatCOP(stagnantItem.suggestedPrice)}</span> (-{stagnantItem.discount}%)</p></div>;
                                        return null;
                                    })()
                                )}
                            </div>
                        </>
                    ) : activeAITab === 'forecast' ? (
                        <div className="w-full flex flex-col md:flex-row gap-4 animate-fade-in">
                            <div className="md:w-1/2 space-y-3">
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Proyección de Cierre</h4>
                                    <p className="text-2xl font-extrabold text-accent">{formatCOP(forecastAnalysis.projectedTotal)}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-300"><span>Progreso del Mes</span><span>{Math.round(forecastAnalysis.monthProgress)}%</span></div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden"><div className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${forecastAnalysis.monthProgress}%` }}></div></div>
                                </div>
                            </div>
                            <div className="md:w-1/2 space-y-2">
                                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200">Estrategias</h4>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                    {forecastAnalysis.strategies.map((strat, idx) => (
                                        <div key={idx} className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex gap-3 items-start"><div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${strat.type === 'marketing' ? 'bg-purple-500' : 'bg-green-500'}`}></div><div><p className="text-xs font-bold">{strat.title}</p><p className="text-[10px] text-gray-500">{strat.desc}</p></div></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full animate-fade-in">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 mb-3">Clientes en Riesgo de Fuga</h4>
                            <div className="max-h-[200px] overflow-y-auto pr-2">
                                {churnAnalysis.length > 0 ? churnAnalysis.map((client, index) => (
                                    <div key={index} className="bg-white dark:bg-gray-800 p-3 mb-2 rounded-lg border-l-4 border-l-red-500 flex justify-between items-center">
                                        <div><p className="font-bold text-sm">{client.name}</p><p className="text-xs text-gray-500">{client.phone}</p></div>
                                        <div className="text-right"><p className="text-xs font-bold text-red-500">{client.daysSince} días</p><p className="text-[10px] text-gray-400">sin volver</p></div>
                                    </div>
                                )) : <p className="text-xs text-center text-gray-400">Todo bien por ahora.</p>}
                            </div>
                        </div>
                    )}
                    </div>
                 </div>
                 )}
             </div>
      </div>
      
      {/* Main Reports */}
      <div id="payment-report" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <div onClick={() => setIsPaymentsReportVisible(!isPaymentsReportVisible)} className="cursor-pointer flex justify-between items-center">
             <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-accent">Informe de Pagos: {currentStore?.name || 'Tienda Actual'}</h2>
                 <button onClick={(e) => { e.stopPropagation(); handleShareCurrentStore(); }} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700" aria-label={`Compartir resumen`}>
                    <ShareIcon className="w-5 h-5" />
                </button>
            </div>
            <ChevronDownIcon className={`w-6 h-6 transition-transform ${isPaymentsReportVisible ? 'rotate-180' : ''}`} />
        </div>
        {isPaymentsReportVisible && (
            <div className="mt-4 pt-4 border-t-2 border-accent/30 animate-fade-in">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div 
                        onClick={() => setIsUnitsSoldExpanded(!isUnitsSoldExpanded)}
                        className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                        <div className="flex justify-between items-start">
                            <div className="text-left">
                                <p className="text-sm text-gray-500 dark:text-text-dark">Unidades Vendidas</p>
                                <p className="text-2xl font-bold">{metricsForCurrentStore.totalUnitsSold}</p>
                            </div>
                            <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isUnitsSoldExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-sm text-gray-500 dark:text-text-dark">Ganancia (Ventas)</p>
                            <p className={`text-2xl font-bold ${metricsForCurrentStore.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCOP(metricsForCurrentStore.totalProfit)}</p>
                        </div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-sm text-gray-500 dark:text-text-dark">Ticket Promedio</p>
                            <p className="text-2xl font-bold">{formatCOP(metricsForCurrentStore.averageTicketSize)}</p>
                        </div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-sm text-gray-500 dark:text-text-dark">Valor Inventario (Costo)</p>
                            <p className="text-2xl font-bold">{formatCOP(metricsForCurrentStore.totalInventoryValue)}</p>
                        </div>
                    </div>
                </div>
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-text-light mb-2">Desglose por Medio de Pago</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-md text-left ring-2 ring-green-500/50">
                            <p className="font-bold text-green-800 dark:text-green-300">Ingresos del Periodo</p>
                            <p className="text-2xl font-extrabold text-green-600 dark:text-green-400">{formatCOP(totalPeriodIncome)}</p>
                        </div>
                        <div className={`bg-white dark:bg-gray-900/50 p-3 rounded-md text-left transition-all duration-200 ${paymentMethodFilter === 'Efectivo' ? 'ring-2 ring-accent shadow-lg' : 'hover:shadow-md'}`}>
                            <div onClick={(e) => { e.stopPropagation(); setIsCashBreakdownVisible(!isCashBreakdownVisible); }} className="cursor-pointer">
                                <div className="flex justify-between items-center">
                                    <p className="font-bold text-gray-800 dark:text-text-light">Efectivo (Neto)</p>
                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isCashBreakdownVisible ? 'rotate-180' : ''}`} />
                                </div>
                                <p className="text-2xl font-extrabold text-accent">{formatCOP(cashBreakdown?.netTotal || 0)}</p>
                            </div>
                            {isCashBreakdownVisible && cashBreakdown && (
                                <div className="mt-2 pt-2 border-t border-dashed text-xs space-y-1 animate-fade-in">
                                    <div className="flex justify-between"><span>Ventas (incluye excedentes):</span><span>{formatCOP(cashBreakdown.salesCash)}</span></div>
                                    <div className="flex justify-between"><span>Abonos:</span><span>{formatCOP(cashBreakdown.layawaysCash)}</span></div>
                                </div>
                            )}
                        </div>
                        {Object.entries(detailedReportData.totalsByMethod)
                            .filter(([method]) => method !== 'Efectivo' && method !== 'Recaudo Sistecredito')
                            .map(([method, total]) => {
                                const commission = detailedReportData.commissionsByMethod[method];
                                return (
                                <button key={method} onClick={() => setPaymentMethodFilter(paymentMethodFilter === method ? null : method)} className={`bg-white dark:bg-gray-900/50 p-3 rounded-md text-left transition-all duration-200 ${paymentMethodFilter === method ? 'ring-2 ring-accent shadow-lg' : 'hover:shadow-md'}`}>
                                    <p className="font-bold text-gray-800 dark:text-text-light">{method}</p>
                                    <p className="text-xl font-extrabold text-accent">{formatCOP(Number(total) || 0)}</p>
                                </button>
                            )})
                        }
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Historical Sales Table */}
      <div id="sales-history" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <div onClick={() => setIsSalesHistoryVisible(!isSalesHistoryVisible)} className="cursor-pointer flex justify-between items-center">
            <h2 className="text-2xl font-bold text-accent">Historial de Ventas</h2>
            <ChevronDownIcon className={`w-6 h-6 transition-transform ${isSalesHistoryVisible ? 'rotate-180' : ''}`} />
        </div>
        {isSalesHistoryVisible && (
            <div className="mt-4 pt-4 border-t-2 border-accent/30 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="relative">
                    <input type="text" placeholder="Factura, cliente, etc..." value={salesSearchTerm} onChange={e => setSalesSearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent outline-none" />
                    <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400"><SearchIcon /></div>
                  </div>
                  <select value={salesSellerFilter} onChange={e => setSalesSellerFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2"><option value="">Todos los vendedores</option>{sellers.map(seller => (<option key={seller.id} value={seller.name}>{seller.name}</option>))}</select>
                  <select value={salesCategoryFilter} onChange={e => setSalesCategoryFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2"><option value="">Todas las categorías</option>{props.categories.map(category => (<option key={category.id} value={category.id}>{category.name}</option>))}</select>
                </div>
                {managedSales.length > 0 ? (
                    <div className="overflow-x-auto"><table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-gray-800"><tr>
                            <th className="p-3 text-sm font-semibold">Factura</th><th className="p-3 text-sm font-semibold">Fecha</th><th className="p-3 text-sm font-semibold">Cliente</th><th className="p-3 text-sm font-semibold text-right">Total</th><th className="p-3 text-sm font-semibold text-right">Ganancia</th><th className="p-3 text-sm font-semibold text-center">Acciones</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {managedSales.map((transaction) => {
                            const profit = calculateSaleProfit(transaction);
                            const isExpanded = expandedSaleId === transaction.id;
                            return (<React.Fragment key={transaction.id}>
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => setExpandedSaleId(isExpanded ? null : transaction.id)}>
                                <td className="p-3 font-mono text-accent">#{transaction.invoiceNumber}</td>
                                <td className="p-3 text-sm whitespace-nowrap">{new Date(transaction.createdAt).toLocaleDateString()}</td>
                                <td className="p-3">{transaction.customerName}</td>
                                <td className="p-3 text-right font-semibold">{formatCOP(transaction.totalAmount)}</td>
                                <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCOP(profit)}</td>
                                <td className="p-3 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); setEditingSale(transaction as Sale); }} className="text-gray-500 hover:text-accent p-1"><EditIcon /></button>
                                </td>
                            </tr>
                            </React.Fragment>);})}</tbody>
                    </table></div>
                ) : <p className="text-center text-gray-500 py-8">Sin resultados.</p>}
            </div>
        )}
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-accent mb-4">Ventas por Categoría</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {categoryReport.map(cat => (
                        <div key={cat.categoryId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div><p className="font-bold">{cat.categoryName}</p><p className="text-xs text-gray-500">{cat.totalUnits} uds</p></div>
                            <p className="text-lg font-bold text-accent">{formatCOP(cat.totalSales)}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-accent mb-4">Top Productos</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {topProductsReport.map((prod, index) => (
                        <div key={prod.productId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3"><span className="text-gray-400 font-bold">{index + 1}.</span><p className="font-bold">{prod.productName}</p></div>
                            <p className="text-lg font-bold text-accent">{prod.totalUnits} uds</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div id="sales-chart" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-accent">Análisis de Ventas</h2>
            <div className="flex gap-2">
              <button onClick={() => setChartViewMode('daily')} className={`px-3 py-1 text-sm rounded-full font-semibold ${chartViewMode === 'daily' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Diario</button>
              <button onClick={() => setChartViewMode('monthly')} className={`px-3 py-1 text-sm rounded-full font-semibold ${chartViewMode === 'monthly' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Mensual</button>
            </div>
          </div>
          <SalesHistoryChart data={salesChartData} viewMode={chartViewMode} />
        </div>

        {editingSale && (
            <EditSaleModal
                isOpen={!!editingSale}
                onClose={() => setEditingSale(null)}
                sale={editingSale}
                sellers={sellers}
                inventory={inventory}
                onUpdateSale={onUpdateSale}
            />
        )}
    </div>
  );
};

export default DashboardView;
