// ===== controls.js — Keyboard, pointer lock, virtual joystick, touch =====

const JOY_RADIUS = 48; // pixels, max joystick displacement
const JOY_LEFT_ZONE = 0.4; // left 40% of screen = joystick zone

const controls = {
  keys: {},

  // Joystick: normalized -1..1
  joystick: { x: 0, y: 0 },
  _joystickRaw: { x: 0, y: 0 }, // pixel offset from origin
  _joystickActive: false,
  _joystickTouchId: null,
  _joystickOrigin: { x: 0, y: 0 },

  // Look delta (touch drag / mouse)
  lookDelta: { x: 0, y: 0 },
  _lookDeltaAccum: { x: 0, y: 0 },
  _lookTouchId: null,
  _lookLastX: 0,
  _lookLastY: 0,

  // Mouse pointer lock
  mouseDelta: { x: 0, y: 0 },
  _mouseDeltaAccum: { x: 0, y: 0 },
  _pointerLocked: false,

  // Single-shot fire flags
  shootFired: false,
  touchFireFired: false,

  // --- Queries ---
  isForward()      { return !!this.keys['KeyW'] || !!this.keys['ArrowUp']; },
  isBackward()     { return !!this.keys['KeyS'] || !!this.keys['ArrowDown']; },
  isStrafeLeft()   { return !!this.keys['KeyA']; },
  isStrafeRight()  { return !!this.keys['KeyD']; },
  isTurningLeft()  { return !!this.keys['ArrowLeft']; },
  isTurningRight() { return !!this.keys['ArrowRight']; },
  isShootPressed() { return this.shootFired || this.touchFireFired; },

  // --- Called each frame: swap accumulators into readable fields ---
  flush() {
    this.lookDelta.x = this._lookDeltaAccum.x;
    this.lookDelta.y = this._lookDeltaAccum.y;
    this._lookDeltaAccum.x = 0;
    this._lookDeltaAccum.y = 0;

    this.mouseDelta.x = this._mouseDeltaAccum.x;
    this.mouseDelta.y = this._mouseDeltaAccum.y;
    this._mouseDeltaAccum.x = 0;
    this._mouseDeltaAccum.y = 0;

    this.joystick.x = this._joystickRaw.x / JOY_RADIUS;
    this.joystick.y = this._joystickRaw.y / JOY_RADIUS;
  },

  clearSingleShot() {
    this.shootFired = false;
    this.touchFireFired = false;
  },

  reset() {
    this.keys = {};
    this.joystick = { x: 0, y: 0 };
    this._joystickRaw = { x: 0, y: 0 };
    this._joystickActive = false;
    this._joystickTouchId = null;
    this._lookDeltaAccum = { x: 0, y: 0 };
    this._mouseDeltaAccum = { x: 0, y: 0 };
    this.shootFired = false;
    this.touchFireFired = false;
    if (this._pointerLocked && document.exitPointerLock) document.exitPointerLock();
  }
};

// ---- Keyboard ----
window.addEventListener('keydown', (e) => {
  controls.keys[e.code] = true;
  if (e.code === 'Space') { controls.shootFired = true; e.preventDefault(); }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  controls.keys[e.code] = false;
});

// ---- Pointer Lock (mouse) ----
document.addEventListener('pointerlockchange', () => {
  controls._pointerLocked = document.pointerLockElement != null;
});

document.addEventListener('mousemove', (e) => {
  if (!controls._pointerLocked) return;
  controls._mouseDeltaAccum.x += e.movementX;
  controls._mouseDeltaAccum.y += e.movementY;
});

document.addEventListener('mousedown', (e) => {
  // Only engage pointer lock during active gameplay
  if (typeof gameState === 'undefined' || typeof STATE === 'undefined') return;
  if (gameState !== STATE.PLAYING) return;
  if (!controls._pointerLocked) {
    document.body.requestPointerLock();
  } else {
    if (e.button === 0) controls.shootFired = true;
  }
});

// ---- Touch controls ----
const joystickBaseEl  = document.getElementById('joystickBase');
const joystickThumbEl = document.getElementById('joystickThumb');
const fireBtnEl       = document.getElementById('fireBtn');

