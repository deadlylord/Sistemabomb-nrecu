
import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, Product, Category, Store } from '../types';
import { PlusCircleIcon, EditIcon, TrashIcon, SearchIcon, CheckIcon, CrossIcon, BuildingStorefrontIcon } from './Icons';
import { formatCOP } from '../constants';
import EditPurchaseModal from './EditPurchaseModal';

interface PurchasesViewProps {
  purchases: Purchase[];
  inventory: Product[];
  allInventoryForSearch?: Product[];
  categories: Category[];
  stores: Store[];
  currentStoreId: string;
  onMultiStorePurchase: (data: {
    productInfo: { name: string; categoryId: string; };
    storeEntries: Record<string, { quantity: number; cost: number; price: number; supplier: string }>;
  }) => Promise<void>;
  onUpdatePurchase: (updatedPurchase: Purchase, originalQuantity: number, newProductPrice: number) => void;
  onDeletePurchase: (purchaseId: string) => void;
}

const PurchasesView: React.FC<PurchasesViewProps> = ({ purchases, inventory, allInventoryForSearch, categories, stores, currentStoreId, onMultiStorePurchase, onUpdatePurchase, onDeletePurchase }) => {
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProductCategoryId, setNewProductCategoryId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [storeData, setStoreData] = useState<Record<string, {
    selected: boolean;
    quantity: string;
    cost: string;
    price: string;
  }>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Sugerencias de proveedores
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(-1);

  useEffect(() => {
    setStoreData(stores.reduce((acc, store) => {
      acc[store.id] = { selected: store.id === currentStoreId, quantity: '', cost: '', price: '' };
      return acc;
    }, {} as typeof storeData));
  }, [stores, currentStoreId]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  // Función para normalizar texto (quita espacios extras internos y externos)
  const normalizeText = (text: string) => {
    return (text || '').toLowerCase().trim().replace(/\s\s+/g, ' ');
  };

  const searchSource = useMemo(() => {
    const globalList = allInventoryForSearch || [];
    const unified = [...globalList];
    const existingIds = new Set(unified.map(p => p.id));
    
    inventory.forEach(p => {
        if (!existingIds.has(p.id)) {
            unified.push(p);
        }
    });
    
    return unified;
  }, [allInventoryForSearch, inventory]);

  const resetForm = () => {
    setProductSearch('');
    setSelectedProduct(null);
    setIsCreatingNew(false);
    setNewProductCategoryId('');
    setSupplier('');
    setStoreData(stores.reduce((acc, store) => {
      acc[store.id] = { selected: store.id === currentStoreId, quantity: '', cost: '', price: '' };
      return acc;
    }, {} as typeof storeData));
  };
  
  const suggestedProducts = useMemo(() => {
    const searchTermNormalized = normalizeText(productSearch);
    if (!searchTermNormalized) return [];

    const uniqueProductNames = new Set<string>();
    
    return searchSource
      .filter(p => {
        const nameNormalized = normalizeText(p.name);
        const skuNormalized = normalizeText(p.sku);
        const supplierNormalized = normalizeText(p.supplier || '');
        
        const matches = nameNormalized.includes(searchTermNormalized) || 
                        skuNormalized.includes(searchTermNormalized) ||
                        supplierNormalized.includes(searchTermNormalized);

        if (matches && !uniqueProductNames.has(nameNormalized)) {
          uniqueProductNames.add(nameNormalized);
          return true;
        }
        return false;
      })
      .sort((a, b) => {
          // Prioridad 1: Si el producto está en la tienda actual
          const aInCurrent = a.storeId === currentStoreId;
          const bInCurrent = b.storeId === currentStoreId;
          if (aInCurrent && !bInCurrent) return -1;
          if (!aInCurrent && bInCurrent) return 1;
          
          // Prioridad 2: Orden alfabético
          return a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }, [productSearch, searchSource, currentStoreId]);
  
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestedProducts]);

  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    searchSource.forEach(product => {
      if (product.supplier && product.supplier.trim()) {
        suppliers.add(product.supplier.trim());
      }
    });
    return Array.from(suppliers).sort((a, b) => a.localeCompare(b));
  }, [searchSource]);

  const suggestedSuppliers = useMemo(() => {
    const searchTerm = normalizeText(supplier);
    if (!searchTerm) return [];
    return uniqueSuppliers.filter(s => normalizeText(s).includes(searchTerm));
  }, [supplier, uniqueSuppliers]);

  const handleSupplierKeyDown = (e: React.KeyboardEvent) => {
    if (showSupplierSuggestions && suggestedSuppliers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedSupplierIndex(prev => (prev + 1) % suggestedSuppliers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedSupplierIndex(prev => (prev - 1 + suggestedSuppliers.length) % suggestedSuppliers.length);
      } else if (e.key === 'Enter') {
        if (highlightedSupplierIndex >= 0) {
          e.preventDefault();
          handleSupplierSelect(suggestedSuppliers[highlightedSupplierIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSupplierSuggestions(false);
      }
    }
  };

  const handleSupplierSelect = (selectedSupplier: string) => {
    setSupplier(selectedSupplier);
    setShowSupplierSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestedProducts.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % suggestedProducts.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + suggestedProducts.length) % suggestedProducts.length);
        } else if (e.key === 'Enter') {
            if (highlightedIndex >= 0) {
                e.preventDefault();
                handleProductSelect(suggestedProducts[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    }
  };

  const handleProductSelect = (product: Product) => {
    setProductSearch(product.name);
    setSelectedProduct(product);
    setSupplier(product.supplier || '');
    setIsCreatingNew(false);
    setShowSuggestions(false);

    const nameToMatch = normalizeText(product.name);
    const allInstances = searchSource.filter(p => normalizeText(p.name) === nameToMatch);
    
    setStoreData(prevStoreData => {
        const newStoreData = { ...prevStoreData };
        Object.keys(newStoreData).forEach(storeId => {
            const instanceForThisStore = allInstances.find(p => p.storeId === storeId);
            
            if (instanceForThisStore) {
                newStoreData[storeId] = {
                    ...newStoreData[storeId],
                    cost: instanceForThisStore.cost.toString(),
                    price: instanceForThisStore.price.toString(),
                };
            } else {
                newStoreData[storeId] = {
                    ...newStoreData[storeId],
                    cost: product.cost.toString(),
                    price: product.price.toString(),
                };
            }
        });
        return newStoreData;
    });
  };
  
  const handleInputChange = (storeId: string, field: 'quantity' | 'cost' | 'price', value: string) => {
    setStoreData(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], [field]: value }
    }));
  };

  const handleStoreToggle = (storeId: string) => {
    setStoreData(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], selected: !prev[storeId].selected }
    }));
  };

  const applyToAll = (field: 'quantity' | 'cost' | 'price') => {
    const firstSelectedStoreId = Object.keys(storeData).find(id => storeData[id].selected);
    if (!firstSelectedStoreId) return;

    const valueToApply = storeData[firstSelectedStoreId][field];
    if (valueToApply) {
        setStoreData(prev => {
            const newData = { ...prev };
            Object.keys(newData).forEach(idStr => {
                if (newData[idStr].selected) {
                    newData[idStr][field] = valueToApply;
                }
            });
            return newData;
        });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const productName = (selectedProduct ? selectedProduct.name : productSearch).trim();
      if (!productName) {
        throw new Error('Por favor, busca o escribe el nombre de un producto.');
      }
  
      if (isCreatingNew && !newProductCategoryId) {
        throw new Error('Por favor, selecciona una categoría para el nuevo producto.');
      }
  
      const storeEntries: Record<string, { quantity: number; cost: number; price: number; supplier: string }> = {};
      const selectedStores = Object.entries(storeData).filter(([, data]) => (data as { selected: boolean }).selected);
  
      if (selectedStores.length === 0) {
        throw new Error('Debes seleccionar al menos una tienda.');
      }
      
      let isValid = true;
      selectedStores.forEach(([storeId, data]) => {
        const typedData = data as { quantity: string; cost: string; price: string; };
        const quantity = parseInt(typedData.quantity, 10);
        const cost = parseFloat(typedData.cost);
        const price = parseFloat(typedData.price);
        if (isNaN(quantity) || quantity <= 0 || isNaN(cost) || cost < 0 || isNaN(price) || price < 0) {
          isValid = false;
        }
        storeEntries[storeId] = { quantity, cost, price, supplier: supplier.trim() || 'N/A' };
      });
      
      if (!isValid) {
        throw new Error('Por favor, completa todos los campos (Cantidad, Costo, Precio) con valores válidos.');
      }
  
      const baseProduct = searchSource.find(p => normalizeText(p.name) === normalizeText(productName));

      if (!isCreatingNew && !baseProduct) {
        throw new Error(`Producto no encontrado. Si es nuevo, pulsa "Confirmar Creación".`);
      }
  
      await onMultiStorePurchase({
        productInfo: {
          name: baseProduct ? baseProduct.name : productName,
          categoryId: isCreatingNew ? newProductCategoryId : baseProduct!.categoryId,
        },
        storeEntries,
      });
      
      resetForm();
      setSuccessMessage('Compras registradas y stock actualizado correctamente.');

    } catch (error: any) {
        alert(error.message);
        console.error("Submit failed:", error);
    }
  };
  
  const filteredPurchases = useMemo(() => {
    const searchTermNormalized = normalizeText(historySearchTerm);
    const productMap = new Map(inventory.map(p => [p.id, p]));

    return purchases.filter(p => {
      const purchaseDate = new Date(p.createdAt);
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      const matchesStartDate = start ? purchaseDate >= start : true;
      const matchesEndDate = end ? purchaseDate <= end : true;
      
      const matchesSearch = searchTermNormalized ? 
          normalizeText(p.productName).includes(searchTermNormalized) ||
          normalizeText(p.supplier).includes(searchTermNormalized)
          : true;

      const product = productMap.get(p.productId) as Product | undefined;
      const matchesCategory = categoryFilter ? (product && product.categoryId === categoryFilter) : true;

      return matchesStartDate && matchesEndDate && matchesSearch && matchesCategory;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [purchases, startDate, endDate, historySearchTerm, categoryFilter, inventory]);

  const totals = useMemo(() => {
    return filteredPurchases.reduce(
      (acc, purchase) => {
        acc.totalQuantity += purchase.quantity;
        acc.totalCostValue += purchase.totalCost;
        return acc;
      },
      { totalQuantity: 0, totalCostValue: 0 }
    );
  }, [filteredPurchases]);

  const productExists = useMemo(() => {
      const searchNormalized = normalizeText(productSearch);
      return searchNormalized !== '' && searchSource.some(p => normalizeText(p.name) === searchNormalized);
  }, [searchSource, productSearch]);

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg space-y-6">
          <h2 className="text-2xl font-bold text-accent border-b-2 border-accent/30 pb-2">Registrar Compra Multi-tienda</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <label htmlFor="product" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Buscar o Crear Producto</label>
              <div className="relative">
                 <input type="text" id="product" value={productSearch}
                    onChange={e => {
                        setProductSearch(e.target.value);
                        setSelectedProduct(null);
                        setIsCreatingNew(false);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-gray-100 dark:bg-gray-800 p-2 pl-10 pr-10 rounded-md outline-none focus:ring-2 focus:ring-accent" placeholder="Escribe el nombre, SKU o marca..." autoComplete="off"
                 />
                 <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                 {productSearch && (
                    <button
                        type="button"
                        onClick={() => setProductSearch('')}
                        className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                        aria-label="Limpiar búsqueda"
                    >
                        <CrossIcon className="w-5 h-5" />
                    </button>
                 )}
              </div>
              {showSuggestions && suggestedProducts.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestedProducts.map((p, index) => {
                        const isCurrentStore = p.storeId === currentStoreId;
                        return (
                            <li key={p.id}
                                className={`p-2 flex items-center justify-between cursor-pointer ${index === highlightedIndex ? 'bg-accent/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                onMouseDown={() => handleProductSelect(p)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                            >
                                <div className="flex flex-col">
                                    <span className="font-bold">{p.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">{p.sku} • {p.supplier || 'Sin Marca'}</span>
                                </div>
                                {isCurrentStore && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                        <BuildingStorefrontIcon className="w-3 h-3" /> Aquí
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
              )}
            </div>
             <div className="relative">
              <label htmlFor="supplier" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Proveedor</label>
              <input 
                type="text" 
                id="supplier" 
                value={supplier} 
                onChange={e => {
                  setSupplier(e.target.value);
                  setShowSupplierSuggestions(true);
                }}
                onFocus={() => setShowSupplierSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                onKeyDown={handleSupplierKeyDown}
                className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md outline-none focus:ring-2 focus:ring-accent" 
                placeholder="Nombre del proveedor"
                autoComplete="off"
              />
              {showSupplierSuggestions && suggestedSuppliers.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {suggestedSuppliers.map((s, index) => (
                    <li 
                      key={s}
                      className={`p-2 cursor-pointer text-sm ${index === highlightedSupplierIndex ? 'bg-accent/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      onMouseDown={() => handleSupplierSelect(s)}
                      onMouseEnter={() => setHighlightedSupplierIndex(index)}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {isCreatingNew && (
             <div className="bg-accent/10 p-3 rounded-lg border border-accent/20 animate-fade-in">
                <label htmlFor="category" className="block text-sm font-bold text-accent mb-1">Categoría para "{productSearch.trim()}"</label>
                <select id="category" value={newProductCategoryId} onChange={e => setNewProductCategoryId(e.target.value)} className="w-full md:w-1/2 bg-white dark:bg-gray-800 p-2 rounded-md border border-accent/30" required>
                    <option value="" disabled>Selecciona una categoría</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <p className="text-[10px] text-accent mt-1 italic">El producto se creará en el sistema una vez que registres la compra.</p>
             </div>
          )}

          <div>
             <h3 className="text-lg font-bold text-gray-800 dark:text-text-light mb-2">Gestionar Compra por Tienda</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {stores.map(store => (
                     <div key={store.id} className={`p-4 rounded-lg transition-all ${storeData[store.id]?.selected ? 'bg-accent/10 ring-2 ring-accent shadow-lg shadow-accent/5' : 'bg-gray-100 dark:bg-gray-800'}`}>
                         <label className="flex items-center space-x-3 cursor-pointer">
                           <input type="checkbox" checked={storeData[store.id]?.selected || false} onChange={() => handleStoreToggle(store.id)} className="h-5 w-5 rounded text-accent focus:ring-accent" />
                           <span className="font-bold text-lg">{store.name}</span>
                         </label>
                         {storeData[store.id]?.selected && (
                            <div className="mt-3 space-y-2 animate-fade-in">
                                <div>
                                    <label className="text-xs font-medium">Cantidad</label>
                                    <input type="number" value={storeData[store.id].quantity} onChange={e => handleInputChange(store.id, 'quantity', e.target.value)} className="w-full bg-white dark:bg-gray-700 p-1.5 rounded-md text-sm border focus:border-accent" min="1"/>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Costo Unitario</label>
                                    <input type="number" value={storeData[store.id].cost} onChange={e => handleInputChange(store.id, 'cost', e.target.value)} className="w-full bg-white dark:bg-gray-700 p-1.5 rounded-md text-sm border focus:border-accent" min="0" step="1"/>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Precio Venta</label>
                                    <input type="number" value={storeData[store.id].price} onChange={e => handleInputChange(store.id, 'price', e.target.value)} className="w-full bg-white dark:bg-gray-700 p-1.5 rounded-md text-sm border focus:border-accent" min="0" step="1"/>
                                </div>
                            </div>
                         )}
                     </div>
                 ))}
             </div>
             <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => applyToAll('quantity')} className="text-[10px] px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 transition-colors uppercase font-bold text-gray-600 dark:text-gray-300">Aplicar Cant. a todos</button>
                <button type="button" onClick={() => applyToAll('cost')} className="text-[10px] px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 transition-colors uppercase font-bold text-gray-600 dark:text-gray-300">Aplicar Costo a todos</button>
                <button type="button" onClick={() => applyToAll('price')} className="text-[10px] px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 transition-colors uppercase font-bold text-gray-600 dark:text-gray-300">Aplicar Precio a todos</button>
             </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t-2 border-gray-200 dark:border-gray-700 gap-3">
            {productSearch.trim() && !productExists && !isCreatingNew && (
                <button type="button" onClick={() => setIsCreatingNew(true)} className="bg-yellow-500 text-white font-bold py-2.5 px-6 rounded-lg shadow-lg hover:bg-yellow-600 transition-all active:scale-95">
                  Confirmar Creación de "{productSearch.trim()}"
                </button>
            )}
            <button type="submit" className="bg-accent text-white font-bold py-2.5 px-8 rounded-lg flex items-center space-x-2 hover:bg-accent-hover shadow-lg transition-all active:scale-95">
              <PlusCircleIcon />
              <span>Registrar Compra</span>
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg mt-8">
          <h2 className="text-2xl font-bold text-accent mb-4 border-b-2 border-accent/30 pb-2">Historial de Compras (Tienda Actual)</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative md:col-span-2">
                <input
                  type="text"
                  placeholder="Buscar por producto o proveedor..."
                  value={historySearchTerm}
                  onChange={e => setHistorySearchTerm(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent outline-none"
                />
                <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400">
                  <SearchIcon />
                </div>
              </div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-sm" title="Fecha de inicio"/>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-sm" title="Fecha de fin"/>
              </div>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                          <th className="p-3 text-xs font-black uppercase text-gray-500 tracking-wider">Fecha</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-500 tracking-wider">Producto</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-500 tracking-wider">Proveedor</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-500 tracking-wider text-center">Cant.</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-500 tracking-wider text-right">Costo Unit.</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-500 tracking-wider text-right">Costo Total</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-500 tracking-wider text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredPurchases.map((purchase) => (
                          <tr key={purchase.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="p-3 text-sm whitespace-nowrap text-gray-500">{new Date(purchase.createdAt).toLocaleString()}</td>
                              <td className="p-3 font-bold">{purchase.productName}</td>
                              <td className="p-3 text-sm text-gray-500 dark:text-text-dark">{purchase.supplier}</td>
                              <td className="p-3 text-center font-semibold">{purchase.quantity}</td>
                              <td className="p-3 text-right">{formatCOP(purchase.cost)}</td>
                              <td className="p-3 text-right font-bold text-accent">{formatCOP(purchase.totalCost)}</td>
                              <td className="p-3 text-center">
                                  <div className="flex justify-center items-center space-x-2">
                                      <button onClick={() => setEditingPurchase(purchase)} className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors">
                                          <EditIcon className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => onDeletePurchase(purchase.id)} className="text-gray-500 dark:text-text-dark hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors">
                                          <TrashIcon className="w-4 h-4" />
                                      </button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
                   <tfoot>
                    <tr className="bg-gray-200 dark:bg-gray-900 font-black">
                      <td colSpan={3} className="p-3 text-right text-xs uppercase tracking-widest text-gray-500">Totales:</td>
                      <td className="p-3 text-center text-sm">{totals.totalQuantity}</td>
                      <td className="p-3"></td>
                      <td className="p-3 text-right text-accent text-base">{formatCOP(totals.totalCostValue)}</td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
              </table>
          </div>
        </div>
      </div>
      
      {editingPurchase && (
        <EditPurchaseModal
            purchase={editingPurchase}
            product={inventory.find(p => p.id === editingPurchase.productId)!}
            isOpen={!!editingPurchase}
            onClose={() => setEditingPurchase(null)}
            onUpdatePurchase={onUpdatePurchase}
        />
      )}
      {successMessage && (
        <div className="fixed bottom-5 right-5 bg-green-600 text-white py-3 px-5 rounded-lg shadow-lg flex items-center animate-fade-in-out z-[100]">
          <CheckIcon className="w-6 h-6 mr-3" />
          <span>{successMessage}</span>
        </div>
      )}
    </>
  );
};

export default PurchasesView;
