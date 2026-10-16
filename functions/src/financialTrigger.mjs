import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { projectFinancialRecord } from './financialProjection.mjs';
export const financialLedgerChanged = onDocumentWritten({ document: 'financialRecords/{recordId}', region: 'us-central1', retry: true, maxInstances: 5 }, async event => {
  try { await projectFinancialRecord(getFirestore(), event.params.recordId); }
  catch (error) {
    if (/^(Financial (source|peer)|Invalid financial)/.test(error.message || '')) {
      // Permanent historic-data errors block verification; they must not cause
      // an endless paid retry loop. Keep diagnostics private, without payloads.
      await getFirestore().doc(`financialLedgerErrors/${event.params.recordId}`).set({ reason: error.message, at: new Date().toISOString() });
      return;
    }
    throw error; // Transient failures are retried by Eventarc.
  }
});
