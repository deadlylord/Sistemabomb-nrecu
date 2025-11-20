
import React, { useMemo, useState } from 'react';
import { Store, Product, Sale, Layaway, Seller, Role, View, Category, PaymentMethod, DailyNote, Incident, IncidentStatus, IncidentType, Payment, CartItem } from '../types';
import { formatCOP, COMMISSION_RATES } from '../constants';
import { DollarIcon, PackageIcon, ShareIcon, SwapIcon, CrossIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, EditIcon, TrashIcon, PrintIcon, AlertTriangleIcon, TruckIcon, SparklesIcon, ChartBarIcon, ReceiptIcon, TagIcon } from './Icons';
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
      {/* Legend */}
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
        {/* Y-Axis Labels */}
        <div className="h-full flex flex-col justify-between text-xs text-gray-500 dark:text-text-dark pr-2 shrink-0">
          {yAxisLabels.map((label, i) => (
            <div key={i} className={i === yAxisLabels.length - 1 ? "pb-6" : "-translate-y-1/2"}>
              {formatCOP(label).replace('$', '').replace(/\s/g, '').replace(',00', '')}
            </div>
          ))}
        </div>

        {/* Chart Bars Area */}
        <div className="flex-grow w-full pl-4 border-l border-gray-200 dark:border-gray-700">
          <div className="relative h-full w-full">
            {/* Grid Lines */}
            {yAxisLabels.map((_, i) => (
                <div key={i} className="absolute w-full border-t border-gray-200 dark:border-gray-700/50 border-dashed" style={{ bottom: `${(i / (yAxisLabels.length -1)) * 100}%` }}></div>
            ))}
            
            {/* Bars */}
            <div className="absolute inset-0 flex items-end justify-around gap-2 px-2 pb-6">
                {data.map((d) => {
                    const barHeight = (d.total / safeMaxValue) * 100;
                    const partialHeight = (d.partialTotal / safeMaxValue) * 100;

                    return (
                    <div key={d.label} className="relative flex h-full w-full flex-col items-center justify-end group">
                        
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap shadow-lg">
                            <p className="font-bold">{formatLabel(d.label)}</p>
                            <p>Total: {formatCOP(d.total)}</p>
                            {viewMode !== 'daily' && (
                                <p className="text-gray-300 text-[10px]">A la fecha: {formatCOP(d.partialTotal)}</p>
                            )}
                        </div>
                        
                        {/* Value on top of bar */}
                        <div className="text-xs font-bold text-gray-700 dark:text-text-dark mb-1 transition-opacity duration-300 z-20">
                           {d.total > 0 ? formatCompactCOP(d.total) : ''}
                        </div>
                        
                        {/* The bar container */}
                        <div className="relative w-full flex items-end h-full">
                             {/* Main Bar */}
                            <div
                                className="w-full rounded-t-md bg-accent/70 transition-all duration-300 group-hover:bg-accent absolute bottom-0 left-0"
                                style={{ height: `${barHeight}%` }}
                            ></div>
                            
                            {/* Partial Progress Line (Guide) */}
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
             {/* X-axis labels (separate layer to prevent overflow issues) */}
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
    sales, layaways, inventory, currentStore, sellers, onUpdateSale, onDeleteSale, onReprintSale
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

  const adminRole = useMemo(() => roles.find(r => r.name === 'Administrator'), [roles]);
  const isAdmin = useMemo(() => currentUser.roleId === adminRole?.id, [currentUser, adminRole]);
  
  const pendingIncidentsAcrossStores = useMemo(() => {
      if (!isAdmin) return [];
      return allIncidents.filter(i => [
        IncidentStatus.DAÑADO_REPORTADO,
        IncidentStatus.CAMBIO_SOLICITADO,
        IncidentStatus.TRASLADO_SOLICITADO
      ].includes(i.status));
  }, [allIncidents, isAdmin]);

  const pendingPreOrdersAcrossStores = useMemo(() => {
    return allLayaways.filter(l => l.status === 'pre-order');
  }, [allLayaways]);

  // AI Insights Logic (Local Calculation)
  const aiInsights = useMemo(() => {
    if (!sales || !inventory) return null;

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const periodLabel = `${thirtyDaysAgo.toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})} - ${today.toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})}`;

    // 1. Calculate Velocity per Product
    const productSalesMap = new Map<string, number>();
    sales.forEach(sale => {
      const saleDate = new Date(sale.createdAt);
      if (saleDate >= thirtyDaysAgo) {
        (sale.items || []).forEach(item => {
          if (item) {
            productSalesMap.set(item.id, (productSalesMap.get(item.id) || 0) + item.quantity);
          }
        });
      }
    });

    const insights = {
      period: periodLabel,
      trending: [] as { id: string, name: string, quantity: number, context: string }[],
      restock: [] as { id: string, name: string, stock: number, velocity: number, daysLeft: number }[],
      stagnant: [] as { id: string, name: string, stock: number, value: number }[]
    };

    inventory.forEach(p => {
      if (p.isDisabled) return;
      const soldQty = productSalesMap.get(p.id) || 0;
      
      // Trending: Sold > 3 units in last 30 days
      if (soldQty >= 3) {
        const percentageOfTotal = sales.length > 0 ? ((soldQty / sales.length) * 100).toFixed(1) : '0';
        insights.trending.push({ 
            id: p.id, 
            name: p.name, 
            quantity: soldQty,
            context: `Este producto ha tenido un desempeño sobresaliente. Ha movido ${soldQty} unidades en el último mes.`
        });
      }

      // Restock Needed: Low stock (< 3) but selling well (> 1 recently)
      if (p.stock <= 3 && soldQty >= 2) {
        const velocityPerDay = soldQty / 30;
        const daysLeft = velocityPerDay > 0 ? Math.floor(p.stock / velocityPerDay) : 99;
        insights.restock.push({ 
            id: p.id, 
            name: p.name, 
            stock: p.stock, 
            velocity: soldQty,
            daysLeft
        });
      }

      // Stagnant: High stock (> 8) but 0 sales
      if (p.stock >= 8 && soldQty === 0) {
        insights.stagnant.push({ 
            id: p.id, 
            name: p.name, 
            stock: p.stock,
            value: p.stock * p.cost
        });
      }
    });

    // Sort
    insights.trending.sort((a, b) => b.quantity - a.quantity);
    insights.restock.sort((a, b) => a.daysLeft - b.daysLeft);
    insights.stagnant.sort((a, b) => b.stock - a.stock);

    return insights;
  }, [sales, inventory]);

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
            } else if (sale.paymentMethod) { // Legacy
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
        
        return { totalUnitsSold, totalProfit, averageTicketSize, totalInventoryValue, unitsBySeller: sortedUnitsBySeller };
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
        (i.type === IncidentType.CASH_ADJUSTMENT || i.type === IncidentType.ADDITIONAL_INCOME) &&
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
        // FIX: Strongly type paymentsArray to ensure payment.amount is a number.
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
                        // FIX: Explicitly cast `payment` to `Payment` to ensure `amount` is a number.
                        // @FIX: The value from Object.values could be unknown. Explicitly cast to Number to ensure type safety for amount calculations.
                        amount: Number((payment as Payment).amount),
                    });
                }
            });
        }
    });

    layaways.forEach(layaway => {
        // FIX: Strongly type paymentsArray to ensure payment.amount is a number.
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
                    // FIX: Explicitly cast `payment` to `Payment` to ensure `amount` is a number.
                    // @FIX: The value from Object.values could be unknown. Explicitly cast to Number to ensure type safety for amount calculations.
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
          // FIX: Ensure `p.amount` is treated as a number in calculations to prevent type errors.
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
        totalDiscount: 0, // will be negative
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
    
    // --- START: Sales History Section Logic ---
    const managedSales = useMemo(() => {
        const allTransactions: UnifiedSaleTransaction[] = [
          ...sales.map(s => ({ ...s, transactionType: 'sale' as const })),
          ...layaways.map(l => ({ ...l, transactionType: 'layaway' as const, layawayStatus: l.status }))
        ];

        return allTransactions.filter(transaction => {
          const saleDate = new Date(transaction.createdAt);
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
        
        const itemsArray: CartItem[] = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})) as CartItem[];
        
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
        } else if ('paymentMethod' in transaction && transaction.paymentMethod) { // Legacy support for single payment method on Sales
          const rate = COMMISSION_RATES[transaction.paymentMethod as PaymentMethod];
          if (rate) {
            totalCommission += transaction.totalAmount * rate;
          }
        }
    
        return rawProfit - totalCommission;
      };

      const renderPaymentMethods = (transaction: UnifiedSaleTransaction) => {
        // @FIX: The `methods` array was being inferred as `unknown[]` due to Object.values. Explicitly casting to `string[]` ensures type safety for React keys and content.
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
    // --- END: Sales History Section Logic ---

    // --- Chart Data Logic ---
    const salesChartData = useMemo(() => {
        const transactions = [
            ...sales.map(s => ({ date: s.createdAt, amount: s.totalAmount })),
            ...layaways.filter(l => l.status !== 'pre-order').map(l => ({ date: l.createdAt, amount: l.totalAmount }))
        ];

        const currentDayOfMonth = new Date().getDate();

        // Determine which data set to process based on view mode
        const dataToProcess = chartViewMode === 'all-months' 
            ? transactions
            : transactions.filter(t => isWithinRange(t.date));

        const groupedData: { [key: string]: { total: number, progress: number } } = {};

        dataToProcess.forEach(transaction => {
            const date = new Date(transaction.date);
            let key: string;

            if (chartViewMode === 'daily') {
                key = date.toISOString().split('T')[0]; // YYYY-MM-DD
            } else { // 'monthly' or 'all-months'
                key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM
            }
            
            if (!groupedData[key]) {
                groupedData[key] = { total: 0, progress: 0 };
            }

            groupedData[key].total += transaction.amount;

            // Calculate accumulated sales up to current day of month for comparison
            // Only applicable for monthly aggregations (all-months or monthly)
            if (chartViewMode !== 'daily' && date.getDate() <= currentDayOfMonth) {
                groupedData[key].progress += transaction.amount;
            }
        });

        return Object.entries(groupedData)
            .map(([label, { total, progress }]) => ({ label, total, partialTotal: progress }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [sales, layaways, chartViewMode, isWithinRange]);

  // --- Start of Admin-only General Dashboard Logic ---
  
  const handleShareCurrentStore = async () => {
    const { totalUnitsSold, totalProfit, averageTicketSize } = metricsForCurrentStore;
    
    const paymentBreakdownText = Object.entries(detailedReportData.totalsByMethod)
        .map(([method, total]) => {
            if (method === 'Recaudo Sistecredito') return null; // Don't include this in the main breakdown
            // @FIX: The value from Object.entries could be unknown. Explicitly cast to Number to ensure type safety.
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
  
  const handleGoToPos = (storeId: string) => {
    onSwitchStore(storeId);
    onNavigate(View.POS);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Control Panel: Filters, Quick Nav, and Notifications */}
      <div className="bg-white dark:bg-secondary p-4 rounded-xl shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left Side: Date Filters & Anchors */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Date Presets */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button onClick={setToday} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Hoy</button>
                    <button onClick={setYesterday} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Ayer</button>
                    <button onClick={setLast7Days} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">7 Días</button>
                    <button onClick={setThisMonth} className="px-3 py-1 text-sm hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300">Mes</button>
                </div>

                {/* Quick Navigation Anchors */}
                <div className="flex items-center gap-1 bg-accent/10 p-1 rounded-lg">
                    <button onClick={() => scrollToSection('payment-report')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><DollarIcon className="w-3 h-3"/> Pagos</button>
                    <button onClick={() => scrollToSection('sales-history')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><ReceiptIcon className="w-3 h-3"/> Historial</button>
                    <button onClick={() => scrollToSection('price-variation')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><TagIcon className="w-3 h-3"/> Precios</button>
                     <button onClick={() => scrollToSection('sales-chart')} className="px-3 py-1 text-sm hover:bg-accent/20 rounded-md transition-colors text-accent font-medium flex items-center gap-1"><ChartBarIcon className="w-3 h-3"/> Gráficos</button>
                </div>
            </div>
            
            {/* Right Side: Date Picker & Notifications */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <button onClick={handlePreviousDay} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeftIcon className="w-4 h-4" /></button>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm border-b border-gray-300 dark:border-gray-700 focus:border-accent outline-none w-32"/>
                    <span className="text-gray-400">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm border-b border-gray-300 dark:border-gray-700 focus:border-accent outline-none w-32"/>
                    <button onClick={handleNextDay} disabled={isNextDayDisabled} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><ChevronRightIcon className="w-4 h-4" /></button>
                </div>
                
                {/* Notification Icons */}
                <div className="flex items-center gap-2 border-l pl-4 border-gray-200 dark:border-gray-700">
                    {/* Incidents Notification */}
                    <button 
                        onClick={() => onNavigate(View.INCIDENTS)}
                        className={`relative p-2 rounded-full transition-colors ${isAdmin && pendingIncidentsAcrossStores.length > 0 ? 'text-red-500 animate-pulse hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        title="Novedades Pendientes"
                    >
                        <AlertTriangleIcon className="w-5 h-5" />
                        {isAdmin && pendingIncidentsAcrossStores.length > 0 && (
                            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full border border-white dark:border-gray-900">
                                {pendingIncidentsAcrossStores.length}
                            </span>
                        )}
                    </button>

                    {/* Layaways Notification */}
                    <button 
                        onClick={() => onNavigate(View.LAYAWAY)}
                        className={`relative p-2 rounded-full transition-colors ${pendingPreOrdersAcrossStores.length > 0 ? 'text-yellow-500 animate-pulse hover:bg-yellow-50 dark:hover:bg-yellow-900/20' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        title="Abonos por Entregar"
                    >
                        <TruckIcon className="w-5 h-5" />
                        {pendingPreOrdersAcrossStores.length > 0 && (
                             <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full border border-white dark:border-gray-900">
                                {pendingPreOrdersAcrossStores.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* AI Insights Widget (Full Width) */}
      <div className="w-full">
             <div className="bg-white dark:bg-secondary rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 h-full flex flex-col relative overflow-hidden">
                 {/* Decorative Gradient Border */}
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-purple-500 to-blue-500"></div>
                 
                 <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                     <div className="flex items-center gap-2">
                         <SparklesIcon className="w-5 h-5 text-accent" />
                         <div>
                            <h3 className="font-bold text-gray-800 dark:text-text-light text-sm">Street AI: Insights</h3>
                            {aiInsights && <p className="text-xs text-gray-500 dark:text-gray-400">Analizando: {aiInsights.period}</p>}
                         </div>
                     </div>
                     <span className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-bold uppercase tracking-wider">BETA</span>
                 </div>

                 <div className="flex-grow p-3 flex flex-col md:flex-row gap-3 min-h-[120px]">
                    {/* Left: Insight List */}
                    <div className="md:w-1/2 space-y-2 overflow-y-auto max-h-[150px] pr-1">
                    {aiInsights ? (
                        <>
                             {aiInsights.restock.length > 0 && (
                                <div className="space-y-1">
                                    <p className="font-bold text-red-600 dark:text-red-400 text-xs uppercase tracking-wide">⚠️ Reabastecer</p>
                                    {aiInsights.restock.slice(0, 2).map((item) => (
                                        <button 
                                            key={item.id}
                                            onClick={() => setActiveInsightId(item.id)}
                                            className={`w-full text-left p-1.5 rounded border text-xs transition-colors flex justify-between items-center ${activeInsightId === item.id ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                        >
                                            <span className="truncate font-medium">{item.name}</span>
                                            <span className="text-gray-500 whitespace-nowrap">Quedan: {item.stock}</span>
                                        </button>
                                    ))}
                                </div>
                             )}
                             {aiInsights.trending.length > 0 && (
                                <div className="space-y-1">
                                    <p className="font-bold text-green-600 dark:text-green-400 text-xs uppercase tracking-wide">🔥 Tendencia</p>
                                    {aiInsights.trending.slice(0, 3).map((item) => (
                                        <button 
                                            key={item.id}
                                            onClick={() => setActiveInsightId(item.id)}
                                            className={`w-full text-left p-1.5 rounded border text-xs transition-colors flex justify-between items-center ${activeInsightId === item.id ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                        >
                                            <span className="truncate font-medium">{item.name}</span>
                                            <span className="text-gray-500 whitespace-nowrap">{item.quantity} vendidos</span>
                                        </button>
                                    ))}
                                </div>
                             )}
                             {aiInsights.stagnant.length > 0 && (
                                 <div className="space-y-1">
                                     <p className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">💤 Estancado</p>
                                     {aiInsights.stagnant.slice(0, 2).map((item) => (
                                        <button 
                                            key={item.id}
                                            onClick={() => setActiveInsightId(item.id)}
                                            className={`w-full text-left p-1.5 rounded border text-xs transition-colors flex justify-between items-center ${activeInsightId === item.id ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                        >
                                            <span className="truncate font-medium">{item.name}</span>
                                            <span className="text-gray-500 whitespace-nowrap">{item.stock} en stock</span>
                                        </button>
                                    ))}
                                 </div>
                             )}
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-xs text-gray-400">Cargando análisis...</p>
                        </div>
                    )}
                    </div>

                    {/* Right: Context Panel */}
                    <div className="md:w-1/2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700 flex flex-col justify-center relative">
                         {!activeInsightId ? (
                             <div className="text-center text-gray-400 text-xs">
                                 <SparklesIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                 <p>Selecciona un ítem para ver el análisis detallado.</p>
                             </div>
                         ) : (
                             (() => {
                                 const trendingItem = aiInsights?.trending.find(i => i.id === activeInsightId);
                                 const restockItem = aiInsights?.restock.find(i => i.id === activeInsightId);
                                 const stagnantItem = aiInsights?.stagnant.find(i => i.id === activeInsightId);
                                 
                                 if (trendingItem) {
                                     return (
                                         <div className="animate-fade-in text-sm">
                                             <h4 className="font-bold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1"><span className="text-lg">🔥</span> Alto Rendimiento</h4>
                                             <p className="text-gray-700 dark:text-gray-300 mb-2 text-xs leading-relaxed">{trendingItem.context}</p>
                                             <div className="bg-white dark:bg-gray-800 p-2 rounded border border-green-100 dark:border-green-900/30 text-xs">
                                                 <strong>Sugerencia:</strong> Asegura disponibilidad o crea combos con este producto.
                                             </div>
                                         </div>
                                     );
                                 }
                                 if (restockItem) {
                                     return (
                                        <div className="animate-fade-in text-sm">
                                            <h4 className="font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1"><span className="text-lg">⚠️</span> Stock Crítico</h4>
                                            <p className="text-gray-700 dark:text-gray-300 mb-2 text-xs leading-relaxed">
                                                Vendiendo <strong>{restockItem.velocity}</strong> unidades/mes. 
                                                Al ritmo actual, te quedarás sin stock en aproximadamente <strong>{restockItem.daysLeft} días</strong>.
                                            </p>
                                            <div className="bg-white dark:bg-gray-800 p-2 rounded border border-red-100 dark:border-red-900/30 text-xs">
                                                <strong>Sugerencia:</strong> Realizar pedido a proveedor inmediatamente.
                                            </div>
                                        </div>
                                     );
                                 }
                                 if (stagnantItem) {
                                     return (
                                        <div className="animate-fade-in text-sm">
                                            <h4 className="font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><span className="text-lg">💤</span> Capital Estancado</h4>
                                            <p className="text-gray-700 dark:text-gray-300 mb-2 text-xs leading-relaxed">
                                                Tienes <strong>{stagnantItem.stock}</strong> unidades sin movimiento en 30 días. 
                                                Representa <strong>{formatCOP(stagnantItem.value)}</strong> en costo de inventario quieto.
                                            </p>
                                            <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
                                                <strong>Sugerencia:</strong> Considera una promoción o exhibirlo en una zona más visible.
                                            </div>
                                        </div>
                                     );
                                 }
                                 return null;
                             })()
                         )}
                    </div>
                 </div>
             </div>
      </div>
      
      <div id="payment-report" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <div onClick={() => setIsPaymentsReportVisible(!isPaymentsReportVisible)} className="cursor-pointer flex justify-between items-center">
             <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-accent">Informe de Pagos: {currentStore?.name || 'Tienda Actual'}</h2>
                {isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); onOpenReports(); }} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Generar análisis de ventas con IA">
                      <SparklesIcon className="w-6 h-6 text-accent" />
                  </button>
                )}
                 <button onClick={(e) => { e.stopPropagation(); handleShareCurrentStore(); }} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700" aria-label={`Compartir resumen de ${currentStore?.name || 'Tienda Actual'}`}>
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
                        {isUnitsSoldExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50 animate-fade-in">
                                <h4 className="font-bold text-sm text-left mb-2 text-gray-700 dark:text-text-dark">Desglose por Vendedora:</h4>
                                {metricsForCurrentStore.unitsBySeller.length > 0 ? (
                                    <ul className="space-y-1 text-sm">
                                        {metricsForCurrentStore.unitsBySeller.map(sellerData => (
                                            <li key={sellerData.sellerName} className="flex justify-between items-center">
                                                <span className="text-gray-600 dark:text-text-dark">{sellerData.sellerName}</span>
                                                <span className="font-bold text-accent">{sellerData.units} uds</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-center text-gray-500 dark:text-text-dark">No hay ventas de unidades en este período.</p>
                                )}
                            </div>
                        )}
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
                                    {cashBreakdown.incomeAdjustments.map(adj => (
                                        <div key={adj.id} className="flex justify-between text-green-500" title={adj.description}>
                                            <span className="truncate pr-2">{adj.description || 'Ingreso'}</span>
                                            <span>+{formatCOP(adj.adjustmentAmount || 0)}</span>
                                        </div>
                                    ))}
                                    {cashBreakdown.expenseAdjustments.map(adj => (
                                        <div key={adj.id} className="flex justify-between text-red-500" title={adj.description}>
                                            <span className="truncate pr-2">{adj.description || 'Gasto'}</span>
                                            <span>-{formatCOP(adj.adjustmentAmount || 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {totalRecaudos > 0 && (
                            <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-md text-left ring-2 ring-blue-500/50">
                                <p className="font-bold text-blue-800 dark:text-blue-300">Recaudos (Aparte)</p>
                                <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatCOP(totalRecaudos)}</p>
                            </div>
                        )}
                        {Object.entries(detailedReportData.totalsByMethod)
                            .filter(([method]) => method !== 'Efectivo' && method !== 'Recaudo Sistecredito')
                            .map(([method, total]) => {
                                const commission = detailedReportData.commissionsByMethod[method];
                                return (
                                <button key={method} onClick={() => setPaymentMethodFilter(paymentMethodFilter === method ? null : method)} className={`bg-white dark:bg-gray-900/50 p-3 rounded-md text-left transition-all duration-200 ${paymentMethodFilter === method ? 'ring-2 ring-accent shadow-lg' : 'hover:shadow-md'}`}>
                                    <p className="font-bold text-gray-800 dark:text-text-light">{method}</p>
                                    <p className="text-xl font-extrabold text-accent">{formatCOP(Number(total) || 0)}</p>
                                    {commission > 0 && (
                                        <p className="text-xs font-semibold text-red-500 mt-1">-{formatCOP(Number(commission))}</p>
                                    )}
                                </button>
                            )})
                        }
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-text-light">
                            Desglose de Transacciones
                            {paymentMethodFilter && <span className="text-base font-normal text-gray-500 dark:text-text-dark"> (Filtrado por: {paymentMethodFilter})</span>}
                        </h3>
                        {paymentMethodFilter && <button onClick={() => setPaymentMethodFilter(null)} className="flex items-center text-sm text-accent hover:underline"><CrossIcon className="w-4 h-4 mr-1"/>Limpiar Filtro</button>}
                    </div>
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                                <tr>
                                    <th className="p-2 font-semibold">Fecha</th>
                                    <th className="p-2 font-semibold">Tipo</th>
                                    <th className="p-2 font-semibold">Factura #</th>
                                    <th className="p-2 font-semibold">Cliente</th>
                                    <th className="p-2 font-semibold">Detalles</th>
                                    <th className="p-2 font-semibold">Vendedor</th>
                                    <th className="p-2 font-semibold">Medio de Pago</th>
                                    <th className="p-2 font-semibold text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {detailedReportData.filteredTransactions.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="p-2 whitespace-nowrap">{new Date(t.date).toLocaleString()}</td>
                                        <td className="p-2"><span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-accent/20 text-accent">{t.type}</span></td>
                                        <td className="p-2 font-mono">{t.invoiceNumber}</td>
                                        <td className="p-2">{t.customer}</td>
                                        <td className="p-2 text-xs max-w-xs truncate" title={t.details}>{t.details}</td>
                                        <td className="p-2">{t.seller}</td>
                                        <td className="p-2">{t.paymentMethod}</td>
                                        <td className="p-2 text-right font-bold text-accent">{formatCOP(t.amount)}</td>
                                    </tr>
                                ))}
                                {detailedReportData.filteredTransactions.length === 0 && (
                                    <tr><td colSpan={8} className="p-4 text-center text-gray-500">No hay transacciones para mostrar.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>

      <div id="sales-history" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <div onClick={() => setIsSalesHistoryVisible(!isSalesHistoryVisible)} className="cursor-pointer flex justify-between items-center">
            <h2 className="text-2xl font-bold text-accent">Historial y Gestión de Ventas</h2>
            <ChevronDownIcon className={`w-6 h-6 transition-transform ${isSalesHistoryVisible ? 'rotate-180' : ''}`} />
        </div>
        {isSalesHistoryVisible && (
            <div className="mt-4 pt-4 border-t-2 border-accent/30 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="relative md:col-span-1">
                    <input type="text" placeholder="Buscar por # Factura, cliente, etc..." value={salesSearchTerm} onChange={e => setSalesSearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none" />
                    <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400"><SearchIcon /></div>
                    {salesSearchTerm && (<button onClick={() => setSalesSearchTerm('')} className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white" aria-label="Limpiar búsqueda"><CrossIcon className="w-5 h-5" /></button>)}
                  </div>
                  <select value={salesSellerFilter} onChange={e => setSalesSellerFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"><option value="">Todos los vendedores</option>{sellers.map(seller => (<option key={seller.id} value={seller.name}>{seller.name}</option>))}</select>
                  <select value={salesCategoryFilter} onChange={e => setSalesCategoryFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"><option value="">Todas las categorías</option>{props.categories.map(category => (<option key={category.id} value={category.id}>{category.name}</option>))}</select>
                </div>
                {managedSales.length === 0 ? <p className="text-center text-gray-500 dark:text-text-dark py-8">No se encontraron ventas con los filtros aplicados.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-gray-800"><tr>
                            <th className="p-3 text-sm font-semibold tracking-wide">Factura</th><th className="p-3 text-sm font-semibold tracking-wide">Fecha</th><th className="p-3 text-sm font-semibold tracking-wide">Cliente</th><th className="p-3 text-sm font-semibold tracking-wide text-center">Items</th><th className="p-3 text-sm font-semibold tracking-wide text-right">Total Venta</th><th className="p-3 text-sm font-semibold tracking-wide text-right">Ganancia</th><th className="p-3 text-sm font-semibold tracking-wide">Medio de Pago</th><th className="p-3 text-sm font-semibold tracking-wide">Vendedor</th><th className="p-3 text-sm font-semibold tracking-wide text-center">Acciones</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {managedSales.map((transaction) => {
                            const profit = calculateSaleProfit(transaction);
                            const profitColor = profit >= 0 ? 'text-green-500' : 'text-red-500';
                            const isExpanded = expandedSaleId === transaction.id;
                            const itemsArray: CartItem[] = (Array.isArray(transaction.items) ? transaction.items : Object.values(transaction.items || {})).filter(Boolean) as CartItem[];
                            return (<React.Fragment key={transaction.id}>
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => setExpandedSaleId(isExpanded ? null : transaction.id)}>
                                <td className="p-3 font-mono text-accent"><div className="flex items-center space-x-2"><ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /><span>#{transaction.invoiceNumber}</span>{ (transaction.layawayId || transaction.transactionType === 'layaway') && (<span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/80 text-white">ABONO</span>)}</div></td>
                                <td className="p-3 text-sm whitespace-nowrap">{new Date(transaction.createdAt).toLocaleString()}</td>
                                <td className="p-3"><div>{transaction.customerName}</div><div className="text-xs text-gray-500 dark:text-text-dark">{transaction.customerPhone}</div></td>
                                <td className="p-3 text-center">{itemsArray.reduce((acc, item) => acc + (item?.quantity || 0), 0)}</td>
                                <td className="p-3 text-right font-semibold text-accent">{formatCOP(transaction.totalAmount)}</td>
                                <td className={`p-3 text-right font-bold ${profitColor}`}>{formatCOP(profit)}</td>
                                <td className="p-3">{renderPaymentMethods(transaction)}</td>
                                <td className="p-3">{transaction.seller}</td>
                                <td className="p-3 text-center"><div className="flex justify-center items-center space-x-1">
                                    <button onClick={(e) => { e.stopPropagation(); if(transaction.transactionType === 'sale') onReprintSale(transaction as Sale); }} disabled={transaction.transactionType !== 'sale'} className="text-gray-500 dark:text-text-dark hover:text-blue-500 p-2 rounded-full hover:bg-blue-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={transaction.transactionType === 'sale' ? 'Reimprimir Factura' : 'No se puede reimprimir un abono desde aquí'}><PrintIcon className="w-5 h-5" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setEditingSale(transaction as Sale); }} className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={transaction.layawayId || transaction.transactionType === 'layaway' ? "Editar desde la pestaña Abonos" : "Editar Venta"} disabled={!!transaction.layawayId || transaction.transactionType === 'layaway'}><EditIcon className="w-5 h-5" /></button>
                                    {isAdmin && (<button onClick={(e) => { e.stopPropagation(); if(transaction.transactionType === 'sale') onDeleteSale(transaction.id); }} disabled={transaction.transactionType !== 'sale'} className="text-gray-500 dark:text-text-dark hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={transaction.transactionType !== 'sale' ? 'Eliminar desde la pestaña Abonos' : 'Eliminar Venta'}><TrashIcon className="w-5 h-5" /></button>)}
                                </div></td>
                            </tr>
                            {isExpanded && (<tr className="bg-gray-100/50 dark:bg-gray-800/50"><td colSpan={9} className="p-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><h4 className="font-bold text-accent mb-2">Productos</h4><table className="w-full text-sm"><thead className="border-b dark:border-gray-600"><tr><th className="text-left pb-1 font-semibold">Nombre</th><th className="text-center pb-1 font-semibold">Cant.</th><th className="text-right pb-1 font-semibold">P. Unit</th><th className="text-right pb-1 font-semibold">Subtotal</th></tr></thead><tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">{itemsArray.map((item: CartItem, index) => item && (<tr key={index}><td className="py-1">{item.name}</td><td className="text-center py-1">{item.quantity}</td><td className="text-right py-1">{formatCOP(item.price)}</td><td className="text-right py-1 font-semibold">{formatCOP(item.price * item.quantity)}</td></tr>))}</tbody></table></div>
                                <div><h4 className="font-bold text-accent mb-2">Detalles de Pago</h4><div className="bg-white dark:bg-secondary p-3 rounded-md space-y-2 text-sm">
                                    {transaction.payments ? transaction.payments.map((p, index) => (<div key={index} className="flex justify-between"><span>{p.method}:</span><span className="font-bold">{formatCOP(p.amount)}</span></div>)) : ('paymentMethod' in transaction && transaction.paymentMethod) ? (<div className="flex justify-between"><span>Método de Pago:</span><span className="font-bold">{transaction.paymentMethod}</span></div>) : null}
                                    <div className="flex justify-between font-bold pt-2 border-t border-dashed"><span>Total Pagado:</span><span>{formatCOP(transaction.payments ? transaction.payments.reduce((sum,p) => sum + p.amount, 0) : transaction.totalAmount)}</span></div>
                                    <div className="flex justify-between"><span>Ganancia:</span><span className={`font-bold ${profitColor}`}>{formatCOP(profit)}</span></div>
                                </div></div>
                            </div></td></tr>)}
                        </React.Fragment>);})}</tbody>
                    </table></div>
                )}
            </div>
        )}
      </div>

       <div id="price-variation" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg mt-8">
        <div onClick={() => setIsPriceAnalysisVisible(!isPriceAnalysisVisible)} className="cursor-pointer flex justify-between items-center">
            <h2 className="text-2xl font-bold text-accent">Análisis de Variación de Precios</h2>
            <ChevronDownIcon className={`w-6 h-6 transition-transform ${isPriceAnalysisVisible ? 'rotate-180' : ''}`} />
        </div>
        {isPriceAnalysisVisible && (
            <div className="mt-4 pt-4 border-t-2 border-accent/30 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-100 dark:bg-green-900/50 p-4 rounded-lg text-center">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-300">Cobros por Encima del Precio</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCOP(priceVariationReportData.summary.totalMarkup)}</p>
                    </div>
                    <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-lg text-center">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Descuentos Aplicados</p>
                        <p className="text-2xl font-bold text-red-500">{formatCOP(priceVariationReportData.summary.totalDiscount)}</p>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-lg text-center">
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Diferencia Neta</p>
                        <p className={`text-2xl font-bold ${priceVariationReportData.summary.netDifference >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>{formatCOP(priceVariationReportData.summary.netDifference)}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-4">
                    <select value={priceVariationSellerFilter} onChange={e => setPriceVariationSellerFilter(e.target.value)} className="bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none">
                        <option value="">Todos los Vendedores</option>
                        {sellers.map(seller => <option key={seller.id} value={seller.name}>{seller.name}</option>)}
                    </select>
                    <select value={priceVariationPaymentMethodFilter} onChange={e => setPriceVariationPaymentMethodFilter(e.target.value)} className="bg-gray-100 dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none">
                        <option value="">Todos los Métodos de Pago</option>
                        {Object.values(PaymentMethod).map(method => <option key={method} value={method}>{method}</option>)}
                    </select>
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                            <tr>
                                <th className="p-2 font-semibold">Fecha</th>
                                <th className="p-2 font-semibold">Producto</th>
                                <th className="p-2 font-semibold text-right">Precio Venta</th>
                                <th className="p-2 font-semibold text-right">Precio Actual</th>
                                <th className="p-2 font-semibold text-right">Variación</th>
                                <th className="p-2 font-semibold text-center">Cant.</th>
                                <th className="p-2 font-semibold text-right">Variación Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {priceVariationReportData.items.map(item => (
                                <tr key={item.id} className={`${item.status === 'markup' ? 'bg-green-500/5' : item.status === 'discount' ? 'bg-red-500/5' : ''}`}>
                                    <td className="p-2 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</td>
                                    <td className="p-2 font-semibold">{item.productName}</td>
                                    <td className="p-2 text-right">{formatCOP(item.soldPrice)}</td>
                                    <td className="p-2 text-right text-gray-500">{formatCOP(item.currentPrice)}</td>
                                    <td className={`p-2 text-right font-bold ${item.variation > 0 ? 'text-green-500' : item.variation < 0 ? 'text-red-500' : ''}`}>{formatCOP(item.variation)}</td>
                                    <td className="p-2 text-center">{item.quantity}</td>
                                    <td className={`p-2 text-right font-bold ${item.totalVariation > 0 ? 'text-green-500' : item.totalVariation < 0 ? 'text-red-500' : ''}`}>{formatCOP(item.totalVariation)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {priceVariationReportData.items.length === 0 && <p className="text-center text-gray-500 py-4">No hay variaciones de precio para mostrar.</p>}
                </div>
            </div>
        )}
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-accent mb-4">Ventas por Categoría</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {categoryReport.length > 0 ? categoryReport.map(cat => (
                        <div key={cat.categoryId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div>
                                <p className="font-bold text-gray-800 dark:text-text-light">{cat.categoryName}</p>
                                <p className="text-xs text-gray-500 dark:text-text-dark">{cat.totalUnits} unidades vendidas</p>
                            </div>
                            <p className="text-lg font-bold text-accent">{formatCOP(cat.totalSales)}</p>
                        </div>
                    )) : <p className="text-center text-gray-500 dark:text-text-dark">No hay datos de ventas para este periodo.</p>}
                </div>
            </div>

            <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-accent mb-4">Top 10 Productos Más Vendidos</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {topProductsReport.length > 0 ? topProductsReport.map((prod, index) => (
                        <div key={prod.productId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <span className="font-bold text-lg text-gray-400 dark:text-gray-500 w-6 text-center">{index + 1}.</span>
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-text-light">{prod.productName}</p>
                                    <p className="text-xs text-gray-500 dark:text-text-dark">{formatCOP(prod.totalSales)} en ventas</p>
                                </div>
                            </div>
                            <p className="text-lg font-bold text-accent">{prod.totalUnits} <span className="text-sm font-normal">uds</span></p>
                        </div>
                    )) : <p className="text-center text-gray-500 dark:text-text-dark">No hay datos de ventas para este periodo.</p>}
                </div>
            </div>
        </div>

        <div id="sales-chart" className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-accent">Análisis de Ventas a lo Largo del Tiempo</h2>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <button onClick={() => setChartViewMode('daily')} className={`px-3 py-1 text-sm rounded-full font-semibold ${chartViewMode === 'daily' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Diario</button>
              <button onClick={() => setChartViewMode('monthly')} className={`px-3 py-1 text-sm rounded-full font-semibold ${chartViewMode === 'monthly' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Mensual</button>
              <button onClick={() => setChartViewMode('all-months')} className={`px-3 py-1 text-sm rounded-full font-semibold ${chartViewMode === 'all-months' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Todos los Meses</button>
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
