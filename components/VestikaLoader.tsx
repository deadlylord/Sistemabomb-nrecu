import React from 'react';

/** Indicador unificado para esperas de módulos y operaciones. */
export default function VestikaLoader({ fullScreen = false, compact = false }: { fullScreen?: boolean; compact?: boolean }) {
  return (
    <div role="status" aria-label="Cargando" className={`flex items-center justify-center ${fullScreen ? 'min-h-screen bg-slate-50 dark:bg-slate-950' : compact ? 'min-h-20' : 'min-h-[220px] sm:min-h-[300px]'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={`relative flex items-center justify-center ${compact ? 'w-16 h-16' : 'w-24 h-24'}`}>
          <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-slate-700 border-t-sky-400 border-r-violet-500 animate-spin" />
          <img src="/assets/vestika.png" alt="" className={`rounded-2xl object-contain ${compact ? 'w-10 h-10' : 'w-16 h-16'}`} />
        </div>
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
