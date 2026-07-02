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

  // ── Worlds & stages ──────────────────────────────────────────────────────
  // The campaign is split into themed worlds, each with its own opponents,
  // planet palette, map tint and destination marker. Stage keys are GLOBAL and
  // sequential across worlds so saved progress (unlocked / cleared, keyed
  // 1..N) carries over unchanged from the single-world version.
  // reward = credits for the first clear; repeats pay REPEAT_REWARD.
  const WORLDS = [
    {
      name: 'GALAXY WORLD', short: 'Galaxy',
      tint: 'transparent',
      orb: 'radial-gradient(circle at 34% 30%, #6f8dff 0%, #3b5bbf 55%, #16234f 100%)',
      planets: [
        'radial-gradient(circle at 35% 28%, #3b5bbf 0%, #24357e 45%, #101a45 100%)',
        'radial-gradient(circle at 35% 28%, #2f8fbf 0%, #1e5a86 45%, #0c2740 100%)',
        'radial-gradient(circle at 35% 28%, #6a4bd0 0%, #3f2b8e 45%, #1a1245 100%)',
        'radial-gradient(circle at 35% 28%, #3bbfa8 0%, #1e7a6c 45%, #0c2f2a 100%)',
        'radial-gradient(circle at 35% 28%, #4a63d0 0%, #2b3a8e 45%, #121845 100%)',
        'radial-gradient(circle at 35% 28%, #c06ad0 0%, #7a2b8e 45%, #2f1245 100%)',
      ],
      boss: 'radial-gradient(circle at 34% 28%, #f7d16b 0%, #b06ad0 45%, #3f1a6e 100%)',
      stages: [
        { bot: 'Bob',   title: 'The Rookie',     reward: 8  },
        { bot: 'Alice', title: 'Dice Diner',     reward: 10 },
        { bot: 'Max',   title: 'Lucky Streak',   reward: 12 },
        { bot: 'Nova',  title: 'Double Trouble', reward: 14 },
        { bot: 'Rex',   title: 'Cold Storage',   reward: 16 },
        { bot: 'Luna',  title: 'Extra Innings',  reward: 18 },
        { bot: 'Zane',  title: 'Power Player',   reward: 22 },
        { bot: 'Ivy',   title: 'The Gauntlet',   reward: 26 },
        { bot: 'Titan', title: 'Boss Fight',     reward: 32 },
        { bot: 'Yamio', title: 'Grand Champion', reward: 50 },
      ]
    },
    {
      name: 'MOON WORLD', short: 'Moon',
      tint: 'rgba(148,163,190,0.10)',
      orb: 'radial-gradient(circle at 34% 30%, #eef3ff 0%, #b9c6ee 45%, #6d7db0 100%)',
      planets: [
        'radial-gradient(circle at 35% 28%, #d7deed 0%, #9aa4bd 45%, #444c63 100%)',
        'radial-gradient(circle at 35% 28%, #c3cbe0 0%, #7f8aa6 45%, #363d52 100%)',
        'radial-gradient(circle at 35% 28%, #aeb9d2 0%, #6b7694 45%, #2b3145 100%)',
      ],
      boss: 'radial-gradient(circle at 34% 28%, #ffffff 0%, #9aa8d0 45%, #39406b 100%)',
      stages: [
        { bot: 'Crater',  title: 'Dusty Landing',  reward: 34 },
        { bot: 'Apollo',  title: 'One Small Step', reward: 36 },
        { bot: 'Eclipse', title: 'Dark Side',      reward: 38 },
        { bot: 'Selene',  title: 'Sea of Dice',    reward: 40 },
        { bot: 'Orbit',   title: 'Zero Gravity',   reward: 42 },
        { bot: 'Astro',   title: 'Crater Chaos',   reward: 44 },
        { bot: 'Comet',   title: 'Silver Summit',  reward: 46 },
        { bot: 'Lunara',  title: 'Full Moon Fury', reward: 60 },
      ]
    },
    {
      name: 'FIRE WORLD', short: 'Fire',
      tint: 'rgba(190,60,20,0.12)',
      orb: 'radial-gradient(circle at 34% 30%, #ffd166 0%, #e2551f 55%, #58150a 100%)',
      planets: [
        'radial-gradient(circle at 35% 28%, #ff9d5c 0%, #c2461e 45%, #4a0f05 100%)',
        'radial-gradient(circle at 35% 28%, #ffb84d 0%, #d0611f 45%, #521a08 100%)',
        'radial-gradient(circle at 35% 28%, #f4756a 0%, #a3271d 45%, #400a08 100%)',
      ],
      boss: 'radial-gradient(circle at 34% 28%, #ffe08a 0%, #ff6b35 45%, #6e1205 100%)',
      stages: [
        { bot: 'Ember',   title: 'Warm Welcome', reward: 48 },
        { bot: 'Blaze',   title: 'Hot Streak',   reward: 50 },
        { bot: 'Scorch',  title: 'Burning Dice', reward: 52 },
        { bot: 'Cinder',  title: 'Ash Fields',   reward: 54 },
        { bot: 'Magma',   title: 'Molten Core',  reward: 56 },
        { bot: 'Pyro',    title: 'Flame Runner', reward: 58 },
        { bot: 'Vulcan',  title: 'Eruption',     reward: 62 },
        { bot: 'Inferno', title: 'Ring of Fire', reward: 80 },
      ]
    },
    {
      name: 'ICE WORLD', short: 'Ice',
      tint: 'rgba(80,180,220,0.10)',
      orb: 'radial-gradient(circle at 34% 30%, #eafcff 0%, #7fd0ee 55%, #14425c 100%)',
      planets: [
        'radial-gradient(circle at 35% 28%, #d9f6ff 0%, #6fc4e8 45%, #123a52 100%)',
        'radial-gradient(circle at 35% 28%, #bfeefc 0%, #56a8d6 45%, #0e3048 100%)',
        'radial-gradient(circle at 35% 28%, #e6f4ff 0%, #8fb8de 45%, #1a2c4d 100%)',
      ],
      boss: 'radial-gradient(circle at 34% 28%, #ffffff 0%, #9fdcf2 45%, #0d4a66 100%)',
      stages: [
        { bot: 'Frost',     title: 'First Frost',   reward: 64 },
        { bot: 'Flurry',    title: 'Snowdrift',     reward: 66 },
        { bot: 'Glacier',   title: 'Frozen Lake',   reward: 68 },
        { bot: 'Crystal',   title: 'Ice Palace',    reward: 70 },
        { bot: 'Tundra',    title: 'Whiteout',      reward: 72 },
        { bot: 'Polar',     title: 'Cold Snap',     reward: 74 },
        { bot: 'Blizzard',  title: 'The Freeze',    reward: 78 },
        { bot: 'Frostbite', title: 'Absolute Zero', reward: 100 },
      ]
    },
  ];

  // Flatten to the global stage list the rest of the module works with.
  const STAGES = [];
  WORLDS.forEach((w, wi) => {
    w.index = wi;
    w.stages.forEach((s, si) => {
      s.key = STAGES.length + 1;   // global, save-compatible
      s.world = wi;
      s.local = si + 1;            // stage number shown within its world
      s.isBoss = si === w.stages.length - 1;
      STAGES.push(s);
    });
    w.firstKey = w.stages[0].key;
  });

  const REPEAT_REWARD = 3; // credits for re-beating an already-cleared stage

  // The opponent starts each stage armed with more power-ups the deeper you go.
  // Only the four the bot AI actually knows how to spend are used (luckyDice,
  // doublePoints, extraRoll, freezeDie); the strongest are front-loaded. The bot
  // also earns its own starter pick + YAM rewards on top of this.
  const BOT_PUP_POOL = ['doublePoints', 'luckyDice', 'extraRoll', 'freezeDie'];
  function botLoadoutForStage(key) {
    // Ramps 0→6 across world 1 (0,1,1,2,3,3,4,5,5,6), then keeps growing to a
    // cap of 8 through the later worlds.
    const n = Math.min(8, Math.floor(key / 1.6));
    const out = [];
    for (let i = 0; i < n; i++) out.push(BOT_PUP_POOL[i % BOT_PUP_POOL.length]);
    return out;
  }

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

  // Ringed-planet logo for the Yam World brand (button, map title, nav).
  const PLANET_LOGO =
    '<svg class="yw-btn-logo" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" ' +
    'style="vertical-align:-2px;margin-right:2px">' +
    '<circle cx="12" cy="11" r="6.5" fill="#ffffff"/>' +
    '<circle cx="9.7" cy="9" r="2.1" fill="#ffffff" opacity="0.55"/>' +
    '<ellipse cx="12" cy="12" rx="11" ry="3.6" fill="none" stroke="#ffffff" stroke-width="1.7" ' +
    'transform="rotate(-20 12 12)"/></svg>';

  // Padlock mark shown on locked planets.
  const LOCK_SVG =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" style="vertical-align:-2px">' +
    '<rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="#dbe3ff"/>' +
    '<path d="M8 10.5 V8 a4 4 0 0 1 8 0 V10.5" fill="none" stroke="#dbe3ff" stroke-width="2"/>' +
    '<circle cx="12" cy="14.6" r="1.7" fill="#1a2a5e"/>' +
    '<rect x="11.15" y="14.6" width="1.7" height="3.4" rx="0.85" fill="#1a2a5e"/></svg>';

  // ── State (localStorage) ──────────────────────────────────────────────────
  function defaultState() {
    return { unlocked: 1, credits: 0, cleared: {}, backpack: [] };
  }
  let state = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object') return defaultState();
      const cleared = (raw.cleared && typeof raw.cleared === 'object') ? raw.cleared : {};
      let unlocked = Math.min(STAGES.length, Math.max(1, Number(raw.unlocked) || 1));
      // Campaign-growth migration: a save that beat the old final stage was
      // capped there — roll the unlock pointer forward into the new worlds.
      while (unlocked < STAGES.length && cleared[unlocked]) unlocked++;
      return {
        unlocked,
        credits:  Math.max(0, Number(raw.credits) || 0),
        cleared,
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
      /* ── World tabs ── */
      .yw-worlds { display:flex; gap:8px; margin:0 0 12px; overflow-x:auto; padding-bottom:2px; -webkit-overflow-scrolling:touch; }
      .yw-wtab {
        flex:0 0 auto; display:inline-flex; align-items:center; gap:7px;
        border-radius:999px; padding:7px 13px; border:1px solid rgba(255,255,255,0.14);
        background:rgba(255,255,255,0.06); color:#cdd8ff; font-weight:900; font-size:0.72rem;
        letter-spacing:0.6px; cursor:pointer; font-family:'Nunito',sans-serif; white-space:nowrap;
      }
      .yw-wtab.active { border-color:rgba(245,166,35,0.65); color:#fff; background:rgba(245,166,35,0.14); }
      .yw-wtab.locked { opacity:0.5; }
      .yw-worb { width:15px; height:15px; flex:0 0 15px; border-radius:50%; box-shadow: inset -2px -3px 5px rgba(0,0,0,0.5); }
      /* ── Space map ── */
      .yw-sheet-space {
        background:
          radial-gradient(1200px 500px at 78% -8%, rgba(120,150,255,0.28), transparent 60%),
          radial-gradient(circle at 72% 12%, #1b2b6b 0%, #101a45 42%, #080e2c 100%);
      }
      .yw-space {
        position: relative; width: 100%; margin-top: 6px; border-radius: 18px; overflow: hidden;
        background:
          radial-gradient(1.4px 1.4px at 12% 6%, rgba(255,255,255,0.9), transparent),
          radial-gradient(1.4px 1.4px at 82% 9%, rgba(255,255,255,0.7), transparent),
          radial-gradient(1.2px 1.2px at 34% 15%, rgba(255,255,255,0.75), transparent),
          radial-gradient(1.2px 1.2px at 62% 24%, rgba(200,220,255,0.7), transparent),
          radial-gradient(1.6px 1.6px at 22% 40%, rgba(255,255,255,0.85), transparent),
          radial-gradient(1.2px 1.2px at 88% 52%, rgba(255,255,255,0.6), transparent),
          radial-gradient(1.3px 1.3px at 48% 66%, rgba(220,230,255,0.7), transparent),
          radial-gradient(1.5px 1.5px at 15% 78%, rgba(255,255,255,0.8), transparent),
          radial-gradient(1.2px 1.2px at 74% 84%, rgba(255,255,255,0.6), transparent),
          radial-gradient(1.3px 1.3px at 40% 94%, rgba(255,255,255,0.7), transparent);
        background-color: transparent;
      }
      .yw-dot {
        position: absolute; width: 4px; height: 4px; border-radius: 50%;
        background: rgba(180,205,255,0.75); transform: translate(-50%,-50%);
        box-shadow: 0 0 4px rgba(150,190,255,0.7); z-index: 1;
      }
      .yw-planet {
        position: absolute; transform: translate(-50%,-50%); border-radius: 50%;
        display: flex; align-items: center; justify-content: center; z-index: 2;
        font-family: 'Bebas Neue', cursive; letter-spacing: 1px; color: #eaf0ff;
        border: 1px solid rgba(255,255,255,0.10); cursor: pointer;
        box-shadow: inset -7px -9px 16px rgba(0,0,0,0.55), inset 7px 7px 14px rgba(150,180,255,0.22), 0 8px 22px rgba(0,0,0,0.45);
        transition: transform 0.12s ease;
      }
      .yw-planet:active { transform: translate(-50%,-50%) scale(0.94); }
      .yw-planet .yw-planet-num { font-size: 1.5rem; text-shadow: 0 2px 6px rgba(0,0,0,0.6); }
      .yw-planet.locked { cursor: default; filter: grayscale(0.5) brightness(0.55); }
      .yw-planet.cleared { box-shadow: inset -7px -9px 16px rgba(0,0,0,0.5), 0 0 0 2px rgba(46,204,113,0.55), 0 0 18px rgba(46,204,113,0.35); }
      .yw-planet.current { animation: ywPulse 1.8s ease-in-out infinite; }
      .yw-planet.yw-planet-boss {
        box-shadow: inset -8px -10px 18px rgba(0,0,0,0.5), 0 0 0 2px rgba(245,166,35,0.6), 0 0 26px rgba(168,85,247,0.5);
      }
      @keyframes ywPulse {
        0%,100% { box-shadow: inset -7px -9px 16px rgba(0,0,0,0.55), 0 0 0 2px rgba(245,166,35,0.5), 0 0 14px rgba(245,166,35,0.3); }
        50%     { box-shadow: inset -7px -9px 16px rgba(0,0,0,0.55), 0 0 0 3px rgba(245,166,35,0.9), 0 0 26px rgba(245,166,35,0.6); }
      }
      .yw-plabel { position: absolute; transform: translateX(-50%); text-align: center; width: 132px; z-index: 2; pointer-events: none; }
      .yw-plabel-vs { font-weight: 900; color: #fff; font-size: 0.82rem; text-shadow: 0 1px 4px rgba(0,0,0,0.7); }
      .yw-plabel-sub { font-size: 0.66rem; color: #9fb2e6; margin-top: 1px; }
      .yw-plabel-reward { font-size: 0.66rem; color: var(--gold); font-weight: 800; margin-top: 1px; }
      .yw-rocket {
        position: absolute; transform: translate(-50%,-50%) rotate(34deg); z-index: 3;
        font-size: 1.7rem; pointer-events: none; filter: drop-shadow(0 0 8px rgba(140,190,255,0.8));
        animation: ywBob 2.4s ease-in-out infinite;
      }
      @keyframes ywBob { 0%,100% { margin-top: 0; } 50% { margin-top: -5px; } }
      .yw-moon {
        position: absolute; left: 16px; top: 12px; width: 54px; height: 54px; border-radius: 50%;
        background: radial-gradient(circle at 34% 30%, #eef3ff 0%, #b9c6ee 45%, #6d7db0 100%);
        box-shadow: 0 0 26px rgba(180,200,255,0.55), inset -6px -8px 14px rgba(0,0,0,0.3); z-index: 1;
      }
      .yw-moon-label { position: absolute; left: 12px; top: 70px; font-family: 'Bebas Neue', cursive; letter-spacing: 2px; font-size: 0.72rem; color: #cdd8ff; z-index: 1; }
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
      <div class="yw-sheet yw-sheet-space">
        <div class="yw-head">
          <div class="yw-title">${PLANET_LOGO} YAM WORLD</div>
          <button class="yw-close" id="ywMapClose"><i class="icn icn-close"></i></button>
        </div>
        <div class="yw-credit-box">
          <div>
            <div class="yw-credit-label">Blast across the worlds — beat stages to earn credits</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">Spend them in the shop on power-ups</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div class="yw-credit-value" id="ywMapCredits">0</div>
            <button class="yw-shop-btn" id="ywOpenShop"><i class="icn icn-palette"></i> SHOP</button>
          </div>
        </div>
        <div id="ywWorldTabsHost"></div>
        <div class="yw-space" id="ywPath"></div>
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

  // ── Map (space scene: planets along a dotted flight path, per world) ───────
  let selectedWorldIdx = null; // null → follow campaign progress

  // The stage the campaign rocket sits on: first unlocked-but-uncleared stage.
  function currentStage() {
    return STAGES.find(s => s.key <= state.unlocked && !state.cleared[s.key])
        || STAGES[STAGES.length - 1];
  }

  function shownWorldIdx() {
    if (selectedWorldIdx !== null && WORLDS[selectedWorldIdx]) return selectedWorldIdx;
    return currentStage().world;
  }

  function selectWorld(wi) {
    const w = WORLDS[wi];
    if (!w) return;
    if (w.firstKey > state.unlocked) {
      if (typeof showToast === 'function') showToast(`${w.name} is locked — beat ${WORLDS[wi - 1].name} first!`);
      return;
    }
    selectedWorldIdx = wi;
    renderMap();
  }

  function renderWorldTabs(sel) {
    return WORLDS.map((w, wi) => {
      const locked = w.firstKey > state.unlocked;
      const cls = ['yw-wtab', wi === sel ? 'active' : '', locked ? 'locked' : ''].filter(Boolean).join(' ');
      const mark = locked ? LOCK_SVG : `<span class="yw-worb" style="background:${w.orb}"></span>`;
      return `<button class="${cls}" onclick="yamWorldSelect(${wi})">${mark} ${w.short.toUpperCase()}</button>`;
    }).join('');
  }

  function renderMap() {
    const path = document.getElementById('ywPath');
    const tabsHost = document.getElementById('ywWorldTabsHost');
    const credEl = document.getElementById('ywMapCredits');
    if (credEl) credEl.textContent = state.credits;
    if (!path) return;

    const sel = shownWorldIdx();
    const world = WORLDS[sel];
    if (tabsHost) tabsHost.innerHTML = `<div class="yw-worlds">${renderWorldTabs(sel)}</div>`;
    path.style.backgroundColor = world.tint;

    const stages = world.stages;
    const n = stages.length;
    const topPad = 78, gap = 128, amp = 26, baseSize = 58, bossSize = 84;

    // Geometry: planets wind down the scene on a sine path, first stage at top.
    const pts = stages.map((st, i) => ({
      st, i,
      leftPct: 50 + amp * Math.sin(i * 0.95 + 0.6),
      top: topPad + i * gap,
      size: st.isBoss ? bossSize : baseSize
    }));
    const height = topPad + (n - 1) * gap + bossSize / 2 + 46;

    // Dotted trail between consecutive planets.
    let dots = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], steps = 6;
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const l = a.leftPct + (b.leftPct - a.leftPct) * t;
        const tp = a.top + (b.top - a.top) * t;
        dots += `<div class="yw-dot" style="left:${l.toFixed(2)}%;top:${tp.toFixed(1)}px"></div>`;
      }
    }

    // Planets + labels.
    const bossLabel = sel === WORLDS.length - 1 ? 'FINAL BOSS' : 'WORLD BOSS';
    const nodes = pts.map(p => {
      const st = p.st;
      const cleared = !!state.cleared[st.key];
      const unlocked = st.key <= state.unlocked;
      const isCurrent = unlocked && !cleared;
      const grad = st.isBoss ? world.boss : world.planets[p.i % world.planets.length];
      const cls = ['yw-planet',
        cleared ? 'cleared' : '', isCurrent ? 'current' : '', !unlocked ? 'locked' : '',
        st.isBoss ? 'yw-planet-boss' : ''].filter(Boolean).join(' ');
      const face = cleared ? '<i class="icn icn-check"></i>' : (unlocked ? st.local : LOCK_SVG);
      const onclick = unlocked ? `onclick="yamWorldPlay(${st.key})"` : '';
      const rewardN = cleared ? REPEAT_REWARD : st.reward;
      const status = !unlocked ? 'Locked' : (cleared ? 'Cleared · replay' : 'Tap to launch');
      const armed = botLoadoutForStage(st.key).length;
      const armedTag = armed > 0 ? ` · <span style="white-space:nowrap"><i class="icn icn-bolt"></i>×${armed}</span>` : '';
      const labelTop = p.top + p.size / 2 + 9;

      const planet = `<div class="${cls}" ${onclick}
        style="left:${p.leftPct.toFixed(2)}%;top:${p.top}px;width:${p.size}px;height:${p.size}px;background:${grad}">
        <span class="yw-planet-num">${face}</span></div>`;
      const label = `<div class="yw-plabel" style="left:${p.leftPct.toFixed(2)}%;top:${labelTop}px">
        <div class="yw-plabel-vs">Human vs ${escapeName(st.bot)}</div>
        <div class="yw-plabel-sub">Stage ${st.local} · ${st.isBoss ? bossLabel : escapeName(st.title)}${armedTag}</div>
        <div class="yw-plabel-reward"><i class="icn icn-coin"></i> ${rewardN} · ${status}</div></div>`;
      return planet + label;
    }).join('');

    // Rocket parked at the campaign's current stage — only in its own world.
    const cur = currentStage();
    let rocket = '', scrollTop = 0;
    if (cur.world === sel) {
      const cp = pts[cur.local - 1];
      rocket = `<div class="yw-rocket" style="left:${(cp.leftPct + 10).toFixed(2)}%;top:${cp.top - 4}px">🚀</div>`;
      scrollTop = Math.max(0, cp.top - 170);
    }

    // Destination marker: the next world to reach (champion badge on the last).
    const nextW = WORLDS[sel + 1];
    const decor = nextW
      ? `<div class="yw-moon" style="background:${nextW.orb}"></div><div class="yw-moon-label">${nextW.name}</div>`
      : `<div class="yw-moon" style="background:radial-gradient(circle at 34% 30%, #fff2b8 0%, #f5a623 55%, #7a4a05 100%)"></div><div class="yw-moon-label">GRAND CHAMPION</div>`;

    path.style.height = height + 'px';
    path.innerHTML = decor + dots + nodes + rocket;

    // Bring the current stage into view.
    setTimeout(() => {
      const sheet = document.querySelector('#yamWorldOverlay .yw-sheet');
      if (sheet) sheet.scrollTop = scrollTop;
    }, 30);
  }

  function escapeName(n) {
    return (typeof escapeHtml === 'function') ? escapeHtml(n) : String(n);
  }

  function openYamWorld() {
    if (!_requireName()) return;
    playerName = document.getElementById('playerName').value.trim();
    injectStyles();
    ensureMapOverlay();
    selectedWorldIdx = null; // re-focus the map on campaign progress
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
    pendingBotPups = botLoadoutForStage(stage.key);

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
    let earned = 0, unlockedNew = false, unlockedWorldName = null;

    if (won && !awardedThisGame && stage) {
      awardedThisGame = true;
      const firstClear = !state.cleared[stage.key];
      earned = firstClear ? stage.reward : REPEAT_REWARD;
      state.credits += earned;
      state.cleared[stage.key] = true;
      // Winning consumes the loadout you carried in.
      state.backpack = [];
      const next = stage.key + 1;
      if (next <= STAGES.length && state.unlocked < next) {
        state.unlocked = next;
        unlockedNew = true;
        const ns = STAGES.find(s => s.key === next);
        if (ns && ns.world !== stage.world) unlockedWorldName = WORLDS[ns.world].name;
      }
      save();
    }
    return { won, tie: !!(me && opp && me.score === opp.score), earned, unlockedNew, unlockedWorldName, stage };
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
        `<div class="yw-result-sub">${r.unlockedWorldName ? r.unlockedWorldName + ' unlocked! · ' : (r.unlockedNew ? 'New stage unlocked · ' : '')}Balance: ${state.credits} credits</div>`;
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
    html += `<button class="gameover-btn gameover-btn-quit" onclick="yamWorldToMap()">${PLANET_LOGO} WORLD MAP</button>`;
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
          const stg = STAGES.find(s => s.key === currentStageKey);
          tag.textContent = stg ? '· ' + WORLDS[stg.world].short + ' ' + stg.local
                                : '· Stage ' + currentStageKey;
          badge.appendChild(tag);
        }
      }
    }
  }, 700);

  // ── Public API ─────────────────────────────────────────────────────────────
  window.openYamWorld = openYamWorld;
  window.closeYamWorld = closeYamWorld;
  window.yamWorldPlay = playStage;
  window.yamWorldSelect = selectWorld;
  window.yamWorldBuy = buyPup;
  window.yamWorldNext = next;
  window.yamWorldReplay = replay;
  window.yamWorldToMap = toMap;
  window.yamWorldOpenShopFromResult = shopFromResult;
  window.openYamWorldShop = openShop;

  injectStyles();
})();
