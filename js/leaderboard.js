// ─── LEADERBOARD ─────────────────────────────────────────────────────
// Adds a world-ranking leaderboard reachable from Profile Settings.
//
// Tracks the player's own Online and vs-Bot results (wins / losses /
// win-rate %) in localStorage, mirrors the running totals to a public
// Firebase node (`leaderboard/$uid`), and renders a global ranking that
// can be filtered between Online and vs Bot play.
//
// Solo games (no opponents, not the bot) are ignored — they belong to
// neither board.

(function() {
  const STATS_KEY = 'yum_stats';
  const GOOGLE_PROFILE_KEY = 'yum_google_profile';
  const DEVICE_PROFILE_KEY = 'yum_device_profile';

  let activeBoard = 'online'; // 'online' | 'bot'
  let worldRows = null;       // cached last fetch
  let worldLoading = false;

  // ── storage helpers ──────────────────────────────────────────────
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }
  function loadStats() { return readJSON(STATS_KEY, {}); }
  function saveStats(s) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch(e) {}
  }
  function num(v) { return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 0; }

  function googleProfile() { return readJSON(GOOGLE_PROFILE_KEY, null); }
  function deviceProfile() { return readJSON(DEVICE_PROFILE_KEY, null); }

  function myName() {
    const g = googleProfile();
    if (g && g.name) return g.name;
    const d = deviceProfile();
    if (d && d.name) return d.name;
    try { if (typeof playerName === 'string' && playerName) return playerName; } catch(e) {}
    return 'Player';
  }

  function myAvatarId() {
    try {
      if (window.YumAvatars && typeof window.YumAvatars.getCurrentId === 'function') {
        return window.YumAvatars.getCurrentId();
      }
    } catch(e) {}
    return 'classic';
  }

  function initials(name) {
    return String(name || 'P').trim().split(/\s+/)
      .map(s => s[0]).join('').slice(0, 2).toUpperCase() || 'P';
  }

  function avatarMarkup(avatarId, name, isMe) {
    // The 'google' avatar resolves against the *local* signed-in photo, so it
    // only makes sense for our own row — others fall back to initials.
    if (avatarId === 'google' && !isMe) {
      return `<span class="ya-initials">${esc(initials(name))}</span>`;
    }
    try {
      if (window.YumAvatars && typeof window.YumAvatars.markup === 'function') {
        return window.YumAvatars.markup(avatarId || 'classic', name);
      }
    } catch(e) {}
    return esc(initials(name));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── stat math ────────────────────────────────────────────────────
  function boardStats(stats, board) {
    if (board === 'bot') {
      return { wins: num(stats.botGameWins), losses: num(stats.botGameLosses) };
    }
    return { wins: num(stats.onlineWins), losses: num(stats.onlineLosses) };
  }
  function winRate(wins, losses) {
    const total = wins + losses;
    return total ? Math.round((wins / total) * 100) : 0;
  }

  // ── record a finished game ───────────────────────────────────────
  // Called from the showGameOver patch. `mode` is 'online' or 'bot'.
  function recordResult(mode, iWon) {
    const stats = loadStats();
    if (mode === 'bot') {
      if (iWon) stats.botGameWins = num(stats.botGameWins) + 1;
      else      stats.botGameLosses = num(stats.botGameLosses) + 1;
    } else {
      if (iWon) stats.onlineWins = num(stats.onlineWins) + 1;
      else      stats.onlineLosses = num(stats.onlineLosses) + 1;
    }
    saveStats(stats);
    syncToFirebase(stats);
  }

  // ── Firebase sync (public ranking) ───────────────────────────────
  function leaderboardRef() {
    try {
      if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
      if (!window.db || !window.db.ref) return null;
      return window.db.ref('leaderboard');
    } catch(e) { return null; }
  }

  function currentUid() {
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.uid;
      }
    } catch(e) {}
    return null;
  }

  function syncToFirebase(stats) {
    const ref = leaderboardRef();
    if (!ref) return Promise.resolve();
    const write = () => {
      const uid = currentUid();
      if (!uid) return Promise.resolve();
      const onlineWins   = num(stats.onlineWins);
      const onlineLosses = num(stats.onlineLosses);
      const botWins      = num(stats.botGameWins);
      const botLosses    = num(stats.botGameLosses);
      const payload = {
        name: String(myName()).slice(0, 20),
        avatar: String(myAvatarId()).slice(0, 30),
        onlineWins, onlineLosses, botWins, botLosses,
        totalWins: onlineWins + botWins,
        updatedAt: Date.now()
      };
      return ref.child(uid).set(payload).catch(e => {
        console.warn('Leaderboard sync failed:', e);
      });
    };
    if (window.firebaseAuthReady && typeof window.firebaseAuthReady.then === 'function') {
      return window.firebaseAuthReady.then(write).catch(() => {});
    }
    return write();
  }

  // Push the player's identity/totals up at least once per session so the
  // board has a fresh row even before their first recorded game this load.
  function syncOnce() {
    const stats = loadStats();
    if (num(stats.onlineWins) + num(stats.onlineLosses) +
        num(stats.botGameWins) + num(stats.botGameLosses) === 0) {
      return; // nothing to publish yet
    }
    syncToFirebase(stats);
  }

  function fetchWorld() {
    const ref = leaderboardRef();
    if (!ref) return Promise.resolve(null);
    // Order by totalWins so the query is index-backed; we re-sort per board
    // client-side. Cap the pull so a large board stays cheap on mobile.
    return ref.orderByChild('totalWins').limitToLast(200).once('value')
      .then(snap => {
        const rows = [];
        snap.forEach(child => {
          const v = child.val() || {};
          rows.push({
            uid: child.key,
            name: v.name || 'Player',
            avatar: v.avatar || 'classic',
            onlineWins: num(v.onlineWins),
            onlineLosses: num(v.onlineLosses),
            botWins: num(v.botWins),
            botLosses: num(v.botLosses)
          });
        });
        return rows;
      })
      .catch(e => { console.warn('Leaderboard fetch failed:', e); return null; });
  }

  // ── styles ───────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('leaderboardStyles')) return;
    const style = document.createElement('style');
    style.id = 'leaderboardStyles';
    style.textContent = `
      #leaderboardOverlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.72);
        z-index: 9998;
        display: none; align-items: center; justify-content: center;
        padding: 20px;
      }
      #leaderboardOverlay.show { display: flex; }
      .lb-sheet {
        background: var(--card, #1a1a3e);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 18px;
        padding: 20px;
        max-width: 460px; width: 100%;
        max-height: 88vh; overflow-y: auto;
        color: var(--white, #fff);
        font-family: Nunito, sans-serif;
        box-shadow: 0 22px 70px rgba(0,0,0,0.55);
      }
      .lb-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 14px;
      }
      .lb-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.5rem; letter-spacing: 2.5px;
        color: var(--gold, #f5a623);
      }
      .lb-close {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        color: var(--white, #fff);
        border-radius: 999px;
        width: 34px; height: 34px; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .lb-tabs {
        display: flex; gap: 8px; margin-bottom: 14px;
      }
      .lb-tab {
        flex: 1;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 9px 10px;
        color: var(--muted, #aab);
        font-family: Nunito, sans-serif;
        font-weight: 900; font-size: .85rem;
        letter-spacing: .4px;
        cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      }
      .lb-tab.active {
        background: rgba(245,166,35,0.16);
        border-color: rgba(245,166,35,0.45);
        color: var(--gold, #f5a623);
      }
      .lb-mystats {
        display: flex; gap: 8px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 12px;
        margin-bottom: 16px;
      }
      .lb-stat { flex: 1; text-align: center; }
      .lb-stat-val {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.7rem; line-height: 1;
        color: var(--white, #fff);
      }
      .lb-stat-val.win { color: #4ecdc4; }
      .lb-stat-val.loss { color: #ff6b85; }
      .lb-stat-val.rate { color: var(--gold, #f5a623); }
      .lb-stat-label {
        font-size: .66rem; letter-spacing: 1.2px; text-transform: uppercase;
        color: var(--muted, #aab); margin-top: 4px; font-weight: 800;
      }
      .lb-section-label {
        font-family: 'Bebas Neue', cursive;
        font-size: .8rem; letter-spacing: 2px;
        color: var(--muted, #aab); margin: 4px 4px 8px;
      }
      .lb-row {
        display: flex; align-items: center; gap: 12px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 12px;
        padding: 9px 12px; margin-bottom: 7px;
      }
      .lb-row.me {
        background: rgba(245,166,35,0.12);
        border-color: rgba(245,166,35,0.4);
      }
      .lb-rank {
        flex: 0 0 30px; text-align: center;
        font-family: 'Bebas Neue', cursive; font-size: 1.25rem;
        color: var(--muted, #aab);
      }
      .lb-av {
        width: 36px; height: 36px; flex: 0 0 auto;
        border-radius: 50%; overflow: hidden;
        background: rgba(0,0,0,0.35);
        display: inline-flex; align-items: center; justify-content: center;
        font-family: 'Bebas Neue', cursive; font-size: 1rem; color: #fff;
        border: 1px solid rgba(255,255,255,0.15);
      }
      .lb-av svg, .lb-av img { width: 100%; height: 100%; display: block; object-fit: cover; }
      .lb-who { flex: 1; min-width: 0; }
      .lb-name {
        font-weight: 900; font-size: .9rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .lb-sub { font-size: .68rem; color: var(--muted, #aab); margin-top: 1px; }
      .lb-wins {
        flex: 0 0 auto; text-align: right;
      }
      .lb-wins-val {
        font-family: 'Bebas Neue', cursive; font-size: 1.25rem; color: #4ecdc4;
      }
      .lb-wins-label {
        font-size: .6rem; letter-spacing: 1px; text-transform: uppercase;
        color: var(--muted, #aab);
      }
      .lb-empty, .lb-loading {
        text-align: center; color: var(--muted, #aab);
        font-size: .85rem; padding: 22px 10px;
      }
    `;
    document.head.appendChild(style);
  }

  // ── overlay ──────────────────────────────────────────────────────
  function buildOverlay() {
    if (document.getElementById('leaderboardOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'leaderboardOverlay';
    ov.innerHTML = `
      <div class="lb-sheet" role="dialog" aria-modal="true" aria-labelledby="lbTitle">
        <div class="lb-header">
          <div class="lb-title" id="lbTitle">LEADERBOARD</div>
          <button type="button" class="lb-close" id="lbClose" aria-label="Close">
            <i class="icn icn-close"></i>
          </button>
        </div>
        <div class="lb-tabs">
          <button type="button" class="lb-tab" id="lbTabOnline" data-board="online">
            <i class="icn icn-players"></i> Online
          </button>
          <button type="button" class="lb-tab" id="lbTabBot" data-board="bot">
            <i class="icn icn-bot"></i> vs Bot
          </button>
        </div>
        <div class="lb-mystats" id="lbMyStats"></div>
        <div class="lb-section-label">WORLD RANKING</div>
        <div id="lbWorld"></div>
      </div>
    `;
    document.body.appendChild(ov);

    ov.addEventListener('click', e => { if (e.target === ov) closeLeaderboard(); });
    document.getElementById('lbClose').addEventListener('click', closeLeaderboard);
    ov.querySelectorAll('.lb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeBoard = btn.getAttribute('data-board');
        renderTabs();
        renderMyStats();
        renderWorld();
      });
    });
  }

  function renderTabs() {
    const on = document.getElementById('lbTabOnline');
    const bot = document.getElementById('lbTabBot');
    if (on)  on.classList.toggle('active', activeBoard === 'online');
    if (bot) bot.classList.toggle('active', activeBoard === 'bot');
  }

  function renderMyStats() {
    const el = document.getElementById('lbMyStats');
    if (!el) return;
    const { wins, losses } = boardStats(loadStats(), activeBoard);
    el.innerHTML = `
      <div class="lb-stat"><div class="lb-stat-val win">${wins}</div><div class="lb-stat-label">Won</div></div>
      <div class="lb-stat"><div class="lb-stat-val loss">${losses}</div><div class="lb-stat-label">Lost</div></div>
      <div class="lb-stat"><div class="lb-stat-val rate">${winRate(wins, losses)}%</div><div class="lb-stat-label">Win rate</div></div>
    `;
  }

  function boardWins(row, board) {
    return board === 'bot' ? row.botWins : row.onlineWins;
  }
  function boardLosses(row, board) {
    return board === 'bot' ? row.botLosses : row.onlineLosses;
  }

  function renderWorld() {
    const el = document.getElementById('lbWorld');
    if (!el) return;

    if (worldLoading) {
      el.innerHTML = `<div class="lb-loading"><i class="icn icn-refresh"></i> Loading world ranking…</div>`;
      return;
    }
    if (worldRows === null) {
      el.innerHTML = `<div class="lb-empty">World ranking unavailable offline. Your stats above are saved on this device.</div>`;
      return;
    }

    const board = activeBoard;
    const ranked = worldRows
      .map(r => ({ ...r, w: boardWins(r, board), l: boardLosses(r, board) }))
      .filter(r => r.w + r.l > 0)
      .sort((a, b) => b.w - a.w || winRate(b.w, b.l) - winRate(a.w, a.l));

    if (!ranked.length) {
      el.innerHTML = `<div class="lb-empty">No ${board === 'bot' ? 'vs-bot' : 'online'} games ranked yet. Play a match to claim a spot!</div>`;
      return;
    }

    const uid = currentUid();
    const medal = ['#f5d76e', '#d3d3d3', '#cd7f32'];

    el.innerHTML = ranked.slice(0, 100).map((r, i) => {
      const isMe = uid && r.uid === uid;
      const rankHtml = i < 3
        ? `<i class="icn icn-medal" style="color:${medal[i]}"></i>`
        : (i + 1);
      const rate = winRate(r.w, r.l);
      return `<div class="lb-row${isMe ? ' me' : ''}">
        <div class="lb-rank">${rankHtml}</div>
        <div class="lb-av">${avatarMarkup(r.avatar, r.name, isMe)}</div>
        <div class="lb-who">
          <div class="lb-name">${esc(r.name)}${isMe ? ' (you)' : ''}</div>
          <div class="lb-sub">${r.l} lost · ${rate}% win rate</div>
        </div>
        <div class="lb-wins">
          <div class="lb-wins-val">${r.w}</div>
          <div class="lb-wins-label">Wins</div>
        </div>
      </div>`;
    }).join('');
  }

  function refreshWorld() {
    worldLoading = true;
    renderWorld();
    fetchWorld().then(rows => {
      worldRows = rows;
      worldLoading = false;
      renderWorld();
    });
  }

  function openLeaderboard() {
    injectStyles();
    buildOverlay();
    // Make sure our own latest totals are on the board before we read it.
    syncToFirebase(loadStats());
    renderTabs();
    renderMyStats();
    refreshWorld();
    const ov = document.getElementById('leaderboardOverlay');
    if (ov) ov.classList.add('show');
  }

  function closeLeaderboard() {
    const ov = document.getElementById('leaderboardOverlay');
    if (ov) ov.classList.remove('show');
  }

  window.openLeaderboard = openLeaderboard;
  window.closeLeaderboard = closeLeaderboard;

  // ── hook game-over to record results ─────────────────────────────
  function installGameOverHook() {
    if (typeof window.showGameOver !== 'function') return false;
    if (window.showGameOver.__leaderboardPatched) return true;
    const orig = window.showGameOver;
    const patched = function(players) {
      const r = orig.apply(this, arguments);
      try {
        if (Array.isArray(players) && players.length) {
          const me = players.find(p => p.isMe);
          const opps = players.filter(p => !p.isMe);
          const isBot = (typeof botMode !== 'undefined' && botMode === true);
          const isOnline = (typeof mpMode !== 'undefined' && mpMode === true) && opps.length > 0;
          if (me && (isBot || isOnline)) {
            const maxScore = players.reduce((m, p) => Math.max(m, p.score || 0), 0);
            const iWon = (me.score || 0) >= maxScore; // ties count as a win
            recordResult(isBot ? 'bot' : 'online', iWon);
          }
        }
      } catch(e) { console.warn('Leaderboard record failed:', e); }
      return r;
    };
    patched.__leaderboardPatched = true;
    window.showGameOver = patched;
    return true;
  }

  // showGameOver is also wrapped by achievements.js; retry until it exists
  // so we layer on top of whatever is current.
  (function waitForGameOver() {
    if (installGameOverHook()) return;
    let tries = 0;
    const t = setInterval(() => {
      if (installGameOverHook() || ++tries > 40) clearInterval(t);
    }, 250);
  })();

  // Publish identity/totals shortly after auth settles.
  if (window.firebaseAuthReady && typeof window.firebaseAuthReady.then === 'function') {
    window.firebaseAuthReady.then(() => setTimeout(syncOnce, 1200)).catch(() => {});
  } else {
    setTimeout(syncOnce, 2500);
  }
})();
