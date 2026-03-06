/**
 * reset.js
 *
 * Resets the active game in state.json back to an empty board.
 * Preserves lastCompletedGame so history is not lost on a manual reset.
 * The reset.yml workflow runs render.js afterwards to regenerate the README.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');

// Load existing state so we can keep the previous game result.
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch (_) {
  // File may not exist on first run — that is fine.
}

const resetState = {
  board: {
    A1: null,
    A2: null,
    A3: null,
    B1: null,
    B2: null,
    B3: null,
    C1: null,
    C2: null,
    C3: null,
  },
  currentPlayer: 'X',
  winner: null,
  draw: false,
  gameOver: false,
  moveCount: 0,
  lastMove: null,
  lastMovePlayer: null,
  // Preserve the game number and stats across manual resets (not a finished game).
  gameNumber: existing.gameNumber || 1,
  stats: existing.stats || { xWins: 0, oWins: 0, draws: 0 },
  // Preserve the previous completed game summary across manual resets.
  lastCompletedGame: existing.lastCompletedGame || {
    result: null,
    winner: null,
    draw: false,
    finishedAt: null,
    finalMove: null,
    player: null,
    gameNumber: null,
  },
};

fs.writeFileSync(STATE_FILE, JSON.stringify(resetState, null, 2) + '\n');
console.log('Active game reset. Last completed game summary preserved.');
