import { CartItem, Product, DEFAULT_COMPANY_ID } from '../types';

/** Validate catalog membership independently from whether this operation reserves stock. */
export function assertCartAvailability(items: CartItem[], products: Product[], companyId: string, storeId: string, requireStock: boolean, allowVouchers = false): void {
  if (!items.length) throw new Error('Selecciona al menos una prenda.');
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error('La cantidad debe ser un entero mayor a cero.');
    if (allowVouchers && item.id.startsWith('voucher-')) continue;
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  }
  for (const [id, quantity] of quantities) {
    const product = products.find(p => p.id === id);
    if (!product || (product.companyId || DEFAULT_COMPANY_ID) !== companyId || product.storeId !== storeId || product.isDisabled) {
      throw new Error('La prenda no está disponible en el catálogo de esta sede.');
    }
    if (requireStock && (!Number.isFinite(Number(product.stock)) || Number(product.stock) < quantity)) {
      throw new Error(`Stock insuficiente para ${product.name}. Usa «Por traer» para un encargo o registra la llegada antes de marcarlo recibido.`);
    }
  }
}
