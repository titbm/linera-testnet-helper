// DOM elements
const savedCountEl = document.getElementById('saved-count');
const puzzleListEl = document.getElementById('puzzle-list');
const saveBtn = document.getElementById('save-btn');
const exportBtn = document.getElementById('export-btn');
const clearBtn = document.getElementById('clear-btn');

// Load and display saved solutions
async function loadSolutions() {
  const { solutions = {} } = await chrome.storage.local.get('solutions');
  const count = Object.keys(solutions).length;
  
  savedCountEl.textContent = count;
  
  // Display list
  puzzleListEl.innerHTML = '';
  for (const [id, data] of Object.entries(solutions)) {
    const item = document.createElement('div');
    item.className = 'puzzle-item';
    item.innerHTML = `
      <strong>${data.name}</strong>
      <small>${id} - ${data.cells.length} cells</small>
    `;
    puzzleListEl.appendChild(item);
  }
}

// Save current puzzle solution
saveBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('apps.linera.net')) {
    alert('Please navigate to apps.linera.net first');
    return;
  }
  
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;
  
  try {
    // Get solution from content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SOLUTION' });
    
    if (!response.success) {
      alert('Error: ' + response.error);
      return;
    }
    
    // Save to storage
    const { solutions = {} } = await chrome.storage.local.get('solutions');
    solutions[response.data.id] = response.data;
    await chrome.storage.local.set({ solutions });
    
    // Refresh display
    await loadSolutions();
    
    alert(`Saved: ${response.data.name}`);
  } catch (error) {
    alert('Error saving solution: ' + error.message);
  } finally {
    saveBtn.textContent = 'Save Solution';
    saveBtn.disabled = false;
  }
});

// Export all solutions as JSON
exportBtn.addEventListener('click', async () => {
  const { solutions = {} } = await chrome.storage.local.get('solutions');
  
  if (Object.keys(solutions).length === 0) {
    alert('No solutions to export');
    return;
  }
  
  const json = JSON.stringify(solutions, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  await chrome.downloads.download({
    url: url,
    filename: 'gol-solutions.json',
    saveAs: true
  });
  
  URL.revokeObjectURL(url);
});

// Clear all saved solutions
clearBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all saved solutions?')) {
    return;
  }
  
  await chrome.storage.local.set({ solutions: {} });
  await loadSolutions();
});

// Load on popup open
loadSolutions();
