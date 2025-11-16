// Auto-solver for Linera Game of Life puzzles
// This script loads solutions from gol-solutions.json and automatically solves puzzles

// Configuration
const SOLUTIONS_URL = chrome.runtime.getURL('gol-solutions.json');
const LEARN_ANSWERS_URL = chrome.runtime.getURL('learn-answers.json');
const DELAY_BETWEEN_CLICKS = 100; // ms between cell clicks
const DELAY_AFTER_SUBMIT = 2000; // ms to wait after successful submission before next puzzle
const DELAY_BETWEEN_QUESTS = 1500; // ms to wait between processing quests

// State
let isRunning = false;
let solutions = null;
let learnAnswers = null;
let solvedPuzzles = new Set();
let currentPuzzleId = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_SOLVER') {
    startSolver()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.action === 'STOP_SOLVER') {
    stopSolver();
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'GET_SOLVER_STATUS') {
    sendResponse({ 
      isRunning, 
      solvedCount: solvedPuzzles.size,
      currentPuzzle: getPuzzleId() || 'N/A'
    });
    return true;
  } else if (message.action === 'CLAIM_GOL_QUESTS') {
    isRunning = true; // Enable running flag for stopping
    claimGameOfLifeQuests()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }))
      .finally(() => { isRunning = false; });
    return true;
  } else if (message.action === 'ANSWER_LEARN_QUESTIONS') {
    isRunning = true; // Enable running flag for stopping
    answerLearnQuestions()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }))
      .finally(() => { isRunning = false; });
    return true;
  }
});

// Load solutions from JSON
async function loadSolutions() {
  if (solutions) return solutions;
  
  try {
    const response = await fetch(SOLUTIONS_URL);
    solutions = await response.json();
    console.log('[Solver] Loaded solutions:', Object.keys(solutions));
    return solutions;
  } catch (error) {
    console.error('[Solver] Failed to load solutions:', error);
    throw new Error('Failed to load solutions file');
  }
}

// Initialize solver based on current page state
async function initializeFromCurrentState() {
  console.log('[Solver] Checking current page state...');
  
  // Check if user is not logged in
  if (isWaitingForLogin()) {
    console.log('[Solver] User not logged in, clicking Log In button...');
    
    // Click the Log In button
    if (!clickLoginButton()) {
      console.log('[Solver] Could not find Log In button, waiting...');
    }
    
    console.log('[Solver] Waiting for wallet connection...');
    await waitForLogin();
    console.log('[Solver] User logged in successfully');
    await sleep(2000); // Wait for page to fully load after login
  }
  
  // Check if we're on a puzzle page
  const puzzleId = getPuzzleId();
  
  if (puzzleId) {
    console.log('[Solver] Starting from puzzle page:', puzzleId);
    currentPuzzleId = puzzleId;
    
    // If puzzle is already completed, navigate away
    if (await isPuzzleCompleted()) {
      console.log('[Solver] Current puzzle already completed, navigating to puzzle list...');
      await navigateToPuzzleList();
      await sleep(2000);
    }
  } else {
    console.log('[Solver] Starting from puzzle list page');
  }
}

// Click the Log In button
function clickLoginButton() {
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase().trim();
    if (text.includes('log in') || text === 'login') {
      console.log('[Solver] Clicking Log In button...');
      button.click();
      return true;
    }
  }
  
  return false;
}

// Check if waiting for login
function isWaitingForLogin() {
  const bodyText = document.body.innerText;
  return bodyText.includes('Please connect your wallet') || 
         bodyText.includes('Connecting to wallet') || 
         bodyText.includes('Connect wallet') ||
         bodyText.includes('Connect Wallet') ||
         bodyText.includes('Log In');
}

