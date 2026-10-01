import { doc, runTransaction } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { DEFAULT_COMPANY_ID } from '../types';
import type { Category, Product } from '../types';
import { belongsToCompany, isolatedCategoryId } from './companyCategories';

// Copy only a category actually referenced by this store's existing products.
// Preserve source categories and product stock; re-check ownership inside transactions.
export async function isolateLegacyCategoryForStore(db: Firestore, companyId: string, storeId: string, originalId: string, productIds: string[]) {
  const targetId = isolatedCategoryId(companyId, originalId);
  for (let offset = 0; offset < productIds.length; offset += 200) {
    const chunk = productIds.slice(offset, offset + 200);
    await runTransaction(db, async transaction => {
      const store = await transaction.get(doc(db, 'stores', storeId));
      if (!store.exists() || (store.data().companyId || DEFAULT_COMPANY_ID) !== companyId) throw new Error('La sede pertenece a otra empresa.');
      const source = await transaction.get(doc(db, 'categories', originalId));
      if (!source.exists()) return;
      const original = { ...source.data(), id: source.id } as Category;
      if (belongsToCompany(original, companyId)) return;
      if ((original.companyId || DEFAULT_COMPANY_ID) !== DEFAULT_COMPANY_ID) throw new Error('No se pueden copiar categorías de otra empresa.');
      const targetRef = doc(db, 'categories', targetId);
      const target = await transaction.get(targetRef);
      const products = await Promise.all(chunk.map(id => transaction.get(doc(db, 'inventory', id))));
      if (target.exists() && !belongsToCompany({ ...target.data(), id: target.id } as Category, companyId)) throw new Error('Categoría destino no autorizada.');
      const eligible = products.filter(product => { const data = product.data() as Product | undefined; return data?.storeId === storeId && data.categoryId === originalId && (!data.companyId || data.companyId === companyId); });
      if (!eligible.length) return;
      if (!target.exists()) transaction.set(targetRef, { id: targetId, name: original.name, companyId });
      eligible.forEach(product => {
        const data = product.data() as Product | undefined;
        if (data?.storeId === storeId && data.categoryId === originalId && (!data.companyId || data.companyId === companyId)) {
          transaction.update(product.ref, { categoryId: targetId, companyId });
        }
      });
    });
  }
}
