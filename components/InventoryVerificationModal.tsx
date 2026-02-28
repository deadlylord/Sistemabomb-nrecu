
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
  onSaveStockTake: (stockTakeData: Omit<StockTake, 'id' | 'createdAt' | 'storeId'>, applyNow: boolean) => Promise<void>;
  onSaveDetailedDraft: (categoryId: string, counts: Record<string, number>, systemSnapshot: Record<string, number>) => Promise<void>;
  onApplyDetailedVerification: (categoryId: string, counts: Record<string, number>) => Promise<void>;
  onUpdateStoreSettings: (updatedStore: Store) => Promise<void>;
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
  onUpdateStoreSettings,
}) => {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [detailedCounts, setDetailedCounts] = useState<Record<string, Record<string, string>>>({});
  const [selectedSeller, setSelectedSeller] = useState('');
  const [cashBase, setCashBase] = useState('');
  const [activeCategoryForDetails, setActiveCategoryForDetails] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Local reactive state for the toggle to ensure immediate UI feedback
  const [localHideDetailed, setLocalHideDetailed] = useState(true);

  useEffect(() => {
    if (currentStore) {
        // Use local date for comparison to ensure it matches the user's day
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const isEnabledToday = currentStore.detailedVerificationEnabledDate === today;
        
        // If it's enabled today, we follow hideDetailedVerificationForSellers (which would be false if admin enabled it)
        // If it's NOT enabled today, we force hide it (true)
        if (isEnabledToday) {
            setLocalHideDetailed(!!currentStore.hideDetailedVerificationForSellers);
        } else {
            setLocalHideDetailed(true);
        }
    }
  }, [currentStore?.hideDetailedVerificationForSellers, currentStore?.detailedVerificationEnabledDate]);

  useEffect(() => {
    if (!isOpen) {
        setCounts({});
        setDetailedCounts({});
        setSelectedSeller('');
        setCashBase('');
        setIsSaving(false);
        setSaveSuccess(false);
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

  const handleToggleMagnifyingGlasses = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!currentStore || !isAdmin) return;
      const newValue = e.target.checked; // true = Hide, false = Show
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Update local state immediately for UI responsiveness
      setLocalHideDetailed(newValue);
      
      const updatedStore: Store = { 
          ...currentStore, 
          hideDetailedVerificationForSellers: newValue,
          // When showing (newValue = false), we MUST set the date to today to activate it.
          // When hiding (newValue = true), we can keep the date or clear it, but hideDetailedVerificationForSellers=true will take precedence.
          detailedVerificationEnabledDate: newValue ? (currentStore.detailedVerificationEnabledDate || today) : today
      };
      
      try {
          await onUpdateStoreSettings(updatedStore);
          if (!newValue) {
              alert("✅ Verificación detallada activada para hoy.");
          } else {
              alert("🚫 Verificación detallada desactivada.");
          }
      } catch (error) {
          console.error("Failed to update store settings:", error);
          // Rollback local state on error
          setLocalHideDetailed(!newValue);
          alert("Error al actualizar la configuración de la tienda.");
      }
  };

  const handleApplyDetailedCountsFromModal = (catId: string, productCounts: Record<string, string>) => {
    setDetailedCounts(prev => ({ ...prev, [catId]: productCounts }));
    const sum = Object.values(productCounts).reduce((acc, val) => acc + (parseInt(val, 10) || 0), 0);
    setCounts(prev => ({ ...prev, [catId]: sum.toString() }));
  };

  const handleSubmit = async () => {
    if (!selectedSeller) {
      alert("Por favor, selecciona el vendedor que realiza la verificación.");
      return;
    }

    setIsSaving(true);
    try {
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
      
      await onSaveStockTake({
          seller: selectedSeller,
          cashBase: cashBase ? parseFloat(cashBase) : undefined,
          verification: verificationData,
          productCounts: flattenedProductCounts,
          isApplied: isAdmin 
      }, isAdmin);

      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error saving stock take:", error);
      alert("Error al guardar la verificación.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDetailedVerificationVisible = isAdmin || !localHideDetailed;

  const handleSaveDraftWithSnapshot = async (catId: string, productCounts: Record<string, number>) => {
      // Tomamos una "foto" del stock del sistema actual para todos los productos de la categoría
      const systemSnapshot: Record<string, number> = {};
      inventory
        .filter(p => p.categoryId === catId && !p.isDisabled)
        .forEach(p => {
            systemSnapshot[p.id] = p.stock;
        });
      
      await onSaveDetailedDraft(catId, productCounts, systemSnapshot);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="bg-white dark:bg-secondary rounded-none sm:rounded-2xl shadow-xl p-4 sm:p-6 w-full max-w-2xl h-full sm:h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start border-b-2 border-accent/30 pb-4 mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-accent tracking-tighter uppercase">Inventario y Apertura</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Revisión de stock antes de iniciar jornada</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><CrossIcon className="w-6 h-6"/></button>
          </div>
          
          <div className="mb-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-[10px] font-black text-gray-500 dark:text-text-dark uppercase tracking-widest mb-2">Vendedor Responsable</label>
                      <div className="flex flex-wrap gap-2">
                      {sellers.filter(seller => !seller.isDisabled).map(seller => (
                          <button key={seller.id} onClick={() => setSelectedSeller(seller.name)} className={`px-4 py-2 rounded-xl font-black transition-all text-xs uppercase tracking-tighter ${selectedSeller === seller.name ? 'bg-accent text-white shadow-lg shadow-accent/30 scale-105' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500'}`}>{seller.name}</button>
                      ))}
                    </div>
                  </div>
                   <div>
                      <label htmlFor="cashBase" className="block text-[10px] font-black text-gray-500 dark:text-text-dark uppercase tracking-widest mb-1">Base de Efectivo en Caja</label>
                       <input type="number" id="cashBase" value={cashBase} onChange={e => setCashBase(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border-2 border-transparent focus:border-accent rounded-xl p-3 outline-none font-black text-lg transition-all" placeholder="Ej: 100.000" min="0" />
                   </div>
              </div>

              {isAdmin && (
                  <div className="flex items-center justify-between p-3 bg-accent/5 rounded-xl border border-accent/20">
                      <div className="flex items-center gap-2">
                          <EyeIcon className="w-5 h-5 text-accent" />
                          <span className="text-[11px] font-black text-gray-700 dark:text-gray-200 uppercase tracking-tight">Ocultar lupas detalladas a vendedores</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={localHideDetailed}
                            onChange={handleToggleMagnifyingGlasses}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-accent"></div>
                      </label>
                  </div>
              )}
          </div>

          <div className="flex-grow overflow-y-auto pr-2 scrollbar-hide">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 rounded-xl overflow-hidden">
                <tr>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Categoría</th>
                  {isDetailedVerificationVisible && <th className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Detalle</th>}
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Conteo Físico</th>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {categoryTotals.map(category => {
                  const physicalCountStr = counts[category.id];
                  const physicalCount = physicalCountStr !== undefined && physicalCountStr !== '' ? parseInt(physicalCountStr, 10) : null;
                  const difference = physicalCount !== null ? physicalCount - category.totalStock : null;
                  return (
                    <tr key={category.id} className="hover:bg-accent/5 transition-colors h-16 group">
                      <td className="p-2">
                          <p className="font-black text-sm uppercase tracking-tight text-gray-700 dark:text-gray-200">{category.name}</p>
                          {isAdmin && (
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Sist: {category.totalStock}</p>
                          )}
                      </td>
                      {isDetailedVerificationVisible && (
                        <td className="p-2 text-center">
                            <button onClick={() => openDetailedVerification(category)} className="p-2.5 text-accent bg-accent/10 rounded-xl hover:bg-accent hover:text-white transition-all shadow-sm" title="Verificar por marca / producto"><EyeIcon className="w-5 h-5" /></button>
                        </td>
                      )}
                      <td className="p-2 text-center">
                        <input type="number" min="0" value={counts[category.id] || ''} onChange={(e) => handleCountChange(category.id, e.target.value)} className="w-20 bg-white dark:bg-gray-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center font-black text-base focus:ring-2 focus:ring-accent focus:border-accent outline-none shadow-inner" placeholder="0" />
                      </td>
                      <td className="p-2 text-center">
                         <div className="flex justify-center">
                             {physicalCount !== null ? (
                                 difference === 0 ? (
                                     <span className="text-green-500 bg-green-500/10 p-2 rounded-full" title="Correcto"><CheckIcon className="w-5 h-5" /></span>
                                 ) : (
                                     <span className="text-red-500 bg-red-500/10 p-2 rounded-full" title="Error en conteo"><CrossIcon className="w-5 h-5" /></span>
                                 )
                             ) : <span className="text-gray-300 dark:text-gray-700">--</span>}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3 border-t-2 border-accent/30 pt-4">
              <button onClick={onClose} disabled={isSaving} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center font-black text-xs uppercase tracking-widest text-gray-500 disabled:opacity-50">Cerrar</button>
              <button onClick={handleSubmit} disabled={isSaving || saveSuccess} className={`px-10 py-4 ${saveSuccess ? 'bg-green-500' : (isAdmin ? 'bg-green-600 hover:bg-green-700' : 'bg-accent hover:bg-accent-hover')} text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-2 active:scale-95 uppercase tracking-widest text-sm disabled:opacity-70`}>
                  {isSaving ? (
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : saveSuccess ? (
                    <CheckIcon className="w-6 h-6" />
                  ) : (
                    <CheckIcon className="w-6 h-6" />
                  )}
                  <span>{saveSuccess ? '¡Guardado con éxito!' : isSaving ? 'Guardando...' : (isAdmin ? 'Guardar y Aplicar Stock' : 'Enviar para Revisión')}</span>
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
          onSaveDraft={(counts) => handleSaveDraftWithSnapshot(activeCategoryForDetails.id, counts)}
          onApplyAdjustments={(counts) => onApplyDetailedVerification(activeCategoryForDetails.id, counts)}
          storeId={inventory[0]?.storeId || ''}
        />
      )}
    </>
  );
};
