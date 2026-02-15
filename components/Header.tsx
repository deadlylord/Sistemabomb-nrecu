
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
    shortLabel: string;
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
            { view: View.POS, label: 'Punto de Venta', shortLabel: 'POS', description: 'Facturación rápida', icon: StoreIcon },
            { view: View.LAYAWAY, label: 'Abonos y Apartados', shortLabel: 'Abonos', description: 'Gestionar pagos', icon: ReceiptIcon },
            { view: View.INCIDENTS, label: 'Novedades / Cambios', shortLabel: 'Novedades', description: 'Garantías y cambios', icon: AlertTriangleIcon },
            { view: View.CUSTOMERS, label: 'Mis Clientes', shortLabel: 'Clientes', description: 'Directorio', icon: ContactIcon },
        ]
    },
    {
        id: 'inv',
        label: 'Inventarios',
        icon: PackageIcon,
        color: 'text-orange-500',
        items: [
            { view: View.INVENTORY, label: 'Existencias', shortLabel: 'Stock', description: 'Consulta stock', icon: InventoryIcon },
            { view: View.PURCHASES, label: 'Compras', shortLabel: 'Compras', description: 'Ingreso mercancía', icon: TruckIcon },
            { view: View.INVENTORY_TRANSFER, label: 'Traslados', shortLabel: 'Traslados', description: 'Mover entre sedes', icon: SwapIcon },
            { view: View.STOCK_TAKE_HISTORY, label: 'Conteos Físicos', shortLabel: 'Conteos', description: 'Auditorías', icon: ClipboardListIcon },
        ]
    },
    {
        id: 'admin',
        label: 'Gestión',
        icon: DashboardIcon,
        color: 'text-purple-500',
        items: [
            { view: View.DASHBOARD, label: 'Dashboard', shortLabel: 'Métricas', description: 'Rendimiento', icon: DashboardIcon },
            { view: View.FINANCIAL_RECONCILIATION, label: 'Conciliación', shortLabel: 'Libro Mayor', description: 'Cruce de cuentas', icon: DollarIcon },
            { view: View.ACCOUNTING, label: 'Contabilidad IA', shortLabel: 'PyG IA', description: 'Auditoría inteligente', icon: ChartPieIcon },
            { view: View.PAYROLL, label: 'Nómina y Pagos', shortLabel: 'Nómina', description: 'Comisiones', icon: DollarIcon },
            { view: View.SELLERS, label: 'Vendedores', shortLabel: 'Equipo', description: 'Personal', icon: UsersIcon },
            { view: View.STORES, label: 'Sedes', shortLabel: 'Sedes', description: 'Ajustes sedes', icon: BuildingStorefrontIcon },
            { view: View.ROLE_MANAGER, label: 'Permisos', shortLabel: 'Roles', description: 'Seguridad', icon: ShieldCheckIcon },
            { view: View.SETTINGS, label: 'Ajustes', shortLabel: 'Ajustes', description: 'Opciones', icon: SettingsIcon },
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

  const DesktopNavButton: React.FC<{ item: NavItem }> = ({ item }) => {
    const isActive = currentView === item.view;
    const Icon = item.icon;
    
    return (
      <button
        onClick={() => setCurrentView(item.view)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all group whitespace-nowrap
          ${isActive 
            ? 'bg-accent text-white shadow-lg shadow-accent/20 scale-105' 
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
      >
        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-accent'}`} />
        <span className="text-[11px] font-black uppercase tracking-tighter">{item.shortLabel}</span>
        {item.view === View.INCIDENTS && pendingCount > 0 && (
            <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-black ${isActive ? 'bg-white text-accent' : 'bg-red-500 text-white animate-pulse'}`}>
                {pendingCount}
            </span>
        )}
      </button>
    );
  };

  return (
    <>
      <header className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 fixed top-0 left-0 right-0 z-[100] shadow-sm flex flex-col transition-all duration-300">
        
        {/* FILA SUPERIOR: Branding, Sedes y Usuario */}
        <div className="container mx-auto h-16 px-4 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-4 flex-shrink-0" ref={storeMenuRef}>
            <button 
              onClick={() => isAdmin && setIsStoreDropdownOpen(!isStoreDropdownOpen)}
              className="px-3 py-2 rounded-xl flex items-center gap-3 border-2 shadow-sm active:scale-95 transition-all bg-white dark:bg-slate-800"
              style={{ borderColor: currentStore?.accentColor || 'var(--color-accent)' }}
            >
              <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: currentStore?.accentColor || 'var(--color-accent)' }}></div>
              <span className="hidden sm:inline text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                {currentStore?.name}
              </span>
              {isAdmin && <ChevronDownIcon className="w-4 h-4 text-slate-400" />}
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

          <div className="flex-grow flex items-center justify-center overflow-hidden">
             <div className="flex items-center gap-2 lg:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32" className="drop-shadow-lg">
                  <defs>
                    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff007f" stopOpacity="1" />
                      <stop offset="100%" stopColor="#00aaff" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="50" fill="url(#headerGrad)"/>
                  <text x="50" y="65" fontFamily="Arial" fontSize="50" fontWeight="bold" fill="white" textAnchor="middle">BS</text>
                </svg>
                <h1 className="text-sm sm:text-lg font-serif font-bold text-slate-800 dark:text-text-light tracking-tight truncate">
                    <span className="text-blue-500">Street</span>/<span className="text-accent">Bombón</span>
                </h1>
             </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
             {isAdmin && (
                <button 
                  onClick={onToggleGlobalMode}
                  title="Modo Multisede"
                  className={`p-2 rounded-xl border transition-all ${isGlobalMode ? 'bg-yellow-400 border-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20 scale-105' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                >
                  <BuildingStorefrontIcon className="w-5 h-5" />
                </button>
             )}

             {pendingCount > 0 && (
                <button onClick={onOpenBriefing} className="relative p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:scale-105 transition-all">
                  <AlertTriangleIcon className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 text-[9px] font-black text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                    {pendingCount}
                  </span>
                </button>
             )}

             <div className="relative" ref={userMenuRef}>
                <button onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="flex items-center gap-2 p-1 pl-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md transition-all">
                  <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center font-black text-xs shadow-inner">
                    {currentUser.name.charAt(0)}
                  </div>
                  <ChevronDownIcon className={`w-3 h-3 text-slate-400 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute top-12 right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-[200]">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1">Sesión Activa</p>
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
                    <div className="p-2 border-t dark:border-slate-800">
                      <button onClick={onLogout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all uppercase tracking-widest">
                        <LogoutIcon className="w-5 h-5" />
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* FILA INFERIOR: Navegación Expandida (Desktop) / Selectores (Mobile) */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="container mx-auto px-4 overflow-x-auto scrollbar-hide">
                
                {/* VISTA DESKTOP (Expandida) */}
                <nav className="hidden lg:flex items-center py-2 gap-4">
                    {filteredGroups.map((group, gIdx) => (
                        <div key={group.id} className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-800 last:border-0">
                            <div className="flex flex-col flex-shrink-0 mr-2 opacity-40">
                                <group.icon className="w-3 h-3 mx-auto" />
                                <span className="text-[8px] font-black uppercase text-center tracking-tighter">{group.label}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {group.items.map(item => (
                                    <DesktopNavButton key={item.view} item={item} />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* VISTA MÓVIL (Pills) */}
                <div className="lg:hidden flex items-center justify-center h-14 py-2" ref={groupMenuRef}>
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

                    {isMobileGroupDropdownOpen && displayedGroup && (
                    <div className="absolute top-32 left-1/2 -translate-x-1/2 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-2 z-[200]">
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

            </div>
        </div>
      </header>
      <div className="h-32 lg:h-28"></div>
    </>
  );
};

export default Header;
