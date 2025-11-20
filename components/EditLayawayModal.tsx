
import React, { useState, useMemo, useEffect } from 'react';
import { Layaway, Seller, Product, PaymentMethod, CartItem, Payment } from '../types';
import { formatCOP, toTitleCase } from '../constants';
import { TrashIcon, PlusIcon, MinusIcon, SearchIcon, CrossIcon } from './Icons';

interface EditLayawayModalProps {
  isOpen: boolean;
  onClose: () => void;
  layaway: Layaway;
  sellers: Seller[];
  inventory: Product[];
  onUpdateLayaway: (updatedLayaway: Layaway, originalLayaway: Layaway) => void;
}

const EditLayawayModal: React.FC<EditLayawayModalProps> = ({ isOpen, onClose, layaway, sellers, inventory, onUpdateLayaway }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    invoiceNumber: '',
    seller: '',
    description: '',
  });
  const [status, setStatus] = useState<Layaway['status']>('active');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<CartItem[]>([]);
  const [createdAt, setCreatedAt] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [editingPrice, setEditingPrice] = useState<{id: string, value: string} | null>(null);
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    if (layaway) {
      setFormData({
        customerName: toTitleCase(layaway.customerName),
        customerPhone: layaway.customerPhone,
        invoiceNumber: layaway.invoiceNumber,
        seller: layaway.seller,
        description: layaway.description || '',
      });
      setStatus(layaway.status);
      
      const itemsArray = (Array.isArray(layaway.items) ? layaway.items : Object.values(layaway.items || {})).filter(Boolean) as CartItem[];
      setItems(itemsArray.map(item => ({ ...item })));

      const paymentsArray = (Array.isArray(layaway.payments) ? layaway.payments : Object.values(layaway.payments || {})).filter(Boolean) as Payment[];
      setPayments(paymentsArray.map(p => ({ ...p })));
      
      const layawayDate = new Date(layaway.createdAt);
      layawayDate.setMinutes(layawayDate.getMinutes() - layawayDate.getTimezoneOffset());
      setCreatedAt(layawayDate.toISOString().slice(0, 16));
    }
  }, [layaway]);
  
  const suggestedProducts = useMemo(() => {
    if (!productSearch) return [];
    return inventory.filter(p => 
      !p.isDisabled &&
      p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
      !items.some(item => item.id === p.id)
    );
  }, [productSearch, inventory, items]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestedProducts.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev + 1) % suggestedProducts.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev - 1 + suggestedProducts.length) % suggestedProducts.length); }
        else if (e.key === 'Enter') { if (highlightedIndex >= 0) { e.preventDefault(); handleAddItem(suggestedProducts[highlightedIndex]); } }
        else if (e.key === 'Escape') { setShowSuggestions(false); }
    }
  };

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const paidAmount = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const remainingAmount = totalAmount - paidAmount;
  
  useEffect(() => {
    if (remainingAmount > 0) { setAmountInput(remainingAmount.toFixed(0)); } else { setAmountInput(''); }
  }, [remainingAmount]);

  useEffect(() => {
    if (paidAmount >= totalAmount && totalAmount > 0 && status === 'active') {
        setStatus('completed');
    } else if (paidAmount < totalAmount && status === 'completed') {
        setStatus('active');
    }
  }, [paidAmount, totalAmount, status]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'customerName') { setFormData(prev => ({ ...prev, [name]: toTitleCase(value) })); }
    else { setFormData(prev => ({ ...prev, [name]: value as any })); }
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
        setItems(prev => prev.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
    }
  };
  
  const handleAddItem = (product: Product) => {
    setItems(prev => [...prev, { ...product, quantity: 1 }]);
    setProductSearch('');
    setShowSuggestions(false);
  };
  
  const handleRemoveItem = (productId: string) => { setItems(prev => prev.filter(item => item.id !== productId)); };

  const handlePriceChange = (itemId: string) => {
    if (editingPrice && editingPrice.id === itemId) {
        const newPrice = parseFloat(editingPrice.value);
        if (!isNaN(newPrice) && newPrice >= 0) { setItems(prev => prev.map(item => item.id === itemId ? { ...item, price: newPrice } : item)); }
        setEditingPrice(null);
    }
  };
  
  const handleAddPayment = (method: PaymentMethod) => {
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) return;
    const newPayment: Payment = { amount, method, date: new Date().toISOString(), seller: formData.seller };
    setPayments(prev => [...prev, newPayment]);
  };

  const handleRemovePayment = (indexToRemove: number) => { setPayments(prev => prev.filter((_, index) => index !== indexToRemove)); };
  
  const handlePaymentDateChange = (indexToUpdate: number, newDateValue: string) => {
    if (!newDateValue) return;
    const newPayments = payments.map((payment, index) => {
        if (index === indexToUpdate) {
            return { ...payment, date: new Date(newDateValue).toISOString() };
        }
        return payment;
    });
    setPayments(newPayments);
  };

  const toDateTimeLocal = (isoString: string): string => {
      const date = new Date(isoString);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      return date.toISOString().slice(0, 16);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.customerPhone.trim().length !== 10) {
      alert("El número de celular debe tener exactamente 10 dígitos.");
      return;
    }
    if (!formData.seller) { alert("Por favor, selecciona un vendedor."); return; }

    const { description: _, ...layawayWithoutDescription } = layaway;

    const updatedLayaway: Layaway = {
        ...layawayWithoutDescription,
        ...formData,
        status,
        items: items.map(item => ({ ...item })),
        payments,
        totalAmount,
        paidAmount,
        createdAt: new Date(createdAt).toISOString(),
        ...(status === 'pre-order' ? { description: formData.description || '' } : {})
    };
    onUpdateLayaway(updatedLayaway, layaway);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-4xl h-[95vh] flex flex-col">
        <h2 className="text-2xl font-bold text-accent mb-4">Editar Abono #{layaway.invoiceNumber}</h2>
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col gap-4 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input name="customerPhone" value={formData.customerPhone} onChange={handlePhoneChange} placeholder="Celular (10 dígitos)" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" maxLength={10}/>
            <input name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Nombre Cliente" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md"/>
            <input name="invoiceNumber" value={formData.invoiceNumber} onChange={handleInputChange} placeholder="Número Factura/Abono" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md"/>
            <select name="seller" value={formData.seller} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required>
                <option value="" disabled>Seleccionar Vendedor</option>
                {sellers.filter(s => !s.isDisabled).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as Layaway['status'])} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                {['active', 'completed', 'cancelled', 'pre-order'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="datetime-local" name="createdAt" value={createdAt} onChange={e => setCreatedAt(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required/>
          </div>
          
          {status === 'pre-order' && (
              <div>
                  <label htmlFor="layawayDescription" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">
                      Descripción del Pedido
                  </label>
                  <textarea
                      id="layawayDescription"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                      placeholder="Detalles específicos del encargo (talla, color, etc.)..."
                  />
              </div>
          )}

          <div className="flex-grow overflow-y-auto border-y-2 border-gray-200 dark:border-gray-700 py-4 space-y-3">
             <h3 className="text-lg font-bold mb-2">Artículos</h3>
             {items.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="flex-1">
                    <p className="font-bold">{item.name}</p>
                     {editingPrice?.id === item.id ? (
                        <input type="number" step="1000" value={editingPrice.value} onChange={(e) => setEditingPrice({ id: item.id, value: e.target.value })} onBlur={() => handlePriceChange(item.id)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePriceChange(item.id); } }} className="w-24 bg-gray-200 dark:bg-gray-700 text-accent text-sm p-1 rounded" autoFocus />
                    ) : (
                        <p className="text-sm text-accent cursor-pointer" onClick={() => setEditingPrice({ id: item.id, value: item.price.toString() })}>{formatCOP(item.price)}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button type="button" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-full bg-gray-200 dark:bg-gray-700"><MinusIcon /></button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <button type="button" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="p-1 rounded-full bg-gray-200 dark:bg-gray-700"><PlusIcon /></button>
                  </div>
                  <button type="button" onClick={() => handleRemoveItem(item.id)} className="ml-4 text-gray-500 hover:text-red-500"><TrashIcon /></button>
                </div>
            ))}
             <div className="relative mt-2">
              <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} onKeyDown={handleKeyDown} placeholder="Buscar producto para agregar..." className="w-full bg-gray-100 dark:bg-gray-800 p-2 pl-10 pr-10 rounded-md"/>
              <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              {showSuggestions && suggestedProducts.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-40 overflow-y-auto">{suggestedProducts.map((p, i) => (<li key={p.id} className={`p-2 cursor-pointer text-sm ${i === highlightedIndex ? 'bg-accent/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} onMouseDown={() => handleAddItem(p)}>{p.name} ({p.stock} disp.)</li>))}</ul>
              )}
            </div>
          </div>
          
          <div>
             <h3 className="text-lg font-bold mb-2">Pagos</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {payments.map((p, index) => (
                        <div key={index} className="flex flex-wrap items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                            <div className="flex-1 min-w-[150px]">
                                <p className="font-semibold">{p.method}: <span className="text-accent">{formatCOP(p.amount)}</span></p>
                                <p className="text-xs text-gray-500 dark:text-text-dark">Por: {p.seller}</p>
                            </div>
                            <div className="flex-1">
                                <input
                                    type="datetime-local"
                                    value={toDateTimeLocal(p.date)}
                                    onChange={(e) => handlePaymentDateChange(index, e.target.value)}
                                    className="w-full bg-gray-200 dark:bg-gray-700 p-1 rounded-md text-xs border border-gray-300 dark:border-gray-600"
                                />
                            </div>
                            <button type="button" onClick={() => handleRemovePayment(index)} className="text-gray-500 hover:text-red-500 p-1"><TrashIcon /></button>
                        </div>
                    ))}
                </div>
                <div className="space-y-3">
                  <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md font-bold text-lg" placeholder="Monto"/>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.values(PaymentMethod).map(m => (
                      <button key={m} type="button" onClick={() => handleAddPayment(m)} className="p-2 bg-gray-200 dark:bg-gray-700 text-sm font-semibold rounded-lg hover:bg-accent hover:text-white">{m}</button>
                    ))}
                  </div>
                </div>
             </div>
             <div className="mt-4 border-t-2 pt-4 space-y-2 text-lg">
                <div className="flex justify-between font-bold"><span>Nuevo Total Abono:</span> <span className="text-accent">{formatCOP(totalAmount)}</span></div>
                <div className="flex justify-between"><span>Total Pagado:</span> <span className="font-bold">{formatCOP(paidAmount)}</span></div>
                <div className={`flex justify-between font-bold ${remainingAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    <span>{remainingAmount > 0 ? 'Faltante:' : 'Saldo a favor:'}</span> 
                    <span>{formatCOP(Math.abs(remainingAmount))}</span>
                </div>
             </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Cancelar</button>
            <button type="submit" className="px-8 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLayawayModal;
