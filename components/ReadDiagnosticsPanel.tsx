import React, { useState, useSyncExternalStore } from 'react';
import { clearReadMeasurement, setReadContext, getReadDiagnostics, startReadMeasurement, stopReadMeasurement, subscribeReadDiagnostics } from '../services/readDiagnostics';

export default function ReadDiagnosticsPanel({ available, loginMode = false }: { available: boolean; loginMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(loginMode ? 'Ingreso al POS' : 'Abrir conciliación');
  const value = useSyncExternalStore(subscribeReadDiagnostics, getReadDiagnostics);
  if (!available) return null;
  const active = value.session?.active;
  const sums = value.rows.reduce((a, r) => ({ requests: a.requests + r.requests, server: a.server + r.serverChanges,
    cache: a.cache + r.cacheChanges, pending: a.pending + r.pendingChanges, errors: a.errors + r.errors }), { requests: 0, server: 0, cache: 0, pending: 0, errors: 0 });
  const exportResult = () => {
    const blob = new Blob([JSON.stringify({ ...value, note: 'Observaciones del cliente, no lecturas facturadas. No incluye Cloud Functions, reglas ni entradas de índice. Los eventos de solo metadatos que el SDK no entrega no se cuentan.' }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `vestika-medicion-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <button type="button" onClick={() => setOpen(true)} className={`read-diagnostics-trigger fixed right-3 top-16 z-[30000] rounded-full px-3 py-2 text-xs font-bold shadow-lg ${active ? 'bg-amber-300 text-slate-950' : 'bg-slate-800 text-white'}`}>
      {active ? '● Midiendo · Ver / detener' : loginMode ? 'Medir ingreso' : 'Medir consultas'}
    </button>
    {open && <div className="fixed inset-0 z-[31000] bg-black/60 p-3 sm:p-6 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Medición de consultas">
      <div className="w-full max-w-5xl max-h-[90dvh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 sm:p-6 space-y-4">
        <div className="flex justify-between gap-4 items-center"><h2 className="text-lg font-bold">Medición de consultas</h2><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2">Cerrar</button></div>
        <p className="text-sm">{loginMode ? 'Inicia la medición antes de pulsar Ingresar. Entra al POS, espera a que cargue y abre el medidor para detener y descargar el resultado. La medición continúa después del login.' : 'Inicia, cierra este panel, realiza una sola acción y vuelve a detener la medición. Repite la misma acción para comparar.'} Los contadores se guardan únicamente en esta pestaña.</p>
        <p className="text-xs text-slate-500">Son cambios de documentos observados por la app, no lecturas facturadas. No incluye trabajo del servidor, reglas ni entradas de índice. Los eventos de solo metadatos pueden no aparecer. El tamaño del resultado no es el costo de la consulta.</p>
        <label className="block text-sm">Acción a medir<input maxLength={100} value={label} onChange={e => setLabel(e.target.value)} disabled={!!active} className="mt-1 block w-full rounded-lg border p-2 text-slate-900" /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!active} onClick={() => { if (loginMode) setReadContext({ view: 'Login', companyId: '', storeId: '' }); startReadMeasurement(label); setOpen(false); }} className="rounded-lg bg-indigo-600 text-white px-4 py-2 disabled:opacity-40">Iniciar medición</button>
          <button type="button" disabled={!active} onClick={stopReadMeasurement} className="rounded-lg bg-amber-300 text-slate-950 px-4 py-2 disabled:opacity-40">Detener</button>
          <button type="button" disabled={!value.session || !!active} onClick={exportResult} className="rounded-lg border px-4 py-2 disabled:opacity-40">Descargar resultado</button>
          <button type="button" disabled={!!active} onClick={clearReadMeasurement} className="rounded-lg border px-4 py-2 disabled:opacity-40">Limpiar</button>
        </div>
        {value.session && <>
          <p className="text-sm font-semibold">{value.session.label} · {active ? 'En curso' : 'Finalizada'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {[['Solicitudes puntuales', sums.requests], ['Cambios desde servidor', sums.server], ['Cambios desde caché', sums.cache], ['Listeners abiertos', value.session.listenerStarts]].map(([name, n]) => <div key={name} className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3"><div className="text-xs">{name}</div><strong className="text-lg">{Number(n).toLocaleString('es-CO')}</strong></div>)}
          </div>
          <p className="text-xs">Listeners ya registrados al iniciar: {value.session.initialListeners}. Registrados ahora: {value.activeListeners}. Intentos de transacción observados: {value.session.transactionAttempts}. Errores: {sums.errors}. Cambios locales pendientes: {sums.pending}.</p>
          {!!value.session.droppedGroups && <p className="text-sm text-amber-700">Resultado parcial: se alcanzó el límite de 500 grupos. Haz una medición más corta.</p>}
          <section className="space-y-2" aria-label="Tiempos de la operación">
            <h3 className="font-bold">Tiempos de la operación</h3>
            <p className="text-xs text-slate-500">El tiempo de ingreso termina al verificar el acceso y actualizar el estado; las consultas posteriores siguen registrándose hasta detener la medición. No mide el dibujo de la pantalla. La transacción completa incluye la confirmación de Firebase. Sus etapas están incluidas dentro del total: no sumes todas las filas. El tiempo fuera del callback incluye arranque, posibles reintentos y confirmación; no es una medición exclusiva del servidor. La confirmación en cliente termina al actualizar el estado del formulario, no al dibujarse la pantalla ni al terminar los resúmenes del servidor.</p>
            {value.timings.length === 0 ? <p className="text-sm">Todavía no se registraron etapas. Inicia la medición antes de ingresar o guardar y espera a que termine la carga antes de detenerla.</p> : <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr>{['Etapa', 'Inicio en sesión', 'Duración', 'Estado'].map(t => <th key={t} className="p-2 border-b">{t}</th>)}</tr></thead><tbody>{value.timings.map(t => <tr key={t.id}><td className="p-2 border-b">{t.phase}</td><td className="p-2 border-b">{(t.startOffsetMs / 1000).toFixed(2)} s</td><td className="p-2 border-b">{t.status === 'running' ? 'En curso' : `${(t.durationMs / 1000).toFixed(2)} s`}</td><td className="p-2 border-b">{{ running: 'En curso', success: 'Completado', error: 'Error', incomplete: 'Incompleto: se detuvo antes de terminar' }[t.status]}{t.errorCode && <div className="font-mono text-red-700">{t.errorCode}</div>}</td></tr>)}</tbody></table></div>}
            {!!value.session.droppedTimings && <p className="text-sm text-amber-700">Tiempos parciales: se alcanzó el límite de 200 etapas.</p>}
          </section>
          <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr>{['Pantalla / recurso', 'Operación', 'Solicitudes', 'Servidor', 'Caché', 'Mayor resultado'].map(t => <th key={t} className="p-2 border-b">{t}</th>)}</tr></thead>
            <tbody>{value.rows.map((r, i) => <tr key={i}><td className="p-2 border-b"><strong>{r.view}</strong><div>{r.resource}</div></td><td className="p-2 border-b">{r.operation}</td><td className="p-2 border-b">{r.requests}</td><td className="p-2 border-b">{r.serverChanges}</td><td className="p-2 border-b">{r.cacheChanges}</td><td className="p-2 border-b">{r.largestResult}</td></tr>)}</tbody></table></div>
          <p className="text-xs text-slate-500">La pantalla indica el contexto activo; una consulta global puede incluir varias sedes. Los documentos eliminados de un resultado no se suman como cambios recibidos. Las solicitudes con errores o resultados vacíos también pueden tener costo.</p>
        </>}
      </div>
    </div>}
  </>;
}
