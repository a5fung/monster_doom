// ===== monster.js — Monster class, A* pathfinding, melee AI =====

const MONSTER_STATE = { IDLE: 0, CHASE: 1, ATTACK: 2 };

// ---- Simple binary min-heap for A* open set ----
class MinHeap {
  constructor() { this.data = []; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].f <= this.data[i].f) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2*i+1, r = 2*i+2;
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

// ---- A* pathfinding ----
function aStarPath(startCol, startRow, goalCol, goalRow, doorUnlocked) {
  const key = (c, r) => r * MAP_COLS + c;
  const heuristic = (c, r) => Math.abs(c - goalCol) + Math.abs(r - goalRow);

  const open = new MinHeap();
  const gScore = new Map();
  const cameFrom = new Map();
  const startKey = key(startCol, startRow);

  gScore.set(startKey, 0);
  open.push({ f: heuristic(startCol, startRow), col: startCol, row: startRow });

  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  let iterations = 0;
  const MAX_ITER = 600;

  while (open.size > 0 && iterations++ < MAX_ITER) {
    const current = open.pop();
    const { col, row } = current;

    if (col === goalCol && row === goalRow) {
      // Reconstruct path
      const path = [];
      let k = key(col, row);
      while (cameFrom.has(k)) {
        const [pc, pr] = cameFrom.get(k);
        path.push({ col: pc, row: pr });
        k = key(pc, pr);
      }
      path.reverse();
      // Path is in reverse — we want waypoints from start to goal
      // Actually reconstruct from goal back to start
      const result = [];
      let ck = key(goalCol, goalRow);
      while (cameFrom.has(ck)) {
        const [pc, pr] = cameFrom.get(ck);
        result.push({ col: goalCol, row: goalRow }); // placeholder
        ck = key(pc, pr);
        break;
      }
      // Proper reconstruction
      const fullPath = [];
      let cur = key(goalCol, goalRow);
      fullPath.push({ col: goalCol, row: goalRow });
      while (cameFrom.has(cur)) {
        const [pc, pr] = cameFrom.get(cur);
        cur = key(pc, pr);
        if (cur !== startKey) fullPath.push({ col: pc, row: pr });
      }
      fullPath.reverse();
      return fullPath;
    }

    const currentG = gScore.get(key(col, row)) || 0;

    for (const [dc, dr] of dirs) {
      const nc = col + dc, nr = row + dr;
      if (mapIsBlocker(nc, nr, doorUnlocked)) continue;
      const nk = key(nc, nr);
      const newG = currentG + 1;
      if (!gScore.has(nk) || newG < gScore.get(nk)) {
        gScore.set(nk, newG);
        cameFrom.set(nk, [col, row]);
        open.push({ f: newG + heuristic(nc, nr), col: nc, row: nr });
      }
    }
  }

  return []; // no path found
}

// ---- Line-of-sight check ----
function hasLOS(mx, my, px, py) {
  const dx = px - mx;
  const dy = py - my;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 0.01) return true;
  const steps = Math.ceil(dist / 0.25);
  const sx = dx / steps;
  const sy = dy / steps;
  let cx = mx, cy = my;
  for (let i = 0; i < steps; i++) {
    cx += sx; cy += sy;
    if (mapIsWall(Math.floor(cx), Math.floor(cy))) return false;
  }
  return true;
}

// ---- Monster class ----
class Monster {
  constructor(col, row, difficulty) {
    this.x = col + 0.5;
    this.y = row + 0.5;
    this.hp = MONSTER_HP;
    this.dead = false;
    this.state = MONSTER_STATE.IDLE;

    const diff = DIFFICULTIES[difficulty];
    this.speedMult = diff.speedMult;
    this.meleeDmg  = diff.meleeDmg;
    this.detectionRange = diff.detectionRange;

    this.path = [];
    this.pathTimer = 0;
    this.meleeCooldown = 0;
    this.hitFlashTimer = 0;
    this.frameCount = 0;
  }

  update(delta, player, doorUnlocked) {
    if (this.dead) return;

    this.frameCount++;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= delta;
    if (this.meleeCooldown > 0) this.meleeCooldown -= delta;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.sqrt(dx*dx + dy*dy);

    switch (this.state) {
      case MONSTER_STATE.IDLE:
        if (distToPlayer <= this.detectionRange && hasLOS(this.x, this.y, player.x, player.y)) {
          this.state = MONSTER_STATE.CHASE;
          this.pathTimer = MONSTER_ASTAR_INTERVAL; // recalculate immediately
        }
        break;

      case MONSTER_STATE.CHASE:
        // Recalculate A* path periodically
        if (this.pathTimer <= 0 || this.path.length === 0) {
          const myCol = Math.floor(this.x);
          const myRow = Math.floor(this.y);
          const plCol = Math.floor(player.x);
          const plRow = Math.floor(player.y);
          this.path = aStarPath(myCol, myRow, plCol, plRow, doorUnlocked);
          this.pathTimer = MONSTER_ASTAR_INTERVAL;
        } else {
          this.pathTimer--;
        }

        // Move toward next waypoint
        if (this.path.length > 0) {
          const wp = this.path[0];
          const wpX = wp.col + 0.5;
          const wpY = wp.row + 0.5;
          const wdx = wpX - this.x;
          const wdy = wpY - this.y;
          const wdist = Math.sqrt(wdx*wdx + wdy*wdy);

          if (wdist < 0.15) {
            this.path.shift(); // reached waypoint
          } else {
            const speed = MONSTER_BASE_SPEED * this.speedMult * delta;
            const nx = this.x + (wdx / wdist) * speed;
            const ny = this.y + (wdy / wdist) * speed;
            // Simple monster collision with walls
            if (!mapIsBlocker(Math.floor(nx), Math.floor(this.y), doorUnlocked)) this.x = nx;
            if (!mapIsBlocker(Math.floor(this.x), Math.floor(ny), doorUnlocked)) this.y = ny;
          }
        }

        // Switch to attack if in melee range
        if (distToPlayer < MONSTER_MELEE_RANGE) {
          this.state = MONSTER_STATE.ATTACK;
        }

        // If out of range and no LOS, go idle
        if (distToPlayer > this.detectionRange * 1.5 && !hasLOS(this.x, this.y, player.x, player.y)) {
          this.state = MONSTER_STATE.IDLE;
        }
        break;

      case MONSTER_STATE.ATTACK:
        // Melee hit
        if (this.meleeCooldown <= 0 && distToPlayer < MONSTER_MELEE_RANGE) {
          player.takeDamage(this.meleeDmg);
          this.meleeCooldown = MONSTER_MELEE_CD;
        }
        // Return to chase if player moves away
        if (distToPlayer >= MONSTER_MELEE_RANGE + 0.2) {
          this.state = MONSTER_STATE.CHASE;
          this.pathTimer = 0;
        }
        break;
    }
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitFlashTimer = 0.15;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }
}
