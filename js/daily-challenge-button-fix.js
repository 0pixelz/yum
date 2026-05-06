// ─── DAILY CHALLENGE BUTTON LABEL FIX ───────────────────────────────
// Keeps the Daily Challenge menu button label filled without recreating it.

(function() {
  const PROFILE_KEY = 'yum_google_profile';
  const DAILY_CHALLENGE_KEY = 'yum_daily_challenge_state_v2';

  const CHALLENGES = [
    { id: 'two_yums', title: 'Roll 2 YUM today', target: 2, reward: 5 },
    { id: 'one_win', title: 'Win 1 game today', target: 1, reward: 3 },
    { id: 'three_games', title: 'Play 3 games today', target: 3, reward: 3 },
    { id: 'score_200', title: 'Score 200+ once today', target: 1, reward: 4 },
    { id: 'five_scores', title: 'Fill 5 score boxes today', target: 5, reward: 2 }
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function isLoggedIn() {
    const p = loadJSON(PROFILE_KEY, null);
    return !!(p && (p.type === 'google' || p.type === 'apple') && (p.uid || p.email));
  }

  function challengeState() {
    const today = todayKey();
    let st = loadJSON(DAILY_CHALLENGE_KEY, null);
    if (!st || st.date !== today) {
      const index = Math.abs(today.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % CHALLENGES.length;
      st = { date: today, challengeId: CHALLENGES[index].id, progress: 0, claimed: false };
      saveJSON(DAILY_CHALLENGE_KEY, st);
    }
    return st;
  }

  function getStatus() {
    if (typeof window.getYumDailyChallengeStatus === 'function') {
      try { return window.getYumDailyChallengeStatus(); } catch(e) {}
    }
    const st = challengeState();
    const ch = CHALLENGES.find(c => c.id === st.challengeId) || CHALLENGES[0];
    const progress = Math.min(ch.target, Number(st.progress) || 0);
    return {
      title: ch.title,
      target: ch.target,
      reward: ch.reward,
      progress,
      claimed: !!st.claimed,
      complete: progress >= ch.target
    };
  }

  function fixButton() {
    const btn = document.getElementById('dailyChallengeMenuBtn');
    if (!btn) return;

    if (!isLoggedIn()) {
      btn.remove();
      return;
    }

    const status = getStatus();
    btn.className = 'yum-login-feature-btn challenge';
    btn.style.minHeight = '44px';
    btn.style.color = 'var(--gold)';
    btn.style.borderColor = 'rgba(245,166,35,.42)';
    btn.style.background = 'rgba(245,166,35,.12)';
    btn.onclick = function() {
      if (typeof window.openDailyChallenge === 'function') window.openDailyChallenge();
    };

    btn.innerHTML = status.claimed
      ? `<i class="icn icn-target"></i> Daily Challenge Claimed · +${status.reward} credits`
      : `<i class="icn icn-target"></i> Daily Challenge · ${status.progress}/${status.target} · +${status.reward} credits`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixButton);
  else fixButton();

  window.addEventListener('yumChallengeChanged', fixButton);
  window.addEventListener('yumCreditsChanged', fixButton);

  setInterval(fixButton, 500);
})();
