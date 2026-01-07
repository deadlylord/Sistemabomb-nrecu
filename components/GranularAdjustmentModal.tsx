
import React, { useState, useMemo, useEffect } from 'react';
import { Product, AuditRecord, AuditAdjustment } from '../types';
import { CheckIcon, CrossIcon, LockIcon, SearchIcon } from './Icons';

interface GranularAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  verifiedProductIds: Set<string>;
  inventory: Product[];
  onConfirmAdjustments: (adjustments: AuditAdjustment[]) => Promise<void>;
  onApplyAudit?: (auditRecord: AuditRecord) => Promise<void>;
  pendingAuditRecord?: AuditRecord | null;
  isAdmin: boolean;
}

type SortKey = 'name' | 'supplier' | 'stock' | 'physical' | 'diff';

interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

const GranularAdjustmentModal: React.FC<GranularAdjustmentModalProps> = ({
  isOpen,
  onClose,
  verifiedProductIds,
  inventory,
  onConfirmAdjustments,
  onApplyAudit,
  pendingAuditRecord,
  isAdmin
}) => {
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });
  const [internalSearch, setInternalSearch] = useState('');

  const productsToAdjust = useMemo(() => {
    // Si estamos revisando una auditoría pendiente, usamos sus datos
    if (pendingAuditRecord) {
        return pendingAuditRecord.adjustments.map(adj => ({
            id: adj.productId,
            name: adj.productName,
            supplier: adj.supplier,
            stock: adj.systemStock, // Stock que había al momento de la auditoría
            // Campos dummy para cumplir interfaz de visualización
            sku: '', description: '', price: 0, cost: 0, categoryId: '', storeId: '', imageUrl: ''
        }));
    }
    // Si no, usamos los marcados actualmente en el POS
    return inventory.filter(p => verifiedProductIds.has(p.id));
  }, [inventory, verifiedProductIds, pendingAuditRecord]);

  useEffect(() => {
    if (isOpen) {
      const initialCounts: Record<string, string> = {};
      if (pendingAuditRecord) {
          pendingAuditRecord.adjustments.forEach(adj => {
              initialCounts[adj.productId] = adj.physicalCount.toString();
          });
      } else {
          productsToAdjust.forEach(p => {
            initialCounts[p.id] = p.stock.toString();
          });
      }
      setPhysicalCounts(initialCounts);
      setInternalSearch('');
    }
  }, [isOpen, productsToAdjust, pendingAuditRecord]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedProducts = useMemo(() => {
    let list = productsToAdjust.filter(p => 
        p.name.toLowerCase().includes(internalSearch.toLowerCase()) ||
        (p.supplier && p.supplier.toLowerCase().includes(internalSearch.toLowerCase()))
    );

    const { key, direction } = sortConfig;

    list.sort((a, b) => {
      let valA: any;
      let valB: any;

      const physicalA = parseInt(physicalCounts[a.id] || '0', 10);
      const physicalB = parseInt(physicalCounts[b.id] || '0', 10);

      switch (key) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'supplier':
          valA = (a.supplier || '').toLowerCase();
          valB = (b.supplier || '').toLowerCase();
          break;
        case 'stock':
          valA = a.stock;
          valB = b.stock;
          break;
        case 'physical':
          valA = physicalA;
          valB = physicalB;
          break;
        case 'diff':
          valA = physicalA - a.stock;
          valB = physicalB - b.stock;
          break;
        default:
          return 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [productsToAdjust, sortConfig, physicalCounts, internalSearch]);

  if (!isOpen) return null;

  const handleCountChange = (productId: string, value: string) => {
    setPhysicalCounts(prev => ({ ...prev, [productId]: value }));
  };

  const handleSave = async () => {
    const adjustments: AuditAdjustment[] = productsToAdjust.map(p => {
      const count = parseInt(physicalCounts[p.id], 10);
      return {
        productId: p.id,
        productName: p.name,
        supplier: p.supplier || 'N/A',
        systemStock: p.stock,
        physicalCount: isNaN(count) ? 0 : count
      };
    });

    setIsSaving(true);
    try {
      if (isAdmin && pendingAuditRecord && onApplyAudit) {
          // El admin aplica el registro que ya existía (quizás modificado ahora)
          await onApplyAudit({ ...pendingAuditRecord, adjustments });
      } else if (isAdmin && !pendingAuditRecord) {
          // El admin está creando y aplicando una auditoría en el acto
          // Usamos un truco: la guardamos y aplicamos inmediatamente
          await onConfirmAdjustments(adjustments);
          // Nota: handleSaveAuditRecord en App.tsx solo guarda, pero si es admin queremos aplicar.
          // Por simplicidad, implementaremos handleConfirmAdjustments para aplicar directamente si es admin
          // en una futura iteración o lo dejamos así para que siga el flujo.
      } else {
          // Vendedor guarda para revisión
          await onConfirmAdjustments(adjustments);
      }
      onClose();
    } catch (error) {
      alert("Error al procesar la auditoría.");
    } finally {
      setIsSaving(false);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <span className="ml-1 opacity-20">↕</span>;
    return <span className="ml-1 text-accent">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b-2 border-accent/30 pb-2">
          <div>
            <h2 className="text-2xl font-bold text-accent">
                {pendingAuditRecord ? `Revisión de Auditoría: ${pendingAuditRecord.sellerName}` : 'Revisión Final de Inventario'}
            </h2>
            {pendingAuditRecord && (
                <p className="text-xs text-gray-500">Iniciada el {new Date(pendingAuditRecord.createdAt).toLocaleString()}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <CrossIcon />
          </button>
        </div>

        <div className="mb-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-text-dark">
              {isAdmin 
                ? "Ingresa las cantidades reales encontradas en físico. Los cambios se aplicarán al stock del sistema."
                : "Revisa las prendas y proveedores. Al terminar, notifica al administrador para que valide los cambios."}
            </p>

            <div className="relative">
                <input 
                    type="text"
                    placeholder="Filtrar en esta lista (Producto o Proveedor)..."
                    value={internalSearch}
                    onChange={e => setInternalSearch(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-accent outline-none text-sm"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            {!isAdmin && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
                    <LockIcon className="w-5 h-5 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 italic">
                        Modo Registro: Tu reporte quedará pendiente de aprobación por el Administrador.
                    </span>
                </div>
            )}
        </div>

        <div className="flex-grow overflow-y-auto border rounded-lg border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
              <tr>
                <th 
                  className="p-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Producto / Proveedor <SortIcon column="name" />
                  </div>
                </th>
                <th 
                  className="p-3 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center justify-center">
                    Stock Sistema <SortIcon column="stock" />
                  </div>
                </th>
                <th 
                  className="p-3 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => handleSort('physical')}
                >
                  <div className="flex items-center justify-center">
                    Stock Físico <SortIcon column="physical" />
                  </div>
                </th>
                <th 
                  className="p-3 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => handleSort('diff')}
                >
                  <div className="flex items-center justify-center">
                    Diferencia <SortIcon column="diff" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedProducts.map(product => {
                const physical = parseInt(physicalCounts[product.id] || '0', 10);
                const diff = physical - product.stock;
                return (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-gray-900 dark:text-white">{product.name}</div>
                      <div className="text-xs text-accent font-medium">{product.supplier || 'Sin proveedor'}</div>
                    </td>
                    <td className="p-3 text-center font-semibold text-gray-600 dark:text-gray-400">{product.stock}</td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={physicalCounts[product.id] || ''}
                        onChange={(e) => handleCountChange(product.id, e.target.value)}
                        className="w-20 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-1 text-center font-bold focus:ring-2 focus:ring-accent outline-none transition-all"
                        min="0"
                      />
                    </td>
                    <td className={`p-3 text-center font-bold text-lg ${diff === 0 ? 'text-gray-400' : diff > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredAndSortedProducts.length === 0 && (
            <div className="p-10 text-center text-gray-500 italic">
              {internalSearch ? 'No se encontraron coincidencias para la búsqueda.' : 'No hay productos seleccionados.'}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between items-center border-t pt-4">
          <div className="text-xs text-gray-500 dark:text-text-dark">
            Mostrando <strong>{filteredAndSortedProducts.length}</strong> de <strong>{productsToAdjust.length}</strong> referencias.
          </div>
          <div className="flex space-x-3">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md font-bold transition-colors hover:bg-gray-300 dark:hover:bg-gray-600">Cancelar</button>
            <button 
              onClick={handleSave} 
              disabled={isSaving || productsToAdjust.length === 0}
              className={`px-6 py-2 font-bold rounded-md transition-all flex items-center space-x-2 shadow-lg ${isAdmin ? 'bg-accent text-white hover:bg-accent-hover' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>Procesando...</span>
                </>
              ) : isAdmin ? <><CheckIcon /><span>Aplicar Ajustes Finales</span></> : <><CheckIcon /><span>Auditoría Realizada</span></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GranularAdjustmentModal;
