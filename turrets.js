// ─── TURRETS.JS ───────────────────────────────────────────────────────────────
// Turret logic: buying, range, damage, firing.

import { TURRET_BASE_RANGE, TURRET_SKILLS, TYPES } from './constants.js';
import { hasTurretSkill, hasPilotSkill, getTurretStat, gainTurretXP, trackQuest, saveMeta } from './meta.js';
import { run, board, combat, screen } from './state.js';
import { SLOT_W, SLOT_GAP, RAIL_W, RAIL_GAP, BTN_ZONE, HNG_ZONE, RAIL_ZONE, PANEL_H, VISIBLE_HANGAR } from './constants.js';
import { spawnParticles } from './effects.js';

// ── Layout helpers ────────────────────────────────────────────────────────────
export function getPanelTop() { return screen.H - PANEL_H; }

export function getRailCount(meta) { return hasPilotSkill(meta, 'pr8') ? 4 : 3; }
export function getHangarCount(meta) { return hasPilotSkill(meta, 'pr9') ? 12 : 10; }
export function getMaxLevel(meta) { return hasPilotSkill(meta, 'pr7') ? 4 : 3; }

export function getRailPos(i, railCount) {
  const total = railCount * (RAIL_W + RAIL_GAP) - RAIL_GAP;
  // Sit turrets ABOVE the panel line, in the play area
  const y = getPanelTop() - RAIL_W - 14;
  return { x: screen.W/2 - total/2 + i*(RAIL_W + RAIL_GAP), y };
}

export function getSlotPos(vi) {
  const total = VISIBLE_HANGAR * (SLOT_W + SLOT_GAP) - SLOT_GAP;
  const baseY = screen.H - BTN_ZONE - HNG_ZONE + 10;
  return { x: screen.W/2 - total/2 + vi*(SLOT_W + SLOT_GAP), y: baseY };
}

// ── Range ─────────────────────────────────────────────────────────────────────
export function getTurretRange(meta, slot) {
  const base      = TURRET_BASE_RANGE[slot.type] || 300;
  const rankBonus = (meta.turretRank[slot.type] - 1) * 20;
  const lvlBonus  = slot.level * 15;
  const ks        = meta.turretSkills.kinetic || {};
  const skillBonus = slot.type === 'kinetic'
    ? (ks['k7'] ? 60 : 0) + (ks['k8'] ? 80 : 0) + (ks['k9'] ? 120 : 0)
    : 0;
  const statBonus = getTurretStat(meta, slot.type, 'aoe') * 8; // only meaningful for plasma range display
  return base + rankBonus + lvlBonus + skillBonus;
}

// ── AOE radius ────────────────────────────────────────────────────────────────
export function getPlasmaAoeRadius(meta) {
  const ps = meta.turretSkills.plasma || {};
  let r = 0;
  if (ps['p1']) r += 25;
  if (ps['p2']) r += 35;
  if (ps['p3']) r += 50;
  r += getTurretStat(meta, 'plasma', 'aoe') * 8;
  return r;
}

// ── Penetration / resonance / volatility ─────────────────────────────────────
export function getPenetrationChance(meta) {
  return getTurretStat(meta, 'kinetic', 'penetration') * 0.12;
}
export function getResonanceDuration(meta) {
  return getTurretStat(meta, 'energy', 'resonance') * 30;
}
export function getVolatilityChance(meta) {
  return getTurretStat(meta, 'plasma', 'volatility') * 0.12;
}

// ── Buy cost ──────────────────────────────────────────────────────────────────
export function getTurretBuyCost(meta, type) {
  const base = { kinetic:15, energy:20, plasma:25 }[type] || 15;
  const disc = hasPilotSkill(meta, 'pr6') ? 0.9 : 1;
  return Math.floor(base * disc);
}

// ── Buy (random type, weighted) ───────────────────────────────────────────────
export function buyTurret(meta) {
  const cost = 15; // flat cost for random draw
  if (run.credits < cost) return null;
  const idx = board.hangar.findIndex(s => s === null);
  if (idx === -1) return null;
  run.credits -= cost;

  const weights = {
    kinetic: 1 + ((meta.turretSkillPoints?.kinetic || 0) > 0 ? 0.3 : 0),
    energy:  1 + ((meta.turretSkillPoints?.energy  || 0) > 0 ? 0.3 : 0),
    plasma:  1 + ((meta.turretSkillPoints?.plasma  || 0) > 0 ? 0.3 : 0),
  };
  const total = weights.kinetic + weights.energy + weights.plasma;
  let r = Math.random() * total;
  let type = 'kinetic';
  if ((r -= weights.kinetic) < 0) type = 'kinetic';
  else if ((r -= weights.energy) < 0) type = 'energy';
  else type = 'plasma';

  const turret = { type, level: 1, timer: 0 };
  board.hangar[idx] = turret;
  condenseHangar();

  // Quest tracking
  const events = trackQuest(meta, type, 'bought', 1);
  saveMeta(meta);
  return { turret, questEvents: events };
}

// ── Condense helpers ──────────────────────────────────────────────────────────
export function condenseRails() {
  const filled   = board.rails.filter(s => s !== null);
  const filledHp = board.rails.map((s,i) => s ? board.railHp[i] : null).filter(h => h !== null);
  for (let i = 0; i < board.rails.length; i++) {
    board.rails[i]  = filled[i]   || null;
    board.railHp[i] = filledHp[i] || null;
  }
}

