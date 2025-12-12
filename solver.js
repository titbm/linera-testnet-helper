// Simplified solver for Linera Game of Life puzzles
// This script solves only the current puzzle on button click

// Configuration
const SOLUTIONS_URL = chrome.runtime.getURL('gol-solutions.json');
const LEARN_ANSWERS_URL = chrome.runtime.getURL('learn-answers.json');
const DELAY_BETWEEN_CLICKS = 100; // ms between cell clicks
const DELAY_BETWEEN_QUESTS = 1500; // ms to wait between processing quests

// State
let isRunning = false;
let solutions = null;
let learnAnswers = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SOLVE_CURRENT_PUZZLE') {
    solveCurrentPuzzle()
      .then((result) => sendResponse({ success: true, ...result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.action === 'GET_PUZZLE_INFO') {
    getPuzzleInfo()
      .then((info) => sendResponse(info))
      .catch(error => sendResponse({ puzzleId: null, error: error.message }));
    return true;
  } else if (message.action === 'CLAIM_GOL_QUESTS') {
    isRunning = true;
    claimGameOfLifeQuests()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }))
      .finally(() => { isRunning = false; });
    return true;
  } else if (message.action === 'ANSWER_LEARN_QUESTIONS') {
    isRunning = true;
    answerLearnQuestions()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }))
      .finally(() => { isRunning = false; });
    return true;
  } else if (message.action === 'STOP_SOLVER') {
    isRunning = false;
    sendResponse({ success: true });
    return true;
  }
});

// Load solutions from JSON
async function loadSolutions() {
  if (solutions) return solutions;
  
  try {
    const response = await fetch(SOLUTIONS_URL);
    solutions = await response.json();
    console.log('[Solver] Loaded solutions:', Object.keys(solutions).length, 'puzzles');
    return solutions;
  } catch (error) {
    console.error('[Solver] Failed to load solutions:', error);
    throw new Error('Failed to load solutions file');
  }
}

// Get puzzle ID from page
function getPuzzleId() {
  const headings = document.querySelectorAll('h1, h2');
  
  for (const heading of headings) {
    const text = heading.textContent.trim();
    
    // Skip common non-puzzle headings
    if (text === 'Conway\'s Game of Life' || 
        text === 'Game of Life' || 
        text === 'Puzzles' ||
        text === 'Game of Life Playground' ||
        text === 'Choose Your Challenge' ||
        !text) {
      continue;
    }
    
    // Convert to ID format
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  
  return null;
}

// Check if puzzle is already completed
function isPuzzleCompleted() {
  const messages = document.body.innerText;
  return messages.includes('Puzzle already completed!');
}

// Get current puzzle info
async function getPuzzleInfo() {
  await loadSolutions();
  
  const puzzleId = getPuzzleId();
  const isCompleted = isPuzzleCompleted();
  const hasSolution = puzzleId && solutions && solutions[puzzleId] ? true : false;
  
  return {
    puzzleId: puzzleId || null,
    isCompleted: isCompleted,
    hasSolution: hasSolution
  };
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
    
    // Game of Life grids are at least 4x4
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
  
  console.log('[Solver] Found puzzle grid');
  
  // Get all clickable cells
  const cells = grid.querySelectorAll('div[tabindex="0"]');
  console.log('[Solver] Found', cells.length, 'clickable cells');
  
  // Click each cell in the solution
  for (const cellCoord of solution.cells) {
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
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('submit solution') || text.includes('resubmit solution')) {
      console.log('[Solver] Clicking submit button');
      button.click();
      await sleep(500);
      return;
    }
  }
  
  throw new Error('Submit button not found');
}



// Solve current puzzle
async function solveCurrentPuzzle() {
  try {
    await loadSolutions();
    
    // Get current puzzle ID
    const puzzleId = getPuzzleId();
    if (!puzzleId) {
      throw new Error('Not on a puzzle page');
    }
    
    console.log('[Solver] Current puzzle:', puzzleId);
    
    // Find solution
    const solution = solutions[puzzleId];
    if (!solution) {
      throw new Error('No solution found for: ' + puzzleId);
    }
    
    console.log('[Solver] Found solution with', solution.cells.length, 'cells');
    
    // Check if already completed - just fill cells, don't submit
    const isCompleted = isPuzzleCompleted();
    
    // Solve the puzzle (fill cells)
    console.log('[Solver] Filling puzzle cells...');
    await solvePuzzle(solution);
    
    // Submit solution only if not already completed
    if (!isCompleted) {
      console.log('[Solver] Submitting solution...');
      await submitSolution();
      console.log('[Solver] ✅ Solution submitted!');
    } else {
      console.log('[Solver] ✅ Cells filled (puzzle already completed)');
    }
    
    return { success: true, message: 'Puzzle solved successfully!' };
    
  } catch (error) {
    console.error('[Solver] Error:', error);
    throw error;
  }
}

