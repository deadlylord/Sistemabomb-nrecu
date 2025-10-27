
import React, { useState } from 'react';
import { Store, Purchase } from '../types';

interface ReplicatePurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores: Store[];
  currentStoreId: string;
  purchasesToReplicate: Purchase[];
  onConfirm: (purchasesToCopy: Purchase[], targetStoreIds: string[]) => void;
}

const ReplicatePurchasesModal: React.FC<ReplicatePurchasesModalProps> = ({ isOpen, onClose, stores, currentStoreId, purchasesToReplicate, onConfirm }) => {
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const destinationStores = stores.filter(s => s.id !== currentStoreId);

  const handleStoreSelection = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleSubmit = () => {
    if (selectedStoreIds.length === 0) {
      alert("Debes seleccionar al menos una tienda de destino.");
      return;
    }
    if (window.confirm(`¿Seguro que quieres replicar ${purchasesToReplicate.length} compra(s) en ${selectedStoreIds.length} tienda(s)? Esto creará nuevos registros y actualizará el inventario.`)) {
        onConfirm(purchasesToReplicate, selectedStoreIds);
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold text-accent mb-4">Replicar Compras en Otras Tiendas</h2>
        <p className="text-gray-500 dark:text-text-dark mb-4">
          Se replicarán <span className="font-bold text-gray-800 dark:text-white">{purchasesToReplicate.length}</span> compra(s) seleccionada(s) en el rango de fechas. El stock se actualizará en las tiendas de destino.
        </p>

        <div className="flex-grow overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Selecciona las tiendas de destino:</label>
            <div className="space-y-2">
              {destinationStores.map(store => (
                <label key={store.id} className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedStoreIds.includes(store.id)}
                    onChange={() => handleStoreSelection(store.id)}
                    className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="font-semibold text-gray-800 dark:text-text-light">{store.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">
            Replicar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplicatePurchasesModal;
