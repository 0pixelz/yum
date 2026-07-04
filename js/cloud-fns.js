// ─── CLOUD FUNCTIONS CLIENT WRAPPER ─────────────────────────────────
// Thin promise wrappers around the server-authoritative callables in
// functions/index.js. Every function that touches credits, skins or
// authoritative dice MUST go through here — the RTDB rules block the
// equivalent direct client writes.

(function() {
  const REGION = 'us-central1';

  function getCallable(name) {
    if (!window.firebase || !firebase.functions) {
      throw new Error('Firebase Functions SDK not loaded');
    }
    const fns = firebase.app().functions(REGION);
    return fns.httpsCallable(name);
  }

  async function call(name, data) {
    try {
      const fn = getCallable(name);
      const res = await fn(data || {});
      return res && res.data;
    } catch (err) {
      const code = err && (err.code || err.name) || 'unknown';
      const message = err && (err.message || String(err)) || 'unknown';
      const wrapped = new Error('cloud/' + name + ' failed: ' + message);
      wrapped.code = code;
      wrapped.cause = err;
      throw wrapped;
    }
  }

  window.YumCloud = {
    rollDice: ({ roomId, held }) => call('rollDice', { roomId, held }),
    submitScore: ({ roomId, categoryId }) => call('submitScore', { roomId, categoryId }),
    claimDailyBonus: () => call('claimDailyBonus', {}),
    claimDailyChallenge: ({ challengeId }) => call('claimDailyChallenge', { challengeId }),
    purchaseSkin: ({ skinId }) => call('purchaseSkin', { skinId }),
    grantAchievementCredits: ({ achievementId }) => call('grantAchievementCredits', { achievementId }),
    setUsername: ({ name }) => call('setUsername', { name })
  };
})();
