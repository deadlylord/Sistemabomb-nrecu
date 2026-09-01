

import React, { useState, useEffect } from 'react';
import { Seller, Role, Store } from '../types';
import { EyeIcon, EyeOffIcon, ShieldCheckIcon } from './Icons';

interface SellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, password: string, roleId: string, storeId: string, username?: string, isDeveloper?: boolean) => void;
  seller: Seller | null;
  roles: Role[];
  stores: Store[];
}

const SellerModal: React.FC<SellerModalProps> = ({ isOpen, onClose, onSave, seller, roles, stores }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState<string | ''>('');
  const [storeId, setStoreId] = useState<string | ''>('');
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    if (seller) {
      setName(seller.name || '');
      setUsername(seller.username || '');
      setRoleId(seller.roleId || '');
      setStoreId(seller.storeId || '');
      setPassword(seller.password || '');
      setIsDeveloper(!!seller.isDeveloper);
      setShowPassword(false);
    } else {
      setName('');
      setUsername('');
      setRoleId(roles.length > 0 ? roles[1]?.id || roles[0]?.id : '');
      setStoreId(stores.length > 0 ? stores[0].id : '');
      setPassword('');
      setIsDeveloper(false);
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
      onSave(name.trim(), password.trim(), roleId, storeId, username.trim() || undefined, isDeveloper);
    } else {
      alert("Por favor, completa todos los campos.");
    }
  };

  const selectedRole = roles.find(r => r.id === roleId);
  const isDevRole = (selectedRole?.name || '').toLowerCase() === 'developer' || 
                    (selectedRole?.name || '').toLowerCase() === 'desarrollador';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-black text-accent mb-4 flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6" />
          <span>{seller ? 'Editar Vendedor / Usuario' : 'Agregar Vendedor / Usuario'}</span>
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="sellerName" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Nombre Completo</label>
            <input
              type="text"
              id="sellerName"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Carlos Vendedor"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-bold text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="sellerUsername" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Usuario de Inicio de Sesión <span className="text-[10px] lowercase font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              id="sellerUsername"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
              placeholder="ej. carlos.ventas"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-mono text-sm"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contraseña</label>
              <span className="text-[10px] text-accent font-semibold">
                {seller ? 'Puedes ver y editar la clave' : 'Clave de acceso'}
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-mono font-bold text-sm"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sellerRole" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rol</label>
              <select
                id="sellerRole"
                value={roleId}
                onChange={e => {
                  setRoleId(e.target.value);
                  const r = roles.find(item => item.id === e.target.value);
                  if ((r?.name || '').toLowerCase() === 'developer') {
                    setIsDeveloper(true);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:ring-2 focus:ring-accent focus:border-accent outline-none text-sm font-medium"
                required
              >
                <option value="" disabled>Selecciona rol</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sellerStore" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Sede Asignada</label>
              <select
                id="sellerStore"
                value={storeId}
                onChange={e => setStoreId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:ring-2 focus:ring-accent focus:border-accent outline-none text-sm font-medium"
                required
              >
                <option value="" disabled>Selecciona tienda</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Developer Access Toggle */}
          <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
            <div className="pr-2">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block">
                🛠️ Privilegios de Desarrollador
              </span>
              <span className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 block leading-tight">
                Permite acceso al Developer Center y gestión global multi-empresa.
              </span>
            </div>
            <input
              type="checkbox"
              checked={isDeveloper || isDevRole}
              disabled={isDevRole}
              onChange={e => setIsDeveloper(e.target.checked)}
              className="h-5 w-5 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
            />
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-bold text-xs">Cancelar</button>
            <button type="submit" className="px-5 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors font-bold text-xs shadow-md shadow-accent/20">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SellerModal;
