(function () {
  'use strict';
  // APP_VERSION / APP_BUILD_TIME are stamped at deploy time by
  // .github/workflows/deploy-firebase-hosting.yml. On a non-deployed checkout
  // (local dev, PR previews) the tokens are left untouched, so we fall back to
  // "dev". Exposed on window so other code can compare versions if needed.
  var RAW_VERSION = '__BUILD_VERSION__';
  var RAW_TIME = '__BUILD_TIME__';

  function stamped(value) {
    return value && value.indexOf('__BUILD') !== 0 ? value : null;
  }

  var version = stamped(RAW_VERSION) || 'dev';
  var builtAt = stamped(RAW_TIME);

  window.APP_VERSION = version;
  window.APP_BUILD_TIME = builtAt;

  function render() {
    var el = document.getElementById('appVersion');
    if (!el) return;
    el.textContent = 'Yamio · ' + version;
    if (builtAt) {
      var d = new Date(builtAt);
      if (!isNaN(d.getTime())) el.title = 'Built ' + d.toLocaleString();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