// Utility: sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== QUEST AUTOMATION FUNCTIONS ====================

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
  console.log('[Quests] Starting quest claiming...');
  
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
    
    // Find all clickable quest cards
    console.log('[Quests] Finding Game of Life quests...');
    const allH4 = document.querySelectorAll('h4');
    const questButtons = [];
    
    for (const h4 of allH4) {
      const headingText = h4.textContent.trim();
      const isGolQuest = headingText.startsWith('Complete the') && 
                        (headingText.includes('Puzzle') || 
                         headingText.includes('Reflector') || 
                         headingText.includes('Density'));
      
      if (isGolQuest) {
        console.log('[Quests] Found quest:', headingText);
        
        // Find the clickable parent
        let container = h4;
        let clickableCard = null;
        
        for (let i = 0; i < 20 && container; i++) {
          container = container.parentElement;
          if (!container) break;
          
          const hasH4 = container.contains(h4);
          const hasStartQuest = container.textContent.includes('Start Quest');
          
          if (hasH4 && hasStartQuest) {
            clickableCard = container;
            console.log('[Quests] Found clickable card for:', headingText);
            break;
          }
        }
        
        if (clickableCard) {
          questButtons.push({ button: clickableCard, name: headingText });
        } else {
          console.warn('[Quests] Could not find clickable card for:', headingText);
        }
      }
    }
    
    console.log('[Quests] Found', questButtons.length, 'Game of Life quests');
    
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
      console.log(`[Quests] Processing quest ${i + 1}/${questButtons.length}:`, name);
      
      // Check if already completed
      const buttonText = button.textContent || '';
      if (buttonText.includes('Completed')) {
        console.log('[Quests] Already completed, skipping');
        skippedCount++;
        continue;
      }
      
      // Click the card
      console.log('[Quests] Clicking quest card...');
      button.click();
      await sleep(2000);
      
      // Look for "Check Puzzle" button
      console.log('[Quests] Looking for Check Puzzle button...');
      await sleep(500);
      
      const dialogButtons = document.querySelectorAll('button');
      console.log('[Quests] Found', dialogButtons.length, 'buttons in dialog');
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
        console.log('[Quests] Clicking Check Puzzle...');
        checkPuzzleBtn.click();
        await sleep(2500);
        
        // Check for success/error messages
        const bodyText = document.body.innerText;
        if (bodyText.includes('successfully') || bodyText.includes('claimed')) {
          console.log('[Quests] ✅ Quest claimed successfully');
          claimedCount++;
        } else if (bodyText.includes('already completed') || bodyText.includes('already claimed')) {
          console.log('[Quests] Already claimed');
          skippedCount++;
        } else {
          console.log('[Quests] Assuming success (no clear message)');
          claimedCount++;
        }
      } else {
        console.warn('[Quests] Check Puzzle button not found');
        console.log('[Quests] Available buttons:', Array.from(dialogButtons).map(b => b.textContent.substring(0, 30)));
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
          console.log('[Quests] Found close button');
          btn.click();
          closed = true;
          await sleep(500);
          break;
        }
      }
      
      if (!closed) {
        console.log('[Quests] No close button found, trying Escape key');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await sleep(500);
      }
      
      await sleep(DELAY_BETWEEN_QUESTS);
    }
    
    console.log('[Quests] ✅ Finished!');
    console.log('[Quests] Claimed:', claimedCount);
    console.log('[Quests] Skipped:', skippedCount);
    console.log('[Quests] Total processed:', claimedCount + skippedCount);
    
    if (claimedCount === 0 && skippedCount === questButtons.length) {
      console.log('[Quests] All quests were already completed');
    }
    
  } catch (error) {
    console.error('[Quests] Error:', error);
    throw error;
  }
}

