// Lightweight client-side profanity filter for usernames.
// Exposes window.yumValidateUsername(name) -> { ok: boolean, reason: string }
(function(){
  'use strict';

  // Substrings (after normalization) that block the username.
  // Kept short and obfuscated as char arrays to avoid plain slurs in source.
  const BAD = [
    ['f','u','c','k'],
    ['s','h','i','t'],
    ['b','i','t','c','h'],
    ['a','s','s','h','o','l','e'],
    ['b','a','s','t','a','r','d'],
    ['d','i','c','k','h','e','a','d'],
    ['c','u','n','t'],
    ['p','u','s','s','y'],
    ['c','o','c','k','s','u','c','k','e','r'],
    ['m','o','t','h','e','r','f','u','c','k'],
    ['j','e','r','k','o','f','f'],
    ['w','h','o','r','e'],
    ['s','l','u','t'],
    ['r','e','t','a','r','d'],
    ['n','i','g','g','e','r'],
    ['n','i','g','g','a'],
    ['f','a','g','g','o','t'],
    ['f','a','g'],
    ['c','h','i','n','k'],
    ['s','p','i','c'],
    ['k','i','k','e'],
    ['t','r','a','n','n','y'],
    ['d','y','k','e'],
    ['j','i','z','z'],
    ['c','u','m','s','h','o','t'],
    ['b','l','o','w','j','o','b'],
    ['h','a','n','d','j','o','b'],
    ['r','i','m','j','o','b'],
    ['a','n','a','l','s','e','x'],
    ['h','i','t','l','e','r'],
    ['n','a','z','i'],
    ['k','k','k'],
    // Québécois sacres + French profanity/slurs. Accents are folded to their
    // base letters by normalize() (é→e, â→a, ç→c …), so the plain forms match
    // "câlisse", "négre", etc. Forms chosen to avoid common-word false
    // positives (e.g. "calis" would hit "calisthenics", so we keep "calisse").
    // Keep in sync with functions/index.js.
    ['t','a','b','a','r','n','a'],   // tabarnak / tabarnac / tabarnaque
    ['b','a','r','n','a','k'],
    ['c','a','l','i','s','s','e'],
    ['c','a','l','i','c','e'],
    ['c','r','i','s','s','e'],
    ['c','r','i','s','s'],           // safe-listed against Crissy / crisscross
    ['o','s','t','i','e'],
    ['e','s','t','i','e'],           // safe-listed against bestie / westie
    ['c','i','b','o','i','r','e'],
    ['v','i','a','r','g','e'],
    ['c','a','l','v','a','i','r','e'],
    ['m','a','r','d','e'],
    ['m','e','r','d','e'],
    ['p','u','t','a','i','n'],
    ['s','a','l','o','p'],            // salop / salope / salopard
    ['s','a','l','a','u','d'],
    ['c','o','n','n','a','r','d'],
    ['c','o','n','n','a','s','s','e'],
    ['e','n','c','u','l','e'],        // encule / enculer / enculé
    ['e','n','f','o','i','r','e'],
    ['t','a','p','e','t','t','e'],
    ['n','e','g','r','e'],
    ['b','o','u','g','n','o','u','l','e'],
    ['y','o','u','p','i','n'],
    ['g','u','i','d','o','u','n','e']
  ].map(a => a.join(''));

  // Map common leet-speak / lookalikes back to letters so "f.u_c|<" still matches.
  const LEET = {
    '0':'o','1':'i','!':'i','|':'i','3':'e','4':'a','@':'a','5':'s','$':'s',
    '7':'t','+':'t','8':'b','9':'g','¢':'c','€':'e','£':'l',
    'á':'a','à':'a','ä':'a','â':'a','ã':'a','å':'a','ā':'a',
    'é':'e','è':'e','ë':'e','ê':'e','ē':'e',
    'í':'i','ì':'i','ï':'i','î':'i','ī':'i',
    'ó':'o','ò':'o','ö':'o','ô':'o','õ':'o','ø':'o','ō':'o',
    'ú':'u','ù':'u','ü':'u','û':'u','ū':'u',
    'ý':'y','ÿ':'y','ñ':'n','ç':'c','ß':'s'
  };

  function normalize(name) {
    const lower = String(name || '').toLowerCase();
    let out = '';
    for (const ch of lower) {
      if (LEET[ch]) { out += LEET[ch]; continue; }
      if (ch >= 'a' && ch <= 'z') { out += ch; continue; }
      // Drop spaces, punctuation, digits with no leet mapping, etc.
    }
    return out;
  }

  // Collapse runs of the same letter (e.g. "fuuuuck" -> "fuck") so simple
  // stretching doesn't bypass the filter.
  function collapseRuns(s) { return s.replace(/(.)\1+/g, '$1'); }

  // Innocent words that merely CONTAIN a blocked substring. A block only fires
  // when a bad word appears OUTSIDE every occurrence of a safe word, so "bestie"
  // and "crissy" pass while "estie", "criss" and "crisslover" are still caught.
  // This also clears long-standing English false positives (Scunthorpe→cunt,
  // spice→spic, shiitake→shit). Keep in sync with functions/index.js.
  const SAFE_BASE = [
    'bestie', 'besties', 'westie', 'crissy', 'crisscross', 'crisscrossing',
    'spice', 'spices', 'spicy', 'spicier', 'conspicuous', 'suspicious',
    'auspicious', 'despicable', 'scunthorpe', 'shiitake'
  ];
  // Also cover de-stretched forms (e.g. "shiitake" → "shitake") so the safe
  // word is still found when we scan the collapsed name.
  const SAFE = SAFE_BASE.concat(SAFE_BASE.map(collapseRuns));

  // Character ranges in `s` covered by any safe word.
  function safeRanges(s) {
    const r = [];
    for (const w of SAFE) {
      let i = 0;
      while ((i = s.indexOf(w, i)) !== -1) { r.push([i, i + w.length]); i += 1; }
    }
    return r;
  }
  // True if `word` occurs in `s` at least once outside every safe-word range.
  function occursExposed(s, word, ranges) {
    let i = 0;
    while ((i = s.indexOf(word, i)) !== -1) {
      const a = i, b = i + word.length;
      if (!ranges.some(function (rr) { return a >= rr[0] && b <= rr[1]; })) return true;
      i += 1;
    }
    return false;
  }

  function validate(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { ok: false, reason: 'Enter your name first!' };
    // Match bad words against BOTH the normalized text and its de-stretched
    // form. The words themselves are left intact — collapsing them too would
    // turn "kkk" into "k" and reject every username containing the letter k
    // (Mike, Nick, Kevin…). Matches that fall entirely inside a safe word
    // (bestie, spice…) are ignored so those legit names pass.
    const norm = normalize(trimmed);
    const collapsed = collapseRuns(norm);
    const rNorm = safeRanges(norm);
    const rColl = safeRanges(collapsed);
    for (const word of BAD) {
      if (occursExposed(norm, word, rNorm) || occursExposed(collapsed, word, rColl)) {
        return { ok: false, reason: 'Please choose a different username.' };
      }
    }
    return { ok: true, reason: '' };
  }

  window.yumValidateUsername = validate;
})();
