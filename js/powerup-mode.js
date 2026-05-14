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
  { id:'undoMove',    name:'Undo Move',     icon:'<i class="icn icn-refresh"></i>',
    desc:'Take back your last score choice',
    color:'#e94560', gradient:'linear-gradient(135deg,#e94560,#c0392b)' },
  { id:'chanceRoll',  name:'Chance Roll',   icon:'<i class="icn icn-volcano"></i>',
    desc:'Reroll ALL dice — next positive score doubles, no more rolls this turn',
    color:'#9b59b6', gradient:'linear-gradient(135deg,#9b59b6,#8e44ad)' },
  { id:'yamOrStrike', name:'Yam or Strike', icon:'<i class="icn icn-skull"></i>',
    desc:'First roll only: 4×1 + 2 rerolls on last dice — YAM or strike Yum!',
    color:'#e74c3c', gradient:'linear-gradient(135deg,#e74c3c,#c0392b)' },
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
let upperBonusPowerupAwarded = false; // upper-bonus reward fires once per game

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
  upperBonusPowerupAwarded = false;
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
  };
  const hint = pendingPowerup && hintMap[pendingPowerup]
    ? `<div class="pup-hint">${hintMap[pendingPowerup]}</div>`
    : '';

  bar.innerHTML = `
    <div class="pup-bar-head"><i class="icn icn-bolt"></i> POWER-UPS</div>
    ${dblBanner}
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
    renderPowerupBar();
    refreshDieFreezeVisual();
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

    case 'undoMove': {
      if (!undoPowerupState) { showToast('No recent score to undo!'); return; }
      consumePowerup('undoMove');
      const { catId } = undoPowerupState;
      const cat = (typeof categories !== 'undefined')
        ? categories.find(c => c.id === catId)
        : null;
      delete scores[catId];
      undoPowerupState = null;
      renderScores();
      renderPowerupBar();
      showToast(`↩️ ${cat ? cat.name : catId} score undone — slot is open again!`);
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
      el.classList.remove('die-spin', 'die-rolled-same');
      if (typeof el.getAnimations === 'function') {
        el.getAnimations().forEach(a => { try { a.cancel(); } catch(e){} });
      }
      void el.offsetWidth;
      el.classList.add('die-spin');
    }
    refreshDieFreezeVisual();
    renderPowerupBar();
    showToast(`Lucky reroll → ${dice[i]}`);
    syncPowerupsToDb();
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

// ─── YUM EARN CHECK ──────────────────────────────────────────────────────────

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

function checkPowerupUpperBonusEarn() {
  if (!powerupMode) return;
  if (upperBonusPowerupAwarded) return;
  const ids = (typeof UPPER_IDS !== 'undefined') ? UPPER_IDS : ['ones','twos','threes','fours','fives','sixes'];
  const target = (typeof BONUS_TARGET !== 'undefined') ? BONUS_TARGET : 63;
  const upperTotal = ids.reduce((s, id) => s + (Number(scores[id]) || 0), 0);
  if (upperTotal >= target) {
    upperBonusPowerupAwarded = true;
    setTimeout(() => openPowerupPickerModal('bonus'), 900);
  }
}

// ─── MONKEY-PATCHES ──────────────────────────────────────────────────────────

// Patch cycleDie — intercept die clicks for pending powerups
const _pupOrigCycleDie = cycleDie;
cycleDie = function(i) {
  if (tryPowerupDieClick(i)) return;
  _pupOrigCycleDie(i);
};

// Patch confirmScore — apply double points + track undo + check yum earn
const _pupOrigConfirmScore = confirmScore;
confirmScore = function() {
  if (!powerupMode) { _pupOrigConfirmScore(); return; }

  const catId      = activeModal;
  const baseScore  = selectedScore;
  const savedDice  = dice.slice();

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

  _pupOrigConfirmScore();

  // After scoring, reset freeze index (it was just used to carry a die,
  // the freeze is consumed when the die is re-seeded by clearDice patch)
  renderPowerupBar();

  // Check for YUM earn
  checkPowerupYumEarn(savedDice, baseScore);
  // Check for Upper Bonus earn (first time crossing 63 in upper section)
  checkPowerupUpperBonusEarn();
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
    upperBonusPowerupAwarded = false;
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
    upperBonusPowerupAwarded = false;
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
  upperBonusPowerupAwarded = false;
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
    upperBonusPowerupAwarded = false;
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
  upperBonusPowerupAwarded = false;
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
    upperBonusPowerupAwarded = false;
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
    upperBonusPowerupAwarded = false;
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
