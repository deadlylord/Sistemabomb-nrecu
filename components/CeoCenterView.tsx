import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sale, Layaway, Product, Purchase, Expense, Store, Seller, CeoDailyNote, View, Category
} from '../types';
import { 
  getCeoCenterChatResponse, generateProactiveCeoInsights 
} from '../services/geminiService';
import { 
  SparklesIcon, ChartPieIcon, AlertTriangleIcon, CheckIcon, TrashIcon,
  PlusIcon, ChevronDownIcon, SearchIcon, ClipboardListIcon, TagIcon,
  UsersIcon, BuildingStorefrontIcon, DollarIcon, SwapIcon
} from './Icons';
import { formatCOP } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

interface CeoCenterViewProps {
  sales: Sale[];
  layaways: Layaway[];
  inventory: Product[];
  purchases: Purchase[];
  expenses: Expense[];
  stores: Store[];
  sellers: Seller[];
  ceoNotes: CeoDailyNote[];
  currentUser: Seller;
  onAddCeoNote: (data: Omit<CeoDailyNote, 'id' | 'createdAt'>) => Promise<void>;
  onNavigate: (view: View) => void;
  categories?: Category[];
}

type SubTab = 'consolidated' | 'product_performance' | 'slow' | 'store_info' | 'ai';

