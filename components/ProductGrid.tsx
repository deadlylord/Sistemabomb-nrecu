
import React from 'react';
import { Product } from '../types';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
  performanceTrends?: Record<string, 'up' | 'down' | 'stable'>;
  onAddToCart: (product: Product) => void;
  onEditImage: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onShowPerformance: (product: Product) => void;
  isAdmin: boolean;
  justAddedProductId: string | null;
  verifiedProducts: Set<string>;
  onToggleProductVerification: (productId: string) => void;
  recentSalesMap?: Record<string, number>;
  trendingProductIds?: Set<string>;
}

const ProductGrid: React.FC<ProductGridProps> = ({ 
  products, 
  performanceTrends, 
  onAddToCart, 
  onEditImage, 
  onEditProduct, 
  onShowPerformance, 
  isAdmin, 
  justAddedProductId, 
  verifiedProducts, 
  onToggleProductVerification,
  recentSalesMap,
  trendingProductIds
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map(product => (
        <ProductCard 
            key={product.id} 
            product={product} 
            performanceTrend={performanceTrends?.[product.id]}
            onAddToCart={onAddToCart} 
            onEditImage={onEditImage} 
            onEditProduct={onEditProduct}
            onShowPerformance={onShowPerformance}
            isAdmin={isAdmin}
            justAddedProductId={justAddedProductId}
            isVerified={verifiedProducts.has(product.id)}
            onToggleVerification={onToggleProductVerification}
            isTrending={trendingProductIds?.has(product.id)}
            needsRecompra={(recentSalesMap?.[product.id] || 0) > 0 && product.stock <= 2}
            recentSalesQty={recentSalesMap?.[product.id]}
        />
      ))}
    </div>
  );
};

export default ProductGrid;
