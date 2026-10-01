import { IncidentStatus } from '../types';

const closedIncidents = new Set([
  IncidentStatus.DEVUELTO_Y_RESUELTO,
  IncidentStatus.CAMBIO_PROCESADO,
  IncidentStatus.TRASLADO_COMPLETADO,
  IncidentStatus.WARRANTY_RETURNED,
]);

function monthNumber(date: Date): number {
  if (!Number.isFinite(date.getTime())) return NaN;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', year: 'numeric', month: 'numeric',
  }).formatToParts(date);
  return Number(parts.find(p => p.type === 'year')?.value) * 12
    + Number(parts.find(p => p.type === 'month')?.value) - 1;
}

export function sellerRecordVisible(createdAt: string, active: boolean, now = new Date()): boolean {
  const age = monthNumber(now) - monthNumber(new Date(createdAt));
  return age === 0 || (age === 1 && active);
}

export function incidentIsActive(status: IncidentStatus): boolean {
  return !closedIncidents.has(status);
}
