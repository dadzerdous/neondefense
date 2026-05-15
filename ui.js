// ─── UI.JS ────────────────────────────────────────────────────────────────────
// All HTML UI: HUD updates, skill drawer, quests, menus.

import {
  TURRET_SKILLS, PILOT_SKILLS, TURRET_STAT_DEFS, QUEST_DEFS,
  TYPES, BRANCH_SKILLS,
} from './constants.js';
import { run, combat, input, session } from './state.js';
import {
  getNextPilotXP, getNextTurretXP,
  isSkillAvailable, unlockSkill as metaUnlockSkill,
  spendStatPoint as metaSpendStatPoint,
  getStatCost, getQuestProgress, saveMeta,
} from './meta.js';

// ── Quest toast system ────────────────────────────────────────────────────────
// Shows brief quest progress flashes in the top-right corner.
// Throttled — only fires every 50 progress units to avoid spam.
const toastQueue  = [];
let   toastActive = false;
const TOAST_INTERVAL = 50; // show toast every N progress units

export function checkQuestToast(meta, type, statKey, newTotal) {
  const defs = QUEST_DEFS[type] || [];
  defs.forEach(qd => {
    if (qd.statKey !== statKey) return;
    if (meta.quests?.[qd.id] === 'done') return;
    // Fire toast at every TOAST_INTERVAL multiple
    if (Math.floor(newTotal / TOAST_INTERVAL) > Math.floor((newTotal - 1) / TOAST_INTERVAL)) {
      const pct = Math.min(100, Math.round(newTotal / qd.target * 100));
      showQuestToast(qd.name, pct, newTotal, qd.target, TYPES[type]?.color || '#ffe600');
    }
  });
}

export function showQuestToast(name, pct, current, target, color) {
  toastQueue.push({ name, pct, current, target, color });
  if (!toastActive) drainToastQueue();
}

function drainToastQueue() {
  if (!toastQueue.length) { toastActive = false; return; }
  toastActive = true;
  const t = toastQueue.shift();
  renderToast(t);
  setTimeout(drainToastQueue, 3200);
}

function renderToast(t) {
  let el = document.getElementById('questToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'questToast';
    el.style.cssText = [
      'position:fixed', 'top:70px', 'right:12px',
      'width:200px', 'background:rgba(0,4,14,0.95)',
      'border-radius:8px', 'padding:10px 12px',
      'pointer-events:none', 'z-index:500',
      'transition:opacity 0.4s, transform 0.4s',
      'font-family:"Share Tech Mono",monospace',
    ].join(';');
    document.body.appendChild(el);
  }

  el.style.borderTop = '2px solid ' + t.color;
  el.style.boxShadow = '0 0 16px ' + t.color + '44';
  el.innerHTML = [
    '<div style="font-size:8px;letter-spacing:2px;opacity:0.4;margin-bottom:3px;">QUEST PROGRESS</div>',
    '<div style="font-size:11px;font-family:Orbitron,monospace;color:' + t.color + ';margin-bottom:6px;">' + t.name + '</div>',
    '<div style="display:flex;align-items:center;gap:6px;">',
      '<div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">',
        '<div style="width:' + t.pct + '%;height:100%;background:' + t.color + ';border-radius:2px;transition:width 0.4s;"></div>',
      '</div>',
      '<span style="font-size:9px;color:rgba(255,255,255,0.4);">' + t.current + '/' + t.target + '</span>',
    '</div>',
  ].join('');

  // Animate in
  el.style.opacity = '0';
  el.style.transform = 'translateX(20px)';
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  });

  // Fade out before next
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
  }, 2800);
}

// ── HUD ───────────────────────────────────────────────────────────────────────
export function updateHUD(meta) {
  setText('waveVal',    run.wave);
  setText('creditsVal', '$' + run.credits);
  setText('shieldsVal', run.shields + '%');
  setText('chainVal',   'x' + run.chainCount);
  setText('rankVal',    meta.pilotRank);

  setStyle('shieldFill', 'width', Math.max(0, run.shields) + '%');
  setStyle('heatFill',   'width', run.heat + '%');
  setStyle('heatFill',   'background', run.overheated ? 'var(--red)' : '');

  // Skill point badge
  const totalPts = (meta.skillPoints || 0) +
    Object.values(meta.turretStatPoints || {}).reduce((a,b) => a+b, 0) +
    Object.values(meta.turretSkillPoints || {}).reduce((a,b) => a+b, 0);
  const badge = document.getElementById('skillPtBadge');
  if (badge) {
    badge.style.display = totalPts > 0 ? 'block' : 'none';
    badge.textContent   = totalPts + ' PT' + (totalPts !== 1 ? 'S' : '') + ' AVAIL';
  }
}

