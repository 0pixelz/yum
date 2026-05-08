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

  window.ensureFirebaseDb();
})();
