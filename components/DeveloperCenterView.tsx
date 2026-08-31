import React, { useState, useMemo } from 'react';
import { Company, Store, Seller, Role } from '../types';
import { formatCOP } from '../constants';
import { 
  BuildingStorefrontIcon, UsersIcon, ShieldCheckIcon, 
  SettingsIcon, CheckIcon, CrossIcon, EditIcon, TrashIcon,
  SparklesIcon, DashboardIcon, EyeIcon, EyeOffIcon
} from './Icons';

interface DeveloperCenterViewProps {
  companies: Company[];
  stores: Store[];
  sellers: Seller[];
  roles: Role[];
  activeCompanyId: string;
  onSetActiveCompanyId: (companyId: string) => void;
  onCreateCompany: (company: Partial<Company>, initialStoreName: string, adminUserData?: { name: string; username: string; password: string }) => Promise<void>;
  onUpdateCompany: (company: Company) => Promise<void>;
  onDeleteCompany: (companyId: string) => Promise<void>;
  onCreateStoreForCompany: (companyId: string, store: Partial<Store>) => Promise<void>;
  onUpdateStore: (store: Store) => Promise<void>;
  onDeleteStore: (storeId: string) => Promise<void>;
  onCreateAdminUser: (companyId: string, storeId: string, adminData: { name: string; username: string; password: string }) => Promise<void>;
  onUpdateUser?: (id: string, name: string, password: string, roleId: string, storeId: string, username?: string) => Promise<void>;
  onDeleteUser?: (userId: string) => Promise<void>;
  onToggleUserStatus?: (userId: string) => Promise<void>;
}

