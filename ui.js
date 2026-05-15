// ─── UI.JS ────────────────────────────────────────────────────────────────────
// HUD, skill drawer with cycle arrows + sub-tabs, quest toasts, menus.

import {
  TURRET_SKILLS, PILOT_SKILLS, TURRET_STAT_DEFS, QUEST_CHAINS, QUEST_DEFS,
  TYPES, BRANCH_SKILLS,
} from './constants.js';
import { run, combat, input, session } from './state.js';
import {
  getNextPilotXP, getNextTurretXP,
  isSkillAvailable, unlockSkill as metaUnlockSkill,
  spendStatPoint as metaSpendStatPoint,
  getStatCost, getQuestProgress, saveMeta,
} from './meta.js';

// ── Quest toast ───────────────────────────────────────────────────────────────
const toastQueue = []; let toastActive = false;
const TOAST_INTERVAL = 50;

export function checkQuestToast(meta, type, statKey, newTotal) {
  const chains = QUEST_CHAINS[type] || [];
  chains.forEach(chain => {
    if (chain.statKey !== statKey) return;
    chain.tiers.forEach((tier, ti) => {
      const tierKey = chain.id + '_t' + ti;
      if (meta.quests?.[tierKey] === 'done') return;
      if (newTotal > 0 && Math.floor(newTotal / TOAST_INTERVAL) > Math.floor((newTotal - 1) / TOAST_INTERVAL)) {
        const pct = Math.min(100, Math.round(newTotal / tier.target * 100));
        showQuestToast(chain.name + ' T' + (ti+1), pct, newTotal, tier.target, TYPES[type]?.color || '#ffe600');
      }
    });
  });
}

export function showQuestToast(name, pct, current, target, color) {
  toastQueue.push({ name, pct, current, target, color });
  if (!toastActive) drainToastQueue();
}

function drainToastQueue() {
  if (!toastQueue.length) { toastActive = false; return; }
  toastActive = true;
  renderToast(toastQueue.shift());
  setTimeout(drainToastQueue, 3200);
}

function renderToast(t) {
  let el = document.getElementById('questToast');
  if (!el) {
    el = document.createElement('div'); el.id = 'questToast';
    el.style.cssText = 'position:fixed;top:70px;right:12px;width:200px;background:rgba(0,4,14,0.95);border-radius:8px;padding:10px 12px;pointer-events:none;z-index:500;transition:opacity 0.4s,transform 0.4s;font-family:"Share Tech Mono",monospace;';
    document.body.appendChild(el);
  }
  el.style.borderTop = '2px solid ' + t.color; el.style.boxShadow = '0 0 16px ' + t.color + '44';
  el.innerHTML = '<div style="font-size:8px;letter-spacing:2px;opacity:0.4;margin-bottom:3px;">QUEST PROGRESS</div>' +
    '<div style="font-size:11px;font-family:Orbitron,monospace;color:' + t.color + ';margin-bottom:6px;">' + t.name + '</div>' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
      '<div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">' +
        '<div style="width:' + t.pct + '%;height:100%;background:' + t.color + ';border-radius:2px;"></div>' +
      '</div>' +
      '<span style="font-size:9px;color:rgba(255,255,255,0.4);">' + Math.min(t.current, t.target) + '/' + t.target + '</span>' +
    '</div>';
  el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; }, 2800);
}

