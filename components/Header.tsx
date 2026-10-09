import { isPlatformOwner } from '../services/developerAccess';
import { isTenantAdministrator, resolveTenantRole } from '../services/tenantIdentity';

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

const ScanNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16M8 9v6m3-6v6m3-6v6m3-6v6"/></svg>;
const WalletNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M7 6V4a1 1 0 0 1 1-1h10"/><circle cx="17" cy="15" r="1"/></svg>;
const GiftNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M12 9v12M3 13h18M12 9C7 9 5 7 7 5s5 0 5 4Zm0 0c5 0 7-2 5-4s-5 0-5 4Z"/></svg>;
const BoxNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10"/></svg>;
const CoinsNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7c0-2 4-3 8-3s8 1 8 3-4 3-8 3-8-1-8-3Zm0 0v5c0 2 4 3 8 3m8-8v5c0 2-4 3-8 3m-8-3v5c0 2 4 3 8 3s8-1 8-3v-5"/></svg>;
const LandmarkNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-6 9 6H3Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18"/></svg>;
const SlidersNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>;
const CheckNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 12l2 2 4-4"/></svg>;
const TeamNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></svg>;
const ChartNavIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V4M4 20h16M8 16v-5m5 5V7m5 9v-8"/></svg>;

const Header: React.FC<HeaderProps> = ({ 
  currentView, setCurrentView, theme, toggleTheme, currentUser, currentStore, 
  currentCompany, userPermissions, onLogout, stores, onSwitchStore, roles, isGlobalMode, 
  onToggleGlobalMode, incidents, onOpenBriefing, isDeveloper: isDeveloperProp
}) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [previewGroupIndex, setPreviewGroupIndex] = useState<number>(-1);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const storeMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = isTenantAdministrator(resolveTenantRole(currentUser, roles, stores));
  const currentVersion = APP_VERSIONS.find(v => v.isCurrent)?.version || '1.0.0';

  const groups: NavGroup[] = useMemo(() => [
    { id: 'ops', label: 'Ventas', icon: ShoppingCartIcon, color: 'text-accent', items: [
      { view: View.POS, label: 'Punto de venta', shortLabel: 'POS', description: 'Registrar ventas', icon: ScanNavIcon },
      { view: View.LAYAWAY, label: 'Apartados', shortLabel: 'Apartados', description: 'Abonos y reservas', icon: WalletNavIcon },
      { view: View.INCIDENTS, label: 'Novedades', shortLabel: 'Novedades', description: 'Cambios y garantías', icon: SwapIcon },
      { view: View.CUSTOMERS, label: 'Clientes', shortLabel: 'Clientes', description: 'Directorio de clientes', icon: TeamNavIcon },
      { view: View.GIFT_VOUCHERS, label: 'Bonos', shortLabel: 'Bonos', description: 'Bonos de regalo', icon: GiftNavIcon },
    ] },
    { id: 'inv', label: 'Inventario', icon: BoxNavIcon, color: 'text-accent', items: [
      { view: View.INVENTORY, label: 'Stock', shortLabel: 'Stock', description: 'Existencias y productos', icon: BoxNavIcon },
      { view: View.PURCHASES, label: 'Compras', shortLabel: 'Compras', description: 'Ingreso de mercancía', icon: TruckIcon },
      { view: View.INVENTORY_TRANSFER, label: 'Traslados', shortLabel: 'Traslados', description: 'Movimientos entre sedes', icon: SwapIcon },
      { view: View.STOCK_TAKE_HISTORY, label: 'Conteos', shortLabel: 'Conteos', description: 'Auditorías físicas', icon: CheckNavIcon },
      { view: View.TAG_SCANNING, label: 'Etiquetas', shortLabel: 'Etiquetas', description: 'Verificación de prendas', icon: TagIcon },
    ] },
    { id: 'finance', label: 'Finanzas', icon: ChartNavIcon, color: 'text-accent', items: [
      { view: View.CEO_CENTER, label: 'CEO Center', shortLabel: 'CEO', description: 'Vista ejecutiva multisede', icon: SparklesIcon },
      { view: View.DASHBOARD, label: 'Resumen', shortLabel: 'Resumen', description: 'Indicadores y ventas', icon: DashboardIcon },
      { view: View.FINANCIAL_RECONCILIATION, label: 'Libro de caja', shortLabel: 'Caja', description: 'Caja y conciliación', icon: WalletNavIcon },
      { view: View.ACCOUNTING, label: 'Contabilidad', shortLabel: 'Informes', description: 'Informes financieros', icon: ChartNavIcon },
      { view: View.PAYROLL, label: 'Nómina', shortLabel: 'Nómina', description: 'Pagos al equipo', icon: CoinsNavIcon },
    ] },
    { id: 'admin', label: 'Administración', icon: SlidersNavIcon, color: 'text-accent', items: [
      { view: View.SELLERS, label: 'Equipo', shortLabel: 'Equipo', description: 'Personal y usuarios', icon: TeamNavIcon },
      { view: View.STORES, label: 'Sedes', shortLabel: 'Sedes', description: 'Tiendas y sucursales', icon: BuildingStorefrontIcon },
      { view: View.ROLE_MANAGER, label: 'Permisos', shortLabel: 'Permisos', description: 'Roles y accesos', icon: ShieldCheckIcon },
      { view: View.SETTINGS, label: 'Ajustes', shortLabel: 'Ajustes', description: 'Configuración general', icon: SlidersNavIcon },
      { view: View.DEVELOPER_CENTER, label: 'Developer Center', shortLabel: 'Developer', description: 'Gestión de plataforma', icon: SettingsIcon },
    ] },
  ], []);

  const userRole = roles.find(r => r.id === currentUser.roleId);
  const roleName = (userRole?.name || '').toLowerCase().trim();

  const isDeveloper = isDeveloperProp !== undefined
    ? isDeveloperProp
    : isPlatformOwner(currentUser);
  const canSwitchStore = isAdmin || isDeveloper;

  const filteredGroups = useMemo(() => {
    const companyAllowed = currentCompany?.allowedViews && Array.isArray(currentCompany.allowedViews) && currentCompany.allowedViews.length > 0
      ? new Set(currentCompany.allowedViews)
      : null;

    return groups.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (isDeveloper) return true;
            if (item.view === View.DEVELOPER_CENTER) return false;
            
            // Si el usuario no es desarrollador, verificar si la empresa tiene habilitado este módulo
            if (!isDeveloper && companyAllowed && !companyAllowed.has(item.view)) {
                return false;
            }

            if (item.view === View.TAG_SCANNING) return true;
            if (item.view === View.ACCOUNTING || item.view === View.FINANCIAL_RECONCILIATION || item.view === View.GIFT_VOUCHERS || item.view === View.CEO_CENTER) return isAdmin;
            return userPermissions.includes(item.view);
        })
    })).filter(group => group.items.length > 0);
  }, [groups, userPermissions, isAdmin, isDeveloper, currentCompany]);

  const currentGroupIndex = useMemo(() => {
    return filteredGroups.findIndex(group => group.items.some(item => item.view === currentView));
  }, [currentView, filteredGroups]);

  useEffect(() => {
    setIsStoreDropdownOpen(false);
    setIsUserDropdownOpen(false);
    setIsMobileMenuOpen(false);
    setPreviewGroupIndex(-1);
  }, [currentUser.id, currentCompany?.id, currentStore?.id, currentView]);

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

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

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
        <div className={`p-2.5 rounded-lg transition-colors ${isActive ? 'bg-accent/10 text-accent' : 'bg-slate-100 dark:bg-slate-800 text-accent'}`}>
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
            <div className="flex items-center justify-center flex-shrink-0" title="Vestika">
              <img src="/assets/vestika.png" alt="Vestika" className="h-8 w-8 lg:h-11 lg:w-11 rounded-xl object-contain drop-shadow-sm" />
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 flex items-center gap-1 sm:gap-4" ref={storeMenuRef}>
              <button 
                aria-label="Cambiar sede"
                aria-expanded={canSwitchStore && isStoreDropdownOpen}
                disabled={!canSwitchStore || stores.length === 0}
                onClick={() => canSwitchStore && setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                className="px-1.5 py-1.5 sm:px-3 sm:py-2 rounded-xl flex items-center gap-1.5 sm:gap-3 border-2 shadow-sm active:scale-95 transition-all bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                style={{ borderColor: isStoreDropdownOpen ? 'var(--color-accent)' : undefined }}
              >
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shadow-inner flex-shrink-0" style={{ backgroundColor: currentStore?.accentColor || 'var(--color-accent)' }}></div>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest text-slate-700 dark:text-slate-200 truncate max-w-[130px] sm:max-w-[200px] lg:max-w-none">
                  {currentStore?.name || 'Sin sedes'}
                </span>
                {canSwitchStore && <ChevronDownIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />}
              </button>

              {isStoreDropdownOpen && canSwitchStore && (
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

          {/* Navigation groups are in the mobile bottom bar, not the narrow header. */}
          <div className="hidden lg:flex flex-grow" />
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
                  className={`hidden lg:inline-flex p-2 rounded-xl transition-all border-2 active:scale-90
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
                      {isAdmin && (
                        <button type="button" onClick={() => { onToggleGlobalMode(); setIsUserDropdownOpen(false); }} className="lg:hidden flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <BuildingStorefrontIcon className="w-5 h-5 text-accent" />
                          <span>{isGlobalMode ? 'Desactivar modo multisede' : 'Activar modo multisede'}</span>
                        </button>
                      )}
                      {isAdmin && userPermissions.includes(View.FINANCIAL_RECONCILIATION) && (
                        <button type="button" onClick={() => { setCurrentView(View.FINANCIAL_RECONCILIATION); setIsUserDropdownOpen(false); }} className="lg:hidden flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <WalletNavIcon className="w-5 h-5 text-accent" />
                          <span>Libro de caja</span>
                        </button>
                      )}

                      {isDeveloper && (
                        <button 
                          onClick={() => { setCurrentView(View.DEVELOPER_CENTER); setIsUserDropdownOpen(false); }} 
                          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all border border-indigo-200 dark:border-indigo-800"
                        >
                          <SettingsIcon className="w-4 h-4 text-indigo-600" />
                          <span>🛠️ Panel Developer Center</span>
                        </button>
                      )}
                      <span className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                        Versión v{currentVersion}
                      </span>
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

      {/* Mobile bottom navigation: tenant permissions are inherited from filteredGroups. */}
      <nav aria-label="Navegación principal" className="lg:hidden fixed bottom-0 inset-x-0 z-[110] border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 gap-1 px-2 pt-2 pb-1">
          {filteredGroups.map((group, idx) => {
            const GroupIcon = group.icon;
            const active = currentGroupIndex === idx;
            return <button key={group.id} type="button" aria-expanded={isMobileMenuOpen && previewGroupIndex === idx} onClick={() => handleMobileGroupClick(idx)} className={`min-w-0 flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-colors ${active ? 'text-accent bg-accent/10' : 'text-slate-600 dark:text-slate-300'}`}>
              <GroupIcon className="w-6 h-6" /><span className="truncate max-w-full">{group.id === 'inv' ? 'Inventario' : group.id === 'admin' ? 'Admin' : group.label}</span>
            </button>;
          })}
        </div>
        {isMobileMenuOpen && displayedGroup && (
          <div ref={groupMenuRef} className="absolute bottom-full left-2 right-2 mb-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3 max-h-[65vh] overflow-y-auto">
            <div className="flex justify-between items-center px-2 pb-2 border-b dark:border-slate-700"><strong className="text-sm">{displayedGroup.label}</strong><button type="button" aria-label="Cerrar menú" onClick={() => setIsMobileMenuOpen(false)}><CrossIcon className="w-5 h-5" /></button></div>
            <div className="grid gap-1 mt-2">{displayedGroup.items.map(item => <NavButton key={item.view} item={item} isMobile />)}</div>
          </div>
        )}
      </nav>

      {/* Responsive Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col fixed left-0 top-16 bottom-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30 overflow-y-auto transition-all duration-300 py-3 space-y-4 scrollbar-thin ${isDesktopSidebarCollapsed ? 'w-20 px-2' : 'w-60 px-3'}`}>
        <button onClick={toggleDesktopSidebar} className="sticky top-0 z-10 self-end mb-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-accent transition-all" title={isDesktopSidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}>
          {isDesktopSidebarCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
        </button>
        {filteredGroups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.id} className="space-y-1">
              {/* Group Title */}
              <div className="flex items-center gap-2 px-3 py-1 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">
                <GroupIcon className="w-3.5 h-3.5 text-accent opacity-80" />
                {!isDesktopSidebarCollapsed && <span className="text-[10px] font-semibold uppercase tracking-wide">{group.label}</span>}
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
                       className={`flex items-center ${isDesktopSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} w-full py-2 rounded-xl transition-all duration-200 group text-left relative
                         ${isActive 
                           ? 'bg-accent text-white shadow-md shadow-accent/15 font-semibold' 
                           : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                         }`}
                     >
                       <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-white/15 text-white' : 'bg-transparent text-accent group-hover:bg-accent/10'}`}>
                         <Icon className="w-4 h-4" />
                       </div>
                       {!isDesktopSidebarCollapsed && <div className="flex-grow min-w-0">
                         <p className="text-xs font-semibold leading-none">{item.label}</p>
                         <p className={`text-[10px] leading-tight mt-0.5 truncate ${isActive ? 'text-accent/80 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                           {item.description}
                         </p>
                       </div>}
                       {item.view === View.INCIDENTS && pendingCount > 0 && (
                           <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black ${isActive ? 'bg-accent text-white animate-none' : 'bg-red-500 text-white animate-pulse'}`}>
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
