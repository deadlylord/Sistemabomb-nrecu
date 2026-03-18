
import React, { useState, useEffect } from 'react';
import { LabelConfig, Store } from '../types';
import { CheckIcon } from './Icons';
import { encodePrice } from '../constants';
import { TagIcon } from 'lucide-react';

interface LabelConfigPanelProps {
  store: Store;
  onSave: (config: LabelConfig) => void;
}

export const LabelConfigPanel: React.FC<LabelConfigPanelProps> = ({ store, onSave }) => {
  const DEFAULT_CONFIG: LabelConfig = {
    width: 57,
    height: 48,
    columns: 1,
    columnGap: 0,
    orientation: 'portrait',
    fontSize: 8,
    showPrice: true,
    showName: true,
    showSku: true,
    showSupplier: false,
    barcodeWidth: 1.5,
    barcodeHeight: 25,
  };

  const [config, setConfig] = useState<LabelConfig>(store.labelConfig || DEFAULT_CONFIG);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'orientation' ? value : parseFloat(value) || 0)
    }));
  };

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de que deseas restablecer la configuración a los valores predeterminados?')) {
      setConfig(DEFAULT_CONFIG);
      onSave(DEFAULT_CONFIG);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    onSave(config);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleTestPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalWidth = (config.width * config.columns) + (config.columnGap * (config.columns - 1));
    const labelsHtml = Array.from({ length: config.columns * 2 }).map((_, i) => `
      <div class="label">
        <div class="label-inner">
          <div class="store-name">${store.receiptName || store.name}</div>
          <div class="product-name">PRODUCTO DE PRUEBA</div>
          <svg class="barcode" 
            jsbarcode-value="SKU-TEST-${i + 1}"
            jsbarcode-format="CODE128"
            jsbarcode-width="${config.barcodeWidth}"
            jsbarcode-height="${config.barcodeHeight}"
            jsbarcode-displayValue="false"
            jsbarcode-margin="0"
          ></svg>
          <div class="sku">SKU-TEST-${i + 1}</div>
          <div class="cipher">180326-ABCDE</div>
          <div class="price">$ 99.999</div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Prueba de Impresión</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page { 
              size: ${totalWidth}mm ${config.height}mm; 
              margin: 0; 
            }
            body { margin: 0; font-family: monospace; }
            .container {
              display: grid;
              grid-template-columns: repeat(${config.columns}, ${config.width}mm);
              column-gap: ${config.columnGap}mm;
              width: ${totalWidth}mm;
            }
            .label { 
              width: ${config.width}mm; 
              height: ${config.height}mm; 
              box-sizing: border-box; 
              border: 0.1mm solid #eee;
              position: relative;
              overflow: hidden;
            }
            .label-inner {
              display: flex; 
              flex-direction: column; 
              justify-content: center; 
              align-items: center;
              text-align: center;
              box-sizing: border-box;
              padding: 0;
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
            .store-name { font-size: ${config.fontSize * 0.8}pt; font-weight: bold; }
            .product-name { font-size: ${config.fontSize}pt; font-weight: bold; }
            .barcode { 
              width: 100%;
              max-width: 100%; 
              height: auto; 
              margin: 0.1mm 0;
              shape-rendering: crispEdges;
            }
            .sku { font-size: ${config.fontSize * 0.9}pt; }
            .cipher { font-size: ${config.fontSize * 0.8}pt; border-top: 0.1mm solid #000; }
            .price { font-size: ${config.fontSize * 1.2}pt; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">${labelsHtml}</div>
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
  };

  return (
    <div className="space-y-6 relative">
      {showSuccess && (
        <div className="absolute -top-12 right-0 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in flex items-center gap-2 z-50">
          <CheckIcon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Configuración Guardada</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-700 dark:text-text-light border-b border-gray-200 dark:border-gray-700 pb-2">Dimensiones y Diseño</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ancho (mm)</label>
              <input 
                type="number" 
                name="width" 
                value={config.width} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Alto (mm)</label>
              <input 
                type="number" 
                name="height" 
                value={config.height} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Columnas</label>
              <input 
                type="number" 
                name="columns" 
                value={config.columns} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
                min="1"
                max="4"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Espacio Columnas (mm)</label>
              <input 
                type="number" 
                name="columnGap" 
                step="0.1"
                value={config.columnGap} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Orientación</label>
              <select 
                name="orientation" 
                value={config.orientation} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
              >
                <option value="portrait">Vertical (Portrait)</option>
                <option value="landscape">Horizontal (Landscape)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tamaño Fuente</label>
              <input 
                type="number" 
                name="fontSize" 
                value={config.fontSize} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
              />
            </div>
          </div>

          <h3 className="font-bold text-gray-700 dark:text-text-light border-t border-gray-200 dark:border-gray-700 pt-4 pb-2 flex justify-between items-center">
            <span>Código de Barras</span>
            <span className="text-[10px] text-accent font-black uppercase tracking-widest">Sugerido: 1.2 - 1.5</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ancho Barras</label>
              <input 
                type="number" 
                name="barcodeWidth" 
                step="0.1"
                value={config.barcodeWidth} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Alto Barras</label>
              <input 
                type="number" 
                name="barcodeHeight" 
                value={config.barcodeHeight} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
              />
            </div>
          </div>

          <h3 className="font-bold text-gray-700 dark:text-text-light border-t border-gray-200 dark:border-gray-700 pt-4 pb-2">Información Visible</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <input type="checkbox" name="showPrice" checked={config.showPrice} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
              <span className="text-sm">Precio</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <input type="checkbox" name="showName" checked={config.showName} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
              <span className="text-sm">Nombre</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <input type="checkbox" name="showSku" checked={config.showSku} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
              <span className="text-sm">SKU</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <input type="checkbox" name="showSupplier" checked={config.showSupplier} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
              <span className="text-sm">Proveedor</span>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 dark:text-text-light flex justify-between items-center">
            <span>Vista Previa del Diseño</span>
            <span className="text-[10px] uppercase bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              {config.columns} {config.columns === 1 ? 'Columna' : 'Columnas'}
            </span>
          </h3>
          <div className="flex justify-center bg-gray-200 dark:bg-gray-900 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 overflow-auto min-h-[400px] items-start">
            <div 
              className="grid p-2 bg-white/50 dark:bg-white/10 rounded shadow-inner"
              style={{ 
                gridTemplateColumns: `repeat(${config.columns}, ${config.width}mm)`,
                columnGap: `${config.columnGap}mm`,
                rowGap: '2mm',
                width: 'max-content'
              }}
            >
              {[...Array(config.columns * 2)].map((_, i) => (
                <div 
                  key={i}
                  className="relative overflow-hidden"
                  style={{
                    width: `${config.width}mm`,
                    height: `${config.height}mm`,
                    backgroundColor: 'white',
                    boxSizing: 'border-box',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    color: 'black',
                    fontFamily: 'monospace',
                    border: '1px solid #ddd'
                  }}
                >
                  <div 
                    className="flex flex-col justify-center items-center text-center p-[2mm] box-border"
                    style={{
                      width: config.orientation === 'landscape' ? `${config.height}mm` : '100%',
                      height: config.orientation === 'landscape' ? `${config.width}mm` : '100%',
                      position: config.orientation === 'landscape' ? 'absolute' : 'relative',
                      top: config.orientation === 'landscape' ? '50%' : 'auto',
                      left: config.orientation === 'landscape' ? '50%' : 'auto',
                      transform: config.orientation === 'landscape' ? 'translate(-50%, -50%) rotate(-90deg)' : 'none',
                      transformOrigin: 'center'
                    }}
                  >
                    <div style={{ fontSize: `${config.fontSize * 0.7}pt`, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5mm', opacity: 0.8 }}>{store.receiptName || store.name}</div>
                    {config.showName && <div style={{ fontSize: `${config.fontSize * 0.9}pt`, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5mm', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%' }}>PRODUCTO ${i + 1}</div>}
                    
                    <div style={{ width: '100%', height: `${config.barcodeHeight * 0.25}mm`, display: 'flex', alignItems: 'stretch', justifyContent: 'center', margin: '0.5mm 0' }}>
                      {[...Array(20)].map((_, idx) => (
                        <div key={idx} style={{ width: `${Math.random() * 3 + 1}px`, backgroundColor: idx % 2 === 0 ? 'black' : 'transparent', marginRight: '1px' }} />
                      ))}
                    </div>

                    {config.showSku && <div style={{ fontSize: `${config.fontSize * 0.8}pt`, fontWeight: 'bold' }}>SKU-TEST-${i + 1}</div>}
                    <div style={{ fontSize: `${config.fontSize * 0.7}pt`, fontWeight: 'bold', borderTop: '0.2mm solid #000', paddingTop: '0.5mm', marginTop: '0.5mm' }}>
                      180326-ABCDE
                    </div>
                    {config.showPrice && <div style={{ fontSize: `${config.fontSize * 1.1}pt`, fontWeight: 'black', marginTop: '0.5mm' }}>$ 99.999</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleTestPrint}
              className="flex-1 py-3 text-xs font-black uppercase text-accent border-2 border-accent rounded-xl hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <TagIcon className="w-4 h-4" />
              Impresión de Prueba
            </button>
          </div>
          <p className="text-[10px] text-gray-500 text-center italic">La vista previa muestra {config.columns * 2} etiquetas para visualizar el diseño multi-columna.</p>
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <button 
          onClick={handleReset}
          className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black uppercase tracking-widest py-4 px-10 rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 shadow-lg"
        >
          <span>Restablecer</span>
        </button>
        <button 
          onClick={handleSave}
          className="bg-accent text-white font-black uppercase tracking-widest py-4 px-10 rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 shadow-lg shadow-accent/20"
        >
          <CheckIcon className="w-5 h-5" />
          <span>Guardar Configuración</span>
        </button>
      </div>
    </div>
  );
};
