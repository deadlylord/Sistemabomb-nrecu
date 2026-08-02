
import React, { useState, useMemo, useEffect } from 'react';
import { Layaway, Seller, Product, PaymentMethod, CartItem, Payment } from '../types';
import { formatCOP, toTitleCase, normalizeText } from '../constants';
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
      
      // FIX: Cast itemsArray and paymentsArray to their respective types to allow safe spreading and avoid 'Spread types may only be created from object types' error.
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
    const normalizedSearch = normalizeText(productSearch);
    return inventory.filter(p => 
      !p.isDisabled &&
      normalizeText(p.name).includes(normalizedSearch) &&
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-secondary rounded-xl shadow-2xl w-full max-w-4xl h-[94vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0 bg-white dark:bg-secondary">
          <h2 className="text-lg sm:text-2xl font-bold text-accent">Editar Abono #{layaway.invoiceNumber}</h2>
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
            {/* Datos del Cliente y Facturación */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Datos del Cliente y Facturación</h3>
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
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Número Factura / Abono</label>
                  <input name="invoiceNumber" value={formData.invoiceNumber} onChange={handleInputChange} placeholder="Número Factura/Abono" className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-sm border border-transparent focus:border-accent outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Vendedor</label>
                  <select name="seller" value={formData.seller} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-sm border border-transparent focus:border-accent outline-none" required>
                      <option value="" disabled>Seleccionar Vendedor</option>
                      {sellers.filter(s => !s.isDisabled).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estado</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as Layaway['status'])} className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-sm border border-transparent focus:border-accent outline-none font-semibold">
                      {['active', 'completed', 'cancelled', 'pre-order'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fecha de Creación</label>
                  <input type="datetime-local" name="createdAt" value={createdAt} onChange={e => setCreatedAt(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-sm border border-transparent focus:border-accent outline-none" required/>
                </div>
              </div>
            </div>
            
            {status === 'pre-order' && (
                <div className="space-y-1">
                    <label htmlFor="layawayDescription" className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        Descripción del Pedido / Encargo
                    </label>
                    <textarea
                        id="layawayDescription"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-accent outline-none"
                        placeholder="Detalles específicos del encargo (talla, color, observaciones)..."
                    />
                </div>
            )}

            {/* Artículos */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
               <div className="flex items-center justify-between">
                 <h3 className="text-base sm:text-lg font-bold">Artículos en el Abono</h3>
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
                         {editingPrice?.id === item.id ? (
                            <input type="number" step="1000" value={editingPrice.value} onChange={(e) => setEditingPrice({ id: item.id, value: e.target.value })} onBlur={() => handlePriceChange(item.id)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePriceChange(item.id); } }} className="w-28 bg-white dark:bg-gray-700 text-accent font-bold text-sm p-1 rounded border border-accent" autoFocus />
                        ) : (
                            <p className="text-sm text-accent font-semibold cursor-pointer hover:underline" title="Clic para editar precio" onClick={() => setEditingPrice({ id: item.id, value: item.price.toString() })}>{formatCOP(item.price)} <span className="text-[10px] text-gray-400 font-normal">(Editar)</span></p>
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

               {/* Búsqueda de productos */}
               <div className="relative mt-2">
                <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} onKeyDown={handleKeyDown} placeholder="Buscar producto para agregar..." className="w-full bg-gray-100 dark:bg-gray-800 p-2.5 pl-10 pr-10 rounded-lg text-sm border border-transparent focus:border-accent outline-none"/>
                <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                {showSuggestions && suggestedProducts.length > 0 && (
                  <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">{suggestedProducts.map((p, i) => (<li key={p.id} className={`p-2.5 cursor-pointer text-sm flex justify-between items-center ${i === highlightedIndex ? 'bg-accent/20 font-bold' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} onMouseDown={() => handleAddItem(p)}><span>{p.name}</span> <span className="text-xs text-gray-400">Stock: {p.stock}</span></li>))}</ul>
                )}
              </div>
            </div>
            
            {/* Pagos */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
               <h3 className="text-base sm:text-lg font-bold">Registro de Pagos</h3>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Historial de pagos */}
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Pagos registrados ({payments.length})</p>
                      {payments.length === 0 ? (
                        <p className="text-xs text-gray-400 italic py-2">Sin pagos registrados aún.</p>
                      ) : (
                        payments.map((p, index) => (
                            <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex-1">
                                    <p className="font-bold text-sm">{p.method}: <span className="text-accent">{formatCOP(p.amount)}</span></p>
                                    <p className="text-xs text-gray-400">Registrado por: {p.seller || 'N/A'}</p>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <input
                                        type="datetime-local"
                                        value={toDateTimeLocal(p.date)}
                                        onChange={(e) => handlePaymentDateChange(index, e.target.value)}
                                        className="flex-1 sm:flex-none bg-white dark:bg-gray-700 p-1.5 rounded-md text-xs border border-gray-300 dark:border-gray-600 outline-none"
                                    />
                                    <button type="button" onClick={() => handleRemovePayment(index)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar pago"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))
                      )}
                  </div>

                  {/* Agregar nuevo pago */}
                  <div className="space-y-3 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Agregar nuevo abono</p>
                    <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} className="w-full bg-white dark:bg-gray-800 p-2.5 rounded-lg font-bold text-lg border border-gray-300 dark:border-gray-700 outline-none focus:border-accent" placeholder="Monto a abonar"/>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(PaymentMethod).map(m => (
                        <button key={m} type="button" onClick={() => handleAddPayment(m)} className="p-2 bg-gray-200 dark:bg-gray-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-accent hover:text-white transition-colors">{m}</button>
                      ))}
                    </div>
                  </div>
               </div>

               {/* Totales */}
               <div className="mt-3 bg-gray-100 dark:bg-gray-800/80 p-3.5 rounded-xl space-y-2 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between font-bold text-sm sm:text-base"><span>Nuevo Total Abono:</span> <span className="text-accent">{formatCOP(totalAmount)}</span></div>
                  <div className="flex justify-between text-sm sm:text-base"><span>Total Pagado:</span> <span className="font-bold">{formatCOP(paidAmount)}</span></div>
                  <div className={`flex justify-between font-bold text-sm sm:text-base ${remainingAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      <span>{remainingAmount > 0 ? 'Faltante por Pagar:' : 'Saldo a Favor:'}</span> 
                      <span>{formatCOP(Math.abs(remainingAmount))}</span>
                  </div>
               </div>
            </div>
          </div>
          
          {/* Footer Actions - Always Sticky / Visible */}
          <div className="px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0 bg-white dark:bg-secondary z-10">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-7 py-2.5 bg-accent text-white font-bold rounded-xl hover:bg-accent-hover text-sm shadow-md transition-colors">
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLayawayModal;
