
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Seller, Store, Role, Incident, IncidentStatus } from '../types';
import { 
  StoreIcon, InventoryIcon, ReceiptIcon, HistoryIcon, TruckIcon, UsersIcon, SunIcon, MoonIcon, 
  ClipboardListIcon, ChartPieIcon, ContactIcon, SettingsIcon, DollarIcon, ShieldCheckIcon, 
  SwapIcon, BuildingStorefrontIcon, DashboardIcon, AlertTriangleIcon, MenuIcon, CrossIcon, 
  LogoutIcon, ChevronDownIcon, SparklesIcon, ShoppingCartIcon, PackageIcon, CheckIcon,
  ChevronLeftIcon, ChevronRightIcon, TagIcon
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
  const currentVersion = APP_VERSIONS.find(v => v.isCurrent)?.version || '1.0.0';

  const groups: NavGroup[] = useMemo(() => [
    {
        id: 'ops',
        label: 'Operaciones de Venta',
        icon: ShoppingCartIcon,
        color: 'text-blue-500',
        items: [
            { view: View.POS, label: 'Punto de Venta', shortLabel: 'POS', description: 'Facturación rápida', icon: StoreIcon },
            { view: View.LAYAWAY, label: 'Apartados y Abonos', shortLabel: 'Apartados', description: 'Gestionar pagos', icon: ReceiptIcon },
            { view: View.INCIDENTS, label: 'Novedades y Cambios', shortLabel: 'Novedades', description: 'Garantías y devoluciones', icon: AlertTriangleIcon },
            { view: View.GIFT_VOUCHERS, label: 'Bonos de Regalo', shortLabel: 'Bonos', description: 'Administrar bonos', icon: TagIcon },
            { view: View.CUSTOMERS, label: 'Gestión de Clientes', shortLabel: 'Clientes', description: 'Directorio de clientes', icon: ContactIcon },
        ]
    },
    {
        id: 'inv',
        label: 'Control de Inventarios',
        icon: PackageIcon,
        color: 'text-orange-500',
        items: [
            { view: View.INVENTORY, label: 'Stock de Productos', shortLabel: 'Stock', description: 'Consulta de existencias', icon: InventoryIcon },
            { view: View.PURCHASES, label: 'Registro de Compras', shortLabel: 'Compras', description: 'Ingreso de mercancía', icon: TruckIcon },
            { view: View.INVENTORY_TRANSFER, label: 'Traslados Internos', shortLabel: 'Traslados', description: 'Entre sedes', icon: SwapIcon },
            { view: View.STOCK_TAKE_HISTORY, label: 'Auditorías / Conteos', shortLabel: 'Auditorías', description: 'Control físico', icon: ClipboardListIcon },
        ]
    },
    {
        id: 'admin',
        label: 'Administración y Finanzas',
        icon: DashboardIcon,
        color: 'text-purple-500',
        items: [
            { view: View.DASHBOARD, label: 'Resumen de Negocio', shortLabel: 'Dashboard', description: 'Métricas de ventas y rendimiento', icon: DashboardIcon },
            { view: View.FINANCIAL_RECONCILIATION, label: 'Libro de Caja y Conciliación', shortLabel: 'Libro Caja', description: 'Registro de movimientos diarios', icon: DollarIcon },
            { view: View.ACCOUNTING, label: 'Contabilidad e Informes', shortLabel: 'Contabilidad', description: 'Informes PyG y Auditoría IA', icon: ChartPieIcon },
            { view: View.PAYROLL, label: 'Cálculo de Nómina', shortLabel: 'Nómina', description: 'Liquidación de personal', icon: DollarIcon },
            { view: View.SELLERS, label: 'Gestión de Equipo', shortLabel: 'Vendedores', description: 'Personal y usuarios', icon: UsersIcon },
            { view: View.STORES, label: 'Sedes y Almacenes', shortLabel: 'Sedes', description: 'Tiendas físicas', icon: BuildingStorefrontIcon },
            { view: View.ROLE_MANAGER, label: 'Jerarquía y Permisos', shortLabel: 'Seguridad', description: 'Roles y accesos', icon: ShieldCheckIcon },
            { view: View.SETTINGS, label: 'Configuración General', shortLabel: 'Ajustes', description: 'Opciones del sistema', icon: SettingsIcon },
        ]
    }
  ], []);

  const filteredGroups = useMemo(() => {
    return groups.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (item.view === View.ACCOUNTING || item.view === View.FINANCIAL_RECONCILIATION || item.view === View.GIFT_VOUCHERS) return isAdmin;
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
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all group whitespace-nowrap
          ${isActive 
            ? 'bg-accent text-white shadow-md shadow-accent/20 scale-105' 
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
      >
        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-accent'}`} />
        <span className="text-[11px] font-black uppercase tracking-tight">{item.shortLabel}</span>
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
      <header className="bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 fixed top-0 left-0 right-0 z-[100] shadow-sm flex items-center h-16 transition-all duration-300">
        
        <div className="container mx-auto px-2 sm:px-4 flex items-center justify-between gap-1 sm:gap-4">
          
          {/* LEFT: Sede Selector */}
          <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0" ref={storeMenuRef}>
            <button 
              onClick={() => isAdmin && setIsStoreDropdownOpen(!isStoreDropdownOpen)}
              className="px-1.5 py-1.5 sm:px-3 sm:py-2 rounded-xl flex items-center gap-1.5 sm:gap-3 border-2 shadow-sm active:scale-95 transition-all bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
              style={{ borderColor: isStoreDropdownOpen ? 'var(--color-accent)' : undefined }}
            >
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shadow-inner flex-shrink-0" style={{ backgroundColor: currentStore?.accentColor || 'var(--color-accent)' }}></div>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest text-slate-700 dark:text-slate-200 truncate max-w-[60px] sm:max-w-none">
                {currentStore?.name}
              </span>
              {isAdmin && <ChevronDownIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />}
            </button>

            {isStoreDropdownOpen && isAdmin && (
              <div className="absolute top-14 left-2 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1.5 z-[200]">
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

          {/* CENTER: Menu (Replaces Logo) */}
          <div className="flex-grow flex items-center justify-center overflow-hidden">
             
             {/* Desktop Navigation */}
             <nav className="hidden lg:flex items-center gap-4 overflow-x-auto scrollbar-hide py-1">
                {filteredGroups.map((group) => (
                    <div key={group.id} className="flex items-center gap-2 px-2 border-r border-slate-200 dark:border-slate-700 last:border-0">
                        <div className="flex items-center gap-1">
                            {group.items.map(item => (
                                <DesktopNavButton key={item.view} item={item} />
                            ))}
                        </div>
                    </div>
                ))}
             </nav>

             {/* Mobile Navigation */}
             <div className="lg:hidden flex items-center justify-center w-full overflow-x-auto scrollbar-hide" ref={groupMenuRef}>
                 <div className="flex items-center gap-1 p-1">
                    {filteredGroups.map((group, idx) => {
                        const isCurrent = (previewGroupIndex === -1 ? currentGroupIndex : previewGroupIndex) === idx;
                        const GroupIcon = group.icon;
                        return (
                        <button 
                            key={group.id}
                            onClick={() => handleMobileGroupClick(idx)}
                            className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full transition-all duration-300 flex-shrink-0
                            ${isCurrent 
                                ? 'bg-accent text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <GroupIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCurrent ? 'text-white' : ''}`} />
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tighter">
                            {group.label}
                            </span>
                        </button>
                        );
                    })}
                </div>
                {isMobileGroupDropdownOpen && displayedGroup && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 mt-2 w-[90vw] sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-2 z-[200]">
                        <div className="flex items-center justify-center px-2 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-1.5 border border-slate-100 dark:border-slate-700">
                            <span className="text-[9px] sm:text-[10px] font-black text-accent uppercase tracking-[0.2em]">{displayedGroup.label}</span>
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

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
             {isAdmin && (
                <button 
                  onClick={onToggleGlobalMode}
                  title="Modo Multisede"
                  className={`p-1.5 sm:p-2 rounded-xl border transition-all ${isGlobalMode ? 'bg-yellow-400 border-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20 scale-105' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                >
                  <BuildingStorefrontIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
             )}

             {pendingCount > 0 && (
                <button onClick={onOpenBriefing} className="relative p-1.5 sm:p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:scale-105 transition-all">
                  <AlertTriangleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="absolute -top-1 -right-1 h-3 sm:h-3.5 w-3 sm:w-3.5 bg-red-600 text-[7px] sm:text-[8px] font-black text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                    {pendingCount}
                  </span>
                </button>
             )}

             <div className="relative" ref={userMenuRef}>
                <button onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="flex items-center gap-1 sm:gap-2 p-0.5 sm:p-1 pl-1.5 sm:pl-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md transition-all">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent text-white flex items-center justify-center font-black text-[10px] sm:text-xs shadow-inner">
                    {currentUser.name.charAt(0)}
                  </div>
                  <ChevronDownIcon className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
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
      </header>
      <div className="h-20 lg:h-20"></div>
    </>
  );
};

export default Header;
