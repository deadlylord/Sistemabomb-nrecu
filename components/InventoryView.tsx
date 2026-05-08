import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Product, Category, View, Store, ProductHistoryLog, Sale, Purchase, Layaway, ProductChangeType, Seller, Role } from '../types';
import { InventoryTable } from './InventoryTable';
import CategoryManager from './CategoryManager';
import { SearchIcon, SwapIcon, UploadIcon, CrossIcon, DownloadIcon, AlertTriangleIcon, ChartBarIcon, ReceiptIcon, SettingsIcon, PackageIcon, PowerIcon, TrashIcon } from './Icons';
import ProductHistoryModal from './ProductHistoryModal';
import InventoryCostChart from './InventoryCostChart';
import BulkAddProductsModal from './BulkAddProductsModal';
import InconsistencyResolutionModal from './InconsistencyResolutionModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { LabelPrintModal } from './LabelPrintModal';
import { TagIcon } from './Icons';
import { normalizeText } from '../constants';

interface InventoryViewProps {
  inventory: Product[];
  allInventory: Product[];
  sales: Sale[];
  purchases: Purchase[];
  layaways: Layaway[];
  categories: Category[];
  stores: Store[];
  currentStoreId: string;
  onAddProduct: (newProductData: Omit<Product, 'id' | 'sku' | 'storeId' | 'imageUrl'>, selectedStoreIds: string[], imageFile?: File) => void;
  onUpdateProduct: (updatedProduct: Product, imageFile?: File) => Promise<void>;
  onBulkAddProducts: (
    productsToAdd: {
      name: string;
      price: number;
      cost: number;
      stock: number;
      categoryName: string;
      supplier: string;
      description?: string;
      imageUrl?: string;
    }[],
    storeId: string
  ) => void;
  onDeleteProduct: (productId: string) => void;
  onAddCategory: (name: string) => void;
  onUpdateCategory: (id: string, newName: string) => void;
  onDeleteCategory: (id: string) => void;
  onNavigate: (view: View) => void;
  productHistory: ProductHistoryLog[];
  currentUser: Seller;
  roles: Role[];
  showDisabledProducts: boolean;
  onShowDisabledProductsChange: (show: boolean) => void;
  onReactivateInconsistentProducts: (productIds: string[]) => void;
  onRegenerateAllSkus?: () => Promise<void>;
}

type SortConfig = {
  key: keyof Product | 'categoryName' | 'velocity';
  direction: 'ascending' | 'descending';
};


