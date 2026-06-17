// ─── SKIN UNLOCK CONFIRMATION POPUP ─────────────────────────────────
// Shown after a successful skin purchase. Congratulates the player and lets
// them choose to equip the new skin now or keep their current one.
// Exposes window.showSkinUnlockedPopup({ id, name, style }).

(function() {
  const DOT_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

  function injectStyles() {
    if (document.getElementById('skinUnlockPopupStyles')) return;
    const s = document.createElement('style');
    s.id = 'skinUnlockPopupStyles';
    s.textContent = `
      #skinUnlockOverlay {
        position: fixed; inset: 0; z-index: 2000;
        background: rgba(0,0,0,.78);
        display: none; align-items: center; justify-content: center;
        padding: 22px;
      }
      #skinUnlockOverlay.open { display: flex; }
      .sup-card {
        width: min(380px, 100%); background: var(--bg, #14181f);
        border: 1px solid rgba(255,255,255,.12); border-radius: 22px;
        padding: 26px 22px 20px; text-align: center;
        box-shadow: 0 18px 60px rgba(0,0,0,.55);
        transform: scale(.88); opacity: 0;
        transition: transform .28s cubic-bezier(.34,1.45,.64,1), opacity .2s ease;
      }
      #skinUnlockOverlay.open .sup-card { transform: scale(1); opacity: 1; }
      .sup-badge {
        font-size: 2.1rem; line-height: 1; margin-bottom: 8px;
      }
      .sup-title {
        font-family: 'Bebas Neue', cursive; letter-spacing: 2px;
        font-size: 1.55rem; color: var(--gold, #f5a623); margin-bottom: 4px;
      }
      .sup-sub { color: var(--muted, #9aa4b2); font-size: .82rem; font-weight: 800; }
      .sup-name {
        color: var(--white, #fff); font-weight: 1000; font-size: 1.05rem;
        margin: 10px 0 12px; letter-spacing: .4px;
      }
      .sup-preview {
        display: flex; gap: 6px; justify-content: center; margin-bottom: 18px;
      }
      .sup-preview span {
        width: 34px; height: 34px; border-radius: 9px;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.25rem; font-family: Arial, sans-serif;
        box-shadow: inset 0 0 4px rgba(0,0,0,.25);
      }
      .sup-actions { display: flex; gap: 10px; }
      .sup-btn {
        flex: 1; border-radius: 999px; padding: 12px 10px;
        font-family: Nunito, sans-serif; font-weight: 1000; letter-spacing: .6px;
        cursor: pointer; font-size: .9rem; border: 1px solid rgba(255,255,255,.14);
      }
      .sup-btn.secondary { background: rgba(255,255,255,.07); color: var(--white, #fff); }
      .sup-btn.primary {
        background: linear-gradient(135deg, var(--accent, #4ecdc4), var(--gold, #f5a623));
        color: #111; border-color: transparent;
      }
    `;
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    let ov = document.getElementById('skinUnlockOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'skinUnlockOverlay';
      document.body.appendChild(ov);
    }
    return ov;
  }

  function close() {
    const ov = document.getElementById('skinUnlockOverlay');
    if (ov) ov.classList.remove('open');
  }

  // skin: { id, name, style }. onEquip optional; defaults to window.equipSkin.
  window.showSkinUnlockedPopup = function(skin, onEquip) {
    if (!skin || !skin.id) return;
    injectStyles();
    const ov = ensureOverlay();
    const name = skin.name || 'New Dice';
    const style = skin.style || 'background:#f8f8f8;color:#111';
    const preview = DOT_FACES.map(f => `<span style="${style}">${f}</span>`).join('');

    ov.innerHTML = `
      <div class="sup-card" role="dialog" aria-modal="true">
        <div class="sup-badge">🎉</div>
        <div class="sup-title">Congratulations!</div>
        <div class="sup-sub">You unlocked a new dice skin</div>
        <div class="sup-name">${name}</div>
        <div class="sup-preview">${preview}</div>
        <div class="sup-actions">
          <button class="sup-btn secondary" id="supNotNow">Not now</button>
          <button class="sup-btn primary" id="supEquip">Equip now</button>
        </div>
      </div>`;

    ov.onclick = (e) => { if (e.target === ov) close(); };
    ov.querySelector('#supNotNow').onclick = close;
    ov.querySelector('#supEquip').onclick = () => {
      close();
      if (typeof onEquip === 'function') onEquip(skin.id);
      else if (typeof window.equipSkin === 'function') window.equipSkin(skin.id);
      // Refresh any open store surface so it reflects the equipped skin.
      if (typeof window.rhRenderHub === 'function') { try { window.rhRenderHub(); } catch (e) {} }
    };

    requestAnimationFrame(() => ov.classList.add('open'));
  };

  window.closeSkinUnlockedPopup = close;
})();
