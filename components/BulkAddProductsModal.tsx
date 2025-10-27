import React, { useState, useMemo } from 'react';
import { Product, Category, Store } from '../types';
import { UploadIcon, CheckIcon, CrossIcon } from './Icons';
import { formatCOP } from '../constants';

interface BulkAddProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Product[];
  categories: Category[];
  stores: Store[];
  currentStoreId: string;
  onConfirm: (productsToAdd: any[], storeId: string) => void;
}

type PreviewStatus = 'new' | 'error' | 'warning' | 'existing';
type UserAction = 'create_as_new' | 'sync_and_create' | 'skip';

interface ParsedProductData {
    name: string;
    price: number;
    cost: number;
    stock: number;
    categoryName: string;
    supplier: string;
    description?: string;
    imageUrl?: string;
}

interface PreviewRow {
  lineNumber: number;
  originalLine: string;
  parsedData: ParsedProductData; // This will hold the "final" data for the recommended action
  originalData: ParsedProductData; // This will always hold the raw parsed data from the line
  status: PreviewStatus;
  message?: string;
  userAction: UserAction;
}


const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/\s\s+/g, ' ') // Replace multiple whitespace chars with a single space
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Levenshtein distance function to check for similarity
const levenshteinDistance = (s1: string, s2: string): number => {
    const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) {
       track[0][i] = i;
    }
    for (let j = 0; j <= s2.length; j += 1) {
       track[j][0] = j;
    }
    for (let j = 1; j <= s2.length; j += 1) {
       for (let i = 1; i <= s1.length; i += 1) {
          const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
          track[j][i] = Math.min(
             track[j][i - 1] + 1, // deletion
             track[j - 1][i] + 1, // insertion
             track[j - 1][i - 1] + indicator, // substitution
          );
       }
    }
    return track[s2.length][s1.length];
};

const calculateSimilarity = (s1: string, s2: string): number => {
    const longerLength = Math.max(s1.length, s2.length);
    if (longerLength === 0) return 1.0;
    return (longerLength - levenshteinDistance(s1, s2)) / longerLength;
};


