# Lyra Terapist Zekası — İmplementasyon Planı

## Header
- **Hedef:** Lyra'yı 6 katmanlı kural motoru, 3 katmanlı hafıza ve gerçek terapist davranışıyla dünyanın en iyi AI terapistine dönüştürmek
- **Spec:** `docs/superpowers/specs/2026-03-19-lyra-therapist-intelligence-design.md`
- **Branch:** `feature/therapist-intelligence`
- **Stack:** Node.js/Express (ES modules), OpenAI GPT-4o, Supabase, VAPI Custom LLM

## Dosya Yapısı

| Dosya | Değişim | Sorumluluk |
|---|---|---|
| `server.js` | GÜNCELLE | L3-L6 kuralları, /update-transcript, sessionTranscriptStore, 3 katmanlı hafıza |
| `public/index.html` | GÜNCELLE | Sessizlik timer, transcript streaming, lastUserMessage takibi |
| `docs/vapi-system-prompt.md` | YENİ | Yeni ~100 satır VAPI system prompt (kopyala-yapıştır için) |

---

## FAZ 1: Branch & Altyapı Hazırlığı

### Görev 1.1 — Git worktree oluştur
```bash
git checkout main
git pull origin main
git checkout -b feature/therapist-intelligence
```
Beklenen: `Switched to a new branch 'feature/therapist-intelligence'`

### Görev 1.2 — Supabase şema güncellemesi
Supabase Dashboard → SQL Editor'de çalıştır:
```sql
ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_profile JSONB DEFAULT '{}';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS pattern_memory JSONB DEFAULT '{}';
```
Beklenen: `ALTER TABLE` başarılı, hata yok.

---

## FAZ 2: server.js — Transcript Store & Yeni Endpoint

### Görev 2.1 — sessionTranscriptStore ekle
`server.js` içinde `const userEmotions = new Map();` satırının hemen altına:
```javascript
// --- SEANS TRANSCRIPT STORE ---
const sessionTranscriptStore = new Map();
// userId → { fullTranscript, silenceDuration, lastSegment, updatedAt }
```

### Görev 2.2 — /update-transcript endpoint ekle
`server.js` içinde `/analyze-emotion` endpoint'inin hemen üstüne:
```javascript
// ─── TRANSCRIPT GÜNCELLEME ────────────────────────────────
app.post('/update-transcript', (req, res) => {
    const { userId, fullTranscript, silenceDuration, lastSegment } = req.body;
    if (!userId) return res.sendStatus(400);
    sessionTranscriptStore.set(userId, {
        fullTranscript: fullTranscript || '',
        silenceDuration: silenceDuration || 0,
        lastSegment: lastSegment || '',
        updatedAt: Date.now()
    });
    res.sendStatus(200);
});
```

### Görev 2.3 — Doğrulama
```bash
node server.js &
curl -X POST http://localhost:3001/update-transcript \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","fullTranscript":"merhaba","silenceDuration":0,"lastSegment":"merhaba"}'
```
Beklenen: `200 OK`

### Görev 2.4 — Commit
```bash
git add server.js
git commit -m "feat: sessionTranscriptStore ve /update-transcript endpoint"
```

---

## FAZ 3: server.js — L3 Seans İçi Örüntü

### Görev 3.1 — trackSessionTopics fonksiyonu ekle
`server.js` içinde `getDominantDuygu` fonksiyonunun altına:
```javascript
const KONU_GRUPLARI = {
    'aile': ['anne', 'baba', 'kardeş', 'aile', 'ebeveyn', 'çocuk'],
    'iş': ['iş', 'patron', 'çalışma', 'işyeri', 'kariyer', 'meslek', 'müdür'],
    'ilişki': ['sevgili', 'eş', 'partner', 'ilişki', 'ayrılık', 'yalnız'],
    'gelecek': ['gelecek', 'plan', 'kaygı', 'endişe', 'belirsiz', 'ne olacak'],
    'geçmiş': ['geçmiş', 'eskiden', 'çocukken', 'hatıra', 'travma'],
    'beden': ['uyku', 'yeme', 'ağrı', 'yorgunluk', 'hastalık', 'beden'],
};

const trackSessionTopics = (transcript) => {
    if (!transcript) return {};
    const lower = transcript.toLowerCase();
    const counts = {};
    for (const [konu, kelimeler] of Object.entries(KONU_GRUPLARI)) {
        counts[konu] = kelimeler.filter(k => lower.includes(k)).length;
    }
    return counts;
};

const detectAvoidance = (transcript) => {
    if (!transcript) return [];
    const lower = transcript.toLowerCase();
    const sinyaller = [];
    // Konu değiştirme sinyalleri
    const konuDegistirme = ['neyse', 'geçelim', 'başka bir şey', 'farklı bir konu', 'bırakalım'];
    if (konuDegistirme.some(k => lower.includes(k))) sinyaller.push('konu_degistirme');
    // Küçümseme sinyalleri
    const kucumseme = ['önemli değil', 'abartmıyorum', 'saçma', 'gülünç', 'ne fark eder'];
    if (kucumseme.some(k => lower.includes(k))) sinyaller.push('kucumseme');
    // Savunma sinyalleri
    const savunma = ['ama şu var ki', 'aslında', 'yani şey', 'anlayamazsın'];
    if (savunma.some(k => lower.includes(k))) sinyaller.push('savunma');
    return sinyaller;
};
```

