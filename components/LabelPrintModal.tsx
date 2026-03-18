
import React, { useState, useEffect } from 'react';
import { Product, Store, LabelConfig } from '../types';
import { CrossIcon, PackageIcon, TagIcon, CheckIcon } from './Icons';
import { formatCOP, encodePrice } from '../constants';

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  store: Store;
}

interface PrintItem {
  product: Product;
  quantity: number;
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ isOpen, onClose, selectedProducts, store }) => {
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPrintItems(selectedProducts.map(p => ({ product: p, quantity: 1 })));
    }
  }, [isOpen, selectedProducts]);

  if (!isOpen) return null;

  const config: LabelConfig = store.labelConfig || {
    width: 57,
    height: 48,
    columns: 1,
    orientation: 'portrait',
    fontSize: 8,
    showPrice: true,
    showName: true,
    showSku: true,
    showSupplier: false,
    barcodeWidth: 1.2,
    barcodeHeight: 30,
  };

  const handleQuantityChange = (productId: string, qty: number) => {
    setPrintItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity: Math.max(0, qty) } : item
    ));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para imprimir.');
      return;
    }

    // Flatten items into a single list of labels to print
    const allLabels: Product[] = [];
    printItems.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        allLabels.push(item.product);
      }
    });

    if (allLabels.length === 0) {
      alert('Selecciona al menos una etiqueta para imprimir.');
      return;
    }

    let labelsHtml = '';
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);

    for (let i = 0; i < allLabels.length; i += config.columns) {
      labelsHtml += '<div class="container">';
      for (let j = 0; j < config.columns; j++) {
        const product = allLabels[i + j];
        if (product) {
          const encoded = encodePrice(product.price);
          const cipherCode = `${today}-${encoded}`;
          
          labelsHtml += `
            <div class="label">
              <div class="label-inner">
                <div class="store-name">${store.receiptName || store.name || 'Boutique'}</div>
                ${config.showName ? `<div class="product-name">${product.name}</div>` : ''}
                <svg class="barcode" 
                  jsbarcode-value="${product.sku}"
                  jsbarcode-format="CODE128"
                  jsbarcode-width="${config.barcodeWidth}"
                  jsbarcode-height="${config.barcodeHeight}"
                  jsbarcode-fontSize="10"
                  jsbarcode-margin="0"
                ></svg>
                ${config.showSku ? `<div class="sku">${product.sku}</div>` : ''}
                <div class="cipher">${cipherCode}</div>
                ${config.showPrice ? `<div class="price">$ ${product.price.toLocaleString()}</div>` : ''}
                ${config.showSupplier && product.supplier ? `<div class="supplier">${product.supplier}</div>` : ''}
              </div>
            </div>
          `;
        } else {
          labelsHtml += '<div class="label"><div class="label-inner"></div></div>';
        }
      }
      labelsHtml += '</div>';
    }

    const totalWidth = config.width * config.columns;

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Etiquetas</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page { 
              size: ${totalWidth}mm ${config.height}mm; 
              margin: 0; 
            }
            body { margin: 0; font-family: 'Courier New', Courier, monospace; }
            .container {
              display: grid;
              grid-template-columns: repeat(${config.columns}, 1fr);
              width: ${totalWidth}mm;
              page-break-after: always;
            }
            .label { 
              width: ${config.width}mm; 
              height: ${config.height}mm; 
              box-sizing: border-box; 
              position: relative;
              overflow: hidden;
            }
            .label-inner {
              display: flex; 
              flex-direction: column; 
              justify-content: center; 
              align-items: center;
              text-align: center;
              padding: 1mm;
              box-sizing: border-box;
              ${config.orientation === 'landscape' ? `
                width: ${config.height}mm;
                height: ${config.width}mm;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-90deg);
                transform-origin: center;
              ` : `
                width: 100%;
                height: 100%;
              `}
            }
            .store-name { font-size: ${config.fontSize * 0.8}pt; font-weight: bold; text-transform: uppercase; margin-bottom: 0.5mm; }
            .product-name { font-size: ${config.fontSize}pt; font-weight: bold; text-transform: uppercase; margin-bottom: 0.5mm; white-space: nowrap; overflow: hidden; width: 100%; }
            .barcode { max-width: ${config.orientation === 'landscape' ? config.height - 4 : config.width - 4}mm; height: auto; margin: 0.5mm 0; }
            .sku { font-size: ${config.fontSize * 0.9}pt; font-weight: bold; }
            .cipher { font-size: ${config.fontSize * 0.8}pt; font-weight: bold; border-top: 0.2mm solid #000; padding-top: 0.5mm; margin-top: 0.5mm; }
            .price { font-size: ${config.fontSize * 1.2}pt; font-weight: black; margin-top: 0.5mm; }
            .supplier { font-size: ${config.fontSize * 0.7}pt; opacity: 0.7; }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = () => {
              JsBarcode(".barcode").init();
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-secondary w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-accent text-white">
          <div className="flex items-center gap-3">
            <TagIcon className="w-6 h-6" />
            <h2 className="text-xl font-black uppercase tracking-widest">Imprimir Etiquetas</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <CrossIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              Configuración actual: <strong>{config.width}x{config.height}mm</strong>, <strong>{config.columns} {config.columns === 1 ? 'columna' : 'columnas'}</strong>.
              Puedes ajustar esto en Ajustes {'>'} Etiquetas.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Productos Seleccionados</p>
            {printItems.map(item => (
              <div key={item.product.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-600 flex-shrink-0">
                  {item.product.imageUrl ? (
                    <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PackageIcon className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate uppercase">{item.product.name}</p>
                  <p className="text-[10px] text-gray-500 font-bold">SKU: {item.product.sku}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.product.id, parseInt(e.target.value) || 0)}
                    className="w-12 text-center bg-transparent font-black text-sm outline-none"
                  />
                  <button 
                    onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-xs font-black uppercase text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:bg-gray-100 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handlePrint}
            disabled={printItems.reduce((sum, i) => sum + i.quantity, 0) === 0}
            className="flex-2 py-4 text-xs font-black uppercase text-white bg-accent rounded-2xl shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            Imprimir {printItems.reduce((sum, i) => sum + i.quantity, 0)} Etiquetas
          </button>
        </div>
      </div>
    </div>
  );
};