// Wait for user to login
async function waitForLogin() {
  const maxWait = 300000; // 5 minutes max wait
  const checkInterval = 1000;
  let elapsed = 0;
  
  console.log('[Solver] Waiting for user to connect wallet...');
  
  while (elapsed < maxWait && isRunning) {
    // Check if login screen is gone
    const bodyText = document.body.innerText;
    
    // Login is complete when we no longer see login prompts
    // and we see either the puzzle list or a puzzle page
    const stillWaitingForLogin = bodyText.includes('Please connect your wallet') || 
                                  bodyText.includes('Connecting to wallet');
    
    if (!stillWaitingForLogin) {
      // Check if content loaded
      if (bodyText.includes('Choose Your Challenge') || 
          bodyText.includes('Conway\'s Game of Life') ||
          getPuzzleId()) {
        console.log('[Solver] Login successful, content loaded');
        return true;
      }
    }
    
    await sleep(checkInterval);
    elapsed += checkInterval;
    
    // Log progress every 10 seconds
    if (elapsed % 10000 === 0) {
      console.log(`[Solver] Still waiting for login... (${elapsed/1000}s)`);
    }
  }
  
  if (!isRunning) {
    throw new Error('Solver stopped while waiting for login');
  }
  
  throw new Error('Login timeout - user did not connect wallet');
}

// Navigate to puzzle list
async function navigateToPuzzleList() {
  console.log('[Solver] Navigating to puzzle list...');
  
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase().trim();
    if (text === 'back to puzzles') {
      console.log('[Solver] Clicking "Back to Puzzles"...');
      button.click();
      await sleep(1500);
      return true;
    }
  }
  
  // If no button found, try navigating to main page
  console.log('[Solver] No "Back to Puzzles" button, trying to navigate to main page...');
  window.location.href = '/gol/index.html';
  await sleep(2000);
  return true;
}

// Start the auto-solver
async function startSolver() {
  if (isRunning) {
    console.log('[Solver] Already running');
    return;
  }
  
  console.log('[Solver] Starting...');
  isRunning = true;
  
  try {
    await loadSolutions();
    
    // Initialize based on current page state
    await initializeFromCurrentState();
    
    await solverLoop();
  } catch (error) {
    console.error('[Solver] Error:', error);
    isRunning = false;
    throw error;
  }
}

// Stop the solver
function stopSolver() {
  console.log('[Solver] Stopping...');
  isRunning = false;
}

// Main solver loop
async function solverLoop() {
  while (isRunning) {
    try {
      // Get current puzzle ID
      const puzzleId = getPuzzleId();
      if (!puzzleId) {
        console.log('[Solver] No puzzle detected, checking if on puzzle list...');
        
        // If we're on the puzzle list, select the first unsolved puzzle
        const bodyText = document.body.innerText;
        if (bodyText.includes('Choose Your Challenge')) {
          console.log('[Solver] On puzzle list, selecting first unsolved puzzle...');
          const moved = await selectNextUnsolvedPuzzle();
          if (!moved) {
            console.log('[Solver] No unsolved puzzles available');
            stopSolver();
            break;
          }
          await sleep(2000);
          continue;
        }
        
        console.log('[Solver] Unknown page state, waiting...');
        await sleep(1000);
        continue;
      }
      
      // Check if we're stuck on the same puzzle
      if (currentPuzzleId === puzzleId && solvedPuzzles.has(puzzleId)) {
        console.log('[Solver] Already solved this puzzle, forcing navigation...');
        const moved = await goToNextPuzzle();
        if (!moved) {
          console.log('[Solver] Cannot move to next puzzle, stopping...');
          stopSolver();
          break;
        }
        await sleep(2000);
        continue;
      }
      
      currentPuzzleId = puzzleId;
      console.log('[Solver] Current puzzle:', puzzleId);
      
      // Check if already completed
      if (await isPuzzleCompleted()) {
        console.log('[Solver] Puzzle already completed, moving to next...');
        solvedPuzzles.add(puzzleId);
        const moved = await goToNextPuzzle();
        if (!moved) {
          console.log('[Solver] No more puzzles available');
          stopSolver();
          break;
        }
        await sleep(2000);
        continue;
      }
      
      // Check if we have a solution
      const solution = solutions[puzzleId];
      if (!solution) {
        console.log('[Solver] No solution found for:', puzzleId);
        const moved = await goToNextPuzzle();
        if (!moved) {
          console.log('[Solver] No more puzzles available');
          stopSolver();
          break;
        }
        await sleep(2000);
        continue;
      }
      
      // Solve the puzzle
      console.log('[Solver] Solving:', puzzleId);
      await solvePuzzle(solution);
      
      // Submit solution
      await submitSolution();
      
      // Wait for success message
      const success = await waitForSubmissionResult();
      
      if (success) {
        console.log('[Solver] Successfully solved:', puzzleId);
        solvedPuzzles.add(puzzleId);
        
        // Wait for next button to appear
        await sleep(1000);
        
        // Try to move to next puzzle
        const moved = await goToNextPuzzle();
        if (!moved) {
          console.log('[Solver] No more puzzles available');
          stopSolver();
          break;
        }
        
        // Wait for new puzzle to load
        await sleep(2000);
      } else {
        console.log('[Solver] Failed to solve:', puzzleId);
        const moved = await goToNextPuzzle();
        if (!moved) {
          console.log('[Solver] No more puzzles available');
          stopSolver();
          break;
        }
        await sleep(2000);
      }
      
    } catch (error) {
      console.error('[Solver] Error in loop:', error);
      await sleep(2000);
    }
  }
  
  console.log('[Solver] Stopped');
}

