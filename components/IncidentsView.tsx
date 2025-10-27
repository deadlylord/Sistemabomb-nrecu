import React, { useState, useMemo } from 'react';
// FIX: Added 'Customer' type import to support the new 'customers' prop.
import { Incident, IncidentStatus, IncidentType, Product, Seller, Role, Sale, Store, Customer } from '../types';
import { PlusCircleIcon, CheckIcon, SwapIcon, SearchIcon, EditIcon, TrashIcon, CrossIcon } from './Icons';
import CreateIncidentModal from './CreateIncidentModal';
import { formatCOP } from '../constants';
import EditIncidentModal from './EditIncidentModal';
import EditExchangeIncidentModal from './EditExchangeIncidentModal';

interface IncidentsViewProps {
  incidents: Incident[];
  inventory: Product[];
  currentUser: Seller;
  roles: Role[];
  sales: Sale[];
  stores: Store[];
  // FIX: Added 'customers' prop to pass customer data down to child components.
  customers: Customer[];
  onCreateIncident: (data: Omit<Incident, 'id' | 'status' | 'createdAt' | 'storeId' | 'sellerName'> & { surplusPaid?: number; incidentDate?: string; }) => void;
  onApproveIncident: (incidentId: string) => void;
  onResolveIncident: (incidentId: string) => void;
  onUpdateIncident: (incident: Incident) => void;
  onDeleteIncident: (incidentId: string) => void;
}

