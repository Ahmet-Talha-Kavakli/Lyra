# Lyra — Gelişmiş Görüntü Analizi ve Video Terapi UI Implementasyon Planı

**Spec:** `docs/superpowers/specs/2026-03-19-vision-analysis-design.md`
**Tarih:** 2026-03-19
**Durum:** Bekliyor

---

## Hedef

Lyra'nın görüntü analizi sistemini temel duygu tespitinden jest/mimik/enerji analizine yükseltmek; adaptif interval, trend takibi, 3 katmanlı kural motoru ve simetrik iki panelli video terapi UI eklemek.

---

## Mimari Özet

```
Frontend (index.html)                    Backend (server.js)
─────────────────────────────────────    ─────────────────────────────────────
Kamera (getUserMedia)                    /analyze-emotion
  ↓ adaptif setInterval (2-6s)             ↓ GPT-4o Vision (zengin prompt)
captureFrame() → base64                    ↓ userEmotions Map güncelle
  ↓ POST /analyze-emotion                  ↓ emotion_logs → Supabase
onAnalysisResult()                       /api/chat/completions
  ↓ interval güncelle                      ↓ buildLayer1/2/3Rules()
                                           ↓ sistem prompt enjeksiyonu
Video UI (CSS Grid)                      /vapi-webhook
  panel-lyra (Three.js sahne)              ↓ seans özeti → memories
  panel-user (kamera video)
  glow-lyra / glow-user animasyonu
```

---

## Dosya Sorumlulukları

| Dosya | Değişiklik |
|---|---|
| `server.js` | `/analyze-emotion` prompt, `userEmotions` Map, trend motoru, kural motoru, `emotion_logs` kaydı, `vapi-webhook` seans özeti |
| `public/index.html` | Adaptif interval, video UI CSS Grid, glow çerçeve, `getUserMedia`, VAPI event handlers |
| Supabase Dashboard | `emotion_logs` tablosu (manuel oluşturulacak) |

**Değişmeyen dosyalar:** `config.js`, `package.json`, `vercel.json`

---

## Teknik Notlar

- `server.js` ES module kullanıyor (`import/export`) — `const` ve arrow function kullan
- Three.js `camera` değişkeni zaten kullanılıyor — kamera stream için `camStream` adını kullan, Three.js `camera` değişkenine dokunma
- `#hidden-canvas` zaten var — bu ID'yi olduğu gibi kullan
- `container` değişkeni Three.js tarafından kullanılıyor — CSS Grid `.panel-lyra` içine `container` div'i taşı
- VAPI instance: `let vapi;` olarak tanımlı — mevcut event listener'ları koru, yenilerini ekle
- `currentUserId`: `index.html`'de Supabase auth sonrası set edilen değişken — bunu duygu analizinde kullan
- `crypto.randomUUID()`: Node.js 14.17+ yerleşik — ayrı import gerekmez, doğrudan `crypto.randomUUID()` kullan
- `gecmis` dizisi: tam analiz objesini (jestler dahil) sakla — trend ve sinyal hesaplaması için gerekli

---

## Görevler

### Faz 1 — Backend: Zengin Analiz ve Trend Motoru
> Dosya: `server.js`

---

- [ ] **Görev 1.1 — Yardımcı Fonksiyonları Ekle**

  `server.js`'de `const openai = ...` satırının hemen altına şu yardımcı fonksiyonları ekle:

  ```javascript
  // ─── DUYGU ANALİZİ YARDIMCILARI ─────────────────────────────
  const yogunlukToNum = (y) => ({ 'düşük': 30, 'orta': 60, 'yüksek': 90 }[y] ?? 60);

  const calculateTrend = (gecmis) => {
      if (gecmis.length < 3) return 'stabil';
      const son3 = gecmis.slice(-3).map(a => yogunlukToNum(a.yogunluk));
      const fark = son3[2] - son3[0];
      if (fark > 10) return 'kötüleşiyor';
      if (fark < -10) return 'iyileşiyor';
      return 'stabil';
  };

  const getAktifSinyaller = (jestler) => {
      if (!jestler) return [];
      const sinyaller = [];
      if (jestler.kas_catma === true)          sinyaller.push('kas_catma');
      if (jestler.gozyasi_izi === true)        sinyaller.push('gozyasi_izi');
      if (jestler.dudak_sikistirma === true)   sinyaller.push('dudak_sikistirma');
      if (jestler.bas_egme === true)           sinyaller.push('bas_egme');
      if (jestler.goz_temasi === 'düşük')      sinyaller.push('goz_temasi:düşük');
      if (jestler.omuz_durusu === 'düşük')     sinyaller.push('omuz_durusu:düşük');
      if (jestler.cene_gerginligi === 'yüksek') sinyaller.push('cene_gerginligi:yüksek');
      if (jestler.goz_kirpma_hizi === 'yavaş') sinyaller.push('goz_kirpma_hizi:yavaş');
      return sinyaller;
  };

  const getDominantDuygu = (gecmis) => {
      if (!gecmis.length) return 'sakin';
      const sayac = {};
      gecmis.forEach(a => { sayac[a.duygu] = (sayac[a.duygu] || 0) + 1; });
      const maxSayi = Math.max(...Object.values(sayac));
      const adaylar = Object.keys(sayac).filter(d => sayac[d] === maxSayi);
      if (adaylar.length === 1) return adaylar[0];
      // Eşitlikte en son geçeni tercih et
      for (let i = gecmis.length - 1; i >= 0; i--) {
          if (adaylar.includes(gecmis[i].duygu)) return gecmis[i].duygu;
      }
      return adaylar[0];
  };
  ```

  Doğrulama: Sunucu hatasız başlıyor mu?
  ```bash
  npm start
  # Beklenen: 🚀 Lyra Brain Sunucusu Çalışıyor!
  ```

