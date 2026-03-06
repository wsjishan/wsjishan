/**
 * reset.js
 *
 * Resets game/state.json to the initial empty-board state.
 * The reset.yml workflow runs render.js afterwards to regenerate the README.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');

const INITIAL_STATE = {
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
};

fs.writeFileSync(STATE_FILE, JSON.stringify(INITIAL_STATE, null, 2) + '\n');
console.log('Game state reset to initial empty board.');
