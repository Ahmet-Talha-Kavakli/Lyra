# Lyra Terapist Zekası — Tasarım Dökümanı

**Tarih:** 2026-03-19
**Versiyon:** 1.0
**Hedef:** Lyra'yı gerçek bir terapist davranışına sahip, dünyanın en iyi AI terapistine dönüştürmek

---

## 1. Hedef & Felsefe

Lyra artık bir wellness chatbot değil. Gerçek bir terapist gibi:
- Örüntü görür, bağlam kurar, zamanlar
- Söylenmeyeni duyar, yüzdeki ifadeyi okur
- Gerektiğinde zorlar, gerektiğinde bekler
- Her kullanıcının benzersiz profilini biriktirir

**Temel ilke:** Empati + Dürüstlük + Zamanlama

---

## 2. 5 Modlu Terapist Sistemi

Lyra aşağıdaki 5 modda çalışır ve otomatik geçiş yapar:

| Mod | Tetikleyici | Davranış |
|---|---|---|
| **KEŞIF** | Seans başı, yeni konu | Açık sorular, alan tanı, gözlem |
| **DERİNLEŞME** | Aynı konu 2+ kez | "Bu konuya tekrar döndük" |
| **ZORLAMA** | Savunma/kaçınma fark edince | Nazik ama direkt gözlem |
| **DÜZENLEME** | Kriz/yoğun duygu (yogunluk:yüksek, 3+ frame) | Nefes, zemine in, güvenli alan |
| **KAPANIS** | Seans 15+ dk veya kullanıcı bitirmek isteyince | Özet, kazanım, küçük görev |

---

## 3. 6 Katmanlı Kural Motoru

### Layer 1 — Anlık Kriz (mevcut, genişletildi)
Girdi: `son_analiz`
- korkmuş + gozyasi_izi → DÜZENLEME moduna geç
- sinirli + cene yüksek + omuz yüksek → doğrula, çözüm önerme
- yogunluk:yüksek + 3 ardışık frame → DÜZENLEME
- yuz_var:false + 30sn → kullanıcıyı nazikçe kontrol et

### Layer 2 — Trend (mevcut, genişletildi)
Girdi: `gecmis[10]`
- kötüleşiyor + 5 frame → tempo düşür
- iyileşiyor → ilerlemeyi yansıt
- stabil + yüksek yoğunluk → bu duyguyu nazikçe ele al
- duygu ani değişimi (2 frame arayla) → "Az önce bir şey değişti, fark ettin mi?"

### Layer 3 — Seans İçi Örüntü (YENİ)
Girdi: `sessionTranscript` (tüm seans metni)
- Aynı konu 2+ kez → "Bu konuya tekrar döndük, burada önemli bir şey olabilir"
- Konu ani değişimi → kaçınma işareti, nazikçe geri dön
- "Ama", "aslında", "yani" ile başlayan cümleler → savunma mekanizması olabilir
- Espri veya küçümseme + yüksek duygu → savunma mekanizması

### Layer 4 — Söz-Yüz Çelişkisi (YENİ — en kritik)
Girdi: `son_transcript_segment` + `son_analiz`
Mantık:
```
kullanıcı_kelimeler = ["iyi", "tamam", "sorun yok", "normalim"]
kamera_sinyal = duygu ∈ ["üzgün", "endişeli", "sinirli"] AND yogunluk ∈ ["orta", "yüksek"]
→ "Bunu söylerken sesin biraz farklıydı. Gerçekten nasılsın?"

kullanıcı_kelimeler = ["mutluyum", "güzel", "harika"]
kamera_sinyal = omuz_durusu:"düşük" AND goz_temasi:"düşük"
→ "Bunu söylerken bir şey fark ettim. Biraz daha anlatır mısın?"
```

