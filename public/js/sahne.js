// Club sahnesi — "arkadan kalabalık" kadrajı: gri tonlar + tek vurgu rengi.
// Sabit kamera kalabalığın arkasında; sahne kadrajın üst üçte birinde, VIP platformu sahnenin sağ önünde.
// Koordinatlar: pist merkezde, sahne arkada (z ≈ -9), kamera önde (z ≈ 9.5).
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// izleyicinin seçebildiği renkler (yalnızca kendi saçı ve ışık çubuğu)
export const NEON = {
  mor: '#b14dff', yesil: '#39ff88', pembe: '#ff3fb4', mavi: '#3fa8ff', sari: '#ffe14d',
  kirmizi: '#ff3b4f', turuncu: '#ff8a2b', beyaz: '#f4f4ff', turkuaz: '#2bffe9',
};
// müzik tarzına göre tek vurgu rengi
// ekranda görünen tarz adları (Türkçe pop/rap yayını için)
export const MODE_LABEL = { pop: 'POP', rap: 'RAP', trap: 'TRAP', rnb: 'R&B' };
export const modeLabel = (m) => MODE_LABEL[m] || String(m || '').toUpperCase();
export const ACCENTS = { pop: '#ff4fa3', rap: '#8cff3a', trap: '#ff3b5c', rnb: '#a46bff', festival: '#ffc23d' };
// sabit kamera (kamera.js ve pist yerleşimi bunu kullanır)
export const CAM = { pos: V(0, 6.9, 12.6), look: V(0, 1.1, -3.0), fov: 41 }; // yakın: kalabalık telefonda görünen orta şeridi doldursun

