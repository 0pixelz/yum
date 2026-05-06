// ─── DAILY BONUS + DAILY CHALLENGE OVERLAYS ─────────────────────────
// Replaces the toast-only bonus claim and the slim challenge overlay with
// achievement-styled bottom sheets. Clicking the menu buttons opens them.

(function() {
  const PROFILE_KEY      = 'yum_google_profile';
  const BONUS_DATE_KEY   = 'yum_daily_bonus_final_date';
  const BONUS_STREAK_KEY = 'yum_daily_bonus_final_streak';

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function isLoggedIn() {
    const p = loadJSON(PROFILE_KEY, null);
    return !!(p && (p.type === 'google' || p.type === 'apple') && (p.uid || p.email));
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function toast(msg) { if (window.showToast) showToast(msg); }

  function credits() {
    return typeof window.getYumCredits === 'function' ? window.getYumCredits() : 0;
  }

  // ── Daily-bonus reward ladder ──────────────────────────────────────
  // Day index is 1-based and resets when streak breaks.
  // 7-day cycle: 1, 1, 2, 2, 2, 3, 5
  function rewardForStreakDay(day) {
    if (day <= 0) return 1;
    const idx = ((day - 1) % 7) + 1;
    if (idx === 7) return 5;
    if (idx === 6) return 3;
    if (idx >= 3) return 2;
    return 1;
  }

  function streakInfo() {
    const today = todayISO();
    const lastDate = localStorage.getItem(BONUS_DATE_KEY);
    const claimed  = lastDate === today;
    const streak   = Number(localStorage.getItem(BONUS_STREAK_KEY)) || 0;

    let nextStreak;
    if (claimed) {
      nextStreak = streak;
    } else if (lastDate) {
      const diff = Math.round((new Date(today + 'T00:00:00') - new Date(lastDate + 'T00:00:00')) / 86400000);
      nextStreak = diff === 1 ? streak + 1 : 1;
    } else {
      nextStreak = 1;
    }

    return {
      claimed,
      streak,
      nextStreak,
      reward: rewardForStreakDay(nextStreak)
    };
  }

  // ── Styles ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('dailyBonusChallengeOverlayStyles')) return;
    const s = document.createElement('style');
    s.id = 'dailyBonusChallengeOverlayStyles';
    s.textContent = `
      #dboBonusOverlay, #dboChallengeOverlay {
        position: fixed; inset: 0; z-index: 990;
        background: rgba(0,0,0,0.85);
        display: none; align-items: flex-end; justify-content: center;
      }
      #dboBonusOverlay.open, #dboChallengeOverlay.open { display: flex; }
      .dbo-sheet {
        background: var(--bg); width: 100%; max-width: 480px;
        max-height: 90vh; border-radius: 24px 24px 0 0;
        overflow-y: auto;
        transform: translateY(100%);
        transition: transform 0.35s cubic-bezier(0.34,1.2,0.64,1);
        padding-bottom: 28px;
      }
      #dboBonusOverlay.open .dbo-sheet,
      #dboChallengeOverlay.open .dbo-sheet { transform: translateY(0); }
      .dbo-header {
        position: sticky; top: 0; background: var(--panel);
        padding: 16px 18px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex; align-items: center; gap: 10px; z-index: 2;
      }
      .dbo-header-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.4rem; letter-spacing: 3px; color: var(--gold); flex: 1;
      }
      .dbo-close {
        background: none; border: none; color: var(--muted);
        font-size: 1.4rem; cursor: pointer; padding: 4px 8px;
      }
      .dbo-progress-bar {
        background: rgba(255,255,255,0.08); border-radius: 20px;
        height: 8px; margin: 16px 18px 4px; overflow: hidden;
      }
      .dbo-progress-fill {
        height: 100%; border-radius: 20px;
        background: linear-gradient(90deg, var(--green), var(--gold));
        transition: width 0.5s ease;
      }
      .dbo-progress-label {
        font-size: 0.72rem; color: var(--muted);
        letter-spacing: 1px; padding: 0 18px; margin-bottom: 14px;
      }

      /* ── Streak grid for daily bonus ── */
      .dbo-streak-grid {
        display: grid; grid-template-columns: repeat(7, 1fr);
        gap: 8px; padding: 6px 12px 12px;
      }
      .dbo-day {
        background: var(--card);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        padding: 10px 4px 8px;
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        text-align: center;
      }
      .dbo-day.claimed {
        opacity: 0.55;
        border-color: rgba(78,205,196,0.4);
        background: linear-gradient(135deg, rgba(78,205,196,0.12), var(--card));
      }
      .dbo-day.today {
        border-color: rgba(245,166,35,0.6);
        background: linear-gradient(135deg, rgba(245,166,35,0.15), var(--card));
        box-shadow: 0 0 0 2px rgba(245,166,35,0.2);
      }
      .dbo-day.bonus { border-color: rgba(233,69,96,0.45); }
      .dbo-day-num {
        font-size: 0.6rem; color: var(--muted);
        letter-spacing: 1px; font-weight: 800;
      }
      .dbo-day-icon { font-size: 1.25rem; line-height: 1; }
      .dbo-day-amt {
        font-family: 'Bebas Neue', cursive;
        font-size: 0.95rem; letter-spacing: 1.5px;
        color: var(--gold);
      }
      .dbo-day.claimed .dbo-day-amt { color: var(--green); }

      /* ── Featured reward card ── */
      .dbo-feature {
        margin: 12px;
        background: linear-gradient(135deg, rgba(245,166,35,0.18), var(--card));
        border: 1px solid rgba(245,166,35,0.45);
        border-radius: 18px;
        padding: 16px;
        display: flex; align-items: center; gap: 14px;
      }
      .dbo-feature-icon {
        font-size: 2.4rem; line-height: 1; flex-shrink: 0;
      }
      .dbo-feature-body { flex: 1; min-width: 0; }
      .dbo-feature-label {
        font-size: 0.62rem; color: var(--gold);
        font-weight: 800; letter-spacing: 2px;
      }
      .dbo-feature-name {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.2rem; letter-spacing: 2px; color: var(--white);
        margin-top: 2px;
      }
      .dbo-feature-desc {
        font-size: 0.72rem; color: var(--muted);
        line-height: 1.35; margin-top: 3px;
      }
      .dbo-feature-amt {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.6rem; letter-spacing: 2px;
        color: var(--gold); flex-shrink: 0;
      }

      /* ── Big claim button ── */
      .dbo-claim-btn {
        margin: 4px 12px 0;
        width: calc(100% - 24px);
        border: none; border-radius: 50px;
        padding: 14px 16px;
        font-family: 'Nunito', sans-serif;
        font-weight: 900; letter-spacing: 1.5px;
        font-size: 0.95rem;
        background: linear-gradient(135deg, var(--gold), #ffd166);
        color: #251400;
        cursor: pointer;
        box-shadow: 0 6px 24px rgba(245,166,35,0.35);
        transition: transform 0.1s;
      }
      .dbo-claim-btn:active { transform: scale(0.97); }
      .dbo-claim-btn:disabled {
        background: rgba(255,255,255,0.08);
        color: var(--muted);
        box-shadow: none;
        cursor: not-allowed;
      }
      .dbo-claim-btn.green {
        background: linear-gradient(135deg, var(--green), #5fe3d8);
        color: #051818;
        box-shadow: 0 6px 24px rgba(78,205,196,0.35);
      }
      .dbo-foot-note {
        text-align: center;
        color: var(--muted);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        padding: 12px 18px 4px;
      }

      /* ── Mission card for daily challenge ── */
      .dbo-mission {
        margin: 12px;
        background: var(--card);
        border: 1px solid rgba(245,166,35,0.32);
        border-radius: 16px;
        padding: 14px 14px 12px;
        display: flex; flex-direction: column; gap: 10px;
      }
      .dbo-mission-row {
        display: flex; align-items: center; gap: 12px;
      }
      .dbo-mission-icon {
        width: 48px; height: 48px;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(245,166,35,0.22), rgba(78,205,196,0.18));
        border: 1px solid rgba(245,166,35,0.35);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.6rem; line-height: 1; flex-shrink: 0;
      }
      .dbo-mission-info { flex: 1; min-width: 0; }
      .dbo-mission-label {
        font-size: 0.6rem; color: var(--gold);
        font-weight: 800; letter-spacing: 2px;
      }
      .dbo-mission-name {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.15rem; letter-spacing: 2px; color: var(--white);
        margin-top: 2px;
      }
      .dbo-mission-desc {
        font-size: 0.72rem; color: var(--muted);
        line-height: 1.35; margin-top: 3px;
      }
      .dbo-mission-reward {
        flex-shrink: 0;
        text-align: right;
      }
      .dbo-mission-reward-amt {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.4rem; letter-spacing: 1.5px; color: var(--gold);
      }
      .dbo-mission-reward-lbl {
        font-size: 0.58rem; color: var(--muted);
        font-weight: 800; letter-spacing: 1.5px;
      }
      .dbo-mission-prog {
        height: 10px; border-radius: 999px;
        background: rgba(0,0,0,0.32); overflow: hidden;
      }
      .dbo-mission-prog-fill {
        height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, var(--green), var(--gold));
        transition: width 0.4s ease;
      }
      .dbo-mission-prog-lbl {
        text-align: center;
        color: var(--muted);
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 1px;
      }

      /* Wallet pill in header */
      .dbo-wallet {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; border-radius: 999px;
        background: rgba(78,205,196,0.12);
        border: 1px solid rgba(78,205,196,0.28);
        color: var(--green);
        font-family: 'Nunito', sans-serif;
        font-weight: 900; font-size: 0.72rem;
        letter-spacing: 0.5px;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Bonus overlay ──────────────────────────────────────────────────
  function ensureBonusOverlay() {
    let ov = document.getElementById('dboBonusOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'dboBonusOverlay';
    ov.onclick = e => { if (e.target === ov) closeBonus(); };
    document.body.appendChild(ov);
    return ov;
  }

  function renderBonusOverlay() {
    const ov = ensureBonusOverlay();
    const info = streakInfo();
    const cycleDay = info.claimed
      ? (((info.streak - 1) % 7) + 1)
      : (((info.nextStreak - 1) % 7) + 1);
    const pct = Math.round((cycleDay / 7) * 100);

    const days = Array.from({ length: 7 }, (_, i) => {
      const dayNum   = i + 1;
      const isToday  = dayNum === cycleDay;
      const isClaimed = info.claimed ? dayNum <= cycleDay : dayNum < cycleDay;
      const reward   = rewardForStreakDay(dayNum);
      const isBonus  = dayNum === 7;
      const icon     = isClaimed ? '✓' : (isBonus ? '🎁' : '⭐');
      const cls      = [
        'dbo-day',
        isClaimed ? 'claimed' : '',
        isToday ? 'today' : '',
        isBonus ? 'bonus' : ''
      ].filter(Boolean).join(' ');
      return `<div class="${cls}">
        <div class="dbo-day-num">DAY ${dayNum}</div>
        <div class="dbo-day-icon">${icon}</div>
        <div class="dbo-day-amt">+${reward}</div>
      </div>`;
    }).join('');

    const claimBtn = info.claimed
      ? `<button class="dbo-claim-btn green" disabled>✓ CLAIMED TODAY · COME BACK TOMORROW</button>`
      : `<button class="dbo-claim-btn" onclick="window.dboPerformBonusClaim()">🎁 CLAIM +${info.reward} CREDITS</button>`;

    const featureLabel = info.claimed ? "TODAY'S CLAIM" : "TODAY'S REWARD";
    const featureName  = info.claimed
      ? `Day ${cycleDay} reward claimed`
      : `Day ${info.nextStreak} · +${info.reward} credits`;
    const featureDesc  = info.claimed
      ? `Streak: ${info.streak} day${info.streak === 1 ? '' : 's'}. Next claim available tomorrow.`
      : `Log in daily to keep your streak alive. Day 7 awards a +5 bonus.`;

    ov.innerHTML = `
      <div class="dbo-sheet">
        <div class="dbo-header">
          <div class="dbo-header-title">🎁 DAILY BONUS</div>
          <span class="dbo-wallet">💰 ${credits()}</span>
          <button class="dbo-close" onclick="window.dboCloseBonus()">✕</button>
        </div>
        <div class="dbo-progress-bar"><div class="dbo-progress-fill" style="width:${pct}%"></div></div>
        <div class="dbo-progress-label">Day ${cycleDay} / 7 · streak ${info.claimed ? info.streak : info.nextStreak}</div>
        <div class="dbo-streak-grid">${days}</div>
        <div class="dbo-feature">
          <div class="dbo-feature-icon">${info.claimed ? '✓' : '🎁'}</div>
          <div class="dbo-feature-body">
            <div class="dbo-feature-label">${featureLabel}</div>
            <div class="dbo-feature-name">${featureName}</div>
            <div class="dbo-feature-desc">${featureDesc}</div>
          </div>
          <div class="dbo-feature-amt">+${info.reward}</div>
        </div>
        ${claimBtn}
        <div class="dbo-foot-note">Credits unlock skins in the Skin Store</div>
      </div>
    `;
  }

  function openBonus() {
    if (!isLoggedIn()) {
      toast('Sign in with Google or Apple to claim daily bonus');
      return;
    }
    injectStyles();
    renderBonusOverlay();
    requestAnimationFrame(() => ensureBonusOverlay().classList.add('open'));
  }

  function closeBonus() {
    const ov = document.getElementById('dboBonusOverlay');
    if (ov) ov.classList.remove('open');
  }

  function performBonusClaim() {
    if (!isLoggedIn()) return toast('Sign in with Google or Apple to claim daily bonus');
    if (typeof window.addYumCredits !== 'function') return;
    const today = todayISO();
    if (localStorage.getItem(BONUS_DATE_KEY) === today) {
      toast('Daily bonus already claimed today');
      renderBonusOverlay();
      return;
    }
    const info = streakInfo();
    localStorage.setItem(BONUS_DATE_KEY, today);
    localStorage.setItem(BONUS_STREAK_KEY, String(info.nextStreak));
    window.addYumCredits(info.reward, 'daily_bonus_final');
    toast(`🎁 Daily bonus claimed: +${info.reward} credits`);
    renderBonusOverlay();
    if (typeof window.yumRefreshMenuButtons === 'function') window.yumRefreshMenuButtons();
  }

  window.dboCloseBonus = closeBonus;
  window.dboPerformBonusClaim = performBonusClaim;

  // ── Challenge overlay ──────────────────────────────────────────────
  function ensureChallengeOverlay() {
    let ov = document.getElementById('dboChallengeOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'dboChallengeOverlay';
    ov.onclick = e => { if (e.target === ov) closeChallenge(); };
    document.body.appendChild(ov);
    return ov;
  }

  function renderChallengeOverlay() {
    const ov = ensureChallengeOverlay();
    const status = typeof window.getYumDailyChallengeStatus === 'function'
      ? window.getYumDailyChallengeStatus()
      : null;
    if (!status) {
      ov.innerHTML = `<div class="dbo-sheet"><div class="dbo-header"><div class="dbo-header-title">🎯 DAILY CHALLENGE</div><button class="dbo-close" onclick="window.dboCloseChallenge()">✕</button></div><div class="dbo-foot-note">Daily challenge not available right now</div></div>`;
      return;
    }

    const pct = Math.round((status.progress / status.target) * 100);
    const claimBtn = status.claimed
      ? `<button class="dbo-claim-btn green" disabled>✓ REWARD CLAIMED</button>`
      : status.complete
        ? `<button class="dbo-claim-btn" onclick="claimDailyChallenge()">🏁 CLAIM +${status.reward} CREDITS</button>`
        : `<button class="dbo-claim-btn" disabled>KEEP PLAYING · ${status.progress} / ${status.target}</button>`;

    const subtitle = status.claimed
      ? 'Reward claimed. New mission tomorrow.'
      : status.complete
        ? 'Mission complete! Tap to collect your credits.'
        : 'Complete today to earn Skin Store credits.';

    ov.innerHTML = `
      <div class="dbo-sheet">
        <div class="dbo-header">
          <div class="dbo-header-title">🎯 DAILY CHALLENGE</div>
          <span class="dbo-wallet">💰 ${credits()}</span>
          <button class="dbo-close" onclick="window.dboCloseChallenge()">✕</button>
        </div>
        <div class="dbo-progress-bar"><div class="dbo-progress-fill" style="width:${pct}%"></div></div>
        <div class="dbo-progress-label">${status.progress} / ${status.target} · ${pct}% complete</div>
        <div class="dbo-mission">
          <div class="dbo-mission-row">
            <div class="dbo-mission-icon">🎯</div>
            <div class="dbo-mission-info">
              <div class="dbo-mission-label">TODAY'S MISSION</div>
              <div class="dbo-mission-name">${status.title}</div>
              <div class="dbo-mission-desc">${subtitle}</div>
            </div>
            <div class="dbo-mission-reward">
              <div class="dbo-mission-reward-amt">+${status.reward}</div>
              <div class="dbo-mission-reward-lbl">CREDITS</div>
            </div>
          </div>
          <div class="dbo-mission-prog"><div class="dbo-mission-prog-fill" style="width:${pct}%"></div></div>
          <div class="dbo-mission-prog-lbl">${status.progress} / ${status.target}</div>
        </div>
        ${claimBtn}
        <div class="dbo-foot-note">A new challenge unlocks every day at midnight</div>
      </div>
    `;
  }

  function openChallenge() {
    if (!isLoggedIn()) {
      toast('Sign in with Google or Apple to play daily challenges');
      return;
    }
    injectStyles();
    renderChallengeOverlay();
    requestAnimationFrame(() => ensureChallengeOverlay().classList.add('open'));
  }

  function closeChallenge() {
    const ov = document.getElementById('dboChallengeOverlay');
    if (ov) ov.classList.remove('open');
  }

  window.dboCloseChallenge = closeChallenge;

  // ── Hook the menu buttons ──────────────────────────────────────────
  function bindMenuButtons() {
    const bonus = document.getElementById('dailyRewardMenuBtn');
    if (bonus && bonus.onclick !== openBonus) bonus.onclick = openBonus;
    const challenge = document.getElementById('dailyChallengeMenuBtn');
    if (challenge && challenge.onclick !== openChallenge) challenge.onclick = openChallenge;

    const legacy = document.getElementById('dailyRewardOverlay');
    if (legacy) legacy.classList.remove('open');
  }

  // Override globals so other scripts that call openDailyChallenge still work.
  window.openDailyChallenge = openChallenge;
  window.openDailyReward = openBonus;

  function init() {
    injectStyles();
    ensureBonusOverlay();
    ensureChallengeOverlay();
    bindMenuButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('yumCreditsChanged', () => {
    if (document.getElementById('dboBonusOverlay')?.classList.contains('open')) renderBonusOverlay();
    if (document.getElementById('dboChallengeOverlay')?.classList.contains('open')) renderChallengeOverlay();
  });
  window.addEventListener('yumChallengeChanged', () => {
    if (document.getElementById('dboChallengeOverlay')?.classList.contains('open')) renderChallengeOverlay();
  });

  setInterval(() => {
    bindMenuButtons();
    window.openDailyChallenge = openChallenge;
    window.openDailyReward = openBonus;
  }, 600);
})();
