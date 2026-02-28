// ===== renderer.js — Full frame rendering: floor/walls/sprites/HUD/flash =====

// Offscreen canvas for pixel buffer rendering (480×270)
let offscreen, offCtx, imageData, pixels;
// Main canvas context (scaled display)
let mainCanvas, mainCtx;

// Procedural sprite pixel arrays
let spriteMonster = null; // 32 wide × 64 tall, RGBA Uint8ClampedArray
let spriteKey = null;     // 32 wide × 32 tall, RGBA Uint8ClampedArray

const SPRITE_M_W = 32, SPRITE_M_H = 64;
const SPRITE_K_W = 32, SPRITE_K_H = 32;

function rendererInit(canvas) {
  mainCanvas = canvas;
  mainCtx = canvas.getContext('2d');

  offscreen = document.createElement('canvas');
  offscreen.width = RENDER_W;
  offscreen.height = RENDER_H;
  offCtx = offscreen.getContext('2d');

  imageData = offCtx.createImageData(RENDER_W, RENDER_H);
  pixels = new Uint32Array(imageData.data.buffer);

  generateTextures();
}

// ---- Procedural texture generation ----

function generateTextures() {
  spriteMonster = generateMonsterSprite();
  spriteKey = generateKeySprite();
}

function generateMonsterSprite() {
  const w = SPRITE_M_W, h = SPRITE_M_H;
  const data = new Uint8ClampedArray(w * h * 4);
  // Draw a red humanoid silhouette
  // Helper: set pixel
  function sp(x, y, r, g, b, a) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = a;
  }
  // Head (rows 0-9, cols 10-21)
  for (let y = 2; y < 11; y++) {
    for (let x = 10; x < 22; x++) {
      const cx = x - 16, cy = y - 6;
      if (cx*cx*1.3 + cy*cy < 28) sp(x, y, 180, 40, 40, 255);
    }
  }
  // Eyes
  sp(13, 5, 255, 200, 0, 255); sp(14, 5, 255, 200, 0, 255);
  sp(18, 5, 255, 200, 0, 255); sp(19, 5, 255, 200, 0, 255);
  // Torso (rows 11-36, cols 8-24)
  for (let y = 11; y < 37; y++) {
    const taper = Math.floor((y - 11) * 0.2);
    for (let x = 8 + taper; x < 24 - taper; x++) {
      const shade = 140 + Math.floor(Math.random() * 30);
      sp(x, y, shade, 30, 30, 255);
    }
  }
  // Arms (rows 12-34)
  for (let y = 12; y < 35; y++) {
    // left arm
    for (let x = 2; x < 8; x++) sp(x, y, 150, 35, 35, 255);
    // right arm
    for (let x = 24; x < 30; x++) sp(x, y, 150, 35, 35, 255);
  }
  // Claws
  for (let y = 34; y < 40; y++) {
    sp(2, y, 200,200,200,255); sp(4, y, 200,200,200,255); sp(6, y, 200,200,200,255);
    sp(25, y, 200,200,200,255); sp(27, y, 200,200,200,255); sp(29, y, 200,200,200,255);
  }
  // Legs (rows 37-63)
  for (let y = 37; y < 64; y++) {
    // left leg
    for (let x = 9; x < 16; x++) sp(x, y, 120, 25, 25, 255);
    // right leg
    for (let x = 16; x < 23; x++) sp(x, y, 120, 25, 25, 255);
  }
  return data;
}

function generateKeySprite() {
  const w = SPRITE_K_W, h = SPRITE_K_H;
  const data = new Uint8ClampedArray(w * h * 4);
  function sp(x, y, r, g, b, a) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = a;
  }
  // Key head (circle at top)
  const hcx = 16, hcy = 10, hr = 7;
  for (let y = hcy - hr - 1; y <= hcy + hr + 1; y++) {
    for (let x = hcx - hr - 1; x <= hcx + hr + 1; x++) {
      const dx = x - hcx, dy = y - hcy;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d <= hr) sp(x, y, 255, 200, 0, 255);
      else if (d <= hr + 1) sp(x, y, 200, 150, 0, 255);
    }
  }
  // Key hole
  for (let y = 7; y < 14; y++) {
    for (let x = 14; x < 19; x++) {
      const cx = x-16, cy = y-10;
      if (cx*cx + cy*cy < 8) sp(x, y, 40, 40, 40, 255);
    }
  }
  // Key shaft
  for (let y = 17; y < 28; y++) {
    sp(15, y, 255, 200, 0, 255); sp(16, y, 255, 200, 0, 255); sp(17, y, 255, 200, 0, 255);
  }
  // Key teeth
  sp(18, 20, 255,200,0,255); sp(19, 20, 255,200,0,255);
  sp(18, 23, 255,200,0,255); sp(19, 23, 255,200,0,255);
  sp(18, 25, 255,200,0,255);
  return data;
}

