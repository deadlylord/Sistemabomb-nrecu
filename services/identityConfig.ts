export const verifiedIdentityEnabled = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_VERIFIED_IDENTITY === 'true';

// Only staging exposes the local meter before a user has authenticated.
export const loginDiagnosticsEnabled = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_APP_ENV === 'staging';
