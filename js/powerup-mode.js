// ─── POWER-UP MODE ──────────────────────────────────────────────────────────
// Separate fun mode with earnable/usable power-ups. Normal modes untouched.

const POWERUPS = [
  { id:'extraRoll',    name:'Extra Roll',    icon:'🎲',
    desc:'Get one bonus reroll this turn',
    color:'#4ecdc4', gradient:'linear-gradient(135deg,#4ecdc4,#2ecc71)' },
  { id:'freezeDie',   name:'Freeze Die',    icon:'❄️',
    desc:'Lock one die — carries to your next turn',
    color:'#64b5f6', gradient:'linear-gradient(135deg,#64b5f6,#1e88e5)' },
  { id:'doublePoints',name:'Double Points', icon:'✨',
    desc:'Double the score for your next category',
    color:'#f5a623', gradient:'linear-gradient(135deg,#f5a623,#f39c12)' },
  { id:'luckyDice',   name:'Lucky Dice',    icon:'🍀',
    desc:'Reroll one die — higher chance of 5 or 6',
    color:'#66bb6a', gradient:'linear-gradient(135deg,#66bb6a,#43a047)' },
  { id:'undoMove',    name:'Undo Move',     icon:'↩️',
    desc:'Take back your last score choice',
    color:'#e94560', gradient:'linear-gradient(135deg,#e94560,#c0392b)' },
];

let powerupMode    = false;
let playerPowerups = [];   // array of powerup ids in inventory
let pendingPowerup = null; // id of powerup waiting for a die click
let doublePointsActive = false;
let undoPowerupState   = null; // {catId} for undo
let freezeDieIndex = -1;
let frozenDieValue = 0;

// ─── START ──────────────────────────────────────────────────────────────────

function startPowerupMode() {
  const name = document.getElementById('playerName').value.trim();
  if (!name) { showLobbyErr('Enter your name first!'); return; }
  playerName = name;

  powerupMode        = true;
  playerPowerups     = [];
  pendingPowerup     = null;
  doublePointsActive = false;
  undoPowerupState   = null;
  freezeDieIndex     = -1;
  frozenDieValue     = 0;
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
  document.getElementById('powerupPickerTitle').textContent =
    context === 'start' ? '⚡ CHOOSE YOUR POWER-UP!' : '🎲 YUM! EARN A POWER-UP!';
  document.getElementById('powerupPickerSub').textContent =
    context === 'start'
      ? 'Pick one power-up to start your game with'
      : 'You rolled 5-of-a-kind! Pick a power-up to add to your arsenal';

  document.getElementById('powerupPickerGrid').innerHTML = POWERUPS.map(p => `
    <button class="pup-pick-btn" onclick="selectPowerup('${p.id}','${context}')"
            style="--pup-col:${p.color}">
      <div class="pup-pick-icon">${p.icon}</div>
      <div class="pup-pick-info">
        <div class="pup-pick-name">${p.name}</div>
        <div class="pup-pick-desc">${p.desc}</div>
      </div>
    </button>`).join('');

  document.getElementById('powerupPickerModal').classList.add('open');
}