export function updatePrepHUD(msg, isWarning, countdown) {
  const pt = document.getElementById('prepTimer');
  if (!pt) return;
  pt.style.opacity = '1';
  pt.style.color   = isWarning ? 'var(--red)' : 'var(--yellow)';
  pt.textContent   = msg;
}

export function hidePrepTimer() {
  const pt = document.getElementById('prepTimer');
  if (pt) pt.style.opacity = '0';
}

export function updateBossHP(pct) {
  const bar = document.getElementById('bossHpBar');
  const fill= document.getElementById('bossHpFill');
  if (bar)  bar.style.display = 'flex';
  if (fill) fill.style.width  = Math.max(0, pct) + '%';
}

export function hideBossHP() {
  const bar = document.getElementById('bossHpBar');
  if (bar) bar.style.display = 'none';
}

export function showWaveAnnounce(wave) {
  const el = document.getElementById('waveAnnounce');
  if (!el) return;
  const isBoss = wave % 5 === 0;
  el.textContent   = isBoss ? '!! BOSS WAVE ' + wave + ' !!' : 'WAVE ' + wave;
  el.style.color   = isBoss ? 'var(--red)' : 'var(--cyan)';
  el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 2500);
}

export function showGameOver(meta, wave) {
  setText('overlayTitle', 'DESTROYED');
  setStyle('overlayTitle', 'color', 'var(--red)');
  setText('overlaySub',   'YOUR BASE HAS FALLEN');
  setText('overlayStat',  'WAVE ' + wave + ' | BEST: WAVE ' + meta.highScore + ' | RANK: ' + meta.pilotRank);
  setText('overlayBtn',   'DEPLOY AGAIN');
  document.getElementById('overlay')?.classList.add('active');
}

export function hideGameOver() {
  document.getElementById('overlay')?.classList.remove('active');
}

// ── Skill drawer ──────────────────────────────────────────────────────────────
let currentTab = 'kinetic';
let skillPaused = false;

export function openSkillDrawer(meta) {
  skillPaused = true;
  session.skillPaused = true;
  document.getElementById('skillOverlay')?.classList.add('active');
  renderSkillTab(meta, currentTab);
  initDrawerSwipe(document.getElementById('skillOverlay'), () => closeSkillDrawer());
}

export function closeSkillDrawer() {
  skillPaused = false;
  session.skillPaused = false;
  document.getElementById('skillOverlay')?.classList.remove('active');
}

