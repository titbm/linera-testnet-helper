# Linera GoL Recorder Extension

Simple Chrome/Edge extension to record solutions for Linera Game of Life puzzles.

## Installation

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `recorder` folder
5. Extension is now installed!

## Usage

1. Navigate to https://apps.linera.net/gol/index.html
2. Login with your crypto wallet
3. Open a puzzle and solve it manually
4. Click the extension icon in toolbar
5. Click "Save Solution" button
6. Move to next puzzle and repeat
7. After solving all puzzles, click "Export All"
8. Save the `gol-solutions.json` file

## Features

- **Save Solution**: Records current puzzle state (alive cells, coordinates, puzzle ID)
- **Export All**: Downloads all saved solutions as JSON file
- **Clear All**: Removes all saved solutions from storage
- **Visual List**: Shows saved puzzles with names and cell counts

## Data Format

The exported JSON has this structure:

```json
{
  "puzzle-id-1": {
    "id": "puzzle-id-1",
    "name": "Puzzle Name",
    "gridSize": { "rows": 16, "cols": 16 },
    "cells": [
      { "row": 5, "col": 7 },
      { "row": 5, "col": 8 }
    ],
    "timestamp": "2025-11-16T12:00:00.000Z"
  }
}
```

## Next Steps

Use the exported `gol-solutions.json` file with the Solver extension to automatically solve all puzzles.
