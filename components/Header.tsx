
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Seller, Store, Role, Incident, IncidentStatus, Company } from '../types';
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
  currentCompany?: Company | null;
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
  isDeveloper?: boolean;
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
  currentCompany, userPermissions, onLogout, stores, onSwitchStore, roles, isGlobalMode, 
  onToggleGlobalMode, incidents, onOpenBriefing, onOpenVersionHistory, isDeveloper: isDeveloperProp
}) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
            { view: View.TAG_SCANNING, label: 'Prendas sin Etiqueta', shortLabel: 'Etiquetas', description: 'Escanear y detectar prendas sin etiqueta', icon: TagIcon },
        ]
    },
    {
        id: 'admin',
        label: 'Administración y Finanzas',
        icon: DashboardIcon,
        color: 'text-purple-500',
        items: [
            { view: View.DEVELOPER_CENTER, label: 'Developer Center ⚙️', shortLabel: 'Dev Center', description: 'Gestión de empresas y licencias', icon: SettingsIcon },
            { view: View.CEO_CENTER, label: 'CEO Center 💎', shortLabel: 'CEO Center', description: 'Control unificado de las 3 tiendas', icon: SparklesIcon },
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

  const userRole = roles.find(r => r.id === currentUser.roleId);
  const roleName = (userRole?.name || '').toLowerCase().trim();
  const username = (currentUser.username || '').toLowerCase().trim();
  const name = (currentUser.name || '').toLowerCase().trim();

  const isDeveloper = isDeveloperProp !== undefined
    ? isDeveloperProp
    : (
        !!currentUser.isDeveloper ||
        roleName === 'developer' ||
        roleName === 'desarrollador' ||
        username === 'developer' ||
        username === 'dev' ||
        username === 'carlos.cas8852@gmail.com' ||
        (name === 'developer' && username === 'developer')
      );

  const filteredGroups = useMemo(() => {
    return groups.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (item.view === View.DEVELOPER_CENTER) return isDeveloper;
            if (item.view === View.TAG_SCANNING) return true;
            if (item.view === View.ACCOUNTING || item.view === View.FINANCIAL_RECONCILIATION || item.view === View.GIFT_VOUCHERS || item.view === View.CEO_CENTER) return isAdmin;
            return userPermissions.includes(item.view);
        })
    })).filter(group => group.items.length > 0);
  }, [groups, userPermissions, isAdmin, isDeveloper]);

  const currentGroupIndex = useMemo(() => {
    return filteredGroups.findIndex(group => group.items.some(item => item.view === currentView));
  }, [currentView, filteredGroups]);

  useEffect(() => {
    if (isMobileMenuOpen && previewGroupIndex === -1) {
        setPreviewGroupIndex(currentGroupIndex === -1 ? 0 : currentGroupIndex);
    }
  }, [isMobileMenuOpen, currentGroupIndex]);

  const displayedGroup = useMemo(() => {
    if (previewGroupIndex === -1) return filteredGroups[currentGroupIndex === -1 ? 0 : currentGroupIndex];
    return filteredGroups[previewGroupIndex] || filteredGroups[0];
  }, [filteredGroups, currentGroupIndex, previewGroupIndex]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setIsUserDropdownOpen(false);
      if (storeMenuRef.current && !storeMenuRef.current.contains(target)) setIsStoreDropdownOpen(false);
      if (groupMenuRef.current && !groupMenuRef.current.contains(target)) setIsMobileMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMobileGroupClick = (index: number) => {
    if (previewGroupIndex === index && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    } else {
      setPreviewGroupIndex(index);
      setIsMobileMenuOpen(true);
    }
  };

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
          setIsMobileMenuOpen(false);
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
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all group whitespace-nowrap
          ${isActive 
            ? 'bg-accent text-white shadow-md shadow-accent/20 scale-105' 
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        title={item.label}
      >
        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-accent'}`} />
        <span className="text-[10px] font-black uppercase tracking-tighter">{item.shortLabel}</span>
        {item.view === View.INCIDENTS && pendingCount > 0 && (
            <span className={`flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[7px] font-black ${isActive ? 'bg-white text-accent' : 'bg-red-500 text-white animate-pulse'}`}>
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
          
          {/* LEFT: Logo & Brand (Desktop) / Sede Selector (Both) */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="hidden lg:flex items-center gap-2">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20 overflow-hidden">
                {currentCompany?.logoUrl || currentStore?.logo ? (
                  <img 
                    src={currentCompany?.logoUrl || currentStore?.logo || ''} 
                    alt="Logo" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <SparklesIcon className="w-6 h-6" />
                )}
              </div>
              <div className="hidden xl:block max-w-[150px]">
                <h1 className="text-sm font-black uppercase tracking-tighter leading-none dark:text-white truncate">
                  {currentCompany?.name || 'SISTEMA POS'}
                </h1>
                <p className="text-[8px] font-bold text-accent uppercase tracking-widest mt-1 truncate">
                  {currentCompany?.nit ? `NIT: ${currentCompany.nit}` : 'SISTEMA POS IA'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-4" ref={storeMenuRef}>
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
          </div>

          {/* CENTER: Navigation (Desktop & Mobile) */}
          <div className="flex-grow flex items-center justify-start overflow-x-auto lg:scrollbar-default scrollbar-hide py-1 px-1 sm:px-2 min-w-0" ref={groupMenuRef}>
             {/* Mobile Navigation (Three Main Buttons) */}
             <div className="lg:hidden flex items-center justify-center gap-2 w-full max-w-[280px]">
                {filteredGroups.map((group, idx) => {
                  const isActiveGroup = (previewGroupIndex === -1 ? currentGroupIndex : previewGroupIndex) === idx && isMobileMenuOpen;
                  const isCurrentActive = currentGroupIndex === idx;
                  const GroupIcon = group.icon;
                  
                  return (
                    <button 
                      key={group.id}
                      onClick={() => handleMobileGroupClick(idx)}
                      className={`flex-1 flex flex-col items-center justify-center h-12 rounded-2xl transition-all duration-300 border-2 active:scale-95
                        ${isActiveGroup 
                          ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' 
                          : isCurrentActive
                            ? 'bg-accent/5 text-accent border-accent/20'
                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:bg-slate-50'}`}
                    >
                      <GroupIcon className={`w-5 h-5 ${isActiveGroup ? 'text-white' : isCurrentActive ? 'text-accent' : 'text-slate-400'}`} />
                      <span className="text-[8px] font-black uppercase tracking-tighter mt-1">
                        {group.id === 'ops' ? 'Ventas' : group.id === 'inv' ? 'Stock' : 'Admin'}
                      </span>
                    </button>
                  );
                })}

                {/* Dropdown for Mobile Submenus */}
                {isMobileMenuOpen && displayedGroup && (
                  <div className="absolute top-[72px] left-1/2 -translate-x-1/2 w-[94vw] max-w-sm bg-white dark:bg-slate-900 border-2 border-accent/20 rounded-[2rem] shadow-2xl overflow-hidden animate-slide-in-top p-2 z-[200]">
                    <div className="flex items-center justify-between px-4 py-3 bg-accent/5 rounded-2xl mb-2">
                        <div className="flex items-center gap-2">
                            <displayedGroup.icon className="w-5 h-5 text-accent" />
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">{displayedGroup.label}</span>
                        </div>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded-full bg-accent/10 text-accent">
                            <CrossIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1 max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide">
                       {displayedGroup.items.map(item => (
                         <NavButton key={item.view} item={item} isMobile />
                       ))}
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* RIGHT: User Actions & System Info */}
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
             <button 
               onClick={toggleTheme}
               className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 border-2 border-transparent hover:border-accent transition-all active:scale-90"
             >
               {theme === 'dark' ? <SunIcon className="w-5 h-5 text-yellow-500" /> : <MoonIcon className="w-5 h-5" />}
             </button>
             
             {isAdmin && (
                <button 
                  onClick={onToggleGlobalMode}
                  title={isGlobalMode ? "Modo Multisede Activo" : "Activar Modo Multisede"}
                  className={`p-2 rounded-xl transition-all border-2 active:scale-90
                    ${isGlobalMode 
                      ? 'bg-yellow-400 border-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20' 
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 hover:text-accent hover:border-accent'}`}
                >
                  <BuildingStorefrontIcon className="w-5 h-5" />
                </button>
             )}

             {pendingCount > 0 && (
                <button 
                  onClick={onOpenBriefing}
                  className="relative p-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-100 dark:border-orange-800 text-orange-600 hover:scale-105 active:scale-95 transition-all"
                >
                  <AlertTriangleIcon className="w-5 h-5" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-[10px] font-black text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-sm">
                    {pendingCount}
                  </span>
                </button>
             )}

             <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-transparent hover:border-accent transition-all active:scale-90"
                >
                  <div className="text-accent font-black text-sm">
                    {currentUser.name.charAt(0)}
                  </div>
                </button>

                {isUserDropdownOpen && (
                  <div className="absolute top-14 right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-[200]">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1">Sesión Activa</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                        <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-1">Sede: {currentStore?.name}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      <button onClick={() => { onOpenVersionHistory(); setIsUserDropdownOpen(false); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <SparklesIcon className="w-5 h-5 text-accent" />
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

      {/* Beautiful Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col lg:w-64 fixed left-0 top-16 bottom-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30 overflow-y-auto transition-all duration-300 py-4 px-3 space-y-5 scrollbar-thin">
        {filteredGroups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.id} className="space-y-1">
              {/* Group Title */}
              <div className="flex items-center gap-2 px-3 py-1 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">
                <GroupIcon className="w-3.5 h-3.5 text-accent opacity-80" />
                <span className="text-[10px] font-black uppercase tracking-widest">{group.label}</span>
              </div>
              
              {/* Group Items */}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = currentView === item.view;
                  const Icon = item.icon;
                  return (
                     <button
                       key={item.view}
                       onClick={() => setCurrentView(item.view)}
                       className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-all duration-200 group text-left relative
                         ${isActive 
                           ? 'bg-accent text-white shadow-md shadow-accent/15 font-bold scale-[1.01]' 
                           : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                         }`}
                     >
                       <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                         <Icon className="w-4 h-4" />
                       </div>
                       <div className="flex-grow min-w-0">
                         <p className="text-xs font-black leading-none">{item.label}</p>
                         <p className={`text-[10px] leading-tight mt-0.5 truncate ${isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                           {item.description}
                         </p>
                       </div>
                       {item.view === View.INCIDENTS && pendingCount > 0 && (
                           <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black ${isActive ? 'bg-white text-accent animate-none' : 'bg-red-500 text-white animate-pulse'}`}>
                               {pendingCount}
                           </span>
                       )}
                     </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        
      </aside>

      <div className="h-16 lg:h-16"></div>
    </>
  );
};

export default Header;
