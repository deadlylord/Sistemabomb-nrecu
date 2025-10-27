
import React, { useState } from 'react';
import { UploadIcon } from './Icons';

interface BulkImportCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customers: { name: string; phone: string }[]) => void;
}

const BulkImportCustomersModal: React.FC<BulkImportCustomersModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [bulkData, setBulkData] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    setError(null);
    const lines = bulkData.trim().split('\n');
    const customers: { name: string; phone: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',').map(p => p.trim());
        if (parts.length !== 2) {
            setError(`Error en la línea ${i + 1}: Se esperan 2 campos (Nombre,Celular), pero se encontraron ${parts.length}.`);
            return;
        }

        const [name, phone] = parts;

        if (!name || !phone) {
            setError(`Error en la línea ${i + 1}: El nombre y el celular no pueden estar vacíos.`);
            return;
        }

        const numericPhone = phone.replace(/[^0-9]/g, '');
        if (numericPhone.length !== 10) {
            setError(`Error en la línea ${i + 1}: El celular '${phone}' debe tener 10 dígitos numéricos.`);
            return;
        }

        customers.push({ name, phone: numericPhone });
    }

    if (customers.length === 0) {
        setError("No se encontraron clientes para agregar. Asegúrate de que el formato sea correcto.");
        return;
    }

    onConfirm(customers);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold text-accent mb-4">Carga Masiva de Clientes</h2>
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md text-sm mb-4">
            <p className="font-semibold">Instrucciones:</p>
            <p>Pega los datos de los clientes, un cliente por línea, con los campos separados por comas.</p>
            <p className="font-mono text-xs mt-1">Formato: Nombre,Celular (10 dígitos)</p>
            <p className="font-mono text-xs">Ejemplo: Ana Perez,3001234567</p>
        </div>
        
        <div className="flex-grow overflow-y-auto space-y-4">
            <div>
                <label htmlFor="bulkData" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Datos de Clientes</label>
                <textarea
                    id="bulkData"
                    value={bulkData}
                    onChange={e => setBulkData(e.target.value)}
                    rows={10}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-mono text-sm"
                    placeholder="Pega aquí los clientes..."
                />
            </div>
        </div>
        
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors flex items-center space-x-2">
            <UploadIcon />
            <span>Importar Clientes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImportCustomersModal;
