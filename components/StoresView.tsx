import React, { useState } from 'react';
import { Store } from '../types';
import { EditIcon, PlusCircleIcon, TrashIcon } from './Icons';
import StoreModal from './StoreModal';

interface StoresViewProps {
  stores: Store[];
  onAddStore: (name: string) => void;
  onUpdateStore: (id: string, newName: string) => void;
  onDeleteStore: (id: string) => void;
}

const StoresView: React.FC<StoresViewProps> = ({ stores, onAddStore, onUpdateStore, onDeleteStore }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  const handleOpenAddModal = () => {
    setEditingStore(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (store: Store) => {
    setEditingStore(store);
    setIsModalOpen(true);
  };
  
  const handleSave = (name: string) => {
    if (editingStore) {
      onUpdateStore(editingStore.id, name);
    } else {
      onAddStore(name);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-6 border-b-2 border-accent/30 pb-2">
            <h2 className="text-2xl font-bold text-accent">Gestionar Tiendas</h2>
            <button onClick={handleOpenAddModal} className="bg-accent text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover">
              <PlusCircleIcon />
              <span>Agregar Tienda</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="p-3 text-sm font-semibold tracking-wide">ID</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Nombre de la Tienda</th>
                  <th className="p-3 text-sm font-semibold tracking-wide text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {stores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="p-3 text-gray-500 dark:text-text-dark">{store.id}</td>
                    <td className="p-3 font-bold">{store.name}</td>
                    <td className="p-3 text-center">
                        <div className="flex justify-center items-center space-x-2">
                            <button onClick={() => handleOpenEditModal(store)} className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors">
                                <EditIcon />
                            </button>
                            <button onClick={() => onDeleteStore(store.id)} className="text-gray-500 dark:text-text-dark hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors">
                                <TrashIcon />
                            </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <StoreModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          store={editingStore}
        />
      )}
    </>
  );
};

export default StoresView;
