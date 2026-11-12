import { initializeApp, _getProvider } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from "firebase/firestore";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, onAuthStateChanged, connectAuthEmulator } from "firebase/auth";
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

// Email and password only, so the Google popup/redirect sign-in code is left out.
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });

// --- Opening instantly with the login saved on the phone ---------------------
// On every start Firebase asks Google whether the saved login is still valid
// (and renews it if it's over an hour old) before saying who is signed in, and
// the database won't even read the copy on the phone until then. On a phone
// that can take seconds. So we remember who was signed in, show their data from
// the phone right away, and let Google's check finish in the background: the
// server is only reached with a real token, and if the login turns out to be
// invalid the app goes back to the login screen.

const SAVED_LOGIN = 'frizo:login';

const readSaved = () => {
  try { return JSON.parse(localStorage.getItem(SAVED_LOGIN)) || null; } catch { return null; }
};
let saved = readSaved();
let checked = false; // Firebase has finished checking the login

onAuthStateChanged(auth, (user) => {
  checked = true;
  saved = user ? { uid: user.uid, email: user.email || '' } : null;
  try {
    if (saved) localStorage.setItem(SAVED_LOGIN, JSON.stringify(saved));
    else localStorage.removeItem(SAVED_LOGIN);
  } catch { /* storage blocked: the app just starts the slower way */ }
});

// Someone was signed in on this phone and Firebase hasn't said otherwise yet.
export const hasSavedLogin = () => !checked && !!saved;
export const signedInEmail = () => auth.currentUser?.email || (checked ? '' : saved?.email || '');

// The database asks Firebase "who is signed in?" through this internal bridge.
// It's made to answer with the saved login until Firebase's own check is done.
// If a Firebase update changes the bridge, this is skipped and the app simply
// starts the slower way.
function trustSavedLogin() {
  try {
    const bridge = _getProvider(app, 'auth-internal').getImmediate();
    const { getUid, addAuthTokenListener, removeAuthTokenListener } = bridge;
    if (![getUid, addAuthTokenListener, removeAuthTokenListener].every(f => typeof f === 'function')) return;
    let known = false; // the bridge has heard from Firebase itself
    const wrapped = new Map();
    bridge.getUid = () => getUid.call(bridge) || (known ? null : saved?.uid || null);
    bridge.addAuthTokenListener = (listener) => {
      if (wrapped.has(listener)) return;
      const onChange = (token) => { known = true; listener(token); };
      wrapped.set(listener, onChange);
      addAuthTokenListener.call(bridge, onChange);
      // Announce the saved user right away instead of waiting for Google.
      if (saved) queueMicrotask(() => { if (!known) listener(null); });
    };
    bridge.removeAuthTokenListener = (listener) => {
      const onChange = wrapped.get(listener);
      if (!onChange) return;
      wrapped.delete(listener);
      removeAuthTokenListener.call(bridge, onChange);
    };
  } catch { /* keep Firebase's normal start */ }
}
// Must run before the database is set up, since that's when it connects to the bridge.
trustSavedLogin();

// Keep a copy of the data on the device so the installed app opens instantly
// and keeps working with a weak signal; writes sync when back online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);

// Local testing only (VITE_USE_EMULATORS=true): talk to the Firebase emulators instead of the real data.
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
