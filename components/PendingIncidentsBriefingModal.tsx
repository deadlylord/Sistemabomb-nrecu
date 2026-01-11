
import React, { useMemo } from 'react';
import { Incident, IncidentStatus, IncidentType, View, Layaway } from '../types';
import { CrossIcon, AlertTriangleIcon, SparklesIcon, TruckIcon, SwapIcon, ShieldCheckIcon } from './Icons';

interface PendingIncidentsBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  layaways: Layaway[];
  onNavigate: (view: View) => void;
}

const PendingIncidentsBriefingModal: React.FC<PendingIncidentsBriefingModalProps> = ({ isOpen, onClose, incidents, layaways, onNavigate }) => {
  const pendingByStatus = useMemo(() => {
    return {
      damaged: incidents.filter(i => i.status === IncidentStatus.DAÑADO_REPORTADO),
      exchange: incidents.filter(i => i.status === IncidentStatus.CAMBIO_SOLICITADO),
      transfer: incidents.filter(i => i.status === IncidentStatus.TRASLADO_SOLICITADO),
      warranty: incidents.filter(i => i.status === IncidentStatus.WARRANTY_ACTIVE),
      preOrders: layaways.filter(l => l.status === 'pre-order'),
    };
  }, [incidents, layaways]);

  // FIX: Explicitly type the accumulator 'sum' as number and cast 'list' to any[] to resolve 'unknown' type error from Object.values.
  const totalPending = Object.values(pendingByStatus).reduce((sum: number, list) => sum + (list as any[]).length, 0);

  if (!isOpen || totalPending === 0) return null;

  const handleNavigateToIncidents = () => {
    onNavigate(View.INCIDENTS);
    onClose();
  };

  const handleNavigateToLayaways = () => {
    onNavigate(View.LAYAWAY);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-2 sm:p-4 animate-fade-in backdrop-blur-md">
      <div className="bg-white dark:bg-secondary rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden border border-accent/20 flex flex-col max-h-[95vh] relative">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-accent to-purple-600 p-5 sm:p-6 text-white relative flex-shrink-0">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors active:scale-90 z-10"
            aria-label="Cerrar"
          >
            <CrossIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-white/20 rounded-xl">
              <AlertTriangleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold leading-tight">¡Atención!</h2>
              <p className="text-white/80 text-xs sm:text-sm font-medium">Tareas pendientes por gestionar</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Tienes un total de <span className="font-bold text-accent">{totalPending}</span> tareas que requieren tu atención hoy:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {pendingByStatus.preOrders.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <TruckIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Abonos por Traer (Encargos)</span>
                </div>
                <span className="bg-yellow-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{pendingByStatus.preOrders.length}</span>
              </div>
            )}

            {pendingByStatus.warranty.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
                <div className="flex items-center gap-3">
                  <ShieldCheckIcon className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Garantías Activas</span>
                </div>
                <span className="bg-orange-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{pendingByStatus.warranty.length}</span>
              </div>
            )}

            {pendingByStatus.exchange.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <SwapIcon className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Cambios Solicitados</span>
                </div>
                <span className="bg-blue-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{pendingByStatus.exchange.length}</span>
              </div>
            )}

            {pendingByStatus.damaged.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Prendas Dañadas</span>
                </div>
                <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{pendingByStatus.damaged.length}</span>
              </div>
            )}

            {pendingByStatus.transfer.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                <div className="flex items-center gap-3">
                  <TruckIcon className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Traslados Pendientes</span>
                </div>
                <span className="bg-purple-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{pendingByStatus.transfer.length}</span>
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-col gap-3 flex-shrink-0">
            {pendingByStatus.preOrders.length > 0 && (
              <button
                onClick={handleNavigateToLayaways}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-yellow-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <TruckIcon className="w-5 h-5" />
                Ver Encargos por Traer
              </button>
            )}
            
            <button
              onClick={handleNavigateToIncidents}
              className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <SparklesIcon className="w-5 h-5" />
              Ver Novedades de Prendas
            </button>
            
            <button
              onClick={onClose}
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm active:scale-95"
            >
              Revisar más tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingIncidentsBriefingModal;
