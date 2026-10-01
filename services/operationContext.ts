// A late result may belong to a valid operation in a previous company/store.
// It must not replace the receipt or cart currently shown in the new context.
export function operationContextKey(userId: string | undefined, companyId: string, storeId: string | null) {
  return JSON.stringify([userId || '', companyId, storeId]);
}
