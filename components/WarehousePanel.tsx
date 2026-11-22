import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Category, Product, Purchase, Store } from '../types';
import VerificationCountTable from './VerificationCountTable';
import { loadWarehousePending, saveWarehousePending, warehousePendingKey } from '../services/warehousePending';
import { callWarehouse, type WarehouseDirection } from '../services/warehouse';

type Props = {
  userId: string;
  companyId: string;
  store: Store;
  inventory: Product[];
  categories: Category[];
  isAdmin: boolean;
  onClose: () => void;
  mode?: 'count' | 'move' | 'history' | 'counts' | 'purchase';
  embedded?: boolean;
  purchases?: Purchase[];
  initialSelectedIds?: string[];
  onPurchasesMoved?: (ids: string[]) => void;
  movement?: { productId: string; direction: WarehouseDirection };
  api?: typeof callWarehouse;
};
const inputClass = 'w-full rounded-lg p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700';
export default function WarehousePanel({ userId, companyId, store, inventory, categories, isAdmin, onClose, mode = 'count', movement, embedded, purchases = [], initialSelectedIds, onPurchasesMoved, api = callWarehouse }: Props) {
  const [tab, setTab] = useState<string>(mode), [rows, setRows] = useState<any[]>([]), [counts, setCounts] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<any[]>([]), [category, setCategory] = useState(''), [detailCursor, setDetailCursor] = useState<string | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<any[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState(''), [historyDirection, setHistoryDirection] = useState<'all' | 'toWarehouse' | 'toStore'>('all');
  const direction = movement?.direction || 'toWarehouse';
  const productId = movement?.productId || '';
  const [units, setUnits] = useState(''), [note, setNote] = useState('');
  const [selectedPurchases, setSelectedPurchases] = useState<Record<string, string>>(() => {
    if (!initialSelectedIds?.length) return {};
    const wanted = new Set(initialSelectedIds);
    const initial: Record<string, string> = {};
    for (const row of purchases) {
      if (wanted.has(row.id) && Object.keys(initial).length < 25) {
        initial[row.id] = String(row.quantity);
      }
    }
    return initial;
  });
  const [storageReady, setStorageReady] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const storageKey = warehousePendingKey(companyId, store.id, userId);
  const submitting = useRef(false), pending = useRef<{ signature: string; operationId: string } | null>(null), alive = useRef(true);
  const call = (data: Record<string, unknown>) => api(companyId, store.id, data);
  const refresh = async () => {
    if (mode !== 'count') return;
    const result = await call({ action: 'summary' });
    if (alive.current) {
      setRows(result.rows);
      setCounts({});
      setProductCounts({});
      setDetails([]);
      setCategory('');
    }
  };
  useEffect(() => {
    alive.current = true;
    setTab(mode);
    setBusy(true);
    try {
      pending.current = loadWarehousePending(storageKey);
      setStorageReady(true);
    } catch {
      setError('No se pudo recuperar la operación pendiente de bodega.');
    }
    const load = mode === 'history' || mode === 'counts' ? loadHistory(mode) : refresh();
    load.catch(error => {
      if (alive.current) setError(error.message);
    }).finally(() => {
      if (alive.current) setBusy(false);
    });
    return () => { alive.current = false; };
  }, [companyId, store.id, mode]);
  const run = async (work: () => Promise<void>) => {
    if (submitting.current) return; submitting.current = true; setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'No se pudo completar.'); }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  };
  const write = async (data: Record<string, unknown>) => {
    if (!storageReady) throw new Error('No se puede guardar sin recuperar primero el estado pendiente de esta sesión.');
    const signature = JSON.stringify(data);
    // Keep exactly the same operation and payload on error, never invent a new
    // operation after a lost acknowledgement. Block edits until it is resolved.
    if (pending.current && pending.current.signature !== signature) throw new Error('Reintenta primero la operación pendiente con sus datos originales.');
    if (!pending.current) {
      const candidate = { signature, operationId: crypto.randomUUID() };
      try { saveWarehousePending(storageKey, candidate); } catch { throw new Error('No se pudo preparar la recuperación del movimiento. Revisa el almacenamiento del navegador antes de guardar.'); }
      pending.current = candidate;
    }
    try {
      const result = await call({ ...data, operationId: pending.current.operationId });
      saveWarehousePending(storageKey, null); pending.current = null; return result;
    } catch (error) {
      const code = String((error as { code?: string }).code || '');
      if (['invalid-argument','permission-denied','failed-precondition','aborted','not-found','already-exists'].some(value => code.endsWith('/' + value))) { saveWarehousePending(storageKey, null); pending.current = null; }
      throw error;
    }
  };
  const loadDetails = async (id: string, next = false) => {
    const result = await call({ action: 'products', categoryId: id, ...(next && detailCursor ? { cursor: detailCursor } : {}) });
    if (!alive.current) return;
    setCategory(id); setDetails(old => next ? [...old, ...result.rows] : result.rows); setDetailCursor(result.cursor);
    if (!next) { const saved = await call({ action: 'draft', categoryId: id }); if (alive.current && saved.draft) setProductCounts(old => ({ ...old, ...saved.draft.productCounts })); }
  };
  const entry = (row: any) => ({ categoryId: row.id, revision: row.revision || 0, physicalCount: Number(counts[row.id]) });
  const loadHistory = async (kind: string, next = false) => {
    const result = await call({ action: kind, ...(next && cursor ? { cursor } : {}) });
    if (alive.current) { setHistory(old => next ? [...old, ...result.rows] : result.rows); setCursor(result.cursor); setTab(kind); }
  };
  const products = useMemo(
    () => inventory.filter(p => p.storeId === store.id && (p.companyId || 'default_company') === companyId && !p.isDisabled),
    [inventory, store.id, companyId],
  );
  const productsById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const categoryName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const saveCount = () => run(async () => {
    const entries = rows.filter(r => counts[r.id] !== undefined && counts[r.id] !== '').map(entry);
    if (!entries.length || entries.some(e => !Number.isSafeInteger(e.physicalCount) || e.physicalCount < 0)) throw new Error('Ingresa cantidades enteras mayores o iguales a cero.');
    await write({ action: 'count', entries, productCounts });
    if (alive.current) { setMessage('Conteo de bodega guardado. Las diferencias quedan para revisión.'); setCounts({}); setProductCounts({}); }
  });
  const selectedPurchaseList = purchases.filter(row => selectedPurchases[row.id] !== undefined);
  const selectedPurchaseUnits = selectedPurchaseList.reduce((sum, row) => {
    const n = Number(selectedPurchases[row.id]);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  const filteredHistory = useMemo(() => {
    if (tab !== 'history') return history;
    const term = historySearch.trim().toLowerCase();
    return history.filter(row => {
      if (historyDirection !== 'all' && row.direction !== historyDirection) return false;
      if (!term) return true;
      return String(row.productName || '').toLowerCase().includes(term)
        || String(row.actorName || '').toLowerCase().includes(term)
        || String(row.note || '').toLowerCase().includes(term)
        || String(row.supplier || '').toLowerCase().includes(term);
    });
  }, [tab, history, historySearch, historyDirection]);

  const selectAllPurchases = () => {
    const next: Record<string, string> = {};
    for (const row of purchases.slice(0, 25)) next[row.id] = String(row.quantity);
    setSelectedPurchases(next);
  };

  const content = <>
      {!embedded && (
        <div className="flex justify-between gap-3 items-center mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-black text-xl text-accent">
              {mode === 'history' ? 'Movimientos de bodega' : mode === 'counts' ? 'Conteos de bodega' : mode === 'purchase' ? 'Enviar compras a bodega' : 'Bodega'} · {store.name}
            </h2>
            {mode === 'purchase' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1. Marca los productos comprados · 2. Ajusta unidades si es envío parcial · 3. Confirma el envío.
              </p>
            )}
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700">Cerrar</button>
        </div>
      )}
      {mode === 'count' && isAdmin && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" disabled={busy || !!pending.current} aria-pressed={tab === 'count'} onClick={() => setTab('count')} className={`rounded-lg px-3 py-2 text-sm font-bold ${tab === 'count' ? 'bg-accent text-white' : 'bg-accent/10 text-accent'}`}>Conteo de bodega</button>
          <button type="button" disabled={busy || !!pending.current} aria-pressed={tab === 'counts'} onClick={() => run(() => loadHistory('counts'))} className={`rounded-lg px-3 py-2 text-sm font-bold ${tab === 'counts' ? 'bg-accent text-white' : 'bg-accent/10 text-accent'}`}>Conteos guardados</button>
        </div>
      )}
      {pending.current && <button type="button" disabled={busy} className="mb-2 p-2.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-sm" onClick={() => run(async () => { const payload = JSON.parse(pending.current!.signature);
        const result = await write(payload);
        if (payload.action === 'purchaseMove' && Array.isArray(result.purchaseIds) && alive.current) onPurchasesMoved?.(result.purchaseIds);
        await refresh(); setCounts({}); setProductCounts({}); setUnits(''); setMessage('Operación pendiente confirmada. No se volvió a duplicar el movimiento.'); })}>Resolver operación pendiente</button>}
      {error && <p role="alert" className="text-red-500 text-sm font-semibold mb-2">{error}</p>}
      {message && <p role="status" className="text-green-600 text-sm font-semibold mb-2">{message}</p>}
      {busy && <p role="status" className="text-sm text-slate-500 mb-2">Procesando…</p>}
      <div className="overflow-y-auto min-h-0 space-y-3">
        {tab === 'count' && <>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-600 dark:text-slate-300">Cuenta las unidades por categoría. Abre el ojo para revisar marcas y prendas.</p><button type="button" disabled={busy || !!pending.current} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold" onClick={() => run(async () => { await refresh(); setCounts({}); setProductCounts({}); setDetails([]); setCategory(''); })}>Actualizar</button></div>
          <VerificationCountTable
            rows={rows.map(row => ({ id: row.id, name: categoryName(row.id), totalStock: row.stock }))}
            counts={counts}
            showSystem
            disabled={busy || !!pending.current}
            status={!rows.length ? (busy ? 'Cargando bodega…' : 'No hay mercancía registrada en esta bodega.') : undefined}
            onCountChange={(id, value) => setCounts(previous => ({ ...previous, [id]: value }))}
            onOpenDetails={id => run(() => loadDetails(id))}
          />
          {category && <section className="border rounded-xl p-3 dark:border-slate-700"><h3 className="font-bold mb-2">Marcas y prendas · {categoryName(category)}</h3>{details.map(p => <label key={p.id} className="grid grid-cols-2 gap-2 py-1 items-center text-sm"><span>{productsById.get(p.id)?.supplier || p.supplier || 'Sin marca'} · {productsById.get(p.id)?.name || p.name} · Sistema: {p.stock}</span><input className={inputClass} aria-label={`Contar ${p.name}`} type="number" min="0" step="1" disabled={busy || !!pending.current} value={productCounts[p.id] ?? ''} onChange={e => setProductCounts(old => { const next = { ...old }; if (e.target.value === '') delete next[p.id]; else next[p.id] = Number(e.target.value); return next; })}/></label>)}{detailCursor && <button type="button" disabled={busy} className="mt-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold" onClick={() => run(() => loadDetails(category, true))}>Más prendas</button>}
            <div className="flex flex-wrap gap-3 mt-3"><button type="button" disabled={busy || !!pending.current} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold" onClick={() => { if (detailCursor || details.some(p => !Number.isSafeInteger(productCounts[p.id]) || productCounts[p.id] < 0)) { setError('Carga y cuenta todas las prendas de la categoría para sumar.'); return; } setCounts({ ...counts, [category]: String(details.reduce((sum,p) => sum + productCounts[p.id],0)) }); }}>Usar suma en categoría</button><button type="button" disabled={busy} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold" onClick={() => run(async () => { const row = rows.find(r => r.id === category); if (!row || counts[category] === undefined || counts[category] === '') throw new Error('Indica el total de la categoría antes de guardar el borrador.'); await write({ action: 'draftSave', entries: [entry(row)], productCounts: Object.fromEntries(details.filter(p => productCounts[p.id] !== undefined).map(p => [p.id,productCounts[p.id]])) }); setMessage('Borrador de bodega guardado.'); })}>Guardar borrador</button>{isAdmin && <button type="button" disabled={busy} className="px-3 py-2 rounded-lg bg-accent/15 text-accent text-xs font-bold" onClick={() => { if (detailCursor || details.some(p => !Number.isSafeInteger(productCounts[p.id]) || productCounts[p.id] < 0)) { setError('Carga y cuenta todas las prendas antes de aplicar un ajuste.'); return; } if (!window.confirm('¿Aplicar ajuste solo a las existencias de bodega de estas prendas?')) return; void run(async () => { const row = rows.find(r => r.id === category); await write({ action: 'adjust', entries: [{ categoryId: category, revision: row.revision || 0, physicalCount: details.reduce((sum,p) => sum + productCounts[p.id],0) }], productCounts: Object.fromEntries(details.map(p => [p.id,productCounts[p.id]])) }); await refresh(); setDetails([]); setCategory(''); setCounts({}); setProductCounts({}); setMessage('Ajuste de bodega registrado.'); }); }}>Aplicar ajuste por productos</button>}</div>
          </section>}
          <button type="button" className="p-3 rounded-xl bg-accent text-white font-bold" disabled={busy || !rows.length} onClick={saveCount}>Guardar conteo de bodega</button>
        </>}
        {tab === 'move' && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => { const n = Number(units); if (!productId || !Number.isSafeInteger(n) || n < 1) throw new Error('Selecciona prenda y cantidad entera positiva.'); await write({ action: 'move', direction, productId, quantity: n, note }); if (!alive.current) return; setUnits(''); setNote(''); setMessage('Movimiento confirmado y registrado.'); await refresh(); }); }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase bg-accent/10 text-accent">
            {direction === 'toWarehouse' ? 'Tienda → Bodega' : 'Bodega → Tienda'}
          </div>
          {products.filter(product => product.id === productId).map(product => (
            <div key={product.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="h-20 w-16 object-cover rounded-lg" />}
              <div><p className="font-bold">{product.name}</p><p className="text-xs text-slate-500">{product.supplier}</p><p className="text-sm font-semibold mt-1">Tienda: {product.stock} · Bodega: {product.warehouseUnits ?? 0}</p></div>
            </div>
          ))}
          <label className="block text-sm font-bold">Unidades<input className={inputClass} disabled={busy || !!pending.current} required type="number" min="1" step="1" value={units} onChange={e => setUnits(e.target.value)}/></label>
          <label className="block text-sm font-bold">Nota opcional<input className={inputClass} disabled={busy || !!pending.current} maxLength={500} value={note} onChange={e => setNote(e.target.value)}/></label><button disabled={busy} className="p-3 bg-accent text-white font-bold rounded-xl">Confirmar movimiento físico</button>
        </form>}
        {tab === 'purchase' && (
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault();
            void run(async () => {
              const entries = purchases.filter(row => selectedPurchases[row.id] !== undefined)
                .map(row => ({ purchaseId: row.id, quantity: Number(selectedPurchases[row.id]), maximum: row.quantity }));
              if (!entries.length || entries.length > 25 || entries.some(entry => !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > entry.maximum)) {
                throw new Error('Selecciona entre 1 y 25 compras y revisa las unidades de cada una.');
              }
              const result = await write({
                action: 'purchaseMove',
                entries: entries.map(({ purchaseId, quantity }) => ({ purchaseId, quantity })),
              });
              if (alive.current) onPurchasesMoved?.(result.purchaseIds);
            });
          }}>
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy || !!pending.current || !purchases.length} onClick={selectAllPurchases} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-black uppercase">
                  Seleccionar todo{purchases.length > 25 ? ' (25)' : ''}
                </button>
                <button type="button" disabled={busy || !!pending.current || !selectedPurchaseList.length} onClick={() => setSelectedPurchases({})} className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold disabled:opacity-50">
                  Quitar selección
                </button>
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {selectedPurchaseList.length} seleccionadas · {selectedPurchaseUnits} uds → Bodega
              </span>
            </div>
            {purchases.length > 25 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Hay {purchases.length} compras disponibles; cada envío admite hasta 25 compras por lote. Puedes enviar las primeras 25 y luego el resto.
              </p>
            )}
            <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {purchases.map(row => {
                const selected = selectedPurchases[row.id] !== undefined;
                const product = productsById.get(row.productId);
                const maxAllowed = row.quantity;
                const requested = Number(selectedPurchases[row.id] || 0);
                const exceedsStore = selected && product && requested > product.stock;
                return (
                  <div key={row.id} className={`flex flex-wrap items-center justify-between gap-3 p-3 transition-colors ${selected ? 'bg-accent/5' : ''}`}>
                    <label className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer">
                      <input type="checkbox" disabled={busy || !!pending.current} checked={selected} onChange={event => {
                        const checked = event.target.checked;
                        setSelectedPurchases(previous => {
                          const next = { ...previous };
                          if (checked) next[row.id] = String(row.quantity);
                          else delete next[row.id];
                          return next;
                        });
                      }} className="h-4 w-4 rounded text-accent" />
                      {product?.imageUrl && <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{row.productName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {row.quantity} compradas
                          {row.supplier ? ` · ${row.supplier}` : ''}
                          {row.createdAt ? ` · ${new Date(row.createdAt).toLocaleDateString('es-CO')}` : ''}
                          {product ? ` · Tienda: ${product.stock} · Bodega: ${product.warehouseUnits ?? 0}` : ''}
                        </p>
                        {exceedsStore && (
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Supera el stock actual en tienda ({product.stock} uds).
                          </p>
                        )}
                      </div>
                    </label>
                    {selected && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Enviar:</span>
                        <input type="number" min={1} max={maxAllowed} step={1} required
                          aria-label={`Unidades para bodega de ${row.productName}`}
                          className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-center font-bold" disabled={busy || !!pending.current}
                          value={selectedPurchases[row.id]} onChange={event => setSelectedPurchases({ ...selectedPurchases, [row.id]: event.target.value })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                El stock se descontará de Tienda y pasará a Bodega en una sola operación segura.
              </p>
              <button disabled={busy || !!pending.current || store.warehouseSendEnabled === false || !selectedPurchaseList.length}
                className="rounded-xl bg-accent px-5 py-3 font-black text-white shadow-md disabled:opacity-50">
                Confirmar envío
              </button>
            </div>
          </form>
        )}
        {tab === 'history' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Últimos 30 días · 25 movimientos por página</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Filtrar producto, responsable o nota..."
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-accent"
                />
                <select
                  value={historyDirection}
                  onChange={e => setHistoryDirection(e.target.value as 'all' | 'toWarehouse' | 'toStore')}
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="all">Todas las direcciones</option>
                  <option value="toWarehouse">Tienda → Bodega</option>
                  <option value="toStore">Bodega → Tienda</option>
                </select>
                <button type="button" disabled={busy || !!pending.current} onClick={() => run(() => loadHistory('history'))} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700">
                  Actualizar
                </button>
              </div>
            </div>
            {!busy && !filteredHistory.length && <p className="text-sm text-slate-500 py-4 text-center">{history.length ? 'Ningún movimiento cargado coincide con el filtro.' : 'No hay movimientos en este período.'}</p>}
            {!!filteredHistory.length && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="block w-full text-left text-sm md:table">
                  <thead className="hidden bg-slate-100 dark:bg-slate-800 md:table-header-group text-xs uppercase text-slate-500">
                    <tr>{['Fecha', 'Producto', 'Unidades', 'Dirección', 'Responsable', 'Detalle'].map(label => <th key={label} className="px-3 py-2.5">{label}</th>)}</tr>
                  </thead>
                  <tbody className="block divide-y divide-slate-200 dark:divide-slate-700 md:table-row-group">
                    {filteredHistory.map(row => (
                      <tr key={row.id} className="flex flex-wrap items-center py-2 px-2 md:table-row md:py-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="w-full px-3 py-1 text-xs text-slate-500 md:w-auto md:py-2.5 md:whitespace-nowrap">{new Date(row.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
                        <td className="w-full px-3 py-1 font-bold md:w-auto md:py-2.5">
                          <div>{row.productName}</div>
                          {row.purchaseIds?.length ? <span className="text-[10px] font-bold text-indigo-500 uppercase">Desde Compras</span> : null}
                        </td>
                        <td className="px-3 py-1 font-black md:py-2.5">{row.quantity}<span className="md:hidden"> uds.</span></td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${row.direction === 'toWarehouse' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                            {row.direction === 'toWarehouse' ? 'Tienda → Bodega' : 'Bodega → Tienda'}
                          </span>
                        </td>
                        <td className="px-3 py-1 text-xs font-semibold md:py-2.5">{row.actorName}</td>
                        <td className="w-full px-3 py-1 md:w-auto md:py-2.5">
                          <details>
                            <summary className="cursor-pointer text-xs font-bold text-accent">{row.reversedBy ? 'Revertido' : row.reversalOf ? 'Reversión' : 'Ver detalle'}</summary>
                            <div className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              <p>Tienda {row.localBefore} → {row.localAfter} · Bodega {row.warehouseBefore} → {row.warehouseAfter}</p>
                              {row.note && <p className="break-words italic">“{row.note}”</p>}
                              {row.reversedBy && <p className="text-amber-600">Revertido · {row.reversedBy}</p>}
                              {row.reversalOf && <p className="text-indigo-500">Reversión de {row.reversalOf}</p>}
                              {isAdmin && !row.reversedBy && !row.reversalOf && (
                                <button type="button" disabled={busy || !!pending.current} className="mt-1 text-accent font-bold underline" onClick={() => {
                                  if (window.confirm('¿Revertir este movimiento? Se verificará el stock disponible.')) void run(async () => {
                                    await write({ action: 'reverse', movementId: row.id });
                                    await loadHistory('history');
                                  });
                                }}>Revertir movimiento</button>
                              )}
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {tab === 'counts' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Historial de conteos y ajustes de bodega</p>
              <button type="button" disabled={busy || !!pending.current} onClick={() => run(() => loadHistory('counts'))} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                Actualizar
              </button>
            </div>
            {!busy && !history.length && <p className="text-sm text-slate-500 py-4 text-center">Aún no hay conteos guardados de bodega.</p>}
            <div className="space-y-2">
              {history.map(row => (
                <div key={row.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="font-bold text-xs text-slate-600 dark:text-slate-300">
                      {new Date(row.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {row.actorName}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${row.isApplied ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {row.isApplied ? 'Ajuste aplicado' : 'Solo conteo'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {row.verification.map((v: any) => (
                      <div key={v.categoryId} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs">
                        <p className="font-bold">{categoryName(v.categoryId)}</p>
                        <p className="text-slate-500">
                          Sistema: <strong>{v.systemStock}</strong> · Físico: <strong>{v.physicalCount}</strong> · Dif:{' '}
                          <strong className={v.difference === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                            {v.difference > 0 ? `+${v.difference}` : v.difference}
                          </strong>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {(tab === 'history' || tab === 'counts') && cursor && <button type="button" disabled={busy} className="px-4 py-2 rounded-xl bg-accent/10 text-accent font-bold text-sm" onClick={() => run(() => loadHistory(tab, true))}>Cargar más</button>}
      </div>
    </>;
  if (embedded) return content;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Bodega de ${store.name}`} className="fixed inset-0 z-[20000] bg-black/60 flex items-center justify-center p-2 sm:p-5">
      <div className={`bg-white dark:bg-secondary rounded-2xl shadow-2xl w-full ${mode === 'history' || mode === 'counts' ? 'max-w-7xl' : 'max-w-4xl'} max-h-[95dvh] flex flex-col p-4 sm:p-5`}>
        {content}
      </div>
    </div>
  );
}
