import { saleEditTotals, adjustedSalePayment, validateSaleEdit } from '../services/saleEditTotals';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sale, Seller, Product, PaymentMethod, CartItem, Payment } from '../types';
import { formatCOP, toTitleCase, normalizeText } from '../constants';
import { TrashIcon, PlusIcon, MinusIcon, SearchIcon, CrossIcon } from './Icons';

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  sellers: Seller[];
  inventory: Product[];
  onUpdateSale: (updatedSale: Sale, originalSale: Sale) => void | Promise<void>;
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
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('0');
  const [surchargeInput, setSurchargeInput] = useState('0');
  const [autoBalancePayment, setAutoBalancePayment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);

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
      const initialPayments = paymentsArray.length ? paymentsArray : sale.paymentMethod ? [{ amount: sale.totalAmount, method: sale.paymentMethod, date: sale.createdAt, seller: sale.seller }] : [];
      setPayments(initialPayments.map(p => ({ ...p, amount: Number(p.amount) || 0, date: p.date || sale.createdAt, seller: p.seller || sale.seller })));
      setAutoBalancePayment(initialPayments.length === 1 && initialPayments[0].method !== PaymentMethod.Bono && !sale.layawayId);
      setDiscountMode(sale.discountPercent ? 'percent' : 'amount');
      setDiscountValue(String(sale.discountPercent || sale.discountAmount || 0));
      setSurchargeInput(String(sale.paymentSurchargeAmount || 0));
      setEditingPrice(null);
      setSaveError('');

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

  const calculationItems = useMemo(() => items.map(item => editingPrice?.id === item.id && editingPrice.value !== ''
    ? { ...item, price: Number(editingPrice.value) } : item), [items, editingPrice]);
  const surchargeAmount = Number(surchargeInput || 0);
  const { subtotal, discountPercent, discountAmount, totalAmount } = saleEditTotals(calculationItems, discountMode, Number(discountValue || 0), surchargeAmount);
  const effectivePayments = autoBalancePayment && payments.length === 1
    ? [adjustedSalePayment(payments[0], totalAmount, surchargeAmount)] : payments;
  const paidAmount = effectivePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingAmount = Math.round((totalAmount - paidAmount) * 100) / 100;

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

    setPayments([...effectivePayments, newPayment]);
    setAutoBalancePayment(false);
  };

  const handleRemovePayment = (indexToRemove: number) => {
    setPayments(effectivePayments.filter((_, index) => index !== indexToRemove));
    setAutoBalancePayment(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setSaveError('');
    if (formData.customerPhone.trim() && formData.customerPhone.trim().length !== 10) {
        alert('El número de celular debe tener 10 dígitos o dejarse vacío.');
        return;
    }
    if (!formData.seller) {
      alert("Por favor, selecciona un vendedor.");
      return;
    }

    try {
      if (editingPrice && (editingPrice.value.trim() === '' || !Number.isFinite(Number(editingPrice.value)))) throw new Error('Escribe un precio válido para el producto.');
      if (!createdAt || !Number.isFinite(new Date(createdAt).getTime())) throw new Error('Revisa la fecha de la venta.');
      if (discountMode === 'percent' && (Number(discountValue) < 0 || Number(discountValue) > 100)) throw new Error('El descuento debe estar entre 0 y 100%.');
      validateSaleEdit(calculationItems, effectivePayments, totalAmount, discountAmount, surchargeAmount);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Revisa los datos de la venta.');
      return;
    }

    const updatedSale: Sale = {
      ...sale,
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      storeId: sale.storeId,
      ...(sale.layawayId && { layawayId: sale.layawayId }),
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      seller: formData.seller,
      items: calculationItems.map(item => ({...item})), // ensure items are plain objects
      payments: effectivePayments.map(payment => ({ ...payment,
        date: !payment.date || payment.date === sale.createdAt ? new Date(createdAt).toISOString() : payment.date,
        seller: !payment.seller || payment.seller === sale.seller ? formData.seller : payment.seller
      })),
      totalAmount: totalAmount,
      discountPercent,
      discountAmount,
      paymentSurchargeAmount: surchargeAmount,
      companyId: sale.companyId,
      paymentMethod: effectivePayments[0]?.method || sale.paymentMethod,
      createdAt: new Date(createdAt).toISOString(),
    };
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onUpdateSale(updatedSale, sale);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar la venta. Tus cambios se conservan para reintentar.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-sale-title"
    >
      <div className="bg-white dark:bg-secondary rounded-none sm:rounded-xl shadow-2xl w-full max-w-4xl h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0 bg-white dark:bg-secondary">
          <h2 id="edit-sale-title" className="text-lg sm:text-2xl font-bold text-accent">Editar Venta #{sale.invoiceNumber}</h2>
          <button
            type="button"
            onClick={() => { if (!savingRef.current) onClose(); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
            title="Cerrar"
          >
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <fieldset disabled={isSaving} className="contents">
          {/* Main Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0 overscroll-contain">
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
                                    min="0"
                                    step="0.01"
                                    aria-label={`Precio unitario de ${item.name}`}
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
                              <button type="button" aria-label={`Restar una unidad de ${item.name}`} onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"><MinusIcon className="w-4 h-4" /></button>
                              <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                              <button type="button" aria-label={`Sumar una unidad de ${item.name}`} onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="p-1 rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"><PlusIcon className="w-4 h-4" /></button>
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
                  {payments.length === 1 && payments[0].method !== PaymentMethod.Bono && !sale.layawayId && <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input type="checkbox" checked={autoBalancePayment} onChange={event => { setPayments(effectivePayments.map(p => ({...p}))); setAutoBalancePayment(event.target.checked); }} />
                    Ajustar el único pago al nuevo total de la venta
                  </label>}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {effectivePayments.map((p, index) => (
                          <div key={index} className="flex items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                              <div className="flex-1">
                                  <select aria-label={`Medio del pago ${index + 1}`} value={p.method} onChange={event => { setPayments(effectivePayments.map((payment, i) => i === index ? {...payment, method: event.target.value as PaymentMethod} : payment)); setAutoBalancePayment(false); }} className="w-full bg-white dark:bg-gray-700 rounded p-1 text-sm">
                                    {Object.values(PaymentMethod).map(method => <option key={method} value={method}>{method}</option>)}
                                  </select>
                                  <input type="number" min="0" step="0.01" aria-label={`Importe del pago ${index + 1}`} value={p.amount} onChange={event => { setPayments(effectivePayments.map((payment, i) => i === index ? adjustedSalePayment(payment, Number(event.target.value)) : payment)); setAutoBalancePayment(false); }} className="w-full mt-1 bg-white dark:bg-gray-700 text-accent font-bold rounded p-1" />
                                  {!autoBalancePayment && Math.abs(remainingAmount) > .01 && p.amount + remainingAmount >= 0 && <button type="button" onClick={() => setPayments(effectivePayments.map((payment, i) => i === index ? adjustedSalePayment(payment, payment.amount + remainingAmount) : payment))} className="text-xs text-accent underline mt-1">Aplicar diferencia a este pago</button>}
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
                      <div className="flex justify-between"><span>Subtotal:</span><span>{formatCOP(subtotal)}</span></div>
                      <label className="block text-xs">Descuento
                        <div className="flex gap-2 mt-1">
                          <select aria-label="Tipo de descuento" value={discountMode} onChange={event => { setDiscountMode(event.target.value as 'percent' | 'amount'); setDiscountValue('0'); }} className="rounded bg-white dark:bg-gray-700 p-1"><option value="percent">%</option><option value="amount">$</option></select>
                          <input aria-label="Descuento de la venta" type="number" min="0" step="0.01" max={discountMode === 'percent' ? 100 : subtotal} value={discountValue} onChange={event => setDiscountValue(event.target.value)} className="min-w-0 w-full rounded bg-white dark:bg-gray-700 p-1" />
                        </div>
                      </label>
                      <label className="block text-xs">Recargo total ($)
                        <input aria-label="Recargo de la venta" type="number" min="0" step="0.01" value={surchargeInput} onChange={event => setSurchargeInput(event.target.value)} className="mt-1 w-full rounded bg-white dark:bg-gray-700 p-1" />
                      </label>
                      {discountAmount > 0 && <div className="flex justify-between text-rose-500 font-semibold"><span>Descuento{discountMode === 'percent' ? ` (${discountPercent}%)` : ''}:</span><span>-{formatCOP(discountAmount)}</span></div>}
                      <div className="flex justify-between font-bold"><span>Nuevo Total Venta:</span> <span className="text-accent">{formatCOP(totalAmount)}</span></div>
                      <div className="flex justify-between"><span>Total Pagado:</span> <span className="font-bold">{formatCOP(paidAmount)}</span></div>
                      <div className={`flex justify-between font-bold ${remainingAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          <span>{remainingAmount > 0 ? 'Faltante por corregir:' : remainingAmount < 0 ? 'Excedente por corregir:' : 'Saldo:'}</span>
                          <span>{formatCOP(Math.abs(remainingAmount))}</span>
                      </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {saveError && <p role="alert" className="px-4 py-2 text-sm text-red-600">{saveError}</p>}
          {/* Sticky Footer */}
          <div data-testid="edit-sale-mobile-actions" className="px-3 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 sm:flex sm:justify-end gap-2 sm:gap-3 shrink-0 bg-white dark:bg-secondary z-20 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] sm:shadow-none">
            <button type="button" onClick={() => { if (!savingRef.current) onClose(); }} className="w-full sm:w-auto px-3 sm:px-5 py-3 sm:py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 text-sm transition-colors">Cancelar</button>
            <button type="submit" className="w-full sm:w-auto px-3 sm:px-7 py-3 sm:py-2.5 bg-accent text-white font-bold rounded-xl hover:bg-accent-hover text-sm shadow-md transition-colors">{isSaving ? 'Guardando…' : 'Guardar Cambios'}</button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default EditSaleModal;
