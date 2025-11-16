// DOM elements
const solverStatusEl = document.getElementById('solver-status');
const solvedCountEl = document.getElementById('solved-count');
const currentPuzzleEl = document.getElementById('current-puzzle');
const startSolverBtn = document.getElementById('start-solver-btn');
const claimGolQuestsBtn = document.getElementById('claim-gol-quests-btn');
const answerLearnBtn = document.getElementById('answer-learn-btn');

// State tracking
let isSolverRunning = false;
let isClaimQuestsRunning = false;
let isAnswerLearnRunning = false;

// Update solver status
async function updateSolverStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const isLinera = tab.url.includes('apps.linera.net') || tab.url.includes('portal.linera.net');
  
  if (!isLinera) {
    solverStatusEl.textContent = 'N/A';
    solverStatusEl.style.color = '#888';
    currentPuzzleEl.textContent = 'Not on Linera site';
    startSolverBtn.disabled = true;
    claimGolQuestsBtn.disabled = true;
    answerLearnBtn.disabled = true;
    return;
  }
  
  // Check running state from content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SOLVER_STATUS' });
    
    // Update local state from content script
    isSolverRunning = response.isRunning;
    isClaimQuestsRunning = response.isRunning && tab.url.includes('/quests');
    isAnswerLearnRunning = response.isRunning && tab.url.includes('/learn');
  } catch (error) {
    // Content script not loaded or error
    isSolverRunning = false;
    isClaimQuestsRunning = false;
    isAnswerLearnRunning = false;
  }
  
  // Enable quest buttons on specific portal pages
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
  
  // Enable solver buttons on apps.linera.net
  if (tab.url.includes('apps.linera.net')) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SOLVER_STATUS' });
      
      isSolverRunning = response.isRunning;
      
      if (response.isRunning) {
        solverStatusEl.textContent = 'Running';
        solverStatusEl.style.color = '#4CAF50';
        startSolverBtn.textContent = 'Stop Solver';
        startSolverBtn.className = 'btn btn-stop';
        startSolverBtn.disabled = false;
      } else {
        solverStatusEl.textContent = 'Stopped';
        solverStatusEl.style.color = '#888';
        startSolverBtn.textContent = 'Start Solver';
        startSolverBtn.className = 'btn btn-primary';
        startSolverBtn.disabled = false;
      }
      
      solvedCountEl.textContent = response.solvedCount || 0;
      currentPuzzleEl.textContent = response.currentPuzzle || '-';
      
    } catch (error) {
      // Solver not loaded yet or error
      solverStatusEl.textContent = 'Ready';
      solverStatusEl.style.color = '#888';
      startSolverBtn.textContent = 'Start Solver';
      startSolverBtn.className = 'btn btn-primary';
      startSolverBtn.disabled = false;
      solvedCountEl.textContent = '0';
      currentPuzzleEl.textContent = '-';
      isSolverRunning = false;
    }
  } else {
    // On portal, disable solver buttons
    startSolverBtn.disabled = true;
    solverStatusEl.textContent = 'N/A';
    solverStatusEl.style.color = '#888';
    currentPuzzleEl.textContent = 'Use on apps.linera.net';
  }
}

// Toggle solver (Start/Stop)
startSolverBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('apps.linera.net')) {
    alert('Please navigate to apps.linera.net first');
    return;
  }
  
  if (isSolverRunning) {
    // Stop solver
    startSolverBtn.disabled = true;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'STOP_SOLVER' });
      await updateSolverStatus();
    } catch (error) {
      alert('Error stopping solver: ' + error.message);
    } finally {
      startSolverBtn.disabled = false;
    }
  } else {
    // Start solver
    startSolverBtn.textContent = 'Starting...';
    startSolverBtn.disabled = true;
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'START_SOLVER' });
      
      if (!response.success) {
        alert('Error starting solver: ' + response.error);
        return;
      }
      
      await updateSolverStatus();
      
      // Update status periodically
      const intervalId = setInterval(async () => {
        await updateSolverStatus();
        
        // Check if solver is still running
        try {
          const status = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SOLVER_STATUS' });
          if (!status.isRunning) {
            clearInterval(intervalId);
          }
        } catch {
          clearInterval(intervalId);
        }
      }, 2000);
      
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      startSolverBtn.disabled = false;
    }
  }
});

// Toggle Claim GoL Quests (Start/Stop)
claimGolQuestsBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('portal.linera.net')) {
    alert('Please navigate to portal.linera.net first');
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
    claimGolQuestsBtn.textContent = 'Stop Claiming';
    claimGolQuestsBtn.className = 'btn btn-stop';
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'CLAIM_GOL_QUESTS' });
      
      if (!response.success) {
        alert('Error claiming quests: ' + response.error);
      } else {
        alert('Successfully claimed Game of Life quests!');
      }
      
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      isClaimQuestsRunning = false;
      claimGolQuestsBtn.textContent = 'Claim GoL Quests';
      claimGolQuestsBtn.className = 'btn btn-primary';
    }
  }
});

// Toggle Answer Learn Questions (Start/Stop)
answerLearnBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('portal.linera.net')) {
    alert('Please navigate to portal.linera.net first');
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
    answerLearnBtn.textContent = 'Stop Answering';
    answerLearnBtn.className = 'btn btn-stop';
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ANSWER_LEARN_QUESTIONS' });
      
      if (!response.success) {
        alert('Error answering questions: ' + response.error);
      } else {
        alert('Successfully answered Learn questions!');
      }
      
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      isAnswerLearnRunning = false;
      answerLearnBtn.textContent = 'Answer Learn Questions';
      answerLearnBtn.className = 'btn btn-primary';
    }
  }
});

// Load on popup open
updateSolverStatus();

// Update status every 3 seconds while popup is open
setInterval(updateSolverStatus, 3000);
