
import React from 'react';
import { Incident, Store } from '../types';
import { formatCOP } from '../constants';
import { PrintIcon, CrossIcon, WhatsAppIcon } from './Icons';

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};

interface RecaudoReceiptModalProps {
  incident: Incident;
  store: Store | null;
  onClose: () => void;
}

const RecaudoReceiptModal: React.FC<RecaudoReceiptModalProps> = ({ incident, store, onClose }) => {
  if (!store) return null;

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const receiptText = `*${store.receiptName || store.name}*\n\n` +
      `📄 *COMPROBANTE DE RECAUDO*\n` +
      `*Fecha:* ${new Date(incident.createdAt).toLocaleString()}\n` +
      `*Cliente:* ${incident.customerName}\n` +
      `*Atendido por:* ${incident.sellerName}\n\n` +
      `-----------------------------------\n` +
      `*Concepto:* ${incident.type}` +
      `\n> _${incident.description}_` +
      `\n> *VALOR RECIBIDO:* *${formatCOP(incident.adjustmentAmount || 0)}*` +
      `\n-----------------------------------\n\n` +
      `_${store.whatsappFooterText}_\n\n` +
      `${store.contactInfo}`;

  const handlePrint = () => {
    if (isInIframe()) {
      setErrorMsg("⚠️ No se puede imprimir directamente dentro de la vista previa de AI Studio. Por favor, abre la aplicación en una pestaña nueva (usando el botón de la esquina superior derecha) para imprimir sin bloqueos.");
      setTimeout(() => setErrorMsg(null), 12000);
      return;
    }
    try {
      // Use native window.print() on the main window.
      // This is 100% reliable and respects the @media print CSS in index.html which isolates #receipt-to-print
      window.print();
    } catch (err) {
      console.error("Error calling window.print():", err);
      setErrorMsg("No se pudo iniciar la impresión en este navegador.");
    }
  };
  
  const handleWhatsAppSend = () => {
    const phone = incident.customerPhone?.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (!phone || phone.length < 7) {
      setErrorMsg('No se puede enviar por WhatsApp. El número de teléfono del cliente no es válido o no fue proporcionado.');
      setTimeout(() => setErrorMsg(null), 6000);
      return;
    }
    const colombiaPhoneNumber = phone.length === 10 ? `57${phone}` : phone;
    const encodedText = encodeURIComponent(receiptText);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const whatsappUrl = isMobile 
        ? `https://api.whatsapp.com/send?phone=${colombiaPhoneNumber}&text=${encodedText}`
        : `https://web.whatsapp.com/send?phone=${colombiaPhoneNumber}&text=${encodedText}`;
    try {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error("Error opening WhatsApp URL:", err);
      setErrorMsg("No se pudo abrir WhatsApp automáticamente. Intenta hacer clic manualmente.");
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        onClose();
    }
  };

  return (
    <div id="receipt-modal-container" className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={handleOverlayClick}>
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl w-full max-w-sm flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center print:hidden">
            <h2 className="text-xl font-bold text-accent">Recaudo Registrado</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <CrossIcon />
            </button>
        </div>

        <div id="receipt-to-print" className="p-6 bg-white dark:bg-primary text-black dark:text-text-light font-mono text-sm overflow-y-auto flex-grow">
           <div className="text-center mb-4">
                {store.logo && <img src={store.logo} alt="Logo" className="mx-auto max-h-20 mb-2" />}
                <h1 className="text-2xl font-bold text-accent dark:text-accent">{store.receiptName || store.name}</h1>
                <p className="whitespace-pre-wrap text-xs text-gray-800 dark:text-text-dark">{store.contactInfo}</p>
            </div>
            <div className="text-center mb-4">
                <h2 className="text-lg font-bold">COMPROBANTE DE RECAUDO</h2>
            </div>
            <div className="mb-4">
                <p><strong>Fecha:</strong> {new Date(incident.createdAt).toLocaleString()}</p>
                <p><strong>Cliente:</strong> {incident.customerName || 'N/A'}</p>
                <p><strong>Vendedor:</strong> {incident.sellerName}</p>
            </div>
            <table className="w-full mb-4">
                <thead className="border-b-2 border-dashed border-black dark:border-gray-500">
                    <tr>
                        <th className="text-left font-bold pb-1">Concepto</th>
                        <th className="text-right font-bold pb-1">Valor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-black dark:divide-gray-500">
                    <tr>
                        <td className="py-1">{incident.type}<br/><span className="text-xs">{incident.description}</span></td>
                        <td className="text-right py-1">{formatCOP(incident.adjustmentAmount || 0)}</td>
                    </tr>
                </tbody>
            </table>
            <div className="border-t-2 border-dashed border-black dark:border-gray-500 pt-2 text-right">
                <p className="text-lg font-bold">Total Recibido: {formatCOP(incident.adjustmentAmount || 0)}</p>
            </div>
            <div className="text-center mt-4 text-xs text-gray-800 dark:text-text-dark">
                <p>{store.footerText}</p>
            </div>
        </div>
        
        <div className="p-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 print:hidden flex flex-col gap-3">
            {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-2.5 rounded-xl text-xs font-bold text-center">
                    ⚠️ {errorMsg}
                </div>
            )}
            <div className="flex items-center justify-between gap-2.5">
                 <button
                    onClick={handleWhatsAppSend}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
                >
                    <WhatsAppIcon />
                    <span>WhatsApp</span>
                </button>
                <button
                    onClick={handlePrint}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-accent text-white text-xs font-bold rounded-xl hover:bg-accent-hover transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
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

export default RecaudoReceiptModal;