import React, { useState, useEffect } from 'react';
import { Incident, IncidentStatus, IncidentType } from '../types';
import { formatCOP } from '../constants';

interface EditIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident;
  onUpdateIncident: (incident: Incident) => void;
  isAdmin: boolean;
}

const EditIncidentModal: React.FC<EditIncidentModalProps> = ({ isOpen, onClose, incident, onUpdateIncident, isAdmin }) => {
  const [description, setDescription] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [status, setStatus] = useState<IncidentStatus>(incident.status);

  useEffect(() => {
    if (incident) {
      setDescription(incident.description);
      const incidentDate = new Date(incident.createdAt);
      // Adjust for local timezone offset to display correctly in the input
      incidentDate.setMinutes(incidentDate.getMinutes() - incidentDate.getTimezoneOffset());
      setCreatedAt(incidentDate.toISOString().slice(0, 16));
      setAdjustmentAmount(incident.adjustmentAmount ? incident.adjustmentAmount.toString() : '');
      setStatus(incident.status);
    }
  }, [incident]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert("La descripción no puede estar vacía.");
      return;
    }
    
    const { adjustmentAmount: oldAmount, ...restOfIncident } = incident;

    const updatedIncident: Incident = {
      ...restOfIncident,
      description,
      createdAt: new Date(createdAt).toISOString(),
      status,
    };
    
    if (incident.type === IncidentType.RECAUDO || incident.type === IncidentType.CASH_ADJUSTMENT) {
        const newAmount = parseFloat(adjustmentAmount);
        if (isNaN(newAmount) || newAmount < 0) {
            alert('El monto ingresado no es válido.');
            return;
        }
        updatedIncident.adjustmentAmount = newAmount;
    } else if (oldAmount !== undefined) {
        updatedIncident.adjustmentAmount = oldAmount;
    }
    
    onUpdateIncident(updatedIncident);
    onClose();
  };
  
  const renderReadOnlyDetails = () => {
      const isEditableAmount = incident.type === IncidentType.RECAUDO || incident.type === IncidentType.CASH_ADJUSTMENT;

      return (
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md text-sm space-y-1">
            <p><strong>Tipo:</strong> {incident.type}</p>
            {incident.productName && <p><strong>Producto:</strong> {incident.productName}</p>}
            {incident.customerName && <p><strong>Cliente:</strong> {incident.customerName} ({incident.customerPhone})</p>}
            {incident.adjustmentAmount && !isEditableAmount && <p><strong>Monto:</strong> {formatCOP(incident.adjustmentAmount)} ({incident.adjustmentType})</p>}
            {incident.originalSaleInvoiceNumber && <p><strong>Factura Original:</strong> #{incident.originalSaleInvoiceNumber}</p>}
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold text-accent mb-4">Editar Novedad</h2>
        
        <form onSubmit={handleSubmit} id="incident-form" className="flex-grow overflow-y-auto pr-2 space-y-4">
            {renderReadOnlyDetails()}
            {isAdmin && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">
                  Estado (Admin)
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={e => setStatus(e.target.value as IncidentStatus)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                >
                  {Object.values(IncidentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {(incident.type === IncidentType.RECAUDO || incident.type === IncidentType.CASH_ADJUSTMENT) && (
              <div>
                <label htmlFor="adjustmentAmount" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">
                  Monto del {incident.type === IncidentType.RECAUDO ? 'Recaudo' : 'Ajuste'}
                </label>
                <input
                  type="number"
                  id="adjustmentAmount"
                  value={adjustmentAmount}
                  onChange={e => setAdjustmentAmount(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  required
                  min="0"
                  step="1"
                />
              </div>
            )}
          <div>
            <label htmlFor="createdAt" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">
              Fecha de la Novedad
            </label>
            <input
              type="datetime-local"
              id="createdAt"
              value={createdAt}
              onChange={e => setCreatedAt(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">
              Descripción / Motivo
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              required
            ></textarea>
          </div>
        </form>

        <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="incident-form" onClick={handleSubmit} className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditIncidentModal;