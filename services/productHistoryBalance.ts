import { ProductChangeType, type ProductHistoryLog } from '../types';

const quantityPatterns = [
  /(?:cantidad|stock(?:\s+restaurado|\s+devuelto|\s+recibido|\s+rebajado)?|restaurado|devuelto|recibido)\s*:\s*([+-]?\d+)/i,
  /se\s+restaron\s+([+-]?\d+)/i,
  /(?:^|\s)([+-]\s*\d+)(?=\s|$|[.,])/i,
  /\bde\s+([+-]?\d+)\s+unidades\b/i,
];

function signedQuantity(details: string): number | null {
  for (const pattern of quantityPatterns) {
    const match = details.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/\s/g, ''));
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function editedStockDelta(details: string): number | null {
  const transition = details.match(/Stock\s+(\d+)\s*->\s*(\d+)/i);
  if (transition) return Number(transition[2]) - Number(transition[1]);

  const before = details.match(/(?:antes|stock inicial)\s*:\s*(\d+)/i);
  const after = details.match(/(?:stock\s+a|a)\s*(\d+)\s*unidades/i);
  if (before && after) return Number(after[1]) - Number(before[1]);

  const adjustment = details.match(/ajuste(?:\s+de\s+stock)?\s*:\s*([+-]?\d+)/i);
  return adjustment ? Number(adjustment[1]) : null;
}

/** Signed stock movement (+ adds stock, - removes it). Handles legacy descriptions too. */
export function getProductHistoryStockDelta(log: ProductHistoryLog): number | null {
  if (typeof log.stockDelta === 'number' && Number.isFinite(log.stockDelta)) return log.stockDelta;
  const details = log.details || '';
  const qty = signedQuantity(details);

  switch (log.changeType) {
    case ProductChangeType.SALE:
    case ProductChangeType.TRANSFER_OUT:
    case ProductChangeType.DAMAGED:
    case ProductChangeType.EXCHANGE_OUT:
    case ProductChangeType.LAYAWAY_RESERVED:
    case ProductChangeType.PRE_ORDER_FULFILLED:
      return qty === null ? null : -Math.abs(qty);
    case ProductChangeType.SALE_DELETED:
    case ProductChangeType.TRANSFER_IN:
    case ProductChangeType.PURCHASE:
    case ProductChangeType.EXCHANGE_IN:
    case ProductChangeType.DAMAGED_RETURNED:
    case ProductChangeType.LAYAWAY_DELETED:
      return qty === null ? editedStockDelta(details) : Math.abs(qty);
    case ProductChangeType.RETURN:
      return editedStockDelta(details) ?? qty;
    case ProductChangeType.PURCHASE_DELETE:
      return qty === null ? null : -Math.abs(qty);
    case ProductChangeType.TRANSFER_DELETED:
      return qty;
    case ProductChangeType.MANUAL_EDIT:
    case ProductChangeType.STOCK_TAKE_APPLIED:
    case ProductChangeType.DETAILED_VERIFICATION:
    case ProductChangeType.INCONSISTENCY_FIX:
    case ProductChangeType.PURCHASE_EDIT:
      return editedStockDelta(details) ?? qty;
    case ProductChangeType.CREATED: {
      const initial = details.match(/stock inicial:\s*(\d+)/i);
      return initial ? Number(initial[1]) : null;
    }
    default:
      return null;
  }
}

export function calculateProductHistoryBalances<T extends ProductHistoryLog>(logs: T[], currentStock: number): Array<T & { balanceAfter: number | null }> {
  let runningStock = currentStock;
  let balanceKnown = true;
  return [...logs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map(log => {
      const balanceAfter = balanceKnown ? runningStock : null;
      const delta = getProductHistoryStockDelta(log);
      if (delta !== null && balanceKnown) runningStock -= delta;
      else if (delta === null) balanceKnown = false;
      return { ...log, balanceAfter };
    });
}
