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

  function paint(label, tip) {
    var el = document.getElementById('appVersion');
    if (!el) return;
    el.textContent = 'Yamio · ' + label;
    if (tip) el.title = tip;
  }

  function render() {
    var tip = null;
    if (builtAt) {
      var d = new Date(builtAt);
      if (!isNaN(d.getTime())) tip = 'Built ' + d.toLocaleString();
    }
    paint(version, tip);

    // Inside the native app the __BUILD_VERSION__ token is never stamped (that
    // only happens on web deploy), so the label would read "dev". Replace it
    // with the real bundled app version from Capacitor, e.g. "2.0.2 (17)".
    try {
      var cap = window.Capacitor;
      var isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
      var App = isNative && cap.Plugins && cap.Plugins.App;
      if (App && typeof App.getInfo === 'function') {
        App.getInfo().then(function (info) {
          if (!info || !info.version) return;
          var label = info.version + (info.build ? ' (' + info.build + ')' : '');
          window.APP_VERSION = info.version;
          paint(label, tip);
        }).catch(function () {});
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
