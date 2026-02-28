// ===== config.js — All constants, difficulty table, stage registry =====

const RENDER_W = 480, RENDER_H = 270;
const FOV = Math.PI / 3;           // 60°
const HALF_FOV = FOV / 2;
const PLAYER_SPEED = 3.5;          // units/sec
const PLAYER_TURN_SPEED = 2.5;     // rad/sec (keyboard)
const PLAYER_RADIUS = 0.25;        // collision half-size
const TOUCH_LOOK_SENS = 0.008;     // rad per pixel dragged
const MOUSE_LOOK_SENS = 0.002;     // rad per pixel
const SHOOT_DAMAGE = 25;
const SHOOT_COOLDOWN = 0.4;        // seconds
const SHOOT_RANGE = 15.0;          // units (hitscan max)
const MONSTER_HP = 50;
const MONSTER_RADIUS = 0.4;
const MONSTER_MELEE_RANGE = 0.9;   // units
const MONSTER_MELEE_CD = 1.5;      // seconds
const MONSTER_BASE_SPEED = 1.8;    // units/sec × speedMult
const MONSTER_ASTAR_INTERVAL = 30; // frames between A* recalculates
const FOG_START = 4.0, FOG_END = 14.0;

// Difficulty settings
const DIFFICULTIES = {
  easy:    { monsters: 3,  speedMult: 0.6, meleeDmg: 5,  playerHp: 150, detectionRange: 8  },
  hard:    { monsters: 6,  speedMult: 1.0, meleeDmg: 12, playerHp: 100, detectionRange: 12 },
  extreme: { monsters: 10, speedMult: 1.5, meleeDmg: 25, playerHp: 75,  detectionRange: 16 }
};

// Stage registry — add Stage 2, 3, etc. here
const STAGES = {
  1: { name: 'The Labyrinth', mapKey: 'STAGE1' }
};
