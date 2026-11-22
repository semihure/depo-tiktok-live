// Ana döngü: üç boyutlu sahne + bloom, oyun, ses, kamera, arayüz, canlı bağlantı (SSE).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createClub } from './sahne.js';
import { createCrowd } from './dansci.js';
import { createGame } from './oyun.js';
import { createAudio } from './ses.js';
import { createDirector } from './kamera.js';
import { createUI } from './arayuz.js';
import { createDemo } from './demo.js';
import { createMinigames } from './oyunlar.js';

const params = new URLSearchParams(location.search);
if (params.has('clean')) document.body.classList.add('clean');

// ---------- kalite ----------
// panel ve sahne ayrı pencereler; aynı adreste oldukları için localStorage ortak → panel seçince sahne de değişir
const QUALITY = {
  low: { pr: 0.75, bloom: false, parts: 1500, fog: 30, disco: 60 },
  mid: { pr: 1, bloom: true, parts: 3000, fog: 60, disco: 120 },
  high: { pr: 2, bloom: true, parts: 4000, fog: 60, disco: 160 }, // Retina/4K ekranda tam çözünürlük (yayın için)
};
function readQuality() {
  const q = params.get('q');
  if (QUALITY[q]) return q;
  try { const s = localStorage.getItem('depo.quality'); if (QUALITY[s]) return s; } catch {}
  return 'mid';
}
let qName = readQuality();

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 9 / 16, 0.1, 120);

const club = createClub(scene, QUALITY[qName]);
const crowd = createCrowd(scene, 240);
const audio = createAudio();
const game = createGame({ club, crowd, audio });
const director = createDirector(camera);
const mini = createMinigames({ game, audio, club });
game.minigames = mini;
const demo = createDemo(game, mini, audio);

// ---------- canlı bağlantı ----------
const live = {
  connect: (username) => post('/api/connect', { username }),
  disconnect: () => post('/api/disconnect'),
};
function post(url, body) { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).catch(() => {}); }

const ui = createUI({ game, crowd, club, audio, camera, live, demo, mini, quality: { get: () => qName, set: setQuality } });
game.on('focus', (f) => director.focusOn(f));

if (location.protocol !== 'file:' && window.EventSource) {
  const es = new EventSource('/api/events');
  es.onmessage = (e) => {
    let ev; try { ev = JSON.parse(e.data); } catch { return; }
    if (ev.type === 'status') return ui.setStatus(ev.status);
    demo.receive(ev); // panelden gelen yayın kontrolü ya da TikTok/test olayı
  };
  fetch('/api/status').then((r) => r.json()).then((j) => game.setResident(j.residentDj)).catch(() => {});
  fetch('/api/rules').then((r) => r.json()).then((j) => { if (j.hata) console.warn(j.hata); game.setRules(j.kurallar); }).catch(() => {});
  audio.loadTracks();
}

// ---------- bloom ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(540, 960), 0.55, 0.45, 0.55);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const frame = document.getElementById('frame');
  const w = frame.clientWidth, h = frame.clientHeight;
  const pr = Math.min(window.devicePixelRatio || 1, QUALITY[qName].pr);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  ui.resize(Math.round(w * pr), Math.round(h * pr));
}
function setQuality(name, save = true) {
  if (!QUALITY[name]) return;
  qName = name;
  club.setQuality(QUALITY[name]);
  if (save) { try { localStorage.setItem('depo.quality', name); } catch {} }
  resize();
}
window.addEventListener('resize', resize);
window.addEventListener('storage', (e) => { if (e.key === 'depo.quality' && !params.get('q')) setQuality(e.newValue, false); });
resize();

// ---------- döngü ----------
// görsel zaman (vdt) ağır çekimde yavaşlar; ses ve oyun mantığı gerçek zamanda kalır
let last = performance.now(), fpsAcc = 0, fpsN = 0, lowFpsT = 0;
const fpsEl = document.getElementById('fps');
function frame(dt) {
  demo.tick(dt);
  game.update(dt);
  mini.tick(dt);
  crowd.groove = game.groove;
  crowd.build = game.lockT > 0 ? 0 : game.build;
  const vdt = dt * game.timeScale;
  // kafaların kenar parlaması vuruşla nabız atar (vurgu renginde)
  const ph = ((game.vbeat % 1) + 1) % 1, pulse = Math.pow(1 - ph, 3);
  crowd.setRim(club.accent, 0.18 + pulse * (0.45 + game.energy / 250) + club.flashA);
  crowd.update(vdt, game.vtime, game.vbeat, game.energy, game.dropAge);
  club.update(vdt, game.vtime, game.vbeat, game.energy, game.build);
  director.crowdN = crowd.list.length;
  director.update(vdt, game.vtime, game.beat);
  if (QUALITY[qName].bloom) {
    bloom.strength = 0.45 + game.energy / 600 + club.flashA * 0.5;
    composer.render();
  } else renderer.render(scene, camera);
  ui.tick(dt);
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  frame(dt);
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) {
    const fps = Math.round(fpsN / fpsAcc);
    // 10 sn boyunca 25 FPS altı → panelde uyarı
    lowFpsT = fps < 25 && document.visibilityState === 'visible' ? lowFpsT + fpsAcc : 0;
    ui.setFps(fps, crowd.list.length, lowFpsT > 10 && qName !== 'low');
    fpsAcc = 0; fpsN = 0;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// hata ayıklama: DEPO.step(90) → simülasyonu 3 sn ileri sarar (arka plandaki sekmede test için)
window.DEPO = { game, club, crowd, audio, director, camera, mini, setQuality, step: (n = 30) => { for (let i = 0; i < n; i++) frame(1 / 30); } };
