import { useSyncExternalStore } from 'react';
import { loginDiagnosticsEnabled } from './identityConfig';
import { clearReadMeasurement } from './readDiagnostics';
const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_APP_ENV || 'staging';
const key = `vestika:${env}:measurement-visible`;
const sessionKey = `${key}:invitation`;
const subscribers = new Set<() => void>();
function initialVisibility() {
  if (typeof window === 'undefined') return loginDiagnosticsEnabled;
  try {
    const invitation = new URLSearchParams(window.location?.search || '').get('medir');
    if (invitation === '1' || invitation === '0') {
      try { window.sessionStorage?.setItem(sessionKey, invitation); } catch {}
      return invitation === '1';
    }
    const value = window.sessionStorage?.getItem(sessionKey) ?? window.localStorage?.getItem(key);
    return value === '1' || value !== '0' && loginDiagnosticsEnabled;
  } catch { return loginDiagnosticsEnabled; }
}
let visible = initialVisibility();
export function getMeasurementVisibility() { return visible; }
export function setMeasurementVisibility(enabled: boolean) {
  visible = enabled;
  if (typeof window !== 'undefined') {
    try { window.localStorage?.setItem(key, enabled ? '1' : '0'); } catch {}
    try { window.sessionStorage?.removeItem(sessionKey); } catch {}
    try {
      const url = new URL(window.location.href); url.searchParams.delete('medir');
      window.history.replaceState(window.history.state, '', url.href);
    } catch {}
  }
  if (!enabled) clearReadMeasurement();
  subscribers.forEach(fn => fn());
}
function subscribe(fn: () => void) { subscribers.add(fn); return () => { subscribers.delete(fn); }; }
export function useMeasurementVisibility() { return useSyncExternalStore(subscribe, getMeasurementVisibility, getMeasurementVisibility); }
export function measurementInvitationUrl() {
  const url = new URL(window.location.href); url.search = ''; url.hash = ''; url.searchParams.set('medir', '1'); return url.href;
}
