
import React, { useState, useMemo } from 'react';
import { Sale, Layaway, Customer } from '../types';
import { SearchIcon, UserPlusIcon, CrossIcon, EditIcon } from './Icons';
import { formatCOP } from '../constants';
import BulkImportCustomersModal from './BulkImportCustomersModal';
import EditCustomerModal from './EditCustomerModal';

interface CustomersViewProps {
  sales: Sale[];
  layaways: Layaway[];
  allCustomers: Customer[];
  onBulkAddCustomers: (customers: { name: string, phone: string }[]) => void;
  onUpdateCustomer: (customerId: string, newName: string, newPhone: string) => void;
}

type EnrichedCustomerData = Customer & {
    totalSpent: number;
    totalPurchases: number;
    totalUnits: number;
    lastPurchaseDate: Date | null;
    purchaseFrequency: number; // in days, Infinity if < 2 purchases
    customerSales: Sale[];
    customerLayaways: Layaway[];
};

type SortConfig = {
    key: keyof EnrichedCustomerData | 'name';
    direction: 'ascending' | 'descending';
};

const CustomerRow: React.FC<{ customerData: EnrichedCustomerData; onEdit: (customer: Customer) => void; }> = ({ customerData, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { 
    name, 
    phone, 
    totalSpent, 
    totalPurchases, 
    totalUnits, 
    lastPurchaseDate, 
    purchaseFrequency,
    customerSales,
    customerLayaways
  } = customerData;
  
  const frequencyText = useMemo(() => {
    if (purchaseFrequency === Infinity) {
        return totalPurchases > 0 ? `1 compra` : 'N/A';
    }
    return `Cada ${purchaseFrequency.toFixed(1)} días`;
  }, [purchaseFrequency, totalPurchases]);

  return (
    <>
      <tr 
        onClick={() => setIsExpanded(!isExpanded)} 
        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        tabIndex={0}
        onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && setIsExpanded(!isExpanded)}
      >
        <td className="p-3 font-bold">{name}</td>
        <td className="p-3 text-gray-500 dark:text-text-dark">{phone}</td>
        <td className="p-3 font-bold text-accent text-right">{formatCOP(totalSpent)}</td>
        <td className="p-3 text-center">{totalPurchases}</td>
        <td className="p-3 text-center">{totalUnits}</td>
        <td className="p-3">{lastPurchaseDate ? lastPurchaseDate.toLocaleDateString('es-CO') : 'N/A'}</td>
        <td className="p-3">{frequencyText}</td>
        <td className="p-3 text-center">
            <button
                onClick={(e) => {
                    e.stopPropagation(); // Prevent row expansion when clicking the button
                    onEdit(customerData);
                }}
                className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors"
                title="Editar Cliente"
            >
                <EditIcon className="w-5 h-5" />
            </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-100/50 dark:bg-gray-800/50">
          <td colSpan={8} className="p-4">
            <div className="space-y-4">
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
          </td>
        </tr>
      )}
    </>
  );
};