export function switchTab(meta, tab) {
  currentTab = tab;
  document.querySelectorAll('.skill-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderSkillTab(meta, tab);
}

export function renderSkillTab(meta, tab) {
  const grid    = document.getElementById('skillGrid');
  const xpLabel = document.getElementById('xpLabel');
  const xpFill  = document.getElementById('xpFill');
  if (!grid) return;
  grid.innerHTML = '';

  let skills, unlockedMap, xpCurrent, xpNext, color, skillPts;

  if (tab === 'pilot') {
    skills = PILOT_SKILLS; unlockedMap = meta.pilotSkills;
    xpCurrent = meta.pilotXP; xpNext = getNextPilotXP(meta);
    color = '#ffe600'; skillPts = meta.skillPoints || 0;
    if (xpLabel) xpLabel.textContent = 'PILOT RANK ' + meta.pilotRank + '  |  ' + skillPts + ' SKILL PT' + (skillPts!==1?'S':'') + ' AVAIL';
  } else {
    skills = TURRET_SKILLS[tab]; unlockedMap = meta.turretSkills[tab];
    xpCurrent = meta.turretXP[tab]; xpNext = getNextTurretXP(meta, tab);
    color = TYPES[tab].color;
    skillPts = meta.turretSkillPoints?.[tab] || 0;
    if (xpLabel) xpLabel.textContent = tab.toUpperCase() + ' RANK ' + meta.turretRank[tab] + '  |  ' + skillPts + ' SKILL PT' + (skillPts!==1?'S':'') + ' AVAIL';
  }

  if (xpFill) {
    xpFill.style.width      = Math.min(100, (xpCurrent / xpNext) * 100) + '%';
    xpFill.style.background = color;
    xpFill.style.boxShadow  = '0 0 8px ' + color;
  }

  // Skill nodes
  skills.forEach(skill => {
    const isUnlocked  = unlockedMap[skill.id];
    const available   = !isUnlocked && isSkillAvailable(meta, tab, skill.id);
    const questLocked = !isUnlocked && !available && !(!skill.req || unlockedMap[skill.req]);
    const reallyQuestLocked = !isUnlocked && isSkillAvailable === false; // branch not unlocked
    const canAfford   = skillPts >= 1;

    const node = document.createElement('div');
    node.className = 'skill-node ' + (isUnlocked ? 'unlocked' : available ? 'available' : 'locked');

    const costStr = isUnlocked  ? 'UNLOCKED'
      : available && canAfford  ? '1 SKILL PT'
      : available               ? 'NEED PT'
      : skill.branch && !isBranchUnlocked(meta, tab, skill.branch) ? 'QUEST LOCKED'
      : 'LOCKED';
    const costCol = isUnlocked ? '#00ff88' : (available && canAfford) ? '#ffe600' : 'rgba(255,255,255,0.2)';

    node.innerHTML =
      '<div class="skill-node-name" style="color:' + (isUnlocked ? '#00ff88' : color) + '">' + skill.name + '</div>' +
      '<div class="skill-node-desc">' + skill.desc + '</div>' +
      '<div class="skill-node-cost" style="color:' + costCol + '">' + costStr + '</div>';

    if (available && canAfford) {
      node.onclick = () => {
        if (metaUnlockSkill(meta, tab, skill.id)) { saveMeta(meta); renderSkillTab(meta, tab); }
      };
    }
    grid.appendChild(node);
  });

  // Stat tweaks (turret only)
  if (tab !== 'pilot' && TURRET_STAT_DEFS[tab]) {
    const statPts = meta.turretStatPoints?.[tab] || 0;
    appendSeparator(grid, 'STAT TWEAKS -- ' + statPts + ' PT' + (statPts!==1?'S':'') + ' AVAILABLE');

    TURRET_STAT_DEFS[tab].forEach(def => {
      const cur    = meta.turretStats?.[tab]?.[def.id] || 0;
      const cost   = getStatCost(cur);
      const canUp  = statPts >= cost && cur < def.max;
      const canDown= cur > 0;
      const pip    = Array.from({length:def.max},(_,i) =>
        '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
        (i<cur?color:'rgba(255,255,255,0.12)') + ';margin-right:2px;"></span>'
      ).join('');
      const badge  = def.unique ? '<span style="font-size:7px;background:rgba(255,200,0,0.12);color:#ffe600;padding:1px 4px;border-radius:3px;margin-left:4px;">UNIQUE</span>' : '';
      const row    = document.createElement('div');
      row.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,0.05);';
      row.innerHTML =
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:9px;font-family:Orbitron,monospace;color:' + color + ';">' + def.name + badge + '</div>' +
          '<div style="font-size:8px;color:rgba(255,255,255,0.3);margin-top:1px;">' + def.desc + '</div>' +
          '<div style="margin-top:4px;">' + pip + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:4px;">' +
          '<button class="stat-dn" style="width:22px;height:22px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:rgba(255,255,255,0.5);font-size:16px;cursor:pointer;padding:0;" ' + (canDown?'':'disabled') + '>-</button>' +
          '<span style="font-size:11px;font-family:Orbitron,monospace;color:' + color + ';min-width:16px;text-align:center;">' + cur + '</span>' +
          '<button class="stat-up" style="width:22px;height:22px;border-radius:4px;border:1px solid ' + (canUp?color:'rgba(255,255,255,0.15)') + ';background:transparent;color:' + (canUp?color:'rgba(255,255,255,0.25)') + ';font-size:16px;cursor:pointer;padding:0;" ' + (canUp?'':'disabled') + '>+</button>' +
        '</div>';
      row.querySelector('.stat-up').addEventListener('click', () => {
        if (metaSpendStatPoint(meta, tab, def.id, 1)) { saveMeta(meta); renderSkillTab(meta, tab); }
      });
      row.querySelector('.stat-dn').addEventListener('click', () => {
        if (metaSpendStatPoint(meta, tab, def.id, -1)) { saveMeta(meta); renderSkillTab(meta, tab); }
      });
      grid.appendChild(row);
    });
  }

  // Quests
  const questDefs = QUEST_DEFS[tab];
  if (questDefs?.length) {
    appendSeparator(grid, 'QUESTS -- UNLOCK BRANCHES');
    questDefs.forEach(qd => {
      const done = meta.quests?.[qd.id] === 'done';
      const prog = Math.min(getQuestProgress(meta, qd.id), qd.target);
      const pct  = Math.round(prog / qd.target * 100);
      const qRow = document.createElement('div');
      qRow.style.cssText = 'grid-column:1/-1;padding:8px;border-radius:6px;border:1px solid ' + (done?'rgba(0,255,136,0.3)':'rgba(255,255,255,0.08)') + ';margin-bottom:6px;background:' + (done?'rgba(0,255,136,0.04)':'transparent') + ';';
      qRow.innerHTML =
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
          '<span style="font-size:9px;font-family:Orbitron,monospace;color:' + (done?'#00ff88':color) + ';">' + qd.name + '</span>' +
          '<span style="font-size:8px;color:' + (done?'#00ff88':'#ffe600') + ';padding:1px 5px;border-radius:3px;">' + (done?'DONE':qd.rewardLabel) + '</span>' +
        '</div>' +
        '<div style="font-size:8px;color:rgba(255,255,255,0.35);margin-bottom:5px;">' + qd.desc + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<div style="flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">' +
            '<div style="width:' + pct + '%;height:100%;background:' + (done?'#00ff88':color) + ';border-radius:2px;"></div>' +
          '</div>' +
          '<span style="font-size:8px;color:rgba(255,255,255,0.3);">' + prog + '/' + qd.target + '</span>' +
        '</div>';
      grid.appendChild(qRow);
    });
  }
}

