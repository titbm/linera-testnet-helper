// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_SOLUTION') {
    getSolution()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Get current puzzle solution
async function getSolution() {
  // Get puzzle ID from URL
  const puzzleId = getPuzzleId();
  if (!puzzleId) {
    throw new Error('Cannot determine puzzle ID. Make sure you are on a puzzle page.');
  }
  
  // Get puzzle name
  const puzzleName = getPuzzleName();
  
  // Get grid size
  const gridSize = getGridSize();
  
  // Get alive cells
  const cells = getAliveCells();
  
  return {
    id: puzzleId,
    name: puzzleName,
    gridSize: gridSize,
    cells: cells,
    timestamp: new Date().toISOString()
  };
}

// Extract puzzle ID from page (since URL doesn't change in SPA)
function getPuzzleId() {
  // Get all h1 and h2 headings
  const headings = document.querySelectorAll('h1, h2');
  
  // Iterate through headings to find the puzzle name
  // Skip common app-level headings
  for (const heading of headings) {
    const text = heading.textContent.trim();
    
    // Skip if it's a common app heading or empty
    if (text === 'Conway\'s Game of Life' || 
        text === 'Game of Life' || 
        text === 'Puzzles' ||
        text === 'Game of Life Playground' ||
        text === 'Choose Your Challenge' ||
        !text) {
      continue;
    }
    
    // Convert puzzle name to ID format: "Four Blinkers 2" -> "four-blinkers-2"
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  
  return null;
}

// Extract puzzle name from page
function getPuzzleName() {
  // Get all h1 and h2 headings
  const headings = document.querySelectorAll('h1, h2');
  
  // Iterate through headings to find the puzzle name
  // Skip common app-level headings
  for (const heading of headings) {
    const text = heading.textContent.trim();
    
    // Skip if it's a common app heading or empty
    if (text === 'Conway\'s Game of Life' || 
        text === 'Game of Life' || 
        text === 'Puzzles' ||
        text === 'Game of Life Playground' ||
        text === 'Choose Your Challenge' ||
        !text) {
      continue;
    }
    
    // This should be the puzzle name
    return text;
  }
  
  return 'Unknown Puzzle';
}

// Detect grid size
function getGridSize() {
  // Strategy: Find the puzzle grid by looking near the "Game of Life Playground" heading
  // and finding a grid with many children (actual puzzle grid, not layout grid)
  
  // First, try to find the playground section
  const playgroundHeading = Array.from(document.querySelectorAll('h2')).find(h => 
    h.textContent.includes('Playground')
  );
  
  let searchRoot = playgroundHeading ? playgroundHeading.parentElement : document.body;
  
  // Find all grids and filter for the puzzle grid
  // Puzzle grid characteristics:
  // 1. Has display: grid or inline-grid
  // 2. Has many children (one per cell, typically 64+ for 8x8 grid)
  // 3. Has square gridTemplateColumns and gridTemplateRows
  const allDivs = searchRoot.querySelectorAll('div');
  let puzzleGrid = null;
  
  for (const el of allDivs) {
    const style = window.getComputedStyle(el);
    const display = style.display;
    
    // Must be a grid
    if (display !== 'grid' && display !== 'inline-grid') continue;
    
    const cols = style.gridTemplateColumns;
    const rows = style.gridTemplateRows;
    
    // Must have grid template
    if (!cols || !rows) continue;
    
    const colCount = cols.split(' ').filter(x => x).length;
    const rowCount = rows.split(' ').filter(x => x).length;
    const childCount = el.children.length;
    
    // Puzzle grid should have many children (at least 16 for 4x4, typically 64+ for 8x8+)
    // and square or near-square dimensions
    if (childCount >= 16 && colCount >= 4 && rowCount >= 4) {
      puzzleGrid = el;
      break; // Found the puzzle grid
    }
  }
  
  if (!puzzleGrid) {
    throw new Error('Puzzle grid not found. Make sure you are on a puzzle page with the grid visible.');
  }
  
  const style = window.getComputedStyle(puzzleGrid);
  const cols = style.gridTemplateColumns.split(' ').filter(x => x).length;
  const rows = style.gridTemplateRows.split(' ').filter(x => x).length;
  
  console.log('[GOL Recorder] Found puzzle grid:', { cols, rows, children: puzzleGrid.children.length });
  
  return { rows, cols };
}

// Get all alive cells with coordinates
function getAliveCells() {
  // Find grid first
  let grid = document.querySelector('.grid.relative');
  if (!grid) grid = document.querySelector('.grid');
  if (!grid) grid = document.querySelector('[class*="grid"]');
  if (!grid) {
    grid = Array.from(document.querySelectorAll('div')).find(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'grid' && style.gridTemplateColumns;
    });
  }
  
  if (!grid) {
    throw new Error('Grid not found');
  }
  
  // Get all clickable cells
  const cells = grid.querySelectorAll('div[tabindex="0"]');
  const aliveCells = [];
  
  for (const cell of cells) {
    // Check if cell is alive (solution cell with red-orange background)
    // Based on research: solution cells use rgb(222, 42, 2)
    const bgColor = cell.style.backgroundColor;
    const isAlive = bgColor === 'rgb(222, 42, 2)';
    
    if (isAlive) {
      // Parse grid-area: "row / col"
      const gridArea = cell.style.gridArea;
      if (gridArea) {
        const [row, col] = gridArea.split('/').map(s => parseInt(s.trim()));
        aliveCells.push({ row, col });
      }
    }
  }
  
  return aliveCells;
}
