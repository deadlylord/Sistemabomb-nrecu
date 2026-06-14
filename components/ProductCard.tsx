
import React from 'react';
import { Product } from '../types';
import { CameraIcon, EditIcon, PackageIcon, ChartBarIcon, TrendingUpIcon, TrendingDownIcon, WhatsAppIcon } from './Icons';
import { formatCOP } from '../constants';

interface ProductCardProps {
  product: Product;
  performanceTrend?: 'up' | 'down' | 'stable';
  onAddToCart: (product: Product) => void;
  onEditImage: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onShowPerformance: (product: Product) => void;
  isAdmin: boolean;
  justAddedProductId: string | null;
  isVerified: boolean;
  onToggleVerification: (productId: string) => void;
  recentSales30d?: number;
  isTrending?: boolean;
  needsRebuy?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, performanceTrend, onAddToCart, onEditImage, onEditProduct, onShowPerformance, isAdmin, justAddedProductId, isVerified, onToggleVerification, recentSales30d, isTrending, needsRebuy }) => {
  const [isSharing, setIsSharing] = React.useState(false);

  // Preparar mensaje de WhatsApp sin precios
  const getWhatsAppShareUrl = () => {
    const originalDesc = product.description || '';
    // Eliminar menciones de precios, por ejemplo signos de pesos seguidos de números, eg. $35.000, $ 35000, etc.
    const cleanDesc = originalDesc
      .replace(/\$\s?\d+([.,]\d+)*(?!\w)/g, '')
      .replace(/\b\d+([.,]\d+)*\s?(COP|pesos|mil)\b/gi, '')
      .trim();

    const textLines = [
      `*¡Hola! Te comparto este producto:*`,
      ``,
      `*🛍️ ${product.name.toUpperCase()}*`,
    ];

    if (cleanDesc) {
      textLines.push(``);
      textLines.push(`*Tallas y Colores / Detalles:*`);
      textLines.push(cleanDesc);
    }

    if (product.imageUrl) {
      textLines.push(``);
      textLines.push(`*Ver imagen:* ${product.imageUrl}`);
    }

    const fullText = textLines.join('\n');
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
  };

  const whatsappUrl = getWhatsAppShareUrl();

  const handleShareClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSharing) return;

    const originalDesc = product.description || '';
    const cleanDesc = originalDesc
      .replace(/\$\s?\d+([.,]\d+)*(?!\w)/g, '')
      .replace(/\b\d+([.,]\d+)*\s?(COP|pesos|mil)\b/gi, '')
      .trim();

    const textHeader = `*🛍️ ${product.name.toUpperCase()}*${cleanDesc ? '\n\n*Tallas y Colores / Detalles:*\n' + cleanDesc : ''}`;

    if (product.imageUrl && navigator.share && navigator.canShare) {
      setIsSharing(true);
      try {
        const response = await fetch(product.imageUrl);
        const blob = await response.blob();
        
        let ext = 'jpg';
        if (blob.type === 'image/png') ext = 'png';
        else if (blob.type === 'image/webp') ext = 'webp';
        else if (blob.type === 'image/gif') ext = 'gif';
        
        const fileName = `${product.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${ext}`;
        const file = new File([blob], fileName, { type: blob.type });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: product.name,
            text: textHeader
          });
          setIsSharing(false);
          return;
        }
      } catch (err) {
        console.warn("No se pudo compartir la imagen exacta como archivo debido a CORS o red. Usando fallback de texto.", err);
      } finally {
        setIsSharing(false);
      }
    }

    // Fallback: abrir enlace de WhatsApp
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent adding to cart if an admin button, the checkbox, or link was clicked
    if (
      (e.target as HTMLElement).closest('button') || 
      (e.target as HTMLElement).closest('a') || 
      (e.target as HTMLElement).closest('.verification-checkbox-wrapper')
    ) {
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
        {/* Controles de Acción en Esquina Superior Izquierda (WhatsApp y Edición) */}
        <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
            {/* Botón de Compartir en WhatsApp - Siempre Visible y Destacado */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleShareClick}
              className={`w-8 h-8 rounded-full shadow-lg border border-white/20 transition-all flex items-center justify-center cursor-pointer ${
                isSharing 
                  ? 'bg-amber-500 animate-pulse' 
                  : 'bg-green-500 hover:bg-green-600 hover:scale-110 active:scale-95 text-white'
              }`}
              title="Compartir por WhatsApp (Imagen y especificaciones)"
            >
              {isSharing ? (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <WhatsAppIcon className="w-4 h-4 text-white" />
              )}
            </a>

            {/* Botones de Edición - Visibles en Hover en PC o siempre en móvil */}
            <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                      e.stopPropagation();
                      onEditImage(product);
                    }
                  }
                  className="w-8 h-8 bg-black/50 hover:bg-black/75 text-white rounded-full backdrop-blur-sm transition-colors flex items-center justify-center"
                  aria-label={`Editar imagen de ${product.name}`}
                >
                  <CameraIcon className="w-4 h-4"/>
                </button>
                {isAdmin && (
                  <button
                      onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}
                      className="w-8 h-8 bg-black/50 hover:bg-black/75 text-white rounded-full backdrop-blur-sm transition-colors flex items-center justify-center"
                      aria-label={`Editar detalles de ${product.name}`}
                  >
                      <EditIcon className="w-4 h-4"/>
                  </button>
                )}
            </div>
        </div>

        {isAdmin && (
            <div className="absolute top-1.5 right-1.5 z-20 flex flex-col items-end gap-1.5">
                <button
                    onClick={(e) => { e.stopPropagation(); onShowPerformance(product); }}
                    className={`p-1.5 rounded-full backdrop-blur-md shadow-lg border transition-all duration-300 ${
                        performanceTrend === 'up' 
                            ? 'bg-emerald-500/90 border-emerald-400 text-white scale-110' 
                            : performanceTrend === 'down'
                            ? 'bg-rose-500/90 border-rose-400 text-white scale-90 opacity-80'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300'
                    }`}
                    aria-label={`Ver rendimiento de ${product.name}`}
                    title={`Rendimiento: ${performanceTrend === 'up' ? 'En aumento' : performanceTrend === 'down' ? 'En descenso' : 'Estable'}`}
                >
                    {performanceTrend === 'up' ? (
                        <TrendingUpIcon className="w-4 h-4" />
                    ) : performanceTrend === 'down' ? (
                        <TrendingDownIcon className="w-4 h-4" />
                    ) : (
                        <ChartBarIcon className="w-4 h-4" />
                    )}
                </button>

                <div
                    onClick={handleCheckboxClick}
                    className="verification-checkbox-wrapper h-7 w-7 flex items-center justify-center bg-black/30 rounded-full cursor-pointer backdrop-blur-sm group/check"
                    title="Marcar como verificado físicamente"
                >
                    <input
                        type="checkbox"
                        checked={isVerified}
                        readOnly 
                        className="pointer-events-none h-4 w-4 rounded-full appearance-none border-2 border-white/70 bg-transparent transition-colors group-hover/check:border-white checked:bg-green-500 checked:border-green-500"
                    />
                </div>
            </div>
        )}

        {/* Floating Badges for Admin Insights */}
        {isAdmin && (isTrending || needsRebuy) && (
          <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1">
            {isTrending && (
              <span className="bg-rose-500/95 border border-rose-400 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-sm font-sans">
                🔥 TENDENCIA {recentSales30d ? `(${recentSales30d})` : ''}
              </span>
            )}
            {needsRebuy && (
              <span className="bg-amber-500/95 border border-amber-400 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-sm font-sans animate-pulse">
                🚨 RECOMPRAR
              </span>
            )}
          </div>
        )}

      </div>

      {/* Details */}
      <div className="p-2 flex-shrink-0">
        <div className="flex justify-between items-start gap-1">
            <h3 className="font-bold text-sm text-slate-800 dark:text-text-light truncate flex-grow" title={product.name}>{product.name}</h3>
            {product.discountPrice !== undefined && product.discountPrice !== product.price && (
                <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter animate-bounce shadow-sm ${product.discountPrice < product.price ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                        {product.discountPrice < product.price ? 'OFERTA' : 'PRECIO ESP.'}
                    </span>
                    {product.discountPrice < product.price && (
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 rounded-full">
                            -{Math.round((1 - product.discountPrice / product.price) * 100)}%
                        </span>
                    )}
                </div>
            )}
        </div>
        <div className="flex justify-between items-baseline mt-1">
          <p className="text-xs text-slate-500 dark:text-text-dark truncate">{product.supplier || 'Sin proveedor'}</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${product.stock > 0 ? 'bg-slate-500 text-white' : 'bg-red-600 text-white'}`}>
                Stock: {product.stock}
            </span>
            <div className="flex flex-col items-end">
              {product.discountPrice !== undefined && product.discountPrice !== product.price && (
                <span className="text-[10px] text-slate-400 line-through leading-none">{formatCOP(product.price)}</span>
              )}
              {(product.discountPrice !== undefined ? product.discountPrice : product.price) === 0 ? (
                <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Obsequio</span>
              ) : (
                <p className="text-accent font-semibold text-base leading-none">
                  {formatCOP(product.discountPrice !== undefined ? product.discountPrice : product.price)}
                </p>
              )}
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