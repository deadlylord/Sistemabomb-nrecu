import React from 'react';
import { View, Seller, Store, Role } from '../types';
import { StoreIcon, InventoryIcon, ReceiptIcon, HistoryIcon, TruckIcon, UsersIcon, SunIcon, MoonIcon, ClipboardListIcon, ChartPieIcon, ContactIcon, SettingsIcon, DollarIcon, ShieldCheckIcon, SwapIcon, BuildingStorefrontIcon, DashboardIcon, AlertTriangleIcon } from './Icons';

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
}

const navItems = [
    { view: View.DASHBOARD, label: 'Dashboard', icon: DashboardIcon },
    { view: View.POS, label: 'Punto de Venta', icon: StoreIcon },
    { view: View.INVENTORY, label: 'Inventario', icon: InventoryIcon },
    { view: View.INVENTORY_TRANSFER, label: 'Traslados', icon: SwapIcon },
    { view: View.PURCHASES, label: 'Compras', icon: TruckIcon },
    { view: View.SELLERS, label: 'Vendedores', icon: UsersIcon },
    { view: View.STORES, label: 'Tiendas', icon: BuildingStorefrontIcon },
    { view: View.LAYAWAY, label: 'Abonos', icon: ReceiptIcon },
    { view: View.CUSTOMERS, label: 'Clientes', icon: ContactIcon },
    { view: View.INCIDENTS, label: 'Novedades', icon: AlertTriangleIcon },
    { view: View.PAYROLL, label: 'Nómina', icon: DollarIcon },
    { view: View.STOCK_TAKE_HISTORY, label: 'Historial Conteos', icon: ClipboardListIcon },
    { view: View.ROLE_MANAGER, label: 'Gestionar Roles', icon: ShieldCheckIcon },
    { view: View.SETTINGS, label: 'Ajustes', icon: SettingsIcon },
];

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView, theme, toggleTheme, currentUser, currentStore, userPermissions, onLogout, stores, onSwitchStore, roles, isGlobalMode, onToggleGlobalMode }) => {
  const commonButtonClasses = "px-3 py-1.5 text-xs sm:text-sm font-bold transition-all duration-300 rounded-lg flex items-center space-x-1.5";
  const activeButtonClasses = "bg-accent text-white shadow-md shadow-accent/30";
  const inactiveButtonClasses = "bg-white/50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/80 hover:text-slate-800 dark:hover:text-slate-200";

  const availableNavItems = navItems.filter(item => userPermissions.includes(item.view));
  
  const adminRole = roles.find(r => r.name === 'Administrator');
  const isAdmin = currentUser.roleId === adminRole?.id;

  return (
    <header className="bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-2 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3">
            <div className="text-center sm:text-left">
              <h1 className="text-md sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Facturación Street/ <span className="text-accent">Bombón</span>
              </h1>
               <div className="mt-1 flex items-center gap-4">
                {isAdmin ? (
                  <div className="relative inline-block">
                    <select
                      value={currentStore?.id}
                      onChange={(e) => onSwitchStore(e.target.value)}
                      className={`bg-transparent text-accent font-bold text-base border-2 rounded-md py-0 pl-2 pr-8 focus:ring-0 appearance-none cursor-pointer h-[29.5px] transition-all ${isGlobalMode ? 'border-yellow-400 shadow-md shadow-yellow-400/30' : 'border-accent'}`}
                      aria-label="Cambiar de tienda"
                    >
                      {stores.map(store => (
                        <option key={store.id} value={store.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-normal text-base">
                          {store.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-accent">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                ) : (
                  currentStore && <p className="text-base font-bold text-accent">{currentStore.name}</p>
                )}
                {isAdmin && (
                    <label htmlFor="globalModeToggle" className="flex items-center cursor-pointer">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mr-2">Búsqueda Global</span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="globalModeToggle"
                                className="sr-only"
                                checked={isGlobalMode}
                                onChange={onToggleGlobalMode}
                            />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${isGlobalMode ? 'bg-yellow-400' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isGlobalMode ? 'translate-x-4' : ''}`}></div>
                        </div>
                    </label>
                )}
              </div>
            </div>
            <div className="hidden lg:flex items-center space-x-2 flex-wrap bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl">
              {availableNavItems.map(({ view, label, icon: Icon }) => (
                 <button
                    key={view}
                    onClick={() => setCurrentView(view)}
                    className={`${commonButtonClasses} ${currentView === view ? activeButtonClasses : inactiveButtonClasses.replace('bg-white/50', 'bg-transparent').replace('dark:bg-slate-800/60', 'dark:bg-transparent')}`}
                    aria-label={label}
                >
                    <Icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{label}</span>
                </button>
              ))}
            </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
           <div className="text-right">
                <p className="font-bold text-sm text-slate-800 dark:text-white">{currentUser.name}</p>
                <button onClick={onLogout} className="text-xs text-accent hover:underline">
                  Cerrar Sesión
                </button>
           </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon className="w-5 h-5 text-yellow-400" /> : <MoonIcon className="w-5 h-5 text-slate-700" />}
          </button>
        </div>
      </div>
       <div className="lg:hidden container mx-auto mt-2 overflow-x-auto pb-2">
           <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl">
            {availableNavItems.map(({ view, label, icon: Icon }) => (
                 <button
                    key={view}
                    onClick={() => setCurrentView(view)}
                    className={`group ${commonButtonClasses} ${currentView === view ? activeButtonClasses : inactiveButtonClasses.replace('bg-white/50', 'bg-transparent').replace('dark:bg-slate-800/60', 'dark:bg-transparent')}`}
                    aria-label={label}
                >
                    <Icon className="w-5 h-5" />
                    <span className="hidden group-hover:inline sm:inline whitespace-nowrap">{label}</span>
                </button>
              ))}
           </nav>
       </div>
    </header>
  );
};

export default Header;