// ─── SOUND EFFECTS ──────────────────────────────────────────────────
let soundEnabled = localStorage.getItem('yumSound') !== 'off';
let _audioCtx = null;

function _ctx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('yumSound', soundEnabled ? 'on' : 'off');
  const btn = document.getElementById('soundToggle');
  btn.textContent = soundEnabled ? '🔊' : '🔇';
  btn.classList.toggle('muted', !soundEnabled);
}

function _playTone(freq, type, startVol, endVol, startTime, duration, ctx) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(startVol, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(endVol, 0.0001), startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

const SFX = {
  roll() {
    if (!soundEnabled) return;
    const ctx = _ctx();
    const now = ctx.currentTime;
    // Multiple short noise bursts to simulate dice clattering
    const count = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < count; i++) {
      const t = now + i * 0.055;
      const freq = 180 + Math.random() * 120;
      _playTone(freq, 'sawtooth', 0.18, 0.001, t, 0.06, ctx);
      _playTone(freq * 1.5, 'square', 0.08, 0.001, t, 0.05, ctx);
    }
  },

  hold() {
    if (!soundEnabled) return;
    const ctx = _ctx();
    const now = ctx.currentTime;
    _playTone(660, 'sine', 0.12, 0.001, now, 0.07, ctx);
    _playTone(880, 'sine', 0.06, 0.001, now + 0.04, 0.06, ctx);
  },

  unhold() {
    if (!soundEnabled) return;
    const ctx = _ctx();
    const now = ctx.currentTime;
    _playTone(880, 'sine', 0.10, 0.001, now, 0.05, ctx);
    _playTone(660, 'sine', 0.07, 0.001, now + 0.03, 0.06, ctx);
  },

  score() {
    if (!soundEnabled) return;
    const ctx = _ctx();
    const now = ctx.currentTime;
    _playTone(523, 'sine', 0.15, 0.001, now,       0.12, ctx);
    _playTone(659, 'sine', 0.15, 0.001, now + 0.10, 0.12, ctx);
    _playTone(784, 'sine', 0.18, 0.001, now + 0.20, 0.18, ctx);
  },

  yum() {
    if (!soundEnabled) return;
    const ctx = _ctx();
    const now = ctx.currentTime;
    // Triumphant ascending fanfare
    const notes = [523, 659, 784, 1047, 1047];
    const delays = [0, 0.10, 0.20, 0.32, 0.42];
    const durs   = [0.12, 0.12, 0.12, 0.20, 0.35];
    notes.forEach((f, i) => {
      _playTone(f,     'sine',     0.20, 0.001, now + delays[i], durs[i], ctx);
      _playTone(f * 2, 'sine',     0.07, 0.001, now + delays[i], durs[i], ctx);
      _playTone(f * 0.5, 'triangle', 0.05, 0.001, now + delays[i], durs[i], ctx);
    });
  },

  win() {
    if (!soundEnabled) return;
    const ctx = _ctx();
    const now = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 784, 1047];
    const delays = [0, 0.12, 0.24, 0.36, 0.50, 0.62];
    notes.forEach((f, i) => {
      _playTone(f,     'sine',     0.18, 0.001, now + delays[i], 0.18, ctx);
      _playTone(f * 2, 'sine',     0.06, 0.001, now + delays[i], 0.18, ctx);
    });
  },

  lose() {
    if (!soundEnabled) return;
    const ctx = _ctx();
    const now = ctx.currentTime;
    _playTone(392, 'sine', 0.14, 0.001, now,        0.22, ctx);
    _playTone(349, 'sine', 0.14, 0.001, now + 0.20, 0.22, ctx);
    _playTone(294, 'sine', 0.16, 0.001, now + 0.40, 0.40, ctx);
  },

  scratch() {
    if (!soundEnabled) return;
    const ctx = _ctx();
    const now = ctx.currentTime;
    _playTone(220, 'sawtooth', 0.10, 0.001, now,        0.10, ctx);
    _playTone(180, 'sawtooth', 0.10, 0.001, now + 0.09, 0.12, ctx);
  }
};

// Init button state on load
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('soundToggle');
  if (!soundEnabled) { btn.textContent = '🔇'; btn.classList.add('muted'); }
});

const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

const categories = [
  // Upper
  { id:'ones',  name:'Ones',   icon:'d1', hint:'Sum of all 1s (max 5)', max:5,  section:'upper', calc: d=>d.filter(x=>x===1).reduce((a,b)=>a+b,0) },
  { id:'twos',  name:'Twos',   icon:'d2', hint:'Sum of all 2s (max 10)', max:10, section:'upper', calc: d=>d.filter(x=>x===2).reduce((a,b)=>a+b,0) },
  { id:'threes',name:'Threes', icon:'d3', hint:'Sum of all 3s (max 15)', max:15, section:'upper', calc: d=>d.filter(x=>x===3).reduce((a,b)=>a+b,0) },
  { id:'fours', name:'Fours',  icon:'d4', hint:'Sum of all 4s (max 20)', max:20, section:'upper', calc: d=>d.filter(x=>x===4).reduce((a,b)=>a+b,0) },
  { id:'fives', name:'Fives',  icon:'d5', hint:'Sum of all 5s (max 25)', max:25, section:'upper', calc: d=>d.filter(x=>x===5).reduce((a,b)=>a+b,0) },
  { id:'sixes', name:'Sixes',  icon:'d6', hint:'Sum of all 6s (max 30)', max:30, section:'upper', calc: d=>d.filter(x=>x===6).reduce((a,b)=>a+b,0) },
  // Lower
  { id:'threeKind', name:'3 of a Kind', icon:'🎯', hint:'≥3 same → sum all dice (max 30)', max:30, section:'lower', calc: d=>{const c=counts(d);return Object.values(c).some(v=>v>=3)?d.reduce((a,b)=>a+b,0):0} },
  { id:'fourKind',  name:'4 of a Kind', icon:'🔥', hint:'≥4 same → sum all dice (max 30)', max:30, section:'lower', calc: d=>{const c=counts(d);return Object.values(c).some(v=>v>=4)?d.reduce((a,b)=>a+b,0):0} },
  { id:'fullHouse', name:'Full House',  icon:'🏠', hint:'3+2 of a kind → 25 pts', max:25, section:'lower', calc: d=>{const v=Object.values(counts(d)).sort();return(v[0]===2&&v[1]===3)||v[0]===5?25:0} },
  { id:'smStraight',name:'Sm. Straight',icon:'📏', hint:'4 sequential → 30 pts', max:30, section:'lower', calc: d=>{const u=[...new Set(d)].sort((a,b)=>a-b);const s=u.join('');return['1234','2345','3456'].some(p=>s.includes(p))?30:0} },
  { id:'lgStraight',name:'Lg. Straight',icon:'📐', hint:'5 sequential → 40 pts', max:40, section:'lower', calc: d=>{const u=[...new Set(d)].sort((a,b)=>a-b);return(u.length===5&&u[4]-u[0]===4)?40:0} },
  { id:'yum',       name:'YUM!',        icon:'🎲', hint:'5 of a kind → 50 pts', max:50, section:'lower', calc: d=>{return Object.values(counts(d)).some(v=>v===5)?50:0} },
  { id:'chance',    name:'Chance',      icon:'🎰', hint:'Any roll → sum all dice (max 30)', max:30, section:'lower', calc: d=>d.reduce((a,b)=>a+b,0) },
];

const UPPER_IDS = ['ones','twos','threes','fours','fives','sixes'];
const BONUS_TARGET = 63;
const BONUS_POINTS = 35;

let scores = {};
let dice = [0,0,0,0,0];
let held = [false,false,false,false,false];
let rolled = false;
let rollsLeft = 3;
let activeModal = null;
let selectedScore = null;

function counts(d) {
  const c={};
  d.forEach(v=>c[v]=(c[v]||0)+1);
  return c;
}

function cycleDie(i) {
  // In multiplayer or vs bot, tapping die toggles hold
  if(mpMode || botMode) {
    toggleHold(i);
    return;
  }
  dice[i] = dice[i] === 0 ? 1 : (dice[i] % 6) + 1;
  rolled = dice.some(v => v > 0);
  renderDice();
  renderScores();
}

function rollDice() {
  if(mpMode && currentTurnId !== playerId) { showToast("It's not your turn!"); return; }
  if(botMode && !playerTurn) { showToast('Wait for the bot! 🤖'); return; }
  if(rollsLeft <= 0) return;
  SFX.roll();
  dice = dice.map((v,i) => held[i] ? v : Math.floor(Math.random()*6)+1);
  rolled = true;
  rollsLeft--;
  renderDice(true);
  renderScores();
  document.getElementById('rollCount').textContent = `Rolls: ${3-rollsLeft} / 3`;
  // Sync dice to Firebase for opponents to see
  if(mpMode && roomRef) {
    const _skinId = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
    roomRef.child('players/' + playerId + '/liveDice').set({
      dice: dice, held: held, roll: 3 - rollsLeft, skin: _skinId, ts: Date.now()
    });
  }
}

function clearDice() {
  dice = [0,0,0,0,0];
  held = [false,false,false,false,false];
  rolled = false;
  rollsLeft = 3;
  renderDice();
  renderScores();
  document.getElementById('rollCount').textContent = 'Rolls: 0 / 3';
}

function toggleHold(i) {
  if(mpMode && currentTurnId !== playerId) { showToast("It's not your turn!"); return; }
  if(botMode && !playerTurn) { showToast('Wait for the bot! 🤖'); return; }
  if(dice[i] === 0) return;
  held[i] = !held[i];
  held[i] ? SFX.hold() : SFX.unhold();
  renderDice();
  // Sync hold state so opponents see which dice are locked
  if(mpMode && roomRef) {
    const _skinId = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
    roomRef.child('players/' + playerId + '/liveDice').set({
      dice: dice, held: held, roll: 3 - rollsLeft, skin: _skinId, ts: Date.now()
    });
  }
}

let lastRolledMask = 0b11111; // track which dice were just rolled (all by default)

