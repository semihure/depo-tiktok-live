// DEPO oyun mantığı. Tek giriş noktası: game.handle(olay)
//   { type:'member', user } | { type:'chat', user, text } | { type:'like', user, count }
//   { type:'gift', user, gift:{ name, id, diamonds, count, image } } | follow | share | { type:'viewers', count }
//   user = { id, nick }
import { NEON, modeLabel } from './sahne.js';
import { MOVES, SPECIALS } from './dansci.js';

export const LEVELS = [
  { n: 'SAKİN', bpm: 122, at: 0 },
  { n: 'ORTA', bpm: 128, at: 30 },
  { n: 'YÜKSEK', bpm: 136, at: 60 },
  { n: 'ZİRVE', bpm: 145, at: 85 },
];
export const DEFAULT_RULES = [
  { eylem: 'isikcubugu', etiket: 'Işık Çubuğu', jeton: 1, ikon: '🌹', ad: ['Rose', 'Gül'], id: ['5655'] },
  { eylem: 'podyum', etiket: 'Podyuma Çık', jeton: 10, ikon: '🕺', ad: [], id: [] },
  { eylem: 'lazer', etiket: 'Lazer Şovu', jeton: 30, ikon: '🔦', ad: [], id: [] },
  { eylem: 'co2', etiket: 'CO2 Patlat + Drop', jeton: 99, ikon: '💨', ad: [], id: [] },
  { eylem: 'vip', etiket: 'VIP Balkon', jeton: 199, ikon: '💎', ad: [], id: [] },
  { eylem: 'dj', etiket: 'DJ Ol', jeton: 500, ikon: '🎧', ad: [], id: [] },
  { eylem: 'festival', etiket: 'Festivali Başlat', minJeton: 1000, ikon: '🎆', ad: [], id: [] },
  { eylem: 'dans', dans: 'disko', etiket: 'Disko', jeton: 5, ikon: '🕺', ad: [], id: [] },
  { eylem: 'dans', dans: 'dalga', etiket: 'Vücut Dalgası', jeton: 15, ikon: '🌊', ad: [], id: [] },
  { eylem: 'dans', dans: 'yeldegirmeni', etiket: 'Yel Değirmeni', jeton: 20, ikon: '🌪️', ad: [], id: [] },
  { eylem: 'dans', dans: 'kalabalik', etiket: 'Kalabalığa Yaptır', jeton: 299, ikon: '👑', ad: [], id: [] },
];
const COLOR_WORDS = {
  mor: 'mor', yeşil: 'yesil', yesil: 'yesil', pembe: 'pembe', mavi: 'mavi', sarı: 'sari', sari: 'sari',
  kırmızı: 'kirmizi', kirmizi: 'kirmizi', turuncu: 'turuncu', beyaz: 'beyaz', turkuaz: 'turkuaz',
};
// yorumla geçici olarak seçilen ücretsiz hareketler
const CMD_MOVES = {
  el: 'hands', eller: 'hands', hands: 'hands', dans: 'shuffle', shuffle: 'shuffle', sallan: 'sway', sway: 'sway', yana: 'sway',
  hopla: 'bounce', bounce: 'bounce', robot: 'robot', kafa: 'headbang', headbang: 'headbang', twist: 'twist',
  alkış: 'clap', alkis: 'clap', clap: 'clap', yumruk: 'pump', pump: 'pump', adım: 'step', adim: 'step', step: 'step',
};
// DJ'in yorumla seçtiği tarzlar
const MODE_WORDS = { pop: 'pop', rap: 'rap', trap: 'trap', rnb: 'rnb', 'r&b': 'rnb', randb: 'rnb', rb: 'rnb' };
// oyunun kendi ürettiği sentez müzik (müzik klasörü boşken) bu iç ses kalıplarını kullanır
const SYNTH_OF = { pop: 'melodik', rap: 'deep', trap: 'hard', rnb: 'deep' };
const IDLE = 300, IDLE_GIFTER = 600, PODIUM_T = 90, DJ_T = 600, VIP_T = 900;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fmt = (n) => Math.round(n).toLocaleString('tr-TR');

