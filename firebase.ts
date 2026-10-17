import { resolveFirebaseConfig } from './services/firebaseConfig';
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  clearIndexedDbPersistence,
  memoryLocalCache,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const { appEnv, useEmulators, firebaseConfig } = resolveFirebaseConfig(import.meta.env);

const app = initializeApp(firebaseConfig);

let db;
try {
  db = initializeFirestore(app, {
    localCache: import.meta.env.VITE_VERIFIED_IDENTITY === 'true' ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (error) {
  console.error("Could not initialize Firestore with persistence, falling back to default.", error);
  db = getFirestore(app);
}

if (import.meta.env.VITE_VERIFIED_IDENTITY === 'true') {
  clearIndexedDbPersistence(db).catch(() => console.warn('Cierra otras pestañas antiguas de staging para limpiar su caché anterior.'));
}

export const auth = getAuth(app);
export const storage = getStorage(app);

if (useEmulators) {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  connectFirestoreEmulator(db, host, Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080));
  connectAuthEmulator(auth, `http://${host}:${import.meta.env.VITE_AUTH_EMULATOR_PORT || "9099"}`, { disableWarnings: true });
  connectStorageEmulator(storage, host, Number(import.meta.env.VITE_STORAGE_EMULATOR_PORT || 9199));
}

export { db };