function renderDice(justRolled) {
  const row = document.getElementById('diceRow');
  dice.forEach((v,i) => {
    const el = row.querySelector(`[data-i="${i}"]`);
    const face = v > 0 ? (typeof window.getDieFace === 'function' ? window.getDieFace(i, v) : DICE_FACES[v-1]) : '–';
    // Always animate if this die was part of a roll (justRolled flag)
    // OR if the face changed (e.g. manual cycle)
    const wasRolled = justRolled && !held[i];
    const faceChanged = el.textContent !== face;
    if(wasRolled || faceChanged) {
      el.classList.remove('die-spin');
      void el.offsetWidth; // force reflow
      el.classList.add('die-spin');
    }
    el.textContent = face;
    if (typeof window.applyDieSkinAttr === 'function') window.applyDieSkinAttr(el, i);
    el.classList.toggle('held', held[i]);
    const hBtn = row.querySelector(`[data-hold="${i}"]`);
    if(hBtn) hBtn.classList.toggle('held-active', held[i]);
  });
}

function getSuggestedScore(cat) {
  if(!dice.every(v => v > 0)) return null;
  return cat.calc(dice);
}

function diceBonusNeeded(id) {
  const faceMap = { ones:1, twos:2, threes:3, fours:4, fives:5, sixes:6 };
  const face = faceMap[id];
  const total = UPPER_IDS.reduce((s, i) => s + (scores[i] || 0), 0);
  if (total >= BONUS_TARGET) return null;
  if (scores[id] !== undefined) return null;
  const otherMax = UPPER_IDS.reduce((s, i) => {
    if (i === id || scores[i] !== undefined) return s;
    return s + faceMap[i] * 5;
  }, 0);
  const needed = BONUS_TARGET - total - otherMax;
  if (needed <= 0) return { count: 0, face };
  return { count: Math.min(5, Math.ceil(needed / face)), face };
}

function renderScores() {
  const sec = document.getElementById('scoreSection');
  let html = '';

  // Upper section
  html += `<div class="score-card">`;
  html += `<div style="padding:10px 14px 6px;"><div class="section-title">UPPER SECTION</div></div>`;
  UPPER_IDS.forEach(id => {
    const cat = categories.find(c=>c.id===id);
    const val = scores[id];
    const filled = val !== undefined;
    const suggested = !filled && dice.every(v=>v>0) ? cat.calc(dice) : null;
    const pct = filled ? Math.round((val/cat.max)*100) : (suggested !== null ? Math.round((suggested/cat.max)*100) : null);
    const pctColor = pct >= 75 ? '#4ecdc4' : pct >= 40 ? '#f5a623' : '#e94560';
    const bonusInfo = diceBonusNeeded(id);
    const bonusBadge = bonusInfo !== null && bonusInfo.count > 0
      ? `<div class="dice-bonus-need ${bonusInfo.count >= 5 ? 'danger' : bonusInfo.count >= 4 ? 'warning' : ''}">${bonusInfo.count}×${bonusInfo.face}</div>`
      : '';
    html += `<div class="score-row ${filled?'filled':''} ${filled&&val===0?'scratched':''} ${suggested!==null&&!filled?'suggested':''}" onclick="openModal('${id}')">
      <div class="score-icon">${renderIcon(cat.icon)}</div>
      <div class="score-info">
        <div class="score-name">${cat.name}</div>
        <div class="score-hint">${cat.hint}</div>
        ${pct!==null?`<div class="pct-bar-wrap"><div class="pct-bar" style="width:${pct}%;background:${pctColor}"></div></div>`:''}
      </div>
      ${pct!==null?`<div class="score-pct" style="color:${pctColor}">${pct}%</div>`:'<div class="score-pct">–</div>'}
      ${bonusBadge}
      <div class="score-value ${filled||suggested!==null?'':'empty'}">${filled?val:(suggested!==null?`<span style="color:var(--green);font-size:1.1rem">${suggested}?</span>`:'–')}</div>
    </div>`;
  });
  html += `</div>`;

  // Bonus
  const upperTotal = UPPER_IDS.reduce((s,id)=>s+(scores[id]||0),0);
  const bonusEarned = upperTotal >= BONUS_TARGET;
  const bonusProgress = Math.min(upperTotal, BONUS_TARGET);
  html += `<div class="bonus-row">
    <div>
      <div class="bonus-label">🎁 UPPER BONUS</div>
      <div class="bonus-sub">${upperTotal}/${BONUS_TARGET} pts → +35 bonus${bonusEarned?' ✓':''}</div>
      <div class="pct-bar-wrap" style="width:180px;margin-top:5px">
        <div class="pct-bar" style="width:${(bonusProgress/BONUS_TARGET)*100}%"></div>
      </div>
    </div>
    <div class="bonus-val" style="${bonusEarned?'color:var(--gold)':'color:var(--muted)'}">${bonusEarned?'+35':'–'}</div>
  </div>`;

  // Lower section
  const lowerIds = categories.filter(c=>c.section==='lower').map(c=>c.id);
  html += `<div class="score-card">`;
  html += `<div style="padding:10px 14px 6px;"><div class="section-title">LOWER SECTION</div></div>`;
  lowerIds.forEach(id => {
    const cat = categories.find(c=>c.id===id);
    const val = scores[id];
    const filled = val !== undefined;
    const suggested = !filled && dice.every(v=>v>0) ? cat.calc(dice) : null;
    const pct = filled ? Math.round((val/cat.max)*100) : (suggested !== null ? Math.round((suggested/cat.max)*100) : null);
    const pctColor = pct >= 75 ? '#4ecdc4' : pct >= 40 ? '#f5a623' : '#e94560';
    html += `<div class="score-row ${filled?'filled':''} ${filled&&val===0?'scratched':''} ${suggested!==null&&!filled?'suggested':''}" onclick="openModal('${id}')">
      <div class="score-icon">${renderIcon(cat.icon)}</div>
      <div class="score-info">
        <div class="score-name">${cat.name}</div>
        <div class="score-hint">${cat.hint}</div>
        ${pct!==null?`<div class="pct-bar-wrap"><div class="pct-bar" style="width:${pct}%;background:${pctColor}"></div></div>`:''}
      </div>
      ${pct!==null?`<div class="score-pct" style="color:${pctColor}">${pct}%</div>`:'<div class="score-pct">–</div>'}
      <div class="score-value ${filled||suggested!==null?'':'empty'}">${filled?val:(suggested!==null?`<span style="color:var(--green);font-size:1.1rem">${suggested}?</span>`:'–')}</div>
    </div>`;
  });
  html += `</div>`;

  sec.innerHTML = html;
  updateTotals(upperTotal, bonusEarned);
  if(botMode) renderBotLeaderboard();
}

function updateTotals(upperTotal, bonusEarned) {
  const lowerTotal = categories.filter(c=>c.section==='lower').reduce((s,c)=>s+(scores[c.id]||0),0);
  const grand = upperTotal + lowerTotal + (bonusEarned ? BONUS_POINTS : 0);
  const filled = Object.keys(scores).length;
  const total = categories.length;
  const pct = Math.round((filled/total)*100);

  document.getElementById('grandTotal').textContent = grand;
  document.getElementById('totalSub').textContent = `${filled} of ${total} filled`;
  document.getElementById('globalProgress').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = `${pct}% Complete · ${grand} pts`;
}

function openModal(id) {
  // Block if not player's turn
  if(botMode && !playerTurn) { showToast('Wait for the bot! 🤖'); return; }
  if(mpMode && currentTurnId !== playerId) { showToast("It's not your turn!"); return; }
  // In multiplayer/bot modes, can't re-score already filled categories
  if((mpMode || botMode) && scores[id] !== undefined) { showToast('Already scored!'); return; }
  activeModal = id;
  const cat = categories.find(c=>c.id===id);
  const val = scores[id];
  document.getElementById('modalTitle').textContent = `${cat.icon} ${cat.name}`;
  document.getElementById('modalHint').textContent = cat.hint;
  // Only allow delete in practice mode
  document.getElementById('deleteBtn').style.display = (!mpMode && !botMode && val !== undefined) ? 'block' : 'none';

  const qs = document.getElementById('quickScores');
  let btns = '';

  const allSet = dice.every(v => v > 0);

  if(allSet) {
    const rolled_score = cat.calc(dice);
    const pct = Math.round((rolled_score / cat.max) * 100);
    const diceIcons = dice.map(v => ['⚀','⚁','⚂','⚃','⚄','⚅'][v-1]).join(' ');

    if(rolled_score > 0) {
      // Show score option only if dice actually score points
      btns += `
        <div style="width:100%;margin-bottom:8px">
          <button class="quick-btn ${val===rolled_score?'active':''}"
            onclick="selectScore(${rolled_score})"
            style="width:100%;text-align:left;padding:14px 16px;font-size:1rem;border-radius:12px;
                   background:rgba(78,205,196,0.12);border-color:rgba(78,205,196,0.4)">
            <div style="font-size:1.1rem;margin-bottom:4px">${diceIcons}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="color:var(--green)">Score ${rolled_score} pts</span>
              <span style="font-size:0.75rem;color:var(--muted)">${pct}% of max</span>
            </div>
          </button>
        </div>`;
      selectedScore = val !== undefined ? val : rolled_score;
    } else {
      // No points scored — only show strike, auto-select it
      selectedScore = 0;
    }

    // Strike option — always shown
    const strikeLabel = rolled_score === 0
      ? '✕ Strike — no matching dice (0 pts)'
      : '✕ Strike (0 pts)';
    btns += `
      <div style="width:100%">
        <button class="quick-btn ${(val===0||rolled_score===0)?'active':''}"
          onclick="selectScore(0)"
          style="width:100%;text-align:left;padding:12px 16px;border-radius:12px;
                 background:rgba(233,69,96,0.08);border-color:rgba(233,69,96,0.3)">
          <span style="color:var(--accent)">${strikeLabel}</span>
          <span style="font-size:0.72rem;color:var(--muted);display:block;margin-top:2px">
            Scratch this category — can't use it again
          </span>
        </button>
      </div>`;
  } else {
    // Dice not fully set — only show strike option
    btns += `
      <div style="color:var(--muted);font-size:0.85rem;margin-bottom:12px;text-align:center">
        🎲 Roll your dice first to see your score
      </div>
      <div style="width:100%">
        <button class="quick-btn ${val===0?'active':''}"
          onclick="selectScore(0)"
          style="width:100%;text-align:left;padding:12px 16px;border-radius:12px;
                 background:rgba(233,69,96,0.08);border-color:rgba(233,69,96,0.3)">
          <span style="color:var(--accent)">✕ Strike (0 pts)</span>
          <span style="font-size:0.72rem;color:var(--muted);display:block;margin-top:2px">
            Scratch this category — can't use it again
          </span>
        </button>
      </div>`;
    selectedScore = 0; // only option is strike, pre-select it
  }

  qs.innerHTML = btns;

  const backdrop = document.getElementById('modalBackdrop');
  backdrop.classList.add('open');
}

