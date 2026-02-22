
import React from 'react';
import { Product } from '../types';
import { CameraIcon, EditIcon, PackageIcon, ChartBarIcon } from './Icons';
import { formatCOP } from '../constants';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onEditImage: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onShowPerformance: (product: Product) => void;
  isAdmin: boolean;
  justAddedProductId: string | null;
  isVerified: boolean;
  onToggleVerification: (productId: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, onEditImage, onEditProduct, onShowPerformance, isAdmin, justAddedProductId, isVerified, onToggleVerification }) => {
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent adding to cart if an admin button or the checkbox was clicked
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.verification-checkbox-wrapper')) {
      return;
    }
    if (product.stock > 0) { // Also prevent adding if out of stock
        onAddToCart(product);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && product.stock > 0) {
      handleCardClick(e as any);
    }
  }

  const handleCheckboxClick = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      onToggleVerification(product.id);
  };

  return (
    <div
      onClick={handleCardClick}
      onKeyPress={handleKeyPress}
      className={`relative group/card bg-white dark:bg-slate-900/50 dark:backdrop-blur-lg dark:border dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all duration-300 flex flex-col aspect-[2/3] ${product.stock > 0 ? 'hover:shadow-lg hover:ring-2 hover:ring-accent cursor-pointer' : 'cursor-not-allowed'} ${product.id === justAddedProductId ? 'animate-pulse-accent' : ''}`}
      aria-label={`${product.stock > 0 ? `Agregar ${product.name}` : `${product.name} (agotado)`} al carrito`}
      role="button"
      tabIndex={product.stock > 0 ? 0 : -1}
    >
      {/* Image */}
      <div className="relative flex-grow overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full bg-slate-200 dark:bg-slate-800/50 flex items-center justify-center relative">
            <PackageIcon className="w-1/2 h-1/2 text-slate-400 dark:text-slate-600" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5 z-20 flex space-x-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                  e.stopPropagation();
                  onEditImage(product);
                }
              }
              className="p-1.5 bg-black/50 text-white rounded-full backdrop-blur-sm"
              aria-label={`Editar imagen de ${product.name}`}
            >
              <CameraIcon className="w-4 h-4"/>
            </button>
            {isAdmin && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}
                        className="p-1.5 bg-black/50 text-white rounded-full backdrop-blur-sm"
                        aria-label={`Editar detalles de ${product.name}`}
                    >
                        <EditIcon className="w-4 h-4"/>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onShowPerformance(product); }}
                        className="p-1.5 bg-black/50 text-white rounded-full backdrop-blur-sm"
                        aria-label={`Ver rendimiento de ${product.name}`}
                        title="Ver Rendimiento"
                    >
                        <ChartBarIcon className="w-4 h-4 text-emerald-400"/>
                    </button>
                </>
            )}
        </div>
        
        {isAdmin && (
            <div
                onClick={handleCheckboxClick}
                className="verification-checkbox-wrapper absolute top-1.5 right-1.5 z-20 h-7 w-7 flex items-center justify-center bg-black/30 rounded-full cursor-pointer backdrop-blur-sm group/check"
                title="Marcar como verificado físicamente"
            >
                <input
                    type="checkbox"
                    checked={isVerified}
                    readOnly 
                    className="pointer-events-none h-4 w-4 rounded-full appearance-none border-2 border-white/70 bg-transparent transition-colors group-hover/check:border-white checked:bg-green-500 checked:border-green-500"
                />
            </div>
        )}

      </div>

      {/* Details */}
      <div className="p-2 flex-shrink-0">
        <div className="flex justify-between items-start gap-1">
            <h3 className="font-bold text-sm text-slate-800 dark:text-text-light truncate flex-grow" title={product.name}>{product.name}</h3>
            {product.originalPrice && product.originalPrice > product.price && (
                <span className="bg-orange-500 text-white text-[8px] font-black px-1 rounded uppercase tracking-tighter animate-pulse">Liquidación</span>
            )}
        </div>
        <div className="flex justify-between items-baseline mt-1">
          <p className="text-xs text-slate-500 dark:text-text-dark truncate">{product.supplier || 'Sin proveedor'}</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${product.stock > 0 ? 'bg-slate-500 text-white' : 'bg-red-600 text-white'}`}>
                Stock: {product.stock}
            </span>
            <div className="flex flex-col items-end">
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-[10px] text-slate-400 line-through leading-none">{formatCOP(product.originalPrice)}</span>
              )}
              <p className="text-accent font-semibold text-base leading-none">{formatCOP(product.price)}</p>
            </div>
          </div>
        </div>
      </div>

      {product.stock <= 0 && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl pointer-events-none">
          <span className="text-white font-bold text-lg drop-shadow-md">AGOTADO</span>
        </div>
      )}
    </div>
  );
};

export default ProductCard;