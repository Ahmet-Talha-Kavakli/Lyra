# Lyra — Gelişmiş Görüntü Analizi ve Video Terapi UI Sistemi

**Durum:** Tasarım Dokümanı (Spec)
**Tarih:** 2026-03-19
**Versiyon:** 1.0

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Mevcut Durum Analizi](#2-mevcut-durum-analizi)
3. [Zengin Analiz Objesi](#3-zengin-analiz-objesi)
4. [Adaptif Interval Sistemi](#4-adaptif-interval-sistemi)
5. [Trend Takibi](#5-trend-takibi)
6. [Supabase — emotion_logs Tablosu](#6-supabase--emotion_logs-tablosu)
7. [Çok Katmanlı Kural Motoru](#7-çok-katmanlı-kural-motoru)
8. [Video Terapi UI — Simetrik Yan Yana Layout](#8-video-terapi-ui--simetrik-yan-yana-layout)
9. [Değişen Dosyalar ve Sorumluluklar](#9-değişen-dosyalar-ve-sorumluluklar)
10. [Uygulama Görev Listesi](#10-uygulama-görev-listesi)

---

## 1. Genel Bakış

Bu spec, Lyra uygulamasının görüntü analizi altyapısını temel bir duygu tespitinden çok boyutlu bir jest/mimik/enerji analizine yükseltmek için tasarlanmıştır. Ek olarak simetrik iki pencereli bir video terapi arayüzü (kullanıcı + Lyra avatar) tanımlanmakta ve kural motorunun anlık, trend ve geçmiş seans katmanlarına ayrılması öngörülmektedir.

### Hedefler

- GPT-4o Vision'dan daha ayrıntılı jest ve mimik verisi elde etmek
- Kamera analiz sıklığını kullanıcının duygusal durumuna göre otomatik ayarlamak
- Duygu geçmişini bellekte tutarak trend hesaplamak ve Supabase'e kaydetmek
- Lyra'nın yanıtlarını anlık duygusuna, trende ve geçmiş seanslara göre uyarlamak
- Kullanıcıya Lyra avatarı ile kendi kamera görüntüsünü yan yana gösteren terapi UI'si oluşturmak

---

## 2. Mevcut Durum Analizi

### `server.js` — Mevcut `/analyze-emotion` endpoint'i

Şu an `POST /analyze-emotion` şu yapıyı döndürmektedir:

```json
{ "duygu": "üzgün", "guven": 80 }
```

Prompt yalnızca `duygu` ve `guven` istemektedir. `userEmotions` Map'i bu iki alandan oluşmaktadır. Duygu enjeksiyonu `api/chat/completions` içinde anlık veriden yapılmakta, trend veya geçmiş seans bilgisi kullanılmamaktadır.

### `public/index.html` — Mevcut kamera sistemi

Kamera widget'ı sağ altta küçük bir önizleme penceresi olarak durmaktadır. `analyzeEmotion()` fonksiyonu sabit 4 saniye interval ile çalışmaktadır. Yüz tespiti yoktur; boş görüntü de API'ye gönderilmektedir.

---

## 3. Zengin Analiz Objesi

### 3.1 GPT-4o Vision Prompt Tasarımı

Mevcut kısa promptun yerine aşağıdaki yapılandırılmış prompt kullanılacaktır:

```
Bu görüntüdeki kişinin duygusal durumunu, jest ve mimiklerini ayrıntılı analiz et.
Yüz görünmüyorsa yuz_var:false döndür, diğer alanları null yap.
Yalnızca geçerli JSON döndür, başka hiçbir şey ekleme:

{
  "duygu": "mutlu|üzgün|endişeli|korkmuş|sakin|şaşırmış|sinirli|yorgun",
  "yogunluk": "düşük|orta|yüksek",
  "enerji": "canlı|normal|yorgun",
  "jestler": {
    "kas_catma": true|false,
    "goz_temasi": "yüksek|normal|düşük",
    "goz_kirpma_hizi": "hızlı|normal|yavaş",
    "gülümseme_tipi": "gerçek|sosyal|yok",
    "gülümseme_gerceklik": true|false|null,
    "bas_egme": true|false,
    "bas_sallama_ritmi": "aktif|yok",
    "omuz_durusu": "yüksek|normal|düşük",
    "cene_gerginligi": "yüksek|orta|düşük",
    "dudak_sikistirma": true|false,
    "gozyasi_izi": true|false
  },
  "genel_vucut_dili": "açık|nötr|kapalı",
  "nefes_ritmi": "hızlı|normal|ağır",
  "guven": <0-100 arası sayı>,
  "yuz_var": true|false,
  "timestamp": <unix ms>
}
```

### 3.2 Tam Analiz Objesi Şeması

```json
{
  "duygu": "üzgün",
  "yogunluk": "yüksek",
  "enerji": "yorgun",
  "jestler": {
    "kas_catma": true,
    "goz_temasi": "düşük",
    "goz_kirpma_hizi": "yavaş",
    "gülümseme_tipi": "yok",
    "gülümseme_gerceklik": null,
    "bas_egme": true,
    "bas_sallama_ritmi": "yok",
    "omuz_durusu": "düşük",
    "cene_gerginligi": "orta",
    "dudak_sikistirma": false,
    "gozyasi_izi": false
  },
  "genel_vucut_dili": "kapalı",
  "nefes_ritmi": "agir",
  "guven": 87,
  "yuz_var": true,
  "timestamp": 1234567890
}
```

---

## 4. Adaptif Interval Sistemi

### 4.1 Temel Interval Tablosu

| Durum | Interval |
|---|---|
| Yüz yok (`yuz_var: false`) | Analiz atlanır, mevcut interval korunur |
| Sakin / Mutlu | 6 saniye |
| Normal | 4 saniye |
| Endişeli / Üzgün | 2 saniye |
| Korkmuş / Sinirli | 2 saniye |

### 4.2 Tekrar Tasarrufu Mantığı

- Aynı `duygu` değeri üst üste 3 kez gelirse `consecutiveCount` sayacı artar ve interval bir adım yukarı kayar (örneğin 2s → 4s).
- Herhangi bir `duygu` değişikliği `consecutiveCount`'u sıfırlar ve interval `baseInterval`'e döner.
- Maksimum tasarruf adımı 1'dir — interval hiçbir zaman sakin baseline'ının (6s) üzerine çıkmaz.

### 4.3 Pseudo-kod

```
let currentInterval = 4000
let lastDuygu = null
let consecutiveCount = 0

function getBaseInterval(duygu):
  if duygu in ['sakin', 'mutlu']: return 6000
  if duygu in ['endişeli', 'üzgün', 'korkmuş', 'sinirli']: return 2000
  return 4000

function onAnalysisResult(result):
  if not result.yuz_var:
    return  // interval değiştirme

  base = getBaseInterval(result.duygu)

  if result.duygu == lastDuygu:
    consecutiveCount++
    if consecutiveCount >= 3:
      currentInterval = min(base * 2, 6000)
  else:
    consecutiveCount = 0
    currentInterval = base

  lastDuygu = result.duygu
  rescheduleTimer(currentInterval)
```

---

## 5. Trend Takibi

### 5.1 In-Memory Yapısı

`userEmotions` Map'i `userId` anahtarı ile aşağıdaki yapıyı tutacaktır:

```json
{
  "gecmis": [
    { "duygu": "üzgün", "yogunluk": "yüksek", "guven": 87, "timestamp": 1000 },
    { "...son 10 analiz..." }
  ],
  "trend": "kötüleşiyor | iyileşiyor | stabil",
  "dominant_duygu": "üzgün",
  "yogunluk_ort": 72,
  "aktif_sinyal": ["kas_catma", "omuz_durusu:düşük"],
  "son_analiz": { "...tam analiz objesi..." }
}
```

### 5.2 Trend Hesaplama Mantığı

Yoğunluk metinsel değerleri sayısal karşılıklara dönüştürülür:
- `"düşük"` → 30
- `"orta"` → 60
- `"yüksek"` → 90

Son 3 analizin yoğunluk değerleri alınır:

```
scores = gecmis[-3:].map(a => yogunlukToNum(a.yogunluk))

if scores[-1] - scores[0] > 10:   trend = "kötüleşiyor"
elif scores[0] - scores[-1] > 10: trend = "iyileşiyor"
else:                              trend = "stabil"
```

### 5.3 Aktif Sinyal Tespiti

| Jest Alanı | Ekleme Koşulu |
|---|---|
| `kas_catma` | `true` |
| `gozyasi_izi` | `true` |
| `dudak_sikistirma` | `true` |
| `bas_egme` | `true` |
| `goz_temasi` | `"düşük"` |
| `omuz_durusu` | `"düşük"` |
| `cene_gerginligi` | `"yüksek"` |
| `goz_kirpma_hizi` | `"yavaş"` |

### 5.4 Dominant Duygu

Son 10 analizde en sık geçen `duygu` değeri `dominant_duygu` olur. Eşitlikte son analizin duygusu tercih edilir.

---

## 6. Supabase — emotion_logs Tablosu

### 6.1 Tablo Şeması

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
```

### 6.2 RLS Politikası

```sql
ALTER TABLE emotion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_emotion_logs"
  ON emotion_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "service_key_insert"
  ON emotion_logs FOR INSERT
  WITH CHECK (true);
```

### 6.3 Kayıt Zamanlaması

- `yuz_var: true` olan her başarılı analizde kayıt yapılır
- `yuz_var: false` durumunda kayıt atlanır

### 6.4 Seans Sonu Özeti

`vapi-webhook` `end-of-call-report` aldığında:
1. `emotion_logs`'dan aktif `session_id`'ye ait satırlar çekilir
2. Özet hesaplanır: dominant duygu, ortalama güven, trend değişimi, aktif sinyaller
3. Bu özet `memories` tablosundaki hafıza kaydına eklenir

---

## 7. Çok Katmanlı Kural Motoru

### 7.1 Genel Çalışma Prensibi

Kural motoru `/api/chat/completions` endpoint'inde sistem mesajına enjekte edilecek bir `[GİZLİ TALIMAT]` bloğu üretir. Üç katman bağımsız değerlendirilir, çıktıları birleştirilerek tek blok oluşturulur.

```
[GİZLİ TALIMAT — Kamera & Trend Analizi]:
<Katman 1 çıktısı>
<Katman 2 çıktısı>
<Katman 3 çıktısı>
Bu talimatları doğal şekilde uygula, asla "kamerayı görüyorum" deme.
```

### 7.2 Katman 1 — Anlık Kurallar

| Koşul | Enjekte Edilecek Kural |
|---|---|
| `duygu == "korkmuş"` AND `guven > 80` AND `jestler.gozyasi_izi == true` | Önce güven ver, hiç soru sorma. Sessiz, kısa, destekleyici cümleler kullan. |
| `duygu == "sinirli"` AND `jestler.cene_gerginligi == "yüksek"` AND `jestler.omuz_durusu == "yüksek"` | Doğrula, çözüm önerme. Nefes egzersizi sun. |
| `duygu == "yorgun"` AND `jestler.goz_kirpma_hizi == "yavaş"` AND `enerji == "yorgun"` | Seansı kısalt, konuyu değiştirme, enerjik sorular sorma. |
| `duygu == "üzgün"` AND `jestler.genel_vucut_dili == "kapalı"` | Daha az soru, daha çok yansıtma ve empati. |
| `jestler.gozyasi_izi == true` | Çok dikkatli ol, sessizlik ver. |
| `yogunluk == "yüksek"` AND `jestler.kas_catma == true` | Yavaş konuş, kısa cümleler kur. |

### 7.3 Katman 2 — Trend Kuralları

| Koşul | Enjekte Edilecek Kural |
|---|---|
| `trend == "kötüleşiyor"` AND `dominant_duygu == "endişeli"` | Tempo düşür, kısa cümle kur, uygun yerlerde sessizlik bırak. |
| `trend == "iyileşiyor"` | İlerlemeyi nazikçe yansıt, zorlamadan teşvik et. |
| Son 5 analiz aynı yoğun duygu | Bu duyguyu doğrudan ele almayı değerlendir. |
| `yogunluk_ort > 75` AND `gecmis.length >= 5` | Kullanıcı uzun süredir yoğun bir duygudaymış, sabırlı ve yavaş ol. |

### 7.4 Katman 3 — Geçmiş Seans Kuralları

| Koşul | Enjekte Edilecek Kural |
|---|---|
| Hafızada "3 seansdır üzgün" benzeri örüntü | Bu tekrarlayan duygu durumunu nazikçe gündeme getir. |
| Hafızada iyileşme notu | Bu ilerlemeyi fark et ve kutla. |
| İlk kez bu yoğunlukta duygu | Daha dikkatli yaklaş, normalleştirme. |

---

## 8. Video Terapi UI — Simetrik Yan Yana Layout

### 8.1 Genel Yapı

```
┌─────────────────────────────────────┐
│                                     │
│   ┌───────────────┐ ┌─────────────┐ │
│   │               │ │    📷       │ │
│   │  LYRA AVATAR  │ │    SEN      │ │
│   │   (3D sahne)  │ │             │ │
│   │               │ │             │ │
│   └───────────────┘ └─────────────┘ │
│                                     │
│     [ 🎤 mikrofon  —  durum ]       │
└─────────────────────────────────────┘
```

### 8.2 CSS Grid Layout

```css
.therapy-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  gap: 16px;
  height: 100vh;
  padding: 24px;
  box-sizing: border-box;
}

.panel-lyra {
  grid-column: 1;
  grid-row: 1;
  border-radius: 20px;
  overflow: hidden;
}

.panel-user {
  grid-column: 2;
  grid-row: 1;
  border-radius: 20px;
  overflow: hidden;
  background: #0d0a07;
}

.bottom-controls {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
}

@media (max-width: 767px) {
  .therapy-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr auto;
  }
  .panel-lyra       { grid-column: 1; grid-row: 1; }
  .panel-user       { grid-column: 1; grid-row: 2; }
  .bottom-controls  { grid-row: 3; }
}
```

### 8.3 Işıltılı Çerçeve (Glow Border)

```css
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

.panel-lyra, .panel-user {
  box-shadow: 0 0 0 1px rgba(200, 169, 110, 0.15);
  transition: box-shadow 0.4s ease;
}

.panel-lyra.speaking { animation: glow-lyra 1.4s ease-in-out infinite; }
.panel-user.speaking { animation: glow-user 1.4s ease-in-out infinite; }
```

### 8.4 Kamera Teknik Detayları

```javascript
// Kamera erişimi (ses VAPI'den geliyor, echo önlemi)
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
  audio: false
});

// Video elementi
// <video id="user-video" autoplay playsinline muted></video>

// Canvas snapshot (hidden canvas, 320x240 GPT-4o detail:low için yeterli)
function captureFrame() {
  ctx.drawImage(videoEl, 0, 0, 320, 240);
  return canvas.toDataURL('image/jpeg', 0.7).split(',')[1]; // base64
}
```

### 8.5 Konuşma Durumu Tespiti

```javascript
vapiInstance.on('speech-start', () => {
  document.querySelector('.panel-lyra').classList.add('speaking');
  document.querySelector('.panel-user').classList.remove('speaking');
});

vapiInstance.on('speech-end', () => {
  document.querySelector('.panel-lyra').classList.remove('speaking');
});

vapiInstance.on('volume-level', (level) => {
  const userPanel = document.querySelector('.panel-user');
  if (level > 0.05) {
    userPanel.classList.add('speaking');
  } else {
    userPanel.classList.remove('speaking');
  }
});
```

---

## 9. Değişen Dosyalar ve Sorumluluklar

| Dosya | Değişiklik | Öncelik |
|---|---|---|
| `server.js` | `/analyze-emotion` prompt genişletme, `userEmotions` Map yeniden yapılandırma, trend motoru, kural motoru, `emotion_logs` Supabase kaydı, `vapi-webhook` seans özeti | Yüksek |
| `public/index.html` | Adaptif interval sistemi, video UI (CSS Grid, iki panel), ışıltılı çerçeve CSS, `getUserMedia` entegrasyonu, VAPI speech event dinleyicileri, yüz tespiti kontrolü | Yüksek |
| Supabase Dashboard | `emotion_logs` tablosu oluşturma, indeksler, RLS politikaları | Orta |

### Değişmeyen Dosyalar

- `config.js` — Değişiklik gerekmez
- `package.json` — Yeni bağımlılık gerekmez
- `vercel.json` — Değişiklik gerekmez

---

## 10. Uygulama Görev Listesi

### Faz 1 — Backend: Zengin Analiz ve Trend Motoru

- [ ] **1.1** `/analyze-emotion` endpoint'ini genişlet: GPT-4o Vision prompt'unu tam analiz objesi şemasına göre güncelle
- [ ] **1.2** `userEmotions` Map yapısını `{ gecmis, trend, dominant_duygu, yogunluk_ort, aktif_sinyal, son_analiz }` olarak yeniden tasarla
- [ ] **1.3** `calculateTrend(gecmis)` yardımcı fonksiyonunu yaz
- [ ] **1.4** `getAktifSinyaller(jestler)` yardımcı fonksiyonunu yaz
- [ ] **1.5** `getDominantDuygu(gecmis)` yardımcı fonksiyonunu yaz
- [ ] **1.6** Her başarılı analizde `userEmotions` Map'ini güncelle
- [ ] **1.7** Test: `curl -X POST /analyze-emotion` ile zengin obje döndüğünü doğrula

### Faz 2 — Backend: Supabase emotion_logs

- [ ] **2.1** Supabase Dashboard'da `emotion_logs` tablosunu oluştur
- [ ] **2.2** RLS politikalarını uygula
- [ ] **2.3** `/analyze-emotion` içine `emotion_logs` insert fonksiyonu ekle
- [ ] **2.4** `vapi-webhook` handler'ına seans özeti mantığını ekle
- [ ] **2.5** Test: Analiz yap, Supabase'de satırın oluştuğunu doğrula

### Faz 3 — Backend: Kural Motoru

- [ ] **3.1** `buildLayer1Rules(sonAnaliz, aktifSinyaller)` fonksiyonunu yaz
- [ ] **3.2** `buildLayer2Rules(trend, dominantDuygu, gecmis)` fonksiyonunu yaz
- [ ] **3.3** `buildLayer3Rules(hafizaMetni, sonAnaliz)` fonksiyonunu yaz
- [ ] **3.4** `/api/chat/completions` duygu enjeksiyonunu üç katman çıktısını birleştirecek şekilde güncelle
- [ ] **3.5** Test: Farklı duygu kombinasyonlarında sistem mesajının doğru enjeksiyonu aldığını doğrula

### Faz 4 — Frontend: Adaptif Interval

- [ ] **4.1** `getBaseInterval(duygu)` fonksiyonunu yaz
- [ ] **4.2** `consecutiveCount` ve `lastDuygu` değişkenlerini ekle
- [ ] **4.3** `analyzeEmotion()` callback'ini adaptif interval mantığıyla güncelle
- [ ] **4.4** `yuz_var: false` durumunda analiz atlama mantığını implement et
- [ ] **4.5** Test: Sakin durumda 6s, üzgün durumda 2s interval'ı doğrula

### Faz 5 — Frontend: Video Terapi UI

- [ ] **5.1** Mevcut kamera widget HTML + CSS'ini kaldır
- [ ] **5.2** `.therapy-layout` CSS Grid yapısını ekle
- [ ] **5.3** `.panel-lyra` ve `.panel-user` HTML yapısını oluştur
- [ ] **5.4** Three.js sahnesini `.panel-lyra` içine taşı
- [ ] **5.5** `<video id="user-video">` elementini `.panel-user` içine ekle
- [ ] **5.6** `getUserMedia({ video: true, audio: false })` çağrısını implement et
- [ ] **5.7** Hidden `<canvas id="snapshot-canvas">` elementini ekle
- [ ] **5.8** `captureFrame()` fonksiyonunu yeni canvas'a göre güncelle
- [ ] **5.9** Responsive CSS `@media` kurallarını ekle
- [ ] **5.10** Test: İki panel yan yana görünüyor mu, video stream çalışıyor mu?

### Faz 6 — Frontend: Işıltılı Çerçeve

- [ ] **6.1** `@keyframes glow-lyra` ve `@keyframes glow-user` CSS animasyonlarını ekle
- [ ] **6.2** `.panel-lyra.speaking` ve `.panel-user.speaking` CSS sınıflarını ekle
- [ ] **6.3** VAPI `speech-start` / `speech-end` event handler'larına glow sınıfı bağla
- [ ] **6.4** VAPI `volume-level` event handler'ına kullanıcı panel glow mantığını bağla
- [ ] **6.5** Test: Lyra konuşurken mor/mavi glow, kullanıcı konuşurken yeşil/beyaz glow çalışıyor mu?

### Faz 7 — Entegrasyon Testi

- [ ] **7.1** Tam seans simülasyonu: giriş yap, görüşme başlat, farklı duygular sergile
- [ ] **7.2** Supabase `emotion_logs` tablosunda kayıtlar doğru mu?
- [ ] **7.3** Seans sonunda hafıza güncellenmiş mi?
- [ ] **7.4** Kural motoru enjeksiyonu Lyra'nın yanıtlarına yansıyor mu?
- [ ] **7.5** Mobil görünüm: dikey stack layout çalışıyor mu?
- [ ] **7.6** Kamera izni reddedildiğinde hata yönetimi çalışıyor mu?

---

## Ekler

### A. Maliyet Tahmini

Her `/analyze-emotion` çağrısı GPT-4o `detail:low` ile yaklaşık **0.001-0.002 USD** maliyetindedir.
- Sakin seans (çoğunlukla 6s interval), 10 dakika: ~100 çağrı → **~0.15-0.20 USD/seans**
- Kriz durumu (2s interval), 10 dakika: ~300 çağrı → **~0.45-0.60 USD/seans**

### B. Hata Senaryoları

| Senaryo | Davranış |
|---|---|
| GPT-4o Vision parse hatası | `{ duygu: 'sakin', guven: 0, yuz_var: false }` döndür, enjeksiyon yapma |
| Supabase insert hatası | `console.error` yaz, kullanıcıya hata gösterme, akışı kesme |
| `getUserMedia` reddedildi | Kamera panelini gizle, single-panel moduna geç, analiz devre dışı |
| Network timeout | Mevcut interval'i koru, sonraki zamanlayıcıyı planla |

### C. Güvenlik Notları

- `emotion_logs` tablosuna yalnızca `service_key` ile yazılır; frontend doğrudan yazamaz
- `userId` server tarafında `supabase.auth.getUser(token)` ile doğrulanmış olmalıdır
- Kamera frame'leri (base64) hiçbir yerde disk'e kaydedilmez, yalnızca API isteğinde kullanılır
