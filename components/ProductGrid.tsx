
import React from 'react';
import { DEFAULT_COMPANY_ID, Product, type Store } from '../types';
import ProductCard from './ProductCard';
import type { OpenWarehouseMovement } from '../services/warehouse';

interface ProductGridProps {
  products: Product[];
  warehouseView?: boolean;
  warehouseStore?: Store;
  onMoveWarehouse?: OpenWarehouseMovement;
  preOrderSelection?: boolean;
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
  warehouseView,
  warehouseStore,
  onMoveWarehouse,
  preOrderSelection = false,
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {products.map(product => (
        <ProductCard 
            key={product.id} 
            product={product}
            warehouseView={warehouseView}
            onMoveWarehouse={warehouseStore && product.storeId === warehouseStore.id
                && (product.companyId || DEFAULT_COMPANY_ID) === (warehouseStore.companyId || DEFAULT_COMPANY_ID)
                ? onMoveWarehouse : undefined}
            preOrderSelection={preOrderSelection}
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
