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
  btn.innerHTML = soundEnabled
    ? '<i class="icn icn-sound-on"></i>'
    : '<i class="icn icn-sound-off"></i>';
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
  if (!soundEnabled) { btn.innerHTML = '<i class="icn icn-sound-off"></i>'; btn.classList.add('muted'); }
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
  { id:'threeKind', name:'3 of a Kind', icon:'icn-target', hint:'≥3 same → sum all dice (max 30)', max:30, section:'lower', calc: d=>{const c=counts(d);return Object.values(c).some(v=>v>=3)?d.reduce((a,b)=>a+b,0):0} },
  { id:'fourKind',  name:'4 of a Kind', icon:'icn-flame',  hint:'≥4 same → sum all dice (max 30)', max:30, section:'lower', calc: d=>{const c=counts(d);return Object.values(c).some(v=>v>=4)?d.reduce((a,b)=>a+b,0):0} },
  { id:'fullHouse', name:'Full House',  icon:'icn-home',   hint:'3+2 of a kind → 25 pts', max:25, section:'lower', calc: d=>{const v=Object.values(counts(d)).sort();return(v[0]===2&&v[1]===3)||v[0]===5?25:0} },
  { id:'smStraight',name:'Sm. Straight',icon:'icn-flag',   hint:'4 sequential → 30 pts', max:30, section:'lower', calc: d=>{const u=[...new Set(d)].sort((a,b)=>a-b);const s=u.join('');return['1234','2345','3456'].some(p=>s.includes(p))?30:0} },
  { id:'lgStraight',name:'Lg. Straight',icon:'icn-bolt',   hint:'5 sequential → 40 pts', max:40, section:'lower', calc: d=>{const u=[...new Set(d)].sort((a,b)=>a-b);return(u.length===5&&u[4]-u[0]===4)?40:0} },
  { id:'yum',       name:'YAM!',        icon:'icn-trophy', hint:'5 of a kind → 50 pts', max:50, section:'lower', calc: d=>{return Object.values(counts(d)).some(v=>v===5)?50:0} },
  { id:'chance',    name:'Chance',      icon:'icn-gem',    hint:'Any roll → sum all dice (max 30)', max:30, section:'lower', calc: d=>d.reduce((a,b)=>a+b,0) },
];

const UPPER_IDS = ['ones','twos','threes','fours','fives','sixes'];
const BONUS_TARGET = 63;
const BONUS_POINTS = 35;

