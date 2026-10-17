import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { projectFinancialRecord, invalidateFinancialProjection } from './financialProjection.mjs';
// Production database is nam5. Keep this deployment separate from staging's
// southamerica-east1 trigger and from the pending verified-login deployment.
export const productionFinancialLedgerChanged = onDocumentWritten({ document: 'financialRecords/{recordId}', region: 'us-central1', retry: true, maxInstances: 5, minInstances: 0, concurrency: 4, labels: { vestika_ledger_build: '__VESTIKA_LEDGER_BUILD__' } }, async event => {
  if (process.env.GCLOUD_PROJECT !== 'factura2-6e811') throw new Error('Production ledger target mismatch');
  try { await projectFinancialRecord(getFirestore(), event.params.recordId); }
  catch (error) {
    if (/^(Financial (source|peer)|Invalid financial)/.test(error.message || '')) {
      await invalidateFinancialProjection(getFirestore(), event.params.recordId, error.message);
      return;
    }
    throw error;
  }
});