// Get puzzle ID from page
function getPuzzleId() {
  const headings = document.querySelectorAll('h1, h2');
  
  for (const heading of headings) {
    const text = heading.textContent.trim();
    
    if (text === 'Conway\'s Game of Life' || 
        text === 'Game of Life' || 
        text === 'Puzzles' ||
        text === 'Game of Life Playground' ||
        text === 'Choose Your Challenge' ||
        !text) {
      continue;
    }
    
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  
  return null;
}

// Check if puzzle is already completed
async function isPuzzleCompleted() {
  // Look for "Puzzle already completed!" message
  const messages = document.body.innerText;
  return messages.includes('Puzzle already completed!');
}

// Find the puzzle grid
function findPuzzleGrid() {
  const allDivs = document.querySelectorAll('div');
  
  for (const el of allDivs) {
    const style = window.getComputedStyle(el);
    const display = style.display;
    
    if (display !== 'grid' && display !== 'inline-grid') continue;
    
    const cols = style.gridTemplateColumns;
    const rows = style.gridTemplateRows;
    
    if (!cols || !rows) continue;
    
    const colCount = cols.split(' ').filter(x => x).length;
    const rowCount = rows.split(' ').filter(x => x).length;
    const childCount = el.children.length;
    
    if (childCount >= 16 && colCount >= 4 && rowCount >= 4) {
      return el;
    }
  }
  
  return null;
}

// Solve puzzle by clicking cells
async function solvePuzzle(solution) {
  const grid = findPuzzleGrid();
  if (!grid) {
    throw new Error('Puzzle grid not found');
  }
  
  console.log('[Solver] Found grid, clicking cells...');
  
  // Get all clickable cells
  const cells = grid.querySelectorAll('div[tabindex="0"]');
  
  // Click each cell in the solution
  for (const cellCoord of solution.cells) {
    if (!isRunning) break;
    
    const { row, col } = cellCoord;
    
    // Find cell by grid-area
    const cell = Array.from(cells).find(el => {
      const gridArea = el.style.gridArea;
      if (!gridArea) return false;
      const [r, c] = gridArea.split('/').map(s => parseInt(s.trim()));
      return r === row && c === col;
    });
    
    if (cell) {
      console.log(`[Solver] Clicking cell (${row}, ${col})`);
      cell.click();
      await sleep(DELAY_BETWEEN_CLICKS);
    } else {
      console.warn(`[Solver] Cell not found: (${row}, ${col})`);
    }
  }
  
  console.log('[Solver] Finished clicking cells');
}

// Submit solution
async function submitSolution() {
  // Look for Submit or Resubmit button
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('submit solution') || text.includes('resubmit solution')) {
      console.log('[Solver] Clicking submit button...');
      button.click();
      await sleep(500);
      return;
    }
  }
  
  throw new Error('Submit button not found');
}

