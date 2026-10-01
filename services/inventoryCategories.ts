import type { Product, Category } from '../types';

// Include existing products at zero/negative stock so they can still be counted.
// Missing category references remain visible instead of silently hiding products.
export function getInventoryCategorySummary(inventory: Product[], categories: Category[]) {
  const totals = new Map<string, { productCount: number; totalStock: number }>();
  for (const product of inventory) {
    if (product.isDisabled) continue;
    const id = String(product.categoryId ?? '');
    const total = totals.get(id) || { productCount: 0, totalStock: 0 };
    const stock = Number(product.stock);
    total.productCount++;
    total.totalStock += Number.isFinite(stock) ? stock : 0;
    totals.set(id, total);
  }
  const categoryById = new Map(categories.map(category => [String(category.id), category]));
  return [...totals].map(([id, total]) => ({
    ...(categoryById.get(id) || { id, name: id ? `Categoría no encontrada (${id})` : 'Sin categoría' }),
    ...total,
  })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
