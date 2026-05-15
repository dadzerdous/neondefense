// ─── CONSTANTS.JS ────────────────────────────────────────────────────────────
// All static game data. No imports needed — pure data.

export const SAVE_KEY = 'neonStrikeSave_v2';

// ── Turret types ──────────────────────────────────────────────────────────────
export const TYPES = {
  kinetic: { color: '#00f5ff', label: 'KINETIC', icon: 'hex'     },
  energy:  { color: '#cc00ff', label: 'ENERGY',  icon: 'diamond' },
  plasma:  { color: '#ff6600', label: 'PLASMA',  icon: 'tri'     },
};

export const TURRET_BASE_RANGE = { kinetic: 280, energy: 380, plasma: 200 };
export const MAX_LEVEL = 3; // default, overridden to 4 by Overclock skill

// ── Enemy types ───────────────────────────────────────────────────────────────
export const ENEMY_TYPES = [
  { id:'blue',   color:'#00aaff', shape:'rect',    hpMult:1,   speedMult:1,   reward:3, weakTo:'kinetic', armor:'energy',  label:'SCOUT',  pulses:false },
  { id:'purple', color:'#cc00ff', shape:'diamond', hpMult:1.3, speedMult:0.8, reward:4, weakTo:'energy',  armor:'kinetic', label:'PHANTOM',pulses:false },
  { id:'red',    color:'#ff2244', shape:'triangle',hpMult:1.8, speedMult:0.6, reward:6, weakTo:'plasma',  armor:'energy',  label:'TANK',   pulses:false },
  { id:'yellow', color:'#ffe600', shape:'circle',  hpMult:0.6, speedMult:1.8, reward:5, weakTo:'kinetic', armor:'plasma',  label:'RUNNER', pulses:true  },
  { id:'orange', color:'#ff6600', shape:'star',    hpMult:2,   speedMult:0.9, reward:8, weakTo:'plasma',  armor:'kinetic', label:'BRUTE',  pulses:true  },
];

// ── Skill trees ───────────────────────────────────────────────────────────────
export const TURRET_SKILLS = {
  kinetic: [
    { id:'k1', name:'Rapid Fire',    desc:'Fire rate +25%',         effect:'fireRate',  branch:'rate'   },
    { id:'k2', name:'Piercing Shot', desc:'Bullets pierce 1 enemy', effect:'pierce',    branch:'pierce', req:'k1' },
    { id:'k3', name:'Ricochet',      desc:'Bullets bounce once',    effect:'ricochet',  branch:'pierce', req:'k2' },
    { id:'k4', name:'Overdrive',     desc:'Fire rate +50%',         effect:'fireRate2', branch:'rate',   req:'k1' },
    { id:'k5', name:'Twin Barrel',   desc:'Fire 2 bullets',         effect:'twin',      branch:'rate',   req:'k4' },
    { id:'k6', name:'Railgun',       desc:'Bullets ignore armor',   effect:'armorpen',  branch:'rate',   req:'k5' },
    { id:'k7', name:'Long Barrel',   desc:'Range +60px',            effect:'range1',    branch:'range'  },
    { id:'k8', name:'Extended Bore', desc:'Range +80px',            effect:'range2',    branch:'range',  req:'k7' },
    { id:'k9', name:'Sniper Rail',   desc:'Range +120px',           effect:'range3',    branch:'range',  req:'k8' },
  ],
  energy: [
    { id:'e1', name:'Wide Beam',     desc:'Beam width +30%',              effect:'beamWidth', branch:'heat'  },
    { id:'e2', name:'Slow Field',    desc:'Hits slow enemy 20%',          effect:'slow',      branch:'slow',  req:'e1' },
    { id:'e3', name:'Shield Drain',  desc:'+50% vs armored',              effect:'shieldbns', branch:'slow',  req:'e2' },
    { id:'e4', name:'Overcharge',    desc:'Dmg +40% when beam hot',       effect:'heatbonus', branch:'heat',  req:'e1' },
    { id:'e5', name:'Chain Arc',     desc:'Arcs to 2nd enemy',            effect:'arc',       branch:'heat',  req:'e4' },
    { id:'e6', name:'Ion Storm',     desc:'All-lane pulse every 10s',     effect:'pulse',     branch:'heat',  req:'e5' },
    { id:'e7', name:'Capacitor',     desc:'Heat cools 25% faster',        effect:'cooldown',  branch:'slow'  },
    { id:'e8', name:'Focus Lens',    desc:'Damage +30%',                  effect:'dmgBonus',  branch:'slow',  req:'e7' },
    { id:'e9', name:'Overload',      desc:'Lv3 bursts on kill',           effect:'overload',  branch:'slow',  req:'e8' },
  ],
  plasma: [
    { id:'p1', name:'Blast Radius',  desc:'AOE radius +25px',             effect:'aoe1',      branch:'aoe'   },
    { id:'p2', name:'Wide Burst',    desc:'AOE radius +35px',             effect:'aoe2',       branch:'aoe',   req:'p1' },
    { id:'p3', name:'Shockwave',     desc:'AOE radius +50px',             effect:'aoe3',       branch:'aoe',   req:'p2' },
    { id:'p4', name:'Burn DoT',      desc:'Leaves burn on hit',           effect:'burn',       branch:'burn'  },
    { id:'p5', name:'Napalm',        desc:'Burn damage +50%',             effect:'burnDmg',    branch:'burn',  req:'p4' },
    { id:'p6', name:'Sticky Fire',   desc:'Burn slows enemy',             effect:'burnSlow',   branch:'burn',  req:'p5' },
    { id:'p7', name:'Heat Sink',     desc:'Less beam heat per shot',      effect:'heatRed',    branch:'aoe'   },
    { id:'p8', name:'Superheated',   desc:'Dmg scales with wave',         effect:'waveBonus',  branch:'burn',  req:'p7' },
    { id:'p9', name:'Meltdown',      desc:'5% instant-kill chance',       effect:'instakill',  branch:'burn',  req:'p8' },
  ],
};

