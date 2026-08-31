
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, Store } from '../types';
import { PlusCircleIcon, UploadIcon } from './Icons';
import { toTitleCase, normalizeText } from '../constants';

interface AddProductFormProps {
  onAddProduct: (newProductData: Omit<Product, 'id' | 'sku' | 'storeId' | 'imageUrl'>, selectedStoreIds: string[], imageFile?: File) => void;
  categories: Category[];
  stores: Store[];
  currentStoreId: string;
  allInventory: Product[];
}

const AddProductForm: React.FC<AddProductFormProps> = ({ onAddProduct, categories, stores, currentStoreId, allInventory }) => {
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([currentStoreId]);

  const resetFormFields = () => {
    setProductSearch('');
    setSelectedProduct(null);
    setPrice('');
    setCost('');
    setStock('');
    setDescription('');
    setCategoryId('');
    setSupplier('');
    setImageFile(null);
    setImagePreview(null);
    setSelectedStoreIds([currentStoreId]);
  };

  const suggestedProducts = useMemo(() => {
    if (!productSearch) return [];
    const normalizedSearch = normalizeText(productSearch);
    const uniqueProductNames = new Set<string>();
    return allInventory
      .filter(p => {
        const nameNormalized = normalizeText(p.name);
        if (nameNormalized.includes(normalizedSearch) && !uniqueProductNames.has(nameNormalized)) {
          uniqueProductNames.add(nameNormalized);
          return true;
        }
        return false;
      })
      .slice(0, 10);
  }, [productSearch, allInventory]);

  const storesWithProduct = useMemo(() => {
    const productNameToFind = selectedProduct?.name || productSearch;
    if (!productNameToFind) return [];
    const normalizedProductNameToFind = normalizeText(productNameToFind);
    return allInventory
        .filter(p => normalizeText(p.name) === normalizedProductNameToFind)
        .map(p => p.storeId);
  }, [selectedProduct, productSearch, allInventory]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestedProducts]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestedProducts.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % suggestedProducts.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + suggestedProducts.length) % suggestedProducts.length);
      } else if (e.key === 'Enter') {
        if (highlightedIndex >= 0) {
          e.preventDefault();
          handleProductSelect(suggestedProducts[highlightedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const handleProductSelect = (product: Product) => {
    setProductSearch(toTitleCase(product.name));
    setSelectedProduct(product);
    setPrice(product.price.toString());
    setCost(product.cost.toString());
    setDescription(product.description);
    setCategoryId(product.categoryId);
    setSupplier(product.supplier || '');
    setImagePreview(product.imageUrl);
    setImageFile(null); // Reset file if selecting existing
    setShowSuggestions(false);
    
    // Al seleccionar uno existente, marcar las tiendas donde NO existe
    const targetName = (product.name || '').toLowerCase();
    const existingStoreIds = allInventory
        .filter(p => (p.name || '').toLowerCase() === targetName)
        .map(p => p.storeId);
    
    // Si no existe en la tienda actual, dejarla seleccionada. Si existe, buscar otras.
    if (!existingStoreIds.includes(currentStoreId)) {
        setSelectedStoreIds([currentStoreId]);
    } else {
        setSelectedStoreIds([]);
    }
  };
  
  const handleStoreSelection = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        }
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productName = toTitleCase(productSearch);
    
    const productDataForSubmission = {
      name: productName,
      price: parseFloat(price),
      cost: parseFloat(cost),
      stock: parseInt(stock, 10),
      description: description,
      categoryId: categoryId,
      supplier: supplier.trim(),
    };

    // Smart-fill data if creating a new instance of an existing product by name
    if (!selectedProduct && productName) {
        const prodNameLower = productName.toLowerCase();
        const existingProduct = allInventory.find(p => (p.name || '').toLowerCase() === prodNameLower);
        if (existingProduct) {
            productDataForSubmission.description = existingProduct.description;
            productDataForSubmission.categoryId = existingProduct.categoryId;
        }
    }

    if (!productDataForSubmission.name || isNaN(productDataForSubmission.price) || isNaN(productDataForSubmission.cost) || isNaN(productDataForSubmission.stock) || !productDataForSubmission.description || !productDataForSubmission.categoryId || selectedStoreIds.length === 0) {
      alert('Por favor, completa todos los campos requeridos y selecciona al menos una tienda.');
      return;
    }

    onAddProduct(productDataForSubmission, selectedStoreIds, imageFile || undefined);
    
    resetFormFields();
  };

  return (
    <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Agregar Nuevo Producto</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label htmlFor="name" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre del Producto</label>
            <input 
              type="text" 
              id="name" 
              value={productSearch} 
              onChange={e => {
                setProductSearch(e.target.value);
                setSelectedProduct(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={handleKeyDown}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none font-bold" 
              required
              autoComplete="off"
            />
            {showSuggestions && suggestedProducts.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestedProducts.map((p, index) => (
                        <li key={p.id}
                            className={`p-2 cursor-pointer flex items-center gap-3 ${index === highlightedIndex ? 'bg-accent/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            onMouseDown={() => handleProductSelect(p)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                                {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover"/> : <PlusCircleIcon className="w-full h-full text-gray-400 p-1"/>}
                            </div>
                            <span className="font-bold text-sm">{p.name}</span>
                        </li>
                    ))}
                </ul>
            )}
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Categoría</label>
            <select id="category" value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required>
                <option value="" disabled>Selecciona una categoría</option>
                {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Precio de Venta</label>
            <input type="number" id="price" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0" step="1" />
          </div>
          <div>
            <label htmlFor="cost" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Costo del Producto</label>
            <input type="number" id="cost" value={cost} onChange={e => setCost(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0" step="1" />
          </div>
          <div>
            <label htmlFor="stock" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Añadir Stock (por tienda)</label>
            <input type="number" id="stock" value={stock} onChange={e => setStock(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0" />
          </div>
          <div>
            <label htmlFor="supplier" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Proveedor (Opcional)</label>
            <input type="text" id="supplier" value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Descripción</label>
          <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Imagen del Producto (Global para todas las sedes)</label>
            <div className="mt-1 flex items-center gap-4">
                <span className="inline-block h-24 w-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-gray-200">
                    {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                        <svg className="h-full w-full text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.993A2 2 0 002 19h20a2 2 0 002-1.007zM12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" /></svg>
                    )}
                </span>
                <label htmlFor="image-upload" className="cursor-pointer bg-white dark:bg-gray-700 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent">
                    <UploadIcon className="inline-block w-5 h-5 mr-2" />
                    <span>Subir Nueva Foto</span>
                    <input id="image-upload" name="image-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/png, image/jpeg" />
                </label>
                {(selectedProduct || storesWithProduct.length > 0) && (
                    <p className="text-[10px] text-gray-400 italic">Este producto ya existe. Al subir una foto nueva, se actualizará en todas las sedes.</p>
                )}
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Tiendas donde añadir stock:</label>
            <div className="flex flex-wrap gap-3">
                {stores.map(store => {
                    const alreadyExists = storesWithProduct.includes(store.id);
                    return (
                      <label key={store.id} className={`flex items-center space-x-2 p-2 rounded-lg border transition-colors ${alreadyExists ? 'bg-green-500/10 border-green-500/30' : 'cursor-pointer hover:bg-gray-50'}`}>
                          <input 
                              type="checkbox"
                              checked={selectedStoreIds.includes(store.id)}
                              onChange={() => handleStoreSelection(store.id)}
                              className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
                          />
                          <span className="text-sm font-bold">{store.name} {alreadyExists && <span className="text-[10px] text-green-500">(Sumar a existente)</span>}</span>
                      </label>
                    )
                })}
            </div>
        </div>
        <div className="flex justify-end pt-4">
            <button type="submit" className="bg-accent text-white font-black py-3 px-8 rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 hover:bg-accent-hover shadow-lg shadow-accent/20 active:scale-95">
                <PlusCircleIcon />
                <span>{selectedProduct || storesWithProduct.length > 0 ? 'Actualizar/Sumar Producto' : 'Crear Producto'}</span>
            </button>
        </div>
      </form>
    </div>
  );
};

export default AddProductForm;
