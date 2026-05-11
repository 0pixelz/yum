// ─── LOGIN-GATED CREDITS + DAILY CHALLENGES ─────────────────────────
// Owns credit storage, daily challenge state, challenge overlay, and game hooks.
// It does NOT recreate main-menu buttons; login-feature-finalizer.js owns layout.
// This file only fills/updates the Daily Challenge button label.

(function() {
  const PROFILE_KEY = 'yum_google_profile';
  const LEGACY_CREDIT_KEY = 'yum_credit_wallet_v2';
  const DAILY_CHALLENGE_KEY = 'yum_daily_challenge_state_v3';

  const CHALLENGES = [
    { id: 'two_yums', title: 'Roll 2 YAM today', target: 2, reward: 5, stat: 'yums' },
    { id: 'one_win', title: 'Win 1 game today', target: 1, reward: 3, stat: 'wins' },
    { id: 'three_games', title: 'Play 3 games today', target: 3, reward: 3, stat: 'games' },
    { id: 'score_200', title: 'Score 200+ once today', target: 1, reward: 4, stat: 'score200' },
    { id: 'five_scores', title: 'Fill 5 score boxes today', target: 5, reward: 2, stat: 'scores' },
    { id: 'five_classic_wins', title: 'Win 5 games in Classic mode today', target: 5, reward: 20, stat: 'classic_wins' },
    { id: 'score_300', title: 'Score 300+ once today', target: 1, reward: 15, stat: 'score300' }
  ];
  const DAILY_CHALLENGES_PER_DAY = 3;

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

  function todayChallengeIds() {
    const d = new Date();
    const dayIndex = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    // Step by DAILY_CHALLENGES_PER_DAY each day so consecutive days don't
    // share challenges. With 7 challenges and step 3, GCD is 1, so the daily
    // mix cycles through all 7 starting offsets before repeating.
    const start = (((dayIndex * DAILY_CHALLENGES_PER_DAY) % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length;
    const ids = [];
    for (let i = 0; i < DAILY_CHALLENGES_PER_DAY && i < CHALLENGES.length; i++) {
      ids.push(CHALLENGES[(start + i) % CHALLENGES.length].id);
    }
    return ids;
  }

  function challengeState() {
    const today = todayKey();
    let st = loadJSON(DAILY_CHALLENGE_KEY, null);
    if (!st || st.date !== today || !Array.isArray(st.items)) {
      const ids = todayChallengeIds();
      // If today's stored state is the legacy single-challenge schema, carry
      // forward its progress so a mid-day upgrade doesn't wipe what the player
      // already earned on the matching challenge.
      const carry = {};
      if (st && st.date === today && st.challengeId) {
        carry[st.challengeId] = {
          progress: Math.max(0, Number(st.progress) || 0),
          claimed: !!st.claimed
        };
      }
      st = {
        date: today,
        items: ids.map(id => ({
          id,
          progress: carry[id] ? carry[id].progress : 0,
          claimed: carry[id] ? carry[id].claimed : false
        }))
      };
      saveJSON(DAILY_CHALLENGE_KEY, st);
    }
    return st;
  }

  function saveChallengeState(st) {
    saveJSON(DAILY_CHALLENGE_KEY, st);
    window.dispatchEvent(new CustomEvent('yumChallengeChanged', { detail: window.getYumDailyChallengeStatuses() }));
    refreshChallengeButtonText();
  }

  function statusForItem(item) {
    const def = CHALLENGES.find(c => c.id === item.id) || CHALLENGES[0];
    const progress = Math.min(def.target, Math.max(0, Number(item.progress) || 0));
    return {
      id: def.id,
      title: def.title,
      target: def.target,
      reward: def.reward,
      progress,
      claimed: !!item.claimed,
      complete: progress >= def.target
    };
  }

  window.getYumDailyChallengeStatuses = function getYumDailyChallengeStatuses() {
    return challengeState().items.map(statusForItem);
  };

  // Backwards-compatible single-status accessor: prefer a claimable challenge,
  // then the next in-progress one, then the first.
  window.getYumDailyChallengeStatus = function getYumDailyChallengeStatus() {
    const list = window.getYumDailyChallengeStatuses();
    if (!list.length) return null;
    return list.find(s => s.complete && !s.claimed)
      || list.find(s => !s.claimed)
      || list[0];
  };

  function refreshChallengeButtonText() {
    const btn = document.getElementById('dailyChallengeMenuBtn');
    if (!btn) return;

    if (!isLoggedIn()) {
      btn.remove();
      return;
    }

    const list = window.getYumDailyChallengeStatuses();
    const total = list.length;
    const claimable = list.filter(s => s.complete && !s.claimed).length;
    const claimed = list.filter(s => s.claimed).length;

    btn.className = 'yum-login-feature-btn challenge';
    btn.style.minHeight = '44px';
    btn.style.color = 'var(--gold)';
    btn.style.borderColor = 'rgba(245,166,35,.42)';
    btn.style.background = 'rgba(245,166,35,.12)';
    btn.onclick = window.openDailyChallenge;

    let label;
    if (claimable > 0) {
      label = `${claimable} ready to claim`;
    } else if (claimed === total && total > 0) {
      label = `All ${total} claimed`;
    } else {
      label = `${claimed}/${total} done`;
    }
    btn.innerHTML = `<i class="icn icn-target"></i> Daily Challenges · ${label}`;
  }

  function addChallengeProgress(stat, amount) {
    if (!isLoggedIn()) return;
    const st = challengeState();
    let changed = false;
    const completedRewards = [];
    for (const item of st.items) {
      const def = CHALLENGES.find(c => c.id === item.id);
      if (!def || def.stat !== stat || item.claimed) continue;
      const before = Math.max(0, Number(item.progress) || 0);
      const after = Math.min(def.target, before + (Number(amount) || 1));
      if (after === before) continue;
      item.progress = after;
      changed = true;
      if (before < def.target && after >= def.target) completedRewards.push(def.reward);
    }
    if (!changed) return;
    saveChallengeState(st);
    if (completedRewards.length && window.showToast) {
      const total = completedRewards.reduce((a, b) => a + b, 0);
      showToast(completedRewards.length === 1
        ? `Daily challenge complete: +${total} credits ready`
        : `${completedRewards.length} challenges complete: +${total} credits ready`);
    }
  }

  window.claimDailyChallenge = function claimDailyChallenge(id) {
    if (!isLoggedIn()) {
      if (window.showToast) showToast('Sign in with Google to earn credits');
      return;
    }
    const st = challengeState();
    const targets = id ? st.items.filter(it => it.id === id) : st.items.slice();
    let totalReward = 0;
    let claimedCount = 0;
    for (const item of targets) {
      if (item.claimed) continue;
      const def = CHALLENGES.find(c => c.id === item.id);
      if (!def) continue;
      if ((Math.max(0, Number(item.progress) || 0)) < def.target) continue;
      item.claimed = true;
      totalReward += def.reward;
      claimedCount++;
    }
    if (claimedCount === 0) {
      if (window.showToast) showToast('Challenge not completed yet');
      return;
    }
    saveChallengeState(st);
    window.addYumCredits(totalReward, 'daily_challenge');
    renderDailyChallengeOverlay();
    refreshChallengeButtonText();
    if (window.showToast) {
      showToast(claimedCount === 1
        ? `Challenge reward claimed: +${totalReward} credits`
        : `${claimedCount} rewards claimed: +${totalReward} credits`);
    }
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
    const list = window.getYumDailyChallengeStatuses();
    const missions = list.map(status => {
      const pct = Math.round((status.progress / status.target) * 100);
      const canClaim = status.complete && !status.claimed;
      const btnLabel = status.claimed
        ? '<i class="icn icn-check"></i> CLAIMED'
        : canClaim ? `CLAIM +${status.reward}` : 'KEEP PLAYING';
      return `<div class="dc-mission"><div class="dc-name">${status.title}</div><div class="dc-progress"><div class="dc-fill" style="width:${pct}%"></div></div><div class="dc-sub">${status.progress} / ${status.target} · Reward: +${status.reward} credits</div><button class="dc-btn" onclick="claimDailyChallenge('${status.id}')" ${canClaim ? '' : 'disabled'}>${btnLabel}</button></div>`;
    }).join('');
    overlay.innerHTML = `<div class="dc-card"><div class="dc-title"><i class="icn icn-target"></i> DAILY CHALLENGES</div><div class="dc-sub">Complete today's missions to earn Skin Store credits.</div>${missions}<button class="dc-close" onclick="closeDailyChallenge()">Close</button></div>`;
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
        const beforeTotal = (() => { try { return Number(calcTotal(scores)) || 0; } catch(e) { return 0; } })();
        const result = confirm.apply(this, args);
        setTimeout(() => {
          addChallengeProgress('scores', 1);
          try {
            const total = Number(calcTotal(scores)) || beforeTotal;
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
            const isPowerup = (typeof powerupMode !== 'undefined' && powerupMode);
            if (!isPowerup) addChallengeProgress('classic_wins', 1);
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
