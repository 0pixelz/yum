// ─── BOT POWER-UP AI ────────────────────────────────────────────────────────
// Adds power-up logic to the VS Bot opponent:
//  • Bot picks a starter power-up when a power-up game begins
//  • Bot earns a new power-up when it rolls 5-of-a-kind
//  • Bot strategically uses its power-ups during its turn
//
// Loaded AFTER app.js, first-roll.js and powerup-mode.js so it can wrap them.

// ─── BOT POWER-UP STATE ─────────────────────────────────────────────────────
let botPowerups          = [];
let botFreezeDieIndex    = -1;
let botFrozenDieValue    = 0;
let botDoublePointsActive = false;

function _botResetPowerups() {
  botPowerups          = [];
  botFreezeDieIndex    = -1;
  botFrozenDieValue    = 0;
  botDoublePointsActive = false;
}

function _botHasPowerup(id) { return botPowerups.indexOf(id) >= 0; }
function _botConsumePowerup(id) {
  const i = botPowerups.indexOf(id);
  if (i >= 0) botPowerups.splice(i, 1);
  if (typeof renderBotLeaderboard === 'function') renderBotLeaderboard();
}

function _botPowerupToast(html) {
  if (typeof showToast === 'function') showToast(html);
}

// ─── PICK STRATEGY ──────────────────────────────────────────────────────────
function _botWeightedPick(weights) {
  const ids   = Object.keys(weights);
  const total = ids.reduce((s, k) => s + weights[k], 0);
  let r = Math.random() * total;
  for (const id of ids) {
    r -= weights[id];
    if (r <= 0) return POWERUPS.find(p => p.id === id);
  }
  return POWERUPS.find(p => p.id === ids[0]);
}

// At game start: pick something that's useful out of the gate. Skip undoMove
// (no prior move to undo) and weight high-impact picks higher.
function _botPickStarterPowerup() {
  return _botWeightedPick({
    doublePoints: 35,
    extraRoll:    25,
    luckyDice:    20,
    freezeDie:    20,
  });
}

// On YUM earn: weight by remaining turns. Skip undoMove (bot doesn't currently
// have logic to use it intelligently).
function _botPickEarnedPowerup() {
  const filled    = (typeof botScores === 'object') ? Object.keys(botScores).length : 0;
  const remaining = 13 - filled;
  return _botWeightedPick({
    doublePoints: 30,
    extraRoll:    25,
    luckyDice:    20,
    freezeDie:    remaining >= 4 ? 20 : 5,
  });
}

// ─── DECISION HELPERS ───────────────────────────────────────────────────────
// Categories where high pip values are valuable — lucky dice is worth using.
const _BOT_HIGH_DICE_CATS = ['threes','fours','fives','sixes','threeKind','fourKind','fullHouse','chance','yum'];

function _botTurnsLeft() {
  const filled = (typeof botScores === 'object') ? Object.keys(botScores).length : 0;
  return Math.max(0, 13 - filled);
}

// Returns the index of a non-held low die worth swapping with luckyDice; -1 otherwise.
// Uses a wider threshold near end-game so the powerup gets spent.
function _botLuckyTargetIdx(targetCatId) {
  if (!_botHasPowerup('luckyDice')) return -1;
  const inHighCat = _BOT_HIGH_DICE_CATS.indexOf(targetCatId) >= 0;
  const turnsLeft = _botTurnsLeft();
  // Spend it if we're running out of turns no matter the category.
  const maxLow = turnsLeft <= 3 ? 4 : (inHighCat ? 3 : -1);
  if (maxLow < 0) return -1;
  let worstIdx = -1, worstVal = 99;
  for (let i = 0; i < 5; i++) {
    if (botHeld[i]) continue;          // don't swap held dice
    if (botDice[i] === 0) continue;
    if (botDice[i] <= maxLow && botDice[i] < worstVal) {
      worstVal = botDice[i];
      worstIdx = i;
    }
  }
  return worstIdx;
}

