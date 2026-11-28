import type { Category, Product } from '../types';

export type InventoryCategoryRow = {
  categoryId: string;
  name: string;
  segment: 'men' | 'women';
  units: number;
  storeUnits: number;
  warehouseUnits: number;
  value: number;
  percent: number;
};

export type InventorySegmentSummary = {
  value: number;
  units: number;
  categoriesCount: number;
  percent: number;
};

export type InventoryBreakdown = {
  totalValue: number;
  totalUnits: number;
  totalStoreUnits: number;
  totalWarehouseUnits: number;
  hasMenCategories: boolean;
  segments: {
    men: InventorySegmentSummary;
    women: InventorySegmentSummary;
  } | null;
  categories: InventoryCategoryRow[];
};

const normalizeName = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function classifyCategorySegment(categoryName: string): 'men' | 'women' {
  const normalized = normalizeName(categoryName);
  if (!normalized) return 'women';
  return /\b(hombre|hombres|caballero|caballeros|masculino|masculinos|varon|varones)\b/.test(normalized)
    ? 'men'
    : 'women';
}

export function buildInventoryBreakdown(products: Product[], categories: Category[]): InventoryBreakdown {
  const categoryNames = new Map<string, string>();
  for (const cat of categories) {
    if (cat?.id) categoryNames.set(cat.id, cat.name || 'Sin categoría');
  }

  const byCategory = new Map<string, {
    categoryId: string;
    name: string;
    segment: 'men' | 'women';
    units: number;
    storeUnits: number;
    warehouseUnits: number;
    value: number;
  }>();

  let totalValue = 0;
  let totalUnits = 0;
  let totalStoreUnits = 0;
  let totalWarehouseUnits = 0;

  for (const product of products) {
    if (!product || product.isDisabled) continue;
    const storeUnits = Number(product.stock) || 0;
    const warehouseUnits = Number(product.warehouseUnits) || 0;
    const units = storeUnits + warehouseUnits;
    const cost = Number(product.cost) || 0;
    const value = cost * units;
    if (units === 0 && value === 0) continue;

    const categoryId = product.categoryId || 'uncategorized';
    const name = categoryNames.get(categoryId) || 'Sin categoría';
    const segment = classifyCategorySegment(name);

    const existing = byCategory.get(categoryId) || {
      categoryId,
      name,
      segment,
      units: 0,
      storeUnits: 0,
      warehouseUnits: 0,
      value: 0,
    };
    existing.units += units;
    existing.storeUnits += storeUnits;
    existing.warehouseUnits += warehouseUnits;
    existing.value += value;
    byCategory.set(categoryId, existing);

    totalValue += value;
    totalUnits += units;
    totalStoreUnits += storeUnits;
    totalWarehouseUnits += warehouseUnits;
  }

  const rows: InventoryCategoryRow[] = [...byCategory.values()]
    .map(row => ({
      ...row,
      percent: totalValue > 0 ? (row.value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => (b.value - a.value) || (b.units - a.units) || a.name.localeCompare(b.name, 'es'));

  const hasMenCategories = rows.some(row => row.segment === 'men');
  let segments: InventoryBreakdown['segments'] = null;
  if (hasMenCategories) {
    const menRows = rows.filter(r => r.segment === 'men');
    const womenRows = rows.filter(r => r.segment === 'women');
    const menValue = menRows.reduce((s, r) => s + r.value, 0);
    const womenValue = womenRows.reduce((s, r) => s + r.value, 0);
    segments = {
      men: {
        value: menValue,
        units: menRows.reduce((s, r) => s + r.units, 0),
        categoriesCount: menRows.length,
        percent: totalValue > 0 ? (menValue / totalValue) * 100 : 0,
      },
      women: {
        value: womenValue,
        units: womenRows.reduce((s, r) => s + r.units, 0),
        categoriesCount: womenRows.length,
        percent: totalValue > 0 ? (womenValue / totalValue) * 100 : 0,
      },
    };
  }

  return {
    totalValue,
    totalUnits,
    totalStoreUnits,
    totalWarehouseUnits,
    hasMenCategories,
    segments,
    categories: rows,
  };
}
