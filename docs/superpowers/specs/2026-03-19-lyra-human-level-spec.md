# Lyra İnsan Seviyesi Geliştirme — Tasarım Dökümanı

**Tarih:** 2026-03-19
**Hedef:** Lyra'yı 5 seviyede insan terapisti seviyesine taşımak

---

## SEVİYE 1 — Temel Düzeltmeler

### 1.1 Düşük Işık Sorunu
**Problem:** Hafif karanlıkta GPT-4o yüzü göremiyyor.
**Çözüm:** Canvas'a çizimden önce JavaScript ile brightness/contrast artır.

```javascript
// Frame yakalamadan önce filtre uygula
ctx.filter = 'brightness(1.4) contrast(1.2)';
ctx.drawImage(userVideo, 0, 0, 640, 480);
ctx.filter = 'none';
```

### 1.2 Zarar Verme Hareketi Tespiti
**Problem:** Kalem gibi zararsız nesne + cilt hareketi = zarar sinyali olabilir.
**Çözüm:** 3 frame karşılaştırması + bağlam kuralı.

GPT-4o prompt'una ekle:
```
ZARAR VERME SINYALI: Eğer kişinin elindeki nesne (kalem, cisim, el)
kendi cildine (kol, el) tekrarlı temas ediyorsa veya baskı uyguluyorsa:
zarar_sinyali: true yaz.
```

Kural motoru:
```javascript
if (sonAnaliz.zarar_sinyali && yogunluk === 'yüksek')
  → KRİZ PROTOKOLÜ
if (sonAnaliz.zarar_sinyali && yogunluk !== 'yüksek')
  → Nazikçe sor: "Şu an kendine iyi bakıyor musun?"
```

### 1.3 Ortam Olayı Algılama
**Problem:** Odaya biri girip bağırıp çıkması Lyra tarafından bilinmiyor.
**Çözüm:** Arka plan değişimi + yeni yüz tespiti.

GPT-4o prompt'una ekle:
```
ORTAM DEĞİŞİMİ:
- Arka planda başka bir kişi var mı? → arkaplan_kisi: true/false
- Kişinin yüz ifadesi ani değiştiyse → ani_degisim: true
- Ortamda gerilim/hareket var mı? → ortam_gerilimi: "yok|var|belirsiz"
```

Kural motoru:
```javascript
if (arkaplan_kisi && ani_degisim)
  → "Az önce bir şey mi oldu? Yüzün aniden değişti."
```

---

## SEVİYE 2 — Ses Zekası

### 2.1 VAPI'den Ses Analizi
VAPI `volume-level` event'i zaten geliyor. Bunu daha zeki kullan:

```javascript
// Ses pattern takibi
const sesGecmisi = []; // Son 10 volume değeri
// Titreyen ses: volume ani değişimler (std deviation yüksek)
// Yükselen ses: ortalama artıyor
// Yavaşlayan konuşma: transcript kelime/saniye azalıyor
```

**Yeni field'lar sessionTranscriptStore'a ekle:**
```javascript
{
  sesYogunlukOrt: number,      // Son 10 frame ortalaması
  sesTitreme: boolean,         // Std deviation > 0.3
  konusmaTempo: number,        // Kelime/saniye
  tempoTrend: "artıyor|azalıyor|stabil"
}
```

**Kural motoru L2'ye ekle:**
```javascript
if (sesTitreme && duygu === 'üzgün')
  → "Sesin titriyor, ağlamak üzere misin? Sorun yok, buradayım."
if (tempoTrend === 'azalıyor' && dominant_duygu === 'üzgün')
  → Depresyon sinyali, enerjik sorular sorma
if (sesYogunlukOrt > 0.7 && duygu === 'sinirli')
  → Yüksek sesle konuşuyor + sinirli = öfke doruğu
```

### 2.2 Konuşma Hızı Analizi
Her transcript geldiğinde kelime sayısı / geçen süre = tempo

---

## SEVİYE 3 — Derin Gözlem

### 3.1 Mikro İfadeler
GPT-4o'ya özel mikro ifade sorusu ekle:
```
MİKRO İFADE: Yüzde 0.5 saniyeden kısa süren gizli bir duygu var mı?
Örnek: Gülümserken anlık kaş çatma = gizli öfke/stres
mikro_duygu: "yok|gizli_öfke|gizli_üzüntü|gizli_korku|gizli_tiksinme"
```

