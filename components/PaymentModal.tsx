
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Seller, Customer, Payment, Store, GiftVoucher } from '../types';
import { formatCOP, toTitleCase } from '../constants';
import { TrashIcon } from './Icons';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  sellers: Seller[];
  customers: Customer[];
  onProcessSale: (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; discountPercent?: number; discountAmount?: number; }, saleDate: Date) => void;
  saleDate: Date;
  onHoldSale: (data: { customer: { name: string; phone: string }; sellerName: string; }) => void;
  initialCustomerInfo: {name: string, phone: string} | null;
  currentStore: Store | undefined;
  giftVouchers: GiftVoucher[];
  onUpdateGiftVoucher: (voucherId: string, updates: Partial<GiftVoucher>) => Promise<void>;
  discountPercent?: number;
  discountAmount?: number;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, total, sellers, customers, onProcessSale, saleDate, onHoldSale, initialCustomerInfo, currentStore, giftVouchers, onUpdateGiftVoucher, discountPercent, discountAmount }) => {
  const [payments, setPayments] = useState<Omit<Payment, 'date' | 'seller'>[]>([]);
  const [amountInput, setAmountInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedSeller, setSelectedSeller] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [isVoucherValidating, setIsVoucherValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    const timer = setTimeout(() => {
      setErrorMsg(current => current === msg ? null : current);
    }, 4500);
    return () => clearTimeout(timer);
  };

  const paidAmount = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const remainingAmount = total - paidAmount;
  const change = remainingAmount < 0 ? Math.abs(remainingAmount) : 0;
  const isFullyPaid = remainingAmount <= 0;

  useEffect(() => {
    setPayments([]);
    setSelectedSeller('');
    setVoucherCode('');
    setErrorMsg(null);
    setCustomerName(initialCustomerInfo?.name || '');
    setCustomerPhone(initialCustomerInfo?.phone || '');
  }, [total, initialCustomerInfo]);

  useEffect(() => {
    if (isOpen) {
      if (remainingAmount > 0) {
        setAmountInput(remainingAmount.toFixed(0));
      } else {
        setAmountInput('');
      }
    }
  }, [isOpen, remainingAmount]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value.replace(/[^0-9]/g, '');
    if (phone.length <= 10) {
        setCustomerPhone(phone);
        if (phone.length === 10) {
            const foundCustomer = customers.find(c => c.phone === phone);
            if (foundCustomer) {
              setCustomerName(foundCustomer.name);
            }
        }
    }
  };
  
  const handleAddPayment = async (method: PaymentMethod) => {
    setErrorMsg(null);
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      triggerError("Por favor, ingresa un monto válido.");
      return;
    }
    
    // Calculate current remaining amount based on current payments state
    const currentPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const currentRemaining = total - currentPaid;

    if (method === PaymentMethod.Bono) {
        const trimmedCode = voucherCode.trim().toUpperCase();
        if (!trimmedCode) {
            triggerError("Ingresa el código del bono.");
            return;
        }
        setIsVoucherValidating(true);
        
        const voucher = giftVouchers.find(v => v.code.toUpperCase() === trimmedCode);
        
        if (!voucher) {
            triggerError(`Bono "${trimmedCode}" no encontrado. Asegúrate de que el código sea correcto.`);
            setIsVoucherValidating(false);
            return;
        }
        if (voucher.status !== 'active' || voucher.currentValue <= 0) {
            triggerError(`Este bono no está activo o no tiene saldo. Saldo actual: ${formatCOP(voucher.currentValue)}`);
            setIsVoucherValidating(false);
            return;
        }

        const amountToUse = Math.min(amount, voucher.currentValue, currentRemaining);
        if (amountToUse <= 0) {
            triggerError(`No se puede aplicar el bono. Saldo: ${formatCOP(voucher.currentValue)}, Faltante: ${formatCOP(currentRemaining)}`);
            setIsVoucherValidating(false);
            return;
        }

        setPayments(prev => [...prev, { amount: amountToUse, method, voucherId: voucher.id, voucherCode: voucher.code }]);
        setVoucherCode('');
        setAmountInput(''); 
        setIsVoucherValidating(false);
    } else {
        let amountToUse = amount;
        if (method !== PaymentMethod.Efectivo) {
            amountToUse = Math.min(amount, currentRemaining);
            if (amountToUse <= 0 && currentRemaining <= 0) {
                triggerError("La venta ya está totalmente pagada.");
                return;
            }
        }
        setPayments(prev => [...prev, { amount: amountToUse, method }]);
    }
  };

  const handleRemovePayment = (indexToRemove: number) => {
    setPayments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleFinalize = () => {
    setErrorMsg(null);
    if (!isFullyPaid) {
      triggerError("Aún falta por pagar el total de la venta.");
      return;
    }
    if (!selectedSeller) {
      triggerError("Por favor, selecciona un vendedor.");
      return;
    }
    
    const finalCustomerName = toTitleCase(customerName.trim() || 'Cliente Mostrador');
    const finalCustomerPhone = customerPhone.trim() || 'N/A';
    
    if (finalCustomerPhone !== 'N/A' && finalCustomerPhone.length !== 10) {
        triggerError('El número de celular debe tener 10 dígitos o dejarse vacío.');
        return;
    }
    
    const finalPayments: Payment[] = payments.map(p => ({
        ...p,
        date: saleDate.toISOString(),
        seller: selectedSeller,
    }));
    
    onProcessSale({
      payments: finalPayments,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      seller: selectedSeller,
      discountPercent,
      discountAmount,
    }, saleDate);
    
    onClose();
  };

  const handleHold = () => {
    setErrorMsg(null);
    const finalCustomerName = toTitleCase(customerName.trim() || 'Cliente Mostrador');
    const finalCustomerPhone = customerPhone.trim() || 'N/A';
    if (!selectedSeller) {
        triggerError("Por favor, selecciona un vendedor para poner la venta en espera.");
        return;
    }
    onHoldSale({ 
        customer: { name: finalCustomerName, phone: finalCustomerPhone },
        sellerName: selectedSeller,
    });
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        onClose();
    }
  };
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white dark:bg-secondary rounded-2xl shadow-2xl p-4 w-full max-w-3xl max-h-[95vh] flex flex-col border border-slate-100 dark:border-slate-800"
      >
        {/* Header Compacto */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div>
            <h2 className="text-lg font-black tracking-tight text-accent uppercase">Procesar Pago</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Punto de Venta</p>
          </div>
          
          <div className="text-right">
            {discountPercent && discountPercent > 0 ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Subtotal: <span className="line-through">{formatCOP(total + (discountAmount || 0))}</span></span>
                  <span className="inline-block bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">
                    Desc: -{formatCOP(discountAmount || 0)} ({discountPercent}%)
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 px-3 py-1 rounded-xl border border-slate-100 dark:border-slate-800 text-right">
                  <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">Total Final</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{formatCOP(total)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/40 px-3 py-1 rounded-xl border border-slate-100 dark:border-slate-800 text-right">
                <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">Total a Pagar</span>
                <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{formatCOP(total)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dos Columnas Compactas */}
        <div className="flex-grow grid md:grid-cols-12 gap-3.5 py-3 overflow-y-auto min-h-0">
          {/* Columna Izquierda: Datos del Pago y Cliente (7 cols on md) */}
          <div className="md:col-span-7 flex flex-col gap-3.5">
            {/* Vendedor */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Vendedor (Obligatorio)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {sellers.filter(s => !s.isDisabled).map(seller => (
                  <button 
                    key={seller.id} 
                    onClick={() => { setErrorMsg(null); setSelectedSeller(seller.name); }} 
                    className={`py-1.5 px-2 rounded-xl font-black transition-all text-xs border text-center ${
                      selectedSeller === seller.name 
                        ? 'bg-accent text-white border-accent ring-2 ring-accent/30 shadow-md shadow-accent/20' 
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {seller.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5 space-y-1.5">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Datos del Cliente (Opcional)</h3>
              <div className="grid grid-cols-2 gap-2">
                 <input 
                    type="tel" 
                    value={customerPhone} 
                    onChange={handlePhoneChange} 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-slate-800 dark:text-white" 
                    placeholder="Celular (10 dígitos)" 
                    maxLength={10}
                 />
                 <input 
                    type="text" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                    onBlur={() => setCustomerName(prev => toTitleCase(prev))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-slate-800 dark:text-white" 
                    placeholder="Nombre Cliente"
                 />
              </div>
            </div>
            
            {/* Agregar Pago */}
            {!isFullyPaid && (
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5 space-y-2.5 flex-grow flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Monto y Redención de Bonos</h3>
                  <div className="flex gap-1.5 items-center">
                    <div className="relative flex-grow">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">$</span>
                      <input 
                        type="number" 
                        id="amountInput" 
                        value={amountInput} 
                        onChange={e => setAmountInput(e.target.value)} 
                        className="w-full bg-slate-50 dark:bg-slate-800/50 pl-6 pr-2.5 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700 font-black text-sm text-slate-800 dark:text-white" 
                        placeholder="0" 
                        min="0" 
                        step="1000" 
                      />
                    </div>
                    <input 
                        type="text" 
                        value={voucherCode} 
                        onChange={e => setVoucherCode(e.target.value.toUpperCase())} 
                        className="w-24 bg-pink-500/5 dark:bg-pink-500/10 border border-pink-500/20 px-2 py-1.5 rounded-xl text-xs font-mono font-black text-pink-600 dark:text-pink-400" 
                        placeholder="COD. BONO"
                    />
                    <button 
                        type="button"
                        onClick={() => handleAddPayment(PaymentMethod.Bono)}
                        disabled={isVoucherValidating || !voucherCode.trim()}
                        className="px-3 py-1.5 bg-pink-500 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-pink-600 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                    >
                        {isVoucherValidating ? '...' : 'Redimir'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.values(PaymentMethod).filter(m => m !== PaymentMethod.Bono).map(method => {
                      let label: string = method;
                      if (method === PaymentMethod.Efectivo && currentStore?.accountLabels?.cash) label = currentStore.accountLabels.cash;
                      if ([PaymentMethod.Nequi, PaymentMethod.Daviplata, PaymentMethod.QR].includes(method) && currentStore?.accountLabels?.qr) {
                          if (method === PaymentMethod.QR) label = currentStore.accountLabels.qr;
                      }
                      
                      return (
                        <button 
                          key={method} 
                          type="button" 
                          onClick={() => handleAddPayment(method)} 
                          className="py-1.5 px-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-accent hover:text-white hover:border-accent dark:hover:bg-accent dark:hover:text-white transition-all text-[11px] text-center"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Columna Derecha: Resumen de Pago (5 cols on md) */}
          <div className="md:col-span-5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 p-3 rounded-2xl flex flex-col justify-between min-h-[180px] md:min-h-0">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Resumen de Pago</h3>
              <div className="space-y-1.5 max-h-[160px] md:max-h-[220px] overflow-y-auto pr-1">
                {payments.length > 0 ? payments.map((p, index) => (
                  <div key={index} className="flex justify-between items-center bg-white dark:bg-secondary p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                    <div>
                      <p className="font-black text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                          {p.method === PaymentMethod.Efectivo && currentStore?.accountLabels?.cash ? currentStore.accountLabels.cash : 
                           (p.method === PaymentMethod.QR && currentStore?.accountLabels?.qr ? currentStore.accountLabels.qr : p.method)}
                          {p.voucherCode && <span className="ml-1 px-1 bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400 font-mono text-[9px] rounded font-bold">{p.voucherCode}</span>}
                      </p>
                      <p className="text-xs font-black text-accent">{formatCOP(p.amount)}</p>
                    </div>
                    <button 
                      onClick={() => handleRemovePayment(index)} 
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      title="Eliminar este pago"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                    <p className="text-xs font-bold text-center">Sin pagos agregados.</p>
                    <p className="text-[9px] text-center mt-0.5">Elige un método de pago a la izquierda.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-dashed border-slate-200 dark:border-slate-700/80 pt-2.5 mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400 font-bold">
                <span>Total Pagado:</span> 
                <span className="font-black text-slate-800 dark:text-white">{formatCOP(paidAmount)}</span>
              </div>
              <div className={`flex justify-between font-bold ${remainingAmount > 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>
                <span>Faltante:</span> 
                <span className="font-black">{formatCOP(remainingAmount > 0 ? remainingAmount : 0)}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between text-emerald-500 font-bold bg-emerald-500/10 dark:bg-emerald-500/5 p-1 rounded-lg border border-emerald-500/10">
                  <span>Cambio / Devolución:</span> 
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCOP(change)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Banner de error inline no-bloqueante */}
        {errorMsg && (
          <div className="mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-2 rounded-xl text-xs font-black text-center animate-pulse">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Footer Compacto */}
        <div className="flex justify-end items-center gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            Cancelar
          </button>
          
          <button 
            type="button" 
            onClick={handleHold} 
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
          >
            Poner en Espera
          </button>
          
          <button 
            type="button" 
            onClick={handleFinalize} 
            disabled={!isFullyPaid || !selectedSeller} 
            className="px-5 py-2 bg-accent hover:bg-accent-hover disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:text-slate-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
          >
            Finalizar Venta
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
