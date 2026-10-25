import {createHash} from 'node:crypto';import {prepareCompatibleBusinessRules} from './compatibleBusinessRules.mjs';import {prepareCompatibleLedgerRules} from './compatibleLedgerRules.mjs';
const legacy="rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /inventory/{document=**} { allow read: if true; allow write: if request.auth != null; } match /categories/{document=**} { allow read: if true; allow write: if request.auth != null; } match /{document=**} { allow read, write: if request.auth != null; } } }";
const normalize=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
export function prepareCompatibleIdentityRules(current){
 const baseline=prepareCompatibleBusinessRules(prepareCompatibleLedgerRules(legacy).source).source;
 let source=baseline.replace("|| verifiedScope(companyId, storeId)","|| actualDeveloper() || verifiedScope(companyId, storeId)");
 source=source.replace('    match /{collection}/{document=**}',`    // Authentication material and authority mutations are server-owned.
    // Operational access stays compatible with the current POS rollout;
    // this patch is not a claim of full tenant authorization hardening.
    function signedIdentity() { return authenticated() && request.auth.token.firebase.sign_in_provider == 'custom' && request.auth.token.get('identityVersion',0) == 1; }
    function actualDeveloper() { return signedIdentity() && request.auth.token.get('platformDeveloper',false) == true && developerProfile(); }
    function developerProfile() {
      let t=request.auth.token;
      let s=get(/databases/$(database)/documents/sellers/$(t.sellerId)).data;
      return s.companyId == t.companyId && s.storeId == t.storeId && s.roleId == t.roleId
        && s.get('authVersion',0) == t.authVersion && !s.get('isDisabled',false)
        && (t.sellerId == '-OYqLOlA2gyy_TrUtzf2' || developerGrant(t.sellerId));
    }
    function developerGrant(id) { let g=get(/databases/$(database)/documents/platformDevelopers/$(id)).data; return g.userId == id && g.active == true && g.role == 'developer' && g.grantedBy == '-OYqLOlA2gyy_TrUtzf2'; }
    function validCompany(data) {
      return data.name is string && data.name.size() > 0 && data.name.size() <= 200
        && data.get('status','active') in ['active','inactive','suspended']
        && (!('maxStores' in data) || data.maxStores is int && data.maxStores >= 1 && data.maxStores <= 10000)
        && (!('maxAdmins' in data) || data.maxAdmins is int && data.maxAdmins >= 1 && data.maxAdmins <= 10000)
        && (!('maxSellers' in data) || data.maxSellers is int && data.maxSellers >= 0 && data.maxSellers <= 10000);
    }
    match /authCredentials/{id} { allow read, write: if false; }
    match /authLoginIndex/{id} { allow read, write: if false; }
    match /authLoginAttempts/{id} { allow read, write: if false; }
    match /sellers/{id} { allow read: if authenticated(); allow write: if false; }
    match /roles/{id} { allow read: if authenticated(); allow write: if false; }
    match /platformDevelopers/{id} {
      allow get: if signedIdentity() && (id == request.auth.token.sellerId || request.auth.token.sellerId == '-OYqLOlA2gyy_TrUtzf2' && actualDeveloper());
      allow list: if actualDeveloper() && request.auth.token.sellerId == '-OYqLOlA2gyy_TrUtzf2';
      allow write: if false;
    }
    match /companies/{id} {
      allow read: if authenticated();
      allow create, update: if actualDeveloper() && validCompany(request.resource.data);
      allow delete: if actualDeveloper() && id != 'default_company';
    }
    match /{collection}/{document=**}`).replace("'businessSummaryErrors']);","'businessSummaryErrors', 'authCredentials', 'authLoginIndex', 'authLoginAttempts', 'sellers', 'roles', 'platformDevelopers', 'companies']);");
 if(![normalize(baseline),normalize(source)].includes(normalize(current)))throw Error('Unknown production rules; preserve and review before identity migration');
 return {source,hash:createHash('sha256').update(source).digest('hex'),previousHash:createHash('sha256').update(current).digest('hex')};
}