function _botApplyLuckyDice(idx) {
  _botConsumePowerup('luckyDice');
  // Mirror the player's lucky-dice odds: 2/3 chance of 5 or 6.
  botDice[idx] = Math.random() < (2/3)
    ? (Math.random() < 0.5 ? 5 : 6)
    : (Math.floor(Math.random() * 4) + 1);
  _botPowerupToast(
    `<i class="icn icn-bot"></i> ${botName} used <i class="icn icn-star"></i> Lucky Dice → ${botDice[idx]}!`
  );
}

// Use Extra Roll whenever another reroll has a real shot at improving the score.
function _botShouldUseExtraRoll(cat, scoreVal, hasUnheldToReroll) {
  if (!_botHasPowerup('extraRoll')) return false;
  if (!hasUnheldToReroll)            return false;
  if (scoreVal === 0)                          return true;
  if (scoreVal < cat.max * 0.6)                return true;
  // Burn it on the last few turns so it doesn't go to waste.
  if (_botTurnsLeft() <= 2 && scoreVal < cat.max) return true;
  return false;
}

// Activate Double Points before scoring a meaningful category — lower threshold
// late in the game so the powerup actually gets spent.
function _botShouldUseDoublePoints(scoreVal) {
  if (!_botHasPowerup('doublePoints')) return false;
  if (scoreVal <= 0) return false;
  const turnsLeft = _botTurnsLeft();
  if (turnsLeft <= 2)  return scoreVal >= 8;   // burn it before end of game
  if (turnsLeft <= 5)  return scoreVal >= 15;
  return scoreVal >= 20;
}

// Save a 5 or 6 for next turn (only when there's still real game left and the
// die isn't critical to the chosen scoring category).
function _botFreezeCandidateIdx(cat) {
  if (!_botHasPowerup('freezeDie')) return -1;
  if (_botTurnsLeft() <= 2) return -1;        // no point freezing if game's about to end
  for (let i = 0; i < 5; i++) {
    if (botDice[i] < 5) continue;
    if (cat.id === 'fives' && botDice[i] === 5) continue;
    if (cat.id === 'sixes' && botDice[i] === 6) continue;
    return i;
  }
  return -1;
}

// ─── POWER-UP-AWARE BOT TURN ────────────────────────────────────────────────
const _origBotTakeTurn = botTakeTurn;
botTakeTurn = function() {
  if (!botMode || playerTurn) return;
  if (typeof powerupMode === 'undefined' || !powerupMode) {
    _origBotTakeTurn();
    return;
  }
  _botPowerupTakeTurn();
};

function _botThink(text) {
  const el = document.getElementById('botThinkMsg');
  if (el) el.textContent = text;
}

// Roll 5 fresh dice, but restore a frozen die (from previous turn) at its slot.
// Returns the carried-over index (or -1) so the caller can mark it held.
function _botSeedRoll1Dice() {
  const fresh = [0,0,0,0,0].map(() => randDie());
  const carriedIdx = botFreezeDieIndex;
  if (carriedIdx >= 0) {
    fresh[carriedIdx] = botFrozenDieValue;
    _botPowerupToast(
      `<i class="icn icn-bot"></i> ${botName}'s frozen dice (${botFrozenDieValue}) carried over!`
    );
  }
  botFreezeDieIndex = -1;
  botFrozenDieValue = 0;
  return { dice: fresh, carriedIdx };
}

