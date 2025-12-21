// Moji - The game that plays itself
// First puzzle: 2025-12-21

// Testing flag - set to true to play unlimited times per day
const DEBUG_UNLIMITED_PLAYS = false;

const FIRST_PUZZLE_DATE = new Date('2025-12-21T00:00:00');
const GRID_WIDTH = 5;
const ROW_REVEAL_DELAY = 400; // ms between each row reveal

// Tile types with CSS class and emoji for sharing
const TILES = {
  empty: { css: 'empty', emoji: '⬜' },
  yellow: { css: 'yellow', emoji: '🟨' },
  green: { css: 'green', emoji: '🟩' },
  blue: { css: 'blue', emoji: '🟦' },
  purple: { css: 'purple', emoji: '🟪' },
  orange: { css: 'orange', emoji: '🟠' },
  star: { css: 'star', emoji: '⭐' },
  lightbulb: { css: 'lightbulb', emoji: '💡' },
  bluecircle: { css: 'blue', emoji: '🔵' },
};

const WIN_TILES = ['green', 'blue', 'purple', 'yellow'];
const CHAOS_TILES = ['green', 'purple', 'bluecircle', 'lightbulb', 'yellow', 'blue', 'orange', 'star'];

// Seeded random number generator (Mulberry32)
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Get puzzle number from date
function getPuzzleNumber(date = new Date()) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const first = new Date(FIRST_PUZZLE_DATE.getFullYear(), FIRST_PUZZLE_DATE.getMonth(), FIRST_PUZZLE_DATE.getDate());
  const diffTime = today - first;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

// Get today's date string for localStorage
function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Generate result for a given puzzle number
function generateResult(puzzleNumber) {
  const rand = mulberry32(puzzleNumber * 12345);

  // Check for special outcomes (~1.25% each, 5% total)
  const specialRoll = rand();

  if (specialRoll < 0.0125) {
    // Special win: 0 rows (empty grid)
    return { type: 'special-win', score: '0', rows: 0, isSpecial: true, isFail: false };
  } else if (specialRoll < 0.025) {
    // Special fail: 7 rows (doesn't break streak)
    return { type: 'special-fail', score: '7', rows: 7, isSpecial: true, isFail: false };
  } else if (specialRoll < 0.0375) {
    // Star win: random 1-6 rows with star finale
    const starRows = Math.floor(rand() * 6) + 1;
    return { type: 'special-star', score: '⭐', rows: starRows, isSpecial: true, isFail: false };
  } else if (specialRoll < 0.05) {
    // Lightbulb win: random 1-6 rows with lightbulb finale
    const bulbRows = Math.floor(rand() * 6) + 1;
    return { type: 'special-bulb', score: String(bulbRows), rows: bulbRows, isSpecial: true, isFail: false };
  }

  // Normal distribution: roughly normal around 4
  // Weights: 1(3%), 2(8%), 3(20%), 4(30%), 5(20%), 6(12%), X(7%)
  const outcomeRoll = rand();
  let score, rows, isFail = false;

  if (outcomeRoll < 0.03) {
    score = '1'; rows = 1;
  } else if (outcomeRoll < 0.11) {
    score = '2'; rows = 2;
  } else if (outcomeRoll < 0.31) {
    score = '3'; rows = 3;
  } else if (outcomeRoll < 0.61) {
    score = '4'; rows = 4;
  } else if (outcomeRoll < 0.81) {
    score = '5'; rows = 5;
  } else if (outcomeRoll < 0.93) {
    score = '6'; rows = 6;
  } else {
    score = 'X'; rows = 6; isFail = true;
  }

  return { type: isFail ? 'fail' : 'win', score, rows, isSpecial: false, isFail };
}