let scores = {};
let playerScoreDice = {}; // stores dice used per category for the local player
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
  if(botMode && !playerTurn) { showToast('Wait for the bot!'); return; }
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
    let _pdc = null; try { _pdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch(e) {}
    roomRef.child('players/' + playerId + '/liveDice').set({
      dice: dice, held: held, roll: 3 - rollsLeft, skin: _skinId, perDieColors: _pdc, ts: Date.now()
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
  if(botMode && !playerTurn) { showToast('Wait for the bot!'); return; }
  if(dice[i] === 0) return;
  held[i] = !held[i];
  held[i] ? SFX.hold() : SFX.unhold();
  renderDice();
  // Sync hold state so opponents see which dice are locked
  if(mpMode && roomRef) {
    const _skinId = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
    let _pdc = null; try { _pdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch(e) {}
    roomRef.child('players/' + playerId + '/liveDice').set({
      dice: dice, held: held, roll: 3 - rollsLeft, skin: _skinId, perDieColors: _pdc, ts: Date.now()
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
      el.classList.remove('die-spin', 'die-rolled-same');
      void el.offsetWidth; // force reflow
      el.classList.add('die-spin');
      if(wasRolled && !faceChanged) el.classList.add('die-rolled-same');
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
      <div class="bonus-label">${iconHtml('icn-gift',{size:'1.2em'})} UPPER BONUS</div>
      <div class="bonus-sub">${upperTotal}/${BONUS_TARGET} pts → +35 bonus${bonusEarned?' <i class="icn icn-check icn-green"></i>':''}</div>
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
  if(botMode && !playerTurn) { showToast('Wait for the bot!'); return; }
  if(mpMode && currentTurnId !== playerId) { showToast("It's not your turn!"); return; }
  // Can't re-score already filled categories
  if(scores[id] !== undefined) { showToast('Already scored!'); return; }
  activeModal = id;
  const cat = categories.find(c=>c.id===id);
  const val = scores[id];
  document.getElementById('modalTitle').innerHTML = `${iconHtml(cat.icon,{color:'var(--gold)'})} ${cat.name}`;
  document.getElementById('modalHint').textContent = cat.hint;

  const qs = document.getElementById('quickScores');
  let btns = '';

  const allSet = dice.every(v => v > 0);

  if(allSet) {
    const rolled_score = cat.calc(dice);
    const pct = Math.round((rolled_score / cat.max) * 100);
    const diceIcons = dice.map(v => `<span style="display:inline-block;width:22px;height:22px;vertical-align:-6px;margin-right:2px">${dieIcon(v)}</span>`).join('');

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
      ? '<i class="icn icn-close"></i> Strike — no matching dice (0 pts)'
      : '<i class="icn icn-close"></i> Strike (0 pts)';
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
        <i class="icn icn-dice"></i> Roll your dice first to see your score
      </div>
      <div style="width:100%">
        <button class="quick-btn ${val===0?'active':''}"
          onclick="selectScore(0)"
          style="width:100%;text-align:left;padding:12px 16px;border-radius:12px;
                 background:rgba(233,69,96,0.08);border-color:rgba(233,69,96,0.3)">
          <span style="color:var(--accent)"><i class="icn icn-close"></i> Strike (0 pts)</span>
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
  playerScoreDice[activeModal] = dice.slice();
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
  }
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
  return d.filter(v=>v>0).map(v=>`<span style="display:inline-block;width:18px;height:18px;vertical-align:-4px;margin-right:1px">${dieIcon(v)}</span>`).join('');
}

function holdDesc(initHeld) {
  const kept = initHeld.filter(v=>v>0);
  const reroll = initHeld.filter(v=>v===0).length;
  if(kept.length===0) return 'Re-roll all 5 dice';
  if(kept.length===5) return 'Keep all — score now!';
  return `Keep ${diceLabel(initHeld)} · re-roll ${reroll}`;
}

function closePrediction() {
  const panel = document.getElementById('predOverlay');
  if(panel) panel.classList.remove('open');
}

function closePredictionOverlay(e) {
  if(e && e.target && e.target.id === 'predOverlay') closePrediction();
}

function runPrediction() {
  if(!dice.every(v=>v>0)) return;
  const panel = document.getElementById('predOverlay');
  const cont  = document.getElementById('predContent');
  panel.classList.add('open');
  cont.innerHTML='<div class="pred-spinner"><i class="icn icn-orb"></i> Simulating… hang tight</div>';

  setTimeout(()=>{
    const unfilledCats = categories.filter(c=>scores[c.id]===undefined);
    if(unfilledCats.length===0){
      cont.innerHTML='<div class="pred-spinner"><i class="icn icn-check icn-green"></i> All categories filled!</div>';
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

    // (medal icons now provided via .icn-medal class with rank colors)

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
          <div style="font-weight:800;font-size:1rem;color:#c084fc"><i class="icn icn-trophy"></i> YAM! Chance</div>
          <div style="font-family:'Bebas Neue',cursive;font-size:1.6rem;color:${yColor}">${yPct}%</div>
        </div>
        <div style="font-size:0.8rem;color:var(--gold);margin-bottom:6px;font-weight:700"><i class="icn icn-target"></i> ${holdDesc(yr.initHeld)}</div>
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
        <div class="pred-cat">${iconHtml(r.cat.icon,{color:'var(--gold)'})} ${r.cat.name}</div>
        <div class="pred-hold"><i class="icn icn-target"></i> ${holdDesc(r.initHeld)}</div>
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
    const ov = document.getElementById('predOverlay');
    if(ov) ov.classList.remove('open');
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
  setStatus('loading', '<i class="icn icn-search"></i> Analysing dice…');

  try {
    const results = await scanDiceFromImage(file);
    if(!results || results.length === 0) {
      setStatus('err', '<i class="icn icn-close"></i> Could not detect dice — try better lighting & flat surface');
      event.target.value = ''; return;
    }
    for(let i=0;i<5;i++) { dice[i] = i < results.length ? results[i] : 0; held[i] = false; }
    rolled = dice.some(v=>v>0);
    renderDice(); renderScores();
    const count = results.length;
    if(count === 5) {
      const dHtml = results.map(v=>`<span style="display:inline-block;width:18px;height:18px;vertical-align:-4px">${dieIcon(v)}</span>`).join(' ');
      setStatus('ok', `<i class="icn icn-check"></i> Detected: ${dHtml}`);
    } else {
      setStatus('ok', `<i class="icn icn-warn"></i> Found ${count} dice — set rest manually`);
    }
  } catch(err) {
    console.error(err);
    setStatus('err', '<i class="icn icn-close"></i> Scan failed — try again with better lighting');
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
  el.innerHTML = msg;
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
  return '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 100 100" style="border-radius:8px;flex-shrink:0;display:block;max-width:100%;max-height:100%">'
    + '<rect width="100" height="100" rx="20" fill="#1e8a9e"/>'
    + dots + '</svg>';
}

// Inline brand-themed SVG icons for the scorecard categories.
// Rendered directly (not via CSS mask) so they display correctly even on
// stale-cache devices and never fall back to system emoji glyphs.
const INLINE_SVG_ICONS = {
  'icn-target':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<circle cx="16" cy="16" r="14" fill="#1a1a2e" stroke="#f5a623" stroke-width="2"/>'
    + '<circle cx="16" cy="16" r="10" fill="none" stroke="#f5a623" stroke-width="1.6"/>'
    + '<circle cx="16" cy="16" r="6" fill="none" stroke="#e94560" stroke-width="1.6"/>'
    + '<circle cx="16" cy="16" r="2.6" fill="#e94560"/>'
    + '</svg>',
  'icn-flame':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<defs><linearGradient id="flameG" x1="0" y1="1" x2="0" y2="0">'
    + '<stop offset="0%" stop-color="#e94560"/><stop offset="60%" stop-color="#f5a623"/>'
    + '<stop offset="100%" stop-color="#ffd166"/></linearGradient></defs>'
    + '<path d="M16 2c2 4 6 7 6 12a6 6 0 0 1-1.5 4c2.2 1.2 4 3.6 4 7a8.5 8.5 0 0 1-17 0c0-2.6 1.2-4.8 2.8-6.4 0 0 1.2 2.4 2.7 2.4 0-4 0-9 3-19z" fill="url(#flameG)"/>'
    + '<path d="M16 12c1 2 2.5 3.6 2.5 6a3 3 0 0 1-5 2.2c0-2.5 1.2-5 2.5-8.2z" fill="#fff3c4" opacity="0.8"/>'
    + '</svg>',
  'icn-home':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<path d="M16 4 3 15h3v12h7v-7h6v7h7V15h3z" fill="#e94560"/>'
    + '<path d="M16 4 3 15h3v6l10-9 10 9v-6z" fill="#c0392b"/>'
    + '<rect x="13" y="20" width="6" height="7" fill="#1a1a2e"/>'
    + '<rect x="20" y="14" width="3" height="3" fill="#ffd166"/>'
    + '<rect x="9" y="14" width="3" height="3" fill="#ffd166"/>'
    + '</svg>',
  'icn-flag':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<rect x="3"  y="20" width="6" height="6" rx="1.2" fill="#4ecdc4"/><circle cx="6"  cy="23" r="1" fill="#1a1a2e"/>'
    + '<rect x="11" y="16" width="6" height="6" rx="1.2" fill="#4ecdc4"/><circle cx="13" cy="18" r="0.85" fill="#1a1a2e"/><circle cx="15" cy="20" r="0.85" fill="#1a1a2e"/>'
    + '<rect x="19" y="12" width="6" height="6" rx="1.2" fill="#f5a623"/><circle cx="21" cy="14" r="0.85" fill="#1a1a2e"/><circle cx="23" cy="14" r="0.85" fill="#1a1a2e"/><circle cx="22" cy="16" r="0.85" fill="#1a1a2e"/>'
    + '<rect x="23" y="4"  width="6" height="6" rx="1.2" fill="#e94560"/><circle cx="25" cy="6"  r="0.85" fill="#fff"/><circle cx="27" cy="6"  r="0.85" fill="#fff"/><circle cx="25" cy="8.5" r="0.85" fill="#fff"/><circle cx="27" cy="8.5" r="0.85" fill="#fff"/>'
    + '</svg>',
  'icn-bolt':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<defs><linearGradient id="boltG" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0%" stop-color="#ffd166"/><stop offset="100%" stop-color="#e94560"/>'
    + '</linearGradient></defs>'
    + '<path d="M18 2 5 19h7l-2 11 14-18h-7l1-10z" fill="url(#boltG)" stroke="#fff3c4" stroke-width="0.6"/>'
    + '</svg>',
  'icn-trophy':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<defs><linearGradient id="trophyG" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#ffd166"/><stop offset="100%" stop-color="#f5a623"/>'
    + '</linearGradient></defs>'
    + '<path d="M9 4h14v3h4v4a5 5 0 0 1-5 5h-.6a6 6 0 0 1-4.4 4.6V23h4v3H11v-3h4v-2.4A6 6 0 0 1 10.6 16H10a5 5 0 0 1-5-5V7h4V4zm0 5H7v2a3 3 0 0 0 2 2.8V9zm14 0v4.8A3 3 0 0 0 25 11V9h-2z" fill="url(#trophyG)" stroke="#7a4a00" stroke-width="0.4"/>'
    + '</svg>',
  'icn-gem':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<defs><linearGradient id="gemG" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#9be7e0"/><stop offset="100%" stop-color="#4ecdc4"/>'
    + '</linearGradient></defs>'
    + '<path d="M8 4h16l5 8-13 16L3 12z" fill="url(#gemG)" stroke="#0f3a3a" stroke-width="0.6"/>'
    + '<path d="M8 4 12 12H3z" fill="#7be0d4"/>'
    + '<path d="M24 4 20 12h9z" fill="#2bb5ad"/>'
    + '<path d="M12 12 16 28 20 12z" fill="#39c1b6"/>'
    + '<path d="M8 4 12 12 16 4zM16 4l4 8 4-8z" fill="#bff3ec" opacity="0.55"/>'
    + '</svg>',
  'icn-gift':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<rect x="4" y="13" width="24" height="16" rx="2" fill="#e94560"/>'
    + '<rect x="4" y="13" width="24" height="4" fill="#c0392b"/>'
    + '<rect x="14" y="13" width="4" height="16" fill="#f5a623"/>'
    + '<rect x="3" y="9" width="26" height="5" rx="1.2" fill="#f5a623"/>'
    + '<rect x="14" y="9" width="4" height="5" fill="#ffd166"/>'
    + '<path d="M16 9c-3-3-7-2-7 1s4 3 7 1c3 2 7 2 7-1s-4-4-7-1z" fill="#ffd166" stroke="#7a4a00" stroke-width="0.4"/>'
    + '</svg>',
  'icn-dice':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">'
    + '<rect x="5" y="5" width="22" height="22" rx="4" fill="#fff7cc" stroke="#f5a623" stroke-width="1.4"/>'
    + '<circle cx="11" cy="11" r="2" fill="#e94560"/><circle cx="21" cy="11" r="2" fill="#e94560"/>'
    + '<circle cx="16" cy="16" r="2" fill="#e94560"/>'
    + '<circle cx="11" cy="21" r="2" fill="#e94560"/><circle cx="21" cy="21" r="2" fill="#e94560"/>'
    + '</svg>'
};

function inlineIconSvg(icon, sizePx, displayCss) {
  const svg = INLINE_SVG_ICONS[icon];
  if(!svg) return null;
  const size = sizePx || 28;
  const display = displayCss || 'inline-block';
  return '<span class="yum-inline-icn" data-icn="'+icon+'" style="display:'+display+';width:'+size+'px;height:'+size+'px;line-height:0;flex-shrink:0">'+svg+'</span>';
}

function renderIcon(icon) {
  if(icon && icon.startsWith('d') && icon.length===2) {
    return dieIcon(parseInt(icon[1]));
  }
  const inline = icon && icon.startsWith('icn-') ? inlineIconSvg(icon, 28, 'inline-block') : null;
  if(inline) return inline;
  if(icon && icon.startsWith('icn-')) {
    return '<i class="icn '+icon+'" style="font-size:1.5rem;color:var(--gold)"></i>';
  }
  return '<span style="font-size:1.3rem">'+icon+'</span>';
}

// HTML for the icon used in modal titles/inline text — sized to match text
function iconHtml(icon, opts) {
  opts = opts || {};
  const size = opts.size || '1.1em';
  const color = opts.color || 'currentColor';
  if(icon && icon.startsWith('d') && icon.length===2) {
    return '<span style="display:inline-block;vertical-align:-0.25em;width:'+size+';height:'+size+'">'+dieIcon(parseInt(icon[1]))+'</span>';
  }
  if(icon && icon.startsWith('icn-') && INLINE_SVG_ICONS[icon]) {
    return '<span style="display:inline-block;vertical-align:-0.25em;width:'+size+';height:'+size+';line-height:0">'+INLINE_SVG_ICONS[icon]+'</span>';
  }
  if(icon && icon.startsWith('icn-')) {
    return '<i class="icn '+icon+'" style="font-size:'+size+';color:'+color+'"></i>';
  }
  return '<span>'+icon+'</span>';
}


// ─── MULTIPLAYER ────────────────────────────────────────────────────
let mpMode = false;
let roomCode = null;
// playerId is tied to firebase auth.uid as soon as auth is ready so that
// reloading the page mid-match keeps the same slot. We seed with a temp
// random id only as a fallback until auth resolves.
let playerId = 'p_' + Math.random().toString(36).substr(2,9);
function _yumApplyAuthPlayerId() {
  try {
    const u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
    if (u && u.uid) playerId = u.uid;
  } catch(e) {}
}
_yumApplyAuthPlayerId();
try {
  if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(u => {
      if (u && u.uid && !mpMode) playerId = u.uid;
    });
  }
} catch(e) {}
let playerName = 'Player';
let isHost = false;
let roomRef = null;
let allPlayers = {};
let currentTurnId = null;
let previousPlayerCount = null;
let previousPlayers = {};
let prevOpponentScores = {}; // track opponent score counts for change detection
let prevOpponentPowerups = {}; // track opponent powerup state for change detection
const POWERUP_ICONS = { extraRoll:'<i class="icn icn-dice"></i>', freezeDie:'<i class="icn icn-gem"></i>', doublePoints:'<i class="icn icn-sparkle"></i>', luckyDice:'<i class="icn icn-star"></i>', undoMove:'<i class="icn icn-refresh"></i>' };
let mpGameOverShown = false;

function genCode() {
  // Firebase rules require ^[A-Z0-9]{4,8}$, so guarantee exactly 4 chars
  // from a fixed alphabet (no ambiguous 0/O/1/I) instead of relying on
  // Math.random().toString(36).substr(2,4) which can occasionally return
  // fewer than 4 chars when the random value is small.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function getLobbyName() {
  const n = document.getElementById('playerName').value.trim();
  if(!n) { showLobbyErr('Enter your name first!'); return null; }
  if (typeof window.yumValidateUsername === 'function') {
    const check = window.yumValidateUsername(n);
    if (!check.ok) { showLobbyErr(check.reason); return null; }
  }
  try { localStorage.setItem('yum_last_username', n); } catch(e) {}
  return n;
}

function showLobbyErr(msg, opts) {
  const el = document.getElementById('lobbyErr');
  if (!el) return;
  if (opts && opts.text) {
    el.textContent = msg;
  } else {
    el.innerHTML = msg;
  }
  if (window.__yumLobbyErrTimer) clearTimeout(window.__yumLobbyErrTimer);
  const hold = (opts && typeof opts.holdMs === 'number') ? opts.holdMs : 3000;
  window.__yumLobbyErrTimer = setTimeout(()=>{ el.textContent = ''; }, hold);
}

async function createGame() {
  if (window.__yumCreateGameInFlight) return;
  window.__yumCreateGameInFlight = true;
  try {
    const name = getLobbyName(); if(!name) return;
    playerName = name;
    isHost = true;
    roomCode = genCode();

    showLobbyErr('<i class="icn icn-dice"></i> Creating room…');

    if(!window.db) {
      if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
      for (let i = 0; i < 12 && !window.db; i++) {
        await new Promise(r => setTimeout(r, 250));
        if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
      }
    }
    const _db = window.db;
    if(!_db) {
      showLobbyErr('Multiplayer not available — check your internet and reload.');
      return;
    }
    let _authUser = null;
    try {
      if (typeof window.ensureFirebaseAuth === 'function') {
        _authUser = await Promise.race([
          window.ensureFirebaseAuth(),
          new Promise(r => setTimeout(() => r(null), 7000))
        ]);
      }
    } catch(e) { console.warn('auth wait failed:', e); }
    if (!_authUser) {
      showLobbyErr('Sign-in failed — check your internet and reload.');
      return;
    }
    // Use firebase auth.uid as the player slot key so a page refresh during a
    // match returns to the same slot (and so server-side rules can map the
    // slot to the authenticated user).
    playerId = _authUser.uid;
    const _joinSkin = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
    let _joinPdc = null; try { _joinPdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch(e) {}
    // Try up to 6 codes to dodge any in-flight collisions. Each attempt uses a
    // transaction so two clients racing for the same code can't both win.
    const MAX_CODE_ATTEMPTS = 6;
    let createOk = false;
    let lastErr = null;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !createOk; attempt++) {
      if (attempt > 0) roomCode = genCode();
      const candidateRef = _db.ref('rooms/' + roomCode);
      const newRoom = {
        host: playerId,
        started: false,
        currentTurn: playerId,
        gameMode: 'normal',
        players: {
          [playerId]: { name: playerName, uid: _authUser.uid, scores: {}, joined: Date.now(), skin: _joinSkin, perDieColors: _joinPdc }
        }
      };
      try {
        const txnPromise = candidateRef.transaction(function(curr) {
          // Abort if the slot is already taken — caller will retry with a new code.
          if (curr) return undefined;
          return newRoom;
        });
        const result = await Promise.race([
          txnPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))
        ]);
        if (result && result.committed) {
          roomRef = candidateRef;
          createOk = true;
          break;
        }
        // Not committed → collision; loop to try a new code.
        lastErr = new Error('collision');
      } catch(err) {
        lastErr = err;
        // Network/timeout/permission errors abort the retry loop — only collisions
        // (transaction returned undefined) are worth retrying.
        break;
      }
    }
    if (!createOk) {
      console.warn('createGame failed:', lastErr);
      const err = lastErr || new Error('unknown');
      const code = (err && (err.code || err.name)) || 'unknown';
      const detail = (err && err.message) || String(err);
      const connected = (window.yumFirebaseConnected === true) ? 'online' : 'offline';
      const dbPresent = !!window.db;
      let msg;
      if (err && err.message === 'timeout') {
        msg = `Timeout creating room (db=${dbPresent}, fb=${connected}). Tap Create to retry.`;
      } else if (err && err.message === 'collision') {
        msg = 'All tried room codes were taken — tap Create to try again.';
      } else {
        msg = `Create failed: ${code} — ${detail} (db=${dbPresent}, fb=${connected})`;
      }
      showLobbyErr(msg, { text: true, holdMs: 15000 });
      try { if (roomRef) { roomRef.off(); } } catch(e) {}
      roomRef = null;
      return;
    }

    // Soft-disconnect: mark a timestamp on disconnect instead of removing the
    // slot, so a temporary network drop (subway, lockscreen, app background)
    // doesn't immediately cancel the match. A sweeper enforces the grace
    // window and removes the slot if the player stays gone too long.
    try {
      const _ts = (window.firebase && firebase.database && firebase.database.ServerValue)
        ? firebase.database.ServerValue.TIMESTAMP : Date.now();
      roomRef.child('players/' + playerId + '/disconnectedAt').onDisconnect().set(_ts);
    } catch(e) {
      roomRef.child('players/' + playerId).onDisconnect().remove();
    }
    setTimeout(() => { if (typeof window.publishMyDiceSkin === 'function') window.publishMyDiceSkin(); }, 200);

    // Mark this client as the host that just created the room so listenRoom
    // can ignore a transient empty snapshot during the first ~3s instead of
    // bouncing the user back to the lobby via leaveGame().
    window.__yumJustCreatedAt = Date.now();
    showWaiting();
    listenRoom();
  } finally {
    window.__yumCreateGameInFlight = false;
  }
}

function setMpGameMode(mode) {
  if (!isHost || !roomRef) return;
  roomRef.update({ gameMode: mode });
}

async function joinGame() {
  const name = getLobbyName(); if(!name) return;
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if(code.length !== 4) { showLobbyErr('Enter a 4-letter room code'); return; }

  playerName = name;
  roomCode = code;
  isHost = false;

  if(!window.db) {
    if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    for (let i = 0; i < 12 && !window.db; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    }
  }
  const _db = window.db;
  if(!_db) { showLobbyErr('Multiplayer not available — check your internet and reload.'); return; }

  let _authUser2 = null;
  try {
    if (typeof window.ensureFirebaseAuth === 'function') {
      _authUser2 = await Promise.race([
        window.ensureFirebaseAuth(),
        new Promise(r => setTimeout(() => r(null), 7000))
      ]);
    }
  } catch(e) { console.warn('auth wait failed:', e); }
  if (!_authUser2) { showLobbyErr('Sign-in failed — check your internet and reload.'); return; }
  // Use firebase auth.uid as the player slot key (see createGame for rationale).
  playerId = _authUser2.uid;

  let snap;
  try {
    snap = await _db.ref('rooms/' + code).once('value');
  } catch(err) {
    console.warn('joinGame failed:', err);
    showLobbyErr('Could not reach server. Tap Join again to retry.');
    return;
  }
  if(!snap.exists()) { showLobbyErr('Room not found! Check the code.'); return; }
  // Allow rejoin: a started game is OK if the auth.uid already has a slot
  // (e.g. page reload mid-match). Otherwise block as before.
  const _roomVal = snap.val();
  const _existingSlot = _roomVal.players && _roomVal.players[playerId];
  if(_roomVal.started && !_existingSlot) { showLobbyErr('Game already started!'); return; }

  roomRef = _db.ref('rooms/' + code);
  const _joinSkin2 = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
  let _joinPdc2 = null; try { _joinPdc2 = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch(e) {}
  if (_existingSlot) {
    // Rejoin: keep scores/joined, just refresh presence + skin/name and clear
    // any prior soft-disconnect marker.
    await roomRef.child('players/' + playerId).update({
      name: playerName, uid: _authUser2.uid, skin: _joinSkin2, perDieColors: _joinPdc2,
      disconnectedAt: null
    });
    if (_roomVal.started) {
      mpMode = true;
      // Skip the waiting overlay since the game is already in progress.
      document.getElementById('lobbyOverlay').style.display = 'none';
    } else {
      showWaiting();
    }
  } else {
    await roomRef.child('players/' + playerId).set({
      name: playerName, uid: _authUser2.uid, scores: {}, joined: Date.now(), skin: _joinSkin2, perDieColors: _joinPdc2
    });
    showWaiting();
  }
  // Soft-disconnect: mark a timestamp on disconnect; a sweeper removes the
  // slot only if the player stays gone past the grace window.
  try {
    const _ts = (window.firebase && firebase.database && firebase.database.ServerValue)
      ? firebase.database.ServerValue.TIMESTAMP : Date.now();
    roomRef.child('players/' + playerId + '/disconnectedAt').onDisconnect().set(_ts);
  } catch(e) {
    roomRef.child('players/' + playerId).onDisconnect().remove();
  }
  setTimeout(() => { if (typeof window.publishMyDiceSkin === 'function') window.publishMyDiceSkin(); }, 200);

  listenRoom();
}

function showWaiting() {
  document.getElementById('lobbyOverlay').style.display = 'none';
  const w = document.getElementById('waitingOverlay');
  w.style.display = 'flex';
  document.getElementById('displayCode').textContent = roomCode;

  // Generate QR code with the room code embedded in the page URL.
  // Wrap in try/catch so a missing/blocked QR library can't bubble up
  // and prevent showWaiting() from finishing its overlay swap.
  try {
    const qrEl = document.getElementById('qrCode');
    if (qrEl && typeof QRCode === 'function') {
      qrEl.innerHTML = '';
      const joinUrl = window.location.href.split('?')[0] + '?join=' + roomCode;
      new QRCode(qrEl, {
        text: joinUrl,
        width: 160, height: 160,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  } catch(e) {
    console.warn('QR code render failed:', e);
  }
}

function listenRoom() {
  roomRef.on('value', snap => {
    if(!snap.exists()) {
      // Right after createGame the host's local cache may briefly report
      // the room as missing while the server confirms the write. Don't
      // kick the user back to the lobby in that window — wait for the
      // next snapshot which will have the real data.
      const justCreated = window.__yumJustCreatedAt && (Date.now() - window.__yumJustCreatedAt < 6000);
      if (justCreated) return;
      leaveGame();
      return;
    }
    // Once we get a real snapshot we no longer need the grace window.
    window.__yumJustCreatedAt = 0;
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

    // Update game mode selector
    const gm = data.gameMode || 'normal';
    const normalBtn  = document.getElementById('mpModeNormalBtn');
    const powerupBtn = document.getElementById('mpModePowerupBtn');
    const modeInfo   = document.getElementById('mpModeInfo');
    if(normalBtn && powerupBtn) {
      normalBtn.classList.toggle('active', gm === 'normal');
      powerupBtn.classList.toggle('active', gm === 'powerup');
      normalBtn.disabled  = !isHost;
      powerupBtn.disabled = !isHost;
      if(modeInfo) modeInfo.textContent = gm === 'powerup'
        ? 'Roll 5-of-a-kind to earn power-ups!'
        : 'Standard rules, no power-ups';
    }

    if(data.started && document.getElementById('waitingOverlay').style.display !== 'none') {
      // Game started!
      document.getElementById('waitingOverlay').style.display = 'none';
      mpMode = true;
      mpGameOverShown = false;
      document.getElementById('mpBanner').style.display = 'block';
      document.getElementById('leaderboard').style.display = 'block';
      document.getElementById('mpCodeBadge').textContent = roomCode;
      scores = {}; playerScoreDice = {}; // reset local scores
      renderScores();
      syncDiceUI();

      // Activate power-up mode if the room was set to power-up mode
      if((data.gameMode || 'normal') === 'powerup') {
        powerupMode = true;
        playerPowerups = [];
        pendingPowerup = null;
        doublePointsActive = false;
        undoPowerupState = null;
        freezeDieIndex = -1;
        frozenDieValue = 0;
        if (typeof pendingFreezeIdx !== 'undefined') {
          pendingFreezeIdx = -1;
          pendingFreezeVal = 0;
        }
        renderPowerupBar();
      }

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

      // Re-activate power-up mode if Firebase says so but local state was lost
      // (e.g. page reload mid-game — the waiting-overlay transition won't fire again)
      if((data.gameMode || 'normal') === 'powerup' && !powerupMode) {
        powerupMode = true;
        playerPowerups = [];
        pendingPowerup = null;
        doublePointsActive = false;
        undoPowerupState = null;
        freezeDieIndex = -1;
        frozenDieValue = 0;
        if (typeof pendingFreezeIdx !== 'undefined') {
          pendingFreezeIdx = -1;
          pendingFreezeVal = 0;
        }
        renderPowerupBar();
      }
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
        const prevNames = Object.keys(previousPlayers || {});
        const currNames = Object.keys(data.players || {});
        const leftId = prevNames.find(id => !currNames.includes(id));
        const leftName = (previousPlayers[leftId] || {}).name || 'A player';
        if(leftId !== playerId) {
          // With ≥2 surviving players, the match continues with the
          // remaining players — only cancel when we're down to 1 (no game
          // possible). Pass surviving count so the popup can decide.
          showPlayerLeftPopup(leftName, currentCount);
          // If it was the leaver's turn, advance to the next player so
          // the game doesn't stall waiting on a ghost.
          if (currentTurnId === leftId && isHost) {
            const order = Object.entries(data.players || {})
              .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))
              .map(e => e[0]);
            if (order.length) {
              const next = order[0];
              try { roomRef.update({ currentTurn: next }); } catch(e) {}
            }
          }
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

    // Detect when opponent uses or activates a power-up
    if (data.started && typeof powerupMode !== 'undefined' && powerupMode) {
      Object.entries(allPlayers).forEach(([id, p]) => {
        if (id === playerId) return;
        const cur = p.livePowerups || {};
        const prev = prevOpponentPowerups[id];

        if (!prev) {
          // First snapshot — just record, no toast
          prevOpponentPowerups[id] = { inventory: (cur.inventory || []).slice(), pending: cur.pending || null };
          return;
        }

        const curInv = cur.inventory || [];
        const prevInv = prev.inventory || [];

        // Count how many of each power-up were consumed
        const prevCount = {};
        prevInv.forEach(x => prevCount[x] = (prevCount[x] || 0) + 1);
        const curCount = {};
        curInv.forEach(x => curCount[x] = (curCount[x] || 0) + 1);
        Object.keys(prevCount).forEach(pid => {
          const removed = (prevCount[pid] || 0) - (curCount[pid] || 0);
          for (let i = 0; i < removed; i++) {
            const icon = POWERUP_ICONS[pid] || '<i class="icn icn-bolt"></i>';
            const pName = (typeof POWERUPS !== 'undefined' ? (POWERUPS.find(x => x.id === pid) || {}).name : null) || pid;
            showToast(`${icon} ${p.name} used ${pName}!`);
          }
        });

        // Opponent just entered pending (die-selection) state
        if (!prev.pending && cur.pending) {
          const icon = POWERUP_ICONS[cur.pending] || '<i class="icn icn-bolt"></i>';
          const pName = (typeof POWERUPS !== 'undefined' ? (POWERUPS.find(x => x.id === cur.pending) || {}).name : null) || cur.pending;
          showToast(`${icon} ${p.name} is activating ${pName}…`);
        }

        prevOpponentPowerups[id] = { inventory: curInv.slice(), pending: cur.pending || null };
      });
      renderLeaderboard();
    }

    if(data.started && currentTurnId && currentTurnId !== playerId) {
      const oppLive = allPlayers[currentTurnId]?.liveDice;
      const oppName = allPlayers[currentTurnId]?.name || 'Opponent';
      const oppSkin = allPlayers[currentTurnId]?.skin || 'classic';
      if(oppLive && oppLive.dice) {
        showOpponentDiceInRoller(oppLive, oppName);
      } else {
        // Opponent hasn't rolled yet — show their skin on empty dice so both players see the active skin
        showOpponentDiceInRoller(
          { dice: [0,0,0,0,0], held: [false,false,false,false,false], roll: 0, skin: oppSkin,
            perDieColors: allPlayers[currentTurnId]?.perDieColors || null },
          oppName
        );
        document.getElementById('rollCount').textContent = `Waiting for ${oppName} to roll…`;
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
    // Cancel any onDisconnect handlers we registered before tearing down the
    // listener — without this, the SDK keeps the registered handler bound to
    // the original ref and may fire it later (e.g. when the underlying
    // websocket finally drops), writing stale data into a room we've left.
    try { roomRef.child('players/' + playerId).onDisconnect().cancel(); } catch(e) {}
    try { roomRef.child('players/' + playerId + '/disconnectedAt').onDisconnect().cancel(); } catch(e) {}
    try { roomRef.onDisconnect().cancel(); } catch(e) {}
    roomRef.child('players/' + playerId).remove();
    roomRef.off();
    roomRef = null;
  }
  window.__yumReactionsAttachedFor = null;
  mpMode = false; roomCode = null;
  document.getElementById('waitingOverlay').style.display = 'none';
  document.getElementById('mpBanner').style.display = 'none';
  document.getElementById('leaderboard').style.display = 'none';
  document.getElementById('lobbyOverlay').style.display = 'flex';
  scores = {}; playerScoreDice = {}; renderScores();
}

function updateMpUI() {
  const isMyTurn = currentTurnId === playerId;
  const badge = document.getElementById('mpTurnBadge');
  if(isMyTurn) {
    badge.innerHTML = '<i class="icn icn-dice"></i> YOUR TURN';
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

    // Power-up inventory icons (only in powerup mode)
    let pupHtml = '';
    if (typeof powerupMode !== 'undefined' && powerupMode) {
      const inv = isMe
        ? (typeof playerPowerups !== 'undefined' ? playerPowerups : [])
        : (p.livePowerups?.inventory || []);
      const lp = isMe ? null : p.livePowerups;
      if (inv.length > 0) {
        const countMap = {};
        inv.forEach(x => countMap[x] = (countMap[x] || 0) + 1);
        const icons = Object.entries(countMap).map(([pid, cnt]) => {
          const icon = POWERUP_ICONS[pid] || '<i class="icn icn-bolt"></i>';
          const isActive = lp?.pending === pid;
          const puDef = typeof POWERUPS !== 'undefined' ? POWERUPS.find(p => p.id === pid) : null;
          const name = puDef ? puDef.name : pid;
          return `<span class="lb-pup-icon${isActive ? ' lb-pup-active' : ''}" title="${pid}">${icon} ${name}${cnt > 1 ? ` ×${cnt}` : ''}</span>`;
        }).join('');
        pupHtml = `<div class="lb-pups">${icons}</div>`;
      }
    }

    return `<div class="lb-row ${isMe?'me':''}" onclick="${tapAction}" style="cursor:pointer">
      <div class="lb-rank">${i+1}</div>
      ${isTurn ? '<div class="lb-turn-dot"></div>' : '<div style="width:8px"></div>'}
      <div class="lb-name-col">
        <div class="lb-name">${p.name}${isMe?' <i class="icn icn-tap"></i>':'<span style="font-size:0.65rem;color:var(--muted)"> <i class="icn icn-eye"></i> view</span>'}</div>
        ${pupHtml}
      </div>
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
  showToast('Score saved! ' + (allPlayers[nextId]?.name || 'Next player') + "'s turn");
}

function pushScoresToDb() {
  if(!mpMode || !roomRef) return;
  // Use a transaction (rather than set) so the write is atomic against
  // concurrent rematch resets. We also bail out if the room's roundId moved
  // past ours — that means a rematch reset happened after we started our
  // turn and our local scores belong to the previous round.
  const myRoundId = window.__yumRoundId || 0;
  const localScores = {...scores};
  const ref = roomRef.child('players/' + playerId + '/scores');
  ref.transaction(() => localScores).then(res => {
    // If we detect the round changed via the room snapshot, the listenRoom
    // sync pulls the empty server state back into local — so this write
    // can't permanently clobber the reset.
  }).catch(() => {});
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
  t.innerHTML = msg; t.classList.add('show');
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


// ─── REACTIONS — custom icon stamps (no emojis) ─────────────────────
const REACTIONS = [
  { emoji: '<i class="icn icn-check icn-green"></i>',  label: 'Nice one!' },
  { emoji: '<i class="icn icn-flame icn-red"></i>',    label: 'On fire!' },
  { emoji: '<i class="icn icn-sparkle icn-gold"></i>', label: 'Ha!' },
  { emoji: '<i class="icn icn-dice icn-gold"></i>',    label: 'Roll it!' },
  { emoji: '<i class="icn icn-trophy icn-gold"></i>',  label: 'Champion!' },
  { emoji: '<i class="icn icn-warn icn-gold"></i>',    label: 'Yikes…' },
  { emoji: '<i class="icn icn-handshake icn-green"></i>', label: 'Good job!' },
  { emoji: '<i class="icn icn-skull icn-red"></i>',    label: 'Dead!' },
  { emoji: '<i class="icn icn-star icn-gold"></i>',    label: 'Good luck!' },
  { emoji: '<i class="icn icn-gem icn-green"></i>',    label: 'Too easy' },
  { emoji: '<i class="icn icn-target icn-gold"></i>',  label: 'Bull\'s eye!' },
  { emoji: '<i class="icn icn-bolt icn-gold"></i>',    label: 'Hurry up!' },
  { emoji: '<i class="icn icn-volcano icn-red"></i>',  label: 'Party time!' },
  { emoji: '<i class="icn icn-bot icn-red"></i>',      label: 'Intense!' },
  { emoji: '<i class="icn icn-tap icn-green"></i>',    label: 'Let\'s go!' },
  { emoji: '<i class="icn icn-medal icn-gold"></i>',   label: 'Strong!' },
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
  // Use ServerValue.TIMESTAMP so all clients agree on the ordering — client
  // clocks can skew, which would otherwise drop or replay reactions for
  // listeners that filter by their own Date.now().
  const TS = (window.firebase && firebase.database && firebase.database.ServerValue)
    ? firebase.database.ServerValue.TIMESTAMP : Date.now();
  // Fan-out the reaction and the per-user throttle timestamp atomically so the
  // server-side rule can rate-limit without trusting client clocks.
  const reactionId = roomRef.child('reactions').push().key;
  const updates = {};
  updates['reactions/' + reactionId] = {
    from: playerId,
    fromName: playerName,
    to: reactionTargetId,
    toName: toName,
    emoji: r.emoji,
    label: r.label,
    uid: playerId,
    ts: TS
  };
  updates['_reactionTs/' + playerId] = TS;
  roomRef.update(updates).catch(() => {});
  closeReactionPicker();
}

function listenReactions() {
  if(!roomRef) return;
  // Guard against the wrapper around listenRoom firing this multiple times
  // (it re-fires on every snapshot of "started").
  if (window.__yumReactionsAttachedFor === roomCode) return;
  window.__yumReactionsAttachedFor = roomCode;
  // Anchor the cutoff to a server timestamp instead of the client clock —
  // skewed client clocks would otherwise miss or replay reactions.
  const _filterRef = roomRef.child('_listenAt/' + playerId);
  const TS = (window.firebase && firebase.database && firebase.database.ServerValue)
    ? firebase.database.ServerValue.TIMESTAMP : Date.now();
  const attachWith = startAt => {
    roomRef.child('reactions').orderByChild('ts').startAt(startAt).on('child_added', s => {
      const r = s.val();
      if(!r) return;
      showReactionBubble(r);
    });
  };
  _filterRef.set(TS).then(() => _filterRef.once('value')).then(snap => {
    attachWith((snap && snap.val()) || Date.now());
  }).catch(() => attachWith(Date.now()));
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
  const _db = window.db;
  if (!_db || !roomCode) return;
  _db.ref('rooms/' + roomCode + '/started').on('value', snap => {
    if(snap.val() === true) listenReactions();
  });
};


// ─── VS BOT ─────────────────────────────────────────────────────────
let botMode = false;
let botScores = {};
let botName = 'Bot';
let playerTurn = true; // true = human, false = bot
let botThinkTimeout = null;

function openBotModeChoice() {
  const name = document.getElementById('playerName').value.trim();
  if(!name) { showLobbyErr('Enter your name first!'); return; }
  if (typeof window.yumValidateUsername === 'function') {
    const check = window.yumValidateUsername(name);
    if (!check.ok) { showLobbyErr(check.reason); return; }
  }
  document.getElementById('botModeModal').classList.add('open');
}

function closeBotModeChoice() {
  document.getElementById('botModeModal').classList.remove('open');
}

function chooseBotMode(mode) {
  document.getElementById('botModeModal').classList.remove('open');
  startVsBot(mode);
}

function startVsBot(mode) {
  const name = document.getElementById('playerName').value.trim();
  if(!name) { showLobbyErr('Enter your name first!'); return; }
  if (typeof window.yumValidateUsername === 'function') {
    const check = window.yumValidateUsername(name);
    if (!check.ok) { showLobbyErr(check.reason); return; }
  }
  playerName = name;
  botMode = true;
  botScores = {};
  scores = {};
  playerScoreDice = {};

  // Reset power-up state, then enable if requested
  if (typeof playerPowerups !== 'undefined') {
    playerPowerups     = [];
    pendingPowerup     = null;
    doublePointsActive = false;
    undoPowerupState   = null;
    freezeDieIndex     = -1;
    frozenDieValue     = 0;
    if (typeof pendingFreezeIdx !== 'undefined') {
      pendingFreezeIdx = -1;
      pendingFreezeVal = 0;
    }
  }
  if (typeof powerupMode !== 'undefined') {
    powerupMode = (mode === 'powerup');
  }

  document.getElementById('lobbyOverlay').style.display = 'none';
  document.getElementById('leaderboard').style.display = 'block';
  if (typeof renderPowerupBar === 'function') renderPowerupBar();
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
        showToast('Bot goes first!');
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

  const playerPupHtml = _renderBotLbPupHtml(
    typeof playerPowerups !== 'undefined' ? playerPowerups : [],
    typeof pendingPowerup !== 'undefined' ? pendingPowerup : null
  );
  const botPupHtml = _renderBotLbPupHtml(
    typeof botPowerups !== 'undefined' ? botPowerups : [],
    null
  );

  document.getElementById('lbRows').innerHTML = `
    <div class="lb-row me" style="cursor:default">
      <div class="lb-rank">${pLeading?'1':'2'}</div>
      <div style="width:8px"></div>
      <div class="lb-name-col">
        <div class="lb-name">${playerName} ${playerTurn?'<i class="icn icn-dice icn-gold"></i>':''}</div>
        ${playerPupHtml}
      </div>
      <div class="lb-filled">${pFilled}/13</div>
      <div class="lb-score">${pTotal}</div>
    </div>
    <div class="lb-row" style="cursor:pointer;background:rgba(168,85,247,0.07)" onclick="openOppViewer('bot','${botName}',botScores,botScoreDice)">
      <div class="lb-rank">${pLeading?'2':'1'}</div>
      <div style="width:8px"></div>
      <div class="lb-name-col">
        <div class="lb-name"><i class="icn icn-bot"></i> ${botName} ${!playerTurn?'<i class="icn icn-dice icn-gold"></i>':''} <span style="font-size:0.65rem;color:var(--muted)"><i class="icn icn-eye"></i> tap</span></div>
        ${botPupHtml}
      </div>
      <div class="lb-filled">${bFilled}/13</div>
      <div class="lb-score">${bTotal}</div>
    </div>`;
}

function _renderBotLbPupHtml(inv, pendingId) {
  if (typeof powerupMode === 'undefined' || !powerupMode) return '';
  if (!inv || inv.length === 0) return '';
  const countMap = {};
  inv.forEach(x => countMap[x] = (countMap[x] || 0) + 1);
  const icons = Object.entries(countMap).map(([pid, cnt]) => {
    const icon = POWERUP_ICONS[pid] || '<i class="icn icn-bolt"></i>';
    const isActive = pendingId === pid;
    const puDef = typeof POWERUPS !== 'undefined' ? POWERUPS.find(p => p.id === pid) : null;
    const name = puDef ? puDef.name : pid;
    return `<span class="lb-pup-icon${isActive ? ' lb-pup-active' : ''}" title="${pid}">${icon} ${name}${cnt > 1 ? ` ×${cnt}` : ''}</span>`;
  }).join('');
  return `<div class="lb-pups">${icons}</div>`;
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
    document.getElementById('botThinkMsg').textContent = 'Roll 1 of 3…';
    showBotDiceInRoller(botDice, botHeld, true);

    // Decide hold after roll 1
    setTimeout(() => {
      const move1 = botChooseBestMove();
      if(!move1) { finishBotTurn(null); return; }
      // Show which dice bot is holding
      botHeld = move1.held.map(v => v !== 0);
      document.getElementById('botThinkMsg').textContent = 'Holding ' + botHeld.filter(Boolean).length + ' dice…';
      showBotDiceInRoller(botDice, botHeld, false);

      // Roll 2
      setTimeout(() => {
        botDice = move1.held.map((v,i) => v === 0 ? randDie() : v);
        const move2 = botChooseBestMove();
        botHeld = move2 ? move2.held.map(v => v !== 0) : [true,true,true,true,true];
        document.getElementById('botThinkMsg').textContent = 'Roll 2 of 3…';
        showBotDiceInRoller(botDice, botHeld, true);

        setTimeout(() => {
          document.getElementById('botThinkMsg').textContent = 'Holding ' + botHeld.filter(Boolean).length + ' dice…';
          showBotDiceInRoller(botDice, botHeld, false);

          // Roll 3
          setTimeout(() => {
            if(!move2) { finishBotTurn(null); return; }
            botDice = move2.held.map((v,i) => v === 0 ? randDie() : v);
            botHeld = [true,true,true,true,true];
            document.getElementById('botThinkMsg').textContent = 'Roll 3 of 3…';
            showBotDiceInRoller(botDice, botHeld, true);

            setTimeout(() => {
              const finalMove = botChooseBestMove();
              document.getElementById('botThinkMsg').textContent = 'Scoring…';
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
  document.getElementById('bapAvatar').innerHTML = isMp
    ? '<i class="icn icn-players"></i>'
    : '<i class="icn icn-bot"></i>';
  document.getElementById('bapName').textContent = name.toUpperCase();
  const diceEl = document.getElementById('bapDice');
  if(diceArr && diceArr.length > 0) {
    diceEl.innerHTML = diceArr
      .map(v => `<span class="bap-die">${v > 0
        ? `<span style="display:inline-block;width:24px;height:24px">${dieIcon(v)}</span>`
        : '<span style="opacity:0.3">·</span>'}</span>`)
      .join('');
    diceEl.style.display = 'flex';
  } else {
    diceEl.innerHTML = '';
    diceEl.style.display = 'none';
  }
  document.getElementById('bapCat').textContent = catName;
  document.getElementById('bapScore').textContent = scored;
  document.getElementById('bapLabel').innerHTML =
    isPerfect ? 'PERFECT! <i class="icn icn-trophy icn-gold"></i>' : isZero ? 'STRUCK OUT' : 'SCORED';
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
    showToast('Your turn!');
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
    playerScoreDice[activeModal] = dice.slice();
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
  if(botMode && !playerTurn) { showToast('Wait for the bot!'); return; }
  _origCycleDie(i);
};
const _origRollDice = rollDice;
rollDice = function() {
  if(botMode && !playerTurn) { showToast('Wait for the bot!'); return; }
  _origRollDice();
};


// ─── OPPONENT SCORECARD VIEWER ───────────────────────────────────────
let botScoreDice = {}; // stores dice used per category for bot

function openOppViewer(targetId, targetName, targetScores, targetScoreDice) {
  const total = calcTotal(targetScores);
  document.getElementById('oppAvatar').innerHTML = targetId === 'bot'
    ? '<i class="icn icn-bot"></i>'
    : '<i class="icn icn-players"></i>';
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
        ? usedDice.map(v=>`<span class="opp-die-chip"><span style="display:inline-block;width:18px;height:18px;vertical-align:-4px">${dieIcon(v)}</span></span>`).join('')
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
        <div style="font-weight:800;font-size:0.85rem;color:var(--green)"><i class="icn icn-gift"></i> UPPER BONUS</div>
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

  let rollText = `${oppName} — Roll ${rollNum} / 3`;
  if (typeof powerupMode !== 'undefined' && powerupMode) {
    const oppPup = allPlayers[currentTurnId]?.livePowerups;
    if (oppPup?.pending) {
      const pName = (typeof POWERUPS !== 'undefined' ? (POWERUPS.find(x => x.id === oppPup.pending) || {}).name : null) || oppPup.pending;
      rollText += `  · Using ${pName}…`;
    } else if (oppPup?.doubleActive) {
      rollText += '  · Double Points!';
    }
  }
  document.getElementById('rollCount').textContent = rollText;
}

function showOpponentWaiting(oppName) {
  if(!myDiceUI) return; // already showing something
  document.getElementById('rollCount').textContent =
    `Waiting for ${oppName} to roll…`;
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
  document.getElementById('goTrophy').innerHTML =
    tied ? '<i class="icn icn-handshake icn-gold"></i>'
         : winner.isMe ? '<i class="icn icn-trophy icn-gold"></i>'
                       : '<i class="icn icn-skull icn-red"></i>';
  document.getElementById('goTitle').textContent =
    tied ? "IT'S A TIE!" : winner.isMe ? 'YOU WIN!' : 'YOU LOSE!';
  document.getElementById('goWinner').textContent =
    tied ? 'Dead even!' : winner.name + ' wins!';

  document.getElementById('goScores').innerHTML = players.map((p,i) =>
    `<div class="gameover-score-row">
      <div class="gameover-score-name">${i===0&&!tied?'<i class="icn icn-medal icn-gold"></i> ':''}${p.name}${p.isMe?' (you)':''}</div>
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
    scores = {}; playerScoreDice = {}; playerTurn = true;
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
          showToast('Bot goes first!');
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
    scores = {}; playerScoreDice = {}; playerTurn = true;
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
  tabs.innerHTML = `<button class="session-tab ${sessionTab==='summary'?'active':''}" onclick="setSessionTab('summary')"><i class="icn icn-clipboard"></i> Summary</button>`
    + sessionGames.map((g,i) =>
        `<button class="session-tab ${sessionTab==='game'+g.gameNum?'active':''}"
          onclick="setSessionTab('game${g.gameNum}')">
          Game ${g.gameNum}${g.winnerId==='me'?' <i class="icn icn-trophy icn-gold"></i>':''}
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
  const medalColors = ['#f5d76e', '#d3d3d3', '#cd7f32'];
  const renderMedal = (i) => i < 3
    ? `<i class="icn icn-medal" style="color:${medalColors[i]};font-size:1.4rem"></i>`
    : (i+1);

  let html = `<div class="session-summary">
    <div class="session-summary-title">STANDINGS · ${sessionGames.length} GAME${sessionGames.length!==1?'S':''}</div>`;

  sorted.forEach(([name, s], i) => {
    html += `<div class="session-summary-row">
      <div class="ssrow-rank">${renderMedal(i)}</div>
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
        <span style="font-size:0.75rem;color:var(--gold);font-weight:700"><i class="icn icn-trophy"></i> ${g.winner}</span>
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
      <div class="sgc-winner"><i class="icn icn-trophy icn-gold"></i> ${game.winner}</div>
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
  showLobbyErr('<i class="icn icn-camera"></i> Reading QR code…');

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
      showLobbyErr('<i class="icn icn-close"></i> Could not read QR code — try again');
    } else {
      document.getElementById('joinCode').value = raw;
      document.getElementById('lobbyErr').innerHTML = '<i class="icn icn-check"></i> Room code scanned!';
      document.getElementById('lobbyErr').style.color = 'var(--green)';
      setTimeout(() => {
        document.getElementById('lobbyErr').textContent = '';
        document.getElementById('lobbyErr').style.color = '';
      }, 2000);
    }
  } catch(e) {
    showLobbyErr('<i class="icn icn-close"></i> Scan failed — type the code manually');
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
  // Most callers schedule this via setTimeout, so by the time it fires the
  // turn may already have flipped to the bot/opponent. Re-check the current
  // turn state and bail if it's no longer our turn.
  if (mpMode && currentTurnId && currentTurnId !== playerId) return;
  if (botMode && playerTurn === false) return;
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
