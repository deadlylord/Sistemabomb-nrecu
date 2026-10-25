import React, { useState } from 'react';
import { measurementInvitationUrl, setMeasurementVisibility, useMeasurementVisibility } from '../services/diagnosticsVisibility';
export default function MeasurementSettings() {
  const enabled = useMeasurementVisibility();
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  return <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3" aria-label="Configuración de medición">
    <h2 className="font-bold">Medición de consultas e ingreso</h2>
    <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={enabled} onChange={event => setMeasurementVisibility(event.target.checked)} />Mostrar botón de medición en este dispositivo</label>
    <p className="text-sm text-slate-500">Se aplica al login y al POS de este navegador. No inicia una medición ni activa el botón para todos los usuarios.</p>
    <button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={async () => {
      const value = measurementInvitationUrl(); setLink(value); setCopied(false);
      try { await navigator.clipboard.writeText(value); setCopied(true); } catch {}
    }}>Compartir enlace para medir el ingreso</button>
    {link && <div className="space-y-2"><p className="text-sm">{copied ? 'Enlace copiado.' : 'Copia este enlace.'} Quien lo abra verá el botón durante esa pestaña. Debe iniciar y detener la medición manualmente.</p><input aria-label="Enlace de medición" readOnly value={link} onFocus={event => event.target.select()} className="w-full rounded-lg border p-2 text-sm text-slate-900" /></div>}
  </section>;
}
