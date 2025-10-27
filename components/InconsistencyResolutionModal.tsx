import React from 'react';
import { Product } from '../types';
import { AlertTriangleIcon, CrossIcon, CheckIcon } from './Icons';
import { formatCOP } from '../constants';

interface InconsistencyResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  inconsistentProducts: Product[];
  onResolve: (productIds: string[]) => void;
}

const InconsistencyResolutionModal: React.FC<InconsistencyResolutionModalProps> = ({
  isOpen,
  onClose,
  inconsistentProducts,
  onResolve,
}) => {
  if (!isOpen) return null;

  const handleResolveClick = () => {
    onResolve(inconsistentProducts.map(p => p.id));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between mb-4 border-b-2 border-orange-500/30 pb-2">
          <div className="flex items-center space-x-3">
            <AlertTriangleIcon className="w-8 h-8 text-orange-400" />
            <div>
                <h2 className="text-2xl font-bold text-orange-400">Resolver Inconsistencias</h2>
                <p className="text-sm text-gray-500 dark:text-text-dark">Se encontraron productos descontinuados con stock.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mt-2 -mr-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <CrossIcon />
          </button>
        </div>

        <p className="text-gray-600 dark:text-text-dark mb-4">
          Se encontraron <strong>{inconsistentProducts.length}</strong> producto(s) marcados como 'descontinuados' que aún tienen unidades en stock. Esto puede causar errores en los reportes de inventario y conteos físicos. Se recomienda reactivarlos para asegurar la consistencia de los datos.
        </p>

        <div className="flex-grow overflow-y-auto border-t border-b border-gray-200 dark:border-gray-700">
          <table className="w-full text-left">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="p-3 text-sm font-semibold">Producto</th>
                <th className="p-3 text-sm font-semibold hidden sm:table-cell">SKU</th>
                <th className="p-3 text-sm font-semibold text-center">Stock Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {inconsistentProducts.map(product => (
                <tr key={product.id} className="bg-red-500/5 dark:bg-red-900/10">
                  <td className="p-3 font-semibold">{product.name}</td>
                  <td className="p-3 text-sm text-gray-500 dark:text-text-dark hidden sm:table-cell">{product.sku}</td>
                  <td className="p-3 text-center font-bold text-red-500">{product.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
            Cancelar
          </button>
          <button onClick={handleResolveClick} className="px-6 py-2 bg-orange-500 text-white font-bold rounded-md hover:bg-orange-600 transition-colors flex items-center space-x-2">
            <CheckIcon />
            <span>Reactivar {inconsistentProducts.length} Producto(s)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InconsistencyResolutionModal;
