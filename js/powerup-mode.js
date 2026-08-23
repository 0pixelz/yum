// ─── POWER-UP MODE ──────────────────────────────────────────────────────────
// Separate fun mode with earnable/usable power-ups. Normal modes untouched.

const POWERUPS = [
  { id:'extraRoll',    name:'Extra Roll',    icon:'<i class="icn icn-dice"></i>',
    desc:'Get one bonus reroll this turn',
    color:'#4ecdc4', gradient:'linear-gradient(135deg,#4ecdc4,#2ecc71)' },
  { id:'freezeDie',   name:'Freeze Dice',   icon:'<i class="icn icn-gem"></i>',
    desc:'Lock one dice — carries to your next turn',
    color:'#64b5f6', gradient:'linear-gradient(135deg,#64b5f6,#1e88e5)' },
  { id:'doublePoints',name:'Double Points', icon:'<i class="icn icn-sparkle"></i>',
    desc:'Double the score for your next category',
    color:'#f5a623', gradient:'linear-gradient(135deg,#f5a623,#f39c12)' },
  { id:'luckyDice',   name:'Lucky Dice',    icon:'<i class="icn icn-star"></i>',
    desc:'Reroll one dice — higher chance of 5 or 6',
    color:'#66bb6a', gradient:'linear-gradient(135deg,#66bb6a,#43a047)' },
  { id:'goldenDice',  name:'Golden Dice',   icon:'<i class="icn icn-dice-stack"></i>',
    desc:'Set one dice to any value you choose',
    color:'#ffcf5c', gradient:'linear-gradient(135deg,#ffd76a,#f5a623)' },
  { id:'chanceRoll',  name:'Chance Roll',   icon:'<i class="icn icn-volcano"></i>',
    desc:'Reroll ALL dice — next positive score doubles, no more rolls this turn',
    color:'#9b59b6', gradient:'linear-gradient(135deg,#9b59b6,#8e44ad)' },
  { id:'yamOrStrike', name:'Yam or Strike', icon:'<i class="icn icn-skull"></i>',
    desc:'First roll only: 4×1 + 2 rerolls on last dice — YAM or strike Yum!',
    color:'#e74c3c', gradient:'linear-gradient(135deg,#e74c3c,#c0392b)' },
  { id:'wildcard',    name:'Wildcard',      icon:'<i class="icn icn-target"></i>',
    desc:'Roll a combo you already scored to add it to that category again — then strike an empty one',
    color:'#f39c12', gradient:'linear-gradient(135deg,#f6c343,#e67e22)' },
];

let powerupMode    = false;
let playerPowerups = [];   // array of powerup ids in inventory
let pendingPowerup = null; // id of powerup waiting for a die click
let doublePointsActive = false;
let undoPowerupState   = null; // {catId} for undo
let freezeDieIndex = -1;
let frozenDieValue = 0;
let yamOrStrikeActive   = false;
let yamOrStrikeAttempts = 0;     // number of attempts used (max 2)
let suppressNextYumEarn = false; // forced YAM via yamOrStrike shouldn't earn another power-up
let allButYumPowerupAwarded = false; // reward for filling everything but Yam, once per game
let upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false; // upper-bonus reward fires once per game
let wildcardMaxCat   = null;   // Wildcard step 1: category chosen to fill with max
let wildcardMaxScore = 0;      // its max value, applied once the strike is picked

// ─── START ──────────────────────────────────────────────────────────────────

function startPowerupMode() {
  const name = document.getElementById('playerName').value.trim();
  if (!name) { (window.promptForUsername || showLobbyErr.bind(null, 'Enter your name first!'))(); return; }
  if (typeof window.yumValidateUsername === 'function') {
    const check = window.yumValidateUsername(name);
    if (!check.ok) { showLobbyErr(check.reason); return; }
  }
  playerName = name;

  powerupMode        = true;
  playerPowerups     = [];
  pendingPowerup     = null;
  doublePointsActive = false;
  undoPowerupState   = null;
  freezeDieIndex     = -1;
  frozenDieValue     = 0;
  pendingFreezeIdx   = -1;
  pendingFreezeVal   = 0;
  yamOrStrikeActive  = false;
  yamOrStrikeAttempts = 0;
  suppressNextYumEarn = false;
  upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false;
  // Clear the solo game-over latch — if a previous power-up game ended and the
  // player returned to the lobby (rather than rematch/quit), this stayed true
  // and permanently suppressed the next game's game-over screen.
  _pupGameOverPending = false;
  scores             = {};

  clearDice();
  document.getElementById('lobbyOverlay').style.display = 'none';
  renderScores();
  renderPowerupBar();
  syncDiceUI();

  openPowerupPickerModal('start');
}

// ─── PICKER MODAL ────────────────────────────────────────────────────────────

function openPowerupPickerModal(context) {
  let titleHtml, subText;
  if (context === 'start') {
    titleHtml = '<i class="icn icn-bolt"></i> CHOOSE YOUR POWER-UP!';
    subText   = 'Pick one power-up to start your game with';
  } else if (context === 'bonus') {
    titleHtml = '<i class="icn icn-gift"></i> UPPER BONUS! EARN A POWER-UP!';
    subText   = 'You reached 63 in the upper section — pick a power-up reward';
  } else if (context === 'allbutyum') {
    titleHtml = '<i class="icn icn-gift"></i> LOWER SECTION DONE! EARN A POWER-UP!';
    subText   = 'You filled the lower section — pick your reward power-up';
  } else {
    titleHtml = '<i class="icn icn-dice"></i> YAM! EARN A POWER-UP!';
    subText   = 'You rolled 5-of-a-kind! Pick a power-up to add to your arsenal';
  }
  document.getElementById('powerupPickerTitle').innerHTML = titleHtml;
  document.getElementById('powerupPickerSub').textContent = subText;

  const yumSlotFilled = !!(scores && scores.yum !== undefined);

  document.getElementById('powerupPickerGrid').innerHTML = POWERUPS.map(p => {
    const disabled = p.id === 'yamOrStrike' && yumSlotFilled;
    const onclick  = disabled ? '' : `onclick="selectPowerup('${p.id}','${context}')"`;
    const descText = disabled ? 'Yum slot already filled — unavailable' : p.desc;
    return `
    <button class="pup-pick-btn ${disabled ? 'pup-pick-disabled' : ''}" ${onclick}
            ${disabled ? 'disabled aria-disabled="true"' : ''}
            style="--pup-col:${p.color}">
      <div class="pup-pick-icon">${p.icon}</div>
      <div class="pup-pick-info">
        <div class="pup-pick-name">${p.name}</div>
        <div class="pup-pick-desc">${descText}</div>
      </div>
    </button>`;
  }).join('');

  document.getElementById('powerupPickerModal').classList.add('open');
}

function selectPowerup(id, context) {
  playerPowerups.push(id);
  document.getElementById('powerupPickerModal').classList.remove('open');
  const p = POWERUPS.find(x => x.id === id);
  showToast(`${p.icon} ${p.name} added!`);
  renderPowerupBar();
  syncPowerupsToDb();

  if (context === 'start') {
    setTimeout(() => showYourTurnPop('USE YOUR POWER-UPS!'), 300);
  }
}

// ─── ROLL-OFF REWARD ─────────────────────────────────────────────────────────
// Whoever wins the "who goes first" roll-off gets a free Extra Roll power-up.
// Power-Up mode only. Each client runs this for its own player, so in real
// multiplayer both sides are handled fairly (the winner's own client grants it
// and syncs the inventory to the room). In vs-bot, a bot win instead arms a
// one-time bonus roll on the bot's first turn (see botTakeTurn in app.js).
window.onFirstRollWinner = function onFirstRollWinner(winnerId, winnerIsMe, winnerName) {
  if (!powerupMode) return;
  if (winnerIsMe) {
    playerPowerups.push('extraRoll');
    renderPowerupBar();
    syncPowerupsToDb();
  } else if (typeof botMode !== 'undefined' && botMode && winnerId === 'bot') {
    // Bot won who-goes-first — give it a matching bonus roll on its first turn.
    window.__botFirstTurnExtraRoll = true;
  }
  // Announce to everyone (winner and loser) who got the free Extra Roll, using
  // the same prominent card as the "YOUR TURN" popup so it can't be missed.
  showFreeRollPopup(winnerIsMe, winnerName);
};

