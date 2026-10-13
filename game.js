'use strict';

/* ============================================================
   Tower Defense 3D — game.js (Three.js)
   ============================================================ */

/* ----------------------- DOM ----------------------- */
const container3d  = document.getElementById('canvas3d');
const moneyEl      = document.getElementById('money');
const livesEl      = document.getElementById('lives');
const waveEl       = document.getElementById('wave');
const scoreEl      = document.getElementById('score');
const bestEl       = document.getElementById('best');
const waveBtn      = document.getElementById('waveBtn');
const speedBtn     = document.getElementById('speedBtn');
const muteBtn      = document.getElementById('muteBtn');
const mapBtn       = document.getElementById('mapBtn');
const overlay      = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText  = document.getElementById('overlayText');
const overlayBtn   = document.getElementById('overlayBtn');
const towerButtons = Array.from(document.querySelectorAll('.tower'));

/* ============================================================
   ЗВУК
   ============================================================ */
let audioCtx = null;
let muted = false;
try { muted = localStorage.getItem('tdMuted') === '1'; } catch (e) {}

function initAudio() {
  if (audioCtx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  } catch (e) { audioCtx = null; }
}
function unlockAudio() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}
function tone(opt) {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime;
  const { freq = 440, freqEnd = null, type = 'square',
          duration = 0.12, volume = 0.14, attack = 0.005 } = opt || {};
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + duration + 0.05);
}
function noise(opt) {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime;
  const { duration = 0.25, volume = 0.18, filterFrom = 1200, filterTo = 120 } = opt || {};
  const len = Math.floor(audioCtx.sampleRate * duration);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrom, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t + duration);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  src.start(t); src.stop(t + duration + 0.05);
}
const _lastPlay = {};
function throttle(key, ms, fn) {
  const now = performance.now();
  if (_lastPlay[key] && now - _lastPlay[key] < ms) return;
  _lastPlay[key] = now;
  fn();
}
const SFX = {
  arrowShot() { throttle('arrowShot', 40, () => tone({ freq: 900, freqEnd: 380, type: 'square', duration: 0.07, volume: 0.06 })); },
  cannonShot() {
    throttle('cannonShot', 80, () => {
      tone({ freq: 180, freqEnd: 50, type: 'sawtooth', duration: 0.28, volume: 0.18 });
      noise({ duration: 0.25, volume: 0.14, filterFrom: 900, filterTo: 80 });
    });
  },
  frostShot() {
    throttle('frostShot', 60, () => {
      tone({ freq: 1350, freqEnd: 950, type: 'sine', duration: 0.12, volume: 0.08 });
      tone({ freq: 1800, freqEnd: 1200, type: 'triangle', duration: 0.1, volume: 0.04 });
    });
  },
  enemyDeath() {
    throttle('enemyDeath', 30, () => {
      tone({ freq: 520, freqEnd: 120, type: 'square', duration: 0.14, volume: 0.10 });
      noise({ duration: 0.12, volume: 0.06, filterFrom: 1500, filterTo: 200 });
    });
  },
  lifeLost() {
    tone({ freq: 220, freqEnd: 80, type: 'sawtooth', duration: 0.4, volume: 0.22 });
    noise({ duration: 0.3, volume: 0.15, filterFrom: 700, filterTo: 100 });
  },
  towerPlace() {
    tone({ freq: 500, freqEnd: 800, type: 'triangle', duration: 0.14, volume: 0.14 });
    setTimeout(() => tone({ freq: 750, freqEnd: 1100, type: 'triangle', duration: 0.12, volume: 0.12 }), 60);
  },
  towerUpgrade() {
    tone({ freq: 600, type: 'triangle', duration: 0.1, volume: 0.12 });
    setTimeout(() => tone({ freq: 800, type: 'triangle', duration: 0.1, volume: 0.12 }), 70);
    setTimeout(() => tone({ freq: 1100, type: 'triangle', duration: 0.14, volume: 0.13 }), 140);
  },
  towerSell() { tone({ freq: 700, freqEnd: 300, type: 'triangle', duration: 0.18, volume: 0.12 }); },
  waveStart() {
    tone({ freq: 440, type: 'square', duration: 0.12, volume: 0.13 });
    setTimeout(() => tone({ freq: 660, type: 'square', duration: 0.12, volume: 0.13 }), 130);
    setTimeout(() => tone({ freq: 880, type: 'square', duration: 0.20, volume: 0.14 }), 260);
  },
  waveComplete() {
    tone({ freq: 660, type: 'triangle', duration: 0.12, volume: 0.11 });
    setTimeout(() => tone({ freq: 880, type: 'triangle', duration: 0.12, volume: 0.11 }), 110);
    setTimeout(() => tone({ freq: 1320, type: 'triangle', duration: 0.22, volume: 0.12 }), 230);
  },
  gameOver() {
    tone({ freq: 400, freqEnd: 320, type: 'sawtooth', duration: 0.25, volume: 0.15 });
    setTimeout(() => tone({ freq: 320, freqEnd: 260, type: 'sawtooth', duration: 0.25, volume: 0.15 }), 220);
    setTimeout(() => tone({ freq: 260, freqEnd: 90, type: 'sawtooth', duration: 0.7, volume: 0.17 }), 440);
    setTimeout(() => noise({ duration: 0.6, volume: 0.12, filterFrom: 600, filterTo: 80 }), 440);
  },
  uiClick() { tone({ freq: 700, freqEnd: 900, type: 'square', duration: 0.05, volume: 0.06 }); },
  error()   { tone({ freq: 200, freqEnd: 140, type: 'square', duration: 0.14, volume: 0.10 }); }
};
function attachAudioUnlock() {
  const unlock = () => {
    unlockAudio();
    document.removeEventListener('mousedown', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('mousedown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('touchstart', unlock);
}
attachAudioUnlock();
function updateMuteButton() {
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', muted);
}
muteBtn.addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('tdMuted', muted ? '1' : '0'); } catch (e) {}
  updateMuteButton();
  if (!muted) { unlockAudio(); SFX.uiClick(); }
});
updateMuteButton();

/* ============================================================
   КОНСТАНТЫ
   ============================================================ */
const TILE = 2;
const COLS = 15;
const ROWS = 10;
const WORLD_W = COLS * TILE;
const WORLD_D = ROWS * TILE;
const STORAGE_KEY = 'towerDefenseHighScore_v1';
const MAP_KEY = 'tdMapMode';

/* ----------------------- КАРТА (режим) ----------------------- */
let mapMode = 'summer';
try { mapMode = localStorage.getItem(MAP_KEY) || 'summer'; } catch (e) {}

const PATH_TILES = [
  { x: -1, y: 1 },
  { x:  3, y: 1 },
  { x:  3, y: 5 },
  { x:  8, y: 5 },
  { x:  8, y: 2 },
  { x: 12, y: 2 },
  { x: 12, y: 8 },
  { x: 15, y: 8 }
];

function tileToWorld(col, row) {
  return { x: col * TILE + TILE / 2, z: row * TILE + TILE / 2 };
}
const WAYPOINTS = PATH_TILES.map(p => {
  const w = tileToWorld(p.x, p.y);
  return { x: w.x, z: w.z };
});

const BLOCKED = new Set();
(function buildBlocked() {
  for (let i = 0; i < PATH_TILES.length - 1; i++) {
    const a = PATH_TILES[i], b = PATH_TILES[i + 1];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let x = a.x, y = a.y;
    BLOCKED.add(x + ',' + y);
    while (x !== b.x || y !== b.y) {
      x += dx; y += dy;
      BLOCKED.add(x + ',' + y);
    }
  }
})();

const TOWER_TYPES = {
  arrow:  { name: 'Стрелок', cost: 50,  color: 0x4aa3ff, range: 125/60*TILE, damage: 12, cooldown: 0.55, projSpeed: 560/60*TILE, splash: 0, slow: 0,   slowDur: 0 },
  cannon: { name: 'Пушка',   cost: 100, color: 0xff7a45, range: 110/60*TILE, damage: 34, cooldown: 1.25, projSpeed: 380/60*TILE, splash: 48/60*TILE, slow: 0, slowDur: 0 },
  frost:  { name: 'Мороз',   cost: 75,  color: 0x4ae0d0, range: 115/60*TILE, damage: 6,  cooldown: 0.9,  projSpeed: 460/60*TILE, splash: 0, slow: 0.5, slowDur: 1.6 }
};

const ENEMY_TYPES = {
  normal: { hp: 32,  speed: 62/60*TILE,  reward: 8,  radius: 14/60*TILE, color: 0xc94a3f, accent: 0xf0a29a },
  fast:   { hp: 22,  speed: 112/60*TILE, reward: 10, radius: 11/60*TILE, color: 0xe0b31a, accent: 0xffe98a },
  tank:   { hp: 85,  speed: 42/60*TILE,  reward: 18, radius: 18/60*TILE, color: 0x7d4fb8, accent: 0xcbb0ee },
  boss:   { hp: 340, speed: 36/60*TILE,  reward: 90, radius: 26/60*TILE, color: 0x2c4a68, accent: 0x7fa9cf }
};

function loadBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { score: 0, wave: 0 };
    const data = JSON.parse(raw);
    return { score: Number(data.score) || 0, wave: Number(data.wave) || 0 };
  } catch (e) { return { score: 0, wave: 0 }; }
}
function saveBest(rec) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch (e) {}
}
let best = loadBest();

/* ============================================================
   ПРОЦЕДУРНЫЕ ТЕКСТУРЫ
   ============================================================ */
const _texCache = {};

