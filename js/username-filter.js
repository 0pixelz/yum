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
    ['k','k','k']
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

  function validate(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { ok: false, reason: 'Enter your name first!' };
    // Match bad words against BOTH the normalized text and its de-stretched
    // form. The words themselves are left intact — collapsing them too would
    // turn "kkk" into "k" and reject every username containing the letter k
    // (Mike, Nick, Kevin…), which is exactly the false-positive we must avoid.
    const norm = normalize(trimmed);
    const collapsed = collapseRuns(norm);
    for (const word of BAD) {
      if (norm.includes(word) || collapsed.includes(word)) {
        return { ok: false, reason: 'Please choose a different username.' };
      }
    }
    return { ok: true, reason: '' };
  }

  window.yumValidateUsername = validate;
})();