---

- [ ] **Görev 1.2 — `/analyze-emotion` Endpoint'ini Genişlet**

  `server.js`'de mevcut `/analyze-emotion` endpoint'ini tamamen değiştir.

  Mevcut prompt (`'Bu yüzün duygusunu analiz et...'`) yerine:

  ```javascript
  app.post('/analyze-emotion', async (req, res) => {
      try {
          const { imageBase64, userId, sessionId } = req.body;
          if (!imageBase64) return res.json({ duygu: 'sakin', guven: 0, yuz_var: false });

          const response = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{
                  role: 'user',
                  content: [
                      {
                          type: 'text',
                          text: `Bu görüntüdeki kişinin duygusal durumunu, jest ve mimiklerini ayrıntılı analiz et.
  Yüz görünmüyorsa yuz_var:false döndür, diğer alanları null yap.
  Yalnızca geçerli JSON döndür, başka hiçbir şey ekleme:
  {"duygu":"mutlu|üzgün|endişeli|korkmuş|sakin|şaşırmış|sinirli|yorgun","yogunluk":"düşük|orta|yüksek","enerji":"canlı|normal|yorgun","jestler":{"kas_catma":true,"goz_temasi":"yüksek|normal|düşük","goz_kirpma_hizi":"hızlı|normal|yavaş","gülümseme_tipi":"gerçek|sosyal|yok","gülümseme_gerceklik":true,"bas_egme":false,"bas_sallama_ritmi":"aktif|yok","omuz_durusu":"yüksek|normal|düşük","cene_gerginligi":"yüksek|orta|düşük","dudak_sikistirma":false,"gozyasi_izi":false},"genel_vucut_dili":"açık|nötr|kapalı","nefes_ritmi":"hızlı|normal|ağır","guven":85,"yuz_var":true,"timestamp":0}`
                      },
                      {
                          type: 'image_url',
                          image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' }
                      }
                  ]
              }],
              max_tokens: 200
          });

          let result = { duygu: 'sakin', guven: 0, yuz_var: false };
          try {
              const raw = response.choices[0].message.content.trim().replace(/```json|```/g, '');
              result = JSON.parse(raw);
              result.timestamp = Date.now();
          } catch { /* parse hatası → fallback */ }

          if (userId && result.yuz_var) {
              // userEmotions Map'i güncelle
              const mevcut = userEmotions.get(userId) || { gecmis: [] };
              // gecmis: tam analiz objesi saklanır (jestler dahil — trend ve sinyal hesabı için gerekli)
              const yeniGecmis = [...mevcut.gecmis, {
                  duygu: result.duygu,
                  yogunluk: result.yogunluk,
                  enerji: result.enerji,
                  guven: result.guven,
                  jestler: result.jestler || null,
                  timestamp: result.timestamp
              }].slice(-10); // son 10

              const guncel = {
                  gecmis: yeniGecmis,
                  trend: calculateTrend(yeniGecmis),
                  dominant_duygu: getDominantDuygu(yeniGecmis),
                  yogunluk_ort: Math.round(yeniGecmis.reduce((s, a) => s + yogunlukToNum(a.yogunluk), 0) / yeniGecmis.length),
                  aktif_sinyal: getAktifSinyaller(result.jestler),
                  son_analiz: result
              };
              userEmotions.set(userId, guncel);
              console.log(`[DUYGU] ${userId}: ${result.duygu} | yogunluk:${result.yogunluk} | trend:${guncel.trend} | sinyaller:${guncel.aktif_sinyal.join(',')}`);

              // emotion_logs'a kaydet — fire-and-forget (akışı bloklama)
              const sid = req.body.sessionId || activeSessionId;
              if (sid) {
                  supabase.from('emotion_logs').insert({
                      user_id: userId,
                      session_id: sid,
                      duygu: result.duygu,
                      yogunluk: result.yogunluk,
                      enerji: result.enerji,
                      jestler: result.jestler || null,
                      trend: guncel.trend,
                      guven: result.guven
                  }).then(({ error }) => {
                      if (error) console.error('[EMOTION LOG] Insert hatası:', error.message);
                  });
              }
          }

          res.json(result);
      } catch (err) {
          console.error('[DUYGU] Hata:', err.message);
          res.json({ duygu: 'sakin', guven: 0, yuz_var: false });
      }
  });
  ```

  Doğrulama:
  ```bash
  curl -s -X POST http://localhost:3001/analyze-emotion \
    -H "Content-Type: application/json" \
    -d '{"imageBase64":"","userId":"test"}' | jq .
  # Beklenen: {"duygu":"sakin","guven":0,"yuz_var":false}
  ```

