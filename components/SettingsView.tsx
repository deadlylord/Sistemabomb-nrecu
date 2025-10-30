
import React, { useState, useEffect } from 'react';
import { Store, Seller, Role, Product, Category } from '../types';
import { CheckIcon, DownloadIcon } from './Icons';
// FIX: Updated the import path for 'compressImage' from '../constants' to '../services/storageService' to resolve module not found error.
import { compressImage } from '../services/storageService';
import { db } from '../firebase';

interface SettingsViewProps {
  stores: Store[];
  allInventory: Product[];
  categories: Category[];
  onSave: (updatedStore: Store) => void;
  onResetStoreData: (storeId: string) => void;
  currentUser: Seller;
  roles: Role[];
  onRecompressAllProductImages: (storeId: string, quality: 'low' | 'medium' | 'high') => void;
  isRecompressing: boolean;
  recompressProgress: { current: number; total: number };
  onGenerateTestData: () => void;
  onReactivateAllProducts: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ stores, allInventory, categories, onSave, onResetStoreData, currentUser, roles, onRecompressAllProductImages, isRecompressing, recompressProgress, onGenerateTestData, onReactivateAllProducts }) => {
  const adminRole = roles.find(r => r.name === 'Administrator');
  const isAdmin = currentUser.roleId === adminRole?.id;

  const [selectedStoreId, setSelectedStoreId] = useState<string>(currentUser.storeId || stores[0]?.id || '');
  const [localSettings, setLocalSettings] = useState<Store | null>(stores.find(s => s.id === selectedStoreId) || null);
  

  useEffect(() => {
    const storeToEdit = stores.find(s => s.id === selectedStoreId);
    if (storeToEdit) {
      setLocalSettings(storeToEdit);
    }
  }, [selectedStoreId, stores]);


  // FIX: Broaden the type of the event parameter to include `HTMLSelectElement`.
  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!localSettings) return;
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setLocalSettings(prev => prev ? ({...prev, [name]: checked }) : null);
    } else {
        const isNumericField = name === 'nextInvoiceNumber';
        setLocalSettings(prev => prev ? ({...prev, [name]: isNumericField ? parseInt(value, 10) || 1 : value }) : null);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        try {
          const compressedImage = await compressImage(file, 'logo');
          setLocalSettings(prev => prev ? ({ ...prev, logo: compressedImage }) : null);
        } catch (error) {
          console.error("Error compressing logo:", error);
          alert("Hubo un error al procesar el logo.");
        }
      } else {
        alert("Por favor, sube un archivo de imagen válido (PNG, JPG, SVG).");
      }
    }
  };
  
  const handleRemoveLogo = () => {
    setLocalSettings(prev => prev ? ({ ...prev, logo: null }) : null);
    const fileInput = document.getElementById('logo-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = "";
    }
  };

  const handleBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'image/png' || file.type === 'image/jpeg') {
        try {
          const compressedImage = await compressImage(file, 'background');
          setLocalSettings(prev => prev ? ({ ...prev, loginBackgroundUrl: compressedImage }) : null);
        } catch (error) {
          console.error("Error compressing background image:", error);
          alert("Hubo un error al procesar la imagen de fondo.");
        }
      } else {
        alert("Por favor, sube un archivo de tipo PNG o JPG.");
      }
    }
  };

  const handleRemoveBackground = () => {
      setLocalSettings(prev => prev ? ({ ...prev, loginBackgroundUrl: null }) : null);
      const fileInput = document.getElementById('background-upload') as HTMLInputElement;
      if (fileInput) {
          fileInput.value = "";
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(localSettings) {
        onSave(localSettings);
    }
  };
  
  const handleOptimizeClick = () => {
      if (!localSettings) return;
      const quality = localSettings.imageCompressionQuality || 'medium';
      if (window.confirm(`¿Estás seguro de que quieres optimizar todas las imágenes de productos para "${localSettings.name}" con calidad "${quality}"? Esta acción no se puede deshacer.`)) {
          onRecompressAllProductImages(localSettings.id, quality);
      }
  };

  const handleResetClick = () => {
    if (localSettings) {
      onResetStoreData(localSettings.id);
    } else {
      alert("Por favor, selecciona una tienda para reiniciar.");
    }
  };

  const handleExportConsolidatedProducts = () => {
    // 1. De-duplicate products by name
    const uniqueProducts = new Map<string, Product>();
    allInventory.forEach(product => {
      const key = product.name.toLowerCase().trim();
      if (!uniqueProducts.has(key)) {
        uniqueProducts.set(key, product);
      }
    });
    const productsToExport = Array.from(uniqueProducts.values()).sort((a, b) => a.name.localeCompare(b.name));
    
    // 2. Get category map
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    // 3. Create CSV content
    const headers = ['Nombre', 'Costo', 'Proveedor', 'Categoría'];
    const csvRows = [headers.join(',')];

    productsToExport.forEach(product => {
        const categoryName = categoryMap.get(product.categoryId) || 'Sin Categoría';
        const row = [
            `"${product.name.replace(/"/g, '""')}"`,
            product.cost,
            `"${(product.supplier || '').replace(/"/g, '""')}"`,
            // FIX: Explicitly cast categoryName to a string to prevent a 'replace does not exist on type unknown' error, ensuring type safety.
            `"${String(categoryName).replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // 4. Trigger download
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel compatibility
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const fileName = `consolidado_productos_compras_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (!localSettings) {
      return (
        <div className="max-w-2xl mx-auto">
             <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg text-center">
                <p>No hay tienda seleccionada o disponible para editar.</p>
             </div>
        </div>
      )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Ajustes Generales</h2>
        
        {isAdmin && stores.length > 1 && (
            <div className="mb-6">
                <label htmlFor="storeSelector" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Editando Ajustes de la Tienda</label>
                <select 
                    id="storeSelector" 
                    value={selectedStoreId} 
                    onChange={e => setSelectedStoreId(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                >
                    {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                </select>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-text-light">Tiquete de Compra</h3>
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Logo de la Tienda (PNG, JPG, SVG)</label>
            <div className="flex items-center space-x-4">
              {localSettings.logo ? (
                <img src={localSettings.logo} alt="Logo Preview" className="w-20 h-20 object-contain rounded-md bg-gray-100 dark:bg-gray-800 p-1" />
              ) : (
                <div className="w-20 h-20 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md text-gray-400">
                  Sin logo
                </div>
              )}
              <div className="flex flex-col space-y-2">
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <label htmlFor="logo-upload" className="cursor-pointer px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover-bg-gray-600 transition-colors">
                  Cambiar Logo
                </label>
                {localSettings.logo && (
                  <button type="button" onClick={handleRemoveLogo} className="px-4 py-2 bg-red-500/20 text-red-500 rounded-md text-sm font-medium hover:bg-red-500/30 transition-colors">
                    Quitar Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Text Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre Interno de la Tienda</label>
              <input
                type="text"
                id="name"
                name="name"
                value={localSettings.name || ''}
                onChange={handleSettingsChange}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              />
            </div>
             <div>
              <label htmlFor="receiptName" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre para Recibos</label>
              <input
                type="text"
                id="receiptName"
                name="receiptName"
                value={localSettings.receiptName || ''}
                onChange={handleSettingsChange}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                placeholder="Ej: Boutique Divino"
              />
            </div>
          </div>
           <div>
            <label htmlFor="nextInvoiceNumber" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Próximo Número de Factura</label>
            <input
              type="number"
              id="nextInvoiceNumber"
              name="nextInvoiceNumber"
              value={localSettings.nextInvoiceNumber || ''}
              onChange={handleSettingsChange}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              min="1"
              step="1"
            />
          </div>
          <div>
            <label htmlFor="contactInfo" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Información de Contacto</label>
            <textarea
              id="contactInfo"
              name="contactInfo"
              value={localSettings.contactInfo || ''}
              onChange={handleSettingsChange}
              rows={3}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              placeholder="Ej: Teléfono: 1234567&#10;Instagram: @tienda"
            />
          </div>
          <div>
            <label htmlFor="footerText" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Texto al Pie del Recibo Impreso</label>
            <input
              type="text"
              id="footerText"
              name="footerText"
              value={localSettings.footerText || ''}
              onChange={handleSettingsChange}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
           <div>
            <label htmlFor="whatsappFooterText" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Texto para Recibo de WhatsApp</label>
            <input
              type="text"
              id="whatsappFooterText"
              name="whatsappFooterText"
              value={localSettings.whatsappFooterText || ''}
              onChange={handleSettingsChange}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="addiLink" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Link de Addi</label>
              <input
                type="url"
                id="addiLink"
                name="addiLink"
                value={localSettings.addiLink || ''}
                onChange={handleSettingsChange}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              />
            </div>
            <div>
              <label htmlFor="sistecreditoLink" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Link de Sistecredito</label>
              <input
                type="url"
                id="sistecreditoLink"
                name="sistecreditoLink"
                value={localSettings.sistecreditoLink || ''}
                onChange={handleSettingsChange}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              />
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" name="autoPrint" checked={!!localSettings.autoPrint} onChange={handleSettingsChange} className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent" />
              <span className="text-sm">Imprimir automáticamente</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" name="autoSendWhatsApp" checked={!!localSettings.autoSendWhatsApp} onChange={handleSettingsChange} className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent" />
              <span className="text-sm">Enviar a WhatsApp automáticamente</span>
            </label>
          </div>
          
          <h3 className="text-lg font-bold text-gray-800 dark:text-text-light pt-4 border-t-2 border-gray-200 dark:border-gray-700">Apariencia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="accentColor" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Color de Acento</label>
                <input type="color" id="accentColor" name="accentColor" value={localSettings.accentColor || '#ff007f'} onChange={handleSettingsChange} className="w-full h-10 p-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md cursor-pointer"/>
              </div>
              <div>
                <label htmlFor="accentColorHover" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Color de Acento (Hover)</label>
                <input type="color" id="accentColorHover" name="accentColorHover" value={localSettings.accentColorHover || '#e60073'} onChange={handleSettingsChange} className="w-full h-10 p-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md cursor-pointer"/>
              </div>
          </div>

           <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Fondo de Pantalla de Login (PNG, JPG)</label>
            <div className="flex items-center space-x-4">
              {localSettings.loginBackgroundUrl ? (
                <img src={localSettings.loginBackgroundUrl} alt="Login BG Preview" className="w-20 h-20 object-cover rounded-md bg-gray-100 dark:bg-gray-800 p-1" />
              ) : (
                <div className="w-20 h-20 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md text-gray-400">
                  Sin fondo
                </div>
              )}
              <div className="flex flex-col space-y-2">
                <input id="background-upload" type="file" accept="image/png, image/jpeg" onChange={handleBackgroundChange} className="hidden" />
                <label htmlFor="background-upload" className="cursor-pointer px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm font-medium">
                  Cambiar Fondo
                </label>
                {localSettings.loginBackgroundUrl && (
                  <button type="button" onClick={handleRemoveBackground} className="px-4 py-2 bg-red-500/20 text-red-500 rounded-md text-sm font-medium hover:bg-red-500/30">
                    Quitar Fondo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" className="bg-accent text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover">
              <CheckIcon />
              <span>Guardar Ajustes</span>
            </button>
          </div>
        </form>

        {isAdmin && (
          <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-400/50">
            <h3 className="text-xl font-bold text-gray-800 dark:text-text-light mb-4">Exportar Datos</h3>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-bold text-gray-700 dark:text-text-light">Consolidado de Productos para Compras</h4>
                <p className="text-sm text-gray-600 dark:text-text-dark mt-1 mb-3">
                    Descarga un archivo de texto (CSV) con una lista de todos los productos únicos de todas las tiendas, ideal para realizar pedidos a proveedores. Incluye nombre, costo, proveedor y categoría.
                </p>
                <button onClick={handleExportConsolidatedProducts} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                    <DownloadIcon />
                    <span>Descargar Consolidado</span>
                </button>
            </div>
          </div>
        )}

        {isAdmin && (
            <div className="mt-8 pt-6 border-t-2 border-dashed border-red-500/50">
                <h3 className="text-xl font-bold text-red-500 mb-4">Zona de Peligro</h3>
                <div className="space-y-6">
                    <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                        <h4 className="font-bold text-green-500">Reactivar Productos Descontinuados</h4>
                        <p className="text-sm text-gray-600 dark:text-text-dark mt-1 mb-3">
                            Esta acción buscará todos los productos marcados como descontinuados en TODAS las tiendas y los volverá a habilitar. Úsalo para corregir productos que fueron deshabilitados por error.
                        </p>
                        <button onClick={onReactivateAllProducts} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">Reactivar Todos los Productos</button>
                    </div>

                    <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                        <h4 className="font-bold text-red-500">Optimizar Imágenes de Productos</h4>
                        <p className="text-sm text-gray-600 dark:text-text-dark mt-1 mb-3">
                            Esta acción volverá a procesar y subir TODAS las imágenes de los productos de esta tienda con la calidad seleccionada. Esto puede reducir el uso de almacenamiento y mejorar los tiempos de carga, pero es irreversible.
                        </p>
                        <div className="flex items-center gap-4">
                            <select
                                name="imageCompressionQuality"
                                value={localSettings.imageCompressionQuality || 'medium'}
                                onChange={handleSettingsChange}
                                className="bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-300 dark:border-gray-700"
                            >
                                <option value="low">Baja (más rápido)</option>
                                <option value="medium">Media (balanceada)</option>
                                <option value="high">Alta (más calidad)</option>
                            </select>
                            <button onClick={handleOptimizeClick} disabled={isRecompressing} className="bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600 disabled:bg-gray-400">
                                {isRecompressing ? `Optimizando... (${recompressProgress.current}/${recompressProgress.total})` : 'Iniciar Optimización'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                        <h4 className="font-bold text-red-500">Generar Datos de Prueba</h4>
                        <p className="text-sm text-gray-600 dark:text-text-dark mt-1 mb-3">
                            Esto creará 100 productos de prueba en CADA tienda para evaluar el rendimiento. No se puede deshacer fácilmente.
                        </p>
                        <button onClick={onGenerateTestData} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700">Generar Datos</button>
                    </div>

                    <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                        <h4 className="font-bold text-red-500">Reiniciar Datos de la Tienda</h4>
                        <p className="text-sm text-gray-600 dark:text-text-dark mt-1 mb-3">
                            Esta acción eliminará permanentemente TODAS las ventas, inventario, clientes y otros datos asociados a <strong>"{localSettings.name}"</strong>. La tienda y sus ajustes se conservarán, pero los datos transaccionales se borrarán.
                        </p>
                        <button onClick={handleResetClick} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700">Reiniciar "{localSettings.name}"</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
