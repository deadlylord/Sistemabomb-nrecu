import {createHash} from 'node:crypto';
import {prepareCompatibleLedgerRules} from './compatibleLedgerRules.mjs';
const legacy="rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /inventory/{document=**} { allow read: if true; allow write: if request.auth != null; } match /categories/{document=**} { allow read: if true; allow write: if request.auth != null; } match /{document=**} { allow read, write: if request.auth != null; } } }";
const normalize=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
export function prepareCompatibleBusinessRules(current){
 const baseline=prepareCompatibleLedgerRules(legacy).source;
 const source=baseline.replace('    match /{collection}/{document=**}',`    // Business summary roots/details are server-owned; clients only read.
    match /businessSummaryCompanies/{companyId}/stores/{storeId}/{detail=**} {
      allow read: if ledgerScope(companyId, storeId);
      allow write: if false;
    }
    match /businessSummaryState/{id} { allow read, write: if false; }
    match /businessSummaryErrors/{id} { allow read, write: if false; }
    match /{collection}/{document=**}`).replace("'financialLedgerErrors']);","'financialLedgerErrors', 'businessSummaryCompanies', 'businessSummaryState', 'businessSummaryErrors']);");
 if(![normalize(baseline),normalize(source)].includes(normalize(current)))throw Error('Unknown production rules; preserve and review before changing them');
 return{source,hash:createHash('sha256').update(source).digest('hex'),previousHash:createHash('sha256').update(current).digest('hex')};
}
