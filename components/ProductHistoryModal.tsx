
import React from 'react';
import { Product, ProductHistoryLog } from '../types';
import { CrossIcon } from './Icons';

interface ProductHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  history: ProductHistoryLog[];
}

const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({ isOpen, onClose, product, history }) => {
  if (!isOpen) return null;

  const productHistory = history
    .filter(log => log.productId === product.id && log.storeId === product.storeId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b-2 border-accent/30 pb-2">
            <div>
              <h2 className="text-2xl font-bold text-accent">Historial del Producto</h2>
              <p className="text-gray-500 dark:text-text-dark">{product.name} (SKU: {product.sku})</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              <CrossIcon />
            </button>
        </div>
        
        <div className="flex-grow overflow-y-auto">
          {productHistory.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-text-dark py-10">No hay historial de cambios para este producto.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="p-3 text-sm font-semibold tracking-wide">Fecha</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Tipo de Cambio</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Detalles</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Realizado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {productHistory.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="p-3 text-sm whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-3 text-sm">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-accent/20 text-accent">
                            {log.changeType}
                        </span>
                    </td>
                    <td className="p-3 text-sm text-gray-600 dark:text-text-dark">{log.details}</td>
                    <td className="p-3 text-sm">{log.changedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductHistoryModal;
