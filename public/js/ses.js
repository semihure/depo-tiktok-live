// Techno ses motoru: tamamen Web Audio ile kodla üretilir (dosya yok, telif yok).
//  • 16'lık adım sıralayıcı, ileriye dönük zamanlama (lookahead) ile kaymasız çalar
//  • modlar: deep | acid | hard | melodik   (DJ olan izleyici seçer)
//  • yoğunluk 0-3: enerji kademesiyle katmanlar eklenir
//  • build(p): bar dolarken filtre açılır, trampet sıklaşır, riser yükselir, sonda kick susar
//  • drop(): crash + sub düşüşü, her şey tam güçle geri girer
//  • müzik/ klasöründe parça varsa onu çalar; build/drop efektleri o parçaya uygulanır
export function createAudio() {
  const A = {
    ctx: null, on: false, bpm: 124, targetBpm: 124, mode: 'acid', intensity: 0,
    buildP: 0, step: 0, nextTime: 0, marks: [], onStep: null, onHit: null, gate: null,
    tracks: [], ti: -1, queueNext: -1, beatBase: 0, el: null, ownMusic: false, trackBpm: 0, trackOffset: 0,
  };
  let c, master, comp, drums, synth, fxBus, filt, gateF, duck, noiseBuf, distCurve, timer;

  // A minör etrafında; Hz
  const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const ACID = [ // [midi, aksan, kayma]; null = sus
    [[45, 1, 0], [45, 0, 0], [57, 0, 1], [45, 0, 0], [48, 1, 0], null, [45, 0, 0], [55, 0, 1], [45, 1, 0], [45, 0, 0], [52, 0, 0], [45, 0, 1], [57, 1, 0], null, [50, 0, 0], [48, 0, 1]],
    [[45, 1, 0], [57, 0, 1], [45, 0, 0], [45, 0, 0], [60, 1, 1], [57, 0, 0], [45, 0, 0], null, [43, 1, 0], [43, 0, 0], [55, 0, 1], [43, 0, 0], [48, 1, 0], [50, 0, 1], [52, 0, 0], [55, 1, 1]],
  ];
  const ARP = [57, 60, 64, 67, 64, 60, 57, 64, 55, 59, 62, 67, 62, 59, 55, 62];
  const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];

  function init() {
    c = A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = c.createGain(); master.gain.value = 0;
    comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.15;
    // build sırasında tüm karışım yüksek geçiren filtreden geçer (DJ hareketi)
    filt = c.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 20; filt.Q.value = 0.9;
    // kanal oyunu (kendi parçalarında): kanalları ayıramadığımız için filtreyle yaklaşık solo/susturma
    gateF = c.createBiquadFilter(); gateF.type = 'lowpass'; gateF.frequency.value = 20000; gateF.Q.value = 0.7;
    master.connect(gateF); gateF.connect(filt); filt.connect(comp); comp.connect(c.destination);

    drums = c.createGain(); drums.gain.value = 0.95; drums.connect(master);
    duck = c.createGain(); duck.gain.value = 1; duck.connect(master); // kick'e göre "pompalanan" bas ve synth
    synth = c.createGain(); synth.gain.value = 0.55; synth.connect(duck);
    fxBus = c.createGain(); fxBus.gain.value = 0.5; fxBus.connect(comp); // riser/crash filtreden etkilenmesin

    // gecikme (dub echo) synth'e
    const dl = c.createDelay(1); dl.delayTime.value = 0.36;
    const fb = c.createGain(); fb.gain.value = 0.32;
    const dlf = c.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2500;
    const wet = c.createGain(); wet.gain.value = 0.22;
    synth.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(wet); wet.connect(duck);
    A.delay = dl;

    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; distCurve[i] = Math.tanh(x * 4); }
    timer = setInterval(schedule, 25);
  }

  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function noise(t, dur, type, freq, q, peak, decay, dest = drums) {
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); env(g, t, peak, 0.002, decay);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }

  // ---------- sesler ----------
  function kick(t, hard) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(hard ? 190 : 150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    env(g, t, hard ? 1.2 : 1, 0.002, hard ? 0.42 : 0.36);
    if (hard) { const ws = c.createWaveShaper(); ws.curve = distCurve; o.connect(ws); ws.connect(g); } else o.connect(g);
    g.connect(drums); o.start(t); o.stop(t + 0.5);
    noise(t, 0.01, 'highpass', 3000, 0.7, 0.25, 0.008);
    // sidechain: bas ve synth kick'te kısılıp geri gelir
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.25, t);
    duck.gain.linearRampToValueAtTime(1, t + 60 / A.bpm * 0.55);
  }
  const hat = (t, open) => noise(t, open ? 0.2 : 0.04, 'highpass', open ? 7000 : 9000, 0.8, open ? 0.16 : 0.11, open ? 0.14 : 0.03);
  function clap(t) { for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.04, 'bandpass', 1400, 1.2, 0.35, i === 2 ? 0.16 : 0.02); }
  const snare = (t, v) => noise(t, 0.08, 'bandpass', 2200, 0.9, 0.25 * v, 0.07);

  function rumble(t, len, midi) {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(midi);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180 + A.intensity * 60; f.Q.value = 3;
    const g = c.createGain(); env(g, t, 0.32, 0.005, len);
    o.connect(f); f.connect(g); g.connect(duck); o.start(t); o.stop(t + len + 0.05);
  }
  let acidOsc = null, acidF = null, acidG = null;
  function acid(t, n, len) {
    if (!acidOsc) { // tek osilatör: kaymalar (slide) için sürekli çalar
      acidOsc = c.createOscillator(); acidOsc.type = 'sawtooth';
      acidF = c.createBiquadFilter(); acidF.type = 'lowpass'; acidF.Q.value = 14;
      acidG = c.createGain(); acidG.gain.value = 0;
      acidOsc.connect(acidF); acidF.connect(acidG); acidG.connect(synth); acidOsc.start();
    }
    const [m, acc, slide] = n;
    const fr = NOTE(m);
    if (slide) acidOsc.frequency.linearRampToValueAtTime(fr, t + len * 0.6); else acidOsc.frequency.setValueAtTime(fr, t);
    const base = 300 + A.intensity * 350 + A.buildP * 2500;
    acidF.frequency.setValueAtTime(base * (acc ? 6 : 3.5), t);
    acidF.frequency.exponentialRampToValueAtTime(base, t + len * 0.9);
    acidG.gain.setValueAtTime(acc ? 0.34 : 0.22, t);
    acidG.gain.setTargetAtTime(slide ? 0.18 : 0.0001, t + len * 0.7, 0.02);
  }
  function pluck(t, midi, vol, len, type = 'square') {
    const o = c.createOscillator(); o.type = type; o.frequency.value = NOTE(midi);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200 + A.buildP * 4000, t); f.frequency.exponentialRampToValueAtTime(500, t + len);
    const g = c.createGain(); env(g, t, vol, 0.004, len);
    o.connect(f); f.connect(g); g.connect(synth); o.start(t); o.stop(t + len + 0.05);
  }
  function pad(t, chord, len) {
    for (const m of chord) for (const det of [-7, 7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(m); o.detune.value = det;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + A.buildP * 2500;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len);
      o.connect(f); f.connect(g); g.connect(synth); o.start(t); o.stop(t + len + 0.05);
    }
  }
  function stab(t, chord) { for (const m of chord) pluck(t, m + 12, 0.07, 0.25, 'sawtooth'); }

  // ---------- sıralayıcı ----------
  function playStep(s, t) {
    const i = s % 16, bar = Math.floor(s / 16), sp = 60 / A.bpm / 4;
    const lv = A.intensity, mode = A.mode, bp = A.buildP;
    const breakdown = bp >= 0.85; // barın sonu: kick susar, gerilim
    const hitAt = (ch) => { if (A.onHit) A.onHit(ch, t); };
    // kanal oyunu: solo ise yalnızca o kanal, susturulduysa o kanal hariç hepsi
    const g = A.gate, on = (ch) => !g || (g.solo ? g.solo === ch : g.mute !== ch);
    if (!A.ownMusic) {
      if (i % 4 === 0 && !breakdown && on('kick')) { kick(t, mode === 'hard'); hitAt('kick'); }
      if (on('hat')) {
        // offbeat açık hi-hat ~12 ms geç: küçük gecikme groove'un parçası
        if (i % 4 === 2) { hat(t + 0.012, true); hitAt('hat'); }
        else if ((lv >= 1 || mode === 'hard' || (g && g.solo === 'hat')) && i % 2 === 1) hat(t, false);
        else if (lv >= 2 && i % 4 !== 0) hat(t, false);
        if ((lv >= 1 || mode === 'hard') && (i === 4 || i === 12) && !breakdown) { clap(t); hitAt('clap'); }
      }
      if (on('bas') && i % 4 !== 0 && !breakdown && (mode !== 'melodik' || i % 2 === 0)) { rumble(t, sp * 0.9, bar % 4 === 3 && i > 8 ? 43 : 33); if (i % 4 === 2) hitAt('bas'); }
      // solo acid istendiğinde tarz ne olursa olsun acid hattı çalar
      const acidOn = (mode === 'acid' || (mode === 'hard' && lv >= 2) || (g && g.solo === 'acid')) && on('acid');
      const an = acidOn && !breakdown ? ACID[bar % 4 < 2 ? 0 : 1][i] : null;
      if (an) { acid(t, an, sp); hitAt('acid'); } else if (acidG) acidG.gain.setTargetAtTime(0.0001, t, 0.01);
      if (mode === 'melodik' && on('acid') && !(g && g.solo === 'acid')) { hitAt('acid'); pluck(t, ARP[i] + (bar % 8 >= 4 ? 2 : 0), 0.06 + bp * 0.05, sp * 1.6); if (i === 0) pad(t, CHORDS[bar % 4], sp * 16); }
      if (mode === 'deep' && on('acid') && (i === 3 || i === 11) && bar % 2 === 0) stab(t, CHORDS[(bar >> 1) % 4]);
    }
    // build: trampet sıklaşır (dörtlük → sekizlik → onaltılık)
    if (bp > 0.35 && (!g || !g.solo || g.solo === 'hat')) {
      const every = bp > 0.8 ? 1 : bp > 0.6 ? 2 : 4;
      if (i % every === 0) snare(t, 0.4 + bp);
    }
    if (A.onStep) A.onStep(s, t);
  }

  function schedule() {
    if (!A.on) return;
    // tempo yumuşak geçsin
    if (Math.abs(A.bpm - A.targetBpm) > 0.05) A.bpm += Math.sign(A.targetBpm - A.bpm) * Math.min(0.25, Math.abs(A.targetBpm - A.bpm));
    if (A.ownMusic) return;
    while (A.nextTime < c.currentTime + 0.12) {
      A.marks.push({ t: A.nextTime, s: A.step, bpm: A.bpm });
      if (A.marks.length > 64) A.marks.splice(0, 32);
      playStep(A.step, A.nextTime);
      A.nextTime += 60 / A.bpm / 4; A.step++;
    }
    A.delay.delayTime.setTargetAtTime((60 / A.bpm) * 0.75, c.currentTime, 0.1);
  }

  // ---------- dış arayüz ----------
  A.start = async function () {
    if (!c) init();
    await c.resume();
    if (A.on) return true;
    A.on = true;
    master.gain.setTargetAtTime(0.9, c.currentTime, 0.05);
    if (A.tracks.length) { A.ownMusic = true; nextTrack(); }
    else { A.nextTime = c.currentTime + 0.06; A.step = 0; A.marks = []; }
    return true;
  };
  A.stop = function () {
    if (!A.on) return;
    A.on = false;
    master.gain.setTargetAtTime(0, c.currentTime, 0.08);
    if (A.el) A.el.pause();
  };

  // şu anki vuruş (dörtlük cinsinden ondalıklı); ses kapalıysa null → oyun kendi saatini kullanır
  A.beatNow = function () {
    if (!A.on || !c) return null;
    if (A.ownMusic) {
      if (!A.el || A.el.paused) return null;
      // şarkı değişince sayaç geri atlamasın: her parça bir önceki parçanın kaldığı vuruştan devam eder.
      // tempo henüz ölçülmediyse geçici 128 BPM ile saymaya devam eder.
      return (A.lastOwnBeat = A.beatBase + Math.max(0, A.el.currentTime - A.trackOffset) * (A.trackBpm || 128) / 60);
    }
    const now = c.currentTime;
    let m = null;
    for (let k = A.marks.length - 1; k >= 0; k--) if (A.marks[k].t <= now) { m = A.marks[k]; break; }
    if (!m) return null;
    return m.s / 4 + (now - m.t) * m.bpm / 60;
  };
  A.currentBpm = () => (A.ownMusic && A.trackBpm ? A.trackBpm : A.bpm);

  A.setBuild = function (p) {
    A.buildP = Math.max(0, Math.min(1, p));
    if (!c) return;
    // son %40'ta yüksek geçiren filtre yukarı süpürülür
    const hp = A.buildP < 0.6 ? 20 : 20 + Math.pow((A.buildP - 0.6) / 0.4, 2) * 900;
    filt.frequency.setTargetAtTime(hp, c.currentTime, 0.2);
    // riser: build'in son yarısında sürekli gürültü
    if (A.on && A.buildP > 0.5 && !A.riser) {
      const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4; f.frequency.value = 400;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(fxBus); s.start();
      A.riser = { s, f, g };
    }
    if (A.riser) {
      const r = A.riser, k = Math.max(0, (A.buildP - 0.5) / 0.5);
      r.f.frequency.setTargetAtTime(400 + k * k * 7000, c.currentTime, 0.2);
      r.g.gain.setTargetAtTime(k * 0.35, c.currentTime, 0.2);
    }
  };

  A.drop = function () {
    A.buildP = 0;
    if (!c || !A.on) { A.setBuild(0); return; }
    const t = c.currentTime + 0.02;
    filt.frequency.cancelScheduledValues(t); filt.frequency.setValueAtTime(20, t);
    if (A.riser) { A.riser.g.gain.setTargetAtTime(0, t, 0.03); const s = A.riser.s; setTimeout(() => s.stop(), 400); A.riser = null; }
    noise(t, 1.8, 'highpass', 5000, 0.5, 0.5, 1.6, fxBus);             // crash
    const o = c.createOscillator(), g = c.createGain();                 // sub düşüşü
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
    env(g, t, 0.9, 0.005, 1.3); o.connect(g); g.connect(fxBus); o.start(t); o.stop(t + 1.4);
    if (!A.ownMusic) { kick(t, true); }
  };

  // kanal oyunu: { solo: 'kick'|'hat'|'bas'|'acid' } ya da { mute: ... }; null → normal
  const GATE_FILTER = {
    'solo:kick': ['lowpass', 110, 1], 'solo:bas': ['lowpass', 220, 1], 'solo:hat': ['highpass', 6500, 0.7], 'solo:acid': ['bandpass', 1100, 0.9],
    'mute:kick': ['highpass', 140, 0.7], 'mute:bas': ['highpass', 280, 0.7], 'mute:hat': ['lowpass', 4500, 0.7], 'mute:acid': ['notch', 1100, 0.6],
  };
  A.setGate = (gate) => {
    A.gate = gate && (gate.solo || gate.mute) ? gate : null;
    if (!c) return;
    const t = c.currentTime;
    const f = A.gate && A.ownMusic ? GATE_FILTER[(A.gate.solo ? 'solo:' + A.gate.solo : 'mute:' + A.gate.mute)] : null;
    if (f) { gateF.type = f[0]; gateF.frequency.setTargetAtTime(f[1], t, 0.03); gateF.Q.value = f[2]; }
    else { gateF.type = 'lowpass'; gateF.frequency.setTargetAtTime(20000, t, 0.05); gateF.Q.value = 0.7; }
  };
  A.setMode = (m) => { if (['deep', 'acid', 'hard', 'melodik'].includes(m)) A.mode = m; };
  A.setIntensity = (lv) => { A.intensity = lv; };
  A.setBpm = (b) => { A.targetBpm = b; if (!A.on) A.bpm = b; if (A.el && A.trackBpm) A.el.playbackRate = Math.max(0.9, Math.min(1.12, b / A.trackBpm)); };

  // ---------- kendi müziklerin ----------
  A.loadTracks = async function () {
    try {
      const j = await (await fetch('/api/music')).json();
      A.tracks = (j.tracks || []).map((f) => ({ file: f, url: 'muzik/' + encodeURIComponent(f), bpm: 0, offset: 0 }));
    } catch { A.tracks = []; }
    return A.tracks;
  };
  async function nextTrack() {
    if (!A.tracks.length) return;
    // oylamayla seçilen parça varsa o
    A.ti = A.queueNext >= 0 && A.queueNext < A.tracks.length ? A.queueNext : (A.ti + 1) % A.tracks.length;
    A.queueNext = -1;
    const tr = A.tracks[A.ti];
    if (!A.el) {
      A.el = new Audio(); A.el.crossOrigin = 'anonymous';
      const src = c.createMediaElementSource(A.el); src.connect(duck);
      A.el.addEventListener('ended', () => nextTrack());
    }
    // şarkı bittiği an çalar 'duraklamış' sayılır; son bilinen vuruştan devam et
    const prev = A.lastOwnBeat;
    A.beatBase = prev != null ? Math.ceil(prev) : (A.beatBase || 0);
    A.el.src = tr.url;
    A.trackBpm = tr.bpm || 0; A.trackOffset = tr.offset || 0;
    A.el.play().catch(() => {});
    if (!tr.bpm) detectBpm(tr).then(() => {
      if (A.tracks[A.ti] !== tr) return;
      // ölçüm şarkının ortasında biterse: sayacı sürekli tut, sonra gerçek vuruşa (tam sayıya) oturt
      const cur = A.beatNow();
      A.trackBpm = tr.bpm; A.trackOffset = tr.offset;
      if (cur != null) A.beatBase = Math.round(cur - Math.max(0, A.el.currentTime - tr.offset) * tr.bpm / 60);
    });
  }
  A.skip = () => { if (A.ownMusic) nextTrack(); };
  // kendi müziğin çalıyorsa parça bilgisi: "Sanatçı - Parça.mp3" → { artist, title, progress }
  A.trackInfo = () => {
    if (!A.ownMusic || A.ti < 0 || !A.tracks[A.ti]) return null;
    const name = A.tracks[A.ti].file.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
    const m = name.split(/\s+[-–—]\s+/);
    const el = A.el, progress = el && el.duration ? el.currentTime / el.duration : 0;
    return m.length > 1 ? { artist: m[0].trim(), title: m.slice(1).join(' - ').trim(), progress } : { artist: '', title: name.trim(), progress };
  };

  // basit tempo tespiti: enerji artış zarfının otokorelasyonu (110-160 BPM arası)
  async function detectBpm(tr) {
    try {
      const buf = await c.decodeAudioData(await (await fetch(tr.url)).arrayBuffer());
      const d = buf.getChannelData(0), sr = buf.sampleRate, hop = Math.round(sr / 100);
      const frames = Math.min(Math.floor(d.length / hop), 100 * 90);
      const envl = new Float32Array(frames);
      let prev = 0;
      for (let f = 0; f < frames; f++) {
        let e = 0; for (let i = f * hop, end = i + hop; i < end; i++) e += d[i] * d[i];
        e = Math.sqrt(e / hop); envl[f] = Math.max(0, e - prev); prev = e;
      }
      let best = 120, bestS = -1;
      for (let bpm = 110; bpm <= 160; bpm += 0.5) {
        const lag = 6000 / bpm; let s = 0;
        for (let f = 0; f + lag * 4 < frames; f += 2) s += envl[f] * (envl[Math.round(f + lag)] + envl[Math.round(f + lag * 2)] + envl[Math.round(f + lag * 4)]);
        if (s > bestS) { bestS = s; best = bpm; }
      }
      const lag = 6000 / best; let bo = 0, bs = -1;
      for (let o = 0; o < lag; o++) { let s = 0; for (let f = o; f < frames; f += lag) s += envl[Math.round(f)]; if (s > bs) { bs = s; bo = o; } }
      tr.bpm = best; tr.offset = bo / 100;
      console.log(`[müzik] ${tr.file}: ${best} BPM`);
    } catch (e) { tr.bpm = 128; tr.offset = 0; }
  }

  return A;
}
