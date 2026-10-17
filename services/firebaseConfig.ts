// Public web configuration already used by production. Environment overrides
// remain supported; staging never inherits this production fallback.
const productionWebConfig = {
  apiKey: 'AIzaSyCsEfJKMRzfOirlzpzPag8hwIyDzEwXicU',
  authDomain: 'factura2-6e811.firebaseapp.com',
  databaseURL: 'https://factura2-6e811-default-rtdb.firebaseio.com',
  projectId: 'factura2-6e811',
  storageBucket: 'factura2-6e811.firebasestorage.app',
  messagingSenderId: '1038601908493',
  appId: '1:1038601908493:web:bfcaf3c4312aae287fc044',
  measurementId: 'G-1RBDBWCRDW',
};
export function resolveFirebaseConfig(env: Record<string, string | undefined>) {
  const appEnv = env.VITE_APP_ENV || 'staging';
  const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true';
  const fallback = appEnv === 'production' ? productionWebConfig : undefined;
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || fallback?.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fallback?.authDomain,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL || fallback?.databaseURL,
    projectId: env.VITE_FIREBASE_PROJECT_ID || fallback?.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fallback?.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallback?.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || fallback?.appId,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || fallback?.measurementId,
  };
  const missing = Object.entries(firebaseConfig).filter(([key, value]) => !['databaseURL', 'measurementId'].includes(key) && !value).map(([key]) => key);
  if (missing.length) throw new Error(`Firebase configuration is incomplete for ${appEnv}: ${missing.join(', ')}`);
  const productionId = env.VITE_FIREBASE_PRODUCTION_PROJECT_ID || productionWebConfig.projectId;
  if (appEnv === 'production' && (useEmulators || firebaseConfig.projectId !== productionId)) throw new Error('Safety guard: production must use its production Firebase project without emulators.');
  if (appEnv !== 'production' && !useEmulators && [productionWebConfig.projectId, productionId].includes(firebaseConfig.projectId!)) throw new Error(`Safety guard: ${appEnv} cannot use production Firebase.`);
  return { appEnv, useEmulators, firebaseConfig };
}
