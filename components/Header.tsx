
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Seller, Store, Role, Incident, IncidentStatus } from '../types';
import { 
  StoreIcon, InventoryIcon, ReceiptIcon, HistoryIcon, TruckIcon, UsersIcon, SunIcon, MoonIcon, 
  ClipboardListIcon, ChartPieIcon, ContactIcon, SettingsIcon, DollarIcon, ShieldCheckIcon, 
  SwapIcon, BuildingStorefrontIcon, DashboardIcon, AlertTriangleIcon, MenuIcon, CrossIcon, 
  LogoutIcon, ChevronDownIcon, SparklesIcon, ShoppingCartIcon, PackageIcon, CheckIcon,
  ChevronLeftIcon, ChevronRightIcon
} from './Icons';
import { APP_VERSIONS } from '../constants';

interface HeaderProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  currentUser: Seller;
  currentStore?: Store;
  userPermissions: View[];
  onLogout: () => void;
  stores: Store[];
  onSwitchStore: (storeId: string) => void;
  roles: Role[];
  isGlobalMode: boolean;
  onToggleGlobalMode: () => void;
  incidents: Incident[];
  onOpenBriefing: () => void;
  onOpenVersionHistory: () => void;
}

interface NavItem {
    view: View;
    label: string;
    description: string;
    icon: React.FC<{ className?: string }>;
}

interface NavGroup {
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    color: string;
    items: NavItem[];
}

