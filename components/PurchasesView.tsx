import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, Product, Category, Store } from '../types';
import { PlusCircleIcon, EditIcon, TrashIcon, SearchIcon, CheckIcon, CrossIcon } from './Icons';
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

  // New state for supplier suggestions
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
  
  const searchSource = useMemo(() => allInventoryForSearch && allInventoryForSearch.length > 0 ? allInventoryForSearch : inventory, [allInventoryForSearch, inventory]);

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
    if (!productSearch) return [];
    const lowerCaseSearch = productSearch.toLowerCase();
    const uniqueProductNames = new Set<string>();
    return searchSource
      .filter(p => {
        const nameLower = p.name.toLowerCase();
        if (nameLower.includes(lowerCaseSearch) && !uniqueProductNames.has(nameLower)) {
          uniqueProductNames.add(nameLower);
          return true;
        }
        return false;
      })
      .slice(0, 10);
  }, [productSearch, searchSource]);
  
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestedProducts]);

  // Supplier suggestions logic
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
    if (!supplier.trim()) {
      return [];
    }
    const lowerCaseSearch = supplier.toLowerCase();
    return uniqueSuppliers.filter(s => s.toLowerCase().includes(lowerCaseSearch));
  }, [supplier, uniqueSuppliers]);

  useEffect(() => {
    setHighlightedSupplierIndex(-1);
  }, [suggestedSuppliers]);

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
  // End of supplier suggestions logic

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

    // Find all instances of this product across all stores
    const allInstances = searchSource.filter(p => p.name.toLowerCase() === product.name.toLowerCase());
    
    setStoreData(prevStoreData => {
        const newStoreData = { ...prevStoreData };
        
        // Iterate over the stores we are currently displaying in the form
        Object.keys(newStoreData).forEach(storeId => {
            // Find if there's an instance for THIS specific store
            const instanceForThisStore = allInstances.find(p => p.storeId === storeId);
            
            if (instanceForThisStore) {
                // If an instance exists, pre-fill its data
                newStoreData[storeId] = {
                    ...newStoreData[storeId], // Keep the existing selection and quantity
                    cost: instanceForThisStore.cost.toString(),
                    price: instanceForThisStore.price.toString(),
                };
            } else {
                // If no instance exists for this store, pre-fill from the base selected product as a suggestion.
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
      const productName = selectedProduct ? selectedProduct.name : productSearch;
      if (!productName.trim()) {
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
        throw new Error('Por favor, completa todos los campos (Cantidad, Costo, Precio) con valores válidos para las tiendas seleccionadas.');
      }
  
      const baseProduct = searchSource.find(p => p.name.toLowerCase() === productName.toLowerCase());

      if (!isCreatingNew && !baseProduct) {
        throw new Error(`El producto "${productName}" no se encontró en la base de datos. Si es un producto nuevo, bórralo y escríbelo de nuevo para ver la opción de crearlo.`);
      }
  
      await onMultiStorePurchase({
        productInfo: {
          name: baseProduct ? baseProduct.name : productName,
          categoryId: isCreatingNew ? newProductCategoryId : baseProduct!.categoryId,
        },
        storeEntries,
      });
      
      // Only reset form and show success on successful completion
      resetForm();
      setSuccessMessage('Compras registradas y stock actualizado correctamente.');

    } catch (error: any) {
        // The error alert is already shown in App.tsx. 
        // We just catch it here to prevent the form from resetting on failure.
        console.error("Submit failed, form not reset.");
    }
  };
  
  const filteredPurchases = useMemo(() => {
    const lowerCaseSearchTerm = historySearchTerm.toLowerCase();
    const productMap = new Map(inventory.map(p => [p.id, p]));

    return purchases.filter(p => {
      const purchaseDate = new Date(p.createdAt);
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      const matchesStartDate = start ? purchaseDate >= start : true;
      const matchesEndDate = end ? purchaseDate <= end : true;
      
      const matchesSearch = lowerCaseSearchTerm ? 
          p.productName.toLowerCase().includes(lowerCaseSearchTerm) ||
          p.supplier.toLowerCase().includes(lowerCaseSearchTerm)
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

  const productExists = useMemo(() => searchSource.some(p => p.name.toLowerCase() === productSearch.toLowerCase()), [searchSource, productSearch]);

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
                    className="w-full bg-gray-100 dark:bg-gray-800 p-2 pl-10 pr-10 rounded-md" placeholder="Escribe para buscar o crear..." autoComplete="off"
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
                    {suggestedProducts.map((p, index) => (
                        <li key={p.id}
                            className={`p-2 cursor-pointer ${index === highlightedIndex ? 'bg-accent/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            onMouseDown={() => handleProductSelect(p)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            {p.name}
                        </li>
                    ))}
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
                className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" 
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
             <div className="bg-accent/10 p-3 rounded-lg">
                <label htmlFor="category" className="block text-sm font-medium text-accent mb-1">Categoría para "{productSearch}"</label>
                <select id="category" value={newProductCategoryId} onChange={e => setNewProductCategoryId(e.target.value)} className="w-full md:w-1/2 bg-white dark:bg-gray-800 p-2 rounded-md" required>
                    <option value="" disabled>Selecciona una categoría</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
             </div>
          )}

          <div>
             <h3 className="text-lg font-bold text-gray-800 dark:text-text-light mb-2">Gestionar Compra por Tienda</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {stores.map(store => (
                     <div key={store.id} className={`p-4 rounded-lg transition-all ${storeData[store.id]?.selected ? 'bg-accent/10 ring-2 ring-accent' : 'bg-gray-100 dark:bg-gray-800'}`}>
                         <label className="flex items-center space-x-3 cursor-pointer">
                           <input type="checkbox" checked={storeData[store.id]?.selected || false} onChange={() => handleStoreToggle(store.id)} className="h-5 w-5 rounded text-accent focus:ring-accent" />
                           <span className="font-bold text-lg">{store.name}</span>
                         </label>
                         {storeData[store.id]?.selected && (
                            <div className="mt-3 space-y-2">
                                <div>
                                    <label className="text-xs font-medium">Cantidad</label>
                                    <input type="number" value={storeData[store.id].quantity} onChange={e => handleInputChange(store.id, 'quantity', e.target.value)} className="w-full bg-white dark:bg-gray-700 p-1.5 rounded-md text-sm" min="1"/>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Costo Unitario</label>
                                    <input type="number" value={storeData[store.id].cost} onChange={e => handleInputChange(store.id, 'cost', e.target.value)} className="w-full bg-white dark:bg-gray-700 p-1.5 rounded-md text-sm" min="0" step="1"/>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Precio Venta</label>
                                    <input type="number" value={storeData[store.id].price} onChange={e => handleInputChange(store.id, 'price', e.target.value)} className="w-full bg-white dark:bg-gray-700 p-1.5 rounded-md text-sm" min="0" step="1"/>
                                </div>
                            </div>
                         )}
                     </div>
                 ))}
             </div>
             <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => applyToAll('quantity')} className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-md">Aplicar Cant. a todos</button>
                <button type="button" onClick={() => applyToAll('cost')} className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-md">Aplicar Costo a todos</button>
             </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t-2 border-gray-200 dark:border-gray-700">
            {productSearch && !productExists && !isCreatingNew && (
                <button type="button" onClick={() => setIsCreatingNew(true)} className="bg-yellow-500 text-white font-bold py-2 px-6 rounded-lg mr-4">
                  Confirmar Creación de "{productSearch}"
                </button>
            )}
            <button type="submit" className="bg-accent text-white font-bold py-2 px-6 rounded-lg flex items-center space-x-2 hover:bg-accent-hover">
              <PlusCircleIcon />
              <span>Registrar</span>
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
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
                <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400">
                  <SearchIcon />
                </div>
                {historySearchTerm && (
                  <button
                      onClick={() => setHistorySearchTerm('')}
                      className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                      aria-label="Limpiar búsqueda"
                  >
                      <CrossIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
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
                          <th className="p-3 text-sm font-semibold tracking-wide">Fecha</th>
                          <th className="p-3 text-sm font-semibold tracking-wide">Producto</th>
                          <th className="p-3 text-sm font-semibold tracking-wide">Proveedor</th>
                          <th className="p-3 text-sm font-semibold tracking-wide text-center">Cant.</th>
                          <th className="p-3 text-sm font-semibold tracking-wide text-right">Costo Unit.</th>
                          <th className="p-3 text-sm font-semibold tracking-wide text-right">Costo Total</th>
                          <th className="p-3 text-sm font-semibold tracking-wide text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredPurchases.map((purchase) => (
                          <tr key={purchase.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="p-3 text-sm whitespace-nowrap">{new Date(purchase.createdAt).toLocaleString()}</td>
                              <td className="p-3 font-bold">{purchase.productName}</td>
                              <td className="p-3 text-sm text-gray-500 dark:text-text-dark">{purchase.supplier}</td>
                              <td className="p-3 text-center font-semibold">{purchase.quantity}</td>
                              <td className="p-3 text-right">{formatCOP(purchase.cost)}</td>
                              <td className="p-3 text-right font-bold text-accent">{formatCOP(purchase.totalCost)}</td>
                              <td className="p-3 text-center">
                                  <div className="flex justify-center items-center space-x-2">
                                      <button onClick={() => setEditingPurchase(purchase)} className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors">
                                          <EditIcon />
                                      </button>
                                      <button onClick={() => onDeletePurchase(purchase.id)} className="text-gray-500 dark:text-text-dark hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors">
                                          <TrashIcon />
                                      </button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
                   <tfoot>
                    <tr className="bg-gray-200 dark:bg-gray-900 font-bold">
                      <td colSpan={3} className="p-3 text-right text-sm">Totales:</td>
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