---

### Faz 2 — Backend: Supabase emotion_logs
> Supabase Dashboard + `server.js`

---

- [ ] **Görev 2.1 — Supabase Tablosunu Oluştur**

  Supabase Dashboard → SQL Editor'e git ve şunu çalıştır:

  ```sql
  CREATE TABLE emotion_logs (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid        REFERENCES auth.users(id),
    session_id  uuid,
    timestamp   timestamptz DEFAULT now(),
    duygu       text,
    yogunluk    text,
    enerji      text,
    jestler     jsonb,
    trend       text,
    guven       int
  );

  CREATE INDEX emotion_logs_user_id_idx    ON emotion_logs (user_id);
  CREATE INDEX emotion_logs_session_id_idx ON emotion_logs (session_id);
  CREATE INDEX emotion_logs_timestamp_idx  ON emotion_logs (timestamp DESC);

  ALTER TABLE emotion_logs ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "users_own_emotion_logs"
    ON emotion_logs FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "service_key_insert"
    ON emotion_logs FOR INSERT
    WITH CHECK (true);
  ```

  Doğrulama: Supabase → Table Editor → `emotion_logs` tablosu görünüyor mu?

---

- [ ] **Görev 2.2 — session_id Takibini Ekle**

  `server.js`'de `activeSessionUserId` değişkeninin yanına `activeSessionId` ekle:

  ```javascript
  let activeSessionUserId = null;
  let activeSessionId = null; // YENİ
  ```

  `/session-start` endpoint'inde, `activeSessionUserId = user.id;` satırının hemen altına ekle:

  ```javascript
  activeSessionUserId = user.id;
  activeSessionId = crypto.randomUUID(); // YENİ — Node.js 14.17+ yerleşik, import gerekmez
  console.log(`[SESSION] Aktif kullanıcı: ${user.id}, sessionId: ${activeSessionId}`);
  ```

  **Not:** `crypto.randomUUID()` Node.js global'dir, ayrı `import` gerekmez.

  **Not:** `emotion_logs` insert işlemi zaten Görev 1.2'de `/analyze-emotion` içine eklenmiştir (`req.body.sessionId || activeSessionId` kullanarak). Bu görev yalnızca `activeSessionId` lifecycle'ını tamamlar.

  Ayrıca `/vapi-webhook`'taki `end-of-call-report` bloğunun sonuna, `res.json({})` öncesine sıfırlama ekle:

  ```javascript
  // Seans bitti, ID'yi sıfırla
  activeSessionId = null;
  ```

  Doğrulama: Sunucu yeniden başlat, `/session-start` çağır, `[SESSION] ... sessionId:` logunu gör:
  ```bash
  curl -s -X POST http://localhost:3001/session-start \
    -H "Content-Type: application/json" \
    -d '{"token":"test"}'
  # Beklenen: 200 OK, sunucu logunda [SESSION] satırı
  ```

---

- [ ] **Görev 2.3 — vapi-webhook Seans Özeti Güncelle**

  `server.js`'de `end-of-call-report` bloğunda, `saveMemory(userId, summary)` çağrısından **önce** emotion özeti ekle:

  ```javascript
  // Seans emotion özetini çek
  let emotionOzeti = '';
  try {
      if (activeSessionId) {
          const { data: logs } = await supabase
              .from('emotion_logs')
              .select('duygu, yogunluk, trend, guven')
              .eq('session_id', activeSessionId)
              .order('timestamp', { ascending: true });

          if (logs && logs.length > 0) {
              const sayac = {};
              logs.forEach(l => { sayac[l.duygu] = (sayac[l.duygu] || 0) + 1; });
              const dominant = Object.keys(sayac).sort((a,b) => sayac[b]-sayac[a])[0];
              const ortGuven = Math.round(logs.reduce((s,l) => s + (l.guven||0), 0) / logs.length);
              const sonTrend = logs[logs.length-1]?.trend || 'stabil';
              emotionOzeti = `\n\nBu seanstaki duygu analizi: Baskın duygu "${dominant}", ortalama güven %${ortGuven}, seans sonu trendi "${sonTrend}".`;
          }
      }
  } catch (e) { console.error('[EMOTION OZET] Hata:', e.message); }

  // Mevcut özeti emotion özeti ile zenginleştir
  const summary = summaryResponse.choices[0].message.content + emotionOzeti;
  await saveMemory(userId, summary);
  ```

  Doğrulama: Sunucu hatasız derlenip başlıyor mu?
  ```bash
  npm start
  # Beklenen: 🚀 Lyra Brain Sunucusu Çalışıyor!
  ```

