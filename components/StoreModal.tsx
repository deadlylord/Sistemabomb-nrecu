import React, { useState, useEffect } from 'react';
import { Store } from '../types';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  store: Store | null;
}

const StoreModal: React.FC<StoreModalProps> = ({ isOpen, onClose, onSave, store }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (store) {
      setName(store.name);
    } else {
      setName('');
    }
  }, [store]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name);
    } else {
      alert("Por favor, ingresa un nombre para la tienda.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-accent mb-6">
          {store ? 'Editar Tienda' : 'Agregar Nueva Tienda'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="storeName" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre de la Tienda</label>
            <input
              type="text"
              id="storeName"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              required
              autoFocus
            />
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreModal;
