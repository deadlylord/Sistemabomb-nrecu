import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { projectFinancialRecord, invalidateFinancialProjection } from './financialProjection.mjs';
// Each event updates the store's shared summary. Limit concurrent transactions
// to reduce contention and costly retries when many rows arrive together.
export const financialLedgerChanged = onDocumentWritten({ document: 'financialRecords/{recordId}', region: 'southamerica-east1', retry: true, maxInstances: 5, concurrency: 4 }, async event => {
  try { await projectFinancialRecord(getFirestore(), event.params.recordId); }
  catch (error) {
    if (/^(Financial (source|peer)|Invalid financial)/.test(error.message || '')) {
      // Permanent historic-data errors block verification; they must not cause
      // an endless paid retry loop. Keep diagnostics private, without payloads.
      await invalidateFinancialProjection(getFirestore(), event.params.recordId, error.message);
      return;
    }
    throw error; // Transient failures are retried by Eventarc.
  }
});
