export const verifiedIdentityEnabled = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_VERIFIED_IDENTITY === 'true';
