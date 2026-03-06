/**
 * render.js
 *
 * Reads game/state.json and regenerates the Tic-Tac-Toe section of README.md.
 * Content outside the <!-- TICTACTOE-START / END --> markers is preserved.
 *
 * If the markers do not yet exist the section is inserted after the first
 * top-level heading (or at the very top if there is no heading).
 *
 * Repository URL resolution order:
 *   1. GITHUB_REPOSITORY env var  (set automatically in GitHub Actions)
 *   2. `git remote get-url origin`  (works when run locally)
 *   3. Placeholder "https://github.com/OWNER/REPO"
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths & markers
// ---------------------------------------------------------------------------

const STATE_FILE = path.join(__dirname, 'state.json');
const README_FILE = path.join(__dirname, '..', 'README.md');

const MARKER_START = '<!-- TICTACTOE-START -->';
const MARKER_END = '<!-- TICTACTOE-END -->';

// ---------------------------------------------------------------------------
// Board config
// ---------------------------------------------------------------------------

const ROWS = ['A', 'B', 'C'];
const COLS = ['1', '2', '3'];

const EMOJI = {
  X: '❌',
  O: '⭕',
  empty: '⬜',
};

// ---------------------------------------------------------------------------
// Repository URL
// ---------------------------------------------------------------------------

function getRepoUrl() {
  // 1. GitHub Actions provides this automatically
  if (process.env.GITHUB_REPOSITORY) {
    return `https://github.com/${process.env.GITHUB_REPOSITORY}`;
  }

  // 2. Try to derive from the git remote (useful when running locally)
  try {
    const { execSync } = require('child_process');
    const remote = execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const httpsMatch = remote.match(/https:\/\/github\.com\/([^/]+\/[^/.]+)/);
    const sshMatch = remote.match(/git@github\.com:([^/]+\/[^.]+)/);
    const found = httpsMatch || sshMatch;
    if (found) {
      return `https://github.com/${found[1]}`;
    }
  } catch (_) {
    // ignore — git may not be available or remote may not be set
  }

  // 3. Fallback to the known repository so local runs still produce valid links.
  return 'https://github.com/wsjishan/wsjishan';
}

// ---------------------------------------------------------------------------
// Board rendering
// ---------------------------------------------------------------------------

/** Build the issue-creation URL for a given cell. */
function makeIssueUrl(cell, repoUrl) {
  const title = encodeURIComponent(`Move: ${cell}`);
  const body = encodeURIComponent(
    `I want to play at cell **${cell}**.\n\n` +
      `_This issue was created by clicking a cell in the Tic-Tac-Toe README game._`
  );
  return `${repoUrl}/issues/new?title=${title}&body=${body}`;
}

/** Render the 3×3 board as a GitHub-flavoured markdown table. */
function renderBoard(state, repoUrl) {
  const lines = [];

  lines.push('|   | 1 | 2 | 3 |');
  lines.push('|:-:|:-:|:-:|:-:|');

  for (const row of ROWS) {
    const cells = COLS.map((col) => {
      const key = `${row}${col}`;
      const value = state.board[key];

      if (value !== null) {
        // Occupied — show emoji, no link
        return EMOJI[value];
      }

      if (state.gameOver) {
        // Game finished — empty cells are not clickable
        return EMOJI.empty;
      }

      // Active empty cell — clicking opens an issue
      return `[${EMOJI.empty}](${makeIssueUrl(key, repoUrl)})`;
    });

    lines.push(`| **${row}** | ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}

/** One-line status: whose turn / winner / draw. */
function renderStatus(state) {
  if (state.gameOver) {
    if (state.winner) {
      return `🏆 **Game over — ${EMOJI[state.winner]} ${state.winner} wins!**`;
    }
    if (state.draw) {
      return `🤝 **Game over — It's a draw!**`;
    }
  }
  return `▶ Current turn: ${EMOJI[state.currentPlayer]} ${state.currentPlayer}`;
}