function ensureFreeRollPopupStyles() {
  if (document.getElementById('freeRollPopStyles')) return;
  const s = document.createElement('style');
  s.id = 'freeRollPopStyles';
  // Reuse the .your-turn-box look (defined in css/style.css) but as a distinct
  // centered overlay, so the score-labels bottom override for #yourTurnPop does
  // not apply and this stays the big centered card. Higher z-index than the
  // turn popup so it sits on top.
  s.textContent = `
    #freeRollPop{position:fixed;inset:0;z-index:1400;display:none;
      align-items:center;justify-content:center;pointer-events:none;padding:16px;}
    #freeRollPop.show{display:flex;}
    #freeRollPop .frp-box{max-width:min(88vw,360px);}
    #freeRollPop .frp-title{font-size:2.1rem!important;letter-spacing:4px!important;}
    #freeRollPop .your-turn-sub{font-size:.95rem!important;color:var(--white)!important;}
    #freeRollPop .your-turn-sub b{color:var(--gold);}
  `;
  document.head.appendChild(s);
}

function showFreeRollPopup(isMe, name) {
  try {
    ensureFreeRollPopupStyles();
    let pop = document.getElementById('freeRollPop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'freeRollPop';
      document.body.appendChild(pop);
    }
    const esc = window.escapeHtml || (x => x);
    const who = isMe ? 'You' : (name || 'Opponent');
    const extra = POWERUPS.find(x => x.id === 'extraRoll');
    pop.innerHTML =
      '<div class="your-turn-box frp-box">' +
        '<span class="your-turn-emoji">' + (extra ? extra.icon : '<i class="icn icn-dice icn-gold"></i>') + '</span>' +
        '<div class="your-turn-text frp-title">FREE EXTRA ROLL!</div>' +
        '<div class="your-turn-sub"><b>' + esc(who) + '</b> won the roll-off</div>' +
      '</div>';
    // Restart the entrance/exit animation on repeat (e.g. rematch).
    pop.classList.remove('show');
    void pop.offsetWidth;
    pop.classList.add('show');
    clearTimeout(pop._frpTimer);
    pop._frpTimer = setTimeout(() => pop.classList.remove('show'), 2600);
  } catch (e) {}
}

// ─── POWER-UP BAR ────────────────────────────────────────────────────────────

function renderPowerupBar() {
  const bar = document.getElementById('powerupBar');
  if (!powerupMode) { bar.style.display = 'none'; return; }

  // Build inventory count map
  const countMap = {};
  playerPowerups.forEach(id => { countMap[id] = (countMap[id] || 0) + 1; });

  const hasAny = Object.keys(countMap).length > 0;
  bar.style.display = hasAny ? 'flex' : 'flex'; // always show in powerup mode for context

  let btns = Object.entries(countMap).map(([id, cnt]) => {
    const p        = POWERUPS.find(x => x.id === id);
    const isActive = pendingPowerup === id;
    const isUsed   = id === 'doublePoints' && doublePointsActive;
    return `
      <button class="pup-btn ${isActive ? 'pup-active' : ''} ${isUsed ? 'pup-used' : ''}"
        onclick="activatePowerup('${id}')"
        title="${p.desc}"
        style="--pup-color:${p.color}">
        <span class="pup-icon">${p.icon}</span>
        <span class="pup-label">${p.name}</span>
        ${cnt > 1 ? `<span class="pup-count">×${cnt}</span>` : ''}
      </button>`;
  }).join('');

  if (!hasAny) {
    btns = `<span class="pup-empty">Roll 5-of-a-kind to earn more!</span>`;
  }

  // Double-points active banner
  const dblBanner = doublePointsActive
    ? `<div class="pup-dbl-banner"><i class="icn icn-sparkle"></i> DOUBLE POINTS ACTIVE — score any category to double it!</div>`
    : '';

  // Pending action hint
  const hintMap = {
    freezeDie: '<i class="icn icn-gem"></i> Click a dice to freeze it',
    luckyDice: '<i class="icn icn-star"></i> Click a dice to reroll with luck',
    goldenDice: '<i class="icn icn-dice-stack"></i> Click a dice to set its value',
  };
  const hint = pendingPowerup && hintMap[pendingPowerup]
    ? `<div class="pup-hint">${hintMap[pendingPowerup]}</div>`
    : '';

  // Wildcard two-step guide — a big, persistent banner that spells out exactly
  // which of the two steps you're on (pick the MAX category, then the STRIKE),
  // so it never relies on a toast that's already faded.
  let wcBanner = '';
  if (pendingPowerup === 'wildcard' || wildcardMaxCat) {
    ensureWildcardStyles();
    if (!wildcardMaxCat) {
      wcBanner = `<div class="pup-wc-banner pup-wc-step1">
        <span class="pup-wc-step">STEP 1 / 2</span>
        <span class="pup-wc-text"><i class="icn icn-star"></i> Tap a category you <b>already scored that your roll makes</b> to add it again</span>
      </div>`;
    } else {
      const _wc = _wcCat(wildcardMaxCat) || {};
      const _wcName = _wc.name || wildcardMaxCat;
      const _cur = Number((typeof scores !== 'undefined' ? scores[wildcardMaxCat] : 0)) || 0;
      wcBanner = `<div class="pup-wc-banner pup-wc-step2">
        <span class="pup-wc-step">STEP 2 / 2</span>
        <span class="pup-wc-text"><b>${_wcName} ${_cur} +${wildcardMaxScore} = ${_cur + wildcardMaxScore}.</b> Now tap an <b>EMPTY category to STRIKE (0)</b> as the cost</span>
        <button class="pup-wc-cancel" type="button" onclick="activatePowerup('wildcard')">Cancel</button>
      </div>`;
    }
  }

  bar.innerHTML = `
    <div class="pup-bar-head"><i class="icn icn-bolt"></i> POWER-UPS</div>
    ${dblBanner}
    ${wcBanner}
    ${hint}
    <div class="pup-items">${btns}</div>`;
}

// ─── ACTIVATE ────────────────────────────────────────────────────────────────

