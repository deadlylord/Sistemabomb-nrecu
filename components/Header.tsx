
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isMobileStoreDropdownOpen, setIsMobileStoreDropdownOpen] = useState(false);
  const [isMobileGroupDropdownOpen, setIsMobileGroupDropdownOpen] = useState(false);
  const [activeDesktopGroup, setActiveDesktopGroup] = useState<string | null>(null);
  const [expandedMobileGroups, setExpandedMobileGroups] = useState<Set<string>>(new Set(['ops']));
  
  // Para el carrusel de grupos en móvil
  const [previewGroupIndex, setPreviewGroupIndex] = useState<number>(-1);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const storeMenuRef = useRef<HTMLDivElement>(null);
  const mobileStoreMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

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
            if (item.view === View.ACCOUNTING) return isAdmin;
            return userPermissions.includes(item.view);
        })
    })).filter(group => group.items.length > 0);
  }, [groups, userPermissions, isAdmin]);

  const currentGroupIndex = useMemo(() => {
    return filteredGroups.findIndex(group => group.items.some(item => item.view === currentView));
  }, [currentView, filteredGroups]);

  // Al abrir el dropdown móvil, sincronizar el índice de previsualización
  useEffect(() => {
    if (isMobileGroupDropdownOpen) {
        setPreviewGroupIndex(currentGroupIndex === -1 ? 0 : currentGroupIndex);
    }
  }, [isMobileGroupDropdownOpen, currentGroupIndex]);

  const displayedGroup = useMemo(() => {
    if (previewGroupIndex === -1) return filteredGroups[currentGroupIndex === -1 ? 0 : currentGroupIndex];
    return filteredGroups[previewGroupIndex] || filteredGroups[0];
  }, [filteredGroups, currentGroupIndex, previewGroupIndex]);

  const navigateGroup = (direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.stopPropagation();
    const len = filteredGroups.length;
    if (len === 0) return;
    setPreviewGroupIndex(prev => {
        const currentIdx = prev === -1 ? (currentGroupIndex === -1 ? 0 : currentGroupIndex) : prev;
        if (direction === 'next') return (currentIdx + 1) % len;
        return (currentIdx - 1 + len) % len;
    });
  };

  const handleMouseEnter = (groupId: string) => {
    if (leaveTimeoutRef.current) window.clearTimeout(leaveTimeoutRef.current);
    setActiveDesktopGroup(groupId);
  };

  const handleMouseLeave = () => {
    leaveTimeoutRef.current = window.setTimeout(() => {
        setActiveDesktopGroup(null);
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setIsUserDropdownOpen(false);
      if (storeMenuRef.current && !storeMenuRef.current.contains(target)) setIsStoreDropdownOpen(false);
      if (mobileStoreMenuRef.current && !mobileStoreMenuRef.current.contains(target)) setIsMobileStoreDropdownOpen(false);
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

  const toggleMobileGroup = (groupId: string) => {
    setExpandedMobileGroups(prev => {
        const next = new Set(prev);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        return next;
    });
  };

  const NavButton: React.FC<{ item: NavItem, isMobile?: boolean }> = ({ item, isMobile = false }) => {
    const isActive = currentView === item.view;
    const Icon = item.icon;
    
    return (
      <button
        onClick={() => {
          setCurrentView(item.view);
          setIsMobileMenuOpen(false);
          setIsMobileGroupDropdownOpen(false);
          setIsMobileStoreDropdownOpen(false);
          setActiveDesktopGroup(null);
        }}
        className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all duration-200 group text-left
          ${isActive 
            ? 'bg-accent/10 text-accent shadow-sm' 
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
      >
        <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-accent text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
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
        <div className="container mx-auto h-full px-4 flex items-center justify-between gap-2 sm:gap-4">
          
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <MenuIcon className="w-6 h-6" />
            </button>

            {/* LOGO BS: Ahora con onClick asegurado para escritorio */}
            <div 
              onClick={() => isAdmin && setCurrentView(View.DASHBOARD)}
              className={`flex items-center gap-2 group select-none pointer-events-auto ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
              title={isAdmin ? "Ir al Dashboard" : "Logo BS"}
            >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-accent/20 group-hover:rotate-6 transition-transform">BS</div>
                <h1 className="hidden sm:block text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase">
                  STREET<span className="text-accent">BOMBÓN</span>
                </h1>
            </div>
          </div>

          {/* ESPACIO CENTRAL MÓVIL Y TABLET: Selector de Grupo con Flechas */}
          <div className="flex-grow lg:hidden flex flex-col items-center justify-center min-w-0">
            <div className="relative" ref={groupMenuRef}>
              <div className="flex items-center gap-1 bg-accent/5 dark:bg-accent/10 rounded-lg p-1">
                {/* Flecha Izquierda */}
                <button 
                  onClick={(e) => navigateGroup('prev', e)}
                  className="p-1 text-accent/50 hover:text-accent transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                
                <button 
                  onClick={() => setIsMobileGroupDropdownOpen(!isMobileGroupDropdownOpen)}
                  className="flex items-center gap-1.5 px-2 py-0.5 transition-all active:scale-95"
                >
                  <span className="text-[10px] font-black text-accent uppercase tracking-[0.1em] truncate max-w-[100px]">
                    {displayedGroup?.label || 'Menú'}
                  </span>
                  <ChevronDownIcon className={`w-3.5 h-3.5 text-accent transition-transform duration-300 ${isMobileGroupDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Flecha Derecha */}
                <button 
                  onClick={(e) => navigateGroup('next', e)}
                  className="p-1 text-accent/50 hover:text-accent transition-colors"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>

              {isMobileGroupDropdownOpen && displayedGroup && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1.5 z-[120]">
                  {/* Título del grupo actual dentro del desplegable */}
                  <div className="flex items-center justify-center px-2 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-1.5 border border-slate-100 dark:border-slate-700">
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
            
            {isAdmin && (
              <div className="relative mt-1" ref={mobileStoreMenuRef}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMobileStoreDropdownOpen(!isMobileStoreDropdownOpen); }}
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentStore?.accentColor || 'var(--color-accent)' }}></div>
                  <span className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter max-w-[70px] truncate">{currentStore?.name || 'Sede'}</span>
                  <ChevronDownIcon className={`w-2.5 h-2.5 text-slate-400 transition-transform ${isMobileStoreDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMobileStoreDropdownOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1.5 z-[130]">
                    <p className="px-3 py-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800 mb-1">Cambiar Tienda</p>
                    {stores.map(store => (
                      <button
                        key={store.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwitchStore(store.id);
                          setIsMobileStoreDropdownOpen(false);
                        }}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[10px] font-bold transition-all text-left
                          ${currentStore?.id === store.id 
                            ? 'bg-accent/10 text-accent' 
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: store.accentColor }}></div>
                        <span className="truncate">{store.name}</span>
                        {currentStore?.id === store.id && <CheckIcon className="w-3 h-3 ml-auto text-accent" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="hidden lg:flex items-center gap-2 h-full">
            {filteredGroups.map(group => {
                const isOpen = activeDesktopGroup === group.id;
                const GroupIcon = group.icon;
                const hasActiveItem = group.items.some(i => i.view === currentView);

                return (
                    <div 
                        key={group.id} 
                        className="relative h-full flex items-center"
                        onMouseEnter={() => handleMouseEnter(group.id)}
                        onMouseLeave={handleMouseLeave}
                    >
                        <button 
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all
                                ${isOpen || hasActiveItem ? 'text-accent bg-accent/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <GroupIcon className="w-4 h-4" />
                            {group.label}
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpen && (
                            <div className="absolute top-[calc(100%-8px)] left-0 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 animate-fade-in z-50">
                                <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800 mb-1">{group.label}</p>
                                <div className="space-y-1">
                                    {group.items.map(item => (
                                        <NavButton key={item.view} item={item} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
             
             {isAdmin && (
                <button 
                  onClick={onToggleGlobalMode}
                  className={`p-2 rounded-xl border transition-all relative group
                    ${isGlobalMode 
                      ? 'bg-yellow-400 border-yellow-500 text-slate-900 shadow-lg shadow-yellow-400/20 scale-105' 
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-accent'
                    }`}
                  title={isGlobalMode ? "Modo Global Activo: Viendo todas las sedes" : "Activar Búsqueda Global"}
                >
                  <BuildingStorefrontIcon className="w-5 h-5" />
                  {isGlobalMode && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-yellow-400"></span>
                      </span>
                  )}
                </button>
             )}

             <div className="relative hidden lg:block" ref={storeMenuRef}>
                <button 
                  onClick={() => isAdmin && setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                  className={`flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-all ${isAdmin ? 'hover:border-accent cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStore?.accentColor || 'var(--color-accent)' }}></div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight max-w-[120px] truncate">{currentStore?.name || 'Sede'}</span>
                  {isAdmin && <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isStoreDropdownOpen ? 'rotate-180' : ''}`} />}
                </button>

                {isStoreDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1">
                    <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cambiar Sede</p>
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

             {pendingCount > 0 && (
                <button 
                  onClick={onOpenBriefing}
                  className="relative p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:scale-110 transition-all"
                >
                  <AlertTriangleIcon className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 text-[9px] font-black text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-sm animate-bounce">
                    {pendingCount}
                  </span>
                </button>
             )}

             <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center gap-2 p-1 pl-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-accent transition-all group"
                >
                  <div className="hidden sm:block text-right pr-1">
                    <p className="text-[10px] font-black text-slate-900 dark:text-white leading-none truncate max-w-[80px]">{currentUser.name}</p>
                    <p className="text-[8px] text-accent uppercase font-bold tracking-widest">{isAdmin ? 'Admin' : 'Vendedor'}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center font-black text-xs shadow-md shadow-accent/20 group-hover:scale-105 transition-transform">
                    {currentUser.name.charAt(0)}
                  </div>
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in divide-y dark:divide-slate-800">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">Sesión Activa</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                        <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-1">Sede: {currentStore?.name}</p>
                    </div>
                    
                    <div className="p-2 space-y-1">
                      <button onClick={toggleTheme} className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <div className="flex items-center gap-3">
                          {theme === 'dark' ? <SunIcon className="w-4 h-4 text-yellow-500" /> : <MoonIcon className="w-4 h-4" />}
                          Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}
                        </div>
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

      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] animate-fade-in" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="fixed top-0 left-0 bottom-0 w-80 bg-white dark:bg-slate-900 z-[201] shadow-2xl animate-slide-right flex flex-col">
            <div className="p-6 bg-gradient-to-br from-accent to-purple-600 text-white flex justify-between items-center relative overflow-hidden">
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-lg">BS</div>
                <div>
                  <p className="font-black text-lg leading-tight uppercase">Menú Principal</p>
                  <p className="text-white/60 text-[10px] font-bold tracking-[0.2em] uppercase">v{currentVersion}</p>
                </div>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-90 relative z-10">
                <CrossIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              
              {/* SELECTOR DE SEDE MÓVIL (Solo Admin) */}
              {isAdmin && (
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cambiar de Tienda</p>
                      <div className="grid grid-cols-1 gap-2">
                          {stores.map(store => (
                              <button
                                  key={store.id}
                                  onClick={() => {
                                      onSwitchStore(store.id);
                                      setIsMobileMenuOpen(false);
                                  }}
                                  className={`flex items-center justify-between w-full p-3 rounded-xl transition-all border-2
                                      ${currentStore?.id === store.id 
                                          ? 'bg-white dark:bg-slate-800 border-accent shadow-md' 
                                          : 'bg-transparent border-transparent text-slate-500'}`}
                              >
                                  <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: store.accentColor }}></div>
                                      <span className={`text-sm font-black uppercase ${currentStore?.id === store.id ? 'text-slate-900 dark:text-white' : ''}`}>{store.name}</span>
                                  </div>
                                  {currentStore?.id === store.id && <CheckIcon className="w-5 h-5 text-accent" />}
                              </button>
                          ))}
                      </div>
                  </div>
              )}

              {filteredGroups.map(group => {
                const isExpanded = expandedMobileGroups.has(group.id);
                const GroupIcon = group.icon;
                
                return (
                    <div key={group.id} className="space-y-1">
                        <button 
                            onClick={() => toggleMobileGroup(group.id)}
                            className={`flex items-center justify-between w-full p-4 rounded-2xl transition-all ${isExpanded ? 'bg-slate-100 dark:bg-slate-800/50 mb-2' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 ${group.color}`}>
                                    <GroupIcon className="w-5 h-5" />
                                </div>
                                <span className="font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">{group.label}</span>
                            </div>
                            <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isExpanded && (
                            <div className="pl-4 pr-1 space-y-1 animate-fade-in border-l-2 border-slate-100 dark:border-slate-800 ml-6">
                                {group.items.map(item => (
                                    <NavButton key={item.view} item={item} isMobile />
                                ))}
                            </div>
                        )}
                    </div>
                );
              })}
            </div>

            <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-500/20 active:scale-95 transition-all uppercase tracking-[0.2em] text-[10px]">
                <LogoutIcon className="w-5 h-5" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </>
      )}

      <div className="h-16"></div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slide-right {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-right {
          animation: slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </>
  );
};

export default Header;
