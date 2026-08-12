
import React, { useState } from 'react';
import { GiftVoucher, Sale } from '../types';
import { formatCOP } from '../constants';
import { CrossIcon, SearchIcon } from './Icons';

interface CheckVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  giftVouchers: GiftVoucher[];
  sales?: Sale[];
}

const CheckVoucherModal: React.FC<CheckVoucherModalProps> = ({ isOpen, onClose, giftVouchers, sales }) => {
  const [code, setCode] = useState('');
  const [foundVoucher, setFoundVoucher] = useState<GiftVoucher | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSearch = () => {
    setErrorMsg('');
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) return;
    const voucher = giftVouchers.find(v => v.code.toUpperCase() === trimmedCode);
    if (voucher) {
      setFoundVoucher(voucher);
    } else {
      setErrorMsg(`Bono "${trimmedCode}" no encontrado.`);
      setFoundVoucher(null);
    }
  };

  const getPaymentMethod = (voucher: GiftVoucher) => {
    if (voucher.paymentMethod) return voucher.paymentMethod;
    if (sales) {
      const sale = sales.find(s => s.id === voucher.saleId || s.items?.some(i => i && i.id === `voucher-${voucher.code}`));
      if (sale && sale.payments && sale.payments[0]) {
        return sale.payments[0].method;
      }
    }
    return 'N/A';
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-purple-600">Consultar Bono</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative text-sm" role="alert">
            <span className="block sm:inline">{errorMsg}</span>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-grow bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-lg font-mono outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="CÓDIGO DEL BONO"
            />
            <button
              onClick={handleSearch}
              className="bg-purple-500 text-white p-3 rounded-lg hover:bg-purple-600 transition-colors"
            >
              <SearchIcon className="w-6 h-6" />
            </button>
          </div>

          {foundVoucher ? (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 duration-300">
              <div className="text-center mb-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Saldo Disponible</p>
                <p className="text-4xl font-black text-purple-600">{formatCOP(foundVoucher.currentValue)}</p>
              </div>
              
              <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Código:</span>
                  <span className="font-mono font-bold">{foundVoucher.code}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Valor Inicial:</span>
                  <span className="font-bold">{formatCOP(foundVoucher.initialValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Medio de Pago:</span>
                  <span className="font-extrabold text-purple-600 dark:text-purple-400 uppercase">{getPaymentMethod(foundVoucher)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Estado:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${foundVoucher.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {foundVoucher.status === 'active' ? 'Activo' : 'Redimido'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold">{foundVoucher.customerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fecha Creación:</span>
                  <span className="font-bold">{new Date(foundVoucher.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <SearchIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Ingresa un código para ver los detalles</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default CheckVoucherModal;