const Header: React.FC<HeaderProps> = ({ 
  currentView, setCurrentView, theme, toggleTheme, currentUser, currentStore, 
  userPermissions, onLogout, stores, onSwitchStore, roles, isGlobalMode, 
  onToggleGlobalMode, incidents, onOpenBriefing, onOpenVersionHistory 
}) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isMobileGroupDropdownOpen, setIsMobileGroupDropdownOpen] = useState(false);
  const [previewGroupIndex, setPreviewGroupIndex] = useState<number>(-1);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const storeMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  const adminRole = roles.find(r => r.name === 'Administrator');
  const isAdmin = currentUser.roleId === adminRole?.id;
  const currentVersion = useMemo(() => APP_VERSIONS.find(v => v.isCurrent)?.version || '1.0.0', []);

  const groups: NavGroup[] = useMemo(() => [
    {
        id: 'ops',
        label: 'Ventas',
        icon: ShoppingCartIcon,
        color: 'text-blue-500',
        items: [
            { view: View.POS, label: 'Punto de Venta', description: 'Facturación rápida y caja', icon: StoreIcon },
            { view: View.LAYAWAY, label: 'Abonos y Apartados', description: 'Gestionar pagos pendientes', icon: ReceiptIcon },
            { view: View.INCIDENTS, label: 'Novedades / Cambios', description: 'Garantías, daños y cambios', icon: AlertTriangleIcon },
            { view: View.CUSTOMERS, label: 'Mis Clientes', description: 'Directorio y fidelización', icon: ContactIcon },
        ]
    },
    {
        id: 'inv',
        label: 'Inventarios',
        icon: PackageIcon,
        color: 'text-orange-500',
        items: [
            { view: View.INVENTORY, label: 'Existencias', description: 'Consulta y ajustes de stock', icon: InventoryIcon },
            { view: View.PURCHASES, label: 'Compras', description: 'Registrar compras al lote', icon: TruckIcon },
            { view: View.INVENTORY_TRANSFER, label: 'Traslados', description: 'Mover stock entre sedes', icon: SwapIcon },
            { view: View.STOCK_TAKE_HISTORY, label: 'Conteos Físicos', description: 'Auditorías de inventario', icon: ClipboardListIcon },
        ]
    },
    {
        id: 'admin',
        label: 'Gestión',
        icon: DashboardIcon,
        color: 'text-purple-500',
        items: [
            { view: View.DASHBOARD, label: 'Dashboard Métricas', description: 'Gráficos y rendimiento', icon: DashboardIcon },
            { view: View.FINANCIAL_RECONCILIATION, label: 'Conciliación Bancaria', description: 'Cruce de efectivo y bancos', icon: DollarIcon },
            { view: View.ACCOUNTING, label: 'Contabilidad IA', description: 'Gastos, PyG y Auditoría', icon: ChartPieIcon },
            { view: View.PAYROLL, label: 'Nómina y Pagos', description: 'Comisiones de vendedores', icon: DollarIcon },
            { view: View.SELLERS, label: 'Vendedores', description: 'Gestión de personal', icon: UsersIcon },
            { view: View.STORES, label: 'Sedes', description: 'Ajustes de sucursales', icon: BuildingStorefrontIcon },
            { view: View.ROLE_MANAGER, label: 'Permisos', description: 'Configuración de seguridad', icon: ShieldCheckIcon },
            { view: View.SETTINGS, label: 'Ajustes', description: 'Opciones del sistema', icon: SettingsIcon },
        ]
    }
  ], []);

  const filteredGroups = useMemo(() => {
    return groups.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (item.view === View.ACCOUNTING || item.view === View.FINANCIAL_RECONCILIATION) return isAdmin;
            return userPermissions.includes(item.view);
        })
    })).filter(group => group.items.length > 0);
  }, [groups, userPermissions, isAdmin]);

  const currentGroupIndex = useMemo(() => {
    return filteredGroups.findIndex(group => group.items.some(item => item.view === currentView));
  }, [currentView, filteredGroups]);

  useEffect(() => {
    if (isMobileGroupDropdownOpen && previewGroupIndex === -1) {
        setPreviewGroupIndex(currentGroupIndex === -1 ? 0 : currentGroupIndex);
    }
  }, [isMobileGroupDropdownOpen, currentGroupIndex]);

  const displayedGroup = useMemo(() => {
    if (previewGroupIndex === -1) return filteredGroups[currentGroupIndex === -1 ? 0 : currentGroupIndex];
    return filteredGroups[previewGroupIndex] || filteredGroups[0];
  }, [filteredGroups, currentGroupIndex, previewGroupIndex]);

  const handleMobileGroupClick = (index: number) => {
    if (previewGroupIndex === index && isMobileGroupDropdownOpen) {
        setIsMobileGroupDropdownOpen(false);
    } else {
        setPreviewGroupIndex(index);
        setIsMobileGroupDropdownOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setIsUserDropdownOpen(false);
      if (storeMenuRef.current && !storeMenuRef.current.contains(target)) setIsStoreDropdownOpen(false);
      if (groupMenuRef.current && !groupMenuRef.current.contains(target)) setIsMobileGroupDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pendingCount = useMemo(() => {
    return incidents.filter(i => 
      [IncidentStatus.DAÑADO_REPORTADO, IncidentStatus.CAMBIO_SOLICITADO, IncidentStatus.TRASLADO_SOLICITADO, IncidentStatus.WARRANTY_ACTIVE].includes(i.status)
    ).length;
  }, [incidents]);

  const NavButton: React.FC<{ item: NavItem, isMobile?: boolean }> = ({ item, isMobile = false }) => {
    const isActive = currentView === item.view;
    const Icon = item.icon;
    
    return (
      <button
        onClick={() => {
          setCurrentView(item.view);
          setIsMobileGroupDropdownOpen(false);
        }}
        className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 group text-left
          ${isActive 
            ? 'bg-accent/10 text-accent shadow-sm' 
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
      >
        <div className={`p-2.5 rounded-lg transition-colors ${isActive ? 'bg-accent text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-grow min-w-0">
          <p className="text-sm font-bold leading-none">{item.label}</p>
          {!isMobile && <p className="text-[10px] text-slate-500 mt-1 truncate">{item.description}</p>}
        </div>
        {item.view === View.INCIDENTS && pendingCount > 0 && (
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm">
                {pendingCount}
            </span>
        )}
      </button>
    );
  };

  return (
    <>
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 h-16 fixed top-0 left-0 right-0 z-[100] shadow-sm">
        <div className="container mx-auto h-full px-4 flex items-center justify-between gap-1">
          
          {/* IZQUIERDA: SELECTOR DE TIENDA */}
          <div className="flex items-center flex-shrink-0" ref={storeMenuRef}>
            <button 
              onClick={() => isAdmin && setIsStoreDropdownOpen(!isStoreDropdownOpen)}
              className="w-10 h-10 rounded-xl flex items-center justify-center border-2 shadow-sm active:scale-90 transition-all bg-white dark:bg-slate-800"
              style={{ borderColor: currentStore?.accentColor || 'var(--color-accent)' }}
            >
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentStore?.accentColor || 'var(--color-accent)' }}></div>
            </button>

            {isStoreDropdownOpen && isAdmin && (
              <div className="absolute top-16 left-4 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1.5 z-[200]">
                <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800 mb-1">Cambiar Sede</p>
                {stores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => {
                      onSwitchStore(store.id);
                      setIsStoreDropdownOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold transition-all
                      ${currentStore?.id === store.id 
                        ? 'bg-accent/10 text-accent' 
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: store.accentColor }}></div>
                    {store.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CENTRO: LOS TRES MENÚS CENTRADOS (MÁS GRANDES) */}
          <div className="flex-grow flex items-center justify-center min-w-0" ref={groupMenuRef}>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-full border border-slate-200 dark:border-slate-700/50 shadow-inner">
              {filteredGroups.map((group, idx) => {
                const isCurrent = (previewGroupIndex === -1 ? currentGroupIndex : previewGroupIndex) === idx;
                const GroupIcon = group.icon;
                return (
                  <button 
                    key={group.id}
                    onClick={() => handleMobileGroupClick(idx)}
                    className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 rounded-full transition-all duration-300 relative
                      ${isCurrent 
                        ? 'bg-accent text-white shadow-lg scale-105 z-10' 
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                  >
                    <GroupIcon className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${isCurrent ? 'text-white' : ''}`} />
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tighter truncate max-w-[65px] sm:max-w-none">
                      {group.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dropdown de sub-vistas (Más ancho para optimizar espacio) */}
            {isMobileGroupDropdownOpen && displayedGroup && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-2 z-[200]">
                <div className="flex items-center justify-center px-2 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-1.5 border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">{displayedGroup.label}</span>
                </div>
                <div className="space-y-1">
                  {displayedGroup.items.map(item => (
                    <NavButton key={item.view} item={item} isMobile />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DERECHA: NOTIFICACIONES Y PERFIL */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
             {isAdmin && (
                <button 
                  onClick={onToggleGlobalMode}
                  className={`p-2 rounded-xl border transition-all ${isGlobalMode ? 'bg-yellow-400 border-yellow-500 text-slate-900' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                >
                  <BuildingStorefrontIcon className="w-5 h-5" />
                </button>
             )}

             {pendingCount > 0 && (
                <button onClick={onOpenBriefing} className="relative p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                  <AlertTriangleIcon className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 text-[9px] font-black text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                    {pendingCount}
                  </span>
                </button>
             )}

             <div className="relative" ref={userMenuRef}>
                <button onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="flex items-center gap-2 p-1 pl-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center font-black text-xs">
                    {currentUser.name.charAt(0)}
                  </div>
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute top-12 right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-[200]">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">Sesión Activa</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                        <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-1">Sede: {currentStore?.name}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      <button onClick={toggleTheme} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        {theme === 'dark' ? <SunIcon className="w-4 h-4 text-yellow-500" /> : <MoonIcon className="w-4 h-4" />}
                        Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}
                      </button>
                      <button onClick={() => { onOpenVersionHistory(); setIsUserDropdownOpen(false); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <SparklesIcon className="w-4 h-4 text-accent" />
                        Versión v{currentVersion}
                      </button>
                    </div>
                    <div className="p-2">
                      <button onClick={onLogout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                        <LogoutIcon className="w-5 h-5" />
                        CERRAR SESIÓN
                      </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </header>
      <div className="h-16"></div>
    </>
  );
};

export default Header;
