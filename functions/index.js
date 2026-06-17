// Server-authoritative Cloud Functions for Yamio.
// All gameplay state that affects fairness or monetization is mutated only
// here — the RTDB rules block clients from writing the corresponding paths.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
// maxInstances raised from 50 → 200 for Play Store launch: each active
// player triggers rollDice / submitScore / claimDailyBonus every 30–60s,
// so 50 instances throttles past ~200 concurrent users. 200 is the cap
// the project's current CpuAllocPerProjectRegion quota (200,000 mCPU)
// allows; request a quota increase in GCP Console → IAM & Admin → Quotas
// before bumping this any higher.
setGlobalOptions({
  region: 'us-central1',
  maxInstances: 200,
});

const SERVER_TIMESTAMP = admin.database.ServerValue.TIMESTAMP;
const ROOM_ID_RE = /^[A-Z0-9]{4,8}$/;
const MAX_ROLL = 3;
const MAX_CREDITS = 1000000;

// ─── Score calculators (mirror js/scoring-rules.js + js/app.js) ─────
// These run server-side every time submitScore is called. If you ever
// change the client's category formulas, change them here too.
const FULL_HOUSE = 25;
const SM_STRAIGHT = 15;
const LG_STRAIGHT = 20;
const YAM_POINTS = 30;

function counts(d) {
  const c = {};
  d.forEach((v) => { c[v] = (c[v] || 0) + 1; });
  return c;
}

const SCORE_CALC = {
  ones:       (d) => d.filter((x) => x === 1).reduce((a, b) => a + b, 0),
  twos:       (d) => d.filter((x) => x === 2).reduce((a, b) => a + b, 0),
  threes:     (d) => d.filter((x) => x === 3).reduce((a, b) => a + b, 0),
  fours:      (d) => d.filter((x) => x === 4).reduce((a, b) => a + b, 0),
  fives:      (d) => d.filter((x) => x === 5).reduce((a, b) => a + b, 0),
  sixes:      (d) => d.filter((x) => x === 6).reduce((a, b) => a + b, 0),
  threeKind:  (d) => (Object.values(counts(d)).some((v) => v >= 3) ? d.reduce((a, b) => a + b, 0) : 0),
  fourKind:   (d) => (Object.values(counts(d)).some((v) => v >= 4) ? d.reduce((a, b) => a + b, 0) : 0),
  fullHouse:  (d) => {
    const v = Object.values(counts(d)).sort();
    return ((v[0] === 2 && v[1] === 3) || v[0] === 5) ? FULL_HOUSE : 0;
  },
  smStraight: (d) => {
    const u = [...new Set(d)].sort((a, b) => a - b).join('');
    return ['1234', '2345', '3456'].some((p) => u.includes(p)) ? SM_STRAIGHT : 0;
  },
  lgStraight: (d) => {
    const u = [...new Set(d)].sort((a, b) => a - b);
    return (u.length === 5 && u[4] - u[0] === 4) ? LG_STRAIGHT : 0;
  },
  yum:        (d) => (Object.values(counts(d)).some((v) => v === 5) ? YAM_POINTS : 0),
  chance:     (d) => d.reduce((a, b) => a + b, 0)
};
const VALID_CATEGORIES = new Set(Object.keys(SCORE_CALC));

// Random.org isn't reachable from Functions runtime; crypto.randomInt
// is a CSPRNG and is what we want anyway.
function rollOne() {
  return crypto.randomInt(1, 7);
}

function requireAuth(req) {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sign in required');
  return uid;
}

function requireRoomId(id) {
  if (typeof id !== 'string' || !ROOM_ID_RE.test(id)) {
    throw new HttpsError('invalid-argument', 'bad roomId');
  }
  return id;
}

function db() { return admin.database(); }

