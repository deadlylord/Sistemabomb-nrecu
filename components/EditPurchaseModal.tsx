import React, { useState, useEffect } from 'react';
import { Purchase, Product } from '../types';

interface EditPurchaseModalProps {
  purchase: Purchase;
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePurchase: (updatedPurchase: Purchase, originalQuantity: number, newProductPrice: number) => void;
}

const EditPurchaseModal: React.FC<EditPurchaseModalProps> = ({
  purchase,
  product,
  isOpen,
  onClose,
  onUpdatePurchase,
}) => {
  const [formData, setFormData] = useState({
    quantity: purchase.quantity.toString(),
    cost: purchase.cost.toString(),
    supplier: purchase.supplier || '',
    price: product.price.toString(),
  });
  
  useEffect(() => {
    if (purchase && product) {
      setFormData({
        quantity: purchase.quantity.toString(),
        cost: purchase.cost.toString(),
        supplier: purchase.supplier || '',
        price: product.price.toString(),
      });
    }
  }, [purchase, product]);

  if (!isOpen || !purchase || !product) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseInt(formData.quantity, 10);
    const cost = parseFloat(formData.cost);
    const price = parseFloat(formData.price);

    if (isNaN(quantity) || isNaN(cost) || isNaN(price) || quantity < 0 || cost < 0 || price < 0) {
      alert('Por favor, ingresa valores numéricos válidos y positivos.');
      return;
    }
    
    const updatedPurchase: Purchase = {
      ...purchase,
      quantity,
      cost,
      supplier: formData.supplier.trim(),
      totalCost: quantity * cost,
    };
    
    onUpdatePurchase(updatedPurchase, purchase.quantity, price);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-2xl font-bold text-accent mb-2">Editar Compra</h2>
        <p className="mb-1 text-gray-500 dark:text-text-dark">Producto: <span className="font-bold text-gray-800 dark:text-text-light">{purchase.productName}</span></p>
        <p className="mb-6 text-sm text-gray-500 dark:text-text-dark">Fecha Original: <span className="font-mono">{new Date(purchase.createdAt).toLocaleString()}</span></p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Cantidad</label>
              <input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0"/>
            </div>
            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Costo Unitario</label>
              <input type="number" name="cost" id="cost" value={formData.cost} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0" step="1"/>
            </div>
            <div>
              <label htmlFor="supplier" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Proveedor</label>
              <input type="text" name="supplier" id="supplier" value={formData.supplier} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Precio de Venta (Producto)</label>
              <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0" step="1"/>
            </div>
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

export default EditPurchaseModal;
