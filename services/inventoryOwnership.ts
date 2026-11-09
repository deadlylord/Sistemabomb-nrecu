import type { Product } from '../types';
// Valuation counts both locations; availability, sales and physical local counts
// must continue using product.stock alone. No query or projection is added.
export const ownedInventoryUnits = (product: Pick<Product, 'stock' | 'warehouseUnits'>) =>
  (Number(product.stock) || 0) + (Number(product.warehouseUnits) || 0);
