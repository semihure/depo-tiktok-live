// DEPO — yerel köprü sunucusu
//  • public/ klasörünü ve three.js modüllerini servis eder
//  • TikTok LIVE olaylarını (tiktok-live-connector) sade bir formata çevirir
//  • olayları SSE (/api/events) ile açık tüm sahne sayfalarına yayınlar
//  • kontrol panelindeki demo butonları da /api/demo üzerinden aynı yoldan gider
//
// Kullanım: node server.js [kullaniciadi]   (ya da ayarlar.json / kontrol paneli)
const http = require('http');
const fs = require('fs');
const path = require('path');

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
if (NODE_MAJOR < 20) console.warn(`\n  ⚠️  Node.js ${process.versions.node} eski. TikTok bağlantısı için Node 20 veya üstü gerekir (demo yine çalışır).\n     https://nodejs.org adresinden LTS sürümünü kur.\n`);
const PORT = Number(process.env.PORT) || 3200;
const ROOT = path.join(__dirname, 'public');
const THREE_DIR = path.join(__dirname, 'node_modules', 'three');
const CONFIG_FILE = path.join(__dirname, 'ayarlar.json');
const RULES_FILE = path.join(__dirname, 'hediyeler.json');
const IMG_FILE = path.join(__dirname, 'hediye-resimleri.json'); // oyunun öğrendiği gerçek TikTok hediye görselleri
const readImages = () => { try { return JSON.parse(fs.readFileSync(IMG_FILE, 'utf8')); } catch { return {}; } };
const ruleKey = (r) => r.eylem + (r.dans ? ':' + r.dans : '');
const MUSIC_DIR = [path.join(__dirname, 'müzik'), path.join(__dirname, 'muzik')].find((d) => fs.existsSync(d)) || path.join(__dirname, 'müzik');
const AUDIO_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|flac)$/i;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
  '.opus': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm', '.flac': 'audio/flac',
};

// ---------- dosya servisi (müzikte ileri sarma için Range destekli) ----------
function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? +range[1] : 0;
      const end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}
const inside = (base, file) => file === base || file.startsWith(base + path.sep);

// ---------- ayarlar ----------
const config = { username: '', signApiKey: '', residentDj: 'shure' }; // residentDj: kimse DJ değilken kabindeki isim
try { Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); }
catch (e) { if (fs.existsSync(CONFIG_FILE)) console.warn('[ayarlar] ayarlar.json okunamadı (tırnak/virgül silinmiş olabilir):', e.message); }
if (process.env.EULER_API_KEY) config.signApiKey = process.env.EULER_API_KEY;
if (process.argv[2]) config.username = process.argv[2].replace(/^@/, '');
const saveConfig = () => { try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch {} };

// ---------- SSE ----------
const clients = new Set();
function broadcast(obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of clients) res.write(line);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000);

// ---------- TikTok bağlantısı ----------
// gen: her bağlan/kes işleminde artar; eski bağlantılardan gelen olaylar ve zamanlayıcılar yok sayılır
const live = { conn: null, username: '', gen: 0, timer: null, ended: false, connectedAt: 0 };
let status = { state: 'idle', username: '', message: 'Bağlı değil' };
function setStatus(state, message) {
  status = { state, username: live.username, message };
  broadcast({ type: 'status', status });
  console.log(`[TikTok] ${state.padEnd(10)} ${message}`);
}

let lib = null;
async function loadLib() {
  if (lib) return lib;
  lib = await import('tiktok-live-connector');
  // "yayında mı?" sorgusu Euler'e gitmesin, bağlantı kotasını yemesin
  if (lib.IsLiveRouteConfig) lib.IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = true;
  return lib;
}

