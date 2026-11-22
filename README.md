# DEPO — TikTok LIVE techno club oyunu

Karanlık bir depo rave'i, kalabalığın **arkasından sabit kadrajla**: gri tonlu, siyah konturlu çizgi film kalabalık, üstte DJ kabini, hoparlörler ve vuruşla yanan ışık barları. Her şey **tek vurgu rengiyle** boyanır; renk müzik tarzına göre değişir (POP pembe, RAP yeşil, TRAP kırmızı, R&B mor, festival altın). Yayına giren her izleyici, adı başının üstünde bir dansçı olur. `müzik/` klasörü boşken müziği oyun kendisi üretir (telif riski yok); klasöre parça koyarsan onlar çalar.

Ekranın üstünde **"Şu an çalıyor"** şeridi var: sanatçı — parça · mod, büyük BPM rakamı, ölçüdeki vuruşu gösteren 4 kare, durum (GROOVE / BUILD-UP / BREAKDOWN / DROP) ve müzikle aynı anda yanan KICK · HAT · BAS · MELODİ göstergeleri. Altta duyurular kalın vurgulu altyazı olarak çıkar, en alttaki ince çizgi drop'a kalan yolu gösterir.

**Ana hedef: "Drop'u getir".** Beğeniler ve yorumlar üstteki barı doldurur. Bar doldukça müzik gerilir, bar dolunca DROP gelir: bas girer, herkes zıplar, konfeti ve CO2 patlar.

