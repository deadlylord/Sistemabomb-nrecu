
import React, { useState, useEffect } from 'react';
import { LabelConfig, Store } from '../types';
import { CheckIcon } from './Icons';

interface LabelConfigPanelProps {
  store: Store;
  onSave: (config: LabelConfig) => void;
}

export const LabelConfigPanel: React.FC<LabelConfigPanelProps> = ({ store, onSave }) => {
  const [config, setConfig] = useState<LabelConfig>(store.labelConfig || {
    width: 57,
    height: 48,
    columns: 1,
    fontSize: 8,
    showPrice: true,
    showName: true,
    showSku: true,
    showSupplier: false,
    barcodeWidth: 1.2,
    barcodeHeight: 30,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : parseFloat(value) || 0
    }));
  };

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-700 dark:text-text-light border-b border-gray-200 dark:border-gray-700 pb-2">Dimensiones (mm)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ancho</label>
              <input 
                type="number" 
                name="width" 
                value={config.width} 
                onChange={handleChange}
                className="w-full bg-white dark:bg-gray-700 p-2 rounded-lg border outline-none font-bold text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Alto</label>
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
              />
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

          <h3 className="font-bold text-gray-700 dark:text-text-light border-t border-gray-200 dark:border-gray-700 pt-4 pb-2">Código de Barras</h3>
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
          <h3 className="font-bold text-gray-700 dark:text-text-light">Vista Previa</h3>
          <div className="flex justify-center bg-gray-200 dark:bg-gray-900 p-8 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 overflow-auto min-h-[300px] items-center">
            <div 
              style={{
                width: `${config.width}mm`,
                height: `${config.height}mm`,
                backgroundColor: 'white',
                padding: '2mm',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                color: 'black',
                fontFamily: 'monospace'
              }}
            >
              <div style={{ fontSize: `${config.fontSize * 0.8}pt`, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5mm' }}>{store.receiptName || store.name}</div>
              {config.showName && <div style={{ fontSize: `${config.fontSize}pt`, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5mm', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%' }}>PRODUCTO DE EJEMPLO</div>}
              
              <div style={{ width: '100%', height: `${config.barcodeHeight * 0.3}mm`, backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '1mm 0', border: '1px dashed #ccc' }}>
                <span style={{ fontSize: '6pt', color: '#999' }}>BARCODE {config.barcodeWidth}x{config.barcodeHeight}</span>
              </div>

              {config.showSku && <div style={{ fontSize: `${config.fontSize * 0.9}pt`, fontWeight: 'bold' }}>SKU-123456</div>}
              {config.showPrice && <div style={{ fontSize: `${config.fontSize * 1.2}pt`, fontWeight: 'black', marginTop: '1mm' }}>$ 50.000</div>}
              {config.showSupplier && <div style={{ fontSize: `${config.fontSize * 0.7}pt`, opacity: 0.7 }}>PROVEEDOR ABC</div>}
            </div>
          </div>
          <p className="text-[10px] text-gray-500 text-center italic">La vista previa es una aproximación. El resultado final depende de la impresora.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          className="bg-accent text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover"
        >
          <CheckIcon />
          <span>Guardar Configuración de Etiquetas</span>
        </button>
      </div>
    </div>
  );
};
