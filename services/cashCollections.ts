export interface CollectionIncident {
  type: string; status: string; storeId: string; createdAt: string;
  adjustmentAmount?: number; paymentMethod?: string;
}

// Historical recaudos were always cash and were saved without a payment method.
export function isCashCollection(incident: CollectionIncident): boolean {
  return incident.type === 'Recaudo'
    && incident.status !== 'Pendiente de Aprobación'
    && (!incident.paymentMethod || incident.paymentMethod === 'Efectivo')
    && (Number(incident.adjustmentAmount) || 0) > 0;
}

export function sumCashCollections(incidents: CollectionIncident[], storeId: string | undefined, withinRange: (date: string) => boolean): number {
  if (!storeId) return 0;
  return incidents.reduce((sum, incident) => sum + (incident.storeId === storeId && withinRange(incident.createdAt) && isCashCollection(incident) ? Number(incident.adjustmentAmount) : 0), 0);
}