---

### Faz 3 — Backend: Kural Motoru
> Dosya: `server.js`

---

- [ ] **Görev 3.1 — Kural Motoru Fonksiyonlarını Ekle**

  `server.js`'de yardımcı fonksiyonların hemen altına ekle:

  ```javascript
  // ─── KURAL MOTORU ─────────────────────────────────────────
  const buildLayer1Rules = (sonAnaliz, aktifSinyaller) => {
      if (!sonAnaliz || !sonAnaliz.yuz_var) return '';
      const kurallar = [];
      const { duygu, yogunluk, enerji, jestler, guven } = sonAnaliz;

      if (duygu === 'korkmuş' && guven > 80 && jestler?.gozyasi_izi === true)
          kurallar.push('Kullanıcı korkmuş ve gözyaşı izi var. Önce güven ver, hiç soru sorma. Sessiz, kısa, destekleyici cümleler kur.');

      if (duygu === 'sinirli' && jestler?.cene_gerginligi === 'yüksek' && jestler?.omuz_durusu === 'yüksek')
          kurallar.push('Kullanıcı sinirli ve gergin. Doğrula, çözüm önerme. Gerekirse nefes egzersizi sun.');

      if (duygu === 'yorgun' && jestler?.goz_kirpma_hizi === 'yavaş' && enerji === 'yorgun')
          kurallar.push('Kullanıcı çok yorgun. Seansı kısalt, konuyu değiştirme, enerjik sorular sorma.');

      if (duygu === 'üzgün' && jestler?.genel_vucut_dili === 'kapalı')
          kurallar.push('Kullanıcı üzgün ve kapalı beden dili sergiliyor. Daha az soru, daha çok yansıtma ve empati.');

      if (jestler?.gozyasi_izi === true)
          kurallar.push('Gözyaşı izi tespit edildi. Çok dikkatli ol, sessizlik ver, yargılama.');

      if (yogunluk === 'yüksek' && jestler?.kas_catma === true)
          kurallar.push('Yüksek yoğunluk ve kaş çatma. Yavaş konuş, kısa cümleler kur.');

      return kurallar.join(' ');
  };

  const buildLayer2Rules = (trend, dominantDuygu, gecmis) => {
      if (!gecmis || gecmis.length < 2) return '';
      const kurallar = [];

      if (trend === 'kötüleşiyor' && dominantDuygu === 'endişeli')
          kurallar.push('Kullanıcının endişe seviyesi artıyor. Tempo düşür, kısa cümleler kur, uygun yerlerde sessizlik bırak.');

      if (trend === 'iyileşiyor')
          kurallar.push('Kullanıcı sakinleşiyor. Bu ilerlemeyi nazikçe yansıt, zorlamadan teşvik et.');

      const son5 = gecmis.slice(-5);
      const hepsiYogun = son5.length >= 5 && son5.every(a => a.yogunluk === 'yüksek' || a.yogunluk === 'orta');
      if (hepsiYogun)
          kurallar.push(`Kullanıcı uzun süredir ${dominantDuygu} hissediyor. Bu duyguyu doğrudan nazikçe ele almayı düşün.`);

      const yogunlukOrt = gecmis.reduce((s, a) => s + yogunlukToNum(a.yogunluk), 0) / gecmis.length;
      if (yogunlukOrt > 75 && gecmis.length >= 5)
          kurallar.push('Kullanıcı bu seans boyunca yüksek duygusal yoğunlukta. Sabırlı ve yavaş ol.');

      return kurallar.join(' ');
  };

  const buildLayer3Rules = (hafizaMetni, sonAnaliz) => {
      if (!hafizaMetni || !sonAnaliz) return '';
      const kurallar = [];
      const lower = hafizaMetni.toLowerCase();

      if ((lower.includes('üzgün') || lower.includes('uzgun')) &&
          (lower.includes('seans') || lower.includes('hafta') || lower.includes('süre')))
          kurallar.push('Hafızaya göre kullanıcı bir süredir üzgün. Bu tekrarlayan durumu nazikçe gündeme getirmeyi düşün.');

      if (lower.includes('iyileş') || lower.includes('daha iyi') || lower.includes('güzel geçt'))
          kurallar.push('Önceki seanslarda iyileşme kaydedilmiş. Bu ilerlemeyi fark et ve kutla.');

      if (sonAnaliz.yogunluk === 'yüksek' && sonAnaliz.guven > 80 &&
          !lower.includes('yoğun') && !lower.includes('kriz'))
          kurallar.push('Bu seansta ilk kez yüksek yoğunluk görülüyor. Daha dikkatli yaklaş, acele etme.');

      return kurallar.join(' ');
  };
  ```

  Doğrulama:
  ```bash
  npm start
  # Beklenen: hatasız başlatma
  ```

