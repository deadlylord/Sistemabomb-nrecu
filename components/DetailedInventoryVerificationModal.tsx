
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, PendingDetailedVerification } from '../types';
import { SearchIcon, CrossIcon, CheckIcon, PackageIcon, EyeIcon, HistoryIcon, TrashIcon, ChevronDownIcon, AlertTriangleIcon, PlusCircleIcon } from './Icons';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { formatCOP } from '../constants';

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
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // History and Draft States
  const [draftInfo, setDraftInfo] = useState<PendingDetailedVerification | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Audit State
  const [auditModeEntry, setAuditModeEntry] = useState<any | null>(null);

  // Fetch current draft and history logs
  const fetchDraftAndHistory = async () => {
    setIsLoadingDraft(true);
    try {
      const draftId = `${category.id}_${storeId}`;
      
      // 1. Current Active Draft
      const draftDoc = await getDoc(doc(db, 'pendingDetailedVerifications', draftId));
      if (draftDoc.exists()) {
        const data = draftDoc.data() as PendingDetailedVerification;
        setDraftInfo(data);
        
        if (Object.keys(localCounts).length === 0) {
          const newCounts: Record<string, string> = {};
          Object.entries(data.counts).forEach(([pid, val]) => {
            newCounts[pid] = (val as number).toString();
          });
          setLocalCounts(newCounts);
        }
      } else {
        setDraftInfo(null);
      }

      // 2. Chronological History (Solo para Admin)
      if (isAdmin) {
          const historyQuery = query(
            collection(db, 'detailedVerificationHistory'),
            where('draftId', '==', draftId)
          );
          const historySnap = await getDocs(historyQuery);
          const historyData = historySnap.docs
            .map(d => ({ ...d.data(), id: d.id } as any))
            // Fix: Cast updatedAt to any to resolve unknown type error during sorting
            .sort((a, b) => new Date(b.updatedAt as any).getTime() - new Date(a.updatedAt as any).getTime())
            .slice(0, 15);
          setHistoryList(historyData);
      }

    } catch (error) {
      console.error("Error loading verification data:", error);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDraftAndHistory();
    }
  }, [isOpen, category.id, storeId, isAdmin]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.supplier && p.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortConfig.key === 'physical') {
        if (auditModeEntry) {
            aVal = auditModeEntry.counts[a.id]?.physical || 0;
            bVal = auditModeEntry.counts[b.id]?.physical || 0;
        } else {
            aVal = parseInt(localCounts[a.id] || '0', 10);
            bVal = parseInt(localCounts[b.id] || '0', 10);
        }
      } else if (sortConfig.key === 'difference') {
        if (auditModeEntry) {
            const aSnap = auditModeEntry.counts[a.id] || { system: 0, physical: 0 };
            const bSnap = auditModeEntry.counts[b.id] || { system: 0, physical: 0 };
            aVal = aSnap.physical - aSnap.system;
            bVal = bSnap.physical - bSnap.system;
        } else {
            const aPhys = parseInt(localCounts[a.id] || '0', 10);
            const bPhys = parseInt(localCounts[b.id] || '0', 10);
            aVal = aPhys - a.stock;
            bVal = bPhys - b.stock;
        }
      } else if (sortConfig.key === 'stock') {
        if (auditModeEntry) {
            aVal = auditModeEntry.counts[a.id]?.system || 0;
            bVal = auditModeEntry.counts[b.id]?.system || 0;
        } else {
            aVal = a.stock;
            bVal = b.stock;
        }
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
  }, [products, searchTerm, sortConfig, localCounts, auditModeEntry]);

  if (!isOpen) return null;

  const handleCountChange = (productId: string, value: string) => {
    if (auditModeEntry) return; 
    setLocalCounts(prev => ({ ...prev, [productId]: value }));
  };

  const handleToggleCheck = (productId: string, currentSystemStock: number) => {
    if (auditModeEntry) return;
    
    setLocalCounts(prev => {
        const currentVal = prev[productId];
        if (currentVal === currentSystemStock.toString()) {
            const next = { ...prev };
            delete next[productId];
            return next;
        } else {
            return { ...prev, [productId]: currentSystemStock.toString() };
        }
    });
  };

  const handleResetAllCounts = () => {
    if (auditModeEntry) return;
    if (window.confirm("¿Seguro que deseas borrar todos los ingresos físicos de esta categoría?")) {
        setLocalCounts({});
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDraftSave = async () => {
    if (auditModeEntry) return;
    setIsSaving(true);
    try {
      const counts: Record<string, number> = {};
      Object.entries(localCounts).forEach(([pid, val]) => {
        const n = parseInt(val, 10);
        if (!isNaN(n)) counts[pid] = n;
      });
      
      await onSaveDraft(counts);
      onApplyCounts(localCounts);
      onClose();
    } catch (e: any) {
      alert("Error al guardar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuditHistory = (historyEntry: any) => {
    setAuditModeEntry(historyEntry);
    setShowHistory(false);
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    if (!window.confirm("¿Eliminar este registro permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'detailedVerificationHistory', id));
      setHistoryList(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      alert("Error al eliminar.");
    }
  };

  const handleApplyFinalAdjustments = async () => {
    if (auditModeEntry) return;
    if (!window.confirm("¡ATENCIÓN! Esto modificará el stock REAL del sistema ahora mismo. ¿Deseas proceder?")) return;
    setIsSaving(true);
    try {
      const counts: Record<string, number> = {};
      Object.entries(localCounts).forEach(([pid, val]) => {
        const n = parseInt(val, 10);
        if (!isNaN(n)) counts[pid] = n;
      });
      await onApplyAdjustments(counts);
      onApplyCounts(localCounts);
      onClose();
    } catch (e: any) {
      alert("Error al aplicar cambios: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  const totalPhysical = useMemo(() => {
      if (auditModeEntry) {
          return Object.values(auditModeEntry.counts).reduce((sum: number, val: any) => sum + (val.physical || 0), 0);
      }
      return products.reduce((sum, p) => sum + (parseInt(localCounts[p.id] || '0', 10)), 0);
  }, [products, localCounts, auditModeEntry]);

  const totalSystem = useMemo(() => {
      if (auditModeEntry) {
          return Object.values(auditModeEntry.counts).reduce((sum: number, val: any) => sum + (val.system || 0), 0);
      }
      return products.reduce((sum, p) => sum + p.stock, 0);
  }, [products, auditModeEntry]);

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-secondary rounded-none sm:rounded-2xl shadow-2xl w-full max-w-6xl h-full sm:h-[95vh] flex flex-col overflow-hidden border border-accent/20" onClick={e => e.stopPropagation()}>
        
        {auditModeEntry && (
            <div className="bg-orange-600 text-white p-3 px-6 flex justify-between items-center shadow-lg z-20">
                <div className="flex items-center gap-3">
                    <HistoryIcon className="w-6 h-6 animate-spin-slow" />
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest leading-none">MODO AUDITORÍA DE SNAPSHOT</p>
                        {/* Fix: Cast updatedAt to any to avoid unknown type error when formatting date */}
                        <p className="text-[10px] font-bold opacity-80 mt-1">Estado guardado por {auditModeEntry.lastUpdatedBy} el {new Date(auditModeEntry.updatedAt as any).toLocaleString()}</p>
                    </div>
                </div>
                <button onClick={() => setAuditModeEntry(null)} className="bg-white text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-gray-100 transition-all shadow-md active:scale-95">Regresar al Borrador Actual</button>
            </div>
        )}

        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-start bg-accent/5">
          <div className="space-y-1">
            <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-accent uppercase tracking-tighter">
                    {category.name}
                </h2>
                {isAdmin && (
                    <button 
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${showHistory ? 'bg-accent text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-accent'}`}
                    >
                        <HistoryIcon className="w-4 h-4" />
                        Historial de "Fotos" (Snapshots)
                        <ChevronDownIcon className={`w-3 h-3 transition-transform duration-300 ${showHistory ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-6 mt-2">
               <div className="flex gap-4">
                  <div className="text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Unidades Sistema</p>
                      <p className="text-lg font-black text-gray-700 dark:text-gray-200">
                          {totalSystem}
                      </p>
                  </div>
                  <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 self-center"></div>
                  <div className="text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Unidades Físicas (Conteo)</p>
                      <p className="text-lg font-black text-accent">{totalPhysical}</p>
                  </div>
               </div>
               
               {!auditModeEntry && (
                   <div className={`px-4 py-2 rounded-xl flex flex-col items-center ${totalPhysical === totalSystem ? 'bg-green-500/10 text-green-600 border border-green-200' : 'bg-red-500/10 text-red-600 border border-red-200'}`}>
                       <p className="text-[8px] font-black uppercase tracking-tighter">Diferencia Neta</p>
                       <p className="text-base font-black leading-none">{totalPhysical - totalSystem}</p>
                   </div>
               )}
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
            <CrossIcon className="w-8 h-8" />
          </button>
        </div>

        {showHistory && isAdmin && (
            <div className="absolute top-[120px] left-0 right-0 bg-white dark:bg-slate-900 z-50 border-b-4 border-accent shadow-2xl animate-fade-in p-6 max-h-[500px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 border-b dark:border-gray-800 pb-3">
                    <div>
                        <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Auditoría Cronológica de Inventarios</h3>
                        <p className="text-xs text-gray-500">Selecciona un momento en el tiempo para ver cómo estaba el stock vs el conteo del vendedor.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {historyList.length > 0 ? historyList.map((entry) => {
                        let snapPhys = 0; let snapSyst = 0;
                        Object.values(entry.counts).forEach((val: any) => {
                            snapPhys += (val.physical || 0);
                            snapSyst += (val.system || 0);
                        });
                        const diff = snapPhys - snapSyst;

                        return (
                        <div key={entry.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col group hover:border-accent transition-all cursor-pointer" onClick={() => handleAuditHistory(entry)}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    {/* Fix: Cast updatedAt to any to resolve unknown type error when formatting date in history map */}
                                    <p className="text-xs font-black text-accent uppercase leading-none">{new Date(entry.updatedAt as any).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Vendedor: {entry.lastUpdatedBy}</p>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteHistoryEntry(entry.id); }}
                                    className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex justify-around items-center bg-white dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="text-center">
                                    <p className="text-[8px] font-black uppercase text-gray-400">Sistema</p>
                                    <p className="text-base font-black text-blue-500">{snapSyst}</p>
                                </div>
                                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                                <div className="text-center">
                                    <p className="text-[8px] font-black uppercase text-gray-400">Conteo</p>
                                    <p className="text-base font-black text-accent">{snapPhys}</p>
                                </div>
                                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                                <div className="text-center">
                                    <p className="text-[8px] font-black uppercase text-gray-400">Dif.</p>
                                    <p className={`text-base font-black ${diff === 0 ? 'text-green-500' : 'text-red-500'}`}>{diff > 0 ? '+' : ''}{diff}</p>
                                </div>
                            </div>
                            <div className="mt-3 text-center">
                                <span className="text-[9px] font-black text-accent uppercase underline">Haga clic para ver detalle del snapshot</span>
                            </div>
                        </div>
                    )}) : <div className="col-span-full py-10 text-center text-gray-400 italic">No hay registros históricos para esta categoría.</div>}
                </div>
            </div>
        )}

        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-4 border-b dark:border-slate-800">
          <div className="relative flex-grow">
            <input 
              type="text"
              placeholder="Buscar por marca o nombre de prenda..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border-2 border-transparent focus:border-accent rounded-2xl py-3 pl-12 pr-12 outline-none font-bold text-sm shadow-inner transition-all"
            />
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
            {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-accent"><CrossIcon className="w-5 h-5"/></button>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
             {!auditModeEntry && (
                 <button 
                    onClick={handleResetAllCounts} 
                    className="flex-1 sm:flex-none px-6 py-3 text-[10px] font-black uppercase tracking-widest bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95"
                    title="Borrar todos los conteos ingresados"
                 >
                    <TrashIcon className="w-4 h-4" />
                    <span>Reiniciar Conteo</span>
                 </button>
             )}
          </div>
        </div>

        <div className="flex-grow overflow-auto relative">
          {isLoadingDraft && (
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/80 z-30 flex flex-col items-center justify-center backdrop-blur-sm">
               <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent mb-4"></div>
               <p className="font-black text-accent uppercase tracking-widest animate-pulse">Cargando datos de verificación...</p>
            </div>
          )}
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-sm">
              <tr>
                <th className="p-4 w-16 text-center font-black">✓</th>
                <th className="p-4 w-20 text-[10px] font-black uppercase text-gray-500">Imagen</th>
                <th className="p-4 cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-500" onClick={() => handleSort('name')}>
                  Producto {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-4 cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-500" onClick={() => handleSort('supplier')}>
                  Marca {sortConfig.key === 'supplier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-4 text-center cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-500" onClick={() => handleSort('stock')}>
                  Stock Sist {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-4 text-center cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-500" onClick={() => handleSort('physical')}>
                  Conteo Físico {sortConfig.key === 'physical' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-4 text-center cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-500" onClick={() => handleSort('difference')}>
                  Diferencia {sortConfig.key === 'difference' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredAndSortedProducts.map(product => {
                let systemStock = product.stock;
                let physicalStr = localCounts[product.id] || '';
                let physical = parseInt(physicalStr, 10);
                
                if (auditModeEntry) {
                    const snap = auditModeEntry.counts[product.id] || { system: 0, physical: 0 };
                    systemStock = snap.system;
                    physical = snap.physical;
                    physicalStr = physical.toString();
                }

                const hasValue = physicalStr !== '';
                const diff = (hasValue ? physical : 0) - systemStock;
                const isCorrect = hasValue && diff === 0;

                return (
                  <tr key={product.id} className={`transition-colors group ${isCorrect ? 'bg-green-500/5 dark:bg-green-900/5' : ''} ${auditModeEntry ? 'bg-gray-50/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                    <td className="p-4 text-center">
                      <button 
                        disabled={!!auditModeEntry}
                        onClick={() => handleToggleCheck(product.id, systemStock)}
                        className={`p-2 rounded-full transition-all active:scale-90 ${isCorrect ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 opacity-20 group-hover:opacity-100'}`}
                      >
                        <CheckIcon className="w-5 h-5" />
                      </button>
                    </td>
                    <td className="p-2">
                      <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-zoom-in overflow-hidden border border-gray-200 dark:border-gray-600 shadow-sm" onClick={() => product.imageUrl && setPreviewImage(product.imageUrl)}>
                        {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageIcon className="w-6 h-6 text-slate-400" />}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-black text-sm uppercase leading-tight text-gray-800 dark:text-gray-200">{product.name}</p>
                      <p className="text-[9px] font-mono text-slate-500 uppercase mt-1">{product.sku}</p>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{product.supplier || 'SIN MARCA'}</td>
                    
                    <td className={`p-4 text-center font-black text-base ${auditModeEntry ? 'text-blue-500' : 'text-gray-400'}`}>
                        {systemStock}
                    </td>

                    <td className="p-4 text-center">
                      {auditModeEntry ? (
                          <span className="font-black text-lg text-accent">{physicalStr}</span>
                      ) : (
                          <input 
                            type="number" 
                            min="0" 
                            value={physicalStr} 
                            onChange={e => handleCountChange(product.id, e.target.value)} 
                            className={`w-20 bg-white dark:bg-gray-800 border-2 rounded-xl p-2.5 text-center font-black text-base focus:ring-4 focus:ring-accent/20 outline-none transition-all ${hasValue ? 'border-accent shadow-md' : 'border-slate-200 dark:border-slate-700'}`} 
                            placeholder="0"
                          />
                      )}
                    </td>

                    <td className="p-4 text-center">
                        {hasValue ? (
                            <div className={`flex flex-col items-center justify-center`}>
                                <span className={`text-lg font-black ${diff === 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {diff > 0 ? `+${diff}` : diff}
                                </span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${diff === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {diff === 0 ? 'CORRECTO' : 'DESCUADRE'}
                                </span>
                            </div>
                        ) : <span className="text-gray-300 dark:text-gray-700 font-bold uppercase text-[9px]">PENDIENTE</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredAndSortedProducts.length === 0 && (
              <div className="py-40 text-center flex flex-col items-center">
                  <SearchIcon className="w-16 h-16 text-gray-200 mb-4" />
                  <p className="text-gray-400 font-black uppercase tracking-widest italic">No se encontraron productos en esta categoría.</p>
              </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-xl">
             <AlertTriangleIcon className="w-6 h-6 flex-shrink-0 text-yellow-500" />
             <p className="leading-relaxed">
                {auditModeEntry 
                  ? 'Estás visualizando una "Foto Histórica". Los datos de Sistema y Conteo son fijos de ese momento específico.'
                  : 'Cada vez que guardas un borrador, el sistema toma una foto exacta del stock actual para permitir auditorías posteriores comparando contra tu conteo físico.'}
             </p>
          </div>
          <div className="flex gap-3 w-full lg:w-auto">
            <button onClick={onClose} className="flex-1 lg:flex-none px-8 py-3 bg-slate-200 dark:bg-slate-800 font-black rounded-2xl hover:bg-slate-300 transition-colors uppercase text-xs tracking-widest active:scale-95">Cerrar</button>
            {!auditModeEntry && (
              <>
                <button 
                    onClick={handleDraftSave} 
                    disabled={isSaving} 
                    className="flex-1 lg:flex-none px-8 py-3 bg-accent text-white font-black rounded-2xl hover:bg-accent-hover transition-all disabled:opacity-50 uppercase text-xs tracking-widest shadow-xl shadow-accent/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSaving ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> : <CheckIcon className="w-5 h-5" />}
                  <span>Guardar Borrador</span>
                </button>
                {isAdmin && (
                  <button 
                    onClick={handleApplyFinalAdjustments} 
                    disabled={isSaving} 
                    className="flex-1 lg:flex-none px-8 py-3 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 shadow-xl shadow-green-600/30 transition-all active:scale-95 disabled:opacity-50 uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    <PlusCircleIcon className="w-5 h-5"/>
                    <span>Aplicar al Stock Real</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[400] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl w-full aspect-square bg-white rounded-3xl overflow-hidden border-4 border-accent shadow-2xl flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain" />
            <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 bg-black/50 text-white p-3 rounded-full hover:bg-accent transition-colors shadow-lg active:scale-90"><CrossIcon className="w-6 h-6" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedInventoryVerificationModal;