// Generate the tile grid
function generateGrid(puzzleNumber, result) {
  const rand = mulberry32(puzzleNumber * 54321);
  const grid = [];

  for (let row = 0; row < result.rows; row++) {
    const rowTiles = [];
    const isLastRow = row === result.rows - 1;

    // Special win: chaotic single row
    if (result.type === 'special-win') {
      for (let col = 0; col < GRID_WIDTH; col++) {
        const idx = Math.floor(rand() * CHAOS_TILES.length);
        rowTiles.push(CHAOS_TILES[idx]);
      }
    }
    // Star win: last row is all stars
    else if (isLastRow && result.type === 'special-star') {
      for (let col = 0; col < GRID_WIDTH; col++) {
        rowTiles.push('star');
      }
    }
    // Lightbulb win: last row is all lightbulbs
    else if (isLastRow && result.type === 'special-bulb') {
      for (let col = 0; col < GRID_WIDTH; col++) {
        rowTiles.push('lightbulb');
      }
    }
    // Normal win: last row is solid color
    else if (isLastRow && result.type === 'win') {
      const winTile = WIN_TILES[Math.floor(rand() * WIN_TILES.length)];
      for (let col = 0; col < GRID_WIDTH; col++) {
        rowTiles.push(winTile);
      }
    }
    // All other rows (including fail rows): random mix
    else {
      for (let col = 0; col < GRID_WIDTH; col++) {
        const progressBias = row / result.rows;
        const r = rand();

        if (r < 0.2 + progressBias * 0.3) {
          rowTiles.push('green');
        } else if (r < 0.5 + progressBias * 0.2) {
          rowTiles.push('yellow');
        } else if (r < 0.7) {
          rowTiles.push('empty');
        } else if (r < 0.85) {
          rowTiles.push('blue');
        } else {
          rowTiles.push('purple');
        }
      }
    }

    grid.push(rowTiles);
  }

  return grid;
}

// localStorage helpers
function getStats() {
  const stored = localStorage.getItem('moji-stats');
  if (!stored) {
    return {
      gamesPlayed: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, 'X': 0 },
      specialOutcomes: {},
      lastPlayedDate: null,
      history: []
    };
  }
  return JSON.parse(stored);
}

function saveStats(stats) {
  localStorage.setItem('moji-stats', JSON.stringify(stats));
}

function hasPlayedToday() {
  if (DEBUG_UNLIMITED_PLAYS) return false;
  const stats = getStats();
  return stats.lastPlayedDate === getTodayString();
}

function getTodayResult() {
  const stats = getStats();
  if (stats.lastPlayedDate === getTodayString() && stats.history.length > 0) {
    return stats.history[stats.history.length - 1];
  }
  return null;
}

// Record result to localStorage FIRST before showing animation
function recordResult(puzzleNumber, result, grid) {
  const stats = getStats();
  const today = getTodayString();

  stats.gamesPlayed++;
  stats.lastPlayedDate = today;

  // Track distribution
  if (result.isSpecial) {
    let specialKey;
    if (result.type === 'special-win') specialKey = '0';
    else if (result.type === 'special-fail') specialKey = '7';
    else if (result.type === 'special-star') specialKey = '⭐';
    else if (result.type === 'special-bulb') specialKey = '💡';

    if (!stats.specialOutcomes[specialKey]) {
      stats.specialOutcomes[specialKey] = 0;
    }
    stats.specialOutcomes[specialKey]++;
  } else {
    stats.distribution[result.score]++;
  }

  // Update streak
  if (result.isFail) {
    stats.currentStreak = 0;
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (stats.history.length > 0) {
      const lastPlay = stats.history[stats.history.length - 1];
      if (lastPlay.date === yesterdayStr && !lastPlay.isFail) {
        stats.currentStreak++;
      } else if (lastPlay.date !== yesterdayStr) {
        stats.currentStreak = 1;
      } else {
        stats.currentStreak++;
      }
    } else {
      stats.currentStreak = 1;
    }

    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }
  }

  // Add to history
  stats.history.push({
    date: today,
    puzzleNumber,
    score: result.score,
    type: result.type,
    isFail: result.isFail,
    isSpecial: result.isSpecial,
    grid: grid
  });

  saveStats(stats);
  return stats;
}

// Convert tile type to emoji for sharing
function tileToEmoji(tileType) {
  return TILES[tileType]?.emoji || '⬜';
}

// Format score for display
function formatScore(result) {
  if (result.type === 'special-bulb') {
    return `${result.score}/💡`;
  }
  return `${result.score}/6`;
}