/** Render the "Last Game" summary block. */
function renderLastGame(state) {
  const lcg = state.lastCompletedGame;
  if (!lcg || !lcg.finishedAt) {
    return '📋 Last Game — No completed games yet.';
  }

  const gameNumLabel = lcg.gameNumber ? ` #${lcg.gameNumber}` : '';

  // Format ISO timestamp → "2026-03-06 14:22 UTC" (no external deps)
  const dt = new Date(lcg.finishedAt);
  const pad = (n) => String(n).padStart(2, '0');
  const readable = [
    dt.getUTCFullYear(),
    '-',
    pad(dt.getUTCMonth() + 1),
    '-',
    pad(dt.getUTCDate()),
    ' ',
    pad(dt.getUTCHours()),
    ':',
    pad(dt.getUTCMinutes()),
    ' UTC',
  ].join('');

  const resultLabel = lcg.draw ? '🤝 Draw' : `🏆 ${lcg.result}`;
  const moveLabel = lcg.player
    ? `${lcg.finalMove} by [@${lcg.player}](https://github.com/${lcg.player})`
    : lcg.finalMove;

  return [
    `📋 Last Game${gameNumLabel} — ${resultLabel}`,
    `Winning move: ${moveLabel}`,
    `Finished: ${readable}`,
  ].join('\n');
}

/** Render the lifetime stats block. */
function renderStats(state) {
  const s = state.stats || { xWins: 0, oWins: 0, draws: 0 };
  return [
    '📊 Stats',
    `${EMOJI.X} X wins: ${s.xWins}`,
    `${EMOJI.O} O wins: ${s.oWins}`,
    `🤝 Draws: ${s.draws}`,
  ].join('\n');
}

/** Build the full fenced section that goes between the markers. */
function renderSection(state, repoUrl) {
  const board = renderBoard(state, repoUrl);
  const status = renderStatus(state);
  const gameNum = `#${state.gameNumber || 1}`;
  const lastGameNum =
    state.lastCompletedGame && state.lastCompletedGame.gameNumber
      ? `#${state.lastCompletedGame.gameNumber}`
      : null;
  const lastMove = state.lastMove
    ? `Last move: ${state.lastMove}${state.lastMovePlayer ? ` by [@${state.lastMovePlayer}](https://github.com/${state.lastMovePlayer})` : ''}`
    : 'No moves yet.';
  const lastGame = renderLastGame(state);
  const stats = renderStats(state);

  return [
    '## 🎮 Tic-Tac-Toe',
    '',
    `Current Game: ${gameNum}`,
    '',
    lastGame,
    '',
    stats,
    '',
    '---',
    '',
    status,
    '',
    'Click an empty square 🔲 to play your move.',
    '',
    board,
    '',
    `📍 ${lastMove}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// README update
// ---------------------------------------------------------------------------

function updateReadme(section) {
  const newBlock = `${MARKER_START}\n${section}\n${MARKER_END}`;

  let readme = '';
  if (fs.existsSync(README_FILE)) {
    readme = fs.readFileSync(README_FILE, 'utf8');
  }

  if (readme.includes(MARKER_START) && readme.includes(MARKER_END)) {
    // Replace everything between (and including) the markers
    const before = readme.slice(0, readme.indexOf(MARKER_START));
    const after = readme.slice(readme.indexOf(MARKER_END) + MARKER_END.length);
    readme = `${before}${newBlock}${after}`;
  } else {
    // Insert after the first top-level heading, or at the top if none exists
    const lines = readme.split('\n');
    const headingIndex = lines.findIndex((l) => l.startsWith('#'));
    const insertAt = headingIndex >= 0 ? headingIndex + 1 : 0;
    lines.splice(insertAt, 0, '', newBlock, '');
    readme = lines.join('\n');
  }

  fs.writeFileSync(README_FILE, readme);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const repoUrl = getRepoUrl();

  const section = renderSection(state, repoUrl);
  updateReadme(section);

  console.log(`README.md updated (repo: ${repoUrl})`);
}

main();