export function condenseHangar() {
  const filled = board.hangar.filter(s => s !== null);
  for (let i = 0; i < board.hangar.length; i++) {
    board.hangar[i] = filled[i] || null;
  }
}

export function returnToHangar(item) {
  const idx = board.hangar.findIndex(s => s === null);
  if (idx !== -1) board.hangar[idx] = item;
  condenseHangar();
}

// ── Damage variance helpers ───────────────────────────────────────────────────
// Each shot rolls between min and max damage — like a d6 but scaled.
export function getDamageRange(meta, slot) {
  const rank     = meta.turretRank[slot.type] || 1;
  const statBonus= getTurretStat(meta, slot.type, 'dmg') * 0.15;
  const base     = slot.level * (1 + (rank - 1) * 0.15) + statBonus;
  // Variance: ±25% around base, floor rises with rank
  const variance = 0.25;
  const floor    = base * (1 - variance + (rank - 1) * 0.04); // floor rises with rank
  const ceil     = base * (1 + variance);
  return { min: Math.max(0.5, floor), max: ceil, base };
}

export function rollDamage(meta, slot) {
  const { min, max } = getDamageRange(meta, slot);
  return min + Math.random() * (max - min);
}

export function getCritChance(meta, type) {
  // Base 3% for all, +5% per crit stat level, kinetic k9 skill adds 15%
  const statCrit  = getTurretStat(meta, type, 'crit') * 0.05;
  const skillCrit = type === 'kinetic' && hasTurretSkill(meta, 'kinetic', 'k9') ? 0.15 : 0;
  return 0.03 + statCrit + skillCrit;
}

// ── Damage calculation ────────────────────────────────────────────────────────
export function calcDamage(meta, bullet, enemy) {
  // Roll damage variance
  let dmg = bullet.roll ?? bullet.power; // use pre-rolled value if available

  // Elemental matchup
  if (enemy.weakTo === bullet.type) dmg *= 1.6;
  if (enemy.armor  === bullet.type && !hasTurretSkill(meta, 'kinetic', 'k6')) dmg *= 0.5;

  // Type-specific skill bonuses
  if (bullet.type === 'energy'  && hasTurretSkill(meta, 'energy',  'e8')) dmg *= 1.3;
  if (bullet.type === 'plasma'  && hasTurretSkill(meta, 'plasma',  'p8')) dmg *= (1 + 0.25 * (run.wave / 5));

  // Universal crit — rolls at fire time (stored on bullet so same roll applies to pierce/AOE)
  if (bullet.crit) dmg *= 2;

  return dmg;
}

// ── Fire rate calc ────────────────────────────────────────────────────────────
export function getFireInterval(meta, slot) {
  const rank = meta.turretRank[slot.type] || 1;
  const b1   = hasTurretSkill(meta, slot.type, slot.type[0]+'1') ? 1.25 : 1;
  const b2   = hasTurretSkill(meta, slot.type, slot.type[0]+'4') ? 1.5  : 1;
  const stat = 1 + getTurretStat(meta, slot.type, 'fireRate') * 0.08;
  return Math.max(8, Math.floor((40 - slot.level * 5 - rank * 2) / (b1 * b2 * stat)));
}

// ── Fire a bullet ─────────────────────────────────────────────────────────────
export function fireBullet(meta, x, y, angle, speed, slot) {
  const hasSpeedSkill = hasTurretSkill(meta, slot.type, slot.type[0]+'7');
  const spd    = speed * (1 + (hasSpeedSkill ? 0.5 : 0));
  const roll   = rollDamage(meta, slot);
  const isCrit = Math.random() < getCritChance(meta, slot.type);
  combat.bullets.push({
    x, y,
    vx:    Math.cos(angle) * spd,
    vy:    Math.sin(angle) * spd,
    type:  slot.type,
    power: roll,
    roll,
    crit:  isCrit,
    pierce: hasTurretSkill(meta, slot.type, slot.type[0]+'2') ? 1 : 0,
    life:   130,
    fromRailIdx: slot.railIdx ?? -1,
  });
}

// ── Update all rail turrets ───────────────────────────────────────────────────
export function updateTurrets(meta) {
  const railCount = board.rails.length;
  board.rails.forEach((slot, i) => {
    if (!slot) return;
    slot.railIdx = i;
    slot.timer   = (slot.timer || 0) + 1;

    const interval = getFireInterval(meta, slot);
    if (slot.timer < interval) return;
    slot.timer = 0;

    gainTurretXP(meta, slot.type, 1);
    saveMeta(meta);

    const p       = getRailPos(i, railCount);
    const cx      = p.x + RAIL_W / 2;
    const cy      = p.y + RAIL_W / 2;
    const range   = getTurretRange(meta, slot);

    // Find closest enemy in range
    let target   = null, minDist = range;
    combat.enemies.forEach(en => {
      const d = Math.hypot(en.x - cx, en.y - cy);
      if (d < minDist) { minDist = d; target = en; }
    });
    if (!target && combat.boss && Math.hypot(combat.boss.x - cx, combat.boss.y - cy) < range) {
      target = combat.boss;
    }
    if (!target) return;

    const angle = Math.atan2(target.y - cy, target.x - cx);
    fireBullet(meta, cx, cy, angle, 12, slot);

    // Twin barrel
    if (hasTurretSkill(meta, slot.type, slot.type[0]+'5') && slot.type === 'kinetic') {
      fireBullet(meta, cx, cy, angle + 0.15, 12, slot);
    }
  });
}
