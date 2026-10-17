import { verifiedIdentityEnabled } from '../services/identityConfig';


import { isPlatformRole } from '../services/developerAccess';
import React, { useState, useEffect, useRef } from 'react';
import { Seller, Role, Store, View } from '../types';
import { EyeIcon, EyeOffIcon, ShieldCheckIcon } from './Icons';

interface SellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, password: string, roleId: string, storeId: string, username?: string, isDeveloper?: boolean) => Promise<void>;
  seller: Seller | null;
  roles: Role[];
  stores: Store[];
  isDeveloperUser?: boolean;
}

const SellerModal: React.FC<SellerModalProps> = ({ isOpen, onClose, onSave, seller, roles, stores, isDeveloperUser = false }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState<string | ''>('');
  const [storeId, setStoreId] = useState<string | ''>('');
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { setSaveError(''); }, [isOpen, seller?.id]);

  // Filter roles available to the current user
  const availableRoles = React.useMemo(() => {
    return roles.filter(r => {
      const rName = (r.name || '').toLowerCase().trim();
      const isDev = isPlatformRole(r) || rName === 'developer' || rName === 'desarrollador' || (r.permissions && r.permissions.includes(View.DEVELOPER_CENTER));
      return !isDev;
    });
  }, [roles, isDeveloperUser]);

  useEffect(() => {
    if (seller) {
      setName(seller.name || '');
      setUsername(seller.username || '');
      setRoleId(seller.roleId || '');
      setStoreId(seller.storeId || '');
      setPassword(verifiedIdentityEnabled ? '' : seller.password || '');
      setShowPassword(false);
    } else {
      setName('');
      setUsername('');
      const defaultRole = availableRoles.length > 1 ? availableRoles[1]?.id : availableRoles[0]?.id || '';
      setRoleId(defaultRole);
      setStoreId(stores.length > 0 ? stores[0].id : '');
      setPassword('');
      setShowPassword(false);
    }
  }, [seller, availableRoles, stores, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving.current) return;
    if (name.trim() && roleId !== '' && storeId !== '') {
      if (!password.trim() && (!seller || !verifiedIdentityEnabled)) {
        alert("La contraseña es obligatoria.");
        return;
      }
      // Platform access is managed exclusively in Developer Center.
      saving.current = true;
      setIsSaving(true);
      setSaveError('');
      try {
        await onSave(name.trim(), password.trim(), roleId, storeId, username.trim());
      } catch (error: any) {
        setSaveError(error?.message || 'No se pudo guardar el usuario. Reintenta.');
      } finally {
        saving.current = false;
        setIsSaving(false);
      }
    } else {
      alert("Por favor, completa todos los campos.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-black text-accent mb-4 flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6" />
          <span>{seller ? 'Editar Vendedor / Usuario' : 'Agregar Vendedor / Usuario'}</span>
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isSaving} className="m-0 min-w-0 space-y-4 border-0 p-0">
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
              <label htmlFor="password" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{seller && verifiedIdentityEnabled ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
              <span className="text-[10px] text-accent font-semibold">
                {seller ? verifiedIdentityEnabled ? 'Déjala vacía para conservarla' : 'Puedes ver y editar la clave' : 'Clave de acceso'}
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-mono font-bold text-sm"
                placeholder={seller && verifiedIdentityEnabled ? 'Nueva contraseña' : 'Ingresa la contraseña'}
                required={!seller || !verifiedIdentityEnabled}
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
                onChange={e => setRoleId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:ring-2 focus:ring-accent focus:border-accent outline-none text-sm font-medium"
                required
              >
                <option value="" disabled>Selecciona rol</option>
                {availableRoles.map(role => (
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

          <div className="mt-6 flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-bold text-xs">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors font-bold text-xs shadow-md shadow-accent/20">{isSaving ? 'Guardando…' : 'Guardar'}</button>
          </div>
          </fieldset>
          {saveError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
        </form>
      </div>
    </div>
  );
};

export default SellerModal;
