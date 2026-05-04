// ─── LOGIN-GATED CREDITS + DAILY CHALLENGES ─────────────────────────
// Owns credit storage, daily challenge state, challenge overlay, and game hooks.
// It does NOT redraw main-menu buttons; login-feature-finalizer.js owns the UI.

(function() {
  const PROFILE_KEY = 'yum_google_profile';
  const CREDIT_KEY = 'yum_credit_wallet_v2';
  const DAILY_CHALLENGE_KEY = 'yum_daily_challenge_state_v2';

  const CHALLENGES = [
    { id: 'two_yums', title: 'Roll 2 YUM today', target: 2, reward: 5, stat: 'yums' },
    { id: 'one_win', title: 'Win 1 game today', target: 1, reward: 3, stat: 'wins' },
    { id: 'three_games', title: 'Play 3 games today', target: 3, reward: 3, stat: 'games' },
    { id: 'score_200', title: 'Score 200+ once today', target: 1, reward: 4, stat: 'score200' },
    { id: 'five_scores', title: 'Fill 5 score boxes today', target: 5, reward: 2, stat: 'scores' }
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
    return p && (p.type === 'google' || p.type === 'apple') && (p.uid || p.email) ? p : null;
  }

  function isLoggedIn() {
    return !!getLoginProfile();
  }

  window.isYumLoggedIn = isLoggedIn;

  function creditState() {
    return loadJSON(CREDIT_KEY, { credits: 0, earned: 0, spent: 0 });
  }

  function saveCreditState(state) {
    saveJSON(CREDIT_KEY, state);
  }

  window.getYumCredits = function getYumCredits() {
    if (!isLoggedIn()) return 0;
    const st = creditState();
    return Math.max(0, Number(st.credits) || 0);
  };

  window.addYumCredits = function addYumCredits(amount, reason) {
    if (!isLoggedIn()) return 0;
    const n = Math.max(0, Number(amount) || 0);
    const st = creditState();
    st.credits = (Number(st.credits) || 0) + n;
    st.earned = (Number(st.earned) || 0) + n;
    st.lastReason = reason || '';
    st.updatedAt = Date.now();
    saveCreditState(st);
    window.dispatchEvent(new CustomEvent('yumCreditsChanged', { detail: st }));
    return st.credits;
  };

  window.spendYumCredits = function spendYumCredits(amount, reason) {
    if (!isLoggedIn()) return false;
    const n = Math.max(0, Number(amount) || 0);
    const st = creditState();
    if ((Number(st.credits) || 0) < n) return false;
    st.credits -= n;
    st.spent = (Number(st.spent) || 0) + n;
    st.lastReason = reason || '';
    st.updatedAt = Date.now();
    saveCreditState(st);
    window.dispatchEvent(new CustomEvent('yumCreditsChanged', { detail: st }));
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
      showToast(`✅ Daily challenge complete: +${ch.reward} credits ready`);
    }
  }

  window.claimDailyChallenge = function claimDailyChallenge() {
    if (!isLoggedIn()) {
      if (window.showToast) showToast('Sign in with Google or Apple to earn credits');
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
    if (window.showToast) showToast(`🏁 Challenge reward claimed: +${ch.reward} credits`);
  };

  function injectStyles() {
    if (document.getElementById('loginRewardsChallengesStyles')) return;
    const style = document.createElement('style');
    style.id = 'loginRewardsChallengesStyles';
    style.textContent = `
      .yum-login-feature-btn{width:min(520px,100%);border-radius:999px;padding:10px 14px;font-family:Nunito,sans-serif;font-weight:1000;letter-spacing:1px;cursor:pointer;margin-top:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:var(--white)}
      .yum-login-feature-btn.bonus{border-color:rgba(78,205,196,.36);background:rgba(78,205,196,.1);color:var(--green)}
      .yum-login-feature-btn.challenge{border-color:rgba(245,166,35,.42);background:rgba(245,166,35,.12);color:var(--gold)}
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
    overlay.innerHTML = `<div class="dc-card"><div class="dc-title">🎯 DAILY CHALLENGE</div><div class="dc-sub">Complete today mission to earn Skin Store credits.</div><div class="dc-mission"><div class="dc-name">${status.title}</div><div class="dc-progress"><div class="dc-fill" style="width:${pct}%"></div></div><div class="dc-sub">${status.progress} / ${status.target} · Reward: +${status.reward} credits</div></div><button class="dc-btn" onclick="claimDailyChallenge()" ${canClaim ? '' : 'disabled'}>${status.claimed ? '✓ REWARD CLAIMED' : canClaim ? 'CLAIM CREDITS' : 'KEEP PLAYING'}</button><button class="dc-close" onclick="closeDailyChallenge()">Close</button></div>`;
  }

  window.openDailyChallenge = function openDailyChallenge() {
    injectStyles();
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
          } catch(e) {}
        }, 200);
        return result;
      };
      patchedConfirm.__dailyChallengeCreditPatched = true;
      window.confirmScore = patchedConfirm;
    }

    ['startSolo','startVsBot','startGame'].forEach(name => {
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
  }

  function init() {
    injectStyles();
    ensureChallengeOverlay();
    patchGameHooks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(patchGameHooks, 1000);
})();