// Wait for submission result
async function waitForSubmissionResult() {
  const maxWait = 5000; // 5 seconds
  const checkInterval = 200;
  let elapsed = 0;
  
  while (elapsed < maxWait) {
    const text = document.body.innerText;
    
    if (text.includes('Solution submitted successfully!')) {
      return true;
    }
    
    if (text.includes('incorrect') || text.includes('failed')) {
      return false;
    }
    
    await sleep(checkInterval);
    elapsed += checkInterval;
  }
  
  return false;
}

// Go to next puzzle
async function goToNextPuzzle() {
  console.log('[Solver] Attempting to navigate to next puzzle...');
  
  // Look for "Next puzzle" button (the most reliable way)
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase().trim();
    if (text === 'next puzzle') {
      console.log('[Solver] Found "Next puzzle" button, clicking...');
      button.click();
      await sleep(2000);
      
      // Verify we moved to a different puzzle
      const newPuzzleId = getPuzzleId();
      if (newPuzzleId && newPuzzleId !== currentPuzzleId) {
        console.log('[Solver] Successfully moved to:', newPuzzleId);
        return true;
      }
      console.log('[Solver] Button clicked but puzzle did not change');
    }
  }
  
  // If no "Next puzzle" button found, go back to puzzle list and select next unsolved puzzle
  console.log('[Solver] No "Next puzzle" button found, going back to puzzle list...');
  
  if (!await navigateToPuzzleList()) {
    return false;
  }
  
  // Now we should be on the puzzle list page, find next unsolved puzzle
  return await selectNextUnsolvedPuzzle();
}

// Select next unsolved puzzle from the list
async function selectNextUnsolvedPuzzle() {
  console.log('[Solver] Looking for unsolved puzzles in list...');
  
  await sleep(1000);
  const puzzleButtons = document.querySelectorAll('button');
  
  // Try to find and click on an unsolved puzzle
  for (const button of puzzleButtons) {
    // Extract puzzle name from button text (usually the first heading in the button)
    const heading = button.querySelector('h3, h2, h1');
    if (!heading) continue;
    
    const puzzleName = heading.textContent.trim();
    const id = puzzleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Skip if we already solved it in this session
    if (solvedPuzzles.has(id)) {
      console.log('[Solver] Skipping already solved (session):', id);
      continue;
    }
    
    // Check for the green checkmark SVG icon
    const hasCheckmark = button.querySelector('svg.lucide-circle-check-big') ||
                         button.querySelector('svg.lucide-circle-check') ||
                         button.querySelector('.lucide-circle-check') ||
                         button.querySelector('svg.text-green-600') ||
                         button.querySelector('.text-green-600') ||
                         button.querySelector('[class*="circle-check"]');
    
    if (hasCheckmark) {
      console.log('[Solver] Skipping completed puzzle (has checkmark):', puzzleName);
      solvedPuzzles.add(id); // Add to solved list
      continue;
    }
    
    // Check if we have a solution for this puzzle
    if (solutions && solutions[id]) {
      console.log('[Solver] Found unsolved puzzle with solution:', puzzleName);
      button.click();
      await sleep(2000);
      
      // Verify we moved to a different puzzle
      const newPuzzleId = getPuzzleId();
      if (newPuzzleId && newPuzzleId !== currentPuzzleId) {
        console.log('[Solver] Successfully moved to:', newPuzzleId);
        return true;
      }
    }
  }
  
  console.log('[Solver] No unsolved puzzles found with solutions');
  return false;
}

// Utility: sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== NEW FUNCTIONS FOR QUESTS AND LEARN =====

// Load learn answers from JSON
async function loadLearnAnswers() {
  if (learnAnswers) return learnAnswers;
  
  try {
    const response = await fetch(LEARN_ANSWERS_URL);
    learnAnswers = await response.json();
    console.log('[Quests] Loaded learn answers:', Object.keys(learnAnswers));
    return learnAnswers;
  } catch (error) {
    console.error('[Quests] Failed to load learn answers:', error);
    throw new Error('Failed to load learn answers file');
  }
}

// ==================== NEW QUEST AUTOMATION FUNCTIONS ====================