// ── HUD ───────────────────────────────────────────────────────────────────────
export function updateHUD(meta) {
  setText('waveVal', run.wave); setText('creditsVal', '$' + run.credits);
  setText('shieldsVal', run.shields + '%'); setText('chainVal', 'x' + run.chainCount);
  setText('rankVal', meta.pilotRank);
  setStyle('shieldFill', 'width', Math.max(0, run.shields) + '%');
  setStyle('heatFill', 'width', run.heat + '%');
  setStyle('heatFill', 'background', run.overheated ? 'var(--red)' : '');
  const totalPts = (meta.skillPoints || 0) +
    Object.values(meta.turretStatPoints  || {}).reduce((a,b) => a+b, 0) +
    Object.values(meta.turretSkillPoints || {}).reduce((a,b) => a+b, 0);
  const badge = document.getElementById('skillPtBadge');
  if (badge) { badge.style.display = totalPts > 0 ? 'block' : 'none'; badge.textContent = totalPts + ' PT' + (totalPts!==1?'S':'') + ' AVAIL'; }
}
export function updatePrepHUD(msg, isWarning) {
  const pt = document.getElementById('prepTimer'); if (!pt) return;
  pt.style.opacity = '1'; pt.style.color = isWarning ? 'var(--red)' : 'var(--yellow)'; pt.textContent = msg;
}
export function hidePrepTimer() { const pt=document.getElementById('prepTimer'); if(pt) pt.style.opacity='0'; }
export function updateBossHP(pct) { const b=document.getElementById('bossHpBar'),f=document.getElementById('bossHpFill'); if(b)b.style.display='flex'; if(f)f.style.width=Math.max(0,pct)+'%'; }
export function hideBossHP() { const b=document.getElementById('bossHpBar'); if(b)b.style.display='none'; }
export function showWaveAnnounce(wave) {
  const el = document.getElementById('waveAnnounce'); if (!el) return;
  const isBoss = wave % 5 === 0;
  el.textContent = isBoss ? '!! BOSS WAVE ' + wave + ' !!' : 'WAVE ' + wave;
  el.style.color = isBoss ? 'var(--red)' : 'var(--cyan)'; el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 2500);
}
export function showGameOver(meta, wave) {
  setText('overlayTitle','DESTROYED'); setStyle('overlayTitle','color','var(--red)');
  setText('overlaySub','YOUR BASE HAS FALLEN');
  setText('overlayStat','WAVE '+wave+' | BEST: WAVE '+meta.highScore+' | RANK: '+meta.pilotRank);
  setText('overlayBtn','DEPLOY AGAIN');
  document.getElementById('overlay')?.classList.add('active');
}
export function hideGameOver() { document.getElementById('overlay')?.classList.remove('active'); }

// ── Skill drawer state ────────────────────────────────────────────────────────
const TURRET_TYPES = ['kinetic','energy','plasma'];
let currentType   = 'kinetic';
let currentSubTab = 'stats';
let isPilot       = false;

export function openSkillDrawer(meta) {
  session.skillPaused = true;
  document.getElementById('skillOverlay')?.classList.add('active');
  renderDrawer(meta);
  initDrawerSwipe(document.getElementById('skillOverlay'), closeSkillDrawer);
}
export function closeSkillDrawer() {
  session.skillPaused = false;
  document.getElementById('skillOverlay')?.classList.remove('active');
}
export function renderSkillTab(meta, tab) {
  if (TURRET_TYPES.includes(tab)) { currentType = tab; isPilot = false; }
  else if (tab === 'pilot') { isPilot = true; }
  renderDrawer(meta);
}
export function switchTab(meta, tab) { renderSkillTab(meta, tab); }

// ── Main drawer renderer ──────────────────────────────────────────────────────
export function renderDrawer(meta) {
  const el = document.getElementById('skillGrid'); if (!el) return;
  el.innerHTML = '';
  renderDrawerHeader(el, meta);
  if (isPilot) { renderPilotSection(el, meta); return; }
  if (currentSubTab === 'stats')  renderStatsSection(el, meta, currentType);
  if (currentSubTab === 'skills') renderSkillsSection(el, meta, currentType);
  if (currentSubTab === 'quests') renderQuestsSection(el, meta, currentType);
}