// ---- Fog helper ----

function fogFactor(dist) {
  if (dist <= FOG_START) return 0;
  if (dist >= FOG_END) return 1;
  return (dist - FOG_START) / (FOG_END - FOG_START);
}

function applyFog(r, g, b, fog) {
  const fr = 17, fg = 17, fb = 17; // fog color #111
  return [
    Math.round(r + (fr - r) * fog),
    Math.round(g + (fg - g) * fog),
    Math.round(b + (fb - b) * fog)
  ];
}

function toPixel32(r, g, b) {
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

// ---- Main render function ----

function renderFrame(player, monsters, doorUnlocked, keyExists) {
  // 1. Clear pixel buffer — ceiling top half, floor bottom half
  const halfH = RENDER_H >> 1;
  const ceilColor  = toPixel32(34, 34, 34);   // #222
  const floorColor = toPixel32(68, 68, 68);   // #444
  for (let y = 0; y < RENDER_H; y++) {
    const color = y < halfH ? ceilColor : floorColor;
    for (let x = 0; x < RENDER_W; x++) {
      pixels[y * RENDER_W + x] = color;
    }
  }

  // 2. Draw walls from wallHits[]
  for (let c = 0; c < RENDER_W; c++) {
    const hit = wallHits[c];
    const perpDist = hit.perpDist;
    const lineHeight = Math.round(RENDER_H / perpDist);
    const drawStart = Math.max(0, Math.floor((RENDER_H - lineHeight) / 2));
    const drawEnd   = Math.min(RENDER_H - 1, Math.floor((RENDER_H + lineHeight) / 2));

    // Base wall color
    let wr, wg, wb;
    if (hit.cell === 2) {
      // Exit door — brown
      wr = 85; wg = 51; wb = 17;
    } else {
      // Regular wall — N/S brighter than E/W
      const base = hit.side === 0 ? 170 : 136;
      wr = base; wg = base; wb = base;
    }

    const fog = fogFactor(perpDist);
    const wallX = hit.wallX;

    for (let y = drawStart; y <= drawEnd; y++) {
      // Brick texture: mortar at every 8 rows and fractional column positions
      const texRow = Math.floor(((y - drawStart) / (drawEnd - drawStart + 1)) * 64);
      const isMortarRow = (texRow % 8 === 0);
      // Offset mortar columns by half for alternating rows effect
      const brickRow = Math.floor(texRow / 8);
      const wallXOff = (brickRow % 2 === 0) ? wallX : (wallX + 0.5) % 1.0;
      const isMortarCol = (wallXOff * 16) % 1.0 < 0.06;
      const isMortar = isMortarRow || isMortarCol;

      let r = isMortar ? Math.round(wr * 0.55) : wr;
      let g = isMortar ? Math.round(wg * 0.55) : wg;
      let b = isMortar ? Math.round(wb * 0.55) : wb;

      const [fr, fg2, fb] = applyFog(r, g, b, fog);
      pixels[y * RENDER_W + c] = toPixel32(fr, fg2, fb);
    }
  }

  // 3. Upload pixel buffer
  offCtx.putImageData(imageData, 0, 0);

  // 4. Draw sprites (monsters + key) — sorted farthest-first
  const sprites = [];

  // Living monsters
  for (const m of monsters) {
    if (m.dead) continue;
    const dx = m.x - player.x;
    const dy = m.y - player.y;
    const dist2 = dx*dx + dy*dy;
    sprites.push({ type: 'monster', obj: m, dist2 });
  }

  // Key pickup
  if (keyExists) {
    const kx = KEY_POS.col + 0.5;
    const ky = KEY_POS.row + 0.5;
    const dx = kx - player.x;
    const dy = ky - player.y;
    sprites.push({ type: 'key', x: kx, y: ky, dist2: dx*dx + dy*dy });
  }

  // Sort farthest first
  sprites.sort((a, b) => b.dist2 - a.dist2);

  // Camera plane (perpendicular to view direction)
  const camDirX = Math.cos(player.angle);
  const camDirY = Math.sin(player.angle);
  const planX = -camDirY * Math.tan(HALF_FOV);
  const planY =  camDirX * Math.tan(HALF_FOV);

  for (const sp of sprites) {
    let sx, sy, spW, spH, spriteData, sw, sh;
    if (sp.type === 'monster') {
      sx = sp.obj.x; sy = sp.obj.y;
      spriteData = spriteMonster; sw = SPRITE_M_W; sh = SPRITE_M_H;
    } else {
      sx = sp.x; sy = sp.y;
      spriteData = spriteKey; sw = SPRITE_K_W; sh = SPRITE_K_H;
    }

    // Translate to camera space
    const relX = sx - player.x;
    const relY = sy - player.y;

    // Inverse camera matrix determinant
    const invDet = 1.0 / (planX * camDirY - camDirX * planY);
    const transformX = invDet * (camDirY * relX - camDirX * relY);
    const transformY = invDet * (-planY * relX + planX * relY); // depth

    if (transformY <= 0.1) continue; // behind player

    // Projected screen X center
    const screenX = Math.floor((RENDER_W / 2) * (1 + transformX / transformY));

    // Sprite screen dimensions
    spH = Math.abs(Math.floor(RENDER_H / transformY));
    spW = Math.abs(Math.floor(RENDER_H / transformY * (sw / sh)));

    const drawStartY = Math.max(0, Math.floor((RENDER_H - spH) / 2));
    const drawEndY   = Math.min(RENDER_H - 1, Math.floor((RENDER_H + spH) / 2));
    const drawStartX = Math.max(0, Math.floor(screenX - spW / 2));
    const drawEndX   = Math.min(RENDER_W - 1, Math.floor(screenX + spW / 2));

    const fog = fogFactor(transformY);

    // Flash tint for hit monsters
    const flashing = sp.type === 'monster' && sp.obj.hitFlashTimer > 0;

    for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
      // Z-buffer occlusion check
      if (transformY >= zBuffer[stripe]) continue;

      const texX = Math.floor((stripe - (screenX - spW / 2)) / spW * sw);

      for (let y = drawStartY; y <= drawEndY; y++) {
        const texY = Math.floor((y - drawStartY) / spH * sh);
        const si = (texY * sw + texX) * 4;
        const a = spriteData[si + 3];
        if (a < 128) continue; // transparent

        let r = spriteData[si];
        let g = spriteData[si + 1];
        let b = spriteData[si + 2];

        if (flashing) { r = Math.min(255, r + 120); g = Math.min(255, g + 40); b = Math.min(255, b + 40); }

        const [fr, fg2, fb] = applyFog(r, g, b, fog);
        pixels[y * RENDER_W + stripe] = toPixel32(fr, fg2, fb);
      }
    }
  }

  // 5. Upload sprite-composited buffer
  offCtx.putImageData(imageData, 0, 0);

  // 6. Scale to main canvas
  mainCtx.imageSmoothingEnabled = false;
  mainCtx.drawImage(offscreen, 0, 0, mainCanvas.width, mainCanvas.height);

  // 7. Damage flash overlay
  if (player.damageFlashTimer > 0) {
    const alpha = Math.min(0.5, player.damageFlashTimer * 1.5);
    mainCtx.fillStyle = `rgba(200,0,0,${alpha.toFixed(3)})`;
    mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
  }

  // 8. Update HUD DOM
  updateHUD(player);
}

function updateHUD(player) {
  const hpPct = Math.max(0, player.hp / player.maxHp) * 100;
  const hpFill = document.getElementById('hudHpFill');
  const hpNum  = document.getElementById('hudHpNum');
  const hudKey = document.getElementById('hudKey');

  if (hpFill) hpFill.style.width = hpPct.toFixed(1) + '%';
  if (hpNum)  hpNum.textContent = Math.max(0, Math.floor(player.hp));
  if (hudKey) {
    if (player.hasKey) hudKey.classList.add('collected');
    else hudKey.classList.remove('collected');
  }
}
