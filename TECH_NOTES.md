# Технические заметки: Linera Game of Life

## О проекте

**Цель:** Два Chrome-расширения для автоматизации головоломок Conway's Game of Life

**Расширения:**
1. **Recorder** (`recorder/`) - Записывает решения головоломок в JSON
2. **Solver** (`solver/`) - Автоматически решает головоломки используя записанные решения

**Что делают:**
- Recorder: записывает координаты живых клеток, сохраняет в JSON
- Solver: определяет головоломку, кликает на ячейки, отправляет решение, переходит к следующей

**Файлы проекта:**
- `recorder/` — Chrome extension для записи решений (Manifest V3)
  - `content.js` — извлечение данных из DOM
  - `popup.js` — UI расширения
- `solver/` — Chrome extension для автоматического решения (Manifest V3)
  - `solver.js` — автоматический решатель
  - `popup.js` — UI управления
  - `gol-solutions.json` — база решений
- `answers/gol-solutions.json` — общая база сохранённых решений
- `TECH_NOTES.md` — этот файл (для быстрой справки)

**Установка расширений:**

Recorder:
1. Chrome → Extensions → Developer mode
2. Load unpacked → выбрать папку `recorder/`
3. Открыть https://apps.linera.net/gol/index.html
4. Решить головоломку → кликнуть на расширение → Save Solution

Solver:
1. Chrome → Extensions → Developer mode
2. Load unpacked → выбрать папку `solver/`
3. Открыть https://apps.linera.net/gol/index.html (любую головоломку)
4. Кликнуть на расширение → Start Solver
5. Расширение автоматически решает все головоломки!

## Структура сайта

**URL:** https://apps.linera.net/gol/index.html  
**Framework:** React 18.3.1 (SPA)

### DOM-структура

```
body
├── #root
    └── div (app container)
        ├── h1 "Conway's Game of Life" (app title - игнорировать)
        ├── h2 "Beehive" / "Block" / "Loaf" (название головоломки)
        ├── div[style*="display: inline-grid"] (PUZZLE GRID)
        │   └── div × N (клетки сетки)
        └── button "Submit Solution"
```

### Определение сетки головоломки

**Проблема:** На странице есть несколько CSS Grid элементов:
- Layout grid (3×1) — структура страницы
- Puzzle grid (8×8, 9×9, 10×10) — игровая сетка

**Решение:** Ищем grid с ≥16 children и gridTemplateColumns ≥ "4fr"

```javascript
const grids = document.querySelectorAll('[style*="display: inline-grid"]');
const puzzleGrid = Array.from(grids).find(grid => {
  const children = grid.children.length;
  const style = window.getComputedStyle(grid);
  const cols = style.gridTemplateColumns.split(' ').length;
  const rows = style.gridTemplateRows.split(' ').length;
  return children >= 16 && cols >= 4 && rows >= 4;
});
```

## Координатная система

**КРИТИЧНО:** CSS grid-area использует **1-based indexing**

```
grid-area: "1 / 1"  ← первая клетка (не 0/0!)
grid-area: "4 / 4"  ← центр сетки 8×8
grid-area: "8 / 8"  ← последняя клетка 8×8
```

### Извлечение координат

```javascript
const cells = Array.from(puzzleGrid.children);
const aliveCells = cells
  .filter(cell => window.getComputedStyle(cell).backgroundColor === 'rgb(222, 42, 2)')
  .map(cell => {
    const gridArea = cell.style.gridArea; // "4 / 5"
    const [row, col] = gridArea.split(' / ').map(Number);
    return { row, col }; // уже 1-based!
  });
```

### Автоматизация (селекторы)

```javascript
// ✅ ПРАВИЛЬНО (координаты уже 1-based)
const selector = `[style*="grid-area: ${cell.row} / ${cell.col}"]`;

// ❌ НЕПРАВИЛЬНО (не добавлять +1)
const selector = `[style*="grid-area: ${cell.row + 1} / ${cell.col + 1}"]`;
```

## Определение названия головоломки

**Проблема:** `querySelector('h1')` возвращает app title, а не название головоломки

**Решение:** Итерация по всем заголовкам с фильтрацией

```javascript
function getPuzzleName() {
  const headings = document.querySelectorAll('h1, h2');
  const appTitles = ['Conway\'s Game of Life', 'Game of Life'];
  
  for (const h of headings) {
    const text = h.textContent.trim();
    if (!appTitles.includes(text) && text.length > 0) {
      return text; // "Beehive", "Block", "Loaf"
    }
  }
  return null;
}
```

## Данные решений

**Формат JSON:**
```json
{
  "puzzleId": {
    "id": "block",
    "name": "Block",
    "gridSize": { "rows": 8, "cols": 8 },
    "cells": [
      { "row": 4, "col": 4 },  // 1-based координаты
      { "row": 4, "col": 5 }
    ],
    "timestamp": "2025-11-16T03:07:11.147Z"
  }
}
```

## Известные головоломки

| Название | Размер | Клеток | ID |
|----------|--------|--------|-----|
| Beehive  | 9×9    | 6      | beehive |
| Block    | 8×8    | 4      | block |
| Loaf     | 10×10  | 7      | loaf |

## Баги и решения

### ❌ Баг #1: Неправильное название
- **Причина:** `querySelector('h1')` возвращает app title
- **Решение:** Итерация с фильтрацией app titles

### ❌ Баг #2: Неправильный gridSize
- **Причина:** Находит layout grid (3×1) вместо puzzle grid
- **Решение:** Фильтр по количеству children (≥16) и размеру (≥4×4)

### ❌ Баг #3: Смещение координат в автоматизации
- **Причина:** Добавление +1 к уже 1-based координатам
- **Решение:** Использовать координаты напрямую без +1

## Цель проекта

**Главная задача:** Автоматизировать решение всех 18 головоломок Conway's Game of Life на Linera Testnet

**Архитектура:**
1. **Recorder** (recorder/) — записывает решения в JSON формат
   - Запускается на странице с головоломкой
   - Сохраняет координаты решённых головоломок
   - Результат → `answers/gol-solutions.json`

2. **Solver** (будущее расширение) — автоматически решает все головоломки
   - Читает решения из JSON
   - Определяет текущую головоломку на странице
   - Автоматически кликает нужные клетки
   - Отправляет решение
   - Переходит к следующей головоломке

**Текущий прогресс:**
- ✅ Recorder готов и работает
- ✅ Записано 3 решения: Beehive, Block, Loaf
- ⏳ Нужно записать ещё 15 решений (всего 18)
- ⏳ Создать Solver расширение

**Следующие шаги:**
1. Записать все 18 решений через Recorder
2. Создать новое Chrome-расширение Solver
3. Solver автоматически решит все головоломки за один запуск
