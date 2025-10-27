import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { SearchIcon } from './Icons';

interface StockTakeModalProps {
  inventory: Product[];
  isOpen: boolean;
  onClose: () => void;
  // FIX: Changed productId from number to string to match data model.
  onAdjustStock: (adjustments: { productId: string, newStock: number }[]) => void;
}

const StockTakeModal: React.FC<StockTakeModalProps> = ({ inventory, isOpen, onClose, onAdjustStock }) => {
  // FIX: Changed key of counts from number to string to match product ID type.
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredInventory = useMemo(() => {
    return inventory.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [inventory, searchTerm]);

  // FIX: Changed productId from number to string to match data model.
  const handleCountChange = (productId: string, value: string) => {
    setCounts(prev => ({ ...prev, [productId]: value }));
  };

  const handleSubmit = () => {
    // FIX: Explicitly type parameters from Object.entries to resolve 'unknown' type.
    const adjustments = Object.entries(counts)
      // FIX: productId is now a string, no need to parse.
      .map(([productId, newStockStr]: [string, string]) => {
        const newStock = parseInt(newStockStr, 10);
        // FIX: Comparison is now string to string, resolving the type error.
        const originalProduct = inventory.find(p => p.id === productId);

        if (originalProduct && !isNaN(newStock) && newStock !== originalProduct.stock) {
          return { productId, newStock };
        }
        return null;
      })
      // FIX: Update filter type to match string productId.
      .filter((adj): adj is { productId: string, newStock: number } => adj !== null);

    if (adjustments.length > 0) {
      onAdjustStock(adjustments);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-secondary rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-4xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-accent mb-4 border-b-2 border-accent/30 pb-2">Ajuste de Inventario / Conteo Físico</h2>
        
        <div className="relative mb-4">
            <input 
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
            <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400">
              <SearchIcon />
            </div>
        </div>

        <div className="flex-grow overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="p-3 text-sm font-semibold tracking-wide">Producto</th>
                <th className="p-3 text-sm font-semibold tracking-wide hidden sm:table-cell">SKU</th>
                <th className="p-3 text-sm font-semibold tracking-wide text-center">Stock Sistema</th>
                <th className="p-3 text-sm font-semibold tracking-wide text-center">Conteo Físico</th>
                <th className="p-3 text-sm font-semibold tracking-wide text-center">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredInventory.map(product => {
                const physicalCountStr = counts[product.id];
                const physicalCount = physicalCountStr !== undefined && physicalCountStr !== '' ? parseInt(physicalCountStr, 10) : null;
                const difference = physicalCount !== null ? physicalCount - product.stock : null;
                
                let diffColor = 'text-gray-500 dark:text-text-dark';
                if (difference !== null) {
                    if (difference > 0) diffColor = 'text-green-500';
                    else if (difference < 0) diffColor = 'text-red-500';
                    else diffColor = 'text-gray-900 dark:text-white';
                }

                return (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-2 font-bold">{product.name}</td>
                    <td className="p-2 text-sm text-gray-500 dark:text-text-dark hidden sm:table-cell">{product.sku}</td>
                    <td className="p-2 text-center font-semibold">{product.stock}</td>
                    <td className="p-2 text-center">
                      <input 
                        type="number"
                        min="0"
                        value={counts[product.id] || ''}
                        // FIX: handleCountChange now correctly expects a string for product.id.
                        onChange={(e) => handleCountChange(product.id, e.target.value)}
                        className="w-24 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-1 text-center focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                      />
                    </td>
                    <td className={`p-2 text-center font-bold text-lg ${diffColor}`}>
                      {difference !== null ? (difference > 0 ? `+${difference}` : difference) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
            <button onClick={handleSubmit} className="px-6 py-2 bg-accent text-white font-bold rounded-md hover:bg-accent-hover transition-colors">Aplicar Ajustes</button>
        </div>
      </div>
    </div>
  );
};

export default StockTakeModal;