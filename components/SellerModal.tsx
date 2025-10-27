

import React, { useState, useEffect } from 'react';
import { Seller, Role, Store } from '../types';

interface SellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // FIX: Changed ID props from number to string to match data model.
  onSave: (name: string, password: string, roleId: string, storeId: string) => void;
  seller: Seller | null;
  roles: Role[];
  stores: Store[];
}

const SellerModal: React.FC<SellerModalProps> = ({ isOpen, onClose, onSave, seller, roles, stores }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  // FIX: Changed state to handle string IDs.
  const [roleId, setRoleId] = useState<string | ''>('');
  const [storeId, setStoreId] = useState<string | ''>('');

  useEffect(() => {
    if (seller) {
      setName(seller.name);
      setRoleId(seller.roleId);
      setStoreId(seller.storeId);
      setPassword(''); // Clear password field for editing
    } else {
      setName('');
      setRoleId(roles.length > 0 ? roles[1]?.id || roles[0]?.id : '');
      setStoreId(stores.length > 0 ? stores[0].id : '');
      setPassword('');
    }
  }, [seller, roles, stores]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && roleId !== '' && storeId !== '') {
        if (!seller && !password.trim()) {
            alert("La contraseña es obligatoria para nuevos vendedores.");
            return;
        }
      // FIX: Removed incorrect Number() conversions.
      onSave(name, password, roleId, storeId);
    } else {
      alert("Por favor, completa todos los campos.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-accent mb-6">
          {seller ? 'Editar Vendedor' : 'Agregar Vendedor'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="sellerName" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre</label>
            <input
              type="text"
              id="sellerName"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              placeholder={seller ? "Dejar en blanco para no cambiar" : "Contraseña requerida"}
              required={!seller}
            />
          </div>
          <div>
            <label htmlFor="sellerRole" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Rol</label>
            <select
              id="sellerRole"
              value={roleId}
              // FIX: Removed incorrect Number() conversion.
              onChange={e => setRoleId(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              required
            >
              <option value="" disabled>Selecciona un rol</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sellerStore" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Tienda Asignada</label>
            <select
              id="sellerStore"
              value={storeId}
              // FIX: Removed incorrect Number() conversion.
              onChange={e => setStoreId(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              required
            >
              <option value="" disabled>Selecciona una tienda</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
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

export default SellerModal;
