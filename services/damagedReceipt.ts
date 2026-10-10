import { IncidentStatus, IncidentType, type Incident, type Product } from '../types';

export function planDamagedReceipt(incident: Incident, product: Product, companyId: string, storeId: string, canReplace: boolean, receivedBy: string, receivedAt: string) {
  if (incident.storeId !== storeId || product.storeId !== storeId ||
      (incident.companyId && incident.companyId !== companyId) || (product.companyId && product.companyId !== companyId)) {
    throw new Error('La novedad y la prenda recibida deben pertenecer a esta empresa y sede.');
  }
  if (incident.type !== IncidentType.DAMAGED || !incident.productId) throw new Error('La novedad no corresponde a una prenda enviada a arreglo o cambio.');
  if (product.id !== incident.productId && !canReplace) throw new Error('Solo un administrador puede recibir una prenda diferente.');
  if (incident.status === IncidentStatus.DEVUELTO_Y_RESUELTO && incident.damagedReceipt?.productId === product.id) return null;
  if (incident.status !== IncidentStatus.EN_ARREGLO_CAMBIO || incident.damagedReceipt) throw new Error('Esta novedad ya fue recibida o no está en arreglo/cambio.');
  if (product.isDisabled) throw new Error('La prenda seleccionada está desactivada.');
  const notes = product.id === incident.productId
    ? `Recibida la misma prenda: ${product.name}. Stock: +1.`
    : `Prenda enviada: ${incident.productName || incident.productId}. Recibida en reemplazo: ${product.name}. Stock recibido: +1; la original permanece descontada.`;
  return {
    productId: product.id,
    notes,
    update: {
      status: IncidentStatus.DEVUELTO_Y_RESUELTO,
      resolutionDate: receivedAt,
      damagedReceipt: { productId: product.id, productName: product.name, receivedBy, receivedAt },
      history: [...(incident.history || []), { status: IncidentStatus.DEVUELTO_Y_RESUELTO, changedBy: receivedBy, timestamp: receivedAt, notes }]
    }
  };
}