function selectPowerup(id, context) {
  playerPowerups.push(id);
  document.getElementById('powerupPickerModal').classList.remove('open');
  const p = POWERUPS.find(x => x.id === id);
  showToast(`${p.icon} ${p.name} added!`);
  renderPowerupBar();

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
    ? `<div class="pup-dbl-banner">✨ DOUBLE POINTS ACTIVE — score any category to double it!</div>`
    : '';

  // Pending action hint
  const hintMap = {
    freezeDie: '❄️ Click a die to freeze it',
    luckyDice: '🍀 Click a die to reroll with luck',
  };
  const hint = pendingPowerup && hintMap[pendingPowerup]
    ? `<div class="pup-hint">${hintMap[pendingPowerup]}</div>`
    : '';

  bar.innerHTML = `
    <div class="pup-bar-head">⚡ POWER-UPS</div>
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
    return;
  }

  switch (id) {

    case 'extraRoll': {
      consumePowerup('extraRoll');
      rollsLeft++;
      const used = Math.max(0, 3 - rollsLeft + 1);
      document.getElementById('rollCount').textContent = `Rolls: ${3 - rollsLeft} / 3  ⚡+1`;
      showToast('🎲 Extra Roll granted — you have one more roll!');
      renderPowerupBar();
      break;
    }

    case 'freezeDie': {
      if (!rolled) { showToast('Roll your dice first!'); return; }
      pendingPowerup = 'freezeDie';
      renderPowerupBar();
      refreshDieFreezeVisual();
      break;
    }

    case 'doublePoints': {
      consumePowerup('doublePoints');
      doublePointsActive = true;
      renderPowerupBar();
      showToast('✨ Double Points active! Score any category to double it.');
      break;
    }

    case 'luckyDice': {
      if (!rolled) { showToast('Roll your dice first!'); return; }
      pendingPowerup = 'luckyDice';
      renderPowerupBar();
      refreshDieFreezeVisual();
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
      break;
    }
  }
}

function consumePowerup(id) {
  const idx = playerPowerups.indexOf(id);
  if (idx >= 0) playerPowerups.splice(idx, 1);
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
    showToast(`❄️ Die frozen (${['⚀','⚁','⚂','⚃','⚄','⚅'][dice[i]-1]}) — carries to next turn!`);
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
    // Spin just this one die
    const el = document.getElementById('diceRow').querySelector(`[data-i="${i}"]`);
    if (el) { el.classList.remove('die-spin'); void el.offsetWidth; el.classList.add('die-spin'); }
    refreshDieFreezeVisual();
    renderPowerupBar();
    showToast(`🍀 Lucky reroll → ${['⚀','⚁','⚂','⚃','⚄','⚅'][dice[i]-1]}`);
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
  // 5-of-a-kind earns a power-up
  const isYum = savedDice.every(v => v > 0) && savedDice.every(v => v === savedDice[0]);
  if (isYum) {
    setTimeout(() => openPowerupPickerModal('earn'), 900);
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

  // Apply double points modifier
  if (doublePointsActive && baseScore > 0) {
    selectedScore      = baseScore * 2;
    doublePointsActive = false;
    showToast(`✨ Double Points! ${baseScore} → ${selectedScore} pts`);
  } else if (doublePointsActive && baseScore === 0) {
    doublePointsActive = false; // used up, nothing to double on 0
  }

  // Track undo target
  undoPowerupState = { catId };

  _pupOrigConfirmScore();

  // After scoring, reset freeze index (it was just used to carry a die,
  // the freeze is consumed when the die is re-seeded by clearDice patch)
  renderPowerupBar();

  // Check for YUM earn
  checkPowerupYumEarn(savedDice, baseScore);
};

// Patch clearDice — carry frozen die to next turn
const _pupOrigClearDice = clearDice;
clearDice = function() {
  const savedIdx = freezeDieIndex;
  const savedVal = frozenDieValue;

  _pupOrigClearDice();

  if (!powerupMode || savedIdx < 0) return;

  // After clearDice sets everything to 0, restore the frozen die
  setTimeout(() => {
    if (!powerupMode) return;
    dice[savedIdx] = savedVal;
    held[savedIdx] = true;
    rolled         = true;
    renderDice(false);
    refreshDieFreezeVisual();
    freezeDieIndex = -1;
    frozenDieValue = 0;
    showToast(`❄️ Frozen die (${['⚀','⚁','⚂','⚃','⚄','⚅'][savedVal-1]}) carried to new turn!`);
  }, 150);
};

// Patch renderDice — keep freeze visual in sync
const _pupOrigRenderDice = renderDice;
renderDice = function(justRolled) {
  _pupOrigRenderDice(justRolled);
  if (powerupMode) refreshDieFreezeVisual();
};

// Patch confirmNewGame — reset powerup state when returning to lobby
const _pupOrigConfirmNewGame = confirmNewGame;
confirmNewGame = function() {
  if (powerupMode) {
    // In powerup mode it's solo — just return to lobby
    powerupMode        = false;
    playerPowerups     = [];
    pendingPowerup     = null;
    doublePointsActive = false;
    undoPowerupState   = null;
    freezeDieIndex     = -1;
    frozenDieValue     = 0;
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
// Detect when all 13 categories are filled in powerup mode (solo game)

let _pupGameOverPending = false;

const _pupOrigRenderScores = renderScores;
renderScores = function() {
  _pupOrigRenderScores();
  if (!powerupMode || _pupGameOverPending) return;
  if (Object.keys(scores).length >= categories.length) {
    _pupGameOverPending = true;
    setTimeout(() => {
      if (!powerupMode) return;
      const total   = calcTotal(scores);
      const players = [{ name: playerName, score: total, isMe: true }];
      // Keep powerupMode=true so rematch works; showGameOver handles display
      showGameOver(players);
      document.getElementById('powerupBar').style.display = 'none';
    }, 600);
  }
};

// Patch rematch — restart powerup mode fresh
const _pupOrigRematch = rematch;
rematch = function() {
  if (!powerupMode) { _pupOrigRematch(); return; }
  document.getElementById('gameOverlay').classList.remove('open');
  // Full reset of powerup game state (keep mode active)
  playerPowerups     = [];
  pendingPowerup     = null;
  doublePointsActive = false;
  undoPowerupState   = null;
  freezeDieIndex     = -1;
  frozenDieValue     = 0;
  _pupGameOverPending = false;
  scores             = {};
  clearDice();
  renderScores();
  renderPowerupBar();
  openPowerupPickerModal('start');
};

// Patch quitGame — cleanly exit powerup mode
const _pupOrigQuitGame = quitGame;
quitGame = function() {
  if (!powerupMode) { _pupOrigQuitGame(); return; }
  powerupMode         = false;
  _pupGameOverPending = false;
  playerPowerups      = [];
  pendingPowerup      = null;
  doublePointsActive  = false;
  undoPowerupState    = null;
  freezeDieIndex      = -1;
  frozenDieValue      = 0;
  scores              = {};
  clearDice();
  renderScores();
  document.getElementById('gameOverlay').classList.remove('open');
  document.getElementById('powerupBar').style.display = 'none';
  document.getElementById('lobbyOverlay').style.display = 'flex';
};
