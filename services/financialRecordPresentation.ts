import type { FinancialRecord, Store } from '../types';

// Presentation only: retain the stored concept for editing, exports and audits.
export function financialRecordPresentation(record: Pick<FinancialRecord, 'description' | 'subCategory' | 'amount' | 'debtStoreId'>, stores: Pick<Store, 'id' | 'name'>[]) {
  const description = record.description || '';
  if (!record.debtStoreId) return { label: '', description, detail: '' };
  const store = stores.find(store => store.id === record.debtStoreId);
  const name = store?.name || 'sede no disponible';
  const settlement = description.match(/^Cruce .+: (Pago deuda|Recibo pago deuda) ref\. (.+)$/i);
  const loan = /pr[ée]stamo/i.test(record.subCategory || '') || /pr[ée]stamo/i.test(description);
  const label = settlement
    ? `${record.amount < 0 ? 'Pago a' : 'Pago recibido de'} ${name}`
    : loan ? `${record.amount < 0 ? 'Préstamo a' : 'Préstamo recibido de'} ${name}`
    : `Cruce con ${name}`;
  // Only compact the application's generated settlement format. Free text stays intact.
  return { label, description: settlement ? label : description, detail: settlement ? description : '' };
}