## Kurulum
1. [Node.js](https://nodejs.org) LTS kur. **Node 20 veya üstü şart**; Node 18'de TikTok bağlantısı çalışmaz (demo yine çalışır).
2. [Euler Stream](https://www.eulerstream.com)'den ücretsiz API anahtarı al.
3. `ayarlar.ornek.json` dosyasını kopyalayıp adını `ayarlar.json` yap (bu dosya kişiseldir, git'e girmez). `ayarlar.json` dosyasına TikTok kullanıcı adını (`@` olmadan) ve `euler_` ile başlayan anahtarı tırnakların arasına yaz. İstersen `"residentDj": "shure"` satırıyla kimse DJ değilken kabinde duran DJ'in adını değiştirebilirsin (varsayılan: shure).
4. Başlat: Windows'ta `BASLAT.bat`, macOS'ta `baslat.command` dosyasına çift tıkla. Elle başlatmak için: `npm install` ve `node server.js`.
5. İki pencere açılır:
   - **Sahne penceresi** (`http://localhost:3200/?clean`, dikey): yayına verilecek olan bu. Ses kendiliğinden başlar; köşede soluk bir 🔇 görürsen pencereye bir kez tıkla.
   - **Kontrol paneli** (`http://localhost:3200`): bağlantı, "Yayına hazır mı?" listesi, yayın kontrolü, test butonları, ayarlar ve hediye kaydı. Bunu yayına verme; panelde ses açma (yayın penceresiyle üst üste çalar).
6. TikTok LIVE Studio'da sahneyi dikey (9:16) yap, **Pencere yakalama** ile sahne penceresini seç.

## Kontrol paneli
- **Yayına hazır mı?**: Euler anahtarı, kullanıcı adı, bağlantı ve müzik klasörü durumunu ✅/⚠️ ile gösterir.
- **Yayın kontrolü**: 💥 Drop'u zorla · ⏭ Sonraki parça · 🎛️ Kanal oyu · 🗳 Parça oylaması · 🎯 BPM tahmini. Sadece başlatır; sahte oy ya da izleyici eklemez. Panelden basınca yayın penceresinde de olur.
- **🧪 Test** (kapalı başlar): sahte izleyici, yorum, beğeni, hediye ve sahte oylu mini oyun. **Canlıya bağlıyken kilitlidir**, çünkü test olayları yayında görünür.

**Telefon düzeni:** TikTok'un telefon arayüzü ekranın üst ~%18'ini (profil, takip, izleyiciler) ve alt ~%35'ini (yorumlar, hediye düğmeleri) kaplar. DEPO'nun bilgileri bu iki alanın arasına yerleştirilmiştir: üstte "şu an çalıyor" şeridi ve drop çizgisi, solda profil fotoğraflı "Gecenin Kralları" (hediye anında 10 sn ilk 5 açılır, sonra tek satıra küçülür), sağ altta yorum alanının hemen üstünde **tek, büyük, dönen hediye kartı** (3 sn'de bir sıradaki hediye; biri hediye atınca o hediyede durur; gelen gerçek hediyelerin resmi öğrenilir ve `hediye-resimleri.json`'a kaydedilir), solda altyazı ve "Yorum yaz, kulübe gir!" çağrısı, ortada kalabalık. Boşta yönlendirme altyazıları 30 sn'de bir çıkar. Panelde **"Telefonda TikTok'un kapattığı alanları göster"** ile bu alanları sahne üzerinde görebilirsin. Az izleyicide kamera biraz yaklaşır.

Sahne boş kalmasın diye pistte her zaman en az **4 kişi** olur; her gerçek izleyici (yorum yazan) gelince bunlardan biri çekilir. Kimse DJ değilken kabinde **shure** çalar (adı, etiketi ve "şu an çalıyor"daki sanatçı adı); biri DJ hediyesi atınca yerini alır, süre bitince shure geri döner.

**Canlıya bağlıyken** demo dansçılar isimsiz arka plan kalabalığıdır: adları görünmez, yorum/beğeni yapmaz, oy vermez, drop barını doldurmaz. Gerçek izleyiciler geldikçe çekilirler.

## Yayın öncesi kontrol
1. `ayarlar.json`'da Euler anahtarı ve kullanıcı adı dolu mu (paneldeki liste ✅ mi)?
2. `müzik/` klasöründe hakkı sende olmayan parça var mı? Varsa çıkar; boşken oyunun kendi müziği çalar.
3. TikTok LIVE Studio'daki "İzleyici Dilekleri" ile `hediyeler.json` aynı mı?
4. Sahne penceresinde ses geliyor mu? (🔇 varsa pencereye tıkla.)
5. Panelde ses kapalı mı? (İki pencere birden çalarsa ses üst üste biner.)

## İzleyici ne yapar?
| İzleyici | Oyunda |
|---|---|
| Yayına girer, beğenir, takip eder | Enerjiye ve drop barına katkı verir; **sahneye girmez** |
| **Yorum yazar** (ya da hediye atar) | Kulübe girer, pistte yerini alır, adı ve profil fotoğrafı görünür |
| `zıpla` · `el` · `dans` · `sallan` · `hopla` · `robot` · `kafa` · `twist` · `alkış` · `yumruk` · `adım` yazar | O hareketi **45 sn** yapar, sonra kendi tarzına döner |
| Renk yazar (`mor`, `yeşil`, `pembe`, `mavi`, `sarı`, `kırmızı`, `turuncu`, `turkuaz`, `beyaz`) | Gri kalabalıkta yalnızca onun saçı/beresi ve ışık çubuğu o renk olur, kendini hemen bulur |
| `drop` yazar | Drop barına ekstra itiş (kişi başı 8 sn'de bir) |
| Beğeni atar | Bar dolar, tempo yükselir (oyunun kendi müziğinde 122 → 128 → 136 → 145 BPM; tarz R&B → POP → RAP → TRAP sırasıyla değişir) |
| Takip eder / paylaşır | Adı LED duvara yazılır, lazer çakar |
| Hediye atar | `hediyeler.json`'daki eylem gerçekleşir |

Dansçılar sürekli aynı dansı yapmaz: herkesin kendine ait 3–4 hareketlik bir tarzı vardır ve 8–16 ölçüde bir, ölçü başında bunlar arasında yumuşakça geçer. Build-up'ta "el havaya" ve zıplama artar, drop'ta herkes zıplar. Hediye atan dansçı kendi etrafında dönüp zıplar. Drop yaklaşınca (bar %60'ı geçince) kalabalık ışık çubuklarıyla soldan sağa dalga yapar.

**DJ olan izleyici**, yorumla müziğin tarzını seçer: `pop`, `rap`, `trap` ya da `r&b` (`rnb` de olur).

## Müzik mini oyunları
Aynı anda tek tur açılır; ekranın ortasında bir oylama kartı çıkar. Her izleyicinin tur başına 1 oyu var. Drop, festival ve breakdown sırasında tur açılmaz, açık turun süresi durur.

| Oyun | Nasıl | Sonuç |
|---|---|---|
| **Kanal oyu** | Yorumla `solo kick` · `solo hat` · `solo bas` · `solo melodi` · `sustur kick` · `sustur hat` … (`kick` tek başına = solo). İlk oyla 10 sn'lik tur açılır. | Kazanan seçenek 2 ölçü (8 vuruş) uygulanır: o kanal tek başına çalar ya da susar. Kick susunca kalabalığın başı boşta kalır. Turlar arası 30 sn. |
| **Sonraki parça** | Her şarkıda **tek bir kez**, şarkının yarısı geçince açılır (15 sn). Yorumla `1`, `2`, `3`. | `müzik/` klasöründe 2+ parça varsa sıradaki parça oylanır; yoksa sonraki tarz (POP / RAP / TRAP / R&B). DJ varken o şarkıda sorulmaz. |
| **BPM tahmini** | Her şarkının başında (%12'den sonra) açılır (20 sn). Yorumla bir sayı yaz (60–220). | BPM ekranda **???** olarak gizlidir. Biri doğru ya da ±3 yakın bilince BPM görünür; en yakın tahmin podyuma çıkar, tam bilenler 🎯 rozeti alır. Kimse bilemezse 25 sn sonra tekrar sorulur; 3 denemeden sonra cevap açıklanır. Her yeni şarkıda BPM yeniden gizlenir. |

Kendi parçalarında kanallar ayrı ayrı açılıp kapatılamadığı için kanal oyu filtreyle yaklaşık uygulanır (solo bas = yalnızca alçak frekanslar, solo hat = yalnızca tizler…). Panelde her oyun için demo butonu var.

## Hediyeler (`hediyeler.json`)
| Eylem | Varsayılan | Etki |
|---|---|---|
| `isikcubugu` | Gül (1) | Dev ışık çubuğu |
| `podyum` | 10 | Podyuma çıkar (90 sn) |
| `lazer` | 30 | Lazer şovu, adı LED duvarda |
| `co2` | 99 | CO2 patlaması ve anında drop |
| `vip` | 199 | VIP balkona çıkar (15 dk) |
| `dj` | 500 | DJ kabinine geçer, adı LED duvarda (10 dk), müzik tarzını seçer |
| `festival` | 1000+ | 45 sn açık hava festival: depo duvarları kalkar, gün batımı gökyüzü, yan kule lazerleri, havai fişek, drop |

**Özel danslar** (sadece hediyeyle, yorumla alınamaz; hediye başına 60 sn, seride katlanır, en fazla 5 dk):

| Eylem (`"eylem": "dans"`) | Varsayılan | Hareket |
|---|---|---|
| `"dans": "disko"` 🕺 | 5 | 70'ler disko: sağ kol çaprazdan yukarıyı gösterir, sonra aşağı iner; sol el belde, kalça sallanır |
| `"dans": "dalga"` 🌊 | 15 | Baş → göğüs → bel vücut dalgası |
| `"dans": "yeldegirmeni"` 🌪️ | 20 | İki kol sırayla büyük daireler çizer, gövde eğilip kalkar |
| `"dans": "kalabalik"` 👑 | 299 | Etrafındaki 12 kişi 20 sn onun son özel dansını yapar |

Özel dans yapanın isminin başında dansın ikonu görünür. Hediye şeridi iki sayfa: **Roller & efektler** ↔ **Özel danslar** (8 sn'de bir değişir).

Hediyeler sırayla şuna göre eşleşir: id, sonra ad, sonra jeton değeri. TikTok LIVE Studio'daki "İzleyici Dilekleri" listesini buradakiyle aynı tut. Gerçek hediye ad ve id'lerini paneldeki **Hediye kaydı**ndan görebilirsin. Dosyayı kaydedip sayfayı yenilemen yeterli.

Listede olmayan hediyeler değerine göre ışık şovu olur ve **Gecenin Kralı** sıralamasına yazılır.

## Görsel efektler
- **Drop:** ~1 sn ağır çekim (müzik normal hızda devam eder), CO2, sis, konfeti. Ardından 8 sn boyunca kamera her 2 ölçüde bir sert kesmeyle plan değiştirir.
- **Disko topu:** tavanda döner, duvarlara ışık noktaları yansıtır. R&B ve POP tarzında ve drop sonrası en parlak halinde.
- **Yerde sis:** zeminde süzülür, rengi müzik tarzına göre değişir. Drop ve CO2'de sahne önünden sis püskürür.
- Kamera geçişleri ölçü başına denk gelir.

## Kalite ayarı
Panelde **Kalite**: Düşük / Orta / Yüksek. Düşük modda çözünürlük azalır, bloom (parlama) kapanır, parçacık ve sis azalır. Panelde seçince açık sahne penceresi de değişir. Sahne penceresine doğrudan vermek için adrese `?q=low` (ya da `mid`, `high`) ekle: `http://localhost:3200/?clean&q=low`. Sahne uzun süre 25 FPS'in altına düşerse panel uyarı verir.

## Kendi müziğin
`müzik/` klasörüne telifsiz parçalar atabilirsin. Dosya adını `Sanatçı - Parça.mp3` biçiminde verirsen "Şu an çalıyor" şeridinde sanatçı ve parça adı ayrı görünür, alttaki çizgi parçanın ilerlemesini gösterir. Klasör boşken oyunun kendi müziği çalar; her drop'tan sonra yeni bir parça adı gelir, biri DJ olunca sanatçı olarak onun adı yazar. Oyun temposunu ölçer, dansları ve ışıkları vuruşa kilitler. Build ve drop efektleri bu parçalara da uygulanır. Klasör boşsa oyun kendi techno'sunu üretir. TikTok'ta telifli müzik yayının sessize alınmasına yol açabilir.

## Güvenlik ve kurallar
- Flaşlar saniyede 3'ün altında tutulur. Panelden tamamen kapatılabilir (ışığa duyarlı epilepsi riski).
- Alkol ve uyuşturucu imgesi yok. Bar yerine su ve enerji içeceği standı var.
- Şans oyunu, çark ya da ödül vaadi yok. Hediyeler yalnızca görsel efekt ve rol verir.
- `ayarlar.json`'daki anahtarı kimseyle paylaşma.

## Sorun çözme
| Belirti | Çözüm |
|---|---|
| "rate limit" | Euler'in ücretsiz saatlik kotası doldu. Program 10 dk sonra kendisi tekrar dener. |
| "şu an yayında değil" | Yayını aç. Program 30 sn içinde kendisi bağlanır. |
| Ses yok | Sahne penceresine bir kez tıkla. |
| Kasma | Panelden kaliteyi **Düşük** yap, başka sekmeleri kapat. Pencere arka planda kalırsa tarayıcı onu yavaşlatır. |
| "Node.js … eski" | Node 20 veya üstünü kur (nodejs.org, LTS), sonra yeniden başlat. |
