import React, { useState } from 'react';
import { Store } from '../types';
import { EditIcon, PlusCircleIcon, TrashIcon } from './Icons';
import StoreModal from './StoreModal';
import { formatCOP } from '../constants';

interface StoresViewProps {
  stores: Store[];
  onAddStore: (store: Store) => void;
  onUpdateStore: (store: Store) => void;
  onDeleteStore: (id: string) => void;
  isDeveloper?: boolean;
}

const StoresView: React.FC<StoresViewProps> = ({ stores, onAddStore, onUpdateStore, onDeleteStore, isDeveloper = false }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  const handleOpenAddModal = () => {
    if (!isDeveloper) {
      alert('La creación de nuevas sedes está restringida al desarrollador del sistema. Por favor, comunícate con soporte/desarrollo para autorizar y habilitar una nueva sede.');
      return;
    }
    setEditingStore(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (store: Store) => {
    setEditingStore(store);
    setIsModalOpen(true);
  };
  
  const handleSave = (storeData: Store) => {
    if (editingStore) {
      onUpdateStore(storeData);
    } else {
      onAddStore(storeData);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-4">
        {!isDeveloper && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
            <p>
              🔒 <strong>Gestión de Licencias de Sedes:</strong> Solo el desarrollador puede autorizar y crear nuevas sedes según tu plan contratado. Puedes configurar los colores, balances y ajustes de tus sedes actuales.
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-6 border-b-2 border-accent/30 pb-2">
            <h2 className="text-2xl font-bold text-accent uppercase tracking-widest">Sedes y Almacenes</h2>
            {isDeveloper ? (
              <button onClick={handleOpenAddModal} className="bg-accent text-white font-black py-2.5 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all hover:scale-105 shadow-lg shadow-accent/20 text-[10px] uppercase">
                <PlusCircleIcon />
                <span>Agregar Sede</span>
              </button>
            ) : (
              <span className="text-xs font-bold text-slate-400">
                {stores.length} {stores.length === 1 ? 'Sede autorizada' : 'Sedes autorizadas'}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre de la Sede</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Saldos Iniciales</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {stores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                    <td className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: store.accentColor }}></div>
                            <span className="font-bold text-gray-800 dark:text-white uppercase text-sm">{store.name}</span>
                        </div>
                    </td>
                    <td className="p-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">EFEC: {formatCOP(store.initialBalances?.cash || 0)}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase">QR: {formatCOP(store.initialBalances?.qr || 0)}</span>
                        </div>
                    </td>
                    <td className="p-4 text-center">
                        <div className="flex justify-center items-center space-x-2">
                            <button onClick={() => handleOpenEditModal(store)} className="text-slate-500 hover:text-accent p-2 rounded-xl hover:bg-accent/10 transition-all" title="Editar Nombre y Configuración de Sede">
                                <EditIcon />
                            </button>
                            {isDeveloper && stores.length > 1 && (
                              <button onClick={() => onDeleteStore(store.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-500/10 transition-all" title="Eliminar Sede">
                                  <TrashIcon />
                              </button>
                            )}
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
          allStores={stores}
        />
      )}
    </>
  );
};

export default StoresView;
