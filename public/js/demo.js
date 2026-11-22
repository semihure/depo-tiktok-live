// Demo dansçılar + panel butonları.
//  • Yayın kontrolü (drop, sonraki parça, mini oyun başlat): sahte oy/izleyici eklemez.
//  • Test butonları: sahte izleyici olayları üretir; canlıya bağlıyken kilitlidir.
//  • Panel ve yayın penceresi ayrı sayfalar: tüm butonlar olayı sunucuya yollar (/api/demo),
//    sunucu açık tüm sahnelere iletir → yayın penceresi de aynı olayı alır.
const NAMES = ['ravekız', 'bassmehmet', 'techno_ayşe', 'gecekuşu', 'acidali', 'zeynep.mp3', 'kickdrum', 'neonelif', 'subbass_can', 'dj_değilim', 'depocu', 'strobo', 'melodikmert', 'hardcoreHale', 'bpm145', 'afterparty', 'lazerli', 'dansbaşı', 'gecenurdu', 'darkroom'];
const CHATS = ['zıpla', 'el', 'dans', 'mor', 'yeşil', 'pembe', 'drop drop', 'bas gelsin 🔥', 'efsane', 'mavi', 'sallan', 'turkuaz', 'selam depo', 'zıpla zıpla', 'alkış', 'yumruk'];
const COLORS = ['mor', 'yeşil', 'pembe', 'mavi', 'sarı', 'kırmızı', 'turuncu', 'turkuaz', 'beyaz'];
const KANAL_VOTES = ['solo hat', 'sustur kick', 'solo bas', 'kick', 'sustur hat', 'solo acid', 'solo hat', 'sustur kick'];
const pick = (a) => a[(Math.random() * a.length) | 0];
const BOT_TARGET = 4; // sahnede en az bu kadar kişi olsun

