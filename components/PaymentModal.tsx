
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
  onProcessSale: (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; }, saleDate: Date) => void;
  saleDate: Date;
  onHoldSale: (data: { customer: { name: string; phone: string }; sellerName: string; }) => void;
  initialCustomerInfo: {name: string, phone: string} | null;
  currentStore: Store | undefined;
  giftVouchers: GiftVoucher[];
  onUpdateGiftVoucher: (voucherId: string, updates: Partial<GiftVoucher>) => Promise<void>;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, total, sellers, customers, onProcessSale, saleDate, onHoldSale, initialCustomerInfo, currentStore, giftVouchers, onUpdateGiftVoucher }) => {
  const [payments, setPayments] = useState<Omit<Payment, 'date' | 'seller'>[]>([]);
  const [amountInput, setAmountInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedSeller, setSelectedSeller] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [isVoucherValidating, setIsVoucherValidating] = useState(false);

  const paidAmount = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const remainingAmount = total - paidAmount;
  const change = remainingAmount < 0 ? Math.abs(remainingAmount) : 0;
  const isFullyPaid = remainingAmount <= 0;

  useEffect(() => {
    setPayments([]);
    setSelectedSeller('');
    setVoucherCode('');
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
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      alert("Por favor, ingresa un monto válido.");
      return;
    }
    
    if (method === PaymentMethod.Bono) {
        if (!voucherCode) {
            alert("Ingresa el código del bono.");
            return;
        }
        setIsVoucherValidating(true);
        const voucher = giftVouchers.find(v => v.code.toUpperCase() === voucherCode.toUpperCase());
        
        if (!voucher) {
            alert("Bono no encontrado.");
            setIsVoucherValidating(false);
            return;
        }
        if (voucher.status !== 'active' || voucher.currentValue <= 0) {
            alert(`Este bono ya fue redimido o no tiene saldo. Saldo actual: ${formatCOP(voucher.currentValue)}`);
            setIsVoucherValidating(false);
            return;
        }

        const amountToUse = Math.min(amount, voucher.currentValue, remainingAmount);
        if (amountToUse <= 0) {
            alert("El monto ingresado es inválido para este bono.");
            setIsVoucherValidating(false);
            return;
        }

        setPayments(prev => [...prev, { amount: amountToUse, method, voucherId: voucher.id, voucherCode: voucher.code }]);
        setVoucherCode('');
        setIsVoucherValidating(false);
    } else {
        if (method !== PaymentMethod.Efectivo && amount > remainingAmount && remainingAmount > 0) {
            alert(`El monto para ${method} no puede superar el faltante de ${formatCOP(remainingAmount)}.`);
            return;
        }
        setPayments(prev => [...prev, { amount, method }]);
    }
  };

  const handleRemovePayment = (indexToRemove: number) => {
    setPayments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleFinalize = () => {
    if (!isFullyPaid) {
      alert("Aún falta por pagar el total de la venta.");
      return;
    }
    if (!selectedSeller) {
      alert("Por favor, selecciona un vendedor.");
      return;
    }
    
    const finalCustomerName = toTitleCase(customerName.trim() || 'Cliente Mostrador');
    const finalCustomerPhone = customerPhone.trim() || 'N/A';
    
    if (finalCustomerPhone !== 'N/A' && finalCustomerPhone.length !== 10) {
        alert('El número de celular debe tener 10 dígitos o dejarse vacío.');
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
    }, saleDate);
    
    onClose();
  };

  const handleHold = () => {
    const finalCustomerName = toTitleCase(customerName.trim() || 'Cliente Mostrador');
    const finalCustomerPhone = customerPhone.trim() || 'N/A';
    if (!selectedSeller) {
        alert("Por favor, selecciona un vendedor para poner la venta en espera.");
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
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        <div className="text-center border-b pb-4">
          <h2 className="text-2xl font-bold text-accent mb-2">Procesar Pago</h2>
          <p className="text-gray-500 dark:text-text-dark mb-2">Total a pagar</p>
          <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{formatCOP(total)}</p>
        </div>

        <div className="flex-grow grid md:grid-cols-2 gap-6 py-4 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Vendedor (Obligatorio)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sellers.filter(s => !s.isDisabled).map(seller => (
                  <button key={seller.id} onClick={() => setSelectedSeller(seller.name)} className={`p-3 rounded-lg font-semibold transition-colors text-sm ${selectedSeller === seller.name ? 'bg-accent text-white ring-2 ring-accent-hover' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {seller.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t pt-4">
              <h3 className="text-lg font-bold text-center text-accent/80 mb-2">Datos del Cliente (Opcional)</h3>
              <div className="space-y-3">
                 <input type="tel" value={customerPhone} onChange={handlePhoneChange} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md border outline-none focus:ring-2 focus:ring-accent" placeholder="Celular (10 dígitos)" maxLength={10}/>
                 <input 
                    type="text" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                    onBlur={() => setCustomerName(prev => toTitleCase(prev))}
                    className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md border outline-none focus:ring-2 focus:ring-accent" 
                    placeholder="Nombre Cliente"
                 />
              </div>
            </div>
            
            {!isFullyPaid && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-bold text-center text-accent/80 mb-2">Agregar Pago</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="amountInput" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Monto a Pagar</label>
                    <div className="flex gap-2">
                        <input type="number" id="amountInput" value={amountInput} onChange={e => setAmountInput(e.target.value)} className="flex-grow bg-gray-100 dark:bg-gray-800 p-2 rounded-md font-bold text-lg" placeholder="0" min="0" step="1000" />
                        <input 
                            type="text" 
                            value={voucherCode} 
                            onChange={e => setVoucherCode(e.target.value.toUpperCase())} 
                            className="w-32 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 p-2 rounded-md text-sm font-mono" 
                            placeholder="CÓDIGO BONO"
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Método de Pago</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(PaymentMethod).map(method => {
                        let label = method;
                        if (method === PaymentMethod.Efectivo && currentStore?.accountLabels?.cash) label = currentStore.accountLabels.cash as PaymentMethod;
                        if ([PaymentMethod.Nequi, PaymentMethod.Daviplata, PaymentMethod.QR].includes(method) && currentStore?.accountLabels?.qr) {
                            if (method === PaymentMethod.QR) label = currentStore.accountLabels.qr as PaymentMethod;
                        }
                        if ([PaymentMethod.Tarjeta, PaymentMethod.Sistecredito, PaymentMethod.Addi].includes(method) && currentStore?.accountLabels?.bank) {
                            // if (method === PaymentMethod.Tarjeta) label = currentStore.accountLabels.bank as PaymentMethod;
                        }
                        
                        return (
                          <button key={method} type="button" onClick={() => handleAddPayment(method)} className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-text-light font-semibold rounded-lg hover:bg-accent hover:text-white transition-colors text-xs">
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Resumen de Pago</h3>
            <div className="flex-grow space-y-2 overflow-y-auto">
              {payments.length > 0 ? payments.map((p, index) => (
                <div key={index} className="flex justify-between items-center bg-white dark:bg-secondary p-2 rounded-md">
                  <div>
                    <p className="font-semibold text-xs">
                        {p.method === PaymentMethod.Efectivo && currentStore?.accountLabels?.cash ? currentStore.accountLabels.cash : 
                         (p.method === PaymentMethod.QR && currentStore?.accountLabels?.qr ? currentStore.accountLabels.qr : p.method)}
                    </p>
                    <p className="text-sm font-bold text-accent">{formatCOP(p.amount)}</p>
                  </div>
                  <button onClick={() => handleRemovePayment(index)} className="text-gray-500 hover:text-red-500 p-1"><TrashIcon /></button>
                </div>
              )) : <p className="text-sm text-center text-gray-500 dark:text-text-dark">Aún no hay pagos agregados.</p>}
            </div>
            <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 mt-4 pt-4 space-y-2 text-lg">
              <div className="flex justify-between"><span>Total Pagado:</span> <span className="font-bold">{formatCOP(paidAmount)}</span></div>
              <div className={`flex justify-between ${remainingAmount > 0 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}><span>Faltante:</span> <span className="font-bold">{formatCOP(remainingAmount > 0 ? remainingAmount : 0)}</span></div>
              {change > 0 && <div className="flex justify-between text-blue-500"><span>Cambio:</span> <span className="font-bold">{formatCOP(change)}</span></div>}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end items-center gap-3 border-t pt-4">
          <button type="button" onClick={onClose} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Cancelar</button>
          <button type="button" onClick={handleHold} className="px-6 py-3 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600">Poner en Espera</button>
          <button type="button" onClick={handleFinalize} disabled={!isFullyPaid || !selectedSeller} className="px-8 py-3 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover disabled:bg-gray-400 disabled:cursor-not-allowed">
            Finalizar Venta
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
