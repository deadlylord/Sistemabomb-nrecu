
import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, Product, Category, Store } from '../types';
import { PlusCircleIcon, EditIcon, TrashIcon, SearchIcon, CheckIcon, CrossIcon, BuildingStorefrontIcon, PackageIcon, CameraIcon, PlusIcon, HistoryIcon, CopyIcon, TagIcon } from './Icons';
import { formatCOP, encodePrice } from '../constants';
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
  onLoadFullHistory?: () => void;
  isFullHistoryLoaded?: boolean;
}

interface BatchPurchaseItem {
    id: string;
    productId?: string;
    productName: string;
    imageUrl?: string;
    categoryId: string;
    isNew: boolean;
    supplier: string;
    storeEntries: Record<string, { quantity: string; cost: string; price: string; }>;
}

type HistorySortKey = 'createdAt' | 'productName' | 'supplier' | 'storeId' | 'quantity' | 'totalCost';

const toYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const PurchasesView: React.FC<PurchasesViewProps> = ({ purchases, inventory, allInventoryForSearch, categories, stores, currentStoreId, onMultiStorePurchase, onUpdatePurchase, onDeletePurchase, onUpdateProduct, onLoadFullHistory, isFullHistoryLoaded }) => {
  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeStoreIds, setActiveStoreIds] = useState<string[]>([currentStoreId]);
  const [globalSupplier, setGlobalSupplier] = useState('');
  const [showGlobalSupplierSuggestions, setShowGlobalSupplierSuggestions] = useState(false);
  const [itemSupplierSearchId, setItemSupplierSearchId] = useState<string | null>(null);
  
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editingProductImage, setEditingProductImage] = useState<Product | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [labelPurchase, setLabelPurchase] = useState<Purchase | null>(null);
  const [labelQuantity, setLabelQuantity] = useState(1);
  
  const [startDate, setStartDate] = useState(toYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(toYYYYMMDD(new Date()));
  
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [historySortConfig, setHistorySortConfig] = useState<{ key: HistorySortKey, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [successMessage, setSuccessMessage] = useState('');

  const [batchItems, setBatchItems] = useState<BatchPurchaseItem[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  const normalizeText = (text: string) => (text || '').toLowerCase().trim().replace(/\s\s+/g, ' ');

  const searchSource = useMemo(() => {
    const globalList = allInventoryForSearch || [];
    const unified = [...globalList];
    const existingIds = new Set(unified.map(p => p.id));
    inventory.forEach(p => { if (!existingIds.has(p.id)) unified.push(p); });
    return unified;
  }, [allInventoryForSearch, inventory]);

  const existingSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    searchSource.forEach(p => {
        if (p.supplier) suppliers.add(p.supplier.trim());
    });
    return Array.from(suppliers).sort((a, b) => a.localeCompare(b));
  }, [searchSource]);

  const filteredGlobalSupplierSuggestions = useMemo(() => {
    if (!globalSupplier) return [];
    const norm = normalizeText(globalSupplier);
    return existingSuppliers.filter(s => normalizeText(s).includes(norm)).slice(0, 8);
  }, [globalSupplier, existingSuppliers]);

  const suggestedProducts = useMemo(() => {
    const searchTermNormalized = normalizeText(productSearch);
    if (!searchTermNormalized) return [];
    const uniqueProductNames = new Set<string>();
    return searchSource
      .filter(p => {
        const nameNormalized = normalizeText(p.name);
        const skuNormalized = normalizeText(p.sku);
        const matches = nameNormalized.includes(searchTermNormalized) || skuNormalized.includes(searchTermNormalized);
        if (matches && !uniqueProductNames.has(nameNormalized)) {
          uniqueProductNames.add(nameNormalized);
          return true;
        }
        return false;
      })
      .slice(0, 15);
  }, [productSearch, searchSource]);

  const handleProductSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const formatted = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    setProductSearch(formatted);
    setShowSuggestions(true);
  };

  const handleToggleActiveStore = (id: string) => {
      setActiveStoreIds(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(sid => sid !== id) : prev) : [...prev, id]);
  };

  const handleProductSelect = (product: Product, targetStoreId: string | 'ALL') => {
    const existingInBatch = batchItems.find(item => item.productName.toLowerCase() === product.name.toLowerCase());
    
    if (existingInBatch) {
        setBatchItems(prev => prev.map(item => {
            if (item.id === existingInBatch.id) {
                const newEntries = { ...item.storeEntries };
                const storesToAdd = targetStoreId === 'ALL' ? activeStoreIds : [targetStoreId];
                
                storesToAdd.forEach(sid => {
                    if (!newEntries[sid]) {
                        const instanceInStore = searchSource.find(p => p.name.toLowerCase() === product.name.toLowerCase() && p.storeId === sid);
                        newEntries[sid] = {
                            quantity: '1',
                            cost: (instanceInStore?.cost || product.cost).toString(),
                            price: (instanceInStore?.price || product.price).toString()
                        };
                    } else {
                        newEntries[sid].quantity = (parseInt(newEntries[sid].quantity || '0') + 1).toString();
                    }
                });
                return { ...item, storeEntries: newEntries };
            }
            return item;
        }));
    } else {
        const defaultEntries: Record<string, { quantity: string; cost: string; price: string; }> = {};
        const storesToAdd = targetStoreId === 'ALL' ? activeStoreIds : [targetStoreId];
        
        storesToAdd.forEach(sid => {
            const instanceInStore = searchSource.find(p => p.name.toLowerCase() === product.name.toLowerCase() && p.storeId === sid);
            defaultEntries[sid] = {
                quantity: '1',
                cost: (instanceInStore?.cost || product.cost).toString(),
                price: (instanceInStore?.price || product.price).toString()
            };
        });

        const newItem: BatchPurchaseItem = {
            id: Math.random().toString(36).substr(2, 9),
            productId: product.id,
            productName: product.name,
            imageUrl: product.imageUrl,
            categoryId: product.categoryId,
            isNew: false,
            supplier: globalSupplier || product.supplier || '',
            storeEntries: defaultEntries
        };
        setBatchItems(prev => [newItem, ...prev]);
    }
  };

  const handleCreateNewFromSearch = () => {
      const name = productSearch.trim();
      if (!name) return;
      const defaultEntries: Record<string, { quantity: string; cost: string; price: string; }> = {};
      activeStoreIds.forEach(sid => {
          defaultEntries[sid] = { quantity: '1', cost: '', price: '' };
      });
      const newItem: BatchPurchaseItem = {
          id: Math.random().toString(36).substr(2, 9),
          productName: name,
          imageUrl: '',
          categoryId: '',
          isNew: true,
          supplier: globalSupplier || '',
          storeEntries: defaultEntries
      };
      setBatchItems(prev => [newItem, ...prev]);
      setProductSearch('');
      setShowSuggestions(false);
  };

  const handleUpdateBatchStoreEntry = (itemId: string, storeId: string, field: 'quantity' | 'cost' | 'price', value: string) => {
      setBatchItems(prev => prev.map(item => {
          if (item.id === itemId) {
              const currentEntries = { ...item.storeEntries };
              if (!currentEntries[storeId]) {
                  currentEntries[storeId] = { quantity: '0', cost: '', price: '' };
              }
              currentEntries[storeId] = { ...currentEntries[storeId], [field]: value };
              return { ...item, storeEntries: currentEntries };
          }
          return item;
      }));
  };

  const handleSyncValueAcrossStores = (itemId: string, field: 'quantity' | 'cost' | 'price', sourceStoreId: string) => {
      const item = batchItems.find(i => i.id === itemId);
      if (!item) return;
      const valueToCopy = item.storeEntries[sourceStoreId]?.[field];
      if (valueToCopy === undefined) return;

      setBatchItems(prev => prev.map(i => {
          if (i.id === itemId) {
              const newEntries = { ...i.storeEntries };
              activeStoreIds.forEach(sid => {
                  if (sid !== sourceStoreId) {
                      newEntries[sid] = {
                          ...(newEntries[sid] || { quantity: '0', cost: '', price: '' }),
                          [field]: valueToCopy
                      };
                  }
              });
              return { ...i, storeEntries: newEntries };
          }
          return i;
      }));
  };

  const handleRemoveFromBatch = (itemId: string) => setBatchItems(prev => prev.filter(item => item.id !== itemId));

  const handleUpdateBatchItem = (itemId: string, updates: Partial<BatchPurchaseItem>) => {
    setBatchItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
  };

  const totalsByStore = useMemo(() => {
      const totals: Record<string, number> = {};
      activeStoreIds.forEach(sid => totals[sid] = 0);
      batchItems.forEach(item => {
          Object.entries(item.storeEntries).forEach(([sid, entry]) => {
              const data = entry as any;
              if (activeStoreIds.includes(sid)) {
                  const q = parseInt(data.quantity) || 0;
                  const c = parseFloat(data.cost) || 0;
                  totals[sid] += (q * c);
              }
          });
      });
      return totals;
  }, [batchItems, activeStoreIds]);

  const handleProcessBatch = async () => {
    if (batchItems.length === 0) return;
    for (const item of batchItems) {
        if (!item.categoryId) { alert(`El producto "${item.productName}" no tiene categoría.`); return; }
        const hasQty = Object.entries(item.storeEntries).some(([sid, entry]) => activeStoreIds.includes(sid) && parseInt((entry as any).quantity) > 0);
        if (!hasQty) { alert(`El producto "${item.productName}" no tiene cantidades en las tiendas seleccionadas.`); return; }
    }

    setIsProcessingBatch(true);
    try {
        for (const item of batchItems) {
            const finalStoreEntries: Record<string, { quantity: number; cost: number; price: number; supplier: string }> = {};
            Object.entries(item.storeEntries).forEach(([sid, entry]) => {
                const data = entry as any;
                if (!activeStoreIds.includes(sid)) return;
                const qty = parseInt(data.quantity, 10);
                if (qty > 0) {
                    finalStoreEntries[sid] = {
                        quantity: qty,
                        cost: parseFloat(data.cost) || 0,
                        price: parseFloat(data.price) || 0,
                        supplier: item.supplier || globalSupplier || 'N/A'
                    };
                }
            });
            if (Object.keys(finalStoreEntries).length > 0) {
                await onMultiStorePurchase({
                    productInfo: { name: item.productName, categoryId: item.categoryId },
                    storeEntries: finalStoreEntries,
                });
            }
        }
        setBatchItems([]);
        setSuccessMessage('Lote procesado correctamente.');
    } catch (error: any) {
        alert("Error: " + error.message);
    } finally {
        setIsProcessingBatch(false);
    }
  };

  const filteredPurchases = useMemo(() => {
    const searchTermNormalized = normalizeText(historySearchTerm);
    const startOfMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    let result = purchases.filter(p => {
      const d = new Date(p.createdAt);
      
      if (!isFullHistoryLoaded && d < startOfMonthDate) return false;

      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      const matchesSearch = !searchTermNormalized || normalizeText(p.productName).includes(searchTermNormalized) || normalizeText(p.supplier).includes(searchTermNormalized);
      const matchesCategory = !categoryFilter || inventory.find(inv => inv.id === p.productId)?.categoryId === categoryFilter;
      
      return (!start || d >= start) && (!end || d <= end) && matchesSearch && matchesCategory;
    });

    const { key, direction } = historySortConfig;
    result.sort((a, b) => {
        let valA: any = a[key as keyof Purchase];
        let valB: any = b[key as keyof Purchase];

        if (key === 'createdAt') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
  }, [purchases, startDate, endDate, historySearchTerm, categoryFilter, inventory, isFullHistoryLoaded, historySortConfig]);

  const { totalHistoryQuantity, totalHistoryCost } = useMemo(() => {
    return filteredPurchases.reduce((acc, p) => ({
      totalHistoryQuantity: acc.totalHistoryQuantity + p.quantity,
      totalHistoryCost: acc.totalHistoryCost + p.totalCost
    }), { totalHistoryQuantity: 0, totalHistoryCost: 0 });
  }, [filteredPurchases]);

  const handleRequestSort = (key: HistorySortKey) => {
    setHistorySortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortHeader = ({ k, label }: { k: HistorySortKey, label: string }) => {
    const isSorted = historySortConfig.key === k;
    return (
        <th 
            className="p-3 text-[10px] font-black uppercase text-gray-400 cursor-pointer hover:text-accent transition-colors"
            onClick={() => handleRequestSort(k)}
        >
            <div className="flex items-center gap-1">
                {label}
                {isSorted && (
                    <span className="text-[8px]">{historySortConfig.direction === 'desc' ? '▼' : '▲'}</span>
                )}
            </div>
        </th>
    );
  };

  const currentMonthName = new Date().toLocaleString('es-CO', { month: 'long' });

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* SECTOR DE CONFIGURACIÓN Y BÚSQUEDA */}
      <div className="bg-white dark:bg-secondary p-6 rounded-2xl shadow-xl border-l-8 border-accent">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-6">
            <div className="space-y-4 w-full lg:w-1/2">
                <h2 className="text-2xl font-black text-accent flex items-center gap-2">
                    <PackageIcon className="w-8 h-8" />
                    Ingreso de Mercancía
                </h2>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tiendas donde vas a comprar hoy:</label>
                    <div className="flex flex-wrap gap-2">
                        {stores.map(s => (
                            <button 
                                key={s.id} 
                                onClick={() => handleToggleActiveStore(s.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-black transition-all border-2 ${activeStoreIds.includes(s.id) ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-transparent opacity-60'}`}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="w-full lg:w-1/3 relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Proveedor del Lote (Opcional)</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={globalSupplier} 
                        onChange={e => setGlobalSupplier(e.target.value)}
                        onFocus={() => setShowGlobalSupplierSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowGlobalSupplierSuggestions(false), 200)}
                        className="w-full bg-gray-100 dark:bg-gray-800 p-3 rounded-xl outline-none focus:ring-2 focus:ring-accent font-bold"
                        placeholder="Escribe el proveedor..."
                    />
                    {showGlobalSupplierSuggestions && filteredGlobalSupplierSuggestions.length > 0 && (
                        <div className="absolute z-[60] w-full mt-1 bg-white dark:bg-gray-900 border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                            {filteredGlobalSupplierSuggestions.map(s => (
                                <button key={s} onMouseDown={() => setGlobalSupplier(s)} className="w-full text-left p-3 hover:bg-accent/10 transition-colors font-bold text-xs uppercase border-b last:border-0 dark:border-gray-800">
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        <div className="relative">
            <div className="relative group">
                <input 
                    type="text" 
                    value={productSearch} 
                    onChange={handleProductSearchChange}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-gray-50 dark:bg-gray-800 p-5 pl-14 pr-10 rounded-2xl outline-none focus:ring-4 focus:ring-accent/20 font-black text-xl shadow-inner border-2 border-transparent focus:border-accent/30" 
                    placeholder="BUSCA Y SELECCIONA PRODUCTOS..."
                />
                <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-7 h-7 text-gray-400 group-focus-within:text-accent transition-colors"/>
                {productSearch && (
                    <button onClick={() => {setProductSearch(''); setShowSuggestions(false);}} className="absolute top-0 right-0 h-full w-12 text-gray-400 hover:text-accent"><CrossIcon className="w-6 h-6"/></button>
                )}
            </div>

            {showSuggestions && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900 border-2 border-accent/20 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                    {suggestedProducts.length > 0 ? (
                        <div className="max-h-[450px] overflow-y-auto divide-y dark:divide-gray-800">
                            {suggestedProducts.map((p) => (
                                <div key={p.id} className="p-4 flex flex-col sm:flex-row items-center justify-between hover:bg-accent/5 transition-colors gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div 
                                            className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0 cursor-zoom-in relative group/thumb"
                                            onClick={() => p.imageUrl && setPreviewImage(p.imageUrl)}
                                        >
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <PackageIcon className="w-8 h-8 text-gray-400" />
                                            )}
                                            {p.imageUrl && (
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                    <SearchIcon className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-black text-sm uppercase tracking-tight">{p.name}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{p.sku} • {p.supplier || 'Genérico'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        {activeStoreIds.map(sid => (
                                            <button 
                                                key={sid}
                                                onClick={() => handleProductSelect(p, sid)}
                                                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-[10px] font-black rounded-lg hover:bg-accent hover:text-white transition-all border border-transparent hover:border-accent"
                                            >
                                                + {stores.find(s => s.id === sid)?.name}
                                            </button>
                                        ))}
                                        <button 
                                            onClick={() => handleProductSelect(p, 'ALL')}
                                            className="px-4 py-1.5 bg-accent text-white text-[10px] font-black rounded-lg hover:bg-accent-hover shadow-md active:scale-95"
                                        >
                                            + TODAS LAS SELECCIONADAS
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : productSearch.length > 2 ? (
                        <div className="p-10 text-center space-y-4">
                            <p className="text-gray-500 font-medium italic">No se encontró "{productSearch}". ¿Es un producto nuevo?</p>
                            <button onClick={handleCreateNewFromSearch} className="bg-yellow-500 text-white font-black py-3 px-10 rounded-xl shadow-lg hover:bg-yellow-600 transition-all uppercase text-xs tracking-widest">
                                Crear y Añadir al Lote
                            </button>
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-400 text-sm">Escribe para buscar...</div>
                    )}
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 text-center">
                        <button onClick={() => setShowSuggestions(false)} className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline">Cerrar buscador</button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* VISTA DEL LOTE ACTUAL */}
      {batchItems.length > 0 && (
          <div className="bg-white dark:bg-secondary rounded-2xl shadow-2xl border-2 border-accent/20 overflow-hidden flex flex-col animate-slide-up">
              <div className="p-5 bg-accent text-white flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-lg"><PlusIcon className="w-6 h-6" /></div>
                      <h3 className="text-xl font-black uppercase tracking-widest">Lote en Preparación ({batchItems.length})</h3>
                  </div>
                  <div className="flex gap-6">
                      {activeStoreIds.map(sid => (
                          <div key={sid} className="text-center border-l border-white/20 pl-6">
                              <p className="text-[10px] font-bold uppercase opacity-70">{stores.find(s => s.id === sid)?.name}</p>
                              <p className="text-xl font-black">{formatCOP(totalsByStore[sid])}</p>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800/80 border-b dark:border-gray-700">
                              <th className="p-4 text-[10px] font-black uppercase text-gray-500 w-1/4">Producto</th>
                              {activeStoreIds.map(sid => {
                                  const store = stores.find(s => s.id === sid);
                                  return (
                                  <th key={sid} className="p-4 border-l dark:border-gray-700 min-w-[300px] relative overflow-hidden" style={{ borderTop: `4px solid ${store?.accentColor || '#ff007f'}` }}>
                                      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundColor: store?.accentColor || 'transparent' }}></div>
                                      <span className="text-[11px] font-black uppercase tracking-wider relative z-10" style={{ color: store?.accentColor || '#ff007f' }}>
                                          {store?.name}
                                      </span>
                                  </th>
                              )})}
                              <th className="p-4 w-10"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-800">
                          {batchItems.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-accent/5 transition-colors">
                                  <td className="p-4">
                                      <div className="flex items-center gap-3">
                                          <div 
                                              className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 overflow-hidden flex-shrink-0 cursor-zoom-in"
                                              onClick={() => item.imageUrl && setPreviewImage(item.imageUrl)}
                                          >
                                              {item.imageUrl ? (
                                                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                              ) : (
                                                  <PackageIcon className="w-6 h-6 mx-auto mt-3 text-gray-300" />
                                              )}
                                          </div>
                                          
                                          <div className="flex-grow">
                                              {item.isNew ? (
                                                  <div className="space-y-2">
                                                      <input type="text" value={item.productName} onChange={e => handleUpdateBatchItem(item.id, { productName: e.target.value })} className="w-full bg-white dark:bg-gray-900 p-2 rounded border-2 border-yellow-500/30 text-sm font-bold" placeholder="Nombre..."/>
                                                      <select value={item.categoryId} onChange={e => handleUpdateBatchItem(item.id, { categoryId: e.target.value })} className="w-full bg-white dark:bg-gray-900 p-2 rounded border text-xs font-bold">
                                                          <option value="">Categoría...</option>
                                                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                      </select>
                                                  </div>
                                              ) : (
                                                  <div>
                                                      <p className="font-black text-sm uppercase leading-tight">{item.productName}</p>
                                                      <p className="text-[10px] text-gray-400 font-bold uppercase">{categories.find(c => c.id === item.categoryId)?.name || 'Sin cat.'}</p>
                                                  </div>
                                              )}
                                              <div className="relative mt-2">
                                                  <input 
                                                      type="text" 
                                                      value={item.supplier} 
                                                      onChange={e => handleUpdateBatchItem(item.id, { supplier: e.target.value })} 
                                                      onFocus={() => setItemSupplierSearchId(item.id)}
                                                      onBlur={() => setTimeout(() => setItemSupplierSearchId(null), 200)}
                                                      className="w-full bg-transparent border-b border-gray-200 dark:border-gray-700 text-[10px] font-bold uppercase py-1 outline-none" 
                                                      placeholder="Marca/Proveedor..."
                                                  />
                                                  {itemSupplierSearchId === item.id && item.supplier && (
                                                      <div className="absolute z-[60] w-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-2xl overflow-hidden animate-fade-in">
                                                          {existingSuppliers
                                                              .filter(s => normalizeText(s).includes(normalizeText(item.supplier)))
                                                              .slice(0, 5)
                                                              .map(s => (
                                                                  <button key={s} onMouseDown={() => handleUpdateBatchItem(item.id, { supplier: s })} className="w-full text-left p-2 hover:bg-accent/10 transition-colors font-bold text-[9px] uppercase border-b last:border-0 dark:border-gray-800">
                                                                      {s}
                                                                  </button>
                                                              ))
                                                          }
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  </td>
                                  {activeStoreIds.map((sid, idx) => {
                                      const store = stores.find(s => s.id === sid);
                                      return (
                                      <td key={sid} className="p-4 border-l dark:border-gray-700" style={{ borderLeftColor: `${store?.accentColor}33` }}>
                                          <div className="grid grid-cols-3 gap-2">
                                              <div className="flex flex-col gap-1">
                                                  <div className="flex justify-between items-center px-1">
                                                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Cant.</label>
                                                      {idx === 0 && activeStoreIds.length > 1 && (
                                                          <button onClick={() => handleSyncValueAcrossStores(item.id, 'quantity', sid)} className="text-accent hover:scale-125 transition-transform" title="Copiar cantidad a todas las tiendas"><CopyIcon className="w-2.5 h-2.5"/></button>
                                                      )}
                                                  </div>
                                                  <input type="number" value={item.storeEntries[sid]?.quantity || ''} onChange={e => handleUpdateBatchStoreEntry(item.id, sid, 'quantity', e.target.value)} className="w-full bg-white dark:bg-gray-900 border dark:border-gray-700 rounded p-1.5 text-center font-black text-sm outline-none focus:border-accent" style={{ borderBottomColor: store?.accentColor }} placeholder="0" />
                                              </div>
                                              <div className="flex flex-col gap-1">
                                                  <div className="flex justify-between items-center px-1">
                                                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Costo</label>
                                                      {idx === 0 && activeStoreIds.length > 1 && (
                                                          <button onClick={() => handleSyncValueAcrossStores(item.id, 'cost', sid)} className="text-accent hover:scale-125 transition-transform" title="Copiar costo a todas las tiendas"><CopyIcon className="w-2.5 h-2.5"/></button>
                                                      )}
                                                  </div>
                                                  <input type="number" value={item.storeEntries[sid]?.cost || ''} onChange={e => handleUpdateBatchStoreEntry(item.id, sid, 'cost', e.target.value)} className="w-full bg-white dark:bg-gray-900 border dark:border-gray-700 rounded p-1.5 text-right font-bold text-xs outline-none focus:border-accent" placeholder="0" />
                                              </div>
                                              <div className="flex flex-col gap-1">
                                                  <div className="flex justify-between items-center px-1">
                                                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Venta</label>
                                                      {idx === 0 && activeStoreIds.length > 1 && (
                                                          <button onClick={() => handleSyncValueAcrossStores(item.id, 'price', sid)} className="text-accent hover:scale-125 transition-transform" title="Copiar precio a todas las tiendas"><CopyIcon className="w-2.5 h-2.5"/></button>
                                                      )}
                                                  </div>
                                                  <input type="number" value={item.storeEntries[sid]?.price || ''} onChange={e => handleUpdateBatchStoreEntry(item.id, sid, 'price', e.target.value)} className="w-full bg-white dark:bg-gray-900 border dark:border-gray-700 rounded p-1.5 text-right font-bold text-xs outline-none focus:border-accent" placeholder="0" />
                                              </div>
                                          </div>
                                      </td>
                                  )})}
                                  <td className="p-4">
                                      <button onClick={() => handleRemoveFromBatch(item.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><TrashIcon className="w-5 h-5"/></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-6">
                    <button onClick={() => setBatchItems([])} className="text-gray-400 font-bold text-xs hover:text-red-500 uppercase tracking-widest transition-colors">Limpiar Lote</button>
                    <div className="flex gap-4">
                        <button onClick={handleProcessBatch} disabled={isProcessingBatch} className="bg-green-600 text-white font-black py-4 px-12 rounded-2xl hover:bg-green-700 transition-all shadow-xl shadow-green-600/30 active:scale-95 uppercase tracking-widest disabled:opacity-50 text-base">
                            {isProcessingBatch ? 'Procesando...' : 'FINALIZAR COMPRA DE LOTE'}
                        </button>
                    </div>
              </div>
          </div>
      )}

      {/* HISTORIAL DE COMPRAS */}
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b dark:border-gray-700 pb-2">
            <h2 className="text-2xl font-black text-gray-800 dark:text-text-light flex items-center gap-3">
                <HistoryIcon className="w-6 h-6 text-accent" />
                Historial de Compras
            </h2>
            {!isFullHistoryLoaded && (
                <div className="flex items-center gap-3 bg-accent/5 p-2 px-4 rounded-xl border border-accent/10">
                    <span className="text-xs font-bold text-gray-500">Mostrando solo {currentMonthName}</span>
                    <button onClick={onLoadFullHistory} className="bg-accent text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-accent/20">
                        Cargar Historial Completo
                    </button>
                </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="relative md:col-span-1">
                <input type="text" placeholder="Producto o proveedor..." value={historySearchTerm} onChange={e => setHistorySearchTerm(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 pl-10 pr-10 focus:ring-2 focus:ring-accent outline-none font-bold text-sm" />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              <select 
                  value={categoryFilter} 
                  onChange={e => setCategoryFilter(e.target.value)} 
                  className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-sm outline-none focus:ring-2 focus:ring-accent"
              >
                  <option value="">Todas las categorías</option>
                  {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-sm"/>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-sm"/>
          </div>

          <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                      <tr>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-400">Imagen</th>
                          <SortHeader k="createdAt" label="Fecha" />
                          <SortHeader k="productName" label="Producto" />
                          <SortHeader k="supplier" label="Proveedor" />
                          <SortHeader k="storeId" label="Tienda" />
                          <SortHeader k="quantity" label="Cant." />
                          <SortHeader k="totalCost" label="Costo Total" />
                          <th className="p-3 text-center w-20">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-800">
                      {filteredPurchases.map(p => {
                          const product = inventory.find(inv => inv.id === p.productId);
                          return (
                          <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 group">
                              <td className="p-3">
                                  <div 
                                      className="relative w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 overflow-hidden cursor-zoom-in"
                                      onClick={() => product?.imageUrl && setPreviewImage(product.imageUrl)}
                                  >
                                      {product?.imageUrl ? (
                                          <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                          <PackageIcon className="w-6 h-6 mx-auto mt-3 text-gray-300" />
                                      )}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/opacity-100 transition-opacity flex items-center justify-center">
                                          <SearchIcon className="w-4 h-4 text-white" />
                                      </div>
                                  </div>
                              </td>
                              <td className="p-3 text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                              <td className="p-3">
                                  <p className="font-black text-sm uppercase">{p.productName}</p>
                                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                          onClick={() => product && setEditingProductImage(product)} 
                                          className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent rounded flex items-center gap-1 font-bold"
                                      >
                                          <CameraIcon className="w-2.5 h-2.5" /> Editar Foto Global
                                      </button>
                                  </div>
                              </td>
                              <td className="p-3 text-xs text-gray-500 font-bold uppercase">{p.supplier || 'N/A'}</td>
                              <td className="p-3"><span className="px-2 py-1 bg-accent/10 text-accent rounded text-[10px] font-black uppercase">{stores.find(s => s.id === p.storeId)?.name}</span></td>
                              <td className="p-3 text-center font-black">{p.quantity}</td>
                              <td className="p-3 text-right font-black text-accent">{formatCOP(p.totalCost)}</td>
                              <td className="p-3 text-center">
                                  <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                      <button onClick={() => { setLabelPurchase(p); setLabelQuantity(p.quantity); }} className="p-1.5 text-gray-400 hover:text-blue-500" title="Generar Etiquetas"><TagIcon className="w-4 h-4"/></button>
                                      <button onClick={() => setEditingPurchase(p)} className="p-1.5 text-gray-400 hover:text-accent"><EditIcon className="w-4 h-4"/></button>
                                      <button onClick={() => onDeletePurchase(p.id)} className="p-1.5 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
                                  </div>
                              </td>
                          </tr>
                      )})}
                  </tbody>
                  {filteredPurchases.length > 0 && (
                    <tfoot className="bg-gray-50/80 dark:bg-gray-800/80 font-black border-t-2 border-gray-200 dark:border-gray-700">
                        <tr>
                            <td className="p-4" colSpan={2}></td>
                            <td className="p-4 text-xs uppercase text-gray-500 tracking-widest">TOTAL FILTRADO</td>
                            <td className="p-4" colSpan={2}></td>
                            <td className="p-4 text-center text-lg">{totalHistoryQuantity}</td>
                            <td className="p-4 text-right text-lg text-accent">{formatCOP(totalHistoryCost)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                  )}
              </table>
              {filteredPurchases.length === 0 && (
                <div className="p-10 text-center text-gray-400">
                    No se encontraron compras en el rango seleccionado.
                </div>
              )}
          </div>
      </div>

      {editingPurchase && (
        <EditPurchaseModal
            purchase={editingPurchase}
            product={inventory.find(prod => prod.id === editingPurchase.productId)!}
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

      {labelPurchase && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-secondary w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-accent/20">
                <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="text-lg font-black text-accent uppercase tracking-widest flex items-center gap-2">
                        <TagIcon className="w-5 h-5" /> Generar Etiquetas
                    </h3>
                    <button onClick={() => setLabelPurchase(null)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><CrossIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                        <div className="w-16 h-16 rounded-xl bg-white dark:bg-gray-900 border flex items-center justify-center overflow-hidden">
                            {inventory.find(inv => inv.id === labelPurchase.productId)?.imageUrl ? (
                                <img src={inventory.find(inv => inv.id === labelPurchase.productId)?.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <PackageIcon className="w-8 h-8 text-gray-300" />
                            )}
                        </div>
                        <div>
                            <p className="font-black text-sm uppercase">{labelPurchase.productName}</p>
                            <p className="text-[10px] text-gray-500 font-bold">SKU: {inventory.find(inv => inv.id === labelPurchase.productId)?.sku}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cantidad de etiquetas</label>
                        <input 
                            type="number" 
                            value={labelQuantity} 
                            onChange={e => setLabelQuantity(parseInt(e.target.value) || 1)}
                            className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent font-black text-xl text-center"
                            min="1"
                        />
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase mb-2">Vista Previa del Cifrado</p>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500">Precio Original:</span>
                            <span className="text-sm font-black text-gray-800 dark:text-white">{formatCOP(inventory.find(inv => inv.id === labelPurchase.productId)?.price || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-xs font-bold text-gray-500">Código Cifrado:</span>
                            <span className="text-sm font-black text-accent tracking-widest">
                                {labelPurchase.createdAt.split('T')[0].replace(/-/g, '').slice(2)}-{encodePrice(inventory.find(inv => inv.id === labelPurchase.productId)?.price || 0)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={() => setLabelPurchase(null)} className="flex-1 py-4 text-xs font-black uppercase text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-2xl hover:bg-gray-200 transition-all">Cancelar</button>
                        <button 
                            onClick={() => {
                                const product = inventory.find(inv => inv.id === labelPurchase.productId);
                                if (!product) return;
                                const encoded = encodePrice(product.price);
                                const dateStr = labelPurchase.createdAt.split('T')[0].replace(/-/g, '').slice(2);
                                const cipherCode = `${dateStr}-${encoded}`;
                                
                                const printWindow = window.open('', '_blank');
                                if (!printWindow) return;

                                const labelsHtml = Array.from({ length: labelQuantity }).map((_, i) => `
                                    <div class="label">
                                        <div class="store-name">${stores.find(s => s.id === labelPurchase.storeId)?.name || 'Boutique'}</div>
                                        <div class="product-name">${product.name}</div>
                                        <svg class="barcode" 
                                            jsbarcode-value="${product.sku}"
                                            jsbarcode-format="CODE128"
                                            jsbarcode-width="1.2"
                                            jsbarcode-height="35"
                                            jsbarcode-fontSize="10"
                                            jsbarcode-margin="0"
                                        ></svg>
                                        <div class="cipher">${cipherCode}</div>
                                    </div>
                                `).join('');

                                printWindow.document.write(`
                                    <html>
                                        <head>
                                            <title>Imprimir Etiquetas</title>
                                            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                                            <style>
                                                @page { size: 40mm 25mm; margin: 0; }
                                                body { margin: 0; font-family: 'Courier New', Courier, monospace; }
                                                .label { 
                                                    width: 40mm; 
                                                    height: 25mm; 
                                                    padding: 1mm; 
                                                    box-sizing: border-box; 
                                                    display: flex; 
                                                    flex-direction: column; 
                                                    justify-content: center; 
                                                    align-items: center;
                                                    text-align: center;
                                                    page-break-after: always;
                                                }
                                                .store-name { font-size: 6pt; font-weight: bold; text-transform: uppercase; margin-bottom: 0.5mm; }
                                                .product-name { font-size: 7pt; font-weight: bold; text-transform: uppercase; margin-bottom: 0.5mm; white-space: nowrap; overflow: hidden; width: 100%; }
                                                .barcode { max-width: 38mm; height: auto; margin: 0.5mm 0; }
                                                .cipher { font-size: 7pt; font-weight: bold; border-top: 0.2mm solid #000; padding-top: 0.5mm; margin-top: 0.5mm; }
                                            </style>
                                        </head>
                                        <body>
                                            ${labelsHtml}
                                            <script>
                                                window.onload = () => {
                                                    JsBarcode(".barcode").init();
                                                    setTimeout(() => {
                                                        window.print();
                                                        window.close();
                                                    }, 500);
                                                };
                                            </script>
                                        </body>
                                    </html>
                                `);
                                printWindow.document.close();
                                setLabelPurchase(null);
                            }} 
                            className="flex-2 py-4 text-xs font-black uppercase text-white bg-accent rounded-2xl shadow-lg shadow-accent/20 hover:scale-105 transition-all"
                        >
                            Imprimir Etiquetas
                        </button>
                    </div>
                </div>
            </div>
        </div>
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
        <div className="fixed bottom-5 right-5 bg-green-600 text-white py-4 px-8 rounded-2xl shadow-2xl flex items-center animate-fade-in-out z-[100]">
          <CheckIcon className="w-6 h-6 mr-3" />
          <span className="font-black uppercase tracking-widest">{successMessage}</span>
        </div>
      )}
    </div>
  );
};

export default PurchasesView;