export function createDemo(game, mini, audio) {
  const D = { bots: true, t: 0, nextAct: 1, onMsg: null };
  let seq = 0;
  const bot = (i) => ({ id: 'demo_' + i, nick: NAMES[i % NAMES.length] });
  const viewer = () => ({ id: 'v_' + Date.now().toString(36) + (seq++), nick: pick(NAMES) + '_' + ((Math.random() * 90 + 10) | 0) });
  const recent = [];
  const someone = () => (recent.length && Math.random() < 0.7 ? pick(recent) : remember(viewer()));
  function remember(u) { recent.push(u); if (recent.length > 30) recent.shift(); return u; }
  const msg = (t) => D.onMsg && D.onMsg(t);

  // olay: sunucu varsa tüm sahnelere, yoksa yalnızca bu sayfaya
  function send(ev) {
    if (location.protocol === 'file:') return D.receive(ev);
    fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) }).catch(() => D.receive(ev));
  }
  // sunucudan (ya da yerelden) gelen olay
  D.receive = (ev) => { if (ev.type === 'control') return control(ev.action); game.handle(ev); };

  // ---------- yayın kontrolü (her sahnede çalışır; sahte oy yok) ----------
  function control(action) {
    switch (action) {
      case 'drop': game.forceDrop(); return true;
      case 'skip':
        if (audio.ownMusic) audio.skip(); else game.newTrack();
        return true;
      case 'kanal': if (!mini) return false; mini.cool.kanal = 0; return mini.round ? false : mini.startKanal();
      case 'parca': return !!mini && !mini.round && mini.startParca();
      case 'bpm': return !!mini && !mini.round && mini.startBpm();
    }
    return false;
  }
  D.live = (action) => {
    // panel ile yayın penceresi ayrı çalışır; açılıp açılmayacağına yayın penceresi karar verir
    send({ type: 'control', action });
    msg({ drop: 'Drop gönderildi.', skip: 'Sonraki parçaya geçildi.',
      kanal: 'Kanal oyu gönderildi (drop, festival ya da başka tur yoksa başlar).',
      parca: 'Parça oylaması gönderildi (DJ, drop ya da başka tur yoksa başlar).',
      bpm: 'BPM tahmini gönderildi (drop ya da başka tur yoksa başlar).' }[action] || '');
  };

  // ---------- test (sahte izleyiciler) ----------
  let testType = 0;
  D.button = (kind) => {
    if (game.live) return msg('Canlıya bağlıyken test olayları kilitli.');
    switch (kind) {
      case 'member': send({ type: 'chat', user: remember(viewer()), text: 'selam' }); break; // sahneye yorumla girilir
      case 'chat': send({ type: 'chat', user: someone(), text: pick(CHATS) }); break;
      case 'color': send({ type: 'chat', user: someone(), text: pick(COLORS) }); break;
      case 'like': send({ type: 'like', user: someone(), count: 25 }); break;
      case 'follow': send({ type: 'follow', user: someone() }); break;
      case 'crowd': for (let i = 0; i < 20; i++) setTimeout(() => send({ type: 'chat', user: remember(viewer()), text: pick(CHATS) }), i * 120); break;
      case 'minitest': { // sırayla kanal → parça → BPM turu açıp sahte oy verir
        const type = ['kanal', 'parca', 'bpm'][testType++ % 3];
        send({ type: 'control', action: type });
        setTimeout(() => {
          const ans = (mini.round && mini.round.data && mini.round.data.answer) || 128;
          for (let i = 0; i < 8; i++) setTimeout(() => send({ type: 'chat', user: remember(viewer()), text: type === 'kanal' ? pick(KANAL_VOTES) : type === 'parca' ? pick(['1', '2', '2', '3']) : String(ans + Math.round((Math.random() - 0.5) * 20)) }), i * 450);
        }, 300);
        msg(`Test: ${type} turu sahte oylarla açıldı.`);
        break;
      }
    }
  };
  D.gift = (rule) => {
    if (!rule) return;
    if (game.live) return msg('Canlıya bağlıyken test hediyeleri kilitli.');
    const dia = rule.minJeton || rule.jeton || 1;
    send({ type: 'gift', user: someone(), gift: { name: (rule.ad && rule.ad[0]) || rule.etiket, id: (rule.id && rule.id[0]) || '', diamonds: dia, count: 1 } });
  };

  // ---------- demo dansçılar ----------
  // sahne boş kalmasın: en az BOT_TARGET kişi; her gerçek izleyici (yorum yazan) gelince bir demo dansçı çekilir.
  // Canlıdayken sadece isimsiz arka plan kalabalığıdır:
  // yorum, beğeni ve oy üretmezler (sahte etkileşim olmasın).
  D.tick = (dt) => {
    D.t += dt;
    if (!D.bots) return;
    const real = game.realCount();
    const want = Math.max(0, BOT_TARGET - real);
    let have = 0; for (const u of game.users.values()) if (u.demo) have++;
    if (have < want && D.t > 0.5 && Math.random() < dt * 4) {
      for (let i = 0; i < NAMES.length; i++) if (!game.users.has('demo_' + i)) { game.handle({ type: 'member', user: bot(i), demoUser: true }); break; }
    }
    if (have > want && D.t - (D.lastLeave || 0) > 3) { D.lastLeave = D.t; game.removeOneDemo && game.removeOneDemo(); }
    if (game.live || !have) return;
    const bots = [...game.users.values()].filter((u) => u.demo);
    if (mini && mini.round && Math.random() < dt * 0.4) {
      const u = pick(bots), R = mini.round;
      const text = R.type === 'kanal' ? pick(KANAL_VOTES) : R.type === 'parca' ? pick(['1', '2', '3']) : String((R.data.answer || 128) + Math.round((Math.random() - 0.5) * 30));
      game.handle({ type: 'chat', user: { id: u.id, nick: u.nick }, text, demoUser: true });
    }
    if ((D.nextAct -= dt) <= 0) {
      D.nextAct = 1.2 + Math.random() * 2.5;
      const u = pick(bots);
      if (Math.random() < 0.55) game.handle({ type: 'chat', user: { id: u.id, nick: u.nick }, text: pick(CHATS), demoUser: true });
      else game.handle({ type: 'like', user: { id: u.id, nick: u.nick }, count: 3 + ((Math.random() * 8) | 0), demoUser: true });
    }
  };
  return D;
}
