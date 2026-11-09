import React, { useState } from 'react';
import type { Store } from '../types';
import { callWarehouse } from '../services/warehouse';

export default function WarehouseSettingsDialog({ companyId, store, onClose }: {
  companyId: string;
  store: Store;
  onClose: () => void;
}) {
  const [sendDraft, setSendDraft] = useState<boolean | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<boolean | null>(null);
  const sendEnabled = store.warehouseSendEnabled !== false;
  const categoryVisible = store.warehouseCategoryVisible !== false;
  const hasChanges = sendDraft !== null || categoryDraft !== null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !hasChanges) return;
    setSaving(true);
    setError('');
    try {
      await callWarehouse(companyId, store.id, {
        action: 'settings',
        ...(sendDraft !== null ? { sendEnabled: sendDraft } : {}),
        ...(categoryDraft !== null ? { categoryVisible: categoryDraft } : {}),
      });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="warehouse-settings-title" className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl bg-white dark:bg-secondary p-5 space-y-4">
        <div>
          <h2 id="warehouse-settings-title" className="text-lg font-bold text-accent">Configurar bodega</h2>
          <p className="text-sm text-gray-500">{store.name}</p>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
          <span>Permitir enviar a bodega desde POS y Compras</span>
          <input type="checkbox" role="switch" checked={sendDraft ?? sendEnabled} disabled={saving} onChange={event => setSendDraft(event.target.checked === sendEnabled ? null : event.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
          <span>Mostrar categoría Bodega en el POS</span>
          <input type="checkbox" role="switch" checked={categoryDraft ?? categoryVisible} disabled={saving} onChange={event => setCategoryDraft(event.target.checked === categoryVisible ? null : event.target.checked)} />
        </label>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="px-3 py-2">Cancelar</button>
          <button disabled={saving || !hasChanges} className="rounded-lg bg-accent px-3 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}
