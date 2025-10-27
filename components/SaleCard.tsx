import React, { useState } from 'react';
import { Sale } from '../types';

interface SaleCardProps {
  sale: Sale;
}

const SaleCard: React.FC<SaleCardProps> = ({ sale }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gray-800 rounded-lg p-4 transition-all duration-300 shadow-md">
      <div 
        className="flex flex-col sm:flex-row justify-between sm:items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 mb-3 sm:mb-0">
          <h3 className="font-bold text-lg text-white">{sale.customerName}</h3>
          <p className="text-sm text-text-dark">{sale.customerPhone}</p>
        </div>
        <div className="flex-1 text-left sm:text-center mb-3 sm:mb-0">
          <p className="text-sm text-text-dark">Método de Pago</p>
          <p className="font-semibold text-white">{sale.paymentMethod}</p>
        </div>
        <div className="flex-1 text-left sm:text-right">
          <p className="text-xl font-bold text-accent">${sale.totalAmount.toFixed(2)}</p>
          <p className="text-xs text-text-dark mt-1">{new Date(sale.createdAt).toLocaleString()}</p>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h4 className="font-bold text-accent mb-2">Productos Comprados</h4>
          <ul className="space-y-2">
            {sale.items.map(item => (
              <li key={item.id} className="flex justify-between items-center text-sm bg-primary p-2 rounded-md">
                <div>
                  <span className="font-semibold text-text-light">{item.name}</span>
                  <span className="text-text-dark"> (x{item.quantity})</span>
                </div>
                <span className="font-semibold text-accent">${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SaleCard;