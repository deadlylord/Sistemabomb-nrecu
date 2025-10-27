import React, { useState, useEffect } from 'react';
import { Product, Category } from '../types';
import { CheckIcon, PackageIcon, UploadIcon } from './Icons';

interface EditProductModalProps {
  isOpen: boolean;
  product: Product;
  categories: Category[];
  onUpdateProduct: (updatedProduct: Product, imageFile?: File) => Promise<void>;
  onClose: () => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({ isOpen, product, categories, onUpdateProduct, onClose }) => {
  const [formData, setFormData] = useState({
    name: product.name,
    price: product.price.toString(),
    cost: product.cost.toString(),
    stock: product.stock.toString(),
    description: product.description,
    categoryId: product.categoryId.toString(),
    supplier: product.supplier || '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product.imageUrl);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      cost: product.cost.toString(),
      stock: product.stock.toString(),
      description: product.description,
      categoryId: product.categoryId.toString(),
      supplier: product.supplier || '',
    });
    setImageFile(null);
    setImagePreview(product.imageUrl);
    setIsLoading(false);
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.cost || !formData.stock || !formData.description || !formData.categoryId) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    
    setIsLoading(true);
    try {
        const updatedProduct: Product = {
          ...product,
          ...formData,
          price: parseFloat(formData.price),
          cost: parseFloat(formData.cost),
          stock: parseInt(formData.stock, 10),
          imageUrl: imagePreview || '', // keep old image if no new one
        };
        
        await onUpdateProduct(updatedProduct, imageFile || undefined);
        onClose();
    } catch (error) {
        console.error("Error updating product:", error);
        alert("Hubo un error al actualizar el producto.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2 w-full">Editar Producto</h2>
            <div className="text-right ml-4">
                <span className="text-xs text-gray-500 dark:text-text-dark">SKU</span>
                <p className="font-mono text-accent font-bold">{product.sku}</p>
            </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre del Producto</label>
              <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required />
            </div>
            <div>
              <label htmlFor="categoryId" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Categoría</label>
              <select name="categoryId" id="categoryId" value={formData.categoryId} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Precio de Venta</label>
              <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0" step="1" />
            </div>
            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Costo</label>
              <input type="number" name="cost" id="cost" value={formData.cost} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0" step="1" />
            </div>
            <div>
              <label htmlFor="stock" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Stock</label>
              <input type="number" name="stock" id="stock" value={formData.stock} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required min="0" />
            </div>
            <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Proveedor</label>
                <input type="text" name="supplier" id="supplier" value={formData.supplier} onChange={handleChange} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Descripción</label>
            <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none" required />
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Imagen del Producto</label>
                    <label htmlFor="image-update-upload" className="cursor-pointer bg-white dark:bg-gray-700 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent flex items-center justify-center">
                        <UploadIcon className="w-5 h-5 mr-2" />
                        <span>Subir Nueva Imagen</span>
                        <input id="image-update-upload" name="image-update-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/png, image/jpeg" />
                    </label>
                </div>
                <div className="flex justify-center items-center">
                    {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-md shadow-md" />
                    ) : (
                        <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 shadow-md">
                            <PackageIcon className="w-16 h-16 text-gray-400 dark:text-gray-500" />
                        </div>
                    )}
                </div>
            </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors disabled:bg-gray-400 disabled:cursor-wait flex items-center space-x-2">
              {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Guardando...</span>
                  </>
              ) : (
                  <>
                    <CheckIcon />
                    <span>Guardar Cambios</span>
                  </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;