export const PILOT_SKILLS = [
  { id:'pr1', name:'Veteran Start',  desc:'Start with +$30',         effect:'startCredits', branch:'econ'    },
  { id:'pr2', name:'Salvage',        desc:'Kill credit +$1',         effect:'killBonus',    branch:'econ',    req:'pr1' },
  { id:'pr3', name:'Fast Cooldown',  desc:'Beam cools 30% faster',  effect:'beamCool',     branch:'defense'  },
  { id:'pr4', name:'Chain Master',   desc:'Chain timer 50% longer', effect:'chainTime',    branch:'econ',    req:'pr2' },
  { id:'pr5', name:'Iron Will',      desc:'Start with +10 shields', effect:'startShields', branch:'defense', req:'pr3' },
  { id:'pr6', name:'Efficiency',     desc:'Turrets 10% cheaper',    effect:'discount',     branch:'econ',    req:'pr4' },
  { id:'pr7', name:'Overclock',      desc:'Unlock Lv4 merges',      effect:'overclock',    branch:'econ',    req:'pr6' },
  { id:'pr8', name:'Arsenal',        desc:'+1 rail slot',           effect:'railSlot',     branch:'defense', req:'pr5' },
  { id:'pr9', name:'Hangar Bay',     desc:'+2 hangar slots',        effect:'hangarSlot',   branch:'defense', req:'pr5' },
];

// Which skill IDs belong to which branch (for quest gating)
export const BRANCH_SKILLS = {
  kinetic: { range:['k7','k8','k9'], rate:['k4','k5','k6'], pierce:['k2','k3'] },
  energy:  { slow:['e2','e3','e7','e8','e9'], heat:['e4','e5','e6'] },
  plasma:  { aoe:['p1','p2','p3','p7'], burn:['p4','p5','p6','p8','p9'] },
  pilot:   { econ:['pr1','pr2','pr4','pr6','pr7'], defense:['pr3','pr5','pr8','pr9'] },
};

