// ===== raycaster.js — DDA raycasting, Z-buffer, wall hit records =====

// Module-level state
let zBuffer = new Float32Array(RENDER_W);
let wallHits = new Array(RENDER_W);

// Initialize wallHits array
for (let i = 0; i < RENDER_W; i++) {
  wallHits[i] = { perpDist: 0, wallX: 0, side: 0, cell: 0 };
}

/**
 * Build Z-buffer and wallHits for the current frame.
 * Called once per frame before sprite rendering.
 */
function buildZBuffer(player, doorUnlocked) {
  const px = player.x;
  const py = player.y;
  const angle = player.angle;

  for (let c = 0; c < RENDER_W; c++) {
    // Ray angle for this column
    const rayAngle = angle - HALF_FOV + (c / RENDER_W) * FOV;
    const rayDirX = Math.cos(rayAngle);
    const rayDirY = Math.sin(rayAngle);

    // Which map cell the player is in
    let mapCol = Math.floor(px);
    let mapRow = Math.floor(py);

    // Length of ray from one x/y side to next x/y side
    const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

    // Direction and initial side distances
    let stepX, stepY;
    let sideDistX, sideDistY;

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (px - mapCol) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapCol + 1.0 - px) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (py - mapRow) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapRow + 1.0 - py) * deltaDistY;
    }

    // DDA loop
    let side = 0; // 0=N/S face (X side hit), 1=E/W face (Y side hit)
    let hit = false;
    let hitCell = 1;
    let maxSteps = MAP_COLS + MAP_ROWS;

    while (!hit && maxSteps-- > 0) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapCol += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapRow += stepY;
        side = 1;
      }
      hitCell = mapGetCell(mapCol, mapRow);
      if (hitCell === 1 || (hitCell === 2 && !doorUnlocked)) {
        hit = true;
      }
    }

    // Perpendicular distance (avoids fisheye)
    let perpDist;
    if (side === 0) {
      perpDist = sideDistX - deltaDistX;
    } else {
      perpDist = sideDistY - deltaDistY;
    }
    if (perpDist < 0.001) perpDist = 0.001;

    // Fractional wall hit position (for texture offset)
    let wallX;
    if (side === 0) {
      wallX = py + perpDist * rayDirY;
    } else {
      wallX = px + perpDist * rayDirX;
    }
    wallX -= Math.floor(wallX);

    zBuffer[c] = perpDist;
    wallHits[c].perpDist = perpDist;
    wallHits[c].wallX = wallX;
    wallHits[c].side = side;
    wallHits[c].cell = hitCell;
  }
}

/**
 * Cast a single ray and return perpendicular distance to nearest wall/door.
 * Used for player shooting line-of-sight check.
 */
function castRayDist(x, y, angle, doorUnlocked) {
  const rayDirX = Math.cos(angle);
  const rayDirY = Math.sin(angle);

  let mapCol = Math.floor(x);
  let mapRow = Math.floor(y);

  const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
  const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

  let stepX, stepY;
  let sideDistX, sideDistY;

  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (x - mapCol) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapCol + 1.0 - x) * deltaDistX;
  }
  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (y - mapRow) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapRow + 1.0 - y) * deltaDistY;
  }

  let side = 0;
  let hit = false;
  let maxSteps = MAP_COLS + MAP_ROWS;

  while (!hit && maxSteps-- > 0) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapCol += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapRow += stepY;
      side = 1;
    }
    const cell = mapGetCell(mapCol, mapRow);
    if (cell === 1 || (cell === 2 && !doorUnlocked)) {
      hit = true;
    }
  }

  if (side === 0) {
    return sideDistX - deltaDistX;
  } else {
    return sideDistY - deltaDistY;
  }
}