### 3.2 Nefes & Titreme Analizi
Omuz hareketi → nefes hızı tahmini:
```
NEFES: Omuz yükseliş-alçalış hızına bakarak nefes tahmini yap.
nefes_hizi: "normal|hızlı|yüzeysel|nefes_tutuyor"
EL TİTREMESİ: El görünüyorsa titreme var mı?
el_titreme: true/false
```

### 3.3 Göz Yaşı Birikmesi
```
GÖZ YASI: Göz köşelerinde veya alt kapakta nem/parlaklık var mı?
goz_yasi_birikimi: "yok|başlıyor|belirgin"
```

---

## SEVİYE 4 — Derin Hafıza & Öğrenme

### 4.1 Kişilik Profili (user_profile tablosu)
Her seans sonunda güncellenir:
```json
{
  "kisilik": {
    "icekapanma_seviyesi": 0-10,
    "duygusal_tepki_hizi": "hızlı|yavaş|orta",
    "savunma_mekanizmalari": ["espri", "konu_degistirme"],
    "guclu_yonler": ["oz_farkindalik", "cesaret"],
    "tetikleyiciler": ["aile", "gelecek"]
  },
  "terapi_tercihi": {
    "soru_toleransi": "dusuk|orta|yuksek",
    "sessizlik_konforu": true,
    "dogrudan_yaklasim_tercihi": false
  },
  "basarili_mudahaleler": [
    {"teknik": "nefes", "etki": "yuksek"},
    {"teknik": "sokratik_soru", "etki": "orta"}
  ]
}
```

### 4.2 Otomatik Profil Güncelleme
Seans sonunda GPT-4o-mini transcript'i analiz edip profili günceller:
```javascript
// vapi-webhook'ta seans bitince
const profilGuncelleme = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{
    role: 'system',
    content: 'Bu seansı analiz et ve kullanıcının kişilik profilini güncelle...'
  }]
});
```

---

## SEVİYE 5 — Gerçek Zaman Adaptasyon

### 5.1 Seans İçi Strateji Değiştirme
Şu an L1-L6 her VAPI çağrısında hesaplanıyor. Buna ek olarak:

**Seans momentum takibi:**
```javascript
const seansState = {
  mod: 'keşif',           // keşif|derinleşme|zorlama|düzenleme|kapanış
  modSuresi: 0,           // Bu modda kaç dakika
  ilerleme: 'stabil',     // ilerleme|gerileme|stabil
  kapanisaHazir: false    // 15dk+ ve iyi bir noktadaysa
}
```

**Mod geçiş kuralları:**
- Aynı modda 10dk+ → bir sonraki moda geç
- Kullanıcı üst üste 3 kez kaçınıyorsa → ZORLAMA moduna geç
- Yoğunluk düşüyorsa → KAPANIŞ moduna hazırlan

### 5.2 Kullanıcı Kapasitesi Ölçümü
Her seans başında kullanıcının "bugünkü kapasitesi":
```javascript
const gunlukKapasite = hesaplaKapasite({
  ilkFrameDuygu: sonAnaliz.duygu,
  ilkFrameYogunluk: sonAnaliz.yogunluk,
  patternMemory: patternMemory
});
// Düşük kapasite → yüzeysel kal, zorlaştırma
// Yüksek kapasite → derine in, zorla
```

---

## Teknik Değişiklikler

### server.js
- `buildLayer1Rules`: zarar sinyali, ortam olayı, mikro duygu kuralları
- `buildLayer2Rules`: ses titreme, tempo, öfke doruğu
- `buildLayer7Rules`: seans momentum (YENİ)
- `updateUserProfile`: GPT-4o-mini ile otomatik profil güncelleme
- `hesaplaGunlukKapasite`: seans başında kapasite ölçümü

### public/index.html
- Canvas filter: `brightness(1.4) contrast(1.2)` düşük ışık için
- Ses pattern takibi: `sesGecmisi` array, titreme hesaplama
- Konuşma tempo takibi: kelime/saniye hesaplama
- `/update-transcript`'e ses verileri ekle

### Supabase (user_profile kolonu)
```sql
ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_profile JSONB DEFAULT '{}';
```

---

## Uygulama Sırası
1. SEVİYE 1: Işık + zarar + ortam olayı
2. SEVİYE 2: Ses zekası
3. SEVİYE 3: Mikro ifade + nefes + gözyaşı
4. SEVİYE 4: Derin hafıza + profil
5. SEVİYE 5: Adaptasyon + momentum