function activatePowerup(id) {
  // Power-ups only work in powerup mode (solo)
  if (!powerupMode) return;

  // Cancel pending if tapping same powerup again
  if (pendingPowerup === id) {
    pendingPowerup = null;
    // Fully clear the two-step Wildcard state so a re-arm starts clean.
    wildcardMaxCat = null; wildcardMaxScore = 0;
    renderPowerupBar();
    refreshDieFreezeVisual();
    refreshWildcardHighlight();
    syncPowerupsToDb();
    return;
  }

  switch (id) {

    case 'extraRoll': {
      consumePowerup('extraRoll');
      rollsLeft++;
      const used = Math.max(0, 3 - rollsLeft + 1);
      document.getElementById('rollCount').textContent = `Rolls: ${3 - rollsLeft} / 3  +1`;
      showToast('Extra Roll granted — you have one more roll!');
      renderPowerupBar();
      syncPowerupsToDb();
      break;
    }

    case 'freezeDie': {
      if (!rolled) { showToast('Roll your dice first!'); return; }
      pendingPowerup = 'freezeDie';
      renderPowerupBar();
      refreshDieFreezeVisual();
      syncPowerupsToDb();
      break;
    }

    case 'doublePoints': {
      consumePowerup('doublePoints');
      doublePointsActive = true;
      renderPowerupBar();
      // Refresh the scorecard now so the doubled previews show immediately
      // (renderScores also triggers the possibilities panel to re-render).
      if (typeof renderScores === 'function') renderScores();
      showToast('Double Points active! Score any category to double it.');
      syncPowerupsToDb();
      break;
    }

    case 'luckyDice': {
      if (!rolled) { showToast('Roll your dice first!'); return; }
      pendingPowerup = 'luckyDice';
      renderPowerupBar();
      refreshDieFreezeVisual();
      syncPowerupsToDb();
      break;
    }

    case 'goldenDice': {
      // Arms a dice pick — tapping a dice opens a popup to choose its new value.
      if (!rolled) { showToast('Roll your dice first!'); return; }
      pendingPowerup = 'goldenDice';
      renderPowerupBar();
      refreshDieFreezeVisual();
      showToast('Golden Dice — tap a dice to set its value!');
      syncPowerupsToDb();
      break;
    }

    case 'wildcard': {
      // Arms a two-step pick (see _wildcardOnRowTap): step 1 taps a category you
      // ALREADY completed whose combo your CURRENT roll makes (its rolled score
      // is added on top), step 2 taps an EMPTY category to strike as the cost.
      // Requires a roll — you must actually roll the combo to add it.
      // `wildcardMaxCat` (not a special pendingPowerup value) is the step flag,
      // so the flow survives snapshot re-renders that could reset pendingPowerup.
      if (!rolled) { showToast('Roll your dice first — Wildcard adds the combo you roll!'); return; }
      pendingPowerup   = 'wildcard';
      wildcardMaxCat   = null;
      wildcardMaxScore = 0;
      renderPowerupBar();
      refreshWildcardHighlight();
      showToast('Wildcard — tap a category you already scored that your roll makes, to add it again!');
      syncPowerupsToDb();
      break;
    }

    case 'chanceRoll': {
      if (yamOrStrikeActive) { showToast('Finish Yam or Strike first!'); return; }
      consumePowerup('chanceRoll');
      // Reroll ALL dice, ignoring holds
      for (let i = 0; i < 5; i++) {
        dice[i] = Math.floor(Math.random() * 6) + 1;
        held[i] = false;
      }
      // Freeze carry-overs are also blown away by chaos
      freezeDieIndex = -1; frozenDieValue = 0;
      rolled = true;
      rollsLeft = 0;
      doublePointsActive = true;
      renderDice(true);
      renderScores();
      const rc = document.getElementById('rollCount');
      if (rc) rc.textContent = 'CHANCE ROLL — committed!';
      if (window.SFX && SFX.roll) { try { SFX.roll(); } catch(e){} }
      renderPowerupBar();
      showToast('CHANCE ROLL! No more rolls — score positive to double!');
      // MP sync of dice state
      if (typeof mpMode !== 'undefined' && mpMode && typeof roomRef !== 'undefined' && roomRef) {
        const _skinId = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
        let _pdc = null; try { _pdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch(e) {}
        roomRef.child('players/' + playerId + '/liveDice').set({
          dice: dice, held: held, roll: 3, skin: _skinId, perDieColors: _pdc, ts: Date.now()
        });
      }
      syncPowerupsToDb();
      break;
    }

    case 'yamOrStrike': {
      if (yamOrStrikeActive) { showToast('Already active — roll the last dice!'); return; }
      // First-roll only: rollsLeft is 3 before any roll has happened.
      // Once any roll has happened (rollsLeft < 3), Yam or Strike is locked out.
      if (rollsLeft < 3) {
        showToast('You can only use Yam or Strike on your first roll!');
        return;
      }
      // Block if Yum slot is already filled
      if (scores && scores.yum !== undefined) {
        showToast('Yum slot already taken — can\'t use Yam or Strike!');
        return;
      }
      consumePowerup('yamOrStrike');
      yamOrStrikeActive   = true;
      yamOrStrikeAttempts = 1; // the initial forced roll counts as attempt 1 of 3
      // Force 4 dice to 1, last die rolled
      dice[0] = 1; dice[1] = 1; dice[2] = 1; dice[3] = 1;
      dice[4] = Math.floor(Math.random() * 6) + 1;
      held[0] = true; held[1] = true; held[2] = true; held[3] = true; held[4] = false;
      // Freeze carry-overs are no longer meaningful for this turn
      freezeDieIndex = -1; frozenDieValue = 0;
      rolled = true;
      rollsLeft = 2; // 2 more rerolls allowed (3/3 total)
      renderDice(true);
      renderScores();
      const rc2 = document.getElementById('rollCount');
      if (rc2) rc2.textContent = 'YAM OR STRIKE — 2 chances left';
      if (window.SFX && SFX.roll) { try { SFX.roll(); } catch(e){} }
      renderPowerupBar();
      // MP sync
      if (typeof mpMode !== 'undefined' && mpMode && typeof roomRef !== 'undefined' && roomRef) {
        const _skinId = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
        let _pdc = null; try { _pdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch(e) {}
        roomRef.child('players/' + playerId + '/liveDice').set({
          dice: dice, held: held, roll: 1, skin: _skinId, perDieColors: _pdc, ts: Date.now()
        });
      }
      if (dice[4] === 1) {
        resolveYamOrStrike(true);
      } else {
        showToast(`Rolled ${dice[4]} — need a 1! 2 rerolls left`);
      }
      syncPowerupsToDb();
      break;
    }
  }
}

// ─── YAM-OR-STRIKE RESOLUTION ────────────────────────────────────────────────

function resolveYamOrStrike(success) {
  yamOrStrikeActive   = false;
  yamOrStrikeAttempts = 0;
  rollsLeft           = 0;
  const yumPts = (typeof RULES !== 'undefined' && RULES && RULES.yumPoints)
    ? RULES.yumPoints
    : 50;
  if (success) {
    suppressNextYumEarn = true;
    showToast(`YAM! +${yumPts} pts (no power-up bonus)`);
    activeModal    = 'yum';
    selectedScore  = yumPts;
    // Trigger the same YAM splash effect as a natural 5-of-a-kind
    if (typeof window.yumCheckCelebrate === 'function') {
      try { window.yumCheckCelebrate(); } catch(e) {}
    }
  } else {
    showToast('No 1 — YAM struck!');
    activeModal    = 'yum';
    selectedScore  = 0;
  }
  const rc = document.getElementById('rollCount');
  if (rc) rc.textContent = success ? 'YAM!' : 'STRUCK';
  renderPowerupBar();
  // Auto-commit the Yum score after a brief beat so the player sees the outcome
  setTimeout(() => {
    if (typeof confirmScore === 'function') confirmScore();
  }, 700);
}

function consumePowerup(id) {
  const idx = playerPowerups.indexOf(id);
  if (idx >= 0) playerPowerups.splice(idx, 1);
}

function syncPowerupsToDb() {
  if (!mpMode || !powerupMode || !roomRef) return;
  roomRef.child('players/' + playerId + '/livePowerups').set({
    inventory: playerPowerups.slice(),
    pending: pendingPowerup || null,
    doubleActive: doublePointsActive,
    ts: Date.now()
  });
}

// ─── DIE CLICK INTERCEPTION ──────────────────────────────────────────────────

// Returns true if the click was consumed by a pending powerup
function tryPowerupDieClick(i) {
  if (!powerupMode || !pendingPowerup) return false;
  if (dice[i] === 0) return false;

  if (pendingPowerup === 'freezeDie') {
    consumePowerup('freezeDie');
    pendingPowerup  = null;
    freezeDieIndex  = i;
    frozenDieValue  = dice[i];
    held[i]         = true;
    renderDice(false);
    refreshDieFreezeVisual();
    renderPowerupBar();
    showToast(`Dice frozen (${dice[i]}) — carries to next turn!`);
    syncPowerupsToDb();
    _pushLiveDice();   // let the opponent see the held/frozen dice live
    return true;
  }

  if (pendingPowerup === 'goldenDice') {
    // Don't consume yet — open the value picker; applyGoldenDice finalizes it.
    openGoldenDicePicker(i);
    return true;
  }

  if (pendingPowerup === 'luckyDice') {
    consumePowerup('luckyDice');
    pendingPowerup = null;
    // 2/3 chance of landing on 5 or 6
    dice[i] = Math.random() < (2/3) ? (Math.random() < 0.5 ? 5 : 6)
                                     : (Math.floor(Math.random() * 4) + 1);
    rolled = true;
    renderScores();
    renderDice(false);
    // Spin just this one die (held dice aren't animated by renderDice(false),
    // and a same-value reroll wouldn't trigger via faceChanged either).
    const el = document.getElementById('diceRow').querySelector(`[data-i="${i}"]`);
    if (el) {
      if (typeof window.spinDie === 'function') {
        window.spinDie(el, false);
      } else {
        el.classList.remove('die-spin', 'die-rolled-same');
        void el.offsetWidth;
        el.classList.add('die-spin');
      }
    }
    refreshDieFreezeVisual();
    renderPowerupBar();
    showToast(`Lucky reroll → ${dice[i]}`);
    syncPowerupsToDb();
    _pushLiveDice();   // let the opponent see the rerolled dice live
    return true;
  }

  return false;
}

// ─── FREEZE VISUAL ───────────────────────────────────────────────────────────

function refreshDieFreezeVisual() {
  const row = document.getElementById('diceRow');
  if (!row) return;
  for (let i = 0; i < 5; i++) {
    const el = row.querySelector(`[data-i="${i}"]`);
    if (!el) continue;
    el.classList.toggle('die-frozen',     powerupMode && i === freezeDieIndex);
    el.classList.toggle('die-selectable', powerupMode && !!pendingPowerup && dice[i] > 0);
  }
}

// Push the current dice state to the room's liveDice stream so the opponent's
// board updates immediately when a power-up changes a dice mid-turn (Golden Dice,
// Lucky Dice). Mirrors the roll-count field the normal roll push uses so the
// opponent's roll dots stay correct.
function _pushLiveDice() {
  if (typeof mpMode === 'undefined' || !mpMode) return;
  if (typeof roomRef === 'undefined' || !roomRef || typeof playerId === 'undefined' || !playerId) return;
  try {
    const _skinId = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
    let _pdc = null; try { _pdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch (e) {}
    const _roll = Math.max(0, Math.min(3, 3 - (typeof rollsLeft === 'number' ? rollsLeft : 0)));
    roomRef.child('players/' + playerId + '/liveDice').set({
      dice: dice, held: held, roll: _roll, skin: _skinId, perDieColors: _pdc, ts: Date.now()
    });
  } catch (e) { console.warn('liveDice push failed:', e); }
}

// ─── GOLDEN DICE VALUE PICKER ─────────────────────────────────────────────────
// After tapping a dice with Golden Dice armed, a small popup lets the player
// choose the new face (1–6). applyGoldenDice() finalizes and consumes the power-up.
function ensureGoldenDiceStyles() {
  if (document.getElementById('goldenDiceStyles')) return;
  const s = document.createElement('style');
  s.id = 'goldenDiceStyles';
  s.textContent = `
    #goldenDiceOverlay{position:fixed;inset:0;z-index:1500;display:none;align-items:center;
      justify-content:center;background:rgba(0,0,0,.72);padding:20px;}
    #goldenDiceOverlay.open{display:flex;}
    #goldenDiceOverlay .gd-sheet{background:var(--panel,#1b1b2f);border-radius:20px;padding:22px 18px 20px;
      width:100%;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.5),inset 0 0 0 1px rgba(245,166,35,.35);text-align:center;}
    #goldenDiceOverlay .gd-title{font-family:"Bebas Neue","Arial Narrow",sans-serif;letter-spacing:2px;
      font-size:1.5rem;color:#ffd76a;margin-bottom:2px;}
    #goldenDiceOverlay .gd-sub{font-size:.85rem;color:var(--muted,#aab);margin-bottom:16px;}
    #goldenDiceOverlay .gd-faces{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
    #goldenDiceOverlay .gd-face{aspect-ratio:1/1;border-radius:14px;border:1px solid rgba(245,166,35,.45);
      background:rgba(245,166,35,.10);color:#fff;font-size:1.5rem;font-weight:800;cursor:pointer;
      display:flex;align-items:center;justify-content:center;transition:transform .1s,background .15s;}
    #goldenDiceOverlay .gd-face:hover,#goldenDiceOverlay .gd-face:active{background:rgba(245,166,35,.28);transform:scale(1.06);}
    #goldenDiceOverlay .gd-face svg,#goldenDiceOverlay .gd-face i{width:34px;height:34px;}
    #goldenDiceOverlay .gd-cancel{background:rgba(255,255,255,.10);color:#fff;border:1px solid rgba(255,255,255,.22);
      border-radius:999px;padding:7px 20px;font-size:.85rem;font-weight:600;cursor:pointer;}
  `;
  document.head.appendChild(s);
}

let _goldenDiceIdx = -1;

function openGoldenDicePicker(i) {
  if (!powerupMode || pendingPowerup !== 'goldenDice') return;
  ensureGoldenDiceStyles();
  _goldenDiceIdx = i;
  let ov = document.getElementById('goldenDiceOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'goldenDiceOverlay';
    document.body.appendChild(ov);
  }
  const face = (v) => (typeof dieIcon === 'function' ? dieIcon(v) : String(v));
  ov.innerHTML =
    '<div class="gd-sheet">' +
      '<div class="gd-title"><i class="icn icn-dice-stack"></i> GOLDEN DICE</div>' +
      '<div class="gd-sub">Choose this dice’s new value</div>' +
      '<div class="gd-faces">' +
        [1,2,3,4,5,6].map(v => `<button class="gd-face" type="button" data-v="${v}">${face(v)}</button>`).join('') +
      '</div>' +
      '<button class="gd-cancel" type="button">Cancel</button>' +
    '</div>';
  ov.querySelectorAll('.gd-face').forEach(btn => {
    btn.onclick = () => applyGoldenDice(_goldenDiceIdx, Number(btn.getAttribute('data-v')));
  });
  const cancel = ov.querySelector('.gd-cancel');
  if (cancel) cancel.onclick = () => closeGoldenDicePicker();
  ov.classList.add('open');
}

function closeGoldenDicePicker() {
  const ov = document.getElementById('goldenDiceOverlay');
  if (ov) ov.classList.remove('open');
  _goldenDiceIdx = -1;
}

function applyGoldenDice(i, v) {
  closeGoldenDicePicker();
  if (!powerupMode || pendingPowerup !== 'goldenDice') return;
  if (i < 0 || i > 4 || !(v >= 1 && v <= 6)) return;
  consumePowerup('goldenDice');
  pendingPowerup = null;
  dice[i] = v;
  rolled = true;
  renderScores();
  renderDice(false);
  const el = document.getElementById('diceRow') &&
    document.getElementById('diceRow').querySelector(`[data-i="${i}"]`);
  if (el) {
    if (typeof window.spinDie === 'function') window.spinDie(el, false);
    else { el.classList.remove('die-spin','die-rolled-same'); void el.offsetWidth; el.classList.add('die-spin'); }
  }
  refreshDieFreezeVisual();
  renderPowerupBar();
  showToast(`Golden Dice → ${v}`);
  syncPowerupsToDb();
  _pushLiveDice();   // let the opponent see the changed dice live
}

// ─── YUM EARN CHECK ──────────────────────────────────────────────────────────

// Reward: roll a Large Straight on your FIRST roll and score it → free Extra Roll.
// rollsBefore is rollsLeft at score time: 2 means exactly one roll was taken this
// turn (no rerolls). Fires every time it happens (a first-roll straight is rare).
function checkPowerupFirstRollStraightEarn(catId, scoreVal, rollsBefore) {
  if (!powerupMode) return;
  if (catId !== 'lgStraight') return;   // Large Straight only
  if (!(scoreVal > 0)) return;          // must actually be a valid straight
  if (rollsBefore !== 2) return;        // only on the first roll (no rerolls)
  if (typeof playerPowerups === 'undefined') return;
  playerPowerups.push('extraRoll');
  renderPowerupBar();
  syncPowerupsToDb();
  const ico = (typeof POWERUP_ICONS !== 'undefined' && POWERUP_ICONS.extraRoll)
    ? POWERUP_ICONS.extraRoll : '<i class="icn icn-dice"></i>';
  showToast(`${ico} First-roll Large Straight! Bonus Extra Roll earned!`);
}

function checkPowerupYumEarn(savedDice, scoreVal) {
  if (!powerupMode) return;
  if (scoreVal <= 0) return;
  // Yam-or-Strike forced YAMs don't earn a bonus power-up
  if (suppressNextYumEarn) { suppressNextYumEarn = false; return; }
  // 5-of-a-kind earns a power-up
  const isYum = savedDice.every(v => v > 0) && savedDice.every(v => v === savedDice[0]);
  if (isYum) {
    setTimeout(() => openPowerupPickerModal('earn'), 900);
  }
}

function checkPowerupUpperBonusEarn(justScoredId, justScoredValue) {
  if (!powerupMode) return;
  if (upperBonusPowerupAwarded) return;
  const ids = (typeof UPPER_IDS !== 'undefined') ? UPPER_IDS : ['ones','twos','threes','fours','fives','sixes'];
  const target = (typeof BONUS_TARGET !== 'undefined') ? BONUS_TARGET : 63;
  let upperTotal = ids.reduce((s, id) => s + (Number(scores[id]) || 0), 0);
  // In multiplayer the just-scored value lands in `scores` asynchronously (after
  // the server submit resolves), so it isn't in `scores` yet when this runs.
  // Fold it in explicitly so the bonus reward fires on the same turn instead of
  // a round late. In solo/bot the score is already in `scores`, so this guard
  // (undefined check) prevents double-counting.
  if (justScoredId && ids.indexOf(justScoredId) !== -1 &&
      (scores[justScoredId] === undefined || scores[justScoredId] === null)) {
    upperTotal += (Number(justScoredValue) || 0);
  }
  if (upperTotal >= target) {
    upperBonusPowerupAwarded = true;
    setTimeout(() => openPowerupPickerModal('bonus'), 900);
  }
}

// Reward for completing the LOWER section's non-Yam categories: once every
// lower-section category other than Yam is filled, earn a power-up — regardless
// of whether Yam itself is filled or not. Fires once per game.
function checkPowerupAllButYumEarn(justScoredId) {
  if (!powerupMode) return;
  if (allButYumPowerupAwarded) return;
  if (typeof categories === 'undefined' || !Array.isArray(categories)) return;

  const isFilled = (id) =>
    (scores[id] !== undefined && scores[id] !== null) || id === justScoredId;

  // Every LOWER-section category except Yam filled? Yam's own state doesn't
  // matter. (Folds in the just-scored id for MP's async scores write.)
  const lowerNonYum = categories.filter(c => c.section === 'lower' && c.id !== 'yum');
  const allLowerFilled = lowerNonYum.length > 0 && lowerNonYum.every(c => isFilled(c.id));
  if (allLowerFilled) {
    allButYumPowerupAwarded = true;
    setTimeout(() => openPowerupPickerModal('allbutyum'), 900);
  }
}

// ─── MONKEY-PATCHES ──────────────────────────────────────────────────────────

// Patch cycleDie — intercept die clicks for pending powerups
const _pupOrigCycleDie = cycleDie;
cycleDie = function(i) {
  if (tryPowerupDieClick(i)) return;
  _pupOrigCycleDie(i);
};

// ── Wildcard power-up (two-step) ──────────────────────────────────────────────
// Step 1: tap a category (not Yam) → remember it as the MAX fill.
// Step 2: tap a different empty category → that one is STRUCK (0). Both are then
// scored in one turn: max into the first, 0 into the second.
function _wcTurnOk() {
  if (typeof mpMode !== 'undefined' && mpMode &&
      typeof currentTurnId !== 'undefined' && currentTurnId !== playerId) {
    showToast("It's not your turn!"); return false;
  }
  if (typeof botMode !== 'undefined' && botMode &&
      typeof playerTurn !== 'undefined' && !playerTurn) {
    showToast('Wait for the bot!'); return false;
  }
  return true;
}
function _wcCat(id) {
  return (typeof categories !== 'undefined') ? categories.find(c => c.id === id) : null;
}

// Self-contained multiplayer Wildcard submit. ADDS the rolled `addAmount` on top
// of the already-scored `addCat` and strikes the empty `strikeId` to 0 in a
// single server call, then mirrors the result locally. Everything is wrapped so
// a failure can only ever produce a toast + a re-armed pick — never a blank page.
// Deliberately does NOT call confirmScore (whose deep wrapper chain was the
// crash surface).
async function _wildcardMpStrike(addCat, addAmount, strikeId) {
  const cloud = (typeof window !== 'undefined') ? window.YumCloud : null;
  if (!cloud || typeof cloud.submitScore !== 'function' ||
      typeof roomCode === 'undefined' || !roomCode) {
    showToast("Can't reach the server — try again in a moment.");
    return;
  }

  // Clear the pending Wildcard UI immediately so the banner/pills disappear on
  // tap (feedback that the strike registered). Remember it for rollback.
  const _prevPending  = pendingPowerup;
  const _prevMaxCat   = wildcardMaxCat;
  const _prevMaxScore = wildcardMaxScore;
  const _before       = Number((typeof scores !== 'undefined' ? scores[addCat] : 0)) || 0;
  pendingPowerup = null; wildcardMaxCat = null; wildcardMaxScore = 0;
  renderPowerupBar();
  refreshWildcardHighlight();

  try {
    const payload = {
      roomId:         roomCode,
      categoryId:     addCat,
      score:          Math.max(0, addAmount | 0),  // the rolled amount to ADD; server adds it to the existing value
      wildcardDouble: true,           // tells the server to allow re-scoring a filled category
      strikeCategory: strikeId,
    };
    const resp = await cloud.submitScore(payload);
    const serverScore = (resp && typeof resp.score === 'number') ? resp.score : (_before + (addAmount | 0));

    consumePowerup('wildcard');
    if (typeof scores !== 'undefined') { scores[addCat] = serverScore; scores[strikeId] = 0; }
    if (typeof playerScoreDice !== 'undefined') {
      playerScoreDice[strikeId] = [];
    }
    try { if (window.SFX && typeof SFX.score === 'function') SFX.score(); } catch (e) {}
    if (typeof clearDice === 'function')   { try { clearDice(); } catch (e) { console.warn(e); } }
    if (typeof closeModalEl === 'function') { try { closeModalEl(); } catch (e) {} }
    if (typeof renderScores === 'function') renderScores();
    renderPowerupBar();
    syncPowerupsToDb();
    showToast(`Wildcard — ${(_wcCat(addCat) || {}).name || addCat} ${_before} → ${serverScore}, struck ${(_wcCat(strikeId) || {}).name || strikeId}.`);

    // Bonus power-up rewards — fold in the just-scored value for MP's async write.
    try { checkPowerupUpperBonusEarn(addCat, serverScore); } catch (e) { console.warn(e); }
    try { checkPowerupAllButYumEarn(strikeId); } catch (e) { console.warn(e); }

    // Game-over check, mirroring the MP confirmScore path.
    try {
      if (typeof allPlayers === 'object' && allPlayers && typeof categories !== 'undefined' &&
          Object.keys(scores).length >= categories.length) {
        const localDone = Object.entries(allPlayers).every(([pid, p]) => {
          const sc = pid === playerId ? scores : (p.scores || {});
          return Object.keys(sc).length >= categories.length;
        });
        if (localDone && typeof showMpGameOver === 'function') setTimeout(showMpGameOver, 800);
      }
    } catch (e) { console.warn(e); }
  } catch (err) {
    console.warn('wildcard MP strike failed:', err);
    const msg = String((err && err.message) || '');
    if (/not your turn/i.test(msg))          showToast("It's not your turn!");
    else if (/empty category to strike/i.test(msg)) showToast('Pick an EMPTY category to strike as the cost.');
    else                                     showToast("Couldn't apply Wildcard — try again.");
    // Roll back to the strike-pending state so the player can retry cleanly.
    pendingPowerup = _prevPending; wildcardMaxCat = _prevMaxCat; wildcardMaxScore = _prevMaxScore;
    renderPowerupBar();
    refreshWildcardHighlight();
  }
}

// Score the current dice for a category (its "rolled" value this turn).
function _wcRolled(cat) {
  try {
    if (cat && typeof cat.calc === 'function' && typeof dice !== 'undefined' && Array.isArray(dice)) {
      return Number(cat.calc(dice)) || 0;
    }
  } catch (e) {}
  return 0;
}

// Handle a scorecard tap while the Wildcard power-up is armed. Returns true if
// the tap was consumed by the Wildcard flow, false to let normal scoring happen.
//
// Mechanic: roll a combo you've already scored and ADD it to that category
// again, paying for it by striking an empty one.
//   Step 1 — tap an ALREADY-SCORED category whose combo your CURRENT roll makes
//            → its rolled value is added on top (e.g. Full House 25 → 50).
//            The ADD amount is stored in wildcardMaxScore, the category in
//            wildcardMaxCat.
//   Step 2 — tap an EMPTY category → struck to 0 as the cost; both land in one submit.
//
// The step is decided by `wildcardMaxCat` (null = still choosing what to re-score;
// set = now choosing the strike), NOT by a special pendingPowerup value —
// wildcardMaxCat is owned solely by this flow and is never reset by a room
// snapshot or teardown, so the strike step can't be silently lost between taps.
function _wildcardOnRowTap(id) {
  if (typeof powerupMode === 'undefined' || !powerupMode) return false;

  // ── Step 2 — a re-score target is chosen; this tap picks the empty strike. ──
  if (wildcardMaxCat) {
    if (!_wcTurnOk()) return true;
    if (id === wildcardMaxCat) {   // tapping the chosen category again cancels
      pendingPowerup = null; wildcardMaxCat = null; wildcardMaxScore = 0;
      renderPowerupBar(); refreshWildcardHighlight(); syncPowerupsToDb();
      showToast('Wildcard cancelled.');
      return true;
    }
    if (typeof scores === 'undefined' || scores[id] !== undefined) {
      showToast('Strike an EMPTY category as the cost.'); return true;
    }
    const strikeId  = id;
    const addCat    = wildcardMaxCat;
    const addAmount = wildcardMaxScore;                        // the rolled add
    const newTotal  = (Number((typeof scores !== 'undefined' ? scores[addCat] : 0)) || 0) + addAmount;
    if (typeof mpMode !== 'undefined' && mpMode) {
      // Multiplayer: dedicated, fully-guarded submit (never the confirmScore
      // wrapper chain — a throw in that chain used to blank the page).
      _wildcardMpStrike(addCat, addAmount, strikeId);
      return true;
    }
    // Solo / bot: re-score the category (existing + rolled) + strike the empty
    // one, then let confirmScore advance the turn (it drives the bot's turn).
    consumePowerup('wildcard');
    pendingPowerup = null; wildcardMaxCat = null; wildcardMaxScore = 0;
    if (typeof scores !== 'undefined') scores[strikeId] = 0;
    if (typeof playerScoreDice !== 'undefined') playerScoreDice[strikeId] = [];
    activeModal   = addCat;
    selectedScore = newTotal;
    renderPowerupBar();
    syncPowerupsToDb();
    showToast(`Wildcard — ${(_wcCat(addCat)||{}).name || addCat} +${addAmount} = ${newTotal}, struck ${(_wcCat(strikeId)||{}).name || strikeId}.`);
    if (typeof confirmScore === 'function') confirmScore();
    return true;
  }

  // ── Step 1 — pick an already-completed category your current roll makes. ──
  if (pendingPowerup === 'wildcard') {
    if (!_wcTurnOk()) return true;
    if (typeof rolled !== 'undefined' && !rolled) { showToast('Roll your dice first!'); return true; }
    if (typeof scores === 'undefined' || scores[id] === undefined) {
      showToast('Tap a category you already SCORED (your roll must make it).'); return true;
    }
    const cat = _wcCat(id);
    const rolledVal = _wcRolled(cat);
    if (rolledVal <= 0) {
      showToast(`Your roll doesn't make a ${(cat||{}).name || id} — roll that combo first!`);
      return true;
    }
    const curVal = Number(scores[id]) || 0;
    wildcardMaxCat   = id;
    wildcardMaxScore = rolledVal;                              // the ADD amount from this roll
    renderPowerupBar();
    refreshWildcardHighlight();
    syncPowerupsToDb();
    showToast(`Wildcard: ${(cat||{}).name || id} ${curVal} +${rolledVal} = ${curVal + rolledVal}. Now strike an EMPTY category as the cost.`);
    return true;
  }

  return false;
}

// Capture-phase interceptor: catch the scorecard tap BEFORE the row's inline
// onclick="openModal(...)" runs. This is the reliable path — it does not depend
// on the openModal monkey-patch being the one the inline handler resolves to,
// and it can't be swallowed by any other bubble-phase handler. Armed only while
// a Wildcard pick is in progress.
document.addEventListener('click', function (e) {
  if (typeof powerupMode === 'undefined' || !powerupMode) return;
  if (pendingPowerup !== 'wildcard' && !wildcardMaxCat) return;
  const t = e.target;
  const row = (t && t.closest) ? t.closest('#scoreSection .score-row') : null;
  if (!row) return;
  const id = row.getAttribute('data-cat');
  if (!id) return;
  // We own this tap — stop it from also opening the normal scoring modal.
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  try { _wildcardOnRowTap(id); }
  catch (err) { console.warn('wildcard tap failed:', err); showToast("Wildcard error — try again."); }
}, true);

// Keep the openModal patch too, as a fallback for any programmatic openModal(id)
// call made while a Wildcard pick is armed.
const _pupOrigOpenModal = openModal;
openModal = function(id) {
  if (powerupMode && (pendingPowerup === 'wildcard' || wildcardMaxCat)) {
    if (_wildcardOnRowTap(id)) return;
  }
  _pupOrigOpenModal(id);
};

// ── Wildcard scorecard highlight ──────────────────────────────────────────────
// While Wildcard is picking, glow the categories you can tap and label each with
// a pill: green "DOUBLE" on completed categories (step 1), then gold "×2" on the
// chosen row and red "STRIKE" on the remaining empty rows (step 2).
function ensureWildcardStyles() {
  if (document.getElementById('wildcardPickStyles')) return;
  const s = document.createElement('style');
  s.id = 'wildcardPickStyles';
  s.textContent = `
    #scoreSection .score-row.wc-pick, #scoreSection .score-row.wc-strike, #scoreSection .score-row.wc-chosen { cursor:pointer; position:relative; }
    #scoreSection .score-row.wc-pick   { animation: wcPulseGreen 1.1s ease-in-out infinite; }
    #scoreSection .score-row.wc-strike { animation: wcPulseRed 1.1s ease-in-out infinite; }
    #scoreSection .score-row.wc-chosen { box-shadow: inset 0 0 0 2px rgba(245,166,35,0.9), 0 0 16px rgba(245,166,35,0.4); }
    /* A clear pill on each row saying what a tap will do. */
    #scoreSection .score-row.wc-pick::after,
    #scoreSection .score-row.wc-strike::after,
    #scoreSection .score-row.wc-chosen::after {
      position:absolute; right:10px; top:50%; transform:translateY(-50%);
      font-family:"Bebas Neue","Arial Narrow",sans-serif; font-size:.72rem; letter-spacing:1px;
      font-weight:700; padding:2px 8px; border-radius:999px; pointer-events:none; white-space:nowrap;
    }
    #scoreSection .score-row.wc-pick::after   { content:'ADD ROLL'; color:#8ff5ee; background:rgba(78,205,196,.20); box-shadow:inset 0 0 0 1px rgba(78,205,196,.7); }
    #scoreSection .score-row.wc-strike::after { content:'STRIKE'; color:#ff9aab; background:rgba(233,69,96,.20); box-shadow:inset 0 0 0 1px rgba(233,69,96,.75); }
    #scoreSection .score-row.wc-chosen::after { content:'ADD'; color:#ffd67a; background:rgba(245,166,35,.22); box-shadow:inset 0 0 0 1px rgba(245,166,35,.8); }
    @keyframes wcPulseGreen { 0%,100%{box-shadow:inset 0 0 0 2px rgba(78,205,196,0.5),0 0 8px rgba(78,205,196,0.2)} 50%{box-shadow:inset 0 0 0 2px rgba(78,205,196,0.95),0 0 18px rgba(78,205,196,0.5)} }
    @keyframes wcPulseRed { 0%,100%{box-shadow:inset 0 0 0 2px rgba(233,69,96,0.45),0 0 8px rgba(233,69,96,0.2)} 50%{box-shadow:inset 0 0 0 2px rgba(233,69,96,0.95),0 0 18px rgba(233,69,96,0.45)} }

    /* Two-step guide banner in the power-up bar. */
    .pup-wc-banner { display:flex; align-items:center; gap:10px; flex-wrap:wrap;
      margin:6px 0; padding:9px 12px; border-radius:12px; font-size:.9rem; line-height:1.35; }
    .pup-wc-banner .pup-wc-step { flex:none; font-family:"Bebas Neue","Arial Narrow",sans-serif;
      letter-spacing:1.5px; font-size:.78rem; padding:3px 9px; border-radius:999px; font-weight:700; }
    .pup-wc-banner .pup-wc-text { flex:1 1 auto; min-width:0; }
    .pup-wc-step1 { background:rgba(78,205,196,.12); box-shadow:inset 0 0 0 1px rgba(78,205,196,.45); }
    .pup-wc-step1 .pup-wc-step { background:rgba(78,205,196,.28); color:#8ff5ee; }
    .pup-wc-step2 { background:rgba(233,69,96,.12); box-shadow:inset 0 0 0 1px rgba(233,69,96,.5); }
    .pup-wc-step2 .pup-wc-step { background:rgba(233,69,96,.28); color:#ff9aab; }
    .pup-wc-cancel { flex:none; margin-left:auto; background:rgba(255,255,255,.10); color:#fff;
      border:1px solid rgba(255,255,255,.25); border-radius:999px; padding:4px 12px;
      font-size:.8rem; font-weight:600; cursor:pointer; }
    .pup-wc-cancel:hover { background:rgba(255,255,255,.18); }
  `;
  document.head.appendChild(s);
}

function refreshWildcardHighlight() {
  const rows = document.querySelectorAll('#scoreSection .score-row');
  rows.forEach(r => r.classList.remove('wc-pick', 'wc-strike', 'wc-chosen'));
  if (!powerupMode) return;
  // Show highlights whenever a Wildcard pick is in progress — either armed
  // (pending) or already mid-strike (wildcardMaxCat set), so the strike targets
  // stay lit even if pendingPowerup changed underneath us.
  if (pendingPowerup !== 'wildcard' && !wildcardMaxCat) return;
  ensureWildcardStyles();
  rows.forEach(r => {
    const id = r.getAttribute('data-cat');
    if (!id) return;
    const filled    = r.classList.contains('filled');
    const scratched = r.classList.contains('scratched'); // filled with 0
    if (!wildcardMaxCat) {
      // Step 1 — highlight completed categories your CURRENT roll actually makes
      // (rolled score > 0), i.e. the ones you can add to.
      if (filled && !scratched && _wcRolled(_wcCat(id)) > 0) r.classList.add('wc-pick');
    } else {
      // Step 2 — the chosen row glows gold; the remaining EMPTY rows are strikes.
      if (id === wildcardMaxCat) r.classList.add('wc-chosen');
      else if (!filled) r.classList.add('wc-strike');
    }
  });
}

// renderScores rebuilds the rows (dropping the classes), so re-apply after it.
const _pupOrigRenderScoresWc = renderScores;
renderScores = function() {
  _pupOrigRenderScoresWc();
  refreshWildcardHighlight();
};

// Patch confirmScore — apply double points + track undo + check yum earn
const _pupOrigConfirmScore = confirmScore;
confirmScore = function() {
  if (!powerupMode) { _pupOrigConfirmScore(); return; }

  const catId      = activeModal;
  const baseScore  = selectedScore;
  const savedDice  = dice.slice();
  // Rolls left BEFORE scoring (clearDice resets it). 2 = exactly one roll taken
  // this turn — used for the first-roll Large Straight bonus below.
  const rollsBefore = (typeof rollsLeft === 'number') ? rollsLeft : 0;

  // Apply double points modifier — only consume when it actually doubles
  // a positive score. Striking a category (baseScore === 0) keeps the
  // power-up active for the next scoring play, otherwise an accidental
  // or strategic strike would silently burn the power-up.
  if (doublePointsActive && baseScore > 0) {
    selectedScore      = baseScore * 2;
    doublePointsActive = false;
    showToast(`Double Points! ${baseScore} → ${selectedScore} pts`);
  } else if (doublePointsActive && baseScore === 0) {
    showToast('Strike — Double Points still active for your next score');
  }

  // Track undo target
  undoPowerupState = { catId };

  // The value being recorded for this category (after any Double Points). In MP
  // it's written to `scores` asynchronously, so capture it here to feed the
  // upper-bonus check below.
  const finalScore = selectedScore;

  _pupOrigConfirmScore();

  // After scoring, reset freeze index (it was just used to carry a die,
  // the freeze is consumed when the die is re-seeded by clearDice patch)
  renderPowerupBar();

  // Check for YUM earn
  checkPowerupYumEarn(savedDice, baseScore);
  // Check for Upper Bonus earn (first time crossing 63 in upper section).
  // Pass the just-scored category + value so MP's async scores write doesn't
  // delay the reward by a full round.
  checkPowerupUpperBonusEarn(catId, finalScore);
  // Check for the "everything but Yam filled" reward.
  checkPowerupAllButYumEarn(catId);
  // Reward a first-roll Large Straight with a bonus Extra Roll.
  checkPowerupFirstRollStraightEarn(catId, baseScore, rollsBefore);
};

// Pending freeze carry-over — survives across bot's / opponent's turn so the
// player's frozen die is reapplied at the start of their next turn (not the
// bot's or opponent's, which would otherwise overwrite the local dice array).
let pendingFreezeIdx = -1;
let pendingFreezeVal = 0;

function _isMyTurnNow() {
  if (typeof mpMode !== 'undefined' && mpMode) {
    return typeof currentTurnId !== 'undefined' && currentTurnId === playerId;
  }
  if (typeof botMode !== 'undefined' && botMode) {
    return typeof playerTurn !== 'undefined' && playerTurn;
  }
  return true;
}

function _applyPendingFreeze() {
  if (!powerupMode || pendingFreezeIdx < 0) return;
  if (!_isMyTurnNow()) return;
  const idx = pendingFreezeIdx;
  const val = pendingFreezeVal;
  pendingFreezeIdx = -1;
  pendingFreezeVal = 0;
  dice[idx] = val;
  held[idx] = true;
  rolled    = true;
  renderDice(false);
  refreshDieFreezeVisual();
  showToast(`Frozen dice (${val}) carried to new turn!`);
}

// Patch clearDice — carry frozen die to the player's next turn. The carry
// is staged into pendingFreezeIdx/Val so it survives the bot's or opponent's
// turn (which overwrite the local dice array) and only gets applied when the
// player's turn actually resumes.
const _pupOrigClearDice = clearDice;
clearDice = function() {
  // Stage any active freeze into the pending carry-over. Both clearDice calls
  // that happen back-to-back at score time reference the same die, so we only
  // capture once (don't overwrite a pending carry that's already staged).
  if (powerupMode && freezeDieIndex >= 0) {
    pendingFreezeIdx = freezeDieIndex;
    pendingFreezeVal = frozenDieValue;
    freezeDieIndex = -1;
    frozenDieValue = 0;
  }

  _pupOrigClearDice();

  if (!powerupMode || pendingFreezeIdx < 0) return;

  // Try to apply once orig clearDice has zeroed things out. If it's not yet
  // our turn (bot is about to play, opponent is mid-turn), this is a no-op
  // and the carry stays pending until rollDice / restoreMyDiceUI / a later
  // clearDice triggers another apply attempt.
  setTimeout(_applyPendingFreeze, 150);
};

// Patch renderDice — keep freeze visual in sync
const _pupOrigRenderDice = renderDice;
renderDice = function(justRolled) {
  _pupOrigRenderDice(justRolled);
  if (powerupMode) refreshDieFreezeVisual();
};

// Patch confirmNewGame — reset powerup state when returning to lobby (solo only)
const _pupOrigConfirmNewGame = confirmNewGame;
confirmNewGame = function() {
  if (powerupMode && !mpMode && !botMode) {
    // Pure solo powerup mode — just return to lobby directly
    powerupMode        = false;
    playerPowerups     = [];
    pendingPowerup     = null;
    doublePointsActive = false;
    undoPowerupState   = null;
    freezeDieIndex     = -1;
    frozenDieValue     = 0;
    pendingFreezeIdx   = -1;
    pendingFreezeVal   = 0;
    yamOrStrikeActive   = false;
    yamOrStrikeAttempts = 0;
    suppressNextYumEarn = false;
    upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false;
    scores             = {};
    clearDice();
    renderScores();
    document.getElementById('powerupBar').style.display = 'none';
    document.getElementById('lobbyOverlay').style.display = 'flex';
    return;
  }
  _pupOrigConfirmNewGame();
};

// Patch syncDiceUI — also account for powerupMode (solo, free die cycling allowed)
const _pupOrigSyncDiceUI = syncDiceUI;
syncDiceUI = function() {
  _pupOrigSyncDiceUI();
  // In powerup mode: die label is fine to show (it's solo mode)
};

// ─── GAME-OVER HOOK ──────────────────────────────────────────────────────────
// Detect when all 13 categories are filled in powerup mode (solo game only)

let _pupGameOverPending = false;

const _pupOrigRenderScores = renderScores;
renderScores = function() {
  _pupOrigRenderScores();
  // Only trigger solo game-over — multiplayer handles it via listenRoom
  if (!powerupMode || _pupGameOverPending || mpMode || botMode) return;
  if (Object.keys(scores).length >= categories.length) {
    _pupGameOverPending = true;
    setTimeout(() => {
      if (!powerupMode || mpMode || botMode) return;
      const total   = calcTotal(scores);
      const players = [{ name: playerName, score: total, isMe: true }];
      // Keep powerupMode=true so rematch works; showGameOver handles display
      showGameOver(players);
      document.getElementById('powerupBar').style.display = 'none';
    }, 600);
  }
};

// Patch rematch — restart powerup mode fresh (solo only; MP uses doMpRematch)
const _pupOrigRematch = rematch;
rematch = function() {
  if (powerupMode && botMode) {
    // Bot + powerup rematch: reset powerup state, let bot rematch handle the rest.
    // The closeFirstRoll patch will reopen the picker.
    playerPowerups      = [];
    pendingPowerup      = null;
    doublePointsActive  = false;
    undoPowerupState    = null;
    freezeDieIndex      = -1;
    frozenDieValue      = 0;
    pendingFreezeIdx    = -1;
    pendingFreezeVal    = 0;
    yamOrStrikeActive   = false;
    yamOrStrikeAttempts = 0;
    suppressNextYumEarn = false;
    upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false;
    _pupGameOverPending = false;
    renderPowerupBar();
    _pupOrigRematch();
    return;
  }
  if (!powerupMode || mpMode) { _pupOrigRematch(); return; }
  document.getElementById('gameOverlay').classList.remove('open');
  // Full reset of powerup game state (keep mode active)
  playerPowerups     = [];
  pendingPowerup     = null;
  doublePointsActive = false;
  undoPowerupState   = null;
  freezeDieIndex     = -1;
  frozenDieValue     = 0;
  pendingFreezeIdx   = -1;
  pendingFreezeVal   = 0;
  upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false;
  _pupGameOverPending = false;
  scores             = {};
  clearDice();
  renderScores();
  renderPowerupBar();
  openPowerupPickerModal('start');
};

// Patch quitGame — cleanly exit powerup mode (solo only; MP quitGame calls leaveGame)
const _pupOrigQuitGame = quitGame;
quitGame = function() {
  if (powerupMode && botMode) {
    // Bot + powerup quit: clear powerup state, let bot's quitGame handle teardown.
    powerupMode         = false;
    _pupGameOverPending = false;
    playerPowerups      = [];
    pendingPowerup      = null;
    doublePointsActive  = false;
    undoPowerupState    = null;
    freezeDieIndex      = -1;
    frozenDieValue      = 0;
    pendingFreezeIdx    = -1;
    pendingFreezeVal    = 0;
    yamOrStrikeActive   = false;
    yamOrStrikeAttempts = 0;
    suppressNextYumEarn = false;
    upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false;
    document.getElementById('powerupBar').style.display = 'none';
    _pupOrigQuitGame();
    return;
  }
  if (!powerupMode || mpMode) { _pupOrigQuitGame(); return; }
  powerupMode         = false;
  _pupGameOverPending = false;
  playerPowerups      = [];
  pendingPowerup      = null;
  doublePointsActive  = false;
  undoPowerupState    = null;
  freezeDieIndex      = -1;
  frozenDieValue      = 0;
  pendingFreezeIdx    = -1;
  pendingFreezeVal    = 0;
  upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false;
  scores              = {};
  clearDice();
  renderScores();
  document.getElementById('gameOverlay').classList.remove('open');
  document.getElementById('powerupBar').style.display = 'none';
  document.getElementById('lobbyOverlay').style.display = 'flex';
};

// Patch closeFirstRoll — in MP/bot power-up mode, show power-up picker after first-roll
const _pupOrigCloseFirstRoll = closeFirstRoll;
closeFirstRoll = function() {
  _pupOrigCloseFirstRoll();
  if (powerupMode && (mpMode || botMode)) {
    // Show picker after the first-roll overlay finishes animating out (~900ms)
    setTimeout(() => openPowerupPickerModal('start'), 1100);
  }
};

// Patch doMpRematch — reset per-player power-up state and re-show picker
const _pupOrigDoMpRematch = doMpRematch;
doMpRematch = function() {
  if (powerupMode && mpMode) {
    playerPowerups     = [];
    pendingPowerup     = null;
    doublePointsActive = false;
    undoPowerupState   = null;
    freezeDieIndex     = -1;
    frozenDieValue     = 0;
    pendingFreezeIdx   = -1;
    pendingFreezeVal   = 0;
    upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false;
    _pupGameOverPending = false;
    renderPowerupBar();
    if (roomRef) roomRef.child('players/' + playerId + '/livePowerups').remove();
  }
  _pupOrigDoMpRematch();
};

// Patch leaveGame — clean up power-up state when leaving a MP game
const _pupOrigLeaveGame = leaveGame;
leaveGame = function() {
  if (powerupMode && mpMode) {
    powerupMode         = false;
    _pupGameOverPending = false;
    playerPowerups      = [];
    pendingPowerup      = null;
    doublePointsActive  = false;
    undoPowerupState    = null;
    freezeDieIndex      = -1;
    frozenDieValue      = 0;
    pendingFreezeIdx    = -1;
    pendingFreezeVal    = 0;
    yamOrStrikeActive   = false;
    yamOrStrikeAttempts = 0;
    suppressNextYumEarn = false;
    upperBonusPowerupAwarded = false; allButYumPowerupAwarded = false;
    document.getElementById('powerupBar').style.display = 'none';
  }
  _pupOrigLeaveGame();
};

// Patch rollDice — flush a pending freeze carry-over before rolling so the
// frozen die is locked into place even if the apply timer was skipped (MP
// turn-resume race) or if dice were overwritten by the bot's roll display.
// Also intercepts when Yam-or-Strike is active: only the 5th die is rerolled
// and the resolution check fires after the attempt.
const _pupOrigRollDicePending = rollDice;
rollDice = function() {
  if (powerupMode && yamOrStrikeActive) {
    if (typeof mpMode !== 'undefined' && mpMode && typeof currentTurnId !== 'undefined' && currentTurnId !== playerId) return;
    if (typeof botMode !== 'undefined' && botMode && typeof playerTurn !== 'undefined' && !playerTurn) return;
    if (yamOrStrikeAttempts >= 3) return;
    if (window.SFX && SFX.roll) { try { SFX.roll(); } catch(e){} }
    dice[4] = Math.floor(Math.random() * 6) + 1;
    rolled = true;
    yamOrStrikeAttempts++;
    rollsLeft = Math.max(0, rollsLeft - 1);
    renderDice(true);
    renderScores();
    const rc = document.getElementById('rollCount');
    if (rc) rc.textContent = `YAM OR STRIKE — ${3 - yamOrStrikeAttempts} chance${3 - yamOrStrikeAttempts === 1 ? '' : 's'} left`;
    if (typeof mpMode !== 'undefined' && mpMode && typeof roomRef !== 'undefined' && roomRef) {
      const _skinId = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
      let _pdc = null; try { _pdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch(e) {}
      roomRef.child('players/' + playerId + '/liveDice').set({
        dice: dice, held: held, roll: yamOrStrikeAttempts, skin: _skinId, perDieColors: _pdc, ts: Date.now()
      });
    }
    if (dice[4] === 1) {
      resolveYamOrStrike(true);
    } else if (yamOrStrikeAttempts >= 3) {
      resolveYamOrStrike(false);
    } else {
      showToast(`Rolled ${dice[4]} — need a 1!`);
    }
    return;
  }
  if (powerupMode && pendingFreezeIdx >= 0 && _isMyTurnNow()) {
    _applyPendingFreeze();
  }
  _pupOrigRollDicePending();
};

// Patch restoreMyDiceUI — apply a pending freeze when our MP turn resumes,
// since the apply timer may have skipped earlier while currentTurnId pointed
// at the opponent.
if (typeof restoreMyDiceUI === 'function') {
  const _pupOrigRestoreMyDiceUI = restoreMyDiceUI;
  restoreMyDiceUI = function() {
    _pupOrigRestoreMyDiceUI();
    if (powerupMode && pendingFreezeIdx >= 0) _applyPendingFreeze();
  };
}
