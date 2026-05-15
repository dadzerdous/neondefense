// ─── INPUT.JS ─────────────────────────────────────────────────────────────────
// All pointer and touch event handling.

import { SLOT_W, SLOT_GAP, RAIL_W, VISIBLE_HANGAR } from './constants.js';
import { run, board, input, screen } from './state.js';
import { TURRET_MAX_HP } from './state.js';
import { getRailPos, getSlotPos, getPanelTop, getMaxLevel, getTurretBuyCost, condenseRails, condenseHangar, returnToHangar } from './turrets.js';
import { spawnMergeEffect } from './effects.js';
import { gainTurretXP, saveMeta } from './meta.js';
import { TYPES } from './constants.js';

export function initInput(canvas, meta) {
  canvas.addEventListener('pointerdown', e => onDown(e, meta));
  canvas.addEventListener('pointermove', e => onMove(e, meta));
  canvas.addEventListener('pointerup',   e => onUp(e, meta));
}

function onDown(e, meta) {
  const x = e.clientX, y = e.clientY;
  const panelTop = getPanelTop();

  // Scroll arrows
  const arrowY  = screen.H - 50 - 70 + 10 + SLOT_W/2;
  const rowLeft  = getSlotPos(0).x;
  const rowRight = getSlotPos(VISIBLE_HANGAR-1).x + SLOT_W;
  if (Math.abs(y - arrowY) < 24) {
    if (Math.abs(x - (rowLeft - 12)) < 20) { scrollHangar(-1); return; }
    if (Math.abs(x - (rowRight + 18)) < 20) { scrollHangar(1); return; }
  }

  // Sell mode
  if (input.sellMode) {
    for (let vi = 0; vi < VISIBLE_HANGAR; vi++) {
      const ai = board.hangarPage + vi;
      if (!board.hangar[ai]) continue;
      const p = getSlotPos(vi);
      if (x > p.x && x < p.x+SLOT_W && y > p.y && y < p.y+SLOT_W) {
        run.credits += Math.floor(getTurretBuyCost(meta, board.hangar[ai].type) * 0.4 * board.hangar[ai].level);
        board.hangar[ai] = null;
      }
    }
    condenseHangar();
    board.rails.forEach((slot, i) => {
      if (!slot) return;
      const p = getRailPos(i, board.rails.length);
      if (x > p.x && x < p.x+RAIL_W && y > p.y && y < p.y+RAIL_W) {
        run.credits += Math.floor(getTurretBuyCost(meta, slot.type) * 0.4 * slot.level);
        board.rails[i] = null;
      }
    });
    condenseRails();
    return;
  }

  // Drag from hangar
  let picked = false;
  for (let vi = 0; vi < VISIBLE_HANGAR; vi++) {
    if (picked) break;
    const ai = board.hangarPage + vi;
    if (!board.hangar[ai]) continue;
    const p = getSlotPos(vi);
    if (x > p.x && x < p.x+SLOT_W && y > p.y && y < p.y+SLOT_W) {
      input.dragging      = board.hangar[ai];
      input.dragFromIdx   = ai;
      input.dragFromHangar= true;
      board.hangar[ai]    = null;
      condenseHangar();
      picked = true;
    }
  }

  // Drag from rail
  if (!picked) {
    board.rails.forEach((slot, i) => {
      if (picked || !slot) return;
      const p = getRailPos(i, board.rails.length);
      if (x > p.x && x < p.x+RAIL_W && y > p.y && y < p.y+RAIL_W) {
        input.dragging       = slot;
        input.dragFromIdx    = i;
        input.dragFromHangar = false;
        board.rails[i]       = null;
        condenseRails();
        picked = true;
      }
    });
  }

  // Beam
  if (!picked && y < panelTop) {
    input.beamActive = true;
    input.beamX = x;
    input.beamY = Math.min(y, panelTop - 2);
  }
  updateMouse(e);
}

