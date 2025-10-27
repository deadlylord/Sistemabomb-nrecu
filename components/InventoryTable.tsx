import React, { useState } from 'react';
import { Product, Category } from '../types';
import { EditIcon, HistoryIcon, TrashIcon, PowerIcon, PackageIcon } from './Icons';
import EditProductModal from './EditProductModal';
import { formatCOP } from '../constants';

type EnrichedProduct = Product & {
  velocity: {
    status: string;
    days: number;
    trend: 'improving' | 'stable' | 'worsening';
  }
};

interface InventoryTableProps {
  inventory: EnrichedProduct[];
  categories: Category[];
  onUpdateProduct: (updatedProduct: Product, imageFile?: File) => Promise<void>;
  onDeleteProduct: (productId: string) => void;
  onShowHistory: (product: Product) => void;
  requestSort: (key: keyof Product | 'categoryName' | 'velocity') => void;
  sortConfig: { key: keyof Product | 'categoryName' | 'velocity' | null; direction: 'ascending' | 'descending' };
  isAdmin: boolean;
}

const SortableHeader: React.FC<{
  columnKey: InventoryTableProps['sortConfig']['key'];
  title: string;
  requestSort: InventoryTableProps['requestSort'];
  sortConfig: InventoryTableProps['sortConfig'];
  className?: string;
}> = ({ columnKey, title, requestSort, sortConfig, className }) => {
  const isSorted = sortConfig.key === columnKey;
  const directionIcon = sortConfig.direction === 'ascending' ? '▲' : '▼';

  return (
    <th className={`p-0 ${className}`}>
      <button 
        onClick={() => requestSort(columnKey!)} 
        className="w-full h-full p-3 text-sm font-semibold tracking-wide flex items-center justify-start hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        {title} 
        {isSorted && <span className="ml-1 text-xs">{directionIcon}</span>}
      </button>
    </th>
  );
};

const VelocityPill: React.FC<{ velocity: EnrichedProduct['velocity'] }> = ({ velocity }) => {
    if (!velocity || !velocity.status) return <span>-</span>;

    const { status, days, trend } = velocity;

    let trendIcon = null;
    let trendColor = '';
    let trendTitle = '';

    if (trend === 'improving') {
        trendIcon = '↑';
        trendColor = 'text-green-400';
        trendTitle = 'Tendencia de ventas a la alza';
    } else if (trend === 'worsening') {
        trendIcon = '↓';
        trendColor = 'text-red-400';
        trendTitle = 'Tendencia de ventas a la baja';
    }

    let pillClasses = 'px-2 py-1 text-xs font-bold rounded-full flex items-center justify-center';
    let tooltip = '';

    switch (status) {
        case 'Alta Rotación':
            pillClasses += ' bg-green-500/20 text-green-300';
            tooltip = `¡Excelente! Se vende 1 unidad cada ${Math.round(days)} días en promedio (últimos 90d).`;
            break;
        case 'Rotación Media':
            pillClasses += ' bg-blue-500/20 text-blue-300';
            tooltip = `Rendimiento estable. 1 unidad cada ${Math.round(days)} días en promedio (últimos 90d).`;
            break;
        case 'Baja Rotación':
            pillClasses += ' bg-yellow-500/20 text-yellow-300';
            tooltip = `Venta lenta. 1 unidad cada ${Math.round(days)} días en promedio (últimos 90d).`;
            break;
        case 'En Riesgo':
            pillClasses += ' bg-orange-500/20 text-orange-400';
            tooltip = `En riesgo de estancarse. 1 unidad cada ${Math.round(days)} días en promedio (últimos 90d).`;
            break;
        case 'Estancado':
            pillClasses += ' bg-red-500/20 text-red-300';
            tooltip = `¡Urgente! Venta muy lenta o nula en los últimos 30 días.`;
            break;
        case 'Nuevo':
            pillClasses += ' bg-gray-500/20 text-gray-400';
            tooltip = 'Producto nuevo, sin suficientes datos de venta.';
            break;
        default: // 'Sin Datos'
            return <span>-</span>;
    }

    return (
        <span className={pillClasses} title={tooltip}>
            {trendIcon && <span className={`mr-1.5 font-bold text-base ${trendColor}`} title={trendTitle}>{trendIcon}</span>}
            {status}
        </span>
    );
};