### Görev 3.2 — buildLayer3Rules güncelle (seans içi örüntü)
Mevcut `buildLayer3Rules` fonksiyonunu tamamen değiştir:
```javascript
const buildLayer3Rules = (hafizaMetni, sonAnaliz, userId) => {
    const kurallar = [];

    // Eski: hafıza bazlı kurallar (koru)
    if (hafizaMetni) {
        const lower = hafizaMetni.toLowerCase();
        if ((lower.includes('üzgün') || lower.includes('uzgun')) &&
            (lower.includes('seans') || lower.includes('hafta') || lower.includes('süre')))
            kurallar.push('Hafızaya göre kullanıcı bir süredir üzgün. Bu tekrarlayan durumu nazikçe gündeme getirmeyi düşün.');
        if (lower.includes('iyileş') || lower.includes('daha iyi') || lower.includes('güzel geçt'))
            kurallar.push('Önceki seanslarda iyileşme kaydedilmiş. Bu ilerlemeyi fark et ve kutla.');
        if (sonAnaliz?.yogunluk === 'yüksek' && sonAnaliz?.guven > 80 &&
            !lower.includes('yoğun') && !lower.includes('kriz'))
            kurallar.push('Bu seansta ilk kez yüksek yoğunluk görülüyor. Daha dikkatli yaklaş, acele etme.');
    }

    // YENİ: seans içi örüntü
    const transcriptData = userId ? sessionTranscriptStore.get(userId) : null;
    if (transcriptData?.fullTranscript) {
        const konular = trackSessionTopics(transcriptData.fullTranscript);
        const tekrarlayan = Object.entries(konular).filter(([, v]) => v >= 2).map(([k]) => k);
        if (tekrarlayan.length > 0)
            kurallar.push(`Bu seansta "${tekrarlayan.join(', ')}" konusuna defalarca döndünüz. Bu alanda önemli bir şey olabilir, nazikçe derinleş.`);

        const kacınma = detectAvoidance(transcriptData.fullTranscript);
        if (kacınma.includes('konu_degistirme'))
            kurallar.push('Kullanıcı az önce konuyu değiştirdi. Nazikçe önceki konuya geri dön: "Az önce farklı bir şeyden bahsediyorduk, oraya dönebilir miyiz?"');
        if (kacınma.includes('kucumseme'))
            kurallar.push('Kullanıcı yaşadığını küçümsüyor. Bu bir savunma mekanizması olabilir. Nazikçe önem ver: "Bunu küçümsüyor olsan da, anlatman önemli."');
        if (kacınma.includes('savunma'))
            kurallar.push('Kullanıcı savunmaya geçti. Baskı yapma, güvenli alan yarat, yavaşla.');
    }

    return kurallar.join(' ');
};
```

**Dikkat:** `buildLayer3Rules` çağrısı `/api/chat/completions` içinde — `userId` parametresini de geçirmek gerekiyor.

### Görev 3.3 — /api/chat/completions içindeki buildLayer3Rules çağrısını güncelle
Şu satırı:
```javascript
const l3 = buildLayer3Rules(userMemory, son_analiz);
```
Şuna değiştir:
```javascript
const l3 = buildLayer3Rules(userMemory, son_analiz, userId);
```

### Görev 3.4 — Commit
```bash
git add server.js
git commit -m "feat: L3 seans içi örüntü, konu takibi ve kaçınma tespiti"
```

---

## FAZ 4: server.js — L4 Söz-Yüz Çelişkisi

