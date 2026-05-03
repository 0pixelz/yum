// ─── YUM ROLL CELEBRATION ────────────────────────────────────────────
// When the player rolls 5 of a kind and the YUM category is still open,
// show a flash celebration and play a sound.

(function() {
  let lastCelebratedKey = '';
  let audioCtx = null;

  function injectStyles() {
    if (document.getElementById('yumRollCelebrationStyles')) return;
    const style = document.createElement('style');
    style.id = 'yumRollCelebrationStyles';
    style.textContent = `
      #yumRollFlash {
        position: fixed;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle, rgba(245,166,35,.34), rgba(233,69,96,.18) 38%, rgba(0,0,0,0) 70%);
        opacity: 0;
        transform: scale(.92);
      }
      #yumRollFlash.show {
        animation: yumFlashPop 1.2s ease-out forwards;
      }
      .yum-flash-card {
        padding: 20px 28px;
        border-radius: 28px;
        border: 2px solid rgba(245,166,35,.72);
        background: linear-gradient(135deg, rgba(15,52,96,.96), rgba(26,26,94,.94));
        box-shadow: 0 0 38px rgba(245,166,35,.55), 0 0 80px rgba(233,69,96,.28);
        text-align: center;
      }
      .yum-flash-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 3rem;
        letter-spacing: 6px;
        color: var(--gold);
        text-shadow: 0 0 22px rgba(245,166,35,.7);
        line-height: 1;
      }
      .yum-flash-sub {
        margin-top: 6px;
        font-size: .8rem;
        font-weight: 900;
        letter-spacing: 1.5px;
        color: var(--green);
      }
      .dice-section.yum-hit {
        animation: yumDiceGlow 1.15s ease-out;
      }
      .dice-section.yum-hit .die {
        animation: yumDieBounce .75s ease-out;
      }
      @keyframes yumFlashPop {
        0% { opacity: 0; transform: scale(.88); }
        16% { opacity: 1; transform: scale(1.02); }
        55% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.08); }
      }
      @keyframes yumDiceGlow {
        0%, 100% { box-shadow: none; }
        18% { box-shadow: 0 0 0 2px rgba(245,166,35,.35), 0 0 38px rgba(245,166,35,.35); }
      }
      @keyframes yumDieBounce {
        0% { transform: translateY(0) scale(1); }
        25% { transform: translateY(-8px) scale(1.08) rotate(-2deg); }
        50% { transform: translateY(0) scale(.98) rotate(2deg); }
        75% { transform: translateY(-3px) scale(1.03); }
        100% { transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFlashEl() {
    let el = document.getElementById('yumRollFlash');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'yumRollFlash';
    el.innerHTML = `
      <div class="yum-flash-card">
        <div class="yum-flash-title">YUM!</div>
        <div class="yum-flash-sub">5 OF A KIND</div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function playYumSound() {
    try {
      if (window.SFX && typeof SFX.yum === 'function') {
        SFX.yum();
        return;
      }
    } catch(e) {}

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = audioCtx || new AudioContext();
      const now = audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.0001, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.24);
      });
    } catch(e) {}
  }

  function isYumAvailable() {
    try {
      return !scores || scores.yum === undefined || scores.yum === null;
    } catch(e) {
      return true;
    }
  }

  function isFiveOfAKind(values) {
    if (!Array.isArray(values) || values.length !== 5) return false;
    if (values.some(v => !Number(v))) return false;
    return values.every(v => Number(v) === Number(values[0]));
  }

  function currentDiceValues() {
    try {
      if (Array.isArray(dice)) return dice.map(Number);
    } catch(e) {}
    return Array.from(document.querySelectorAll('.dice-section .die')).map(el => Number((el.textContent || '').trim())).filter(Boolean);
  }

  function celebrateIfNeeded() {
    const values = currentDiceValues();
    if (!isFiveOfAKind(values) || !isYumAvailable()) return;

    const key = values.join('-') + ':' + (() => { try { return rollsLeft; } catch(e) { return ''; } })();
    if (key === lastCelebratedKey) return;
    lastCelebratedKey = key;

    injectStyles();
    const flash = ensureFlashEl();
    flash.classList.remove('show');
    void flash.offsetWidth;
    flash.classList.add('show');

    const diceSection = document.querySelector('.dice-section');
    if (diceSection) {
      diceSection.classList.remove('yum-hit');
      void diceSection.offsetWidth;
      diceSection.classList.add('yum-hit');
    }

    playYumSound();
    if (window.showToast) showToast('🎉 YUM! 5 of a kind!');
  }

  function patchRollDice() {
    const original = window.rollDice;
    if (typeof original !== 'function' || original.__yumCelebrationPatched) return;
    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(celebrateIfNeeded, 520);
      return result;
    };
    patched.__yumCelebrationPatched = true;
    window.rollDice = patched;
  }

  function init() {
    injectStyles();
    patchRollDice();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(patchRollDice, 1200);
})();