// ─── rollDice ────────────────────────────────────────────────────────
// Authoritative dice generation. Client passes which dice to keep; the
// server reads the current roll number from /serverDice/roll, advances
// it, regenerates the non-held positions, and writes everything back.
// The matching liveDice/dice path stays writable by the client for the
// streaming-roll animation, but the score check below ignores liveDice
// and reads /serverDice — so cheats spoofing liveDice don't affect score.
exports.rollDice = onCall(async (req) => {
  const uid = requireAuth(req);
  const data = req.data || {};
  const roomId = requireRoomId(data.roomId);

  const heldInput = Array.isArray(data.held) ? data.held.slice(0, 5) : [];
  const held = [0, 1, 2, 3, 4].map((i) => !!heldInput[i]);

  const roomRef = db().ref('rooms/' + roomId);
  const snap = await roomRef.once('value');
  const room = snap.val();
  if (!room) throw new HttpsError('not-found', 'no such room');
  if (room.currentTurn !== uid) throw new HttpsError('permission-denied', 'not your turn');

  const sd = (room.players && room.players[uid] && room.players[uid].serverDice) || {};
  const prevDice = Array.isArray(sd.dice) && sd.dice.length === 5 ? sd.dice : [0, 0, 0, 0, 0];
  const prevRoll = typeof sd.roll === 'number' ? sd.roll : 0;

  if (prevRoll >= MAX_ROLL) {
    throw new HttpsError('failed-precondition', 'no rolls left');
  }

  // A held die must already have a value > 0 from a previous roll.
  for (let i = 0; i < 5; i++) {
    if (held[i] && (typeof prevDice[i] !== 'number' || prevDice[i] < 1)) {
      held[i] = false;
    }
  }

  const newDice = [0, 1, 2, 3, 4].map((i) => (held[i] ? prevDice[i] : rollOne()));
  const newRoll = prevRoll + 1;

  await roomRef.child('players/' + uid + '/serverDice').set({
    dice: newDice,
    held: held,
    roll: newRoll,
    ts: SERVER_TIMESTAMP
  });

  return { dice: newDice, held: held, roll: newRoll };
});

// ─── submitScore ─────────────────────────────────────────────────────
// Computes the score for a category from /serverDice (the authoritative
// roll), writes it to /players/$uid/scores/$categoryId, clears
// /serverDice, and advances /currentTurn to the next player by join order.
exports.submitScore = onCall(async (req) => {
  const uid = requireAuth(req);
  const data = req.data || {};
  const roomId = requireRoomId(data.roomId);
  const categoryId = data.categoryId;
  if (!VALID_CATEGORIES.has(categoryId)) {
    throw new HttpsError('invalid-argument', 'bad categoryId');
  }

  const roomRef = db().ref('rooms/' + roomId);
  const snap = await roomRef.once('value');
  const room = snap.val();
  if (!room) throw new HttpsError('not-found', 'no such room');
  if (room.currentTurn !== uid) throw new HttpsError('permission-denied', 'not your turn');

  const player = (room.players && room.players[uid]) || {};
  const sd = player.serverDice || {};
  const dice = Array.isArray(sd.dice) ? sd.dice : null;
  if (!dice || dice.length !== 5 || dice.some((v) => typeof v !== 'number' || v < 1 || v > 6)) {
    throw new HttpsError('failed-precondition', 'no rolled dice on record');
  }
  if (player.scores && player.scores[categoryId] !== undefined) {
    throw new HttpsError('failed-precondition', 'category already scored');
  }

  const score = SCORE_CALC[categoryId](dice);

  const order = Object.entries(room.players || {})
    .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))
    .map((e) => e[0]);
  const idx = order.indexOf(uid);
  const nextTurn = order.length > 0 ? order[(idx + 1) % order.length] : uid;

  const updates = {};
  updates['players/' + uid + '/scores/' + categoryId] = score;
  updates['players/' + uid + '/serverDice'] = null;
  updates['players/' + uid + '/liveDice'] = null;
  updates['currentTurn'] = nextTurn;
  updates['rollCount'] = 0;
  await roomRef.update(updates);

  return { score, nextTurn };
});

