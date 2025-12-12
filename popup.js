// DOM elements
const currentPuzzleEl = document.getElementById('current-puzzle');
const solvePuzzleBtn = document.getElementById('solve-puzzle-btn');
const claimGolQuestsBtn = document.getElementById('claim-gol-quests-btn');
const answerLearnBtn = document.getElementById('answer-learn-btn');

// State tracking
let isClaimQuestsRunning = false;
let isAnswerLearnRunning = false;

// Update puzzle info
async function updatePuzzleInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const isGoLPage = tab.url.includes('apps.linera.net/gol');
  
  if (!isGoLPage) {
    currentPuzzleEl.textContent = 'Not on GoL page';
    currentPuzzleEl.style.color = '#888';
    solvePuzzleBtn.disabled = true;
    solvePuzzleBtn.textContent = 'Solve This Puzzle';
    solvePuzzleBtn.className = 'btn btn-primary';
    return;
  }
  
  try {
    const info = await chrome.tabs.sendMessage(tab.id, { action: 'GET_PUZZLE_INFO' });
    
    if (!info.puzzleId) {
      currentPuzzleEl.textContent = 'No puzzle detected';
      currentPuzzleEl.style.color = '#888';
      solvePuzzleBtn.disabled = true;
      solvePuzzleBtn.textContent = 'Solve This Puzzle';
      solvePuzzleBtn.className = 'btn btn-primary';
    } else if (info.isCompleted) {
      currentPuzzleEl.textContent = info.puzzleId + ' ✓';
      currentPuzzleEl.style.color = '#4CAF50';
      solvePuzzleBtn.disabled = true;
      solvePuzzleBtn.textContent = 'Already Completed';
      solvePuzzleBtn.className = 'btn btn-primary';
    } else if (!info.hasSolution) {
      currentPuzzleEl.textContent = info.puzzleId + ' (no solution)';
      currentPuzzleEl.style.color = '#ff9800';
      solvePuzzleBtn.disabled = true;
      solvePuzzleBtn.textContent = 'No Solution Available';
      solvePuzzleBtn.className = 'btn btn-primary';
    } else {
      currentPuzzleEl.textContent = info.puzzleId;
      currentPuzzleEl.style.color = '#fff';
      solvePuzzleBtn.disabled = false;
      solvePuzzleBtn.textContent = 'Solve This Puzzle';
      solvePuzzleBtn.className = 'btn btn-primary';
    }
    
  } catch (error) {
    currentPuzzleEl.textContent = 'Error loading info';
    currentPuzzleEl.style.color = '#f44336';
    solvePuzzleBtn.disabled = true;
  }
}

// Update quest buttons status
async function updateQuestButtons() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab.url.includes('portal.linera.net')) {
    // Enable Claim GoL Quests only on /quests page
    claimGolQuestsBtn.disabled = !tab.url.includes('/quests');
    if (tab.url.includes('/quests') && isClaimQuestsRunning) {
      claimGolQuestsBtn.textContent = 'Stop Claiming';
      claimGolQuestsBtn.className = 'btn btn-stop';
    } else {
      claimGolQuestsBtn.textContent = 'Claim GoL Quests';
      claimGolQuestsBtn.className = 'btn btn-primary';
    }
    
    // Enable Answer Learn only on /learn page
    answerLearnBtn.disabled = !tab.url.includes('/learn');
    if (tab.url.includes('/learn') && isAnswerLearnRunning) {
      answerLearnBtn.textContent = 'Stop Answering';
      answerLearnBtn.className = 'btn btn-stop';
    } else {
      answerLearnBtn.textContent = 'Answer Learn Questions';
      answerLearnBtn.className = 'btn btn-primary';
    }
  } else {
    claimGolQuestsBtn.disabled = true;
    answerLearnBtn.disabled = true;
  }
}

// Solve current puzzle
solvePuzzleBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('apps.linera.net/gol')) {
    alert('Please navigate to a Game of Life puzzle first');
    return;
  }
  
  solvePuzzleBtn.disabled = true;
  solvePuzzleBtn.textContent = 'Solving...';
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'SOLVE_CURRENT_PUZZLE' 
    });
    
    if (!response.success) {
      alert('❌ Error: ' + response.error);
    }
    
  } catch (error) {
    alert('❌ Error: ' + error.message);
  } finally {
    await updatePuzzleInfo();
  }
});

// Claim GoL Quests
claimGolQuestsBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('portal.linera.net/quests')) {
    alert('Please navigate to portal.linera.net/quests first');
    return;
  }
  
  if (isClaimQuestsRunning) {
    // Stop claiming quests
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'STOP_SOLVER' });
      isClaimQuestsRunning = false;
      claimGolQuestsBtn.textContent = 'Claim GoL Quests';
      claimGolQuestsBtn.className = 'btn btn-primary';
    } catch (error) {
      alert('Error stopping: ' + error.message);
    }
  } else {
    // Start claiming quests
    isClaimQuestsRunning = true;
    claimGolQuestsBtn.textContent = 'Claiming...';
    claimGolQuestsBtn.className = 'btn btn-stop';
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'CLAIM_GOL_QUESTS' });
      
      if (!response.success) {
        alert('❌ Error: ' + response.error);
      } else {
        alert('✅ Successfully claimed Game of Life quests!');
      }
      
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      isClaimQuestsRunning = false;
      claimGolQuestsBtn.textContent = 'Claim GoL Quests';
      claimGolQuestsBtn.className = 'btn btn-primary';
    }
  }
});

// Answer Learn Questions
answerLearnBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('portal.linera.net/learn')) {
    alert('Please navigate to portal.linera.net/learn first');
    return;
  }
  
  if (isAnswerLearnRunning) {
    // Stop answering questions
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'STOP_SOLVER' });
      isAnswerLearnRunning = false;
      answerLearnBtn.textContent = 'Answer Learn Questions';
      answerLearnBtn.className = 'btn btn-primary';
    } catch (error) {
      alert('Error stopping: ' + error.message);
    }
  } else {
    // Start answering questions
    isAnswerLearnRunning = true;
    answerLearnBtn.textContent = 'Answering...';
    answerLearnBtn.className = 'btn btn-stop';
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ANSWER_LEARN_QUESTIONS' });
      
      if (!response.success) {
        alert('❌ Error: ' + response.error);
      } else {
        alert('✅ Successfully answered Learn questions!');
      }
      
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      isAnswerLearnRunning = false;
      answerLearnBtn.textContent = 'Answer Learn Questions';
      answerLearnBtn.className = 'btn btn-primary';
    }
  }
});

// Update on popup open
updatePuzzleInfo();
updateQuestButtons();

// Update every 2 seconds
setInterval(() => {
  updatePuzzleInfo();
  updateQuestButtons();
}, 2000);
