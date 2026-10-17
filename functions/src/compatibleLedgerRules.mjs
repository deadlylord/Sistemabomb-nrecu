import { createHash } from 'node:crypto';

// Refuse to overwrite an unknown ruleset. This recognizes only the exact legacy
// authenticated catch-all; a custom live policy needs its own reviewed patch.
export function prepareCompatibleLedgerRules(liveRules) {
  if (typeof liveRules !== 'string') throw new Error('Live production rules are required');
  const normalized = liveRules.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s/g, '').replace(/"/g, "'");
  if (normalized !== "rules_version='2';servicecloud.firestore{match/databases/{database}/documents{match/{document=**}{allowread,write:ifrequest.auth!=null;}}}") throw new Error('Unknown production rules; preserve and review them before deployment');
  const source = `// Compatibility activation: existing business access remains unchanged.
// Derived financial data is server-owned. Verified tenant identity is a separate
// migration; anonymous legacy identities still have the existing read scope.
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function authenticated() { return request.auth != null; }
    function ledgerScope(companyId, storeId) {
      return authenticated()
        && exists(/databases/$(database)/documents/stores/$(storeId))
        && get(/databases/$(database)/documents/stores/$(storeId)).data.get('companyId', 'default_company') == companyId
        && (request.auth.token.get('identityVersion', 0) == 0 || verifiedScope(companyId, storeId));
    }
    function verifiedScope(companyId, storeId) {
      let token = request.auth.token;
      let seller = get(/databases/$(database)/documents/sellers/$(token.sellerId)).data;
      let role = get(/databases/$(database)/documents/roles/$(token.roleId)).data;
      return token.identityVersion == 1 && token.companyId == companyId
        && seller.companyId == companyId && seller.storeId == token.storeId && seller.roleId == token.roleId
        && seller.get('authVersion', 0) == token.authVersion && !seller.get('isDisabled', false)
        && role.companyId == companyId && !role.get('isDisabled', false)
        && (storeId == token.storeId || role.get('userType', '') == 'admin');
    }
    match /financialLedgerCompanies/{companyId}/stores/{storeId} {
      allow read: if ledgerScope(companyId, storeId);
      allow write: if false;
      match /accounts/{account}/entries/{id} { allow read: if ledgerScope(companyId, storeId); allow write: if false; }
      match /peers/{peerId}/entries/{id} { allow read: if ledgerScope(companyId, storeId); allow write: if false; }
      match /months/{month} {
        allow read: if ledgerScope(companyId, storeId);
        allow write: if false;
        match /entries/{id} { allow read: if ledgerScope(companyId, storeId); allow write: if false; }
      }
    }
    match /financialLedgerState/{id} { allow read, write: if false; }
    match /financialLedgerErrors/{id} { allow read, write: if false; }
    match /{collection}/{document=**} {
      allow read, write: if authenticated()
        && !(collection in ['financialLedgerCompanies', 'financialLedgerState', 'financialLedgerErrors']);
    }
  }
}
`;
  return { source, previousHash: createHash('sha256').update(liveRules).digest('hex'), hash: createHash('sha256').update(source).digest('hex') };
}
