<div align="center">
  <img src="logo.png" alt="Linera Logo" width="200"/>
</div>

# Linera Testnet Helper

Chrome extension for automating Linera testnet tasks: solving Conway's Game of Life puzzles, claiming quests, and answering learn questions.

## ✨ Features

### 🎮 Conway's Game of Life Puzzles Solver
Automatically solves all Conway's Game of Life puzzles on [apps.linera.net/gol](https://apps.linera.net/gol):
- Detects current puzzle state
- Applies pre-calculated solutions
- Submits and verifies results
- Automatically proceeds to next puzzle
- Skips already completed puzzles

### 🎯 Puzzle's Quests Auto Claim on Portal
Claims all Game of Life quest rewards on [portal.linera.net/quests](https://portal.linera.net/quests):
- Iterates through all GoL challenges
- Opens each quest automatically
- Clicks "Check Puzzle" to claim rewards
- Skips already claimed quests
- **Note**: Puzzles must be solved first on apps.linera.net

### 📚 Questions Auto Answering on Portal
Automatically answers all 28 learn questions on [portal.linera.net/learn](https://portal.linera.net/learn):
- Uses pre-loaded correct answers database
- Submits answers automatically
- Skips already answered questions
- Completes all learn modules

## 🚀 Installation

1. Download or clone this repository:
   ```bash
   git clone https://github.com/titbm/linera-testnet-helper.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked**

5. Select the repository root folder

## 📖 Usage

### Solving Conway's Game of Life Puzzles

1. Navigate to [apps.linera.net/gol](https://apps.linera.net/gol)
2. Connect your wallet if needed
3. Click the extension icon in Chrome toolbar
4. Click the **red "Start Solver"** button
5. The solver will automatically complete all puzzles
6. Click the **white "Stop Solver"** button to stop

### Claiming Quests

1. **First, complete all Game of Life puzzles** using the solver above
2. Navigate to [portal.linera.net/quests](https://portal.linera.net/quests)
3. Ensure you're logged in
4. Open the extension
5. Click **"Claim GoL Quests"**
6. Wait for completion notification

### Answering Learn Questions

1. Navigate to [portal.linera.net/learn](https://portal.linera.net/learn)
2. Ensure you're logged in
3. Open the extension
4. Click **"Answer Learn Questions"**
5. Wait for completion notification

## 📁 Project Structure

```
linera-testnet-helper/
├── manifest.json          # Extension configuration
├── solver.js              # Main automation logic
├── popup.html             # Extension popup interface
├── popup.js               # Popup logic
├── popup.css              # Popup styles
├── gol-solutions.json     # GoL puzzle solutions database
├── learn-answers.json     # Learn questions answers database
├── icons/                 # Extension icons
└── README.md              # This file
```

## ⚙️ Button States

All buttons have three states:

- 🔴 **Red** - Ready to start (click to begin)
- ⚪ **White** - Running (click to stop)
- ⚫ **Black/Disabled** - Not available (wrong page or not logged in)

## ⚠️ Important Notes

1. **Complete puzzles before claiming quests** - Use "Start Solver" on apps.linera.net first
2. **Stay logged in** - Ensure wallet is connected before starting any automation
3. **Keep tab open** - Don't close or switch tabs during automation
4. **Check console for logs** - Press F12 to see detailed progress logs

## 🐛 Debugging

All extension actions are logged to browser console with prefixes:
- `[Solver]` - GoL puzzle solver logs
- `[Quests]` - Quest claiming logs  
- `[Learn]` - Learn questions logs

To view logs:
1. Press `F12` to open DevTools
2. Go to Console tab
3. Run desired function

## 📄 License

MIT License - feel free to use and modify

---

<div align="center">
  Made for Linera Testnet 🚀
</div>