// ── Stat tweaks ───────────────────────────────────────────────────────────────
export const TURRET_STAT_DEFS = {
  kinetic: [
    { id:'dmg',         name:'Damage',       desc:'+0.15 dmg/level',          max:5, unique:false },
    { id:'fireRate',    name:'Fire Rate',     desc:'+8% rate/level',           max:5, unique:false },
    { id:'penetration', name:'Penetration',   desc:'+12% pierce chance/level', max:5, unique:true  },
  ],
  energy: [
    { id:'dmg',         name:'Damage',        desc:'+0.15 dmg/level',         max:5, unique:false },
    { id:'heatRed',     name:'Heat Control',  desc:'-6% heat gen/level',      max:5, unique:false },
    { id:'resonance',   name:'Resonance',     desc:'+0.5s slow duration/lvl', max:5, unique:true  },
  ],
  plasma: [
    { id:'dmg',         name:'Damage',        desc:'+0.15 dmg/level',         max:5, unique:false },
    { id:'aoe',         name:'Blast+',        desc:'+8px AOE radius/level',   max:5, unique:false },
    { id:'volatility',  name:'Volatility',    desc:'Burning enemies explode', max:5, unique:true  },
  ],
};

// ── Quests ────────────────────────────────────────────────────────────────────
export const QUEST_DEFS = {
  kinetic: [
    { id:'qk_range',  name:'Long Shot',     desc:'Kill 10 enemies from max range',   target:10,  statKey:'longshots',   reward:'range',  rewardLabel:'Range branch'  },
    { id:'qk_rate',   name:'Chain Killer',  desc:'Get a x5 kill chain',              target:1,   statKey:'chain5',      reward:'rate',   rewardLabel:'Rate branch'   },
    { id:'qk_pierce', name:'Armory Built',  desc:'Buy 30 kinetic turrets total',     target:30,  statKey:'bought',      reward:'pierce', rewardLabel:'Pierce branch' },
  ],
  energy: [
    { id:'qe_slow',   name:'Crowd Control', desc:'Slow 50 enemies in one run',       target:50,  statKey:'slowed',      reward:'slow',   rewardLabel:'Slow branch'   },
    { id:'qe_heat',   name:'Heat Seeker',   desc:'Overheat beam 10 times',           target:10,  statKey:'overheats',   reward:'heat',   rewardLabel:'Heat branch'   },
  ],
  plasma: [
    { id:'qp_aoe',    name:'Splash Damage', desc:'Hit 3+ enemies with one shot x20', target:20, statKey:'splashkills', reward:'aoe',    rewardLabel:'AOE branch'    },
    { id:'qp_burn',   name:'Pyromaniac',    desc:'Deal 500 burn damage total',       target:500, statKey:'burndmg',    reward:'burn',   rewardLabel:'Burn branch'   },
  ],
  pilot: [
    { id:'qpr_econ',  name:'Entrepreneur',  desc:'Earn $2000 credits across runs',   target:2000,statKey:'credits',     reward:'econ',   rewardLabel:'Economy branch'},
    { id:'qpr_def',   name:'Shield Wall',   desc:'Complete 3 waves at full shields', target:3,   statKey:'cleanwaves', reward:'defense',rewardLabel:'Defense branch'},
  ],
};

// ── XP thresholds ─────────────────────────────────────────────────────────────
export const PILOT_XP_PER_RANK  = [0,300,600,1000,1500,2200,3000,4000,5500,7500];
export const TURRET_XP_PER_RANK = [0,250,550,1000,1800,3000];

// ── Layout ────────────────────────────────────────────────────────────────────
export const SLOT_W        = 52;
export const SLOT_GAP      = 6;
export const RAIL_W        = 60;
export const RAIL_GAP      = 10;
export const BTN_ZONE      = 50;
export const HNG_ZONE      = 70;
export const RAIL_ZONE     = 75;
export const PANEL_H       = BTN_ZONE + HNG_ZONE + RAIL_ZONE + 10;
export const VISIBLE_HANGAR = 5;
export const DEFAULT_RAILS  = 3;
export const DEFAULT_HANGAR = 10;