function isBranchUnlocked(meta, type, branch) {
  const questDefs = QUEST_DEFS[type] || [];
  const quest = questDefs.find(q => q.reward === branch);
  if (!quest) return true;
  return meta.quests?.[quest.id] === 'done';
}

function appendSeparator(grid, label) {
  const sep = document.createElement('div');
  sep.style.cssText = 'grid-column:1/-1;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;margin-top:4px;';
  sep.innerHTML = '<div style="font-size:9px;letter-spacing:3px;opacity:0.4;margin-bottom:8px;">' + label + '</div>';
  grid.appendChild(sep);
}

// ── Splash tab switching ──────────────────────────────────────────────────────
export function splashTab(tab) {
  ['play','skills','how'].forEach(t => {
    const panel = document.getElementById('panel' + t.charAt(0).toUpperCase() + t.slice(1));
    const btn   = document.getElementById('tab'   + t.charAt(0).toUpperCase() + t.slice(1));
    if (panel) panel.style.display = t === tab ? (t==='how'?'block':'flex') : 'none';
    if (btn)   { btn.style.background = t===tab?'var(--cyan)':'transparent'; btn.style.color=t===tab?'#000':'var(--cyan)'; }
  });
}

// ── Drawer swipe ──────────────────────────────────────────────────────────────
function initDrawerSwipe(el, onClose) {
  if (!el) return;
  const handle = document.getElementById('skillDragHandle');
  if (!handle) return;

  let startY = 0, currentY = 0, dragging = false;

  const onStart = e => {
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    dragging = true;
    el.style.transition = 'none';
  };
  const onMove = e => {
    if (!dragging) return;
    currentY = (e.touches ? e.touches[0].clientY : e.clientY) - startY;
    if (currentY > 0) el.style.transform = 'translateY(' + currentY + 'px)';
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    el.style.transition = '';
    if (currentY > 80) { el.style.transform = ''; onClose(); }
    else el.style.transform = '';
    currentY = 0;
  };

  const newHandle = handle.cloneNode(true);
  handle.parentNode.replaceChild(newHandle, handle);
  newHandle.addEventListener('touchstart', onStart, { passive:true });
  newHandle.addEventListener('touchmove',  onMove,  { passive:true });
  newHandle.addEventListener('touchend',   onEnd);
  newHandle.addEventListener('mousedown',  onStart);
  window.addEventListener('mousemove',     onMove);
  window.addEventListener('mouseup',       onEnd);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}