const CustomersView: React.FC<CustomersViewProps> = ({ sales, layaways, allCustomers, onBulkAddCustomers, onUpdateCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const enrichedCustomerData = useMemo(() => {
    return allCustomers.map(customer => {
        const customerSales = sales
            .filter(s => s.customerName === customer.name && s.customerPhone === customer.phone)
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const customerLayaways = layaways
            .filter(l => l.customerName === customer.name && l.customerPhone === customer.phone)
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const totalSpent = customerSales.reduce((sum, s) => sum + s.totalAmount, 0) + customerLayaways.reduce((sum, l) => sum + l.paidAmount, 0);
        
        const allTransactions = [...customerSales, ...customerLayaways];
        const totalPurchases = allTransactions.length;

        const totalUnits = allTransactions
            .flatMap(t => t.items)
            .reduce((sum, item) => sum + (item?.quantity || 0), 0);
            
        if (allTransactions.length === 0) {
            return {
                ...customer,
                totalSpent,
                totalPurchases: 0,
                totalUnits: 0,
                lastPurchaseDate: null,
                purchaseFrequency: Infinity,
                customerSales: [],
                customerLayaways: [],
            };
        }

        const purchaseDates = allTransactions
            .map(t => new Date(t.createdAt).getTime())
            .sort((a, b) => a - b);
            
        const lastPurchaseDate = new Date(purchaseDates[purchaseDates.length - 1]);

        let purchaseFrequency = Infinity;
        if (purchaseDates.length > 1) {
            const uniqueDays = [...new Set(purchaseDates.map(d => new Date(d).setHours(0,0,0,0)))];
            if (uniqueDays.length > 1) {
              const differences = [];
              for (let i = 1; i < uniqueDays.length; i++) {
                  const diff = (uniqueDays[i] - uniqueDays[i-1]) / (1000 * 60 * 60 * 24); // difference in days
                  differences.push(diff);
              }
              const avgDifference = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
              purchaseFrequency = avgDifference;
            }
        }

        return {
            ...customer,
            totalSpent,
            totalPurchases,
            totalUnits,
            lastPurchaseDate,
            purchaseFrequency,
            customerSales,
            customerLayaways,
        };
    });
  }, [allCustomers, sales, layaways]);

  const sortedAndFilteredCustomers = useMemo(() => {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      let filtered = allCustomers.length > 0 ? enrichedCustomerData : [];

      if (lowerCaseSearchTerm) {
        filtered = filtered.filter(c => 
          c.name.toLowerCase().includes(lowerCaseSearchTerm) ||
          c.phone.includes(lowerCaseSearchTerm)
        );
      }

      if (sortConfig.key) {
        filtered.sort((a, b) => {
            const aVal = a[sortConfig.key as keyof EnrichedCustomerData];
            const bVal = b[sortConfig.key as keyof EnrichedCustomerData];
            
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'ascending' ? aVal - bVal : bVal - aVal;
            }
            if (aVal instanceof Date && bVal instanceof Date) {
                return sortConfig.direction === 'ascending' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
            }
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const comparison = aVal.localeCompare(bVal);
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            }
            return 0;
        });
      }
      return filtered;
  }, [enrichedCustomerData, searchTerm, sortConfig, allCustomers]);
  
  const requestSort = (key: keyof EnrichedCustomerData) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const SortableHeader = ({ children, columnKey, className }: { children: React.ReactNode, columnKey: keyof EnrichedCustomerData, className?: string }) => {
    const isSorted = sortConfig.key === columnKey;
    const directionIcon = isSorted ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : '';
    return (
      <th 
        className={`p-3 text-sm font-semibold tracking-wide cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${className}`}
        onClick={() => requestSort(columnKey)}
      >
        {children}{isSorted && <span className="text-xs">{directionIcon}</span>}
      </th>
    );
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditModalOpen(true);
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">
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
          
          {sortedAndFilteredCustomers.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-text-dark py-8">No se encontraron clientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    {/* FIX: Add children prop to SortableHeader components */}
                    <SortableHeader columnKey="name" className="text-left">Nombre</SortableHeader>
                    <SortableHeader columnKey="phone" className="text-left">Celular</SortableHeader>
                    <SortableHeader columnKey="totalSpent" className="text-right">Total Comprado</SortableHeader>
                    <SortableHeader columnKey="totalPurchases" className="text-center"># Compras</SortableHeader>
                    <SortableHeader columnKey="totalUnits" className="text-center"># Unidades</SortableHeader>
                    <SortableHeader columnKey="lastPurchaseDate" className="text-left">Última Compra</SortableHeader>
                    <SortableHeader columnKey="purchaseFrequency" className="text-left">Frecuencia</SortableHeader>
                    <th className="p-3 text-sm font-semibold tracking-wide text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedAndFilteredCustomers.map(customer => (
                    <CustomerRow key={customer.id} customerData={customer} onEdit={handleEditClick} />
                  ))}
                </tbody>
              </table>
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
      {isEditModalOpen && editingCustomer && (
        <EditCustomerModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            customer={editingCustomer}
            onSave={onUpdateCustomer}
        />
      )}
    </>
  );
};

export default CustomersView;