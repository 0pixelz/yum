# Yamio Cloud Functions

Server-authoritative game logic. Anything that affects fairness in
multiplayer or that mints/spends credits lives here so a modified client
can't forge it — the Realtime Database rules block the same paths from
client writes.

## Functions

| Function | What it does |
| --- | --- |
| `rollDice({ roomId, held })` | Generates dice with `crypto.randomInt`, writes `/rooms/$id/players/$uid/serverDice`, returns the rolled dice. Verifies it's the caller's turn and that they have rolls remaining. |
| `submitScore({ roomId, categoryId })` | Reads `/serverDice`, recomputes the score for `categoryId`, writes `/players/$uid/scores/$categoryId`, clears `/serverDice` and `/liveDice`, advances `/currentTurn` to the next player. |
| `claimDailyBonus()` | One claim per UTC day. Updates `/users/$uid/dailyBonus` and `/users/$uid/creditWallet` in a single transaction. Streak resets if the previous claim wasn't yesterday. |
| `claimDailyChallenge({ challengeId })` | One claim per challenge ID per UTC day, recorded under `/users/$uid/dailyChallenges/$date/$challengeId`. |
| `purchaseSkin({ skinId })` | Validates `/users/$uid/creditWallet.credits` covers the catalog price, deducts in a transaction, and writes `/users/$uid/skins/$skinId = true`. |
| `grantAchievementCredits({ achievementId })` | One credit per achievement; idempotent via `/users/$uid/achievements/$id`. |

## Local emulator

```bash
cd functions
npm install
firebase emulators:start --only functions,database
```

In the browser, swap `firebase.app().functions('us-central1')` for the
emulator: `fns.useEmulator('localhost', 5001)`.

## Deploy

Requires the **Blaze** (pay-as-you-go) plan — Spark plan can't run
Functions. The free tier covers light usage (2M invocations / month).

```bash
firebase deploy --only functions
```

To deploy only one function:

```bash
firebase deploy --only functions:rollDice
```

## Keeping client and server in sync

The catalogs are duplicated by design — there's no shared module between
the browser and Node.

| File | What stays in sync |
| --- | --- |
| `SCORE_CALC` (index.js) | Category formulas in `js/scoring-rules.js` + `js/app.js` |
| `rewardForStreakDay` (index.js) | Same function in `js/daily-bonus-challenge-overlay.js` |
| `SKIN_COSTS` (index.js) | `SKINS` in `js/store.js` + `js/login-feature-finalizer.js` |
| `CHALLENGE_REWARDS` (index.js) | `CHALLENGES` in `js/login-rewards-challenges.js` |
| `ACHIEVEMENT_REWARDS` (index.js) | `ACHIEVEMENTS` in `js/achievements.js` |

If you add a new skin / category / challenge / achievement client-side
without a row here, the corresponding Cloud Function will reject the call
with `invalid-argument` and the client will surface a generic error.
