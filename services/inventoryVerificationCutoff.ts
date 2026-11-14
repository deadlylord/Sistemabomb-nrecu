const colombiaOffsetMinutes = 5 * 60;
const minutesPerDay = 24 * 60;

export function inventoryVerificationClosed(cutoff: number | null | undefined, now = new Date()): boolean {
  if (cutoff == null) return false;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMinutes = (utcMinutes + minutesPerDay - colombiaOffsetMinutes) % minutesPerDay;
  return localMinutes >= cutoff;
}

export function inventoryVerificationTime(cutoff: number): string {
  return [Math.floor(cutoff / 60), cutoff % 60].map(part => String(part).padStart(2, '0')).join(':');
}

export function inventoryVerificationClosedMessage(cutoff: number): string {
  return `Verificación de Tienda cerrada desde las ${inventoryVerificationTime(cutoff)} (hora de Colombia). Disponible mañana.`;
}