// Generate share text
function generateShareText(puzzleNumber, result, grid, streak) {
  let text = `Moji #${puzzleNumber} ${formatScore(result)}\n\n`;

  for (const row of grid) {
    text += row.map(tileToEmoji).join('') + '\n';
  }

  if (streak > 1 && !result.isFail) {
    text += `\n🔥 ${streak} day streak`;
  }

  return text.trim();
}

// UI Elements
const playContainer = document.getElementById('play-container');
const playBtn = document.getElementById('play-btn');
const resultContainer = document.getElementById('result-container');
const resultHeader = document.getElementById('result-header');
const puzzleNumberEl = document.getElementById('puzzle-number');
const resultScoreEl = document.getElementById('result-score');
const gridDisplay = document.getElementById('grid-display');
const bottomSection = document.getElementById('bottom-section');
const streakDisplay = document.getElementById('streak-display');
const shareBtn = document.getElementById('share-btn');
const copiedToast = document.getElementById('copied-toast');
const statsBtn = document.getElementById('stats-btn');
const statsModal = document.getElementById('stats-modal');
const modalClose = document.getElementById('modal-close');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const helpClose = document.getElementById('help-close');

let currentPuzzleNumber = getPuzzleNumber();
let currentResult = null;
let currentGrid = null;
let currentStats = null;
let debugPlayCount = 0; // For generating different results in debug mode

// Build the grid DOM (without revealing)
function buildGrid(grid) {
  gridDisplay.innerHTML = '';

  grid.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'grid-row';

    row.forEach((tileType) => {
      const tile = document.createElement('div');
      const cssClass = TILES[tileType]?.css || 'empty';
      tile.className = `grid-tile ${cssClass}`;
      rowEl.appendChild(tile);
    });

    gridDisplay.appendChild(rowEl);
  });
}

// Animate reveal: tiles flip left-to-right, row by row
function revealGridAnimated(callback) {
  const rows = gridDisplay.querySelectorAll('.grid-row');
  const TILE_DELAY = 80;  // ms between each tile in a row

  let totalDelay = 0;

  rows.forEach((row, rowIndex) => {
    const tiles = row.querySelectorAll('.grid-tile');

    tiles.forEach((tile, tileIndex) => {
      const delay = totalDelay + (tileIndex * TILE_DELAY);
      setTimeout(() => {
        tile.classList.add('revealed');
      }, delay);
    });

    // After this row's tiles, add delay before next row
    totalDelay += (tiles.length * TILE_DELAY) + 150;
  });

  // After all tiles revealed, trigger callback
  if (callback) {
    setTimeout(callback, totalDelay);
  }
}

// Show grid instantly (for returning visitors)
function revealGridInstant() {
  const tiles = gridDisplay.querySelectorAll('.grid-tile');
  tiles.forEach(tile => tile.classList.add('revealed'));
  resultHeader.classList.add('revealed');
  bottomSection.classList.add('revealed');
}

// Update streak display
function updateStreakDisplay(stats, result) {
  if (stats.currentStreak > 1 && !result.isFail) {
    streakDisplay.textContent = `🔥 ${stats.currentStreak} day streak`;
    streakDisplay.className = 'streak-display active';
  } else if (result.isFail) {
    streakDisplay.textContent = 'Streak lost 💔';
    streakDisplay.className = 'streak-display';
  } else {
    streakDisplay.textContent = '';
    streakDisplay.className = 'streak-display';
  }
}

// Show result with animation (for new plays)
function showResultAnimated(puzzleNumber, result, grid, stats) {
  playContainer.style.display = 'none';

  puzzleNumberEl.textContent = puzzleNumber;
  resultScoreEl.textContent = formatScore(result);

  buildGrid(grid);
  updateStreakDisplay(stats, result);

  resultContainer.classList.add('visible');

  // Start grid reveal immediately (tiles flip left-to-right, row by row)
  setTimeout(() => {
    revealGridAnimated(() => {
      // After grid reveal, show header/score
      resultHeader.classList.add('revealed');

      // Then show bottom section
      setTimeout(() => {
        bottomSection.classList.add('revealed');

        // In debug mode, show play button again after a delay
        if (DEBUG_UNLIMITED_PLAYS) {
          setTimeout(() => {
            playContainer.style.display = 'block';
            playBtn.textContent = 'Play Again';
          }, 1000);
        }
      }, 300);
    });
  }, 100);
}

