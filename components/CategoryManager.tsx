

import React, { useState } from 'react';
import { Category, Product } from '../types';
import { EditIcon, CheckIcon, PlusCircleIcon, TrashIcon } from './Icons';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface CategoryManagerProps {
  categories: Category[];
  inventory: Product[];
  onAddCategory: (name: string) => void;
  // FIX: Changed ID prop from number to string to match data model.
  onUpdateCategory: (id: string, newName: string) => void;
  onDeleteCategory: (id: string) => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ categories, inventory, onAddCategory, onUpdateCategory, onDeleteCategory }) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  // FIX: Changed state to handle string IDs.
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const handleAdd = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName);
      setNewCategoryName('');
    }
  };

  const handleEditClick = (category: Category) => {
    setEditingCategory({ id: category.id, name: category.name });
  };

  const handleUpdate = () => {
    if (editingCategory && editingCategory.name.trim()) {
      onUpdateCategory(editingCategory.id, editingCategory.name);
      setEditingCategory(null);
    }
  };
  
  const handleCancelEdit = () => {
      setEditingCategory(null);
  }

  return (
    <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg h-full">
      <h2 className="text-2xl font-bold text-accent mb-4 border-b-2 border-accent/30 pb-2">Gestionar Categorías</h2>
      
      <div className="flex space-x-2 mb-6">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nueva categoría"
          className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} className="bg-accent text-white p-2 rounded-md hover:bg-accent-hover flex-shrink-0">
          <PlusCircleIcon />
        </button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
        {categories.map((cat) => {
            const isUsed = inventory.some(p => p.categoryId === cat.id);
            return (
              <div key={cat.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-md h-12">
                {editingCategory?.id === cat.id ? (
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="w-full bg-gray-200 dark:bg-gray-700 border border-gray-400 dark:border-gray-600 rounded-md p-1 text-sm outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate();
                        if (e.key === 'Escape') handleCancelEdit();
                    }}
                    onBlur={handleCancelEdit} // Cancel on blur to avoid dangling edit state
                  />
                ) : (
                  <span className="text-gray-800 dark:text-text-light truncate">{cat.name}</span>
                )}
                <div className="flex items-center space-x-1 pl-2">
                  {editingCategory?.id === cat.id ? (
                    <button onMouseDown={handleUpdate} className="text-green-400 hover:text-green-300 p-1">
                      <CheckIcon />
                    </button>
                  ) : (
                    <>
                        <button onClick={() => handleEditClick(cat)} className="text-gray-500 dark:text-text-dark hover:text-accent p-1">
                          <EditIcon />
                        </button>
                        <button 
                            onClick={() => setCategoryToDelete(cat)} 
                            disabled={isUsed}
                            className="text-gray-500 dark:text-text-dark hover:text-red-500 disabled:text-gray-400/50 dark:disabled:text-gray-600 disabled:cursor-not-allowed p-1"
                            title={isUsed ? "La categoría está en uso por productos" : "Eliminar categoría"}
                        >
                            <TrashIcon />
                        </button>
                    </>
                  )}
                </div>
              </div>
            );
        })}
      </div>
      
      <DeleteConfirmationModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={() => categoryToDelete && onDeleteCategory(categoryToDelete.id)}
        title="¿Eliminar Categoría?"
        message="¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer."
        itemName={categoryToDelete?.name}
      />
    </div>
  );
};

export default CategoryManager;