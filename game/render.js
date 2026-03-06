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

  // 3. Fallback placeholder — links won't work until you deploy to GitHub
  console.warn('WARNING: Could not determine repository URL.');
  console.warn('Set GITHUB_REPOSITORY=owner/repo when running locally, e.g.:');
  console.warn('  GITHUB_REPOSITORY=yourname/yourrepo node game/render.js');
  return 'https://github.com/OWNER/REPO';
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
  return `▶️ **Current turn: ${EMOJI[state.currentPlayer]} ${state.currentPlayer}**`;
}

/** Build the full fenced section that goes between the markers. */
function renderSection(state, repoUrl) {
  const board = renderBoard(state, repoUrl);
  const status = renderStatus(state);
  const lastMove = state.lastMove
    ? `Last move: **${state.lastMove}**`
    : 'No moves yet.';

  const resetNote = state.gameOver
    ? '\n\n> 🔄 **Start a new game** — go to the **Actions** tab and run the **Reset Tic-Tac-Toe** workflow manually.'
    : '';

  return [
    '## 🎮 Tic-Tac-Toe',
    '',
    '> Play against the community! Click an empty square ⬜ to make your move.',
    '',
    status,
    '',
    board,
    '',
    `📌 ${lastMove}`,
    '',
    '> Each click opens a pre-filled GitHub Issue — the board updates automatically via Actions.',
    resetNote,
    '',
    '---',
    '',
    '_Powered by GitHub Issues + Actions_',
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
