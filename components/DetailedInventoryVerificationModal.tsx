
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, PendingDetailedVerification } from '../types';
import { SearchIcon, CrossIcon, CheckIcon, PackageIcon, EyeIcon, HistoryIcon } from './Icons';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface DetailedInventoryVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  products: Product[];
  initialCounts: Record<string, string>;
  onApplyCounts: (counts: Record<string, string>) => void;
  isAdmin: boolean;
  onSaveDraft: (counts: Record<string, number>) => Promise<void>;
  onApplyAdjustments: (counts: Record<string, number>) => Promise<void>;
  storeId: string;
}

type SortKey = 'name' | 'supplier' | 'stock' | 'physical' | 'difference';

const DetailedInventoryVerificationModal: React.FC<DetailedInventoryVerificationModalProps> = ({
  isOpen,
  onClose,
  category,
  products,
  initialCounts,
  onApplyCounts,
  isAdmin,
  onSaveDraft,
  onApplyAdjustments,
  storeId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [localCounts, setLocalCounts] = useState<Record<string, string>>(initialCounts);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [draftInfo, setDraftInfo] = useState<PendingDetailedVerification | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load draft from DB on mount
  useEffect(() => {
    if (isOpen) {
      const fetchDraft = async () => {
        setIsLoadingDraft(true);
        try {
          const draftId = `${category.id}_${storeId}`;
          const draftDoc = await getDoc(doc(db, 'pendingDetailedVerifications', draftId));
          if (draftDoc.exists()) {
            const data = draftDoc.data() as PendingDetailedVerification;
            setDraftInfo(data);
            
            // If we don't have local counts from parent, populate with draft
            if (Object.keys(localCounts).length === 0) {
              const newCounts: Record<string, string> = {};
              Object.entries(data.counts).forEach(([pid, val]) => {
                newCounts[pid] = val.toString();
              });
              setLocalCounts(newCounts);
            }
          }
        } catch (error) {
          console.error("Error loading draft:", error);
        } finally {
          setIsLoadingDraft(false);
        }
      };
      fetchDraft();
    }
  }, [isOpen, category.id, storeId]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.supplier && p.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortConfig.key === 'physical') {
        aVal = parseInt(localCounts[a.id] || '0', 10);
        bVal = parseInt(localCounts[b.id] || '0', 10);
      } else if (sortConfig.key === 'difference') {
        const aPhys = parseInt(localCounts[a.id] || '0', 10);
        const bPhys = parseInt(localCounts[b.id] || '0', 10);
        aVal = aPhys - a.stock;
        bVal = bPhys - b.stock;
      } else {
        aVal = a[sortConfig.key as keyof Product] || '';
        bVal = b[sortConfig.key as keyof Product] || '';
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, searchTerm, sortConfig, localCounts]);

  if (!isOpen) return null;

  const handleCountChange = (productId: string, value: string) => {
    setLocalCounts(prev => ({ ...prev, [productId]: value }));
  };

  const toggleVerified = (productId: string) => {
    setVerifiedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
        // Cuando se aplica el check, agregamos el valor del sistema a la casilla física automáticamente
        const product = products.find(p => p.id === productId);
        if (product) {
          setLocalCounts(prevCounts => ({
            ...prevCounts,
            [productId]: product.stock.toString()
          }));
        }
      }
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const prepareCountsForDB = () => {
    const final: Record<string, number> = {};
    Object.entries(localCounts).forEach(([pid, val]) => {
      const n = parseInt(val, 10);
      if (!isNaN(n)) final[pid] = n;
    });
    return final;
  };

  const handleDraftSave = async () => {
    setIsSaving(true);
    try {
      const counts = prepareCountsForDB();
      await onSaveDraft(counts);
      alert("Borrador guardado exitosamente. Un administrador podrá revisarlo y aplicarlo.");
      onApplyCounts(localCounts);
      onClose();
    } catch (e) {
      alert("Error al guardar el borrador.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyFinalAdjustments = async () => {
    if (!window.confirm("¿Estás seguro? Esto actualizará el stock real del sistema inmediatamente.")) return;
    setIsSaving(true);
    try {
      const counts = prepareCountsForDB();
      await onApplyAdjustments(counts);
      alert("Inventario actualizado correctamente.");
      onApplyCounts(localCounts);
      onClose();
    } catch (e) {
      alert("Error al aplicar los ajustes.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalPhysical = products.reduce((sum, p) => sum + (parseInt(localCounts[p.id] || '0', 10)), 0);
  const totalSystem = products.reduce((sum, p) => sum + p.stock, 0);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-secondary rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col overflow-hidden border border-accent/20">
        {/* Header */}
        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-accent/5">
          <div>
            <h2 className="text-xl font-bold text-accent">Verificación Detallada: {category.name}</h2>
            <div className="flex items-center gap-3 mt-1">
               <p className="text-xs text-slate-500 dark:text-slate-400">Sistema: {totalSystem} | Físico: {totalPhysical}</p>
               {draftInfo && (
                 <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded text-[10px] font-bold border border-yellow-500/20">
                   <HistoryIcon className="w-3 h-3" />
                   <span>BORRADOR: Editado por {draftInfo.lastUpdatedBy} ({new Date(draftInfo.updatedAt).toLocaleTimeString()})</span>
                 </div>
               )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-4 border-b dark:border-slate-800">
          <div className="relative flex-grow">
            <input 
              type="text"
              placeholder="Buscar por producto o marca..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg py-2 pl-10 pr-10 focus:ring-2 focus:ring-accent outline-none"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-accent transition-colors"
                  title="Limpiar búsqueda"
                >
                  <CrossIcon className="w-4 h-4" />
                </button>
            )}
          </div>
          <div className="flex gap-2">
             <button onClick={() => setVerifiedIds(new Set())} className="px-3 py-2 text-xs font-bold bg-slate-200 dark:bg-slate-800 rounded-lg hover:bg-slate-300 transition-colors">Limpiar Checkbox</button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-grow overflow-auto relative">
          {isLoadingDraft && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 z-20 flex items-center justify-center backdrop-blur-sm">
               <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
            </div>
          )}
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-sm">
              <tr>
                <th className="p-3 w-12 text-center">✓</th>
                <th className="p-3 w-16">Foto</th>
                <th className="p-3 cursor-pointer hover:text-accent transition-colors" onClick={() => handleSort('name')}>
                  Producto {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-accent transition-colors" onClick={() => handleSort('supplier')}>
                  Marca {sortConfig.key === 'supplier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-center cursor-pointer hover:text-accent transition-colors" onClick={() => handleSort('stock')}>
                  Sistema {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-center cursor-pointer hover:text-accent transition-colors" onClick={() => handleSort('physical')}>
                  Físico {sortConfig.key === 'physical' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-center cursor-pointer hover:text-accent transition-colors" onClick={() => handleSort('difference')}>
                  Diff {sortConfig.key === 'difference' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredAndSortedProducts.map(product => {
                const physical = parseInt(localCounts[product.id] || '0', 10);
                const diff = physical - product.stock;
                const isChecked = verifiedIds.has(product.id);

                return (
                  <tr key={product.id} className={`transition-colors ${isChecked ? 'bg-green-50/30 dark:bg-green-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={isChecked} onChange={() => toggleVerified(product.id)} className="w-5 h-5 rounded border-slate-300 text-accent focus:ring-accent cursor-pointer" />
                    </td>
                    <td className="p-3">
                      <div className="w-10 h-10 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center cursor-zoom-in overflow-hidden border border-slate-300 dark:border-slate-600" onClick={() => product.imageUrl && setPreviewImage(product.imageUrl)}>
                        {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageIcon className="w-5 h-5 text-slate-400" />}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-sm">{product.name}</p>
                      <p className="text-[10px] font-mono text-slate-500 uppercase">{product.sku}</p>
                    </td>
                    <td className="p-3 text-sm text-slate-600 dark:text-slate-400">{product.supplier || 'N/A'}</td>
                    <td className="p-3 text-center font-semibold text-slate-500">{product.stock}</td>
                    <td className="p-3 text-center">
                      <input type="number" min="0" value={localCounts[product.id] || ''} onChange={e => handleCountChange(product.id, e.target.value)} className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-center font-bold focus:ring-2 focus:ring-accent outline-none" />
                    </td>
                    <td className={`p-3 text-center font-bold ${diff === 0 ? 'text-green-500' : 'text-red-500'}`}>{diff > 0 ? `+${diff}` : diff}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredAndSortedProducts.length === 0 && <div className="p-20 text-center text-slate-500">No se encontraron productos.</div>}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500">
             * Los borradores se guardan globalmente para revisión de administradores.
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-2 bg-slate-200 dark:bg-slate-800 font-bold rounded-lg hover:bg-slate-300 transition-colors">Cancelar</button>
            <button onClick={handleDraftSave} disabled={isSaving} className="flex-1 sm:flex-none px-6 py-2 bg-accent/20 text-accent font-bold rounded-lg hover:bg-accent hover:text-white transition-colors disabled:opacity-50">
              {isSaving ? 'Guardando...' : 'Guardar Borrador'}
            </button>
            {isAdmin && (
              <button onClick={handleApplyFinalAdjustments} disabled={isSaving} className="flex-1 sm:flex-none px-8 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? 'Aplicando...' : 'Aplicar Ajustes'}
              </button>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full aspect-square bg-white rounded-lg overflow-hidden border-4 border-accent shadow-2xl">
            <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
            <button className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full"><CrossIcon /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedInventoryVerificationModal;
