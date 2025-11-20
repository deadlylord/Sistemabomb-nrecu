


import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Seller, Product, PaymentMethod, CartItem, Payment } from '../types';
import { formatCOP, toTitleCase } from '../constants';
import { TrashIcon, PlusIcon, MinusIcon, SearchIcon, CrossIcon } from './Icons';

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  sellers: Seller[];
  inventory: Product[];
  onUpdateSale: (updatedSale: Sale, originalSale: Sale) => void;
}

// FIX: Changed to a named export to resolve module loading error in parent component.
export const EditSaleModal: React.FC<EditSaleModalProps> = ({ isOpen, onClose, sale, sellers, inventory, onUpdateSale }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    seller: '',
  });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<CartItem[]>([]);
  const [createdAt, setCreatedAt] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [editingPrice, setEditingPrice] = useState<{id: string, value: string} | null>(null);
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    if (sale) {
      setFormData({
        customerName: toTitleCase(sale.customerName),
        customerPhone: sale.customerPhone,
        seller: sale.seller,
      });

      // FIX: Robustly handle `sale.items` and `sale.payments` which might be an object from Firebase
      // instead of an array. This ensures the items list appears correctly when editing a sale.
      const itemsArray = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {})).filter(Boolean) as CartItem[];
      setItems(itemsArray.map(item => ({ ...item })));

      const paymentsArray = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})).filter(Boolean) as Payment[];
      setPayments(paymentsArray.map(p => ({ ...p })));
      
      const saleDate = new Date(sale.createdAt);
      // Adjust for local timezone offset before formatting for the input
      saleDate.setMinutes(saleDate.getMinutes() - saleDate.getTimezoneOffset());
      setCreatedAt(saleDate.toISOString().slice(0, 16));
    }
  }, [sale]);
  
  const suggestedProducts = useMemo(() => {
    if (!productSearch) return [];
    return inventory.filter(p => 
      !p.isDisabled &&
      p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
      !items.some(item => item.id === p.id) // Exclude items already in cart
    );
  }, [productSearch, inventory, items]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestedProducts]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestedProducts.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % suggestedProducts.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + suggestedProducts.length) % suggestedProducts.length);
        } else if (e.key === 'Enter') {
            if (highlightedIndex >= 0) {
                e.preventDefault();
                handleAddItem(suggestedProducts[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    }
  };

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const paidAmount = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const remainingAmount = totalAmount - paidAmount;
  
  useEffect(() => {
    if (remainingAmount > 0) {
      setAmountInput(remainingAmount.toFixed(0));
    } else {
      setAmountInput('');
    }
  }, [remainingAmount]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'customerName') {
        setFormData(prev => ({ ...prev, [name]: toTitleCase(value) }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value as any }));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value.replace(/[^0-9]/g, '');
    if (phone.length <= 10) {
        setFormData(prev => ({...prev, customerPhone: phone}));
    }
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setItems(prev => prev.filter(item => item.id !== productId));
    } else {
      setItems(prev => prev.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };
  
  const handleAddItem = (product: Product) => {
    setItems(prev => [...prev, { ...product, quantity: 1 }]);
    setProductSearch('');
    setShowSuggestions(false);
  };
  
  const handleRemoveItem = (productId: string) => {
     setItems(prev => prev.filter(item => item.id !== productId));
  };

  const handlePriceChange = (itemId: string) => {
    if (editingPrice && editingPrice.id === itemId) {
        const newPrice = parseFloat(editingPrice.value);
        if (!isNaN(newPrice) && newPrice >= 0) {
            setItems(prev => prev.map(item =>
                item.id === itemId ? { ...item, price: newPrice } : item
            ));
        }
        setEditingPrice(null);
    }
  };
  
  const handleAddPayment = (method: PaymentMethod) => {
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) return;
    
    const newPayment: Payment = {
        amount,
        method,
        date: new Date(createdAt).toISOString(),
        seller: formData.seller
    };

    setPayments(prev => [...prev, newPayment]);
  };

  const handleRemovePayment = (indexToRemove: number) => {
    setPayments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.customerPhone.trim() && formData.customerPhone.trim().length !== 10) {
        alert('El número de celular debe tener 10 dígitos o dejarse vacío.');
        return;
    }
    if (!formData.seller) {
      alert("Por favor, selecciona un vendedor.");
      return;
    }
    
    if (Math.abs(remainingAmount) > 0.01) {
        alert(`El total pagado (${formatCOP(paidAmount)}) no coincide con el nuevo total de la venta (${formatCOP(totalAmount)}). Por favor, ajusta los pagos.`);
        return;
    }

    const updatedSale: Sale = {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      storeId: sale.storeId,
      ...(sale.layawayId && { layawayId: sale.layawayId }),
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      seller: formData.seller,
      items: items.map(item => ({...item})), // ensure items are plain objects
      payments: payments,
      totalAmount: totalAmount,
      createdAt: new Date(createdAt).toISOString(),
    };
    onUpdateSale(updatedSale, sale);
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-4xl h-[95vh] flex flex-col">
        <h2 className="text-2xl font-bold text-accent mb-4">Editar Venta #{sale.invoiceNumber}</h2>
        
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col gap-4 min-h-0">
          {/* Top Section: Sale Details */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-shrink-0">
            <input name="customerPhone" value={formData.customerPhone} onChange={handlePhoneChange} placeholder="Celular (10 dígitos)" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" maxLength={10}/>
            <input name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Nombre Cliente" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md"/>
            <select name="seller" value={formData.seller} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required>
                <option value="" disabled>Seleccionar Vendedor</option>
                {sellers.filter(s => !s.isDisabled).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
             <div className="lg:col-span-3">
                <label htmlFor="createdAt" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Fecha de la Venta</label>
                <input
                    type="datetime-local"
                    id="createdAt"
                    name="createdAt"
                    value={createdAt}
                    onChange={e => setCreatedAt(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md"
                    required
                />
             </div>
          </div>

          {/* Combined Middle Section: Items and Payments */}
          <div className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0 border-t-2 border-gray-200 dark:border-gray-700 py-4">
            
            {/* Left side: Items */}
            <div className="flex-grow lg:w-3/5 flex flex-col min-h-0">
              <h3 className="text-lg font-bold mb-2 flex-shrink-0">Artículos</h3>
              <div className="flex-grow overflow-y-auto space-y-3 pr-2 -mr-2">
                  {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                        <div className="flex-1">
                          <p className="font-bold">{item.name}</p>
                          <p className="text-xs text-gray-500 dark:text-text-dark">{item.supplier || 'N/A'}</p>
                           {editingPrice?.id === item.id ? (
                              <input
                                  type="number"
                                  step="1000"
                                  value={editingPrice.value}
                                  onChange={(e) => setEditingPrice({ id: item.id, value: e.target.value })}
                                  onBlur={() => handlePriceChange(item.id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePriceChange(item.id); } }}
                                  className="w-24 bg-gray-200 dark:bg-gray-700 text-accent text-sm p-1 rounded outline-none ring-2 ring-accent"
                                  autoFocus
                              />
                          ) : (
                              <p className="text-sm text-accent cursor-pointer" onClick={() => setEditingPrice({ id: item.id, value: item.price.toString() })}>
                                  {formatCOP(item.price)}
                              </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button type="button" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-full bg-gray-200 dark:bg-gray-700"><MinusIcon /></button>
                          <span className="w-8 text-center font-bold">{item.quantity}</span>
                          <button type="button" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="p-1 rounded-full bg-gray-200 dark:bg-gray-700"><PlusIcon /></button>
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(item.id)} className="ml-4 text-gray-500 dark:text-text-dark hover:text-red-500"><TrashIcon /></button>
                      </div>
                  ))}
              </div>
              <div className="relative mt-3 flex-shrink-0">
                <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} onKeyDown={handleKeyDown} placeholder="Buscar producto para agregar..." className="w-full bg-gray-100 dark:bg-gray-800 p-2 pl-10 pr-10 rounded-md"/>
                <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                {productSearch && (
                  <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                      aria-label="Limpiar búsqueda"
                  >
                      <CrossIcon className="w-5 h-5" />
                  </button>
                )}
                 {showSuggestions && suggestedProducts.length > 0 && (
                  <ul className="absolute z-50 bottom-full w-full mb-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {suggestedProducts.map((p, index) => (
                          <li key={p.id}
                              className={`p-2 cursor-pointer text-sm ${index === highlightedIndex ? 'bg-accent/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                              onMouseDown={() => handleAddItem(p)}
                          >
                              {p.name} ({p.stock} disp.)
                          </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right side: Payments */}
            <div className="lg:w-2/5 flex flex-col lg:border-l-2 lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6">
              <h3 className="text-lg font-bold mb-2 flex-shrink-0">Pagos</h3>
              <div className="flex-grow overflow-y-auto space-y-4 pr-2 -mr-2">
                <div className="space-y-2">
                    {payments.map((p, index) => (
                        <div key={index} className="flex flex-wrap items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                            <div className="flex-1 min-w-[150px]">
                                <p className="font-semibold">{p.method}: <span className="text-accent">{formatCOP(p.amount)}</span></p>
                                <p className="text-xs text-gray-500 dark:text-text-dark">Por: {p.seller}</p>
                            </div>
                            <button type="button" onClick={() => handleRemovePayment(index)} className="text-gray-500 hover:text-red-500 p-1"><TrashIcon /></button>
                        </div>
                    ))}
                </div>
                <div className="space-y-3">
                  <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md font-bold text-lg" placeholder="Monto" min="0" step="1000" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(PaymentMethod).map(method => (
                        <button key={method} type="button" onClick={() => handleAddPayment(method)} className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-text-light font-semibold rounded-lg hover:bg-accent hover:text-white transition-colors">
                          {method}
                        </button>
                      ))}
                    </div>
                </div>
                <div className="mt-4 border-t-2 border-dashed border-gray-300 dark:border-gray-600 pt-4 space-y-2 text-lg">
                    <div className="flex justify-between font-bold"><span>Nuevo Total Venta:</span> <span className="text-accent">{formatCOP(totalAmount)}</span></div>
                    <div className="flex justify-between"><span>Total Pagado:</span> <span className="font-bold">{formatCOP(paidAmount)}</span></div>
                    <div className={`flex justify-between font-bold ${remainingAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        <span>{remainingAmount > 0 ? 'Faltante:' : 'Cambio:'}</span> 
                        <span>{formatCOP(Math.abs(remainingAmount))}</span>
                    </div>
                </div>
              </div>
            </div>

          </div>
          
          <div className="flex justify-end space-x-3 pt-4 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Cancelar</button>
            <button type="submit" className="px-8 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSaleModal;