// ─── claimDailyBonus ─────────────────────────────────────────────────
// 7-day cycling streak. The reward table mirrors rewardForStreakDay in
// js/daily-bonus-challenge-overlay.js. Server is the only place credits
// get added, so the client can't fabricate a claim or replay yesterday's.
function rewardForStreakDay(day) {
  // 7-day cycle that mirrors rewardForStreakDay in
  // js/daily-bonus-challenge-overlay.js. If you change one, change both.
  if (day <= 0) return 1;
  const idx = ((day - 1) % 7) + 1;
  if (idx === 7) return 5;
  if (idx === 6) return 3;
  if (idx >= 3) return 2;
  return 1;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

exports.claimDailyBonus = onCall(async (req) => {
  const uid = requireAuth(req);
  const userRef = db().ref('users/' + uid);

  const result = await userRef.transaction((curr) => {
    const u = curr || {};
    const bonus = u.dailyBonus || {};
    const wallet = u.creditWallet || { credits: 0, earned: 0, spent: 0 };

    const today = todayKey();
    if (bonus.lastDate === today) {
      // Already claimed today — abort transaction.
      return;
    }
    const yesterday = yesterdayKey();
    const newStreak = bonus.lastDate === yesterday ? (Number(bonus.streak) || 0) + 1 : 1;
    const reward = rewardForStreakDay(newStreak);

    const earned = Math.min(MAX_CREDITS, (Number(wallet.earned) || 0) + reward);
    const spent = Math.min(MAX_CREDITS, Number(wallet.spent) || 0);
    const credits = Math.max(0, Math.min(MAX_CREDITS, earned - spent));

    u.dailyBonus = {
      lastDate: today,
      streak: newStreak,
      lastClaimedAt: SERVER_TIMESTAMP
    };
    u.creditWallet = {
      credits,
      earned,
      spent,
      lastReason: 'daily-bonus-day-' + newStreak,
      updatedAt: SERVER_TIMESTAMP
    };
    return u;
  });

  if (!result.committed) {
    throw new HttpsError('failed-precondition', 'already claimed today');
  }
  const after = result.snapshot.val();
  const streak = after.dailyBonus.streak;
  return {
    streak,
    credits: after.creditWallet.credits,
    earned: after.creditWallet.earned,
    spent: after.creditWallet.spent,
    reward: rewardForStreakDay(streak),
    lastDate: after.dailyBonus.lastDate
  };
});

// ─── purchaseSkin ────────────────────────────────────────────────────
// Merged catalog: store.js SKINS for the basic colour skins (cost 1) and
// login-feature-finalizer.js SKINS for the premium tier. Where IDs overlap,
// the finalizer's price wins because its buySkin overrides store.js's at
// load time and is what users actually pay. Keep this table in sync with
// both files — if a new skin lands client-side without a row here,
// purchaseSkin throws "unknown skin" and the unlock silently fails.
const SKIN_COSTS = {
  // Basic palette (store.js)
  classic:  0,
  red:      1,
  blue:     1,
  green:    1,
  purple:   1,
  orange:   1,
  pink:     1,
  black:    1,
  teal:     1,
  candy:    25,
  ocean:    50,
  midnight: 100,
  rosegold: 200,
  // Premium tier (login-feature-finalizer.js)
  gold:     5,
  neon:     8,
  ice:      10,
  fire:     15,
  galaxy:   25,
  emerald:  40,
  ruby:     60,
  sapphire: 90,
  sunset:   130,
  aurora:   175,
  obsidian: 225,
  phantom:  300,
  toxic:    400,
  lava:     525,
  frost:    700,
  royal:    900,
  cosmic:   1150,
  dragon:   1450,
  mythic:   1750,
  diamond:  2000
};

exports.purchaseSkin = onCall(async (req) => {
  const uid = requireAuth(req);
  const data = req.data || {};
  const skinId = data.skinId;
  if (typeof skinId !== 'string' || skinId.length > 30 || !(skinId in SKIN_COSTS)) {
    throw new HttpsError('invalid-argument', 'unknown skin');
  }
  const cost = SKIN_COSTS[skinId];

  const userRef = db().ref('users/' + uid);
  const result = await userRef.transaction((curr) => {
    const u = curr || {};
    const wallet = u.creditWallet || { credits: 0, earned: 0, spent: 0 };
    const skins = u.skins || {};

    if (skins[skinId]) {
      // Already owned — abort so the caller sees a clean error.
      return;
    }
    const credits = Math.max(0, Number(wallet.credits) || 0);
    if (cost > 0 && credits < cost) {
      // Insufficient — abort.
      return;
    }

    const earned = Math.min(MAX_CREDITS, Number(wallet.earned) || 0);
    const spent = Math.min(MAX_CREDITS, (Number(wallet.spent) || 0) + cost);
    const newCredits = Math.max(0, Math.min(MAX_CREDITS, earned - spent));

    u.skins = Object.assign({}, skins, { [skinId]: true });
    u.creditWallet = {
      credits: newCredits,
      earned,
      spent,
      lastReason: 'skin-' + skinId,
      updatedAt: SERVER_TIMESTAMP
    };
    return u;
  });

  if (!result.committed) {
    // Disambiguate the two abort reasons. Collapsing them into one message
    // lets the client mistake "insufficient credits" for "already owned" and
    // hand the skin over without charging, so report them distinctly.
    const current = (await userRef.once('value')).val() || {};
    if ((current.skins || {})[skinId]) {
      throw new HttpsError('already-exists', 'skin already owned');
    }
    throw new HttpsError('failed-precondition', 'insufficient credits');
  }
  const after = result.snapshot.val();
  return {
    skinId,
    cost,
    credits: after.creditWallet.credits,
    earned: after.creditWallet.earned,
    spent: after.creditWallet.spent
  };
});

// ─── grantAchievementCredits ─────────────────────────────────────────
// The achievement catalog itself is client-side, but the credit grant
// must come through the server. Client tells us which achievement just
// unlocked; we check it wasn't already credited and add the reward.
// ─── claimDailyChallenge ─────────────────────────────────────────────
// Server only checks "have you already claimed challenge X today?" — it
// trusts the client's claim of completion. To cheat completion the user
// would have to play the game (or just claim with no progress, in which
// case they get the credits but their public stats won't move; that's a
// known trade-off until per-stat server tracking lands).
const CHALLENGE_REWARDS = {
  two_yums:           5,
  one_win:            3,
  three_games:        3,
  score_200:          4,
  five_scores:        2,
  five_classic_wins: 20,
  score_250:         15
};

exports.claimDailyChallenge = onCall(async (req) => {
  const uid = requireAuth(req);
  const data = req.data || {};
  const challengeId = data.challengeId;
  if (typeof challengeId !== 'string' || !(challengeId in CHALLENGE_REWARDS)) {
    throw new HttpsError('invalid-argument', 'bad challengeId');
  }
  const reward = CHALLENGE_REWARDS[challengeId];
  const today = todayKey();

  const userRef = db().ref('users/' + uid);
  const result = await userRef.transaction((curr) => {
    const u = curr || {};
    const all = u.dailyChallenges || {};
    const todayMap = all[today] || {};
    if (todayMap[challengeId]) {
      return;
    }
    const wallet = u.creditWallet || { credits: 0, earned: 0, spent: 0 };
    const earned = Math.min(MAX_CREDITS, (Number(wallet.earned) || 0) + reward);
    const spent = Math.min(MAX_CREDITS, Number(wallet.spent) || 0);
    const credits = Math.max(0, Math.min(MAX_CREDITS, earned - spent));

    u.dailyChallenges = Object.assign({}, all, {
      [today]: Object.assign({}, todayMap, { [challengeId]: SERVER_TIMESTAMP })
    });
    u.creditWallet = {
      credits,
      earned,
      spent,
      lastReason: 'challenge-' + challengeId,
      updatedAt: SERVER_TIMESTAMP
    };
    return u;
  });

  if (!result.committed) {
    throw new HttpsError('failed-precondition', 'already claimed today');
  }
  const after = result.snapshot.val();
  return {
    challengeId,
    reward,
    credits: after.creditWallet.credits,
    earned: after.creditWallet.earned
  };
});

// One credit per achievement — matches the "1 credit per unlock" promise in
// js/store.js (the cheapest skins cost 1 credit and the credit pill in the
// achievements panel reads from this implicit grant).
const ACHIEVEMENT_REWARDS = {
  first_game:    1,
  first_win:     1,
  first_yum:     1,
  yum_x3:        1,
  yum_x10:       1,
  full_house:    1,
  lg_straight:   1,
  bonus:         1,
  perfect_upper: 1,
  score_250:     1,
  score_300:     1,
  bot_slayer:    1,
  no_scratch:    1,
  games_10:      1,
  games_25:      1
};

exports.grantAchievementCredits = onCall(async (req) => {
  const uid = requireAuth(req);
  const data = req.data || {};
  const achievementId = data.achievementId;
  if (typeof achievementId !== 'string' || achievementId.length > 50) {
    throw new HttpsError('invalid-argument', 'bad achievementId');
  }
  const reward = ACHIEVEMENT_REWARDS[achievementId];
  if (typeof reward !== 'number') {
    // Achievement exists on the client but isn't on the credit ladder.
    // Mark it but grant nothing.
    await db().ref('users/' + uid + '/achievements/' + achievementId).set(true);
    return { achievementId, reward: 0, credits: null };
  }

  const userRef = db().ref('users/' + uid);
  const result = await userRef.transaction((curr) => {
    const u = curr || {};
    const ach = u.achievements || {};
    if (ach[achievementId]) {
      return;
    }
    const wallet = u.creditWallet || { credits: 0, earned: 0, spent: 0 };
    const earned = Math.min(MAX_CREDITS, (Number(wallet.earned) || 0) + reward);
    const spent = Math.min(MAX_CREDITS, Number(wallet.spent) || 0);
    const credits = Math.max(0, Math.min(MAX_CREDITS, earned - spent));

    u.achievements = Object.assign({}, ach, { [achievementId]: true });
    u.creditWallet = {
      credits,
      earned,
      spent,
      lastReason: 'achievement-' + achievementId,
      updatedAt: SERVER_TIMESTAMP
    };
    return u;
  });

  if (!result.committed) {
    throw new HttpsError('failed-precondition', 'already credited');
  }
  const after = result.snapshot.val();
  return {
    achievementId,
    reward,
    credits: after.creditWallet.credits,
    earned: after.creditWallet.earned
  };
});