// ── Header: cycle arrows + XP bar + sub-tabs ─────────────────────────────────
function renderDrawerHeader(container, meta) {
  const color    = isPilot ? '#ffe600' : TYPES[currentType].color;
  const typeRank = isPilot ? meta.pilotRank : meta.turretRank[currentType];
  const xpCur    = isPilot ? meta.pilotXP   : meta.turretXP[currentType];
  const xpNext   = isPilot ? getNextPilotXP(meta) : getNextTurretXP(meta, currentType);
  const skillPts = isPilot ? (meta.skillPoints||0) : (meta.turretSkillPoints?.[currentType]||0);
  const statPts  = isPilot ? 0 : (meta.turretStatPoints?.[currentType]||0);
  const label    = isPilot ? 'PILOT' : currentType.toUpperCase();

  const canLeft  = !isPilot && TURRET_TYPES.indexOf(currentType) > 0;
  const canRight = !(isPilot);

  // Type row
  const typeRow = el('div','display:flex;align-items:center;justify-content:space-between;padding:0 4px 8px;');
  typeRow.appendChild(arrowBtn('<', canLeft, () => {
    const i = TURRET_TYPES.indexOf(currentType);
    if (i > 0) { currentType = TURRET_TYPES[i-1]; isPilot=false; renderDrawer(meta); }
  }));

  const mid = el('div','flex:1;text-align:center;');
  mid.innerHTML =
    '<div style="font-family:Orbitron,monospace;font-size:14px;font-weight:900;color:'+color+';letter-spacing:2px;">'+label+'</div>' +
    '<div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:2px;">RANK '+typeRank+
      (skillPts>0?' &nbsp;&bull;&nbsp; <span style="color:#ffe600">'+skillPts+' SKILL PT</span>':'')+
      (statPts>0?' &nbsp;&bull;&nbsp; <span style="color:#ffe600">'+statPts+' STAT PT</span>':'')+
    '</div>';
  typeRow.appendChild(mid);

  typeRow.appendChild(arrowBtn('>', canRight, () => {
    const i = TURRET_TYPES.indexOf(currentType);
    if (!isPilot && i < TURRET_TYPES.length-1) { currentType = TURRET_TYPES[i+1]; renderDrawer(meta); }
    else if (!isPilot) { isPilot=true; renderDrawer(meta); }
  }));

  container.appendChild(typeRow);

  // XP bar
  const xpPct = Math.min(100, Math.round(xpCur/xpNext*100));
  const xpBar = el('div','margin:0 4px 8px;');
  xpBar.innerHTML =
    '<div style="display:flex;justify-content:space-between;font-size:8px;color:rgba(255,255,255,0.25);margin-bottom:3px;"><span>XP</span><span>'+xpCur+' / '+xpNext+'</span></div>' +
    '<div style="height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">' +
      '<div style="width:'+xpPct+'%;height:100%;background:'+color+';border-radius:2px;transition:width 0.4s;"></div>' +
    '</div>';
  container.appendChild(xpBar);

  // Sub-tabs (turret only)
  if (!isPilot) {
    const tabs = el('div','display:flex;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:6px;');
    ['stats','skills','quests'].forEach(st => {
      const active = currentSubTab === st;
      const t = el('button',
        'flex:1;padding:8px 0;border:none;background:'+(active?'rgba(255,255,255,0.05)':'transparent')+
        ';border-bottom:2px solid '+(active?color:'transparent')+
        ';color:'+(active?color:'rgba(255,255,255,0.3)')+
        ';font-family:Orbitron,monospace;font-size:9px;letter-spacing:1px;cursor:pointer;');
      t.textContent = st.toUpperCase();
      t.addEventListener('click', () => { currentSubTab = st; renderDrawer(meta); });
      tabs.appendChild(t);
    });
    container.appendChild(tabs);
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStatsSection(container, meta, type) {
  const defs  = TURRET_STAT_DEFS[type] || [];
  const color = TYPES[type].color;
  const pts   = meta.turretStatPoints?.[type] || 0;

  ptsLabel(container, pts, 'STAT');

  defs.forEach(def => {
    const cur   = meta.turretStats?.[type]?.[def.id] || 0;
    const cost  = getStatCost(cur);
    const canUp = pts >= cost && cur < def.max;
    const canDn = cur > 0;
    const pip   = Array.from({length:def.max},(_,i)=>
      '<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:'+
      (i<cur?color:'rgba(255,255,255,0.1)')+';margin-right:3px;"></span>'
    ).join('');
    const badge = def.unique ? '<span style="font-size:7px;background:rgba(255,200,0,0.12);color:#ffe600;padding:1px 5px;border-radius:3px;margin-left:5px;">UNIQUE</span>' : '';
    const row = el('div','grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,0.05);');
    row.innerHTML =
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:10px;font-family:Orbitron,monospace;color:'+color+';">'+def.name+badge+'</div>' +
        '<div style="font-size:8px;color:rgba(255,255,255,0.3);margin:3px 0;">'+def.desc+'</div>' +
        '<div>'+pip+'</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
        '<button class="sdn" style="'+sbtnSt(canDn,'#ff4466')+'">-</button>' +
        '<span style="font-size:12px;font-family:Orbitron,monospace;color:'+color+';min-width:18px;text-align:center;">'+cur+'</span>' +
        '<button class="sup" style="'+sbtnSt(canUp,color)+'">'+(canUp?'+':cur>=def.max?'MAX':cost+'pt')+'</button>' +
      '</div>';
    row.querySelector('.sup').addEventListener('click', () => { if(metaSpendStatPoint(meta,type,def.id,1)){saveMeta(meta);renderDrawer(meta);} });
    row.querySelector('.sdn').addEventListener('click', () => { if(metaSpendStatPoint(meta,type,def.id,-1)){saveMeta(meta);renderDrawer(meta);} });
    container.appendChild(row);
  });
}

// ── Skills ────────────────────────────────────────────────────────────────────
function renderSkillsSection(container, meta, type) {
  const skills   = TURRET_SKILLS[type] || [];
  const unlocked = meta.turretSkills[type] || {};
  const color    = TYPES[type].color;
  const pts      = meta.turretSkillPoints?.[type] || 0;

  ptsLabel(container, pts, 'SKILL');

  const branches = {};
  skills.forEach(s => { const b = s.branch||'core'; if(!branches[b])branches[b]=[]; branches[b].push(s); });

  Object.entries(branches).forEach(([branch, bSkills]) => {
    const bUnlocked = isBranchQuestDone(meta, type, branch);
    const bh = el('div','grid-column:1/-1;font-size:8px;letter-spacing:3px;color:'+(bUnlocked?'rgba(255,255,255,0.3)':'#ff4466')+';padding:6px 0 4px;border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;');
    bh.textContent = branch.toUpperCase() + (bUnlocked ? '' : ' — COMPLETE QUEST TO UNLOCK');
    container.appendChild(bh);

    bSkills.forEach(skill => {
      const isUnlocked = unlocked[skill.id];
      const available  = !isUnlocked && isSkillAvailable(meta, type, skill.id) && bUnlocked;
      const canAfford  = pts >= 1;
      const statusCol  = isUnlocked ? '#00ff88' : available && canAfford ? '#ffe600' : 'rgba(255,255,255,0.2)';
      const statusTxt  = isUnlocked ? 'UNLOCKED' : available && canAfford ? '1 PT' : !bUnlocked ? 'QUEST LOCKED' : skill.req && !unlocked[skill.req] ? 'PREREQ' : 'NEED PT';

      const node = el('div','grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:5px;border:1px solid '+
        (isUnlocked?'rgba(0,255,136,0.2)':available?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.04)')+
        ';background:'+(isUnlocked?'rgba(0,255,136,0.04)':'transparent')+';margin-bottom:4px;cursor:'+(available&&canAfford?'pointer':'default')+';');
      node.innerHTML =
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:10px;font-family:Orbitron,monospace;color:'+(isUnlocked?'#00ff88':bUnlocked?color:'rgba(255,255,255,0.2)')+';">'+skill.name+'</div>' +
          '<div style="font-size:8px;color:rgba(255,255,255,0.3);margin-top:2px;">'+skill.desc+'</div>' +
        '</div>' +
        '<span style="font-size:8px;color:'+statusCol+';white-space:nowrap;">'+statusTxt+'</span>';
      if (available && canAfford) node.addEventListener('click', () => { if(metaUnlockSkill(meta,type,skill.id)){saveMeta(meta);renderDrawer(meta);} });
      container.appendChild(node);
    });
  });
}

// ── Quests ────────────────────────────────────────────────────────────────────
function renderQuestsSection(container, meta, type) {
  const chains = QUEST_CHAINS[type] || [];
  const color  = TYPES[type]?.color || '#ffe600';

  if (!chains.length) {
    const e = el('div','grid-column:1/-1;text-align:center;color:rgba(255,255,255,0.2);padding:24px;');
    e.textContent = 'No quests yet.'; container.appendChild(e); return;
  }

  chains.forEach(chain => {
    const chainWrap = el('div','grid-column:1/-1;margin-bottom:14px;');
    chainWrap.innerHTML =
      '<div style="font-family:Orbitron,monospace;font-size:10px;color:'+color+';margin-bottom:6px;letter-spacing:1px;">' +
        chain.name +
        '<span style="font-size:8px;color:rgba(255,255,255,0.3);margin-left:8px;">Unlocks: '+chain.rewardLabel+'</span>' +
      '</div>';

    chain.tiers.forEach((tier, ti) => {
      const tierKey  = chain.id + '_t' + ti;
      const legKey   = chain.id;
      const done     = meta.quests?.[tierKey]==='done' || (ti===0 && meta.quests?.[legKey]==='done');
      const prevDone = ti===0 || meta.quests?.[chain.id+'_t'+(ti-1)]==='done' || (ti===1 && meta.quests?.[legKey]==='done');
      const active   = !done && prevDone;
      const prog     = done ? tier.target : active ? (getQuestProgress(meta,tierKey)||getQuestProgress(meta,legKey)||0) : 0;
      const pct      = Math.min(100, Math.round(prog/tier.target*100));
      const tierColor= done?'#00ff88':active?color:'rgba(255,255,255,0.25)';

      const tierEl = el('div',
        'padding:8px 10px;border-radius:5px;border:1px solid '+
        (done?'rgba(0,255,136,0.2)':active?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.03)')+
        ';background:'+(done?'rgba(0,255,136,0.04)':'transparent')+
        ';margin-bottom:5px;opacity:'+(active||done?'1':'0.3')+';');

      tierEl.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
          '<span style="font-size:8px;font-family:Orbitron,monospace;color:'+tierColor+';">TIER '+(ti+1)+'</span>' +
          '<span style="font-size:8px;color:'+(done?'#00ff88':'#ffe600')+';padding:1px 6px;border-radius:3px;background:rgba(255,255,255,0.04);">'+(done?'COMPLETE':tier.bonusDesc)+'</span>' +
        '</div>' +
        '<div style="font-size:9px;color:rgba(255,255,255,'+(active?'0.5':'0.2')+');margin-bottom:'+(active||done?'6':'0')+'px;">'+tier.desc+'</div>' +
        (active||done ?
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<div style="flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">' +
              '<div style="width:'+pct+'%;height:100%;background:'+(done?'#00ff88':color)+';border-radius:2px;"></div>' +
            '</div>' +
            '<span style="font-size:8px;color:rgba(255,255,255,0.3);">'+Math.min(prog,tier.target)+'/'+tier.target+'</span>' +
          '</div>' : '');
      chainWrap.appendChild(tierEl);
    });
    container.appendChild(chainWrap);
  });
}

// ── Pilot section ─────────────────────────────────────────────────────────────
function renderPilotSection(container, meta) {
  const color = '#ffe600';
  const pts   = meta.skillPoints || 0;
  ptsLabel(container, pts, 'SKILL');

  const branches = {};
  PILOT_SKILLS.forEach(s => { const b=s.branch||'core'; if(!branches[b])branches[b]=[]; branches[b].push(s); });

  Object.entries(branches).forEach(([branch, bSkills]) => {
    const bUnlocked = isBranchQuestDone(meta,'pilot',branch);
    const bh = el('div','grid-column:1/-1;font-size:8px;letter-spacing:3px;color:'+(bUnlocked?'rgba(255,255,255,0.3)':'#ff4466')+';padding:6px 0 4px;border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;');
    bh.textContent = branch.toUpperCase() + (bUnlocked?'':' — QUEST LOCKED');
    container.appendChild(bh);

    bSkills.forEach(skill => {
      const isUnlocked = meta.pilotSkills?.[skill.id];
      const available  = !isUnlocked && (!skill.req || meta.pilotSkills?.[skill.req]) && bUnlocked;
      const canAfford  = pts >= 1;
      const statusCol  = isUnlocked?'#00ff88':available&&canAfford?'#ffe600':'rgba(255,255,255,0.2)';
      const statusTxt  = isUnlocked?'UNLOCKED':available&&canAfford?'1 PT':!bUnlocked?'QUEST LOCKED':skill.req&&!meta.pilotSkills?.[skill.req]?'PREREQ':'NEED PT';

      const node = el('div','grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:5px;border:1px solid '+
        (isUnlocked?'rgba(255,230,0,0.18)':available?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.04)')+
        ';background:'+(isUnlocked?'rgba(255,230,0,0.04)':'transparent')+';margin-bottom:4px;cursor:'+(available&&canAfford?'pointer':'default')+';');
      node.innerHTML =
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:10px;font-family:Orbitron,monospace;color:'+(isUnlocked?'#00ff88':bUnlocked?color:'rgba(255,255,255,0.2)')+';">'+skill.name+'</div>' +
          '<div style="font-size:8px;color:rgba(255,255,255,0.3);margin-top:2px;">'+skill.desc+'</div>' +
        '</div>' +
        '<span style="font-size:8px;color:'+statusCol+';white-space:nowrap;">'+statusTxt+'</span>';
      if (available && canAfford) node.addEventListener('click', () => { if(metaUnlockSkill(meta,'pilot',skill.id)){saveMeta(meta);renderDrawer(meta);} });
      container.appendChild(node);
    });
  });

  // Pilot quests
  const qh = el('div','grid-column:1/-1;font-size:8px;letter-spacing:3px;color:rgba(255,255,255,0.3);padding:10px 0 6px;border-top:1px solid rgba(255,255,255,0.06);margin-top:6px;');
  qh.textContent = 'PILOT QUESTS';
  container.appendChild(qh);
  renderQuestsSection(container, meta, 'pilot');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isBranchQuestDone(meta, type, branch) {
  if (branch === 'core') return true;
  const chains = QUEST_CHAINS[type] || [];
  const chain  = chains.find(c => c.reward === branch);
  if (!chain) return true;
  return meta.quests?.[chain.id+'_t0']==='done' || meta.quests?.[chain.id]==='done';
}

function ptsLabel(container, pts, kind) {
  const d = el('div','grid-column:1/-1;font-size:9px;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:8px;text-align:center;');
  d.textContent = pts + ' ' + kind + ' POINT' + (pts!==1?'S':'') + ' AVAILABLE';
  container.appendChild(d);
}

function arrowBtn(label, enabled, onClick) {
  const b = el('button','width:28px;height:28px;border-radius:50%;border:1px solid '+(enabled?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.08)')+';background:transparent;color:'+(enabled?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.15)')+';font-size:14px;cursor:'+(enabled?'pointer':'default')+';flex-shrink:0;');
  b.textContent = label;
  if (enabled) b.addEventListener('click', onClick);
  return b;
}

function sbtnSt(enabled, color) {
  return 'width:28px;height:28px;border-radius:4px;border:1px solid '+(enabled?color:'rgba(255,255,255,0.1)')+';background:transparent;color:'+(enabled?color:'rgba(255,255,255,0.2)')+';font-size:14px;cursor:'+(enabled?'pointer':'default')+';padding:0;';
}

function el(tag, css) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  return e;
}

// ── Splash ────────────────────────────────────────────────────────────────────
export function splashTab(tab) {
  ['play','skills','how'].forEach(t => {
    const panel = document.getElementById('panel'+t[0].toUpperCase()+t.slice(1));
    const b     = document.getElementById('tab'+t[0].toUpperCase()+t.slice(1));
    if (panel) panel.style.display = t===tab?(t==='how'?'block':'flex'):'none';
    if (b) { b.style.background=t===tab?'var(--cyan)':'transparent'; b.style.color=t===tab?'#000':'var(--cyan)'; }
  });
}

// ── Drawer swipe ──────────────────────────────────────────────────────────────
function initDrawerSwipe(el, onClose) {
  if (!el) return;
  const handle = document.getElementById('skillDragHandle'); if (!handle) return;
  let sy=0,cy=0,drag=false;
  const start = e => { sy=(e.touches?e.touches[0]:e).clientY; drag=true; el.style.transition='none'; };
  const move  = e => { if(!drag)return; cy=(e.touches?e.touches[0]:e).clientY-sy; if(cy>0)el.style.transform='translateY('+cy+'px)'; };
  const end   = () => { if(!drag)return; drag=false; el.style.transition=''; if(cy>80){el.style.transform='';onClose();}else el.style.transform=''; cy=0; };
  const nh = handle.cloneNode(true); handle.parentNode.replaceChild(nh,handle);
  nh.addEventListener('touchstart',start,{passive:true}); nh.addEventListener('touchmove',move,{passive:true}); nh.addEventListener('touchend',end);
  nh.addEventListener('mousedown',start); window.addEventListener('mousemove',move); window.addEventListener('mouseup',end);
}

function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function setStyle(id,p,v){const e=document.getElementById(id);if(e)e.style[p]=v;}