// Load learn answers from JSON
async function loadLearnAnswers() {
  if (learnAnswers) return learnAnswers;
  
  try {
    const response = await fetch(LEARN_ANSWERS_URL);
    learnAnswers = await response.json();
    console.log('[Learn] Loaded answers for', Object.keys(learnAnswers).length, 'questions');
    return learnAnswers;
  } catch (error) {
    console.error('[Learn] Failed to load answers:', error);
    throw new Error('Failed to load learn answers file');
  }
}

// Claim Game of Life Quests on portal.linera.net/quests
async function claimGameOfLifeQuests() {
  console.log('[Quests] Starting Game of Life quest claim automation...');
  
  try {
    // Check if we're on the quests page
    if (!window.location.href.includes('portal.linera.net')) {
      throw new Error('Not on portal.linera.net - please navigate to /quests first');
    }
    
    // Navigate to quests page if not already there
    if (!window.location.pathname.includes('/quests')) {
      console.log('[Quests] Navigating to /quests...');
      window.location.href = '/quests';
      await sleep(3000);
    }
    
    // Wait for page to load
    console.log('[Quests] Waiting for page to load...');
    await sleep(3000);
    
    // Find all clickable quest cards by looking for h4 and finding their clickable parent
    console.log('[Quests] Looking for Game of Life quest cards...');
    const allH4 = document.querySelectorAll('h4');
    const questButtons = [];
    
    for (const h4 of allH4) {
      const headingText = h4.textContent.trim();
      // Match Game of Life quest patterns:
      // - "Complete the X Puzzle"
      // - "Complete the X" (for Reflector/Density quests)
      const isGolQuest = headingText.startsWith('Complete the') && 
                        (headingText.includes('Puzzle') || 
                         headingText.includes('Reflector') || 
                         headingText.includes('Density'));
      
      if (isGolQuest) {
        console.log('[Quests] Found quest heading:', headingText);
        
        // Find the clickable parent - it's usually a <generic> element with cursor:pointer
        // Go up until we find an element that contains both h4 AND "Start Quest" text
        let container = h4;
        let clickableCard = null;
        
        for (let i = 0; i < 20 && container; i++) {
          container = container.parentElement;
          if (!container) break;
          
          // Check if this container has both the h4 and "Start Quest" in text
          const hasH4 = container.contains(h4);
          const hasStartQuest = container.textContent.includes('Start Quest');
          
          if (hasH4 && hasStartQuest) {
            // This is the card - it should be clickable
            clickableCard = container;
            console.log('[Quests] Found clickable card for:', headingText);
            break;
          }
        }
        
        if (clickableCard) {
          questButtons.push({ button: clickableCard, name: headingText });
        } else {
          console.log('[Quests] Could not find clickable card for:', headingText);
        }
      }
    }
    
    console.log('[Quests] Found', questButtons.length, 'GoL quest cards');
    
    if (questButtons.length === 0) {
      throw new Error('No Game of Life quests found - they may already be completed or page not loaded');
    }
    
    let claimedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < questButtons.length; i++) {
      if (!isRunning) {
        console.log('[Quests] Stopped by user');
        break;
      }
      
      const { button, name } = questButtons[i];
      console.log(`[Quests] Processing ${i + 1}/${questButtons.length}:`, name);
      
      // Check if quest already completed (has "Completed" text)
      const buttonText = button.textContent || '';
      if (buttonText.includes('Completed')) {
        console.log('[Quests] Already completed (has Completed text), skipping');
        skippedCount++;
        continue;
      }
      
      // Click the card to open quest dialog
      console.log('[Quests] Clicking quest card...');
      console.log('[Quests] Card element:', button.tagName, button.className);
      button.click();
      await sleep(2000);
      
      // Look for "Check Puzzle" button in the dialog
      console.log('[Quests] Looking for Check Puzzle button...');
      await sleep(500);
      
      const dialogButtons = document.querySelectorAll('button');
      console.log('[Quests] Found', dialogButtons.length, 'buttons after click');
      let checkPuzzleBtn = null;
      
      for (const btn of dialogButtons) {
        const btnText = btn.textContent.toLowerCase();
        if (btnText.includes('check puzzle')) {
          checkPuzzleBtn = btn;
          console.log('[Quests] Found Check Puzzle button');
          break;
        }
      }
      
      if (checkPuzzleBtn) {
        console.log('[Quests] Clicking "Check Puzzle" button...');
        checkPuzzleBtn.click();
        await sleep(2500);
        
        // Check for success/error messages
        const bodyText = document.body.innerText;
        if (bodyText.includes('successfully') || bodyText.includes('claimed')) {
          console.log('[Quests] Successfully claimed!');
          claimedCount++;
        } else if (bodyText.includes('already completed') || bodyText.includes('already claimed')) {
          console.log('[Quests] Already completed');
          skippedCount++;
        } else {
          console.log('[Quests] Check result unclear');
          claimedCount++;
        }
      } else {
        console.log('[Quests] "Check Puzzle" button not found');
        console.log('[Quests] Available buttons:', Array.from(dialogButtons).map(b => b.textContent.substring(0, 30)));
        console.log('[Quests] This puzzle may need to be solved first on apps.linera.net');
      }
      
      // Close dialog
      console.log('[Quests] Closing dialog...');
      await sleep(500);
      
      const closeButtons = document.querySelectorAll('button');
      let closed = false;
      
      for (const btn of closeButtons) {
        const text = btn.textContent.toLowerCase().trim();
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        
        if (text === 'close' || ariaLabel.includes('close') || btn.querySelector('svg[class*="close"]')) {
          console.log('[Quests] Found close button, clicking...');
          btn.click();
          closed = true;
          await sleep(500);
          break;
        }
      }
      
      if (!closed) {
        console.log('[Quests] No close button found, pressing Escape...');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await sleep(500);
      }
      
      await sleep(DELAY_BETWEEN_QUESTS);
    }
    
    console.log('[Quests] ===== FINISHED =====');
    console.log('[Quests] Claimed:', claimedCount);
    console.log('[Quests] Skipped:', skippedCount);
    console.log('[Quests] Total processed:', claimedCount + skippedCount);
    
    if (claimedCount === 0 && skippedCount === questButtons.length) {
      console.log('[Quests] All quests already completed!');
    }
    
  } catch (error) {
    console.error('[Quests] Error:', error);
    // If error is "no quests found" but page is loaded, maybe all completed
    if (error.message.includes('No Game of Life quests found')) {
      throw new Error('No Game of Life quests found - they may all be completed already');
    }
    throw error;
    throw error;
  }
}

