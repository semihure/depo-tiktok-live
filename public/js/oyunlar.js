import { modeLabel } from './sahne.js';
// Müzik mini oyunları — tek tur yöneticisi, ortak oylama kartı.
//  • kanal: "solo hat", "sustur kick"… → kazanan seçenek 2 ölçü (8 vuruş) uygulanır
//  • parca: parça değişmeden önce sonraki tarzı (ya da müzik klasöründen parçayı) 1/2/3 ile oyla
//  • bpm: "bu parça kaç BPM?" → en yakın tahmin podyuma çıkar, tam bilen 🎯 alır
// Kurallar: aynı anda tek tur; drop/festival/breakdown sırasında tur açılmaz, açıksa süre durur; kişi başı tur başına 1 oy.

const CH_LABEL = { kick: 'KICK', hat: 'HI-HAT', bas: 'BAS', acid: 'MELODİ' };
const CH_ALIAS = { kick: 'kick', hat: 'hat', hihat: 'hat', 'hi-hat': 'hat', bas: 'bas', bass: 'bas', acid: 'acid', asit: 'acid', melodi: 'acid' };
const MODES = ['pop', 'rap', 'trap', 'rnb'];
// kanala özel altyazılar: * kalın, _ vurgu rengi
const GATE_CAPS = {
  'solo:kick': 'Sadece *KICK*\nKafan _düşüyor_, ama kalkmıyor',
  'solo:hat': 'Sadece *HI-HAT*\nKafan _hâlâ_ sallanıyor mu?',
  'solo:bas': 'Sadece *BAS*\nGöğsünde _hissediyor_ musun?',
  'solo:acid': 'Sadece *MELODİ*\nRitim _yok_, sadece ezgi',
  'mute:kick': '*KICK* sustu\nKalabalık _boşta_ kaldı',
  'mute:hat': '*HI-HAT* sustu\nGroove _yere_ çöktü',
  'mute:bas': '*BAS* sustu\nZemin _boşaldı_',
  'mute:acid': '*MELODİ* sustu\nSadece _ritim_ kaldı',
};