### Görev 4.1 — buildLayer4Rules ekle
`buildLayer3Rules` fonksiyonunun altına:
```javascript
const OLUMLU_KELIMELER = ['iyiyim', 'iyi', 'tamam', 'sorun yok', 'normalim', '괜찮아', 'mutluyum', 'güzel', 'harika', 'fena değil'];
const OLUMSUZ_KAMERA = ['üzgün', 'endişeli', 'korkmuş', 'sinirli', 'yorgun'];

const buildLayer4Rules = (lastSegment, sonAnaliz) => {
    if (!lastSegment || !sonAnaliz || !sonAnaliz.yuz_var) return '';
    const kurallar = [];
    const segLower = lastSegment.toLowerCase();

    // Çelişki 1: "iyiyim" ama yüz olumsuz
    const sozluOlumlu = OLUMLU_KELIMELER.some(k => segLower.includes(k));
    const kameraOlumsuz = OLUMSUZ_KAMERA.includes(sonAnaliz.duygu) &&
        ['orta', 'yüksek'].includes(sonAnaliz.yogunluk);
    if (sozluOlumlu && kameraOlumsuz && sonAnaliz.guven > 65)
        kurallar.push(`Kullanıcı "${sonAnaliz.duygu}" görünüyor ama olumlu kelimeler söylüyor. Nazikçe sorgula: "Bunu söylerken sesin biraz farklıydı, gerçekten nasılsın?"`);

    // Çelişki 2: Kapalı beden dili + olumlu söylem
    if (sozluOlumlu && sonAnaliz.genel_vucut_dili === 'kapalı' && sonAnaliz.jestler?.goz_temasi === 'düşük')
        kurallar.push('Kullanıcı olumlu konuşuyor ama beden dili kapalı ve göz teması düşük. "Biraz daha anlatır mısın bunu?" diye sor.');

    // Çelişki 3: Yüksek duygu + küçümseyici söylem
    if (sonAnaliz.yogunluk === 'yüksek' && (segLower.includes('önemli değil') || segLower.includes('saçma')))
        kurallar.push('Kullanıcı yüksek duygusal yoğunlukta ama durumu önemsiz gösteriyor. "Bunu önemsiz görüyor olsan da, bu duygu gerçek ve önemli" diyebilirsin.');

    return kurallar.join(' ');
};
```

### Görev 4.2 — /api/chat/completions içine L4 ekle
`buildLayer3Rules` çağrısının altına:
```javascript
const transcriptState = sessionTranscriptStore.get(userId);
const l4 = buildLayer4Rules(transcriptState?.lastSegment, son_analiz);
```

Ve `tumKurallar` satırını güncelle:
```javascript
const tumKurallar = [l1, l2, l3, l4].filter(Boolean).join(' ');
```

### Görev 4.3 — Commit
```bash
git add server.js
git commit -m "feat: L4 söz-yüz çelişkisi tespiti"
```

---

## FAZ 5: server.js — L5 Sessizlik & L6 Seanslar Arası

### Görev 5.1 — buildLayer5Rules ekle
`buildLayer4Rules` fonksiyonunun altına:
```javascript
const buildLayer5Rules = (silenceDuration) => {
    if (!silenceDuration || silenceDuration < 5) return '';
    if (silenceDuration >= 5 && silenceDuration < 10)
        return ''; // 5-10sn: hiçbir şey yapma, alan tanı
    if (silenceDuration >= 10 && silenceDuration < 20)
        return 'Kullanıcı uzun süredir sessiz. "Seninle buradayım, hazır olduğunda devam edebiliriz" de.';
    if (silenceDuration >= 20)
        return 'Kullanıcı çok uzun süredir sessiz. "Şu an kelimeler gelmiyorsa, o da tamam. Sessizlik de bir cevap." de.';
    return '';
};
```

