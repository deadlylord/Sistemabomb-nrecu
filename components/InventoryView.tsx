

import React, { useState, useMemo } from 'react';
import { Product, Category, View, Store, ProductHistoryLog, Sale, Purchase, Layaway, ProductChangeType, Seller, Role } from '../types';
import AddProductForm from './AddProductForm';
import InventoryTable from './InventoryTable';
import CategoryManager from './CategoryManager';
import { SearchIcon, SwapIcon, UploadIcon, CrossIcon, DownloadIcon, AlertTriangleIcon } from './Icons';
import ProductHistoryModal from './ProductHistoryModal';
import InventoryCostChart from './InventoryCostChart';
import BulkAddProductsModal from './BulkAddProductsModal';
import InconsistencyResolutionModal from './InconsistencyResolutionModal';

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
  // FIX: Expanded type to include optional description and imageUrl from bulk add modal.
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
}

type SortConfig = {
  key: keyof Product | 'categoryName' | 'velocity';
  direction: 'ascending' | 'descending';
};


const InventoryView: React.FC<InventoryViewProps> = ({ inventory, allInventory, sales, purchases, layaways, categories, stores, currentStoreId, onAddProduct, onUpdateProduct, onBulkAddProducts, onDeleteProduct, onAddCategory, onUpdateCategory, onDeleteCategory, onNavigate, productHistory, currentUser, roles, showDisabledProducts, onShowDisabledProductsChange, onReactivateInconsistentProducts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [historyModalProduct, setHistoryModalProduct] = useState<Product | null>(null);
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [showOnlyDisabled, setShowOnlyDisabled] = useState(false);
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);

  const adminRole = useMemo(() => roles.find(r => r.name === 'Administrator'), [roles]);
  const isAdmin = useMemo(() => currentUser.roleId === adminRole?.id, [currentUser, adminRole]);

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

  const handleExportToExcel = () => {
    // 1. Filter products with stock
    const productsToExport = inventory.filter(p => p.stock > 0);

    // 2. Get category map for easy lookup
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    // 3. Sort products by category, then by name
    productsToExport.sort((a, b) => {
      const categoryA = categoryMap.get(a.categoryId) || 'zzzz';
      const categoryB = categoryMap.get(b.categoryId) || 'zzzz';

      if (categoryA < categoryB) return -1;
      if (categoryA > categoryB) return 1;

      return a.name.localeCompare(b.name);
    });

    // 4. Create CSV content
    const headers = ['Categoría', 'Nombre del Producto', 'SKU', 'Stock Actual', 'Precio de Venta'];
    const csvRows = [headers.join(',')];

    productsToExport.forEach(product => {
      const row = [
        `"${categoryMap.get(product.categoryId) || 'Sin Categoría'}"`,
        `"${product.name.replace(/"/g, '""')}"`, // Escape double quotes
        `"${product.sku}"`,
        product.stock,
        product.price
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // 5. Trigger download
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel compatibility
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

    // Consolidate all relevant sales transactions once for performance
    const salesAndLayaways = [
        ...sales.flatMap(s => (s.items || []).map(item => item ? ({ ...item, date: s.createdAt }) : null)),
        ...layaways.flatMap(l => (l.status === 'active' || l.status === 'completed') ? (l.items || []).map(item => item ? ({ ...item, date: l.createdAt }) : null) : [])
    ].filter(Boolean) as (Product & { quantity: number; date: string })[];

    const productsWithVelocity = inventory.map(product => {
        // --- Sales History for current product ---
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
        
        // --- Determine Trend ---
        let trend: 'improving' | 'stable' | 'worsening' = 'stable';
        if (salesInLast30Days > salesInPrevious30Days) {
            trend = 'improving';
        } else if (salesInLast30Days < salesInPrevious30Days) {
            if (salesInPrevious30Days > 0) { // Only flag as worsening if there were sales previously
                 trend = 'worsening';
            }
        }
        
        // --- Determine Status and Days ---
        let status = 'Sin Datos';
        let days = Infinity;
        
        const isStagnatedByDate = product.stock > 0 && lastSaleDate && (today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24) > 30;

        if (isStagnatedByDate) {
            status = 'Estancado';
            days = Infinity;
        } else if (salesInLast90Days > 0) {
            // Rule 2: Performance Calculation (if there are recent sales)
            const avgDaysPerUnit = 90 / salesInLast90Days;
            days = avgDaysPerUnit;
            if (avgDaysPerUnit <= 7) status = 'Alta Rotación';
            else if (avgDaysPerUnit <= 15) status = 'Rotación Media';
            else if (avgDaysPerUnit <= 30) status = 'Baja Rotación';
            else if (avgDaysPerUnit <= 60) status = 'En Riesgo';
            else status = 'Estancado';
        } else {
            // Rule 3: No sales in last 90 days - either New or Stagnant
            const creationLogs = productHistory.filter(h => h.productId === product.id && h.changeType === ProductChangeType.CREATED);
            const purchaseLogs = purchases.filter(p => p.productId === product.id);
            const potentialDates = [
                ...(creationLogs.map(l => new Date(l.timestamp).getTime())),
                ...(purchaseLogs.map(p => new Date(p.createdAt).getTime()))
            ];

            if (potentialDates.length > 0) {
                const firstStockedDate = new Date(Math.min(...potentialDates));
                const daysOnMarket = (today.getTime() - firstStockedDate.getTime()) / (1000 * 60 * 60 * 24);
                
                if (productTransactions.length === 0) { // If it has never sold at all
                     status = daysOnMarket < 90 ? 'Nuevo' : 'Estancado';
                } else { // It has sold before, but not in the last 90 days
                     status = 'Estancado';
                }
            } else {
                // No creation/purchase date found, and no sales in 90 days.
                status = productTransactions.length > 0 ? 'Estancado' : 'Nuevo';
            }
        }
        
        if (status === 'Estancado') {
            trend = 'worsening';
        }
        
        return { ...product, velocity: { status, days, trend } };
    });

    let filteredProducts = productsWithVelocity.filter(product => {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                            (product.supplier && product.supplier.toLowerCase().includes(lowerCaseSearchTerm));
      const matchesCategory = filterCategoryId ? product.categoryId === filterCategoryId : true;
      const matchesStock = hideZeroStock ? product.stock > 0 : true;
      
      let matchesDisabled;
      if (showOnlyDisabled) {
        matchesDisabled = !!product.isDisabled;
      } else {
        matchesDisabled = showDisabledProducts ? true : !product.isDisabled;
      }

      return matchesSearch && matchesCategory && matchesStock && matchesDisabled;
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
  }, [inventory, searchTerm, filterCategoryId, hideZeroStock, sortConfig, categories, sales, layaways, purchases, productHistory, showDisabledProducts, showOnlyDisabled]);

  const categorySummary = useMemo(() => {
    return categories.map(category => {
      const productsInCategory = inventory.filter(p => p.categoryId === category.id);
      const productCount = productsInCategory.length;
      const totalStock = productsInCategory.reduce((sum, p) => sum + p.stock, 0);
      return { ...category, productCount, totalStock };
    }).sort((a,b) => b.totalStock - a.totalStock);
  }, [inventory, categories]);

  const inventoryCostHistory = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Start of the 30-day window

    const valueEvents: { date: Date; valueChange: number }[] = [];

    purchases.forEach(p => {
        valueEvents.push({ date: new Date(p.createdAt), valueChange: p.totalCost });
    });

    sales.forEach(s => {
        const saleCost = s.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
        valueEvents.push({ date: new Date(s.createdAt), valueChange: -saleCost });
    });

    layaways.forEach(l => {
        if (l.status === 'active') { // only when stock is first deducted
            const layawayCost = l.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
            valueEvents.push({ date: new Date(l.createdAt), valueChange: -layawayCost });
        }
    });
    
    // This is complex, but for now we won't process returns/edits for history.
    // A more robust system might use daily snapshots.

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
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-accent mb-3">Historial de Costo de Inventario (Últimos 30 días)</h3>
                <InventoryCostChart data={inventoryCostHistory} />
            </div>
            <div className="lg:col-span-2 bg-white dark:bg-secondary p-6 rounded-xl shadow-lg flex flex-col">
                <h3 className="text-xl font-bold text-accent mb-3">Resumen por Categoría</h3>
                <div className="flex-grow space-y-2 overflow-y-auto pr-2">
                  {categorySummary.map((summary, index) => (
                    <div key={summary.id} className={`flex justify-between items-center p-3 rounded-lg ${index % 2 === 0 ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                      <div>
                          <p className="font-bold text-gray-800 dark:text-text-light truncate">{summary.name}</p>
                          <p className="text-xs text-gray-500 dark:text-text-dark">{summary.productCount} Productos</p>
                      </div>
                      <p className="text-lg font-extrabold text-accent">{summary.totalStock} <span className="text-sm font-normal">unidades</span></p>
                    </div>
                  ))}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <AddProductForm 
              onAddProduct={onAddProduct} 
              categories={categories} 
              stores={stores} 
              currentStoreId={currentStoreId}
              allInventory={allInventory}
            />
          </div>
          <div className="lg:col-span-1">
            <CategoryManager 
              categories={categories}
              inventory={allInventory}
              onAddCategory={onAddCategory}
              onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-secondary p-4 rounded-xl shadow-lg">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="relative">
                <input 
                  type="text"
                  placeholder="Buscar por nombre o proveedor..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
                <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400">
                  <SearchIcon />
                </div>
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                        aria-label="Limpiar búsqueda"
                    >
                        <CrossIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
            <select 
              value={filterCategoryId}
              onChange={e => setFilterCategoryId(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            >
              <option value="">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                  type="checkbox"
                  checked={hideZeroStock}
                  onChange={(e) => setHideZeroStock(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
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
                  className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
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
                  className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
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
        />
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
    </>
  );
};

export default InventoryView;