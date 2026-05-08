// ─── FIREBASE INITIALIZATION ─────────────────────────────────────────
// Required for multiplayer rooms. This file must load after the Firebase SDK
// scripts and before js/app.js.

(function() {
  window.firebaseConfig = {
    apiKey: "AIzaSyBl1XezlXttwyQLBsEJJV0nkxomzL0uhZw",
    authDomain: "yum-game.firebaseapp.com",
    databaseURL: "https://yum-game-default-rtdb.firebaseio.com",
    projectId: "yum-game",
    storageBucket: "yum-game.firebasestorage.app",
    messagingSenderId: "418931435506",
    appId: "1:418931435506:web:1f37261a6bf89c596b2d6b"
  };

  window.ensureFirebaseDb = function ensureFirebaseDb() {
    try {
      if (!window.firebase || !firebase.database) {
        console.warn('Firebase SDK not loaded. Multiplayer unavailable.');
        window.db = null;
        window.yumFirebaseConnected = false;
        return null;
      }

      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(window.firebaseConfig);

        if (firebase.appCheck) {
          try {
            if (typeof self !== 'undefined' && /[?&]appCheckDebug=1\b/.test(location.search)) {
              self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
            }
            firebase.appCheck().activate(
              new firebase.appCheck.ReCaptchaV3Provider('6LfU598sAAAAAPxSWlcPjq768nbIJwgU5ZwAka6K'),
              true
            );
          } catch(e) {
            console.warn('App Check activation failed:', e);
          }
        }
      }

      window.db = firebase.database();
      // In non-module browser scripts, assigning to window.db usually exposes global db too.
      // Some browsers are stricter, so also eval a var assignment as a fallback for legacy code using db.ref(...).
      try { window.eval('var db = window.db;'); } catch(e) {}

      if (!window.__yumFirebaseConnectionListener && window.db) {
        window.__yumFirebaseConnectionListener = true;
        window.db.ref('.info/connected').on('value', snap => {
          window.yumFirebaseConnected = snap.val() === true;
        });
      }

      return window.db;
    } catch(e) {
      console.warn('Firebase not available:', e);
      window.db = null;
      window.yumFirebaseConnected = false;
      return null;
    }
  };

  // Database rules require auth != null for room reads/writes. Sign the user
  // in anonymously on startup so guests (no Google sign-in) can still play.
  // If a user is already signed in (e.g. via Google), reuse that session.
  // Always reflects the *current* user — a Google sign-in mid-session must
  // not return the stale anonymous user, or createGame/joinGame would write
  // the wrong uid and fail the per-player write rule.
  window.ensureFirebaseAuth = function ensureFirebaseAuth() {
    if (!window.firebase || !firebase.auth) return Promise.resolve(null);
    const auth = firebase.auth();
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    if (window.__yumFirebaseAuthInFlight) return window.__yumFirebaseAuthInFlight;
    window.__yumFirebaseAuthInFlight = (async () => {
      const initialUser = await new Promise(resolve => {
        const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
      });
      if (initialUser) return initialUser;
      try {
        const cred = await auth.signInAnonymously();
        return cred.user;
      } catch(e) {
        console.warn('Anonymous sign-in failed:', e);
        return null;
      } finally {
        window.__yumFirebaseAuthInFlight = null;
      }
    })();
    return window.__yumFirebaseAuthInFlight;
  };

  window.ensureFirebaseDb();
  window.firebaseAuthReady = window.ensureFirebaseAuth();
})();