export function createGame({ club, crowd, audio }) {
  const G = {
    time: 0, beat: 0, bpm: 122, energy: 10, level: 0, build: 0, lockT: 0, dropAge: -1, drops: 0,
    timeScale: 1, slowT: 0, vtime: 0, vbeat: 0, beatOff: 0,
    groove: 1, grooveTarget: 1, forcedMode: null, minigames: null,
    users: new Map(), scores: new Map(), top: [], rules: DEFAULT_RULES,
    likes: 0, diamonds: 0, viewers: 0, mode: 'pop', autoMode: true,
    dj: null, vip: [null, null, null, null], podium: [null, null],
    live: false, _ls: {}, club,
  };
  G.on = (e, f) => (G._ls[e] = G._ls[e] || []).push(f);
  G.emit = (e, d) => (G._ls[e] || []).forEach((f) => f(d));
  G.addEnergy = (v) => { G.energy = Math.min(100, G.energy + v); };
  G.addBuild = (v) => { if (G.lockT <= 0) G.build = Math.min(1, G.build + v); };

  // ---------- pist yerleri: yalnızca kadrajda görünen alan; ortadan dışa doğru dolar ----------
  const F = club.floor, SLOTS = [];
  const DX = 0.6, DZ = 0.58;
  for (let z = F.z0; z <= F.z1; z += DZ) for (let x = F.x0; x <= F.x1; x += DX) {
    const jx = x + ((Math.round(z / DZ) % 2) ? DX / 2 : 0);
    if (club.inFrame && !club.inFrame(jx, z, 0.95)) continue;
    if (club.podiums.some((p) => Math.abs(p.x - jx) < 0.95 && Math.abs(p.z - z) < 0.95)) continue;
    if (jx > 2.3 && z > -7.1 && z < -4.6) continue; // VIP platformunun ayakları
    SLOTS.push({ x: jx, z, owner: null, d: Math.hypot(jx * 0.9, (z + 1.8) * 1.0) });
  }
  SLOTS.sort((a, b) => a.d - b.d);
  const MAX_FLOOR = Math.min(SLOTS.length, 225);

  // ---------- resident DJ: kimse DJ değilken kabinde duran figür ----------
  // kimse DJ değilken kabinde duran "resident DJ" (adı ayarlar.json → residentDj, varsayılan "shure").
  // Biri DJ hediyesi atınca yerini alır, DJ süresi bitince geri gelir. Sayılara ve sıralamaya girmez.
  G.resident = null;
  G.residentUser = { id: 'resident', nick: 'shure', place: 'dj', demo: false, lastActive: 0, joinT: 0, avatar: '' };
  const residentName = () => G.residentUser.nick;
  G.setResident = (name) => {
    name = String(name || '').trim().replace(/^@/, '').slice(0, 24);
    if (!name) return;
    G.residentUser.nick = name;
    if (!G.dj) { club.dj = name; trackArtist(); }
  };
  function showResident(on) {
    if (on && !G.resident) {
      const p = club.djSpot;
      G.resident = crowd.add({ seed: 4242, x: p.x, z: p.z, y: p.y, move: 'nod', user: G.residentUser });
      Object.assign(G.resident, { tx: p.x, tz: p.z, ty: p.y, face: 0, yaw: 0 });
      club.dj = residentName();
    } else if (!on && G.resident) { crowd.remove(G.resident); G.resident = null; }
  }
  showResident(true);

  // ---------- parça kimliği (sentez müzik için) ----------
  const TRACKS = ['Beton Kat', 'Sabaha Karşı', 'Bodrum 3', 'Neon Duvar', 'Son Vapur', 'Fabrika Ayarı', 'Gece Vardiyası', 'Karanlık Oda', 'Paslı Kapı', 'Yeraltı Hattı', 'Kırık Saat', 'Çatı Katı', 'Siren', 'Asfalt', 'Depo No. 9', 'Sessiz Liman'];
  let trackI = (Math.random() * TRACKS.length) | 0;
  G.track = null; G.trackT = 0; G.TRACK_LEN = 180; // kendi müziğinde her parça 3 dk
  G.newTrack = () => {
    // kalabalık sonraki tarzı oyladıysa bu parça o tarzda çalar
    const voted = G.minigames && G.minigames.takeNextMode();
    G.forcedMode = voted || null;
    if (voted) { G.mode = voted; audio.setMode(SYNTH_OF[voted] || voted); club.mode = voted; }
    trackI = (trackI + 1 + ((Math.random() * 3) | 0)) % TRACKS.length;
    G.track = { title: TRACKS[trackI], artist: G.dj ? '@' + G.dj.u.nick.replace(/^@/, '') : residentName().toLocaleUpperCase('tr'), no: (G.track ? G.track.no : 0) + 1 };
    G.trackT = 0;
    G.emit('track', G.track);
  };
  G.newTrack();

  function freeSlot() { return SLOTS.slice(0, MAX_FLOOR).find((s) => !s.owner); }
  function toFloor(u) {
    let s = u.slot && u.slot.owner === u ? u.slot : freeSlot();
    if (!s) { evict(); s = freeSlot(); }
    if (!s) return false;
    s.owner = u; u.slot = s;
    const d = u.d;
    d.tx = s.x + (Math.random() - 0.5) * 0.12; d.tz = s.z + (Math.random() - 0.5) * 0.12; d.ty = 0; d.face = Math.PI;
    u.place = 'floor';
    return true;
  }
  function releaseSlot(u) { if (u.slot && u.slot.owner === u) u.slot.owner = null; u.slot = null; }
  function teleport(u, p, face) {
    releaseSlot(u);
    const d = u.d;
    club.sparkle({ x: d.x, y: d.y + 1, z: d.z }, '#ffffff', 20);
    d.x = d.tx = p.x; d.z = d.tz = p.z; d.y = d.ty = p.y; d.face = face; d.alpha = 0;
    club.sparkle({ x: p.x, y: p.y + 1, z: p.z }, d.col.getStyle(), 40);
  }

  // ---------- kullanıcılar ----------
  function ensure(user, demo = false) {
    let u = G.users.get(user.id);
    if (u) { u.lastActive = G.time; if (user.nick) u.nick = user.nick; if (user.avatar) u.avatar = user.avatar; if (!demo) u.demo = false; return u; }
    if (!demo) kickDemo();
    const seed = hash(String(user.id));
    const colors = Object.values(NEON);
    u = { id: user.id, nick: user.nick || 'misafir', avatar: user.avatar || '', seed, demo, lastActive: G.time, joinT: G.time, gifted: 0, bubble: null, place: 'floor', cmdT: -99 };
    u.d = crowd.add({ seed, color: colors[seed % colors.length], x: club.door.x + (Math.random() - 0.5), z: club.door.z, user: u });
    if (!u.d) { evict(); u.d = crowd.add({ seed, color: colors[seed % colors.length], x: club.door.x, z: club.door.z, user: u }); }
    if (!u.d) return null;
    u.d.fast = true;
    G.users.set(u.id, u);
    if (!toFloor(u)) { crowd.remove(u.d); G.users.delete(u.id); return null; }
    if (!demo) G.emit('feed', { kind: 'join', user: u, text: 'kulübe girdi 🎟️' });
    return u;
  }
  function leave(u) {
    releaseSlot(u); clearRoles(u);
    G.users.delete(u.id);
    u.leaving = true; u.bubble = null;
    const d = u.d; d.tx = club.door.x; d.tz = club.door.z; d.ty = 0; d.fast = true;
    if (d.y > 0.2) { d.y = 0; d.x = club.door.x - 1; d.z = club.door.z - 1; }
    G.leavingList.push(u);
  }
  G.leavingList = [];
  function isProtected(u) { return G.dj && G.dj.u === u || G.vip.some((v) => v && v.u === u) || G.podium.some((p) => p && p.u === u); }
  function evict() {
    let best = null, bs = Infinity;
    for (const u of G.users.values()) {
      if (isProtected(u)) continue;
      const sc = (u.demo ? -1e6 : 0) + u.lastActive + Math.min(600, u.gifted * 2);
      if (sc < bs) { bs = sc; best = u; }
    }
    if (best) leave(best);
  }
  // gerçek izleyici gelince demo dansçılar teker teker çıkar
  let demoKickT = 0;
  G.removeOneDemo = () => { for (const u of G.users.values()) if (u.demo && !u.leaving) { leave(u); return true; } return false; };
  function kickDemo() {
    if (G.time - demoKickT < 4) return;
    for (const u of G.users.values()) if (u.demo) { demoKickT = G.time; leave(u); return; }
  }
  G.realCount = () => { let n = 0; for (const u of G.users.values()) if (!u.demo) n++; return n; };

  // ---------- roller ----------
  function clearRoles(u) {
    if (G.dj && G.dj.u === u) { G.dj = null; club.dj = residentName(); G.autoMode = true; showResident(true); trackArtist(); G.emit('roles'); }
    G.vip = G.vip.map((v) => (v && v.u === u ? null : v));
    G.podium = G.podium.map((p) => (p && p.u === u ? null : p));
  }
  function backToFloor(u) { if (!G.users.has(u.id)) return; u.d.y = 0; u.d.ty = 0; toFloor(u); const d = u.d; d.x = d.tx; d.z = d.tz; d.alpha = 0; }

  function takePodium(u) {
    if (G.podium.some((p) => p && p.u === u)) { G.podium.find((p) => p && p.u === u).t = PODIUM_T; return; }
    let i = G.podium.findIndex((p) => !p);
    if (i < 0) { i = G.podium[0].t < G.podium[1].t ? 0 : 1; const old = G.podium[i].u; G.podium[i] = null; backToFloor(old); }
    G.podium[i] = { u, t: PODIUM_T };
    teleport(u, club.podiums[i], Math.PI); u.place = 'podium';
    G.emit('focus', { shot: 'podyum', i });
  }
  function takeVip(u) {
    if (G.vip.some((v) => v && v.u === u)) { G.vip.find((v) => v && v.u === u).t = VIP_T; return; }
    let i = G.vip.findIndex((v) => !v);
    if (i < 0) { i = 0; for (let k = 1; k < 4; k++) if (G.vip[k].t < G.vip[i].t) i = k; const old = G.vip[i].u; G.vip[i] = null; backToFloor(old); }
    G.vip[i] = { u, t: VIP_T };
    teleport(u, club.vipSlots[i], Math.PI / 2 + 0.4); u.place = 'vip';
    G.emit('focus', { shot: 'vip' });
  }
  function trackArtist() { if (G.track) { G.track.artist = G.dj ? '@' + G.dj.u.nick.replace(/^@/, '') : residentName().toLocaleUpperCase('tr'); G.emit('track', G.track); } }
  function takeDj(u) {
    showResident(false);
    if (G.dj && G.dj.u !== u) { const old = G.dj.u; G.dj = null; backToFloor(old); }
    G.podium = G.podium.map((p) => (p && p.u === u ? null : p));
    G.vip = G.vip.map((v) => (v && v.u === u ? null : v));
    G.dj = { u, t: DJ_T };
    teleport(u, club.djSpot, 0); u.place = 'dj'; crowd.command(u.d, 'hands', G.vtime, DJ_T);
    club.dj = u.nick; G.autoMode = false; trackArtist();
    club.showMsg(u.nick, '🎧 YENİ DJ', 5);
    G.emit('roles');
    G.emit('focus', { shot: 'dj' });
    G.emit('announce', `🎧 ${u.nick} artık DJ! Yorumla seç: pop · rap · trap · r&b`);
  }

  // ---------- drop ----------
  function doDrop(by) {
    G.build = 0; G.lockT = 7; G.dropAge = 0; G.drops++;
    G.slowT = 1.5; // 0.9 sn ağır çekim + 0.6 sn dönüş
    club.smoke(40); club.disco = Math.max(club.disco, 8); crowd.wave = 0;
    audio.drop(); audio.setBuild(0);
    club.confetti(320); club.co2(); club.flash(G.time, 1);
    G.addEnergy(15);
    G.emit('drop', { by });
    G.emit('focus', { shot: 'kalabalik', shake: 1 });
  }
  G.forceDrop = () => doDrop(null);
  G.takePodium = (u) => takePodium(u);

  // ---------- olaylar ----------
  // sahnede olmayan izleyicinin olayları: sadece sayılır
  function outsider(ev) {
    const nick = String(ev.user.nick || '');
    switch (ev.type) {
      case 'member': G.addEnergy(0.5); G.addBuild(0.004); break;
      case 'like': { const n = Math.max(1, ev.count | 0); G.likes += n; G.addEnergy(Math.min(6, 0.35 * n)); G.addBuild(Math.min(0.05, 0.0035 * n)); break; }
      case 'follow': G.addEnergy(3); G.addBuild(0.03); club.showMsg(nick, '➕ TAKİP ETTİ', 3); club.laserShow(3); break;
      case 'share': G.addEnergy(3); G.addBuild(0.03); club.showMsg(nick, '🔗 PAYLAŞTI', 3); club.laserShow(3); break;
    }
  }

  G.handle = (ev) => {
    if (!ev || !ev.type) return;
    if (ev.type === 'viewers') { G.viewers = ev.count | 0; return; }
    if (!ev.user || !ev.user.id) return;
    // sahneye yalnızca yorum yazan ya da hediye atan girer ("Yorum yaz, kulübe gir!").
    // Sadece yayına giren, beğenen, takip eden: enerji ve drop barına katkı verir ama dansçı olmaz.
    const joins = ev.type === 'chat' || ev.type === 'gift' || ev.demoUser;
    if (!joins && !G.users.has(ev.user.id)) { outsider(ev); return; }
    const u = ensure(ev.user, !!ev.demoUser);
    if (!u) return;
    switch (ev.type) {
      case 'member': G.addEnergy(0.5); G.addBuild(0.004); break;
      case 'chat': {
        const text = String(ev.text || '').slice(0, 100);
        u.bubble = { text, t: G.time };
        command(u, text);
        G.addEnergy(1.2); G.addBuild(0.008);
        G.emit('feed', { kind: 'chat', user: u, text });
        break;
      }
      case 'like': {
        const n = Math.max(1, ev.count | 0);
        G.likes += n;
        G.addEnergy(Math.min(6, 0.35 * n)); G.addBuild(Math.min(0.05, 0.0035 * n));
        const h = crowd.headPos(u.d);
        for (let i = 0; i < Math.min(n, 5); i++) club.emit(h.x, h.y + 0.2, h.z, (Math.random() - 0.5) * 0.6, 1.5 + Math.random(), (Math.random() - 0.5) * 0.6, 'accent', 1.3, 0.2); // beğeni kalpleri vurgu renginde
        if (G.time - (u.likeFeedT || -99) > 8) { u.likeFeedT = G.time; G.emit('feed', { kind: 'like', user: u, text: `${n} beğeni ❤️` }); }
        break;
      }
      case 'gift': gift(u, ev.gift || {}); break;
      case 'follow':
        G.addEnergy(3); G.addBuild(0.03);
        club.showMsg(u.nick, '➕ TAKİP ETTİ', 3); club.laserShow(3);
        G.emit('feed', { kind: 'follow', user: u, text: 'takip etti ➕' });
        break;
      case 'share':
        G.addEnergy(3); G.addBuild(0.03);
        club.showMsg(u.nick, '🔗 PAYLAŞTI', 3); club.laserShow(3);
        G.emit('feed', { kind: 'share', user: u, text: 'yayını paylaştı 🔗' });
        break;
    }
  };

  function command(u, text) {
    if (G.minigames && G.minigames.onChat(u, text)) return; // mini oyun komutu
    const words = text.toLocaleLowerCase('tr').replace(/r\s*&\s*b/g, 'rnb').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const d = u.d;
    for (const w of words) {
      if (COLOR_WORDS[w]) { crowd.setColor(d, NEON[COLOR_WORDS[w]]); club.sparkle(crowd.headPos(d), NEON[COLOR_WORDS[w]], 18); }
      else if (/^(zıpla|zipla|hop|jump)$/.test(w)) d.jumpT = G.vtime;
      else if (CMD_MOVES[w]) crowd.command(d, CMD_MOVES[w], G.vtime); // 45 sn, sonra kendi repertuvarına döner
      else if (w === 'drop' && G.time - u.cmdT > 8) { u.cmdT = G.time; G.addBuild(0.03); }
      else if (MODE_WORDS[w] && G.dj && G.dj.u === u) {
        G.mode = MODE_WORDS[w]; audio.setMode(SYNTH_OF[G.mode] || G.mode); club.mode = G.mode;
        club.showMsg(modeLabel(G.mode), `🎧 ${u.nick} seçti`, 3);
        G.emit('feed', { kind: 'dj', user: u, text: `modu ${modeLabel(G.mode)} yaptı 🎛️` });
      }
    }
  }

  function matchRule(gf, dia) {
    const name = String(gf.name || '').toLocaleLowerCase('tr'), id = String(gf.id || '');
    const R = G.rules;
    return R.find((r) => id && (r.id || []).map(String).includes(id))
      || R.find((r) => name && (r.ad || []).some((a) => a.toLocaleLowerCase('tr') === name))
      || R.find((r) => !(r.id || []).length && !(r.ad || []).length && r.jeton === dia)
      || R.filter((r) => r.minJeton && dia >= r.minJeton).sort((a, b) => b.minJeton - a.minJeton)[0]
      || null;
  }
  G.matchRule = matchRule;

  // ---------- özel danslar (hediyeyle) ----------
  function specialDance(u, r, cnt) {
    const d = u.d, name = r.dans;
    if (name === 'kalabalik') {
      // etrafındaki 12 kişi 20 sn boyunca onun son özel dansını yapar
      const dance = crowd.specialOf(d, G.vtime) || u.lastSpecial || 'disko';
      crowd.setSpecial(d, dance, G.vtime, 20);
      // kendi parasıyla özel dans yapanlar etkilenmez (dansları ezilmesin)
      const near = crowd.list.filter((o) => o !== d && o.user && !o.user.leaving && o.user.place === 'floor' && !crowd.specialOf(o, G.vtime))
        .sort((a, b) => Math.hypot(a.x - d.x, a.z - d.z) - Math.hypot(b.x - d.x, b.z - d.z)).slice(0, 12);
      for (const o of near) crowd.setSpecial(o, dance, G.vtime, 20);
      club.ring({ x: d.x, y: d.y + 2.2, z: d.z }, 'accent'); club.ring({ x: d.x, y: d.y + 1.2, z: d.z }, 'accent');
      G.emit('focus', {});
      G.emit('banner', { user: u, text: `👑 kalabalığa _${(SPECIALS[dance] || SPECIALS.disko).ad}_ yaptırıyor!` });
      return;
    }
    const sp = SPECIALS[name] ? name : 'disko';
    crowd.setSpecial(d, sp, G.vtime, 60 * Math.max(1, cnt));
    u.lastSpecial = sp;
    club.sparkle(crowd.headPos(d), 'accent', 50);
    G.emit('focus', {});
    G.emit('banner', { user: u, text: `${SPECIALS[sp].icon} _${SPECIALS[sp].ad}_ yapıyor!` });
  }

  function gift(u, gf) {
    const dia = Math.max(1, gf.diamonds | 0), cnt = Math.max(1, gf.count | 0), total = dia * cnt;
    u.gifted += total; u.lastActive = G.time;
    G.diamonds += total;
    const sc = G.scores.get(u.id) || { id: u.id, nick: u.nick, d: 0 };
    sc.d += total; sc.nick = u.nick; sc.avatar = u.avatar || sc.avatar; G.scores.set(u.id, sc);
    G.top = [...G.scores.values()].sort((a, b) => b.d - a.d).slice(0, 5);
    G.emit('board');
    G.addEnergy(Math.min(30, 3 + total * 0.05)); G.addBuild(Math.min(0.3, 0.01 + total * 0.002));

    const r = matchRule(gf, dia);
    // gerçek hediye görselini öğren: rehberde emoji yerine TikTok'un hediye resmi görünsün (dosyaya da kaydedilir)
    if (r && gf.image && /^https:\/\//.test(gf.image) && r.resim !== gf.image) {
      r.resim = gf.image; G.emit('rules');
      if (location.protocol !== 'file:') fetch('/api/rule-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: r.eylem + (r.dans ? ':' + r.dans : ''), resim: gf.image }) }).catch(() => {});
    }
    G.emit('giftlog', { user: u, gift: gf, dia, cnt, rule: r });
    const label = r ? `${r.ikon || ''} ${r.etiket}` : `${fmt(total)} 💎 ışık şovu`;
    G.emit('feed', { kind: 'gift', user: u, text: `${gf.name || 'Hediye'} ×${cnt} → ${label}` });
    const d = u.d, head = crowd.headPos(d);
    d.celebrateT = G.vtime; d.celebrateBig = total >= 99;
    if (total >= 99) club.ring(head, d.col.getStyle());
    if (!r) {
      club.sparkle(head, d.col.getStyle(), Math.min(120, 20 + total));
      if (total >= 20) club.laserShow(Math.min(10, 2 + total / 20));
      if (total >= 100) { club.confetti(Math.min(400, total)); club.flash(G.time, 0.7); G.emit('banner', { user: u, text: `${fmt(total)} 💎 ışık şovu!` }); }
      return;
    }
    switch (r.eylem) {
      case 'isikcubugu': d.bigStick = 25 * Math.min(4, cnt); club.sparkle(head, d.col.getStyle(), 40); break;
      case 'podyum': takePodium(u); G.emit('announce', `🕺 ${u.nick} podyumda!`); break;
      case 'lazer': club.laserShow(10); club.showMsg(u.nick, '🔦 LAZER ŞOVU', 4); G.emit('focus', { shot: 'genel' }); break;
      case 'co2': club.co2(); club.smoke(30); doDrop(u); G.emit('banner', { user: u, text: '💨 CO2 patlattı, DROP!' }); break;
      case 'vip': takeVip(u); G.emit('banner', { user: u, text: '💎 VIP balkona çıktı' }); break;
      case 'dj': takeDj(u); G.emit('banner', { user: u, text: '🎧 DJ kabinine geçti!' }); break;
      case 'dans': specialDance(u, r, cnt); break;
      case 'festival':
        club.festival = 45; club.showMsg('FESTİVAL', `🎆 ${u.nick} başlattı`, 5);
        for (let i = 0; i < 4; i++) setTimeout(() => club.firework(), i * 300);
        doDrop(u); G.emit('banner', { user: u, text: '🎆 FESTİVALİ BAŞLATTI!' });
        break;
    }
  }

  // ---------- kare güncelleme ----------
  G.update = (dt) => {
    G.time += dt;
    // tempo kademesi
    G.energy = Math.max(8, G.energy - dt * 0.5);
    let lv = 0; for (let i = 0; i < LEVELS.length; i++) if (G.energy >= LEVELS[i].at) lv = i;
    if (club.festival > 0) lv = Math.max(lv, 2);
    if (lv !== G.level) { G.level = lv; G.emit('level', lv); }
    G.bpm = LEVELS[lv].bpm;
    audio.setBpm(G.bpm); audio.setIntensity(lv);
    G.groove += (G.grooveTarget - G.groove) * Math.min(1, dt * 4);
    if (G.autoMode && !G.forcedMode) { const m = ['rnb', 'pop', 'rap', 'trap'][lv]; if (m !== G.mode) { G.mode = m; audio.setMode(SYNTH_OF[m] || m); club.mode = m; } }
    club.bpm = audio.currentBpm();

    // vuruş saati: ses açıksa sesten, değilse kendi saatimiz
    const ab = audio.beatNow();
    if (ab != null) {
      // sayaç geri atlarsa (şarkı değişimi) görsel vuruş kesintisiz kalsın
      if (ab < G.beat - 1) G.beatOff += Math.round(G.beat - ab);
      G.beat = ab;
    } else G.beat += dt * G.bpm / 60;

    // ağır çekim: görsel zaman yavaşlar; görsel vuruş geride kalır, sonra en yakın tam vuruşa oturur
    if (G.slowT > 0) { G.slowT -= dt; G.timeScale = G.slowT > 0.6 ? 0.3 : 0.3 + 0.7 * (1 - G.slowT / 0.6); }
    else G.timeScale = 1;
    if (G.timeScale < 1) G.beatOff -= dt * (1 - G.timeScale) * G.bpm / 60;
    else { const tgt = Math.round(G.beatOff); G.beatOff += (tgt - G.beatOff) * Math.min(1, dt * 3); }
    G.vtime += dt * G.timeScale;
    G.vbeat = G.beat + G.beatOff;

    // ışık çubuğu dalgası: build %60'tan sonra büyür
    const wantWave = G.lockT > 0 ? 0 : Math.max(0, (G.build - 0.6) / 0.35);
    crowd.wave += (Math.min(1, wantWave) - crowd.wave) * Math.min(1, dt * 2);

    // build: boşta da yavaşça dolar; drop sonrası kısa kilit
    if (G.lockT > 0) G.lockT -= dt; else G.addBuild(dt * 0.0035);
    if (G.dropAge >= 0) G.dropAge += dt;
    audio.setBuild(G.build);
    if (G.build >= 1) doDrop(null);

    // rol süreleri
    if (G.dj && (G.dj.t -= dt) <= 0) { const u = G.dj.u; G.dj = null; club.dj = residentName(); G.autoMode = true; showResident(true); trackArtist(); backToFloor(u); G.emit('roles'); }
    // parça: drop'tan 24 sn sonra ya da 3 dakikada bir yenisi başlar
    G.trackT += dt;
    if (!audio.ownMusic && G.trackT >= G.TRACK_LEN) G.newTrack();
    G.podium.forEach((p, i) => { if (p && (p.t -= dt) <= 0) { G.podium[i] = null; backToFloor(p.u); } });
    G.vip.forEach((v, i) => { if (v && (v.t -= dt) <= 0) { G.vip[i] = null; backToFloor(v.u); } });

    // etkileşimsiz kalan çıkar
    for (const u of G.users.values()) {
      if (u.demo || isProtected(u)) continue;
      if (G.time - u.lastActive > (u.gifted ? IDLE_GIFTER : IDLE)) leave(u);
    }
    // kapıya ulaşanlar silinir
    G.leavingList = G.leavingList.filter((u) => {
      const d = u.d;
      if (Math.hypot(d.x - club.door.x, d.z - club.door.z) < 0.25) { crowd.remove(d); return false; }
      return true;
    });
    for (const u of G.users.values()) if (u.d.fast && Math.hypot(u.d.tx - u.d.x, u.d.tz - u.d.z) < 0.05) u.d.fast = false;
  };

  G.setRules = (rules) => { if (Array.isArray(rules) && rules.length) G.rules = rules; G.emit('rules'); };
  G.reset = () => {
    for (const u of [...G.users.values()]) leave(u);
    G.scores.clear(); G.top = []; G.likes = G.diamonds = 0; G.energy = 10; G.build = 0;
    G.emit('board'); G.emit('roles');
  };
  G.MOVES = MOVES;
  return G;
}
