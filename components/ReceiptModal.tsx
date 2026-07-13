
import React, { useEffect, useRef } from 'react';
import { Sale, Store } from '../types';
import { formatCOP } from '../constants';
import { PrintIcon, CrossIcon, WhatsAppIcon } from './Icons';

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};

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


  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handlePrint = (autoSendWhatsAppAfter: boolean = false) => {
    if (isInIframe()) {
      setErrorMsg("⚠️ No se puede imprimir directamente dentro de la vista previa de AI Studio. Por favor, abre la aplicación en una pestaña nueva (usando el botón de la esquina superior derecha) para imprimir sin bloqueos.");
      setTimeout(() => setErrorMsg(null), 12000);
      return;
    }
    
    let popupWindow: Window | null = null;
    try {
      // Intentar abrir una ventana emergente para una impresión aislada.
      // Esto evita el deadlock/congelamiento en Microsoft Edge y Chrome al aislar el hilo del diálogo de impresión.
      popupWindow = window.open('', '_blank', 'width=320,height=600,menubar=no,status=no,titlebar=no');
      
      if (!popupWindow) {
        throw new Error("Popup blocked");
      }

      const logoHtml = store.logo ? `<img src="${store.logo}" alt="Logo" class="logo" />` : '';
      const itemsHtml = sale.items.map(item => `
        <tr>
          <td style="text-align: left; vertical-align: top; padding: 4px 0;">
            ${shortenProductName(item.name)}
            ${item.id.startsWith('voucher-') ? `<div style="font-size: 10px; font-weight: bold; color: #000;">CÓDIGO: ${item.id.replace('voucher-', '')}</div>` : ''}
          </td>
          <td style="text-align: center; vertical-align: top; padding: 4px 0; width: 30px;">${item.quantity}</td>
          <td style="text-align: right; vertical-align: top; padding: 4px 0; width: 70px;">${formatCOP(item.price * item.quantity)}</td>
        </tr>
      `).join('');

      const paymentsHtml = sale.payments ? (
        sale.payments.map(p => `<p style="margin: 2px 0;"><strong>${p.method}:</strong> ${formatCOP(p.amount)}</p>`).join('')
      ) : (
        `<p style="margin: 2px 0;"><strong>Método Pago:</strong> ${sale.paymentMethod}</p>`
      );

      popupWindow.document.open();
      popupWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Recibo ${sale.invoiceNumber}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0mm;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              color: #000;
              margin: 2mm;
              padding: 0;
              width: 54mm;
              background-color: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .mb-2 { margin-bottom: 8px; }
            .mb-4 { margin-bottom: 16px; }
            .mt-4 { margin-top: 16px; }
            .w-full { width: 100%; }
            .border-b-2 { border-bottom: 2px dashed #000; }
            .border-t-2 { border-top: 2px dashed #000; }
            table { border-collapse: collapse; width: 100%; margin-top: 4px; margin-bottom: 4px; }
            .logo { max-height: 50px; display: block; margin: 0 auto 6px auto; }
            .title { font-size: 13px; font-weight: bold; margin-bottom: 3px; }
            .subtitle { font-size: 9px; white-space: pre-wrap; margin-bottom: 6px; line-height: 1.2; }
            p { margin: 2px 0; line-height: 1.2; }
          </style>
        </head>
        <body>
          <div class="text-center mb-2">
            ${logoHtml}
            <div class="title">${store.receiptName || store.name}</div>
            <div class="subtitle">${store.contactInfo}</div>
          </div>
          <div class="mb-2" style="font-size: 10px;">
            <p><strong>Factura #:</strong> ${sale.invoiceNumber}</p>
            <p><strong>Fecha:</strong> ${new Date(sale.createdAt).toLocaleString()}</p>
            <p><strong>Cliente:</strong> ${sale.customerName}</p>
            <p><strong>Vendedor:</strong> ${sale.seller}</p>
          </div>
          <table class="w-full mb-2">
            <thead>
              <tr class="border-b-2">
                <th style="text-align: left; font-weight: bold; padding-bottom: 2px;">Artículo</th>
                <th style="text-align: center; font-weight: bold; padding-bottom: 2px; width: 30px;">Cant</th>
                <th style="text-align: right; font-weight: bold; padding-bottom: 2px; width: 70px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="border-t-2" style="padding-top: 4px; text-align: right; font-size: 11px;">
            ${paymentsHtml}
            <p style="margin: 3px 0 0 0; font-size: 12px;"><strong>Total: ${formatCOP(sale.totalAmount)}</strong></p>
          </div>
          <div class="text-center mt-4" style="font-size: 9px; border-top: 1px dashed #000; padding-top: 6px; line-height: 1.2;">
            <p>${store.footerText}</p>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.close();
                }, 500);
              }, 250);
            };
          </script>
        </body>
        </html>
      `);
      popupWindow.document.close();

      if (autoSendWhatsAppAfter) {
        setTimeout(() => {
          handleWhatsAppSend(false);
        }, 1000);
      }
    } catch (err) {
      console.warn("Popup printing blocked or failed, falling back to native window.print():", err);
      setErrorMsg("⚠️ Microsoft Edge bloqueó la ventana de impresión emergente. Asegúrate de 'Permitir ventanas emergentes' para este sitio en la barra de direcciones superior.");
      
      // Fallback a impresión nativa directa en la ventana principal
      window.print();
      
      if (autoSendWhatsAppAfter) {
        setTimeout(() => {
          handleWhatsAppSend(false);
        }, 800);
      }
    }
  };
  
  const handleWhatsAppSend = (isManual: boolean = false) => {
    const phone = sale.customerPhone?.replace(/\s+/g, '').replace(/[^0-9]/g, '');

    if (!phone || phone.length < 7) { // Loosened validation for local numbers
      if (isManual) {
        setErrorMsg('No se puede enviar por WhatsApp. El número de teléfono del cliente no es válido o no fue proporcionado.');
        setTimeout(() => setErrorMsg(null), 6000);
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

    try {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error("Error opening WhatsApp URL:", err);
      setErrorMsg("No se pudo abrir WhatsApp automáticamente. Intenta hacer clic manualmente.");
    }
  };

  useEffect(() => {
    let printTimer: number | undefined;
    let whatsappTimer: number | undefined;

    if (sale && store && !hasAutoInteracted.current) {
        hasAutoInteracted.current = true; // Set flag to prevent re-triggering

        if (isInIframe()) {
            console.warn("Auto-impresión y auto-envío de WhatsApp cancelados dentro de la vista previa iframe para evitar congelamiento del navegador.");
            return;
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (store.autoPrint && !isMobile) {
            printTimer = window.setTimeout(() => {
                try {
                    // Send WhatsApp sequentially AFTER printing completes to avoid overlapping blocking actions
                    handlePrint(store.autoSendWhatsApp);
                } catch (e) {
                    console.warn("Auto-print failed or blocked:", e);
                }
            }, 500);
        } else if (store.autoSendWhatsApp) {
            whatsappTimer = window.setTimeout(() => {
                try {
                    handleWhatsAppSend(false);
                } catch (e) {
                    console.warn("Auto-send WhatsApp failed or blocked:", e);
                }
            }, 700);
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
        <div className="p-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 print:hidden flex flex-col gap-3">
            {/Edg\//i.test(navigator.userAgent) && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl text-[11px] text-center leading-relaxed">
                    💡 <strong>Microsoft Edge:</strong> Si la impresión no abre, haz clic en el icono de <strong>ventana emergente bloqueada</strong> en la parte superior derecha de tu navegador para permitirla en este sitio.
                </div>
            )}
            {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-2.5 rounded-xl text-xs font-bold text-center">
                    ⚠️ {errorMsg}
                </div>
            )}
            <div className="flex items-center justify-between gap-2.5">
                 <button
                    onClick={() => handleWhatsAppSend(true)}
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

export default ReceiptModal;