
import React, { useEffect, useRef } from 'react';
import { Sale, Store } from '../types';
import { formatCOP } from '../constants';
import { PrintIcon, CrossIcon, WhatsAppIcon } from './Icons';

interface ReceiptModalProps {
  sale: Sale;
  store: Store | null;
  onClose: () => void;
}

const shortenProductName = (name: string): string => {
    const words = name.split(' ');
    if (words.length > 1) {
        return words.slice(0, -1).join(' ');
    }
    return name;
};

const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, store, onClose }) => {
  const hasAutoInteracted = useRef(false);

  if (!store) return null; // Can't render without store info

  // Re-formatted text for WhatsApp to look more like an invoice
  const itemsText = sale.items.map(item => {
      let text = `*${shortenProductName(item.name)}*`;
      if (item.id.startsWith('voucher-')) {
          text += `\n> CÓDIGO: *${item.id.replace('voucher-', '')}*`;
      }
      text += `\n> Cant: ${item.quantity}` +
              `\n> Subtotal: *${formatCOP(item.price * item.quantity)}*`;
      return text;
  }).join('\n\n');

  const paymentsText = sale.payments
    ? sale.payments.map(p => `*${p.method}:* ${formatCOP(p.amount)}`).join('\n')
    : `*Método de Pago:* ${sale.paymentMethod}`;

  const receiptText = `*${store.receiptName || store.name}*\n` +
      `_¡Gracias por tu compra!_\n\n` +
      `📄 *RECIBO DE VENTA*\n` +
      `*Factura #:* ${sale.invoiceNumber}\n` +
      `*Fecha:* ${new Date(sale.createdAt).toLocaleString()}\n` +
      `*Cliente:* ${sale.customerName}\n` +
      `*Atendido por:* ${sale.seller}\n\n` +
      `-----------------------------------\n` +
      `${itemsText}\n` +
      `-----------------------------------\n\n` +
      `${paymentsText}\n` +
      `*TOTAL PAGADO: ${formatCOP(sale.totalAmount)}*\n\n` +
      `_${store.whatsappFooterText}_\n\n` +
      `${store.contactInfo}`;


  const handlePrint = () => {
    window.print();
  };
  
  const handleWhatsAppSend = (isManual: boolean = false) => {
    const phone = sale.customerPhone?.replace(/\s+/g, '').replace(/[^0-9]/g, '');

    if (!phone || phone.length < 7) { // Loosened validation for local numbers
      if (isManual) {
        alert('No se puede enviar por WhatsApp. El número de teléfono del cliente no es válido o no fue proporcionado.');
      } else {
        console.warn('Auto-envío por WhatsApp omitido: número de teléfono inválido o no proporcionado.');
      }
      return;
    }

    const colombiaPhoneNumber = phone.length === 10 ? `57${phone}` : phone;
    const encodedText = encodeURIComponent(receiptText);
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const whatsappUrl = isMobile 
        ? `https://api.whatsapp.com/send?phone=${colombiaPhoneNumber}&text=${encodedText}`
        : `https://web.whatsapp.com/send?phone=${colombiaPhoneNumber}&text=${encodedText}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    let printTimer: number | undefined;
    let whatsappTimer: number | undefined;

    if (sale && store && !hasAutoInteracted.current) {
        hasAutoInteracted.current = true; // Set flag to prevent re-triggering

        if (store.autoPrint) {
            printTimer = window.setTimeout(() => {
                window.print();
            }, 500);
        }
        if (store.autoSendWhatsApp) {
            whatsappTimer = window.setTimeout(() => handleWhatsAppSend(false), 700);
        }
    }
    return () => {
        if (printTimer) clearTimeout(printTimer);
        if (whatsappTimer) clearTimeout(whatsappTimer);
    };
  }, [sale, store]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        onClose();
    }
  };
  
  return (
    <div id="receipt-modal-container" className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={handleOverlayClick}>
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl w-full max-w-sm flex flex-col max-h-[90vh]">
        {/* Modal content that is NOT printed */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center print:hidden">
            <h2 className="text-xl font-bold text-accent">Venta Completada</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <CrossIcon />
            </button>
        </div>

        {/* The actual receipt that will be printed */}
        <div id="receipt-to-print" className="p-6 bg-white dark:bg-primary text-black dark:text-text-light font-mono text-sm overflow-y-auto flex-grow">
           <div className="text-center mb-4">
                {store.logo && <img src={store.logo} alt="Logo" className="mx-auto max-h-20 mb-2" />}
                <h1 className="text-2xl font-bold text-accent dark:text-accent">{store.receiptName || store.name}</h1>
                <p className="whitespace-pre-wrap text-xs text-gray-800 dark:text-text-dark">{store.contactInfo}</p>
            </div>
            <div className="mb-4">
                <p><strong>Factura #:</strong> {sale.invoiceNumber}</p>
                <p><strong>Fecha:</strong> {new Date(sale.createdAt).toLocaleString()}</p>
                <p><strong>Cliente:</strong> {sale.customerName}</p>
                <p><strong>Vendedor:</strong> {sale.seller}</p>
            </div>
            <table className="w-full mb-4">
                <thead className="border-b-2 border-dashed border-black dark:border-gray-500">
                    <tr>
                        <th className="text-left font-bold pb-1">Artículo</th>
                        <th className="text-center font-bold pb-1">Cant.</th>
                        <th className="text-right font-bold pb-1">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-black dark:divide-gray-500">
                    {sale.items.map(item => (
                        <tr key={item.id}>
                            <td className="py-1">
                                {shortenProductName(item.name)}
                                {item.id.startsWith('voucher-') && (
                                    <div className="text-[10px] font-bold text-accent">CÓDIGO: {item.id.replace('voucher-', '')}</div>
                                )}
                            </td>
                            <td className="text-center py-1">{item.quantity}</td>
                            <td className="text-right py-1">{formatCOP(item.price * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="border-t-2 border-dashed border-black dark:border-gray-500 pt-2 text-right">
                {sale.payments ? (
                    sale.payments.map((p, index) => (
                        <p key={index}><strong>{p.method}:</strong> {formatCOP(p.amount)}</p>
                    ))
                ) : (
                    <p><strong>Método Pago:</strong> {sale.paymentMethod}</p>
                )}
                <p className="text-lg font-bold">Total: {formatCOP(sale.totalAmount)}</p>
            </div>
            <div className="text-center mt-4 text-xs text-gray-800 dark:text-text-dark">
                <p>{store.footerText}</p>
            </div>
        </div>
        
        {/* Action buttons */}
        <div className="p-4 bg-gray-100 dark:bg-gray-800 print:hidden">
            <div className="flex justify-end space-x-3">
                 <button
                    onClick={() => handleWhatsAppSend(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                >
                    <WhatsAppIcon />
                    <span>WhatsApp</span>
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center space-x-2 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
                >
                    <PrintIcon />
                    <span>Imprimir</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;