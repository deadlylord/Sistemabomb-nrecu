import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { PackageIcon, TrashIcon, CheckIcon, UploadIcon } from './Icons';

interface EditProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onUpdateProduct: (updatedProduct: Product, imageFile?: File) => Promise<void>;
}

const EditProductImageModal: React.FC<EditProductImageModalProps> = ({ isOpen, onClose, product, onUpdateProduct }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product.imageUrl);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setImageFile(null);
    setImagePreview(product.imageUrl);
    setIsLoading(false);
  }, [isOpen, product]);

  if (!isOpen) return null;
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!imageFile) {
        alert("Por favor, selecciona una nueva imagen para subir.");
        return;
    }
    setIsLoading(true);
    try {
        await onUpdateProduct(product, imageFile);
        onClose();
    } catch (error) {
        console.error("Error updating image:", error);
        alert("Hubo un error al guardar la imagen. Por favor, intenta de nuevo.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar la imagen actual?')) {
        setIsLoading(true);
        try {
            const updatedProduct = { ...product, imageUrl: '' };
            await onUpdateProduct(updatedProduct); // Pass without a file to just update the URL to empty
            onClose();
        } catch (error) {
            alert("Error al eliminar la imagen.");
        } finally {
            setIsLoading(false);
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-accent mb-2">Cambiar Imagen</h2>
        <p className="text-gray-500 dark:text-text-dark mb-4">{product.name}</p>
        
        <div className="space-y-4">
          <div className="flex flex-col items-center">
            <p className="font-bold mb-2">Vista Previa</p>
            <div className="w-48 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 shadow-md mb-4">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <PackageIcon className="w-24 h-24 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            <label htmlFor="image-modal-upload" className="cursor-pointer bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center">
              <UploadIcon className="w-5 h-5 mr-2" />
              <span>{imageFile ? imageFile.name : 'Seleccionar Archivo...'}</span>
              <input id="image-modal-upload" name="image-modal-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/png, image/jpeg"/>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <button 
            type="button" 
            onClick={handleDelete}
            disabled={!product.imageUrl || isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-md font-medium hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <TrashIcon className="w-5 h-5"/>
            <span>Eliminar</span>
          </button>
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={isLoading || !imageFile} className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2">
              {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Guardando...</span>
                  </>
              ) : (
                  <>
                    <CheckIcon />
                    <span>Guardar Imagen</span>
                  </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProductImageModal;