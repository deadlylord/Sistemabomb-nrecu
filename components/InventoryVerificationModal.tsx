
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, Seller, StockTake } from '../types';
import { CheckIcon, CrossIcon } from './Icons';

interface InventoryVerificationModalProps {
  inventory: Product[];
  categories: Category[];
  sellers: Seller[];
  isOpen: boolean;
  onClose: () => void;
  onSaveStockTake: (stockTakeData: Omit<StockTake, 'id' | 'createdAt' | 'storeId'>) => void;
}

// FIX: Added a named export to make the component importable.
export const InventoryVerificationModal: React.FC<InventoryVerificationModalProps> = ({
  inventory,
  categories,
  sellers,
  isOpen,
  onClose,
  onSaveStockTake,
}) => {
  // FIX: Changed key of counts from number to string to match category ID type.
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [selectedSeller, setSelectedSeller] = useState('');
  const [cashBase, setCashBase] = useState('');

  useEffect(() => {
    if (!isOpen) {
        setCounts({});
        setSelectedSeller('');
        setCashBase('');
    }
  }, [isOpen]);

  const categoryTotals = useMemo(() => {
    return categories
      .map(category => {
        const totalStock = inventory
          .filter(p => p.categoryId === category.id)
          .reduce((sum, p) => sum + p.stock, 0);
        return { ...category, totalStock };
      })
      .filter(category => category.totalStock > 0);
  }, [inventory, categories]);

  if (!isOpen) return null;

  // FIX: Changed categoryId from number to string to match data model.
  const handleCountChange = (categoryId: string, value: string) => {
    setCounts(prev => ({ ...prev, [categoryId]: value }));
  };

  const handleSubmit = () => {
    if (!selectedSeller) {
      alert("Por favor, selecciona el vendedor que realiza la verificación.");
      return;
    }

    const verificationData = categoryTotals.map(cat => {
      const physicalCountStr = counts[cat.id];
      const physicalCount = physicalCountStr !== undefined && physicalCountStr !== '' ? parseInt(physicalCountStr, 10) : 0;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        systemStock: cat.totalStock,
        physicalCount: isNaN(physicalCount) ? 0 : physicalCount,
        difference: (isNaN(physicalCount) ? 0 : physicalCount) - cat.totalStock,
      };
    });
    
    onSaveStockTake({
        seller: selectedSeller,
        cashBase: cashBase ? parseFloat(cashBase) : undefined,
        verification: verificationData,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-secondary rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-2xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-accent mb-4 border-b-2 border-accent/30 pb-2">Verificación y Apertura de Caja</h2>
        
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Vendedor (Obligatorio)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sellers.map(seller => (
                    <button
                    key={seller.id}
                    onClick={() => setSelectedSeller(seller.name)}
                    className={`p-3 rounded-lg font-semibold transition-colors text-sm ${selectedSeller === seller.name ? 'bg-accent text-white ring-2 ring-accent-hover' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  >
                    {seller.name}
                  </button>
                ))}
              </div>
            </div>
             <div>
                <label htmlFor="cashBase" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Base de Caja (Opcional)</label>
                 <input
                    type="number"
                    id="cashBase"
                    value={cashBase}
                    onChange={e => setCashBase(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                    placeholder="Ej: 100000"
                    min="0"
                />
             </div>
        </div>

        <div className="flex-grow overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="p-3 text-sm font-semibold tracking-wide">Categoría</th>
                <th className="p-3 text-sm font-semibold tracking-wide text-center">Conteo Físico</th>
                <th className="p-3 text-sm font-semibold tracking-wide text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {categoryTotals.map(category => {
                const physicalCountStr = counts[category.id];
                const physicalCount = physicalCountStr !== undefined && physicalCountStr !== '' ? parseInt(physicalCountStr, 10) : null;
                const difference = physicalCount !== null ? physicalCount - category.totalStock : null;

                return (
                  <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-2 font-bold">{category.name}</td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={counts[category.id] || ''}
                        onChange={(e) => handleCountChange(category.id, e.target.value)}
                        className="w-24 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-1 text-center focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                      />
                    </td>
                    <td className="p-2 text-center text-xl">
                       {difference === 0 && physicalCount !== null && <span className="text-green-500"><CheckIcon /></span>}
                       {difference !== 0 && physicalCount !== null && <span className="text-red-500"><CrossIcon /></span>}
                       {physicalCount === null && <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center space-x-2">
                <CrossIcon />
                <span>Cancelar</span>
            </button>
            <button onClick={handleSubmit} className="px-6 py-2 bg-accent text-white font-bold rounded-md hover:bg-accent-hover transition-colors flex items-center space-x-2">
                <CheckIcon />
                <span>Guardar Verificación</span>
            </button>
        </div>
      </div>
    </div>
  );
};
