import React, { useEffect, useRef, useState } from 'react';
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
  mode?: 'count' | 'move' | 'history' | 'purchase';
  embedded?: boolean;
  purchases?: Purchase[];
  onPurchasesMoved?: (ids: string[]) => void;
  movement?: { productId: string; direction: WarehouseDirection };
  api?: typeof callWarehouse;
};
const inputClass = 'w-full rounded-lg p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700';
export default function WarehousePanel({ userId, companyId, store, inventory, categories, isAdmin, onClose, mode = 'count', movement, embedded, purchases = [], onPurchasesMoved, api = callWarehouse }: Props) {
  const [tab, setTab] = useState<string>(mode), [rows, setRows] = useState<any[]>([]), [counts, setCounts] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<any[]>([]), [category, setCategory] = useState(''), [detailCursor, setDetailCursor] = useState<string | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<any[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const direction = movement?.direction || 'toWarehouse';
  const productId = movement?.productId || '';
  const [units, setUnits] = useState(''), [note, setNote] = useState('');
  const [selectedPurchases, setSelectedPurchases] = useState<Record<string, string>>({});
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
    setBusy(true);
    try {
      pending.current = loadWarehousePending(storageKey);
      setStorageReady(true);
    } catch {
      setError('No se pudo recuperar la operación pendiente de bodega.');
    }
    const load = mode === 'history' ? loadHistory('history') : refresh();
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
  const products = inventory.filter(p => p.storeId === store.id && (p.companyId || 'default_company') === companyId && !p.isDisabled);
  const categoryName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const saveCount = () => run(async () => {
    const entries = rows.filter(r => counts[r.id] !== undefined && counts[r.id] !== '').map(entry);
    if (!entries.length || entries.some(e => !Number.isSafeInteger(e.physicalCount) || e.physicalCount < 0)) throw new Error('Ingresa cantidades enteras mayores o iguales a cero.');
    await write({ action: 'count', entries, productCounts });
    if (alive.current) { setMessage('Conteo de bodega guardado. Las diferencias quedan para revisión.'); setCounts({}); setProductCounts({}); }
  });
  const content = <>
      {!embedded && (
        <div className="flex justify-between gap-3 items-center mb-3">
          <h2 className="font-bold text-xl text-accent">
            {mode === 'history' ? 'Movimientos de bodega' : mode === 'purchase' ? 'Enviar compras a bodega' : 'Bodega'} · {store.name}
          </h2>
          <button disabled={busy} onClick={onClose}>Cerrar</button>
        </div>
      )}
      {mode === 'count' && isAdmin && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" disabled={busy || !!pending.current} aria-pressed={tab === 'count'} onClick={() => setTab('count')} className="rounded-lg bg-accent/10 p-2 text-accent">Conteo de bodega</button>
          <button type="button" disabled={busy || !!pending.current} aria-pressed={tab === 'counts'} onClick={() => run(() => loadHistory('counts'))} className="rounded-lg bg-accent/10 p-2 text-accent">Conteos guardados</button>
        </div>
      )}
      {pending.current && <button disabled={busy} className="p-2 rounded-lg bg-amber-100 text-amber-900" onClick={() => run(async () => { const payload = JSON.parse(pending.current!.signature);
        const result = await write(payload);
        if (payload.action === 'purchaseMove' && Array.isArray(result.purchaseIds) && alive.current) onPurchasesMoved?.(result.purchaseIds);
        await refresh(); setCounts({}); setProductCounts({}); setUnits(''); setMessage('Operación pendiente confirmada. No se volvió a duplicar el movimiento.'); })}>Resolver operación pendiente</button>}
      {error && <p role="alert" className="text-red-500 mb-2">{error}</p>}{message && <p role="status" className="text-green-600 mb-2">{message}</p>}
      {busy && <p role="status">Procesando…</p>}
      <div className="overflow-y-auto min-h-0 space-y-3">
        {tab === 'count' && <>
          <div className="flex justify-between gap-2"><p>Cuenta las unidades por categoría. Abre el ojo para revisar marcas y prendas.</p><button disabled={busy || !!pending.current} onClick={() => run(async () => { await refresh(); setCounts({}); setProductCounts({}); setDetails([]); setCategory(''); })}>Actualizar</button></div>
          <VerificationCountTable
            rows={rows.map(row => ({ id: row.id, name: categoryName(row.id), totalStock: row.stock }))}
            counts={counts}
            showSystem
            disabled={busy || !!pending.current}
            status={!rows.length ? (busy ? 'Cargando bodega…' : 'No hay mercancía registrada en esta bodega.') : undefined}
            onCountChange={(id, value) => setCounts(previous => ({ ...previous, [id]: value }))}
            onOpenDetails={id => run(() => loadDetails(id))}
          />
          {category && <section className="border rounded-lg p-3"><h3 className="font-bold">Marcas y prendas · {categoryName(category)}</h3>{details.map(p => <label key={p.id} className="grid grid-cols-2 gap-2 py-1"><span>{products.find(local => local.id === p.id)?.supplier || p.supplier || 'Sin marca'} · {products.find(local => local.id === p.id)?.name || p.name} · Sistema: {p.stock}</span><input className={inputClass} aria-label={`Contar ${p.name}`} type="number" min="0" step="1" disabled={busy || !!pending.current} value={productCounts[p.id] ?? ''} onChange={e => setProductCounts(old => { const next = { ...old }; if (e.target.value === '') delete next[p.id]; else next[p.id] = Number(e.target.value); return next; })}/></label>)}{detailCursor && <button disabled={busy} onClick={() => run(() => loadDetails(category, true))}>Más prendas</button>}
            <div className="flex flex-wrap gap-3 mt-3"><button disabled={busy || !!pending.current} onClick={() => { if (detailCursor || details.some(p => !Number.isSafeInteger(productCounts[p.id]) || productCounts[p.id] < 0)) { setError('Carga y cuenta todas las prendas de la categoría para sumar.'); return; } setCounts({ ...counts, [category]: String(details.reduce((sum,p) => sum + productCounts[p.id],0)) }); }}>Usar suma en categoría</button><button disabled={busy} onClick={() => run(async () => { const row = rows.find(r => r.id === category); if (!row || counts[category] === undefined || counts[category] === '') throw new Error('Indica el total de la categoría antes de guardar el borrador.'); await write({ action: 'draftSave', entries: [entry(row)], productCounts: Object.fromEntries(details.filter(p => productCounts[p.id] !== undefined).map(p => [p.id,productCounts[p.id]])) }); setMessage('Borrador de bodega guardado.'); })}>Guardar borrador</button>{isAdmin && <button disabled={busy} onClick={() => { if (detailCursor || details.some(p => !Number.isSafeInteger(productCounts[p.id]) || productCounts[p.id] < 0)) { setError('Carga y cuenta todas las prendas antes de aplicar un ajuste.'); return; } if (!window.confirm('¿Aplicar ajuste solo a las existencias de bodega de estas prendas?')) return; void run(async () => { const row = rows.find(r => r.id === category); await write({ action: 'adjust', entries: [{ categoryId: category, revision: row.revision || 0, physicalCount: details.reduce((sum,p) => sum + productCounts[p.id],0) }], productCounts: Object.fromEntries(details.map(p => [p.id,productCounts[p.id]])) }); await refresh(); setDetails([]); setCategory(''); setCounts({}); setProductCounts({}); setMessage('Ajuste de bodega registrado.'); }); }}>Aplicar ajuste por productos</button>}</div>
          </section>}
          <button className="p-3 rounded-lg bg-accent text-white" disabled={busy || !rows.length} onClick={saveCount}>Guardar conteo de bodega</button>
        </>}
        {tab === 'move' && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => { const n = Number(units); if (!productId || !Number.isSafeInteger(n) || n < 1) throw new Error('Selecciona prenda y cantidad entera positiva.'); await write({ action: 'move', direction, productId, quantity: n, note }); if (!alive.current) return; setUnits(''); setNote(''); setMessage('Movimiento confirmado y registrado.'); await refresh(); }); }}>
          <p className="font-semibold">{direction === 'toWarehouse' ? 'Tienda → Bodega' : 'Bodega → Tienda'}</p>
          {products.filter(product => product.id === productId).map(product => (
            <div key={product.id} className="flex items-center gap-3">
              {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="h-20 w-16 object-cover rounded-lg" />}
              <div><p className="font-bold">{product.name}</p><p>{product.supplier}</p><p>Tienda: {product.stock} · Bodega: {product.warehouseUnits ?? 0}</p></div>
            </div>
          ))}
          <label className="block">Unidades<input className={inputClass} disabled={busy || !!pending.current} required type="number" min="1" step="1" value={units} onChange={e => setUnits(e.target.value)}/></label>
          <label className="block">Nota opcional<input className={inputClass} disabled={busy || !!pending.current} maxLength={500} value={note} onChange={e => setNote(e.target.value)}/></label><button disabled={busy} className="p-3 bg-accent text-white rounded-lg">Confirmar movimiento físico</button>
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
            <p className="text-sm">Selecciona hasta 25 compras de esta sede e indica cuántas unidades enviar.</p>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {purchases.map(row => {
                const selected = selectedPurchases[row.id] !== undefined;
                return (
                  <div key={row.id} className="flex items-center justify-between gap-3 py-2">
                    <label className="flex min-w-0 items-center gap-2">
                      <input type="checkbox" disabled={busy || !!pending.current} checked={selected} onChange={event => {
                        const checked = event.target.checked;
                        setSelectedPurchases(previous => {
                          const next = { ...previous };
                          if (checked) next[row.id] = String(row.quantity);
                          else delete next[row.id];
                          return next;
                        });
                      }} />
                      <span>{row.productName} · {row.quantity} compradas</span>
                    </label>
                    {selected && <input type="number" min={1} max={row.quantity} step={1} required
                      aria-label={`Unidades para bodega de ${row.productName}`}
                      className="w-20 rounded border bg-transparent p-2" disabled={busy || !!pending.current}
                      value={selectedPurchases[row.id]} onChange={event => setSelectedPurchases({ ...selectedPurchases, [row.id]: event.target.value })} />}
                  </div>
                );
              })}
            </div>
            <button disabled={busy || !!pending.current || store.warehouseSendEnabled === false || !Object.keys(selectedPurchases).length}
              className="rounded-lg bg-accent p-3 text-white disabled:opacity-50">Confirmar envío</button>
          </form>
        )}
        {tab === 'history' && (
          <>
            <p className="text-sm text-gray-500">Últimos 30 días · 25 movimientos por página</p>
            {!busy && !history.length && <p>No hay movimientos en este período.</p>}
            {!!history.length && (
              <div className="overflow-x-auto">
                <table className="block w-full text-left text-sm md:table">
                  <thead className="hidden bg-slate-100 dark:bg-slate-800 md:table-header-group">
                    <tr>{['Fecha', 'Producto', 'Unidades', 'Dirección', 'Responsable', 'Detalle'].map(label => <th key={label} className="px-2 py-2">{label}</th>)}</tr>
                  </thead>
                  <tbody className="block divide-y divide-slate-200 dark:divide-slate-700 md:table-row-group">
                    {history.map(row => (
                      <tr key={row.id} className="flex flex-wrap items-center py-2 md:table-row md:py-0">
                        <td className="w-full px-2 py-1 text-gray-500 md:w-auto md:py-2 md:text-inherit md:whitespace-nowrap">{new Date(row.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
                        <td className="w-full px-2 py-1 font-semibold md:w-auto md:py-2">{row.productName}</td>
                        <td className="px-2 py-1 md:py-2">{row.quantity}<span className="md:hidden"> uds.</span></td>
                        <td className="px-2 py-2 whitespace-nowrap">{row.direction === 'toWarehouse' ? 'Tienda → Bodega' : 'Bodega → Tienda'}</td>
                        <td className="px-2 py-1 md:py-2">{row.actorName}</td>
                        <td className="w-full px-2 py-1 md:w-auto md:py-2">
                          <details>
                            <summary className="cursor-pointer text-accent">{row.reversedBy ? 'Revertido' : row.reversalOf ? 'Reversión' : 'Ver detalle'}</summary>
                            <p>Tienda {row.localBefore} → {row.localAfter} · Bodega {row.warehouseBefore} → {row.warehouseAfter}</p>
                            {row.note && <p className="break-words">{row.note}</p>}
                            {row.reversedBy && <p>Revertido · {row.reversedBy}</p>}
                            {row.reversalOf && <p>Reversión de {row.reversalOf}</p>}
                            {isAdmin && !row.reversedBy && !row.reversalOf && (
                              <button disabled={busy || !!pending.current} className="text-accent" onClick={() => {
                                if (window.confirm('¿Revertir este movimiento? Se verificará el stock disponible.')) void run(async () => {
                                  await write({ action: 'reverse', movementId: row.id });
                                  await loadHistory('history');
                                });
                              }}>Revertir movimiento</button>
                            )}
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
        {tab === 'counts' && history.map(row => (
          <div key={row.id} className="border rounded-lg p-3 text-sm">
            <p>{new Date(row.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {row.actorName}</p>
            {row.verification.map((v: any) => <p key={v.categoryId}>{categoryName(v.categoryId)} · Sistema: {v.systemStock} · Físico: {v.physicalCount} · Diferencia: {v.difference}</p>)}
          </div>
        ))}
        {(tab === 'history' || tab === 'counts') && cursor && <button disabled={busy} onClick={() => run(() => loadHistory(tab, true))}>Cargar más</button>}
      </div>
    </>;
  if (embedded) return content;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Bodega de ${store.name}`} className="fixed inset-0 z-[20000] bg-black/60 flex items-center justify-center p-2 sm:p-5">
      <div className={`bg-white dark:bg-secondary rounded-xl w-full ${mode === 'history' ? 'max-w-7xl' : 'max-w-4xl'} max-h-[95dvh] flex flex-col p-4`}>
        {content}
      </div>
    </div>
  );
}