const IncidentsView: React.FC<IncidentsViewProps> = ({ incidents, inventory, currentUser, roles, sales, stores, customers, onCreateIncident, onApproveIncident, onResolveIncident, onUpdateIncident, onDeleteIncident }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditExchangeModalOpen, setIsEditExchangeModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [filter, setFilter] = useState<IncidentStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const adminRole = useMemo(() => roles.find(r => r.name === 'Administrator'), [roles]);
  const isAdmin = useMemo(() => currentUser.roleId === adminRole?.id, [currentUser, adminRole]);

  const filteredIncidents = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return [...incidents]
      .filter(i => {
        const matchesStatus = filter === 'ALL' ? true : i.status === filter;
        
        const matchesSearch = lowerCaseSearchTerm ? 
            i.description.toLowerCase().includes(lowerCaseSearchTerm) ||
            (i.productName && i.productName.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (i.customerName && i.customerName.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (i.customerPhone && i.customerPhone.includes(lowerCaseSearchTerm)) ||
            (i.originalSaleInvoiceNumber && i.originalSaleInvoiceNumber.includes(lowerCaseSearchTerm))
            : true;
            
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [incidents, filter, searchTerm]);
  
  const handleEditClick = (incident: Incident) => {
    setEditingIncident(incident);
    if (isAdmin && incident.type === IncidentType.PRODUCT_EXCHANGE) {
        setIsEditExchangeModalOpen(true);
    } else {
        setIsEditModalOpen(true);
    }
  };

  const getStoreName = (storeId?: string) => {
    if (!storeId) return 'N/A';
    return stores.find(s => s.id === storeId)?.name || 'Desconocido';
  }

  const getStatusPill = (status: IncidentStatus) => {
    const baseClasses = "px-3 py-1 text-xs font-bold rounded-full";
    switch (status) {
        case IncidentStatus.REGISTRADO: return `${baseClasses} bg-gray-500/20 text-gray-300`;
        case IncidentStatus.DAÑADO_REPORTADO: return `${baseClasses} bg-yellow-500/20 text-yellow-300`;
        case IncidentStatus.CAMBIO_SOLICITADO: return `${baseClasses} bg-yellow-500/20 text-yellow-300`;
        case IncidentStatus.TRASLADO_SOLICITADO: return `${baseClasses} bg-yellow-500/20 text-yellow-300`;
        case IncidentStatus.EN_ARREGLO_CAMBIO: return `${baseClasses} bg-blue-500/20 text-blue-300`;
        case IncidentStatus.DEVUELTO_Y_RESUELTO: return `${baseClasses} bg-green-500/20 text-green-300`;
        case IncidentStatus.CAMBIO_PROCESADO: return `${baseClasses} bg-green-500/20 text-green-300`;
        case IncidentStatus.TRASLADO_COMPLETADO: return `${baseClasses} bg-green-500/20 text-green-300`;
        case IncidentStatus.WARRANTY_ACTIVE: return `${baseClasses} bg-orange-500/20 text-orange-300 animate-pulse`;
        case IncidentStatus.WARRANTY_RETURNED: return `${baseClasses} bg-green-500/20 text-green-300`;
        default: return `${baseClasses} bg-gray-500/20 text-gray-300`;
    }
  };
  
  const getDaysRemainingText = (deadline?: string) => {
      if (!deadline) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(deadline);
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return <span className="text-red-400 font-bold">Vencido por {Math.abs(diffDays)} día(s)</span>;
      if (diffDays === 0) return <span className="text-red-400 font-bold">Vence Hoy</span>;
      if (diffDays <= 3) return <span className="text-yellow-400 font-bold">Vence en {diffDays} día(s)</span>;
      return <span className="text-gray-400">Vence en {diffDays} día(s)</span>;
  };

  const renderIncidentDetails = (incident: Incident) => {
      // FIX: Removed incorrect property access and implemented logic using the correct data structure.
      switch(incident.type) {
          case IncidentType.DAMAGED:
              return <p className="font-bold">{incident.productName || 'Producto no especificado'}</p>;
          case IncidentType.WARRANTY:
               return (
                  <div>
                    <p className="font-bold">{incident.productName}</p>
                    <p className="text-xs text-gray-400">Cliente: {incident.customerName} ({incident.customerPhone})</p>
                  </div>
              );
          case IncidentType.CASH_ADJUSTMENT:
              return (
                  <p className={`font-bold ${incident.adjustmentType === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                    {incident.adjustmentType === 'income' ? '+' : '-'}
                    {formatCOP(incident.adjustmentAmount || 0)}
                  </p>
              );
          case IncidentType.RECAUDO:
            return (
                <div>
                    <p className="font-bold text-green-500">
                        +{formatCOP(incident.adjustmentAmount || 0)}
                    </p>
                    <p className="text-xs text-gray-400">Cliente: {incident.customerName} ({incident.customerPhone})</p>
                </div>
            );
          case IncidentType.PRODUCT_EXCHANGE:
              const returnedProductNames = incident.returnedItems?.map(item => `${item.productName} (x${item.quantity})`).join(', ') || 'N/A';
              const takenProductNames = incident.takenItems?.map(item => `${item.productName} (x${item.quantity})`).join(', ') || 'N/A';
              return (
                  <div>
                    <p className="text-xs text-red-500">Devuelve: {returnedProductNames}</p>
                    <p className="text-xs text-green-500">Lleva: {takenProductNames}</p>
                    <p className="text-xs text-gray-400">Factura Orig: #{incident.originalSaleInvoiceNumber}</p>
                  </div>
              );
          case IncidentType.INVENTORY_TRANSFER_REQUEST:
              return (
                <div>
                    <p className="font-bold">{incident.quantity} x {incident.productName}</p>
                    <p className="text-xs text-gray-400">Desde: {getStoreName(incident.fromStoreId)} → Hacia: {getStoreName(incident.toStoreId)}</p>
                </div>
              )
          default:
              return null;
      }
  }

  return (
    <>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b-2 border-accent/30 pb-2 gap-4">
            <h2 className="text-2xl font-bold text-accent">Gestión de Novedades</h2>
            <button onClick={() => setIsCreateModalOpen(true)} className="bg-accent text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover self-end sm:self-center">
              <PlusCircleIcon />
              <span>Crear Novedad</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
               <input
                type="text"
                placeholder="Buscar por producto, cliente, factura..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              />
              <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400">
                <SearchIcon />
              </div>
              {searchTerm && (
                <button
                    onClick={() => setSearchTerm('')}
                    className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    aria-label="Limpiar búsqueda"
                >
                    <CrossIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value as any)} className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2">
              <option value="ALL">Todos los Estados</option>
              {Object.values(IncidentStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="p-3 text-sm font-semibold">Fecha</th>
                  <th className="p-3 text-sm font-semibold">Tipo</th>
                  <th className="p-3 text-sm font-semibold">Detalles</th>
                  <th className="p-3 text-sm font-semibold">Descripción</th>
                  <th className="p-3 text-sm font-semibold">Vendedor</th>
                  <th className="p-3 text-sm font-semibold text-center">Estado</th>
                  <th className="p-3 text-sm font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredIncidents.map((incident) => {
                  const canBeApproved = isAdmin && [
                    IncidentStatus.DAÑADO_REPORTADO,
                    IncidentStatus.CAMBIO_SOLICITADO,
                    IncidentStatus.TRASLADO_SOLICITADO,
                  ].includes(incident.status);

                  const canBeResolved = [
                      IncidentStatus.EN_ARREGLO_CAMBIO,
                      IncidentStatus.WARRANTY_ACTIVE,
                  ].includes(incident.status);

                  return (
                  <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="p-3 text-sm whitespace-nowrap">{new Date(incident.createdAt).toLocaleString()}</td>
                    <td className="p-3 text-sm font-bold text-accent">{incident.type}</td>
                    <td className="p-3 text-sm">{renderIncidentDetails(incident)}</td>
                    <td className="p-3 text-sm text-gray-600 dark:text-text-dark max-w-xs truncate" title={incident.description}>{incident.description}</td>
                    <td className="p-3 text-sm">{incident.sellerName}</td>
                    <td className="p-3 text-center">
                        <div className="flex flex-col items-center">
                            <span className={getStatusPill(incident.status)}>{incident.status}</span>
                            {incident.type === IncidentType.WARRANTY && incident.deadline && getDaysRemainingText(incident.deadline)}
                        </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center items-center space-x-1">
                        {canBeApproved && (
                           <button onClick={() => onApproveIncident(incident.id)} className="text-green-500 hover:text-green-400 p-2 rounded-full hover:bg-green-500/10 transition-colors" title="Aprobar y Procesar">
                              <CheckIcon />
                            </button>
                        )}
                        {canBeResolved && (
                            <button onClick={() => onResolveIncident(incident.id)} className="text-blue-500 hover:text-blue-400 p-2 rounded-full hover:bg-blue-500/10 transition-colors" title={incident.status === IncidentStatus.WARRANTY_ACTIVE ? "Marcar como Devuelta" : "Marcar como Resuelto"}>
                              <SwapIcon />
                            </button>
                        )}
                        <button onClick={() => handleEditClick(incident)} className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors" title="Editar Novedad">
                          <EditIcon />
                        </button>
                        {isAdmin && (
                            <button onClick={() => onDeleteIncident(incident.id)} className="text-red-500 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors" title="Eliminar Novedad">
                                <TrashIcon />
                            </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isCreateModalOpen && (
        <CreateIncidentModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            inventory={inventory}
            sales={sales}
            stores={stores}
            currentUser={currentUser}
            roles={roles}
            customers={customers}
            onCreateIncident={onCreateIncident}
        />
      )}
      {isEditModalOpen && editingIncident && (
          <EditIncidentModal 
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            incident={editingIncident}
            onUpdateIncident={onUpdateIncident}
            isAdmin={isAdmin}
          />
      )}
      {isEditExchangeModalOpen && editingIncident && (
          <EditExchangeIncidentModal
            isOpen={isEditExchangeModalOpen}
            onClose={() => setIsEditExchangeModalOpen(false)}
            incident={editingIncident}
            inventory={inventory}
            sales={sales}
            onUpdateIncident={onUpdateIncident}
          />
      )}
    </>
  );
};

export default IncidentsView;
