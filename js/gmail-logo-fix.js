// Replaces the envelope emoji on the Gmail login button with a small Gmail-style logo.
(function() {
  function injectStyles() {
    if (document.getElementById('gmailLogoFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'gmailLogoFixStyles';
    style.textContent = `
      .gmail-m-logo {
        width: 22px;
        height: 16px;
        display: inline-block;
        position: relative;
        border-radius: 3px;
        background: #fff;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,.08);
        margin-right: 8px;
        flex: 0 0 auto;
      }
      .gmail-m-logo:before {
        content: '';
        position: absolute;
        inset: 3px 3px 2px 3px;
        border-left: 4px solid #EA4335;
        border-right: 4px solid #4285F4;
        border-top: 4px solid #EA4335;
        transform: skewY(-34deg);
      }
      .gmail-m-logo:after {
        content: '';
        position: absolute;
        left: 3px;
        right: 3px;
        bottom: 2px;
        height: 4px;
        background: linear-gradient(90deg, #34A853 0 25%, transparent 25% 75%, #FBBC04 75% 100%);
      }
      .gmail-login-polished {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function polishGmailButton() {
    injectStyles();
    document.querySelectorAll('button').forEach(btn => {
      const text = (btn.textContent || '').trim();
      if (!text.includes('Continue with Gmail')) return;
      if (btn.querySelector('.gmail-m-logo')) return;
      btn.classList.add('gmail-login-polished');
      btn.innerHTML = '<span class="gmail-m-logo" aria-hidden="true"></span><span>Continue with Gmail</span>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', polishGmailButton);
  } else {
    polishGmailButton();
  }
  setInterval(polishGmailButton, 1000);
})();