const InventoryTable: React.FC<InventoryTableProps> = ({ inventory, categories, onUpdateProduct, onDeleteProduct, onShowHistory, requestSort, sortConfig, isAdmin }) => {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const handleToggleDisabled = (product: Product) => {
    // If we are trying to disable the product (current state is enabled)
    if (!product.isDisabled) {
        if (product.stock > 0) {
            alert('No se puede descontinuar un producto que tiene stock. Vende las unidades restantes o ajústalas a cero primero.');
            return; // Prevent the action
        }
    }
    // Otherwise, allow toggling (enabling, or disabling a zero-stock product)
    onUpdateProduct({ ...product, isDisabled: !product.isDisabled });
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId)?.name || 'Sin Categoría';
  };
  
  return (
    <>
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <SortableHeader columnKey="name" title="Producto" requestSort={requestSort} sortConfig={sortConfig} />
                <th className="p-3 text-sm font-semibold tracking-wide hidden sm:table-cell text-left">SKU</th>
                <SortableHeader columnKey="supplier" title="Proveedor" requestSort={requestSort} sortConfig={sortConfig} />
                <SortableHeader columnKey="categoryName" title="Categoría" requestSort={requestSort} sortConfig={sortConfig} />
                <SortableHeader columnKey="velocity" title="Rendimiento" requestSort={requestSort} sortConfig={sortConfig} />
                <SortableHeader columnKey="price" title="Precio" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                <SortableHeader columnKey="stock" title="Stock" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                <th className="p-3 text-sm font-semibold tracking-wide text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {inventory.map(product => {
                return (
                  <tr key={product.id} className={`transition-colors ${product.isDisabled ? 'bg-red-50 dark:bg-red-900/20 opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <td className="p-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-md hidden sm:flex items-center justify-center flex-shrink-0 bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-md" />
                          ) : (
                              <PackageIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold">{product.name}</span>
                          {product.isDisabled && <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-500/20 text-gray-400">Deshabilitado</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-500 dark:text-text-dark hidden sm:table-cell">{product.sku}</td>
                    <td className="p-3 text-sm text-gray-500 dark:text-text-dark">{product.supplier || 'N/A'}</td>
                    <td className="p-3 text-sm text-gray-500 dark:text-text-dark">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-accent/20 text-accent">
                        {getCategoryName(product.categoryId)}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      <VelocityPill velocity={product.velocity} />
                    </td>
                    <td className="p-3 text-right font-semibold text-accent">{formatCOP(product.price)}</td>
                    <td className="p-3 text-right font-bold">{product.stock}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center items-center">
                        <button onClick={() => handleToggleDisabled(product)} className={`p-2 rounded-full transition-colors ${!product.isDisabled ? 'text-red-500 hover:text-red-400 hover:bg-red-500/10' : 'text-green-500 hover:text-green-400 hover:bg-green-500/10'}`} title={product.isDisabled ? 'Habilitar Producto' : 'Deshabilitar Producto'}>
                              <PowerIcon className="w-5 h-5" />
                          </button>
                        <button onClick={() => setEditingProduct(product)} className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors" title="Editar Producto">
                          <EditIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onShowHistory(product)} className="text-gray-500 dark:text-text-dark hover:text-blue-500 p-2 rounded-full hover:bg-blue-500/10 transition-colors" title="Ver Historial">
                          <HistoryIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDeleteProduct(product.id)} className="text-gray-500 dark:text-text-dark hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors" title="Eliminar Producto">
                              <TrashIcon className="w-5 h-5" />
                          </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {editingProduct && (
        <EditProductModal
          // FIX: Added isOpen prop to align with the component's updated interface.
          isOpen={!!editingProduct}
          product={editingProduct}
          categories={categories}
          onUpdateProduct={onUpdateProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </>
  );
};

export default InventoryTable;