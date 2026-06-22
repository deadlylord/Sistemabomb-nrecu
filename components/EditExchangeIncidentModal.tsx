import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Incident, IncidentType, Product, Sale, ExchangedItem, CartItem, PaymentMethod, IncidentStatus } from '../types';
import { formatCOP, toTitleCase } from '../constants';
import { TrashIcon, SearchIcon, CrossIcon } from './Icons';

interface EditExchangeIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident;
  inventory: Product[];
  sales: Sale[];
  onUpdateIncident: (incident: Incident) => void;
  isAdmin: boolean;
}

const EditExchangeIncidentModal: React.FC<EditExchangeIncidentModalProps> = ({
  isOpen,
  onClose,
  incident,
  inventory,
  sales,
  onUpdateIncident,
  isAdmin
}) => {
  // State for all editable fields
  const [description, setDescription] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [originalSaleInvoiceNumber, setOriginalSaleInvoiceNumber] = useState('');
  const [originalSale, setOriginalSale] = useState<Sale | null>(null);
  const [returnedItems, setReturnedItems] = useState<ExchangedItem[]>([]);
  const [takenItems, setTakenItems] = useState<ExchangedItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [surplusPaymentMethod, setSurplusPaymentMethod] = useState<PaymentMethod | ''>('');
  const [manualSurplus, setManualSurplus] = useState<string>('');
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  
  // UI State
  const [takenItemSearch, setTakenItemSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isLoadedRef = useRef(false);
  const prevDifferenceRef = useRef<number | null>(null);

  // Populate state from prop on open
  useEffect(() => {
    if (incident && incident.type === IncidentType.PRODUCT_EXCHANGE) {
      setDescription(incident.description);
      
      const incidentDate = new Date(incident.createdAt);
      incidentDate.setMinutes(incidentDate.getMinutes() - incidentDate.getTimezoneOffset());
      setCreatedAt(incidentDate.toISOString().slice(0, 16));
      
      setOriginalSaleInvoiceNumber(incident.originalSaleInvoiceNumber || '');
      const foundSale = sales.find(s => s.invoiceNumber.toString() === incident.originalSaleInvoiceNumber);
      setOriginalSale(foundSale || null);

      setReturnedItems(incident.returnedItems ? incident.returnedItems.map(item => ({ ...item })) : []);
      setTakenItems(incident.takenItems ? incident.takenItems.map(item => ({ ...item })) : []);
      
      setCustomerName(incident.customerName || '');
      setCustomerPhone(incident.customerPhone || '');
      
      setSurplusPaymentMethod(incident.paymentMethod || '');
      setManualSurplus(incident.adjustmentAmount ? incident.adjustmentAmount.toString() : '');
      setStatus(incident.status);

      isLoadedRef.current = false;
      prevDifferenceRef.current = null;
    }
  }, [incident, sales]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value.replace(/[^0-9]/g, '');
    if (phone.length <= 10) {
        setCustomerPhone(phone);
    }
  };

  const suggestedTakenItems = useMemo(() => {
    if (!takenItemSearch) return [];
    const lowerCaseSearch = takenItemSearch.toLowerCase();
    return inventory.filter(p =>
      !p.isDisabled &&
      p.name.toLowerCase().includes(lowerCaseSearch) &&
      !takenItems.some(item => item.productId === p.id)
    );
  }, [takenItemSearch, inventory, takenItems]);
  
  useEffect(() => {
    if (originalSaleInvoiceNumber) {
      const foundSale = sales.find(s => s.invoiceNumber.toString() === originalSaleInvoiceNumber);
      setOriginalSale(foundSale || null);
      if (incident.originalSaleInvoiceNumber !== originalSaleInvoiceNumber) {
        setReturnedItems([]); // Reset ONLY if sale is changed manually by the user
      }
    } else {
      setOriginalSale(null);
      setReturnedItems([]);
    }
  }, [originalSaleInvoiceNumber, sales, incident.originalSaleInvoiceNumber]);

  const { returnedTotal, takenTotal, difference } = useMemo(() => {
    const rt = returnedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tt = takenItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return { returnedTotal: rt, takenTotal: tt, difference: tt - rt };
  }, [returnedItems, takenItems]);

  useEffect(() => {
    if (!isLoadedRef.current) {
      isLoadedRef.current = true;
      prevDifferenceRef.current = difference;
      return;
    }

    if (difference !== prevDifferenceRef.current) {
      setManualSurplus(difference > 0 ? difference.toFixed(0) : '');
      prevDifferenceRef.current = difference;
    }
  }, [difference]);

  const addReturnedItem = (item: CartItem) => {
    setReturnedItems(prev => {
        const existing = prev.find(i => i.productId === item.id);
        if (existing) {
            const saleItem = originalSale?.items.find(i => i.id === item.id);
            const maxQty = saleItem?.quantity || 999;
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
        const maxQty = 999;
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
      const maxQty = list === returnedItems ? (saleItem?.quantity || 999) : 999;

      if (newQuantity <= 0) {
          setter(prev => prev.filter(i => i.productId !== productId));
      } else {
          setter(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.min(maxQty, newQuantity) } : i));
      }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerPhone.trim() && customerPhone.trim().length !== 10) {
      alert("El número de celular debe tener exactamente 10 dígitos.");
      return;
    }
    const surplusPaidAmount = parseFloat(manualSurplus) || 0;
    if (surplusPaidAmount > 0 && !surplusPaymentMethod) {
      alert('Selecciona un método de pago para el excedente.');
      return;
    }
    if (surplusPaidAmount > 0 && (isNaN(surplusPaidAmount) || surplusPaidAmount <= 0)) {
      alert('Ingresa un valor de excedente válido.');
      return;
    }

    const { adjustmentAmount: oldAdjustment, paymentMethod: oldPaymentMethod, ...restOfIncident } = incident;

    const updatedIncident: Incident = {
        ...restOfIncident,
        description,
        createdAt: new Date(createdAt).toISOString(),
        originalSaleId: originalSale ? originalSale.id : (incident.originalSaleId || ''),
        originalSaleInvoiceNumber,
        returnedItems,
        takenItems,
        customerName: toTitleCase(customerName),
        customerPhone,
        status,
    };

    if (surplusPaidAmount > 0 && surplusPaymentMethod) {
        updatedIncident.adjustmentAmount = surplusPaidAmount;
        updatedIncident.paymentMethod = surplusPaymentMethod;
    } else {
        updatedIncident.adjustmentAmount = 0;
        updatedIncident.paymentMethod = undefined;
    }
    
    onUpdateIncident(updatedIncident);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold text-accent mb-4">Editar Novedad de Cambio</h2>
        <form onSubmit={handleSubmit} id="edit-exchange-form" className="flex-grow overflow-y-auto pr-2 space-y-4">
            <div className="space-y-3 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                <h4 className="font-bold">Detalles del Cambio</h4>
                <input 
                  type="text" 
                  value={originalSaleInvoiceNumber} 
                  onChange={e => setOriginalSaleInvoiceNumber(e.target.value)} 
                  placeholder="Número de Factura Original" 
                  className="w-full bg-white dark:bg-primary p-2 rounded-md font-semibold text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-gray-700" 
                  required 
                />
                {!originalSale && originalSaleInvoiceNumber && (
                    <p className="text-amber-500 dark:text-amber-400 text-[11px] font-semibold px-1">
                        Nota: La factura #{originalSaleInvoiceNumber} no se encuentra cargada en la lista local actual, pero se conservan las prendas registradas y puedes corregir montos y método de pago libremente.
                    </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <input 
                      type="text" 
                      value={customerName} 
                      onChange={e => setCustomerName(toTitleCase(e.target.value))} 
                      placeholder="Nombre Cliente" 
                      className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700 text-slate-800 dark:text-slate-100" 
                    />
                    <input 
                      type="tel" 
                      value={customerPhone} 
                      onChange={handlePhoneChange} 
                      placeholder="Celular Cliente (10 dígitos)" 
                      className="w-full bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700 text-slate-800 dark:text-slate-100" 
                      maxLength={10} 
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {/* Returned Items */}
                   <div className="bg-white/50 dark:bg-primary/50 p-2 rounded-md">
                       <h5 className="font-semibold text-sm mb-2">Prendas a Devolver</h5>
                       {originalSale ? (
                           <select 
                             className="w-full p-1.5 rounded-md mb-2 text-sm bg-white dark:bg-primary text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-gray-700" 
                             onChange={e => {
                               const found = originalSale.items.find(i => i.id === e.target.value);
                               if (found) addReturnedItem(found);
                             }} 
                             value=""
                           >
                               <option value="" disabled>Selecciona de la factura...</option>
                               {originalSale.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                           </select>
                       ) : (
                           <p className="text-[11px] text-amber-500 dark:text-amber-400 font-medium mb-2 leading-tight">
                               No se cargó la factura en el listado activo: No se pueden agregar más devueltos. Te habilitamos la edición o eliminación de las prendas ya guardadas.
                           </p>
                       )}
                       <div className="space-y-1 max-h-32 overflow-y-auto">
                           {returnedItems.map(item => (
                               <div key={item.productId} className="flex justify-between items-center text-xs bg-red-500/10 p-1.5 rounded">
                                   <span className="truncate flex-1 pr-2">{item.productName}</span>
                                   <div className="flex items-center gap-1">
                                       <span className="text-gray-400 mr-1">Cant:</span>
                                       <input 
                                         type="number" 
                                         value={item.quantity} 
                                         onChange={e => updateItemQuantity(returnedItems, setReturnedItems, item.productId, parseInt(e.target.value))} 
                                         className="w-10 text-center bg-white dark:bg-primary text-slate-800 dark:text-slate-100 rounded border border-gray-200 dark:border-gray-700 py-0.5"
                                         min="1"
                                       />
                                       <button type="button" onClick={() => updateItemQuantity(returnedItems, setReturnedItems, item.productId, 0)} className="ml-1">
                                           <TrashIcon className="w-3.5 h-3.5 text-red-500 hover:scale-110 transition-transform" />
                                       </button>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
                   {/* Taken Items */}
                   <div className="bg-white/50 dark:bg-primary/50 p-2 rounded-md">
                       <h5 className="font-semibold text-sm mb-2">Prendas a Llevar</h5>
                       <div className="relative mb-2">
                          <input 
                            type="text" 
                            value={takenItemSearch} 
                            onChange={e => setTakenItemSearch(e.target.value)} 
                            onFocus={() => setShowSuggestions(true)} 
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                            placeholder="Buscar en inventario..." 
                            className="w-full p-1.5 pl-8 pr-8 rounded-md text-sm bg-white dark:bg-primary border border-gray-300 dark:border-gray-700 text-slate-800 dark:text-slate-100" 
                          />
                          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          {takenItemSearch && (
                            <button type="button" onClick={() => setTakenItemSearch('')} className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-8 text-gray-500">
                                <CrossIcon className="w-4 h-4" />
                            </button>
                          )}
                          {showSuggestions && suggestedTakenItems.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-md shadow-lg max-h-40 overflow-y-auto">
                              {suggestedTakenItems.map(p => (
                                <li 
                                  key={p.id} 
                                  onMouseDown={() => addTakenItem(p)} 
                                  className="p-2 cursor-pointer text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-slate-800 dark:text-slate-100"
                                >
                                  {p.name}
                                </li>
                              ))}
                            </ul>
                          )}
                       </div>
                       <div className="space-y-1 max-h-32 overflow-y-auto">
                           {takenItems.map(item => (
                               <div key={item.productId} className="flex justify-between items-center text-xs bg-green-500/10 p-1.5 rounded">
                                   <span className="truncate flex-1 pr-2">{item.productName}</span>
                                   <div className="flex items-center gap-1">
                                       <span className="text-gray-400 mr-1">Cant:</span>
                                       <input 
                                         type="number" 
                                         value={item.quantity} 
                                         onChange={e => updateItemQuantity(takenItems, setTakenItems, item.productId, parseInt(e.target.value))} 
                                         className="w-10 text-center bg-white dark:bg-primary text-slate-800 dark:text-slate-100 rounded border border-gray-200 dark:border-gray-700 py-0.5"
                                         min="1"
                                       />
                                       <button type="button" onClick={() => updateItemQuantity(takenItems, setTakenItems, item.productId, 0)} className="ml-1">
                                           <TrashIcon className="w-3.5 h-3.5 text-red-500 hover:scale-110 transition-transform" />
                                       </button>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
                </div>
                <div className="mt-2 p-2 rounded-md text-center font-bold bg-gray-200 dark:bg-gray-900 text-slate-800 dark:text-slate-100">
                   <p>Total Devuelto: <span className="text-red-500">{formatCOP(returnedTotal)}</span></p>
                   <p>Total a Llevar: <span className="text-green-500">{formatCOP(takenTotal)}</span></p>
                   <div className="mt-1 pt-1 border-t border-dashed border-gray-300 dark:border-gray-700">
                       {(difference > 0 || parseFloat(manualSurplus) > 0 || !!surplusPaymentMethod) ? (
                           <div className="space-y-2 text-red-500">
                               <div className="flex items-center justify-center gap-2">
                                   <label htmlFor="manualSurplus" className="font-bold">Paga Excedente:</label>
                                   <input 
                                     id="manualSurplus" 
                                     type="number" 
                                     value={manualSurplus} 
                                     onChange={e => setManualSurplus(e.target.value)} 
                                     className="w-32 bg-white dark:bg-primary p-1 rounded-md text-center font-bold text-red-500 border border-gray-300 dark:border-gray-600 focus:ring-accent focus:border-accent outline-none" 
                                     min="0" 
                                     step="1000" 
                                   />
                               </div>
                               {isAdmin ? (
                                   <div className="mt-2">
                                       <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Paga con:</label>
                                       <select 
                                         value={surplusPaymentMethod} 
                                         onChange={e => setSurplusPaymentMethod(e.target.value as PaymentMethod)} 
                                         className="ml-2 p-1 text-sm rounded bg-white dark:bg-primary text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-gray-700 focus:ring-accent focus:border-accent outline-none" 
                                         required
                                       >
                                           <option value="" disabled>Método de Pago</option>
                                           {Object.values(PaymentMethod).map(method => (
                                             <option key={method} value={method}>{method}</option>
                                           ))}
                                       </select>
                                   </div>
                               ) : surplusPaymentMethod ? (
                                   <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                       Paga con: <span className="font-bold text-accent">{surplusPaymentMethod}</span>
                                   </div>
                               ) : null}
                           </div>
                       ) : (
                           <p className="text-green-500">Saldo a Favor: {formatCOP(Math.abs(difference))}</p>
                       )}
                   </div>
                </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Estado (Admin)</label>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value as IncidentStatus)} 
                className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-gray-700 focus:ring-accent focus:border-accent outline-none"
                disabled={incident.status === IncidentStatus.CAMBIO_PROCESADO}
              >
                  {Object.values(IncidentStatus)
                    .filter(s => s !== IncidentStatus.CAMBIO_PROCESADO || incident.status === IncidentStatus.CAMBIO_PROCESADO)
                    .map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Fecha de la Novedad</label>
                <input 
                  type="datetime-local" 
                  value={createdAt} 
                  onChange={e => setCreatedAt(e.target.value)} 
                  className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-gray-700 focus:ring-accent focus:border-accent outline-none" 
                  required 
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Descripción / Motivo</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows={3} 
                  className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-gray-700 focus:ring-accent focus:border-accent outline-none" 
                  required
                ></textarea>
            </div>
        </form>
        <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-slate-700 dark:text-slate-200">Cancelar</button>
          <button type="submit" form="edit-exchange-form" className="px-4 py-2 bg-accent text-white rounded-md font-semibold font-sans hover:brightness-110 active:scale-95 transition-all">Guardar Cambios</button>
        </div>
      </div>
    </div>
  );
};

export default EditExchangeIncidentModal;
