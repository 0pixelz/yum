// ─── FRIENDS SIDE MENU ───────────────────────────────────────────────
// Adds a slide-out side menu with a friend list, online presence, and the
// ability to send a 1v1 game invite to any friend who is online.
//
// Firebase paths used (see firebase.rules.json):
//   /presence/$uid         — heartbeat (ts, name, avatar, status). Refreshed
//                            every 45s while the tab is open; readers treat a
//                            ts older than ONLINE_FRESH_MS as offline. We
//                            deliberately do NOT use onDisconnect().remove()
//                            because /presence/$uid is shared across every
//                            tab/browser for the same uid — one tab closing
//                            would otherwise wipe the node while another tab
//                            is still live, making the user appear offline to
//                            friends until the survivor's next heartbeat.
//   /friendInvites/$uid    — pending invite addressed to $uid. Sender writes
//                            { from, fromName, fromAvatar, roomCode, mode, ts }.
//
// Friend list is stored locally per device under `yum_friends_v1` so we don't
// need any per-user write rules. Friends are added by sharing a "friend code"
// (the firebase auth uid). The code is shown in the side menu and can be
// copied or shared via the native share sheet.

(function() {
  'use strict';

  const FRIENDS_KEY     = 'yum_friends_v1';
  const PRESENCE_PATH   = 'presence';
  const INVITES_PATH    = 'friendInvites';
  const ONLINE_FRESH_MS = 90 * 1000;     // presence ts within this is "online"
  const HEARTBEAT_MS    = 45 * 1000;
  const INVITE_FRESH_MS = 60 * 1000;     // ignore invites older than this

  let myUid = null;
  let myName = null;
  let myAvatar = null;
  let presenceRef = null;
  let heartbeatTimer = null;
  let inviteRef = null;
  let inviteListener = null;
  let friendPresenceWatchers = {};       // uid -> { ref, listener, online, info }
  let pendingInvite = null;              // active incoming invite shown in modal
  let outgoingInviteUid = null;          // friend uid the mode-picker is targeting
  let outgoingRoomCode  = null;
  let outgoingMode      = 'normal';
  let lastSeenInviteKey = '';            // de-dupe invite-modal triggers
  // Latched copy of outgoingInviteUid so cancel can clear the slot after the
  // mode picker has nulled outgoingInviteUid.
  let _lastInviteTarget = null;

  function el(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function loadFriends() {
    try {
      const arr = JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(f => f && typeof f.uid === 'string') : [];
    } catch(e) { return []; }
  }

  function saveFriends(list) {
    try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(list || [])); } catch(e) {}
  }

  function injectStyles() {
    if (document.getElementById('friendsMenuStyles')) return;
    const style = document.createElement('style');
    style.id = 'friendsMenuStyles';
    style.textContent = `
      .friends-menu-btn {
        position: fixed; top: 14px; left: 64px;
        z-index: 600;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px; color: var(--white);
        font-size: 1.1rem; cursor: pointer;
        padding: 4px 9px; line-height: 1;
        transition: background 0.15s;
        display: inline-flex; align-items: center; justify-content: center;
        gap: 4px;
      }
      .friends-menu-btn:hover { background: rgba(255,255,255,0.22); }
      .friends-menu-btn .fmb-dot {
        display: inline-block; width: 8px; height: 8px; border-radius: 50%;
        background: var(--accent); box-shadow: 0 0 8px var(--accent);
        margin-left: 2px; animation: fmDotPulse 1.4s infinite;
      }
      @keyframes fmDotPulse {
        0%,100% { transform: scale(1); opacity: 1; }
        50%     { transform: scale(1.35); opacity: .55; }
      }

      #friendsScrim {
        position: fixed; inset: 0; z-index: 1099;
        background: rgba(0,0,0,0.55);
        opacity: 0; pointer-events: none;
        transition: opacity .25s ease;
      }
      #friendsScrim.open { opacity: 1; pointer-events: auto; }

      #friendsDrawer {
        position: fixed; top: 0; left: 0; bottom: 0;
        width: min(360px, 88vw);
        z-index: 1100;
        background: var(--bg);
        border-right: 1px solid rgba(255,255,255,0.08);
        box-shadow: 8px 0 32px rgba(0,0,0,0.5);
        transform: translateX(-105%);
        transition: transform .3s cubic-bezier(0.34,1.2,0.64,1);
        display: flex; flex-direction: column;
      }
      #friendsDrawer.open { transform: translateX(0); }

      .fr-head {
        background: linear-gradient(135deg, var(--panel), #1a1a5e);
        padding: 18px 16px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex; align-items: center; gap: 10px;
      }
      .fr-head-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.4rem; letter-spacing: 3px;
        color: var(--gold); flex: 1;
      }
      .fr-head-close {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px; color: var(--white);
        cursor: pointer; padding: 6px 10px; line-height: 1;
        font-size: 1rem;
      }

      .fr-body {
        flex: 1; overflow-y: auto;
        padding: 14px 14px 26px;
      }

      .fr-section-label {
        font-family: 'Bebas Neue', cursive;
        font-size: 0.85rem; letter-spacing: 2px;
        color: var(--muted);
        margin: 14px 4px 8px;
      }

      .fr-mycode-box {
        background: var(--card);
        border: 1px solid rgba(245,166,35,0.25);
        border-radius: 12px;
        padding: 12px;
      }
      .fr-mycode-label {
        font-size: 0.7rem; color: var(--muted); letter-spacing: 1.4px;
        font-weight: 800; text-transform: uppercase; margin-bottom: 4px;
      }
      .fr-mycode-row {
        display: flex; align-items: center; gap: 8px;
      }
      .fr-mycode-val {
        flex: 1; min-width: 0;
        background: rgba(0,0,0,0.25); color: var(--gold);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.78rem;
        padding: 8px 10px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.08);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .fr-mycode-btn {
        background: rgba(78,205,196,0.13);
        color: var(--green);
        border: 1px solid rgba(78,205,196,0.3);
        border-radius: 8px; padding: 8px 10px;
        font-family: 'Nunito', sans-serif;
        font-weight: 800; cursor: pointer;
        font-size: 0.78rem;
      }
      .fr-mycode-hint {
        margin-top: 8px;
        font-size: 0.7rem; color: var(--muted);
      }

      .fr-add-row {
        display: flex; gap: 6px; margin-top: 6px;
      }
      .fr-add-input {
        flex: 1;
        background: rgba(0,0,0,0.25); color: var(--white);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px; padding: 9px 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.8rem; outline: none;
      }
      .fr-add-input:focus { border-color: rgba(245,166,35,0.5); }
      .fr-add-btn {
        background: rgba(245,166,35,0.15);
        color: var(--gold);
        border: 1px solid rgba(245,166,35,0.4);
        border-radius: 8px; padding: 9px 14px;
        font-family: 'Nunito', sans-serif;
        font-weight: 900; cursor: pointer;
        font-size: 0.8rem;
      }

      .fr-list { display: flex; flex-direction: column; gap: 8px; }
      .fr-empty {
        text-align: center; color: var(--muted);
        font-size: 0.82rem; padding: 24px 12px;
        border: 1px dashed rgba(255,255,255,0.12);
        border-radius: 12px;
      }

      .fr-row {
        display: flex; align-items: center; gap: 10px;
        background: var(--card);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 9px 10px;
      }
      .fr-row.online { border-color: rgba(78,205,196,0.35); }
      .fr-avatar {
        width: 40px; height: 40px; flex: 0 0 40px;
        border-radius: 10px; overflow: hidden;
        background: rgba(255,255,255,0.05);
        display: flex; align-items: center; justify-content: center;
        position: relative;
      }
      .fr-avatar svg { width: 100%; height: 100%; display: block; }
      .fr-avatar-fallback {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.1rem; color: var(--gold);
        letter-spacing: 1px;
      }
      .fr-avatar-dot {
        position: absolute; right: -2px; bottom: -2px;
        width: 12px; height: 12px; border-radius: 50%;
        background: #4d5a6b; border: 2px solid var(--bg);
      }
      .fr-row.online .fr-avatar-dot {
        background: var(--green);
        box-shadow: 0 0 6px rgba(78,205,196,0.7);
      }
      .fr-row.in-game .fr-avatar-dot {
        background: var(--gold);
        box-shadow: 0 0 6px rgba(245,166,35,0.7);
      }

      .fr-info { flex: 1; min-width: 0; }
      .fr-name {
        font-weight: 800; font-size: 0.92rem; color: var(--white);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .fr-status {
        font-size: 0.7rem; color: var(--muted);
        margin-top: 2px;
      }
      .fr-row.online .fr-status { color: var(--green); }
      .fr-row.in-game .fr-status { color: var(--gold); }

      .fr-actions { display: flex; gap: 6px; align-items: center; }
      .fr-invite-btn {
        background: rgba(78,205,196,0.13);
        color: var(--green);
        border: 1px solid rgba(78,205,196,0.35);
        border-radius: 8px; padding: 7px 11px;
        font-family: 'Nunito', sans-serif;
        font-weight: 900; cursor: pointer;
        font-size: 0.74rem; letter-spacing: 0.5px;
        white-space: nowrap;
      }
      .fr-invite-btn:disabled {
        opacity: 0.4; cursor: not-allowed;
      }
      .fr-remove-btn {
        background: transparent; color: var(--muted);
        border: none; cursor: pointer;
        font-size: 1rem; padding: 4px 6px;
      }
      .fr-remove-btn:hover { color: var(--accent); }

      /* Incoming invite modal */
      #friendInviteModal {
        position: fixed; inset: 0; z-index: 1200;
        background: rgba(0,0,0,0.85);
        display: none; align-items: center; justify-content: center;
        padding: 18px;
      }
      #friendInviteModal.open { display: flex; }
      .fi-box {
        background: var(--card);
        border: 1px solid rgba(78,205,196,0.4);
        border-radius: 18px;
        max-width: 360px; width: 100%;
        padding: 22px 20px;
        text-align: center;
        box-shadow: 0 16px 60px rgba(0,0,0,0.6);
      }
      .fi-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.3rem; letter-spacing: 3px;
        color: var(--green);
        margin-bottom: 8px;
      }
      .fi-msg {
        color: var(--white); font-size: 0.95rem;
        margin: 6px 0 16px;
      }
      .fi-from {
        font-weight: 900; color: var(--gold);
      }
      .fi-btns { display: flex; gap: 10px; }
      .fi-btn {
        flex: 1; padding: 12px;
        border-radius: 10px;
        font-family: 'Nunito', sans-serif;
        font-weight: 900; letter-spacing: 1px;
        cursor: pointer; border: none;
        font-size: 0.9rem;
      }
      .fi-accept {
        background: var(--green); color: #06302d;
      }
      .fi-decline {
        background: rgba(255,255,255,0.07); color: var(--muted);
        border: 1px solid rgba(255,255,255,0.12);
      }

      /* Mode picker for outgoing invite */
      #friendInviteSendModal {
        position: fixed; inset: 0; z-index: 1200;
        background: rgba(0,0,0,0.85);
        display: none; align-items: center; justify-content: center;
        padding: 18px;
      }
      #friendInviteSendModal.open { display: flex; }
      .fis-box {
        background: var(--card);
        border: 1px solid rgba(245,166,35,0.4);
        border-radius: 18px;
        max-width: 380px; width: 100%;
        padding: 20px;
      }
      .fis-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.2rem; letter-spacing: 2px;
        color: var(--gold);
        text-align: center;
        margin-bottom: 4px;
      }
      .fis-sub {
        text-align: center; color: var(--muted);
        font-size: 0.82rem; margin-bottom: 14px;
      }
      .fis-grid { display: grid; gap: 8px; }
      .fis-mode-btn {
        background: var(--bg);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 12px 14px;
        text-align: left;
        cursor: pointer; color: var(--white);
        display: flex; align-items: center; gap: 12px;
      }
      .fis-mode-btn:hover { border-color: rgba(245,166,35,0.4); }
      .fis-mode-icon { font-size: 1.4rem; color: var(--gold); }
      .fis-mode-title { font-weight: 900; font-size: 0.95rem; }
      .fis-mode-desc { font-size: 0.74rem; color: var(--muted); }
      .fis-cancel {
        margin-top: 12px; width: 100%;
        background: rgba(255,255,255,0.07);
        color: var(--muted);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px; padding: 10px;
        font-family: 'Nunito', sans-serif;
        font-weight: 800; cursor: pointer;
      }

      /* Outgoing-invite waiting overlay */
      #friendInviteWaitOverlay {
        position: fixed; inset: 0; z-index: 1180;
        background: rgba(0,0,0,0.8);
        display: none; align-items: center; justify-content: center;
        padding: 20px;
      }
      #friendInviteWaitOverlay.open { display: flex; }
      .fiw-box {
        background: var(--card);
        border: 1px solid rgba(245,166,35,0.4);
        border-radius: 16px;
        padding: 20px; text-align: center;
        max-width: 320px;
      }
      .fiw-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.1rem; letter-spacing: 2px;
        color: var(--gold);
      }
      .fiw-msg { color: var(--white); margin: 10px 0; font-size: 0.9rem; }
      .fiw-cancel {
        margin-top: 6px;
        background: rgba(255,255,255,0.07); color: var(--muted);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px; padding: 9px 16px;
        font-family: 'Nunito', sans-serif; font-weight: 800;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function injectMarkup() {
    // Side menu button — fixed-position so it floats above the lobby overlay
    // (z-index 500) as well as the in-game header. Appended to body so it
    // isn't trapped in the header's stacking context.
    if (!el('friendsMenuBtn')) {
      const btn = document.createElement('button');
      btn.id = 'friendsMenuBtn';
      btn.className = 'friends-menu-btn';
      btn.title = 'Friends';
      btn.setAttribute('aria-label', 'Open friends menu');
      btn.innerHTML = '<i class="icn icn-players"></i><span class="fmb-dot" id="friendsMenuDot" style="display:none"></span>';
      btn.onclick = () => openFriendsMenu();
      document.body.appendChild(btn);
    }

    if (!el('friendsScrim')) {
      const scrim = document.createElement('div');
      scrim.id = 'friendsScrim';
      scrim.onclick = closeFriendsMenu;
      document.body.appendChild(scrim);
    }

    if (!el('friendsDrawer')) {
      const drawer = document.createElement('aside');
      drawer.id = 'friendsDrawer';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-label', 'Friends');
      drawer.innerHTML = `
        <div class="fr-head">
          <div class="fr-head-title"><i class="icn icn-players"></i> FRIENDS</div>
          <button class="fr-head-close" aria-label="Close" onclick="window.YumFriends.close()"><i class="icn icn-close"></i></button>
        </div>
        <div class="fr-body">
          <div class="fr-section-label">YOUR FRIEND CODE</div>
          <div class="fr-mycode-box">
            <div class="fr-mycode-label">Share this with friends</div>
            <div class="fr-mycode-row">
              <div class="fr-mycode-val" id="frMyCode" title="Your friend code">…</div>
              <button class="fr-mycode-btn" onclick="window.YumFriends.copyMyCode()">COPY</button>
              <button class="fr-mycode-btn" onclick="window.YumFriends.shareMyCode()">SHARE</button>
            </div>
            <div class="fr-mycode-hint">Friends paste this code below to add you.</div>
          </div>

          <div class="fr-section-label">ADD A FRIEND</div>
          <div class="fr-add-row">
            <input class="fr-add-input" id="frAddInput" placeholder="Paste friend code" autocomplete="off" spellcheck="false">
            <button class="fr-add-btn" onclick="window.YumFriends.addFromInput()">ADD</button>
          </div>

          <div class="fr-section-label" id="frListLabel">FRIENDS</div>
          <div class="fr-list" id="frList"></div>
        </div>
      `;
      document.body.appendChild(drawer);
    }

    if (!el('friendInviteModal')) {
      const modal = document.createElement('div');
      modal.id = 'friendInviteModal';
      modal.innerHTML = `
        <div class="fi-box">
          <div class="fi-title"><i class="icn icn-players"></i> GAME INVITE</div>
          <div class="fi-msg"><span class="fi-from" id="fiFromName">A friend</span> wants to play <span id="fiModeLabel">Classic 1v1</span> with you.</div>
          <div class="fi-btns">
            <button class="fi-btn fi-decline" onclick="window.YumFriends.declineInvite()"><i class="icn icn-close"></i> DECLINE</button>
            <button class="fi-btn fi-accept" onclick="window.YumFriends.acceptInvite()"><i class="icn icn-check"></i> ACCEPT</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    if (!el('friendInviteSendModal')) {
      const modal = document.createElement('div');
      modal.id = 'friendInviteSendModal';
      modal.innerHTML = `
        <div class="fis-box">
          <div class="fis-title"><i class="icn icn-bolt"></i> SEND GAME INVITE</div>
          <div class="fis-sub" id="fisSub">Choose a game mode</div>
          <div class="fis-grid">
            <button class="fis-mode-btn" onclick="window.YumFriends.sendInvite('normal')">
              <span class="fis-mode-icon"><i class="icn icn-gamepad"></i></span>
              <div>
                <div class="fis-mode-title">Classic 1v1</div>
                <div class="fis-mode-desc">Standard rules, no power-ups</div>
              </div>
            </button>
            <button class="fis-mode-btn" onclick="window.YumFriends.sendInvite('powerup')">
              <span class="fis-mode-icon" style="color:#f5a623"><i class="icn icn-bolt"></i></span>
              <div>
                <div class="fis-mode-title">Power-Up 1v1</div>
                <div class="fis-mode-desc">Earn and use power-ups during your match</div>
              </div>
            </button>
          </div>
          <button class="fis-cancel" onclick="window.YumFriends.closeSendModal()"><i class="icn icn-close"></i> Cancel</button>
        </div>
      `;
      document.body.appendChild(modal);
    }

    if (!el('friendInviteWaitOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'friendInviteWaitOverlay';
      overlay.innerHTML = `
        <div class="fiw-box">
          <div class="fiw-title">INVITE SENT</div>
          <div class="fiw-msg" id="fiwMsg">Waiting for friend to accept…</div>
          <button class="fiw-cancel" onclick="window.YumFriends.cancelOutgoingInvite()"><i class="icn icn-close"></i> Cancel invite</button>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  }

  // ─── Profile / identity helpers ────────────────────────────────────
  function getMyProfileName() {
    try {
      const inp = el('playerName');
      if (inp && inp.value.trim()) return inp.value.trim().slice(0, 20);
    } catch(e) {}
    try {
      const saved = localStorage.getItem('yum_last_username');
      if (saved) return saved.slice(0, 20);
    } catch(e) {}
    if (typeof window.getYumProfile === 'function') {
      const p = window.getYumProfile();
      if (p && p.name) return String(p.name).slice(0, 20);
    }
    return 'Player';
  }

  function getMyAvatarId() {
    try {
      if (window.YumAvatars && typeof window.YumAvatars.getCurrentId === 'function') {
        return window.YumAvatars.getCurrentId();
      }
    } catch(e) {}
    return null;
  }

  function avatarMarkup(avatarId, name) {
    if (window.YumAvatars && typeof window.YumAvatars.markup === 'function') {
      try { return window.YumAvatars.markup(avatarId, name); } catch(e) {}
    }
    const initial = (name || '?').trim().slice(0, 1).toUpperCase();
    return `<span class="fr-avatar-fallback">${escapeHtml(initial)}</span>`;
  }

  // ─── Presence ──────────────────────────────────────────────────────
  async function ensureDb() {
    if (window.db) return window.db;
    if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    for (let i = 0; i < 12 && !window.db; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    }
    return window.db || null;
  }

  async function ensureAuth() {
    if (typeof window.ensureFirebaseAuth !== 'function') return null;
    try {
      return await Promise.race([
        window.ensureFirebaseAuth(),
        new Promise(r => setTimeout(() => r(null), 7000))
      ]);
    } catch(e) { return null; }
  }

  function gameStatusLabel() {
    // Simple heuristic: if a multiplayer banner is visible the user is in a game.
    try {
      const banner = el('mpBanner');
      if (banner && banner.style.display === 'flex') return 'in-game';
      const lobby = el('lobbyOverlay');
      if (lobby && lobby.style.display !== 'none') return 'lobby';
    } catch(e) {}
    return 'idle';
  }

  // Returns 'bot-classic' | 'bot-powerup' | 'mp-classic' | 'mp-powerup' | null.
  // The globals live in app.js / powerup-mode.js as classic-script `let`s,
  // so we guard with typeof in case a script failed to load.
  function gameModeLabel() {
    try {
      const mp  = (typeof mpMode      !== 'undefined') && mpMode;
      const bot = (typeof botMode     !== 'undefined') && botMode;
      const pup = (typeof powerupMode !== 'undefined') && powerupMode;
      if (bot) return pup ? 'bot-powerup' : 'bot-classic';
      if (mp)  return pup ? 'mp-powerup'  : 'mp-classic';
    } catch(e) {}
    return null;
  }

  async function startPresence() {
    const db = await ensureDb();
    if (!db) return;
    const user = await ensureAuth();
    if (!user) return;

    myUid    = user.uid;
    myName   = getMyProfileName();
    myAvatar = getMyAvatarId();

    presenceRef = db.ref(PRESENCE_PATH + '/' + myUid);
    // Cancel any onDisconnect handler an earlier session may have left
    // registered on this connection. We intentionally do not register a new
    // remove() handler — see the file header for why.
    try { await presenceRef.onDisconnect().cancel(); } catch(e) {}
    await writePresence();

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => writePresence().catch(() => {}), HEARTBEAT_MS);

    // Refresh on visibility so a backgrounded tab doesn't look offline forever.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') writePresence().catch(() => {});
    });

    // Always-on listener for incoming friend invites.
    attachInviteListener(db);
    // Watch presence for every saved friend.
    attachAllFriendPresence();

    setMyCodeText(myUid);
  }

  async function writePresence() {
    if (!presenceRef) return;
    myName   = getMyProfileName();
    myAvatar = getMyAvatarId();
    const status = gameStatusLabel();
    const payload = {
      ts: Date.now(),
      name: myName,
      status: status
    };
    if (myAvatar) payload.avatar = myAvatar;
    if (status === 'in-game') {
      const mode = gameModeLabel();
      if (mode) payload.mode = mode;
    }
    try { await presenceRef.set(payload); } catch(e) {}
  }

  // ─── Incoming invite listener ──────────────────────────────────────
  function attachInviteListener(db) {
    if (!db || !myUid) return;
    detachInviteListener();
    inviteRef = db.ref(INVITES_PATH + '/' + myUid);
    inviteListener = inviteRef.on('value', snap => {
      if (!snap.exists()) {
        if (pendingInvite && el('friendInviteModal').classList.contains('open')) {
          // Sender canceled; close modal silently.
          closeInviteModal();
        }
        return;
      }
      const inv = snap.val() || {};
      if (!inv.from || inv.from === myUid) return;
      if (!inv.roomCode) return;
      if (typeof inv.ts !== 'number') return;
      if (Date.now() - inv.ts > INVITE_FRESH_MS) {
        // Stale invite — clean up so nothing surfaces.
        try { inviteRef.remove(); } catch(e) {}
        return;
      }
      // De-dupe so quickly-resent invites don't reopen the modal.
      const key = inv.from + '|' + inv.roomCode + '|' + inv.ts;
      if (key === lastSeenInviteKey) return;
      lastSeenInviteKey = key;

      // If we are mid-game or in a non-lobby state, ignore politely.
      if (gameStatusLabel() === 'in-game') {
        // Keep the invite around; user can return to lobby and accept.
        showToast('<i class="icn icn-players"></i> ' + escapeHtml(inv.fromName || 'Friend') + ' invited you (finish current game first)');
        return;
      }

      pendingInvite = inv;
      const who = el('fiFromName');
      if (who) who.textContent = inv.fromName || 'A friend';
      const modeLbl = el('fiModeLabel');
      if (modeLbl) modeLbl.textContent = (inv.mode === 'powerup') ? 'Power-Up 1v1' : 'Classic 1v1';
      el('friendInviteModal').classList.add('open');
      pulseMenuDot(true);
    }, () => {});
  }

  function detachInviteListener() {
    if (inviteRef && inviteListener) {
      try { inviteRef.off('value', inviteListener); } catch(e) {}
    }
    inviteRef = null; inviteListener = null;
  }

  function closeInviteModal() {
    pendingInvite = null;
    const m = el('friendInviteModal');
    if (m) m.classList.remove('open');
    pulseMenuDot(false);
  }

  async function acceptInvite() {
    if (!pendingInvite) { closeInviteModal(); return; }
    const inv = pendingInvite;
    closeInviteModal();
    closeFriendsMenu();

    // Make sure we have a name in the lobby input before joinGame() runs.
    const nameEl = el('playerName');
    if (nameEl && !nameEl.value.trim()) {
      const fallback = getMyProfileName();
      if (fallback && fallback !== 'Player') nameEl.value = fallback;
    }
    if (nameEl && !nameEl.value.trim()) {
      showToast('Enter your name in the lobby first, then accept again.');
      // Re-show modal so they can retry
      pendingInvite = inv;
      el('friendInviteModal').classList.add('open');
      return;
    }

    const code = (inv.roomCode || '').toString().trim().toUpperCase();
    const join = el('joinCode');
    if (join) join.value = code;
    if (typeof window.joinGame !== 'function') {
      showToast('Multiplayer not ready — try again.');
      return;
    }
    try {
      await window.joinGame();
      // Clear the invite after we successfully join.
      try { if (inviteRef) await inviteRef.remove(); } catch(e) {}
    } catch(e) {
      console.warn('[friends] accept join failed:', e);
      showToast('Could not join game.');
    }
  }

  async function declineInvite() {
    if (inviteRef) {
      try { await inviteRef.remove(); } catch(e) {}
    }
    closeInviteModal();
  }

  // ─── Friend list rendering ─────────────────────────────────────────
  function attachAllFriendPresence() {
    detachAllFriendPresence();
    if (!window.db) return;
    const friends = loadFriends();
    friends.forEach(f => attachFriendPresence(f.uid));
  }

  function detachAllFriendPresence() {
    Object.keys(friendPresenceWatchers).forEach(uid => {
      const w = friendPresenceWatchers[uid];
      try { if (w && w.ref && w.listener) w.ref.off('value', w.listener); } catch(e) {}
    });
    friendPresenceWatchers = {};
  }

  function attachFriendPresence(uid) {
    if (!window.db || !uid || friendPresenceWatchers[uid]) return;
    const ref = window.db.ref(PRESENCE_PATH + '/' + uid);
    const listener = ref.on('value', snap => {
      const info = snap.exists() ? (snap.val() || {}) : null;
      friendPresenceWatchers[uid] = friendPresenceWatchers[uid] || { ref, listener };
      friendPresenceWatchers[uid].info = info;
      // Refresh the row (cheap re-render).
      renderFriendList();
    }, () => {});
    friendPresenceWatchers[uid] = { ref, listener, info: null };
  }

  function detachFriendPresence(uid) {
    const w = friendPresenceWatchers[uid];
    if (w && w.ref && w.listener) {
      try { w.ref.off('value', w.listener); } catch(e) {}
    }
    delete friendPresenceWatchers[uid];
  }

  function isOnline(info) {
    if (!info || typeof info.ts !== 'number') return false;
    return (Date.now() - info.ts) < ONLINE_FRESH_MS;
  }

  const MODE_LABELS = {
    'bot-classic':  'vs Bot · Classic',
    'bot-powerup':  'vs Bot · Power-Ups',
    'mp-classic':   '1v1 · Classic',
    'mp-powerup':   '1v1 · Power-Ups'
  };

  function statusText(info) {
    if (!isOnline(info)) return 'Offline';
    if (info.status === 'in-game') {
      return MODE_LABELS[info.mode] || 'In a game';
    }
    return 'Online';
  }

  function renderFriendList() {
    const list = el('frList');
    if (!list) return;
    const friends = loadFriends();
    const label = el('frListLabel');
    if (label) label.textContent = 'FRIENDS · ' + friends.length;

    if (friends.length === 0) {
      list.innerHTML = `<div class="fr-empty">No friends yet.<br>Share your friend code or paste one above to add a friend.</div>`;
      return;
    }

    // Sort: online first, then by name.
    const decorated = friends.map(f => {
      const info = (friendPresenceWatchers[f.uid] && friendPresenceWatchers[f.uid].info) || null;
      return { f, info, online: isOnline(info) };
    });
    decorated.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (a.f.name || '').localeCompare(b.f.name || '');
    });

    list.innerHTML = decorated.map(({ f, info, online }) => {
      const avId = (info && info.avatar) || f.avatar || null;
      const name = (info && info.name) || f.name || 'Friend';
      const inGame = online && info && info.status === 'in-game';
      const cls = ['fr-row'];
      if (online) cls.push('online');
      if (inGame) cls.push('in-game');
      const safeUid = encodeURIComponent(f.uid);
      const inviteAttrs = online ? '' : 'disabled title="Friend is offline"';
      return `
        <div class="${cls.join(' ')}">
          <div class="fr-avatar">${avatarMarkup(avId, name)}<span class="fr-avatar-dot"></span></div>
          <div class="fr-info">
            <div class="fr-name">${escapeHtml(name)}</div>
            <div class="fr-status">${escapeHtml(statusText(info))}</div>
          </div>
          <div class="fr-actions">
            <button class="fr-invite-btn" ${inviteAttrs} onclick="window.YumFriends.openSendModal('${safeUid}')"><i class="icn icn-bolt"></i> INVITE</button>
            <button class="fr-remove-btn" title="Remove friend" onclick="window.YumFriends.removeFriend('${safeUid}')">×</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ─── Add / remove friends ──────────────────────────────────────────
  function addFromInput() {
    const inp = el('frAddInput');
    if (!inp) return;
    const code = (inp.value || '').trim();
    if (!code) { showToast('Paste a friend code first.'); return; }
    if (myUid && code === myUid) { showToast("That's your own code!"); return; }
    if (code.length < 6 || code.length > 64) { showToast('That code looks wrong.'); return; }

    const friends = loadFriends();
    if (friends.some(f => f.uid === code)) {
      showToast('Already in your friend list.');
      inp.value = '';
      return;
    }
    friends.push({ uid: code, name: '', avatar: null, addedAt: Date.now() });
    saveFriends(friends);
    inp.value = '';
    attachFriendPresence(code);
    renderFriendList();
    showToast('<i class="icn icn-check"></i> Friend added!');
  }

  function removeFriend(uidEnc) {
    const uid = decodeURIComponent(uidEnc);
    const friends = loadFriends().filter(f => f.uid !== uid);
    saveFriends(friends);
    detachFriendPresence(uid);
    renderFriendList();
  }

  // ─── Outgoing invite flow ──────────────────────────────────────────
  function openSendModal(uidEnc) {
    const uid = decodeURIComponent(uidEnc);
    const w = friendPresenceWatchers[uid];
    if (!w || !isOnline(w.info)) {
      showToast('Friend is offline.');
      return;
    }
    if (gameStatusLabel() === 'in-game') {
      showToast('Finish your current game first.');
      return;
    }
    outgoingInviteUid = uid;
    const sub = el('fisSub');
    if (sub) sub.textContent = 'Inviting ' + ((w.info && w.info.name) || 'your friend');
    el('friendInviteSendModal').classList.add('open');
  }

  function closeSendModal() {
    outgoingInviteUid = null;
    const m = el('friendInviteSendModal');
    if (m) m.classList.remove('open');
  }

  async function sendInvite(mode) {
    const targetUid = outgoingInviteUid;
    if (!targetUid) { closeSendModal(); return; }
    _lastInviteTarget = targetUid;
    closeSendModal();
    closeFriendsMenu();

    if (typeof window.createGame !== 'function') {
      showToast('Multiplayer not ready.');
      return;
    }

    // Make sure our lobby name is set so createGame() doesn't bail.
    const nameEl = el('playerName');
    if (nameEl && !nameEl.value.trim()) {
      const fallback = getMyProfileName();
      if (fallback && fallback !== 'Player') nameEl.value = fallback;
    }
    if (nameEl && !nameEl.value.trim()) {
      showToast('Enter your name in the lobby first.');
      return;
    }
    if (typeof window.yumValidateUsername === 'function' && nameEl) {
      const check = window.yumValidateUsername(nameEl.value.trim());
      if (!check.ok) { showToast(check.reason || 'Pick a different name.'); return; }
    }

    showWaitOverlay('Creating room…');

    try {
      await window.createGame();
    } catch(e) {
      console.warn('[friends] createGame failed:', e);
      hideWaitOverlay();
      showToast('Could not create game.');
      return;
    }

    let code = null;
    try {
      // app.js exposes roomCode at the script scope, but it isn't always on window.
      // eslint-disable-next-line no-undef
      code = (typeof roomCode !== 'undefined' && roomCode) ? roomCode : null;
    } catch(e) {}
    if (!code) {
      const dc = el('displayCode');
      const txt = dc ? (dc.textContent || '').trim() : '';
      if (txt && txt !== '----') code = txt;
    }
    if (!code) {
      hideWaitOverlay();
      showToast('Could not get room code.');
      return;
    }
    outgoingRoomCode = code;
    outgoingMode = (mode === 'powerup') ? 'powerup' : 'normal';

    // Tag the room with the agreed-upon mode so the recipient gets the right experience.
    try {
      const db = window.db;
      if (db) {
        await db.ref('rooms/' + code).update({ gameMode: outgoingMode, mode: 'friend-invite' });
      }
    } catch(e) {}

    // Write the invite into the friend's slot.
    try {
      const db = window.db;
      const payload = {
        from: myUid,
        fromName: getMyProfileName(),
        roomCode: code,
        mode: outgoingMode,
        ts: Date.now()
      };
      const av = getMyAvatarId();
      if (av) payload.fromAvatar = av;
      await db.ref(INVITES_PATH + '/' + targetUid).set(payload);
      showWaitOverlay('Waiting for friend to accept…');
    } catch(e) {
      console.warn('[friends] invite write failed:', e);
      hideWaitOverlay();
      showToast('Could not send invite.');
      return;
    }

    // Watch the room for the friend joining; once they're in we hide the wait overlay.
    watchRoomForJoin(code, targetUid);
  }

  function watchRoomForJoin(code, targetUid) {
    const db = window.db;
    if (!db) return;
    const ref = db.ref('rooms/' + code + '/players');
    const listener = ref.on('value', snap => {
      if (!snap.exists()) return;
      const players = snap.val() || {};
      const ids = Object.keys(players).filter(id => !players[id] || !players[id].disconnectedAt);
      if (ids.length >= 2) {
        try { ref.off('value', listener); } catch(e) {}
        hideWaitOverlay();
        // Clear the invite once they have joined.
        try { db.ref(INVITES_PATH + '/' + targetUid).remove(); } catch(e) {}
      }
    }, () => {});
  }

  function showWaitOverlay(msg) {
    const m = el('fiwMsg');
    if (m) m.textContent = msg || 'Waiting for friend to accept…';
    const o = el('friendInviteWaitOverlay');
    if (o) o.classList.add('open');
  }

  function hideWaitOverlay() {
    const o = el('friendInviteWaitOverlay');
    if (o) o.classList.remove('open');
  }

  async function cancelOutgoingInvite() {
    hideWaitOverlay();
    const db = window.db;
    if (db && _lastInviteTarget) {
      try { await db.ref(INVITES_PATH + '/' + _lastInviteTarget).remove(); } catch(e) {}
    }
    if (typeof window.leaveGame === 'function') {
      try { window.leaveGame(); } catch(e) {}
    }
    outgoingRoomCode = null;
    _lastInviteTarget = null;
  }

  // ─── Side menu open/close ──────────────────────────────────────────
  function setMyCodeText(uid) {
    const c = el('frMyCode');
    if (c) c.textContent = uid || '…';
  }

  function openFriendsMenu() {
    renderFriendList();
    if (myUid) setMyCodeText(myUid);
    el('friendsScrim').classList.add('open');
    el('friendsDrawer').classList.add('open');
    // Refresh presence for any newly-added friends.
    attachAllFriendPresence();
    // Refresh own presence so "lobby" status pings.
    writePresence().catch(() => {});
  }

  function closeFriendsMenu() {
    const s = el('friendsScrim'); if (s) s.classList.remove('open');
    const d = el('friendsDrawer'); if (d) d.classList.remove('open');
  }

  function pulseMenuDot(on) {
    const dot = el('friendsMenuDot');
    if (!dot) return;
    dot.style.display = on ? 'inline-block' : 'none';
  }

  async function copyMyCode() {
    if (!myUid) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(myUid);
        showToast('<i class="icn icn-check"></i> Friend code copied');
        return;
      }
    } catch(e) {}
    const ta = document.createElement('textarea');
    ta.value = myUid; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch(e) {}
    ta.remove();
    showToast(ok ? 'Friend code copied' : myUid);
  }

  async function shareMyCode() {
    if (!myUid) return;
    const text = `Add me as a friend on Yamio! My friend code: ${myUid}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Yamio friend code', text });
        return;
      }
    } catch(e) { return; }
    await copyMyCode();
  }

  function showToast(msg) {
    if (typeof window.showToast === 'function') return window.showToast(msg);
    console.log('[friends]', msg);
  }

  // ─── Init ──────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    injectMarkup();
    renderFriendList();
    startPresence();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public surface
  window.YumFriends = {
    open: openFriendsMenu,
    close: closeFriendsMenu,
    addFromInput,
    removeFriend,
    openSendModal,
    closeSendModal,
    sendInvite,
    acceptInvite,
    declineInvite,
    cancelOutgoingInvite,
    copyMyCode,
    shareMyCode
  };
})();