const DeveloperCenterView: React.FC<DeveloperCenterViewProps> = ({
  companies,
  stores,
  sellers,
  roles,
  activeCompanyId,
  onSetActiveCompanyId,
  onCreateCompany,
  onUpdateCompany,
  onDeleteCompany,
  onCreateStoreForCompany,
  onUpdateStore,
  onDeleteStore,
  onCreateAdminUser,
  onUpdateUser,
  onDeleteUser,
  onToggleUserStatus
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(activeCompanyId);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [isNewAdminModalOpen, setIsNewAdminModalOpen] = useState(false);
  const [isEditStoreModalOpen, setIsEditStoreModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editingUser, setEditingUser] = useState<Seller | null>(null);

  // Visibility state for passwords
  const [visibleUserPasswords, setVisibleUserPasswords] = useState<Record<string, boolean>>({});
  const [newAdminShowPassword, setNewAdminShowPassword] = useState(false);
  const [editingUserShowPassword, setEditingUserShowPassword] = useState(false);

  // Form states for New Company
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyNit, setNewCompanyNit] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyMaxStores, setNewCompanyMaxStores] = useState<number>(2);
  const [newCompanyInitialStoreName, setNewCompanyInitialStoreName] = useState('Sede Principal');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminStoreId, setNewAdminStoreId] = useState('');

  // Form states for New Store
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreColor, setNewStoreColor] = useState('#ff007f');
  const [newStoreContact, setNewStoreContact] = useState('');
  const [newStoreCash, setNewStoreCash] = useState<number>(0);
  const [newStoreQr, setNewStoreQr] = useState<number>(0);

  // Form states for Editing Store
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreColor, setEditStoreColor] = useState('#ff007f');
  const [editStoreContact, setEditStoreContact] = useState('');
  const [editStoreCash, setEditStoreCash] = useState<number>(0);
  const [editStoreQr, setEditStoreQr] = useState<number>(0);

  // Form states for Editing User
  const [editUserName, setEditUserName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRoleId, setEditUserRoleId] = useState('');
  const [editUserStoreId, setEditUserStoreId] = useState('');

  const toggleUserPasswordVisibility = (id: string) => {
    setVisibleUserPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Loading state
  const [isProcessing, setIsProcessing] = useState(false);

  const activeCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyId) || companies[0];
  }, [companies, selectedCompanyId]);

  const companyStores = useMemo(() => {
    if (!activeCompany) return [];
    return stores.filter(s => (s.companyId || 'default_company') === activeCompany.id);
  }, [stores, activeCompany]);

  const companyUsers = useMemo(() => {
    if (!activeCompany) return [];
    const storeIds = new Set(companyStores.map(s => s.id));
    return sellers.filter(s => (s.companyId || 'default_company') === activeCompany.id || storeIds.has(s.storeId));
  }, [sellers, activeCompany, companyStores]);

  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      alert('Por favor, ingresa el nombre de la empresa.');
      return;
    }

    try {
      setIsProcessing(true);
      await onCreateCompany(
        {
          name: newCompanyName.trim(),
          nit: newCompanyNit.trim(),
          phone: newCompanyPhone.trim(),
          email: newCompanyEmail.trim(),
          address: newCompanyAddress.trim(),
          maxStores: Number(newCompanyMaxStores) || 1,
          status: 'active',
        },
        newCompanyInitialStoreName.trim() || 'Sede Principal',
        newAdminUsername.trim() ? {
          name: newAdminName.trim() || 'Administrador',
          username: newAdminUsername.trim(),
          password: newAdminPassword.trim() || 'admin123'
        } : undefined
      );

      // Reset form
      setNewCompanyName('');
      setNewCompanyNit('');
      setNewCompanyPhone('');
      setNewCompanyEmail('');
      setNewCompanyAddress('');
      setNewCompanyMaxStores(2);
      setNewCompanyInitialStoreName('Sede Principal');
      setNewAdminName('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setIsNewCompanyModalOpen(false);
    } catch (err: any) {
      alert('Error creando empresa: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;
    if (!newStoreName.trim()) {
      alert('Por favor ingresa un nombre para la sede.');
      return;
    }

    if (companyStores.length >= activeCompany.maxStores) {
      alert(`Esta empresa ya alcanzó su límite de sedes contratadas (${activeCompany.maxStores}). Para agregar más sedes, edita el límite de la empresa primero.`);
      return;
    }

    try {
      setIsProcessing(true);
      await onCreateStoreForCompany(activeCompany.id, {
        name: newStoreName.trim(),
        accentColor: newStoreColor,
        contactInfo: newStoreContact.trim(),
        initialBalances: { cash: Number(newStoreCash) || 0, qr: Number(newStoreQr) || 0 }
      });
      setNewStoreName('');
      setNewStoreContact('');
      setNewStoreCash(0);
      setNewStoreQr(0);
      setIsNewStoreModalOpen(false);
    } catch (err: any) {
      alert('Error creando sede: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany || companyStores.length === 0) {
      alert('Primero debes tener al menos una sede creada en la empresa.');
      return;
    }
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      alert('Por favor ingresa usuario y contraseña.');
      return;
    }

    const targetStoreId = newAdminStoreId || companyStores[0].id;

    try {
      setIsProcessing(true);
      await onCreateAdminUser(activeCompany.id, targetStoreId, {
        name: newAdminName.trim() || 'Administrador',
        username: newAdminUsername.trim(),
        password: newAdminPassword.trim()
      });
      setNewAdminName('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setNewAdminStoreId('');
      setNewAdminShowPassword(false);
      setIsNewAdminModalOpen(false);
    } catch (err: any) {
      alert('Error creando administrador: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEditStore = (store: Store) => {
    setEditingStore(store);
    setEditStoreName(store.name || '');
    setEditStoreColor(store.accentColor || '#ff007f');
    setEditStoreContact(store.contactInfo || '');
    setEditStoreCash(store.initialBalances?.cash || 0);
    setEditStoreQr(store.initialBalances?.qr || 0);
    setIsEditStoreModalOpen(true);
  };

  const handleSaveStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore || !editStoreName.trim()) {
      alert('El nombre de la sede es obligatorio.');
      return;
    }
    try {
      setIsProcessing(true);
      const updatedStore: Store = {
        ...editingStore,
        name: editStoreName.trim(),
        accentColor: editStoreColor,
        contactInfo: editStoreContact.trim(),
        initialBalances: {
          cash: Number(editStoreCash) || 0,
          qr: Number(editStoreQr) || 0,
        }
      };
      await onUpdateStore(updatedStore);
      setIsEditStoreModalOpen(false);
      setEditingStore(null);
    } catch (err: any) {
      alert('Error actualizando sede: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEditUser = (user: Seller) => {
    setEditingUser(user);
    setEditUserName(user.name || '');
    setEditUserUsername(user.username || '');
    setEditUserPassword(user.password || '');
    setEditUserRoleId(user.roleId || (roles.length > 0 ? roles[0].id : ''));
    setEditUserStoreId(user.storeId || (companyStores.length > 0 ? companyStores[0].id : ''));
    setEditingUserShowPassword(false);
    setIsEditUserModalOpen(true);
  };

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editUserName.trim() || !editUserPassword.trim()) {
      alert('El nombre y la contraseña son obligatorios.');
      return;
    }
    try {
      setIsProcessing(true);
      if (onUpdateUser) {
        await onUpdateUser(
          editingUser.id,
          editUserName.trim(),
          editUserPassword.trim(),
          editUserRoleId,
          editUserStoreId,
          editUserUsername.trim()
        );
      }
      setIsEditUserModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      alert('Error actualizando usuario: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500 text-white shadow-sm">
              SUPERADMIN / DEVELOPER
            </span>
            <span className="text-xs text-indigo-300 font-mono">Modo Multi-Empresa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Centro de Control de Empresas y Sedes</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona las empresas cliente, sus bases de datos, licencias y sedes autorizadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsNewCompanyModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>Nueva Empresa</span>
          </button>
        </div>
      </div>

      {/* Selector & Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Empresas</p>
          <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{companies.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresas Activas</p>
          <p className="text-2xl font-black text-emerald-500 mt-1">
            {companies.filter(c => c.status === 'active').length}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sedes Registradas</p>
          <p className="text-2xl font-black text-indigo-500 mt-1">{stores.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa en Vista Actual</p>
          <p className="text-sm font-bold text-accent truncate mt-2">{activeCompany?.name || 'Ninguna'}</p>
        </div>
      </div>

      {/* Main Companies Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: List of Companies */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800 dark:text-white">Empresas Clientes</h2>
            <span className="text-xs font-bold text-slate-400 font-mono">{companies.length} regs</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {companies.map((comp) => {
              const compStoreCount = stores.filter(s => (s.companyId || 'default_company') === comp.id).length;
              const isSelected = activeCompany?.id === comp.id;

              return (
                <div
                  key={comp.id}
                  onClick={() => setSelectedCompanyId(comp.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md shadow-indigo-500/10'
                      : 'border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">{comp.name}</h3>
                      {comp.nit && <p className="text-xs text-slate-400 font-mono">NIT: {comp.nit}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      comp.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                    }`}>
                      {comp.status === 'active' ? 'Activa' : 'Suspendida'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <span className="font-medium">
                      Sedes: <strong className="text-slate-800 dark:text-slate-200">{compStoreCount}</strong> / {comp.maxStores}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetActiveCompanyId(comp.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        activeCompanyId === comp.id 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {activeCompanyId === comp.id ? '✓ Conectado' : 'Conectar POS'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT TWO COLUMNS: Details of Selected Company */}
        <div className="lg:col-span-2 space-y-6">
          {activeCompany ? (
            <>
              {/* Company Info Card */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white">{activeCompany.name}</h2>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                        ID: {activeCompany.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {activeCompany.email || 'Sin correo'} • {activeCompany.phone || 'Sin teléfono'} • {activeCompany.address || 'Sin dirección'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingCompany(activeCompany);
                        setIsEditCompanyModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all"
                    >
                      Editar Empresa
                    </button>
                    {activeCompany.id !== 'default_company' && (
                      <button
                        onClick={() => {
                          if (confirm(`¿Estás seguro de eliminar la empresa ${activeCompany.name}? Esta acción no se puede deshacer.`)) {
                            onDeleteCompany(activeCompany.id);
                          }
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all"
                        title="Eliminar Empresa"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stores of this company */}
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Sedes Autorizadas ({companyStores.length} de {activeCompany.maxStores} contratadas)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Solo el desarrollador puede crear sedes. Los administradores no tienen permisos para añadir sedes.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsNewStoreModalOpen(true)}
                      disabled={companyStores.length >= activeCompany.maxStores}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        companyStores.length >= activeCompany.maxStores
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      }`}
                    >
                      <BuildingStorefrontIcon className="w-3.5 h-3.5" />
                      <span>+ Crear Sede</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {companyStores.map(store => (
                      <div key={store.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: store.accentColor || '#ff007f' }}></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">{store.name}</p>
                              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold px-1.5 py-0.5 rounded">Sede</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Efectivo: {formatCOP(store.initialBalances?.cash || 0)} | QR: {formatCOP(store.initialBalances?.qr || 0)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditStore(store)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-all"
                            title="Editar nombre y ajustes de la sede"
                          >
                            <EditIcon className="w-3.5 h-3.5" />
                          </button>
                          {companyStores.length > 1 && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar la sede ${store.name}?`)) {
                                  onDeleteStore(store.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                              title="Eliminar Sede"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Users / Admins of this company */}
                <div className="mt-8 space-y-4 pt-6 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Usuarios y Administradores ({companyUsers.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Gestiona los usuarios, consulta y actualiza sus contraseñas o datos de acceso.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsNewAdminModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white transition-all shadow-sm"
                    >
                      <UsersIcon className="w-3.5 h-3.5" />
                      <span>+ Crear Admin</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase">
                        <tr>
                          <th className="p-2.5 rounded-l-lg">Nombre</th>
                          <th className="p-2.5">Usuario (Login)</th>
                          <th className="p-2.5">Contraseña</th>
                          <th className="p-2.5">Rol</th>
                          <th className="p-2.5">Sede Asignada</th>
                          <th className="p-2.5 text-center">Estado</th>
                          <th className="p-2.5 rounded-r-lg text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {companyUsers.map(user => {
                          const userRole = roles.find(r => r.id === user.roleId)?.name || 'Vendedor';
                          const userStore = stores.find(s => s.id === user.storeId)?.name || 'Cualquiera';

                          return (
                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                              <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{user.name}</td>
                              <td className="p-2.5 font-mono text-slate-500 font-semibold">{user.username || user.name}</td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-1.5">
                                  {visibleUserPasswords[user.id] ? (
                                    <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-slate-800 dark:text-slate-100 select-all">
                                      {user.password || '—'}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-slate-400 tracking-widest text-xs">
                                      ••••••
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleUserPasswordVisibility(user.id)}
                                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 rounded transition-colors"
                                    title={visibleUserPasswords[user.id] ? "Ocultar clave" : "Ver clave"}
                                  >
                                    {visibleUserPasswords[user.id] ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  userRole === 'Administrator' ? 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                }`}>
                                  {userRole}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-400 uppercase font-medium">{userStore}</td>
                              <td className="p-2.5 text-center">
                                <button
                                  onClick={() => onToggleUserStatus && onToggleUserStatus(user.id)}
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                                    !user.isDisabled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-400'
                                  }`}
                                  title="Clic para cambiar estado"
                                >
                                  {!user.isDisabled ? 'Activo' : 'Inactivo'}
                                </button>
                              </td>
                              <td className="p-2.5 text-right">
                                <div className="flex justify-end items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEditUser(user)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-colors"
                                    title="Editar Usuario y Contraseña"
                                  >
                                    <EditIcon className="w-3.5 h-3.5" />
                                  </button>
                                  {onDeleteUser && (
                                    <button
                                      onClick={() => onDeleteUser(user.id)}
                                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors"
                                      title="Eliminar usuario"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                  )}
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
            </>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <BuildingStorefrontIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Selecciona una empresa para gestionar sus sedes y licencias.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Nueva Empresa */}
      {isNewCompanyModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Registrar Nueva Empresa</h3>
            <p className="text-xs text-slate-500 mb-4">Crea una nueva organización aislada en la plataforma.</p>

            <form onSubmit={handleCreateCompanySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre Comercial / Empresa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Boutique Moda & Estilo"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">NIT / Cédula</label>
                  <input
                    type="text"
                    placeholder="900.123.456-7"
                    value={newCompanyNit}
                    onChange={(e) => setNewCompanyNit(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="300 123 4567"
                    value={newCompanyPhone}
                    onChange={(e) => setNewCompanyPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Límite de Sedes Contratadas</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={newCompanyMaxStores}
                    onChange={(e) => setNewCompanyMaxStores(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre Sede Inicial</label>
                  <input
                    type="text"
                    placeholder="Sede Principal"
                    value={newCompanyInitialStoreName}
                    onChange={(e) => setNewCompanyInitialStoreName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Optional initial Admin */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase mb-2">Usuario Administrador Inicial</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Nombre</label>
                    <input
                      type="text"
                      placeholder="Dueño"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Usuario</label>
                    <input
                      type="text"
                      placeholder="admin"
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Contraseña</label>
                    <input
                      type="text"
                      placeholder="admin123"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewCompanyModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  {isProcessing ? 'Creando...' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Crear Sede Autorizada */}
      {isNewStoreModalOpen && activeCompany && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Crear Sede Autorizada</h3>
            <p className="text-xs text-slate-500 mb-4">Para la empresa: <strong>{activeCompany.name}</strong></p>

            <form onSubmit={handleCreateStoreSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre de la Sede *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sede Centro, Sede Norte"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Color Distintivo</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newStoreColor}
                      onChange={(e) => setNewStoreColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <span className="text-xs font-mono">{newStoreColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Contacto / Teléfono</label>
                  <input
                    type="text"
                    placeholder="300 000 0000"
                    value={newStoreContact}
                    onChange={(e) => setNewStoreContact(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Saldo Base Efectivo</label>
                  <input
                    type="number"
                    value={newStoreCash}
                    onChange={(e) => setNewStoreCash(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Saldo Base QR</label>
                  <input
                    type="number"
                    value={newStoreQr}
                    onChange={(e) => setNewStoreQr(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewStoreModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  {isProcessing ? 'Creando...' : 'Crear Sede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Crear Admin para Empresa */}
      {isNewAdminModalOpen && activeCompany && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Crear Administrador</h3>
            <p className="text-xs text-slate-500 mb-4">Para: <strong>{activeCompany.name}</strong></p>

            <form onSubmit={handleCreateAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carlos Gómez"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Sede de Trabajo Asignada</label>
                <select
                  value={newAdminStoreId || companyStores[0]?.id || ''}
                  onChange={(e) => setNewAdminStoreId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                >
                  {companyStores.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">El administrador tendrá permisos de gestión en esta sede y acceso administrativo a la empresa.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre de Usuario (Login)</label>
                <input
                  type="text"
                  required
                  placeholder="admin.carlos"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">Contraseña</label>
                  <span className="text-[10px] text-indigo-500 font-semibold">Mínimo 4 caracteres</span>
                </div>
                <div className="relative">
                  <input
                    type={newAdminShowPassword ? "text" : "password"}
                    required
                    placeholder="Contraseña segura"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 pr-10 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setNewAdminShowPassword(!newAdminShowPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1"
                    title={newAdminShowPassword ? "Ocultar" : "Mostrar"}
                  >
                    {newAdminShowPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewAdminModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  {isProcessing ? 'Creando...' : 'Crear Usuario Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Sede */}
      {isEditStoreModalOpen && editingStore && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Editar Sede</h3>
            <p className="text-xs text-slate-500 mb-4">Modifica el nombre y la configuración operativa de la sede.</p>

            <form onSubmit={handleSaveStoreSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre de la Sede *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sede Principal, Boutique Centro"
                  value={editStoreName}
                  onChange={(e) => setEditStoreName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Color Distintivo</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editStoreColor}
                      onChange={(e) => setEditStoreColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <span className="text-xs font-mono">{editStoreColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Contacto / Teléfono</label>
                  <input
                    type="text"
                    placeholder="300 000 0000"
                    value={editStoreContact}
                    onChange={(e) => setEditStoreContact(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Saldo Base Efectivo</label>
                  <input
                    type="number"
                    value={editStoreCash}
                    onChange={(e) => setEditStoreCash(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Saldo Base QR</label>
                  <input
                    type="number"
                    value={editStoreQr}
                    onChange={(e) => setEditStoreQr(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditStoreModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Usuario / Admin */}
      {isEditUserModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Editar Usuario / Administrador</h3>
            <p className="text-xs text-slate-500 mb-4">Visualiza y actualiza la contraseña o datos de acceso.</p>

            <form onSubmit={handleSaveUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre de Usuario (Login)</label>
                <input
                  type="text"
                  placeholder="ej: carlos.admin"
                  value={editUserUsername}
                  onChange={(e) => setEditUserUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">Contraseña *</label>
                  <span className="text-[10px] text-indigo-500 font-semibold">Puedes verla o cambiarla</span>
                </div>
                <div className="relative">
                  <input
                    type={editingUserShowPassword ? "text" : "password"}
                    required
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 pr-10 text-sm font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingUserShowPassword(!editingUserShowPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1"
                    title={editingUserShowPassword ? "Ocultar" : "Mostrar"}
                  >
                    {editingUserShowPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Rol</label>
                  <select
                    value={editUserRoleId}
                    onChange={(e) => setEditUserRoleId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Sede Asignada</label>
                  <select
                    value={editUserStoreId}
                    onChange={(e) => setEditUserStoreId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  >
                    {companyStores.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Empresa */}
      {isEditCompanyModalOpen && editingCompany && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Editar Empresa</h3>
            <p className="text-xs text-slate-500 mb-4">{editingCompany.name}</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setIsProcessing(true);
                await onUpdateCompany(editingCompany);
                setIsEditCompanyModalOpen(false);
              } catch (err: any) {
                alert('Error actualizando empresa: ' + err?.message);
              } finally {
                setIsProcessing(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={editingCompany.name}
                  onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Límite de Sedes</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={editingCompany.maxStores}
                    onChange={(e) => setEditingCompany({ ...editingCompany, maxStores: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold text-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Estado</label>
                  <select
                    value={editingCompany.status}
                    onChange={(e) => setEditingCompany({ ...editingCompany, status: e.target.value as 'active' | 'suspended' })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                  >
                    <option value="active">Activa</option>
                    <option value="suspended">Suspendida</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Teléfono</label>
                <input
                  type="text"
                  value={editingCompany.phone || ''}
                  onChange={(e) => setEditingCompany({ ...editingCompany, phone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditCompanyModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperCenterView;
