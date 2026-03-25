import React, { useState, useEffect } from 'react';
import { Store } from '../types';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (store: Store) => void;
  store: Store | null;
  allStores: Store[];
}

const StoreModal: React.FC<StoreModalProps> = ({ isOpen, onClose, onSave, store, allStores }) => {
  const [name, setName] = useState('');
  const [initialBalances, setInitialBalances] = useState({ cash: 0, qr: 0 });
  const [crossStoreInitialBalances, setCrossStoreInitialBalances] = useState<Record<string, { cash: number; qr: number }>>({});

  useEffect(() => {
    if (store) {
      setName(store.name);
      setInitialBalances(store.initialBalances || { cash: 0, qr: 0 });
      setCrossStoreInitialBalances(store.crossStoreInitialBalances || {});
    } else {
      setName('');
      setInitialBalances({ cash: 0, qr: 0 });
      setCrossStoreInitialBalances({});
    }
  }, [store]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      const updatedStore: Store = {
        ...(store || {
          id: Math.random().toString(36).substr(2, 9),
          logo: null,
          contactInfo: '',
          footerText: '',
          whatsappFooterText: '',
          addiLink: '',
          sistecreditoLink: '',
          accentColor: '#ff007f',
          accentColorHover: '#e60073',
          nextInvoiceNumber: 1
        }),
        name,
        initialBalances,
        crossStoreInitialBalances
      };
      onSave(updatedStore);
    } else {
      alert("Por favor, ingresa un nombre para la tienda.");
    }
  };

  const handleUpdateCrossBalance = (storeId: string, field: 'cash' | 'qr', value: string) => {
    const num = parseFloat(value) || 0;
    setCrossStoreInitialBalances(prev => ({
      ...prev,
      [storeId]: {
        ...(prev[storeId] || { cash: 0, qr: 0 }),
        [field]: num
      }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl p-6 w-full max-w-2xl my-8">
        <h2 className="text-2xl font-black text-accent mb-6 uppercase tracking-widest">
          {store ? 'Configurar Sede' : 'Agregar Nueva Sede'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="storeName" className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Nombre de la Sede</label>
            <input
              type="text"
              id="storeName"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border-2 border-transparent focus:border-accent rounded-xl p-3 outline-none font-bold"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b pb-2">Saldos Iniciales Propios</h3>
              <p className="text-[10px] text-gray-400 italic">Dinero físico/real que hay en las cuentas de esta sede al iniciar.</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Efectivo</label>
                  <input
                    type="number"
                    value={initialBalances.cash}
                    onChange={e => setInitialBalances({ ...initialBalances, cash: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">QR (Nequi/Bancolombia)</label>
                  <input
                    type="number"
                    value={initialBalances.qr}
                    onChange={e => setInitialBalances({ ...initialBalances, qr: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-sm font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b pb-2">Dinero en Otras Sedes</h3>
              <p className="text-[10px] text-gray-400 italic">Dinero que PERTENECE a esta sede pero que está físicamente en las cuentas de otra sede.</p>
              
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                {allStores.filter(s => s.id !== store?.id).map(otherStore => (
                  <div key={otherStore.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] font-black text-accent uppercase mb-2">{otherStore.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Efectivo</label>
                        <input
                          type="number"
                          value={crossStoreInitialBalances[otherStore.id]?.cash || 0}
                          onChange={e => handleUpdateCrossBalance(otherStore.id, 'cash', e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 rounded p-1 text-[10px] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">QR</label>
                        <input
                          type="number"
                          value={crossStoreInitialBalances[otherStore.id]?.qr || 0}
                          onChange={e => handleUpdateCrossBalance(otherStore.id, 'qr', e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 rounded p-1 text-[10px] font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {allStores.filter(s => s.id !== store?.id).length === 0 && (
                  <p className="text-[10px] text-gray-400 italic text-center py-4">No hay otras sedes registradas.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-3 pt-4 border-t dark:border-gray-800">
            <button type="button" onClick={onClose} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-500 font-black uppercase text-[10px] rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
            <button type="submit" className="px-8 py-2.5 bg-accent text-white font-black uppercase text-[10px] rounded-xl shadow-lg shadow-accent/20 hover:scale-105 transition-all">Guardar Configuración</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreModal;
