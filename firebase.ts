import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsEfJKMRzfOirlzpzPag8hwIyDzEwXicU",
  authDomain: "factura2-6e811.firebaseapp.com",
  databaseURL: "https://factura2-6e811-default-rtdb.firebaseio.com",
  projectId: "factura2-6e811",
  storageBucket: "factura2-6e811.firebasestorage.app",
  messagingSenderId: "1038601908493",
  appId: "1:1038601908493:web:bfcaf3c4312aae287fc044",
  measurementId: "G-1RBDBWCRDW"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence.
// This is the recommended way for v9+ and avoids the deprecated enableIndexedDbPersistence.
// It might throw an error in environments where IndexedDB is not available.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({})
  });
  console.log("Firestore persistence enabled successfully.");
} catch (error) {
  console.error("Could not initialize Firestore with persistence, falling back to default.", error);
  db = getFirestore(app);
}

export const auth = getAuth(app);
export const storage = getStorage(app);
export { db };