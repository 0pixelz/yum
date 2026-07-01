// ─── YAM WORLD — STAGE / CAMPAIGN MODE (vs Bot only) ─────────────────────────
// A single-player adventure built on top of the existing Power-Up vs-Bot game.
// You travel a world map of stages, each against a named opponent (Human vs
// Bob, Alice, Max …). Every stage is a full Power-Up game. Beat the opponent
// to earn credits and unlock the next stage. Spend those credits in the Yam
// World shop to stock power-ups for your next run.
//
// This module is fully self-contained:
//   • Progress + a separate "Yam World credit" wallet live in localStorage
//     (yum_yamworld_v1). It deliberately does NOT touch the server-authoritative
//     skin-store credit wallet.
//   • Gameplay reuses startVsBot('powerup') — we only set the opponent name,
//     seed a purchased loadout into the player's inventory, optionally hand the
//     bot bonus power-ups for difficulty, and take over the game-over screen.
//
// Loaded LAST so its wrappers around startVsBot / showGameOver / quitGame /
// confirmNewGame sit outside the power-up + mega-yam + bot wrappers.
(function () {
  'use strict';

  const KEY = 'yum_yamworld_v1';

  // ── Stage roster ────────────────────────────────────────────────────────
  // reward  = credits earned for beating the stage the first time (a smaller
  //           consolation is granted on repeat wins).
  // botPups = bonus power-ups the opponent starts with, ramping difficulty.
  const STAGES = [
    { key: 1,  bot: 'Bob',   title: 'The Rookie',      reward: 8,  botPups: [] },
    { key: 2,  bot: 'Alice', title: 'Dice Diner',      reward: 10, botPups: [] },
    { key: 3,  bot: 'Max',   title: 'Lucky Streak',    reward: 12, botPups: ['luckyDice'] },
    { key: 4,  bot: 'Nova',  title: 'Double Trouble',  reward: 14, botPups: ['doublePoints'] },
    { key: 5,  bot: 'Rex',   title: 'Cold Storage',    reward: 16, botPups: ['freezeDie'] },
    { key: 6,  bot: 'Luna',  title: 'Extra Innings',   reward: 18, botPups: ['extraRoll', 'luckyDice'] },
    { key: 7,  bot: 'Zane',  title: 'Power Player',    reward: 22, botPups: ['doublePoints', 'extraRoll'] },
    { key: 8,  bot: 'Ivy',   title: 'The Gauntlet',    reward: 26, botPups: ['luckyDice', 'freezeDie', 'doublePoints'] },
    { key: 9,  bot: 'Titan', title: 'Boss Fight',      reward: 32, botPups: ['doublePoints', 'extraRoll', 'luckyDice', 'freezeDie'] },
    { key: 10, bot: 'Yamio', title: 'Grand Champion',  reward: 50, botPups: ['doublePoints', 'doublePoints', 'extraRoll', 'luckyDice', 'freezeDie'] },
  ];

  const REPEAT_REWARD = 3; // credits for re-beating an already-cleared stage

  // ── Shop: buyable power-ups (defs come from the global POWERUPS list) ─────
  const SHOP = [
    { id: 'extraRoll',    cost: 4 },
    { id: 'freezeDie',    cost: 5 },
    { id: 'luckyDice',    cost: 5 },
    { id: 'doublePoints', cost: 6 },
    { id: 'undoMove',     cost: 5 },
    { id: 'chanceRoll',   cost: 8 },
    { id: 'yamOrStrike',  cost: 10 },
  ];

  function pupDef(id) {
    return (typeof POWERUPS !== 'undefined') ? POWERUPS.find(p => p.id === id) : null;
  }

  // ── State (localStorage) ──────────────────────────────────────────────────
  function defaultState() {
    return { unlocked: 1, credits: 0, cleared: {}, backpack: [] };
  }
  let state = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object') return defaultState();
      return {
        unlocked: Math.min(STAGES.length, Math.max(1, Number(raw.unlocked) || 1)),
        credits:  Math.max(0, Number(raw.credits) || 0),
        cleared:  (raw.cleared && typeof raw.cleared === 'object') ? raw.cleared : {},
        backpack: Array.isArray(raw.backpack) ? raw.backpack.filter(id => !!pupDef(id)) : []
      };
    } catch (e) { return defaultState(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ── Runtime flags ─────────────────────────────────────────────────────────
  let yamWorldActive   = false; // a Yam World stage is currently being played
  let currentStageKey  = 0;
  let awardedThisGame  = false; // guard so a game-over only pays out once
  let pendingLoadout   = null;  // powerups to grant the player once play begins
  let pendingBotPups   = null;  // bonus powerups to grant the bot once play begins
  window.yamWorldActive = false; // read by the mode badge below

  function _requireName() {
    const el = document.getElementById('playerName');
    const name = el ? el.value.trim() : '';
    if (!name) {
      if (typeof promptForUsername === 'function') promptForUsername();
      else if (typeof showLobbyErr === 'function') showLobbyErr('Enter your name first!');
      return null;
    }
    if (typeof window.yumValidateUsername === 'function') {
      const check = window.yumValidateUsername(name);
      if (!check.ok) { if (typeof showLobbyErr === 'function') showLobbyErr(check.reason); return null; }
    }
    return name;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('yamWorldStyles')) return;
    const s = document.createElement('style');
    s.id = 'yamWorldStyles';
    s.textContent = `
      #yamWorldOverlay, #yamWorldShopOverlay {
        position: fixed; inset: 0; z-index: 962; display: none;
        align-items: flex-end; justify-content: center; background: rgba(0,0,0,0.78);
      }
      #yamWorldOverlay.open, #yamWorldShopOverlay.open { display: flex; }
      .yw-sheet {
        width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto;
        background: var(--panel); border-radius: 24px 24px 0 0; padding: 18px 16px 28px;
        border: 1px solid rgba(245,166,35,0.22); box-shadow: 0 -12px 40px rgba(0,0,0,0.45);
      }
      .yw-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
      .yw-title { font-family: 'Bebas Neue', cursive; font-size: 1.6rem; letter-spacing: 3px; color: var(--gold); }
      .yw-close { border: none; background: rgba(255,255,255,0.08); color: var(--muted); border-radius: 999px; padding: 8px 12px; font-weight: 900; cursor: pointer; }
      .yw-credit-box {
        display: flex; align-items: center; justify-content: space-between;
        background: rgba(245,166,35,0.10); border: 1px solid rgba(245,166,35,0.28);
        border-radius: 14px; padding: 11px 13px; margin-bottom: 14px;
      }
      .yw-credit-label { font-size: 0.76rem; color: var(--muted); font-weight: 800; }
      .yw-credit-value { font-family: 'Bebas Neue', cursive; font-size: 1.6rem; color: var(--gold); letter-spacing: 2px; }
      .yw-shop-btn {
        border: 1px solid rgba(78,205,196,0.4); background: rgba(78,205,196,0.12); color: var(--green);
        border-radius: 999px; padding: 9px 16px; font-family: 'Nunito', sans-serif; font-weight: 900;
        letter-spacing: 0.8px; cursor: pointer;
      }
      /* Map path */
      .yw-path { position: relative; display: flex; flex-direction: column; gap: 12px; padding-left: 6px; }
      .yw-node {
        display: flex; align-items: center; gap: 12px; position: relative;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px; padding: 12px 14px;
      }
      .yw-node.current { border-color: rgba(245,166,35,0.6); box-shadow: 0 0 18px rgba(245,166,35,0.18); }
      .yw-node.cleared { border-color: rgba(46,204,113,0.4); }
      .yw-node.locked  { opacity: 0.55; }
      .yw-badge {
        width: 44px; height: 44px; flex: 0 0 44px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Bebas Neue', cursive; font-size: 1.5rem; letter-spacing: 1px;
        background: linear-gradient(135deg,#2a2a6e,#16163f); color: #fff; border: 1px solid rgba(255,255,255,0.12);
      }
      .yw-node.cleared .yw-badge { background: linear-gradient(135deg,#16a34a,#0e7a37); }
      .yw-node.current .yw-badge { background: linear-gradient(135deg,#f5a623,#f39c12); color: #251400; }
      .yw-node-info { flex: 1; min-width: 0; }
      .yw-node-vs { font-weight: 900; color: var(--white); font-size: 0.98rem; }
      .yw-node-sub { font-size: 0.74rem; color: var(--muted); margin-top: 1px; }
      .yw-node-reward { font-size: 0.72rem; color: var(--gold); font-weight: 800; margin-top: 2px; }
      .yw-play-btn {
        border: none; border-radius: 999px; padding: 9px 16px; font-family: 'Nunito', sans-serif;
        font-weight: 900; letter-spacing: 0.8px; cursor: pointer; white-space: nowrap;
        background: linear-gradient(135deg, var(--green), #2ecc71); color: #111;
      }
      .yw-play-btn.locked { background: rgba(255,255,255,0.08); color: var(--muted); cursor: default; }
      .yw-play-btn.cleared { background: rgba(78,205,196,0.14); color: var(--green); border: 1px solid rgba(78,205,196,0.35); }
      /* Shop grid */
      .yw-shop-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
      .yw-shop-card {
        display: flex; align-items: center; gap: 12px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px; padding: 12px;
      }
      .yw-shop-icon {
        width: 42px; height: 42px; flex: 0 0 42px; border-radius: 12px; font-size: 1.3rem;
        display: flex; align-items: center; justify-content: center; color: #fff;
      }
      .yw-shop-info { flex: 1; min-width: 0; }
      .yw-shop-name { font-weight: 900; color: var(--white); }
      .yw-shop-desc { font-size: 0.72rem; color: var(--muted); margin-top: 1px; }
      .yw-buy-btn {
        border: none; border-radius: 999px; padding: 9px 14px; font-family: 'Nunito', sans-serif;
        font-weight: 900; letter-spacing: 0.5px; cursor: pointer; white-space: nowrap;
        background: linear-gradient(135deg, var(--gold), #f39c12); color: #251400;
      }
      .yw-buy-btn.locked { background: rgba(255,255,255,0.08); color: var(--muted); cursor: default; }
      .yw-loadout {
        background: rgba(255,255,255,0.04); border: 1px dashed rgba(255,255,255,0.16);
        border-radius: 14px; padding: 11px 13px; margin: 4px 0 14px;
      }
      .yw-loadout-title { font-size: 0.74rem; color: var(--muted); font-weight: 800; letter-spacing: 0.5px; margin-bottom: 6px; }
      .yw-loadout-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .yw-chip {
        display: inline-flex; align-items: center; gap: 4px; font-size: 0.74rem; font-weight: 800;
        background: rgba(245,166,35,0.14); color: var(--gold); border-radius: 999px; padding: 4px 9px;
      }
      .yw-loadout-empty { font-size: 0.76rem; color: var(--muted); }
      /* Game-over result banner */
      .yw-result-banner {
        margin: 4px auto 12px; max-width: 320px; text-align: center;
        background: rgba(245,166,35,0.10); border: 1px solid rgba(245,166,35,0.28);
        border-radius: 14px; padding: 10px 12px;
      }
      .yw-result-line { font-weight: 900; color: var(--gold); font-size: 0.95rem; }
      .yw-result-sub  { font-size: 0.76rem; color: var(--muted); margin-top: 3px; }
      .lobby-btn-yamworld {
        background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Overlays (built on demand) ────────────────────────────────────────────
  function ensureMapOverlay() {
    let o = document.getElementById('yamWorldOverlay');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'yamWorldOverlay';
    o.onclick = e => { if (e.target === o) closeYamWorld(); };
    o.innerHTML = `
      <div class="yw-sheet">
        <div class="yw-head">
          <div class="yw-title"><i class="icn icn-orb"></i> YAM WORLD</div>
          <button class="yw-close" id="ywMapClose"><i class="icn icn-close"></i></button>
        </div>
        <div class="yw-credit-box">
          <div>
            <div class="yw-credit-label">Beat stages to earn credits</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">Spend them in the shop on power-ups</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div class="yw-credit-value" id="ywMapCredits">0</div>
            <button class="yw-shop-btn" id="ywOpenShop"><i class="icn icn-palette"></i> SHOP</button>
          </div>
        </div>
        <div class="yw-path" id="ywPath"></div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector('#ywMapClose').onclick = closeYamWorld;
    o.querySelector('#ywOpenShop').onclick = () => openShop();
    return o;
  }

  function ensureShopOverlay() {
    let o = document.getElementById('yamWorldShopOverlay');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'yamWorldShopOverlay';
    o.onclick = e => { if (e.target === o) closeShop(); };
    o.innerHTML = `
      <div class="yw-sheet">
        <div class="yw-head">
          <div class="yw-title"><i class="icn icn-palette"></i> POWER-UP SHOP</div>
          <button class="yw-close" id="ywShopClose"><i class="icn icn-close"></i></button>
        </div>
        <div class="yw-credit-box">
          <div>
            <div class="yw-credit-label">Your Yam World credits</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">Purchases load into your next stage</div>
          </div>
          <div class="yw-credit-value" id="ywShopCredits">0</div>
        </div>
        <div class="yw-loadout" id="ywLoadout"></div>
        <div class="yw-shop-grid" id="ywShopGrid"></div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector('#ywShopClose').onclick = closeShop;
    return o;
  }

  // ── Map ───────────────────────────────────────────────────────────────────
  function renderMap() {
    const path = document.getElementById('ywPath');
    const credEl = document.getElementById('ywMapCredits');
    if (credEl) credEl.textContent = state.credits;
    if (!path) return;

    path.innerHTML = STAGES.map(st => {
      const cleared = !!state.cleared[st.key];
      const unlocked = st.key <= state.unlocked;
      const isCurrent = unlocked && !cleared;
      const cls = cleared ? 'cleared' : (isCurrent ? 'current' : (unlocked ? '' : 'locked'));
      const badge = cleared ? '<i class="icn icn-check"></i>' : (unlocked ? st.key : '<i class="icn icn-key"></i>');

      let btn;
      if (!unlocked) {
        btn = `<button class="yw-play-btn locked" disabled><i class="icn icn-key"></i></button>`;
      } else if (cleared) {
        btn = `<button class="yw-play-btn cleared" onclick="yamWorldPlay(${st.key})">REPLAY</button>`;
      } else {
        btn = `<button class="yw-play-btn" onclick="yamWorldPlay(${st.key})">PLAY <i class="icn icn-dice"></i></button>`;
      }

      return `
        <div class="yw-node ${cls}">
          <div class="yw-badge">${badge}</div>
          <div class="yw-node-info">
            <div class="yw-node-vs">Stage ${st.key} · Human vs ${escapeName(st.bot)}</div>
            <div class="yw-node-sub">${st.title}${st.botPups.length ? ' · opponent is armed' : ''}</div>
            <div class="yw-node-reward"><i class="icn icn-coin"></i> ${cleared ? REPEAT_REWARD : st.reward} credit${(cleared ? REPEAT_REWARD : st.reward) === 1 ? '' : 's'} to win</div>
          </div>
          ${btn}
        </div>`;
    }).join('');
  }

  function escapeName(n) {
    return (typeof escapeHtml === 'function') ? escapeHtml(n) : String(n);
  }

  function openYamWorld() {
    if (!_requireName()) return;
    playerName = document.getElementById('playerName').value.trim();
    injectStyles();
    ensureMapOverlay();
    renderMap();
    document.getElementById('lobbyOverlay').style.display = 'none';
    document.getElementById('yamWorldOverlay').classList.add('open');
  }

  function closeYamWorld() {
    const o = document.getElementById('yamWorldOverlay');
    if (o) o.classList.remove('open');
    // Only pop back to the lobby if we're not mid-stage.
    if (!yamWorldActive) document.getElementById('lobbyOverlay').style.display = 'flex';
  }

  // ── Shop ──────────────────────────────────────────────────────────────────
  function openShop() {
    injectStyles();
    ensureShopOverlay();
    renderShop();
    document.getElementById('yamWorldShopOverlay').classList.add('open');
  }
  function closeShop() {
    const o = document.getElementById('yamWorldShopOverlay');
    if (o) o.classList.remove('open');
    renderMap();
  }

  function renderShop() {
    const grid = document.getElementById('ywShopGrid');
    const credEl = document.getElementById('ywShopCredits');
    const loadoutEl = document.getElementById('ywLoadout');
    if (credEl) credEl.textContent = state.credits;

    if (loadoutEl) {
      if (state.backpack.length) {
        const counts = {};
        state.backpack.forEach(id => counts[id] = (counts[id] || 0) + 1);
        const chips = Object.entries(counts).map(([id, cnt]) => {
          const d = pupDef(id);
          return `<span class="yw-chip">${d ? d.icon : ''} ${d ? d.name : id}${cnt > 1 ? ` ×${cnt}` : ''}</span>`;
        }).join('');
        loadoutEl.innerHTML = `<div class="yw-loadout-title">LOADOUT FOR YOUR NEXT STAGE</div><div class="yw-loadout-chips">${chips}</div>`;
      } else {
        loadoutEl.innerHTML = `<div class="yw-loadout-title">LOADOUT FOR YOUR NEXT STAGE</div><div class="yw-loadout-empty">Empty — buy power-ups below to bring them into your next game.</div>`;
      }
    }

    if (!grid) return;
    grid.innerHTML = SHOP.map(item => {
      const d = pupDef(item.id);
      if (!d) return '';
      const canBuy = state.credits >= item.cost;
      const btn = canBuy
        ? `<button class="yw-buy-btn" onclick="yamWorldBuy('${item.id}')">BUY · ${item.cost}</button>`
        : `<button class="yw-buy-btn locked" disabled>NEED ${item.cost}</button>`;
      return `
        <div class="yw-shop-card">
          <div class="yw-shop-icon" style="background:${d.gradient || d.color}">${d.icon}</div>
          <div class="yw-shop-info">
            <div class="yw-shop-name">${d.name}</div>
            <div class="yw-shop-desc">${d.desc}</div>
          </div>
          ${btn}
        </div>`;
    }).join('');
  }

  function buyPup(id) {
    const item = SHOP.find(s => s.id === id);
    if (!item) return;
    if (state.credits < item.cost) { if (typeof showToast === 'function') showToast('Not enough credits yet'); return; }
    state.credits -= item.cost;
    state.backpack.push(id);
    save();
    renderShop();
    const d = pupDef(id);
    if (typeof showToast === 'function') showToast(`${d ? d.icon : ''} ${d ? d.name : id} added to your loadout!`);
  }

  // ── Play a stage ───────────────────────────────────────────────────────────
  function playStage(k) {
    const stage = STAGES.find(s => s.key === k);
    if (!stage) return;
    if (k > state.unlocked) { if (typeof showToast === 'function') showToast('Locked — clear the earlier stages first!'); return; }
    if (!_requireName()) return;

    // Close the campaign overlays.
    const mo = document.getElementById('yamWorldOverlay');
    const so = document.getElementById('yamWorldShopOverlay');
    if (mo) mo.classList.remove('open');
    if (so) so.classList.remove('open');

    yamWorldActive = true;
    window.yamWorldActive = true;
    currentStageKey = k;
    awardedThisGame = false;

    // Queue the loadouts. They're applied in the closeFirstRoll hook (once the
    // roll-off finishes) — the same lifecycle point at which power-up mode and
    // the bot grant their starter power-ups. Seeding earlier gets wiped by the
    // first-roll setup. The player's purchased loadout is a COPY: it isn't
    // consumed off the shelf until the stage is actually won (see award()), so
    // a loss lets you retry with the same gear.
    pendingLoadout = state.backpack.slice();
    pendingBotPups = stage.botPups.slice();

    // Name the opponent, then launch a Power-Up vs-Bot game. botName is a
    // top-level binding shared across the app's scripts.
    botName = stage.bot;
    startVsBot('powerup');
  }

  function applyPendingLoadouts() {
    if (pendingLoadout && typeof playerPowerups !== 'undefined') {
      pendingLoadout.forEach(id => playerPowerups.push(id));
    }
    if (pendingBotPups && typeof botPowerups !== 'undefined') {
      pendingBotPups.forEach(id => botPowerups.push(id));
    }
    pendingLoadout = null;
    pendingBotPups = null;
    if (typeof renderPowerupBar === 'function') renderPowerupBar();
    if (typeof renderBotLeaderboard === 'function') renderBotLeaderboard();
  }

  // ── Game-over takeover ─────────────────────────────────────────────────────
  function award(players) {
    const me = players.find(p => p.isMe);
    const opp = players.find(p => !p.isMe);
    const won = !!(me && opp && me.score > opp.score);
    const stage = STAGES.find(s => s.key === currentStageKey);
    let earned = 0, unlockedNew = false;

    if (won && !awardedThisGame && stage) {
      awardedThisGame = true;
      const firstClear = !state.cleared[stage.key];
      earned = firstClear ? stage.reward : REPEAT_REWARD;
      state.credits += earned;
      state.cleared[stage.key] = true;
      // Winning consumes the loadout you carried in.
      state.backpack = [];
      const next = stage.key + 1;
      if (next <= STAGES.length && state.unlocked < next) { state.unlocked = next; unlockedNew = true; }
      save();
    }
    return { won, tie: !!(me && opp && me.score === opp.score), earned, unlockedNew, stage };
  }

  function decorateGameOver(players) {
    const box = document.querySelector('#gameOverlay .gameover-box');
    const btns = document.querySelector('#gameOverlay .gameover-btns');
    if (!box || !btns) return;

    const r = award(players);
    const stage = r.stage;
    const hasNext = stage && (stage.key + 1) <= STAGES.length;

    // Result banner (inserted just above the buttons).
    const old = document.getElementById('ywResultBanner');
    if (old) old.remove();
    const banner = document.createElement('div');
    banner.id = 'ywResultBanner';
    banner.className = 'yw-result-banner';
    if (r.won) {
      banner.innerHTML =
        `<div class="yw-result-line"><i class="icn icn-coin"></i> +${r.earned} credit${r.earned === 1 ? '' : 's'} earned!</div>` +
        `<div class="yw-result-sub">${r.unlockedNew ? 'New stage unlocked · ' : ''}Balance: ${state.credits} credits</div>`;
    } else {
      banner.innerHTML =
        `<div class="yw-result-line"><i class="icn icn-skull"></i> ${stage ? escapeName(stage.bot) : 'The bot'} held the stage</div>` +
        `<div class="yw-result-sub">Retry the stage or head back to the map.</div>`;
    }
    btns.parentNode.insertBefore(banner, btns);

    // Swap the button row for Yam World navigation.
    let html = '';
    if (r.won && hasNext) {
      html += `<button class="gameover-btn gameover-btn-rematch" onclick="yamWorldNext()"><i class="icn icn-dice"></i> NEXT STAGE</button>`;
    } else if (r.won && !hasNext) {
      html += `<button class="gameover-btn gameover-btn-rematch" onclick="yamWorldReplay()"><i class="icn icn-refresh"></i> REPLAY</button>`;
    } else {
      html += `<button class="gameover-btn gameover-btn-rematch" onclick="yamWorldReplay()"><i class="icn icn-refresh"></i> RETRY</button>`;
    }
    html += `<button class="gameover-btn" onclick="yamWorldOpenShopFromResult()" style="background:rgba(245,166,35,0.12);color:var(--gold);border:1px solid rgba(245,166,35,0.3)"><i class="icn icn-palette"></i> SHOP</button>`;
    html += `<button class="gameover-btn gameover-btn-quit" onclick="yamWorldToMap()"><i class="icn icn-orb"></i> WORLD MAP</button>`;
    btns.innerHTML = html;
  }

  // ── Navigation from the result screen ──────────────────────────────────────
  // Tear the finished game down through the app's own quitGame (which resets
  // bot + power-up + mega-yam state), then route into the next Yam World view.
  function teardownGame() {
    yamWorldActive = false;
    window.yamWorldActive = false;
    _resetModeBadge();
    const banner = document.getElementById('ywResultBanner');
    if (banner) banner.remove();
    if (typeof quitGame === 'function') quitGame();
    // quitGame reveals the lobby; hide it so our overlay shows cleanly.
    const lobby = document.getElementById('lobbyOverlay');
    if (lobby) lobby.style.display = 'none';
  }

  // The header badge is owned by game-mode-display.js, which only rebuilds its
  // label when its cached badge.__mode changes. Our out-of-band relabel to
  // "YAM WORLD" isn't reflected there, so clearing the cache forces a clean
  // rebuild — otherwise a later normal Power-Up game could inherit our label.
  function _resetModeBadge() {
    const badge = document.getElementById('gameModeBadge');
    if (!badge) return;
    const tag = badge.querySelector('.yw-stage-tag');
    if (tag) tag.remove();
    badge.__mode = null;
  }

  function toMap()   { teardownGame(); openYamWorld(); }
  function next()    { const k = currentStageKey + 1; teardownGame(); playStage(k); }
  function replay()  { const k = currentStageKey; teardownGame(); playStage(k); }
  function shopFromResult() { teardownGame(); ensureMapOverlay(); renderMap(); document.getElementById('lobbyOverlay').style.display = 'none'; document.getElementById('yamWorldOverlay').classList.add('open'); openShop(); }

  // ── Wrap showGameOver so we take over only inside a Yam World stage ─────────
  // The game-over button row is a single static element we mutate, so we cache
  // its default markup once and restore it for every non-Yam-World game — else
  // stale "NEXT STAGE / SHOP / MAP" buttons would linger into a normal match.
  let _defaultGoBtns = null;
  (function captureDefaultGoBtns() {
    const btns = document.querySelector('#gameOverlay .gameover-btns');
    if (btns) _defaultGoBtns = btns.innerHTML;
  })();

  function restoreDefaultGameOver() {
    const banner = document.getElementById('ywResultBanner');
    if (banner) banner.remove();
    const btns = document.querySelector('#gameOverlay .gameover-btns');
    if (btns && _defaultGoBtns != null) btns.innerHTML = _defaultGoBtns;
  }

  if (typeof showGameOver === 'function') {
    const _origShowGameOver = showGameOver;
    showGameOver = function (players) {
      _origShowGameOver(players);
      if (_defaultGoBtns == null) {
        const btns = document.querySelector('#gameOverlay .gameover-btns');
        if (btns) _defaultGoBtns = btns.innerHTML;
      }
      if (yamWorldActive) {
        try { decorateGameOver(players); } catch (e) { restoreDefaultGameOver(); }
      } else {
        restoreDefaultGameOver();
      }
    };
  }

  // Grant the queued loadouts right after the roll-off closes and play begins —
  // loaded last, so this runs outside the power-up + bot closeFirstRoll wraps
  // (which schedule the player's / bot's starter picks). Ours adds on top.
  if (typeof closeFirstRoll === 'function') {
    const _origCloseFirstRoll = closeFirstRoll;
    closeFirstRoll = function () {
      const wasPending = yamWorldActive && (pendingLoadout || pendingBotPups);
      _origCloseFirstRoll.apply(this, arguments);
      if (wasPending) {
        // Apply after the inner starter-pick timers have been scheduled; a small
        // delay keeps our additions from being clobbered by the reset the
        // roll-off performs, mirroring the starter-pick timing.
        setTimeout(applyPendingLoadouts, 60);
      }
    };
  }

  // quitGame is the real teardown (reached from the in-game "quit" confirm and
  // from our own result-screen navigation). Clear our state here — not in
  // confirmNewGame, which only *offers* a confirm dialog and would strand a
  // live stage if the player cancels.
  if (typeof quitGame === 'function') {
    const _origQuitGame = quitGame;
    quitGame = function () {
      yamWorldActive = false;
      window.yamWorldActive = false;
      _resetModeBadge();
      restoreDefaultGameOver();
      return _origQuitGame.apply(this, arguments);
    };
  }

  // ── Mode badge: relabel the in-game POWER-UP badge as YAM WORLD ────────────
  setInterval(function () {
    if (!window.yamWorldActive) return;
    const badge = document.getElementById('gameModeBadge');
    if (badge && badge.style.display !== 'none') {
      const txt = document.getElementById('gameModeBadgeText');
      if (txt && txt.textContent !== 'YAM WORLD') {
        txt.textContent = 'YAM WORLD';
        const stageLabel = document.querySelector('#gameModeBadge .yw-stage-tag');
        if (!stageLabel && currentStageKey) {
          const tag = document.createElement('span');
          tag.className = 'yw-stage-tag';
          tag.style.cssText = 'margin-left:6px;opacity:0.85;font-size:0.85em';
          tag.textContent = '· Stage ' + currentStageKey;
          badge.appendChild(tag);
        }
      }
    }
  }, 700);

  // ── Public API ─────────────────────────────────────────────────────────────
  window.openYamWorld = openYamWorld;
  window.closeYamWorld = closeYamWorld;
  window.yamWorldPlay = playStage;
  window.yamWorldBuy = buyPup;
  window.yamWorldNext = next;
  window.yamWorldReplay = replay;
  window.yamWorldToMap = toMap;
  window.yamWorldOpenShopFromResult = shopFromResult;
  window.openYamWorldShop = openShop;

  injectStyles();
})();
