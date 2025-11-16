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

    throw new Error('Failed to load solutions file');
  }
}

// Initialize solver based on current page state
async function initializeFromCurrentState() {

  
  // Check if user is not logged in
  if (isWaitingForLogin()) {

    
    // Click the Log In button
    if (!clickLoginButton()) {

    }
    

    await waitForLogin();

    await sleep(2000); // Wait for page to fully load after login
  }
  
  // Check if we're on a puzzle page
  const puzzleId = getPuzzleId();
  
  if (puzzleId) {

    currentPuzzleId = puzzleId;
    
    // If puzzle is already completed, navigate away
    if (await isPuzzleCompleted()) {

      await navigateToPuzzleList();
      await sleep(2000);
    }
  } else {

  }
}

// Click the Log In button
function clickLoginButton() {
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase().trim();
    if (text.includes('log in') || text === 'login') {

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

  
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase().trim();
    if (text === 'back to puzzles') {

      button.click();
      await sleep(1500);
      return true;
    }
  }
  
  // If no button found, try navigating to main page

  window.location.href = '/gol/index.html';
  await sleep(2000);
  return true;
}

// Start the auto-solver
async function startSolver() {
  if (isRunning) {

    return;
  }
  

  isRunning = true;
  
  try {
    await loadSolutions();
    
    // Initialize based on current page state
    await initializeFromCurrentState();
    
    await solverLoop();
  } catch (error) {

    isRunning = false;
    throw error;
  }
}

// Stop the solver
function stopSolver() {

  isRunning = false;
}

// Main solver loop
async function solverLoop() {
  while (isRunning) {
    try {
      // Get current puzzle ID
      const puzzleId = getPuzzleId();
      if (!puzzleId) {

        
        // If we're on the puzzle list, select the first unsolved puzzle
        const bodyText = document.body.innerText;
        if (bodyText.includes('Choose Your Challenge')) {

          const moved = await selectNextUnsolvedPuzzle();
          if (!moved) {

            stopSolver();
            break;
          }
          await sleep(2000);
          continue;
        }
        

        await sleep(1000);
        continue;
      }
      
      // Check if we're stuck on the same puzzle
      if (currentPuzzleId === puzzleId && solvedPuzzles.has(puzzleId)) {

        const moved = await goToNextPuzzle();
        if (!moved) {

          stopSolver();
          break;
        }
        await sleep(2000);
        continue;
      }
      
      currentPuzzleId = puzzleId;

      
      // Check if already completed
      if (await isPuzzleCompleted()) {

        solvedPuzzles.add(puzzleId);
        const moved = await goToNextPuzzle();
        if (!moved) {

          stopSolver();
          break;
        }
        await sleep(2000);
        continue;
      }
      
      // Check if we have a solution
      const solution = solutions[puzzleId];
      if (!solution) {

        const moved = await goToNextPuzzle();
        if (!moved) {

          stopSolver();
          break;
        }
        await sleep(2000);
        continue;
      }
      
      // Solve the puzzle

      await solvePuzzle(solution);
      
      // Submit solution
      await submitSolution();
      
      // Wait for success message
      const success = await waitForSubmissionResult();
      
      if (success) {

        solvedPuzzles.add(puzzleId);
        
        // Wait for next button to appear
        await sleep(1000);
        
        // Try to move to next puzzle
        const moved = await goToNextPuzzle();
        if (!moved) {

          stopSolver();
          break;
        }
        
        // Wait for new puzzle to load
        await sleep(2000);
      } else {

        const moved = await goToNextPuzzle();
        if (!moved) {

          stopSolver();
          break;
        }
        await sleep(2000);
      }
      
    } catch (error) {

      await sleep(2000);
    }
  }
  

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
  

}

// Submit solution
async function submitSolution() {
  // Look for Submit or Resubmit button
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('submit solution') || text.includes('resubmit solution')) {

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

  
  // Look for "Next puzzle" button (the most reliable way)
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const text = button.textContent.toLowerCase().trim();
    if (text === 'next puzzle') {

      button.click();
      await sleep(2000);
      
      // Verify we moved to a different puzzle
      const newPuzzleId = getPuzzleId();
      if (newPuzzleId && newPuzzleId !== currentPuzzleId) {

        return true;
      }

    }
  }
  
  // If no "Next puzzle" button found, go back to puzzle list and select next unsolved puzzle

  
  if (!await navigateToPuzzleList()) {
    return false;
  }
  
  // Now we should be on the puzzle list page, find next unsolved puzzle
  return await selectNextUnsolvedPuzzle();
}

// Select next unsolved puzzle from the list
async function selectNextUnsolvedPuzzle() {

  
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

      button.click();
      await sleep(2000);
      
      // Verify we moved to a different puzzle
      const newPuzzleId = getPuzzleId();
      if (newPuzzleId && newPuzzleId !== currentPuzzleId) {

        return true;
      }
    }
  }
  

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

    throw new Error('Failed to load learn answers file');
  }
}

