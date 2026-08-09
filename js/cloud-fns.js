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
    // `dice` is optional and only sent by the client-authoritative paths (3D
    // roll, power-up mode). When omitted the server generates the roll itself.
    rollDice: ({ roomId, held, dice }) => call('rollDice', { roomId, held, dice }),
    // `score`/`dice` are only sent for power-up rooms, where scoring is
    // client-authoritative (Double Points and dice-manipulating power-ups are
    // applied locally). Non-power-up rooms omit them and the server recomputes.
    // `strikeCategory` is the Wildcard power-up's second category (struck to 0
    // in the same turn); power-up rooms only.
    submitScore: ({ roomId, categoryId, score, dice, strikeCategory }) =>
      call('submitScore', { roomId, categoryId, score, dice, strikeCategory }),
    claimDailyBonus: () => call('claimDailyBonus', {}),
    claimDailyChallenge: ({ challengeId }) => call('claimDailyChallenge', { challengeId }),
    purchaseSkin: ({ skinId }) => call('purchaseSkin', { skinId }),
    grantAchievementCredits: ({ achievementId }) => call('grantAchievementCredits', { achievementId }),
    setUsername: ({ name }) => call('setUsername', { name })
  };
})();
