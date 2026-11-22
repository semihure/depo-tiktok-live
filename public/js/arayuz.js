// Arayüz: "şu an çalıyor" şeridi, durum/kanal satırı, altyazı, ilerleme çizgisi, hediye rehberi, isim etiketleri, kontrol paneli.

import { SPECIALS } from './dansci.js';
import { modeLabel } from './sahne.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('tr-TR');

export function createUI({ game, crowd, club, audio, camera, live, demo, mini, quality }) {
  const lbl = $('lbl'), lg = lbl.getContext('2d');
  const UI = {};

  // ---------- akış (küçük, soluk, en fazla 3 satır) ----------
  const feed = $('feed');
  game.on('feed', (e) => {
    if (e.user && e.user.demo && e.kind !== 'gift') return;
    const el = document.createElement('div');
    el.className = 'f ' + e.kind;
    el.innerHTML = `<b>${esc(e.user ? e.user.nick : '')}</b> ${esc(e.text)}`;
    feed.appendChild(el);
    while (feed.children.length > 3) feed.firstChild.remove();
  });

  // ---------- altyazı: ortalı, 2 satır, kalın vurgulu (duyurular buraya) ----------
  // metinde *kalın* ve _vurgu rengi_ işaretleri kullanılır
  const capEl = $('caption');
  const fmtCap = (t) => esc(t).replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<em>$1</em>');
  const IDLE_CAPS = [
    'Kafan kick\'te düşer\n_Beğen_, drop\'u *sen getir*',
    'Yorumda *zıpla*, *el* ya da *kafa* yaz\nKalabalık _seninle_ oynar',
    'Bir renk yaz: *mor*, *yeşil*, *pembe*\nKalabalıkta _kendini_ bul',
    'Hediye at, *podyuma* çık\nYa da _DJ kabinine_ geç',
  ];
  let capQ = [], capT = 0, idleI = 0, idleT = 6;
  function caption(text, sec = 3.2, prio = false) {
    if (prio) capQ.unshift({ text, sec }); else capQ.push({ text, sec });
    if (capQ.length > 4) capQ.length = 4;
  }
  function showCap(c) { capEl.innerHTML = fmtCap(c.text).replace('\n', '<br>'); capEl.classList.add('on'); capT = c.sec; }
  // isimdeki _ ve * biçimlendirme sanılmasın: görünüşü aynı karakterlerle değiştir
  const nick = (u) => '@' + String(u.nick || '').replace(/^@/, '').replace(/_/g, '\uFF3F').replace(/\*/g, '\u2217');
  game.on('banner', ({ user, text }) => caption(`*${nick(user)}*\n${text}`));
  game.on('announce', (t) => caption(t.replace(/^(\S+)\s/, '$1 '), 3));
  const dropText = $('dropText'), flashEl = $('flash');
  game.on('drop', ({ by }) => {
    dropText.classList.remove('on'); void dropText.offsetWidth; dropText.classList.add('on');
    caption(by ? `*${nick(by)}*\ndrop'u _getirdi_` : 'Kalabalık _drop\'u getirdi_', 3, true);
  });

  // ---------- şu an çalıyor ----------
  const npArtist = $('npArtist'), npTitle = $('npTitle'), npMode = $('npMode'), bpmEl = $('bpm');
  const beatEls = [...document.querySelectorAll('#beats i')], chanEls = {};
  document.querySelectorAll('#chans span').forEach((el) => (chanEls[el.dataset.ch] = el));
  function showTrack() {
    const own = audio.trackInfo && audio.trackInfo();
    const t = own ? { artist: own.artist || 'MÜZİK KLASÖRÜ', title: own.title } : game.track || { artist: 'DEPO RESIDENT', title: '…' };
    npArtist.textContent = t.artist; npTitle.textContent = t.title;
  }
  game.on('track', (t) => { showTrack(); if (t && t.no > 1) caption(`Sıradaki parça\n*${t.title}* — _${t.artist}_`, 3.5); });
  showTrack();
  // kanal göstergesi: ses açıksa sesle aynı anda (zamanlanmış), kapalıysa vuruştan
  const flashCh = (ch) => { const el = chanEls[ch === 'clap' ? 'hat' : ch]; if (!el) return; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 110); };
  audio.onHit = (ch, t) => { const ms = Math.max(0, (t - audio.ctx.currentTime) * 1000); setTimeout(() => flashCh(ch), ms); };

  // ---------- sıralama (tek satır) ----------
  const king = $('king');
  const avHtml = (sc) => sc.avatar
    ? `<img class="av" src="${esc(sc.avatar)}" referrerpolicy="no-referrer" alt="">`
    : `<span class="av ph">${esc(String(sc.nick || '?').replace(/^@/, '').charAt(0).toLocaleUpperCase('tr'))}</span>`;
  let kingTimer = null;
  function board(open = true) {
    if (open && game.top.length) { king.classList.add('open'); clearTimeout(kingTimer); kingTimer = setTimeout(() => king.classList.remove('open'), 10000); }
    king.innerHTML = game.top.length
      ? '<div class="kh">👑 GECENİN KRALLARI</div>' + game.top.map((sc, i) => `<div class="kr"><span class="n">${i + 1}</span>${avHtml(sc)}<b>${esc(sc.nick)}</b><small>${fmt(sc.d)}</small></div>`).join('')
      : '';
  }
  game.on('board', () => board(true)); board(false);

  // ---------- hediye rehberi ----------
  const guide = $('guide');
  // tek, büyük, dönen kart: her 3 sn'de sıradaki hediye; biri hediye atınca o hediyede 6 sn durur ve parlar.
  // (Orta şerit kalabalığa kalsın diye sütun yerine tek kart.)
  let guideI = 0, guideT = 3;
  function rules() {
    const n = game.rules.length;
    guide.innerHTML = game.rules.map((r, i) => {
      const title = r.eylem === 'dans' ? '🕺 ÖZEL DANS' : '🎁 HEDİYE AT';
      return `<div class="gc" data-k="${i}" hidden><div class="gp">${title}<span class="pd">${i + 1}/${n}</span></div>`
        + `<div class="g"><span class="ic">${r.resim ? `<img src="${esc(r.resim)}" referrerpolicy="no-referrer" alt="">` : esc(r.ikon || '🎁')}</span>`
        + `<span><b>${esc(r.etiket)}</b><small>${r.minJeton ? fmt(r.minJeton) + '+' : fmt(r.jeton)} jeton</small></span></div></div>`;
    }).join('');
    showGuide(Math.min(guideI, Math.max(0, n - 1)), 3);
    const gb = $('giftBtns');
    if (gb) gb.innerHTML = game.rules.map((r, i) => `<button data-gift="${i}"${game.live ? ' disabled' : ''}>${esc(r.ikon || '🎁')} ${esc(r.etiket)}</button>`).join('');
  }
  function showGuide(i, hold) {
    guideI = i; guideT = hold;
    guide.querySelectorAll('.gc').forEach((el) => { el.hidden = +el.dataset.k !== i; });
  }
  UI.guideTick = (dt) => { const n = game.rules.length; if (n && (guideT -= dt) <= 0) showGuide((guideI + 1) % n, 3); };
  game.on('rules', rules); rules();
  game.on('giftlog', ({ user, gift, dia, cnt, rule }) => {
    if (rule) {
      const k = game.rules.indexOf(rule);
      if (k >= 0) { showGuide(k, 6); const el = guide.querySelector(`[data-k="${k}"] .g`); if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } }
    }
    const li = document.createElement('li');
    li.textContent = `${user.nick} → ${gift.name || '?'} (id ${gift.id || '-'}) ${dia} jeton ×${cnt} ${rule ? '→ ' + rule.etiket : ''}`;
    const log = $('giftLog'); if (log) { log.prepend(li); while (log.children.length > 40) log.lastChild.remove(); }
  });

  // ---------- canlı durum ----------
  const isStage = document.body.classList.contains('clean'); // yayın penceresi
  let lastStatus = { state: 'idle', username: '' }, serverInfo = { hasKey: false, savedUsername: '' };
  UI.setStatus = (st) => {
    lastStatus = st;
    const el = $('status');
    if (el) { el.className = 'status ' + st.state; el.textContent = st.message; }
    $('liveDot').classList.toggle('on', st.state === 'live');
    const wasLive = game.live;
    game.live = st.state === 'live';
    if (game.live && !wasLive && mini) mini.onLive(); // canlı başlarken açık turdan demo oylarını temizle
    // canlıdayken test butonları kilitli (sahte olaylar yayında görünür)
    const lock = $('testLock'); if (lock) lock.hidden = !game.live;
    document.querySelectorAll('#demoBtns button, #giftBtns button').forEach((b) => { b.disabled = game.live; });
    checklist();
  };

  // ---------- ses ----------
  // yayın penceresinde "tıkla" butonu hiç görünmez: ses kendiliğinden başlar (başlatıcılar otomatik oynatmaya izin verir);
  // tarayıcı izin vermezse köşede küçük, soluk bir 🔇 çıkar, pencereye tıklayınca ses başlar.
  const gate = $('soundGate'), muteMark = $('muteMark');
  async function startSound() {
    await audio.start();
    const ok = audio.ctx && audio.ctx.state === 'running';
    gate.classList.toggle('hide', ok || isStage);
    muteMark.hidden = ok || !isStage;
    const o = $('optSound'); if (o) o.checked = ok;
    checklist();
  }
  gate.addEventListener('click', startSound);
  $('frame').addEventListener('click', () => { if (!audio.on || audio.ctx.state !== 'running') startSound(); });
  UI.startSound = startSound;
  if (isStage) {
    gate.classList.add('hide');
    muteMark.hidden = false;
    setTimeout(() => startSound().catch(() => {}), 600);
  }

  // ---------- yayına hazır mı? ----------
  function checklist() {
    const ul = $('checklist'); if (!ul || isStage) return;
    const user = lastStatus.username || serverInfo.savedUsername;
    const n = audio.tracks.length;
    const items = [
      [serverInfo.hasKey, serverInfo.hasKey ? 'Euler anahtarı var' : 'Euler anahtarı yok: ayarlar.json → signApiKey'],
      [!!user, user ? `Kullanıcı adı: @${user}` : 'Kullanıcı adı girilmedi'],
      [lastStatus.state === 'live', lastStatus.state === 'live' ? 'Canlı yayına bağlı' : `Bağlantı: ${lastStatus.message || 'bağlı değil'}`],
      [n === 0, n === 0 ? 'Müzik: oyunun kendi müziği çalar (telif riski yok)' : `Müzik klasöründe ${n} parça var: telif hakkı sende değilse yayında ses kapatılabilir`],
    ];
    ul.innerHTML = items.map(([ok, t]) => `<li class="${ok ? 'ok' : 'no'}">${esc(t)}</li>`).join('') +
      '<li class="ok">Ses yayın penceresinde kendiliğinden başlar; köşede 🔇 görürsen pencereye bir kez tıkla</li>';
  }

  // ---------- panel ----------
  if ($('panel') && !isStage) {
    fetch('/api/status').then((r) => r.json()).then((j) => {
      serverInfo = { hasKey: !!j.hasKey, savedUsername: j.savedUsername || '' };
      if (j.savedUsername) $('user').value = j.savedUsername;
      UI.setStatus(j.status);
    }).catch(() => {});
    audio.loadTracks().then(checklist);
    $('connect').onclick = () => live.connect($('user').value);
    $('user').onkeydown = (e) => { if (e.key === 'Enter') live.connect($('user').value); };
    $('disc').onclick = () => live.disconnect();
    $('optSound').onchange = (e) => (e.target.checked ? startSound() : (audio.stop(), gate.classList.remove('hide')));
    $('optStrobe').onchange = (e) => { club.strobeOn = e.target.checked; try { localStorage.setItem('depo.strobe', e.target.checked ? '1' : '0'); } catch {} };
    $('optBots').onchange = (e) => { demo.bots = e.target.checked; };
    $('optSafe').onchange = (e) => { $('safeZones').hidden = !e.target.checked; };
    if (quality) { $('optQuality').value = quality.get(); $('optQuality').onchange = (e) => quality.set(e.target.value); }
    $('liveBtns').onclick = (e) => { const b = e.target.closest('button'); if (b) demo.live(b.dataset.live); };
    $('demoBtns').onclick = (e) => { const b = e.target.closest('button'); if (b) demo.button(b.dataset.demo); };
    $('giftBtns').onclick = (e) => { const b = e.target.closest('button'); if (b) demo.gift(game.rules[+b.dataset.gift]); };
    let msgT; demo.onMsg = (t) => { const el = $('liveMsg'); if (!el) return; el.textContent = t; clearTimeout(msgT); msgT = setTimeout(() => (el.textContent = ''), 4000); };
    checklist();
  }
  try { if (localStorage.getItem('depo.strobe') === '0') { club.strobeOn = false; const o = $('optStrobe'); if (o) o.checked = false; } } catch {}

  // ---------- isim etiketleri ----------
  let accCss = '#8cff3a';
  function drawLabels() {
    const W = lbl.width, H = lbl.height;
    lg.clearRect(0, 0, W, H);
    const base = H / 70;
    lg.textAlign = 'center'; lg.textBaseline = 'bottom';
    const items = [];
    for (const d of crowd.list) {
      const u = d.user; if (!u || u.leaving) continue;
      if (u.demo && game.live) continue; // canlıda demo dansçılar isimsiz arka plan kalabalığı
      // DJ'in başı üst bilgi bloğunun altında kalıyor: etiketini kabinin ön yüzüne koy
      const anchor = u.place === 'dj' ? crowd.headPos(d).clone().set(d.x, 1.25, d.z + 1.0) : crowd.headPos(d).clone();
      const p = anchor.project(camera);
      if (p.z > 1 || p.x < -1.1 || p.x > 1.1 || p.y < -1.1 || p.y > 1.1) continue;
      const dist = camera.position.distanceTo(crowd.headPos(d));
      items.push({ u, d, x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, s: u.place === 'dj' ? 1.15 : Math.max(0.55, Math.min(1.6, 9 / dist)), dist }); // DJ etiketi her zaman okunur boyutta
    }
    items.sort((a, b) => b.dist - a.dist);
    const t = game.time;
    // kalabalıkta: rol sahipleri + son etkileşime göre en yeni 22 kişi (gerisi isimsiz dans eder)
    let shown = null;
    if (items.length > 22) {
      shown = new Set(items.filter((it) => it.u.place === 'floor' && t - it.u.lastActive < 30)
        .sort((a, b) => b.u.lastActive - a.u.lastActive).slice(0, 22).map((it) => it.u));
    }
    for (const it of items) {
      const { u, d } = it;
      if (shown && u.place === 'floor' && !shown.has(u)) continue;
      const sp = crowd.specialOf(d, game.vtime);
      const roleTxt = u.place === 'dj' ? '🎧 DJ' : u.place === 'vip' ? '💎 VIP' : u.place === 'podium' ? '🕺 PODYUM' : '';
      const icons = (sp ? SPECIALS[sp].icon + ' ' : '') + (u.badge ? u.badge + ' ' : '');
      const fs = base * it.s * (roleTxt ? 1.15 : 0.95);
      lg.font = `700 ${fs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      const text = icons + u.nick;
      const av = fs * 1.25, gap = fs * 0.3;                  // profil fotoğrafı (yuvarlak)
      const tw = lg.measureText(text).width;
      const w = av + gap + tw + fs * 0.6, h = fs * 1.45;
      const x0 = it.x - w / 2, y0 = it.y - h;
      lg.globalAlpha = (u.demo ? 0.55 : 1) * d.alpha;
      lg.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(x0, y0, w, h, h / 2); lg.fill();
      drawAvatar(u, x0 + h / 2, y0 + h / 2, av / 2);
      lg.textAlign = 'left';
      lg.fillStyle = sp || u.badge ? accCss : d.colored ? d.col.getStyle() : '#ececf1';
      lg.fillText(text, x0 + h / 2 + av / 2 + gap, it.y - fs * 0.28);
      lg.textAlign = 'center';
      // rol etiketi: büyük, vurgu renginde hap
      if (roleTxt) {
        const rf = fs * 0.85; lg.font = `800 ${rf}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
        const rw = lg.measureText(roleTxt).width + rf * 1.1, rh = rf * 1.45, ry = y0 - rh - fs * 0.15;
        lg.fillStyle = accCss; roundRect(it.x - rw / 2, ry, rw, rh, rh / 2); lg.fill();
        lg.fillStyle = '#000'; lg.fillText(roleTxt, it.x, ry + rh - rf * 0.3);
      }
      // konuşma balonu
      if (u.bubble && t - u.bubble.t < 4) {
        const k = Math.min(1, (4 - (t - u.bubble.t)) * 2);
        const bt = u.bubble.text.length > 32 ? u.bubble.text.slice(0, 31) + '…' : u.bubble.text;
        const bf = fs * 1.05; lg.font = `600 ${bf}px Inter, system-ui, sans-serif`;
        const bw = lg.measureText(bt).width + bf;
        lg.globalAlpha = k * d.alpha;
        lg.fillStyle = 'rgba(240,240,244,0.95)';
        const by = y0 - (roleTxt ? fs * 1.5 : 0) - fs * 0.25;
        roundRect(it.x - bw / 2, by - bf * 1.5, bw, bf * 1.4, bf * 0.6); lg.fill();
        lg.beginPath(); lg.moveTo(it.x - bf * 0.3, by - bf * 0.12); lg.lineTo(it.x, by + bf * 0.3); lg.lineTo(it.x + bf * 0.3, by - bf * 0.12); lg.fill();
        lg.fillStyle = '#0a0a0c'; lg.fillText(bt, it.x, by - bf * 0.3);
      }
    }
    lg.globalAlpha = 1;
  }
  // profil fotoğrafları: bir kez yüklenir, hazır olunca çizilir; yoksa baş harf
  const imgCache = new Map();
  function avatarImg(url) {
    if (!url) return null;
    let im = imgCache.get(url);
    if (!im) { im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = url; imgCache.set(url, im); if (imgCache.size > 400) imgCache.delete(imgCache.keys().next().value); }
    return im.complete && im.naturalWidth ? im : null;
  }
  function drawAvatar(u, cx, cy, r) {
    const im = avatarImg(u.avatar);
    lg.save(); lg.beginPath(); lg.arc(cx, cy, r, 0, Math.PI * 2); lg.closePath();
    if (im) { lg.clip(); lg.drawImage(im, cx - r, cy - r, r * 2, r * 2); }
    else {
      lg.fillStyle = u.d && u.d.colored ? u.d.col.getStyle() : '#3a3a42'; lg.fill();
      lg.fillStyle = '#fff'; lg.font = `800 ${r * 1.15}px Inter, system-ui, sans-serif`; lg.textAlign = 'center'; lg.textBaseline = 'middle';
      lg.fillText(String(u.nick || '?').replace(/^@/, '').charAt(0).toLocaleUpperCase('tr'), cx, cy + r * 0.05);
    }
    lg.restore(); lg.textBaseline = 'bottom';
  }
  function roundRect(x, y, w, h, r) { lg.beginPath(); lg.roundRect ? lg.roundRect(x, y, w, h, r) : lg.rect(x, y, w, h); }

  // ---------- mini oyunlar: kart, kanal durumları, altyazılar ----------
  const voteEl = $('vote');
  const START_CAPS = {
    kanal: 'Kanal oyu başladı\nYorumla *solo hat* ya da *sustur kick*',
    parca: 'Sonraki parça ne olsun?\nYorumla *1*, *2* ya da *3*',
    bpm: 'Bu parça kaç *BPM*?\nYorumla _tahmin et_',
  };
  if (mini) {
    mini.on('round', (R) => caption(START_CAPS[R.type], 3.5, true));
    mini.on('roundEnd', ({ text, sec }) => caption(text, sec || 4, true));
    mini.on('trackChange', () => { const own = audio.trackInfo && audio.trackInfo(); if (own) caption(`Sıradaki parça\n*${own.title.replace(/[*_]/g, ' ')}*${own.artist ? ' — _' + own.artist.replace(/[*_]/g, ' ') + '_' : ''}`, 4); });
    mini.on('gate', (g) => {
      for (const ch in chanEls) {
        const el = chanEls[ch];
        el.classList.toggle('solo', !!(g && g.solo === ch));
        el.classList.toggle('off', !!(g && ((g.solo && g.solo !== ch) || g.mute === ch)));
      }
    });
  }
  function drawVote() {
    const R = mini && mini.round;
    voteEl.hidden = !R;
    if (!R) return;
    const sec = Math.max(0, Math.ceil(R.t));
    let body = '';
    if (R.type === 'bpm') {
      body = `<div class="vs">yorumla sayı yaz · 60–220 · ${R.guesses.length} tahmin</div><div class="vg">${R.guesses.slice(-6).reverse().map((g) => `<span>${esc(g.u.nick)} ${g.v}</span>`).join('')}</div>`;
    } else {
      const opts = R.type === 'kanal' ? R.options.slice().sort((a, b) => b.votes - a.votes).slice(0, 4) : R.options;
      const total = R.options.reduce((s, o) => s + o.votes, 0) || 1;
      const hint = R.type === 'kanal' ? (opts.length ? 'yorumla oy ver · kişi başı 1 oy' : 'yorumla: solo kick · solo hat · sustur bas…') : 'yorumla 1, 2 ya da 3 yaz';
      body = `<div class="vs">${hint}</div><div class="vo">${opts.map((o) => `<span class="lb"><i style="width:${(o.votes / total * 100).toFixed(0)}%"></i>${esc(o.label)}</span><b>${o.votes}</b>`).join('')}</div>`;
    }
    voteEl.innerHTML = `<div class="vh">${esc(R.title)}<span>${sec} sn</span></div>${body}<div class="vt"><i style="width:${(R.t / R.max * 100).toFixed(1)}%"></i></div>`;
  }
  const CH_SHORT = { hat: 'HAT', kick: 'KICK', bas: 'BAS', acid: 'MELODİ' };
  const GATE_STATE = (g) => (g.solo ? '◉ SOLO ' + CH_SHORT[g.solo] : '⊘ ' + CH_SHORT[g.mute] + ' SUSTU');

  // ---------- kare ----------
  const prog = $('progress'), fill = $('buildFill'), pct = $('buildPct'), buildLab = $('buildLab'), stateEl = $('state'), viewers = $('viewers');
  const root = document.documentElement;
  let acc = 0, lastBeat = -1;
  UI.tick = (dt) => {
    drawLabels();
    UI.guideTick(dt);
    flashEl.style.opacity = club.flashA.toFixed(3);
    // altyazı sırası; boşta yönlendirme cümleleri döner
    if (capT > 0) { capT -= dt; if (capT <= 0) capEl.classList.remove('on'); }
    else if (capQ.length) showCap(capQ.shift());
    else if ((idleT -= dt) <= 0) { idleT = 30; showCap({ text: IDLE_CAPS[idleI++ % IDLE_CAPS.length], sec: 5 }); } // boşta: 30 sn'de bir
    // vuruş kareleri + ses kapalıyken kanal göstergeleri
    const bi = Math.floor(game.beat);
    if (bi !== lastBeat) {
      lastBeat = bi;
      beatEls.forEach((el, i) => el.classList.toggle('on', i === ((bi % 4) + 4) % 4));
      if (!audio.on && game.build < 0.85) { flashCh('kick'); setTimeout(() => flashCh('hat'), 30000 / game.bpm); }
    }
    if ((acc += dt) < 0.1) return; acc = 0;
    accCss = '#' + club.accent.getHexString();
    root.style.setProperty('--acc', accCss);
    const own = audio.trackInfo && audio.trackInfo();
    const b = game.build;
    fill.style.width = (b * 100).toFixed(1) + '%';
    pct.textContent = game.lockT > 0 ? 'DROP' : Math.floor(b * 100) + '%';
    buildLab.textContent = game.lockT > 0 ? '✱ DROP' : b > 0.8 ? 'DROP GELİYOR' : "DROP'A";
    prog.classList.toggle('hot', b > 0.8 && game.lockT <= 0);
    drawVote();
    const st = mini && mini.gate ? GATE_STATE(mini.gate) : game.lockT > 0 ? '✱ DROP' : b >= 0.85 ? '■ BREAKDOWN' : b > 0.5 ? '▲ BUILD-UP' : club.festival > 0 ? '✦ FESTİVAL' : '▶ GROOVE';
    if (stateEl.textContent !== st) { stateEl.textContent = st; stateEl.classList.toggle('hot', st !== '▶ GROOVE'); }
    // BPM, tahmin turunda biri bilene kadar gizli (her yeni şarkıda yeniden gizlenir)
    const hidden = mini && !mini.bpmKnown;
    club.bpmHidden = hidden;
    bpmEl.textContent = hidden ? '???' : Math.round(audio.currentBpm());
    npMode.textContent = club.festival > 0 ? 'FESTİVAL' : modeLabel(game.mode);
    if (own) { npArtist.textContent = own.artist || 'MÜZİK KLASÖRÜ'; npTitle.textContent = own.title; }
    viewers.textContent = '· ' + fmt(game.viewers || game.realCount());
  };
  UI.resize = (w, h) => { lbl.width = w; lbl.height = h; };
  UI.setFps = (fps, n, warn) => {
    const el = $('fps'); if (el) el.textContent = `${fps} FPS · ${n} dansçı`;
    const w = $('fpsWarn'); if (w) w.hidden = !warn;
  };
  return UI;
}
