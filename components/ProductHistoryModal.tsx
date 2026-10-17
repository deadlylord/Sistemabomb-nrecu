
import React from 'react';
import { Product, ProductHistoryLog } from '../types';
import { CrossIcon, TrashIcon } from './Icons';
import { calculateProductHistoryBalances } from '../services/productHistoryBalance';

interface ProductHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  history: ProductHistoryLog[];
  onDeleteLog?: (logId: string) => void;
}

const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({ isOpen, onClose, product, history, onDeleteLog }) => {
  if (!isOpen) return null;

  const productHistory = [...history]
    .filter(log => log.productId === product.id && log.storeId === product.storeId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const historyWithBalance = calculateProductHistoryBalances(productHistory, product.stock);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b-2 border-accent/30 pb-2">
            <div>
              <h2 className="text-2xl font-bold text-accent">Historial del Producto</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-text-dark">
                <span className="font-bold">{product.name}</span>
                <span>•</span>
                <span>SKU: {product.sku}</span>
                <span>•</span>
                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">ID: {product.id}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-gray-400">Stock Actual</p>
                <p className="text-xl font-black text-accent">{product.stock}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <CrossIcon />
              </button>
            </div>
        </div>
        
        <div className="flex-grow overflow-y-auto">
          {productHistory.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-text-dark py-10">No hay historial de cambios para este producto.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-sm font-semibold tracking-wide">Fecha</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Tipo</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Detalles</th>
                  <th className="p-3 text-sm font-semibold tracking-wide text-center">Stock Final</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Usuario</th>
                  {onDeleteLog && <th className="p-3 text-sm font-semibold tracking-wide text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {historyWithBalance.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="p-3 text-sm whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-3 text-sm">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-accent/10 text-accent border border-accent/20">
                            {log.changeType}
                        </span>
                    </td>
                    <td className="p-3 text-sm text-gray-600 dark:text-text-dark">{log.details}</td>
                    <td className="p-3 text-sm text-center">
                      <span className="font-bold text-base px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                        {log.balanceAfter === null ? '—' : log.balanceAfter}
                      </span>
                    </td>
                    <td className="p-3 text-sm font-medium">{log.changedBy}</td>
                    {onDeleteLog && (
                      <td className="p-3 text-sm text-center">
                        <button
                          onClick={() => {
                            if (window.confirm('¿Deseas eliminar este registro de historial duplicado?')) {
                              onDeleteLog(log.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Eliminar este registro duplicado"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
          <strong>Nota de Auditoría:</strong> La columna "Stock Final" se reconstruye desde el stock actual ({product.stock}) y los movimientos registrados. Un guion indica que falta un dato de un registro antiguo para calcular con certeza los saldos anteriores.
        </div>
      </div>
    </div>
  );
};

export default ProductHistoryModal;