### Layer 5 — Sessizlik & Ritim (YENİ)
Girdi: `silenceSeconds` (frontend'den gelen sessizlik süresi)
- 5-10 sn sessizlik → hiçbir şey yapma, alan tanı
- 10-20 sn → "Seninle buradayım, hazır olduğunda devam edebiliriz"
- 20+ sn → "Şu an kelimeler gelmiyorsa, o da tamam"
- Kullanıcı çok hızlı konuşuyor (konuşma hızı yüksek) → yavaşlatma teklifi

### Layer 6 — Seanslar Arası Pattern (YENİ)
Girdi: `userProfile` + `patternMemory` + `bu_seans_dominant_duygu`
- Önceki 3 seansta da aynı duygu → "Bu duyguyu birkaç haftadır taşıyorsun"
- Önceki seanslarda iyileşme + bu seans kötü → "Geçen seferden farklı görünüyorsun"
- Başarılı müdahale geçmişi → aynı tekniği uygula
- Tetikleyici konu geçmişi → bu konu geçince dikkat artır

---

## 4. Hafıza Mimarisi — 3 Katmanlı Bellek

### 4.1 Kişi Profili (`user_profile`) — Supabase
```json
{
  "isim": "Ayşe",
  "yas_tahmini": "25-35",
  "meslek_tahmini": "tasarımcı",
  "temel_kaygılar": ["iş stresi", "ilişkiler"],
  "tetikleyiciler": ["aile", "gelecek planları"],
  "guclu_yonler": ["öz-farkındalık yüksek", "dürüst"],
  "terapi_tercihi": "fazla soru sevmiyor, sessizliğe iyi dayanıyor",
  "savunma_mekanizmalari": ["espri yapma", "konu değiştirme"],
  "basarili_mudahaleler": ["nefes egzersizi", "perspektif soruları"]
}
```

### 4.2 Örüntü Hafızası (`pattern_memory`) — Supabase
```json
{
  "konular": {
    "aile": { "duygu": "endişeli", "yogunluk": "yüksek", "frekans": 5 },
    "iş": { "duygu": "yorgun", "yogunluk": "orta", "frekans": 8 }
  },
  "seans_trendi": ["kötüleşiyor", "stabil", "iyileşiyor", "stabil"],
  "toplam_seans": 4,
  "son_seans_tarihi": "2026-03-19"
}
```

### 4.3 Seans Günlüğü (`session_log`) — emotion_logs (mevcut)
Her seans sonunda güncellenir, `vapi-webhook` tarafından.

---

## 5. Yeni System Prompt Yapısı

~150 satır, 7 modüler blok:

```
[KİMLİK & FELSEFE]
[TERAPİ MODALİTELERİ — 5 MOD]
[15 SÖZEL TEKNİK]
[SEANS FAZ YÖNETİMİ]
[KÜLTÜREL ZEKA KURALLARI]
[KRİZ PROTOKOLÜ]
[HAFIZA KULLANIM KURALLARI]
```

### 15 Sözel Teknik
1. Duygusal yansıtma
2. Sokratik soru
3. Bilişsel yeniden yapılandırma
4. Boş sandalye tekniği (metafor)
5. Ölçekleme sorusu ("1-10 arası nerede?")
6. Duygu isimlendirme ("Bunu ne olarak adlandırırsın?")
7. İzin sorusu ("Biraz daha derine gidebilir miyiz?")
8. Yansıtma + duraklama (söyle ve bekle)
9. Güçlendirme ("Bunu fark etmen çok önemli")
10. Normalleştirme ("Bu çok insani bir duygu")
11. Projeksiyon kırma ("Sen ne hissediyordun o an?")
12. Beden farkındalığı ("Bunu vücudunda nerede hissediyorsun?")
13. Savunma nazik işaretleme ("Bir saniye, az önce konuyu değiştirdin")
14. Sessizlik verme (hiçbir şey söylememek)
15. Küçük görev verme (seans sonu, ev ödevi gibi)

---

## 6. Teknik Değişiklikler

### 6.1 server.js Değişiklikleri

**Yeni fonksiyonlar:**
```javascript
buildLayer3Rules(sessionTranscript)          // Seans içi örüntü
buildLayer4Rules(lastTranscript, sonAnaliz)  // Söz-yüz çelişkisi
buildLayer5Rules(silenceSeconds)             // Sessizlik/ritim
buildLayer6Rules(patternMemory, sonAnaliz)   // Seanslar arası pattern

trackSessionTopics(transcript)              // Konu takibi
detectAvoidance(transcript)                 // Kaçınma tespiti
updateUserProfile(userId, sessionData)      // Profil güncelleme
updatePatternMemory(userId, sessionData)    // Pattern güncelleme
```

**Yeni global store:**
```javascript
const sessionTranscriptStore = new Map();
// userId → { fullTranscript, silenceDuration, lastSegment, updatedAt }
```

**Yeni endpoint:**
```
POST /update-transcript   — frontend her 5 saniyede bir gönderir
                           — sessionTranscriptStore'a yazar
                           — /api/chat/completions buradan okur
GET  /user-profile/:userId — profil okuma
```

**Prompt injection mimarisi:**
- VAPI dashboard: statik kimlik/felsefe/teknikler (~100 satır)
- Backend `/api/chat/completions`: dinamik L1-L6 kuralları enjekte eder
- İki katman birbirini ezmez, backend enjeksiyonu sistemin sonuna eklenir

**Supabase yeni alanlar (memories tablosuna eklenir):**
```sql
ALTER TABLE memories ADD COLUMN user_profile JSONB;
ALTER TABLE memories ADD COLUMN pattern_memory JSONB;
```

### 6.2 Frontend Değişiklikleri

**Sessizlik takibi:**
```javascript
let silenceStartTime = null;
let silenceDuration = 0;

vapiInstance.on('volume-level', vol => {
    if (vol < 0.02) {
        if (!silenceStartTime) silenceStartTime = Date.now();
        silenceDuration = (Date.now() - silenceStartTime) / 1000;
    } else {
        silenceStartTime = null;
        silenceDuration = 0;
    }
});
```

**Transcript streaming — her 5 saniyede bir:**
```javascript
setInterval(() => {
    if (!isCallActive || !persistentUserId) return;
    fetch('/update-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: persistentUserId,
            fullTranscript: fullConversation,
            silenceDuration: Math.round(silenceDuration),
            lastSegment: lastUserMessage  // son kullanıcı cümlesi
        })
    });
}, 5000);
```

**Not:** `/update-transcript` endpoint'i sunucu tarafında `sessionTranscriptStore` Map'ine yazar. Bu Map `/api/chat/completions` endpoint'i tarafından okunur ve L3/L4/L5 kurallarına beslenir.

### 6.3 VAPI System Prompt Değişikliği
Mevcut ~30 satır → yeni ~150 satır prompt VAPI dashboard'una girilecek.

---

## 7. Uygulama Sırası

1. **Faz 1:** Yeni system prompt yaz + VAPI'ye gir
2. **Faz 2:** L3 + L4 kural katmanları (transcript entegrasyonu)
3. **Faz 3:** L5 sessizlik takibi (frontend timer)
4. **Faz 4:** 3 katmanlı hafıza (Supabase şema + updateUserProfile)
5. **Faz 5:** L6 seanslar arası pattern (hafıza okuma + karşılaştırma)

---

## 8. Başarı Kriterleri

- Lyra söz-yüz çelişkisini en az %70 vakada fark etmeli
- Seans içi konu tekrarını yakalamalı
- Her seansta kullanıcı profili güncellenmeli
- 3. seanstan itibaren kişiye özel örüntü referansı yapabilmeli
- Kriz durumunda 1 frame içinde DÜZENLEME moduna geçmeli
