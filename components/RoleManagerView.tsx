

import React, { useState } from 'react';
import { Role, View, VIEW_LABELS } from '../types';
import { PlusCircleIcon } from './Icons';

interface RoleManagerViewProps {
  roles: Role[];
  onAddRole: (name: string) => void;
  onUpdateRole: (updatedRole: Role) => void;
}

const RoleManagerView: React.FC<RoleManagerViewProps> = ({ roles, onAddRole, onUpdateRole }) => {
  // FIX: Changed state to handle string IDs.
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const handleAddRole = () => {
    if (newRoleName.trim()) {
      onAddRole(newRoleName);
      setNewRoleName('');
    }
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
  
  // Removed capitalize as we use VIEW_LABELS now


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-3xl font-black text-accent uppercase tracking-tight ml-2">Control de Permisos</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Column 1: Role List and Creation */}
      <div className="lg:col-span-1 bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-accent mb-4 border-b-2 border-accent/30 pb-2">Roles</h2>
        <div className="space-y-2 mb-6">
          {roles.map(role => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`w-full text-left p-3 rounded-md transition-colors ${selectedRoleId === role.id ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              {role.name}
            </button>
          ))}
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Nuevo rol"
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
          />
          <button onClick={handleAddRole} className="bg-accent text-white p-2 rounded-md hover:bg-accent-hover flex-shrink-0">
            <PlusCircleIcon />
          </button>
        </div>
      </div>

      {/* Column 2: Permission Editor */}
      <div className="lg:col-span-2 bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        {selectedRole ? (
          <>
            <h2 className="text-2xl font-bold text-accent mb-4 border-b-2 border-accent/30 pb-2">
              Permisos para <span className="text-gray-800 dark:text-text-light">{selectedRole.name}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Object.values(View).map(view => (
                <div key={view} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRole.permissions?.includes(view)}
                      onChange={(e) => handlePermissionChange(view, e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    <span className="font-medium text-gray-800 dark:text-text-light">{VIEW_LABELS[view]}</span>
                  </label>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-text-dark">Selecciona un rol para editar sus permisos.</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default RoleManagerView;
