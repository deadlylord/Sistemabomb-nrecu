

import React, { useState, useEffect } from 'react';
import { Seller, Role, Store } from '../types';
import { EyeIcon, EyeOffIcon } from './Icons';

interface SellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, password: string, roleId: string, storeId: string) => void;
  seller: Seller | null;
  roles: Role[];
  stores: Store[];
}

const SellerModal: React.FC<SellerModalProps> = ({ isOpen, onClose, onSave, seller, roles, stores }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState<string | ''>('');
  const [storeId, setStoreId] = useState<string | ''>('');

  useEffect(() => {
    if (seller) {
      setName(seller.name);
      setRoleId(seller.roleId);
      setStoreId(seller.storeId);
      setPassword(seller.password || '');
      setShowPassword(false);
    } else {
      setName('');
      setRoleId(roles.length > 0 ? roles[1]?.id || roles[0]?.id : '');
      setStoreId(stores.length > 0 ? stores[0].id : '');
      setPassword('');
      setShowPassword(false);
    }
  }, [seller, roles, stores, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && roleId !== '' && storeId !== '') {
      if (!password.trim()) {
        alert("La contraseña es obligatoria.");
        return;
      }
      onSave(name.trim(), password.trim(), roleId, storeId);
    } else {
      alert("Por favor, completa todos los campos.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-accent mb-6">
          {seller ? 'Editar Vendedor / Usuario' : 'Agregar Vendedor / Usuario'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="sellerName" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre</label>
            <input
              type="text"
              id="sellerName"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-bold"
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-500 dark:text-text-dark">Contraseña</label>
              <span className="text-[10px] text-accent font-semibold">
                {seller ? 'Puedes ver y editar la clave actual' : 'Clave de acceso'}
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-mono font-bold"
                placeholder="Ingresa la contraseña"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-accent p-1 transition-colors"
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="sellerRole" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Rol</label>
            <select
              id="sellerRole"
              value={roleId}
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
          <div className="mt-6 flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">Cancelar</button>
            <button type="submit" className="px-5 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors font-bold shadow-md shadow-accent/20">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SellerModal;