const InventoryView: React.FC<InventoryViewProps> = ({ inventory, allInventory, sales, purchases, layaways, categories, stores, currentStoreId, onAddProduct, onUpdateProduct, onBulkAddProducts, onDeleteProduct, onAddCategory, onUpdateCategory, onDeleteCategory, onNavigate, productHistory, currentUser, roles, showDisabledProducts, onShowDisabledProductsChange, onReactivateInconsistentProducts, onRegenerateAllSkus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const adminRole = useMemo(() => roles.find(r => r.name === 'Administrator'), [roles]);
  const isAdmin = useMemo(() => currentUser.roleId === adminRole?.id, [currentUser, adminRole]);
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterVelocity, setFilterVelocity] = useState(''); 
  const [historyModalProduct, setHistoryModalProduct] = useState<Product | null>(null);
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [showOnlyDisabled, setShowOnlyDisabled] = useState(false);
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDiscontinueConfirm, setShowBulkDiscontinueConfirm] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((allVisibleIds: string[]) => {
    setSelectedIds(prev => {
        const isAllIn = allVisibleIds.every(id => prev.has(id));
        const next = new Set(prev);
        if (isAllIn) {
            allVisibleIds.forEach(id => next.delete(id));
        } else {
            allVisibleIds.forEach(id => next.add(id));
        }
        return next;
    });
  }, []);

  const handleBulkDiscontinue = async () => {
    const selectedList = inventory.filter(p => selectedIds.has(p.id));
    const productsWithStock = selectedList.filter(p => !p.isDisabled && p.stock > 0);
    
    if (productsWithStock.length > 0) {
        alert(`No se pueden descontinuar ${productsWithStock.length} productos porque aún tienen stock disponible. Por favor, desmárcalos o ajusta su stock a cero.`);
        return;
    }

    setShowBulkDiscontinueConfirm(true);
  };

  const confirmBulkDiscontinue = async () => {
    try {
        const promises = Array.from(selectedIds).map(id => {
            const p = inventory.find(item => item.id === id);
            if (p && !p.isDisabled) {
                return onUpdateProduct({ ...p, isDisabled: true });
            }
            return Promise.resolve();
        });
        await Promise.all(promises);
        setSelectedIds(new Set());
        alert('Productos descontinuados correctamente.');
    } catch (e) {
        console.error(e);
        alert('Error al realizar la actualización masiva.');
    }
  };

  const inconsistentProducts = useMemo(() => {
    return inventory.filter(p => p.isDisabled && p.stock > 0);
  }, [inventory]);

  const requestSort = (key: SortConfig['key']) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleExportToExcel = () => {
    const productsToExport = inventory.filter(p => p.stock > 0);
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    productsToExport.sort((a, b) => {
      const categoryA = categoryMap.get(a.categoryId) || 'zzzz';
      const categoryB = categoryMap.get(b.categoryId) || 'zzzz';
      if (categoryA < categoryB) return -1;
      if (categoryA > categoryB) return 1;
      return a.name.localeCompare(b.name);
    });

    const headers = ['Categoría', 'Nombre del Producto', 'SKU', 'Stock Actual', 'Precio de Venta'];
    const csvRows = [headers.join(',')];

    productsToExport.forEach(product => {
      const row = [
        `"${categoryMap.get(product.categoryId) || 'Sin Categoría'}"`,
        `"${product.name.replace(/"/g, '""')}"`,
        `"${product.sku}"`,
        product.stock,
        product.price
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const storeName = stores.find(s => s.id === currentStoreId)?.name || 'tienda';
      const fileName = `inventario_${storeName.toLowerCase().replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  const processedInventory = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(today.getDate() - 60);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);

    const salesAndLayaways = [
        ...sales.flatMap(s => (s.items || []).map(item => item ? ({ ...item, date: s.createdAt }) : null)),
        ...layaways.flatMap(l => (l.status === 'active' || l.status === 'completed') ? (l.items || []).map(item => item ? ({ ...item, date: l.createdAt }) : null) : [])
    ].filter(Boolean) as (Product & { quantity: number; date: string })[];

    const productsWithVelocity = inventory.map(product => {
        const productTransactions = salesAndLayaways
            .filter(item => item.id === product.id)
            .map(item => ({ ...item, transactionDate: new Date(item.date) }));

        const salesInLast30Days = productTransactions
            .filter(t => t.transactionDate >= thirtyDaysAgo)
            .reduce((sum, t) => sum + t.quantity, 0);
        
        const salesInPrevious30Days = productTransactions
            .filter(t => t.transactionDate < thirtyDaysAgo && t.transactionDate >= sixtyDaysAgo)
            .reduce((sum, t) => sum + t.quantity, 0);

        const salesInLast90Days = productTransactions
            .filter(t => t.transactionDate >= ninetyDaysAgo)
            .reduce((sum, t) => sum + t.quantity, 0);

        const lastSaleDate = productTransactions.length > 0
            ? new Date(Math.max(...productTransactions.map(t => t.transactionDate.getTime())))
            : null;
        
        const productPurchases = purchases
            .filter(p => p.productId === product.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const lastPurchaseDate = productPurchases.length > 0 ? new Date(productPurchases[0].createdAt) : null;

        let trend: 'improving' | 'stable' | 'worsening' = 'stable';
        if (salesInLast30Days > salesInPrevious30Days) {
            trend = 'improving';
        } else if (salesInLast30Days < salesInPrevious30Days) {
            if (salesInPrevious30Days > 0) {
                 trend = 'worsening';
            }
        }
        
        let status = 'Sin Datos';
        let days = Infinity;
        
        if (product.stock === 0) {
            if (!lastSaleDate) {
                status = 'Agotado (Sin Ventas)';
            } else {
                const daysSinceLastSale = (today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24);
                
                if (daysSinceLastSale > 30) {
                    status = 'Agotado (Inactivo)';
                    trend = 'stable'; 
                } else {
                    const avgDaysPerUnit = salesInLast90Days > 0 ? 90 / salesInLast90Days : Infinity;
                    status = avgDaysPerUnit <= 15 ? 'Agotado (Alta Demanda)' : 'Agotado';
                }
            }
        } else {
            if (salesInLast90Days > 0) {
                const avgDaysPerUnit = 90 / salesInLast90Days;
                days = avgDaysPerUnit;
                if (avgDaysPerUnit <= 7) status = 'Alta Rotación';
                else if (avgDaysPerUnit <= 15) status = 'Rotación Media';
                else if (avgDaysPerUnit <= 30) status = 'Baja Rotación';
                else if (avgDaysPerUnit <= 60) status = 'En Riesgo';
                else status = 'Estancado';
            } else {
                // No sales in last 90 days
                const totalSalesCount = productTransactions.length;
                const totalPurchasesCount = productPurchases.length;

                // NUEVO ESTADO: Nunca comprado ni vendido (en el sistema de registros)
                if (totalSalesCount === 0 && totalPurchasesCount === 0) {
                  status = 'Sin Historial';
                } else {
                  const creationLogs = productHistory.filter(h => h.productId === product.id && h.changeType === ProductChangeType.CREATED);
                  const potentialDates = [
                      ...(creationLogs.map(l => new Date(l.timestamp).getTime())),
                      ...(lastPurchaseDate ? [lastPurchaseDate.getTime()] : [])
                  ];

                  if (potentialDates.length > 0) {
                      const firstStockedDate = new Date(Math.min(...potentialDates));
                      const daysOnMarket = (today.getTime() - firstStockedDate.getTime()) / (1000 * 60 * 60 * 24);
                      status = daysOnMarket < 90 ? 'Nuevo' : 'Estancado';
                  } else {
                      status = productTransactions.length > 0 ? 'Estancado' : 'Nuevo';
                  }
                }
            }
        }
        
        return { ...product, velocity: { status, days, trend } };
    });

    let filteredProducts = productsWithVelocity.filter(product => {
      const normalizedSearch = normalizeText(searchTerm);
      const matchesSearch = normalizeText(product.name).includes(normalizedSearch) ||
                            (product.supplier && normalizeText(product.supplier).includes(normalizedSearch)) ||
                            (product.sku && normalizeText(product.sku).includes(normalizedSearch));
      const matchesCategory = filterCategoryId ? product.categoryId === filterCategoryId : true;
      const matchesVelocity = filterVelocity ? product.velocity.status === filterVelocity : true;
      const matchesStock = hideZeroStock ? product.stock > 0 : true;
      
      let matchesDisabled;
      if (showOnlyDisabled) {
        matchesDisabled = !!product.isDisabled;
      } else {
        matchesDisabled = showDisabledProducts ? true : !product.isDisabled;
      }

      return matchesSearch && matchesCategory && matchesStock && matchesDisabled && matchesVelocity;
    });

    if (sortConfig.key) {
      filteredProducts.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'categoryName') {
            aValue = categories.find(c => c.id === a.categoryId)?.name || '';
            bValue = categories.find(c => c.id === b.categoryId)?.name || '';
        } else if (sortConfig.key === 'velocity') {
            aValue = a.velocity.days;
            bValue = b.velocity.days;
        } else {
            aValue = a[sortConfig.key as keyof Product];
            bValue = b[sortConfig.key as keyof Product];
        }

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        } 
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comparison = aValue.localeCompare(bValue, 'es', { sensitivity: 'base' });
            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }
        
        return 0;
      });
    }

    return filteredProducts;
  }, [inventory, searchTerm, filterCategoryId, filterVelocity, hideZeroStock, sortConfig, categories, sales, layaways, purchases, productHistory, showDisabledProducts, showOnlyDisabled]);

  const categorySummary = useMemo(() => {
    return categories.map(category => {
      const productsInCategory = inventory.filter(p => p.categoryId === category.id);
      const productCount = productsInCategory.length;
      const totalStock = productsInCategory.reduce((sum, p) => sum + p.stock, 0);
      return { ...category, productCount, totalStock };
    })
    .filter(cat => cat.totalStock > 0)
    .sort((a,b) => b.totalStock - a.totalStock);
  }, [inventory, categories]);

  const inventoryCostHistory = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const valueEvents: { date: Date; valueChange: number }[] = [];

    purchases.forEach(p => {
        valueEvents.push({ date: new Date(p.createdAt), valueChange: p.totalCost });
    });

    sales.forEach(s => {
        const saleCost = s.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
        valueEvents.push({ date: new Date(s.createdAt), valueChange: -saleCost });
    });

    layaways.forEach(l => {
        if (l.status === 'active') {
            const layawayCost = l.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
            valueEvents.push({ date: new Date(l.createdAt), valueChange: -layawayCost });
        }
    });
    
    const netChangeLast30Days = valueEvents
        .filter(e => e.date >= thirtyDaysAgo)
        .reduce((sum, e) => sum + e.valueChange, 0);

    const currentValue = inventory.reduce((sum, p) => sum + p.cost * p.stock, 0);
    const startingValue = currentValue - netChangeLast30Days;
    
    const dailyChanges: { [date: string]: number } = {};
    
    valueEvents
        .filter(e => e.date >= thirtyDaysAgo)
        .forEach(e => {
            const dateStr = e.date.toISOString().split('T')[0];
            dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + e.valueChange;
        });

    const finalData: { date: string; value: number }[] = [];
    let runningTotal = startingValue;
    
    for (let i = 0; i < 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        runningTotal += (dailyChanges[dateStr] || 0);
        finalData.push({ date: dateStr, value: runningTotal });
    }

    return finalData;
  }, [inventory, sales, purchases, layaways]);

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 relative">
        
        {/* Accesos Directos */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-2 rounded-2xl flex flex-wrap gap-2 sticky top-[68px] z-30 shadow-lg">
            <button onClick={() => scrollToSection('inventory-table-container')} className="px-4 py-2 text-sm font-black bg-accent text-white rounded-xl shadow-md hover:scale-105 transition-all flex items-center gap-2">
                <PackageIcon className="w-4 h-4" /> Tabla de Productos
            </button>
            <button onClick={() => scrollToSection('analysis-section')} className="px-4 py-2 text-sm font-black bg-blue-600 text-white rounded-xl shadow-md hover:scale-105 transition-all flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4" /> Análisis de Costos
            </button>
            <button onClick={() => scrollToSection('category-management-section')} className="px-4 py-2 text-sm font-black bg-purple-600 text-white rounded-xl shadow-md hover:scale-105 transition-all flex items-center gap-2">
                <SettingsIcon className="w-4 h-4" /> Gestionar Categorías
            </button>
            {isAdmin && onRegenerateAllSkus && (
                <button onClick={onRegenerateAllSkus} className="px-4 py-2 text-sm font-black bg-amber-500 text-white rounded-xl shadow-md hover:scale-105 transition-all flex items-center gap-2 ml-auto">
                    <PowerIcon className="w-4 h-4" /> Regenerar SKUs
                </button>
            )}
        </div>

        {/* Resumen por Categoría Compacto */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <ReceiptIcon className="w-4 h-4 text-accent" /> Existencias por Categoría
                </h3>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-800">
                    Haz clic en <TagIcon className="w-3 h-3 inline-block mx-0.5 text-accent" /> para imprimir todas las etiquetas de la categoría
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {categorySummary.length > 0 ? categorySummary.map((summary) => (
                    <div key={summary.id} className="bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl flex items-center gap-3 border border-slate-200 dark:border-slate-700 transition-all hover:border-accent/40 hover:bg-slate-200 dark:hover:bg-slate-800">
                        <div className="flex items-baseline gap-2">
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{summary.name}</span>
                            <span className="font-black text-accent text-base">{summary.totalStock}</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold">uds</span>
                        </div>
                        <button 
                            onClick={() => {
                                const categoryProducts = inventory.filter(p => p.categoryId === summary.id && p.stock > 0 && !p.isDisabled);
                                if (categoryProducts.length === 0) {
                                    alert('No hay productos con stock en esta categoría.');
                                    return;
                                }
                                const newSelection = new Set<string>();
                                categoryProducts.forEach(p => newSelection.add(p.id));
                                setSelectedIds(newSelection);
                                setIsLabelModalOpen(true);
                            }}
                            className="p-1.5 bg-accent/20 text-accent rounded-lg hover:bg-accent hover:text-white transition-all shadow-sm"
                            title={`Imprimir etiquetas de ${summary.name}`}
                        >
                            <TagIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )) : <p className="text-xs text-gray-400 italic">No hay productos con stock actualmente.</p>}
            </div>
        </div>

        {/* Filtros e Inventario */}
        <div id="inventory-table-container" className="bg-white dark:bg-slate-900/75 dark:backdrop-blur-xl dark:border dark:border-slate-800 p-4 rounded-xl shadow-lg scroll-mt-24">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <h2 className="text-2xl font-bold text-accent">Inventario Actual</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && inconsistentProducts.length > 0 && (
                <button
                  onClick={() => setIsFixModalOpen(true)}
                  className="relative bg-orange-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-orange-600"
                >
                  <AlertTriangleIcon />
                  <span>Corregir Inconsistencias</span>
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {inconsistentProducts.length}
                  </span>
                </button>
              )}
              <button
                onClick={() => setIsBulkAddModalOpen(true)}
                className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-green-700"
              >
                <UploadIcon />
                <span>Carga Masiva</span>
              </button>
              <button
                onClick={handleExportToExcel}
                className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-blue-700"
              >
                <DownloadIcon />
                <span>Exportar Excel</span>
              </button>
              <button
                onClick={() => onNavigate(View.INVENTORY_TRANSFER)}
                className="bg-accent/90 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover"
              >
                <SwapIcon />
                <span>Realizar Traslado</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="relative">
                <input 
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar por nombre o proveedor..."
                  value={searchTerm}
                  onChange={e => {
                    let val = e.target.value;
                    // Corrección para escáneres con configuración de teclado incorrecta
                    val = val.replace(/[']/g, '-').replace(/[,]/g, '-');
                    setSearchTerm(val);
                  }}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
                <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-slate-400">
                  <SearchIcon />
                </div>
                {searchTerm && (
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            searchInputRef.current?.focus();
                        }}
                        className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        aria-label="Limpiar búsqueda"
                    >
                        <CrossIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
            <select 
              value={filterCategoryId}
              onChange={e => setFilterCategoryId(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            >
              <option value="">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select 
              value={filterVelocity}
              onChange={e => setFilterVelocity(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            >
              <option value="">Rendimiento (Todos)</option>
              <option value="Alta Rotación">Alta Rotación</option>
              <option value="Rotación Media">Rotación Media</option>
              <option value="Baja Rotación">Baja Rotación</option>
              <option value="En Riesgo">En Riesgo</option>
              <option value="Estancado">Estancado</option>
              <option value="Nuevo">Nuevo</option>
              <option value="Sin Historial">Sin Historial (Nunca Comprado/Vendido)</option>
              <option value="Agotado (Alta Demanda)">Agotado (Crítico)</option>
              <option value="Agotado (Inactivo)">Agotado (Inactivo)</option>
              <option value="Agotado (Sin Ventas)">Agotado (Sin Ventas)</option>
              <option value="Agotado">Agotado</option>
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                  type="checkbox"
                  checked={hideZeroStock}
                  onChange={(e) => setHideZeroStock(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-accent focus:ring-accent"
              />
              <span className="text-sm">Ocultar productos con cero unidades</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                  type="checkbox"
                  checked={showDisabledProducts}
                  onChange={(e) => {
                      onShowDisabledProductsChange(e.target.checked);
                      if (!e.target.checked) {
                          setShowOnlyDisabled(false);
                      }
                  }}
                  className="h-5 w-5 rounded border-slate-300 text-accent focus:ring-accent"
              />
              <span className="text-sm">Incluir productos descontinuados</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                  type="checkbox"
                  checked={showOnlyDisabled}
                  onChange={(e) => {
                      const isChecked = e.target.checked;
                      setShowOnlyDisabled(isChecked);
                      if (isChecked) {
                          onShowDisabledProductsChange(true);
                      }
                  }}
                  className="h-5 w-5 rounded border-slate-300 text-accent focus:ring-accent"
              />
              <span className="text-sm">Mostrar solo descontinuados</span>
            </label>
          </div>
        </div>

        <InventoryTable 
            inventory={processedInventory} 
            categories={categories} 
            onUpdateProduct={onUpdateProduct} 
            onDeleteProduct={onDeleteProduct} 
            onShowHistory={setHistoryModalProduct}
            requestSort={requestSort}
            sortConfig={sortConfig}
            isAdmin={isAdmin}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
        />

        {/* BARRA DE ACCIONES MASIVAS FLOTANTE */}
        {selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-white dark:bg-slate-900 border-2 border-accent rounded-full px-6 py-4 shadow-2xl animate-slide-up flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="bg-accent text-white font-black rounded-full h-8 w-8 flex items-center justify-center text-sm shadow-md">{selectedIds.size}</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Productos seleccionados</span>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsLabelModalOpen(true)}
                        className="bg-accent text-white font-black py-2 px-5 rounded-full hover:bg-accent-hover transition-all flex items-center gap-2 shadow-lg shadow-accent/20 active:scale-95 text-xs uppercase"
                    >
                        <TagIcon className="w-4 h-4" /> Imprimir Etiquetas
                    </button>
                    <button 
                        onClick={handleBulkDiscontinue}
                        className="bg-red-500 text-white font-black py-2 px-5 rounded-full hover:bg-red-600 transition-all flex items-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 text-xs uppercase"
                    >
                        <PowerIcon className="w-4 h-4" /> Descontinuar
                    </button>
                    <button 
                        onClick={() => setSelectedIds(new Set())}
                        className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-xs uppercase tracking-widest px-2"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        )}

        {/* Sección Inferior de Análisis y Gestión */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div id="analysis-section" className="bg-white dark:bg-slate-900/75 dark:backdrop-blur-xl dark:border dark:border-slate-800 p-6 rounded-xl shadow-lg scroll-mt-24">
                <h3 className="text-xl font-bold text-accent mb-3 flex items-center gap-2">
                    <ChartBarIcon className="w-6 h-6" /> Valorización (Últimos 30 días)
                </h3>
                <InventoryCostChart data={inventoryCostHistory} />
            </div>
            
            <div id="category-management-section" className="scroll-mt-24">
                <CategoryManager 
                    categories={categories}
                    inventory={allInventory}
                    onAddCategory={onAddCategory}
                    onUpdateCategory={onUpdateCategory}
                    onDeleteCategory={onDeleteCategory}
                />
            </div>
        </div>
      </div>

      {historyModalProduct && (
        <ProductHistoryModal
          isOpen={!!historyModalProduct}
          onClose={() => setHistoryModalProduct(null)}
          product={historyModalProduct}
          history={productHistory}
        />
      )}
      {isBulkAddModalOpen && (
        <BulkAddProductsModal
          isOpen={isBulkAddModalOpen}
          onClose={() => setIsBulkAddModalOpen(false)}
          inventory={allInventory}
          categories={categories}
          stores={stores}
          currentStoreId={currentStoreId}
          onConfirm={onBulkAddProducts}
        />
      )}
      {isFixModalOpen && (
        <InconsistencyResolutionModal
          isOpen={isFixModalOpen}
          onClose={() => setIsFixModalOpen(false)}
          inconsistentProducts={inconsistentProducts}
          onResolve={onReactivateInconsistentProducts}
        />
      )}

      <DeleteConfirmationModal
        isOpen={showBulkDiscontinueConfirm}
        onClose={() => setShowBulkDiscontinueConfirm(false)}
        onConfirm={confirmBulkDiscontinue}
        title="¿Descontinuar Productos?"
        message={`¿Estás seguro de que deseas descontinuar los ${selectedIds.size} productos seleccionados?`}
      />

      <LabelPrintModal 
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        selectedProducts={inventory.filter(p => selectedIds.has(p.id))}
        store={stores.find(s => s.id === currentStoreId)!}
      />
    </>
  );
};

export default InventoryView;