function gradTex(stops) {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dotTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
// 3 kademeli çizgi film gölgelemesi
export function toonRamp() {
  const t = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}

export function createClub(scene, quality) {
  const S = {
    stage: V(0, 0, -9), booth: V(0, 1.55, -8.4), door: V(4.8, 0, 9.5),
    floor: { x0: -5.2, x1: 5.2, z0: -6.8, z1: 1.4 }, // z1: daha öndeki sıralar telefonda TikTok yorumlarının altında kalır
    // VIP platformu: sahnenin sağ önünde, kalabalığın üstünde
    vipSlots: [V(3.05, 2.35, -6.3), V(3.85, 2.35, -6.3), V(3.05, 2.35, -5.45), V(3.85, 2.35, -5.45)],
    podiums: [V(-2.5, 0.7, -1.6), V(2.5, 0.7, -1.6)],
    djSpot: V(0, 1.2, -8.95),
    lasersBoost: 0, strobeOn: true, festival: 0, lastFlash: -9, flashA: 0,
    ledMsg: null, dj: null, mode: 'pop', bpm: 124,
    disco: 0, outdoorK: 0, q: quality || { parts: 3000, fog: 60, disco: 120 },
    accent: new THREE.Color(ACCENTS.pop), bars: 0,
  };
  // kadrajda mı? (sabit kamera, 9:16) — pist yerleri yalnızca görünen alana konur
  const tanH = Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) * (9 / 16);
  S.inFrame = (x, z, margin = 0.9) => Math.abs(x) < (CAM.pos.z - z) * tanH * margin;

  scene.background = new THREE.Color('#07070a');
  scene.fog = new THREE.FogExp2('#0b0b10', 0.03);

  // ---------- ışıklar: kalabalık gri kalsın diye beyaz/nötr ----------
  scene.add(new THREE.HemisphereLight('#c9c9d2', '#1a1a20', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 1.4); key.position.set(-3, 9, 10); scene.add(key);
  const amb = new THREE.AmbientLight('#ffffff', 0.25); scene.add(amb);
  const stageLight = new THREE.PointLight('#ffffff', 10, 9, 1.5); stageLight.position.set(0, 4, -7); scene.add(stageLight);

  // ---------- malzemeler ----------
  const ramp = toonRamp();
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
  const dark = toon('#26262c');
  const mid = toon('#3c3c44');
  const metal = toon('#55555e');
  const lineMat = new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide });
  const glow = () => new THREE.MeshBasicMaterial({ color: S.accent.clone(), toneMapped: false });
  const glowMats = []; // vurgu rengine bağlı malzemeler
  const accentMat = (k = 1) => { const m = glow(); m.userData.k = k; glowMats.push(m); return m; };
  const add = (m, parent = scene) => { parent.add(m); return m; };
  // kontur çizgili kutu (çizim hissi)
  const box = (w, h, d, mat, x, y, z, parent = scene, outline = true) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = add(new THREE.Mesh(g, mat), parent); m.position.set(x, y, z);
    if (outline) { const o = new THREE.Mesh(g, lineMat); o.scale.set(1 + 0.05 / w, 1 + 0.05 / h, 1 + 0.05 / d); m.add(o); }
    return m;
  };

  // ---------- zemin: koyu, hafif vurgu ızgarası ----------
  const gridCv = document.createElement('canvas'); gridCv.width = gridCv.height = 256;
  const gg = gridCv.getContext('2d'); gg.fillStyle = '#000'; gg.fillRect(0, 0, 256, 256);
  gg.strokeStyle = '#fff'; gg.lineWidth = 2; for (let i = 0; i <= 256; i += 32) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 256); gg.moveTo(0, i); gg.lineTo(256, i); gg.stroke(); }
  const gridTex = new THREE.CanvasTexture(gridCv); gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(6, 6);
  const floorMat = new THREE.MeshStandardMaterial({ color: '#0d0d10', roughness: 0.6, metalness: 0.3, emissive: '#000000', emissiveMap: gridTex, emissiveIntensity: 1 });
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat)); floor.rotation.x = -Math.PI / 2;

  // ---------- depo kabuğu (festivalde gizlenir) ----------
  const indoor = add(new THREE.Group()); S.indoor = indoor;
  box(30, 12, 0.5, dark, 0, 6, -12.2, indoor, false);
  box(0.5, 12, 30, dark, -7.5, 6, 0, indoor, false);
  box(0.5, 12, 30, dark, 7.5, 6, 0, indoor, false);
  box(30, 0.5, 30, dark, 0, 12, 0, indoor, false);

  // ---------- sahne ----------
  box(10, 1.0, 4.4, mid, 0, 0.5, -9.7);                       // platform
  const edge = add(new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 0.06), accentMat(1))); edge.position.set(0, 1.03, -7.5);
  box(2.8, 1.05, 0.9, metal, 0, 1.52, -8.4);                   // DJ kabini
  const deck = add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.05), accentMat(0.8))); deck.position.set(0, 1.62, -7.94);
  for (const x of [-0.8, 0.8]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 24), dark); d.position.set(x, 2.07, -8.4); add(d); }
  // hoparlör kuleleri (önde daire hoparlörler)
  const cones = [];
  for (const x of [-3.7, 3.7]) for (let k = 0; k < 3; k++) {
    box(1.15, 1.05, 0.9, dark, x, 1.55 + k * 1.1, -9.3);
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 8, 28), metal)); ring.position.set(x, 1.55 + k * 1.1, -8.84);
    const cone = add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), toon('#16161a'))); cone.position.set(x, 1.55 + k * 1.1, -8.83); cones.push(cone);
  }
  // truss + dikdörtgen ışık barları (vuruş desenine göre yanar)
  box(10, 0.2, 0.2, metal, 0, 6.6, -8.2, indoor);
  for (const x of [-4.8, 4.8]) box(0.2, 6.6, 0.2, metal, x, 3.3, -8.2, indoor);
  const bars = [];
  for (let i = 0; i < 8; i++) {
    const m = accentMat(1);
    const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.2, 0.08), m)); b.position.set(-3.85 + i * 1.1, 6.38, -8.1);
    bars.push({ b, m, i });
  }

  // ---------- VIP platformu (sağ ön, kadrajda) ----------
  box(1.9, 0.25, 2.1, metal, 3.45, 2.22, -5.9);                // zemin
  for (const [x, z] of [[2.55, -5.0], [4.35, -5.0], [2.55, -6.8], [4.35, -6.8]]) box(0.12, 2.2, 0.12, metal, x, 1.1, z);
  box(1.9, 0.06, 0.06, metal, 3.45, 2.95, -4.88); box(0.06, 0.06, 2.1, metal, 2.5, 2.95, -5.9); // korkuluk
  const vipGlow = add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.05), accentMat(1))); vipGlow.position.set(3.45, 2.36, -4.85);
  const vipCv = document.createElement('canvas'); vipCv.width = 256; vipCv.height = 96;
  const vg = vipCv.getContext('2d'); vg.font = '900 74px ui-monospace, Menlo, monospace'; vg.textAlign = 'center'; vg.fillStyle = '#fff'; vg.fillText('VIP', 128, 74);
  const vipSignMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(vipCv), transparent: true, toneMapped: false, color: S.accent.clone() });
  glowMats.push(Object.assign(vipSignMat, { userData: { k: 1 } }));
  const vipSign = add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), vipSignMat)); vipSign.position.set(3.45, 3.95, -6.7);
  const vipLight = new THREE.PointLight('#ffffff', 8, 5, 1.5); vipLight.position.set(3.45, 4.3, -5.6); scene.add(vipLight);

  // podyumlar
  const podMats = [];
  for (const p of S.podiums) {
    box(1.3, 0.7, 1.3, mid, p.x, 0.35, p.z);
    const m = accentMat(0.7); const e = add(new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.04, 0.04), m)); e.position.set(p.x, 0.71, p.z + 0.66); podMats.push(m);
  }

  // ---------- LED duvar (küçük, tek renk) ----------
  const led = document.createElement('canvas'); led.width = 512; led.height = 224;
  const lg = led.getContext('2d');
  const ledTex = new THREE.CanvasTexture(led); ledTex.colorSpace = THREE.SRGBColorSpace;
  const ledMesh = add(new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.8), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false, color: '#8a8a8a' })));
  // üst bilgi bloğunun üstünde kalsın (ekranın ~%3–19'u): telefonda TikTok kutucuklarının arasından, yayın penceresinde tamamen görünür
  const LED_Y = 4.6;
  ledMesh.position.set(0, LED_Y, -11.9);

  // ---------- ışık konileri ve lazerler (vurgu rengi) ----------
  const beamTex = gradTex([[0, 'rgba(255,255,255,0)'], [0.75, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0.8)']]);
  const beamGeo = new THREE.ConeGeometry(1.1, 9, 20, 1, true); beamGeo.translate(0, -4.5, 0);
  const beams = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.MeshBasicMaterial({ color: S.accent.clone(), alphaMap: beamTex, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const b = add(new THREE.Mesh(beamGeo, m)); b.position.set(-3.3 + i * 2.2, 6.5, -8.0); beams.push({ m: b, ph: i * 1.3 });
  }
  const laserGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6); laserGeo.translate(0, 0.5, 0); laserGeo.rotateX(Math.PI / 2);
  const lasers = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.MeshBasicMaterial({ color: S.accent.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const l = add(new THREE.Mesh(laserGeo, m)); l.scale.set(1.6, 1.6, 30); l.position.set((i - 4.5) * 0.22, 3.0, -10.6); lasers.push({ m: l, i });
  }

  // ---------- parçacıklar ----------
  const PMAX = 4000;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pts = add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.14, map: dotTex(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  pts.frustumCulled = false;
  const parts = [];
  const tmpC = new THREE.Color();
  S.emit = (x, y, z, vx, vy, vz, col, life, grav = -3, drag = 0.98) => {
    if (parts.length >= Math.min(PMAX, S.q.parts)) parts.shift();
    if (col === 'accent') tmpC.copy(S.accent); else tmpC.set(col);
    parts.push({ x, y, z, vx, vy, vz, r: tmpC.r, g: tmpC.g, b: tmpC.b, life, max: life, grav, drag });
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mono = () => (Math.random() < 0.55 ? 'accent' : Math.random() < 0.6 ? '#ffffff' : '#8a8a94');
  S.confetti = (n = 300) => { for (let i = 0; i < n; i++) S.emit(rnd(-4.5, 4.5), rnd(6.5, 8), rnd(-7, 3), rnd(-0.5, 0.5), rnd(-1, 0), rnd(-0.5, 0.5), mono(), rnd(4, 6), -0.6, 0.995); };
  S.co2 = () => { for (const x of [-4.2, -1.6, 1.6, 4.2]) for (let i = 0; i < 80; i++) S.emit(x + rnd(-0.1, 0.1), 1.05, -7.6, rnd(-0.5, 0.5), rnd(9, 13), rnd(-0.2, 0.5), '#d8d8e0', rnd(0.8, 1.3), -4, 0.93); };
  S.firework = (x = rnd(-4, 4), y = rnd(7, 9), z = rnd(-11, -8)) => {
    const col = Math.random() < 0.6 ? 'accent' : '#ffffff';
    for (let i = 0; i < 130; i++) { const a = Math.random() * Math.PI * 2, b = Math.acos(rnd(-1, 1)), v = rnd(2.5, 4.5); S.emit(x, y, z, Math.sin(b) * Math.cos(a) * v, Math.cos(b) * v, Math.sin(b) * Math.sin(a) * v, col, rnd(1.2, 2), -1.5, 0.97); }
  };
  S.sparkle = (p, col, n = 30) => { for (let i = 0; i < n; i++) S.emit(p.x, p.y, p.z, rnd(-1.5, 1.5), rnd(0.5, 3), rnd(-1.5, 1.5), col, rnd(0.5, 1), -4); };
  S.ring = (p, col) => { for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; S.emit(p.x, p.y - 0.6, p.z, Math.cos(a) * 3, 0.6, Math.sin(a) * 3, col, 0.9, -1, 0.94); } };

  // flaş: saniyede en fazla ~3 (ışığa duyarlılık güvenliği); kapatılabilir
  S.flash = (time, a = 1) => {
    if (!S.strobeOn || time - S.lastFlash < 0.34) return;
    S.lastFlash = time; S.flashA = Math.min(0.5, a * 0.5);
  };
  S.laserShow = (sec = 8) => { S.lasersBoost = Math.max(S.lasersBoost, sec); };
  S.showMsg = (text, sub, sec = 4) => { S.ledMsg = { text, sub, t: sec, max: sec }; };

  // ---------- disko topu ----------
  const ball = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), new THREE.MeshStandardMaterial({ color: '#d0d0d8', metalness: 1, roughness: 0.15, flatShading: true, emissive: '#202028' })));
  ball.position.set(0, 7.0, -3.5);
  const cable = add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 5, 4), metal), indoor); cable.position.set(0, 9.5, -3.5);
  const DMAX = 160, dirs = [];
  for (let i = 0; i < DMAX; i++) { const y = -1 + (i + 0.5) / DMAX * 1.25, r = Math.sqrt(1 - y * y), a = i * 2.39996; dirs.push(V(Math.cos(a) * r, y, Math.sin(a) * r)); }
  const dGeo = new THREE.BufferGeometry(), dPos = new Float32Array(DMAX * 3); dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dMat = new THREE.PointsMaterial({ size: 0.2, map: dotTex(), color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const dPts = add(new THREE.Points(dGeo, dMat)); dPts.frustumCulled = false;
  const tmpV = new THREE.Vector3(), rotQ = new THREE.Quaternion(), up = V(0, 1, 0);
  function updateDisco(dt) {
    S.disco = Math.max(0, S.disco - dt);
    const strong = S.disco > 0 || S.mode === 'rnb' || S.mode === 'pop';
    const target = (strong ? 0.8 : 0.2) * (S.outdoorK > 0.5 ? 0.3 : 1);
    dMat.opacity += (target - dMat.opacity) * Math.min(1, dt * 2);
    ball.rotation.y += dt * 0.6; rotQ.setFromAxisAngle(up, ball.rotation.y);
    const n = Math.min(DMAX, S.q.disco), o = ball.position;
    for (let i = 0; i < n; i++) {
      const d = tmpV.copy(dirs[i]).applyQuaternion(rotQ);
      let t = Infinity;
      if (d.y < -1e-3) t = Math.min(t, -o.y / d.y);
      if (d.x > 1e-3) t = Math.min(t, (7.2 - o.x) / d.x); else if (d.x < -1e-3) t = Math.min(t, (-7.2 - o.x) / d.x);
      if (d.z < -1e-3) t = Math.min(t, (-11.9 - o.z) / d.z); else if (d.z > 1e-3) t = Math.min(t, (10 - o.z) / d.z);
      if (d.y > 1e-3) t = Math.min(t, (11.7 - o.y) / d.y);
      dPos[i * 3] = o.x + d.x * t; dPos[i * 3 + 1] = Math.max(0.03, o.y + d.y * t); dPos[i * 3 + 2] = o.z + d.z * t;
    }
    dGeo.setDrawRange(0, n); dGeo.attributes.position.needsUpdate = true;
  }

  // ---------- yerde sis ----------
  const FMAX = 140;
  const fogTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
  })();
  const fGeo = new THREE.BufferGeometry(), fPos = new Float32Array(FMAX * 3), fCol = new Float32Array(FMAX * 3);
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const fPts = add(new THREE.Points(fGeo, new THREE.PointsMaterial({ size: 3.2, map: fogTex, vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })));
  fPts.frustumCulled = false; fPts.renderOrder = 2;
  const clouds = [];
  for (let i = 0; i < 60; i++) clouds.push({ x: rnd(-6, 6), y: rnd(0.1, 0.45), z: rnd(-8.5, -2), vx: rnd(-0.15, 0.15), vz: rnd(-0.05, 0.12), ph: rnd(0, 6), life: Infinity });
  S.smoke = (n = 30) => {
    for (let i = 0; i < n; i++) {
      if (clouds.length >= FMAX) clouds.splice(60, 1);
      clouds.push({ x: rnd(-4.5, 4.5), y: rnd(0.15, 0.4), z: -7.3, vx: rnd(-0.9, 0.9), vz: rnd(0.8, 1.6), ph: rnd(0, 6), life: rnd(5, 8), max: 8 });
    }
  };
  const fogC = new THREE.Color('#888890'), fogTmp = new THREE.Color();
  function updateFog(dt, time) {
    fogTmp.set('#9a9aa4').lerp(S.accent, 0.25); fogC.lerp(fogTmp, Math.min(1, dt));
    const ambN = Math.min(60, S.q.fog);
    let n = 0;
    for (let i = clouds.length - 1; i >= 60; i--) { const c = clouds[i]; c.life -= dt; if (c.life <= 0) clouds.splice(i, 1); }
    for (let i = 0; i < clouds.length; i++) {
      if (i >= ambN && i < 60) continue;
      const c = clouds[i];
      c.x += (c.vx + Math.sin(time * 0.3 + c.ph) * 0.08) * dt; c.z += c.vz * dt;
      if (c.life === Infinity) { if (c.x > 7) c.x = -7; if (c.x < -7) c.x = 7; if (c.z > -1.5) c.z = -8.5; }
      else { c.vx *= 0.99; c.vz *= 0.985; }
      const near = Math.max(0, Math.min(1, (3.5 - c.z) / 2.5)); // kameraya yaklaşan sis söner
      const k = (c.life === Infinity ? 0.4 * (1 - 0.5 * S.outdoorK) : Math.min(1, (c.max - c.life) * 2, c.life / 2) * 0.8) * near;
      fPos[n * 3] = c.x; fPos[n * 3 + 1] = c.y + Math.sin(time * 0.5 + c.ph) * 0.08; fPos[n * 3 + 2] = c.z;
      fCol[n * 3] = fogC.r * k; fCol[n * 3 + 1] = fogC.g * k; fCol[n * 3 + 2] = fogC.b * k; n++;
    }
    fGeo.setDrawRange(0, n); fGeo.attributes.position.needsUpdate = true; fGeo.attributes.color.needsUpdate = true;
  }

  // ---------- açık hava (festival) ----------
  const outdoor = add(new THREE.Group()); outdoor.visible = false; S.outdoor = outdoor;
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
    uniforms: { k: { value: 0 }, acc: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform float k; uniform vec3 acc;
      void main(){
        float h = clamp(vP.y, -0.2, 1.0);
        vec3 c = mix(vec3(0.07,0.07,0.1), vec3(0.015,0.015,0.03), smoothstep(0.0, 0.6, h));
        c += acc * 0.35 * (1.0 - smoothstep(0.0, 0.14, abs(h - 0.03)));   // ufukta vurgu bandı
        gl_FragColor = vec4(c, k);
      }`,
  });
  outdoor.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), skyMat));
  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 400; i++) { const a = Math.random() * Math.PI * 2, y = rnd(0.25, 1), r = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * r * 55, y * 55, Math.sin(a) * r * 55); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ size: 0.35, map: dotTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  outdoor.add(new THREE.Points(starGeo, starMat));
  const towerLasers = [];
  for (const x of [-6, 6]) {
    box(0.5, 9, 0.5, metal, x, 4.5, -9, outdoor);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshBasicMaterial({ color: S.accent.clone(), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
      const l = new THREE.Mesh(laserGeo, m); l.scale.set(2.2, 2.2, 45); l.position.set(x, 9, -9); outdoor.add(l); towerLasers.push({ m: l, i, side: Math.sign(x) });
    }
  }
  const FOG_IN = new THREE.Color('#0b0b10'), FOG_OUT = new THREE.Color('#0d0d16');
  let wasOutdoor = false;
  function updateOutdoor(dt, time, beat) {
    const want = S.festival > 0 ? 1 : 0;
    S.outdoorK += Math.sign(want - S.outdoorK) * Math.min(Math.abs(want - S.outdoorK), dt);
    const k = S.outdoorK, isOut = k > 0.5;
    if (isOut !== wasOutdoor) { wasOutdoor = isOut; S.flash(time, 1); }
    indoor.visible = !isOut; outdoor.visible = k > 0.01;
    skyMat.uniforms.k.value = k; skyMat.uniforms.acc.value.copy(S.accent); starMat.opacity = k * 0.9;
    scene.fog.color.copy(FOG_IN).lerp(FOG_OUT, k); scene.fog.density = 0.03 - 0.018 * k;
    ledMesh.scale.setScalar(1 + 0.2 * k); ledMesh.position.y = LED_Y;
    if (outdoor.visible) towerLasers.forEach((l) => {
      l.m.material.color.copy(S.accent);
      l.m.rotation.x = -0.9 - 0.4 * Math.sin(time * 0.8 + l.i);
      l.m.rotation.y = -l.side * (0.3 + l.i * 0.18) + Math.sin(time * 1.1 + l.i) * 0.25;
      l.m.material.opacity = k * (0.4 + 0.35 * ((Math.floor(beat) + l.i) % 2));
    });
  }
  S.setQuality = (q) => { S.q = q; };

  // ---------- LED duvar çizimi (tek renk) ----------
  function fitFont(t, size, maxW) { lg.font = `800 ${size}px ui-monospace, Menlo, monospace`; const w = lg.measureText(t).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
  function drawLed(time, beat, energy, buildP) {
    const W = led.width, H = led.height, ph = ((beat % 1) + 1) % 1, bi = Math.floor(beat);
    const acc = '#' + S.accent.getHexString();
    lg.fillStyle = '#030304'; lg.fillRect(0, 0, W, H);
    // nokta matris desen: vuruşta yanan sütunlar
    const cols = 32, rows = 14, cw = W / cols, ch = H / rows;
    for (let x = 0; x < cols; x++) {
      const hgt = Math.floor((0.25 + 0.75 * Math.abs(Math.sin(x * 0.55 + bi * 0.9))) * rows * (0.4 + energy / 170) * (1 - ph * 0.5));
      for (let y = 0; y < rows; y++) {
        const on = rows - y <= hgt;
        lg.fillStyle = on ? acc : '#141418'; lg.globalAlpha = on ? 0.55 : 1;
        lg.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);
      }
    }
    lg.globalAlpha = 1;
    lg.textAlign = 'center'; lg.textBaseline = 'middle';
    const msg = S.ledMsg;
    // her zaman büyük DEPO; DJ, tarz ve BPM altta küçük satırda (duyurular kısa süre üzerine yazar)
    const title = msg ? msg.text : 'DEPO';
    const sub = msg ? msg.sub : `${S.dj ? '🎧 ' + S.dj + ' · ' : ''}${modeLabel(S.mode)} · ${S.bpmHidden ? '???' : Math.round(S.bpm)} BPM`;
    const k = msg ? Math.min(1, (msg.max - msg.t) * 3, msg.t * 2) : 1;
    lg.globalAlpha = k;
    lg.fillStyle = 'rgba(0,0,0,0.65)'; lg.fillRect(0, H / 2 - 62, W, 124);
    lg.fillStyle = '#ffffff'; lg.font = `800 ${fitFont(title, 78, W - 40)}px ui-monospace, Menlo, monospace`; lg.fillText(title, W / 2, H / 2 - 14);
    lg.font = '700 24px ui-monospace, Menlo, monospace'; lg.fillStyle = acc; lg.fillText(sub || '', W / 2, H / 2 + 38);
    lg.globalAlpha = 1;
    if (buildP > 0.6) { lg.fillStyle = `rgba(255,255,255,${(buildP - 0.6) * 0.5 * (1 - ph)})`; lg.fillRect(0, 0, W, H); }
    ledTex.needsUpdate = true;
  }

  // ---------- kare güncelleme ----------
  const accTarget = new THREE.Color();
  let ledAcc = 0;
  S.update = (dt, time, beat, energy, buildP) => {
    const ph = ((beat % 1) + 1) % 1, pulse = Math.pow(1 - ph, 3), bi = Math.floor(beat);
    S.lasersBoost = Math.max(0, S.lasersBoost - dt);
    S.festival = Math.max(0, S.festival - dt);
    if (S.ledMsg && (S.ledMsg.t -= dt) <= 0) S.ledMsg = null;
    const hype = Math.min(1, energy / 100 + (S.festival > 0 ? 0.6 : 0));

    // vurgu rengi yumuşak geçer
    accTarget.set(S.festival > 0 ? ACCENTS.festival : ACCENTS[S.mode] || ACCENTS.pop);
    S.accent.lerp(accTarget, Math.min(1, dt * 2));
    for (const m of glowMats) m.color.copy(S.accent).multiplyScalar(m.userData.k ?? 1);

    // ışık barları: vuruş desenleri (tek tek koşan, ikili, hepsi)
    const pat = Math.floor(bi / 8) % 3;
    S.bars = 0;
    bars.forEach(({ m, i }) => {
      let on;
      if (buildP > 0.8) on = (Math.floor(beat * 4) % 2 === 0);
      else if (pat === 0) on = (bi % 8) === i || (7 - (bi % 8)) === i;
      else if (pat === 1) on = (i + bi) % 2 === 0;
      else on = true;
      const lvl = on ? 0.35 + 0.65 * pulse : 0.07;
      m.color.copy(S.accent).multiplyScalar(lvl * 1.4);
      if (on) S.bars += pulse / 8;
    });
    floorMat.emissive.copy(S.accent).multiplyScalar(0.02 + 0.05 * pulse * hype);
    stageLight.intensity = 6 + 10 * pulse;
    podMats.forEach((m) => m.color.copy(S.accent).multiplyScalar(0.25 + 0.45 * pulse));
    cones.forEach((c) => c.scale.setScalar(1 + pulse * 0.1));

    beams.forEach((b, i) => {
      b.ph += dt * (0.4 + hype * 0.9 + buildP * 1.5);
      b.m.rotation.x = Math.sin(b.ph + i) * 0.45; b.m.rotation.z = Math.cos(b.ph * 0.8 + i * 2) * 0.5;
      b.m.material.color.copy(S.accent); b.m.material.opacity = (S.festival > 0 ? 0.08 : Math.max(0, buildP - 0.5) * 0.18) * (0.6 + 0.4 * pulse);
    });
    const laserA = Math.min(1, Math.max(0, (energy - 80) / 40) * 0.5 + (S.lasersBoost > 0 ? 1 : 0) + (S.festival > 0 ? 0.8 : 0) + (buildP > 0.85 ? 0.35 : 0));
    lasers.forEach((l) => {
      l.m.rotation.y = (l.i - 4.5) * 0.1 + Math.sin(time * 1.3 + l.i * 0.3) * 0.3;
      l.m.rotation.x = 0.05 + Math.sin(time * 0.9 + l.i) * 0.1 - 0.12 * Math.sin(beat * Math.PI / 4);
      l.m.material.color.copy(S.accent);
      l.m.material.opacity = laserA * (0.5 + 0.5 * ((Math.floor(beat * 2) + l.i) % 2));
    });

    S.flashA = Math.max(0, S.flashA - dt * 4);
    amb.intensity = 0.25 + S.flashA * 4;
    if (S.festival > 0 && Math.random() < dt * 1.6) S.firework();

    for (let i = parts.length - 1; i >= 0; i--) { if ((parts[i].life -= dt) <= 0) parts.splice(i, 1); }
    let n = 0;
    for (const p of parts) {
      p.vy += p.grav * dt; p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
      const k = Math.min(1, p.life / p.max * 2);
      pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z;
      pCol[n * 3] = p.r * k; pCol[n * 3 + 1] = p.g * k; pCol[n * 3 + 2] = p.b * k; n++;
    }
    pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;

    updateDisco(dt);
    updateFog(dt, time);
    updateOutdoor(dt, time, beat);
    if ((ledAcc += dt) > 1 / 30) { ledAcc = 0; drawLed(time, beat, energy, buildP); }
  };

  return S;
}