---

- [ ] **Görev 3.2 — /api/chat/completions Duygu Enjeksiyonunu Güncelle**

  `server.js`'de `/api/chat/completions` içindeki mevcut duygu enjeksiyon bloğunu (`const latestEmotion = userEmotions.get(userId);` ile başlayan kısım) tamamen şununla değiştir:

  ```javascript
  const userState = userEmotions.get(userId);
  if (userState) {
      const { son_analiz, trend, dominant_duygu, aktif_sinyal, gecmis, yogunluk_ort } = userState;

      const l1 = buildLayer1Rules(son_analiz, aktif_sinyal);
      const l2 = buildLayer2Rules(trend, dominant_duygu, gecmis || []);
      const l3 = buildLayer3Rules(userMemory, son_analiz);

      const tumKurallar = [l1, l2, l3].filter(Boolean).join(' ');

      if (tumKurallar) {
          const sysIdx = enrichedMessages.findIndex(m => m.role === 'system');
          const enjeksiyon = `\n\n[GİZLİ TALIMAT — Kamera & Trend Analizi]:\n${tumKurallar}\nBu talimatları doğal şekilde uygula, asla "kamerayı görüyorum" ya da "analiz ediyorum" deme.`;
          if (sysIdx !== -1) {
              enrichedMessages[sysIdx] = {
                  ...enrichedMessages[sysIdx],
                  content: enrichedMessages[sysIdx].content + enjeksiyon
              };
          }
          console.log(`[KURAL MOTORU] Katman1:${!!l1} Katman2:${!!l2} Katman3:${!!l3} | trend:${trend} | dominant:${dominant_duygu}`);
      }
  }
  ```

  Doğrulama:
  ```bash
  npm start
  # Beklenen: hatasız başlatma
  # /api/chat/completions çağrısında [KURAL MOTORU] logu görünmeli
  ```

---

### Faz 4 — Frontend: Kamera Refactor + Adaptif Interval
> Dosya: `public/index.html`
> **Önemli sıra:** Faz 4 görevleri aşağıdaki sırayla uygulanmalı. `userVideo` önce tanımlanıyor, sonra `analyzeEmotion` güncelleniyor.

---

- [ ] **Görev 4.1 — Kamera Değişkenlerini Güncelle**

  `public/index.html`'de mevcut kamera değişken bloğunu bul:
  ```javascript
  let cameraStream = null, cameraActive = false, emotionInterval = null;
  const cameraToggleBtn = document.getElementById('camera-toggle');
  const cameraPreview   = document.getElementById('camera-preview');
  ```

  Bunu şununla **değiştir** (eski `cameraStream` → `camStream`, `cameraPreview` → `userVideo`):

  ```javascript
  // Kamera state
  let camStream = null, cameraActive = false;
  const userVideo    = document.getElementById('user-video');       // YENİ panel içindeki video
  const cameraOffMsg = document.getElementById('camera-off-msg');   // "Kamera kapalı" mesajı
  const cameraToggleBtn = document.getElementById('camera-toggle');

  // Adaptif interval
  let adaptifInterval = 4000;
  let sonDuygu = null;
  let ardiArdina = 0;
  let emotionTimer = null;

  function getBaseInterval(duygu) {
      if (['sakin', 'mutlu'].includes(duygu))                        return 6000;
      if (['endişeli', 'üzgün', 'korkmuş', 'sinirli'].includes(duygu)) return 2000;
      return 4000;
  }

  function scheduleNextAnalysis() {
      clearTimeout(emotionTimer);
      emotionTimer = setTimeout(analyzeEmotion, adaptifInterval);
  }
  ```

  **Not:** `currentUserId` — bu değişken `index.html`'de Supabase oturum açma sonrası set ediliyor (`let currentUserId = null;` + `currentUserId = session.user.id;`). Mevcut kodu kontrol et; eğer farklı isimle tanımlıysa (örn. `userId`, `loggedInUserId`) o ismi kullan.

---

