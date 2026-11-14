import { prepareCompatibleIdentityRules } from './compatibleIdentityRules.mjs';
import { prepareCompatibleBusinessRules } from './compatibleBusinessRules.mjs';
import { prepareCompatibleLedgerRules } from './compatibleLedgerRules.mjs';

const initialRules = "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /inventory/{document=**} { allow read: if true; allow write: if request.auth != null; } match /categories/{document=**} { allow read: if true; allow write: if request.auth != null; } match /{document=**} { allow read, write: if request.auth != null; } } }";
const ledger = prepareCompatibleLedgerRules(initialRules).source;
const baseline = prepareCompatibleIdentityRules(prepareCompatibleBusinessRules(ledger).source).source;
const normalize = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s/g, '');

const helpers = `    function verificationOpen(storeId) {
      let cutoff = get(/databases/$(database)/documents/stores/$(storeId)).data.get('inventoryVerificationCutoffMinutes', null);
      let localTime = request.time - duration.value(5, 'h');
      return cutoff == null || localTime.hours() * 60 + localTime.minutes() < cutoff;
    }
    function maySetVerificationCutoff(store) {
      let claims = request.auth.token;
      let seller = get(/databases/$(database)/documents/sellers/$(claims.sellerId)).data;
      let role = get(/databases/$(database)/documents/roles/$(claims.roleId)).data;
      let cutoff = store.get('inventoryVerificationCutoffMinutes', null);
      return seller.companyId == claims.companyId && seller.storeId == claims.storeId
        && seller.roleId == claims.roleId && seller.get('authVersion', 0) == claims.authVersion
        && !seller.get('isDisabled', false) && !role.get('isDisabled', false)
        && role.get('companyId', 'default_company') == claims.companyId
        && store.get('companyId', 'default_company') == claims.companyId
        && role.get('userType', '') != 'seller'
        && (role.get('userType', '') == 'admin' || role.get('name', '').lower() in ['administrator', 'admin', 'administrador']
          || role.get('permissions', []).hasAny(['role_manager', 'ceo_center']))
        && (cutoff == null || cutoff is int && cutoff >= 0 && cutoff < 1440);
    }
    function verificationWriteAllowed(collection) {
      return request.resource == null && (collection != 'stores' || resource.data.get('inventoryVerificationCutoffMinutes', null) == null
          || signedIdentity() && maySetVerificationCutoff(resource.data))
        || request.resource != null && ( collection == 'stores' && storeCutoffWriteAllowed()
        || collection in ['pendingDetailedVerifications', 'detailedVerificationHistory'] && verificationOpen(request.resource.data.storeId)
        || collection == 'stockTakes' && stockTakeWriteAllowed()
        || collection == 'productHistory' && (resource != null || request.resource.data.get('changeType', '') != 'Conteo Físico Aplicado'
          || verificationOpen(request.resource.data.storeId))
        || !(collection in ['stores', 'pendingDetailedVerifications', 'detailedVerificationHistory', 'stockTakes', 'productHistory']));
    }
    function storeCutoffWriteAllowed() {
      let data = request.resource.data;
      return resource == null ? !data.keys().hasAny(['inventoryVerificationCutoffMinutes'])
        : !data.diff(resource.data).affectedKeys().hasAny(['inventoryVerificationCutoffMinutes'])
          || signedIdentity() && data.get('companyId', 'default_company') == resource.data.get('companyId', 'default_company')
            && maySetVerificationCutoff(data);
    }
    function stockTakeWriteAllowed() {
      let data = request.resource.data;
      return resource != null && !data.diff(resource.data).affectedKeys().hasAny(['verification', 'productCounts', 'isApplied'])
        || verificationOpen(data.storeId);
    }
`;

export function prepareCompatibleVerificationCutoffRules(current) {
  const fallback = /    match \/\{collection\}\/\{document=\*\*\} \{\n      allow read, write: if (authenticated\(\)[\s\S]*?);\n    \}/;
  const match = baseline.match(fallback);
  if (!match) throw new Error('No se encontró la regla general de producción.');
  const source = baseline.replace(match[0], helpers +
    `    match /{collection}/{document=**} {
      allow read: if ${match[1]};
      allow write: if ${match[1]}
        && verificationWriteAllowed(collection);
    }`);
  if (normalize(current) === normalize(source)) return current;
  if (normalize(current) !== normalize(baseline)) throw new Error('Las reglas activas de producción difieren de la base conocida. Revisa el cambio sobre esas reglas.');
  return source;
}

export const verificationCutoffProductionBaseline = baseline;
