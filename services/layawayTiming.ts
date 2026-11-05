import type { Layaway } from '../types';
import { bogotaDateKey } from './incomeChart';

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric',
});

function ageLabel(date: string, now: Date): string {
  const start = bogotaDateKey(date);
  const end = bogotaDateKey(now);
  if (!start || !end) return 'Tiempo no disponible';
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  if (days < 0 || new Date(date).getTime() > now.getTime()) return 'Fecha futura';
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

function dateLabel(date: string): string {
  return Number.isFinite(new Date(date).getTime()) ? dateFormatter.format(new Date(date)) : 'Fecha no disponible';
}

export function getLayawayTiming(layaway: Pick<Layaway, 'createdAt' | 'payments'>, now: Date) {
  // Payment arrays can be edited or arrive in a different order. Never use their
  // last position as the latest date, and do not treat a zero payment as an abono.
  const lastPayment = layaway.payments.reduce<string | null>((latest, payment) => {
    const time = new Date(payment.date).getTime();
    if (!(payment.amount > 0) || !Number.isFinite(time)) return latest;
    return !latest || time > new Date(latest).getTime() ? payment.date : latest;
  }, null);
  return {
    createdLabel: dateLabel(layaway.createdAt),
    ageLabel: ageLabel(layaway.createdAt, now),
    lastPaymentLabel: lastPayment ? dateLabel(lastPayment) : 'Sin abonos registrados',
    lastPaymentAgeLabel: lastPayment ? ageLabel(lastPayment, now) : null,
  };
}