function _botPowerupTakeTurn() {
  const bar = document.getElementById('botThinkBar');
  if (bar) bar.style.display = 'flex';
  showBotDiceOverlay(true);

  // Roll 1
  setTimeout(() => {
    const seed = _botSeedRoll1Dice();
    botDice = seed.dice;
    botHeld = [false,false,false,false,false];
    // Keep the frozen-die from last turn locked through this turn's rerolls.
    if (seed.carriedIdx >= 0) botHeld[seed.carriedIdx] = true;
    _botThink('Roll 1 of 3…');
    showBotDiceInRoller(botDice, botHeld, true);

    setTimeout(() => {
      let move1 = botChooseBestMove();
      if (!move1) { _botFinishWithPowerups(null); return; }
      // Merge bot's chosen hold pattern with the carried-over freeze (don't lose it).
      botHeld = move1.held.map((v,i) => v !== 0 || (seed.carriedIdx === i));

      // LuckyDice between roll 1 and roll 2 — upgrade a worst non-held die.
      const luckyI = _botLuckyTargetIdx(move1.cat.id);
      if (luckyI >= 0 && Math.random() < 0.85) {
        _botApplyLucky_andReplan(luckyI, m => move1 = m);
      }

      // Hold the chosen dice one at a time, then roll again.
      botHoldOneAtATime(botHeld.slice(), () => {

      // Roll 2
      setTimeout(() => {
        botDice = botDice.map((v,i) => botHeld[i] ? v : randDie());
        let move2 = botChooseBestMove();
        if (!move2) { _botFinishWithPowerups(null); return; }
        botHeld = move2.held.map(v => v !== 0);

        // LuckyDice between roll 2 and roll 3.
        const luckyI2 = _botLuckyTargetIdx(move2.cat.id);
        if (luckyI2 >= 0 && Math.random() < 0.8) {
          _botApplyLucky_andReplan(luckyI2, m => move2 = m);
        }

        const targetHeld2 = botHeld.slice();
        _botThink('Roll 2 of 3…');
        botHeld = [false,false,false,false,false];
        showBotDiceInRoller(botDice, botHeld, true);

        setTimeout(() => {
          botHoldOneAtATime(targetHeld2, () => {

          // Roll 3
          setTimeout(() => {
            botDice = botDice.map((v,i) => targetHeld2[i] ? v : randDie());
            botHeld = [true,true,true,true,true];
            _botThink('Roll 3 of 3…');
            showBotDiceInRoller(botDice, botHeld, true);

            setTimeout(() => {
              let finalMove  = botChooseBestMove();
              if (!finalMove) { _botFinishWithPowerups(null); return; }
              let finalScore = finalMove.cat.calc(botDice);

              // Extra Roll: bonus reroll if result is poor and there are dice to reroll.
              const reHeld = finalMove.held.map(v => v !== 0);
              const hasUnheld = reHeld.some(h => !h);
              if (_botShouldUseExtraRoll(finalMove.cat, finalScore, hasUnheld)) {
                _botConsumePowerup('extraRoll');
                _botPowerupToast(
                  `<i class="icn icn-bot"></i> ${botName} used <i class="icn icn-dice"></i> Extra Roll!`
                );

                botHeld = reHeld;
                _botThink('Bonus roll…');
                showBotDiceInRoller(botDice, botHeld, false);

                setTimeout(() => {
                  botDice = botDice.map((v,i) => botHeld[i] ? v : randDie());
                  botHeld = [true,true,true,true,true];
                  showBotDiceInRoller(botDice, botHeld, true);

                  setTimeout(() => {
                    finalMove  = botChooseBestMove() || finalMove;
                    finalScore = finalMove.cat.calc(botDice);
                    _botCommitFinal(finalMove, finalScore);
                  }, 700);
                }, 600);
                return;
              }

              _botCommitFinal(finalMove, finalScore);
            }, 900);
          }, 700);
          }); // end botHoldOneAtATime (roll 2)
        }, 700);
      }, 800);
      }); // end botHoldOneAtATime (roll 1)
    }, 900);
  }, 500);
}

// Lucky dice + re-plan helper. Calls the supplied setter with the new move.
function _botApplyLucky_andReplan(idx, setMove) {
  _botApplyLuckyDice(idx);
  const replanned = botChooseBestMove();
  if (replanned) {
    setMove(replanned);
    botHeld = replanned.held.map(v => v !== 0);
  }
}

