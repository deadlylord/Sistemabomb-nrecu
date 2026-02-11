
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, PendingDetailedVerification } from '../types';
import { SearchIcon, CrossIcon, CheckIcon, PackageIcon, EyeIcon, HistoryIcon, TrashIcon, ChevronDownIcon } from './Icons';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

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
  
  // History and Draft States
  const [draftInfo, setDraftInfo] = useState<PendingDetailedVerification | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Audit State
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
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 10);
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
    if (auditModeEntry) return; // Locked in audit mode
    setLocalCounts(prev => ({ ...prev, [productId]: value }));
  };

  const handleResetAllCounts = () => {
    if (auditModeEntry) return;
    if (window.confirm("¿Seguro que deseas borrar todos los conteos físicos ingresados en esta lista?")) {
        setLocalCounts({});
        setVerifiedIds(new Set());
    }
  };

  const toggleVerified = (productId: string) => {
    if (auditModeEntry) return;
    setVerifiedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
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
      const n = parseInt(val as string, 10);
      if (!isNaN(n)) final[pid] = n;
    });
    return final;
  };

  const handleDraftSave = async () => {
    if (auditModeEntry) return;
    setIsSaving(true);
    try {
      const counts = prepareCountsForDB();
      await onSaveDraft(counts);
      alert("Borrador guardado exitosamente.");
      onApplyCounts(localCounts);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuditHistory = (historyEntry: any) => {
    setAuditModeEntry(historyEntry);
    setShowHistory(false);
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este registro del historial permanentemente?")) return;
    
    try {
      await deleteDoc(doc(db, 'detailedVerificationHistory', id));
      setHistoryList(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting history entry:", error);
      alert("Error al eliminar el registro.");
    }
  };

  const handleExitAudit = () => {
      setAuditModeEntry(null);
  }

  const handleApplyFinalAdjustments = async () => {
    if (auditModeEntry) return;
    if (!window.confirm("¿Estás seguro? Esto actualizará el stock real del sistema inmediatamente.")) return;
    setIsSaving(true);
    try {
      const counts = prepareCountsForDB();
      await onApplyAdjustments(counts);
      alert("Inventario actualizado correctamente.");
      onApplyCounts(localCounts);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const totalPhysical = auditModeEntry 
    ? Object.values(auditModeEntry.counts).reduce((sum: number, val: any) => sum + (typeof val === 'object' ? val.physical : val), 0)
    : products.reduce((sum, p) => sum + (parseInt(localCounts[p.id] || '0', 10)), 0);

  const totalSystem = auditModeEntry
    ? Object.values(auditModeEntry.counts).reduce((sum: number, val: any) => sum + (typeof val === 'object' ? val.system : 0), 0)
    : products.reduce((sum, p) => sum + p.stock, 0);

  return (
    <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => onClose()}>
      <div className="bg-white dark:bg-secondary rounded-none sm:rounded-xl shadow-2xl w-full max-w-5xl h-full sm:h-[95vh] flex flex-col overflow-hidden border border-accent/20" onClick={e => e.stopPropagation()}>
        {/* Audit Mode Banner */}
        {auditModeEntry && (
            <div className="bg-red-600 text-white p-2 px-4 flex justify-between items-center animate-pulse">
                <div className="flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Modo Auditoría: Viendo foto del {new Date(auditModeEntry.updatedAt).toLocaleString()}</span>
                </div>
                <button onClick={handleExitAudit} className="bg-white text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-gray-100 transition-all shadow-lg">Salir y Volver al Borrador Actual</button>
            </div>
        )}

        {/* Header */}
        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-accent/5">
          <div className="flex-grow">
            <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-black text-accent uppercase tracking-tighter">
                    {auditModeEntry ? 'Auditando:' : 'Verificando:'} {category.name}
                </h2>
                {isAdmin && !auditModeEntry && (
                    <button 
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${showHistory ? 'bg-accent text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                    >
                        <HistoryIcon className="w-3.5 h-3.5" />
                        Historial de Borradores
                        <ChevronDownIcon className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
               <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Sistema: {totalSystem} uds | Físico: {totalPhysical} uds</p>
               {!auditModeEntry && draftInfo && (
                 <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-lg text-[9px] font-black border border-yellow-500/20">
                   <CheckIcon className="w-3 h-3" />
                   <span>Último Guardado: {new Date(draftInfo.updatedAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                 </div>
               )}
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>

        {/* History Dropdown Overlay (Solo para Admin) */}
        {showHistory && isAdmin && (
            <div className="absolute top-[88px] left-0 right-0 bg-white dark:bg-slate-900 z-50 border-b border-gray-200 dark:border-gray-800 shadow-2xl animate-fade-in p-4 max-h-[400px] overflow-y-auto">
                <div className="flex items-center justify-between mb-3 border-b dark:border-gray-800 pb-2">
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Borradores e Imágenes de Sistema Anteriores</h3>
                    <span className="text-[9px] text-accent font-bold italic">Selecciona para comparar el estado en ese preciso momento</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {historyList.length > 0 ? historyList.map((entry) => {
                        let entryPhysicalTotal = 0;
                        let entrySystemTotal = 0;
                        Object.values(entry.counts).forEach((val: any) => {
                            if (typeof val === 'object') {
                                entryPhysicalTotal += val.physical;
                                entrySystemTotal += val.system;
                            } else {
                                entryPhysicalTotal += val;
                            }
                        });

                        return (
                        <div key={entry.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col group hover:border-accent/50 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-[10px] font-black text-accent uppercase leading-none">{new Date(entry.updatedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Por: {entry.lastUpdatedBy}</p>
                                </div>
                                <div className="flex gap-1.5">
                                    <button 
                                        onClick={() => handleAuditHistory(entry)}
                                        className="px-3 py-1 bg-white dark:bg-gray-700 text-[10px] font-black rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-accent hover:text-white transition-all shadow-sm"
                                    >
                                        Auditar
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteHistoryEntry(entry.id)}
                                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                        title="Eliminar registro"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                <span className="text-gray-400">SNAP:</span>
                                <div className="flex gap-3">
                                    <span className="text-blue-500">SIST: {entrySystemTotal}</span>
                                    <span className="text-accent">CONT: {entryPhysicalTotal}</span>
                                </div>
                            </div>
                        </div>
                    )}) : <p className="text-sm text-gray-500 italic p-4 text-center col-span-full">No hay historial de versiones para este borrador.</p>}
                </div>
            </div>
        )}

        {/* Controls */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-3 border-b dark:border-slate-800">
          <div className="relative flex-grow">
            <input 
              type="text"
              placeholder="Buscar por marca o nombre de prenda..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-10 focus:ring-2 focus:ring-accent outline-none font-bold text-sm"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          </div>
          <div className="flex gap-2 shrink-0">
             {!auditModeEntry && (
               <>
                 <button 
                    onClick={handleResetAllCounts} 
                    className="flex-1 sm:flex-none px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                    title="Borrar todos los ingresos físicos"
                 >
                    <TrashIcon className="w-4 h-4" />
                    <span>Restablecer</span>
                 </button>
                 <button onClick={() => setVerifiedIds(new Set())} className="flex-1 sm:flex-none px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-slate-200 dark:bg-slate-800 rounded-xl hover:bg-slate-300 transition-colors">Limpiar Checks</button>
               </>
             )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-grow overflow-auto relative">
          {isLoadingDraft && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 z-20 flex items-center justify-center backdrop-blur-sm">
               <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
            </div>
          )}
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-sm">
              <tr>
                <th className="p-3 w-12 text-center font-black">✓</th>
                <th className="p-3 w-16 text-[10px] font-black uppercase text-gray-400">Foto</th>
                <th className="p-3 cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-400" onClick={() => handleSort('name')}>
                  Producto {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-400" onClick={() => handleSort('supplier')}>
                  Marca {sortConfig.key === 'supplier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-center cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-400" onClick={() => handleSort('stock')}>
                  Sist {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-center cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-400" onClick={() => handleSort('physical')}>
                  Físico {sortConfig.key === 'physical' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-center cursor-pointer hover:text-accent transition-colors text-[10px] font-black uppercase text-gray-400" onClick={() => handleSort('difference')}>
                  Dif {sortConfig.key === 'difference' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredAndSortedProducts.map(product => {
                let systemStock = product.stock;
                let physical = parseInt(localCounts[product.id] || '0', 10);
                
                if (auditModeEntry) {
                    const snap = auditModeEntry.counts[product.id] || { system: 0, physical: 0 };
                    systemStock = snap.system;
                    physical = snap.physical;
                }

                const diff = physical - systemStock;
                const isChecked = verifiedIds.has(product.id);

                return (
                  <tr key={product.id} className={`transition-colors ${isChecked ? 'bg-green-50/30 dark:bg-green-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'} ${auditModeEntry ? 'bg-gray-50/20' : ''}`}>
                    <td className="p-3 text-center">
                      <input type="checkbox" disabled={!!auditModeEntry} checked={isChecked} onChange={() => toggleVerified(product.id)} className="w-6 h-6 rounded-lg border-slate-300 text-accent focus:ring-accent cursor-pointer disabled:opacity-30" />
                    </td>
                    <td className="p-2">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center cursor-zoom-in overflow-hidden border border-slate-300 dark:border-slate-600" onClick={() => product.imageUrl && setPreviewImage(product.imageUrl)}>
                        {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageIcon className="w-6 h-6 text-slate-400" />}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-black text-sm uppercase leading-tight">{product.name}</p>
                      <p className="text-[9px] font-mono text-slate-500 uppercase">{product.sku}</p>
                    </td>
                    <td className="p-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{product.supplier || 'N/A'}</td>
                    <td className={`p-3 text-center font-black ${auditModeEntry ? 'text-blue-500' : 'text-slate-400'}`}>{systemStock}</td>
                    <td className="p-3 text-center">
                      {auditModeEntry ? (
                          <span className="font-black text-sm">{physical}</span>
                      ) : (
                          <input type="number" min="0" value={localCounts[product.id] || ''} onChange={e => handleCountChange(product.id, e.target.value)} className="w-16 sm:w-20 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-center font-black text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none" />
                      )}
                    </td>
                    <td className={`p-3 text-center font-black text-sm ${diff === 0 ? 'text-green-500' : 'text-red-500'}`}>{diff > 0 ? `+${diff}` : diff}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredAndSortedProducts.length === 0 && <div className="p-20 text-center text-slate-500 font-bold italic">No se encontraron productos en esta categoría.</div>}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left leading-relaxed">
             {auditModeEntry 
               ? 'Estás en MODO AUDITORÍA. Los datos mostrados corresponden al momento exacto en que el vendedor guardó el borrador.'
               : 'Cada vez que guardas, queda registrada la foto exacta del stock de sistema en ese momento para auditoría posterior.'}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 bg-slate-200 dark:bg-slate-800 font-black rounded-2xl hover:bg-slate-300 transition-colors uppercase text-xs">Cerrar</button>
            {!auditModeEntry && (
              <>
                <button onClick={handleDraftSave} disabled={isSaving} className="flex-1 sm:flex-none px-6 py-3 bg-accent text-white font-black rounded-2xl hover:bg-accent-hover transition-all disabled:opacity-50 uppercase text-xs shadow-lg shadow-accent/20">
                  {isSaving ? 'Guardando...' : 'Guardar Borrador'}
                </button>
                {isAdmin && (
                  <button onClick={handleApplyFinalAdjustments} disabled={isSaving} className="flex-1 sm:flex-none px-8 py-3 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 shadow-xl shadow-green-600/30 transition-all active:scale-95 disabled:opacity-50 uppercase text-xs">
                    {isSaving ? 'Aplicando...' : 'Aplicar al Stock Actual'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[400] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full aspect-square bg-white rounded-2xl overflow-hidden border-4 border-accent shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
            <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 bg-black/50 text-white p-3 rounded-full hover:bg-accent transition-colors shadow-lg"><CrossIcon /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedInventoryVerificationModal;