function makeWoodTexture() {
  if (_texCache.wood) return _texCache.wood;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6b4520';
  g.fillRect(0, 0, 256, 256);
  const plankH = 32;
  for (let i = 0; i < 8; i++) {
    const y = i * plankH;
    const shade = 0.85 + Math.random() * 0.3;
    g.fillStyle = `rgb(${Math.floor(107 * shade)}, ${Math.floor(69 * shade)}, ${Math.floor(32 * shade)})`;
    g.fillRect(0, y, 256, plankH);
    g.fillStyle = 'rgba(30,18,8,0.7)';
    g.fillRect(0, y + plankH - 2, 256, 2);
    for (let k = 0; k < 18; k++) {
      const yy = y + 2 + Math.random() * (plankH - 6);
      g.strokeStyle = `rgba(50,30,12,${0.15 + Math.random() * 0.25})`;
      g.lineWidth = 0.4 + Math.random() * 1.2;
      g.beginPath();
      g.moveTo(0, yy);
      g.bezierCurveTo(64, yy + (Math.random() - 0.5) * 4,
                      128, yy + (Math.random() - 0.5) * 4,
                      256, yy);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _texCache.wood = tex;
  return tex;
}

function makeStoneTexture() {
  if (_texCache.stone) return _texCache.stone;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8378';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const t = Math.random();
    if (t < 0.4) g.fillStyle = `rgba(50,45,38,${0.2 + Math.random() * 0.4})`;
    else if (t < 0.75) g.fillStyle = `rgba(200,195,180,${0.15 + Math.random() * 0.3})`;
    else g.fillStyle = `rgba(120,115,105,${0.2 + Math.random() * 0.35})`;
    g.beginPath();
    g.arc(x, y, 0.5 + Math.random() * 2.5, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 8; i++) {
    g.strokeStyle = `rgba(40,35,28,${0.4 + Math.random() * 0.3})`;
    g.lineWidth = 0.5 + Math.random();
    g.beginPath();
    let x = Math.random() * 256, y = Math.random() * 256;
    g.moveTo(x, y);
    const steps = 5 + Math.floor(Math.random() * 5);
    for (let k = 0; k < steps; k++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = 'rgba(20,18,14,0.8)';
  g.lineWidth = 2.5;
  const rows = 4, rowH = 256 / rows;
  for (let i = 1; i < rows; i++) {
    g.beginPath();
    g.moveTo(0, i * rowH);
    g.lineTo(256, i * rowH);
    g.stroke();
  }
  for (let i = 0; i < rows; i++) {
    const y0 = i * rowH;
    const offset = (i % 2) * (256 / 4);
    for (let k = -1; k < 3; k++) {
      const x = offset + k * (256 / 2);
      if (x <= 0 || x >= 256) continue;
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y0 + rowH);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _texCache.stone = tex;
  return tex;
}

function makeMetalTexture() {
  if (_texCache.metal) return _texCache.metal;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4a5058';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const t = Math.random();
    if (t < 0.5) g.fillStyle = `rgba(20,25,30,${0.2 + Math.random() * 0.4})`;
    else g.fillStyle = `rgba(140,150,160,${0.15 + Math.random() * 0.35})`;
    g.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 30; i++) {
    g.strokeStyle = `rgba(200,210,220,${0.15 + Math.random() * 0.3})`;
    g.lineWidth = 0.5 + Math.random() * 0.8;
    const x = Math.random() * 256, y = Math.random() * 256;
    const a = Math.random() * Math.PI * 2;
    const len = 10 + Math.random() * 60;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _texCache.metal = tex;
  return tex;
}

function makeTileTexture() {
  if (_texCache.tile) return _texCache.tile;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3a2213';
  g.fillRect(0, 0, 256, 256);
  const tileW = 32, tileH = 20;
  for (let row = 0; row < 14; row++) {
    const offset = (row % 2) * (tileW / 2);
    for (let col = -1; col < 9; col++) {
      const x = col * tileW + offset;
      const y = row * tileH;
      const shade = 0.8 + Math.random() * 0.4;
      g.fillStyle = `rgb(${Math.floor(74 * shade)}, ${Math.floor(42 * shade)}, ${Math.floor(20 * shade)})`;
      g.beginPath();
      g.moveTo(x + 1, y + 1);
      g.lineTo(x + tileW - 1, y + 1);
      g.lineTo(x + tileW - 1, y + tileH - 3);
      g.quadraticCurveTo(x + tileW / 2, y + tileH + 2, x + 1, y + tileH - 3);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(15,8,4,0.7)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _texCache.tile = tex;
  return tex;
}

function makeIceTexture() {
  if (_texCache.ice) return _texCache.ice;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#e8fbff');
  grad.addColorStop(0.5, '#9cd8e8');
  grad.addColorStop(1, '#4a8aa0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const branches = 4 + Math.floor(Math.random() * 4);
    for (let b = 0; b < branches; b++) {
      const a = (b / branches) * Math.PI * 2;
      const len = 8 + Math.random() * 20;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _texCache.ice = tex;
  return tex;
}

/* ---------- Зимние текстуры ---------- */
function makeSnowTexture() {
  if (_texCache.snow) return _texCache.snow;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#e8f0f8');
  grad.addColorStop(1, '#c8d8e8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const r = 20 + Math.random() * 80;
    const light = Math.random() < 0.5;
    const rad = g.createRadialGradient(x, y, 0, x, y, r);
    rad.addColorStop(0, light ? 'rgba(255,255,255,0.4)' : 'rgba(150,175,210,0.35)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const b = Math.random();
    if (b < 0.7) g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.5})`;
    else g.fillStyle = `rgba(140,170,210,${0.2 + Math.random() * 0.4})`;
    g.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = 4;
  _texCache.snow = tex;
  return tex;
}

function makeIcePathTexture() {
  if (_texCache.icePath) return _texCache.icePath;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#a8d0e8');
  grad.addColorStop(0.5, '#c0e0f0');
  grad.addColorStop(1, '#8fc0e0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(80,140,180,${0.3 + Math.random() * 0.5})`;
    g.lineWidth = 0.5 + Math.random() * 1.5;
    g.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    g.moveTo(x, y);
    const steps = 5 + Math.floor(Math.random() * 8);
    for (let k = 0; k < steps; k++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.5) * 60;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`;
    g.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  _texCache.icePath = tex;
  return tex;
}

/* ---------- Общие материалы ---------- */
let MATS = null;
function buildTowerMaterials() {
  if (MATS) return MATS;
  const woodTex = makeWoodTexture();
  const stoneTex = makeStoneTexture();
  const metalTex = makeMetalTexture();
  const tileTex = makeTileTexture();
  const iceTex = makeIceTexture();

  MATS = {
    wood:      new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb08050, roughness: 0.85, metalness: 0.0 }),
    woodDark:  new THREE.MeshStandardMaterial({ map: woodTex, color: 0x6a4520, roughness: 0.9 }),
    woodBeam:  new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8a5a30, roughness: 0.9 }),
    stone:     new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x9a9488, roughness: 0.95, metalness: 0.02 }),
    stoneDark: new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x5a544a, roughness: 0.95 }),
    metal:     new THREE.MeshStandardMaterial({ map: metalTex, color: 0x6a7078, roughness: 0.5, metalness: 0.85 }),
    metalDark: new THREE.MeshStandardMaterial({ map: metalTex, color: 0x2a3038, roughness: 0.55, metalness: 0.85 }),
    iron:      new THREE.MeshStandardMaterial({ map: metalTex, color: 0x3a4046, roughness: 0.6, metalness: 0.9 }),
    tile:      new THREE.MeshStandardMaterial({ map: tileTex, color: 0x5a3a20, roughness: 0.9 }),
    cloth:     new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.95 }),
    clothGreen:new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 0.95 }),
    skin:      new THREE.MeshStandardMaterial({ color: 0xd4a878, roughness: 0.75 }),
    black:     new THREE.MeshBasicMaterial({ color: 0x0a0508 }),
    ice:       new THREE.MeshStandardMaterial({ map: iceTex, color: 0xb8ecff, roughness: 0.15, metalness: 0.15, emissive: 0x1a4a5a, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 }),
    iceGlow:   new THREE.MeshStandardMaterial({ color: 0xd6f6ff, emissive: 0x7fe9ff, emissiveIntensity: 1.5, roughness: 0.1, transparent: true, opacity: 0.95 }),
    snow:      new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.8 }),
    gold:      new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0x6a4a00, emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.3 })
  };
  return MATS;
}

/* ============================================================
   THREE.JS SETUP
   ============================================================ */
let scene, camera, renderer, clock;
let hoverMarker, rangeMarker, groundPlaneForRay;
let sunLight, hemiLight, snowPoints, snowData;
const mapObjects = []; /* объекты, подлежащие удалению при смене карты */
const particlePool = [];
const activeParticles = [];

const camState = {
  target: new THREE.Vector3(WORLD_W / 2, 0, WORLD_D / 2),
  radius: 42, theta: 1.2, phi: 0.85,
  minRadius: 12, maxRadius: 90,
  minPhi: 0.12, maxPhi: Math.PI / 2 - 0.06,
  dragging: false, dragMode: null,
  lastX: 0, lastY: 0,
  downX: 0, downY: 0, downTime: 0,
  moved: false, button: -1
};

function updateCamera() {
  const r = camState.radius, t = camState.theta, p = camState.phi;
  camera.position.set(
    camState.target.x + r * Math.sin(p) * Math.cos(t),
    camState.target.y + r * Math.cos(p),
    camState.target.z + r * Math.sin(p) * Math.sin(t)
  );
  camera.lookAt(camState.target);
}

function disposeObj(o) {
  o.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
      else n.material.dispose();
    }
  });
}

function setupThree() {
  buildTowerMaterials();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc0e0);
  scene.fog = new THREE.Fog(0x9cc0e0, 60, 120);

  const aspect = container3d.clientWidth / Math.max(1, container3d.clientHeight);
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 400);
  updateCamera();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container3d.clientWidth, container3d.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container3d.appendChild(renderer.domElement);

  hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.75);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff4d8, 1.0);
  sunLight.position.set(20, 35, 15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  const d = 26;
  sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;   sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.camera.near = 1;  sunLight.shadow.camera.far = 100;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);
  sunLight.target.position.set(WORLD_W / 2, 0, WORLD_D / 2);

  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  /* Собираем карту */
  buildMap();

  const planeGeo = new THREE.PlaneGeometry(WORLD_W, WORLD_D);
  groundPlaneForRay = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ visible: false }));
  groundPlaneForRay.rotation.x = -Math.PI / 2;
  groundPlaneForRay.position.set(WORLD_W / 2, 0, WORLD_D / 2);
  scene.add(groundPlaneForRay);

  const hgeo = new THREE.PlaneGeometry(TILE * 0.94, TILE * 0.94);
  const hmat = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  hoverMarker = new THREE.Mesh(hgeo, hmat);
  hoverMarker.rotation.x = -Math.PI / 2;
  hoverMarker.position.y = 0.05;
  hoverMarker.visible = false;
  scene.add(hoverMarker);

  const rgeo = new THREE.RingGeometry(0.55, 0.62, 64);
  const rmat = new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  rangeMarker = new THREE.Mesh(rgeo, rmat);
  rangeMarker.rotation.x = -Math.PI / 2;
  rangeMarker.position.y = 0.06;
  rangeMarker.visible = false;
  scene.add(rangeMarker);

  clock = new THREE.Clock();
}

/* ============================================================
   ПОСТРОЕНИЕ/ПЕРЕСТРОЕНИЕ КАРТЫ
   ============================================================ */
function buildMap() {
  /* Убираем старые объекты карты */
  for (const o of mapObjects) {
    scene.remove(o);
    disposeObj(o);
  }
  mapObjects.length = 0;

  /* Убираем старый снег, если был */
  if (snowPoints) {
    scene.remove(snowPoints);
    snowPoints.geometry.dispose();
    snowPoints.material.dispose();
    snowPoints = null;
    snowData = null;
  }

  const isWinter = mapMode === 'winter';

  /* Фон и туман */
  const skyColor = isWinter ? 0xc8d8e8 : 0x9cc0e0;
  scene.background = new THREE.Color(skyColor);
  scene.fog.color.setHex(skyColor);
  scene.fog.near = isWinter ? 45 : 60;
  scene.fog.far  = isWinter ? 110 : 120;

  /* Свет */
  if (isWinter) {
    hemiLight.color.setHex(0xdce8f4);
    hemiLight.groundColor.setHex(0x8fa0b8);
    hemiLight.intensity = 0.8;
    sunLight.color.setHex(0xd8e8ff);
    sunLight.intensity = 0.85;
  } else {
    hemiLight.color.setHex(0xcfe8ff);
    hemiLight.groundColor.setHex(0x4a5a3a);
    hemiLight.intensity = 0.75;
    sunLight.color.setHex(0xfff4d8);
    sunLight.intensity = 1.0;
  }

  mapObjects.push(createGround());
  createPath(); /* добавляет напрямую в сцену, но мы их сохраняем в mapObjects */
  createDecorations();
  mapObjects.push(createSpawnPortal());
  mapObjects.push(createCastle());

  if (isWinter) createSnowfall();
}

/* ---------- Земля ---------- */
function createGround() {
  const W = WORLD_W + 20, D = WORLD_D + 20;
  const geo = new THREE.PlaneGeometry(W, D, 1, 1);
  const isWinter = mapMode === 'winter';
  const mat = new THREE.MeshStandardMaterial({
    map: isWinter ? makeSnowTexture() : createGrassTexture(),
    roughness: isWinter ? 0.85 : 0.95,
    metalness: 0
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(WORLD_W / 2, 0, WORLD_D / 2);
  mesh.receiveShadow = true;
  return mesh;
}

function createGrassTexture() {
  if (_texCache.grass) return _texCache.grass;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4c6b32';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const r = 20 + Math.random() * 60;
    const light = Math.random() < 0.5;
    const rad = g.createRadialGradient(x, y, 0, x, y, r);
    rad.addColorStop(0, light ? 'rgba(110,150,70,0.30)' : 'rgba(35,55,25,0.35)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const t = Math.random();
    if (t < 0.4) g.fillStyle = 'rgba(140,180,90,0.55)';
    else if (t < 0.75) g.fillStyle = 'rgba(70,100,45,0.6)';
    else g.fillStyle = 'rgba(40,60,25,0.7)';
    g.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = 4;
  _texCache.grass = tex;
  return tex;
}

/* ---------- Тропа ---------- */
function createPath() {
  const isWinter = mapMode === 'winter';
  const tex = isWinter ? makeIcePathTexture() : makeDirtTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: isWinter ? 0.25 : 0.9,
    metalness: isWinter ? 0.15 : 0,
    emissive: isWinter ? 0x1a3a5a : 0x000000,
    emissiveIntensity: isWinter ? 0.15 : 0
  });

  const added = new Set();
  function addTile(col, row) {
    const key = col + ',' + row;
    if (added.has(key)) return;
    added.add(key);
    const w = tileToWorld(col, row);
    const geo = new THREE.BoxGeometry(TILE * 0.96, isWinter ? 0.14 : 0.12, TILE * 0.96);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(w.x, 0.07, w.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    mapObjects.push(mesh);
  }

  for (let i = 0; i < PATH_TILES.length - 1; i++) {
    const a = PATH_TILES[i], b = PATH_TILES[i + 1];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let x = a.x, y = a.y;
    while (x !== b.x || y !== b.y) { addTile(x, y); x += dx; y += dy; }
    addTile(x, y);
  }
}

function createDirtTexture() {
  if (_texCache.dirt) return _texCache.dirt;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a6b42';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const t = Math.random();
    if (t < 0.35) g.fillStyle = 'rgba(80,55,30,0.6)';
    else if (t < 0.7) g.fillStyle = 'rgba(180,150,105,0.4)';
    else g.fillStyle = 'rgba(120,90,55,0.55)';
    g.beginPath();
    g.arc(x, y, 0.5 + Math.random() * 2, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  _texCache.dirt = tex;
  return tex;
}

/* ---------- Декор ---------- */
function createDecorations() {
  const isWinter = mapMode === 'winter';

  const rockMat  = new THREE.MeshStandardMaterial({ color: isWinter ? 0xc8d0d8 : 0x8a8a80, roughness: 0.9 });
  const bushMat  = new THREE.MeshStandardMaterial({ color: 0x2f5020, roughness: 1 });
  const snowBushMat = new THREE.MeshStandardMaterial({ color: 0xe8f0f8, roughness: 0.85 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: isWinter ? 0x3a2a1a : 0x5a3a1a, roughness: 1 });
  const iceMat   = new THREE.MeshStandardMaterial({
    color: 0xb8ecff, emissive: 0x4a9ac9, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.2
  });

  for (let i = 0; i < 70; i++) {
    const c = Math.floor(Math.random() * COLS);
    const r = Math.floor(Math.random() * ROWS);
    if (BLOCKED.has(c + ',' + r)) continue;
    const w = tileToWorld(c, r);
    const x = w.x + (Math.random() - 0.5) * TILE * 0.7;
    const z = w.z + (Math.random() - 0.5) * TILE * 0.7;

    const roll = Math.random();

    if (isWinter) {
      if (roll < 0.35) {
        /* Снеговик */
        const g = new THREE.Group();
        const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), snowBushMat);
        s1.position.y = 0.28; s1.castShadow = true; g.add(s1);
        const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), snowBushMat);
        s2.position.y = 0.7; s2.castShadow = true; g.add(s2);
        const s3 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), snowBushMat);
        s3.position.y = 1.0; s3.castShadow = true; g.add(s3);

        /* Глазки */
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x101015 });
        const eyeGeo = new THREE.SphereGeometry(0.025, 6, 5);
        const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(0.05, 1.04, 0.14); g.add(e1);
        const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(-0.05, 1.04, 0.14); g.add(e2);

        /* Нос-морковка */
        const carrot = new THREE.Mesh(
          new THREE.ConeGeometry(0.04, 0.14, 6),
          new THREE.MeshStandardMaterial({ color: 0xff7020, roughness: 0.7 })
        );
        carrot.rotation.x = Math.PI / 2;
        carrot.position.set(0, 0.99, 0.2);
        g.add(carrot);

        /* Пуговицы */
        for (let k = 0; k < 2; k++) {
          const btn = new THREE.Mesh(eyeGeo, eyeMat);
          btn.position.set(0, 0.72 - k * 0.12, 0.2);
          g.add(btn);
        }

        /* Ведро на голове */
        const hat = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.14, 0.14, 10),
          new THREE.MeshStandardMaterial({ color: 0x6a7080, metalness: 0.6, roughness: 0.4 })
        );
        hat.position.y = 1.2;
        hat.rotation.z = 0.15;
        hat.castShadow = true;
        g.add(hat);

        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI * 2;
        scene.add(g);
        mapObjects.push(g);
      } else if (roll < 0.65) {
        /* Мёртвое дерево */
        const g = new THREE.Group();
        const trunkH = 0.8 + Math.random() * 0.6;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.1, trunkH, 6),
          trunkMat
        );
        trunk.position.y = trunkH / 2;
        trunk.castShadow = true;
        g.add(trunk);

        /* Ветви */
        for (let k = 0; k < 4; k++) {
          const a = Math.random() * Math.PI * 2;
          const len = 0.25 + Math.random() * 0.3;
          const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.035, len, 5),
            trunkMat
          );
          branch.position.set(
            Math.cos(a) * 0.05,
            trunkH * 0.6 + k * 0.1,
            Math.sin(a) * 0.05
          );
          branch.rotation.z = 0.6 * (Math.random() < 0.5 ? 1 : -1);
          branch.rotation.y = a;
          branch.castShadow = true;
          g.add(branch);
        }

        /* Снег на ветвях */
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6), snowBushMat);
        cap.position.y = trunkH + 0.05;
        cap.scale.set(1, 0.5, 1);
        cap.castShadow = true;
        g.add(cap);

        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI * 2;
        scene.add(g);
        mapObjects.push(g);
      } else {
        /* Ледяной кристалл */
        const s = 0.3 + Math.random() * 0.4;
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(s, 0),
          iceMat
        );
        crystal.position.set(x, s * 0.9, z);
        crystal.scale.set(0.7, 1.4, 0.7);
        crystal.rotation.set(Math.random(), Math.random(), Math.random());
        crystal.castShadow = true;
        scene.add(crystal);
        mapObjects.push(crystal);

        /* Пара мелких рядом */
        for (let k = 0; k < 2; k++) {
          const s2 = s * (0.4 + Math.random() * 0.3);
          const c2 = new THREE.Mesh(new THREE.OctahedronGeometry(s2, 0), iceMat);
          c2.position.set(
            x + (Math.random() - 0.5) * 0.5,
            s2 * 0.9,
            z + (Math.random() - 0.5) * 0.5
          );
          c2.scale.set(0.7, 1.4, 0.7);
          c2.rotation.set(Math.random(), Math.random(), Math.random());
          c2.castShadow = true;
          scene.add(c2);
          mapObjects.push(c2);
        }
      }
    } else {
      /* Летний декор (как было) */
      if (roll < 0.55) {
        const s = 0.15 + Math.random() * 0.3;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
        m.position.set(x, s * 0.6, z);
        m.rotation.set(Math.random() * 2, Math.random() * 6, Math.random() * 2);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        mapObjects.push(m);
      } else {
        const s = 0.25 + Math.random() * 0.2;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, s, 6), trunkMat);
        trunk.position.set(x, s / 2, z);
        trunk.castShadow = true;
        scene.add(trunk);
        mapObjects.push(trunk);

        const m = new THREE.Mesh(new THREE.SphereGeometry(s * 1.1, 8, 6), bushMat);
        m.position.set(x, s * 1.3, z);
        m.scale.set(1, 1.1, 1);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        mapObjects.push(m);
      }
    }
  }
}

/* ---------- Портал спавна ---------- */
function createSpawnPortal() {
  const w = tileToWorld(-1, 1);
  const isWinter = mapMode === 'winter';
  const group = new THREE.Group();

  const archMat = isWinter
    ? new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.7, metalness: 0.3 })
    : new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });

  const pillarGeo = new THREE.CylinderGeometry(0.35, 0.45, 3.2, 8);
  const p1 = new THREE.Mesh(pillarGeo, archMat); p1.position.set(-1.2, 1.6, 0); p1.castShadow = true; group.add(p1);
  const p2 = new THREE.Mesh(pillarGeo, archMat); p2.position.set(1.2, 1.6, 0);  p2.castShadow = true; group.add(p2);

  const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.4, 0.8), archMat);
  top.position.set(0, 3.3, 0); top.castShadow = true; group.add(top);

  /* Сосульки зимой */
  if (isWinter) {
    for (let i = 0; i < 6; i++) {
      const len = 0.15 + Math.random() * 0.25;
      const icicle = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, len, 5),
        new THREE.MeshStandardMaterial({ color: 0xd6f6ff, emissive: 0x4a9ac9, emissiveIntensity: 0.4, roughness: 0.2, transparent: true, opacity: 0.85 })
      );
      icicle.position.set(-1.2 + i * 0.48, 3.3 - 0.2 - len / 2, 0.35);
      icicle.rotation.x = Math.PI;
      icicle.castShadow = true;
      group.add(icicle);
    }
  }

  const innerColor = isWinter ? 0x60c8ff : 0xa06cd5;
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 20, 16),
    new THREE.MeshBasicMaterial({ color: innerColor, transparent: true, opacity: 0.65 })
  );
  inner.position.y = 1.6;
  group.add(inner);

  const portalLight = new THREE.PointLight(innerColor, 0.7, 6);
  portalLight.position.y = 1.6;
  group.add(portalLight);

  group.position.set(w.x, 0, w.z);
  return group;
}

/* ---------- Замок ---------- */
function createCastle() {
  const w = tileToWorld(15, 8);
  const isWinter = mapMode === 'winter';
  const group = new THREE.Group();

  const stoneMat = isWinter
    ? new THREE.MeshStandardMaterial({ color: 0xa8c0d8, roughness: 0.6, metalness: 0.15, emissive: 0x1a3a5a, emissiveIntensity: 0.15 })
    : new THREE.MeshStandardMaterial({ color: 0x7d766a, roughness: 0.85 });
  const stoneDarkMat = isWinter
    ? new THREE.MeshStandardMaterial({ color: 0x7a92a8, roughness: 0.65, metalness: 0.15 })
    : new THREE.MeshStandardMaterial({ color: 0x5a544a, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.9 });

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 5.5, 12), stoneMat);
  tower.position.set(0, 2.75, 0);
  tower.castShadow = true; tower.receiveShadow = true;
  group.add(tower);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), stoneDarkMat);
    m.position.set(Math.cos(a) * 1.55, 5.85, Math.sin(a) * 1.55);
    m.rotation.y = a;
    m.castShadow = true;
    group.add(m);
  }

  const gate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.3), woodMat);
  gate.position.set(-1.55, 0.8, 0);
  gate.castShadow = true;
  group.add(gate);

  /* Кристалл — красный в летнем, голубой в зимнем */
  const gemColor = isWinter ? 0x60c8ff : 0xff3040;
  const gemEmissive = isWinter ? 0x40a8e0 : 0xff2030;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({
      color: gemColor, emissive: gemEmissive, emissiveIntensity: 1.2, roughness: 0.3
    })
  );
  gem.position.set(0, 6.8, 0);
  gem.castShadow = true;
  group.add(gem);

  const gemLight = new THREE.PointLight(gemColor, 1.2, 8);
  gemLight.position.set(0, 6.8, 0);
  group.add(gemLight);

  [-2.4, 2.4].forEach(offset => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 4.2, 10), stoneMat);
    t.position.set(offset, 2.1, 0);
    t.castShadow = true;
    group.add(t);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.0, 10), stoneDarkMat);
    cap.position.set(offset, 4.7, 0);
    cap.castShadow = true;
    group.add(cap);

    /* Снежная шапка поверх конуса зимой */
    if (isWinter) {
      const snowCap = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 0.4, 10),
        new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.8 })
      );
      snowCap.position.set(offset, 5.3, 0);
      snowCap.castShadow = true;
      group.add(snowCap);
    }
  });

  /* Снежные карнизы зимой */
  if (isWinter) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const snowLump = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.85 })
      );
      snowLump.position.set(Math.cos(a) * 1.55, 5.55, Math.sin(a) * 1.55);
      snowLump.scale.set(1, 0.5, 1);
      snowLump.castShadow = true;
      group.add(snowLump);
    }
  }

  group.position.set(w.x, 0, w.z);
  return group;
}

/* ---------- Снегопад ---------- */
function createSnowfall() {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  snowData = [];

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 50;
    const y = Math.random() * 25;
    const z = (Math.random() - 0.5) * 35;
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    snowData.push({
      speed: 0.6 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.11,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    depthWrite: false
  });

  snowPoints = new THREE.Points(geo, mat);
  snowPoints.position.set(WORLD_W / 2, 0, WORLD_D / 2);
  scene.add(snowPoints);
}

function updateSnowfall(dt) {
  if (!snowPoints || !snowData) return;
  const pos = snowPoints.geometry.attributes.position.array;
  const count = snowData.length;
  const t = game.time;

  for (let i = 0; i < count; i++) {
    const d = snowData[i];
    pos[i * 3]     += (d.drift + Math.sin(t + d.phase) * 0.25) * dt;
    pos[i * 3 + 1] -= d.speed * dt;
    pos[i * 3 + 2] += Math.cos(t * 0.7 + d.phase) * 0.2 * dt;

    if (pos[i * 3 + 1] < 0) {
      pos[i * 3]     = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 35;
    }
  }
  snowPoints.geometry.attributes.position.needsUpdate = true;
}

/* ============================================================
   ЧАСТИЦЫ
   ============================================================ */
function spawnParticles(x, y, z, color, count, speed, life) {
  speed = speed || 2;
  life = life || 0.5;
  for (let i = 0; i < count; i++) {
    let p = particlePool.pop();
    if (!p) {
      const geo = new THREE.SphereGeometry(0.07, 6, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      p = { mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 };
    }
    p.mesh.material.color.setHex(color);
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
    p.mesh.visible = true;
    const a = Math.random() * Math.PI * 2;
    const el = Math.random() * Math.PI * 0.5;
    p.vx = Math.cos(a) * Math.cos(el) * speed * (0.4 + Math.random() * 0.8);
    p.vz = Math.sin(a) * Math.cos(el) * speed * (0.4 + Math.random() * 0.8);
    p.vy = Math.sin(el) * speed * (0.6 + Math.random() * 0.8);
    const l = life * (0.6 + Math.random() * 0.6);
    p.life = l; p.maxLife = l;
    activeParticles.push(p);
  }
}

function updateParticles(dt) {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 6 * dt;
    if (p.mesh.position.y < 0.05) {
      p.mesh.position.y = 0.05;
      p.vy *= -0.3;
      p.vx *= 0.6;
      p.vz *= 0.6;
    }
    p.life -= dt;
    const k = Math.max(0, p.life / p.maxLife);
    p.mesh.scale.setScalar(0.6 + Math.random() * 0.3 + k * 0.4);
    p.mesh.material.opacity = k;
    p.mesh.material.transparent = true;
    if (p.life <= 0) {
      p.mesh.visible = false;
      activeParticles.splice(i, 1);
      particlePool.push(p);
    }
  }
}

/* ============================================================
   БАШНЯ
   ============================================================ */
class Tower {
  constructor(type, col, row) {
    this.type = type;
    this.col = col;
    this.row = row;
    const w = tileToWorld(col, row);
    this.x = w.x;
    this.z = w.z;
    this.level = 1;
    this.cooldown = 0;
    this.angle = 0;
    this.spent = TOWER_TYPES[type].cost;
    this.recoil = 0;

    this.mesh = new THREE.Group();
    this.mesh.position.set(this.x, 0, this.z);
    this.turret = new THREE.Group();
    this.buildMesh();
    scene.add(this.mesh);
  }

  get def() { return TOWER_TYPES[this.type]; }
  get range() { return this.def.range * (1 + 0.12 * (this.level - 1)); }
  get damage() { return this.def.damage * Math.pow(1.55, this.level - 1); }
  get fireRate() { return 1 / (this.def.cooldown * Math.pow(0.85, this.level - 1)); }
  get upgradeCost() { return Math.round(this.def.cost * 0.9 * this.level); }
  get sellValue() { return Math.round(this.spent * 0.7); }

  buildMesh() {
    if (this.type === 'arrow') this.buildWatchtower();
    else if (this.type === 'cannon') this.buildMortar();
    else this.buildIceSpire();

    this.levelDots = [];
    for (let i = 0; i < 3; i++) {
      const dot = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), MATS.gold);
      dot.position.set(-0.35 + i * 0.35, 0.25, 0.95);
      dot.visible = i < this.level;
      this.mesh.add(dot);
      this.levelDots.push(dot);
    }
  }

  buildWatchtower() {
    const M = MATS;

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.25, 8), M.stone);
    base.position.y = 0.125; base.castShadow = true; base.receiveShadow = true;
    this.mesh.add(base);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const blk = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.35, 0.28), i % 2 === 0 ? M.stone : M.stoneDark);
      blk.position.set(Math.cos(a) * 0.92, 0.175, Math.sin(a) * 0.92);
      blk.rotation.y = -a + Math.PI / 2;
      blk.castShadow = true; blk.receiveShadow = true;
      this.mesh.add(blk);
    }

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.65, 0.13), M.woodBeam);
      post.position.set(Math.cos(a) * 0.62, 1.18, Math.sin(a) * 0.62);
      post.castShadow = true; post.receiveShadow = true;
      this.mesh.add(post);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.1, 0.13), M.woodDark);
      beam.position.set(Math.cos(a + Math.PI / 4) * 0.62, 2.0, Math.sin(a + Math.PI / 4) * 0.62);
      beam.rotation.y = -(a + Math.PI / 4) + Math.PI / 2;
      beam.castShadow = true;
      this.mesh.add(beam);
    }

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const wallGroup = new THREE.Group();
      for (let j = 0; j < 5; j++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.55, 0.06), j % 2 === 0 ? M.wood : M.woodDark);
        plank.position.set(-0.4 + j * 0.2, 0, 0);
        plank.castShadow = true; plank.receiveShadow = true;
        wallGroup.add(plank);
      }
      wallGroup.position.set(Math.cos(a) * 0.65, 1.18, Math.sin(a) * 0.65);
      wallGroup.rotation.y = -a + Math.PI / 2;
      this.mesh.add(wallGroup);
    }

    const windowGroup = new THREE.Group();
    const winHole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.04), M.black);
    windowGroup.add(winHole);
    const winLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb85a, transparent: true, opacity: 0.85 }));
    winLight.position.z = 0.04;
    windowGroup.add(winLight);
    this.windowLight = winLight;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.05), M.woodDark);
    frame.position.z = -0.03;
    windowGroup.add(frame);
    windowGroup.position.set(0, 1.3, 0.66);
    this.mesh.add(windowGroup);

    const torchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.28, 6), M.woodDark);
    torchHandle.position.set(0.55, 1.75, 0.35);
    torchHandle.rotation.x = Math.PI / 8;
    torchHandle.castShadow = true;
    this.mesh.add(torchHandle);

    const flameOuter = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.85 }));
    flameOuter.position.set(0.55, 1.95, 0.35);
    this.mesh.add(flameOuter);
    this.flame = flameOuter;

    const flameInner = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    flameInner.position.set(0.55, 1.94, 0.35);
    this.mesh.add(flameInner);

    const torchLight = new THREE.PointLight(0xff9040, 0.55, 3.5);
    torchLight.position.set(0.55, 1.95, 0.35);
    this.mesh.add(torchLight);

    const roofBase = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.85, 12), M.tile);
    roofBase.position.y = 2.28;
    roofBase.castShadow = true;
    this.mesh.add(roofBase);

    for (let i = 0; i < 5; i++) {
      const r = 1.0 - i * 0.17;
      const y = 1.95 + i * 0.14;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.06, 12, 1, true), M.woodDark);
      ring.position.y = y;
      ring.castShadow = true;
      this.mesh.add(ring);
    }

    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), M.woodDark);
    finial.position.y = 2.85;
    finial.castShadow = true;
    this.mesh.add(finial);

    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 0.12, 8), M.woodBeam);
    balcony.position.y = 2.2;
    balcony.castShadow = true; balcony.receiveShadow = true;
    this.mesh.add(balcony);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const railPost = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.05), M.woodDark);
      railPost.position.set(Math.cos(a) * 0.55, 2.4, Math.sin(a) * 0.55);
      railPost.castShadow = true;
      this.mesh.add(railPost);
    }
    const railRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 6, 16), M.woodDark);
    railRing.rotation.x = Math.PI / 2;
    railRing.position.y = 2.55;
    railRing.castShadow = true;
    this.mesh.add(railRing);

    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x8a1a2a, roughness: 0.95, side: THREE.DoubleSide }));
    banner.position.set(-0.68, 1.35, 0.35);
    banner.rotation.y = -0.35;
    banner.castShadow = true;
    this.mesh.add(banner);

    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), MATS.gold);
    emblem.position.set(-0.68, 1.35, 0.355);
    emblem.rotation.y = -0.35;
    this.mesh.add(emblem);

    /* Турель */
    this.turret.position.y = 2.35;
    this.mesh.add(this.turret);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.4, 10), M.clothGreen);
    torso.position.y = 0.2; torso.castShadow = true; this.turret.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), M.skin);
    head.position.y = 0.5; head.castShadow = true; this.turret.add(head);

    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65), M.clothGreen);
    hood.position.y = 0.5; hood.castShadow = true; this.turret.add(hood);

    const shoulders = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 10), M.clothGreen);
    shoulders.position.y = 0.36; shoulders.castShadow = true; this.turret.add(shoulders);

    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6), M.clothGreen);
    armL.position.set(-0.14, 0.24, 0.08); armL.rotation.set(Math.PI / 2.4, 0, 0.4); armL.castShadow = true; this.turret.add(armL);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6), M.clothGreen);
    armR.position.set(0.14, 0.24, 0.08); armR.rotation.set(Math.PI / 2.4, 0, -0.4); armR.castShadow = true; this.turret.add(armR);

    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.022, 6, 20, Math.PI * 1.15), M.woodDark);
    bow.position.set(0, 0.25, 0.35); bow.rotation.z = Math.PI * 0.42; bow.rotation.y = Math.PI / 2; bow.castShadow = true;
    this.turret.add(bow);

    const bowEnd1 = new THREE.Vector3(0, 0.25 + Math.sin(Math.PI * 0.42) * 0.32, 0.35 + Math.cos(Math.PI * 0.42) * 0.32);
    const bowEnd2 = new THREE.Vector3(0, 0.25 + Math.sin(Math.PI * 0.42 + Math.PI * 1.15) * 0.32, 0.35 + Math.cos(Math.PI * 0.42 + Math.PI * 1.15) * 0.32);
    const stringGeo = new THREE.BufferGeometry().setFromPoints([bowEnd1, bowEnd2]);
    const stringLine = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xe0d8c0 }));
    this.turret.add(stringLine);

    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), M.woodDark);
    arrow.rotation.z = Math.PI / 2; arrow.position.set(0.05, 0.25, 0.42); arrow.castShadow = true;
    this.turret.add(arrow);

    const arrowTip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6),
      new THREE.MeshStandardMaterial({ color: 0xdcd6b8, metalness: 0.6, roughness: 0.4 }));
    arrowTip.rotation.z = -Math.PI / 2; arrowTip.position.set(0.32, 0.25, 0.42); arrowTip.castShadow = true;
    this.turret.add(arrowTip);

    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.32, 8), M.woodDark);
    quiver.position.set(-0.06, 0.22, -0.16); quiver.rotation.z = 0.35; quiver.rotation.x = -0.2; quiver.castShadow = true;
    this.turret.add(quiver);

    for (let i = 0; i < 3; i++) {
      const a = -0.15 + i * 0.15;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5), M.woodBeam);
      shaft.position.set(-0.06 + Math.sin(a) * 0.04, 0.42 + Math.cos(a) * 0.02, -0.16);
      shaft.rotation.z = 0.35 + a;
      this.turret.add(shaft);

      const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 4), M.cloth);
      f.position.set(-0.06 + Math.sin(a) * 0.07, 0.52 + Math.cos(a) * 0.03, -0.16);
      f.rotation.z = 0.35 + a;
      this.turret.add(f);
    }
  }

  buildMortar() {
    const M = MATS;

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.3, 8), M.stoneDark);
    plinth.position.y = 0.15; plinth.castShadow = true; plinth.receiveShadow = true;
    this.mesh.add(plinth);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const blk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.32), i % 2 === 0 ? M.stone : M.stoneDark);
      blk.position.set(Math.cos(a) * 0.98, 0.45, Math.sin(a) * 0.98);
      blk.rotation.y = -a + Math.PI / 2;
      blk.castShadow = true; blk.receiveShadow = true;
      this.mesh.add(blk);
    }

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.1, 8), M.stone);
    deck.position.y = 0.65; deck.receiveShadow = true; deck.castShadow = true;
    this.mesh.add(deck);

    const turretRing = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.82, 0.15, 24), M.iron);
    turretRing.position.y = 0.78; turretRing.castShadow = true;
    this.mesh.add(turretRing);

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), M.metal);
      rivet.position.set(Math.cos(a) * 0.82, 0.78, Math.sin(a) * 0.82);
      rivet.castShadow = true;
      this.mesh.add(rivet);
    }

    this.turret.position.y = 0.9;
    this.mesh.add(this.turret);

    const bodyOuter = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      M.metalDark
    );
    bodyOuter.scale.set(1, 0.9, 1); bodyOuter.castShadow = true; bodyOuter.receiveShadow = true;
    this.turret.add(bodyOuter);

    const bodyLower = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.2, 20), M.metal);
    bodyLower.position.y = -0.05; bodyLower.castShadow = true;
    this.turret.add(bodyLower);

    const bodyBand = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 24), M.iron);
    bodyBand.rotation.x = Math.PI / 2; bodyBand.position.y = 0.15; bodyBand.castShadow = true;
    this.turret.add(bodyBand);

    const bodyBand2 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 20), M.iron);
    bodyBand2.rotation.x = Math.PI / 2; bodyBand2.position.y = 0.4; bodyBand2.castShadow = true;
    this.turret.add(bodyBand2);

    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), M.metal);
      rivet.position.set(Math.cos(a) * 0.68, 0.15, Math.sin(a) * 0.68);
      this.turret.add(rivet);
    }

    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, 0.2, 0);
    this.turret.add(barrelGroup);
    this.barrelGroup = barrelGroup;

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 1.5, 16), M.metalDark);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, 0.75); barrel.castShadow = true; barrel.receiveShadow = true;
    barrelGroup.add(barrel);

    for (let i = 0; i < 4; i++) {
      const z = 0.25 + i * 0.32;
      const r = 0.21 + i * 0.008;
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 8, 20), M.iron);
      band.rotation.x = Math.PI / 2; band.position.set(0, 0, z); band.castShadow = true;
      barrelGroup.add(band);
    }

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.21, 0.12, 16), M.iron);
    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0, 1.54); muzzle.castShadow = true;
    barrelGroup.add(muzzle);

    const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16), M.black);
    bore.rotation.x = Math.PI / 2; bore.position.set(0, 0, 1.6);
    barrelGroup.add(bore);

    const breech = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.35, 16), M.metal);
    breech.rotation.x = Math.PI / 2; breech.position.set(0, 0, 0.15); breech.castShadow = true;
    barrelGroup.add(breech);

    const backCap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), M.iron);
    backCap.rotation.x = Math.PI / 2; backCap.position.set(0, 0, -0.05); backCap.castShadow = true;
    barrelGroup.add(backCap);

    const trunnionL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 12), M.iron);
    trunnionL.rotation.z = Math.PI / 2; trunnionL.position.set(0.4, 0.2, 0.5); trunnionL.castShadow = true;
    this.turret.add(trunnionL);
    const trunnionR = trunnionL.clone(); trunnionR.position.set(-0.4, 0.2, 0.5); this.turret.add(trunnionR);

    const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), M.iron);
    sightBase.position.set(0, 0.6, 0.4); sightBase.castShadow = true;
    this.turret.add(sightBase);

    const sightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 6), M.iron);
    sightPost.position.set(0, 0.66, 0.4);
    this.turret.add(sightPost);

    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), M.wood);
    crate.position.set(0.75, 0.15, 0.4); crate.castShadow = true; crate.receiveShadow = true;
    this.mesh.add(crate);

    for (let i = 0; i < 2; i++) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.02), M.iron);
      strap.position.set(0.75, 0.15, 0.4 + (i === 0 ? 0.12 : -0.12));
      this.mesh.add(strap);
    }

    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), M.iron);
      ball.position.set(0.66 + i * 0.1, 0.34, 0.4); ball.castShadow = true;
      this.mesh.add(ball);
    }
  }

  buildIceSpire() {
    const M = MATS;

    const stoneBase = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.28, 10), M.stoneDark);
    stoneBase.position.y = 0.14; stoneBase.castShadow = true; stoneBase.receiveShadow = true;
    this.mesh.add(stoneBase);

    const snowCap = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.02, 0.15, 10), M.snow);
    snowCap.position.y = 0.35; snowCap.castShadow = true; snowCap.receiveShadow = true;
    this.mesh.add(snowCap);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.08, 8, 6), M.snow);
      bump.position.set(Math.cos(a) * (0.7 + Math.random() * 0.25), 0.4, Math.sin(a) * (0.7 + Math.random() * 0.25));
      bump.scale.set(1, 0.5, 1); bump.castShadow = true;
      this.mesh.add(bump);
    }

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.PI / 14;
      const len = 0.35 + Math.random() * 0.35;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, len, 4), M.ice);
      spike.position.set(Math.cos(a) * 0.8, 0.45 + len / 2, Math.sin(a) * 0.8);
      spike.rotation.z = Math.sin(a) * 0.5;
      spike.rotation.x = -Math.cos(a) * 0.5;
      spike.castShadow = true;
      this.mesh.add(spike);
    }

    const spire1 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 6), M.ice);
    spire1.position.y = 1.15; spire1.castShadow = true;
    this.mesh.add(spire1);

    const spire2 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.4, 6), M.ice);
    spire2.position.y = 2.05; spire2.rotation.y = Math.PI / 6; spire2.castShadow = true;
    this.mesh.add(spire2);

    const spire3 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.0, 6), M.iceGlow);
    spire3.position.y = 2.85; spire3.rotation.y = Math.PI / 3; spire3.castShadow = true;
    this.mesh.add(spire3);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, 0.02), M.metalDark);
      rib.position.set(Math.cos(a) * 0.36, 1.4, Math.sin(a) * 0.36);
      this.mesh.add(rib);
    }

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xa8f0ff, transparent: true, opacity: 0.85 }));
    core.position.y = 1.8;
    this.mesh.add(core);
    this.core = core;

    const coreLight = new THREE.PointLight(0x7fe9ff, 0.9, 5);
    coreLight.position.y = 1.8;
    this.mesh.add(coreLight);

    const crystalPositions = [
      { a: 0,             r: 0.85, y: 0.55, s: 1.0 },
      { a: Math.PI / 3,   r: 0.9,  y: 0.6,  s: 0.9 },
      { a: 2*Math.PI / 3, r: 0.82, y: 0.5,  s: 1.1 },
      { a: Math.PI,       r: 0.88, y: 0.58, s: 0.95 },
      { a: 4*Math.PI / 3, r: 0.85, y: 0.52, s: 1.05 },
      { a: 5*Math.PI / 3, r: 0.92, y: 0.55, s: 0.9 }
    ];
    for (const cp of crystalPositions) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.15 * cp.s, 0), M.iceGlow);
      crystal.position.set(Math.cos(cp.a) * cp.r, cp.y, Math.sin(cp.a) * cp.r);
      crystal.rotation.set(Math.random(), Math.random(), Math.random());
      crystal.scale.set(0.7, 1.6, 0.7);
      crystal.castShadow = true;
      this.mesh.add(crystal);
    }

    this.turret.position.y = 3.5;
    this.mesh.add(this.turret);

    const topCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), M.iceGlow);
    this.turret.add(topCrystal);
    this.topCrystal = topCrystal;

    this.floaters = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), M.iceGlow);
      shard.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
      shard.scale.set(0.7, 1.5, 0.7);
      this.turret.add(shard);
      this.floaters.push({ mesh: shard, angle: a, radius: 0.4 });
    }

    const topLight = new THREE.PointLight(0xbff5ff, 1.2, 5);
    this.turret.add(topLight);

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const len = 0.08 + Math.random() * 0.14;
      const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.025, len, 4), M.ice);
      icicle.position.set(Math.cos(a) * 0.98, 0.28 - len / 2, Math.sin(a) * 0.98);
      icicle.rotation.x = Math.PI;
      icicle.castShadow = true;
      this.mesh.add(icicle);
    }
  }

  dispose() {
    scene.remove(this.mesh);
    this.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !Object.values(MATS).includes(o.material)) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }

  updateLevelDots() {
    if (!this.levelDots) return;
    this.levelDots.forEach((d, i) => d.visible = i < this.level);
  }

  animate(dt) {
    if (this.flame) {
      const s = 0.9 + Math.sin(game.time * 12 + this.x) * 0.15;
      this.flame.scale.setScalar(s);
    }
    if (this.windowLight) {
      this.windowLight.material.opacity = 0.85 + Math.sin(game.time * 3 + this.z) * 0.15;
    }
    if (this.core) {
      const s = 0.9 + Math.sin(game.time * 2.5 + this.x) * 0.1;
      this.core.scale.setScalar(s);
    }
    if (this.topCrystal) {
      this.topCrystal.rotation.y += dt * 1.5;
      this.topCrystal.rotation.x += dt * 0.7;
    }
    if (this.floaters) {
      for (const f of this.floaters) {
        f.angle += dt * 1.2;
        f.mesh.position.set(
          Math.cos(f.angle) * f.radius,
          Math.sin(game.time * 2 + f.angle) * 0.08,
          Math.sin(f.angle) * f.radius
        );
        f.mesh.rotation.x += dt * 2;
        f.mesh.rotation.y += dt * 1.5;
      }
    }
  }
}

/* ============================================================
   ВРАГ
   ============================================================ */
class Enemy {
  constructor(type, wave) {
    const def = ENEMY_TYPES[type];
    const scale = Math.pow(1.15, wave - 1);
    this.type = type;
    this.maxHp = Math.round(def.hp * scale);
    this.hp = this.maxHp;
    this.baseSpeed = def.speed * (1 + Math.min(0.4, wave * 0.008));
    this.reward = Math.round(def.reward * (1 + wave * 0.04));
    this.radius = def.radius;
    this.color = def.color;
    this.accent = def.accent;
    this.x = WAYPOINTS[0].x;
    this.z = WAYPOINTS[0].z;
    this.wp = 1;
    this.dist = 0;
    this.slowTimer = 0;
    this.slowAmount = 0;
    this.hitFlash = 0;
    this.alive = true;
    this.phase = Math.random() * Math.PI * 2;
    this.dirAngle = 0;
    this.bobPhase = Math.random() * Math.PI * 2;

    this.mesh = new THREE.Group();
    this.mesh.position.set(this.x, 0.6, this.z);
    this.buildMesh();
    scene.add(this.mesh);
  }

  buildMesh() {
    const r = this.radius;
    if (this.type === 'normal') this.buildSlime(r);
    else if (this.type === 'fast') this.buildWisp(r);
    else if (this.type === 'tank') this.buildTank(r);
    else this.buildBoss(r);
  }

  buildSlime(r) {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 14, 12),
      new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.5, metalness: 0.1 })
    );
    body.scale.set(1, 0.85, 1);
    body.castShadow = true; body.receiveShadow = true;
    this.mesh.add(body);
    this.bodyMesh = body;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.SphereGeometry(r * 0.16, 8, 6);
    const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(r * 0.35, r * 0.25, r * 0.75); this.mesh.add(e1);
    const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(-r * 0.35, r * 0.25, r * 0.75); this.mesh.add(e2);
  }

  buildWisp(r) {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 12, 10),
      new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.1 })
    );
    body.scale.set(1.6, 0.85, 0.85);
    body.castShadow = true;
    this.mesh.add(body);
    this.bodyMesh = body;
    this.mesh.add(new THREE.PointLight(this.color, 0.4, 3));
  }

  buildTank(r) {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 14, 12),
      new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.5, metalness: 0.4 })
    );
    body.castShadow = true; body.receiveShadow = true;
    this.mesh.add(body);
    this.bodyMesh = body;
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.05, 6, 24), ringMat);
    ring1.rotation.x = Math.PI / 2; this.mesh.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.85, 0.05, 6, 24), ringMat);
    ring2.rotation.z = Math.PI / 4; this.mesh.add(ring2);
    this.ring2 = ring2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    eye.position.set(r * 0.7, 0, 0);
    this.mesh.add(eye);
  }

  buildBoss(r) {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 14),
      new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.4, metalness: 0.5 })
    );
    body.castShadow = true; body.receiveShadow = true;
    this.mesh.add(body);
    this.bodyMesh = body;
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x0a1520, roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.25, r * 0.55, 6), spikeMat);
      spike.position.set(Math.cos(a) * r * 0.9, r * 0.4, Math.sin(a) * r * 0.9);
      spike.rotation.z = -Math.PI / 4;
      spike.rotation.y = -a + Math.PI / 2;
      spike.castShadow = true;
      this.mesh.add(spike);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
    const eyeGeo = new THREE.SphereGeometry(r * 0.14, 8, 6);
    const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(r * 0.4, r * 0.15, r * 0.75); this.mesh.add(e1);
    const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(-r * 0.4, r * 0.15, r * 0.75); this.mesh.add(e2);
    this.mesh.add(new THREE.PointLight(0xff3030, 1.0, 5));
  }

  dispose() {
    scene.remove(this.mesh);
    this.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }

  sync() {
    this.mesh.position.set(this.x, 0.6, this.z);
    if (this.bodyMesh && this.type !== 'fast') {
      this.bodyMesh.position.y = Math.sin(this.bobPhase) * 0.08;
    }
    if (this.type === 'fast') this.mesh.rotation.y = -this.dirAngle + Math.PI / 2;
    if (this.ring2) this.ring2.rotation.x += 0.03;
  }
}

/* ============================================================
   СНАРЯД
   ============================================================ */
class Projectile {
  constructor(tower, target) {
    this.type = tower.type;
    this.x = tower.x; this.y = 1.5; this.z = tower.z;
    this.target = target;
    this.speed = tower.def.projSpeed;
    this.damage = tower.damage;
    this.splash = tower.def.splash > 0 ? tower.def.splash * (1 + 0.15 * (tower.level - 1)) : 0;
    this.slow = tower.def.slow;
    this.slowDur = tower.def.slowDur;
    this.color = tower.def.color;
    this.alive = true;
    this.angle = 0;
    this.spin = 0;
    this.mesh = this.createMesh();
    scene.add(this.mesh);
  }

  createMesh() {
    if (this.type === 'arrow') {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: 0xc9a06a }));
      shaft.rotation.z = Math.PI / 2;
      g.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 6),
        new THREE.MeshStandardMaterial({ color: 0xdcd6b8, metalness: 0.6 }));
      tip.rotation.z = -Math.PI / 2; tip.position.x = 0.3;
      g.add(tip);
      return g;
    }
    if (this.type === 'cannon') {
      return new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.4, emissive: 0xff6030, emissiveIntensity: 0.8 }));
    }
    return new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({ color: 0xbff5ff, emissive: 0x4ab9c9, emissiveIntensity: 1.2, roughness: 0.2 }));
  }

  dispose() {
    scene.remove(this.mesh);
    this.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  update(dt) {
    this.spin += dt * 8;
    if (this.target && this.target.alive) {
      const dx = this.target.x - this.x;
      const dy = 0.6 - this.y;
      const dz = this.target.z - this.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const step = this.speed * dt;
      if (d <= step + this.target.radius) { this.hitAt(this.target.x, this.target.z); return; }
      this.x += (dx / d) * step; this.y += (dy / d) * step; this.z += (dz / d) * step;
      this.angle = Math.atan2(dx, dz);
    } else {
      this.hitAt(this.x, this.z);
    }
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.angle;
    if (this.type === 'frost') this.mesh.rotation.x = this.spin;
    if (this.type === 'cannon') this.mesh.rotation.z = this.spin * 0.5;
  }

  hitAt(x, z) {
    this.alive = false;
    this.dispose();
    if (this.splash > 0) {
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d <= this.splash + e.radius) {
          damageEnemy(e, this.damage);
          if (this.slow > 0) applySlow(e, this.slow, this.slowDur);
        }
      }
      spawnParticles(x, 1, z, 0xffb066, 18, 4, 0.6);
      spawnParticles(x, 1, z, 0x552010, 12, 2.5, 0.7);
      return;
    }
    if (this.target && this.target.alive) {
      damageEnemy(this.target, this.damage);
      if (this.slow > 0) applySlow(this.target, this.slow, this.slowDur);
      spawnParticles(x, 1, z, this.color, 5, 3, 0.4);
    }
  }
}

/* ============================================================
   СОСТОЯНИЕ ИГРЫ
   ============================================================ */
const game = {
  state: 'menu',
  money: 150, lives: 20, wave: 0, score: 0, speed: 1,
  enemies: [], towers: [], projectiles: [],
  spawnQueue: [], spawnTimer: 0, waveActive: false,
  selectedType: 'arrow', hover: null, time: 0
};

function towerAt(col, row) {
  return game.towers.find(t => t.col === col && t.row === row) || null;
}

function damageEnemy(e, amount) {
  if (!e.alive) return;
  e.hp -= amount;
  e.hitFlash = 0.12;
  if (e.bodyMesh) {
    e.bodyMesh.material.emissive = new THREE.Color(0xffffff);
    e.bodyMesh.material.emissiveIntensity = 0.6;
  }
  if (e.hp <= 0) {
    e.alive = false;
    game.money += e.reward;
    game.score += Math.round(e.maxHp);
    spawnParticles(e.x, 1, e.z, e.color, 16, 4, 0.7);
    spawnParticles(e.x, 1, e.z, e.accent, 8, 3, 0.5);
    SFX.enemyDeath();
  }
}

function applySlow(e, amount, dur) {
  const val = e.type === 'boss' ? amount * 0.5 : amount;
  e.slowAmount = Math.max(e.slowAmount, val);
  e.slowTimer = Math.max(e.slowTimer, dur);
}

function buildWave(n) {
  const queue = [];
  let t = 0;
  const count = 5 + Math.floor(n * 1.6);
  const gap = Math.max(0.32, 0.85 - n * 0.025);
  for (let i = 0; i < count; i++) {
    let type = 'normal';
    if (n >= 2 && i % 5 === 4) type = 'fast';
    if (n >= 3 && i % 7 === 6) type = 'tank';
    if (n >= 6 && i % 11 === 10) type = 'tank';
    queue.push({ type, time: t });
    t += gap;
  }
  if (n % 5 === 0) queue.push({ type: 'boss', time: t + 1.2 });
  return queue;
}

function startWave() {
  if (game.state !== 'playing') return;
  if (game.waveActive) return;
  game.wave++;
  game.waveActive = true;
  game.spawnQueue = buildWave(game.wave);
  game.spawnTimer = 0;
  SFX.waveStart();
  updateHUD();
}

function update(dt) {
  if (game.state !== 'playing') return;
  game.time += dt;

  if (game.waveActive) {
    game.spawnTimer += dt;
    while (game.spawnQueue.length && game.spawnQueue[0].time <= game.spawnTimer) {
      const s = game.spawnQueue.shift();
      game.enemies.push(new Enemy(s.type, game.wave));
    }
  }

  for (const e of game.enemies) updateEnemy(e, dt);
  for (const t of game.towers) { updateTower(t, dt); t.animate(dt); }
  for (const p of game.projectiles) p.update(dt);
  updateParticles(dt);
  updateSnowfall(dt);

  game.enemies = game.enemies.filter(e => {
    if (!e.alive) { e.dispose(); return false; }
    return true;
  });
  game.projectiles = game.projectiles.filter(p => p.alive);

  if (game.waveActive && game.spawnQueue.length === 0 && game.enemies.length === 0) {
    game.waveActive = false;
    game.money += 25 + game.wave * 6;
    game.score += game.wave * 50;
    SFX.waveComplete();
    updateHUD();
  }

  if (game.lives <= 0) gameOver();
}

function updateEnemy(e, dt) {
  if (e.hitFlash > 0) {
    e.hitFlash -= dt;
    if (e.hitFlash <= 0 && e.bodyMesh) {
      e.bodyMesh.material.emissive = new THREE.Color(0x000000);
      e.bodyMesh.material.emissiveIntensity = 0;
    }
  }
  if (e.slowTimer > 0) {
    e.slowTimer -= dt;
    if (e.slowTimer <= 0) e.slowAmount = 0;
  }
  e.bobPhase += dt * 6;
  const speed = e.baseSpeed * (1 - e.slowAmount);
  let remaining = speed * dt;
  while (remaining > 0 && e.wp < WAYPOINTS.length) {
    const target = WAYPOINTS[e.wp];
    const dx = target.x - e.x;
    const dz = target.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d <= remaining) {
      e.x = target.x; e.z = target.z;
      e.dist += d; remaining -= d; e.wp++;
    } else {
      e.x += (dx / d) * remaining;
      e.z += (dz / d) * remaining;
      e.dist += remaining; remaining = 0;
    }
  }
  if (e.wp < WAYPOINTS.length) {
    const target = WAYPOINTS[e.wp];
    e.dirAngle = Math.atan2(target.x - e.x, target.z - e.z);
  }
  if (e.wp >= WAYPOINTS.length) {
    e.alive = false;
    game.lives -= (e.type === 'boss' ? 5 : 1);
    spawnParticles(e.x, 1, e.z, 0xff5555, 18, 4, 0.7);
    SFX.lifeLost();
  }
  e.sync();
  if (e.slowAmount > 0 && e.bodyMesh) {
    e.bodyMesh.material.emissive = new THREE.Color(0x4ab9c9);
    e.bodyMesh.material.emissiveIntensity = 0.4;
  }
}

function findTarget(tower) {
  let bestTarget = null, bestDist = -1;
  const r2 = tower.range * tower.range;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const dx = e.x - tower.x;
    const dz = e.z - tower.z;
    if (dx * dx + dz * dz <= r2 && e.dist > bestDist) {
      bestTarget = e; bestDist = e.dist;
    }
  }
  return bestTarget;
}

function updateTower(t, dt) {
  if (t.cooldown > 0) t.cooldown -= dt;
  if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 4);

  const target = findTarget(t);
  if (!target) return;

  const targetAngle = Math.atan2(target.x - t.x, target.z - t.z);
  let diff = targetAngle - t.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  t.angle += diff * Math.min(1, dt * 10);

  if (t.turret) {
    t.turret.rotation.y = t.angle;
    const rec = t.recoil * 0.2;
    if (t.type === 'cannon') t.turret.position.z = -rec;
    else t.turret.position.z = -rec * 0.5;
  }

  if (t.cooldown <= 0) {
    t.cooldown = 1 / t.fireRate;
    game.projectiles.push(new Projectile(t, target));
    t.recoil = 1;
    if (t.type === 'arrow') SFX.arrowShot();
    else if (t.type === 'cannon') SFX.cannonShot();
    else SFX.frostShot();
    spawnParticles(
      t.x + Math.sin(t.angle) * 1.0, 1.6, t.z + Math.cos(t.angle) * 1.0,
      t.def.color, 3, 2, 0.25
    );
  }
}

/* ============================================================
   КАМЕРА + ВВОД
   ============================================================ */
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

function pointerToWorld(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObject(groundPlaneForRay);
  if (hits.length > 0) return { x: hits[0].point.x, z: hits[0].point.z };
  return null;
}

function doPrimaryClick(e) {
  unlockAudio();
  if (game.state !== 'playing') return;
  const w = pointerToWorld(e.clientX, e.clientY);
  if (!w) return;
  const col = Math.floor(w.x / TILE);
  const row = Math.floor(w.z / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  const existing = towerAt(col, row);
  if (existing) { upgradeTower(existing); return; }
  if (BLOCKED.has(col + ',' + row)) { SFX.error(); return; }
  placeTower(col, row);
}

function doSellClick(e) {
  if (game.state !== 'playing') return;
  const w = pointerToWorld(e.clientX, e.clientY);
  if (!w) return;
  const col = Math.floor(w.x / TILE);
  const row = Math.floor(w.z / TILE);
  const t = towerAt(col, row);
  if (t) sellTower(t);
}

function updateHoverMarker() {
  if (game.state !== 'playing' || !game.hover) {
    hoverMarker.visible = false; rangeMarker.visible = false; return;
  }
  const col = game.hover.col, row = game.hover.row;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
    hoverMarker.visible = false; rangeMarker.visible = false; return;
  }
  const w = tileToWorld(col, row);
  hoverMarker.position.set(w.x, 0.06, w.z);
  const existing = towerAt(col, row);
  if (existing) {
    hoverMarker.material.color.setHex(0x4aa3ff);
    hoverMarker.visible = true;
    rangeMarker.visible = true;
    rangeMarker.position.set(existing.x, 0.07, existing.z);
    rangeMarker.scale.setScalar(existing.range);
    rangeMarker.material.color.setHex(0x4aa3ff);
  } else {
    const ok = !BLOCKED.has(col + ',' + row) && game.money >= TOWER_TYPES[game.selectedType].cost;
    hoverMarker.material.color.setHex(ok ? 0x66ff88 : 0xff5555);
    hoverMarker.visible = true;
    rangeMarker.visible = true;
    rangeMarker.position.set(w.x, 0.07, w.z);
    rangeMarker.scale.setScalar(TOWER_TYPES[game.selectedType].range);
    rangeMarker.material.color.setHex(ok ? 0x66ff88 : 0xff5555);
  }
}

function setupControls() {
  const dom = container3d;
  dom.addEventListener('contextmenu', e => e.preventDefault());

  dom.addEventListener('mousedown', (e) => {
    camState.dragging = true; camState.moved = false;
    camState.lastX = e.clientX; camState.lastY = e.clientY;
    camState.downX = e.clientX; camState.downY = e.clientY;
    camState.downTime = performance.now();
    camState.button = e.button;
    if (e.button === 2) camState.dragMode = 'rotate';
    else if (e.button === 0 || e.button === 1) camState.dragMode = 'pan';
    else camState.dragMode = null;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    const w = pointerToWorld(e.clientX, e.clientY);
    if (w) game.hover = { col: Math.floor(w.x / TILE), row: Math.floor(w.z / TILE) };
    else game.hover = null;
    updateHoverMarker();

    if (!camState.dragging) return;
    const dx = e.clientX - camState.lastX;
    const dy = e.clientY - camState.lastY;
    camState.lastX = e.clientX;
    camState.lastY = e.clientY;
    if (Math.abs(e.clientX - camState.downX) > 4 || Math.abs(e.clientY - camState.downY) > 4) {
      camState.moved = true;
    }
    if (camState.dragMode === 'rotate') {
      camState.theta -= dx * 0.008;
      camState.phi -= dy * 0.008;
      camState.phi = Math.max(camState.minPhi, Math.min(camState.maxPhi, camState.phi));
      updateCamera();
    } else if (camState.dragMode === 'pan') {
      const panSpeed = camState.radius * 0.0016;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) return;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      camState.target.addScaledVector(right, -dx * panSpeed);
      camState.target.addScaledVector(forward, dy * panSpeed);
      updateCamera();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!camState.dragging) return;
    const dt = performance.now() - camState.downTime;
    const wasClick = !camState.moved && dt < 400 && e.button === camState.button;
    const btn = camState.button;
    camState.dragging = false; camState.dragMode = null; camState.button = -1;
    if (wasClick) {
      if (btn === 0) doPrimaryClick(e);
      else if (btn === 2) doSellClick(e);
    }
  });

  window.addEventListener('blur', () => {
    camState.dragging = false; camState.dragMode = null; camState.button = -1;
  });

  dom.addEventListener('mouseleave', () => {
    if (!camState.dragging) { game.hover = null; updateHoverMarker(); }
  });

  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k = Math.exp(e.deltaY * 0.0012);
    camState.radius = Math.max(camState.minRadius, Math.min(camState.maxRadius, camState.radius * k));
    updateCamera();
  }, { passive: false });

  let touchMode = null, lastDist = 0, lastX = 0, lastY = 0, touchMoved = false, touchStart = 0;
  dom.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchMode = 'rotate';
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      touchMoved = false; touchStart = performance.now();
    } else if (e.touches.length === 2) {
      touchMode = 'pinch';
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist = Math.hypot(dx, dy);
    }
  }, { passive: true });

  dom.addEventListener('touchmove', (e) => {
    if (touchMode === 'rotate' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) touchMoved = true;
      camState.theta -= dx * 0.008;
      camState.phi -= dy * 0.008;
      camState.phi = Math.max(camState.minPhi, Math.min(camState.maxPhi, camState.phi));
      updateCamera();
    } else if (touchMode === 'pinch' && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const k = lastDist / dist;
      camState.radius = Math.max(camState.minRadius, Math.min(camState.maxRadius, camState.radius * k));
      lastDist = dist;
      updateCamera();
    }
  }, { passive: true });

  dom.addEventListener('touchend', (e) => {
    if (touchMode === 'rotate' && !touchMoved && performance.now() - touchStart < 400) {
      doPrimaryClick(e.changedTouches[0]);
    }
    touchMode = null;
  }, { passive: true });
}

/* ============================================================
   UI
   ============================================================ */
function updateMapButton() {
  mapBtn.textContent = mapMode === 'winter' ? '❄️' : '☀️';
}
updateMapButton();

mapBtn.addEventListener('click', () => {
  unlockAudio();
  mapMode = mapMode === 'winter' ? 'summer' : 'winter';
  try { localStorage.setItem(MAP_KEY, mapMode); } catch (e) {}
  updateMapButton();
  SFX.uiClick();
  buildMap();
});

for (const btn of towerButtons) {
  btn.addEventListener('click', () => {
    unlockAudio();
    game.selectedType = btn.dataset.type;
    SFX.uiClick();
    updateHUD();
    updateHoverMarker();
  });
}
waveBtn.addEventListener('click', () => { unlockAudio(); if (!waveBtn.disabled) startWave(); });
speedBtn.addEventListener('click', () => {
  unlockAudio();
  game.speed = game.speed === 1 ? 2 : game.speed === 2 ? 3 : 1;
  SFX.uiClick();
  updateHUD();
});
overlayBtn.addEventListener('click', () => {
  unlockAudio();
  overlay.classList.add('hidden');
  resetGame();
  SFX.uiClick();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); if (game.state === 'playing' && !game.waveActive) startWave(); }
  if (e.key === '1') { game.selectedType = 'arrow';  updateHUD(); updateHoverMarker(); }
  if (e.key === '2') { game.selectedType = 'cannon'; updateHUD(); updateHoverMarker(); }
  if (e.key === '3') { game.selectedType = 'frost';  updateHUD(); updateHoverMarker(); }
  if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') muteBtn.click();
  if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') mapBtn.click();
  if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
    camState.target.set(WORLD_W / 2, 0, WORLD_D / 2);
    camState.radius = 42; camState.theta = 1.2; camState.phi = 0.85;
    updateCamera();
  }
});

/* ============================================================
   ЛОГИКА
   ============================================================ */
function placeTower(col, row) {
  const def = TOWER_TYPES[game.selectedType];
  if (game.money < def.cost) { SFX.error(); return; }
  game.money -= def.cost;
  const t = new Tower(game.selectedType, col, row);
  game.towers.push(t);
  spawnParticles(t.x, 1, t.z, def.color, 12, 3, 0.5);
  SFX.towerPlace();
  updateHUD();
}
function upgradeTower(t) {
  if (t.level >= 3) { SFX.error(); return; }
  const cost = t.upgradeCost;
  if (game.money < cost) { SFX.error(); return; }
  game.money -= cost;
  t.spent += cost; t.level++;
  t.updateLevelDots();
  spawnParticles(t.x, 1.5, t.z, 0xffd76a, 14, 3, 0.6);
  SFX.towerUpgrade();
  updateHUD();
}
function sellTower(t) {
  game.money += t.sellValue;
  const idx = game.towers.indexOf(t);
  if (idx >= 0) game.towers.splice(idx, 1);
  spawnParticles(t.x, 1, t.z, 0xffd76a, 14, 3, 0.6);
  t.dispose();
  SFX.towerSell();
  updateHUD();
}
function updateHUD() {
  moneyEl.textContent = Math.floor(game.money);
  livesEl.textContent = Math.max(0, game.lives);
  waveEl.textContent  = game.wave;
  scoreEl.textContent = game.score;
  bestEl.textContent  = Math.max(best.score, game.score);
  waveBtn.textContent = game.waveActive ? 'Волна ' + game.wave + '...' : 'Волна ' + (game.wave + 1);
  waveBtn.disabled = game.waveActive || game.state !== 'playing';
  speedBtn.textContent = 'x' + game.speed;
  for (const btn of towerButtons) {
    const type = btn.dataset.type;
    btn.classList.toggle('active', type === game.selectedType);
    btn.classList.toggle('poor', game.money < TOWER_TYPES[type].cost);
  }
}
function showOverlay(title, text, btnText) {
  overlayTitle.textContent = title;
  overlayText.textContent  = text;
  overlayBtn.textContent   = btnText;
  overlay.classList.remove('hidden');
}
function resetGame() {
  game.state = 'playing';
  game.money = 150; game.lives = 20; game.wave = 0; game.score = 0; game.speed = 1;
  game.enemies.forEach(e => e.dispose());
  game.towers.forEach(t => t.dispose());
  game.projectiles.forEach(p => p.dispose());
  game.enemies = []; game.towers = []; game.projectiles = [];
  game.spawnQueue = []; game.spawnTimer = 0;
  game.waveActive = false; game.selectedType = 'arrow';
  game.hover = null; game.time = 0;
  updateHUD();
}
function gameOver() {
  game.state = 'gameover';
  game.speed = 1;
  if (game.score > best.score) {
    best = { score: game.score, wave: game.wave };
    saveBest(best);
  }
  SFX.gameOver();
  showOverlay(
    'Игра окончена',
    'Счёт: ' + game.score + ' • Волна: ' + game.wave + ' • Рекорд: ' + best.score,
    'Играть снова'
  );
  updateHUD();
}

/* ============================================================
   RESIZE
   ============================================================ */
function onResize() {
  if (!renderer || !camera) return;
  const w = container3d.clientWidth;
  const h = Math.max(1, container3d.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

/* ============================================================
   ГЛАВНЫЙ ЦИКЛ
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (game.state === 'playing') {
    for (let i = 0; i < game.speed; i++) {
      update(dt);
      if (game.state !== 'playing') break;
    }
  } else {
    updateParticles(dt);
    updateSnowfall(dt);
  }
  renderer.render(scene, camera);
}

/* ============================================================
   СТАРТ
   ============================================================ */
setupThree();
setupControls();
onResize();

showOverlay(
  'Tower Defense 3D',
  'Управление: ЛКМ-клик — построить/улучшить башню. ПКМ-клик — продать. ' +
  'ЛКМ-перетаскивание — панорама. ПКМ-перетаскивание — вращение камеры. ' +
  'Колесо — зум. N — сменить карту (☀️/❄️). Клавиши 1-2-3 — башня, Space — волна, R — сброс камеры, M — звук.',
  'Играть'
);

updateHUD();
requestAnimationFrame(animate);