function selectScore(v) {
  selectedScore = v;
  document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

function confirmScore() {
  if(selectedScore === null || selectedScore === undefined) { closeModalEl(); return; }
  scores[activeModal] = selectedScore;
  if(activeModal === 'yum' && selectedScore === 50) SFX.yum();
  else if(selectedScore === 0) SFX.scratch();
  else SFX.score();
  clearDice();
  closeModalEl();
  renderScores();
  // Scroll back to top
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 150);
}

function deleteScore() {
  delete scores[activeModal];
  closeModalEl();
  renderScores();
}

function closeModal(e) {
  if(e.target === document.getElementById('modalBackdrop')) closeModalEl();
}

function closeModalEl() {
  document.getElementById('modalBackdrop').classList.remove('open');
  selectedScore = null;
}

function confirmNewGame() {
  if(mpMode) {
    showConfirm('Are you sure you want to leave the game?', 'Yes, leave', leaveGame);
    return;
  }
  if(botMode) {
    showConfirm('Are you sure you want to quit the game?', 'Yes, quit', quitGame);
    return;
  }
  // Practice mode — go back to lobby
  scores = {};
  clearDice();
  renderScores();
  document.getElementById('lobbyOverlay').style.display = 'flex';
}


// ─── PREDICTION ENGINE ──────────────────────────────────────────────
function randDie() { return Math.floor(Math.random()*6)+1; }

function greedyHoldForCat(d, catId) {
  const c = {};
  d.forEach(v => c[v]=(c[v]||0)+1);
  const sorted = Object.entries(c).sort((a,b)=>b[1]-a[1]);

  if(catId==='ones')   return d.map(v=>v===1);
  if(catId==='twos')   return d.map(v=>v===2);
  if(catId==='threes') return d.map(v=>v===3);
  if(catId==='fours')  return d.map(v=>v===4);
  if(catId==='fives')  return d.map(v=>v===5);
  if(catId==='sixes')  return d.map(v=>v===6);

  // YUM: always hold all dice matching the most common value
  if(catId==='yum') {
    const topVal = sorted[0][0];
    return d.map(v=>String(v)===topVal);
  }
  // 4-of-a-kind: hold most common value
  if(catId==='fourKind') return d.map(v=>String(v)===sorted[0][0]);
  // 3-of-a-kind: hold most common value
  if(catId==='threeKind') return d.map(v=>String(v)===sorted[0][0]);

  if(catId==='fullHouse') {
    // Hold top 2 distinct values
    const keep = new Set(sorted.slice(0,2).map(e=>Number(e[0])));
    return d.map(v=>keep.has(v));
  }
  if(catId==='smStraight'||catId==='lgStraight') {
    // Hold the longest sequential run of unique values
    const uniq=[...new Set(d)].sort((a,b)=>a-b);
    let best=[],cur=[uniq[0]];
    for(let i=1;i<uniq.length;i++){
      if(uniq[i]===uniq[i-1]+1) cur.push(uniq[i]);
      else { if(cur.length>best.length)best=cur; cur=[uniq[i]]; }
    }
    if(cur.length>best.length)best=cur;
    const keepSet=new Set(best);
    const held=d.map(()=>false); const used={};
    d.forEach((v,i)=>{ if(keepSet.has(v)&&!used[v]){held[i]=true;used[v]=true;} });
    return held;
  }
  if(catId==='chance') return d.map(v=>v>=5); // hold 5s and 6s
  return d.map(()=>false);
}

// Simulate expected score for a category given held dice and N remaining rolls
function simulateCatExpected(initHeld, cat, remainRolls, N) {
  let total=0;
  for(let i=0;i<N;i++){
    let d = initHeld.map(v => v===0 ? randDie() : v);
    for(let r=1; r<remainRolls; r++){
      const h = greedyHoldForCat(d, cat.id);
      d = d.map((v,j) => h[j] ? v : randDie());
    }
    total += cat.calc(d);
  }
  return total/N;
}

// Find best hold mask for a category
function bestHoldForCat(cat, remainRolls, N) {
  let best = { mask:31, initHeld:dice.slice(), exp:0, pct:0 };
  for(let mask=0;mask<32;mask++){
    const initHeld = dice.map((v,i)=>((mask>>i)&1)?v:0);
    const exp = simulateCatExpected(initHeld, cat, remainRolls, N);
    const pct = Math.round((exp/cat.max)*100);
    if(exp > best.exp) best = { mask, initHeld, exp, pct };
  }
  return best;
}

function diceLabel(d) {
  return d.filter(v=>v>0).map(v=>['⚀','⚁','⚂','⚃','⚄','⚅'][v-1]).join(' ');
}

function holdDesc(initHeld) {
  const kept = initHeld.filter(v=>v>0);
  const reroll = initHeld.filter(v=>v===0).length;
  if(kept.length===0) return 'Re-roll all 5 dice';
  if(kept.length===5) return 'Keep all — score now!';
  return `Keep ${diceLabel(initHeld)} · re-roll ${reroll}`;
}

function runPrediction() {
  if(!dice.every(v=>v>0)) return;
  const panel = document.getElementById('predPanel');
  const cont  = document.getElementById('predContent');
  panel.style.display='block';
  cont.innerHTML='<div class="pred-spinner">⏳ Simulating… hang tight</div>';
  panel.scrollIntoView({behavior:'smooth', block:'nearest'});

  setTimeout(()=>{
    const unfilledCats = categories.filter(c=>scores[c.id]===undefined);
    if(unfilledCats.length===0){
      cont.innerHTML='<div class="pred-spinner">🎉 All categories filled!</div>';
      return;
    }

    // Determine rolls left — default 2 if manually set, else use rollsLeft
    const remRolls = (rollsLeft < 3) ? rollsLeft : 2;
    const N = 600; // simulations per option

    // Find best hold per category
    const catResults = unfilledCats.map(cat => {
      const best = bestHoldForCat(cat, remRolls, N);
      return { cat, ...best };
    });

    // Sort all categories by expected %
    catResults.sort((a,b)=>(b.exp/b.cat.max)-(a.exp/a.cat.max));

    // Always ensure YUM is shown even if not in top
    const hasYumInResults = catResults.every(r => r.cat.id !== 'yum') === false;
    const yumResult = catResults.find(r=>r.cat.id==='yum');

    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];

    let html = `<div style="font-size:0.72rem;color:var(--muted);margin-bottom:8px;padding:0 2px">
      Based on ${N} simulations · ${remRolls} roll${remRolls!==1?'s':''} remaining · unfilled only</div>`;

    // ── YUM spotlight always at top ──────────────────────────────
    if(yumResult) {
      const yumRank = catResults.indexOf(yumResult)+1;
      const yr = yumResult;
      const yPct = yr.pct;
      const yColor = yPct>=70?'#4ecdc4':yPct>=35?'#f5a623':'#e94560';
      html += `<div style="background:rgba(124,58,237,0.12);border:1px solid rgba(168,85,247,0.4);
        border-radius:12px;padding:12px 14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-weight:800;font-size:1rem;color:#c084fc">🎲 YUM! Chance</div>
          <div style="font-family:'Bebas Neue',cursive;font-size:1.6rem;color:${yColor}">${yPct}%</div>
        </div>
        <div style="font-size:0.8rem;color:var(--gold);margin-bottom:6px;font-weight:700">🎯 ${holdDesc(yr.initHeld)}</div>
        <div style="height:10px;background:rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;width:${Math.min(yPct,100)}%;border-radius:20px;
            background:linear-gradient(90deg,#7c3aed,#a855f7);transition:width 0.6s"></div>
        </div>
        <div style="font-size:0.75rem;color:var(--muted)">
          Expected ~${yr.exp.toFixed(1)} pts of 50 max · Ranked #${yumRank} overall</div>
      </div>`;
    }

    // ── All categories ranked ────────────────────────────────────
    html += '<div class="pred-card">';
    catResults.forEach((r, idx)=>{
      if(r.cat.id==='yum') return; // already shown above
      const pct = r.pct;
      const barColor = pct>=70?'linear-gradient(90deg,#4ecdc4,#2ecc71)':
                       pct>=40?'linear-gradient(90deg,#f5a623,#f39c12)':
                       'linear-gradient(90deg,#e94560,#c0392b)';
      const rank = idx+1;
      html+=`<div class="pred-row">
        <div class="pred-rank">#${rank}</div>
        <div class="pred-cat">${r.cat.icon} ${r.cat.name}</div>
        <div class="pred-hold">🎯 ${holdDesc(r.initHeld)}</div>
        <div class="pred-bar-row">
          <div class="pred-bar-wrap">
            <div class="pred-bar-fill" style="width:${Math.min(pct,100)}%;background:${barColor}"></div>
          </div>
          <div class="pred-pct">${pct}%</div>
        </div>
        <div class="pred-exp">Expected ~${r.exp.toFixed(1)} of ${r.cat.max} max</div>
      </div>`;
    });
    html += '</div>';

    cont.innerHTML = html;
  }, 40);
}

// Enable/disable predict button whenever dice change
const _origRenderDice = renderDice;
renderDice = function(justRolled){
  _origRenderDice(justRolled);
  const btn = document.getElementById('predictBtn');
  if(btn) btn.disabled = !dice.every(v=>v>0);
  if(!dice.every(v=>v>0)){
    document.getElementById('predPanel').style.display='none';
  }
  // Hide tap label and scan button in multiplayer/bot
  syncDiceUI();
};