function onMove(e, meta) {
  updateMouse(e);
  if (input.beamActive) {
    const panelTop = getPanelTop();
    input.beamX = e.clientX;
    input.beamY = Math.min(e.clientY, panelTop - 2);
  }

  input.hoveredSlot = null;
  if (!input.dragging) {
    for (let vi = 0; vi < VISIBLE_HANGAR; vi++) {
      const ai = board.hangarPage + vi;
      if (!board.hangar[ai]) continue;
      const p  = getSlotPos(vi);
      if (e.clientX > p.x && e.clientX < p.x+SLOT_W && e.clientY > p.y && e.clientY < p.y+SLOT_W) {
        input.hoveredSlot = { slot: board.hangar[ai], cx: p.x+SLOT_W/2, cy: p.y+SLOT_W/2 };
      }
    }
    board.rails.forEach((slot, i) => {
      if (!slot) return;
      const p = getRailPos(i, board.rails.length);
      if (e.clientX > p.x && e.clientX < p.x+RAIL_W && e.clientY > p.y && e.clientY < p.y+RAIL_W) {
        input.hoveredSlot = { slot, cx: p.x+RAIL_W/2, cy: p.y+RAIL_W/2 };
      }
    });
  }
}

function onUp(e, meta) {
  updateMouse(e);
  if (input.dragging) {
    let dropped = false;

    // Try drop on hangar
    for (let vi = 0; vi < VISIBLE_HANGAR; vi++) {
      if (dropped) break;
      const ai  = board.hangarPage + vi;
      const p   = getSlotPos(vi);
      if (input.mouseX > p.x && input.mouseX < p.x+SLOT_W && input.mouseY > p.y && input.mouseY < p.y+SLOT_W) {
        if (!board.hangar[ai]) {
          board.hangar[ai] = input.dragging; dropped = true;
        } else if (canMerge(meta, board.hangar[ai], input.dragging)) {
          board.hangar[ai].level++;
          gainTurretXP(meta, board.hangar[ai].type, 8); saveMeta(meta);
          dropped = true;
          spawnMergeEffect(p.x+SLOT_W/2, p.y+SLOT_W/2, TYPES[board.hangar[ai].type].color);
        }
      }
    }

    // Try drop on rail
    if (!dropped) {
      board.rails.forEach((slot, i) => {
        if (dropped) return;
        const p = getRailPos(i, board.rails.length);
        if (input.mouseX > p.x && input.mouseX < p.x+RAIL_W && input.mouseY > p.y && input.mouseY < p.y+RAIL_W) {
          if (!slot) {
            board.rails[i]  = input.dragging;
            board.railHp[i] = TURRET_MAX_HP[input.dragging.level] || 30;
            dropped = true;
          } else if (canMerge(meta, slot, input.dragging)) {
            slot.level++;
            gainTurretXP(meta, slot.type, 8); saveMeta(meta);
            board.rails[i] = slot; dropped = true;
            spawnMergeEffect(p.x+RAIL_W/2, p.y+RAIL_W/2, TYPES[slot.type].color);
          } else {
            const old = board.rails[i];
            board.rails[i] = input.dragging;
            returnToHangar(old);
            dropped = true;
            condenseRails();
          }
        }
      });
    }

    if (!dropped) returnToHangar(input.dragging);
    input.dragging    = null;
    input.selectedSlot = null;
  } else {
    // Tap to select
    let tapped = false;
    for (let vi = 0; vi < VISIBLE_HANGAR; vi++) {
      if (tapped) break;
      const ai = board.hangarPage + vi;
      if (!board.hangar[ai]) continue;
      const p = getSlotPos(vi);
      if (input.mouseX > p.x && input.mouseX < p.x+SLOT_W && input.mouseY > p.y && input.mouseY < p.y+SLOT_W) {
        input.selectedSlot = input.selectedSlot?.slot === board.hangar[ai] ? null : { slot: board.hangar[ai] };
        tapped = true;
      }
    }
    board.rails.forEach((slot, i) => {
      if (tapped || !slot) return;
      const p = getRailPos(i, board.rails.length);
      if (input.mouseX > p.x && input.mouseX < p.x+RAIL_W && input.mouseY > p.y && input.mouseY < p.y+RAIL_W) {
        input.selectedSlot = input.selectedSlot?.slot === slot ? null : { slot };
        tapped = true;
      }
    });
    if (!tapped) input.selectedSlot = null;
  }
  input.beamActive = false;
}

function canMerge(meta, a, b) {
  return a.level === b.level && a.type === b.type && a.level < getMaxLevel(meta);
}

function scrollHangar(dir) {
  const max = board.hangar.length - VISIBLE_HANGAR;
  board.hangarPage = Math.max(0, Math.min(max, board.hangarPage + dir));
}

function updateMouse(e) {
  input.mouseX = e.clientX;
  input.mouseY = e.clientY;
}
