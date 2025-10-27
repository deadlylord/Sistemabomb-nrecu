

import React, { useState, useMemo } from 'react';
import { Sale, Layaway, Customer } from '../types';
import { SearchIcon, UserPlusIcon, CrossIcon } from './Icons';
import { formatCOP } from '../constants';
import BulkImportCustomersModal from './BulkImportCustomersModal';

interface CustomersViewProps {
  sales: Sale[];
  layaways: Layaway[];
  allCustomers: Customer[];
  onBulkAddCustomers: (customers: { name: string, phone: string }[]) => void;
}

const CustomerCard: React.FC<{ customer: Customer; sales: Sale[]; layaways: Layaway[] }> = ({ customer, sales, layaways }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const customerSales = useMemo(() => {
    return sales
        .filter(s => s.customerName === customer.name && s.customerPhone === customer.phone)
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, customer]);

  const customerLayaways = useMemo(() => {
    return layaways
        .filter(l => l.customerName === customer.name && l.customerPhone === customer.phone)
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [layaways, customer]);

  const totalSpent = useMemo(() => {
    const salesTotal = customerSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const layawaysTotal = customerLayaways.reduce((sum, l) => sum + l.paidAmount, 0);
    return salesTotal + layawaysTotal;
  }, [customerSales, customerLayaways]);


  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 transition-all duration-300">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">{customer.name}</h3>
          <p className="text-sm text-gray-500 dark:text-text-dark">{customer.phone}</p>
        </div>
        <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-text-dark">Total Comprado</p>
            <p className="font-bold text-xl text-accent">{formatCOP(totalSpent)}</p>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700 space-y-4">
          {customerSales.length > 0 && (
            <div>
              <h4 className="font-bold text-accent mb-2">Historial de Compras</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {customerSales.map(sale => (
                  <div key={sale.id} className="bg-white dark:bg-secondary p-3 rounded-md">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="font-semibold">Factura #{sale.invoiceNumber}</span>
                      <span className="text-gray-500 dark:text-text-dark">{new Date(sale.createdAt).toLocaleDateString()}</span>
                    </div>
                    <ul className="list-disc list-inside text-sm">
                      {sale.items.map(item => (
                        <li key={item.id}>
                          {item.name} <span className="text-xs text-gray-400">({item.supplier || 'N/A'})</span> (x{item.quantity}) - {formatCOP(item.price)}
                        </li>
                      ))}
                    </ul>
                    <p className="text-right font-bold mt-2">Total: {formatCOP(sale.totalAmount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customerLayaways.length > 0 && (
            <div>
              <h4 className="font-bold text-accent mb-2">Historial de Abonos</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                 {customerLayaways.map(layaway => (
                  <div key={layaway.id} className="bg-white dark:bg-secondary p-3 rounded-md">
                    <div className="flex justify-between items-center text-sm mb-2">
                       <span className="font-semibold">Abono #{layaway.invoiceNumber}</span>
                       <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${layaway.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>{layaway.status.toUpperCase()}</span>
                       <span className="text-gray-500 dark:text-text-dark">{new Date(layaway.createdAt).toLocaleDateString()}</span>
                    </div>
                    <ul className="list-disc list-inside text-sm">
                      {layaway.items.map(item => (
                        <li key={item.id}>
                          {item.name} <span className="text-xs text-gray-400">({item.supplier || 'N/A'})</span> (x{item.quantity}) - {formatCOP(item.price)}
                        </li>
                      ))}
                    </ul>
                    <p className="text-right font-bold mt-2">Abonado: {formatCOP(layaway.paidAmount)} / Total: {formatCOP(layaway.totalAmount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const CustomersView: React.FC<CustomersViewProps> = ({ sales, layaways, allCustomers, onBulkAddCustomers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  
  const filteredCustomers = useMemo(() => {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      if (!lowerCaseSearchTerm) return allCustomers.sort((a,b) => a.name.localeCompare(b.name));
      return allCustomers.filter(c => 
        c.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        c.phone.includes(lowerCaseSearchTerm)
      );
  }, [allCustomers, searchTerm]);

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
           <div className="flex justify-between items-center mb-4 border-b-2 border-accent/30 pb-2">
            <h2 className="text-2xl font-bold text-accent">Gestión de Clientes</h2>
            <button
                onClick={() => setIsBulkImportOpen(true)}
                className="bg-accent text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover"
            >
                <UserPlusIcon />
                <span>Carga Masiva</span>
            </button>
          </div>
          
          <div className="relative mb-6">
              <input 
                type="text"
                placeholder="Buscar por nombre o celular..."
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
          
          {filteredCustomers.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-text-dark py-8">No se encontraron clientes.</p>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map(customer => (
                <CustomerCard key={customer.id} customer={customer} sales={sales} layaways={layaways} />
              ))}
            </div>
          )}
        </div>
      </div>
      {isBulkImportOpen && (
        <BulkImportCustomersModal
            isOpen={isBulkImportOpen}
            onClose={() => setIsBulkImportOpen(false)}
            onConfirm={onBulkAddCustomers}
        />
      )}
    </>
  );
};

export default CustomersView;