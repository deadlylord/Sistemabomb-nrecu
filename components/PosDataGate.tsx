import React from 'react';
import type { PosDataStatus, PosSecondaryCollection } from '../services/posData';

export function PosModalLoading({ onClose, error }: { onClose: () => void; error?: string | null }) {
  return <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-sm w-full" role={error ? 'alert' : 'status'}>
      <p>{error || 'Cargando datos de la tienda activa…'}</p>
      <button type="button" onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700">Cerrar</button>
    </div>
  </div>;
}

export function PosDataGate({ names, status, onClose, children }: React.PropsWithChildren<{
  names: PosSecondaryCollection[]; status?: PosDataStatus; onClose: () => void;
}>) {
  const error = names.map(name => status?.[name]?.error).find(Boolean);
  if (error || names.some(name => status?.[name]?.loading)) return <PosModalLoading onClose={onClose} error={error} />;
  return <>{children}</>;
}
