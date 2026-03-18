
import React from 'react';
import { CrossIcon, AlertTriangleIcon } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-secondary w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-scale-in">
        <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-lg font-black text-gray-800 dark:text-text-light uppercase tracking-widest flex items-center gap-2">
            {isDanger ? <AlertTriangleIcon className="w-5 h-5 text-red-500" /> : null}
            {title}
          </h3>
          <button onClick={onCancel} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-8">
          <p className="text-gray-600 dark:text-gray-400 font-medium text-center text-lg">
            {message}
          </p>
        </div>
        
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl font-black text-gray-500 uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 ${isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-accent hover:bg-accent-hover shadow-accent/20'} text-white rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
