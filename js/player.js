// ===== player.js — Player state, movement, collision, shooting =====

class Player {
  constructor(difficulty) {
    const diff = DIFFICULTIES[difficulty];
    this.x = PLAYER_START.col + 0.5;
    this.y = PLAYER_START.row + 0.5;
    this.angle = 0; // facing east (positive X)
    this.maxHp = diff.playerHp;
    this.hp = diff.playerHp;
    this.hasKey = false;
    this.shootCooldown = 0;
    this.damageFlashTimer = 0;
    this.difficulty = difficulty;
  }

  update(delta, controls, doorUnlocked, monsters) {
    // --- Turning ---
    if (controls.isTurningLeft())  this.angle -= PLAYER_TURN_SPEED * delta;
    if (controls.isTurningRight()) this.angle += PLAYER_TURN_SPEED * delta;

    // Mouse look
    if (controls.mouseDelta && controls.mouseDelta.x !== 0) {
      this.angle += controls.mouseDelta.x * MOUSE_LOOK_SENS;
    }

    // Touch look
    if (controls.lookDelta && controls.lookDelta.x !== 0) {
      this.angle += controls.lookDelta.x * TOUCH_LOOK_SENS;
    }

    // Keep angle in reasonable range
    this.angle = this.angle % (Math.PI * 2);

    // --- Movement ---
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);
    const speed = PLAYER_SPEED * delta;

    // Keyboard movement
    let moveX = 0, moveY = 0;
    if (controls.isForward())     { moveX += cosA; moveY += sinA; }
    if (controls.isBackward())    { moveX -= cosA; moveY -= sinA; }
    if (controls.isStrafeLeft())  { moveX += sinA; moveY -= cosA; }
    if (controls.isStrafeRight()) { moveX -= sinA; moveY += cosA; }

    // Joystick — joyY negative = forward, joyX positive = strafe right
    const joy = controls.joystick;
    if (joy && (joy.x !== 0 || joy.y !== 0)) {
      moveX += cosA * (-joy.y) + sinA * joy.x;
      moveY += sinA * (-joy.y) + (-cosA) * joy.x;
    }

    // Normalize if moving diagonally
    const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveMag > 1) { moveX /= moveMag; moveY /= moveMag; }

    const dx = moveX * speed;
    const dy = moveY * speed;

    // Collision with slide-along-wall
    if (dx !== 0 || dy !== 0) {
      const nx = this.x + dx;
      const ny = this.y + dy;
      if (this.canMoveTo(nx, ny, doorUnlocked)) {
        this.x = nx; this.y = ny;
      } else if (this.canMoveTo(nx, this.y, doorUnlocked)) {
        this.x = nx;
      } else if (this.canMoveTo(this.x, ny, doorUnlocked)) {
        this.y = ny;
      }
      // else fully blocked
    }

    // --- Key pickup ---
    const col = Math.floor(this.x);
    const row = Math.floor(this.y);
    if (mapGetCell(col, row) === 3 && !this.hasKey) {
      this.hasKey = true;
      mapSetCell(col, row, 0);
      showNotification('KEY COLLECTED!', 3000);
    }

    // --- Exit trigger ---
    if (this.hasKey) {
      const exitX = EXIT_POS.col + 0.5;
      const exitY = EXIT_POS.row + 0.5;
      const dx2 = this.x - exitX;
      const dy2 = this.y - exitY;
      if (Math.sqrt(dx2*dx2 + dy2*dy2) < 1.2) {
        triggerWin();
      }
    }

    // --- Timers ---
    if (this.shootCooldown > 0) this.shootCooldown -= delta;
    if (this.damageFlashTimer > 0) this.damageFlashTimer -= delta;
  }

  canMoveTo(nx, ny, doorUnlocked) {
    const r = PLAYER_RADIUS;
    // Check 4 corners
    const corners = [
      [nx - r, ny - r],
      [nx + r, ny - r],
      [nx - r, ny + r],
      [nx + r, ny + r],
    ];
    for (const [cx, cy] of corners) {
      if (mapIsBlocker(Math.floor(cx), Math.floor(cy), doorUnlocked)) return false;
    }
    return true;
  }

  shoot(monsters, doorUnlocked) {
    if (this.shootCooldown > 0) return;
    this.shootCooldown = SHOOT_COOLDOWN;

    // Find closest monster in shooting arc
    let closest = null;
    let closestDist = SHOOT_RANGE;

    for (const m of monsters) {
      if (m.dead) continue;

      const dx = m.x - this.x;
      const dy = m.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > SHOOT_RANGE) continue;

      // Check if the ray passes through the monster cylinder
      // Project monster position onto ray
      const rayDirX = Math.cos(this.angle);
      const rayDirY = Math.sin(this.angle);
      const dot = dx * rayDirX + dy * rayDirY;
      if (dot < 0) continue; // behind player

      // Perpendicular distance from monster center to ray
      const perpX = dx - rayDirX * dot;
      const perpY = dy - rayDirY * dot;
      const perpDist = Math.sqrt(perpX*perpX + perpY*perpY);
      if (perpDist > MONSTER_RADIUS + 0.1) continue; // miss

      // Check wall doesn't block
      const wallDist = castRayDist(this.x, this.y, this.angle, doorUnlocked);
      if (dist > wallDist + 0.5) continue; // wall blocks

      if (dist < closestDist) {
        closestDist = dist;
        closest = m;
      }
    }

    if (closest) {
      closest.takeDamage(SHOOT_DAMAGE);
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.damageFlashTimer = 0.3;
    if (this.hp <= 0) {
      this.hp = 0;
      triggerLose();
    }
  }
}