// Answer Learn Questions on portal.linera.net/learn
async function answerLearnQuestions() {
  console.log('[Learn] Starting question answering...');
  
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
    console.log('[Learn] Finding question buttons...');
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
      console.log(`[Learn] Processing ${questionNum}...`);
      
      // Check if already answered
      const hasCheckmark = button.querySelector('svg.lucide-circle-check-big') ||
                           button.querySelector('svg.lucide-circle-check') ||
                           button.querySelector('.lucide-circle-check') ||
                           button.querySelector('.text-green-600') ||
                           button.querySelector('svg[class*="circle-check"]');
      
      if (hasCheckmark) {
        console.log('[Learn] Already answered, skipping');
        skippedCount++;
        continue;
      }
      
      // Click the question button
      console.log('[Learn] Opening question dialog...');
      button.click();
      await sleep(1500);
      
      // Get the correct answer
      const answerData = learnAnswers[questionNum];
      if (!answerData) {
        console.warn('[Learn] No answer found for', questionNum);
        const closeBtn = document.querySelector('button[aria-label="Close"], button:has(svg)');
        if (closeBtn) closeBtn.click();
        await sleep(500);
        continue;
      }
      
      console.log('[Learn] Looking for answer:', answerData.answer.substring(0, 50) + '...');
      
      // Helper function to check if text matches answer
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
      
      // Try input[type="radio"] first
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
          console.log('[Learn] ✅ Found matching answer!');
          inputRadio.click();
          await sleep(300);
          foundAnswer = true;
          break;
        }
      }
      
      // Fallback: Try [role="radio"]
      if (!foundAnswer) {
        const radios = document.querySelectorAll('[role="radio"]');
        for (const radio of radios) {
          if (!isRunning) break;
          const label = radio.parentElement?.textContent?.trim() || '';
          if (isAnswerMatch(label, answerData.answer)) {
            console.log('[Learn] ✅ Found matching answer (role=radio)!');
            radio.click();
            await sleep(300);
            foundAnswer = true;
            break;
          }
        }
      }
      
      if (!foundAnswer) {
        console.warn('[Learn] ❌ Could not find matching answer');
      } else {
        console.log('[Learn] Selected answer, submitting...');
      }
      
      await sleep(500);
      
      // Submit
      if (foundAnswer) {
        const submitButtons = document.querySelectorAll('button');
        for (const btn of submitButtons) {
          if (btn.textContent.toLowerCase().includes('submit')) {
            console.log('[Learn] Clicking submit...');
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
    
    console.log('[Learn] ✅ Finished!');
    console.log('[Learn] Answered:', answeredCount);
    console.log('[Learn] Skipped:', skippedCount);
    console.log('[Learn] Total processed:', answeredCount + skippedCount);
    
  } catch (error) {
    console.error('[Learn] Error:', error);
    throw error;
  }
}

// ==================== INJECT SOLVE BUTTON ON PAGE ====================

// Remove button if it exists
function removeSolveButton() {
  const button = document.getElementById('linera-solve-btn');
  if (button) {
    console.log('[Solver] Removing button');
    button.remove();
  }
}

// Create and inject solve button on puzzle pages
function injectSolveButton() {
  console.log('[Solver] Attempting to inject button...');
  console.log('[Solver] Current URL:', window.location.href);
  
  // Check if we're on apps.linera.net/gol
  if (!window.location.href.includes('apps.linera.net/gol')) {
    console.log('[Solver] Not on GoL page, removing button if exists');
    removeSolveButton();
    return;
  }
  
  // Check if we're on a puzzle page
  const puzzleId = getPuzzleId();
  console.log('[Solver] Puzzle ID:', puzzleId);
  
  if (!puzzleId) {
    console.log('[Solver] No puzzle detected, removing button if exists');
    removeSolveButton();
    return;
  }
  
  // Check if button already exists
  if (document.getElementById('linera-solve-btn')) {
    console.log('[Solver] Button already exists');
    return;
  }
  
  // Create button
  const button = document.createElement('button');
  button.id = 'linera-solve-btn';
  button.textContent = 'SOLVE';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 24px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Hover effect
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-1px)';
    button.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  });
  
  // Click handler
  button.addEventListener('click', async () => {
    // Disable button
    button.disabled = true;
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';
    const originalText = button.textContent;
    button.textContent = 'SOLVING...';
    
    try {
      await solveCurrentPuzzle();
      
      // Re-enable immediately
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.textContent = originalText;
      
    } catch (error) {
      console.error('[Solver] Error:', error);
      
      // Show error message
      alert('Error: ' + error.message);
      
      // Re-enable immediately
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.textContent = originalText;
    }
  });
  
  // Add to page
  document.body.appendChild(button);
  console.log('[Solver] Injected SOLVE button');
}

// Inject button when page loads and periodically check
function startButtonInjection() {
  console.log('[Solver] Starting button injection system');
  
  // Try immediately
  setTimeout(injectSolveButton, 500);
  
  // Try after 1 second
  setTimeout(injectSolveButton, 1000);
  
  // Try after 2 seconds
  setTimeout(injectSolveButton, 2000);
  
  // Check every 1 second - inject or remove button based on page state
  setInterval(() => {
    injectSolveButton();
  }, 1000);
}

// Start injection system
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startButtonInjection);
} else {
  startButtonInjection();
}

// Log when loaded
console.log('[Solver] Content script loaded');
