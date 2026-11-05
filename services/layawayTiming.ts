import type { Layaway } from '../types';
import { bogotaDateKey } from './incomeChart';

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric',
});

function ageDays(date: string, now: Date): number | null {
  const start = bogotaDateKey(date);
  const end = bogotaDateKey(now);
  if (!start || !end) return null;
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  if (days < 0 || new Date(date).getTime() > now.getTime()) return null;
  return days;
}

function dateLabel(date: string): string {
  return Number.isFinite(new Date(date).getTime()) ? dateFormatter.format(new Date(date)) : 'Fecha no disponible';
}

export function getLayawayTiming(layaway: Pick<Layaway, 'createdAt'>, now: Date) {
  const days = ageDays(layaway.createdAt, now);
  return {
    createdLabel: dateLabel(layaway.createdAt),
    ageDays: days,
    ageLabel: days === null
      ? (new Date(layaway.createdAt).getTime() > now.getTime() ? 'Fecha futura' : 'Tiempo no disponible')
      : `${days} ${days === 1 ? 'día' : 'días'}`,
  };
}