### Görev 5.2 — buildLayer6Rules ekle (seanslar arası)
```javascript
const buildLayer6Rules = (patternMemory, sonAnaliz, dominantDuygu) => {
    if (!patternMemory || !sonAnaliz) return '';
    const kurallar = [];

    // Önceki seans trendi
    const trendi = patternMemory.seans_trendi || [];
    if (trendi.length >= 3) {
        const son3 = trendi.slice(-3);
        if (son3.every(t => t === 'kötüleşiyor'))
            kurallar.push('Kullanıcı son 3 seanstır kötüleşiyor. Bu trendi nazikçe paylaş: "Birkaç süredir zor bir dönemdesin, fark ediyor musun?"');
        if (son3[son3.length-1] === 'iyileşiyor' && son3[0] === 'kötüleşiyor')
            kurallar.push('Kullanıcı kötü bir dönemden iyileşmeye başlıyor. Bu ilerlemeyi kutla.');
    }

    // Tekrarlayan duygu
    if (patternMemory.konular && dominantDuygu) {
        const dominantKonu = Object.entries(patternMemory.konular || {})
            .sort(([,a],[,b]) => b.frekans - a.frekans)[0];
        if (dominantKonu && dominantKonu[1].frekans >= 3)
            kurallar.push(`Kullanıcı daha önce de "${dominantKonu[0]}" konusunu sık konuşmuş. Bu konuya duyarlı yaklaş.`);
    }

    // Başarılı müdahale geçmişi
    const basarili = patternMemory.basarili_mudahaleler || [];
    if (basarili.includes('nefes') && sonAnaliz.yogunluk === 'yüksek')
        kurallar.push('Geçmişte nefes egzersizi bu kullanıcıya yaramış. Yüksek yoğunlukta nefes tekniği öner.');

    return kurallar.join(' ');
};
```

### Görev 5.3 — /api/chat/completions içine L5 ve L6 ekle
`l4` tanımının altına:
```javascript
const l5 = buildLayer5Rules(transcriptState?.silenceDuration);

// Pattern memory oku
const { data: memRow } = await supabase
    .from('memories')
    .select('pattern_memory')
    .eq('user_id', userId)
    .single()
    .catch(() => ({ data: null }));
const patternMemory = memRow?.pattern_memory || {};
const l6 = buildLayer6Rules(patternMemory, son_analiz, dominant_duygu);
```

`tumKurallar` satırını güncelle:
```javascript
const tumKurallar = [l1, l2, l3, l4, l5, l6].filter(Boolean).join(' ');
```

### Görev 5.4 — updatePatternMemory fonksiyonu ekle
`saveMemory` fonksiyonunun altına:
```javascript
const updatePatternMemory = async (userId, sessionData) => {
    if (!userId) return;
    try {
        const { data } = await supabase
            .from('memories')
            .select('pattern_memory')
            .eq('user_id', userId)
            .single();

        const existing = data?.pattern_memory || {
            konular: {}, seans_trendi: [], toplam_seans: 0,
            basarili_mudahaleler: [], son_seans_tarihi: null
        };

        // Seans trendi güncelle
        existing.seans_trendi = [...(existing.seans_trendi || []), sessionData.trend].slice(-10);
        existing.toplam_seans = (existing.toplam_seans || 0) + 1;
        existing.son_seans_tarihi = new Date().toISOString();

        // Konu frekansları güncelle
        for (const [konu, sayi] of Object.entries(sessionData.konular || {})) {
            if (sayi > 0) {
                if (!existing.konular[konu]) existing.konular[konu] = { frekans: 0, duygu: sessionData.dominantDuygu };
                existing.konular[konu].frekans += sayi;
                existing.konular[konu].duygu = sessionData.dominantDuygu;
            }
        }

        await supabase.from('memories').upsert({
            user_id: userId,
            pattern_memory: existing,
            updated_at: new Date().toISOString()
        });
    } catch (e) { console.error('[PATTERN] Güncelleme hatası:', e.message); }
};
```

### Görev 5.5 — vapi-webhook'ta updatePatternMemory çağır
`/vapi-webhook` içinde `saveMemory(userId, summary)` satırının altına:
```javascript
// Pattern memory güncelle
const transcriptDataForPattern = sessionTranscriptStore.get(userId);
if (transcriptDataForPattern) {
    const konular = trackSessionTopics(transcriptDataForPattern.fullTranscript);
    const emotionState = userEmotions.get(userId);
    await updatePatternMemory(userId, {
        trend: emotionState?.trend || 'stabil',
        konular,
        dominantDuygu: emotionState?.dominant_duygu || 'sakin'
    });
    sessionTranscriptStore.delete(userId); // Seans bitti, temizle
}
```

### Görev 5.6 — Commit
```bash
git add server.js
git commit -m "feat: L5 sessizlik, L6 seanslar arası pattern, updatePatternMemory"
```

---

## FAZ 6: Frontend — Transcript Streaming & Sessizlik Timer

### Görev 6.1 — Sessizlik timer değişkenlerini ekle
`public/index.html` içinde `let emotionTimer = null;` satırının altına:
```javascript
// Sessizlik takibi
let silenceStartTime = null;
let silenceDuration = 0;
let lastUserMessage = '';
let transcriptStreamInterval = null;
```