if (fireBtnEl) {
  fireBtnEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    controls.touchFireFired = true;
  }, { passive: false });
}

document.addEventListener('touchstart', (e) => {
  // Let taps on interactive elements (buttons, links) pass through normally
  if (e.target.closest('button, a, input, select')) return;
  e.preventDefault();
  for (const touch of e.changedTouches) {
    const tx = touch.clientX;
    const ty = touch.clientY;
    const screenW = window.innerWidth;

    // Fire button handled separately above — check if in fire button bounds
    if (fireBtnEl) {
      const rect = fireBtnEl.getBoundingClientRect();
      if (tx >= rect.left && tx <= rect.right && ty >= rect.top && ty <= rect.bottom) {
        continue; // handled by fire button listener
      }
    }

    if (tx < screenW * JOY_LEFT_ZONE) {
      // Joystick zone — floating joystick
      if (!controls._joystickActive) {
        controls._joystickActive = true;
        controls._joystickTouchId = touch.identifier;
        controls._joystickOrigin.x = tx;
        controls._joystickOrigin.y = ty;
        controls._joystickRaw.x = 0;
        controls._joystickRaw.y = 0;

        // Show joystick at touch position (floating)
        if (joystickBaseEl) {
          const size = 100; // joystickBase width/height
          joystickBaseEl.style.left   = (tx - size/2) + 'px';
          joystickBaseEl.style.top    = (ty - size/2) + 'px';
          joystickBaseEl.style.bottom = 'auto';
          joystickBaseEl.style.display = 'flex';
          joystickThumbEl.style.transform = 'translate(-50%, -50%)';
        }
      }
    } else {
      // Right zone — look drag
      if (controls._lookTouchId === null) {
        controls._lookTouchId = touch.identifier;
        controls._lookLastX = tx;
        controls._lookLastY = ty;
      }
    }
  }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (e.target.closest('button, a, input, select')) return;
  e.preventDefault();
  for (const touch of e.changedTouches) {
    if (touch.identifier === controls._joystickTouchId) {
      // Update joystick
      const dx = touch.clientX - controls._joystickOrigin.x;
      const dy = touch.clientY - controls._joystickOrigin.y;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > JOY_RADIUS) {
        controls._joystickRaw.x = (dx / len) * JOY_RADIUS;
        controls._joystickRaw.y = (dy / len) * JOY_RADIUS;
      } else {
        controls._joystickRaw.x = dx;
        controls._joystickRaw.y = dy;
      }
      // Update thumb visual — offset from center of base
      if (joystickThumbEl) {
        const clampX = controls._joystickRaw.x;
        const clampY = controls._joystickRaw.y;
        joystickThumbEl.style.transform = `translate(calc(-50% + ${clampX}px), calc(-50% + ${clampY}px))`;
      }
    } else if (touch.identifier === controls._lookTouchId) {
      const dx = touch.clientX - controls._lookLastX;
      const dy = touch.clientY - controls._lookLastY;
      controls._lookDeltaAccum.x += dx;
      controls._lookDeltaAccum.y += dy;
      controls._lookLastX = touch.clientX;
      controls._lookLastY = touch.clientY;
    }
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  for (const touch of e.changedTouches) {
    if (touch.identifier === controls._joystickTouchId) {
      controls._joystickActive = false;
      controls._joystickTouchId = null;
      controls._joystickRaw.x = 0;
      controls._joystickRaw.y = 0;
      if (joystickBaseEl) joystickBaseEl.style.display = 'none';
    } else if (touch.identifier === controls._lookTouchId) {
      controls._lookTouchId = null;
    }
  }
});

document.addEventListener('touchcancel', (e) => {
  for (const touch of e.changedTouches) {
    if (touch.identifier === controls._joystickTouchId) {
      controls._joystickActive = false;
      controls._joystickTouchId = null;
      controls._joystickRaw.x = 0;
      controls._joystickRaw.y = 0;
      if (joystickBaseEl) joystickBaseEl.style.display = 'none';
    } else if (touch.identifier === controls._lookTouchId) {
      controls._lookTouchId = null;
    }
  }
});
