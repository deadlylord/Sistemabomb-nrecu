import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { toTitleCase } from '../constants';

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  onSave: (customerId: string, newName: string, newPhone: string) => void;
}

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({ isOpen, onClose, customer, onSave }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert("El nombre y el celular no pueden estar vacíos.");
      return;
    }
    if (phone.trim().length !== 10) {
      alert("El celular debe tener 10 dígitos numéricos.");
      return;
    }
    onSave(customer.id, toTitleCase(name), phone);
    onClose();
  };
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPhone = e.target.value.replace(/[^0-9]/g, '');
    if (newPhone.length <= 10) {
        setPhone(newPhone);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-accent mb-6">Editar Cliente</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre</label>
            <input
              type="text"
              id="customerName"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Celular (10 dígitos)</label>
            <input
              type="tel"
              id="customerPhone"
              value={phone}
              onChange={handlePhoneChange}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              required
              maxLength={10}
            />
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCustomerModal;