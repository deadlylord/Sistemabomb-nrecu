export const verifiedIdentityEnabled = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_VERIFIED_IDENTITY === 'true';

// Production diagnostics are opt-in through ?medir=1; ordinary login stays unchanged.
const appEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_APP_ENV || 'staging';
export const loginDiagnosticsEnabled = appEnv === 'staging' || appEnv === 'production' && typeof window !== 'undefined' && new URLSearchParams(window.location?.search || '').get('medir') === '1';
export const productionIdentityEnabled = verifiedIdentityEnabled && appEnv === 'production';
export function verifiedServiceTarget(projectId: string | undefined) {
 const production = appEnv === 'production';
 if (!verifiedIdentityEnabled || (production ? projectId !== 'factura2-6e811' : appEnv !== 'staging' || projectId !== 'vestika-staging')) throw new Error('El servicio de identidad no corresponde a este entorno.');
 return production ? { region: 'us-central1', login: 'productionPosLogin', users: 'productionPosUsers', roles: 'productionPosRoles', platform: 'productionPosPlatform' } : { region: 'southamerica-east1', login: 'vestikaStagingLogin', users: 'vestikaStagingUsers', roles: 'vestikaStagingRoles', platform: 'vestikaStagingPlatform' };
}
