
import React from 'react';
import { APP_VERSIONS } from '../constants';
import { CrossIcon, SparklesIcon, HistoryIcon } from './Icons';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 animate-fade-in backdrop-blur-md" onClick={onClose}>
      <div className="bg-white dark:bg-secondary rounded-2xl shadow-2xl w-full max-w-lg border border-accent/20 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 bg-gradient-to-r from-accent to-purple-600 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/20 rounded-lg">
                <HistoryIcon className="w-6 h-6 text-white" />
             </div>
             <div>
                <h2 className="text-xl font-bold">Historial de Progreso</h2>
                <p className="text-white/70 text-[10px] font-medium uppercase tracking-widest">Evolución del Sistema</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-90" aria-label="Cerrar historial">
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {APP_VERSIONS.map((v, index) => (
            <div key={v.version} className="relative pl-8">
              {/* Timeline Connector */}
              {index !== APP_VERSIONS.length - 1 && (
                <div className="absolute left-3 top-7 bottom-[-32px] w-0.5 bg-gray-200 dark:bg-gray-700"></div>
              )}
              
              {/* Timeline Bullet */}
              <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 flex items-center justify-center z-10 ${v.isCurrent ? 'bg-accent border-accent/30 shadow-[0_0_10px_rgb(var(--color-accent))]' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                {v.isCurrent && <SparklesIcon className="w-3 h-3 text-white" />}
              </div>

              <div className={`p-4 rounded-xl border transition-all ${v.isCurrent ? 'bg-accent/5 border-accent/30 shadow-lg shadow-accent/5' : 'bg-gray-50 dark:bg-gray-800/40 border-transparent'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-black text-lg ${v.isCurrent ? 'text-accent' : 'text-gray-800 dark:text-gray-200'}`}>
                    Versión {v.version}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{v.date}</span>
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{v.description}</p>
                <ul className="space-y-2">
                  {v.changes.map((change, cIdx) => (
                    <li key={cIdx} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent/40 flex-shrink-0"></span>
                      {change}
                    </li>
                  ))}
                </ul>
                {v.isCurrent && (
                    <div className="mt-4 pt-3 border-t border-accent/10">
                        <span className="px-2 py-0.5 bg-accent text-white text-[9px] font-black rounded uppercase tracking-tighter">Versión Actual Instalada</span>
                    </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800 text-center flex-shrink-0">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sistema POS Multisede • Cloud Edition</p>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;
