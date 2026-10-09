import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const appEnv = import.meta.env.VITE_APP_ENV || "staging";
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== "databaseURL" && key !== "measurementId" && !value)
  .map(([key]) => key);

if (missingConfig.length) {
  throw new Error(`Firebase configuration is incomplete for ${appEnv}: ${missingConfig.join(", ")}`);
}

const productionProjectId = import.meta.env.VITE_FIREBASE_PRODUCTION_PROJECT_ID;
if (appEnv !== "production" && !useEmulators && (firebaseConfig.projectId === "factura2-6e811" || (productionProjectId && firebaseConfig.projectId === productionProjectId))) {
  throw new Error(
    `Safety guard: ${appEnv} is configured to use the production Firebase project. Use the emulator or a dedicated staging project.`
  );
}

if (appEnv === "production" && useEmulators) {
  throw new Error("Safety guard: production cannot run with Firebase emulators enabled.");
}

const app = initializeApp(firebaseConfig);

let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (error) {
  console.error("Could not initialize Firestore with persistence, falling back to default.", error);
  db = getFirestore(app);
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
