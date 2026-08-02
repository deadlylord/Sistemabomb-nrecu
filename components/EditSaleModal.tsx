
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Seller, Product, PaymentMethod, CartItem, Payment } from '../types';
import { formatCOP, toTitleCase, normalizeText } from '../constants';
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
      // FIX: Added explicit type casts to CartItem[] and Payment[] to resolve 'Spread types may only be created from object types' error.
      const itemsArray = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {}) as any[]).filter(Boolean) as CartItem[];
      setItems(itemsArray.map(item => ({ ...item })));

      const paymentsArray = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {}) as any[]).filter(Boolean) as Payment[];
      setPayments(paymentsArray.map(p => ({ ...p })));
      
      const saleDate = new Date(sale.createdAt);
      // Adjust for local timezone offset before formatting for the input
      saleDate.setMinutes(saleDate.getMinutes() - saleDate.getTimezoneOffset());
      setCreatedAt(saleDate.toISOString().slice(0, 16));
    }
  }, [sale]);
  
  const suggestedProducts = useMemo(() => {
    if (!productSearch) return [];
    const normalizedSearch = normalizeText(productSearch);
    return inventory.filter(p => 
      !p.isDisabled &&
      normalizeText(p.name).includes(normalizedSearch) &&
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-secondary rounded-xl shadow-2xl w-full max-w-4xl h-[94vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0 bg-white dark:bg-secondary">
          <h2 className="text-lg sm:text-2xl font-bold text-accent">Editar Venta #{sale.invoiceNumber}</h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
            title="Cerrar"
          >
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Main Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0">
            {/* Top Section: Sale Details */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Datos de la Venta</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Celular Cliente</label>
                  <input name="customerPhone" value={formData.customerPhone} onChange={handlePhoneChange} placeholder="Celular (10 dígitos)" className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-sm border border-transparent focus:border-accent outline-none" maxLength={10}/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nombre Cliente</label>
                  <input name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Nombre Cliente" className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-sm border border-transparent focus:border-accent outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Vendedor</label>
                  <select name="seller" value={formData.seller} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-sm border border-transparent focus:border-accent outline-none" required>
                      <option value="" disabled>Seleccionar Vendedor</option>
                      {sellers.filter(s => !s.isDisabled).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="createdAt" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fecha de la Venta</label>
                  <input
                      type="datetime-local"
                      id="createdAt"
                      name="createdAt"
                      value={createdAt}
                      onChange={e => setCreatedAt(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-sm border border-transparent focus:border-accent outline-none"
                      required
                  />
                </div>
              </div>
            </div>

            {/* Combined Middle Section: Items and Payments */}
            <div className="flex flex-col lg:flex-row gap-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              
              {/* Left side: Items */}
              <div className="lg:w-3/5 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold">Artículos en la Venta</h3>
                  <span className="text-xs text-gray-400 font-medium">{items.length} ítem(s)</span>
                </div>
                <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">No hay productos seleccionados.</p>
                    ) : (
                      items.map(item => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl">
                          <div className="flex-1">
                            <p className="font-bold text-sm sm:text-base">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.supplier || 'N/A'}</p>
                             {editingPrice?.id === item.id ? (
                                <input
                                    type="number"
                                    step="1000"
                                    value={editingPrice.value}
                                    onChange={(e) => setEditingPrice({ id: item.id, value: e.target.value })}
                                    onBlur={() => handlePriceChange(item.id)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePriceChange(item.id); } }}
                                    className="w-28 bg-white dark:bg-gray-700 text-accent font-bold text-sm p-1 rounded border border-accent outline-none"
                                    autoFocus
                                />
                            ) : (
                                <p className="text-sm text-accent font-semibold cursor-pointer hover:underline" onClick={() => setEditingPrice({ id: item.id, value: item.price.toString() })}>
                                    {formatCOP(item.price)} <span className="text-[10px] text-gray-400 font-normal">(Editar)</span>
                                </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-700">
                            <div className="flex items-center space-x-2 bg-white dark:bg-gray-700/60 p-1 rounded-lg">
                              <button type="button" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"><MinusIcon className="w-4 h-4" /></button>
                              <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                              <button type="button" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="p-1 rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"><PlusIcon className="w-4 h-4" /></button>
                            </div>
                            <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar ítem"><TrashIcon className="w-5 h-5" /></button>
                          </div>
                        </div>
                    ))
                    )}
                </div>
                <div className="relative mt-2">
                  <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} onKeyDown={handleKeyDown} placeholder="Buscar producto para agregar..." className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 pl-10 pr-10 rounded-lg text-sm border border-transparent focus:border-accent outline-none"/>
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
                    <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                        {suggestedProducts.map((p, index) => (
                            <li key={p.id}
                                className={`p-2.5 cursor-pointer text-sm flex justify-between items-center ${index === highlightedIndex ? 'bg-accent/20 font-bold' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                onMouseDown={() => handleAddItem(p)}
                            >
                                <span>{p.name}</span> <span className="text-xs text-gray-400">Stock: {p.stock}</span>
                            </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Right side: Payments */}
              <div className="lg:w-2/5 flex flex-col lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6 space-y-3">
                <h3 className="text-base sm:text-lg font-bold">Registro de Pagos</h3>
                <div className="space-y-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {payments.map((p, index) => (
                          <div key={index} className="flex items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                              <div className="flex-1">
                                  <p className="font-bold text-sm">{p.method}: <span className="text-accent">{formatCOP(p.amount)}</span></p>
                                  <p className="text-xs text-gray-400">Por: {p.seller || 'N/A'}</p>
                              </div>
                              <button type="button" onClick={() => handleRemovePayment(index)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                      ))}
                  </div>
                  <div className="space-y-3 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                    <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} className="w-full bg-white dark:bg-gray-800 p-2.5 rounded-lg font-bold text-lg border border-gray-300 dark:border-gray-700 outline-none focus:border-accent" placeholder="Monto" min="0" step="1000" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.values(PaymentMethod).map(method => (
                          <button key={method} type="button" onClick={() => handleAddPayment(method)} className="p-2 bg-gray-200 dark:bg-gray-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-accent hover:text-white transition-colors">
                            {method}
                          </button>
                        ))}
                      </div>
                  </div>
                  <div className="mt-3 bg-gray-100 dark:bg-gray-800/80 p-3.5 rounded-xl space-y-2 border border-gray-200 dark:border-gray-700 text-sm sm:text-base">
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
          </div>
          
          {/* Sticky Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0 bg-white dark:bg-secondary z-10">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors">Cancelar</button>
            <button type="submit" className="px-7 py-2.5 bg-accent text-white font-bold rounded-xl hover:bg-accent-hover text-sm shadow-md transition-colors">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSaleModal;