// Show result instantly (for returning visitors)
function showResultInstant(puzzleNumber, result, grid, stats) {
  playContainer.style.display = 'none';

  puzzleNumberEl.textContent = puzzleNumber;
  resultScoreEl.textContent = formatScore(result);

  buildGrid(grid);
  updateStreakDisplay(stats, result);

  resultContainer.classList.add('visible');
  revealGridInstant();
}

// Play the game
function play() {
  if (hasPlayedToday()) {
    const todayResult = getTodayResult();
    if (todayResult) {
      showResultInstant(
        todayResult.puzzleNumber,
        { score: todayResult.score, type: todayResult.type, isFail: todayResult.isFail, isSpecial: todayResult.isSpecial },
        todayResult.grid,
        getStats()
      );
    }
    return;
  }

  // Reset UI for new play (needed for debug mode replays)
  resultHeader.classList.remove('revealed');
  bottomSection.classList.remove('revealed');
  gridDisplay.innerHTML = '';

  // Use timestamp as seed for unique results per player
  const playerSeed = Date.now();
  const puzzleSeed = DEBUG_UNLIMITED_PLAYS
    ? currentPuzzleNumber * 1000 + debugPlayCount++
    : playerSeed;

  // Generate and PERSIST first
  currentResult = generateResult(puzzleSeed);
  currentGrid = generateGrid(playerSeed, currentResult);
  currentStats = recordResult(currentPuzzleNumber, currentResult, currentGrid);

  // Then show animation
  showResultAnimated(currentPuzzleNumber, currentResult, currentGrid, currentStats);
}

// Check if mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Icons
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
</svg>`;

const SHARE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
  <polyline points="16,6 12,2 8,6"/>
  <line x1="12" y1="2" x2="12" y2="15"/>
</svg>`;

const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;

// Set up share button based on platform
function setupShareButton() {
  shareBtn.innerHTML = `${SHARE_ICON} Share`;
}

// Fallback copy using textarea (preserves user selection)
function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);

  // Save current selection
  const selected = document.getSelection().rangeCount > 0
    ? document.getSelection().getRangeAt(0)
    : false;

  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);

  // Restore previous selection
  if (selected) {
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(selected);
  }

  return success;
}

// Show copy success feedback
function showCopySuccess() {
  shareBtn.innerHTML = `${CHECK_ICON} Copied!`;
  shareBtn.style.background = '#538d4e';
  copiedToast.classList.add('visible');

  setTimeout(() => {
    setupShareButton();
    shareBtn.style.background = '';
    copiedToast.classList.remove('visible');
  }, 2000);
}

// Share/Copy result
function shareResult() {
  // Guard: ensure we have data to share
  if (!currentResult || !currentGrid) {
    console.error('No result to share');
    return;
  }

  const stats = getStats();
  const shareText = generateShareText(currentPuzzleNumber, currentResult, currentGrid, stats.currentStreak);

  // Mobile: use native share
  if (isMobile && navigator.share) {
    navigator.share({ text: shareText }).catch(() => {
      // User cancelled - that's fine
    });
    return;
  }

  // Desktop: try clipboard API first, then fallback
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareText).then(() => {
      showCopySuccess();
    }).catch(() => {
      // Clipboard API failed, try fallback
      if (fallbackCopy(shareText)) {
        showCopySuccess();
      } else {
        alert('Copy this:\n\n' + shareText);
      }
    });
  } else {
    // No clipboard API, use fallback directly
    if (fallbackCopy(shareText)) {
      showCopySuccess();
    } else {
      alert('Copy this:\n\n' + shareText);
    }
  }
}

