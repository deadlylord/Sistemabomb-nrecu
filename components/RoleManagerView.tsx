

import React, { useState } from 'react';
import { Role, View, VIEW_LABELS } from '../types';
import { PlusCircleIcon, ShieldCheckIcon, SparklesIcon, CheckIcon } from './Icons';

interface RoleManagerViewProps {
  roles: Role[];
  onAddRole: (name: string) => void;
  onUpdateRole: (updatedRole: Role) => void;
}

const RoleManagerView: React.FC<RoleManagerViewProps> = ({ roles, onAddRole, onUpdateRole }) => {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roles[0]?.id || null);
  const [newRoleName, setNewRoleName] = useState('');

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const hasDeveloperRole = roles.some(r => 
    r.name.toLowerCase() === 'developer' || 
    r.name.toLowerCase() === 'desarrollador' ||
    (r.permissions && r.permissions.includes(View.DEVELOPER_CENTER))
  );

  const handleAddRole = () => {
    if (newRoleName.trim()) {
      onAddRole(newRoleName.trim());
      setNewRoleName('');
    }
  };

  const handleCreateDeveloperRole = () => {
    onAddRole('Developer');
  };

  const handlePermissionChange = (view: View, isChecked: boolean) => {
    if (!selectedRole) return;
    const currentPermissions = selectedRole.permissions || [];
    let newPermissions: View[];

    if (isChecked) {
      newPermissions = [...currentPermissions, view];
    } else {
      newPermissions = currentPermissions.filter(p => p !== view);
    }
    onUpdateRole({ ...selectedRole, permissions: newPermissions });
  };

  const handleSelectAll = (selectAll: boolean) => {
    if (!selectedRole) return;
    const newPermissions = selectAll ? Object.values(View) : [];
    onUpdateRole({ ...selectedRole, permissions: newPermissions });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-accent uppercase tracking-tight ml-1 flex items-center gap-2">
            <ShieldCheckIcon className="w-8 h-8" />
            <span>Control de Roles y Permisos</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 ml-1 mt-1">
            Administra los roles del personal y define qué usuarios tienen acceso exclusivo a cada módulo o al Developer Center.
          </p>
        </div>

        {!hasDeveloperRole && (
          <button
            onClick={handleCreateDeveloperRole}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            <SparklesIcon className="w-4 h-4 text-yellow-300" />
            <span>Crear Rol Developer</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Role List and Creation */}
        <div className="lg:col-span-1 bg-white dark:bg-secondary p-5 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2 uppercase tracking-wider">
              Roles Configurados ({roles.length})
            </h3>
            <div className="space-y-2 mb-4">
              {roles.map(role => {
                const isSelected = selectedRoleId === role.id;
                const isDevRole = role.name.toLowerCase() === 'developer' || 
                                  role.name.toLowerCase() === 'desarrollador' ||
                                  (role.permissions && role.permissions.includes(View.DEVELOPER_CENTER));
                const isAdminRole = role.name.toLowerCase() === 'administrator';

                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                      isSelected 
                        ? 'bg-accent text-white border-accent shadow-md shadow-accent/20 font-bold' 
                        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{role.name}</span>
                    </div>
                    {isDevRole ? (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isSelected ? 'bg-white text-indigo-700' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'}`}>
                        🛠️ DEV
                      </span>
                    ) : isAdminRole ? (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isSelected ? 'bg-white text-purple-700' : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'}`}>
                        👑 Admin
                      </span>
                    ) : (
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                        {role.permissions?.length || 0} p.
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Crear Nuevo Rol</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Nombre del rol..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
              />
              <button 
                onClick={handleAddRole} 
                className="bg-accent text-white px-3 py-2 rounded-xl hover:bg-accent-hover flex-shrink-0 font-bold transition-all shadow-md shadow-accent/20"
                title="Crear Rol"
              >
                <PlusCircleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Permission Editor */}
        <div className="lg:col-span-2 bg-white dark:bg-secondary p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
          {selectedRole ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Permisos de:</span>
                    <span className="text-accent">{selectedRole.name}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedRole.permissions?.length || 0} de {Object.values(View).length} vistas autorizadas
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSelectAll(true)}
                    className="px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-all"
                  >
                    Seleccionar Todos
                  </button>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-all"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
                {Object.values(View).map(view => {
                  const isChecked = selectedRole.permissions?.includes(view);
                  const isDevCenter = view === View.DEVELOPER_CENTER;

                  return (
                    <div 
                      key={view} 
                      onClick={() => handlePermissionChange(view, !isChecked)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-2 ${
                        isChecked 
                          ? isDevCenter 
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold'
                            : 'bg-accent/5 dark:bg-accent/10 border-accent/30 text-slate-900 dark:text-white font-bold'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          isChecked 
                            ? isDevCenter ? 'bg-indigo-600 text-white' : 'bg-accent text-white' 
                            : 'border border-slate-400 dark:border-slate-600 bg-transparent'
                        }`}>
                          {isChecked && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="truncate">
                          <span className="text-xs truncate block">{VIEW_LABELS[view]}</span>
                          {isDevCenter && (
                            <span className="text-[9px] text-indigo-600 dark:text-indigo-400 block font-normal">
                              🛠️ Panel Global Multi-Empresa
                            </span>
                          )}
                        </div>
                      </div>

                      {isDevCenter && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 flex-shrink-0">
                          Dev
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheckIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                Selecciona un rol a la izquierda para configurar sus permisos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleManagerView;