export function createMinigames({ game, audio, club }) {
  const M = { round: null, gate: null, gateUntil: 0, gateEndT: 0, cool: { kanal: 0 }, nextMode: null, _ls: {},
    // şarkı başına durum: BPM bilinene kadar gizli, parça oylaması tek sefer
    trackKey: null, bpmKnown: false, bpmTries: 0, nextBpmT: 0, parcaAsked: false };
  const BPM_TOL = 3, BPM_MAX_TRIES = 3;
  M.on = (e, f) => (M._ls[e] = M._ls[e] || []).push(f);
  M.emit = (e, d) => (M._ls[e] || []).forEach((f) => f(d));
  const nick = (u) => '@' + String(u.nick || '').replace(/^@/, '').replace(/_/g, '\uFF3F').replace(/\*/g, '\u2217');
  const busy = () => game.lockT > 0 || club.festival > 0 || game.build >= 0.85;
  M.canStart = () => !M.round && !busy();

  function open(type, title, options, sec, data = {}) {
    M.round = { type, title, options: options.map((o) => ({ ...o, votes: 0, firstT: Infinity })), voters: new Map(), ballots: [], guesses: [], t: sec, max: sec, data };
    M.emit('round', M.round);
  }

  // ---------- kanal oyunu ----------
  function kanalKey(text) {
    const m = /^(solo|sustur|mute|sus)?\s*(kick|hat|hihat|hi-hat|bas|bass|acid|asit|melodi)$/.exec(text);
    if (!m) return null;
    const ch = CH_ALIAS[m[2]], op = m[1] && m[1] !== 'solo' ? 'mute' : 'solo';
    return { key: op + ':' + ch, label: (op === 'solo' ? '◉ SOLO ' : '⊘ SUSTUR ') + CH_LABEL[ch], op, ch };
  }
  M.startKanal = () => { if (!M.canStart()) return false; open('kanal', '🗳 KANAL OYU', [], 10); return true; };

  // ---------- sonraki parça ----------
  M.startParca = () => {
    if (!M.canStart() || game.dj) return false;
    const files = audio.ownMusic ? audio.tracks : null;
    if (files && files.length >= 2) {
      const idx = [...files.keys()].filter((i) => i !== audio.ti).sort(() => Math.random() - 0.5).slice(0, 3);
      open('parca', '🗳 SONRAKİ PARÇA', idx.map((i, n) => ({ key: String(n + 1), label: `${n + 1}  ${files[i].file.replace(/\.[^.]+$/, '')}`, file: i })), 15);
    } else if (!files) {
      const opts = MODES.filter((m) => m !== game.mode).sort(() => Math.random() - 0.5).slice(0, 3);
      open('parca', '🗳 SONRAKİ PARÇA', opts.map((m, n) => ({ key: String(n + 1), label: `${n + 1}  ${modeLabel(m)}`, mode: m })), 15);
    } else return false;
    return true;
  };

  // ---------- BPM tahmini ----------
  M.startBpm = () => {
    if (!M.canStart()) return false;
    open('bpm', '🎯 BPM TAHMİNİ', [], 20, { answer: Math.round(audio.currentBpm()) });
    M.bpmTries++;
    return true;
  };

  // ---------- yorumlar ----------
  // oyun komutuysa true döner (normal komutlar çalışmaz)
  M.onChat = (u, raw) => {
    const text = String(raw || '').toLocaleLowerCase('tr').replace(/[!.?,]+/g, ' ').replace(/\s+/g, ' ').trim();
    const R = M.round;
    const k = kanalKey(text);
    if (k) {
      if (!R && M.cool.kanal <= 0 && M.startKanal()) return vote(u, k), true;
      if (M.round && M.round.type === 'kanal') return vote(u, k), true;
      return true; // tur yokken/beklemedeyken de yut: "kick" dans komutu değil
    }
    if (R && R.type === 'parca' && /^[1-3]$/.test(text)) return vote(u, { key: text }), true;
    if (R && R.type === 'bpm' && /^\d{2,3}$/.test(text)) {
      const v = +text;
      if (v >= 60 && v <= 220 && !R.voters.has(u.id) && !(game.live && u.demo)) { R.voters.set(u.id, v); R.guesses.push({ u, v, t: game.time }); }
      return true;
    }
    return false;
  };

  function vote(u, k) {
    const R = M.round; if (!R || R.voters.has(u.id) || (game.live && u.demo)) return;
    let o = R.options.find((x) => x.key === k.key);
    if (!o) { if (R.type !== 'kanal') return; o = { ...k, votes: 0, firstT: Infinity }; R.options.push(o); }
    R.voters.set(u.id, k.key); o.votes++; if (o.firstT === Infinity) o.firstT = game.time;
    R.ballots.push({ key: k.key, demo: !!u.demo, t: game.time });
  }

  // canlıdayken demo dansçıların (yayın başlamadan önce verilmiş) oyları ve tahminleri sayılmaz
  function purgeDemo(R) {
    for (const o of R.options) { o.votes = 0; o.firstT = Infinity; }
    R.ballots = R.ballots.filter((b) => !b.demo);
    for (const b of R.ballots) { const o = R.options.find((x) => x.key === b.key); if (o) { o.votes++; o.firstT = Math.min(o.firstT, b.t); } }
    R.guesses = R.guesses.filter((g) => !g.u.demo);
    if (R.type === 'kanal') R.options = R.options.filter((o) => o.votes > 0);
  }
  M.onLive = () => { if (M.round) purgeDemo(M.round); };

  // ---------- sonuç ----------
  function resolve() {
    const R = M.round; M.round = null;
    if (game.live) purgeDemo(R);
    // en çok oy; eşitlikte ilk oy alan
    const win = R.options.slice().sort((a, b) => b.votes - a.votes || a.firstT - b.firstT)[0];
    if (R.type === 'kanal') {
      M.cool.kanal = 30;
      if (!win || !win.votes) return M.emit('roundEnd', { type: 'kanal', text: 'Kimse oy vermedi\nTekrar dene: *solo hat*' });
      M.gate = win.op === 'solo' ? { solo: win.ch } : { mute: win.ch };
      M.gateUntil = game.beat + 8;
      M.gateEndT = game.time + 8 * 60 / Math.max(60, audio.currentBpm()) + 1; // vuruş sayacı ne olursa olsun takılı kalmasın
      audio.setGate(M.gate);
      // kick yoksa kalabalığın başı boşta kalır
      game.grooveTarget = (win.op === 'mute' && win.ch === 'kick') || (win.op === 'solo' && win.ch !== 'kick') ? 0.3 : win.ch === 'kick' ? 0.75 : 1;
      M.emit('gate', M.gate);
      M.emit('roundEnd', { type: 'kanal', text: GATE_CAPS[win.key], sec: 6 });
    } else if (R.type === 'parca') {
      if (!win || !win.votes) return M.emit('roundEnd', { type: 'parca', text: 'Oy yok\nSıradaki parça _sürpriz_' });
      if (win.mode) M.nextMode = win.mode;
      if (win.file !== undefined) audio.queueNext = win.file;
      M.emit('roundEnd', { type: 'parca', text: `Kalabalık seçti\n*${win.mode ? modeLabel(win.mode) : win.label.replace(/^\d\s+/, '')}*`, sec: 4 });
    } else if (R.type === 'bpm') {
      const ans = R.data.answer;
      const best = R.guesses.slice().sort((a, b) => Math.abs(a.v - ans) - Math.abs(b.v - ans) || a.t - b.t)[0];
      const close = best && Math.abs(best.v - ans) <= BPM_TOL;
      if (!close) {
        // kimse doğru/yakın bilemedi: BPM gizli kalır, biraz sonra tekrar sorulur (en fazla 3 kez)
        if (M.bpmTries >= BPM_MAX_TRIES) { reveal(); return M.emit('roundEnd', { type: 'bpm', text: `Kimse bilemedi\nDoğrusu _${ans} BPM_`, sec: 5 }); }
        M.nextBpmT = game.time + 25;
        return M.emit('roundEnd', { type: 'bpm', text: best ? `En yakın *${nick(best.u)}*: ${best.v}\nAma _tutmadı_, birazdan tekrar` : 'Kimse tahmin etmedi\nBirazdan _tekrar_ soracağım', sec: 4 });
      }
      for (const g of R.guesses) if (g.v === ans) g.u.badge = '🎯';
      if (game.users.has(best.u.id)) { game.takePodium(best.u); club.ring({ x: best.u.d.x, y: best.u.d.y + 2, z: best.u.d.z }, 'accent'); }
      reveal();
      M.emit('roundEnd', { type: 'bpm', text: best.v === ans ? `*${nick(best.u)}* ${best.v} dedi\nTam _${ans} BPM_! 🎯` : `*${nick(best.u)}* ${best.v} dedi\nDoğrusu _${ans} BPM_ (yakın!)`, sec: 5 });
    }
  }
  function reveal() { M.bpmKnown = true; M.emit('bpm', true); }
  // parça değişirken: oylanan tarzı al
  M.takeNextMode = () => { const m = M.nextMode; M.nextMode = null; return m; };

  // ---------- kare ----------
  M.tick = (dt) => {
    M.checkTrack();
    for (const k in M.cool) M.cool[k] = Math.max(0, M.cool[k] - dt);
    // kanal etkisi 8 vuruş sonra biter
    if (M.gate && (game.beat >= M.gateUntil || game.time >= M.gateEndT)) { M.gate = null; audio.setGate(null); game.grooveTarget = 1; M.emit('gate', null); }
    const R = M.round;
    if (R) {
      if (!busy()) R.t -= dt;            // drop/festival sırasında süre durur
      if (R.t <= 0) resolve();
      return;
    }
    if (busy()) return;
    const p = progress();
    if (p == null) return;
    // 1) BPM tahmini: şarkının başlarında (%12'den sonra); bilinmezse 25 sn sonra tekrar
    const bpmWindow = (p >= 0.12 && p < 0.45) || (p >= 0.6 && p < 0.92);
    if (!M.bpmKnown && bpmWindow && game.time >= M.nextBpmT && M.startBpm()) return;
    // 2) sonraki parça: şarkının yarısında, tek sefer (açılamazsa — DJ var, tek parça — bu şarkıda bir daha sorulmaz)
    if (!M.parcaAsked && p >= 0.5 && p < 0.92) { M.parcaAsked = true; M.startParca(); }
  };

  // şarkının ilerlemesi 0..1 ve şarkı kimliği
  function progress() {
    if (audio.ownMusic) { const el = audio.el; return el && el.duration ? el.currentTime / el.duration : null; }
    return game.trackT / game.TRACK_LEN;
  }
  function currentKey() { return audio.ownMusic ? 'f' + audio.ti + ':' + (audio.el ? audio.el.src : '') : 's' + (game.track ? game.track.no : 0); }
  M.checkTrack = () => {
    const k = currentKey();
    if (k === M.trackKey) return;
    const first = M.trackKey === null;
    M.trackKey = k; M.bpmKnown = false; M.bpmTries = 0; M.parcaAsked = false; M.nextBpmT = 0;
    if (M.round && M.round.type !== 'kanal') M.round = null; // eski şarkının turu kapanır
    M.emit('bpm', false);
    if (!first) M.emit('trackChange', k);
  };
  return M;
}