// Update stats modal
function updateStatsModal() {
  const stats = getStats();

  document.getElementById('stat-played').textContent = stats.gamesPlayed;

  const wins = stats.gamesPlayed - stats.distribution['X'];
  const winPct = stats.gamesPlayed > 0 ? Math.round((wins / stats.gamesPlayed) * 100) : 0;
  document.getElementById('stat-win-pct').textContent = winPct;

  document.getElementById('stat-streak').textContent = stats.currentStreak;
  document.getElementById('stat-max-streak').textContent = stats.maxStreak;

  const chart = document.getElementById('distribution-chart');
  chart.innerHTML = '';

  // Build keys in order: 0 (if any), 1-6, 7 (if any), ⭐ (if any), 💡 (if any), X (fails last)
  const allKeys = [];
  if (stats.specialOutcomes['0']) allKeys.push('0');
  allKeys.push('1', '2', '3', '4', '5', '6');
  if (stats.specialOutcomes['7']) allKeys.push('7');
  if (stats.specialOutcomes['⭐']) allKeys.push('⭐');
  if (stats.specialOutcomes['💡']) allKeys.push('💡');
  allKeys.push('X');

  const maxCount = Math.max(
    ...Object.values(stats.distribution),
    ...Object.values(stats.specialOutcomes),
    1
  );

  const todayResult = getTodayResult();
  const specialKeys = ['0', '7', '⭐', '💡'];

  allKeys.forEach(key => {
    let count;
    let isSpecial = specialKeys.includes(key);
    let isFail = key === 'X' || key === '7';

    if (isSpecial) {
      count = stats.specialOutcomes[key] || 0;
    } else {
      count = stats.distribution[key] || 0;
    }

    const row = document.createElement('div');
    row.className = 'distribution-row';

    const label = document.createElement('div');
    label.className = 'distribution-label';
    label.textContent = key;

    const barContainer = document.createElement('div');
    barContainer.className = 'distribution-bar-container';

    const bar = document.createElement('div');
    bar.className = 'distribution-bar';

    if (isSpecial) {
      bar.classList.add('special');
    } else if (isFail) {
      bar.classList.add('fail');
    }

    // Highlight today's result
    if (todayResult) {
      const isMatch = (
        todayResult.score === key ||
        (key === '💡' && todayResult.type === 'special-bulb')
      );
      if (isMatch) {
        bar.classList.add('highlight');
      }
    }

    const width = count > 0 ? Math.max((count / maxCount) * 100, 8) : 8;
    bar.style.width = `${width}%`;
    bar.textContent = count;

    barContainer.appendChild(bar);
    row.appendChild(label);
    row.appendChild(barContainer);
    chart.appendChild(row);
  });
}

// Update countdown timer
function updateCountdown() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diff = tomorrow - now;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const timer = document.getElementById('next-game-timer');
  timer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Event listeners
playBtn.addEventListener('click', play);
shareBtn.addEventListener('click', shareResult);

statsBtn.addEventListener('click', () => {
  updateStatsModal();
  statsModal.classList.add('visible');
});

modalClose.addEventListener('click', () => {
  statsModal.classList.remove('visible');
});

statsModal.addEventListener('click', (e) => {
  if (e.target === statsModal) {
    statsModal.classList.remove('visible');
  }
});

helpBtn.addEventListener('click', () => {
  helpModal.classList.add('visible');
});

helpClose.addEventListener('click', () => {
  helpModal.classList.remove('visible');
});

helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) {
    helpModal.classList.remove('visible');
  }
});

// Initialize
function init() {
  // Set up share button text based on platform
  setupShareButton();

  // Start countdown timer
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Check if already played today - show result instantly
  if (hasPlayedToday()) {
    const todayResult = getTodayResult();
    if (todayResult) {
      currentPuzzleNumber = todayResult.puzzleNumber;
      currentResult = {
        score: todayResult.score,
        type: todayResult.type,
        isFail: todayResult.isFail,
        isSpecial: todayResult.isSpecial
      };
      currentGrid = todayResult.grid;
      currentStats = getStats();

      showResultInstant(currentPuzzleNumber, currentResult, currentGrid, currentStats);
    }
  }
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('ServiceWorker registration failed:', err);
    });
  });
}

init();