### Görev 6.2 — volume-level event'ini güncelle
Mevcut `vapiInstance.on('volume-level', ...)` bloğunu:
```javascript
vapiInstance.on('volume-level', vol => {
    targetVolume = vol;
    if (panelUserEl) {
        if (vol > 0.05) {
            panelUserEl.classList.add('speaking');
            silenceStartTime = null;
            silenceDuration = 0;
        } else {
            panelUserEl.classList.remove('speaking');
            if (!silenceStartTime) silenceStartTime = Date.now();
            silenceDuration = (Date.now() - silenceStartTime) / 1000;
        }
    }
});
```

### Görev 6.3 — Transcript mesajında lastUserMessage güncelle
`vapiInstance.on('message', ...)` içinde `fullConversation +=` satırının altına:
```javascript
if (message.role === 'user') {
    lastUserMessage = message.transcript;
}
```

### Görev 6.4 — Transcript streaming interval'i ekle
`vapiInstance.on('call-start', ...)` bloğu içinde `setCamera('close', 1800);` satırının altına:
```javascript
transcriptStreamInterval = setInterval(() => {
    if (!persistentUserId || !isCallActive) return;
    fetch('/update-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: persistentUserId,
            fullTranscript: fullConversation,
            silenceDuration: Math.round(silenceDuration),
            lastSegment: lastUserMessage
        })
    }).catch(() => {});
}, 5000);
```

### Görev 6.5 — call-end'de interval temizle
`vapiInstance.on('call-end', ...)` bloğunda `setCamera('normal', 2000);` satırının altına:
```javascript
clearInterval(transcriptStreamInterval);
transcriptStreamInterval = null;
silenceStartTime = null;
silenceDuration = 0;
lastUserMessage = '';
```

### Görev 6.6 — Doğrulama
1. Uygulamayı aç, kamera başlat, görüşmeyi başlat
2. Konuş, 15 saniye sessiz kal
3. Konsolda: `[KURAL MOTORU]` log'unda L5 kuralı görünmeli
4. Network tab'da her 5sn'de `/update-transcript` isteği görünmeli

### Görev 6.7 — Commit
```bash
git add public/index.html
git commit -m "feat: frontend sessizlik timer ve transcript streaming"
```

---

## FAZ 7: Yeni System Prompt — VAPI Dashboard

### Görev 7.1 — System prompt dosyasını oluştur
`docs/vapi-system-prompt.md` dosyasını oluştur ve içeriğini VAPI dashboard'una kopyala:

```
# KİMLİK & FELSEFE

Sen Lyra'sın. Psikoloji, nörobilim ve insan davranışı konusunda derin uzmanlığa sahip bir AI terapistsin. CBT, ACT, DBT, psikanalitik terapi ve travma-odaklı yaklaşımları bilen ve duruma göre kullanan bir uzman olarak hareket edersin.

Temel ilken: Empati + Dürüstlük + Zamanlama. Sadece iyi hissettirmezsin — gerçekten iyileşmeye yardım edersin.

# TERAPİ MODLARI

Her an 5 moddan birinde çalışırsın ve otomatik geçiş yaparsın:

KEŞIF MODU (varsayılan başlangıç): Açık sorular, alan tanı, gözlem.
DERİNLEŞME MODU (aynı konu 2+ kez): "Bu konuya tekrar döndük, burada önemli bir şey var gibi."
ZORLAMA MODU (kaçınma fark edince): Nazik ama direkt — söylenmeyeni söyle.
DÜZENLEME MODU (kriz/yüksek yoğunluk): Nefes, zemine in, güvenli alan kur.
KAPANIS MODU (seans sonu): Özet, kazanım, küçük bir görev ver.

# 15 SÖZEL TEKNİK

Aşağıdaki teknikleri duruma göre kullan:

1. Duygusal yansıtma: "Şu an çok bunalmış hissediyorsun gibi görünüyor."
2. Sokratik soru: "Bu durumun senin için en zorlayıcı kısmı neydi?"
3. Bilişsel yeniden yapılandırma: Olumsuz düşünceyi yapıcı perspektife çek.
4. Ölçekleme sorusu: "1'den 10'a kadar değerlendirirsen, şu an neredesin?"
5. Duygu isimlendirme: "Bunu ne olarak adlandırırsın?"
6. İzin sorusu: "Biraz daha derine gidebilir miyiz?"
7. Yansıtma + duraklama: Söyle ve bekle. Doldurmalarına izin ver.
8. Güçlendirme: "Bunu fark etmen çok önemli."
9. Normalleştirme: "Bu çok insani bir duygu, yalnız değilsin."
10. Projeksiyon kırma: "Arkadaşın diyorsun — peki sen ne hissediyordun o an?"
11. Beden farkındalığı: "Bunu vücudunda nerede hissediyorsun?"
12. Savunma nazik işaretleme: "Bir saniye — az önce konuyu değiştirdin, fark ettin mi?"
13. Sessizlik verme: Bazen en güçlü müdahale hiçbir şey söylememektir.
14. Küçük görev: "Bu hafta şunu dene: her sabah 3 şükran yaz."
15. 4-7-8 nefes: Yüksek kaygıda uygulat.

# SEANS FAZ YÖNETİMİ

Açılış: "Merhaba [isim varsa], bugün seni buraya getiren şey nedir?" ile başla.
Keşif: İlk 5 dakika geniş tut, yönlendirme yapma.
Derinleşme: Tekrarlayan konuları gör, bağlantı kur.
Kapanış: "Bugün önemli bir şeye dokunduk. Seninle paylaşmak istediğim bir şey var..." ile bitir.

# SÖYLEM KURALLARI

- Cümleler kısa: maksimum 20 kelime.
- Asla madde işareti veya formatlama kullanma — konuşma dili.
- İsmi abartılı kullanma — gerçek terapistler her cümlede isim söylemez.
- "Anlıyorum", "Hmm", "Devam et" gibi aktif dinleme ifadeleri kullan.
- Tavsiye vermeden önce sor — "Öneri vermemi ister misin?" diye sor.
- Sessizliği doldurma. 10 saniyeye kadar bekleyebilirsin.

# KÜLTÜREL ZEKA

- Türkçe konuşuluyorsa: aile bağları ve toplumsal baskı konularına hassas ol.
- Utanç ve onur kavramlarını kültürel bağlamda değerlendir.
- "Profesyonel yardım al" derken damgalamadan kaçın.
- Her kültürde farklı duygu ifadesi normları olduğunu bil.

# KRİZ PROTOKOLÜ

Eğer kullanıcı kendine veya başkasına zarar vermekten bahsederse:
"Şu an çok zorlandığını duyuyorum. Bu, profesyonel bir destek gerektiriyor. Lütfen şu an bir yakınınızı ara veya acil yardım hattını ara. Seninle buradayım ama senin güvenliğin önce geliyor."

# HAFIZA KULLANIM KURALLARI

Hafızayı doğal kullan — asla "Seni hatırlıyorum" veya "Kayıtlarıma göre" deme.
Bunun yerine: "Geçen konuşmamızda..." veya "Bana daha önce bundan bahsetmiştin..."
Hafızada olmayan şeyleri uydurma.

Kullanıcı Hafızası: {{memory}}
```

### Görev 7.2 — VAPI Dashboard'a gir
1. dashboard.vapi.ai → Assistants → Lyra
2. System Prompt alanını temizle
3. `docs/vapi-system-prompt.md` içeriğini yapıştır
4. Kaydet

### Görev 7.3 — Commit (dosya olarak)
```bash
git add docs/vapi-system-prompt.md
git commit -m "feat: yeni 150 satır terapist system prompt"
```

---

## FAZ 8: Test & Push

### Görev 8.1 — Entegrasyon testi
1. Server başlat: `node server.js`
2. `http://localhost:3001` aç, giriş yap
3. Kamerayı aç, görüşmeyi başlat
4. Aşağıdaki senaryoları test et:

| Senaryo | Beklenen |
|---|---|
| "İyiyim" de ama üzgün bak | L4: Lyra çelişkiyi fark etsin |
| Aile konusunu 3 kez tekrarla | L3: "Bu konuya tekrar döndük" |
| 15 saniye sessiz kal | L5: "Seninle buradayım" |
| Sinirli yüz ifadesi | L1: Düzenleme modu |

5. Her senaryoda server log'larında `[KURAL MOTORU]` satırını kontrol et.

### Görev 8.2 — GitHub'a push
```bash
git push origin feature/therapist-intelligence
```

---

## Notlar

- Supabase `emotion_logs` tablosu mevcut, değişiklik yok
- `user_profile` JSONB kolonu bu planda kullanılmıyor (gelecek faz için hazır)
- VAPI `{{memory}}` değişkeni memories tablosundan otomatik çekiliyor (mevcut mekanizma korunuyor)
- L1 ve L2 kuralları değiştirilmiyor, sadece L3 güncelleniyor
