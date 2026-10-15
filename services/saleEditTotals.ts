export interface EditableSaleItem { price: number; quantity: number }
export interface EditableSalePayment { amount: number; method: string; date: string; seller: string; baseAmount?: number; surchargeAmount?: number; surchargePercent?: number }
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function saleEditTotals(items: EditableSaleItem[], discountMode: 'percent' | 'amount', discountValue: number, surcharge: number) {
  const subtotal = round(items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0));
  const discountAmount = discountMode === 'percent' ? Math.round(subtotal * discountValue / 100) : discountValue;
  return { subtotal, discountAmount, discountPercent: discountMode === 'percent' ? discountValue : 0, totalAmount: round(subtotal - discountAmount + surcharge) };
}

export function adjustedSalePayment<T extends EditableSalePayment>(payment: T, amount: number, surcharge?: number): T {
  const updated = { ...payment, amount: round(amount) };
  if (surcharge !== undefined && ('baseAmount' in payment || 'surchargeAmount' in payment || surcharge > 0)) {
    updated.baseAmount = round(amount - surcharge);
    updated.surchargeAmount = round(surcharge);
    updated.surchargePercent = updated.baseAmount > 0 ? surcharge / updated.baseAmount * 100 : 0;
  } else if (amount !== payment.amount && ('baseAmount' in payment || 'surchargeAmount' in payment)) {
    const oldSurcharge = Number(payment.surchargeAmount) || 0;
    const ratio = payment.amount > 0 ? oldSurcharge / payment.amount : 0;
    updated.surchargeAmount = round(amount * ratio);
    updated.baseAmount = round(amount - updated.surchargeAmount);
  }
  return updated;
}

export function validateSaleEdit(items: EditableSaleItem[], payments: EditableSalePayment[], total: number, discount: number, surcharge: number) {
  if (!items.length) throw new Error('Agrega al menos un producto a la venta.');
  if (items.some(item => !Number.isFinite(Number(item.price)) || Number(item.price) < 0 || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0)) throw new Error('Revisa los precios y las cantidades de los productos.');
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  if (![discount, surcharge, total].every(Number.isFinite) || discount < 0 || discount > subtotal || surcharge < 0 || total < 0) throw new Error('Revisa el descuento y el recargo de la venta.');
  if (payments.some(payment => !payment.method || !payment.date || !Number.isFinite(new Date(payment.date).getTime()) || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) < 0)) throw new Error('Revisa los importes, medios y fechas de los pagos.');
  const paid = round(payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
  if (Math.abs(total - paid) > .01) throw new Error('Ajusta los pagos para que coincidan con el nuevo total de la venta.');
}
