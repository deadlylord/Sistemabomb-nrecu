import { DEFAULT_COMPANY_ID } from '../types';
import type { Category } from '../types';

// Untagged historical categories belong only to the original company.
export function belongsToCompany(category: Category, companyId: string): boolean {
  return (category.companyId || DEFAULT_COMPANY_ID) === companyId;
}
export function isolatedCategoryId(companyId: string, originalId: string): string {
  return `${companyId}__legacy__${originalId}`;
}
export function selectCompanyCategories(state: { companyId: string; items: Category[] }, companyId: string) {
  return state.companyId === companyId ? state.items.filter(category => belongsToCompany(category, companyId)) : [];
}