// Answer Learn Questions on portal.linera.net/learn
async function answerLearnQuestions() {
  console.log('[Learn] Starting Learn questions automation...');
  
  try {
    // Load answers
    await loadLearnAnswers();
    
    // Check if we're on the portal
    if (!window.location.href.includes('portal.linera.net')) {
      throw new Error('Not on portal.linera.net - please navigate to /learn first');
    }
    
    // Navigate to learn page if not already there
    if (!window.location.pathname.includes('/learn')) {
      console.log('[Learn] Navigating to /learn...');
      window.location.href = '/learn';
      await sleep(3000);
    }
    
    // Wait for page to load
    await sleep(2000);
    
    // Find all question buttons
    console.log('[Learn] Looking for questions...');
    const allButtons = document.querySelectorAll('button');
    const questionButtons = [];
    
    for (const button of allButtons) {
      const heading = button.querySelector('h2, h3');
      if (heading && heading.textContent.match(/^Question \d+$/)) {
        questionButtons.push(button);
      }
    }
    
    console.log('[Learn] Found', questionButtons.length, 'questions');
    
    if (questionButtons.length === 0) {
      console.log('[Learn] No questions found');
      return;
    }
    
    let answeredCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < questionButtons.length; i++) {
      if (!isRunning) {
        console.log('[Learn] Stopped by user');
        break;
      }
      
      const button = questionButtons[i];
      const questionNum = `Question ${i + 1}`;
      console.log('[Learn] ========================================');
      console.log('[Learn] Processing:', questionNum);
      
      // Check if already answered (has checkmark)
      const hasCheckmark = button.querySelector('svg.lucide-circle-check-big') ||
                           button.querySelector('svg.lucide-circle-check') ||
                           button.querySelector('.lucide-circle-check') ||
                           button.querySelector('.text-green-600') ||
                           button.querySelector('svg[class*="circle-check"]');
      
      if (hasCheckmark) {
        console.log('[Learn] ✓ Already answered, skipping');
        skippedCount++;
        continue;
      }
      
      // Click the question button
      console.log('[Learn] Clicking question button...');
      button.click();
      await sleep(1500);
      
      // Get the correct answer from our database
      const answerData = learnAnswers[questionNum];
      if (!answerData) {
        console.log('[Learn] No answer found for', questionNum);
        // Close dialog and continue
        const closeBtn = document.querySelector('button[aria-label="Close"], button:has(svg)');
        if (closeBtn) closeBtn.click();
        await sleep(500);
        continue;
      }
      
      console.log('[Learn]', questionNum);
      console.log('[Learn] Correct answer:', answerData.answer);
      
      // Helper function to check if text matches answer (flexible matching)
      function isAnswerMatch(text, answer) {
        text = text.toLowerCase().trim();
        answer = answer.toLowerCase().trim();
        if (text.includes(answer)) return true;
        const answerWords = answer.split(/\s+/).filter(w => w.length > 3);
        if (answerWords.length > 0) {
          const matchCount = answerWords.filter(word => text.includes(word)).length;
          if (matchCount / answerWords.length >= 0.7) return true;
        }
        return false;
      }
      
      let foundAnswer = false;
      
      // PRIMARY METHOD: Try input[type="radio"] first
      const inputRadios = document.querySelectorAll('input[type="radio"]');
      
      for (const inputRadio of inputRadios) {
        if (!isRunning) break;
        
        let labelText = '';
        if (inputRadio.id) {
          const labelEl = document.querySelector(`label[for="${inputRadio.id}"]`);
          if (labelEl) labelText = labelEl.textContent.trim();
        }
        if (!labelText && inputRadio.parentElement) {
          labelText = inputRadio.parentElement.textContent.trim();
        }
        
        console.log('[Learn] Checking:', labelText.substring(0, 60));
        
        if (isAnswerMatch(labelText, answerData.answer)) {
          console.log('[Learn] ✓ Found! Clicking...');
          inputRadio.click();
          await sleep(300);
          foundAnswer = true;
          break;
        }
      }
      
      // FALLBACK: Try [role="radio"]
      if (!foundAnswer) {
        const radios = document.querySelectorAll('[role="radio"]');
        for (const radio of radios) {
          if (!isRunning) break;
          const label = radio.parentElement?.textContent?.trim() || '';
          if (isAnswerMatch(label, answerData.answer)) {
            console.log('[Learn] ✓ Found via role! Clicking...');
            radio.click();
            await sleep(300);
            foundAnswer = true;
            break;
          }
        }
      }
      
      if (!foundAnswer) {
        console.log('[Learn] ❌ Failed to find answer');
      } else {
        console.log('[Learn] ✓ Answer selected');
      }
      
      await sleep(500);
      
      // Submit
      if (foundAnswer) {
        const submitButtons = document.querySelectorAll('button');
        for (const btn of submitButtons) {
          if (btn.textContent.toLowerCase().includes('submit')) {
            console.log('[Learn] Submitting...');
            btn.click();
            await sleep(2000);
            answeredCount++;
            break;
          }
        }
      }
      
      // Close dialog
      await sleep(1000);
      const closeButtons = document.querySelectorAll('button');
      for (const btn of closeButtons) {
        const text = btn.textContent.toLowerCase().trim();
        if (text === 'close' || text === 'ok' || text.includes('continue')) {
          btn.click();
          await sleep(500);
          break;
        }
      }
      
      await sleep(DELAY_BETWEEN_QUESTS);
    }
    
    console.log('[Learn] ========================================');
    console.log('[Learn] Finished! Answered:', answeredCount, 'Skipped:', skippedCount);
    console.log('[Learn] ========================================');
    
  } catch (error) {
    console.error('[Learn] Error:', error);
    throw error;
  }
}

// Log when loaded
console.log('[Solver] Loaded and ready');
