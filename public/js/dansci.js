// Kalabalık — arkadan görünen çizgi film dansçılar.
//  • gri toon gölgeleme + siyah kontur (ters yüz "inverted hull") + vurgu renginde kenar parlaması
//  • saç çeşitleri: kısa, uzun, topuz, bere, kapüşon (arkadan tanınsın diye)
//  • her parça tek InstancedMesh → 240 kişide bile az çizim çağrısı
//  • dans: her dansçının kendi repertuvarı var; 8–16 ölçüde bir ölçü başında başka harekete geçer,
//    geçişler 0.35 sn yumuşak karışır. Yorum komutları geçicidir, özel danslar hediyeyle alınır.
import * as THREE from 'three';
import { toonRamp } from './sahne.js';

const SKINS = ['#b8b8bc', '#a4a4a8', '#c8c8cc', '#949498', '#d4d4d8'];
const HAIRS = ['#2a2a2e', '#3a3a3e', '#1c1c20', '#55555a', '#707075', '#8a8a90'];
const SHIRTS = ['#4a4a50', '#3a3a40', '#5c5c62', '#2e2e34', '#68686e', '#7a7a80'];
const HAIR_TYPES = ['short', 'long', 'bun', 'beanie', 'hood'];
// kendiliğinden dönen ücretsiz hareketler (repertuvar bunlardan seçilir)
const ROTATION = ['nod', 'bounce', 'sway', 'shuffle', 'headbang', 'twist', 'robot', 'clap', 'pump', 'step'];
// yorumla seçilebilenler (geçici) = ROTATION + hands, jump
export const MOVES = [...ROTATION, 'hands', 'jump'];
// yalnızca hediyeyle alınan özel danslar
export const SPECIALS = { disko: { icon: '🕺', ad: 'disko' }, dalga: { icon: '🌊', ad: 'vücut dalgası' }, yeldegirmeni: { icon: '🌪️', ad: 'yel değirmeni' } };
const BLEND = 0.35;
const POSE_KEYS = ['by', 'bx', 'bz', 'lean', 'roll', 'aL', 'aR', 'aLz', 'aRz', 'lL', 'lR', 'nod', 'twist', 'spin'];

// seed'den tekrarlanabilir rastgele sayılar
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }

export function createCrowd(scene, MAX = 240) {
  const rim = { value: new THREE.Color('#8cff3a') };
  const ramp = toonRamp();
  function toonRim() {
    const m = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: ramp });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = rim;
      sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `
        { vec3 nV = normalize(normal);
          float r = 1.0 - clamp(dot(nV, normalize(vViewPosition)), 0.0, 1.0);
          float up = smoothstep(-0.1, 0.7, nV.y);
          gl_FragColor.rgb += uRim * step(0.6, r) * up; }
        #include <dithering_fragment>`);
    };
    return m;
  }
  const outline = new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide });
  outline.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * 0.024;'); };

  const geo = {
    torso: new THREE.CapsuleGeometry(0.2, 0.3, 6, 12).scale(1.25, 1, 0.8),
    head: new THREE.SphereGeometry(0.2, 18, 14),
    cap: new THREE.SphereGeometry(0.212, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62).rotateX(-0.3),
    long: new THREE.CapsuleGeometry(0.15, 0.32, 4, 10).scale(1.1, 1, 0.45).translate(0, -0.26, -0.12),
    bun: new THREE.SphereGeometry(0.1, 12, 10).translate(0, 0.17, -0.12),
    beanie: new THREE.SphereGeometry(0.228, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 0.02, 0),
    pom: new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.25, 0),
    hood: new THREE.SphereGeometry(0.255, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.68).rotateX(-0.45).translate(0, -0.02, -0.02),
    arm: new THREE.CapsuleGeometry(0.062, 0.42, 4, 8).translate(0, -0.26, 0),
    leg: new THREE.CapsuleGeometry(0.08, 0.6, 4, 8).translate(0, -0.38, 0),
    stick: new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8).translate(0, -0.22, 0),
  };
  const mk = (g, m, n = MAX) => { const im = new THREE.InstancedMesh(g, m, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; im.setColorAt(0, new THREE.Color()); scene.add(im); return im; };
  const PARTS = ['torso', 'head', 'cap', 'long', 'bun', 'beanie', 'pom', 'hood', 'arm', 'leg'];
  const IM = {}, OL = {};
  for (const p of PARTS) {
    const n = p === 'arm' || p === 'leg' ? MAX * 2 : MAX;
    IM[p] = mk(geo[p], toonRim(), n);
    if (p !== 'pom') { OL[p] = mk(geo[p], outline, n); OL[p].renderOrder = -1; }
  }
  IM.stick = mk(geo.stick, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));

  // iskelet: tek Object3D zinciri, her dansçı için yeniden kullanılır
  const root = new THREE.Object3D();
  const body = new THREE.Object3D(); root.add(body);
  const torso = new THREE.Object3D(); torso.position.y = 1.08; body.add(torso);
  const head = new THREE.Object3D(); head.position.y = 0.5; torso.add(head);
  const armL = new THREE.Object3D(); armL.position.set(-0.27, 0.2, 0); torso.add(armL);
  const armR = new THREE.Object3D(); armR.position.set(0.27, 0.2, 0); torso.add(armR);
  const legL = new THREE.Object3D(); legL.position.set(-0.11, 0.78, 0); body.add(legL);
  const legR = new THREE.Object3D(); legR.position.set(0.11, 0.78, 0); body.add(legR);
  const stick = new THREE.Object3D(); stick.position.set(0, -0.5, 0); armR.add(stick);

  const list = [];
  const C = new THREE.Color(), LEG = new THREE.Color('#1d1d22');
  const headWorld = new THREE.Vector3();
  const cnt = {};
  function put(part, matrix, color) {
    const i = cnt[part]++;
    IM[part].setMatrixAt(i, matrix); IM[part].setColorAt(i, color);
    if (OL[part]) OL[part].setMatrixAt(i, matrix);
  }

  // ---------- pozlar ----------
  // ctx: { b (vuruş + kişisel faz), ph (0..1), dip, hit, amp, time, walk }
  function poseOf(move, x, o) {
    for (const k of POSE_KEYS) o[k] = 0;
    o.aLz = 0.1; o.aRz = -0.1;
    const { b, ph, dip, hit, amp, time } = x;
    switch (move) {
      case 'walk': { const s = Math.sin(x.walk); o.lL = s * 0.5; o.lR = -s * 0.5; o.aL = -s * 0.4; o.aR = s * 0.4; o.by = Math.abs(s) * 0.04; break; }
      case 'nod': // baş vuruşta düşer, offbeat'te kalkar
        o.nod = 0.05 + hit * 0.42 * amp; o.by = -hit * 0.05 * amp; o.lean = hit * 0.06; o.lL = o.lR = hit * 0.12;
        o.aL = o.aR = -0.15; o.aLz = 0.15; o.aRz = -0.15; o.twist = Math.sin(b * Math.PI / 4) * 0.12; break;
      case 'bounce': o.by = -dip * 0.07 * amp; o.nod = dip * 0.25 * amp; o.aL = -0.5 - dip * 0.4; o.aR = -0.6 - dip * 0.5 * amp; o.aLz = 0.25; o.aRz = -0.25; o.lean = dip * 0.08; o.twist = Math.sin(b * Math.PI / 2) * 0.25; o.lL = o.lR = dip * 0.15; break;
      case 'hands': o.by = -dip * 0.06 * amp; o.aLz = 2.7 - dip * 0.35 * amp; o.aRz = -2.7 + dip * 0.35 * amp; o.nod = dip * 0.2; break;
      case 'jump': case 'drop': {
        const h = Math.sin(ph * Math.PI); o.by = h * (move === 'drop' ? 0.45 : 0.32) * amp;
        o.aLz = 2.6 + h * 0.3; o.aRz = -2.6 - h * 0.3; o.lL = o.lR = -h * 0.35; o.nod = -h * 0.2; break;
      }
      case 'shuffle': { const s = Math.sin(b * Math.PI); o.lL = s * 0.55 * amp; o.lR = -s * 0.55 * amp; o.twist = s * 0.35; o.by = -dip * 0.05; o.aL = o.aR = -0.9; o.aLz = 0.5; o.aRz = -0.5; break; }
      case 'sway': {
        const side = Math.floor(b) % 2 ? 1 : -1, k = Math.sin(Math.min(1, ph * 2.5) * Math.PI / 2);
        o.bx = side * 0.16 * k * amp; o.roll = -side * 0.12 * k; o.by = -dip * 0.05;
        o.lL = side > 0 ? 0.25 * k : 0; o.lR = side < 0 ? 0.25 * k : 0;
        o.aL = o.aR = -0.3; o.aLz = 0.3 + (side < 0 ? 0.6 * k : 0); o.aRz = -0.3 - (side > 0 ? 0.6 * k : 0); break;
      }
      case 'twist': { const s = Math.sin(b * Math.PI); o.twist = s * 0.7 * amp; o.by = -dip * 0.12; o.lL = o.lR = 0.25 + dip * 0.2; o.aL = o.aR = -0.6; o.aLz = 0.9 + s * 0.3; o.aRz = -0.9 + s * 0.3; break; }
      case 'robot': {
        const st = Math.floor(b * 2) % 4, q = [[0.4, -1.4], [-1.4, 0.4], [1.2, 1.2], [-0.2, -0.2]][(st + 4) % 4];
        o.aL = o.aR = -1.57; o.aLz = q[0] > 0 ? 0.1 : 1.4; o.aRz = q[1] > 0 ? -0.1 : -1.4;
        o.twist = [0.4, -0.4, 0, 0][(st + 4) % 4]; o.nod = [0, 0, 0.3, -0.1][(st + 4) % 4]; o.by = -0.02 * (st % 2); break;
      }
      case 'headbang': { const k = Math.pow(Math.sin(ph * Math.PI), 4); o.nod = 0.15 + k * 0.75 * amp; o.lean = 0.1 + k * 0.25; o.by = -k * 0.06; o.aL = -0.4; o.aR = -1.2 - k * 0.3; o.aLz = 0.2; o.aRz = -0.3; o.lL = o.lR = 0.2; break; }
      case 'clap': { // eller başın üstünde, offbeat'te alkış
        const c = Math.pow(Math.cos(Math.PI * (ph - 0.5)), 10);
        o.aLz = 2.3 + c * 0.6; o.aRz = -2.3 - c * 0.6; o.aL = o.aR = -0.15; o.by = -dip * 0.05 * amp; o.nod = hit * 0.18; o.lL = o.lR = dip * 0.1; break;
      }
      case 'pump': // vuruşta yumruk havaya, diğer el belde
        o.aR = -0.25; o.aRz = -(1.5 + hit * 1.25 * amp); o.aL = 0.35; o.aLz = 0.65; o.by = -hit * 0.06; o.nod = hit * 0.3; o.lean = -hit * 0.05; o.lL = o.lR = hit * 0.12; break;
      case 'step': { // sağ-sol adım + parmak şıklatma
        const side = Math.floor(b) % 2 ? 1 : -1, k = Math.sin(Math.min(1, ph * 3) * Math.PI / 2), snap = Math.pow(Math.cos(Math.PI * (ph - 0.5)), 12);
        o.bx = side * 0.12 * k; o.lL = side > 0 ? 0.3 * k : 0; o.lR = side < 0 ? 0.3 * k : 0; o.by = -dip * 0.04;
        o.aL = o.aR = -1.0; o.aLz = 0.35 + snap * 0.4; o.aRz = -0.35 - snap * 0.4; o.twist = side * 0.15 * k; o.nod = hit * 0.15; break;
      }
      // ---------- özel danslar (hediyeyle) ----------
      case 'disko': { // 70'ler disko: sağ kol çaprazdan yukarıyı gösterir, sonra aşağı çapraza iner; kalça sallanır
        const up = Math.floor(b) % 2 === 0, k = Math.sin(Math.min(1, ph * 3.5) * Math.PI / 2), side = up ? 1 : -1;
        o.aR = up ? -0.25 : -0.55; o.aRz = up ? -(0.4 + 2.1 * k) : -(2.5 - 2.95 * k); // yukarı-sağ ↔ aşağı-sol
        o.aL = 0.4; o.aLz = 0.65; // sol el belde
        o.bx = side * 0.08 * k; o.roll = side * 0.1 * k; o.twist = side * 0.22 * k; o.by = -dip * 0.05;
        o.lL = up ? 0.2 * k : 0; o.lR = up ? 0 : 0.2 * k; o.nod = up ? -0.15 * k : 0.15 * k; break;
      }
      case 'yeldegirmeni': { // iki kol sırayla büyük daireler çizer (arkadan net görünür)
        const a = b * Math.PI;
        o.aL = -0.15; o.aR = -0.15; o.aLz = a % (Math.PI * 2); o.aRz = -((a + Math.PI) % (Math.PI * 2));
        o.lean = 0.12 + Math.sin(a) * 0.12; o.by = -dip * 0.07; o.nod = 0.1 + Math.sin(a) * 0.1; o.lL = o.lR = dip * 0.15; break;
      }
      case 'dalga': { // baş → göğüs → bel sırayla
        const w = b * Math.PI;
        o.nod = Math.sin(w) * 0.35; o.lean = Math.sin(w - 0.9) * 0.28; o.by = Math.sin(w - 1.8) * 0.07; o.roll = Math.sin(w * 0.5) * 0.12;
        o.aL = o.aR = -0.2; o.aLz = 1.35 + Math.sin(w) * 0.6; o.aRz = -(1.35 + Math.sin(w - 1.2) * 0.6); o.lL = o.lR = 0.15 + Math.max(0, Math.sin(w - 1.8)) * 0.25; break;
      }
    }
    return o;
  }
  const PA = {}, PB = {}, ctx = {};

  // repertuvar: seed'e göre 3–4 hareket ('nod' çoğunlukla içinde)
  function makeRep(d) {
    const r = rng(d.seed * 7 + 13), rep = [];
    if (r() < 0.7) rep.push('nod');
    const n = 3 + (r() < 0.5 ? 1 : 0);
    while (rep.length < n) { const m = ROTATION[(r() * ROTATION.length) | 0]; if (!rep.includes(m)) rep.push(m); }
    d.rep = rep; d.repI = 0; d.auto = rep[0]; d.nextBar = null;
    d.mirror = (d.seed >>> 17) & 1 ? -1 : 1;
    d.intensity = 0.85 + r() * 0.35;
    d.rand = r;
  }

  const crowd = {
    list, wave: 0, build: 0,
    add(d) {
      if (list.length >= MAX) return null;
      const seed = d.seed >>> 0;
      Object.assign(d, {
        skin: new THREE.Color(SKINS[seed % SKINS.length]),
        hairCol: new THREE.Color(HAIRS[(seed >>> 5) % HAIRS.length]),
        shirt: new THREE.Color(SHIRTS[(seed >>> 7) % SHIRTS.length]),
        hairType: HAIR_TYPES[(seed >>> 11) % HAIR_TYPES.length],
        col: new THREE.Color(d.color || '#ffffff'), colored: false, stickOn: false,
        phase: ((seed >>> 9) % 100) / 100 * 0.12,
        scale: (d.scale || 1) * (0.9 + ((seed >>> 13) % 18) / 100),
        alpha: 0, jumpT: -99, bigStick: 0,
        yaw: d.yaw ?? Math.PI, x: d.x, y: d.y || 0, z: d.z, walk: 0,
        cmdMove: null, cmdUntil: -1, special: null, specUntil: -1,
        curMove: null, prevMove: null, blendT: 1,
      });
      makeRep(d);
      if (d.move) { d.auto = d.move; d.fixedMove = true; } // ör. resident DJ hep aynı
      list.push(d);
      return d;
    },
    remove(d) { const i = list.indexOf(d); if (i >= 0) list.splice(i, 1); },
    setColor(d, hex) { d.col.set(hex); d.colored = true; d.stickOn = true; },
    // yorum komutu: hareketi geçici yaptırır
    command(d, move, time, sec = 45) { d.cmdMove = move; d.cmdUntil = time + sec; },
    // özel dans (hediye): süre eklenir, en fazla 5 dk
    setSpecial(d, name, time, sec) { const left = d.special === name && d.specUntil > time ? d.specUntil - time : 0; d.special = name; d.specUntil = time + Math.min(300, left + sec); },
    specialOf(d, time) { return d.special && time < d.specUntil ? d.special : null; },
    headPos(d) { return headWorld.set(d.x, d.y + 1.95 * d.scale, d.z); },
    setRim(color, k) { rim.value.copy(color).multiplyScalar(k); },

    update(dt, time, beat, energy, dropAge) {
      const baseAmp = (0.5 + Math.min(1, energy / 100) * 0.7) * (crowd.groove ?? 1);
      const dropHype = dropAge >= 0 && dropAge < 3.5;
      const building = crowd.build > 0.6;
      const bar = Math.floor(beat / 4);
      for (const p in IM) cnt[p] = 0;
      for (const d of list) {
        d.alpha = Math.min(1, d.alpha + dt * 2);
        const dx = d.tx - d.x, dz = d.tz - d.z, dist = Math.hypot(dx, dz);
        const walking = dist > 0.03;
        if (walking) {
          const sp = Math.min(dist, dt * (d.fast ? 4 : 2.4));
          d.x += dx / dist * sp; d.z += dz / dist * sp; d.walk += dt * 9;
          d.yaw = Math.atan2(dx, dz);
        } else {
          const want = d.face ?? Math.PI;
          let da = want - d.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
          d.yaw += da * Math.min(1, dt * 4);
        }
        if (d.ty !== undefined) d.y += (d.ty - d.y) * Math.min(1, dt * 5);
        d.bigStick = Math.max(0, d.bigStick - dt);

        // repertuvarda ilerle: kişiye göre 8–16 ölçüde bir, ölçü başında
        if (!d.fixedMove) {
          if (d.nextBar === null || bar < d.nextBar - 64) d.nextBar = bar + 1 + ((d.seed >>> 4) % 16);
          if (bar >= d.nextBar) {
            d.repI = (d.repI + 1 + ((d.rand() * (d.rep.length - 1)) | 0)) % d.rep.length;
            d.auto = d.rep[d.repI];
            d.nextBar = bar + 8 + ((d.rand() * 9) | 0);
          }
        }
        // bu karede hangi hareket?
        const special = d.specUntil > time ? d.special : null;
        let move;
        if (walking) move = 'walk';
        else if (dropHype && !special) move = 'drop';
        else if (special) move = special;
        else if (time - d.jumpT < 2.2) move = 'jump';
        else if (d.cmdUntil > time) move = d.cmdMove;
        else if (building && !d.fixedMove && (d.seed % 3) !== 0) move = (d.seed % 2) ? 'hands' : 'bounce';
        else move = d.auto;
        if (move !== d.curMove) { d.prevMove = d.curMove; d.curMove = move; d.blendT = d.prevMove ? 0 : 1; }
        d.blendT = Math.min(1, d.blendT + dt / BLEND);

        const b = beat + d.phase, ph = ((b % 1) + 1) % 1;
        ctx.b = b; ctx.ph = ph; ctx.dip = Math.pow(Math.sin(ph * Math.PI), 2); ctx.hit = Math.pow(1 - ph, 3);
        ctx.amp = baseAmp * d.intensity; ctx.time = time; ctx.walk = d.walk;
        const P = poseOf(move, ctx, PA);
        if (d.blendT < 1 && d.prevMove) {
          const Q = poseOf(d.prevMove, ctx, PB), k = d.blendT * d.blendT * (3 - 2 * d.blendT);
          for (const key of POSE_KEYS) if (key !== 'spin') P[key] = Q[key] + (P[key] - Q[key]) * k; // dönüş açısı karışmaz (sıçramasın)
        }
        // kişisel ayna: sol/sağ ters (özel danslar ve yürüyüş hariç)
        if (d.mirror < 0 && !special && move !== 'walk') {
          const aL = P.aL, aLz = P.aLz; P.aL = P.aR; P.aLz = -P.aRz; P.aR = aL; P.aRz = -aLz;
          const lL = P.lL; P.lL = P.lR; P.lR = lL; P.bx = -P.bx; P.roll = -P.roll; P.twist = -P.twist;
        }
        // ışık çubuğu dalgası
        if (crowd.wave > 0.02 && move !== 'walk' && !special && d.y < 0.5) {
          const w = Math.sin(time * 3.2 - d.x * 0.8);
          const upk = Math.max(0, (w - (1 - crowd.wave * 0.9)) / (crowd.wave * 0.9 + 0.001));
          if (upk > 0) { const k = Math.min(1, upk * 2); P.aLz += (2.8 - P.aLz) * k; P.aRz += (-2.8 - P.aRz) * k; P.aL *= 1 - k; P.aR *= 1 - k; P.by += k * 0.05; d.waveUp = k; } else d.waveUp = 0;
        } else d.waveUp = 0;
        // kutlama: hediye atınca dönüp zıplar
        const ct = time - (d.celebrateT ?? -99);
        if (ct >= 0 && ct < 1.3 && !special) { const k = ct / 1.3; P.spin = Math.sin(k * Math.PI / 2) * Math.PI * 2; P.by = Math.max(P.by, Math.sin(k * Math.PI) * (d.celebrateBig ? 0.6 : 0.4)); P.aLz = 2.7; P.aRz = -2.7; P.aL = P.aR = 0; }

        root.position.set(d.x, d.y, d.z); root.rotation.set(0, d.yaw + P.spin, 0);
        root.scale.setScalar(d.scale * (0.6 + 0.4 * d.alpha));
        body.position.set(P.bx, P.by, P.bz); body.rotation.set(P.lean, P.twist, P.roll);
        head.rotation.set(P.nod, 0, 0);
        armL.rotation.set(P.aL, 0, -P.aLz); armR.rotation.set(P.aR, 0, -P.aRz);
        legL.rotation.set(P.lL, 0, 0); legR.rotation.set(P.lR, 0, 0);
        const big = d.bigStick > 0 ? 2.2 : 1; stick.scale.set(big, big, big);
        root.updateMatrixWorld(true);

        const hairC = d.colored ? d.col : d.hairCol;
        const hoodC = d.colored ? C.copy(d.col).multiplyScalar(0.75) : d.shirt;
        put('torso', torso.matrixWorld, d.hairType === 'hood' ? hoodC : d.shirt);
        put('head', head.matrixWorld, d.skin);
        switch (d.hairType) {
          case 'short': put('cap', head.matrixWorld, hairC); break;
          case 'long': put('cap', head.matrixWorld, hairC); put('long', head.matrixWorld, hairC); break;
          case 'bun': put('cap', head.matrixWorld, hairC); put('bun', head.matrixWorld, hairC); break;
          case 'beanie': { const bc = d.colored ? d.col : d.shirt; put('beanie', head.matrixWorld, bc); put('pom', head.matrixWorld, bc); break; }
          case 'hood': put('hood', head.matrixWorld, hoodC); break;
        }
        put('arm', armL.matrixWorld, d.shirt); put('arm', armR.matrixWorld, d.shirt);
        put('leg', legL.matrixWorld, LEG); put('leg', legR.matrixWorld, LEG);
        if (d.stickOn || d.bigStick > 0 || special) {
          const glow = 0.7 + 0.5 * Math.pow(1 - ph, 2) + (d.bigStick > 0 ? 0.6 : 0) + (d.waveUp || 0) * 0.8;
          put('stick', stick.matrixWorld, C.copy(d.colored ? d.col : rim.value).multiplyScalar(glow * 1.6));
        }
      }
      for (const p in IM) {
        IM[p].count = cnt[p]; IM[p].instanceMatrix.needsUpdate = true; if (IM[p].instanceColor) IM[p].instanceColor.needsUpdate = true;
        if (OL[p]) { OL[p].count = cnt[p]; OL[p].instanceMatrix.needsUpdate = true; }
      }
    },
  };
  return crowd;
}
