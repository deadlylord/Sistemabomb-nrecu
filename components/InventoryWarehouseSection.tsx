import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Category, Product, Store } from '../types';
import { formatCOP } from '../constants';
import { type WarehouseDirection } from '../services/warehouse';
import { PackageIcon, SearchIcon, SettingsIcon, SwapIcon, CrossIcon, ClipboardListIcon } from './Icons';

const WarehousePanel = lazy(() => import('./WarehousePanel'));

export type InventoryWarehouseConfig = {
  userId: string;
  companyId: string;
  store: Store;
  isAdmin: boolean;
  canConfigure: boolean;
  onMoveWarehouse: (product: Product, direction: WarehouseDirection) => void;
  onOpenCount: () => void;
  onOpenSettings?: () => void;
};

type Props = {
  config: InventoryWarehouseConfig;
  inventory: Product[];
  categories: Category[];
};

const InventoryWarehouseSection: React.FC<Props> = ({ config, inventory, categories }) => {
  const { userId, companyId, store, isAdmin, canConfigure, onMoveWarehouse, onOpenCount, onOpenSettings } = config;
  const [activeTab, setActiveTab] = useState<'stock' | 'history' | 'counts'>('stock');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [includeStoreOnly, setIncludeStoreOnly] = useState(false);

  const sendEnabled = store.warehouseSendEnabled !== false;
  const categoryVisible = store.warehouseCategoryVisible !== false;

  const storeProducts = useMemo(
    () => inventory.filter(p => p.storeId === store.id && (p.companyId || 'default_company') === companyId && !p.isDisabled),
    [inventory, store.id, companyId],
  );

  const summary = useMemo(() => {
    let warehouseUnits = 0;
    let storeUnits = 0;
    let warehouseRefs = 0;
    let warehouseValue = 0;
    let totalValue = 0;
    const byCategory = new Map<string, number>();

    for (const p of storeProducts) {
      const local = Number(p.stock) || 0;
      const wh = Number(p.warehouseUnits) || 0;
      const cost = Number(p.cost) || 0;
      storeUnits += local;
      warehouseUnits += wh;
      warehouseValue += wh * cost;
      totalValue += (local + wh) * cost;
      if (wh > 0) {
        warehouseRefs += 1;
        byCategory.set(p.categoryId, (byCategory.get(p.categoryId) || 0) + wh);
      }
    }

    const categoriesSummary = [...byCategory.entries()]
      .map(([id, units]) => ({ id, name: categories.find(c => c.id === id)?.name || id, units }))
      .sort((a, b) => b.units - a.units);

    return { warehouseUnits, storeUnits, warehouseRefs, warehouseValue, totalValue, categoriesSummary };
  }, [storeProducts, categories]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return storeProducts
      .filter(p => {
        const wh = Number(p.warehouseUnits) || 0;
        const local = Number(p.stock) || 0;
        if (!includeStoreOnly && wh <= 0) return false;
        if (includeStoreOnly && wh <= 0 && local <= 0) return false;
        if (categoryFilter && p.categoryId !== categoryFilter) return false;
        if (!term) return true;
        return p.name.toLowerCase().includes(term)
          || (p.supplier || '').toLowerCase().includes(term)
          || (p.sku || '').toLowerCase().includes(term);
      })
      .sort((a, b) => (Number(b.warehouseUnits) || 0) - (Number(a.warehouseUnits) || 0) || a.name.localeCompare(b.name));
  }, [storeProducts, includeStoreOnly, categoryFilter, search]);

  const categoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Sin categoría';

  return (
    <section
      id="warehouse-section"
      className="bg-white dark:bg-slate-900/75 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-5 sm:p-6 space-y-5 scroll-mt-24"
    >
      {/* Encabezado consolidado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-accent flex items-center gap-2">
              <SwapIcon className="w-6 h-6" />
              Centro de Bodega · {store.name}
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${sendEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
              {sendEnabled ? 'Envíos activos' : 'Envíos pausados'}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${categoryVisible ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              {categoryVisible ? 'Visible en POS' : 'Oculta en POS'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Consulta existencias consolidadas (Tienda + Bodega), mueve unidades, realiza conteos y revisa el historial desde un solo lugar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCount}
            className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-black uppercase shadow-md hover:opacity-90 transition-all flex items-center gap-2"
          >
            <ClipboardListIcon className="w-4 h-4" /> Conteo de bodega
          </button>
          {canConfigure && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:border-accent transition-all flex items-center gap-2"
            >
              <SettingsIcon className="w-4 h-4" /> Configurar sede
            </button>
          )}
        </div>
      </div>

      {/* KPIs Consolidados (0 lecturas extra) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300">En Bodega</p>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-200 mt-1">{summary.warehouseUnits} <span className="text-xs font-bold">uds</span></p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{summary.warehouseRefs} referencias activas</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">En Tienda</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{summary.storeUnits} <span className="text-xs font-bold">uds</span></p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Disponibles para venta POS</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Consolidado</p>
          <p className="text-2xl font-black text-accent mt-1">{summary.storeUnits + summary.warehouseUnits} <span className="text-xs font-bold">uds</span></p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Tienda + Bodega</p>
        </div>
        <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Valor en Bodega</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-200 mt-1">{formatCOP(summary.warehouseValue)}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Total sede: {formatCOP(summary.totalValue)}</p>
        </div>
      </div>

      {/* Pestañas internas */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'stock' ? 'bg-accent text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
          Existencias en bodega ({summary.warehouseRefs})
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'history' ? 'bg-accent text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              Movimientos (30 días)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('counts')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'counts' ? 'bg-accent text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              Conteos guardados
            </button>
          </>
        )}
      </div>

      {/* Contenido Pestaña 1: Existencias consolidadas */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {summary.categoriesSummary.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter('')}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${categoryFilter === '' ? 'bg-accent text-white border-accent' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                Todas ({summary.warehouseUnits})
              </button>
              {summary.categoriesSummary.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(categoryFilter === cat.id ? '' : cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${categoryFilter === cat.id ? 'bg-accent text-white border-accent' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  {cat.name} · <span className="font-black">{cat.units}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar prenda, marca o SKU en bodega..."
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda de bodega" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <CrossIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeStoreOnly}
                onChange={e => setIncludeStoreOnly(e.target.checked)}
                className="h-4 w-4 rounded text-accent"
              />
              Mostrar también productos solo en tienda (para enviar a bodega)
            </label>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-2">
              <PackageIcon className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-500">
                {summary.warehouseRefs === 0 && !includeStoreOnly
                  ? 'Aún no hay productos guardados en la bodega de esta sede.'
                  : 'No se encontraron productos con el filtro actual.'}
              </p>
              {!includeStoreOnly && sendEnabled && (
                <button
                  type="button"
                  onClick={() => setIncludeStoreOnly(true)}
                  className="mt-2 px-4 py-2 rounded-xl bg-accent/10 text-accent text-xs font-black uppercase hover:bg-accent hover:text-white transition-all"
                >
                  Ver productos de tienda para enviar a bodega
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase text-slate-500 font-black">
                  <tr>
                    <th className="px-3 py-2.5">Producto</th>
                    <th className="px-3 py-2.5">Categoría</th>
                    <th className="px-3 py-2.5 text-center">Tienda</th>
                    <th className="px-3 py-2.5 text-center">Bodega</th>
                    <th className="px-3 py-2.5 text-center">Total</th>
                    <th className="px-3 py-2.5 text-right">Valor bodega</th>
                    <th className="px-3 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredProducts.map(product => {
                    const wh = Number(product.warehouseUnits) || 0;
                    const local = Number(product.stock) || 0;
                    return (
                      <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                <PackageIcon className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold truncate">{product.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{product.supplier || 'Sin marca'} · {product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">{categoryName(product.categoryId)}</td>
                        <td className="px-3 py-2.5 text-center font-bold">{local}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${wh > 0 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-400'}`}>
                            {wh}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-black text-accent">{local + wh}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-xs">{formatCOP(wh * (Number(product.cost) || 0))}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {sendEnabled && local > 0 && (
                              <button
                                type="button"
                                onClick={() => onMoveWarehouse(product, 'toWarehouse')}
                                className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors"
                              >
                                → Bodega
                              </button>
                            )}
                            {wh > 0 && (
                              <button
                                type="button"
                                onClick={() => onMoveWarehouse(product, 'toStore')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-colors"
                              >
                                → Tienda
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
          )}
        </div>
      )}

      {/* Contenido Pestaña 2: Movimientos (carga bajo demanda) */}
      {activeTab === 'history' && isAdmin && (
        <Suspense fallback={<p role="status" className="text-sm text-slate-500 py-4">Cargando movimientos de bodega…</p>}>
          <WarehousePanel
            key={`inv-history:${companyId}:${store.id}`}
            embedded
            mode="history"
            userId={userId}
            companyId={companyId}
            store={store}
            inventory={inventory}
            categories={categories}
            isAdmin={isAdmin}
            onClose={() => setActiveTab('stock')}
          />
        </Suspense>
      )}

      {/* Contenido Pestaña 3: Conteos guardados (carga bajo demanda) */}
      {activeTab === 'counts' && isAdmin && (
        <Suspense fallback={<p role="status" className="text-sm text-slate-500 py-4">Cargando conteos de bodega…</p>}>
          <WarehousePanel
            key={`inv-counts:${companyId}:${store.id}`}
            embedded
            mode="counts"
            userId={userId}
            companyId={companyId}
            store={store}
            inventory={inventory}
            categories={categories}
            isAdmin={isAdmin}
            onClose={() => setActiveTab('stock')}
          />
        </Suspense>
      )}
    </section>
  );
};

export default InventoryWarehouseSection;
