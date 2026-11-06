import React, { useEffect, useRef, useState } from 'react';
import { Category, Product, Store } from '../types';
import { EyeIcon } from './Icons';
import { loadWarehousePending, saveWarehousePending, warehousePendingKey } from '../services/warehousePending';
import { callWarehouse } from '../services/warehouse';

type Props = { userId: string; companyId: string; store: Store; inventory: Product[]; categories: Category[]; isAdmin: boolean; onClose: () => void; api?: typeof callWarehouse };
const inputClass = 'w-full rounded-lg p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700';
export default function WarehousePanel({ userId, companyId, store, inventory, categories, isAdmin, onClose, api = callWarehouse }: Props) {
  const [tab, setTab] = useState('count'), [rows, setRows] = useState<any[]>([]), [counts, setCounts] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<any[]>([]), [category, setCategory] = useState(''), [detailCursor, setDetailCursor] = useState<string | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<any[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [direction, setDirection] = useState('toWarehouse'), [productId, setProductId] = useState(''), [units, setUnits] = useState(''), [note, setNote] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const storageKey = warehousePendingKey(companyId, store.id, userId);
  const submitting = useRef(false), pending = useRef<{ signature: string; operationId: string } | null>(null), alive = useRef(true);
  const call = (data: Record<string, unknown>) => api(companyId, store.id, data);
  const refresh = async () => { const result = await call({ action: 'summary' }); if (alive.current) { setRows(result.rows); setCounts({}); setProductCounts({}); setDetails([]); setCategory(''); } };
  useEffect(() => { alive.current = true; setBusy(true); try { pending.current = loadWarehousePending(storageKey); setStorageReady(true); } catch { setError('No se pudo recuperar la operación pendiente de bodega.'); } refresh().catch(e => { if (alive.current) setError(e.message); }).finally(() => { if (alive.current) setBusy(false); }); return () => { alive.current = false; }; }, [companyId, store.id]);
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
  return <div role="dialog" aria-modal="true" aria-label={`Bodega de ${store.name}`} className="fixed inset-0 z-[20000] bg-black/60 flex items-center justify-center p-2 sm:p-5">
    <div className="bg-white dark:bg-secondary rounded-xl w-full max-w-4xl max-h-[95dvh] flex flex-col p-4">
      <div className="flex justify-between gap-3 items-center"><h2 className="font-bold text-xl text-accent">Bodega · {store.name}</h2><button disabled={busy} onClick={onClose}>Cerrar</button></div>
      <div className="flex flex-wrap gap-2 my-3">{[['count','Conteo de bodega'],['move','Mover mercancía'],['history','Movimientos'],['counts','Conteos guardados']].map(([id,label]) => <button disabled={busy || !!pending.current} key={id} className={`rounded-lg p-2 ${tab === id ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800'}`} onClick={() => id === 'history' || id === 'counts' ? run(() => loadHistory(id)) : setTab(id)}>{label}</button>)}</div>
      {pending.current && <button disabled={busy} className="p-2 rounded-lg bg-amber-100 text-amber-900" onClick={() => run(async () => { await write(JSON.parse(pending.current!.signature)); await refresh(); setCounts({}); setProductCounts({}); setUnits(''); setMessage('Operación pendiente confirmada. No se volvió a duplicar el movimiento.'); })}>Resolver operación pendiente</button>}
      {error && <p role="alert" className="text-red-500 mb-2">{error}</p>}{message && <p role="status" className="text-green-600 mb-2">{message}</p>}
      {busy && <p role="status">Procesando…</p>}
      <div className="overflow-y-auto min-h-0 space-y-3">
        {tab === 'count' && <>
          <div className="flex justify-between gap-2"><p>Cuenta las unidades por categoría. Abre el ojo para revisar marcas y prendas.</p><button disabled={busy || !!pending.current} onClick={() => run(async () => { await refresh(); setCounts({}); setProductCounts({}); setDetails([]); setCategory(''); })}>Actualizar</button></div>
          <table className="w-full text-left"><thead><tr><th>Categoría</th><th>Sistema</th><th>Físico</th><th>Diferencia</th><th>Detalle</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{categoryName(row.id)}</td><td>{row.stock}</td><td><input aria-label={`Conteo ${categoryName(row.id)}`} disabled={busy || !!pending.current} className={inputClass} type="number" min="0" step="1" value={counts[row.id] ?? ''} onChange={e => setCounts({ ...counts, [row.id]: e.target.value })}/></td><td>{counts[row.id] !== undefined && counts[row.id] !== '' ? Number(counts[row.id]) - row.stock : '—'}</td><td><button aria-label={`Verificar marcas ${categoryName(row.id)}`} disabled={busy || !!pending.current} onClick={() => run(() => loadDetails(row.id))}><EyeIcon className="w-5 h-5 text-accent" /></button></td></tr>)}</tbody></table>
          {!rows.length && !busy && <p>No hay mercancía registrada en esta bodega. Usa Mover mercancía para enviarla desde el local.</p>}
          {category && <section className="border rounded-lg p-3"><h3 className="font-bold">Marcas y prendas · {categoryName(category)}</h3>{details.map(p => <label key={p.id} className="grid grid-cols-2 gap-2 py-1"><span>{products.find(local => local.id === p.id)?.supplier || p.supplier || 'Sin marca'} · {products.find(local => local.id === p.id)?.name || p.name} · Sistema: {p.stock}</span><input className={inputClass} aria-label={`Contar ${p.name}`} type="number" min="0" step="1" disabled={busy || !!pending.current} value={productCounts[p.id] ?? ''} onChange={e => setProductCounts(old => { const next = { ...old }; if (e.target.value === '') delete next[p.id]; else next[p.id] = Number(e.target.value); return next; })}/></label>)}{detailCursor && <button disabled={busy} onClick={() => run(() => loadDetails(category, true))}>Más prendas</button>}
            <div className="flex flex-wrap gap-3 mt-3"><button disabled={busy || !!pending.current} onClick={() => { if (detailCursor || details.some(p => !Number.isSafeInteger(productCounts[p.id]) || productCounts[p.id] < 0)) { setError('Carga y cuenta todas las prendas de la categoría para sumar.'); return; } setCounts({ ...counts, [category]: String(details.reduce((sum,p) => sum + productCounts[p.id],0)) }); }}>Usar suma en categoría</button><button disabled={busy} onClick={() => run(async () => { const row = rows.find(r => r.id === category); if (!row || counts[category] === undefined || counts[category] === '') throw new Error('Indica el total de la categoría antes de guardar el borrador.'); await write({ action: 'draftSave', entries: [entry(row)], productCounts: Object.fromEntries(details.filter(p => productCounts[p.id] !== undefined).map(p => [p.id,productCounts[p.id]])) }); setMessage('Borrador de bodega guardado.'); })}>Guardar borrador</button>{isAdmin && <button disabled={busy} onClick={() => { if (detailCursor || details.some(p => !Number.isSafeInteger(productCounts[p.id]) || productCounts[p.id] < 0)) { setError('Carga y cuenta todas las prendas antes de aplicar un ajuste.'); return; } if (!window.confirm('¿Aplicar ajuste solo a las existencias de bodega de estas prendas?')) return; void run(async () => { const row = rows.find(r => r.id === category); await write({ action: 'adjust', entries: [{ categoryId: category, revision: row.revision || 0, physicalCount: details.reduce((sum,p) => sum + productCounts[p.id],0) }], productCounts: Object.fromEntries(details.map(p => [p.id,productCounts[p.id]])) }); await refresh(); setDetails([]); setCategory(''); setCounts({}); setProductCounts({}); setMessage('Ajuste de bodega registrado.'); }); }}>Aplicar ajuste por productos</button>}</div>
          </section>}
          <button className="p-3 rounded-lg bg-accent text-white" disabled={busy || !rows.length} onClick={saveCount}>Guardar conteo de bodega</button>
        </>}
        {tab === 'move' && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => { const n = Number(units); if (!productId || !Number.isSafeInteger(n) || n < 1) throw new Error('Selecciona prenda y cantidad entera positiva.'); await write({ action: 'move', direction, productId, quantity: n, note }); if (!alive.current) return; setUnits(''); setNote(''); setMessage('Movimiento confirmado y registrado.'); await refresh(); }); }}>
          <label className="block">Dirección<select className={inputClass} disabled={busy || !!pending.current} value={direction} onChange={e => setDirection(e.target.value)}><option value="toWarehouse">Tienda → Bodega</option><option value="toStore">Bodega → Tienda</option></select></label>
          <label className="block">Prenda<select className={inputClass} disabled={busy || !!pending.current} value={productId} onChange={e => setProductId(e.target.value)}><option value="">Selecciona una prenda</option>{products.map(p => <option key={p.id} value={p.id}>{p.supplier || ''} · {p.name} · Local: {p.stock}</option>)}</select></label>
          <label className="block">Unidades<input className={inputClass} disabled={busy || !!pending.current} required type="number" min="1" step="1" value={units} onChange={e => setUnits(e.target.value)}/></label>
          <label className="block">Nota opcional<input className={inputClass} disabled={busy || !!pending.current} maxLength={500} value={note} onChange={e => setNote(e.target.value)}/></label><button disabled={busy} className="p-3 bg-accent text-white rounded-lg">Confirmar movimiento físico</button>
        </form>}
        {(tab === 'history' || tab === 'counts') && <>{history.map(row => <div key={row.id} className="border rounded-lg p-3 text-sm"><p>{new Date(row.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {row.actorName}</p>{tab === 'history' ? <><strong>{row.direction === 'toWarehouse' ? 'Envío a bodega' : 'Regreso a tienda'} · {row.quantity} × {row.productName}</strong><p>Local: {row.localBefore} → {row.localAfter} · Bodega: {row.warehouseBefore} → {row.warehouseAfter}</p><p>{row.note}</p>{row.reversedBy && <p>Revertido · {row.reversedBy}</p>}{row.reversalOf && <p>Reversión de {row.reversalOf}</p>}{isAdmin && !row.reversedBy && !row.reversalOf && <button disabled={busy} onClick={() => { if (window.confirm('¿Revertir este movimiento? Se verificará el stock disponible.')) void run(async () => { await write({ action: 'reverse', movementId: row.id }); await refresh(); await loadHistory('history'); }); }}>Revertir movimiento</button>}</> : row.verification.map((v:any) => <p key={v.categoryId}>{categoryName(v.categoryId)} · Sistema: {v.systemStock} · Físico: {v.physicalCount} · Diferencia: {v.difference}</p>)}</div>)}{cursor && <button disabled={busy} onClick={() => run(() => loadHistory(tab,true))}>Cargar más</button>}</>}
      </div>
    </div>
  </div>;
}