- [ ] **Görev 4.2 — startCamera ve stopCamera Fonksiyonlarını Güncelle**

  Mevcut `startCamera()` ve `stopCamera()` fonksiyonlarını tamamen değiştir:

  ```javascript
  async function startCamera() {
      try {
          camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
              audio: false
          });
          userVideo.srcObject = camStream;
          if (cameraOffMsg) cameraOffMsg.classList.add('hidden');
          cameraActive = true;
          cameraToggleBtn.classList.add('active');
          cameraToggleBtn.textContent = '🟢';
          scheduleNextAnalysis();
      } catch (e) {
          console.error('[KAMERA] İzin reddedildi veya hata:', e.message);
          // Kamera panelini gizle, Lyra paneli tam genişliğe geç
          const panelUser = document.getElementById('panel-user');
          if (panelUser) panelUser.style.display = 'none';
          const layout = document.querySelector('.therapy-layout');
          if (layout) layout.style.gridTemplateColumns = '1fr';
      }
  }

  function stopCamera() {
      if (camStream) camStream.getTracks().forEach(t => t.stop());
      camStream = null;
      cameraActive = false;
      clearTimeout(emotionTimer);
      emotionTimer = null;
      adaptifInterval = 4000;  // sıfırla
      sonDuygu = null;
      ardiArdina = 0;
      userVideo.srcObject = null;
      if (cameraOffMsg) cameraOffMsg.classList.remove('hidden');
      cameraToggleBtn.classList.remove('active');
      cameraToggleBtn.textContent = '📷';
  }
  ```

  Mevcut `cameraToggleBtn.addEventListener('click', ...)` satırını koru.

---

- [ ] **Görev 4.3 — analyzeEmotion Fonksiyonunu Güncelle**

  Mevcut `analyzeEmotion` fonksiyonunu tamamen şununla değiştir:

  ```javascript
  async function analyzeEmotion() {
      if (!cameraActive || !camStream) {
          scheduleNextAnalysis();
          return;
      }
      try {
          const hiddenCanvas = document.getElementById('hidden-canvas');
          const ctx = hiddenCanvas.getContext('2d');
          hiddenCanvas.width = 320;
          hiddenCanvas.height = 240;
          ctx.drawImage(userVideo, 0, 0, 320, 240);
          const imageBase64 = hiddenCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];

          // currentUserId: Supabase auth sonrası set edilen kullanıcı ID'si
          // activeSessionId: window üzerinden backend'deki session ID ile eşleştirilir
          const resp = await fetch('/analyze-emotion', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  imageBase64,
                  userId: currentUserId || null,
                  sessionId: null  // backend activeSessionId'yi kullanır
              })
          });
          const result = await resp.json();

          // yuz_var false → interval değiştirme, devam et
          if (!result.yuz_var) {
              scheduleNextAnalysis();
              return;
          }

          // Adaptif interval hesapla
          const base = getBaseInterval(result.duygu);
          if (result.duygu === sonDuygu) {
              ardiArdina++;
              if (ardiArdina >= 3) {
                  adaptifInterval = Math.min(base * 2, 6000);
              }
          } else {
              ardiArdina = 0;
              adaptifInterval = base;
          }
          sonDuygu = result.duygu;

          console.log(`[DUYGU UI] ${result.duygu} | yogunluk:${result.yogunluk} | interval:${adaptifInterval}ms`);
      } catch (e) {
          console.error('[DUYGU UI] Hata:', e.message);
      }
      scheduleNextAnalysis();
  }
  ```

  Doğrulama: Kamera açıldığında `[DUYGU UI]` logları console'da görünüyor mu? İlk analizde 4s, sakin durumda 6s'ye çıkıyor mu?

---

### Faz 5 — Frontend: Video Terapi UI
> Dosya: `public/index.html`

---

- [ ] **Görev 5.1 — HTML Yapısını Güncelle**

  `public/index.html`'de mevcut `<body>` içindeki ana layout'u değiştir.

  Mevcut:
  ```html
  <div id="canvas-container"></div>
  <canvas id="hidden-canvas" style="display:none"></canvas>
  ...
  <div id="camera-widget">
      <video id="camera-preview" autoplay muted playsinline></video>
      ...
      <button class="camera-btn" id="camera-toggle" title="Kamera Analizi">📷</button>
  </div>
  ```

  Yeni:
  ```html
  <div class="therapy-layout">
      <div class="panel-lyra" id="panel-lyra">
          <div id="canvas-container"></div>
          <div class="panel-label">Lyra</div>
      </div>
      <div class="panel-user" id="panel-user">
          <video id="user-video" autoplay muted playsinline></video>
          <div class="panel-label">Sen</div>
          <div class="camera-off-msg" id="camera-off-msg">
              <span>📷</span>
              <p>Kamera kapalı</p>
          </div>
      </div>
      <div class="bottom-controls">
          <!-- Mevcut kontrol butonları buraya taşınacak -->
      </div>
  </div>
  <canvas id="hidden-canvas" style="display:none; width:320px; height:240px;"></canvas>
  ```

  **Önemli:** Mevcut bottom-controls içine `#start-btn`, `#end-btn`, `#camera-toggle` ve diğer mevcut butonları taşı. Silme, sadece `.bottom-controls` div'i içine al.

