import React, { useState, useMemo } from 'react';
import { Seller, Role, Store } from '../types';
import { EditIcon, PlusCircleIcon, TrashIcon, SearchIcon, CrossIcon, PowerIcon, EyeIcon, EyeOffIcon } from './Icons';
import SellerModal from './SellerModal';
import { normalizeText } from '../constants';

interface SellersViewProps {
  sellers: Seller[];
  roles: Role[];
  stores: Store[];
  onAddSeller: (name: string, password: string, roleId: string, storeId: string, username?: string, isDeveloper?: boolean) => void;
  onUpdateSeller: (id: string, newName: string, newPassword: string, newRoleId: string, newStoreId: string, username?: string, isDeveloper?: boolean) => void;
  onDeleteSeller: (id: string) => void;
  onToggleSellerStatus: (id: string) => void;
  isDeveloper?: boolean;
}

const SellersView: React.FC<SellersViewProps> = ({ sellers, roles, stores, onAddSeller, onUpdateSeller, onDeleteSeller, onToggleSellerStatus, isDeveloper }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getRoleName = (roleId: string) => {
    return roles.find(r => r.id === roleId)?.name || 'Sin Rol';
  };
  
  const getStoreName = (storeId: string) => {
    return stores.find(s => s.id === storeId)?.name || 'Sin Tienda';
  };

  const handleOpenAddModal = () => {
    setEditingSeller(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (seller: Seller) => {
    setEditingSeller(seller);
    setIsModalOpen(true);
  };
  
  const handleSave = (name: string, password: string, roleId: string, storeId: string, username?: string, isDev?: boolean) => {
    if (editingSeller) {
      onUpdateSeller(editingSeller.id, name, password, roleId, storeId, username, isDev);
    } else {
      onAddSeller(name, password, roleId, storeId, username, isDev);
    }
    setIsModalOpen(false);
  };

  const filteredSellers = useMemo(() => {
    return sellers.filter(seller => {
      if (!showInactive && seller.isDisabled) {
        return false;
      }
      const normalizedSearch = normalizeText(searchTerm);
      const matchesSearch = normalizeText(seller.name).includes(normalizedSearch);
      const matchesRole = roleFilter ? seller.roleId === roleFilter : true;
      const matchesStore = storeFilter ? seller.storeId === storeFilter : true;
      return matchesSearch && matchesRole && matchesStore;
    });
  }, [sellers, searchTerm, roleFilter, storeFilter, showInactive]);

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-6 border-b-2 border-accent/30 pb-2">
            <h2 className="text-2xl font-bold text-accent">Gestión de Equipo</h2>
            <button onClick={handleOpenAddModal} className="bg-accent text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover">
              <PlusCircleIcon />
              <span>Agregar Vendedor</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative md:col-span-1">
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              />
              <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400">
                <SearchIcon />
              </div>
              {searchTerm && (
                <button
                    onClick={() => setSearchTerm('')}
                    className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    aria-label="Limpiar búsqueda"
                >
                    <CrossIcon className="w-5 h-5" />
                </button>
              )}
            </div>
             <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2">
              <option value="">Filtrar por Rol</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2">
              <option value="">Filtrar por Tienda</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-center mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                      type="checkbox"
                      checked={showInactive}
                      onChange={(e) => setShowInactive(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-gray-600 dark:text-text-dark">Mostrar inactivos</span>
              </label>
          </div>


          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="p-3 text-sm font-semibold tracking-wide">Nombre</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Rol</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Tienda Asignada</th>
                  <th className="p-3 text-sm font-semibold tracking-wide">Contraseña</th>
                  <th className="p-3 text-sm font-semibold tracking-wide text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSellers.map((seller) => {
                  const roleName = getRoleName(seller.roleId);
                  const isDev = !!seller.isDeveloper || 
                                roleName.toLowerCase() === 'developer' || 
                                roleName.toLowerCase() === 'desarrollador' ||
                                (seller.username || '').toLowerCase() === 'developer';

                  return (
                    <tr key={seller.id} className={`transition-colors ${seller.isDisabled ? 'bg-red-50 dark:bg-red-900/20 opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{seller.name}</span>
                          {isDev && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                              🛠️ DEV
                            </span>
                          )}
                        </div>
                        {seller.username && (
                          <div className="text-[11px] font-mono text-slate-400">
                            @{seller.username}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          isDev 
                            ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold' 
                            : 'bg-accent/20 text-accent'
                        }`}>
                          {roleName}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-gray-600 dark:text-text-dark">{getStoreName(seller.storeId)}</td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          {visiblePasswords[seller.id] ? (
                            <span className="font-mono font-bold text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-slate-800 dark:text-slate-100 select-all border border-gray-300 dark:border-gray-700">
                              {seller.password || '—'}
                            </span>
                          ) : (
                            <span className="font-mono text-gray-400 text-xs tracking-widest">
                              ••••••
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(seller.id)}
                            className="text-gray-400 hover:text-accent p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title={visiblePasswords[seller.id] ? "Ocultar contraseña" : "Ver contraseña"}
                          >
                            {visiblePasswords[seller.id] ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                          <div className="flex justify-center items-center space-x-2">
                              <button onClick={() => onToggleSellerStatus(seller.id)} className={`p-2 rounded-full transition-colors ${!seller.isDisabled ? 'text-red-500 hover:text-red-400 hover:bg-red-500/10' : 'text-green-500 hover:text-green-400 hover:bg-green-500/10'}`} title={seller.isDisabled ? 'Habilitar Vendedor' : 'Deshabilitar Vendedor'}>
                                  <PowerIcon />
                              </button>
                              <button onClick={() => handleOpenEditModal(seller)} className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors">
                                  <EditIcon />
                              </button>
                              <button onClick={() => onDeleteSeller(seller.id)} className="text-gray-500 dark:text-text-dark hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors">
                                  <TrashIcon />
                              </button>
                          </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <SellerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          seller={editingSeller}
          roles={roles}
          stores={stores}
        />
      )}
    </>
  );
};

export default SellersView;
