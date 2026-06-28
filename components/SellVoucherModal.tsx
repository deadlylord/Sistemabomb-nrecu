
import React, { useState } from 'react';
import { Seller, Customer, PaymentMethod, Store, GiftVoucher } from '../types';
import { formatCOP, toTitleCase } from '../constants';
import { CrossIcon } from './Icons';

interface SellVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellers: Seller[];
  customers: Customer[];
  currentStore: Store | undefined;
  onCreateGiftVoucher: (voucher: Omit<GiftVoucher, 'id'>) => Promise<void>;
  onProcessSale: (saleData: { payments: any[]; customerName: string; customerPhone: string; seller: string; discountPercent?: number; discountAmount?: number; }, saleDate: Date) => void;
}

const SellVoucherModal: React.FC<SellVoucherModalProps> = ({ isOpen, onClose, sellers, customers, currentStore, onCreateGiftVoucher, onProcessSale }) => {
  const [value, setValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedSeller, setSelectedSeller] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

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

  const generateVoucherCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'BN-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleConfirm = async () => {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) {
      alert("Ingresa un valor válido para el bono.");
      return;
    }
    if (!selectedSeller) {
      alert("Selecciona un vendedor.");
      return;
    }
    if (!paymentMethod) {
      alert("Selecciona un método de pago.");
      return;
    }
    if (customerPhone.length > 0 && customerPhone.length !== 10) {
        alert("El celular debe tener 10 dígitos.");
        return;
    }

    setIsProcessing(true);
    try {
      const code = generateVoucherCode();
      const now = new Date();
      
      // 1. Create the Gift Voucher record
      const voucher: Omit<GiftVoucher, 'id'> = {
        code,
        initialValue: amount,
        currentValue: amount,
        status: 'active',
        createdAt: now.toISOString(),
        customerName: toTitleCase(customerName) || 'Cliente Mostrador',
        customerPhone: customerPhone || 'N/A',
        storeId: currentStore?.id || '',
        createdBy: selectedSeller,
      };
      
      await onCreateGiftVoucher(voucher);

      // 2. Process as a sale
      const saleData = {
        payments: [{
          amount,
          method: paymentMethod as PaymentMethod,
          date: now.toISOString(),
          seller: selectedSeller
        }],
        customerName: toTitleCase(customerName) || 'Cliente Mostrador',
        customerPhone: customerPhone || 'N/A',
        seller: selectedSeller,
        items: [{
            id: `voucher-${code}`,
            sku: code,
            name: `Bono de Regalo ${code}`,
            price: amount,
            quantity: 1,
            categoryId: 'vouchers',
            storeId: currentStore?.id || '',
            imageUrl: '',
            description: `Bono de regalo por valor de ${formatCOP(amount)}`
        }]
      };

      await onProcessSale(saleData, now);
      
      alert(`✅ Bono creado con éxito.\nCódigo: ${code}\nValor: ${formatCOP(amount)}`);
      
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error al crear el bono.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-pink-600">Vender Bono de Regalo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Valor del Bono</label>
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-2xl font-bold text-accent outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="0"
              step="1000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Celular Cliente</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={handlePhoneChange}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Opcional"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Nombre Cliente</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Opcional"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Vendedor</label>
            <div className="grid grid-cols-3 gap-2">
              {sellers.filter(s => !s.isDisabled).map(seller => (
                <button
                  key={seller.id}
                  onClick={() => setSelectedSeller(seller.name)}
                  className={`p-2 rounded-lg text-xs font-bold transition-all ${selectedSeller === seller.name ? 'bg-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'}`}
                >
                  {seller.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Método de Pago</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(PaymentMethod).filter(m => m !== PaymentMethod.Bono).map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`p-2 rounded-lg text-[10px] font-bold transition-all ${paymentMethod === method ? 'bg-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'}`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 py-3 bg-pink-500 text-white font-bold rounded-lg hover:bg-pink-600 shadow-lg shadow-pink-500/30 transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Procesando...' : 'Confirmar Venta'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellVoucherModal;