export const CeoCenterView: React.FC<CeoCenterViewProps> = ({
  sales,
  layaways,
  inventory,
  purchases,
  expenses,
  stores,
  sellers,
  ceoNotes,
  currentUser,
  onAddCeoNote,
  onNavigate,
  categories = []
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('consolidated');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  
  // Product Performance state
  const [productPerfFilter, setProductPerfFilter] = useState<'all' | 'trends' | 'restock' | 'stagnant' | 'negative'>('all');
  const [productPerfSearch, setProductPerfSearch] = useState('');
  const [compareSku, setCompareSku] = useState<string>('');
  const [compareProductName, setCompareProductName] = useState<string>('');

  // Street IA Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [proactiveInsights, setProactiveInsights] = useState<string>('');
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Exclude training stores
  const nonTrainingStores = useMemo(() => stores.filter(s => !s.name.toLowerCase().includes('training')), [stores]);
  const nonTrainingStoreIds = useMemo(() => nonTrainingStores.map(s => s.id), [nonTrainingStores]);

  // Filter helper based on date range
  const isWithinTimeRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (timeRange === 'today') {
      return date >= startOfToday;
    } else if (timeRange === 'week') {
      const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= startOfWeek;
    } else if (timeRange === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= startOfMonth;
    } else {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return date >= startOfYear;
    }
  };

  // Filter metrics (Excluding Training Store)
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesStore = selectedStoreId === 'all' ? nonTrainingStoreIds.includes(s.storeId) : s.storeId === selectedStoreId;
      const matchesTime = isWithinTimeRange(s.createdAt);
      return matchesStore && matchesTime;
    });
  }, [sales, selectedStoreId, timeRange, nonTrainingStoreIds]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchesStore = selectedStoreId === 'all' ? nonTrainingStoreIds.includes(p.storeId) : p.storeId === selectedStoreId;
      const matchesTime = isWithinTimeRange(p.createdAt);
      return matchesStore && matchesTime;
    });
  }, [purchases, selectedStoreId, timeRange, nonTrainingStoreIds]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesStore = selectedStoreId === 'all' ? nonTrainingStoreIds.includes(e.storeId) : e.storeId === selectedStoreId;
      const matchesTime = isWithinTimeRange(e.date);
      return matchesStore && matchesTime;
    });
  }, [expenses, selectedStoreId, timeRange, nonTrainingStoreIds]);

  const filteredLayaways = useMemo(() => {
    return layaways.filter(l => {
      const matchesStore = selectedStoreId === 'all' ? nonTrainingStoreIds.includes(l.storeId) : l.storeId === selectedStoreId;
      return matchesStore;
    });
  }, [layaways, selectedStoreId, nonTrainingStoreIds]);

  const filteredCeoNotes = useMemo(() => {
    return ceoNotes.filter(n => {
      const matchesStore = selectedStoreId === 'all' ? nonTrainingStoreIds.includes(n.tienda) : n.tienda === selectedStoreId;
      const matchesTime = isWithinTimeRange(n.createdAt);
      return matchesStore && matchesTime;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ceoNotes, selectedStoreId, timeRange, nonTrainingStoreIds]);

  // Consolidated KPIs
  const totalSalesAmount = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  }, [filteredSales]);

  const totalCOGS = useMemo(() => {
    return filteredSales.reduce((sum, s) => {
      return sum + s.items.reduce((iSum, item) => iSum + ((item.cost || 0) * (item.quantity || 0)), 0);
    }, 0);
  }, [filteredSales]);

  const totalPurchasesAmount = useMemo(() => {
    return filteredPurchases.reduce((sum, p) => sum + p.totalCost, 0);
  }, [filteredPurchases]);

  const totalExpensesAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const netProfit = totalSalesAmount - totalCOGS - totalExpensesAmount;

  // Store-wise performance
  const storePerformance = useMemo(() => {
    return nonTrainingStores.map(store => {
      const storeS = sales.filter(s => s.storeId === store.id && isWithinTimeRange(s.createdAt));
      const storeCOGS = storeS.reduce((sum, s) => {
        return sum + s.items.reduce((iSum, item) => iSum + ((item.cost || 0) * (item.quantity || 0)), 0);
      }, 0);
      const storeSalesAmt = storeS.reduce((sum, s) => sum + s.totalAmount, 0);
      const storeExpAmt = expenses.filter(e => e.storeId === store.id && isWithinTimeRange(e.date)).reduce((sum, e) => sum + e.amount, 0);
      
      return {
        id: store.id,
        name: store.name,
        sales: storeSalesAmt,
        expenses: storeExpAmt,
        profit: storeSalesAmt - storeCOGS - storeExpAmt,
        color: store.accentColor
      };
    });
  }, [nonTrainingStores, sales, expenses, timeRange]);

  // ALERTS (Stock / Inconsistencies for legacy/AI queries)
  const inventoryAlerts = useMemo(() => {
    const items = inventory.filter(p => selectedStoreId === 'all' ? nonTrainingStoreIds.includes(p.storeId) : p.storeId === selectedStoreId);
    
    const lowStock = items.filter(p => !p.isDisabled && p.stock <= 3 && p.stock >= 0);
    const negativeStock = items.filter(p => !p.isDisabled && p.stock < 0);
    const deadStock = items.filter(p => p.stock > 0 && !p.isDisabled).filter(p => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const hasSales = sales.some(s => s.storeId === p.storeId && s.items.some(item => item.id === p.id) && new Date(s.createdAt) >= thirtyDaysAgo);
      return !hasSales;
    });

    return { lowStock, negativeStock, deadStock };
  }, [inventory, selectedStoreId, sales, nonTrainingStoreIds]);

  // PRODUCT STARS (for legacy/AI queries)
  const starProducts = useMemo(() => {
    const salesMap: Record<string, { product: Product; qty: number; totalRev: number; stores: Record<string, number> }> = {};
    
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!salesMap[item.id]) {
          const orig = inventory.find(p => p.id === item.id) || item;
          salesMap[item.id] = {
            product: orig as Product,
            qty: 0,
            totalRev: 0,
            stores: {}
          };
        }
        salesMap[item.id].qty += item.quantity;
        salesMap[item.id].totalRev += (item.price * item.quantity);
        salesMap[item.id].stores[sale.storeId] = (salesMap[item.id].stores[sale.storeId] || 0) + item.quantity;
      });
    });

    return Object.values(salesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [filteredSales, inventory]);

  // GROUPED PRODUCT PERFORMANCE & CROSS-STORE COMPARISON
  const groupedProductPerformance = useMemo(() => {
    const map: Record<string, { 
      sku: string; 
      name: string; 
      categoryName: string;
      totalStock: number; 
      price: number; 
      cost: number;
      qtySold: number; 
      revenue: number;
      storesBreakdown: Record<string, { stock: number; qtySold: number }>
    }> = {};

    inventory.forEach(p => {
      const store = stores.find(s => s.id === p.storeId);
      if (!store || store.name.toLowerCase().includes('training')) return;

      const key = p.sku || p.name;
      if (!map[key]) {
        const cat = categories.find(c => c.id === p.categoryId);
        map[key] = {
          sku: p.sku || 'N/A',
          name: p.name,
          categoryName: cat ? cat.name : 'Sin categoría',
          totalStock: 0,
          price: p.price,
          cost: p.cost,
          qtySold: 0,
          revenue: 0,
          storesBreakdown: {}
        };
      }
      map[key].totalStock += p.stock;
      map[key].storesBreakdown[p.storeId] = {
        stock: p.stock,
        qtySold: 0
      };
    });

    filteredSales.forEach(sale => {
      const store = stores.find(s => s.id === sale.storeId);
      if (!store || store.name.toLowerCase().includes('training')) return;

      sale.items.forEach(item => {
        const origProd = inventory.find(p => p.id === item.id);
        const key = origProd ? (origProd.sku || origProd.name) : item.id;
        
        if (map[key]) {
          map[key].qtySold += item.quantity;
          map[key].revenue += item.price * item.quantity;
          if (map[key].storesBreakdown[sale.storeId]) {
            map[key].storesBreakdown[sale.storeId].qtySold += item.quantity;
          } else {
            map[key].storesBreakdown[sale.storeId] = {
              stock: 0,
              qtySold: item.quantity
            };
          }
        } else {
          const matchedProd = inventory.find(p => p.sku === (origProd?.sku || item.sku));
          const cat = matchedProd ? categories.find(c => c.id === matchedProd.categoryId) : null;
          map[key] = {
            sku: origProd?.sku || item.sku || 'N/A',
            name: item.name || 'Producto Desconocido',
            categoryName: cat ? cat.name : 'Otros',
            totalStock: 0,
            price: item.price,
            cost: item.cost || 0,
            qtySold: item.quantity,
            revenue: item.price * item.quantity,
            storesBreakdown: {
              [sale.storeId]: { stock: 0, qtySold: item.quantity }
            }
          };
        }
      });
    });

    return Object.values(map);
  }, [inventory, filteredSales, stores, categories]);

  const filteredGroupedPerformance = useMemo(() => {
    let list = groupedProductPerformance;

    // Sede filter
    if (selectedStoreId !== 'all') {
      list = list.filter(item => {
        const b = item.storesBreakdown[selectedStoreId];
        return b && (b.stock !== 0 || b.qtySold > 0);
      });
    }

    // Search filter
    if (productPerfSearch.trim()) {
      const q = productPerfSearch.toLowerCase().trim();
      list = list.filter(item => (item.name || '').toLowerCase().includes(q) || (item.sku || '').toLowerCase().includes(q));
    }

    // Performance filter
    if (productPerfFilter === 'trends') {
      list = list.filter(item => item.qtySold > 0).sort((a, b) => b.qtySold - a.qtySold);
    } else if (productPerfFilter === 'restock') {
      list = list.filter(item => {
        const stock = selectedStoreId === 'all' ? item.totalStock : (item.storesBreakdown[selectedStoreId]?.stock || 0);
        const sold = selectedStoreId === 'all' ? item.qtySold : (item.storesBreakdown[selectedStoreId]?.qtySold || 0);
        return stock <= 3 && sold > 0;
      });
    } else if (productPerfFilter === 'stagnant') {
      list = list.filter(item => {
        const stock = selectedStoreId === 'all' ? item.totalStock : (item.storesBreakdown[selectedStoreId]?.stock || 0);
        const sold = selectedStoreId === 'all' ? item.qtySold : (item.storesBreakdown[selectedStoreId]?.qtySold || 0);
        return stock > 5 && sold === 0;
      });
    } else if (productPerfFilter === 'negative') {
      list = list.filter(item => {
        const stock = selectedStoreId === 'all' ? item.totalStock : (item.storesBreakdown[selectedStoreId]?.stock || 0);
        return stock < 0;
      });
    } else {
      list = [...list].sort((a, b) => b.qtySold - a.qtySold);
    }

    return list;
  }, [groupedProductPerformance, selectedStoreId, productPerfSearch, productPerfFilter]);

  const siblingComparisonData = useMemo(() => {
    if (!compareSku && !compareProductName) return null;
    
    return nonTrainingStores.map(store => {
      const storeProd = inventory.find(p => p.storeId === store.id && (p.sku === compareSku || p.name === compareProductName));
      
      const prodSales = sales.filter(s => s.storeId === store.id && isWithinTimeRange(s.createdAt));
      let qtySold = 0;
      let rev = 0;

      if (storeProd) {
        prodSales.forEach(sale => {
          const item = sale.items.find(i => i.id === storeProd.id);
          if (item) {
            qtySold += item.quantity;
            rev += item.price * item.quantity;
          }
        });
      }

      return {
        storeId: store.id,
        storeName: store.name,
        color: store.accentColor,
        exists: !!storeProd,
        stock: storeProd ? storeProd.stock : 0,
        price: storeProd ? storeProd.price : 0,
        qtySold,
        rev,
        sku: storeProd ? storeProd.sku : 'N/A'
      };
    });
  }, [compareSku, compareProductName, inventory, sales, nonTrainingStores, timeRange]);

  const selectedProductPerf = useMemo(() => {
    if (!compareSku && !compareProductName) return null;

    const targetStoreIds = selectedStoreId === 'all' ? nonTrainingStoreIds : [selectedStoreId];

    const productSalesAllTime = sales.filter(sale => {
      return targetStoreIds.includes(sale.storeId) && sale.items.some(item => {
        const origProd = inventory.find(p => p.id === item.id);
        return origProd ? (origProd.sku === compareSku || origProd.name === compareProductName) : (item.id === compareSku || item.name === compareProductName);
      });
    });

    let totalUnitsSold = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let lastSaleDate: string | null = null;

    productSalesAllTime.forEach(sale => {
      sale.items.forEach(item => {
        const origProd = inventory.find(p => p.id === item.id);
        const matches = origProd ? (origProd.sku === compareSku || origProd.name === compareProductName) : (item.id === compareSku || item.name === compareProductName);
        if (matches) {
          totalUnitsSold += item.quantity;
          totalRevenue += item.price * item.quantity;
          totalProfit += (item.price - (item.cost || 0)) * item.quantity;
          
          if (!lastSaleDate || new Date(sale.createdAt) > new Date(lastSaleDate)) {
            lastSaleDate = sale.createdAt;
          }
        }
      });
    });

    const productPurchases = purchases.filter(p => {
      const origProd = inventory.find(inv => inv.id === p.productId);
      const matches = origProd ? (origProd.sku === compareSku || origProd.name === compareProductName) : false;
      return matches && targetStoreIds.includes(p.storeId);
    });

    let lastPurchaseDate: string | null = null;
    productPurchases.forEach(p => {
      if (!lastPurchaseDate || new Date(p.createdAt) > new Date(lastPurchaseDate)) {
        lastPurchaseDate = p.createdAt;
      }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUnitsSold = productSalesAllTime
      .filter(sale => new Date(sale.createdAt) >= thirtyDaysAgo)
      .reduce((acc, sale) => {
        const matchingItems = sale.items.filter(item => {
          const origProd = inventory.find(p => p.id === item.id);
          return origProd ? (origProd.sku === compareSku || origProd.name === compareProductName) : (item.id === compareSku || item.name === compareProductName);
        });
        return acc + matchingItems.reduce((sum, item) => sum + item.quantity, 0);
      }, 0);

    const monthlyData: { month: string; units: number; revenue: number; [storeId: string]: any }[] = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.getMonth();
      const year = d.getFullYear();
      const monthLabel = `${monthNames[month]} ${year.toString().slice(-2)}`;
      
      const monthSales = productSalesAllTime.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return saleDate.getMonth() === month && saleDate.getFullYear() === year;
      });
      
      const units = monthSales.reduce((acc, sale) => {
        const matchingItems = sale.items.filter(item => {
          const origProd = inventory.find(p => p.id === item.id);
          return origProd ? (origProd.sku === compareSku || origProd.name === compareProductName) : (item.id === compareSku || item.name === compareProductName);
        });
        return acc + matchingItems.reduce((sum, item) => sum + item.quantity, 0);
      }, 0);

      const revenue = monthSales.reduce((acc, sale) => {
        const matchingItems = sale.items.filter(item => {
          const origProd = inventory.find(p => p.id === item.id);
          return origProd ? (origProd.sku === compareSku || origProd.name === compareProductName) : (item.id === compareSku || item.name === compareProductName);
        });
        return acc + matchingItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      }, 0);
      
      // Calculate breakdown per store
      const storeBreakdown: Record<string, number> = {};
      nonTrainingStores.forEach(store => {
        const storeMonthSales = monthSales.filter(sale => sale.storeId === store.id);
        const storeUnits = storeMonthSales.reduce((acc, sale) => {
          const matchingItems = sale.items.filter(item => {
            const origProd = inventory.find(p => p.id === item.id);
            return origProd ? (origProd.sku === compareSku || origProd.name === compareProductName) : (item.id === compareSku || item.name === compareProductName);
          });
          return acc + matchingItems.reduce((sum, item) => sum + item.quantity, 0);
        }, 0);
        storeBreakdown[store.id] = storeUnits;
      });
      
      monthlyData.push({ month: monthLabel, units, revenue, ...storeBreakdown });
    }

    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const aggregateStock = inventory
      .filter(p => targetStoreIds.includes(p.storeId) && (p.sku === compareSku || p.name === compareProductName))
      .reduce((sum, p) => sum + p.stock, 0);

    let supplyRec = {
      type: 'healthy',
      title: '✅ Inventario Saludable',
      message: `El nivel de existencias es saludable en relación con la demanda de los últimos 30 días (has vendido ${recentUnitsSold} unidades en total y te quedan ${aggregateStock}).`,
      color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
    };

    if (recentUnitsSold > 0 && aggregateStock < recentUnitsSold) {
      const recommendedQty = Math.max(Math.round(recentUnitsSold * 2 - aggregateStock), 5);
      supplyRec = {
        type: 'warning',
        title: '🚨 Reabastecimiento Urgente',
        message: `Quedan solo ${aggregateStock} unidades en stock y has vendido ${recentUnitsSold} en los últimos 30 días. Te recomendamos pedir un lote de ${recommendedQty} unidades.`,
        color: 'bg-rose-500/10 border-rose-500/20 text-rose-300'
      };
    } else if (recentUnitsSold === 0 && aggregateStock > 5) {
      supplyRec = {
        type: 'overstock',
        title: '⚠️ Exceso de Existencias / Estancado',
        message: `Este producto no ha registrado ventas en los últimos 30 días y tienes un inventario de ${aggregateStock} unidades. Te sugerimos activar una promoción de descuento.`,
        color: 'bg-amber-500/10 border-amber-500/20 text-amber-300'
      };
    }

    return {
      totalUnitsSold,
      totalRevenue,
      totalProfit,
      lastSaleDate,
      lastPurchaseDate,
      recentUnitsSold,
      monthlyData,
      margin,
      aggregateStock,
      supplyRec
    };
  }, [compareSku, compareProductName, sales, inventory, purchases, selectedStoreId, nonTrainingStoreIds, stores, nonTrainingStores]);

  // ENERGY CORRELATION WITH ACTUAL SALES
  const energyCorrelation = useMemo(() => {
    const energySales: Record<'green' | 'yellow' | 'red', { totalSales: number; daysCount: number }> = {
      green: { totalSales: 0, daysCount: 0 },
      yellow: { totalSales: 0, daysCount: 0 },
      red: { totalSales: 0, daysCount: 0 }
    };

    const processedKeys = new Set<string>();

    filteredCeoNotes.forEach(note => {
      if (!note.energia) return;
      const key = `${note.tienda}_${note.fecha}`;
      if (processedKeys.has(key)) return;
      processedKeys.add(key);

      const daySales = sales.filter(s => s.storeId === note.tienda && s.createdAt.startsWith(note.fecha));
      const daySalesAmt = daySales.reduce((sum, s) => sum + s.totalAmount, 0);

      const energy = note.energia as 'green' | 'yellow' | 'red';
      if (energySales[energy]) {
        energySales[energy].totalSales += daySalesAmt;
        energySales[energy].daysCount += 1;
      }
    });

    return {
      green: energySales.green.daysCount > 0 ? energySales.green.totalSales / energySales.green.daysCount : 0,
      yellow: energySales.yellow.daysCount > 0 ? energySales.yellow.totalSales / energySales.yellow.daysCount : 0,
      red: energySales.red.daysCount > 0 ? energySales.red.totalSales / energySales.red.daysCount : 0,
      counts: {
        green: energySales.green.daysCount,
        yellow: energySales.yellow.daysCount,
        red: energySales.red.daysCount
      }
    };
  }, [filteredCeoNotes, sales]);

  // SLOW SELLING PRODUCTS (Sort deadstock or low rotation items)
  const slowProducts = useMemo(() => {
    const activeInv = inventory.filter(p => !p.isDisabled && (selectedStoreId === 'all' ? nonTrainingStoreIds.includes(p.storeId) : p.storeId === selectedStoreId));
    
    const productSalesMap: Record<string, number> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        productSalesMap[item.id] = (productSalesMap[item.id] || 0) + item.quantity;
      });
    });

    return activeInv
      .map(p => ({
        product: p,
        salesCount: productSalesMap[p.id] || 0,
        value: p.stock * p.cost
      }))
      .filter(item => item.product.stock > 0)
      .sort((a, b) => {
        if (a.salesCount !== b.salesCount) return a.salesCount - b.salesCount;
        return b.value - a.value; // Prefer higher value stuck in stock
      })
      .slice(0, 15);
  }, [inventory, filteredSales, selectedStoreId, nonTrainingStoreIds]);

  // Layaways overview
  const layawaysOverview = useMemo(() => {
    const active = filteredLayaways.filter(l => l.status === 'active' || l.status === 'pre-order');
    const totalPendingAmt = active.reduce((sum, l) => sum + (l.totalAmount - l.paidAmount), 0);
    const totalPaidAmt = active.reduce((sum, l) => sum + l.paidAmount, 0);

    return {
      active,
      totalPendingAmt,
      totalPaidAmt,
      debtors: active.map(l => ({
        id: l.id,
        customerName: l.customerName,
        customerPhone: l.customerPhone,
        total: l.totalAmount,
        pending: l.totalAmount - l.paidAmount,
        seller: l.seller,
        storeName: stores.find(s => s.id === l.storeId)?.name || 'Tienda',
        date: l.createdAt
      })).sort((a, b) => b.pending - a.pending)
    };
  }, [filteredLayaways, stores]);

  // Fetch AI Pro-active insights once data or store changes
  useEffect(() => {
    const fetchInsights = async () => {
      setIsInsightsLoading(true);
      try {
        const payload = {
          kpis: {
            ventas_totales: totalSalesAmount,
            costo_ventas: totalCOGS,
            compras: totalPurchasesAmount,
            gastos: totalExpensesAmount,
            utilidad_neta: netProfit
          },
          alertas_inventario: {
            bajo_stock: inventoryAlerts.lowStock.length,
            negativos: inventoryAlerts.negativeStock.length,
            stagnant: inventoryAlerts.deadStock.length
          },
          estrellas: starProducts.map(s => ({ name: s.product.name, qty: s.qty, total: s.totalRev })),
          abonos_pendientes: layawaysOverview.totalPendingAmt,
          notas_vendedoras: filteredCeoNotes.filter(n => n.energia || n.pregunta_cliente).slice(0, 5)
        };
        const insights = await generateProactiveCeoInsights(payload);
        setProactiveInsights(insights);
      } catch (err) {
        console.error("Error loading proactive insights:", err);
        setProactiveInsights("Asegúrate de registrar tus cuentas de gastos, ventas y energía hoy para que pueda darte sugerencias más profundas.");
      } finally {
        setIsInsightsLoading(false);
      }
    };

    fetchInsights();
  }, [selectedStoreId, timeRange, totalSalesAmount, inventoryAlerts.lowStock.length, filteredCeoNotes.length]);

  // Chat Submission handler
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsAiLoading(true);

    try {
      const payload = {
        tiendas: stores.map(s => ({ id: s.id, name: s.name })),
        ventas_totales: totalSalesAmount,
        compras_totales: totalPurchasesAmount,
        gastos_totales: totalExpensesAmount,
        utilidad_neta: netProfit,
        inventario_total_productos: inventory.length,
        alertas: {
          bajo_stock: inventoryAlerts.lowStock.map(p => ({ SKU: p.sku, nombre: p.name, stock: p.stock })),
          negativos: inventoryAlerts.negativeStock.map(p => ({ SKU: p.sku, nombre: p.name, stock: p.stock }))
        },
        estrellas: starProducts.slice(0, 5).map(s => ({ nombre: s.product.name, qty: s.qty })),
        abonos_pendientes: layawaysOverview.totalPendingAmt,
        notas_ceo_vendedoras: filteredCeoNotes.slice(0, 15)
      };

      const historyFormatted = chatMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      const reply = await getCeoCenterChatResponse(payload, historyFormatted, userMsg);
      setChatMessages(prev => [...prev, { role: 'model', content: reply }]);
    } catch (err) {
      console.error("Street IA error:", err);
      setChatMessages(prev => [...prev, { role: 'model', content: "Lo siento, tuve un problema analizando los balances de tus sedes en este momento. Revisa tu conexión." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Scroll to bottom on chat update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiLoading]);

  // Quick prompt chips helper
  const handleQuickPrompt = (prompt: string) => {
    setChatInput(prompt);
  };

  return (
    <div className="space-y-6">
      {/* CEO HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-[2rem] border border-indigo-500/20 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 text-indigo-400">
            <span className="text-2xl">💎</span>
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">CEO Center</h2>
            <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mt-1">
              Consolidación Estratégica de las Tres Sedes del Negocio
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap gap-2.5">
          <select 
            value={selectedStoreId} 
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl py-2 px-3.5 text-xs font-black uppercase tracking-wider outline-none cursor-pointer focus:ring-2 focus:ring-indigo-400"
          >
            <option value="all" className="bg-slate-900 text-white font-bold">Todas las Sedes</option>
            {nonTrainingStores.map(store => (
              <option key={store.id} value={store.id} className="bg-slate-900 text-white font-bold">{store.name}</option>
            ))}
          </select>

          <div className="flex bg-white/10 backdrop-blur-md border border-white/20 p-1 rounded-xl">
            {(['today', 'week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  timeRange === range 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range === 'today' ? 'Hoy' : range === 'week' ? '7D' : range === 'month' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TWO COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg">
          <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2 border-b dark:border-slate-800">
            Paneles de Decisión
          </p>
          <div className="space-y-1">
            {[
              { id: 'consolidated', label: 'Dashboard Consolidado', icon: ChartPieIcon, desc: 'Balance de tiendas' },
              { id: 'product_performance', label: 'Rendimiento de Productos', icon: ClipboardListIcon, desc: 'Tendencias, resurtir, sedes' },
              { id: 'slow', label: 'Ventas Lentas', icon: SwapIcon, desc: 'Capital de liquidación' },
              { id: 'store_info', label: 'Información de la Tienda', icon: UsersIcon, desc: 'Energía y dudas de clientes' },
              { id: 'ai', label: 'Consultor IA', icon: SparklesIcon, desc: 'Consultas en tiempo real', sparkle: true },
            ].map((subTab) => {
              const isActive = activeTab === subTab.id;
              const Icon = subTab.icon;
              return (
                <button
                  key={subTab.id}
                  onClick={() => setActiveTab(subTab.id as SubTab)}
                  className={`flex items-center gap-3.5 w-full p-3 rounded-2xl transition-all duration-200 text-left group relative
                    ${isActive 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15 scale-[1.02]' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className={`text-xs font-black leading-none ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{subTab.label}</p>
                    <p className={`text-[10px] mt-1 truncate ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>{subTab.desc}</p>
                  </div>
                  {subTab.sparkle && !isActive && (
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Panel Workspace */}
        <div className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              
              {/* PANTALLA 1: DASHBOARD CONSOLIDADO */}
              {activeTab === 'consolidated' && (
                <div className="space-y-6">
                  {/* Financial KPI Bento Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Ventas Totales</span>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3">{formatCOP(totalSalesAmount)}</h3>
                      <p className="text-[10px] text-slate-400 mt-2">Ingresos por ventas de ropa</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Costo Mercancía (COGS)</span>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3">{formatCOP(totalCOGS)}</h3>
                      <p className="text-[10px] text-slate-400 mt-2">Inversión en prendas vendidas</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Gastos Registrados</span>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3">{formatCOP(totalExpensesAmount)}</h3>
                      <p className="text-[10px] text-slate-400 mt-2">Costos fijos y variables</p>
                    </div>

                    <div className={`p-5 rounded-3xl border shadow-md flex flex-col justify-between ${
                      netProfit >= 0 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/20' 
                        : 'bg-red-50 dark:bg-red-950/20 border-red-500/20'
                    }`}>
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Utilidad Neta</span>
                      <h3 className={`text-2xl font-black mt-3 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCOP(netProfit)}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-2">Margen operativo real</p>
                    </div>
                  </div>

                  {/* Pro-active AI Advisor Banner */}
                  {proactiveInsights && (
                    <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 p-5 rounded-3xl text-white flex gap-4 items-start shadow-lg">
                      <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-xl flex-shrink-0">
                        <SparklesIcon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 flex-grow">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">IA CEO • Alerta Diaria</span>
                        <p className="text-xs text-indigo-100 font-medium leading-relaxed">{proactiveInsights}</p>
                      </div>
                    </div>
                  )}

                  {/* Store Comparison Visual Bars */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-5">Rendimiento por Sede</h4>
                    <div className="space-y-5">
                      {storePerformance.map(store => {
                        const maxSales = Math.max(...storePerformance.map(s => s.sales), 1);
                        const widthPct = Math.min((store.sales / maxSales) * 100, 100);
                        return (
                          <div key={store.id} className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: store.color }}></div>
                                {store.name}
                              </span>
                              <div className="space-x-3 text-[11px]">
                                <span className="text-slate-400">Ventas: <strong className="text-slate-800 dark:text-white">{formatCOP(store.sales)}</strong></span>
                                <span className="text-slate-400">Gastos: <strong className="text-red-500">{formatCOP(store.expenses)}</strong></span>
                                <span className={store.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                                  Utilidad: <strong>{formatCOP(store.profit)}</strong>
                                </span>
                              </div>
                            </div>
                            <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-500" 
                                style={{ width: `${widthPct}%`, backgroundColor: store.color }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* PANTALLA 2: RENDIMIENTO DE PRODUCTOS (NUEVO) */}
              {activeTab === 'product_performance' && (
                <div className="space-y-6">
                  {/* Sede Comparison Detail Card */}
                  {siblingComparisonData && (
                    <div className="bg-gradient-to-br from-indigo-900/90 to-slate-900 border border-indigo-500/30 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                      <div className="absolute top-4 right-4">
                        <button 
                          onClick={() => { setCompareSku(''); setCompareProductName(''); }}
                          className="bg-white/10 hover:bg-white/20 text-white rounded-full py-1.5 px-3 transition-all font-black text-[10px] uppercase"
                        >
                          ✕ Cerrar Comparativa
                        </button>
                      </div>
                      <div className="mb-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Comparación Multi-Sede</span>
                        <h3 className="text-xl font-black mt-1">
                          {compareProductName} {compareSku && <span className="font-mono text-sm text-indigo-400">({compareSku})</span>}
                        </h3>
                        <p className="text-xs text-indigo-200 mt-1">Desglose de existencias y rotación real en las tres sedes del negocio.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {siblingComparisonData.map(item => (
                          <div key={item.storeId} className="bg-black/30 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <h4 className="text-xs font-black uppercase tracking-wider">{item.storeName}</h4>
                              </div>

                              {!item.exists ? (
                                <p className="text-[10px] text-slate-400 font-bold italic py-4">No creado en esta sede</p>
                              ) : (
                                <div className="space-y-2.5 my-2">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Existencias:</span>
                                    <span className={`font-black ${item.stock < 0 ? 'text-red-400' : item.stock <= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                      {item.stock}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Precio:</span>
                                    <span className="font-bold">{formatCOP(item.price)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                                    <span className="text-slate-400">Vendidos {timeRange === 'today' ? 'hoy' : timeRange === 'week' ? 'esta semana' : timeRange === 'month' ? 'este mes' : 'este año'}:</span>
                                    <span className="font-black text-indigo-300">{item.qtySold}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Ingreso:</span>
                                    <span className="font-black text-emerald-400">{formatCOP(item.rev)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {item.exists && (
                              <div className="mt-4">
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full bg-indigo-500"
                                    style={{ width: `${Math.min((item.qtySold / Math.max(...siblingComparisonData.map(x => x.qtySold), 1)) * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* POS-Style Detailed Product Stats & Chart Integration */}
                      {selectedProductPerf && (
                        <div className="mt-8 pt-6 border-t border-white/10 space-y-6">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-300">Estadísticas Detalladas de Rendimiento (Histórico & Tendencias)</h4>
                            <p className="text-[10px] text-indigo-200/70 mt-1">Análisis profundo del comportamiento de este producto en el mercado.</p>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">U. Vendidas Global</p>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-black text-white">{selectedProductPerf.totalUnitsSold}</span>
                                <span className="text-[9px] font-bold text-indigo-300/60 uppercase">Histórico</span>
                              </div>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Ingresos Globales</p>
                              <span className="text-lg font-black text-white block truncate">{formatCOP(selectedProductPerf.totalRevenue)}</span>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Utilidad Estimada</p>
                              <span className="text-lg font-black text-emerald-400 block truncate">{formatCOP(selectedProductPerf.totalProfit)}</span>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Margen de Utilidad</p>
                              <span className="text-2xl font-black text-purple-300 block">{selectedProductPerf.margin.toFixed(1)}%</span>
                            </div>
                          </div>

                          {/* Supply Recommendation & Dates */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className={`md:col-span-2 p-5 rounded-2xl border ${selectedProductPerf.supplyRec.color} space-y-1`}>
                              <h5 className="text-[10px] font-black uppercase tracking-widest opacity-80">🤖 Asistente de Abastecimiento Inteligente</h5>
                              <h6 className="text-xs font-black uppercase tracking-wider">{selectedProductPerf.supplyRec.title}</h6>
                              <p className="text-xs leading-relaxed font-bold opacity-90">{selectedProductPerf.supplyRec.message}</p>
                            </div>

                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col justify-center space-y-3">
                              <div>
                                <p className="text-[9px] font-black text-indigo-300/60 uppercase tracking-widest">Última Venta Registrada</p>
                                <p className="text-xs font-black text-white mt-0.5">
                                  {selectedProductPerf.lastSaleDate ? new Date(selectedProductPerf.lastSaleDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin ventas'}
                                </p>
                              </div>
                              <div className="border-t border-white/5 pt-2">
                                <p className="text-[9px] font-black text-indigo-300/60 uppercase tracking-widest">Última Compra Registrada</p>
                                <p className="text-xs font-black text-white mt-0.5">
                                  {selectedProductPerf.lastPurchaseDate ? new Date(selectedProductPerf.lastPurchaseDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin compras'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Monthly Chart */}
                          <div className="bg-white/5 border border-white/5 p-6 rounded-3xl">
                            <div className="flex items-center gap-2 mb-4">
                              <span className="text-lg">📈</span>
                              <h4 className="text-xs font-black text-white uppercase tracking-widest">Ventas Mes a Mes por Sede (Unidades)</h4>
                            </div>
                            <div className="h-48 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={selectedProductPerf.monthlyData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                  <XAxis 
                                    dataKey="month" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: 'rgba(255,255,255,0.5)' }} 
                                  />
                                  <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: 'rgba(255,255,255,0.5)' }} 
                                  />
                                  <Tooltip 
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                    contentStyle={{ 
                                      backgroundColor: '#1e1b4b',
                                      borderRadius: '12px', 
                                      border: '1px solid rgba(255,255,255,0.1)', 
                                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                                      fontSize: '12px',
                                      fontWeight: 'bold',
                                      color: '#fff'
                                    }}
                                  />
                                  <Legend 
                                    verticalAlign="top" 
                                    height={36} 
                                    iconType="circle" 
                                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }} 
                                  />
                                  {nonTrainingStores.map((store) => (
                                    <Bar 
                                      key={store.id} 
                                      name={store.name} 
                                      dataKey={store.id} 
                                      fill={store.accentColor || '#6366f1'} 
                                      radius={[4, 4, 0, 0]} 
                                    />
                                  ))}
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Product Table & Filter Panel */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b dark:border-slate-800 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-white">Análisis de Rendimiento de Prendas</h4>
                          <p className="text-[10px] text-slate-400 mt-1">Busca, filtra por estados de rotación y compara el stock entre sedes.</p>
                        </div>
                        
                        {/* Search Bar */}
                        <div className="relative w-full md:w-64">
                          <input
                            type="text"
                            placeholder="Buscar por SKU o Nombre..."
                            value={productPerfSearch}
                            onChange={(e) => setProductPerfSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 pl-9 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                          />
                          <span className="absolute left-3 top-2 text-sm text-slate-400">🔍</span>
                        </div>
                      </div>

                      {/* Filter chips */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {[
                          { id: 'all', label: 'Todos' },
                          { id: 'trends', label: 'Tendencias (Con ventas)' },
                          { id: 'restock', label: 'Por Resurtir (Bajo stock)' },
                          { id: 'stagnant', label: 'Sin Rotación (Estancado)' },
                          { id: 'negative', label: 'Stock Negativo (Urgente)' },
                        ].map(chip => (
                          <button
                            key={chip.id}
                            onClick={() => setProductPerfFilter(chip.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                              productPerfFilter === chip.id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredGroupedPerformance.length === 0 ? (
                      <p className="p-8 text-slate-400 text-center text-xs font-bold">No se encontraron productos con los filtros seleccionados.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 text-slate-400 uppercase tracking-widest font-black text-[9px]">
                              <th className="p-4">SKU</th>
                              <th className="p-4">Prenda / Categoría</th>
                              <th className="p-4 text-right">Existencias Totales</th>
                              {selectedStoreId === 'all' && (
                                <th className="p-4 text-center">Desglose por Sede (Stock | Ventas)</th>
                              )}
                              <th className="p-4 text-right">Precio venta</th>
                              <th className="p-4 text-right text-indigo-500">U. Vendidas</th>
                              <th className="p-4 text-right">Ingresos</th>
                              <th className="p-4 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredGroupedPerformance.map(item => (
                              <tr key={item.sku} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                                <td className="p-4 font-mono font-bold text-slate-400">{item.sku}</td>
                                <td className="p-4">
                                  <p className="font-bold">{item.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{item.categoryName}</p>
                                    {(() => {
                                      const storeStatuses = nonTrainingStores.map(store => {
                                        const b = item.storesBreakdown[store.id] || { stock: 0, qtySold: 0 };
                                        const hasProductInStore = inventory.some(p => p.storeId === store.id && (p.sku === item.sku || p.name === item.name));
                                        if (!hasProductInStore) return 'none';
                                        if (b.qtySold > 0) return 'performing';
                                        if (b.stock > 3) return 'stagnant';
                                        return 'inactive';
                                      });
                                      const hasDisparity = storeStatuses.includes('performing') && storeStatuses.includes('stagnant');
                                      return hasDisparity ? (
                                        <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-500 dark:text-rose-400 text-[8px] font-black uppercase rounded tracking-wider animate-pulse">
                                          ⚠️ Desbalance
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                </td>
                                <td className="p-4 text-right font-bold">
                                  <span className={`px-2 py-0.5 rounded-full ${item.totalStock < 0 ? 'bg-red-500/10 text-red-500 font-black' : item.totalStock <= 3 ? 'bg-amber-500/10 text-amber-500 font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {item.totalStock}
                                  </span>
                                </td>
                                {selectedStoreId === 'all' && (
                                  <td className="p-4 text-center">
                                    <div className="flex justify-center gap-2 flex-wrap">
                                      {nonTrainingStores.map(store => {
                                        const b = item.storesBreakdown[store.id] || { stock: 0, qtySold: 0 };
                                        const hasProductInStore = inventory.some(p => p.storeId === store.id && (p.sku === item.sku || p.name === item.name));
                                        
                                        if (!hasProductInStore) {
                                          return (
                                            <div key={store.id} className="bg-slate-100/50 dark:bg-slate-800/20 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/40 flex flex-col items-center min-w-[110px] opacity-40">
                                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                                {store.name}
                                              </span>
                                              <span className="text-[9px] font-black text-slate-400 mt-1">❌ Sin Inventario</span>
                                            </div>
                                          );
                                        }

                                        const isTrending = b.qtySold > 0;
                                        const isStagnant = b.stock > 3 && b.qtySold === 0;
                                        const isOutOfStock = b.stock <= 0 && b.qtySold === 0;

                                        let statusBg = "bg-slate-50 dark:bg-slate-800/50";
                                        let statusBorder = "border-slate-200 dark:border-slate-700/60";
                                        let statusBadge = (
                                          <span className="text-slate-500 font-black bg-slate-500/10 px-1 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                            💤 Inactivo
                                          </span>
                                        );

                                        if (isTrending) {
                                          statusBg = "bg-emerald-50/70 dark:bg-emerald-950/20";
                                          statusBorder = "border-emerald-200 dark:border-emerald-800/40";
                                          statusBadge = (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-black bg-emerald-500/10 px-1 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                              🔥 Activo
                                            </span>
                                          );
                                        } else if (isStagnant) {
                                          statusBg = "bg-amber-50/70 dark:bg-amber-950/20";
                                          statusBorder = "border-amber-200 dark:border-amber-800/40";
                                          statusBadge = (
                                            <span className="text-amber-600 dark:text-amber-400 font-black bg-amber-500/10 px-1 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                              ⚠️ Estancado
                                            </span>
                                          );
                                        } else if (isOutOfStock) {
                                          statusBg = "bg-rose-50/50 dark:bg-rose-950/10";
                                          statusBorder = "border-rose-100 dark:border-rose-900/30";
                                          statusBadge = (
                                            <span className="text-rose-500 font-black bg-rose-500/10 px-1 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                              ❌ Agotado
                                            </span>
                                          );
                                        }

                                        return (
                                          <div 
                                            key={store.id} 
                                            className={`${statusBg} ${statusBorder} p-2 rounded-xl border flex flex-col items-stretch min-w-[110px] transition-all hover:scale-[1.02] shadow-sm`}
                                          >
                                            <div className="flex justify-between items-center gap-1.5 mb-1">
                                              <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: store.accentColor }}>
                                                {store.name}
                                              </span>
                                              {statusBadge}
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] mt-0.5">
                                              <span className="text-slate-500 font-medium">Stock:</span>
                                              <span className="text-slate-800 dark:text-slate-200 font-black">{b.stock}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[9px]">
                                              <span className="text-slate-500 font-medium">Vendido:</span>
                                              <span className={`${isTrending ? "text-emerald-500 font-black" : "text-slate-400 font-medium"}`}>
                                                {b.qtySold}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                )}
                                <td className="p-4 text-right font-bold">{formatCOP(item.price)}</td>
                                <td className="p-4 text-right font-black text-indigo-600 dark:text-indigo-400 text-sm">{item.qtySold}</td>
                                <td className="p-4 text-right font-bold text-slate-800 dark:text-white">{formatCOP(item.revenue)}</td>
                                <td className="p-4 text-center">
                                  <button
                                    onClick={() => {
                                      setCompareSku(item.sku);
                                      setCompareProductName(item.name);
                                      // Scroll smoothly to comparison card
                                      window.scrollTo({ top: 150, behavior: 'smooth' });
                                    }}
                                    className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all"
                                  >
                                    Comparar Sedes
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PANTALLA 3: VENTAS LENTAS / LIQUIDACIÓN */}
              {activeTab === 'slow' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-5 rounded-3xl text-white shadow-md">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 py-0.5 px-2 rounded-full">Liquidación Estratégica</span>
                    <h3 className="text-xl font-black mt-2">Liberar Capital Estancado</h3>
                    <p className="text-xs text-amber-50 mt-1.5 leading-relaxed">
                      La siguiente lista muestra las prendas que tienen existencias físicas pero no registran ventas significativas en el periodo seleccionado. 
                      Aplica un descuento (Markdown) o trasládalas a otra sede para recuperar liquidez (Cash Flow).
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b dark:border-slate-800">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-white">Productos Lentos de Alta Inversión</h4>
                    </div>
                    {slowProducts.length === 0 ? (
                      <p className="p-8 text-slate-400 text-center text-xs font-bold">No hay productos estancados en el inventario actual.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 text-slate-400 uppercase tracking-widest font-black text-[9px]">
                              <th className="p-4">SKU</th>
                              <th className="p-4">Producto</th>
                              <th className="p-4">Sede</th>
                              <th className="p-4 text-right">Existencias</th>
                              <th className="p-4 text-right">Valor Atrapado (Costo)</th>
                              <th className="p-4 text-right">Precio venta</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {slowProducts.map(({ product, salesCount, value }) => (
                              <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                                <td className="p-4 font-mono font-bold text-slate-400">{product.sku}</td>
                                <td className="p-4">
                                  <p className="font-bold">{product.name}</p>
                                  <p className="text-[10px] text-slate-400">Ventas periodo: {salesCount}u</p>
                                </td>
                                <td className="p-4 font-bold uppercase tracking-wider text-[10px] text-slate-400">{stores.find(s => s.id === product.storeId)?.name}</td>
                                <td className="p-4 text-right font-bold text-slate-800 dark:text-white">{product.stock}</td>
                                <td className="p-4 text-right font-black text-orange-500">{formatCOP(value)}</td>
                                <td className="p-4 text-right">{formatCOP(product.price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PANTALLA 4: INFORMACIÓN DE LA TIENDA (ENERGÍA Y COMENTARIOS FUSIONADA) */}
              {activeTab === 'store_info' && (
                <div className="space-y-6">
                  {/* Energy & Customer Q&A correlation analysis block */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-3xl border border-emerald-500/10 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Días con Excelente Energía 🟢</span>
                          <span className="text-sm">🔥</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-400 mt-2">Ventas promedio por tienda</h4>
                        <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                          {formatCOP(energyCorrelation.green)}
                        </h3>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-3 font-bold uppercase tracking-wider">
                        {energyCorrelation.counts.green} registros de vendedoras
                      </p>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-3xl border border-amber-500/10 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Días con Tráfico Bajo 🟡</span>
                          <span className="text-sm">💤</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-400 mt-2">Ventas promedio por tienda</h4>
                        <h3 className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                          {formatCOP(energyCorrelation.yellow)}
                        </h3>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-3 font-bold uppercase tracking-wider">
                        {energyCorrelation.counts.yellow} registros de vendedoras
                      </p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-950/20 p-5 rounded-3xl border border-red-500/10 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Días con Día Difícil 🔴</span>
                          <span className="text-sm">⚠️</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-400 mt-2">Ventas promedio por tienda</h4>
                        <h3 className="text-xl font-black text-red-600 dark:text-red-400 mt-1">
                          {formatCOP(energyCorrelation.red)}
                        </h3>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-3 font-bold uppercase tracking-wider">
                        {energyCorrelation.counts.red} registros de vendedoras
                      </p>
                    </div>
                  </div>

                  {/* Combined Feedback Feed */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b dark:border-slate-800 flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-white">Feed de Novedades y Dudas de Clientes</h4>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 py-1 px-2.5 rounded-full text-slate-500">Últimos reportes</span>
                    </div>

                    {filteredCeoNotes.filter(n => n.energia || n.pregunta_cliente).length === 0 ? (
                      <p className="p-8 text-slate-400 text-center text-xs font-bold">No hay registros cargados para esta sede en el periodo seleccionado.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {filteredCeoNotes.filter(n => n.energia || n.pregunta_cliente).map(note => (
                          <div key={note.id} className="p-5 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            {note.energia && (
                              <span className="text-2xl flex-shrink-0">
                                {note.energia === 'green' ? '🟢' : note.energia === 'yellow' ? '🟡' : '🔴'}
                              </span>
                            )}
                            <div className="space-y-2 flex-grow">
                              <div className="flex justify-between items-center">
                                <span className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-[10px]">
                                  {stores.find(s => s.id === note.tienda)?.name || 'Tienda'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {note.fecha} ({new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                                </span>
                              </div>

                              {note.observacion && (
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reporte de Energía:</span>
                                  <p className="text-slate-700 dark:text-slate-300 font-semibold italic mt-0.5">"{note.observacion}"</p>
                                </div>
                              )}

                              {note.pregunta_cliente && (
                                <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/5 mt-1.5">
                                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Pregunta Frecuente del Cliente:</span>
                                  <p className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">"{note.pregunta_cliente}"</p>
                                </div>
                              )}

                              <div className="text-[10px] text-slate-400">
                                Registrado por: <strong className="text-slate-600 dark:text-slate-300">{note.usuario}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PANTALLA 9: STREET IA CONSULTOR */}
              {activeTab === 'ai' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[720px]">
                  
                  {/* Left Column: Proactive Alerts & Quick Chips */}
                  <div className="xl:col-span-1 space-y-4 flex flex-col h-full overflow-y-auto">
                    {/* Insights Banner */}
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-950 p-5 rounded-3xl text-white border border-indigo-500/20 shadow-md">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Resumen Proactivo de IA</span>
                        <span className="text-lg">🤖</span>
                      </div>
                      <p className="text-xs mt-3 leading-relaxed text-indigo-100 font-medium">
                        {isInsightsLoading ? 'Pensando y cruzando existencias...' : proactiveInsights}
                      </p>
                    </div>

                    {/* Quick Command Chips */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex-grow">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Comandos de Negocio Rápidos</h4>
                      <div className="flex flex-col gap-2">
                        {[
                          '¿Cuáles son mis 3 productos más lentos y cuánto capital tengo atrapado en ellos?',
                          'Haz una comparación de rentabilidad neta entre todas mis sedes activas',
                          'Analiza las preguntas más comunes de los clientes y sugiéreme compras para el próximo mes',
                          '¿Qué recomendación de liquidación me das basada en el stock actual?',
                          'Dame una auditoría express de mi cartera vencida de apartados',
                        ].map((promptText, index) => (
                          <button
                            key={index}
                            onClick={() => handleQuickPrompt(promptText)}
                            className="text-left text-xs bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500/20 font-bold transition-all"
                          >
                            {promptText}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Center/Right Column: Interactive Chat Panel */}
                  <div className="xl:col-span-2 bg-slate-900 rounded-3xl border border-white/10 shadow-xl overflow-hidden flex flex-col h-full">
                    {/* Chat Header */}
                    <div className="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                          <SparklesIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-wider">IA CEO • Consultor Estratégico</h3>
                          <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">En línea con todos los datos financieros</p>
                        </div>
                      </div>
                      {chatMessages.length > 0 && (
                        <button 
                          onClick={() => setChatMessages([])} 
                          className="text-white/40 hover:text-white p-1.5 rounded-lg bg-white/5"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-grow p-5 overflow-y-auto space-y-4 scrollbar-hide bg-black/5">
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-5">
                          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                            <SparklesIcon className="w-8 h-8 text-indigo-500" />
                          </div>
                          <div className="max-w-sm space-y-2">
                            <h4 className="text-white font-bold text-sm">Consultoría Ejecutiva con IA</h4>
                            <p className="text-slate-400 text-xs">
                              Escribe tus preguntas o usa uno de los comandos rápidos de la izquierda. Responderé cruzando tus ventas, compras, stock de inventario, layaways e informes diarios.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {chatMessages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed ${
                                msg.role === 'user' 
                                  ? 'bg-indigo-600 text-white font-bold rounded-tr-none' 
                                  : 'bg-white/10 text-white rounded-tl-none border border-white/10'
                              }`}>
                                <p className="font-bold opacity-60 text-[10px] uppercase mb-1">{msg.role === 'user' ? currentUser.name : 'Asistente IA'}</p>
                                <p className="whitespace-pre-line font-medium">{msg.content}</p>
                              </div>
                            </div>
                          ))}
                          {isAiLoading && (
                            <div className="flex justify-start">
                              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 flex items-center gap-2">
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Consultando balances de tiendas...</span>
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>

                    {/* Chat Input form */}
                    <div className="p-4 bg-black/40 border-t border-white/10">
                      <form onSubmit={handleSendChatMessage} className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Pregúntame sobre tus ventas, estrellas, stock..."
                          className="flex-grow bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-indigo-500"
                          disabled={isAiLoading}
                        />
                        <button
                          type="submit"
                          disabled={isAiLoading || !chatInput.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase p-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                          Enviar
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
