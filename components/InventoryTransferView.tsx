
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryTransfer, Product, Store, Seller } from '../types';
import { SwapIcon, SearchIcon, DollarIcon } from './Icons';
import { formatCOP, normalizeText } from '../constants';

interface InventoryTransferViewProps {
  inventory: Product[];
  stores: Store[];
  currentUser: Seller;
  transfers: InventoryTransfer[];
  onTransfer: (data: { fromStoreId: string; toStoreId: string; productId: string; quantity: number; sellerName: string; }) => void;
  onResetBalances: () => void;
}

export const InventoryTransferView: React.FC<InventoryTransferViewProps> = ({ inventory, stores, currentUser, transfers, onTransfer, onResetBalances }) => {
  const [fromStoreId, setFromStoreId] = useState<string | ''>(currentUser.storeId);
  const [toStoreId, setToStoreId] = useState<string | ''>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [quantity, setQuantity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const availableProducts = useMemo(() => {
    if (!fromStoreId) return [];
    return inventory.filter(p => p.storeId === fromStoreId && !p.isDisabled)
        .sort((a,b) => a.name.localeCompare(b.name));
  }, [inventory, fromStoreId]);
  
  const suggestedProducts = useMemo(() => {
    const normalizedSearch = normalizeText(productSearch);
    if (!normalizedSearch) return [];
    return availableProducts.filter(p => normalizeText(p.name).includes(normalizedSearch));
  }, [productSearch, availableProducts]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestedProducts]);

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

  const selectedProductStock = useMemo(() => {
    return selectedProduct ? selectedProduct.stock : 0;
  }, [selectedProduct]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!fromStoreId || !toStoreId || !selectedProduct || !qty || qty <= 0) {
      alert('Por favor, completa todos los campos con valores válidos.');
      return;
    }
    if (fromStoreId === toStoreId) {
      alert('La tienda de origen y destino no pueden ser la misma.');
      return;
    }
    if (qty > selectedProductStock) {
        alert(`Stock insuficiente. Solo hay ${selectedProductStock} unidades disponibles para trasladar.`);
        return;
    }

    onTransfer({
      fromStoreId,
      toStoreId,
      productId: selectedProduct.id,
      quantity: qty,
      sellerName: currentUser.name,
    });

    setSelectedProduct(null);
    setProductSearch('');
    setQuantity('');
  };

  const getStoreName = (storeId: string) => stores.find(s => s.id === storeId)?.name || 'Desconocida';
  
  const filteredTransfers = useMemo(() => {
      return transfers.filter(t => {
          const transferDate = new Date(t.createdAt);
          const start = startDate ? new Date(startDate + 'T00:00:00') : null;
          const end = endDate ? new Date(endDate + 'T23:59:59') : null;
          const matchesStartDate = start ? transferDate >= start : true;
          const matchesEndDate = end ? transferDate <= end : true;
          return matchesStartDate && matchesEndDate;
      }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transfers, startDate, endDate]);

  const balanceSummary = useMemo(() => {
    const balances = new Map<string, number>();

    const unsettledTransfers = filteredTransfers.filter(t => !t.settled);

    unsettledTransfers.forEach(t => {
      const ids = [t.fromStoreId, t.toStoreId].sort((a, b) => a.localeCompare(b));
      const key = `${ids[0]}-${ids[1]}`;
      
      const currentValue = balances.get(key) || 0;
      const valueChange = t.fromStoreId === ids[0] ? t.totalCost : -t.totalCost;
      
      balances.set(key, currentValue + valueChange);
    });

    const summary = [];
    for (const [key, netValue] of balances.entries()) {
        const [store1Id, store2Id] = key.split('-');
        const store1Name = getStoreName(store1Id);
        const store2Name = getStoreName(store2Id);

        if (netValue > 0) {
            summary.push({ text: `${store2Name} le debe a ${store1Name}`, amount: netValue });
        } else if (netValue < 0) {
            summary.push({ text: `${store1Name} le debe a ${store2Name}`, amount: -netValue });
        }
    }
    return summary;
  }, [filteredTransfers, stores]);


  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Realizar Traslado de Inventario</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="fromStore" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Desde Tienda</label>
              <select id="fromStore" value={fromStoreId} onChange={e => { setFromStoreId(e.target.value); setSelectedProduct(null); setProductSearch(''); }} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md border" required>
                <option value="" disabled>Selecciona origen</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="toStore" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Hacia Tienda</label>
              <select id="toStore" value={toStoreId} onChange={e => setToStoreId(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md border" required>
                <option value="" disabled>Selecciona destino</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-1 relative">
              <label htmlFor="product" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Producto</label>
              <div className="relative">
                <input
                    type="text"
                    id="product"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar producto..."
                    className="w-full bg-gray-100 dark:bg-gray-800 p-2 pl-10 rounded-md border"
                    required
                    disabled={!fromStoreId}
                    autoComplete="off"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
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
              {selectedProduct && <p className="text-xs text-gray-400 mt-1">Stock disponible: {selectedProductStock}</p>}
            </div>
             <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Cantidad</label>
              <input type="number" id="quantity" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" max={selectedProductStock} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md border" required />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="bg-accent text-white font-bold py-2 px-6 rounded-lg flex items-center space-x-2 hover:bg-accent-hover">
                <SwapIcon />
                <span>Confirmar Traslado</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
          <h2 className="text-2xl font-bold text-accent">Resumen de Saldos</h2>
          <button 
            onClick={onResetBalances}
            className="bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 hover:bg-yellow-600 transition-colors self-end sm:self-center"
            title="Marcar todos los traslados visibles como liquidados y reiniciar los saldos a cero."
          >
            <DollarIcon className="w-5 h-5"/>
            <span>Resetear Saldos</span>
          </button>
        </div>
        <div className="mb-4">
             {balanceSummary.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {balanceSummary.map((item, index) => (
                        <div key={index} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-center">
                            <p className="text-sm text-gray-600 dark:text-text-dark">{item.text}</p>
                            <p className="text-xl font-bold text-accent">{formatCOP(item.amount)}</p>
                        </div>
                    ))}
                </div>
             ) : (
                <p className="text-center text-gray-500 dark:text-text-dark">No hay saldos pendientes entre tiendas para el periodo seleccionado.</p>
             )}
        </div>
      </div>
      
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-accent mb-4 border-b-2 border-accent/30 pb-2">Historial de Traslados</h2>
        <div className="flex gap-4 mb-4">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md" title="Fecha de inicio"/>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md" title="Fecha de fin"/>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Producto</th>
                <th className="p-3 text-center">Cantidad</th>
                <th className="p-3 text-right">Costo Unitario</th>
                <th className="p-3 text-right">Costo Total</th>
                <th className="p-3">Desde</th>
                <th className="p-3">Hacia</th>
                <th className="p-3">Realizado por</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map(t => (
                <tr key={t.id} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${t.settled ? 'opacity-50' : ''}`} title={t.settled ? 'Este traslado ya fue liquidado' : ''}>
                  <td className="p-3 text-sm">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="p-3 font-bold">{t.productName}</td>
                  <td className="p-3 text-center">{t.quantity}</td>
                  <td className="p-3 text-right">{formatCOP(t.productCost)}</td>
                  <td className="p-3 text-right font-semibold text-accent">{formatCOP(t.totalCost)}</td>
                  <td className="p-3">{getStoreName(t.fromStoreId)}</td>
                  <td className="p-3">{getStoreName(t.toStoreId)}</td>
                  <td className="p-3">{t.sellerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
