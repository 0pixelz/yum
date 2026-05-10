// ─── REWARDS & STORE HUB ───────────────────────────────────────────
// Single unified menu button that opens an overlay containing the Daily
// Bonus, Daily Challenge, and Skin Store as inline sections, replacing
// the three separate buttons that used to live in the lobby.

(function() {
  const PROFILE_KEY      = 'yum_google_profile';
  const ACTIVE_KEY       = 'yum_active_dice_skin';
  const OWNED_KEY        = 'yum_store_owned_skins';
  const LEGACY_DATE_KEY  = 'yum_daily_bonus_final_date';
  const LEGACY_STREAK_KEY = 'yum_daily_bonus_final_streak';

  const DOT_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  const SKINS = [
    { id:'gold', name:'Gold Dice', cost:5, style:'background:linear-gradient(135deg,#fff7cc,#f5a623);color:#251400' },
    { id:'neon', name:'Neon Dice', cost:8, style:'background:#101827;color:#4ecdc4;border:1px solid rgba(78,205,196,.6)' },
    { id:'ice', name:'Ice Dice', cost:10, style:'background:linear-gradient(135deg,#e0f7ff,#8fd8ff);color:#06283d' },
    { id:'fire', name:'Fire Dice', cost:15, style:'background:linear-gradient(135deg,#ffd166,#e94560);color:#180004' },
    { id:'galaxy', name:'Galaxy Dice', cost:25, style:'background:radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%);color:#f8fafc;border:1px solid rgba(168,85,247,.7)' },
    { id:'emerald', name:'Emerald Dice', cost:40, style:'background:linear-gradient(135deg,#10b981,#064e3b);color:#ecfdf5;border:1px solid rgba(16,185,129,.7)' },
    { id:'ruby', name:'Ruby Dice', cost:60, style:'background:linear-gradient(135deg,#ff4d6d,#7f1d1d);color:#fff1f3;border:1px solid rgba(244,63,94,.7)' },
    { id:'sapphire', name:'Sapphire Dice', cost:90, style:'background:linear-gradient(135deg,#3b82f6,#1e3a8a);color:#dbeafe;border:1px solid rgba(96,165,250,.7)' },
    { id:'sunset', name:'Sunset Dice', cost:130, style:'background:linear-gradient(135deg,#f97316,#ec4899);color:#fff7ed' },
    { id:'aurora', name:'Aurora Dice', cost:175, style:'background:linear-gradient(135deg,#22d3ee,#a855f7,#10b981);color:#f0fdfa;border:1px solid rgba(167,139,250,.6)' },
    { id:'obsidian', name:'Obsidian Dice', cost:225, style:'background:linear-gradient(135deg,#0f172a,#000);color:#94a3b8;border:1px solid rgba(148,163,184,.5)' },
    { id:'phantom', name:'Phantom Dice', cost:300, style:'background:radial-gradient(circle,#cbd5e1,#475569 70%);color:#f1f5f9;border:1px solid rgba(203,213,225,.5)' },
    { id:'toxic', name:'Toxic Dice', cost:400, style:'background:linear-gradient(135deg,#84cc16,#365314);color:#f7fee7;box-shadow:inset 0 0 8px rgba(132,204,22,.5)' },
    { id:'lava', name:'Lava Dice', cost:525, style:'background:radial-gradient(circle at 30% 30%,#fde047,#dc2626 60%,#7f1d1d);color:#fef9c3' },
    { id:'frost', name:'Frost Dice', cost:700, style:'background:linear-gradient(135deg,#f0f9ff,#0ea5e9);color:#082f49;border:1px solid rgba(125,211,252,.8)' },
    { id:'royal', name:'Royal Dice', cost:900, style:'background:linear-gradient(135deg,#fbbf24,#7c3aed);color:#fef3c7;border:1px solid rgba(251,191,36,.7)' },
    { id:'cosmic', name:'Cosmic Dice', cost:1150, style:'background:radial-gradient(circle at 25% 25%,#fbbf24 0%,#1e1b4b 35%,#000 80%);color:#fef3c7;border:1px solid rgba(168,85,247,.6)' },
    { id:'dragon', name:'Dragon Dice', cost:1450, style:'background:linear-gradient(135deg,#dc2626,#000,#dc2626);color:#fde047;border:1px solid rgba(220,38,38,.8);box-shadow:inset 0 0 10px rgba(220,38,38,.4)' },
    { id:'mythic', name:'Mythic Dice', cost:1750, style:'background:conic-gradient(from 45deg,#a855f7,#22d3ee,#fbbf24,#ec4899,#a855f7);color:#fff;border:1px solid rgba(255,255,255,.6)' },
    { id:'diamond', name:'Diamond Dice', cost:2000, style:'background:linear-gradient(135deg,#e0f7ff,#fff,#fce7f3,#dbeafe,#fff);color:#0f172a;border:1px solid rgba(255,255,255,.8);box-shadow:0 0 18px rgba(255,255,255,.55)' }
  ];

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(f)); } catch(e) { return f; } }
  function getProfile() { return loadJSON(PROFILE_KEY, null); }
  function isLoggedIn() {
    const p = getProfile();
    return !!(p && p.type === 'google' && (p.uid || p.email));
  }
  function profileId() {
    const p = getProfile();
    return p ? String(p.uid || p.email || '').trim() : '';
  }
  function userKey(suffix) {
    const id = profileId();
    return id ? `${suffix}__${id}` : suffix;
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function credits() { return typeof window.getYumCredits === 'function' ? window.getYumCredits() : 0; }
  function owned() {
    const list = loadJSON(OWNED_KEY, ['classic']);
    if (!list.includes('classic')) list.push('classic');
    return [...new Set(list)];
  }
  function activeSkin() { return localStorage.getItem(ACTIVE_KEY) || 'classic'; }

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
    const lastDate = localStorage.getItem(userKey(LEGACY_DATE_KEY));
    const claimed = lastDate === today;
    const streak = Number(localStorage.getItem(userKey(LEGACY_STREAK_KEY))) || 0;
    let nextStreak;
    if (claimed) nextStreak = streak;
    else if (lastDate) {
      const diff = Math.round((new Date(today + 'T00:00:00') - new Date(lastDate + 'T00:00:00')) / 86400000);
      nextStreak = diff === 1 ? streak + 1 : 1;
    } else {
      nextStreak = 1;
    }
    return { claimed, streak, nextStreak, reward: rewardForStreakDay(nextStreak) };
  }

  function injectStyles() {
    if (document.getElementById('rewardsStoreHubStyles')) return;
    const s = document.createElement('style');
    s.id = 'rewardsStoreHubStyles';
    s.textContent = `
      .main-rewards-hub-btn {
        width: min(520px, 100%);
        border: 1px solid rgba(245,166,35,.42);
        background: linear-gradient(135deg, rgba(245,166,35,.16), rgba(78,205,196,.08));
        color: var(--gold);
        border-radius: 999px;
        padding: 12px 14px;
        font-family: Nunito, sans-serif;
        font-weight: 1000;
        letter-spacing: 1.2px;
        cursor: pointer;
        box-shadow: 0 8px 28px rgba(245,166,35,.14);
        margin-top: 8px;
      }
      #rewardsHubOverlay {
        position: fixed; inset: 0; z-index: 990;
        background: rgba(0,0,0,.85);
        display: none; align-items: flex-end; justify-content: center;
      }
      #rewardsHubOverlay.open { display: flex; }
      .rh-sheet {
        background: var(--bg); width: 100%; max-width: 520px;
        max-height: 92vh; border-radius: 24px 24px 0 0;
        overflow-y: auto; padding-bottom: 28px;
        transform: translateY(100%);
        transition: transform .35s cubic-bezier(.34,1.2,.64,1);
      }
      #rewardsHubOverlay.open .rh-sheet { transform: translateY(0); }
      .rh-header {
        position: sticky; top: 0; background: var(--panel);
        padding: 16px 18px 14px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        display: flex; align-items: center; gap: 10px; z-index: 3;
      }
      .rh-header-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.4rem; letter-spacing: 3px; color: var(--gold); flex: 1;
      }
      .rh-wallet {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; border-radius: 999px;
        background: rgba(78,205,196,.12);
        border: 1px solid rgba(78,205,196,.28);
        color: var(--green);
        font-family: Nunito, sans-serif;
        font-weight: 900; font-size: .72rem; letter-spacing: .5px;
      }
      .rh-close {
        background: none; border: none; color: var(--muted);
        font-size: 1.4rem; cursor: pointer; padding: 4px 8px;
      }
      .rh-section {
        margin: 14px 12px;
        background: rgba(255,255,255,.035);
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 18px;
        padding: 14px 12px 16px;
      }
      .rh-section-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.05rem; letter-spacing: 2px;
        color: var(--gold); margin: 0 6px 10px;
        display: flex; align-items: center; gap: 8px;
      }
      .rh-streak-grid {
        display: grid; grid-template-columns: repeat(7, 1fr);
        gap: 6px; padding: 0 4px;
      }
      .rh-day {
        background: var(--card);
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 12px;
        padding: 8px 2px 6px;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        text-align: center;
      }
      .rh-day.claimed {
        opacity: .55;
        border-color: rgba(78,205,196,.4);
        background: linear-gradient(135deg, rgba(78,205,196,.12), var(--card));
      }
      .rh-day.today {
        border-color: rgba(245,166,35,.6);
        background: linear-gradient(135deg, rgba(245,166,35,.15), var(--card));
        box-shadow: 0 0 0 2px rgba(245,166,35,.2);
      }
      .rh-day.bonus { border-color: rgba(233,69,96,.45); }
      .rh-day-num { font-size: .55rem; color: var(--muted); letter-spacing: 1px; font-weight: 800; }
      .rh-day-icon { font-size: 1.05rem; line-height: 1; }
      .rh-day-amt {
        font-family: 'Bebas Neue', cursive;
        font-size: .85rem; letter-spacing: 1.2px; color: var(--gold);
      }
      .rh-day.claimed .rh-day-amt { color: var(--green); }
      .rh-claim-btn {
        margin-top: 12px;
        width: 100%;
        border: none; border-radius: 50px;
        padding: 12px 16px;
        font-family: Nunito, sans-serif;
        font-weight: 900; letter-spacing: 1.5px;
        font-size: .9rem;
        background: linear-gradient(135deg, var(--gold), #ffd166);
        color: #251400;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(245,166,35,.32);
      }
      .rh-claim-btn:disabled {
        background: rgba(255,255,255,.08);
        color: var(--muted);
        box-shadow: none;
        cursor: not-allowed;
      }
      .rh-claim-btn.green {
        background: linear-gradient(135deg, var(--green), #5fe3d8);
        color: #051818;
        box-shadow: 0 6px 20px rgba(78,205,196,.32);
      }
      .rh-mission-row {
        display: flex; align-items: center; gap: 12px;
        background: var(--card);
        border: 1px solid rgba(245,166,35,.32);
        border-radius: 14px;
        padding: 12px;
      }
      .rh-mission-icon {
        width: 44px; height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(245,166,35,.22), rgba(78,205,196,.18));
        border: 1px solid rgba(245,166,35,.35);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem; flex-shrink: 0;
      }
      .rh-mission-info { flex: 1; min-width: 0; }
      .rh-mission-name {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.05rem; letter-spacing: 2px; color: var(--white);
      }
      .rh-mission-desc { font-size: .7rem; color: var(--muted); margin-top: 2px; line-height: 1.35; }
      .rh-mission-reward { text-align: right; flex-shrink: 0; }
      .rh-mission-reward-amt {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.25rem; letter-spacing: 1.5px; color: var(--gold);
      }
      .rh-mission-reward-lbl { font-size: .55rem; color: var(--muted); font-weight: 800; letter-spacing: 1.5px; }
      .rh-progress-bar {
        margin-top: 10px;
        background: rgba(0,0,0,.32); height: 8px; border-radius: 999px; overflow: hidden;
      }
      .rh-progress-fill {
        height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, var(--green), var(--gold));
        transition: width .4s ease;
      }
      .rh-progress-lbl {
        text-align: center; color: var(--muted);
        font-size: .68rem; font-weight: 800; letter-spacing: 1px;
        margin-top: 4px;
      }
      .rh-skins { display: grid; grid-template-columns: 1fr; gap: 10px; }
      .rh-skin-card {
        background: var(--card);
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 14px;
        padding: 12px;
      }
      .rh-skin-card.active {
        border-color: rgba(78,205,196,.45);
        background: linear-gradient(135deg, rgba(78,205,196,.10), var(--card));
      }
      .rh-skin-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .rh-skin-name {
        font-family: 'Bebas Neue', cursive;
        letter-spacing: 2px; color: var(--white); font-size: 1rem;
      }
      .rh-skin-cost { color: var(--gold); font-weight: 900; font-size: .8rem; }
      .rh-skin-preview { display: flex; gap: 4px; margin: 8px 0; flex-wrap: wrap; }
      .rh-skin-preview span {
        width: 26px; height: 26px;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 6px; font-size: 1rem;
        font-family: Arial, sans-serif;
      }
      .rh-skin-action {
        width: 100%; border-radius: 999px;
        padding: 9px 12px; font-family: Nunito, sans-serif;
        font-weight: 900; letter-spacing: 1px; cursor: pointer;
        background: rgba(245,166,35,.16);
        color: var(--gold);
        border: 1px solid rgba(245,166,35,.4);
      }
      .rh-skin-action.active {
        background: rgba(78,205,196,.16);
        color: var(--green);
        border-color: rgba(78,205,196,.4);
        cursor: default;
      }
      .rh-skin-action.locked { opacity: .5; cursor: not-allowed; }
      .rh-empty {
        text-align: center; color: var(--muted);
        font-weight: 800; padding: 18px; font-size: .85rem;
      }
    `;
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    let ov = document.getElementById('rewardsHubOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'rewardsHubOverlay';
    ov.onclick = e => { if (e.target === ov) closeHub(); };
    document.body.appendChild(ov);
    return ov;
  }

  function renderBonusSection() {
    const info = streakInfo();
    const cycleDay = info.claimed
      ? (((info.streak - 1) % 7) + 1)
      : (((info.nextStreak - 1) % 7) + 1);
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayNum = i + 1;
      const isToday = dayNum === cycleDay;
      const isClaimed = info.claimed ? dayNum <= cycleDay : dayNum < cycleDay;
      const reward = rewardForStreakDay(dayNum);
      const isBonus = dayNum === 7;
      const icon = isClaimed
        ? '<i class="icn icn-check icn-green"></i>'
        : (isBonus ? '<i class="icn icn-gift icn-gold"></i>' : '<i class="icn icn-star icn-gold"></i>');
      const cls = ['rh-day', isClaimed ? 'claimed' : '', isToday ? 'today' : '', isBonus ? 'bonus' : '']
        .filter(Boolean).join(' ');
      return `<div class="${cls}"><div class="rh-day-num">DAY ${dayNum}</div><div class="rh-day-icon">${icon}</div><div class="rh-day-amt">+${reward}</div></div>`;
    }).join('');
    const claimBtn = info.claimed
      ? `<button class="rh-claim-btn green" disabled><i class="icn icn-check"></i> CLAIMED TODAY · COME BACK TOMORROW</button>`
      : `<button class="rh-claim-btn" onclick="window.rhClaimDailyBonus()"><i class="icn icn-gift"></i> CLAIM +${info.reward} CREDITS</button>`;
    return `<div class="rh-section">
      <div class="rh-section-title"><i class="icn icn-gift icn-gold"></i> DAILY BONUS</div>
      <div class="rh-streak-grid">${days}</div>
      ${claimBtn}
    </div>`;
  }

  function renderChallengeSection() {
    const status = typeof window.getYumDailyChallengeStatus === 'function'
      ? window.getYumDailyChallengeStatus()
      : null;
    if (!status) {
      return `<div class="rh-section">
        <div class="rh-section-title"><i class="icn icn-target icn-gold"></i> DAILY CHALLENGE</div>
        <div class="rh-empty">Daily challenge not available right now</div>
      </div>`;
    }
    const pct = Math.round((status.progress / status.target) * 100);
    const claimBtn = status.claimed
      ? `<button class="rh-claim-btn green" disabled><i class="icn icn-check"></i> REWARD CLAIMED</button>`
      : status.complete
        ? `<button class="rh-claim-btn" onclick="window.rhClaimChallenge()"><i class="icn icn-flag"></i> CLAIM +${status.reward} CREDITS</button>`
        : `<button class="rh-claim-btn" disabled>KEEP PLAYING · ${status.progress} / ${status.target}</button>`;
    const subtitle = status.claimed
      ? 'Reward claimed. New mission tomorrow.'
      : status.complete
        ? 'Mission complete! Tap to collect your credits.'
        : 'Complete today to earn Skin Store credits.';
    return `<div class="rh-section">
      <div class="rh-section-title"><i class="icn icn-target icn-gold"></i> DAILY CHALLENGE</div>
      <div class="rh-mission-row">
        <div class="rh-mission-icon"><i class="icn icn-target"></i></div>
        <div class="rh-mission-info">
          <div class="rh-mission-name">${status.title}</div>
          <div class="rh-mission-desc">${subtitle}</div>
        </div>
        <div class="rh-mission-reward">
          <div class="rh-mission-reward-amt">+${status.reward}</div>
          <div class="rh-mission-reward-lbl">CREDITS</div>
        </div>
      </div>
      <div class="rh-progress-bar"><div class="rh-progress-fill" style="width:${pct}%"></div></div>
      <div class="rh-progress-lbl">${status.progress} / ${status.target} · ${pct}%</div>
      ${claimBtn}
    </div>`;
  }

  function renderSkinSection() {
    const c = credits();
    const list = owned();
    const active = activeSkin();
    const cards = SKINS.map(skin => {
      const isOwned = list.includes(skin.id);
      const isActive = active === skin.id;
      const preview = DOT_FACES.map(f => `<span style="${skin.style}">${f}</span>`).join('');
      let action;
      if (isActive) {
        action = `<button class="rh-skin-action active" disabled><i class="icn icn-check"></i> EQUIPPED</button>`;
      } else if (isOwned) {
        action = `<button class="rh-skin-action" onclick="window.rhEquipSkin('${skin.id}')">EQUIP</button>`;
      } else if (c >= skin.cost) {
        action = `<button class="rh-skin-action" onclick="window.rhBuySkin('${skin.id}')">UNLOCK · ${skin.cost} CREDITS</button>`;
      } else {
        action = `<button class="rh-skin-action locked" disabled>LOCKED · NEED ${skin.cost} CREDITS</button>`;
      }
      return `<div class="rh-skin-card ${isActive ? 'active' : ''}">
        <div class="rh-skin-top"><div class="rh-skin-name">${skin.name}</div><div class="rh-skin-cost">${skin.cost} credits</div></div>
        <div class="rh-skin-preview">${preview}</div>
        ${action}
      </div>`;
    }).join('');
    return `<div class="rh-section">
      <div class="rh-section-title"><i class="icn icn-palette icn-gold"></i> SKIN STORE</div>
      <div class="rh-skins">${cards}</div>
    </div>`;
  }

  function render() {
    const ov = ensureOverlay();
    const html = !isLoggedIn()
      ? `<div class="rh-sheet">
        <div class="rh-header">
          <div class="rh-header-title"><i class="icn icn-gift"></i> REWARDS &amp; STORE</div>
          <button class="rh-close" onclick="window.rhCloseHub()"><i class="icn icn-close"></i></button>
        </div>
        <div class="rh-empty">Sign in with Google to earn credits and unlock skins.</div>
      </div>`
      : `<div class="rh-sheet">
        <div class="rh-header">
          <div class="rh-header-title"><i class="icn icn-gift"></i> REWARDS &amp; STORE</div>
          <span class="rh-wallet"><i class="icn icn-coin"></i> ${credits()}</span>
          <button class="rh-close" onclick="window.rhCloseHub()"><i class="icn icn-close"></i></button>
        </div>
        ${renderBonusSection()}
        ${renderChallengeSection()}
        ${renderSkinSection()}
      </div>`;

    // Skip re-render when nothing changed — replacing innerHTML otherwise
    // destroys the .rh-sheet scroll container and snaps scrollTop back to 0.
    if (ov.dataset.rhHtml === html) return;

    const oldSheet = ov.querySelector('.rh-sheet');
    const prevScroll = oldSheet ? oldSheet.scrollTop : 0;
    ov.innerHTML = html;
    ov.dataset.rhHtml = html;
    const newSheet = ov.querySelector('.rh-sheet');
    if (newSheet && prevScroll) newSheet.scrollTop = prevScroll;
  }

  function openHub() {
    injectStyles();
    render();
    requestAnimationFrame(() => ensureOverlay().classList.add('open'));
  }

  function closeHub() {
    const ov = document.getElementById('rewardsHubOverlay');
    if (!ov) return;
    ov.classList.remove('open');
    delete ov.dataset.rhHtml;
  }

  function claimBonusFromHub() {
    if (typeof window.dboPerformBonusClaim === 'function') {
      window.dboPerformBonusClaim();
    }
    setTimeout(render, 60);
  }

  function claimChallengeFromHub() {
    if (typeof window.claimDailyChallenge === 'function') {
      window.claimDailyChallenge();
    }
    setTimeout(render, 60);
  }

  function equipSkinFromHub(id) {
    if (typeof window.equipSkin === 'function') window.equipSkin(id);
    render();
  }

  function buySkinFromHub(id) {
    if (typeof window.buySkin === 'function') window.buySkin(id);
    render();
  }

  window.openRewardsHub = openHub;
  window.rhCloseHub = closeHub;
  window.rhClaimDailyBonus = claimBonusFromHub;
  window.rhClaimChallenge = claimChallengeFromHub;
  window.rhEquipSkin = equipSkinFromHub;
  window.rhBuySkin = buySkinFromHub;

  function refreshHubButton() {
    const profileBar = document.getElementById('profileLoginBar');
    if (!profileBar) return;

    // Clean up the legacy three buttons in case any other module still
    // creates them — the unified hub replaces them entirely.
    ['mainSkinStoreBtn', 'dailyRewardMenuBtn', 'dailyChallengeMenuBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    let btn = document.getElementById('mainRewardsHubBtn');
    if (!isLoggedIn()) {
      if (btn) btn.remove();
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'mainRewardsHubBtn';
      btn.className = 'main-rewards-hub-btn';
      btn.type = 'button';
      btn.onclick = openHub;
      profileBar.insertAdjacentElement('afterend', btn);
    }
    btn.innerHTML = `<i class="icn icn-gift"></i> Rewards &amp; Store · ${credits()} credits`;
  }

  function init() {
    injectStyles();
    refreshHubButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(() => {
    refreshHubButton();
    if (document.getElementById('rewardsHubOverlay')?.classList.contains('open')) render();
  }, 800);

  window.addEventListener('yumCreditsChanged', () => {
    refreshHubButton();
    if (document.getElementById('rewardsHubOverlay')?.classList.contains('open')) render();
  });
  window.addEventListener('yumChallengeChanged', () => {
    if (document.getElementById('rewardsHubOverlay')?.classList.contains('open')) render();
  });
})();
