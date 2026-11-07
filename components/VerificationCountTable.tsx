import React from 'react';
import { CheckIcon, CrossIcon, EyeIcon } from './Icons';

interface Props {
  rows: { id: string; name: string; totalStock: number }[];
  counts: Record<string, string>;
  showSystem: boolean;
  disabled?: boolean;
  status?: string | null;
  onCountChange: (id: string, value: string) => void;
  onOpenDetails?: (id: string) => void;
}

export default function VerificationCountTable({ rows, counts, showSystem, disabled, status, onCountChange, onOpenDetails }: Props) {
  return (
    <table className="w-full text-left">
      <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 rounded-xl overflow-hidden">
        <tr>
          <th className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Categoría</th>
          {onOpenDetails && <th className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Detalle</th>}
          <th className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Conteo Físico</th>
          <th className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Estado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {status && (
          <tr><td colSpan={onOpenDetails ? 4 : 3} className="p-6 text-center text-sm text-gray-500" role="status">
            {status}
          </td></tr>
        )}
        {!status && rows.map(category => {
          const physicalCountStr = counts[category.id];
          const physicalCount = physicalCountStr !== undefined && physicalCountStr !== '' ? Number(physicalCountStr) : null;
          const difference = physicalCount !== null ? physicalCount - category.totalStock : null;
          return (
            <tr key={category.id} className="hover:bg-accent/5 transition-colors h-16 group">
              <td className="p-2">
                  <p className="font-black text-sm uppercase tracking-tight text-gray-700 dark:text-gray-200">{category.name}</p>
                  {showSystem && (
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Sist: {category.totalStock}</p>
                  )}
              </td>
              {onOpenDetails && (
                <td className="p-2 text-center">
                    <button type="button" aria-label={`Verificar marcas ${category.name}`} disabled={disabled} onClick={() => onOpenDetails?.(category.id)} className="p-2.5 text-accent bg-accent/10 rounded-xl hover:bg-accent hover:text-white transition-all shadow-sm" title="Verificar por marca / producto"><EyeIcon className="w-5 h-5" /></button>
                </td>
              )}
              <td className="p-2 text-center">
                <input type="number" min="0" value={counts[category.id] || ''} aria-label={`Conteo ${category.name}`} disabled={disabled} onChange={event => onCountChange(category.id, event.target.value)} className="w-20 bg-white dark:bg-gray-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2 text-center font-black text-base focus:ring-2 focus:ring-accent focus:border-accent outline-none shadow-inner" placeholder="0" />
              </td>
              <td className="p-2 text-center">
                 <div className="flex justify-center">
                     {physicalCount !== null ? (
                         difference === 0 ? (
                             <span className="text-green-500 bg-green-500/10 p-2 rounded-full" title="Correcto"><CheckIcon className="w-5 h-5" /></span>
                         ) : (
                             <span className="text-red-500 bg-red-500/10 p-2 rounded-full" title="Error en conteo"><CrossIcon className="w-5 h-5" /></span>
                         )
                     ) : <span className="text-gray-300 dark:text-gray-700">--</span>}
                 </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
