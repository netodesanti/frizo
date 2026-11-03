import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDv6pIcOt7YGK6uN55FlBSG78WzVoqHrL8",
  authDomain: "frizo-orders.firebaseapp.com",
  projectId: "frizo-orders",
  storageBucket: "frizo-orders.firebasestorage.app",
  messagingSenderId: "523939130689",
  appId: "1:523939130689:web:50a7e62a4b088fe09305c0"
};

const app = initializeApp(firebaseConfig);
// Keep a copy of the data on the device so the installed app opens instantly
// and keeps working with a weak signal; writes sync when back online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const auth = getAuth(app);
export const storage = getStorage(app);

// Local testing only (VITE_USE_EMULATORS=true): talk to the Firebase emulators instead of the real data.
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
