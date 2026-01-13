
import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, Product, Category, Store } from '../types';
import { PlusCircleIcon, EditIcon, TrashIcon, SearchIcon, CheckIcon, CrossIcon, BuildingStorefrontIcon, PackageIcon, CameraIcon } from './Icons';
import { formatCOP, toTitleCase } from '../constants';
import EditPurchaseModal from './EditPurchaseModal';
import EditProductImageModal from './EditProductImageModal';

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
  onUpdateProduct: (updatedProduct: Product, imageFile?: File) => Promise<void>;
}

interface BatchPurchaseItem {
    id: string;
    productName: string;
    categoryId: string;
    isNew: boolean;
    supplier: string;
    storeEntries: Record<string, { quantity: number; cost: number; price: number; }>;
}

const PurchasesView: React.FC<PurchasesViewProps> = ({ purchases, inventory, allInventoryForSearch, categories, stores, currentStoreId, onMultiStorePurchase, onUpdatePurchase, onDeletePurchase, onUpdateProduct }) => {
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
  const [editingProductImage, setEditingProductImage] = useState<Product | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Batch purchase state
  const [batchItems, setBatchItems] = useState<BatchPurchaseItem[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

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

  const resetEntryForm = () => {
    setProductSearch('');
    setSelectedProduct(null);
    setIsCreatingNew(false);
    setNewProductCategoryId('');
    setStoreData(stores.reduce((acc, store) => {
      acc[store.id] = { 
          selected: store.id === currentStoreId || (storeData[store.id]?.selected), 
          quantity: '', 
          cost: storeData[store.id]?.cost || '', 
          price: storeData[store.id]?.price || '' 
      };
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
          const aInCurrent = a.storeId === currentStoreId;
          const bInCurrent = b.storeId === currentStoreId;
          if (aInCurrent && !bInCurrent) return -1;
          if (!aInCurrent && bInCurrent) return 1;
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
    setProductSearch(toTitleCase(product.name));
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

  const handleProcessBatch = async () => {
    if (batchItems.length === 0) return;
    if (!window.confirm(`¿Seguro que deseas procesar la compra de ${batchItems.length} productos diferentes?`)) return;

    setIsProcessingBatch(true);
    try {
        for (const item of batchItems) {
            const mappedStoreEntries: Record<string, { quantity: number; cost: number; price: number; supplier: string }> = {};
            Object.entries(item.storeEntries).forEach(([sid, data]) => {
                // FIX: Explicitly typed 'data' by casting to its object structure to allow spread operation, resolving 'Spread types may only be created from object types' error.
                mappedStoreEntries[sid] = { ...(data as { quantity: number; cost: number; price: number }), supplier: item.supplier };
            });

            await onMultiStorePurchase({
                productInfo: { name: toTitleCase(item.productName), categoryId: item.categoryId },
                storeEntries: mappedStoreEntries,
            });
        }
        setBatchItems([]);
        setSuccessMessage('Lote de compras procesado con éxito.');
    } catch (error: any) {
        alert("Error procesando lote: " + error.message);
    } finally {
        setIsProcessingBatch(false);
    }
  };

  const handleAddToBatch = () => {
    try {
      const productName = (selectedProduct ? selectedProduct.name : productSearch).trim();
      if (!productName) throw new Error('Escribe el nombre del producto.');
      if (isCreatingNew && !newProductCategoryId) throw new Error('Selecciona una categoría.');
      
      const selectedStores = Object.entries(storeData).filter(([, data]) => (data as { selected: boolean }).selected);
      if (selectedStores.length === 0) throw new Error('Selecciona al menos una tienda.');

      const storeEntries: Record<string, { quantity: number; cost: number; price: number; }> = {};
      selectedStores.forEach(([storeId, data]) => {
        const typedData = data as { quantity: string; cost: string; price: string; };
        const quantity = parseInt(typedData.quantity, 10);
        const cost = parseFloat(typedData.cost);
        const price = parseFloat(typedData.price);
        if (isNaN(quantity) || quantity <= 0 || isNaN(cost) || cost < 0 || isNaN(price) || price < 0) {
          throw new Error('Valores numéricos inválidos detectados.');
        }
        storeEntries[storeId] = { quantity, cost, price };
      });

      const baseProduct = searchSource.find(p => normalizeText(p.name) === normalizeText(productSearch));
      if (!isCreatingNew && !baseProduct) {
          throw new Error(`Producto no encontrado. Marca "Confirmar Creación".`);
      }

      const newItem: BatchPurchaseItem = {
          id: Math.random().toString(36).substr(2, 9),
          productName: toTitleCase(baseProduct ? baseProduct.name : productName),
          categoryId: isCreatingNew ? newProductCategoryId : baseProduct!.categoryId,
          isNew: isCreatingNew,
          supplier: supplier.trim() || 'N/A',
          storeEntries
      };

      setBatchItems(prev => [...prev, newItem]);
      resetEntryForm();
    } catch (e: any) {
        alert(e.message);
    }
  };

  const handleRemoveFromBatch = (id: string) => {
      setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const batchTotalItems = batchItems.length;
  // FIX: Cast Object.values(item.storeEntries) to ensure numeric calculations and avoid 'unknown' type errors during reduction.
  const batchTotalCost = batchItems.reduce((sum: number, item: BatchPurchaseItem): number => {
      const entries = Object.values(item.storeEntries) as Array<{ quantity: number; cost: number; price: number }>;
      const itemCost = entries.reduce((iSum: number, sData) => iSum + (sData.cost * sData.quantity), 0);
      return sum + itemCost;
  }, 0);
  
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
        <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg space-y-6 border-l-8 border-accent">
          <h2 className="text-2xl font-black text-accent border-b-2 border-accent/30 pb-2 flex items-center gap-2">
              <PackageIcon className="w-8 h-8" />
              Ingreso de Mercancía
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <label htmlFor="product" className="block text-sm font-bold text-gray-500 dark:text-text-dark mb-1">Producto a Ingresar</label>
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
                    className="w-full bg-gray-100 dark:bg-gray-800 p-3 pl-10 pr-10 rounded-xl outline-none focus:ring-2 focus:ring-accent font-bold" placeholder="Nombre, SKU o Marca..." autoComplete="off"
                 />
                 <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400"/>
                 {productSearch && (
                    <button type="button" onClick={() => setProductSearch('')} className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500"><CrossIcon className="w-5 h-5" /></button>
                 )}
              </div>
              {showSuggestions && suggestedProducts.length > 0 && (
                <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                    {suggestedProducts.map((p, index) => {
                        const isCurrentStore = p.storeId === currentStoreId;
                        return (
                            <li key={p.id}
                                className={`p-3 flex items-center justify-between cursor-pointer border-b last:border-0 dark:border-gray-700 ${index === highlightedIndex ? 'bg-accent/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                onMouseDown={() => handleProductSelect(p)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700" onClick={(e) => { e.stopPropagation(); if(p.imageUrl) setPreviewImage(p.imageUrl); }}>
                                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageIcon className="w-5 h-5 text-gray-400" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-sm uppercase">{p.name}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">{p.sku} • {p.supplier || 'Sin Marca'}</span>
                                    </div>
                                </div>
                                {isCurrentStore && (
                                    <span className="flex items-center gap-1 text-[10px] font-black text-accent bg-accent/10 px-2 py-1 rounded-full uppercase">
                                        <BuildingStorefrontIcon className="w-3 h-3" /> En stock local
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
              )}
            </div>
             <div className="relative">
              <label htmlFor="supplier" className="block text-sm font-bold text-gray-500 dark:text-text-dark mb-1">Proveedor (Se mantiene para el lote)</label>
              <input type="text" id="supplier" value={supplier}
                onChange={e => { setSupplier(e.target.value); setShowSupplierSuggestions(true); }}
                onFocus={() => setShowSupplierSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                onKeyDown={handleSupplierKeyDown}
                className="w-full bg-gray-100 dark:bg-gray-800 p-3 rounded-xl outline-none focus:ring-2 focus:ring-accent font-bold" placeholder="Escribe el proveedor..." autoComplete="off"
              />
              {showSupplierSuggestions && suggestedSuppliers.length > 0 && (
                <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                  {suggestedSuppliers.map((s, index) => (
                    <li key={s} className={`p-2 cursor-pointer text-sm ${index === highlightedSupplierIndex ? 'bg-accent/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} onMouseDown={() => handleSupplierSelect(s)} onMouseEnter={() => setHighlightedSupplierIndex(index)}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {isCreatingNew && (
             <div className="bg-yellow-500/10 p-4 rounded-xl border-2 border-dashed border-yellow-500/50 animate-fade-in">
                <label htmlFor="category" className="block text-sm font-black text-yellow-600 dark:text-yellow-400 mb-1 uppercase tracking-tighter">Categoría Requerida para "{productSearch.trim()}"</label>
                <select id="category" value={newProductCategoryId} onChange={e => setNewProductCategoryId(e.target.value)} className="w-full md:w-1/2 bg-white dark:bg-gray-800 p-2 rounded-lg border-2 border-yellow-500/30" required>
                    <option value="" disabled>Selecciona una categoría...</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
             </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
             <h3 className="text-lg font-black text-gray-800 dark:text-text-light mb-4 flex items-center gap-2">
                 <BuildingStorefrontIcon className="w-5 h-5 text-accent" />
                 Distribución por Tiendas
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {stores.map(store => (
                     <div key={store.id} className={`p-4 rounded-xl transition-all duration-300 ${storeData[store.id]?.selected ? 'bg-accent/5 ring-2 ring-accent' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-60'}`}>
                         <label className="flex items-center space-x-3 cursor-pointer mb-3">
                           <input type="checkbox" checked={storeData[store.id]?.selected || false} onChange={() => handleStoreToggle(store.id)} className="h-5 w-5 rounded text-accent focus:ring-accent" />
                           <span className="font-black text-sm uppercase tracking-tight">{store.name}</span>
                         </label>
                         {storeData[store.id]?.selected && (
                            <div className="space-y-2 animate-fade-in">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Cant.</span>
                                    <input type="number" value={storeData[store.id].quantity} onChange={e => handleInputChange(store.id, 'quantity', e.target.value)} className="w-20 bg-white dark:bg-gray-700 p-1.5 rounded-lg text-center font-bold text-sm border focus:border-accent" min="1"/>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Costo</span>
                                    <input type="number" value={storeData[store.id].cost} onChange={e => handleInputChange(store.id, 'cost', e.target.value)} className="w-28 bg-white dark:bg-gray-700 p-1.5 rounded-lg text-right font-bold text-sm border focus:border-accent" min="0" step="1000"/>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Venta</span>
                                    <input type="number" value={storeData[store.id].price} onChange={e => handleInputChange(store.id, 'price', e.target.value)} className="w-28 bg-white dark:bg-gray-700 p-1.5 rounded-lg text-right font-bold text-sm border focus:border-accent" min="0" step="1000"/>
                                </div>
                            </div>
                         )}
                     </div>
                 ))}
             </div>
             <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => applyToAll('quantity')} className="text-[9px] px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-accent hover:text-white transition-all font-black uppercase tracking-tighter">Copiar Cantidades</button>
                <button type="button" onClick={() => applyToAll('cost')} className="text-[9px] px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-accent hover:text-white transition-all font-black uppercase tracking-tighter">Copiar Costos</button>
                <button type="button" onClick={() => applyToAll('price')} className="text-[9px] px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-accent hover:text-white transition-all font-black uppercase tracking-tighter">Copiar Precios</button>
             </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t-2 border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex gap-2">
                {productSearch.trim() && !productExists && !isCreatingNew && (
                    <button type="button" onClick={() => setIsCreatingNew(true)} className="bg-yellow-500 text-white font-black py-2 px-4 rounded-xl shadow-lg hover:bg-yellow-600 transition-all uppercase text-xs tracking-tighter">
                      Confirmar Nuevo Producto
                    </button>
                )}
            </div>
            <button type="button" onClick={handleAddToBatch} className="w-full sm:w-auto bg-accent text-white font-black py-3 px-10 rounded-2xl flex items-center justify-center gap-2 hover:bg-accent-hover shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm">
              <PlusCircleIcon className="w-6 h-6" />
              Añadir a Lote Actual
            </button>
          </div>
        </div>

        {/* BATCH VIEW */}
        {batchItems.length > 0 && (
            <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl border-2 border-accent/20 overflow-hidden animate-slide-up">
                <div className="p-4 bg-accent text-white flex justify-between items-center">
                    <h3 className="font-black uppercase tracking-widest flex items-center gap-2">
                        <CheckIcon className="w-5 h-5"/>
                        Lote de Compras ({batchTotalItems})
                    </h3>
                    <p className="font-black text-lg">{formatCOP(batchTotalCost)}</p>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y dark:divide-gray-700">
                    {batchItems.map((item) => (
                        <div key={item.id} className="p-3 flex justify-between items-center bg-accent/5 hover:bg-accent/10 transition-colors">
                            <div>
                                <p className="font-black text-sm uppercase">{item.productName}</p>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">{item.supplier} • {Object.keys(item.storeEntries).length} Tiendas</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="font-black text-accent text-sm">
                                        {/* FIX: Cast Object.values to ensure numeric result and avoid 'unknown' type errors from the reduce method. */}
                                        {formatCOP((Object.values(item.storeEntries) as Array<{ quantity: number; cost: number; price: number }>).reduce((sum: number, sData) => sum + (sData.cost * sData.quantity), 0))}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                                        {/* FIX: Cast Object.values to ensure numeric result and avoid 'unknown' type errors when summing quantities. */}
                                        Total Unidades: {(Object.values(item.storeEntries) as Array<{ quantity: number; cost: number; price: number }>).reduce((sum: number, s) => sum + s.quantity, 0)}
                                    </p>
                                </div>
                                <button onClick={() => handleRemoveFromBatch(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 flex justify-end">
                    <button onClick={handleProcessBatch} disabled={isProcessingBatch} className="bg-green-600 text-white font-black py-3 px-12 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95 uppercase tracking-widest disabled:opacity-50">
                        {isProcessingBatch ? 'Procesando Lote...' : `Procesar Lote Completo`}
                    </button>
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-secondary p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800">
          <h2 className="text-2xl font-black text-gray-800 dark:text-text-light mb-6 border-b dark:border-gray-700 pb-2">Historial de Compras</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="relative md:col-span-2">
                <input type="text" placeholder="Buscar por producto o marca..." value={historySearchTerm} onChange={e => setHistorySearchTerm(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 pl-10 focus:ring-2 focus:ring-accent outline-none font-bold" />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-accent">
                <option value="">Todas las categorías</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700"/>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700"/>
              </div>
          </div>
          <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
              <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                      <tr>
                          <th className="p-3 text-xs font-black uppercase text-gray-400 tracking-widest">Foto</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-400 tracking-widest">Fecha</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-400 tracking-widest">Producto</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-400 tracking-widest">Proveedor</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-400 tracking-widest text-center">Cant.</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-400 tracking-widest text-right">Costo Unit.</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-400 tracking-widest text-right">Costo Total</th>
                          <th className="p-3 text-xs font-black uppercase text-gray-400 tracking-widest text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredPurchases.map((purchase) => {
                          const product = inventory.find(p => p.id === purchase.productId);
                          return (
                          <tr key={purchase.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 group">
                              <td className="p-3">
                                  <div className="relative w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 overflow-hidden cursor-zoom-in" onClick={() => product?.imageUrl && setPreviewImage(product.imageUrl)}>
                                      {product?.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageIcon className="w-6 h-6 mx-auto mt-3 text-gray-300" />}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <SearchIcon className="w-4 h-4 text-white" />
                                      </div>
                                  </div>
                              </td>
                              <td className="p-3 text-xs font-bold text-gray-400 whitespace-nowrap">{new Date(purchase.createdAt).toLocaleDateString()}</td>
                              <td className="p-3">
                                  <p className="font-black text-gray-800 dark:text-gray-200 uppercase text-sm">{purchase.productName}</p>
                                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => product && setEditingProductImage(product)} className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent rounded flex items-center gap-1 font-bold">
                                          <CameraIcon className="w-2 h-2" /> Editar Foto
                                      </button>
                                  </div>
                              </td>
                              <td className="p-3 text-xs font-bold text-gray-500 uppercase">{purchase.supplier}</td>
                              <td className="p-3 text-center font-black text-gray-700 dark:text-gray-300">{purchase.quantity}</td>
                              <td className="p-3 text-right font-medium text-gray-500">{formatCOP(purchase.cost)}</td>
                              <td className="p-3 text-right font-black text-accent">{formatCOP(purchase.totalCost)}</td>
                              <td className="p-3 text-center">
                                  <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                      <button onClick={() => setEditingPurchase(purchase)} className="text-gray-400 hover:text-accent p-2 rounded-full hover:bg-accent/10"><EditIcon className="w-4 h-4" /></button>
                                      <button onClick={() => onDeletePurchase(purchase.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50"><TrashIcon className="w-4 h-4" /></button>
                                  </div>
                              </td>
                          </tr>
                      )})}
                  </tbody>
                   <tfoot className="bg-gray-100 dark:bg-gray-900">
                    <tr className="font-black">
                      <td colSpan={4} className="p-3 text-right text-xs uppercase tracking-widest text-gray-500">Totales del Periodo:</td>
                      <td className="p-3 text-center text-sm">{totals.totalQuantity}</td>
                      <td className="p-3"></td>
                      <td className="p-3 text-right text-accent text-lg">{formatCOP(totals.totalCostValue)}</td>
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

      {editingProductImage && (
        <EditProductImageModal 
            isOpen={!!editingProductImage}
            onClose={() => setEditingProductImage(null)}
            product={editingProductImage}
            onUpdateProduct={onUpdateProduct}
        />
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-4xl w-full aspect-square bg-white rounded-2xl overflow-hidden border-4 border-accent shadow-2xl">
                <img src={previewImage} alt="Zoom" className="w-full h-full object-contain" />
                <button className="absolute top-4 right-4 bg-black/50 text-white p-3 rounded-full hover:bg-accent transition-colors"><CrossIcon className="w-6 h-6" /></button>
            </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-5 right-5 bg-green-600 text-white py-3 px-5 rounded-lg shadow-lg flex items-center animate-fade-in-out z-[100]">
          <CheckIcon className="w-6 h-6 mr-3" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}
    </>
  );
};

export default PurchasesView;