// Claim Game of Life Quests on portal.linera.net/quests
async function claimGameOfLifeQuests() {

  
  try {
    // Check if we're on the quests page
    if (!window.location.href.includes('portal.linera.net')) {
      throw new Error('Not on portal.linera.net - please navigate to /quests first');
    }
    
    // Navigate to quests page if not already there
    if (!window.location.pathname.includes('/quests')) {

      window.location.href = '/quests';
      await sleep(3000);
    }
    
    // Wait for page to load

    await sleep(3000);
    
    // Find all clickable quest cards by looking for h4 and finding their clickable parent

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

            break;
          }
        }
        
        if (clickableCard) {
          questButtons.push({ button: clickableCard, name: headingText });
        } else {

        }
      }
    }
    

    
    if (questButtons.length === 0) {
      throw new Error('No Game of Life quests found - they may already be completed or page not loaded');
    }
    
    let claimedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < questButtons.length; i++) {
      if (!isRunning) {

        break;
      }
      
      const { button, name } = questButtons[i];

      
      // Check if quest already completed (has "Completed" text)
      const buttonText = button.textContent || '';
      if (buttonText.includes('Completed')) {
        console.log('[Quests] Already completed (has Completed text), skipping');
        skippedCount++;
        continue;
      }
      
      // Click the card to open quest dialog


      button.click();
      await sleep(2000);
      
      // Look for "Check Puzzle" button in the dialog

      await sleep(500);
      
      const dialogButtons = document.querySelectorAll('button');

      let checkPuzzleBtn = null;
      
      for (const btn of dialogButtons) {
        const btnText = btn.textContent.toLowerCase();
        if (btnText.includes('check puzzle')) {
          checkPuzzleBtn = btn;

          break;
        }
      }
      
      if (checkPuzzleBtn) {

        checkPuzzleBtn.click();
        await sleep(2500);
        
        // Check for success/error messages
        const bodyText = document.body.innerText;
        if (bodyText.includes('successfully') || bodyText.includes('claimed')) {

          claimedCount++;
        } else if (bodyText.includes('already completed') || bodyText.includes('already claimed')) {

          skippedCount++;
        } else {

          claimedCount++;
        }
      } else {

        console.log('[Quests] Available buttons:', Array.from(dialogButtons).map(b => b.textContent.substring(0, 30)));

      }
      
      // Close dialog

      await sleep(500);
      
      const closeButtons = document.querySelectorAll('button');
      let closed = false;
      
      for (const btn of closeButtons) {
        const text = btn.textContent.toLowerCase().trim();
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        
        if (text === 'close' || ariaLabel.includes('close') || btn.querySelector('svg[class*="close"]')) {

          btn.click();
          closed = true;
          await sleep(500);
          break;
        }
      }
      
      if (!closed) {

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await sleep(500);
      }
      
      await sleep(DELAY_BETWEEN_QUESTS);
    }
    




    
    if (claimedCount === 0 && skippedCount === questButtons.length) {

    }
    
  } catch (error) {

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

  
  try {
    // Load answers
    await loadLearnAnswers();
    
    // Check if we're on the portal
    if (!window.location.href.includes('portal.linera.net')) {
      throw new Error('Not on portal.linera.net - please navigate to /learn first');
    }
    
    // Navigate to learn page if not already there
    if (!window.location.pathname.includes('/learn')) {

      window.location.href = '/learn';
      await sleep(3000);
    }
    
    // Wait for page to load
    await sleep(2000);
    
    // Find all question buttons

    const allButtons = document.querySelectorAll('button');
    const questionButtons = [];
    
    for (const button of allButtons) {
      const heading = button.querySelector('h2, h3');
      if (heading && heading.textContent.match(/^Question \d+$/)) {
        questionButtons.push(button);
      }
    }
    

    
    if (questionButtons.length === 0) {

      return;
    }
    
    let answeredCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < questionButtons.length; i++) {
      if (!isRunning) {

        break;
      }
      
      const button = questionButtons[i];
      const questionNum = `Question ${i + 1}`;


      
      // Check if already answered (has checkmark)
      const hasCheckmark = button.querySelector('svg.lucide-circle-check-big') ||
                           button.querySelector('svg.lucide-circle-check') ||
                           button.querySelector('.lucide-circle-check') ||
                           button.querySelector('.text-green-600') ||
                           button.querySelector('svg[class*="circle-check"]');
      
      if (hasCheckmark) {

        skippedCount++;
        continue;
      }
      
      // Click the question button

      button.click();
      await sleep(1500);
      
      // Get the correct answer from our database
      const answerData = learnAnswers[questionNum];
      if (!answerData) {

        // Close dialog and continue
        const closeBtn = document.querySelector('button[aria-label="Close"], button:has(svg)');
        if (closeBtn) closeBtn.click();
        await sleep(500);
        continue;
      }
      


      
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

            radio.click();
            await sleep(300);
            foundAnswer = true;
            break;
          }
        }
      }
      
      if (!foundAnswer) {

      } else {

      }
      
      await sleep(500);
      
      // Submit
      if (foundAnswer) {
        const submitButtons = document.querySelectorAll('button');
        for (const btn of submitButtons) {
          if (btn.textContent.toLowerCase().includes('submit')) {

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
    



    
  } catch (error) {

    throw error;
  }
}

// Log when loaded