// ─── CAMERA DICE SCAN ───────────────────────────────────────────────
async function handleCamImage(event) {
  const file = event.target.files[0];
  if(!file) return;

  const preview = document.getElementById('camPreview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  setStatus('loading', '🔍 Analysing dice…');

  try {
    const results = await scanDiceFromImage(file);
    if(!results || results.length === 0) {
      setStatus('err', '❌ Could not detect dice — try better lighting & flat surface');
      event.target.value = ''; return;
    }
    for(let i=0;i<5;i++) { dice[i] = i < results.length ? results[i] : 0; held[i] = false; }
    rolled = dice.some(v=>v>0);
    renderDice(); renderScores();
    const count = results.length;
    if(count === 5) {
      setStatus('ok', `✅ Detected: ${results.map(v=>['⚀','⚁','⚂','⚃','⚄','⚅'][v-1]).join(' ')}`);
    } else {
      setStatus('ok', `⚠️ Found ${count} dice — set rest manually`);
    }
  } catch(err) {
    console.error(err);
    setStatus('err', '❌ Scan failed — try again with better lighting');
  }
  event.target.value = '';
}

// ── FREE dice scanner using canvas pixel analysis ─────────────────────
function scanDiceFromImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 600;
      const scale = Math.min(MAX/img.width, MAX/img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      resolve(detectDiceFromPixels(imageData, w, h));
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

function detectDiceFromPixels(imageData, w, h) {
  const data = imageData.data;
  const grey = new Uint8Array(w * h);
  for(let i=0;i<w*h;i++) {
    grey[i] = Math.round(0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2]);
  }
  let sum=0;
  for(let i=0;i<grey.length;i++) sum+=grey[i];
  const avg = sum/grey.length;
  const diceThresh = avg + 20;

  const visited = new Uint8Array(w*h);
  const blobs = [];

  function floodFill(startX, startY) {
    const stack=[[startX,startY]];
    let minX=startX,maxX=startX,minY=startY,maxY=startY,count=0;
    while(stack.length){
      const [x,y]=stack.pop();
      const idx=y*w+x;
      if(x<0||x>=w||y<0||y>=h||visited[idx]||grey[idx]<diceThresh) continue;
      visited[idx]=1; count++;
      minX=Math.min(minX,x); maxX=Math.max(maxX,x);
      minY=Math.min(minY,y); maxY=Math.max(maxY,y);
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    return {minX,maxX,minY,maxY,count};
  }

  for(let y=0;y<h;y+=2){
    for(let x=0;x<w;x+=2){
      const idx=y*w+x;
      if(!visited[idx]&&grey[idx]>=diceThresh){
        const blob=floodFill(x,y);
        const bw=blob.maxX-blob.minX+1, bh=blob.maxY-blob.minY+1;
        const area=bw*bh;
        const minD=Math.min(w,h)*0.07, maxD=Math.min(w,h)*0.6;
        if(bw>minD&&bh>minD&&bw<maxD&&bh<maxD&&blob.count>area*0.35&&Math.max(bw/bh,bh/bw)<2.5)
          blobs.push(blob);
      }
    }
  }

  if(blobs.length===0) return null;

  // Take up to 5 largest, sort left-to-right
  const dieFaces = blobs
    .sort((a,b)=>(b.maxX-b.minX)*(b.maxY-b.minY)-(a.maxX-a.minX)*(a.maxY-a.minY))
    .slice(0,5)
    .sort((a,b)=>a.minX-b.minX);

  const results=[];
  for(const face of dieFaces){
    const pad=Math.round((face.maxX-face.minX)*0.05)+2;
    const faceGrey=[];
    for(let y=face.minY+pad;y<=face.maxY-pad;y++)
      for(let x=face.minX+pad;x<=face.maxX-pad;x++)
        faceGrey.push(grey[y*w+x]);
    if(!faceGrey.length){results.push(1);continue;}
    const faceMean=faceGrey.reduce((a,b)=>a+b,0)/faceGrey.length;
    const dotLevel=faceMean-30;

    const faceVisited={};
    let dots=0;
    function dotFlood(sx,sy){
      const stack=[[sx,sy]]; let cnt=0;
      while(stack.length){
        const [x,y]=stack.pop();
        const key=y*10000+x;
        if(x<face.minX+pad||x>face.maxX-pad||y<face.minY+pad||y>face.maxY-pad) continue;
        if(faceVisited[key]||grey[y*w+x]>dotLevel) continue;
        faceVisited[key]=1; cnt++;
        stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
      }
      return cnt;
    }
    const faceArea=(face.maxX-face.minX)*(face.maxY-face.minY);
    for(let y=face.minY+pad;y<=face.maxY-pad;y+=1){
      for(let x=face.minX+pad;x<=face.maxX-pad;x+=1){
        const key=y*10000+x;
        if(!faceVisited[key]&&grey[y*w+x]<dotLevel){
          const sz=dotFlood(x,y);
          if(sz>faceArea*0.004&&sz<faceArea*0.12) dots++;
        }
      }
    }
    results.push(Math.max(1,Math.min(6,dots||1)));
  }
  return results.length>0?results:null;
}

function setStatus(type, msg) {
  const el = document.getElementById('camStatus');
  el.textContent = msg;
  el.className = type;
}


function dieIcon(n) {
  const pipMap = {
    1: [[50,50]],
    2: [[28,28],[72,72]],
    3: [[28,28],[50,50],[72,72]],
    4: [[28,28],[72,28],[28,72],[72,72]],
    5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
    6: [[28,22],[72,22],[28,50],[72,50],[28,78],[72,78]]
  };
  const dots = (pipMap[n]||[]).map(([x,y]) =>
    '<circle cx="'+x+'" cy="'+y+'" r="8.5" fill="#f0f0f0"/>'
  ).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 100 100" style="border-radius:8px;flex-shrink:0;display:block">'
    + '<rect width="100" height="100" rx="20" fill="#1e8a9e"/>'
    + dots + '</svg>';
}

function renderIcon(icon) {
  if(icon && icon.startsWith('d') && icon.length===2) {
    return dieIcon(parseInt(icon[1]));
  }
  return '<span style="font-size:1.3rem">'+icon+'</span>';
}


// ─── MULTIPLAYER ────────────────────────────────────────────────────
let mpMode = false;
let roomCode = null;
let playerId = 'p_' + Math.random().toString(36).substr(2,9);
let playerName = 'Player';
let isHost = false;
let roomRef = null;
let allPlayers = {};
let currentTurnId = null;
let previousPlayerCount = null;
let previousPlayers = {};
let prevOpponentScores = {}; // track opponent score counts for change detection
let mpGameOverShown = false;

function genCode() {
  return Math.random().toString(36).substr(2,4).toUpperCase();
}

function getLobbyName() {
  const n = document.getElementById('playerName').value.trim();
  if(!n) { showLobbyErr('Enter your name first!'); return null; }
  return n;
}

function showLobbyErr(msg) {
  document.getElementById('lobbyErr').textContent = msg;
  setTimeout(()=>document.getElementById('lobbyErr').textContent='', 3000);
}

async function createGame() {
  const name = getLobbyName(); if(!name) return;
  playerName = name;
  isHost = true;
  roomCode = genCode();

  if(!window.db) { showLobbyErr('Multiplayer not available offline'); return; }
  roomRef = db.ref('rooms/' + roomCode);
  await roomRef.set({
    host: playerId,
    started: false,
    currentTurn: playerId,
    players: {
      [playerId]: { name: playerName, scores: {}, joined: Date.now() }
    }
  });

  // Clean up room when host disconnects (if not started)
  roomRef.child('players/' + playerId).onDisconnect().remove();

  showWaiting();
  listenRoom();
}

async function joinGame() {
  const name = getLobbyName(); if(!name) return;
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if(code.length !== 4) { showLobbyErr('Enter a 4-letter room code'); return; }

  playerName = name;
  roomCode = code;
  isHost = false;

  const snap = await db.ref('rooms/' + code).once('value');
  if(!snap.exists()) { showLobbyErr('Room not found! Check the code.'); return; }
  if(snap.val().started) { showLobbyErr('Game already started!'); return; }

  roomRef = db.ref('rooms/' + code);
  await roomRef.child('players/' + playerId).set({
    name: playerName, scores: {}, joined: Date.now()
  });
  roomRef.child('players/' + playerId).onDisconnect().remove();

  showWaiting();
  listenRoom();
}

function startSolo() {
  document.getElementById('lobbyOverlay').style.display = 'none';
}

function showWaiting() {
  document.getElementById('lobbyOverlay').style.display = 'none';
  const w = document.getElementById('waitingOverlay');
  w.style.display = 'flex';
  document.getElementById('displayCode').textContent = roomCode;

  // Generate QR code with the room code embedded in the page URL
  const qrEl = document.getElementById('qrCode');
  qrEl.innerHTML = '';
  const joinUrl = window.location.href.split('?')[0] + '?join=' + roomCode;
  new QRCode(qrEl, {
    text: joinUrl,
    width: 160, height: 160,
    colorDark: '#000000', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function listenRoom() {
  roomRef.on('value', snap => {
    if(!snap.exists()) { leaveGame(); return; }
    const data = snap.val();
    allPlayers = data.players || {};
    currentTurnId = data.currentTurn;

    // Update waiting room player list
    const wp = document.getElementById('waitingPlayers');
    if(wp) {
      const sorted = Object.entries(allPlayers).sort((a,b)=>a[1].joined-b[1].joined);
      wp.innerHTML = sorted.map(([id,p]) =>
        `<div class="room-player-row">
          <div class="room-player-dot"></div>
          <div class="room-player-name">${p.name}${id===playerId?' (you)':''}</div>
          ${id===data.host?'<div class="room-player-host">HOST</div>':''}
        </div>`
      ).join('');
      const cnt = Object.keys(allPlayers).length;
      document.getElementById('waitMsg').textContent =
        cnt < 2 ? 'Waiting for more players…' : cnt + ' players ready!';
    }

    if(data.started && document.getElementById('waitingOverlay').style.display !== 'none') {
      // Game started!
      document.getElementById('waitingOverlay').style.display = 'none';
      mpMode = true;
      mpGameOverShown = false;
      document.getElementById('mpBanner').style.display = 'block';
      document.getElementById('leaderboard').style.display = 'block';
      document.getElementById('mpCodeBadge').textContent = roomCode;
      scores = {}; // reset local scores
      renderScores();
      syncDiceUI();

      // Roll to decide who goes first (only host triggers, result synced via currentTurn)
      if(isHost) {
        const sortedPlayers = Object.entries(allPlayers)
          .sort((a,b) => a[1].joined - b[1].joined)
          .map(([id, p]) => ({ name: p.name, isMe: id === playerId, id }));
        showFirstRoll(sortedPlayers, function(winnerId) {
          roomRef.update({ currentTurn: winnerId });
        });
      } else {
        // Non-host: show the overlay and wait for result from Firebase
        const sortedPlayers = Object.entries(allPlayers)
          .sort((a,b) => a[1].joined - b[1].joined)
          .map(([id, p]) => ({ name: p.name, isMe: id === playerId, id }));
        showFirstRoll(sortedPlayers, function() {});
      }
    }

    if(data.started) {
      updateMpUI();
      renderLeaderboard();
    }

    // Sync my scores from DB
    if(data.started && allPlayers[playerId]) {
      const dbScores = allPlayers[playerId].scores || {};
      if(JSON.stringify(dbScores) !== JSON.stringify(scores)) {
        scores = dbScores;
        renderScores();
      }
    }

    // Game-over detection for all clients (covers the player who finished first)
    if (data.started && !mpGameOverShown && Object.keys(allPlayers).length >= 2) {
      const allDone = Object.entries(allPlayers).every(([id, p]) => {
        const sc = id === playerId ? scores : (p.scores || {});
        return Object.keys(sc).length >= categories.length;
      });
      if (allDone) setTimeout(showMpGameOver, 800);
    }

    // Show opponent's live dice when it's not our turn
    // Detect if a player left mid-game
    if(data.started && previousPlayerCount !== null) {
      const currentCount = Object.keys(data.players || {}).length;
      if(currentCount < previousPlayerCount) {
        // Find who left
        const prevNames = Object.keys(previousPlayers || {});
        const currNames = Object.keys(data.players || {});
        const leftId = prevNames.find(id => !currNames.includes(id));
        const leftName = (previousPlayers[leftId] || {}).name || 'A player';
        if(leftId !== playerId) {
          showPlayerLeftPopup(leftName);
        }
      }
    }
    previousPlayerCount = Object.keys(data.players || {}).length;
    previousPlayers = {...(data.players || {})};

    // Detect when an opponent scores a new category and show action popup
    if(data.started) {
      Object.entries(allPlayers).forEach(([id, p]) => {
        if(id === playerId) return; // skip self
        const newScores = p.scores || {};
        const prevCount = prevOpponentScores[id] || 0;
        const newCount = Object.keys(newScores).length;
        if(newCount > prevCount) {
          // Find which category was just scored
          const prevKeys = Object.keys(prevOpponentScores['_keys_' + id] || {});
          const newKey = Object.keys(newScores).find(k => !prevKeys.includes(k));
          if(newKey) {
            const cat = categories.find(c => c.id === newKey);
            const scored = newScores[newKey];
            if(cat) {
              const isPerfect = scored === cat.max && cat.max > 0;
              const isZero = scored === 0;
              showBotActionPopup(p.name, [], cat.name, scored, isPerfect, isZero, true);
            }
          }
        }
        prevOpponentScores[id] = newCount;
        prevOpponentScores['_keys_' + id] = {...newScores};
      });
    }

    if(data.started && currentTurnId && currentTurnId !== playerId) {
      const oppLive = allPlayers[currentTurnId]?.liveDice;
      if(oppLive && oppLive.dice) {
        showOpponentDiceInRoller(oppLive, allPlayers[currentTurnId]?.name || 'Opponent');
      } else {
        // Opponent hasn't rolled yet — show waiting state
        showOpponentWaiting(allPlayers[currentTurnId]?.name || 'Opponent');
      }
    } else if(data.started && currentTurnId === playerId) {
      // It's our turn — restore normal dice UI
      restoreMyDiceUI();
    }
  });
}

function startGame() {
  if(!isHost) { showToast('Only the host can start!'); return; }
  const cnt = Object.keys(allPlayers).length;
  if(cnt < 1) { showToast('Need at least 1 player!'); return; }
  const firstPlayer = Object.entries(allPlayers).sort((a,b)=>a[1].joined-b[1].joined)[0][0];
  roomRef.update({ started: true, currentTurn: firstPlayer });
}

function leaveGame() {
  if(roomRef) {
    roomRef.child('players/' + playerId).remove();
    roomRef.off();
    roomRef = null;
  }
  mpMode = false; roomCode = null;
  document.getElementById('waitingOverlay').style.display = 'none';
  document.getElementById('mpBanner').style.display = 'none';
  document.getElementById('leaderboard').style.display = 'none';
  document.getElementById('lobbyOverlay').style.display = 'flex';
  scores = {}; renderScores();
}

function updateMpUI() {
  const isMyTurn = currentTurnId === playerId;
  const badge = document.getElementById('mpTurnBadge');
  if(isMyTurn) {
    badge.textContent = '🎲 YOUR TURN';
    badge.className = 'mp-turn-badge my-turn';
  } else {
    const name = allPlayers[currentTurnId]?.name || '…';
    badge.textContent = name + "'s turn";
    badge.className = 'mp-turn-badge wait-turn';
  }
}

function renderLeaderboard() {
  const sorted = Object.entries(allPlayers).sort((a,b) => {
    return calcTotal(b[1].scores||{}) - calcTotal(a[1].scores||{});
  });
  const rows = sorted.map(([id, p], i) => {
    const sc = p.scores || {};
    const total = calcTotal(sc);
    const filled = Object.keys(sc).length;
    const isMe = id === playerId;
    const isTurn = id === currentTurnId;
    const tapAction = isMe
      ? `openReactionPicker('${id}')`
      : `viewMpOpponent('${id}')`;
    return `<div class="lb-row ${isMe?'me':''}" onclick="${tapAction}" style="cursor:pointer">
      <div class="lb-rank">${i+1}</div>
      ${isTurn ? '<div class="lb-turn-dot"></div>' : '<div style="width:8px"></div>'}
      <div class="lb-name">${p.name}${isMe?' 👆':'<span style="font-size:0.65rem;color:var(--muted)"> 👁 view</span>'}</div>
      <div class="lb-filled">${filled}/13</div>
      <div class="lb-score">${total}</div>
    </div>`;
  }).join('');
  document.getElementById('lbRows').innerHTML = rows;
}

function calcTotal(sc) {
  const upperIds = ['ones','twos','threes','fours','fives','sixes'];
  const upperTotal = upperIds.reduce((s,id)=>s+(sc[id]||0),0);
  const bonus = upperTotal >= 63 ? 35 : 0;
  return Object.values(sc).reduce((a,b)=>a+b,0) + bonus;
}

function advanceTurn() {
  if(!mpMode || !roomRef) return;
  // Clear our live dice
  roomRef.child('players/' + playerId + '/liveDice').remove();
  const playerOrder = Object.entries(allPlayers).sort((a,b)=>a[1].joined-b[1].joined).map(e=>e[0]);
  const idx = playerOrder.indexOf(currentTurnId);
  const nextId = playerOrder[(idx+1) % playerOrder.length];
  roomRef.update({ currentTurn: nextId });
  showToast('✅ Score saved! ' + (allPlayers[nextId]?.name || 'Next player') + "'s turn");
}

function pushScoresToDb() {
  if(!mpMode || !roomRef) return;
  roomRef.child('players/' + playerId + '/scores').set(scores);
  // Check if all players have filled all 13 categories
  const allDone = Object.values(allPlayers).every(p =>
    Object.keys(p.scores || {}).length >= categories.length
  );
  // Also check local player
  if(Object.keys(scores).length >= categories.length) {
    // Refresh allPlayers locally for this check
    const localDone = Object.entries(allPlayers).every(([id, p]) => {
      const sc = id === playerId ? scores : (p.scores || {});
      return Object.keys(sc).length >= categories.length;
    });
    if(localDone) setTimeout(showMpGameOver, 800);
  }
}

function showMpGameOver() {
  if (mpGameOverShown) return;
  mpGameOverShown = true;
  const players = Object.entries(allPlayers).map(([id, p]) => {
    const sc = id === playerId ? scores : (p.scores || {});
    return { name: p.name, score: calcTotal(sc), isMe: id === playerId };
  }).sort((a,b) => b.score - a.score);
  showGameOver(players);
}

function showToast(msg) {
  const t = document.getElementById('mpToast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}

// Patch confirmScore to push to Firebase and advance turn
const _origConfirmScore = confirmScore;
confirmScore = function() {
  if(mpMode && currentTurnId !== playerId) { showToast("It's not your turn!"); return; }
  _origConfirmScore();
  if(mpMode) {
    pushScoresToDb();
    advanceTurn();
    clearDice();
  }
};


// ─── REACTIONS ──────────────────────────────────────────────────────
const REACTIONS = [
  { emoji: '👍', label: 'Nice one!' },
  { emoji: '🔥', label: 'On fire!' },
  { emoji: '😂', label: 'Ha!' },
  { emoji: '🎲', label: 'Roll it!' },
  { emoji: '🏆', label: 'Champion!' },
  { emoji: '😬', label: 'Yikes…' },
  { emoji: '👏', label: 'Good job!' },
  { emoji: '💀', label: 'Dead!' },
  { emoji: '🤞', label: 'Good luck!' },
  { emoji: '😎', label: 'Too easy' },
  { emoji: '🎯', label: 'Bull\'s eye!' },
  { emoji: '⏰', label: 'Hurry up!' },
  { emoji: '🥳', label: 'Party time!' },
  { emoji: '😤', label: 'Intense!' },
  { emoji: '🤙', label: 'Let\'s go!' },
  { emoji: '💪', label: 'Strong!' },
];

let reactionTargetId = null;

function openReactionPicker(targetId) {
  if(!mpMode) return;
  reactionTargetId = targetId;
  // Build grid
  const grid = document.getElementById('reactionGrid');
  grid.innerHTML = REACTIONS.map((r,i) =>
    `<button class="reaction-btn" onclick="sendReaction(${i})">
      <span class="r-emoji">${r.emoji}</span>
      <span class="r-label">${r.label}</span>
    </button>`
  ).join('');
  document.getElementById('reactionPicker').classList.add('open');
}

function closeReactionPicker() {
  document.getElementById('reactionPicker').classList.remove('open');
  reactionTargetId = null;
}

function sendReaction(idx) {
  if(!roomRef) return;
  const r = REACTIONS[idx];
  const toName = allPlayers[reactionTargetId]?.name || 'everyone';
  roomRef.child('reactions').push({
    from: playerId,
    fromName: playerName,
    to: reactionTargetId,
    toName: toName,
    emoji: r.emoji,
    label: r.label,
    ts: Date.now()
  });
  closeReactionPicker();
}

function listenReactions() {
  if(!roomRef) return;
  // Only listen to reactions sent TO me or FROM me (last 30s)
  roomRef.child('reactions').orderByChild('ts').startAt(Date.now()).on('child_added', snap => {
    const r = snap.val();
    if(!r) return;
    // Show bubble if it's directed at me or from someone to anyone
    showReactionBubble(r);
  });
}

function showReactionBubble(r) {
  const container = document.getElementById('reactionBubbleContainer');
  const div = document.createElement('div');
  div.className = 'reaction-bubble';

  const isToMe = r.to === playerId;
  const isFromMe = r.from === playerId;
  const toText = isToMe ? 'you' : r.toName;
  const fromText = isFromMe ? 'You' : r.fromName;

  div.innerHTML = `
    <div class="rb-emoji">${r.emoji}</div>
    <div>
      <div class="rb-text">${r.label}</div>
      <div class="rb-name">${fromText} → ${toText}</div>
    </div>`;

  // Position randomly near top-center
  div.style.top = (80 + Math.random() * 80) + 'px';
  div.style.left = '50%';
  div.style.transform = 'translateX(-50%)';

  container.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

// Patch listenRoom to also start reaction listener when game starts
const _origListenRoom = listenRoom;
listenRoom = function() {
  _origListenRoom();
  // We'll start reaction listener after game starts
  const checkStarted = db.ref('rooms/' + roomCode + '/started').on('value', snap => {
    if(snap.val() === true) listenReactions();
  });
};


// ─── VS BOT ─────────────────────────────────────────────────────────
let botMode = false;
let botScores = {};
let botName = '🤖 Bot';
let playerTurn = true; // true = human, false = bot
let botThinkTimeout = null;

function startVsBot() {
  const name = document.getElementById('playerName').value.trim();
  if(!name) { showLobbyErr('Enter your name first!'); return; }
  playerName = name;
  botMode = true;
  botScores = {};
  scores = {};
  document.getElementById('lobbyOverlay').style.display = 'none';
  document.getElementById('leaderboard').style.display = 'block';
  renderBotLeaderboard();
  renderScores();
  syncDiceUI();

  // Roll to decide who goes first
  showFirstRoll(
    [{ name: playerName, isMe: true, id: 'player' }, { name: botName, isMe: false, id: 'bot' }],
    function(winnerId) {
      playerTurn = winnerId === 'player';
      if(playerTurn) {
        // closeFirstRoll() now handles the smooth dice-roller transition and turn popup.
      } else {
        showToast('🤖 Bot goes first!');
        setTimeout(botTakeTurn, 800);
      }
    }
  );
}

function renderBotLeaderboard() {
  if(!botMode) return;
  const pTotal = calcTotal(scores);
  const bTotal = calcTotal(botScores);
  const pFilled = Object.keys(scores).length;
  const bFilled = Object.keys(botScores).length;
  const pLeading = pTotal >= bTotal;

  document.getElementById('lbRows').innerHTML = `
    <div class="lb-row me" style="cursor:default">
      <div class="lb-rank">${pLeading?'1':'2'}</div>
      <div style="width:8px"></div>
      <div class="lb-name">${playerName} ${playerTurn?'🎲':''}</div>
      <div class="lb-filled">${pFilled}/13</div>
      <div class="lb-score">${pTotal}</div>
    </div>
    <div class="lb-row" style="cursor:pointer;background:rgba(168,85,247,0.07)" onclick="openOppViewer('bot','${botName}',botScores,botScoreDice)">
      <div class="lb-rank">${pLeading?'2':'1'}</div>
      <div style="width:8px"></div>
      <div class="lb-name">${botName} ${!playerTurn?'🎲':''} <span style="font-size:0.65rem;color:var(--muted)">👁 tap</span></div>
      <div class="lb-filled">${bFilled}/13</div>
      <div class="lb-score">${bTotal}</div>
    </div>`;
}

// Bot brain: pick best category + hold pattern using greedy sim
function botChooseBestMove() {
  const unfilledCats = categories.filter(c => botScores[c.id] === undefined);
  if(unfilledCats.length === 0) return null;

  let bestCat = null, bestExp = -1, bestHeld = [0,0,0,0,0];

  for(const cat of unfilledCats) {
    for(let mask = 0; mask < 32; mask++) {
      const initHeld = botDice.map((v,i) => ((mask>>i)&1) ? v : 0);
      let total = 0;
      const N = 80;
      for(let sim = 0; sim < N; sim++) {
        let d = initHeld.map(v => v === 0 ? randDie() : v);
        const h2 = greedyHoldForCat(d, cat.id);
        d = d.map((v,j) => h2[j] ? v : randDie());
        total += cat.calc(d);
      }
      const exp = total / N;
      if(exp > bestExp) { bestExp = exp; bestCat = cat; bestHeld = initHeld; }
    }
  }
  return { cat: bestCat, held: bestHeld, exp: bestExp };
}

let botDice = [1,1,1,1,1];

function botTakeTurn() {
  if(!botMode || playerTurn) return;
  const bar = document.getElementById('botThinkBar');
  bar.style.display = 'flex';

  // Show bot is in control of the dice area
  showBotDiceOverlay(true);

  // Roll 1 — roll all 5
  setTimeout(() => {
    botDice = [0,0,0,0,0].map(() => randDie());
    botHeld = [false,false,false,false,false];
    document.getElementById('botThinkMsg').textContent = '🤖 Roll 1 of 3…';
    showBotDiceInRoller(botDice, botHeld, true);

    // Decide hold after roll 1
    setTimeout(() => {
      const move1 = botChooseBestMove();
      if(!move1) { finishBotTurn(null); return; }
      // Show which dice bot is holding
      botHeld = move1.held.map(v => v !== 0);
      document.getElementById('botThinkMsg').textContent = '🤖 Holding ' + botHeld.filter(Boolean).length + ' dice…';
      showBotDiceInRoller(botDice, botHeld, false);

      // Roll 2
      setTimeout(() => {
        botDice = move1.held.map((v,i) => v === 0 ? randDie() : v);
        const move2 = botChooseBestMove();
        botHeld = move2 ? move2.held.map(v => v !== 0) : [true,true,true,true,true];
        document.getElementById('botThinkMsg').textContent = '🤖 Roll 2 of 3…';
        showBotDiceInRoller(botDice, botHeld, true);

        setTimeout(() => {
          document.getElementById('botThinkMsg').textContent = '🤖 Holding ' + botHeld.filter(Boolean).length + ' dice…';
          showBotDiceInRoller(botDice, botHeld, false);

          // Roll 3
          setTimeout(() => {
            if(!move2) { finishBotTurn(null); return; }
            botDice = move2.held.map((v,i) => v === 0 ? randDie() : v);
            botHeld = [true,true,true,true,true];
            document.getElementById('botThinkMsg').textContent = '🤖 Roll 3 of 3…';
            showBotDiceInRoller(botDice, botHeld, true);

            setTimeout(() => {
              const finalMove = botChooseBestMove();
              document.getElementById('botThinkMsg').textContent = '🤖 Scoring…';
              finishBotTurn(finalMove);
            }, 900);
          }, 700);
        }, 700);
      }, 800);
    }, 900);
  }, 500);
}

let botHeld = [false,false,false,false,false];

function showBotDiceOverlay(active) {
  // Add/remove a subtle tint to the dice section
  const sec = document.querySelector('.dice-section');
  if(!sec) return;
  if(active) {
    sec.style.border = '1.5px solid rgba(168,85,247,0.5)';
    sec.style.boxShadow = '0 0 20px rgba(168,85,247,0.15)';
  } else {
    sec.style.border = '';
    sec.style.boxShadow = '';
  }
}

function showBotDiceInRoller(d, heldArr, justRolled) {
  // Temporarily override the dice display with bot's dice
  dice = d.slice();
  held = heldArr.slice();
  renderDice(justRolled);
  // Update roll count display
  const rollNum = justRolled ? 1 : 0;
  document.getElementById('rollCount').textContent =
    document.getElementById('botThinkMsg').textContent;
}

function animateBotDice() {
  // kept for compatibility
  const diceRow = document.getElementById('diceRow');
  diceRow.style.opacity = '0.4';
  setTimeout(() => { diceRow.style.opacity = '1'; }, 200);
}

let _botActionTimer = null;
function showBotActionPopup(name, diceArr, catName, scored, isPerfect, isZero, isMp) {
  const pop = document.getElementById('botActionPopup');
  document.getElementById('bapAvatar').textContent = isMp ? '👤' : '🤖';
  document.getElementById('bapName').textContent = name.toUpperCase();
  const diceEl = document.getElementById('bapDice');
  if(diceArr && diceArr.length > 0) {
    diceEl.innerHTML = diceArr
      .map(v => `<span class="bap-die">${v > 0 ? DICE_FACES[v-1] : '⬜'}</span>`)
      .join('');
    diceEl.style.display = 'flex';
  } else {
    diceEl.innerHTML = '';
    diceEl.style.display = 'none';
  }
  document.getElementById('bapCat').textContent = catName;
  document.getElementById('bapScore').textContent = scored;
  document.getElementById('bapLabel').textContent =
    isPerfect ? 'PERFECT! 🏆' : isZero ? 'STRUCK OUT' : 'SCORED';
  pop.classList.remove('perfect', 'zero', 'mp');
  if(isPerfect) pop.classList.add('perfect');
  else if(isZero) pop.classList.add('zero');
  if(isMp) pop.classList.add('mp');
  if(_botActionTimer) clearTimeout(_botActionTimer);
  pop.classList.add('show');
  _botActionTimer = setTimeout(() => pop.classList.remove('show'), 3000);
}

function finishBotTurn(move) {
  if(!move || !move.cat) {
    // No move, skip
    playerTurn = true;
    renderBotLeaderboard();
    showToast('🎲 Your turn!');
    return;
  }

  // Score it
  const scored = move.cat.calc(botDice);
  botScores[move.cat.id] = scored;
  botScoreDice[move.cat.id] = botDice.slice(); // remember which dice were used

  // Animate score appearing in leaderboard
  renderBotLeaderboard();

  const isPerfect = scored === move.cat.max && move.cat.max > 0;
  const isZero = scored === 0;
  showBotActionPopup(botName, botDice, move.cat.name, scored, isPerfect, isZero, false);

  // Restore dice area to player control
  showBotDiceOverlay(false);
  document.getElementById('botThinkBar').style.display = 'none';

  // Check if bot finished
  if(Object.keys(botScores).length === categories.length) {
    clearDice();
    setTimeout(showBotGameOver, 800);
    return;
  }

  playerTurn = true;
  clearDice();
  renderBotLeaderboard();
  setTimeout(() => showYourTurnPop('ROLL THE DICE'), 2500);
}

function showBotGameOver() {
  const pTotal = calcTotal(scores);
  const bTotal = calcTotal(botScores);
  const players = [
    { name: playerName, score: pTotal, isMe: true },
    { name: botName,    score: bTotal, isMe: false }
  ].sort((a,b) => b.score - a.score);
  setTimeout(() => showGameOver(players), 600);
}

// Patch confirmScore to trigger bot turn after player scores
const _origConfirmScoreBot = confirmScore;
confirmScore = function() {
  if(botMode && !playerTurn) { showToast("Wait for the bot!"); return; }
  // Safety: if selectedScore is 0 (strike) ensure it's explicitly saved
  if(botMode && activeModal && selectedScore === 0) {
    scores[activeModal] = 0;
    closeModalEl();
    renderScores();
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 150);
    playerTurn = false;
    clearDice();
    renderBotLeaderboard();
    setTimeout(botTakeTurn, 600);
    return;
  }
  _origConfirmScoreBot();
  if(botMode) {
    playerTurn = false;
    clearDice();
    renderBotLeaderboard();
    setTimeout(botTakeTurn, 600);
  }
};

// Patch cycleDie/rollDice/toggleHold to block when bot is playing
const _origCycleDie = cycleDie;
cycleDie = function(i) {
  if(botMode && !playerTurn) { showToast('Wait for the bot! 🤖'); return; }
  _origCycleDie(i);
};
const _origRollDice = rollDice;
rollDice = function() {
  if(botMode && !playerTurn) { showToast('Wait for the bot! 🤖'); return; }
  _origRollDice();
};


// ─── OPPONENT SCORECARD VIEWER ───────────────────────────────────────
let botScoreDice = {}; // stores dice used per category for bot

function openOppViewer(targetId, targetName, targetScores, targetScoreDice) {
  const total = calcTotal(targetScores);
  document.getElementById('oppAvatar').textContent = targetId === 'bot' ? '🤖' : '👤';
  document.getElementById('oppHName').textContent = targetName;
  document.getElementById('oppHScore').textContent = total + ' pts';

  const upperIds = ['ones','twos','threes','fours','fives','sixes'];
  const lowerIds = categories.filter(c=>c.section==='lower').map(c=>c.id);

  function buildRows(ids) {
    return ids.map(id => {
      const cat = categories.find(c=>c.id===id);
      const val = targetScores[id];
      const filled = val !== undefined;
      const usedDice = targetScoreDice && targetScoreDice[id];
      const pct = filled ? Math.round((val/cat.max)*100) : null;
      const pctColor = pct>=75?'#4ecdc4':pct>=40?'#f5a623':'#e94560';

      const diceHtml = usedDice
        ? usedDice.map(v=>`<span class="opp-die-chip">${['⚀','⚁','⚂','⚃','⚄','⚅'][v-1]}</span>`).join('')
        : filled ? '<span style="font-size:0.7rem;opacity:0.4">dice unknown</span>' : '';

      return `<div class="opp-score-row">
        <div class="opp-row-icon">${renderIcon(cat.icon)}</div>
        <div class="opp-row-info">
          <div class="opp-row-name">${cat.name}</div>
          ${filled ? `
            <div class="opp-row-dice">${diceHtml}</div>
            <div class="opp-pct-bar">
              <div class="opp-pct-fill" style="width:${pct}%;background:${pctColor}"></div>
            </div>` : '<div style="font-size:0.72rem;color:rgba(255,255,255,0.2);margin-top:2px">not scored yet</div>'}
        </div>
        ${filled
          ? `<div class="opp-row-val">${val}</div>`
          : '<div class="opp-row-empty">–</div>'}
      </div>`;
    }).join('');
  }

  // Upper bonus
  const upperTotal = upperIds.reduce((s,id)=>s+(targetScores[id]||0),0);
  const bonusEarned = upperTotal >= 63;

  const html = `
    <div class="opp-section-title">UPPER SECTION</div>
    <div>${buildRows(upperIds)}</div>
    <div class="opp-bonus-row">
      <div>
        <div style="font-weight:800;font-size:0.85rem;color:var(--green)">🎁 UPPER BONUS</div>
        <div style="font-size:0.72rem;color:var(--muted)">${upperTotal}/63 → +35</div>
      </div>
      <div style="font-family:'Bebas Neue',cursive;font-size:1.4rem;color:${bonusEarned?'var(--gold)':'var(--muted)'}">
        ${bonusEarned?'+35':'–'}
      </div>
    </div>
    <div class="opp-section-title">LOWER SECTION</div>
    <div>${buildRows(lowerIds)}</div>`;

  document.getElementById('oppSheetContent').innerHTML = html;
  const viewer = document.getElementById('oppViewer');
  viewer.style.display = 'flex';
  requestAnimationFrame(() => viewer.classList.add('open'));
}

function closeOppViewer(e) {
  if(e.target === document.getElementById('oppViewer')) closeOppViewerBtn();
}
function closeOppViewerBtn() {
  const viewer = document.getElementById('oppViewer');
  viewer.classList.remove('open');
  setTimeout(()=>{ viewer.style.display='none'; }, 350);
}


// ─── OPPONENT LIVE DICE (MULTIPLAYER) ───────────────────────────────
let myDiceUI = true; // true = showing my dice, false = showing opponent

function showOpponentDiceInRoller(liveDice, oppName) {
  if(myDiceUI) {
    // First time switching — save my dice state? No, just show opponent
    myDiceUI = false;
    showBotDiceOverlay(true);
  }
  // Show opponent's dice in roller
  const oppDice = liveDice.dice || [0,0,0,0,0];
  const oppHeld = liveDice.held || [false,false,false,false,false];
  const rollNum  = liveDice.roll || 1;

  // Temporarily set dice/held for rendering
  const savedDice = dice.slice();
  const savedHeld = held.slice();
  dice = oppDice.slice();
  held = oppHeld.slice();
  renderDice(true);
  dice = savedDice;
  held = savedHeld;

  document.getElementById('rollCount').textContent =
    `👤 ${oppName} — Roll ${rollNum} / 3`;
}

function showOpponentWaiting(oppName) {
  if(!myDiceUI) return; // already showing something
  document.getElementById('rollCount').textContent =
    `⏳ Waiting for ${oppName} to roll…`;
}

function restoreMyDiceUI() {
  if(myDiceUI) return; // already mine
  myDiceUI = true;
  showBotDiceOverlay(false);
  renderDice(false);
  document.getElementById('rollCount').textContent =
    `Rolls: ${3 - rollsLeft} / 3`;
  setTimeout(() => showYourTurnPop('ROLL THE DICE'), 4000);
}


// ─── GAME OVER POPUP ─────────────────────────────────────────────────
function showGameOver(players) {
  // players = [{name, score, isMe}] sorted by score desc
  const winner = players[0];
  const tied = players.length > 1 && players[0].score === players[1].score;

  if (winner.isMe) SFX.win();
  else if (!tied) SFX.lose();
  document.getElementById('goTrophy').textContent =
    tied ? '🤝' : winner.isMe ? '🏆' : '😤';
  document.getElementById('goTitle').textContent =
    tied ? "IT'S A TIE!" : winner.isMe ? 'YOU WIN!' : 'YOU LOSE!';
  document.getElementById('goWinner').textContent =
    tied ? 'Dead even!' : winner.name + ' wins!';

  document.getElementById('goScores').innerHTML = players.map((p,i) =>
    `<div class="gameover-score-row">
      <div class="gameover-score-name">${i===0&&!tied?'🥇 ':''}${p.name}${p.isMe?' (you)':''}</div>
      <div class="gameover-score-val">${p.score}</div>
    </div>`
  ).join('');

  // Save full scores to session
  const playersWithScores = players.map(p => {
    let sc = {};
    if(p.isMe) sc = {...scores};
    else if(botMode) sc = {...botScores};
    else {
      // Multiplayer — find opponent scores from allPlayers
      const entry = Object.entries(allPlayers).find(([id,pl]) => pl.name === p.name);
      if(entry) sc = {...(entry[1].scores || {})};
    }
    return { ...p, scores: sc };
  });
  saveGameToSession(playersWithScores);
  sessionTab = 'game' + sessionGames.length; // default to latest game

  document.getElementById('gameOverlay').classList.add('open');
}

function rematch() {
  document.getElementById('gameOverlay').classList.remove('open');
  if(botMode) {
    // Full reset
    botScores = {}; botScoreDice = {};
    scores = {}; playerTurn = true;
    rollsLeft = 3; rolled = false;
    dice = [0,0,0,0,0]; held = [false,false,false,false,false];
    renderDice(false);
    renderScores();
    renderBotLeaderboard();
    document.getElementById('rollCount').textContent = 'Rolls: 0 / 3';
    // Roll to decide who goes first again
    showFirstRoll(
      [{ name: playerName, isMe: true, id: 'player' }, { name: botName, isMe: false, id: 'bot' }],
      function(winnerId) {
        playerTurn = winnerId === 'player';
        if(playerTurn) {
          showYourTurnPop('YOU GO FIRST!');
        } else {
          showToast('🤖 Bot goes first!');
          setTimeout(botTakeTurn, 800);
        }
      }
    );
  } else if(mpMode && roomRef) {
    // Show vote bar for all players
    startRematchVote();
    // Auto-vote yes for me since I clicked rematch
    setTimeout(() => voteRematch(true), 300);
  }
}

function quitGame() {
  document.getElementById('gameOverlay').classList.remove('open');
  if(botMode) {
    botMode = false; botScores = {}; botScoreDice = {};
    scores = {}; playerTurn = true;
    document.getElementById('leaderboard').style.display = 'none';
    clearDice(); renderScores();
  } else if(mpMode) {
    leaveGame();
  }
  document.getElementById('lobbyOverlay').style.display = 'flex';
}


// ─── SESSION HISTORY ─────────────────────────────────────────────────
let sessionGames = []; // [{gameNum, players:[{name,scores,isMe}], winner}]
let sessionTab = 'summary';

function saveGameToSession(players) {
  // players = [{name, score, scores, isMe}]
  const winner = players.slice().sort((a,b)=>b.score-a.score)[0];
  sessionGames.push({
    gameNum: sessionGames.length + 1,
    players: players,
    winner: winner.name,
    winnerId: winner.isMe ? 'me' : 'opp'
  });
  updateSessionBtn();
}

function updateSessionBtn() {
  const btn = document.getElementById('sessionBtn');
  btn.style.display = sessionGames.length > 0 ? 'flex' : 'none';
  document.getElementById('sessionBadge').textContent = sessionGames.length;
}

function openSession() {
  renderSessionContent();
  const ov = document.getElementById('sessionOverlay');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
}

function closeSession() {
  const ov = document.getElementById('sessionOverlay');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; }, 350);
}

function closeSessionOverlay(e) {
  if(e.target === document.getElementById('sessionOverlay')) closeSession();
}

function renderSessionContent() {
  // Build tabs: Summary + each game
  const tabs = document.getElementById('sessionTabs');
  tabs.innerHTML = `<button class="session-tab ${sessionTab==='summary'?'active':''}" onclick="setSessionTab('summary')">📊 Summary</button>`
    + sessionGames.map((g,i) =>
        `<button class="session-tab ${sessionTab==='game'+g.gameNum?'active':''}"
          onclick="setSessionTab('game${g.gameNum}')">
          Game ${g.gameNum}${g.winnerId==='me'?' 🏆':''}
        </button>`
      ).join('');

  const cont = document.getElementById('sessionContent');

  if(sessionTab === 'summary') {
    renderSessionSummary(cont);
  } else {
    const gameNum = parseInt(sessionTab.replace('game',''));
    const game = sessionGames.find(g=>g.gameNum===gameNum);
    if(game) renderSessionGame(cont, game);
  }
}

function setSessionTab(tab) {
  sessionTab = tab;
  renderSessionContent();
}

function renderSessionSummary(cont) {
  // Tally wins and total scores per player name
  const stats = {};
  sessionGames.forEach(g => {
    g.players.forEach(p => {
      if(!stats[p.name]) stats[p.name] = { wins:0, totalScore:0, games:0, isMe:p.isMe };
      stats[p.name].games++;
      stats[p.name].totalScore += p.score;
      if(p.name === g.winner) stats[p.name].wins++;
    });
  });

  const sorted = Object.entries(stats).sort((a,b)=>b[1].wins-a[1].wins||b[1].totalScore-a[1].totalScore);
  const medals = ['🥇','🥈','🥉'];

  let html = `<div class="session-summary">
    <div class="session-summary-title">STANDINGS · ${sessionGames.length} GAME${sessionGames.length!==1?'S':''}</div>`;

  sorted.forEach(([name, s], i) => {
    html += `<div class="session-summary-row">
      <div class="ssrow-rank">${medals[i]||i+1}</div>
      <div>
        <div class="ssrow-name">${name}${s.isMe?' (you)':''}</div>
        <div style="font-size:0.7rem;color:var(--muted)">${s.games} game${s.games!==1?'s':''} · avg ${Math.round(s.totalScore/s.games)} pts</div>
      </div>
      <div class="ssrow-wins">${s.wins} WIN${s.wins!==1?'S':''}</div>
      <div class="ssrow-total">${s.totalScore}</div>
    </div>`;
  });
  html += '</div>';

  // Mini game results
  html += `<div style="padding:0 12px 4px">
    <div style="font-family:'Bebas Neue',cursive;font-size:0.9rem;letter-spacing:3px;color:var(--muted);margin-bottom:8px">RESULTS</div>`;
  sessionGames.forEach(g => {
    const sorted = g.players.slice().sort((a,b)=>b.score-a.score);
    html += `<div style="background:var(--card);border-radius:10px;padding:10px 14px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.06);cursor:pointer" onclick="setSessionTab('game${g.gameNum}')">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-family:'Bebas Neue',cursive;letter-spacing:2px;color:var(--muted)">GAME ${g.gameNum}</span>
        <span style="font-size:0.75rem;color:var(--gold);font-weight:700">🏆 ${g.winner}</span>
      </div>
      ${sorted.map(p=>`<div style="display:flex;justify-content:space-between;font-size:0.85rem">
        <span style="font-weight:700">${p.name}</span>
        <span style="font-family:'Bebas Neue',cursive;font-size:1.1rem;color:${p.name===g.winner?'var(--gold)':'var(--muted)'}">${p.score}</span>
      </div>`).join('')}
    </div>`;
  });
  html += '</div>';
  cont.innerHTML = html;
}

function renderSessionGame(cont, game) {
  const playerNames = game.players.map(p=>p.name);
  const upperIds = ['ones','twos','threes','fours','fives','sixes'];
  const lowerIds = categories.filter(c=>c.section==='lower').map(c=>c.id);
  const allIds = [...upperIds, ...lowerIds];

  // Build table: rows=categories, cols=players
  let html = `<div class="session-game-card">
    <div class="sgc-header">
      <div class="sgc-title">GAME ${game.gameNum}</div>
      <div class="sgc-winner">🏆 ${game.winner}</div>
    </div>
    <table class="sgc-table">
      <thead><tr>
        <th>Category</th>
        ${playerNames.map(n=>`<th>${n.length>7?n.substr(0,6)+'…':n}</th>`).join('')}
      </tr></thead>
      <tbody>`;

  // Upper section
  html += `<tr><td colspan="${playerNames.length+1}" style="background:rgba(233,69,96,0.08);padding:5px 10px;font-family:'Bebas Neue',cursive;font-size:0.75rem;letter-spacing:2px;color:var(--accent)">UPPER</td></tr>`;

  upperIds.forEach(id => {
    const cat = categories.find(c=>c.id===id);
    const vals = game.players.map(p=>(p.scores||{})[id]);
    const maxVal = Math.max(...vals.filter(v=>v!==undefined));
    html += `<tr>
      <td><div class="sgc-cat-name">${cat.name}</div></td>
      ${vals.map(v => v===undefined
        ? `<td><span class="sgc-val empty">–</span></td>`
        : `<td><span class="sgc-val ${v===maxVal&&maxVal>0?'best':''} ${v===0?'zero':''}">${v}</span></td>`
      ).join('')}
    </tr>`;
  });

  // Bonus row
  const bonusVals = game.players.map(p => {
    const ut = upperIds.reduce((s,id)=>s+((p.scores||{})[id]||0),0);
    return ut >= 63 ? 35 : 0;
  });
  html += `<tr style="background:rgba(78,205,196,0.05)">
    <td><div class="sgc-cat-name" style="color:var(--green)">+Bonus</div></td>
    ${bonusVals.map(v=>`<td><span class="sgc-val ${v>0?'best':'zero'}">${v>0?'+35':'–'}</span></td>`).join('')}
  </tr>`;

  // Lower section
  html += `<tr><td colspan="${playerNames.length+1}" style="background:rgba(233,69,96,0.08);padding:5px 10px;font-family:'Bebas Neue',cursive;font-size:0.75rem;letter-spacing:2px;color:var(--accent)">LOWER</td></tr>`;

  lowerIds.forEach(id => {
    const cat = categories.find(c=>c.id===id);
    const vals = game.players.map(p=>(p.scores||{})[id]);
    const maxVal = Math.max(...vals.filter(v=>v!==undefined));
    html += `<tr>
      <td><div class="sgc-cat-name">${cat.name}</div></td>
      ${vals.map(v => v===undefined
        ? `<td><span class="sgc-val empty">–</span></td>`
        : `<td><span class="sgc-val ${v===maxVal&&maxVal>0?'best':''} ${v===0?'zero':''}">${v}</span></td>`
      ).join('')}
    </tr>`;
  });

  // Total row
  const totals = game.players.map(p=>p.score);
  const maxTotal = Math.max(...totals);
  html += `<tr class="sgc-total-row">
    <td><div style="font-family:'Bebas Neue',cursive;letter-spacing:2px;color:var(--white)">TOTAL</div></td>
    ${totals.map(t=>`<td><span style="font-family:'Bebas Neue',cursive;font-size:1.3rem;color:${t===maxTotal?'var(--gold)':'var(--muted)'}">${t}</span></td>`).join('')}
  </tr>`;

  html += '</tbody></table></div>';
  cont.innerHTML = html;
}


function showConfirm(msg, yesLabel, onYes) {
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmYes').textContent = yesLabel;
  document.getElementById('confirmYes').onclick = function() { closeConfirm(); onYes(); };
  document.getElementById('confirmModal').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('open');
}


// Auto-fill room code if ?join=XXXX in URL
(function() {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  if(joinCode) {
    // Wait for DOM then prefill
    window.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('joinCode');
      if(el) el.value = joinCode.toUpperCase();
    });
    // Also try immediately
    const el = document.getElementById('joinCode');
    if(el) el.value = joinCode.toUpperCase();
  }
})();


// ─── QR CODE SCANNER (lobby) ─────────────────────────────────────────
async function scanQrCode(event) {
  const file = event.target.files[0];
  if(!file) return;
  showLobbyErr('📷 Reading QR code…');

  const base64 = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = () => rej();
    reader.readAsDataURL(file);
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 } },
            { type: 'text', text: 'This is a QR code for a YUM dice game. Extract the room code from the URL in the QR code. The room code is a 4-letter code that appears after "?join=" in the URL. Reply with ONLY the 4 letters, nothing else. If you cannot read it, reply with NULL.' }
          ]
        }]
      })
    });
    const data = await response.json();
    const raw = (data.content?.[0]?.text || '').trim().toUpperCase();

    if(!raw || raw === 'NULL' || raw.length !== 4) {
      showLobbyErr('❌ Could not read QR code — try again');
    } else {
      document.getElementById('joinCode').value = raw;
      document.getElementById('lobbyErr').textContent = '✅ Room code scanned!';
      document.getElementById('lobbyErr').style.color = 'var(--green)';
      setTimeout(() => {
        document.getElementById('lobbyErr').textContent = '';
        document.getElementById('lobbyErr').style.color = '';
      }, 2000);
    }
  } catch(e) {
    showLobbyErr('❌ Scan failed — type the code manually');
  }
  event.target.value = '';
}


