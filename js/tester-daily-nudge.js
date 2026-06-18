// ─── DAILY "COME BACK & PLAY" NUDGE ─────────────────────────────────
// A gentle once-per-day welcome-back card shown on the lobby/home screen.
// Its job is to convert an app open into an actual play session + daily
// bonus claim — i.e. the repeated daily engagement Google Play looks for
// when reviewing a closed test for production access.
//
// Design rules so it never becomes annoying:
//   • Shows at most ONCE per calendar day (scoped per signed-in account).
//   • Only on the lobby/home screen — never over an active game.
//   • Always one tap to dismiss; tapping the backdrop closes it.
//   • If today's daily bonus is already claimed, it leads with "play a
//     game" instead of nagging about the bonus.

(function() {
  const PROFILE_KEY       = 'yum_google_profile';
  // Reuse the same daily-bonus keys the bonus overlay writes, so we can read
  // the current streak / whether today's bonus is already claimed.
  const LEGACY_DATE_KEY   = 'yum_daily_bonus_final_date';
  const LEGACY_STREAK_KEY = 'yum_daily_bonus_final_streak';
  const NUDGE_DATE_KEY    = 'yamio_daily_nudge_date';

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (e) { return fallback; }
  }

  function getProfile() { return loadJSON(PROFILE_KEY, null); }

  function isLoggedIn() {
    const p = getProfile();
    return !!(p && p.type === 'google' && (p.uid || p.email));
  }

  function getProfileId() {
    const p = getProfile();
    if (!p) return '';
    return String(p.uid || p.email || '').trim();
  }

  // Scope the "already shown today" flag (and the bonus keys we read) per
  // account so two people on one device get their own nudge.
  function userKey(suffix) {
    const id = getProfileId();
    return id ? `${suffix}__${id}` : suffix;
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  // ── Streak / bonus state (read-only — the bonus overlay owns writes) ──
  function bonusState() {
    const lastDate = localStorage.getItem(userKey(LEGACY_DATE_KEY)) ||
                     localStorage.getItem(LEGACY_DATE_KEY) || '';
    const streak   = Number(localStorage.getItem(userKey(LEGACY_STREAK_KEY)) ||
                            localStorage.getItem(LEGACY_STREAK_KEY)) || 0;
    return { lastDate, streak, claimedToday: lastDate === todayISO() };
  }

  function shownToday() {
    return localStorage.getItem(userKey(NUDGE_DATE_KEY)) === todayISO();
  }
  function markShownToday() {
    try { localStorage.setItem(userKey(NUDGE_DATE_KEY), todayISO()); } catch (e) {}
  }

  // ── Visibility: only on the lobby/home, never during a game ──────────
  function lobbyVisible() {
    const lobby = document.getElementById('lobbyOverlay');
    if (!lobby) return false;
    // The lobby is hidden with style.display='none' once a game starts.
    return getComputedStyle(lobby).display !== 'none';
  }

  // Don't fight with another sheet/overlay that's already open.
  function anyOverlayOpen() {
    return !!document.querySelector(
      '#dboBonusOverlay.open, #dboChallengeOverlay.open, ' +
      '#tdnOverlay.open, .modal-backdrop.open, #howToPlayOverlay.open'
    );
  }

  // ── Styles ───────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('tdnStyles')) return;
    const s = document.createElement('style');
    s.id = 'tdnStyles';
    s.textContent = `
      #tdnOverlay {
        position: fixed; inset: 0; z-index: 995;
        background: rgba(0,0,0,0.78);
        display: none; align-items: flex-end; justify-content: center;
      }
      #tdnOverlay.open { display: flex; }
      .tdn-card {
        background: var(--bg); width: 100%; max-width: 460px;
        border-radius: 22px 22px 0 0;
        padding: 22px 20px max(22px, env(safe-area-inset-bottom));
        transform: translateY(100%);
        transition: transform 0.34s cubic-bezier(0.34,1.2,0.64,1);
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      #tdnOverlay.open .tdn-card { transform: translateY(0); }
      .tdn-streak {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(245,166,35,0.14);
        border: 1px solid rgba(245,166,35,0.4);
        color: var(--gold); font-weight: 900;
        font-size: 0.72rem; letter-spacing: 1px;
        padding: 5px 11px; border-radius: 999px; margin-bottom: 12px;
      }
      .tdn-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.7rem; letter-spacing: 2px;
        color: var(--white); line-height: 1.1; margin-bottom: 8px;
      }
      .tdn-sub {
        color: var(--muted); font-size: 0.9rem; line-height: 1.45;
        margin-bottom: 16px;
      }
      .tdn-list { list-style: none; margin: 0 0 18px; padding: 0;
        display: flex; flex-direction: column; gap: 9px; }
      .tdn-list li {
        display: flex; align-items: center; gap: 10px;
        color: var(--white); font-size: 0.9rem; font-weight: 600;
      }
      .tdn-list .tdn-ico {
        width: 30px; height: 30px; flex-shrink: 0;
        border-radius: 9px;
        background: linear-gradient(135deg, rgba(245,166,35,0.2), rgba(78,205,196,0.16));
        border: 1px solid rgba(245,166,35,0.32);
        display: flex; align-items: center; justify-content: center;
        font-size: 1rem; color: var(--gold);
      }
      .tdn-btns { display: flex; flex-direction: column; gap: 10px; }
      .tdn-btn {
        border: none; border-radius: 50px;
        padding: 14px 16px;
        font-family: 'Nunito', sans-serif;
        font-weight: 900; letter-spacing: 1px; font-size: 0.92rem;
        cursor: pointer; display: flex; align-items: center;
        justify-content: center; gap: 8px;
        transition: transform 0.1s;
      }
      .tdn-btn:active { transform: scale(0.97); }
      .tdn-btn-primary {
        background: linear-gradient(135deg, var(--gold), #ffd166);
        color: #251400;
        box-shadow: 0 6px 22px rgba(245,166,35,0.32);
      }
      .tdn-btn-secondary {
        background: var(--card); color: var(--white);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .tdn-dismiss {
        background: none; border: none; color: var(--muted);
        font-family: 'Nunito', sans-serif; font-weight: 700;
        font-size: 0.84rem; cursor: pointer;
        padding: 10px; margin: 4px auto 0; display: block;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Render + open/close ──────────────────────────────────────────────
  function ensureOverlay() {
    let ov = document.getElementById('tdnOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'tdnOverlay';
    ov.onclick = e => { if (e.target === ov) close(); };
    document.body.appendChild(ov);
    return ov;
  }

  function close() {
    const ov = document.getElementById('tdnOverlay');
    if (ov) ov.classList.remove('open');
  }

  // Close the nudge, then run an action on the next frame so the dismiss
  // animation doesn't fight with whatever the action opens.
  function closeThen(fn) {
    close();
    setTimeout(() => { try { fn(); } catch (e) {} }, 180);
  }

  function openDailyBonus() {
    closeThen(() => {
      if (typeof window.openDailyReward === 'function') window.openDailyReward();
    });
  }
  function playVsBot() {
    closeThen(() => {
      if (typeof window.openBotModeChoice === 'function') window.openBotModeChoice();
    });
  }
  window.tdnDismiss = close;
  window.tdnOpenBonus = openDailyBonus;
  window.tdnPlayBot = playVsBot;

  function render() {
    const ov = ensureOverlay();
    const st = bonusState();
    const loggedIn = isLoggedIn();
    const bonusAvailToday = loggedIn && !st.claimedToday;

    const streakPill = (st.streak > 0)
      ? `<div class="tdn-streak"><i class="icn icn-flame"></i> ${st.streak}-DAY STREAK${bonusAvailToday ? " · KEEP IT ALIVE" : ""}</div>`
      : '';

    const title = bonusAvailToday ? 'Welcome back — your bonus is waiting' : 'Welcome back to Yamio';
    const sub = bonusAvailToday
      ? 'Two quick things keep your streak going today:'
      : 'Got 3 minutes? A quick game keeps the fun going:';

    const items = [];
    if (bonusAvailToday) {
      items.push(`<li><span class="tdn-ico"><i class="icn icn-gift"></i></span> Claim today’s daily bonus</li>`);
    }
    items.push(`<li><span class="tdn-ico"><i class="icn icn-dice"></i></span> Play one quick game</li>`);
    items.push(`<li><span class="tdn-ico"><i class="icn icn-target"></i></span> Try today’s daily challenge</li>`);

    // Primary CTA: claim the bonus if it's available, otherwise jump into a game.
    const primary = bonusAvailToday
      ? `<button class="tdn-btn tdn-btn-primary" onclick="window.tdnOpenBonus()"><i class="icn icn-gift"></i> CLAIM DAILY BONUS</button>
         <button class="tdn-btn tdn-btn-secondary" onclick="window.tdnPlayBot()"><i class="icn icn-bot"></i> QUICK GAME VS BOT</button>`
      : `<button class="tdn-btn tdn-btn-primary" onclick="window.tdnPlayBot()"><i class="icn icn-bot"></i> QUICK GAME VS BOT</button>`;

    ov.innerHTML = `
      <div class="tdn-card">
        ${streakPill}
        <div class="tdn-title">${title}</div>
        <div class="tdn-sub">${sub}</div>
        <ul class="tdn-list">${items.join('')}</ul>
        <div class="tdn-btns">${primary}</div>
        <button class="tdn-dismiss" onclick="window.tdnDismiss()">Maybe later</button>
      </div>
    `;
  }

  function show() {
    injectStyles();
    render();
    requestAnimationFrame(() => ensureOverlay().classList.add('open'));
    markShownToday();
  }

  // ── Scheduler ────────────────────────────────────────────────────────
  // Try to show once per day. If the lobby isn't ready yet (still loading,
  // or the user landed straight in a game), keep checking quietly and show
  // the next time they're back on the home screen. Give up after a while so
  // we never pop up unexpectedly much later in a long session.
  function tryShow() {
    if (shownToday()) return true;          // done for today
    if (!lobbyVisible()) return false;      // not home — retry later
    if (anyOverlayOpen()) return false;     // something else is up — wait
    show();
    return true;
  }

  function schedule() {
    if (shownToday()) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // ~2 minutes at 3s intervals, then stop trying
    const timer = setInterval(() => {
      attempts++;
      if (tryShow() || attempts >= MAX_ATTEMPTS) clearInterval(timer);
    }, 3000);
    // First attempt shortly after load so a returning player sees it promptly.
    setTimeout(() => { if (tryShow()) clearInterval(timer); }, 2500);
  }

  function init() {
    ensureOverlay();
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