function userOf(d) {
  const u = (d && d.user) || {};
  const handle = u.uniqueId || u.displayId || '';
  const id = String(handle || u.userId || u.id || '');
  if (!id) return null;
  // profil fotoğrafı: kütüphane sürümüne göre alan adı değişiyor, bilinenleri sırayla dene
  const avatar = firstUrl(u.avatarThumb) || firstUrl(u.avatarMedium) || firstUrl(u.profilePicture) || firstUrl(u.avatarLarge)
    || String(u.profilePictureUrl || '') || '';
  return { id: 'tt_' + id, nick: String(u.nickname || handle || id).slice(0, 24), ...(/^https:\/\//.test(avatar) ? { avatar } : {}) };
}
function firstUrl(img) {
  if (!img) return '';
  const list = img.urlList || img.url_list || img.mUrls || img.url || [];
  return Array.isArray(list) ? list[0] || '' : String(list);
}
function emitUser(type, d, extra) {
  const user = userOf(d);
  if (user) broadcast({ type, user, ...extra });
}

function attach(conn, gen) {
  const { WebcastEvent, ControlEvent } = lib;
  const current = () => gen === live.gen && conn === live.conn;

  conn.on(ControlEvent.ERROR, (e) => { if (current()) console.warn('[TikTok] hata:', (e && (e.info || e.message)) || e); });
  conn.on(ControlEvent.DISCONNECTED, () => {
    if (!current() || live.ended) return;
    setStatus('waiting', 'Bağlantı koptu, 10 sn sonra tekrar denenecek…');
    retry(gen, 10000);
  });
  conn.on(WebcastEvent.STREAM_END, () => {
    if (!current()) return;
    live.ended = true;
    setStatus('waiting', `@${live.username} yayını bitti. Yeni yayın açılınca otomatik bağlanacak.`);
    // bağlanır bağlanmaz "bitti" geldiyse TikTok eski odayı veriyor; hemen denemek kotayı yakar
    retry(gen, Date.now() - live.connectedAt < 30000 ? 90000 : 30000);
  });

  const on = (ev, fn) => conn.on(ev, (d) => { if (current()) fn(d); });
  on(WebcastEvent.CHAT, (d) => emitUser('chat', d, { text: String(d.comment || d.content || '') }));
  on(WebcastEvent.MEMBER, (d) => emitUser('member', d));
  on(WebcastEvent.LIKE, (d) => emitUser('like', d, { count: Number(d.likeCount ?? d.count ?? 1) || 1 }));
  on(WebcastEvent.FOLLOW, (d) => emitUser('follow', d));
  on(WebcastEvent.SHARE, (d) => emitUser('share', d));
  on(WebcastEvent.ROOM_USER, (d) => {
    const n = Number(d.viewerCount ?? d.total ?? d.totalUser);
    if (Number.isFinite(n) && n >= 0) broadcast({ type: 'viewers', count: n });
  });
  on(WebcastEvent.GIFT, (d) => {
    const g = d.gift || {}, gd = d.giftDetails || {}, ex = d.extendedGiftInfo || {};
    const giftType = gd.giftType ?? g.type ?? ex.type;
    if (giftType === 1 && !d.repeatEnd) return; // seri hediye: yalnızca serinin son olayını say
    const name = String(gd.giftName || g.name || ex.name || 'Hediye');
    const diamonds = Number(gd.diamondCount ?? g.diamondCount ?? ex.diamond_count ?? ex.diamondCount ?? 1) || 1;
    const count = Math.max(1, Number(d.repeatCount) || 1);
    const image = firstUrl(g.image) || firstUrl(ex.image) || firstUrl(gd.giftImage);
    const id = String(d.giftId || g.id || gd.id || '');
    const u = userOf(d);
    console.log(`[Hediye] ${u ? u.nick : '?'} → ${name} (id ${id || '-'}) ${diamonds} jeton ×${count}`);
    emitUser('gift', d, { gift: { name, id, diamonds, count, image } });
  });
}

function retry(gen, ms) {
  clearTimeout(live.timer);
  live.timer = setTimeout(() => tryConnect(gen), ms);
}

function newConn(gen) {
  // her denemede yeni nesne: eskisi bitmiş yayının oda numarasını tutuyor olabilir
  const c = new lib.TikTokLiveConnection(live.username, {
    enableExtendedGiftInfo: false, // hediye listesi Euler'de ücretli plan istiyor; olaylarda bilgi zaten geliyor
    processInitialData: false,     // bağlanınca eski mesajları tekrar oynatma
    ...(config.signApiKey ? { signApiKey: config.signApiKey } : {}),
  });
  attach(c, gen);
  return c;
}

async function tryConnect(gen) {
  if (gen !== live.gen) return;
  if (live.conn) { const old = live.conn; live.conn = null; old.disconnect().catch(() => {}); }
  const conn = live.conn = newConn(gen);
  live.ended = false;

  let isLive = null;
  try { isLive = await conn.fetchIsLive(); } catch { isLive = null; }
  if (gen !== live.gen || conn !== live.conn) return;
  if (isLive === false) {
    setStatus('waiting', `@${live.username} şu an yayında değil. Yayın açılınca otomatik bağlanacak (30 sn'de bir kontrol).`);
    return retry(gen, 30000);
  }

  setStatus('connecting', `@${live.username} yayınına bağlanılıyor…`);
  try {
    await conn.connect();
    if (gen !== live.gen || conn !== live.conn) { conn.disconnect().catch(() => {}); return; }
    live.connectedAt = Date.now();
    setStatus('live', `@${live.username} canlı yayınına bağlandı`);
  } catch (err) {
    if (gen !== live.gen || conn !== live.conn) return;
    const msg = String((err && err.message) || err);
    if (/rate.?limit|too many/i.test(msg)) {
      setStatus('error', 'Euler bağlantı servisinin saatlik sınırı doldu. 10 dk sonra kendiliğinden tekrar denenecek.');
      return retry(gen, 10 * 60000);
    }
    const offline = (lib.UserOfflineError && err instanceof lib.UserOfflineError) || /offline|not live|isn't online|not online/i.test(msg);
    if (offline) setStatus('waiting', `@${live.username} şu an yayında değil. Yayın açılınca otomatik bağlanacak.`);
    else setStatus('error', `Bağlanamadı: ${msg.slice(0, 160)} — 45 sn sonra tekrar denenecek.`);
    retry(gen, offline ? 30000 : 45000);
  }
}

async function disconnect() {
  live.gen++;
  clearTimeout(live.timer);
  const c = live.conn;
  live.conn = null;
  if (c) { try { await c.disconnect(); } catch {} }
}

async function connect(username) {
  username = String(username || '').trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\//, '').replace(/^@/, '').replace(/[/?].*$/, '');
  await disconnect();
  if (!username) return setStatus('idle', 'Bağlı değil');
  try { await loadLib(); }
  catch (e) { return setStatus('error', NODE_MAJOR < 20 ? `Node.js ${process.versions.node} eski: TikTok bağlantısı için Node 20+ kur (nodejs.org, LTS).` : 'tiktok-live-connector yüklenemedi: ' + e.message); }
  live.username = username;
  config.username = username; saveConfig();
  tryConnect(live.gen);
}

// ---------- HTTP ----------
function readJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}
const json = (res, obj, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const DEMO_TYPES = new Set(['member', 'chat', 'like', 'gift', 'follow', 'share', 'viewers', 'control']); // control: panelin yayın kontrolü

http.createServer(async (req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/'; }

  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (p === '/api/status') return json(res, { status, savedUsername: config.username, hasKey: !!config.signApiKey, residentDj: config.residentDj || 'shure' });
  if (p === '/api/connect' && req.method === 'POST') {
    const b = await readJson(req);
    connect(b.username).catch((e) => setStatus('error', 'Bağlanamadı: ' + e.message));
    return json(res, { ok: true });
  }
  if (p === '/api/disconnect' && req.method === 'POST') {
    await disconnect();
    config.username = ''; saveConfig();
    setStatus('idle', 'Bağlantı kesildi');
    return json(res, { ok: true });
  }
  if (p === '/api/demo' && req.method === 'POST') { // panel butonları → tüm sahneler
    const ev = await readJson(req);
    if (ev && DEMO_TYPES.has(ev.type)) broadcast({ ...ev, demo: true });
    return json(res, { ok: true });
  }
  if (p === '/api/rules') { // her istekte okunur: düzenle, sayfayı yenile
    try {
      const data = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')), imgs = readImages();
      for (const r of data.kurallar || []) if (!r.resim && imgs[ruleKey(r)]) r.resim = imgs[ruleKey(r)];
      return json(res, data);
    }
    catch (e) { return json(res, { kurallar: [], hata: 'hediyeler.json okunamadı: ' + e.message }); }
  }
  if (p === '/api/rule-image' && req.method === 'POST') { // gelen gerçek hediyenin görseli → o kurala kaydet
    const b = await readJson(req);
    if (typeof b.key === 'string' && /^https:\/\//.test(b.resim || '') && b.key.length < 60) {
      const imgs = readImages(); if (imgs[b.key] !== b.resim) { imgs[b.key] = String(b.resim); try { fs.writeFileSync(IMG_FILE, JSON.stringify(imgs, null, 2)); } catch {} }
    }
    return json(res, { ok: true });
  }
  if (p === '/api/music') {
    let tracks = [];
    try { tracks = fs.readdirSync(MUSIC_DIR).filter((f) => AUDIO_RE.test(f)).sort((a, b) => a.localeCompare(b, 'tr')); } catch {}
    return json(res, { tracks });
  }
  if (p.startsWith('/muzik/')) {
    const f = path.normalize(path.join(MUSIC_DIR, p.slice(7)));
    if (!inside(MUSIC_DIR, f) || !AUDIO_RE.test(f)) { res.writeHead(403); return res.end(); }
    return serveFile(req, res, f);
  }
  if (p.startsWith('/three/')) {
    const f = path.normalize(path.join(THREE_DIR, p.slice(7)));
    if (!inside(THREE_DIR, f)) { res.writeHead(403); return res.end(); }
    return serveFile(req, res, f);
  }

  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!inside(ROOT, file)) { res.writeHead(403); return res.end(); }
  serveFile(req, res, file);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  🎧 DEPO hazır — kontrol paneli: http://localhost:${PORT}`);
  console.log(`  🎬 Yayın sahnesi (pencere yakalama için): http://localhost:${PORT}/?clean\n`);
  let n = 0; try { n = fs.readdirSync(MUSIC_DIR).filter((f) => AUDIO_RE.test(f)).length; } catch {}
  console.log(n ? `  🎵 ${n} parça bulundu: ${MUSIC_DIR}\n` : '  🎵 Müzik klasörü boş: oyun kendi techno\'sunu üretecek.\n');
  if (!config.signApiKey) console.log('  ⚠️  ayarlar.json içinde signApiKey (Euler) boş. Demo çalışır, canlı bağlantı için anahtar gerekir.\n');
  if (config.username) connect(config.username);
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\n  ✅ Sunucu zaten açık: http://localhost:${PORT}\n`);
    process.exit(0);
  }
  throw e;
});