function syncDiceUI() {
  const restricted = mpMode || botMode;
  const dieLabel  = document.querySelector('.die-label');
  const scanLabel = document.querySelector('label[for="camInput"]');
  if(dieLabel)  dieLabel.style.display  = restricted ? 'none' : '';
  if(scanLabel) scanLabel.style.display = restricted ? 'none' : '';
}


function viewMpOpponent(id) {
  const p = allPlayers[id];
  if(!p) return;
  openOppViewer(id, p.name, p.scores || {}, {});
}


// Warn before page refresh/close during active game
window.addEventListener('beforeunload', function(e) {
  if(mpMode || botMode) {
    e.preventDefault();
    e.returnValue = '';
  }
});


function showYourTurnPop(sub) {
  const pop = document.getElementById('yourTurnPop');
  const subEl = document.getElementById('yourTurnSub');
  if(subEl) subEl.textContent = sub || 'ROLL THE DICE';
  // Reset animation
  const box = pop.querySelector('.your-turn-box');
  box.style.animation = 'none';
  void box.offsetWidth;
  box.style.animation = '';
  pop.classList.add('show');
  setTimeout(() => pop.classList.remove('show'), 2400);
}


// ─── FIRST ROLL TO DECIDE WHO STARTS ────────────────────────────────
const FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
