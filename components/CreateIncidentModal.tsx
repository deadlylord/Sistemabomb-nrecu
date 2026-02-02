import React, { useState, useEffect, useMemo } from 'react';
import { Incident, IncidentType, Product, Seller, Sale, Store, Customer, ExchangedItem, CartItem, PaymentMethod, Role } from '../types';
import { formatCOP, toTitleCase } from '../constants';
import { TrashIcon, SearchIcon, CrossIcon } from './Icons';
import { doc, collection, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Product[];
  sales: Sale[];
  stores: Store[];
  currentUser: Seller;
  roles: Role[];
  customers: Customer[];
  onCreateIncident: (data: Omit<Incident, 'id' | 'status' | 'createdAt' | 'storeId' | 'sellerName'> & { surplusPaid?: number; surplusPaymentMethod?: PaymentMethod; incidentDate?: string; }) => void;
}

const toYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({ isOpen, onClose, inventory, sales, stores, currentUser, roles, customers, onCreateIncident }) => {
  const [type, setType] = useState<IncidentType>(IncidentType.DAMAGED);
  
  // Common
  const [description, setDescription] = useState('');
  const [incidentDate, setIncidentDate] = useState(toYYYYMMDD(new Date()));
  
  // Customer
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Product
  const [productId, setProductId] = useState<string | ''>('');
  const [productName, setProductName] = useState(''); // For warranty & transfer
  
  // Damaged Product Search
  const [damagedProductSearch, setDamagedProductSearch] = useState('');
  const [showDamagedSuggestions, setShowDamagedSuggestions] = useState(false);

  // Transfer Product Search
  const [transferProductSearch, setTransferProductSearch] = useState('');
  const [showTransferSuggestions, setShowTransferSuggestions] = useState(false);

  // Cash Adjustment & Additional Income
  const [adjustmentType, setAdjustmentType] = useState<'income' | 'expense'>('expense');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');


  // Exchange
  const [originalSaleInvoiceNumber, setOriginalSaleInvoiceNumber] = useState('');
  const [returnedItems, setReturnedItems] = useState<ExchangedItem[]>([]);
  const [takenItems, setTakenItems] = useState<ExchangedItem[]>([]);
  const [originalSale, setOriginalSale] = useState<Sale | null>(null);
  const [takenItemSearch, setTakenItemSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [surplusPaymentMethod, setSurplusPaymentMethod] = useState<PaymentMethod | ''>('');
  const [manualSurplus, setManualSurplus] = useState<string>('');


  // Transfer Request
  const [fromStoreId, setFromStoreId] = useState<string>(currentUser.storeId);
  const [toStoreId, setToStoreId] = useState<string>('');
  const [quantity, setQuantity] = useState('');

  const adminRole = useMemo(() => roles.find(r => r.name === 'Administrator'), [roles]);
  const isAdmin = useMemo(() => currentUser.roleId === adminRole?.id, [currentUser, adminRole]);
  
  const suggestedTakenItems = useMemo(() => {
    if (!takenItemSearch) return [];
    const lowerCaseSearch = takenItemSearch.toLowerCase();
    return inventory.filter(p =>
      !p.isDisabled &&
      p.stock > 0 &&
      p.name.toLowerCase().includes(lowerCaseSearch) &&
      !takenItems.some(item => item.productId === p.id)
    );
  }, [takenItemSearch, inventory, takenItems]);

  const suggestedDamagedProducts = useMemo(() => {
    if (!damagedProductSearch) return [];
    const lowerCaseSearch = damagedProductSearch.toLowerCase();
    return inventory.filter(p =>
      !p.isDisabled &&
      p.name.toLowerCase().includes(lowerCaseSearch)
    );
  }, [damagedProductSearch, inventory]);

  const suggestedTransferProducts = useMemo(() => {
    if (!transferProductSearch) return [];
    const lowerCaseSearch = transferProductSearch.toLowerCase();
    return inventory.filter(p =>
      !p.isDisabled &&
      p.storeId === fromStoreId &&
      p.name.toLowerCase().includes(lowerCaseSearch)
    );
  }, [transferProductSearch, inventory, fromStoreId]);


  useEffect(() => {
    if (originalSaleInvoiceNumber) {
      const foundSale = sales.find(s => s.invoiceNumber.toString() === originalSaleInvoiceNumber);
      setOriginalSale(foundSale || null);
      setReturnedItems([]); // Reset when sale changes
    } else {
      setOriginalSale(null);
      setReturnedItems([]);
    }
  }, [originalSaleInvoiceNumber, sales]);

  const resetForm = () => {
    setType(IncidentType.DAMAGED);
    setDescription('');
    setIncidentDate(toYYYYMMDD(new Date()));
    setCustomerName('');
    setCustomerPhone('');
    setProductId('');
    setProductName('');
    setDamagedProductSearch('');
    setShowDamagedSuggestions(false);
    setTransferProductSearch('');
    setShowTransferSuggestions(false);
    setAdjustmentType('expense');
    setAdjustmentAmount('');
    setPaymentMethod('');
    setOriginalSaleInvoiceNumber('');
    setReturnedItems([]);
    setTakenItems([]);
    setOriginalSale(null);
    setTakenItemSearch('');
    setShowSuggestions(false);
    setSurplusPaymentMethod('');
    setManualSurplus('');
    setFromStoreId(currentUser.storeId);
    setToStoreId('');
    setQuantity('');
  };
  
  const handleClose = () => {
      resetForm();
      onClose();
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        handleClose();
    }
  };
  
  const handleCustomerPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value.replace(/[^0-9]/g, '');
    if (phone.length <= 10) {
        setCustomerPhone(phone);
        if (phone.length === 10) {
            const foundCustomer = customers.find(c => c.phone === phone);
            if (foundCustomer) {
              setCustomerName(toTitleCase(foundCustomer.name));
            }
        }
    }
  };

  const { returnedTotal, takenTotal, difference } = useMemo(() => {
    if (type !== IncidentType.PRODUCT_EXCHANGE) return { returnedTotal: 0, takenTotal: 0, difference: 0 };
    const rt = returnedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tt = takenItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return { returnedTotal: rt, takenTotal: tt, difference: tt - rt };
  }, [type, returnedItems, takenItems]);

  useEffect(() => {
    if (difference > 0) {
        setManualSurplus(difference.toFixed(0));
    } else {
        setManualSurplus('');
    }
  }, [difference]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let data: any = { type, description };
    let product: Product | undefined;

    if (isAdmin && (type === IncidentType.RECAUDO || type === IncidentType.CASH_ADJUSTMENT || type === IncidentType.ADDITIONAL_INCOME)) {
        const [year, month, day] = incidentDate.split('-').map(Number);
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const selectedDate = new Date(year, month - 1, day, hours, minutes, seconds);
        data.incidentDate = selectedDate.toISOString();
    }

    switch (type) {
      case IncidentType.DAMAGED:
        if (!productId) { alert('Selecciona el producto dañado.'); return; }
        product = inventory.find(p => p.id === productId);
        data = { ...data, productId, productName: product?.name };
        break;
      case IncidentType.WARRANTY:
        if (customerPhone.trim().length !== 10) { alert('El número de celular debe tener 10 dígitos.'); return; }
        if (!productName || !customerName || !customerPhone) { alert('Completa los campos de garantía.'); return; }
        data = { ...data, productName, customerName, customerPhone };
        break;
      case IncidentType.CASH_ADJUSTMENT:
        const amount = parseFloat(adjustmentAmount);
        if (isNaN(amount) || amount <= 0) { alert('Ingresa un monto válido.'); return; }
        data = { ...data, adjustmentType, adjustmentAmount: amount };
        break;
      case IncidentType.ADDITIONAL_INCOME:
        const incomeAmount = parseFloat(adjustmentAmount);
        if (isNaN(incomeAmount) || incomeAmount <= 0) { alert('Ingresa un monto de ingreso válido.'); return; }
        if (!paymentMethod) { alert('Selecciona un medio de pago para el ingreso.'); return; }
        data = { ...data, adjustmentType: 'income', adjustmentAmount: incomeAmount, paymentMethod };
        break;
      case IncidentType.PRODUCT_EXCHANGE:
        const surplusPaidAmount = difference > 0 ? parseFloat(manualSurplus) : undefined;
        if (!originalSale || returnedItems.length === 0 || takenItems.length === 0) { alert('Completa todos los campos para el cambio, incluyendo al menos un ítem devuelto y uno a llevar.'); return; }
        if (difference > 0 && !surplusPaymentMethod) {
            alert('Por favor, selecciona un método de pago para el excedente.');
            return;
        }
        if (difference > 0 && (isNaN(surplusPaidAmount) || surplusPaidAmount < 0)) {
            alert('Por favor, ingresa un valor de excedente válido.');
            return;
        }
        data = { ...data, originalSaleId: originalSale.id, originalSaleInvoiceNumber, returnedItems, takenItems, customerName: toTitleCase(originalSale.customerName), customerPhone: originalSale.customerPhone, surplusPaid: surplusPaidAmount, surplusPaymentMethod: surplusPaymentMethod || undefined };
        break;
      case IncidentType.INVENTORY_TRANSFER_REQUEST:
        const qty = parseInt(quantity, 10);
        if (!fromStoreId || !toStoreId || !productId || !productName || !qty || qty <= 0) {
            alert('Por favor, completa todos los campos de la solicitud de traslado.');
            return;
        }
        product = inventory.find(p => p.id === productId);
        if (product && product.stock < qty) {
            alert(`Stock insuficiente. Solo hay ${product.stock} unidades disponibles.`);
            return;
        }
        data = {...data, fromStoreId, toStoreId, productId, productName, quantity: qty};
        break;
       case IncidentType.RECAUDO:
        const recaudoAmount = parseFloat(adjustmentAmount);
        if (customerPhone.trim().length !== 10) { alert('El número de celular debe tener 10 dígitos.'); return; }
        if (!customerPhone || !customerName || isNaN(recaudoAmount) || recaudoAmount <= 0) { alert('Completa todos los campos para el recaudo.'); return; }
        data = { ...data, customerPhone, customerName, adjustmentAmount: recaudoAmount, adjustmentType: 'income' };
        break;
    }
    
    onCreateIncident(data);
    handleClose();
  };
  
  const handleDamagedProductSelect = (product: Product) => {
    setProductId(product.id);
    setDamagedProductSearch(product.name);
    setShowDamagedSuggestions(false);
  }

  const handleTransferProductSelect = (product: Product) => {
    setProductId(product.id);
    setProductName(product.name);
    setTransferProductSearch(product.name);
    setShowTransferSuggestions(false);
  }

  const addReturnedItem = (item: CartItem) => {
    setReturnedItems(prev => {
        const existing = prev.find(i => i.productId === item.id);
        if (existing) {
            const saleItem = originalSale?.items.find(i => i.id === item.id);
            const maxQty = saleItem?.quantity || 0;
            const newQty = Math.min(maxQty, existing.quantity + 1);
            return prev.map(i => i.productId === item.id ? { ...i, quantity: newQty } : i);
        } else {
            return [...prev, { 
              productId: item.id, 
              productName: item.name, 
              quantity: 1, 
              price: item.price, 
              cost: item.cost,
              sku: item.sku,
              categoryId: item.categoryId
            }];
        }
    });
  };
  
  const addTakenItem = (product: Product) => {
    setTakenItems(prev => {
        const existing = prev.find(i => i.productId === product.id);
        const maxQty = product.stock;
        if (existing) {
            const newQty = Math.min(maxQty, existing.quantity + 1);
            return prev.map(i => i.productId === product.id ? { ...i, quantity: newQty } : i);
        } else {
            return [...prev, { 
              productId: product.id, 
              productName: product.name, 
              quantity: 1, 
              price: product.price, 
              cost: product.cost,
              sku: product.sku,
              categoryId: product.categoryId
            }];
        }
    });
    setTakenItemSearch('');
    setShowSuggestions(false);
  };

  const updateItemQuantity = (list: ExchangedItem[], setter: React.Dispatch<React.SetStateAction<ExchangedItem[]>>, productId: string, newQuantity: number) => {
      const saleItem = originalSale?.items.find(i => i.id === productId);
      const product = inventory.find(p => p.id === productId);
      const maxQty = list === returnedItems ? (saleItem?.quantity || 0) : (product?.stock || 0);

      if (newQuantity <= 0) {
          setter(prev => prev.filter(i => i.productId !== productId));
      } else {
          setter(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.min(maxQty, newQuantity) } : i));
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={handleOverlayClick}>
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold text-accent mb-4">Crear Novedad</h2>
        <form onSubmit={handleSubmit} id="incident-form" className="flex-grow overflow-y-auto pr-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Tipo de Novedad</label>
              <select value={type} onChange={e => setType(e.target.value as IncidentType)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                {Object.values(IncidentType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {(isAdmin && (type === IncidentType.RECAUDO || type === IncidentType.CASH_ADJUSTMENT || type === IncidentType.ADDITIONAL_INCOME)) && (
                <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Fecha de la Novedad</label>
                    <input
                        type="date"
                        value={incidentDate}
                        onChange={e => setIncidentDate(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md"
                        required
                    />
                </div>
            )}
          </div>


          {type === IncidentType.DAMAGED && (
            <div className="relative">
                <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Producto Dañado</label>
                <div className="relative">
                    <input
                        type="text"
                        value={damagedProductSearch}
                        onChange={e => {
                            setDamagedProductSearch(e.target.value);
                            setProductId(''); // Clear if user is typing a new search
                        }}
                        onFocus={() => setShowDamagedSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowDamagedSuggestions(false), 200)}
                        placeholder="Buscar producto dañado..."
                        className="w-full bg-gray-100 dark:bg-gray-800 p-2 pl-8 rounded-md"
                        required={!productId}
                        autoComplete="off"
                    />
                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {damagedProductSearch && (
                        <button
                            type="button"
                            onClick={() => {
                                setDamagedProductSearch('');
                                setProductId('');
                            }}
                            className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-8 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                            aria-label="Limpiar búsqueda"
                        >
                            <CrossIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
                {showDamagedSuggestions && suggestedDamagedProducts.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {suggestedDamagedProducts.map(p => (
                            <li
                                key={p.id}
                                onMouseDown={() => handleDamagedProductSelect(p)}
                                className="p-2 cursor-pointer text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                {p.name} (Stock: {p.stock})
                            </li>
                        ))}
                    </ul>
                )}
            </div>
          )}
          
          {type === IncidentType.WARRANTY && (
            <div className="space-y-3">
              <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nombre del Producto en Garantía" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required />
              <input type="tel" value={customerPhone} onChange={handleCustomerPhoneChange} placeholder="Celular del Cliente (10 dígitos)" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required maxLength={10} />
              <input type="text" value={customerName} onChange={e => setCustomerName(toTitleCase(e.target.value))} placeholder="Nombre del Cliente" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required />
            </div>
          )}

          {type === IncidentType.CASH_ADJUSTMENT && (
            <div className="flex gap-4">
              <select value={adjustmentType} onChange={e => setAdjustmentType(e.target.value as any)} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                <option value="expense">Gasto/Salida</option>
                <option value="income">Ingreso Extra</option>
              </select>
              <input type="number" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} placeholder="Monto" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required />
            </div>
          )}
          
          {type === IncidentType.ADDITIONAL_INCOME && (
            <div className="space-y-3">
                <input type="number" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} placeholder="Monto del Ingreso" className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required />
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required>
                    <option value="" disabled>Selecciona Medio de Pago</option>
                    {Object.values(PaymentMethod).map(method => (
                        <option key={method} value={method}>{method}</option>
                    ))}
                </select>
            </div>
          )}
          
          {type === IncidentType.PRODUCT_EXCHANGE && (
            <div className="space-y-3 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                <h4 className="font-bold">Detalles del Cambio</h4>
                <input type="text" value={originalSaleInvoiceNumber} onChange={e => setOriginalSaleInvoiceNumber(e.target.value)} placeholder="Número de Factura Original" className="w-full bg-white dark:bg-primary p-2 rounded-md" required />
                {originalSale ? (
                    <>
                        <p className="text-xs">Cliente: {originalSale.customerName}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {/* Returned Items */}
                           <div className="bg-white/50 dark:bg-primary/50 p-2 rounded-md">
                               <h5 className="font-semibold text-sm mb-2">Prendas a Devolver</h5>
                               <select className="w-full p-1.5 rounded-md mb-2 text-sm" onChange={e => addReturnedItem(originalSale.items.find(i => i.id === e.target.value)!)} value="">
                                   <option value="" disabled>Selecciona de la factura...</option>
                                   {originalSale.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                               </select>
                               <div className="space-y-1 max-h-32 overflow-y-auto">
                                   {returnedItems.map(item => (
                                       <div key={item.productId} className="flex justify-between items-center text-xs bg-red-500/10 p-1.5 rounded">
                                           <span className="truncate flex-1 pr-2">{item.productName}</span>
                                           <div className="flex items-center gap-1">
                                               <input type="number" value={item.quantity} onChange={e => updateItemQuantity(returnedItems, setReturnedItems, item.productId, parseInt(e.target.value))} className="w-10 text-center bg-transparent"/>
                                               <button type="button" onClick={() => updateItemQuantity(returnedItems, setReturnedItems, item.productId, 0)}><TrashIcon className="w-3 h-3 text-red-500"/></button>
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           </div>
                           {/* Taken Items */}
                           <div className="bg-white/50 dark:bg-primary/50 p-2 rounded-md">
                               <h5 className="font-semibold text-sm mb-2">Prendas a Llevar</h5>
                               <div className="relative mb-2">
                                  <input type="text" value={takenItemSearch} onChange={e => setTakenItemSearch(e.target.value)} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Buscar en inventario..." className="w-full p-1.5 pl-8 pr-8 rounded-md text-sm" />
                                  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  {takenItemSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setTakenItemSearch('')}
                                        className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-8 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                        aria-label="Limpiar búsqueda"
                                    >
                                        <CrossIcon className="w-4 h-4" />
                                    </button>
                                  )}
                                  {showSuggestions && suggestedTakenItems.length > 0 && (
                                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                      {suggestedTakenItems.map(p => <li key={p.id} onMouseDown={() => addTakenItem(p)} className="p-2 cursor-pointer text-xs hover:bg-gray-100 dark:hover:bg-gray-700">{p.name}</li>)}
                                    </ul>
                                  )}
                               </div>
                               <div className="space-y-1 max-h-32 overflow-y-auto">
                                   {takenItems.map(item => (
                                       <div key={item.productId} className="flex justify-between items-center text-xs bg-green-500/10 p-1.5 rounded">
                                           <span className="truncate flex-1 pr-2">{item.productName}</span>
                                           <div className="flex items-center gap-1">
                                               <input type="number" value={item.quantity} onChange={e => updateItemQuantity(takenItems, setTakenItems, item.productId, parseInt(e.target.value))} className="w-10 text-center bg-transparent"/>
                                               <button type="button" onClick={() => updateItemQuantity(takenItems, setTakenItems, item.productId, 0)}><TrashIcon className="w-3 h-3 text-red-500"/></button>
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           </div>
                        </div>
                        <div className="mt-2 p-2 rounded-md text-center font-bold bg-gray-200 dark:bg-gray-900">
                           <p>Total Devuelto: <span className="text-red-500">{formatCOP(returnedTotal)}</span></p>
                           <p>Total a Llevar: <span className="text-green-500">{formatCOP(takenTotal)}</span></p>
                           <div className={`mt-1 pt-1 border-t border-dashed ${difference >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                               {difference > 0 ? (
                                   <div className='space-y-2'>
                                       <p className="text-sm font-normal text-gray-500 dark:text-text-dark">Excedente (Sistema): {formatCOP(difference)}</p>
                                       <div className="flex items-center justify-center gap-2">
                                           <label htmlFor="manualSurplus" className="font-bold">Paga Excedente:</label>
                                           <input
                                               id="manualSurplus"
                                               type="number"
                                               value={manualSurplus}
                                               onChange={e => setManualSurplus(e.target.value)}
                                               className="w-32 bg-white dark:bg-primary p-1 rounded-md text-center font-bold text-red-500 border border-gray-300 dark:border-gray-600 focus:ring-accent focus:border-accent"
                                               min="0"
                                               step="1000"
                                           />
                                       </div>
                                       <div className="mt-2">
                                           <label className="text-xs font-normal">Paga con:</label>
                                           <select value={surplusPaymentMethod} onChange={e => setSurplusPaymentMethod(e.target.value as PaymentMethod)} className="ml-2 p-1 text-sm rounded" required>
                                               <option value="" disabled>Método de Pago</option>
                                               {Object.values(PaymentMethod).map(method => (
                                                   <option key={method} value={method}>{method}</option>
                                               ))}
                                           </select>
                                       </div>
                                   </div>
                               ) : (
                                   <p>Saldo a Favor: {formatCOP(Math.abs(difference))}</p>
                               )}
                           </div>
                        </div>
                    </>
                ) : originalSaleInvoiceNumber && (
                     <p className="text-red-500 text-xs">Factura no encontrada.</p>
                )}
            </div>
          )}

          {type === IncidentType.INVENTORY_TRANSFER_REQUEST && (
            <div className="space-y-3 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                <h4 className="font-bold">Detalles del Traslado</h4>
                <div className="grid grid-cols-2 gap-3">
                    <select value={fromStoreId} onChange={e => setFromStoreId(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md" disabled>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                     <select value={toStoreId} onChange={e => setToStoreId(e.target.value)} className="w-full bg-white dark:bg-primary p-2 rounded-md" required>
                        <option value="" disabled>Tienda Destino</option>
                        {stores.filter(s => s.id !== fromStoreId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="relative">
                    <div className="relative">
                        <input
                            type="text"
                            value={transferProductSearch}
                            onChange={e => {
                                setTransferProductSearch(e.target.value);
                                setProductId('');
                            }}
                            onFocus={() => setShowTransferSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowTransferSuggestions(false), 200)}
                            placeholder="Buscar producto a trasladar..."
                            className="w-full bg-white dark:bg-primary p-2 pl-8 rounded-md"
                            required={!productId}
                            autoComplete="off"
                        />
                        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        {transferProductSearch && (
                            <button
                                type="button"
                                onClick={() => {
                                    setTransferProductSearch('');
                                    setProductId('');
                                }}
                                className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-8 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                aria-label="Limpiar búsqueda"
                            >
                                <CrossIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {showTransferSuggestions && suggestedTransferProducts.length > 0 && (
                        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {suggestedTransferProducts.map(p => (
                                <li
                                    key={p.id}
                                    onMouseDown={() => handleTransferProductSelect(p)}
                                    className="p-2 cursor-pointer text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    {p.name} (Stock: {p.stock})
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Cantidad" className="w-full bg-white dark:bg-primary p-2 rounded-md" required min="1"/>
            </div>
          )}

          {type === IncidentType.RECAUDO && (
            <div className="space-y-3 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                <h4 className="font-bold">Detalles del Recaudo</h4>
                <input type="tel" value={customerPhone} onChange={handleCustomerPhoneChange} placeholder="Celular del Cliente (10 dígitos)" className="w-full bg-white dark:bg-primary p-2 rounded-md" required maxLength={10} />
                <input type="text" value={customerName} onChange={e => setCustomerName(toTitleCase(e.target.value))} placeholder="Nombre del Cliente" className="w-full bg-white dark:bg-primary p-2 rounded-md" required />
                <input type="number" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} placeholder="Monto Recaudado" className="w-full bg-white dark:bg-primary p-2 rounded-md" required />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Descripción / Motivo</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" required></textarea>
          </div>

        </form>
        <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
          <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md">Cancelar</button>
          <button type="submit" form="incident-form" className="px-4 py-2 bg-accent text-white rounded-md">Guardar Novedad</button>
        </div>
      </div>
    </div>
  );
};

export default CreateIncidentModal;