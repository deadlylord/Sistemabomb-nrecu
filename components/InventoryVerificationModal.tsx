
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, Seller, StockTake, Store } from '../types';
import { CheckIcon, CrossIcon, EyeIcon } from './Icons';
import DetailedInventoryVerificationModal from './DetailedInventoryVerificationModal';

interface InventoryVerificationModalProps {
  inventory: Product[];
  categories: Category[];
  sellers: Seller[];
  isOpen: boolean;
  isAdmin: boolean;
  currentStore?: Store;
  onClose: () => void;
  onSaveStockTake: (stockTakeData: Omit<StockTake, 'id' | 'createdAt' | 'storeId'>, applyNow: boolean) => void;
  onSaveDetailedDraft: (categoryId: string, counts: Record<string, number>) => Promise<void>;
  onApplyDetailedVerification: (categoryId: string, counts: Record<string, number>) => Promise<void>;
}

export const InventoryVerificationModal: React.FC<InventoryVerificationModalProps> = ({
  inventory,
  categories,
  sellers,
  isOpen,
  isAdmin,
  currentStore,
  onClose,
  onSaveStockTake,
  onSaveDetailedDraft,
  onApplyDetailedVerification,
}) => {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [detailedCounts, setDetailedCounts] = useState<Record<string, Record<string, string>>>({});
  const [selectedSeller, setSelectedSeller] = useState('');
  const [cashBase, setCashBase] = useState('');
  const [activeCategoryForDetails, setActiveCategoryForDetails] = useState<Category | null>(null);

  useEffect(() => {
    if (!isOpen) {
        setCounts({});
        setDetailedCounts({});
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

  const handleCountChange = (categoryId: string, value: string) => {
    setCounts(prev => ({ ...prev, [categoryId]: value }));
  };

  const openDetailedVerification = (category: Category) => {
    setActiveCategoryForDetails(category);
  };

  const handleApplyDetailedCountsFromModal = (catId: string, productCounts: Record<string, string>) => {
    setDetailedCounts(prev => ({ ...prev, [catId]: productCounts }));
    const sum = Object.values(productCounts).reduce((acc, val) => acc + (parseInt(val, 10) || 0), 0);
    setCounts(prev => ({ ...prev, [catId]: sum.toString() }));
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

    const flattenedProductCounts: Record<string, number> = {};
    Object.values(detailedCounts).forEach(catCounts => {
      Object.entries(catCounts).forEach(([pid, val]) => {
        const num = parseInt(val, 10);
        if (!isNaN(num)) flattenedProductCounts[pid] = num;
      });
    });
    
    onSaveStockTake({
        seller: selectedSeller,
        cashBase: cashBase ? parseFloat(cashBase) : undefined,
        verification: verificationData,
        productCounts: flattenedProductCounts,
        isApplied: isAdmin 
    }, isAdmin);

    onClose();
  };

  // Logic to determine if detailed verification (the eye button) should be visible
  const isDetailedVerificationVisible = isAdmin || !currentStore?.hideDetailedVerificationForSellers;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-2xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start border-b-2 border-accent/30 pb-2 mb-4">
              <h2 className="text-2xl font-bold text-accent">Verificación y Apertura de Caja</h2>
              <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><CrossIcon /></button>
          </div>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Vendedor (Obligatorio)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {sellers.filter(seller => !seller.isDisabled).map(seller => (
                      <button key={seller.id} onClick={() => setSelectedSeller(seller.name)} className={`p-3 rounded-lg font-semibold transition-colors text-sm ${selectedSeller === seller.name ? 'bg-accent text-white ring-2 ring-accent-hover' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{seller.name}</button>
                  ))}
                </div>
              </div>
               <div>
                  <label htmlFor="cashBase" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Base de Caja (Opcional)</label>
                   <input type="number" id="cashBase" value={cashBase} onChange={e => setCashBase(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-bold" placeholder="Ej: 100.000" min="0" />
               </div>
          </div>
          <div className="flex-grow overflow-y-auto pr-2">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-sm font-semibold tracking-wide">Categoría</th>
                  {isDetailedVerificationVisible && <th className="p-3 text-sm font-semibold tracking-wide text-center">Detalle</th>}
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
                    <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors h-16">
                      <td className="p-2">
                          <p className="font-bold text-sm sm:text-base">{category.name}</p>
                      </td>
                      {isDetailedVerificationVisible && (
                        <td className="p-2 text-center">
                            <button onClick={() => openDetailedVerification(category)} className="p-2 text-accent bg-accent/10 rounded-full hover:bg-accent hover:text-white transition-all shadow-sm" title="Verificar por marca / producto"><EyeIcon className="w-5 h-5" /></button>
                        </td>
                      )}
                      <td className="p-2 text-center">
                        <input type="number" min="0" value={counts[category.id] || ''} onChange={(e) => handleCountChange(category.id, e.target.value)} className="w-20 sm:w-24 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-center font-bold focus:ring-2 focus:ring-accent focus:border-accent outline-none" />
                      </td>
                      <td className="p-2 text-center">
                         <div className="flex justify-center">
                             {difference === 0 && physicalCount !== null ? (
                                 <span className="text-green-500 bg-green-500/10 p-1 rounded-full"><CheckIcon className="w-5 h-5" /></span>
                             ) : difference !== 0 && physicalCount !== null ? (
                                 <span className="text-red-500 bg-red-500/10 p-1 rounded-full" title={`Dif: ${difference}`}><CrossIcon className="w-5 h-5" /></span>
                             ) : <span className="text-gray-400">-</span>}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3 border-t-2 border-accent/30 pt-4">
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 font-bold"><span>Cerrar</span></button>
              <button onClick={handleSubmit} className={`px-6 py-2 ${isAdmin ? 'bg-green-600 hover:bg-green-700' : 'bg-accent hover:bg-accent-hover'} text-white font-bold rounded-md shadow-lg transition-all flex items-center justify-center space-x-2 active:scale-95`}>
                  <CheckIcon className="w-5 h-5" />
                  <span>{isAdmin ? 'Guardar y Aplicar Inventario' : 'Guardar para Revisión'}</span>
              </button>
          </div>
        </div>
      </div>
      {activeCategoryForDetails && (
        <DetailedInventoryVerificationModal 
          isOpen={!!activeCategoryForDetails}
          onClose={() => setActiveCategoryForDetails(null)}
          category={activeCategoryForDetails}
          products={inventory.filter(p => p.categoryId === activeCategoryForDetails.id && !p.isDisabled)}
          initialCounts={detailedCounts[activeCategoryForDetails.id] || {}}
          onApplyCounts={(productCounts) => handleApplyDetailedCountsFromModal(activeCategoryForDetails.id, productCounts)}
          isAdmin={isAdmin}
          onSaveDraft={(counts) => onSaveDetailedDraft(activeCategoryForDetails.id, counts)}
          onApplyAdjustments={(counts) => onApplyDetailedVerification(activeCategoryForDetails.id, counts)}
          storeId={inventory[0]?.storeId || ''}
        />
      )}
    </>
  );
};