---

- [ ] **Görev 5.2 — CSS Grid Stillerini Ekle**

  `<style>` bloğuna mevcut `#canvas-container` stilinin **üstüne** şunu ekle:

  ```css
  /* ─── TERAPİ LAYOUT ─────────────────────────────────── */
  body {
      margin: 0;
      overflow: hidden;
      background: #080510;
  }

  .therapy-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr auto;
      gap: 12px;
      height: 100vh;
      padding: 20px;
      box-sizing: border-box;
  }

  .panel-lyra {
      grid-column: 1;
      grid-row: 1;
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      background: #0a0618;
      box-shadow: 0 0 0 1px rgba(200, 169, 110, 0.15);
      transition: box-shadow 0.4s ease;
  }

  .panel-user {
      grid-column: 2;
      grid-row: 1;
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      background: #0d0a07;
      box-shadow: 0 0 0 1px rgba(200, 169, 110, 0.15);
      transition: box-shadow 0.4s ease;
  }

  .panel-label {
      position: absolute;
      bottom: 12px;
      left: 16px;
      color: rgba(255,255,255,0.5);
      font-size: 13px;
      font-family: sans-serif;
      letter-spacing: 0.05em;
      z-index: 10;
      pointer-events: none;
  }

  #user-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
  }

  .camera-off-msg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: rgba(255,255,255,0.3);
      font-family: sans-serif;
      pointer-events: none;
  }
  .camera-off-msg span { font-size: 32px; }
  .camera-off-msg p { font-size: 13px; margin: 8px 0 0; }
  .camera-off-msg.hidden { display: none; }

  .bottom-controls {
      grid-column: 1 / -1;
      grid-row: 2;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
      padding: 8px 0 4px;
  }

  /* Mevcut #canvas-container full-fill panel içinde */
  #canvas-container {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: 100%;
  }

  /* Responsive */
  @media (max-width: 767px) {
      .therapy-layout {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr 1fr auto;
          padding: 12px;
          gap: 8px;
      }
      .panel-lyra  { grid-column: 1; grid-row: 1; }
      .panel-user  { grid-column: 1; grid-row: 2; }
      .bottom-controls { grid-row: 3; }
  }
  ```

  **Not:** Mevcut `#canvas-container` stilindeki `position: fixed; top:0; left:0; width:100vw; height:100vh;` varsa kaldır — artık panel içinde relative çalışacak.

---

- [ ] **Görev 5.3 — Three.js Renderer Boyutunu Güncelle**

  `public/index.html`'de Three.js `init()` fonksiyonundaki renderer boyutunu güncelle.

  Mevcut:
  ```javascript
  renderer.setSize(window.innerWidth, window.innerHeight);
  ```

  Yeni:
  ```javascript
  // Panel boyutunu al
  const panelLyra = document.getElementById('panel-lyra');
  renderer.setSize(panelLyra.clientWidth, panelLyra.clientHeight);
  camera.aspect = panelLyra.clientWidth / panelLyra.clientHeight;
  camera.updateProjectionMatrix();
  ```

  `window` resize handler'ında da güncelle:
  ```javascript
  window.addEventListener('resize', () => {
      const panelLyra = document.getElementById('panel-lyra');
      const w = panelLyra.clientWidth;
      const h = panelLyra.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
  });
  ```

---

- [ ] **Görev 5.4 — Kamera UI Bağlantısını Doğrula**

  Faz 4'te `startCamera()`, `stopCamera()` ve `analyzeEmotion()` fonksiyonları zaten güncellendi. Bu adımda yalnızca HTML değişikliğinin JS ile uyumlu olduğunu kontrol et:

  - `document.getElementById('user-video')` → Görev 5.1'de eklenen `<video id="user-video">` elementini buluyor mu?
  - `document.getElementById('camera-off-msg')` → Görev 5.1'de eklenen `.camera-off-msg` elementini buluyor mu?
  - `document.getElementById('camera-toggle')` → `.bottom-controls` içine taşınan butonu buluyor mu?

  Eğer `index.html`'de hala eski `cameraPreview` referansı varsa (Faz 4'te gözden kaçmışsa) bul ve `userVideo` ile değiştir:
  ```javascript
  // Kontrol et: index.html'de bu satır kalmamalı
  // const cameraPreview = document.getElementById('camera-preview');  ← SİL
  // ctx.drawImage(cameraPreview, ...)                                  ← userVideo ile değiştir
  ```

  Doğrulama: Sayfayı aç, kamera butonuna tıkla. İki panel yan yana görünüyor mu? Kamera akışı sağ panelde mi?

---

### Faz 6 — Frontend: Işıltılı Çerçeve
> Dosya: `public/index.html`

