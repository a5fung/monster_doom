// ===== map.js — Stage 1 map grid, spawn points, query helpers =====

// 24×24 grid: 0=floor, 1=wall, 2=exit door (locked), 3=key pickup
const MAP_STAGE1 = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row 0
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1], // row 1
  [1,0,1,1,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1], // row 2
  [1,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1], // row 3
  [1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,0,1,1,0,1], // row 4
  [1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,1], // row 5
  [1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,0,1,1,1,1,0,1], // row 6
  [1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,1,0,1], // row 7
  [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,0,1,1,1,1,0,1,0,1], // row 8
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,0,1,0,1], // row 9
  [1,0,1,1,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1,0,0,0,1], // row 10
  [1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,0,1,1,1,0,1], // row 11
  [1,0,1,0,1,1,1,1,1,1,1,0,1,0,0,0,1,0,1,0,0,0,0,1], // row 12
  [1,0,0,0,1,0,0,0,0,0,1,0,1,1,1,0,1,0,1,1,1,1,0,1], // row 13
  [1,1,1,0,1,0,1,1,1,0,1,0,0,0,1,0,0,0,0,0,0,1,0,1], // row 14
  [1,0,0,0,1,0,1,0,0,0,1,1,1,0,1,1,1,1,1,1,0,1,0,1], // row 15
  [1,0,1,1,1,0,1,0,1,1,1,0,0,0,0,0,0,0,0,1,0,1,0,1], // row 16
  [1,0,1,0,0,0,1,0,0,0,0,0,1,1,1,1,1,1,0,1,0,0,0,1], // row 17
  [1,0,1,0,1,1,1,1,1,0,1,0,1,0,0,0,0,1,0,1,1,1,0,1], // row 18
  [1,0,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,0,0,0,0,1,0,1], // row 19
  [1,1,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,1,0,1,0,1], // row 20
  [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,3,0,1], // row 21
  [1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,0,1,0,1,1,1,1,0,1], // row 22
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row 23
];

// Working copy of map (gets modified during gameplay for key pickup)
let MAP_CURRENT = null;

function mapInit() {
  MAP_CURRENT = MAP_STAGE1.map(row => row.slice());
}

// Monster spawn points — Easy uses first 3, Hard first 6, Extreme all 10
const SPAWNS_STAGE1 = [
  { col:  5, row:  7 },  // 1 Central-left
  { col:  9, row:  3 },  // 2 Top-center
  { col: 13, row:  7 },  // 3 Central crossroads
  { col:  5, row: 13 },  // 4 Mid-left
  { col: 11, row: 11 },  // 5 Maze center
  { col: 17, row:  9 },  // 6 Right-center
  { col:  3, row: 19 },  // 7 Bottom-left
  { col:  9, row: 17 },  // 8 Bottom-center
  { col: 15, row: 15 },  // 9 Bottom-center-right
  { col: 19, row: 21 },  // 10 Guards the key
];

const PLAYER_START = { col: 1, row: 1 };
const EXIT_POS     = { col: 22, row: 1 };
const KEY_POS      = { col: 21, row: 21 };

const MAP_COLS = 24;
const MAP_ROWS = 24;

function mapGetCell(col, row) {
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return 1; // out of bounds = wall
  return MAP_CURRENT[row][col];
}

function mapSetCell(col, row, value) {
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return;
  MAP_CURRENT[row][col] = value;
}

function mapIsWall(col, row) {
  const cell = mapGetCell(col, row);
  return cell === 1;
}

function mapIsBlocker(col, row, doorUnlocked) {
  const cell = mapGetCell(col, row);
  if (cell === 1) return true;              // solid wall
  if (cell === 2 && !doorUnlocked) return true; // locked exit door
  return false;
}
