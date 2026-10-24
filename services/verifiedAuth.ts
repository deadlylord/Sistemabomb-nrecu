import { prepareLoginModules } from './loginModules';
import { measureDiagnosticPhase } from './readDiagnostics';
import { auth, db } from '../firebase';
import { doc, onSnapshot, addDoc, collection } from './measuredFirestore';
import { verifiedIdentityEnabled } from './identityConfig';
import type { Seller, Store, Role, Company } from '../types';

function assertTarget() {
  if (!verifiedIdentityEnabled || auth.app.options.projectId !== 'vestika-staging') throw new Error('La identidad de prueba solo está disponible en staging.');
}
async function call<T>(name: string, data: unknown): Promise<T> {
  assertTarget();
  const sdk = await import('firebase/functions');
  return (await sdk.httpsCallable<unknown, T>(sdk.getFunctions(auth.app, 'southamerica-east1'), name)(data)).data;
}
export async function loginVerified(identifier: string, password: string) {
  assertTarget();
  const [sdk, functions] = await measureDiagnosticPhase('Login: preparar Firebase', prepareLoginModules);
  await measureDiagnosticPhase('Login: cerrar sesión previa', () => sdk.signOut(auth));
  const result = await measureDiagnosticPhase('Login: servicio de identidad', async () => (await functions.httpsCallable<unknown, { customToken: string; user: Seller; store: Store; role: Role; company: Company }>(functions.getFunctions(auth.app, 'southamerica-east1'), 'vestikaStagingLogin')({ identifier, password })).data);
  const signed = await measureDiagnosticPhase('Login: autenticar en Firebase', () => sdk.signInWithCustomToken(auth, result.customToken));
  const { claims } = await measureDiagnosticPhase('Login: validar identidad', () => signed.user.getIdTokenResult());
  if (claims.identityVersion !== 1 || claims.sellerId !== result.user.id || claims.companyId !== result.user.companyId || claims.storeId !== result.user.storeId || claims.roleId !== result.user.roleId || claims.authVersion !== result.user.authVersion) {
    await sdk.signOut(auth); throw new Error('No se pudo verificar la identidad recibida.');
  }
  return { user: result.user, store: result.store, role: result.role, company: result.company };
}
export const manageVerifiedUser = (data: Record<string, unknown>) => call('vestikaStagingUsers', data);
export const manageVerifiedRole = (data: Record<string, unknown>) => call('vestikaStagingRoles', data);
export function recordVerifiedLogin(user: Seller) {
  addDoc(collection(db, 'loginHistory'), { sellerId:user.id, sellerName:user.name, companyId:user.companyId, storeId:user.storeId, date:new Date().toISOString() }).catch(() => console.warn('No se pudo registrar el historial de ingreso.'));
}
export async function logoutVerified(expectedSellerId?: string) {
  const sdk = await import('firebase/auth');
  const signed = auth.currentUser;
  if (expectedSellerId && signed) {
    const { claims } = await signed.getIdTokenResult();
    if (claims.sellerId !== expectedSellerId || signed !== auth.currentUser) return;
  }
  await sdk.signOut(auth);
}

// Firebase auth is shared between tabs. Never retain the old POS user when
// another tab signs in with a different identity or an administrator revokes it.
export function watchVerifiedIdentity(user: Seller, invalidate: () => void) {
  let active = true, invalidated = false, stopAuth = () => {};
  const invalidateOnce = () => { if (active && !invalidated) { invalidated = true; invalidate(); } };
  const stops = [
    onSnapshot(doc(db, 'sellers', user.id), snapshot => {
      if (!active) return;
      const value = snapshot.exists() ? snapshot.data() : null;
      if (!value || value.isDisabled || value.companyId !== user.companyId || value.storeId !== user.storeId || value.roleId !== user.roleId || (value.authVersion || 0) !== (user.authVersion || 0)) invalidateOnce();
    }, invalidateOnce),
    onSnapshot(doc(db, 'roles', user.roleId), snapshot => {
      if (active && (!snapshot.exists() || snapshot.data().isDisabled || snapshot.data().companyId !== user.companyId)) invalidateOnce();
    }, invalidateOnce)
  ];
  import('firebase/auth').then(sdk => {
    if (!active) return;
    stopAuth = sdk.onIdTokenChanged(auth, async signed => {
      if (!signed) { invalidateOnce(); return; }
      try {
        const { claims } = await signed.getIdTokenResult();
        if (active && (claims.sellerId !== user.id || claims.companyId !== user.companyId || claims.roleId !== user.roleId || claims.storeId !== user.storeId || claims.authVersion !== (user.authVersion || 0))) invalidateOnce();
      } catch { invalidateOnce(); }
    });
  });
  return () => { active = false; stopAuth(); stops.forEach(stop => stop()); };
}
