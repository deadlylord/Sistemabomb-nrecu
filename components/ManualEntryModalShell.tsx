import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Portaling outside the animated operational view prevents the app header/nav
// from covering this modal, regardless of the view's stacking context.
export default function ManualEntryModalShell({ children, saving, onClose }: React.PropsWithChildren<{ saving: boolean; onClose: () => void }>) {
  const panel = useRef<HTMLDivElement>(null);
  const action = useRef({ saving, onClose });
  action.current = { saving, onClose };
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panel.current?.focus({ preventScroll: true });
    const visual = window.visualViewport;
    const update = () => setViewport(visual ? { top: visual.offsetTop, height: visual.height } : null);
    update(); visual?.addEventListener('resize', update); visual?.addEventListener('scroll', update);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!action.current.saving) action.current.onClose(); }
      if (event.key !== 'Tab') return;
      const controls: HTMLElement[] = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []) as HTMLElement[];
      const visibleControls = controls.filter(node => node.getClientRects().length > 0);
      const first = visibleControls[0], last = visibleControls.at(-1);
      if (!first) { event.preventDefault(); panel.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; visual?.removeEventListener('resize', update); visual?.removeEventListener('scroll', update); document.removeEventListener('keydown', keydown); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);
  const modal = <div data-manual-entry-dialog="true" role="dialog" aria-modal="true" aria-labelledby="manual-entry-title" className="fixed inset-x-0 z-[20000] flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" style={{ top: viewport?.top || 0, height: viewport?.height ?? '100dvh' }}>
    <div ref={panel} tabIndex={-1} className="manual-entry-panel min-h-0 h-full sm:h-auto max-h-full bg-white dark:bg-secondary sm:rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden border border-accent/20 flex flex-col outline-none">{children}</div>
  </div>;
  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}