const BulkAddProductsModal: React.FC<BulkAddProductsModalProps> = ({
  isOpen,
  onClose,
  inventory,
  categories,
  stores,
  currentStoreId,
  onConfirm,
}) => {
  const [step, setStep] = useState(1);
  const [pastedData, setPastedData] = useState('');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetState = () => {
    setStep(1);
    setPastedData('');
    setPreview([]);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        handleClose();
    }
  };

  const handlePreview = () => {
    setIsProcessing(true);
    const SIMILARITY_THRESHOLD = 0.85;
    const lines = pastedData.trim().split('\n');
    
    const normalizedAllInventory = inventory.map(p => ({
        ...p,
        normalizedName: normalizeString(p.name),
        normalizedSupplier: normalizeString(p.supplier || ''),
        storeName: stores.find(s => s.id === p.storeId)?.name || 'Desconocida',
    }));
    
    const seenItems = new Set<string>();
    const generatedPreview: PreviewRow[] = [];

    lines.forEach((line, index) => {
      if (!line.trim()) return;

      const parts = line.split(',').map(p => p.trim());
      const rowData = {
          lineNumber: index + 1,
          originalLine: line,
      };

      if (parts.length !== 6) {
        generatedPreview.push({ 
            ...rowData,
            status: 'error', 
            message: `Se esperan 6 columnas, se encontraron ${parts.length}.`, 
            userAction: 'skip',
            originalData: {} as ParsedProductData,
            parsedData: {} as ParsedProductData,
        });
        return;
      }

      const [name, priceStr, costStr, stockStr, categoryName, supplier] = parts;
      const price = parseFloat(priceStr);
      const cost = parseFloat(costStr);
      const stock = parseInt(stockStr, 10);
      const originalParsedData: ParsedProductData = { name, price, cost, stock, categoryName, supplier };

      if (!name || !categoryName) {
        generatedPreview.push({ ...rowData, originalData: originalParsedData, parsedData: originalParsedData, status: 'error', message: 'Nombre y Categoría son obligatorios.', userAction: 'skip' });
        return;
      }
      if (isNaN(price) || isNaN(cost) || isNaN(stock) || price < 0 || cost < 0 || stock < 0) {
        generatedPreview.push({ ...rowData, originalData: originalParsedData, parsedData: originalParsedData, status: 'error', message: 'Precio, Costo y Stock deben ser números válidos.', userAction: 'skip' });
        return;
      }

      const normalizedName = normalizeString(name);
      
      const seenKey = `${normalizedName}`; // Check for duplicates in the same pasted list
      if (seenItems.has(seenKey)) {
        generatedPreview.push({ ...rowData, originalData: originalParsedData, parsedData: originalParsedData, status: 'error', message: 'Nombre de producto duplicado en esta carga.', userAction: 'skip' });
        return;
      }
      seenItems.add(seenKey);

      // 1. Check for exact NAME match in the CURRENT store.
      const exactMatchInCurrentStore = normalizedAllInventory.find(p => 
        p.storeId === currentStoreId &&
        p.normalizedName === normalizedName
      );
      if (exactMatchInCurrentStore) {
        generatedPreview.push({ ...rowData, originalData: originalParsedData, parsedData: originalParsedData, status: 'error', message: `Ya existe en esta tienda.`, userAction: 'skip' });
        return;
      }

      // 2. Check if product NAME exists in ANOTHER store
      const existingProductInOtherStore = normalizedAllInventory.find(p => 
        p.normalizedName === normalizedName && 
        p.storeId !== currentStoreId
      );
      if (existingProductInOtherStore) {
          const existingCategory = categories.find(c => c.id === existingProductInOtherStore.categoryId);
          const syncedParsedData = {
              ...originalParsedData,
              name: existingProductInOtherStore.name,
              categoryName: existingCategory ? existingCategory.name : originalParsedData.categoryName,
              supplier: originalParsedData.supplier || existingProductInOtherStore.supplier, // Prioritize new supplier
              description: existingProductInOtherStore.description,
              imageUrl: existingProductInOtherStore.imageUrl,
          };
          
          let message = `Nombre exacto existe en "${existingProductInOtherStore.storeName}".`;
          const normalizedPastedSupplier = normalizeString(supplier);
          if (normalizedPastedSupplier !== existingProductInOtherStore.normalizedSupplier) {
            message += ` Proveedor es diferente (Actual: "${existingProductInOtherStore.supplier}", Nuevo: "${supplier}").`;
          }
          message += ` Se recomienda Sincronizar.`;
          
          generatedPreview.push({ 
              ...rowData, 
              parsedData: syncedParsedData, 
              originalData: originalParsedData,
              status: 'existing', 
              message, 
              userAction: 'sync_and_create'
            });
          return;
      }
      
      // 3. Check for SIMILAR names across ALL stores
      let bestMatch: { product: typeof normalizedAllInventory[0], score: number } | null = null;
      for (const p of normalizedAllInventory) {
          if (normalizeString(p.name) === normalizedName) continue; // Exact matches handled
          const score = calculateSimilarity(normalizedName, p.normalizedName);
          if (score >= SIMILARITY_THRESHOLD) {
              if (!bestMatch || score > bestMatch.score) {
                  bestMatch = { product: p, score: score };
              }
          }
      }
      
      if (bestMatch) {
          const { product, score } = bestMatch;
          let message = `Nombre similar a "${product.name}" (${Math.round(score * 100)}%) encontrado en "${product.storeName}". Revise si es un producto nuevo.`;
          generatedPreview.push({ ...rowData, parsedData: originalParsedData, originalData: originalParsedData, status: 'warning', message, userAction: 'create_as_new' });
          return;
      }
      
      // 4. If none of the above, it's a new product.
      generatedPreview.push({ ...rowData, parsedData: originalParsedData, originalData: originalParsedData, status: 'new', message: 'Nuevo', userAction: 'create_as_new' });
    });

    setPreview(generatedPreview);
    setStep(2);
    setIsProcessing(false);
  };

  const handleUserActionChange = (lineNumber: number, action: UserAction) => {
    setPreview(prev =>
      prev.map(row =>
        row.lineNumber === lineNumber ? { ...row, userAction: action } : row
      )
    );
  };

  const { importCount, skippedCount } = useMemo(() => {
    return preview.reduce(
      (acc, row) => {
        if (row.userAction !== 'skip') acc.importCount++;
        else acc.skippedCount++;
        return acc;
      },
      { importCount: 0, skippedCount: 0 }
    );
  }, [preview]);

  const handleConfirm = () => {
    const productsToCreate = preview
      .filter(row => row.userAction !== 'skip' && (row.parsedData || row.originalData))
      .map(row => {
          const dataToUse = row.userAction === 'create_as_new' ? row.originalData : row.parsedData;
          return {
              ...dataToUse,
              description: dataToUse.description || "Descripción pendiente...",
              imageUrl: dataToUse.imageUrl || "",
          }
      });
    
    if (productsToCreate.length > 0) {
      onConfirm(productsToCreate, currentStoreId);
    }
    handleClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={handleOverlayClick}>
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-accent">Carga Masiva de Productos</h2>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <CrossIcon />
            </button>
        </div>
        
        {step === 1 && (
            <div className="flex-grow flex flex-col">
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md text-sm mb-4">
                    <p className="font-semibold">Instrucciones:</p>
                    <p>Pega los datos de los productos, uno por línea, con los campos separados por comas.</p>
                    <p className="font-mono text-xs mt-1">Formato: Nombre,Precio,Costo,Stock,Categoría,Proveedor</p>
                    <p className="font-mono text-xs">Ejemplo: Blusa 'Sol',85000,50000,10,Blusas y Bodys,ModaCo</p>
                    <p className="mt-1 text-xs">Si una categoría no existe, se creará automáticamente.</p>
                </div>
                <textarea
                    value={pastedData}
                    onChange={e => setPastedData(e.target.value)}
                    rows={15}
                    className="w-full flex-grow bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-mono text-sm"
                    placeholder="Pega aquí los datos..."
                />
                 <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
                    <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md">Cancelar</button>
                    <button onClick={handlePreview} disabled={!pastedData.trim() || isProcessing} className="px-4 py-2 bg-accent text-white rounded-md disabled:bg-gray-400">
                        {isProcessing ? 'Procesando...' : 'Pre-visualizar'}
                    </button>
                </div>
            </div>
        )}

        {step === 2 && (
            <div className="flex-grow flex flex-col min-h-0">
                <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-md mb-4 text-sm">
                    <div>
                        <span className="font-bold text-green-500">{importCount} productos para importar.</span>
                        <span className="font-bold text-gray-500 ml-4">{skippedCount} productos omitidos.</span>
                    </div>
                    <button onClick={() => setStep(1)} className="text-accent hover:underline text-xs">Volver a editar</button>
                </div>
                <div className="flex-grow overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                            <tr>
                                <th className="p-2 w-8">#</th>
                                <th className="p-2">Producto</th>
                                <th className="p-2 w-1/6">Estado</th>
                                <th className="p-2 w-2/5 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                           {preview.map(row => {
                               let statusPill = null;
                               switch(row.status) {
                                   case 'new': statusPill = <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500/20 text-green-300">Nuevo</span>; break;
                                   case 'existing': statusPill = <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300">Existente</span>; break;
                                   case 'warning': statusPill = <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300">Advertencia</span>; break;
                                   case 'error': statusPill = <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500/20 text-red-300">Error</span>; break;
                               }

                               const dataForDisplay = row.userAction === 'sync_and_create' ? row.parsedData : row.originalData;

                               return (
                                   <tr key={row.lineNumber} className={`${row.userAction === 'skip' ? 'opacity-50' : ''}`}>
                                       <td className="p-2 text-gray-500">{row.lineNumber}</td>
                                       <td className="p-2 font-semibold">
                                           {dataForDisplay.name}
                                           <div className="text-xs font-normal text-gray-500 dark:text-text-dark">
                                                {formatCOP(dataForDisplay.price)} | {dataForDisplay.stock} uds | {dataForDisplay.categoryName}
                                                {row.message && <p className="text-blue-400">{row.message}</p>}
                                           </div>
                                       </td>
                                       <td className="p-2">{statusPill}</td>
                                       <td className="p-2">
                                            {row.status === 'existing' ? (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleUserActionChange(row.lineNumber, 'sync_and_create')} className={`w-full text-xs py-1 px-2 rounded ${row.userAction === 'sync_and_create' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Sincronizar y Crear</button>
                                                    <button onClick={() => handleUserActionChange(row.lineNumber, 'create_as_new')} className={`w-full text-xs py-1 px-2 rounded ${row.userAction === 'create_as_new' ? 'bg-yellow-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Crear como Nuevo</button>
                                                    <button onClick={() => handleUserActionChange(row.lineNumber, 'skip')} className={`w-full text-xs py-1 px-2 rounded ${row.userAction === 'skip' ? 'bg-gray-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Omitir</button>
                                                </div>
                                            ) : row.status === 'new' || row.status === 'warning' ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleUserActionChange(row.lineNumber, 'create_as_new')} className={`w-full text-xs py-1 px-2 rounded ${row.userAction === 'create_as_new' ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                                        Crear
                                                    </button>
                                                    <button onClick={() => handleUserActionChange(row.lineNumber, 'skip')} className={`w-full text-xs py-1 px-2 rounded ${row.userAction === 'skip' ? 'bg-gray-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                                        Omitir
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center text-red-500 text-xs font-bold">
                                                    <CrossIcon className="w-4 h-4 mr-1" />
                                                    <span>Omitido</span>
                                                </div>
                                            )}
                                       </td>
                                   </tr>
                               );
                           })}
                        </tbody>
                    </table>
                </div>
                 <div className="mt-6 flex justify-end space-x-3 border-t-2 border-accent/30 pt-4">
                    <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md">Cancelar</button>
                    <button onClick={handleConfirm} disabled={importCount === 0} className="px-4 py-2 bg-accent text-white rounded-md disabled:bg-gray-400 flex items-center space-x-2">
                        <UploadIcon />
                        <span>Importar {importCount} Producto(s)</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default BulkAddProductsModal;