---

- [ ] **Görev 6.1 — Glow CSS Animasyonlarını Ekle**

  `<style>` bloğuna ekle:

  ```css
  /* ─── GLOW ÇERÇEVE ──────────────────────────────────── */
  @keyframes glow-lyra {
      0%, 100% {
          box-shadow:
              0 0 0 2px rgba(140, 100, 255, 0.6),
              0 0 20px 4px rgba(100, 80, 220, 0.3);
      }
      50% {
          box-shadow:
              0 0 0 3px rgba(160, 120, 255, 0.9),
              0 0 40px 10px rgba(120, 90, 240, 0.5);
      }
  }

  @keyframes glow-user {
      0%, 100% {
          box-shadow:
              0 0 0 2px rgba(180, 255, 180, 0.5),
              0 0 20px 4px rgba(100, 200, 100, 0.25);
      }
      50% {
          box-shadow:
              0 0 0 3px rgba(200, 255, 200, 0.85),
              0 0 40px 10px rgba(120, 220, 120, 0.4);
      }
  }

  .panel-lyra.speaking {
      animation: glow-lyra 1.4s ease-in-out infinite;
  }

  .panel-user.speaking {
      animation: glow-user 1.4s ease-in-out infinite;
  }
  ```

---

- [ ] **Görev 6.2 — VAPI Event Handler'larını Bağla**

  VAPI `vapi.on(...)` bloklarının bulunduğu yere şunu ekle (mevcut event listener'ların yanına):

  ```javascript
  const panelLyra = document.getElementById('panel-lyra');
  const panelUser = document.getElementById('panel-user');

  vapi.on('speech-start', () => {
      panelLyra.classList.add('speaking');
      panelUser.classList.remove('speaking');
  });

  vapi.on('speech-end', () => {
      panelLyra.classList.remove('speaking');
  });

  vapi.on('volume-level', (level) => {
      if (level > 0.05) {
          panelUser.classList.add('speaking');
      } else {
          panelUser.classList.remove('speaking');
      }
  });

  // Arama bitince her iki glow'u kapat
  vapi.on('call-end', () => {
      panelLyra.classList.remove('speaking');
      panelUser.classList.remove('speaking');
  });
  ```

  Doğrulama: Sayfayı aç, VAPI bağlantısı başlat. Lyra konuşurken sol panel mor/mavi, sen konuşurken sağ panel yeşil/beyaz glow atıyor mu?

---

### Faz 7 — Entegrasyon Testi

---

- [ ] **Görev 7.1 — Tam Seans Testi**

  1. `npm start` ile sunucuyu başlat
  2. `http://localhost:3001` adresini aç
  3. Giriş yap (Supabase auth)
  4. Kamera butonuna tıkla — iki panel yan yana görünmeli
  5. Görüşme başlat — VAPI bağlantısı kurulmalı
  6. Konuş, farklı ifadeler dene
  7. Console'da şunları kontrol et:
     - `[DUYGU] userId: ... | yogunluk:... | trend:... | sinyaller:...`
     - `[KURAL MOTORU] Katman1:... Katman2:... Katman3:...`
     - `[DUYGU UI] ... | interval:...ms`

- [ ] **Görev 7.2 — Supabase Doğrulama**

  Supabase Dashboard → Table Editor → `emotion_logs`:
  - Seans sırasında satırlar oluşuyor mu?
  - `user_id`, `session_id`, `duygu`, `jestler` (jsonb) dolu mu?

- [ ] **Görev 7.3 — Hafıza Doğrulama**

  Seans bitince Supabase → `memories` tablosunu kontrol et:
  - Hafıza kaydı güncellendi mi?
  - "Baskın duygu" veya "trend" ifadesi hafıza metninde görünüyor mu?

- [ ] **Görev 7.4 — Kamera İzni Red Testi**

  Tarayıcıda kamera iznini reddet, sayfayı yenile, kamera butonuna tıkla:
  - Sağ panel gizleniyor mu?
  - Lyra paneli tam genişliğe mi çıkıyor?
  - Hata fırlatmıyor mu?

- [ ] **Görev 7.5 — Mobil Görünüm**

  Tarayıcı DevTools → mobil boyut (< 768px):
  - Paneller alt alta mı sıralanıyor (Lyra üstte, kullanıcı altta)?
  - Bottom controls görünüyor mu?

---

## Commit Mesajları (Öneri)

```
feat: backend - zengin duygu analizi objesi ve trend motoru
feat: backend - emotion_logs Supabase kaydı ve seans özeti
feat: backend - 3 katmanlı kural motoru (anlık + trend + geçmiş seans)
feat: frontend - adaptif kamera interval sistemi
feat: frontend - simetrik yan yana video terapi UI
feat: frontend - VAPI glow çerçeve animasyonu
```
