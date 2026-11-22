import { createHash } from 'node:crypto';
import {
  prepareCompatibleVerificationCutoffRules,
  verificationCutoffProductionBaseline,
} from './compatibleVerificationCutoffRules.mjs';

const normalize = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s/g, '');
const baseline = prepareCompatibleVerificationCutoffRules(verificationCutoffProductionBaseline);

const inventoryAnchor = '    match /inventory/{document=**} { allow read: if true; allow write: if authenticated(); }';
const inventoryReplacement = `    // inventory.warehouseUnits is server-owned; clients cannot forge, alter, or
    // delete/reclassify references while warehouse units exist.
    function validWarehouseInventory(data) {
      return data.get('warehouseUnits', 0) is int && data.get('warehouseUnits', 0) >= 0;
    }
    function warehouseInventoryCreate(data) {
      return validWarehouseInventory(data) && data.get('warehouseUnits', 0) == 0;
    }
    function warehouseInventoryUpdate(before, after) {
      return validWarehouseInventory(after)
        && after.get('warehouseUnits', 0) == before.get('warehouseUnits', 0)
        && (before.get('warehouseUnits', 0) == 0 || after.get('categoryId', '') == before.get('categoryId', ''));
    }
    match /inventory/{document=**} {
      allow read: if true;
      allow create: if authenticated() && warehouseInventoryCreate(request.resource.data);
      allow update: if authenticated() && warehouseInventoryUpdate(resource.data, request.resource.data);
      allow delete: if authenticated() && resource.data.get('warehouseUnits', 0) == 0;
    }
    match /warehouseCompanies/{document=**} { allow read, write: if false; }`;

const storeAnchor = `    function storeCutoffWriteAllowed() {
      let data = request.resource.data;
      return resource == null ? !data.keys().hasAny(['inventoryVerificationCutoffMinutes'])
        : !data.diff(resource.data).affectedKeys().hasAny(['inventoryVerificationCutoffMinutes'])
          || signedIdentity() && data.get('companyId', 'default_company') == resource.data.get('companyId', 'default_company')
            && maySetVerificationCutoff(data);
    }`;
const storeReplacement = `    function storeCutoffWriteAllowed() {
      let data = request.resource.data;
      return resource == null ? !data.keys().hasAny(['inventoryVerificationCutoffMinutes', 'warehouseSendEnabled', 'warehouseCategoryVisible'])
        : !data.diff(resource.data).affectedKeys().hasAny(['warehouseSendEnabled', 'warehouseCategoryVisible'])
          && (!data.diff(resource.data).affectedKeys().hasAny(['inventoryVerificationCutoffMinutes'])
            || signedIdentity() && data.get('companyId', 'default_company') == resource.data.get('companyId', 'default_company')
              && maySetVerificationCutoff(data));
    }`;

const excludedAnchor = "'platformDevelopers', 'companies'])";
const excludedReplacement = "'platformDevelopers', 'companies', 'inventory', 'warehouseCompanies'])";

export function prepareCompatibleWarehouseRules(current) {
  if (!baseline.includes(inventoryAnchor) || !baseline.includes(storeAnchor) || baseline.split(excludedAnchor).length !== 3) {
    throw new Error('No se encontraron los bloques esperados de reglas de producción para bodega.');
  }
  const source = baseline
    .replace(inventoryAnchor, inventoryReplacement)
    .replace(storeAnchor, storeReplacement)
    .replaceAll(excludedAnchor, excludedReplacement);
  if (![normalize(baseline), normalize(source)].includes(normalize(current))) {
    throw new Error('Las reglas activas de producción difieren de la base conocida. Revisa el cambio sobre esas reglas.');
  }
  return {
    source,
    hash: createHash('sha256').update(source).digest('hex'),
    previousHash: createHash('sha256').update(current).digest('hex'),
  };
}

export const warehouseProductionBaseline = baseline;
