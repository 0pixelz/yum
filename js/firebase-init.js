// ─── FIREBASE INITIALIZATION ─────────────────────────────────────────
// Required for multiplayer rooms. This file must load after the Firebase SDK
// scripts and before js/app.js.

(function() {
  const firebaseConfig = {
    apiKey: "AIzaSyBl1XezlXttwyQLBsEJJV0nkxomzL0uhZw",
    authDomain: "yum-game.firebaseapp.com",
    databaseURL: "https://yum-game-default-rtdb.firebaseio.com",
    projectId: "yum-game",
    storageBucket: "yum-game.firebasestorage.app",
    messagingSenderId: "418931435506",
    appId: "1:418931435506:web:1f37261a6bf89c596b2d6b"
  };

  try {
    if (!window.firebase) {
      console.warn('Firebase SDK not loaded. Multiplayer unavailable.');
      window.db = null;
      return;
    }

    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }

    window.db = firebase.database();
    window.db.ref('.info/connected').on('value', snap => {
      window.yumFirebaseConnected = snap.val() === true;
    });
  } catch(e) {
    console.warn('Firebase not available:', e);
    window.db = null;
    window.yumFirebaseConnected = false;
  }
})();
