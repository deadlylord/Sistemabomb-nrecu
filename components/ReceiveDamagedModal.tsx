import React, { useRef, useState } from 'react';
import { type Incident, type Product } from '../types';
import { normalizeText } from '../constants';

export default function ReceiveDamagedModal({ incident, inventory, canReplace, onReceive, onClose }: {
  incident: Incident;
  inventory: Product[];
  canReplace: boolean;
  onReceive: (incidentId: string, productId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [different, setDifferent] = useState(false);
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const eligible = inventory.filter(p => !p.isDisabled && p.storeId === incident.storeId);
  const chosen = eligible.find(p => p.id === (different ? productId : incident.productId));
  const matches = eligible.filter(p => p.id !== incident.productId && normalizeText(`${p.name} ${p.sku || ''}`).includes(normalizeText(query))).slice(0, 40);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current || !chosen) return;
    pending.current = true; setSaving(true); setError('');
    try { await onReceive(incident.id, chosen.id); onClose(); }
    catch (error: any) { setError(error.message || 'No se pudo registrar la recepción. Intenta de nuevo.'); }
    finally { pending.current = false; setSaving(false); }
  };

  return <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="receive-damaged-title">
    <form onSubmit={submit} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 space-y-4 text-slate-900 dark:text-white">
      <h2 id="receive-damaged-title" className="text-xl font-bold text-accent">Recibir prenda</h2>
      <p className="text-sm">Prenda enviada: <strong>{incident.productName}</strong></p>
      {canReplace && <div className="flex flex-wrap gap-3 text-sm">
        <label><input type="radio" checked={!different} disabled={saving} onChange={() => { setDifferent(false); setError(''); }} /> Volvió la misma</label>
        <label><input type="radio" checked={different} disabled={saving} onChange={() => { setDifferent(true); setError(''); }} /> Llegó otra prenda</label>
      </div>}
      {different && <div className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor="received-product-search">Buscar la prenda recibida</label>
        <input id="received-product-search" value={query} disabled={saving} onChange={e => setQuery(e.target.value)} placeholder="Nombre o código de la prenda" className="w-full rounded-lg p-3 border border-slate-300 dark:border-slate-700 bg-transparent" />
        <div className="max-h-48 overflow-y-auto space-y-1">
          {matches.map(p => <button type="button" key={p.id} disabled={saving} aria-pressed={productId === p.id} onClick={() => setProductId(p.id)} className={`w-full p-3 rounded-lg border text-left text-sm ${productId === p.id ? 'border-accent bg-accent/10' : 'border-slate-200 dark:border-slate-700'}`}><span className="font-semibold">{p.name}</span><span className="block text-xs text-slate-500">{p.sku || 'Sin código'} · Stock actual: {p.stock}</span></button>)}
          {!matches.length && <p className="text-sm text-slate-500">No hay coincidencias. Si la prenda es nueva, regístrala en el inventario con stock 0 antes de recibirla aquí.</p>}
        </div>
      </div>}
      {chosen ? <p className="rounded-lg bg-accent/10 p-3 text-sm">Se sumará <strong>1 unidad a {chosen.name}</strong>. {different && 'La prenda enviada permanece descontada.'}</p> : <p className="text-sm text-slate-500">Selecciona una prenda activa del inventario de esta sede.</p>}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700">Cancelar</button><button type="submit" disabled={saving || !chosen} className="px-4 py-2 rounded-lg bg-accent text-white font-semibold disabled:opacity-50">{saving ? 'Guardando…' : 'Confirmar recepción'}</button></div>
    </form>
  </div>;
}
