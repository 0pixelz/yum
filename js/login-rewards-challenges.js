// ─── LOGIN-GATED CREDITS + DAILY CHALLENGES ─────────────────────────
// Owns credit storage, daily challenge state, challenge overlay, and game hooks.
// It does NOT recreate main-menu buttons; login-feature-finalizer.js owns layout.
// This file only fills/updates the Daily Challenge button label.

(function() {
  const PROFILE_KEY = 'yum_google_profile';
  const LEGACY_CREDIT_KEY = 'yum_credit_wallet_v2';
  const DAILY_CHALLENGE_KEY = 'yum_daily_challenge_state_v2';

  const CHALLENGES = [
    { id: 'two_yums', title: 'Roll 2 YAM today', target: 2, reward: 5, stat: 'yums' },
    { id: 'one_win', title: 'Win 1 game today', target: 1, reward: 3, stat: 'wins' },
    { id: 'three_games', title: 'Play 3 games today', target: 3, reward: 3, stat: 'games' },
    { id: 'score_200', title: 'Score 200+ once today', target: 1, reward: 4, stat: 'score200' },
    { id: 'five_scores', title: 'Fill 5 score boxes today', target: 5, reward: 2, stat: 'scores' },
    { id: 'five_classic_wins', title: 'Win 5 games in Classic mode today', target: 5, reward: 20, stat: 'classic_wins' },
    { id: 'score_300', title: 'Score 300+ once today', target: 1, reward: 15, stat: 'score300' }
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getLoginProfile() {
    const p = loadJSON(PROFILE_KEY, null);
    return p && p.type === 'google' && (p.uid || p.email) ? p : null;
  }

  function isLoggedIn() {
    return !!getLoginProfile();
  }

  window.isYumLoggedIn = isLoggedIn;

  function profileId() {
    const p = getLoginProfile();
    if (!p) return '';
    return String(p.uid || p.email || '').trim();
  }

  // Per-user scope for the credit wallet so multiple Google accounts on one
  // device don't share a balance. Falls back to the legacy unscoped key if no
  // profile is loaded yet.
  function creditKey() {
    const id = profileId();
    return id ? `${LEGACY_CREDIT_KEY}__${id}` : LEGACY_CREDIT_KEY;
  }

  // One-time copy of the unscoped legacy wallet into the current user's
  // scoped wallet so existing balances aren't lost on first sign-in after
  // this update.
  function migrateLegacyCreditKey() {
    if (!isLoggedIn()) return;
    const scoped = creditKey();
    if (scoped === LEGACY_CREDIT_KEY) return;
    if (localStorage.getItem(scoped)) return;
    const legacy = localStorage.getItem(LEGACY_CREDIT_KEY);
    if (legacy) localStorage.setItem(scoped, legacy);
  }

  function creditState() {
    return loadJSON(creditKey(), { credits: 0, earned: 0, spent: 0 });
  }

  function saveCreditState(state) {
    saveJSON(creditKey(), state);
  }

  // ── Firebase sync for the credit wallet ───────────────────────────
  // Mirrors the dailyBonus sync in daily-bonus-challenge-overlay.js so the
  // wallet survives a localStorage wipe and follows the user across devices.
  function userCreditRef() {
    try {
      if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
      if (!window.db || !window.firebase || !window.firebase.database) return null;
      const p = getLoginProfile();
      if (!p || !p.uid) return null;
      return window.db.ref('users/' + p.uid + '/creditWallet');
    } catch(e) { return null; }
  }

  function applyRemoteCreditState(remote) {
    if (!remote) return false;
    const local = creditState();
    const localEarned = Math.max(0, Number(local.earned) || 0);
    const localSpent  = Math.max(0, Number(local.spent)  || 0);
    const remoteEarned = Math.max(0, Number(remote.earned) || 0);
    const remoteSpent  = Math.max(0, Number(remote.spent)  || 0);
    // Cumulative counters are monotonic, so take the max from each side.
    const earned = Math.max(localEarned, remoteEarned);
    const spent  = Math.max(localSpent, remoteSpent);
    const credits = Math.max(0, earned - spent);
    const localCredits = Math.max(0, Number(local.credits) || 0);
    if (credits === localCredits && earned === localEarned && spent === localSpent) return false;
    saveCreditState({
      credits, earned, spent,
      lastReason: local.lastReason || remote.lastReason || '',
      updatedAt: Date.now()
    });
    return true;
  }

  function pushCreditState() {
    const ref = userCreditRef();
    if (!ref) return;
    const st = creditState();
    ref.set({
      credits: Math.max(0, Number(st.credits) || 0),
      earned:  Math.max(0, Number(st.earned)  || 0),
      spent:   Math.max(0, Number(st.spent)   || 0),
      updatedAt: Date.now()
    }).catch(() => {});
  }

  let creditHydratePromise = null;
  function hydrateCreditsFromFirebase() {
    if (creditHydratePromise) return creditHydratePromise;
    const ref = userCreditRef();
    if (!ref) return Promise.resolve(false);
    creditHydratePromise = ref.once('value').then(snap => {
      const remote = snap.val();
      const before = creditState();
      const changed = applyRemoteCreditState(remote);
      const localEarned = Math.max(0, Number(before.earned) || 0);
      const localSpent  = Math.max(0, Number(before.spent)  || 0);
      const remoteEarned = Math.max(0, Number((remote && remote.earned)) || 0);
      const remoteSpent  = Math.max(0, Number((remote && remote.spent))  || 0);
      // If we have local progress the server hasn't seen yet, push it up.
      if (localEarned > remoteEarned || localSpent > remoteSpent || !remote) {
        pushCreditState();
      }
      if (changed) {
        window.dispatchEvent(new CustomEvent('yumCreditsChanged', { detail: creditState() }));
        refreshChallengeButtonText();
      }
      return changed;
    }).catch(() => false).finally(() => { creditHydratePromise = null; });
    return creditHydratePromise;
  }

  window.hydrateYumCreditsFromFirebase = hydrateCreditsFromFirebase;

  window.getYumCredits = function getYumCredits() {
    if (!isLoggedIn()) return 0;
    const st = creditState();
    return Math.max(0, Number(st.credits) || 0);
  };

  window.addYumCredits = function addYumCredits(amount, reason) {
    if (!isLoggedIn()) return 0;
    migrateLegacyCreditKey();
    const n = Math.max(0, Number(amount) || 0);
    const st = creditState();
    st.credits = (Number(st.credits) || 0) + n;
    st.earned = (Number(st.earned) || 0) + n;
    st.lastReason = reason || '';
    st.updatedAt = Date.now();
    saveCreditState(st);
    pushCreditState();
    window.dispatchEvent(new CustomEvent('yumCreditsChanged', { detail: st }));
    refreshChallengeButtonText();
    return st.credits;
  };

  window.spendYumCredits = function spendYumCredits(amount, reason) {
    if (!isLoggedIn()) return false;
    migrateLegacyCreditKey();
    const n = Math.max(0, Number(amount) || 0);
    const st = creditState();
    if ((Number(st.credits) || 0) < n) return false;
    st.credits -= n;
    st.spent = (Number(st.spent) || 0) + n;
    st.lastReason = reason || '';
    st.updatedAt = Date.now();
    saveCreditState(st);
    pushCreditState();
    window.dispatchEvent(new CustomEvent('yumCreditsChanged', { detail: st }));
    refreshChallengeButtonText();
    return true;
  };

  window.getYumCreditState = creditState;

  function challengeState() {
    const today = todayKey();
    let st = loadJSON(DAILY_CHALLENGE_KEY, null);
    if (!st || st.date !== today) {
      const index = Math.abs(today.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % CHALLENGES.length;
      st = { date: today, challengeId: CHALLENGES[index].id, progress: 0, claimed: false };
      saveJSON(DAILY_CHALLENGE_KEY, st);
    }
    return st;
  }

  function saveChallengeState(st) {
    saveJSON(DAILY_CHALLENGE_KEY, st);
    window.dispatchEvent(new CustomEvent('yumChallengeChanged', { detail: window.getYumDailyChallengeStatus() }));
    refreshChallengeButtonText();
  }

  function currentChallenge() {
    const st = challengeState();
    return CHALLENGES.find(c => c.id === st.challengeId) || CHALLENGES[0];
  }

  window.getYumDailyChallengeStatus = function getYumDailyChallengeStatus() {
    const ch = currentChallenge();
    const st = challengeState();
    const progress = Math.min(ch.target, Number(st.progress) || 0);
    return {
      id: ch.id,
      title: ch.title,
      target: ch.target,
      reward: ch.reward,
      progress,
      claimed: !!st.claimed,
      complete: progress >= ch.target
    };
  };

  function refreshChallengeButtonText() {
    const btn = document.getElementById('dailyChallengeMenuBtn');
    if (!btn) return;

    if (!isLoggedIn()) {
      btn.remove();
      return;
    }

    const status = window.getYumDailyChallengeStatus();
    btn.className = 'yum-login-feature-btn challenge';
    btn.style.minHeight = '44px';
    btn.style.color = 'var(--gold)';
    btn.style.borderColor = 'rgba(245,166,35,.42)';
    btn.style.background = 'rgba(245,166,35,.12)';
    btn.onclick = window.openDailyChallenge;

    btn.innerHTML = status.claimed
      ? `<i class="icn icn-target"></i> Daily Challenge Claimed · +${status.reward} credits`
      : `<i class="icn icn-target"></i> Daily Challenge · ${status.progress}/${status.target} · +${status.reward} credits`;
  }

  function addChallengeProgress(stat, amount) {
    if (!isLoggedIn()) return;
    const ch = currentChallenge();
    if (ch.stat !== stat) return;
    const st = challengeState();
    if (st.claimed) return;
    const before = Number(st.progress) || 0;
    st.progress = Math.min(ch.target, before + (Number(amount) || 1));
    saveChallengeState(st);
    if (before < ch.target && st.progress >= ch.target && window.showToast) {
      showToast(`Daily challenge complete: +${ch.reward} credits ready`);
    }
  }

  window.claimDailyChallenge = function claimDailyChallenge() {
    if (!isLoggedIn()) {
      if (window.showToast) showToast('Sign in with Google to earn credits');
      return;
    }
    const ch = currentChallenge();
    const st = challengeState();
    if (st.claimed) return;
    if ((Number(st.progress) || 0) < ch.target) {
      if (window.showToast) showToast('Challenge not completed yet');
      return;
    }
    st.claimed = true;
    saveChallengeState(st);
    window.addYumCredits(ch.reward, 'daily_challenge');
    renderDailyChallengeOverlay();
    refreshChallengeButtonText();
    if (window.showToast) showToast(`Challenge reward claimed: +${ch.reward} credits`);
  };

  function injectStyles() {
    if (document.getElementById('loginRewardsChallengesStyles')) return;
    const style = document.createElement('style');
    style.id = 'loginRewardsChallengesStyles';
    style.textContent = `
      .yum-login-feature-btn{width:min(520px,100%);border-radius:999px;padding:10px 14px;font-family:Nunito,sans-serif;font-weight:1000;letter-spacing:1px;cursor:pointer;margin-top:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:var(--white)}
      .yum-login-feature-btn.bonus{border-color:rgba(78,205,196,.36);background:rgba(78,205,196,.1);color:var(--green)}
      .yum-login-feature-btn.challenge{border-color:rgba(245,166,35,.42);background:rgba(245,166,35,.12);color:var(--gold);min-height:44px}
      #dailyChallengeOverlay{position:fixed;inset:0;z-index:991;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.74);padding:18px}
      #dailyChallengeOverlay.open{display:flex}
      .dc-card{width:min(440px,94vw);border-radius:26px;border:1px solid rgba(245,166,35,.36);background:linear-gradient(145deg,rgba(15,52,96,.98),rgba(22,22,62,.98));box-shadow:0 24px 70px rgba(0,0,0,.58);padding:18px;text-align:center}
      .dc-title{font-family:'Bebas Neue',cursive;font-size:2rem;letter-spacing:4px;color:var(--gold)}
      .dc-sub{color:var(--muted);font-weight:900;font-size:.8rem;margin:6px 0 14px}
      .dc-mission{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:14px;margin:12px 0}
      .dc-name{font-weight:1000;color:var(--white);font-size:1.05rem}
      .dc-progress{height:12px;border-radius:999px;background:rgba(0,0,0,.28);overflow:hidden;margin:12px 0 6px}
      .dc-fill{height:100%;background:linear-gradient(135deg,var(--gold),var(--green));border-radius:999px}
      .dc-btn{width:100%;border:none;border-radius:999px;padding:12px 16px;font-family:Nunito,sans-serif;font-weight:1000;letter-spacing:1px;background:linear-gradient(135deg,var(--gold),#ffd166);color:#251400;cursor:pointer}
      .dc-btn:disabled{opacity:.55}
      .dc-close{margin-top:9px;border:none;background:transparent;color:var(--muted);font-weight:900;padding:8px 12px}
    `;
    document.head.appendChild(style);
  }

  function ensureChallengeOverlay() {
    let overlay = document.getElementById('dailyChallengeOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'dailyChallengeOverlay';
    overlay.onclick = e => { if (e.target === overlay) closeDailyChallenge(); };
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderDailyChallengeOverlay() {
    const overlay = ensureChallengeOverlay();
    const status = window.getYumDailyChallengeStatus();
    const pct = Math.round((status.progress / status.target) * 100);
    const canClaim = status.complete && !status.claimed;
    overlay.innerHTML = `<div class="dc-card"><div class="dc-title"><i class="icn icn-target"></i> DAILY CHALLENGE</div><div class="dc-sub">Complete today mission to earn Skin Store credits.</div><div class="dc-mission"><div class="dc-name">${status.title}</div><div class="dc-progress"><div class="dc-fill" style="width:${pct}%"></div></div><div class="dc-sub">${status.progress} / ${status.target} · Reward: +${status.reward} credits</div></div><button class="dc-btn" onclick="claimDailyChallenge()" ${canClaim ? '' : 'disabled'}>${status.claimed ? '<i class="icn icn-check"></i> REWARD CLAIMED' : canClaim ? 'CLAIM CREDITS' : 'KEEP PLAYING'}</button><button class="dc-close" onclick="closeDailyChallenge()">Close</button></div>`;
  }

  window.openDailyChallenge = function openDailyChallenge() {
    injectStyles();
    refreshChallengeButtonText();
    renderDailyChallengeOverlay();
    ensureChallengeOverlay().classList.add('open');
  };

  window.closeDailyChallenge = function closeDailyChallenge() {
    const overlay = document.getElementById('dailyChallengeOverlay');
    if (overlay) overlay.classList.remove('open');
  };

  function patchGameHooks() {
    const roll = window.rollDice;
    if (typeof roll === 'function' && !roll.__dailyChallengeCreditPatched) {
      const patched = function(...args) {
        const result = roll.apply(this, args);
        setTimeout(() => {
          try {
            const vals = Array.isArray(dice) ? dice.map(Number) : [];
            if (vals.length === 5 && vals.every(v => v && v === vals[0])) addChallengeProgress('yums', 1);
          } catch(e) {}
        }, 650);
        return result;
      };
      patched.__dailyChallengeCreditPatched = true;
      window.rollDice = patched;
    }

    const confirm = window.confirmScore;
    if (typeof confirm === 'function' && !confirm.__dailyChallengeCreditPatched) {
      const patchedConfirm = function(...args) {
        const beforeTotal = (() => { try { return Number(calculateTotal(scores)) || 0; } catch(e) { return 0; } })();
        const result = confirm.apply(this, args);
        setTimeout(() => {
          addChallengeProgress('scores', 1);
          try {
            const total = Number(calculateTotal(scores)) || beforeTotal;
            if (total >= 200) addChallengeProgress('score200', 1);
            if (total >= 300) addChallengeProgress('score300', 1);
          } catch(e) {}
        }, 200);
        return result;
      };
      patchedConfirm.__dailyChallengeCreditPatched = true;
      window.confirmScore = patchedConfirm;
    }

    ['startVsBot','startGame'].forEach(name => {
      const fn = window[name];
      if (typeof fn === 'function' && !fn.__dailyChallengeCreditPatched) {
        const patched = function(...args) {
          addChallengeProgress('games', 1);
          return fn.apply(this, args);
        };
        patched.__dailyChallengeCreditPatched = true;
        window[name] = patched;
      }
    });

    const showOver = window.showGameOver;
    if (typeof showOver === 'function' && !showOver.__dailyChallengeCreditPatched) {
      const patchedOver = function(players, ...rest) {
        try {
          const list = Array.isArray(players) ? players : [];
          const top = list[0];
          const tied = list.length > 1 && top && list[1] && top.score === list[1].score;
          if (top && top.isMe && !tied) {
            addChallengeProgress('wins', 1);
            if (!window.powerupMode) addChallengeProgress('classic_wins', 1);
          }
        } catch(e) {}
        return showOver.apply(this, [players, ...rest]);
      };
      patchedOver.__dailyChallengeCreditPatched = true;
      window.showGameOver = patchedOver;
    }
  }

  // Pull the wallet from Firebase whenever the signed-in user changes so
  // that a fresh device or wiped localStorage still sees the correct balance.
  let lastHydratedUid = null;
  function watchAuthForCreditHydrate() {
    if (!isLoggedIn()) return;
    migrateLegacyCreditKey();
    const p = getLoginProfile();
    const uid = p && p.uid ? String(p.uid) : '';
    if (!uid || uid === lastHydratedUid) return;
    lastHydratedUid = uid;
    hydrateCreditsFromFirebase();
  }

  function init() {
    injectStyles();
    ensureChallengeOverlay();
    patchGameHooks();
    refreshChallengeButtonText();
    watchAuthForCreditHydrate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('yumCreditsChanged', refreshChallengeButtonText);
  window.addEventListener('yumChallengeChanged', refreshChallengeButtonText);

  setInterval(() => {
    patchGameHooks();
    refreshChallengeButtonText();
    watchAuthForCreditHydrate();
  }, 800);
})();
