/**
 * apply-move.js
 *
 * Reads the GitHub issue title from the ISSUE_TITLE environment variable,
 * validates the move, updates game/state.json, and writes a result output
 * for the GitHub Actions workflow to branch on.
 *
 * Outputs (via GITHUB_OUTPUT file):
 *   result = "skipped"  — issue title is not a move command; do nothing
 *   result = "invalid"  — move was a valid format but cannot be applied
 *   result = "success"  — move was applied and state.json was updated
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_FILE = path.join(__dirname, 'state.json');

const VALID_CELLS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

const WIN_COMBOS = [
  // Rows
  ['A1', 'A2', 'A3'],
  ['B1', 'B2', 'B3'],
  ['C1', 'C2', 'C3'],
  // Columns
  ['A1', 'B1', 'C1'],
  ['A2', 'B2', 'C2'],
  ['A3', 'B3', 'C3'],
  // Diagonals
  ['A1', 'B2', 'C3'],
  ['A3', 'B2', 'C1'],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a step output to the GITHUB_OUTPUT file (or log locally). */
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    // Simple single-line values only — no newlines in name or value.
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  } else {
    console.log(`[output] ${name}=${value}`);
  }
}

/** Return the winning player symbol, or null if no winner yet. */
function checkWinner(board) {
  for (const [a, b, c] of WIN_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // 'X' or 'O'
    }
  }
  return null;
}

/** Return true when every cell is filled (and no winner was found). */
function checkDraw(board) {
  return Object.values(board).every((cell) => cell !== null);
}

/** Reset the active game fields back to a fresh empty board, incrementing the game number. */
function resetActiveGame(state) {
  state.board = {
    A1: null,
    A2: null,
    A3: null,
    B1: null,
    B2: null,
    B3: null,
    C1: null,
    C2: null,
    C3: null,
  };
  state.currentPlayer = 'X';
  state.winner = null;
  state.draw = false;
  state.gameOver = false;
  state.moveCount = 0;
  state.lastMove = null;
  state.lastMovePlayer = null;
  state.botLastMove = null;
  state.gameNumber = (state.gameNumber || 1) + 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const issueTitle = (process.env.ISSUE_TITLE || '').trim();
  const issueUser = (process.env.ISSUE_USER || '').trim() || 'unknown';
  console.log(`Issue title: "${issueTitle}" from @${issueUser}`);

  // --- 1. Check that the issue title is a move command ---
  // Expected format: "Move: B2"  (case-insensitive)
  const match = issueTitle.match(/^Move:\s*([A-C][1-3])$/i);
  if (!match) {
    console.log('Title does not match move pattern — skipping.');
    setOutput('result', 'skipped');
    return;
  }

  const cell = match[1].toUpperCase(); // normalise to e.g. "B2"

  // --- 2. Load current state ---
  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (err) {
    console.error(`Failed to read state file: ${err.message}`);
    setOutput('result', 'skipped');
    return;
  }

  // --- 3. Validate the move ---
  if (state.gameOver) {
    console.log('Game is already over — move rejected.');
    setOutput('result', 'invalid');
    setOutput('invalid_reason', 'gameover');
    return;
  }

  if (!VALID_CELLS.includes(cell)) {
    console.log(`"${cell}" is not a valid cell — move rejected.`);
    setOutput('result', 'invalid');
    setOutput('invalid_reason', 'invalid_cell');
    return;
  }

  if (state.board[cell] !== null) {
    console.log(
      `Cell ${cell} is already occupied by ${state.board[cell]} — move rejected.`
    );
    setOutput('result', 'invalid');
    setOutput('invalid_reason', 'taken');
    return;
  }

  // --- 4. Apply the HUMAN (X) move ---
  state.board[cell] = 'X';
  state.moveCount += 1;
  state.lastMove = cell;
  state.lastMovePlayer = issueUser;

  console.log(`Applied: X → ${cell} by @${issueUser}`);

  // Ensure stats object exists (backwards compatibility)
  if (!state.stats) {
    state.stats = { xWins: 0, oWins: 0, draws: 0 };
  }
  if (!state.players) state.players = {};
  if (!state.players[issueUser]) state.players[issueUser] = 0;

  // --- 5. Check game-ending conditions after human move ---
  const winner = checkWinner(state.board);
  let gameEndedMsg = null;

  if (winner) {
    // Human won — bot does NOT move
    state.lastCompletedGame = {
      result: 'X won',
      winner: 'X',
      draw: false,
      finishedAt: new Date().toISOString(),
      finalMove: cell,
      player: issueUser,
      wonByBot: false,
      gameNumber: state.gameNumber || 1,
    };
    state.stats.xWins += 1;
    state.players[issueUser] += 1;
    gameEndedMsg = `You won the game on ${cell}! A new game has started.`;
    console.log('Winner: X (human) — resetting board.');
    resetActiveGame(state);
  } else if (checkDraw(state.board)) {
    // Draw on human's move
    state.lastCompletedGame = {
      result: 'Draw',
      winner: null,
      draw: true,
      finishedAt: new Date().toISOString(),
      finalMove: cell,
      player: issueUser,
      wonByBot: false,
      gameNumber: state.gameNumber || 1,
    };
    state.stats.draws += 1;
    gameEndedMsg = `The game ended in a draw on ${cell}. A new game has started.`;
    console.log('Result: draw after human move — resetting board.');
    resetActiveGame(state);
  } else {
    // --- 6. Game continues — BOT (O) plays ---
    const emptyCells = Object.entries(state.board)
      .filter(([, value]) => value === null)
      .map(([c]) => c);

    const botMove = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    state.board[botMove] = 'O';
    state.moveCount += 1;
    state.botLastMove = botMove;
    console.log(`Bot played: O → ${botMove}`);

    // --- 7. Check game-ending conditions after bot move ---
    const botWinner = checkWinner(state.board);

    if (botWinner) {
      state.lastCompletedGame = {
        result: 'O won',
        winner: 'O',
        draw: false,
        finishedAt: new Date().toISOString(),
        finalMove: botMove,
        player: issueUser,
        wonByBot: true,
        gameNumber: state.gameNumber || 1,
      };
      state.stats.oWins += 1;
      gameEndedMsg = `The bot won the game on ${botMove}. A new game has started.`;
      console.log('Winner: O (bot) — resetting board.');
      resetActiveGame(state);
    } else if (checkDraw(state.board)) {
      state.lastCompletedGame = {
        result: 'Draw',
        winner: null,
        draw: true,
        finishedAt: new Date().toISOString(),
        finalMove: botMove,
        player: issueUser,
        wonByBot: false,
        gameNumber: state.gameNumber || 1,
      };
      state.stats.draws += 1;
      gameEndedMsg = `The game ended in a draw on ${botMove}. A new game has started.`;
      console.log('Result: draw after bot move — resetting board.');
      resetActiveGame(state);
    }
    // else game continues; currentPlayer stays 'X' for next human turn
  }

  // --- 6. Persist updated state ---
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  console.log('state.json saved.');

  // Expose whether this move ended a game (used by the workflow for comments)
  setOutput('result', 'success');
  setOutput('game_ended', gameEndedMsg ? 'true' : 'false');
  if (gameEndedMsg) {
    setOutput('game_result_msg', gameEndedMsg);
  }
}

main();
