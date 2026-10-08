export type PosSecondaryCollection = 'sales' | 'purchases' | 'layaways' | 'giftVouchers' | 'customers' | 'heldCarts' | 'incidents' | 'dailyNotes';
export type PosDataStatus = Partial<Record<PosSecondaryCollection, { loading: boolean; error: string | null }>>;

// Visible reminders and arrivals preserve their automatic behavior, after inventory.
// Historical reports, customer lookup and vouchers require an explicit action.
export const POS_PROGRESSIVE_DATA: PosSecondaryCollection[] = ['purchases', 'layaways', 'heldCarts', 'incidents'];

// One scheduled task, never polling. Allow the inventory's frame to paint first.
export function schedulePosSecondary(run: () => void): () => void {
  let cancelled = false;
  let frame: number | undefined;
  let idle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const callback = () => { if (!cancelled) run(); };
  const afterFrame = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(callback, { timeout: 1500 });
    else timer = setTimeout(callback, 0);
  };
  if (typeof window.requestAnimationFrame === 'function') frame = window.requestAnimationFrame(afterFrame);
  else afterFrame();
  return () => {
    cancelled = true;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    if (timer !== undefined) clearTimeout(timer);
  };
}