// After roll 3 (and any bonus roll), apply Double Points / Freeze Die and finish.
function _botCommitFinal(move, scoreVal) {
  if (_botShouldUseDoublePoints(scoreVal)) {
    _botConsumePowerup('doublePoints');
    botDoublePointsActive = true;
    _botPowerupToast(
      `<i class="icn icn-bot"></i> ${botName} used <i class="icn icn-sparkle"></i> Double Points!`
    );
  }

  // Freeze a high die for next turn (when it makes strategic sense).
  const freezeI = _botFreezeCandidateIdx(move.cat);
  if (freezeI >= 0 && Math.random() < 0.85) {
    _botConsumePowerup('freezeDie');
    botFreezeDieIndex = freezeI;
    botFrozenDieValue = botDice[freezeI];
    _botPowerupToast(
      `<i class="icn icn-bot"></i> ${botName} used <i class="icn icn-gem"></i> Freeze Dice (${botDice[freezeI]}) — carries to next turn!`
    );
  }

  _botThink('Scoring…');
  _botFinishWithPowerups(move);
}

// Mirror of finishBotTurn but applies the bot's doublePoints + earns a YUM power-up.
function _botFinishWithPowerups(move) {
  if (!move || !move.cat) {
    playerTurn = true;
    renderBotLeaderboard();
    showToast('Your turn!');
    return;
  }

  let scored = move.cat.calc(botDice);
  if (botDoublePointsActive) {
    if (scored > 0) scored = scored * 2;
    botDoublePointsActive = false;
  }

  botScores[move.cat.id]    = scored;
  botScoreDice[move.cat.id] = botDice.slice();

  renderBotLeaderboard();

  const isPerfect = scored === move.cat.max && move.cat.max > 0;
  const isZero    = scored === 0;
  showBotActionPopup(botName, botDice, move.cat.name, scored, isPerfect, isZero, false);

  showBotDiceOverlay(false);
  document.getElementById('botThinkBar').style.display = 'none';

  // 5-of-a-kind earns a power-up (mirror player rules).
  const isYum = botDice.every(v => v > 0 && v === botDice[0]);
  if (isYum && scored > 0) {
    setTimeout(() => {
      const earned = _botPickEarnedPowerup();
      botPowerups.push(earned.id);
      _botPowerupToast(
        `<i class="icn icn-bot"></i> ${botName} earned ${earned.icon} ${earned.name}!`
      );
      renderBotLeaderboard();
    }, 1100);
  }

  if (Object.keys(botScores).length === categories.length) {
    clearDice();
    setTimeout(showBotGameOver, 800);
    return;
  }

  playerTurn = true;
  clearDice();
  renderBotLeaderboard();
  setTimeout(() => showYourTurnPop('ROLL THE DICE'), 2500);
}

// ─── HOOKS: GAME LIFECYCLE ──────────────────────────────────────────────────

// closeFirstRoll runs once the first-roll overlay closes; powerup-mode.js has
// already wrapped it to open the player's picker. We additionally schedule the
// bot's starter pick so both players have one before the bot can take a turn.
const _bpOrigCloseFirstRoll = closeFirstRoll;
closeFirstRoll = function() {
  _bpOrigCloseFirstRoll();
  if (typeof powerupMode !== 'undefined' && powerupMode && botMode) {
    setTimeout(() => {
      const p = _botPickStarterPowerup();
      botPowerups.push(p.id);
      _botPowerupToast(
        `<i class="icn icn-bot"></i> ${botName} chose ${p.icon} ${p.name}!`
      );
      renderBotLeaderboard();
    }, 1500);
  }
};

// Mirror the player's power-up changes into the bot leaderboard so the
// "Extra Roll" / etc. label next to the player's name updates live.
const _bpOrigRenderPowerupBar = renderPowerupBar;
renderPowerupBar = function() {
  _bpOrigRenderPowerupBar();
  if (botMode && typeof renderBotLeaderboard === 'function') renderBotLeaderboard();
};

// Reset bot inventory whenever a new bot game / rematch / quit happens.
const _bpOrigStartVsBot = startVsBot;
startVsBot = function(mode) {
  _botResetPowerups();
  _bpOrigStartVsBot(mode);
};

const _bpOrigRematch = rematch;
rematch = function() {
  if (typeof powerupMode !== 'undefined' && powerupMode && botMode) {
    _botResetPowerups();
  }
  _bpOrigRematch();
};

const _bpOrigQuitGame = quitGame;
quitGame = function() {
  if (botMode) _botResetPowerups();
  _bpOrigQuitGame();
};
