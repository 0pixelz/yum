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
      firebase.initializeApp(firebaseConfig);
      window.db = firebase.database();
    } catch(e) {
      console.warn('Firebase not available:', e);
      window.db = null;
    }
