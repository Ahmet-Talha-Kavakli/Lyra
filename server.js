
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import multer from 'multer';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// ─── ROOT (Basit Hoşgeldin) ─────────────────────────
app.get('/', (req, res) => {
    res.send('<h1>Lyra Brain is Running 🌌</h1><p>Visit <a href="/ping">/ping</a> to check status.</p>');
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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

// ─── RAG: BILGI BANKASI — INSIGHT ÇIKARIMI ──────────────────────────
const extractKnowledge = async (transcript, emotion, duygu) => {
    if (!transcript || transcript.length < 50) return [];

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: `Aşağıdaki terapi konuşmasından önemli "therapy insights" çıkar.
JSON formatında 0-3 insight döndür.

Insight tipleri:
- breakthrough: "X ile Y arasında bağlantı buldum"
- strategy: "X stratejisi bana yardım ediyor"
- pattern: "Her zaman X olunca Y oluyor"
- value: "Benim için X en önemli"
- achievement: "X'i yaptım, kendimi iyi hissettim"

Konuşma:
"${transcript.substring(0, 500)}"

JSON Array döndür (boş array olabilir):
[
  {
    "type": "breakthrough" | "strategy" | "pattern" | "value" | "achievement",
    "title": "Başlık (10-15 kelime)",
    "content": "İçerik (1-2 cümle)",
    "tags": ["tag1", "tag2"]
  }
]`
            }],
            temperature: 0.7,
            max_tokens: 400
        });

        let insights = [];
        try {
            const text = response.choices[0].message.content || '[]';
            // JSON extract
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                insights = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.warn('[RAG] JSON parse hatası:', e.message);
        }

        // Her insight'a emotion ve relevance ekle
        insights = insights.map(i => ({
            ...i,
            emotion_context: duygu,
            relevance_score: 0.75 + (Math.random() * 0.2) // 0.75-0.95
        }));

        console.log(`[RAG] ${insights.length} insight çıkarıldı`);
        return insights;
    } catch (err) {
        console.error('[RAG] Extraction hata:', err.message);
        return [];
    }
};

// ─── HIPOTEZ MOTORU (Davranış Tahmini) ──────────────────────────────
const buildHypothesis = (userId, currentTopic, currentDuygu, patternMemory, gecmis) => {
    if (!patternMemory || !currentTopic) {
        return {
            predicted_emotion: currentDuygu,
            confidence: 0.3,
            probable_trigger: 'veri yetersiz',
            suggested_intervention: 'gözlemle ve duygu analizi yap',
            intervention_timing: 'devam_et',
            reasoning: 'Yeterli geçmiş verisi yok, pattern öğrenilemiyor'
        };
    }

    const tetKonular = patternMemory.tetikleyici_konular || {};
    const konuData = tetKonular[currentTopic] || {};
    const konuDuygular = konuData.duygu || [];
    const hit = konuData.hit || 0;

    // 1. KONU → DUYGU PREDICTION
    let predictedEmotion = currentDuygu;
    let confidence = 0.4;

    if (konuDuygular.length > 0) {
        // En sık duygu nedir?
        const duyguFreq = {};
        konuDuygular.forEach(d => { duyguFreq[d] = (duyguFreq[d] || 0) + 1; });
        const siralanmis = Object.entries(duyguFreq).sort(([,a],[,b]) => b - a);
        predictedEmotion = siralanmis[0][0];
        confidence = (siralanmis[0][1] / konuDuygular.length) * 0.95; // max 0.95
    }

    // 2. TREND ANALİZİ
    const trendi = patternMemory.seans_trendi || [];
    let riskSkoru = 0;
    let trendYonu = 'stabil';

    if (trendi.length >= 3) {
        const son3 = trendi.slice(-3);
        if (son3.every(t => t === 'kötüleşiyor')) {
            riskSkoru = 0.8;
            trendYonu = 'kötüleşiyor';
        } else if (son3[son3.length - 1] === 'kötüleşiyor') {
            riskSkoru = 0.6;
            trendYonu = 'kötüleşiyor';
        } else if (son3.every(t => t === 'iyileşiyor')) {
            riskSkoru = 0.1;
            trendYonu = 'iyileşiyor';
        }
    }

    // 3. DÖNGÜ TESPITI (Aynı konu aynı duyguya yol açıyor mu?)
    let isLoop = false;
    let loopStrength = 0;
    if (hit >= 3 && predictedEmotion === gecmis?.[gecmis.length - 1]?.duygu) {
        isLoop = true;
        loopStrength = Math.min(hit / 5, 1); // 0-1
        riskSkoru = Math.max(riskSkoru, 0.5 + loopStrength * 0.3);
    }

    // 4. YOĞUNLUK DEĞİŞİMİ
    const sonYogunluk = yogunlukToNum(currentDuygu === 'şaşkın' ? 'orta' :
                                       ['yüksek', 'öfkeli', 'panikleme'].includes(currentDuygu) ? 'yüksek' : 'orta');
    const ortalamaYogunluk = gecmis?.length > 0
        ? gecmis.map(a => yogunlukToNum(a.yogunluk)).reduce((s,v) => s+v, 0) / gecmis.length
        : 60;

    if (sonYogunluk > ortalamaYogunluk + 20) {
        riskSkoru = Math.max(riskSkoru, 0.7);
    }

    // 5. MÜDAHALe STRATEJİSİ SEÇIMI
    let suggestedIntervention = 'gözlemle';
    let interventionTiming = 'devam_et';

    if (riskSkoru >= 0.7) {
        // Yüksek risk: hemen müdahale
        if (['endişeli', 'korkmuş', 'panik'].includes(predictedEmotion)) {
            suggestedIntervention = 'nefes_egzersizi_4_7_8';
            interventionTiming = 'şimdi';
        } else if (['öfkeli', 'sinirli'].includes(predictedEmotion)) {
            suggestedIntervention = 'kontrol_analizi';
            interventionTiming = 'şimdi';
        } else if (predictedEmotion === 'üzgün') {
            suggestedIntervention = 'vizualizasyon';
            interventionTiming = 'şimdi';
        }
    } else if (riskSkoru >= 0.5) {
        // Orta risk: 2-3 cümle sonra müdahale
        if (isLoop) {
            suggestedIntervention = 'döngü_kır_farklı_soru';
            interventionTiming = '2_3_cumle';
        } else {
            suggestedIntervention = 'empati_ve_doğrulama';
            interventionTiming = 'devam_et';
        }
    }

    // 6. AÇIKLAMA OLUŞTUR
    let reasoning = `Konu "${currentTopic}" → duygu "${predictedEmotion}" (${Math.round(confidence*100)}% emin)`;
    if (hit >= 2) {
        reasoning += `. Geçmiş ${hit} seansda bu konuda aynı duygular görüldü.`;
    }
    if (trendYonu === 'kötüleşiyor') {
        reasoning += ` Trend kötüleşiyor, risk yüksek.`;
    }
    if (isLoop) {
        reasoning += ` Döngü tespit: aynı konu aynı duyguya yol açıyor.`;
    }

    return {
        predicted_emotion: predictedEmotion,
        confidence: Math.round(confidence * 100) / 100,
        probable_trigger: currentTopic,
        risk_score: Math.round(riskSkoru * 100) / 100,
        is_loop: isLoop,
        trend: trendYonu,
        suggested_intervention: suggestedIntervention,
        intervention_timing: interventionTiming,
        reasoning: reasoning
    };
};

const getAktifSinyaller = (jestler) => {
    if (!jestler) return [];
    const sinyaller = [];
    if (jestler.kas_catma === true)           sinyaller.push('kas_catma');
    if (jestler.gozyasi_izi === true)         sinyaller.push('gozyasi_izi');
    if (jestler.dudak_sikistirma === true)    sinyaller.push('dudak_sikistirma');
    if (jestler.bas_egme === true)            sinyaller.push('bas_egme');
    if (jestler.goz_temasi === 'düşük')       sinyaller.push('goz_temasi:düşük');
    if (jestler.omuz_durusu === 'düşük')      sinyaller.push('omuz_durusu:düşük');
    if (jestler.cene_gerginligi === 'yüksek') sinyaller.push('cene_gerginligi:yüksek');
    if (jestler.goz_kirpma_hizi === 'yavaş')  sinyaller.push('goz_kirpma_hizi:yavaş');
    return sinyaller;
};

const getDominantDuygu = (gecmis) => {
    if (!gecmis.length) return 'sakin';
    const sayac = {};
    gecmis.forEach(a => { sayac[a.duygu] = (sayac[a.duygu] || 0) + 1; });
    const maxSayi = Math.max(...Object.values(sayac));
    const adaylar = Object.keys(sayac).filter(d => sayac[d] === maxSayi);
    if (adaylar.length === 1) return adaylar[0];
    for (let i = gecmis.length - 1; i >= 0; i--) {
        if (adaylar.includes(gecmis[i].duygu)) return gecmis[i].duygu;
    }
    return adaylar[0];
};

// ─── SEANS İÇİ ÖRÜNTÜ YARDIMCILARI ──────────────────────
const KONU_GRUPLARI = {
    'aile': ['anne', 'baba', 'kardeş', 'aile', 'ebeveyn', 'çocuk', 'family', 'mother', 'father'],
    'iş': ['iş', 'patron', 'çalışma', 'işyeri', 'kariyer', 'meslek', 'müdür', 'work', 'job', 'boss'],
    'ilişki': ['sevgili', 'eş', 'partner', 'ilişki', 'ayrılık', 'yalnız', 'relationship', 'lonely'],
    'gelecek': ['gelecek', 'plan', 'kaygı', 'endişe', 'belirsiz', 'ne olacak', 'future', 'anxious'],
    'geçmiş': ['geçmiş', 'eskiden', 'çocukken', 'hatıra', 'travma', 'past', 'trauma', 'childhood'],
    'beden': ['uyku', 'yeme', 'ağrı', 'yorgunluk', 'hastalık', 'beden', 'sleep', 'tired', 'pain'],
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
    const konuDegistirme = ['neyse', 'geçelim', 'başka bir şey', 'farklı bir konu', 'bırakalım', 'anyway', "let's move on"];
    if (konuDegistirme.some(k => lower.includes(k))) sinyaller.push('konu_degistirme');
    const kucumseme = ['önemli değil', 'abartmıyorum', 'saçma', 'gülünç', 'ne fark eder', "doesn't matter", 'not important'];
    if (kucumseme.some(k => lower.includes(k))) sinyaller.push('kucumseme');
    const savunma = ['ama şu var ki', 'aslında', 'anlayamazsın', 'you wouldn\'t understand', 'but actually'];
    if (savunma.some(k => lower.includes(k))) sinyaller.push('savunma');
    return sinyaller;
};

// ─── KURAL MOTORU ─────────────────────────────────────────
// L4: Söz-Yüz Çelişkisi
const OLUMLU_KELIMELER = ['iyiyim', 'iyi', 'tamam', 'sorun yok', 'normalim', 'mutluyum', 'güzel', 'harika', 'fena değil', "i'm fine", 'fine', 'okay', 'good'];
const OLUMSUZ_KAMERA_DUYGULAR = ['üzgün', 'endişeli', 'korkmuş', 'sinirli', 'yorgun'];

const buildLayer4Rules = (lastSegment, sonAnaliz, gecmis) => {
    if (!lastSegment || !sonAnaliz || !sonAnaliz.yuz_var) return '';
    const kurallar = [];
    const segLower = lastSegment.toLowerCase();

    const sozluOlumlu = OLUMLU_KELIMELER.some(k => segLower.includes(k));
    const kameraOlumsuz = OLUMSUZ_KAMERA_DUYGULAR.includes(sonAnaliz.duygu) &&
        ['orta', 'yüksek'].includes(sonAnaliz.yogunluk);

    if (sozluOlumlu && kameraOlumsuz && sonAnaliz.guven > 65)
        kurallar.push(`Kullanıcı olumlu kelimeler söylüyor ama yüzü "${sonAnaliz.duygu}" ifadesi gösteriyor. Nazikçe sorgula: "Bunu söylerken sesin biraz farklıydı, gerçekten nasılsın?"`);

    // #2 — YALAN/ÇELİŞKİ GÜÇLENDİRME: Son 5 frame %60+ olumsuz + "iyiyim" söylemesi
    if (gecmis && gecmis.length >= 5 && sozluOlumlu) {
        const son5 = gecmis.slice(-5);
        const olusuzSayi = son5.filter(a => OLUMSUZ_KAMERA_DUYGULAR.includes(a.duygu)).length;
        const olusuzOrani = olusuzSayi / son5.length;
        if (olusuzOrani >= 0.6) {
            const duygular = son5.map(a => a.duygu).join(' → ');
            kurallar.push(`[#2 SÖZYÜZ ÇELİŞKİSİ] Son 5 frame'de %${Math.round(olusuzOrani*100)} olumsuz (${duygular}), ama sen "iyiyim" diyorsun. Çelişki sinyali. Nazikçe: "Bunu söylerken yüzün farklı bir hikaye anlatıyor. Gerçekten nasılsın?"`);
        }
    }

    if (sozluOlumlu && sonAnaliz.genel_vucut_dili === 'kapalı' && sonAnaliz.jestler?.goz_temasi === 'düşük')
        kurallar.push('Kullanıcı olumlu konuşuyor ama beden dili kapalı ve göz teması düşük. "Biraz daha anlatır mısın bunu?" diye sor.');

    if (sonAnaliz.yogunluk === 'yüksek' && (segLower.includes('önemli değil') || segLower.includes('saçma') || segLower.includes("doesn't matter")))
        kurallar.push('Kullanıcı yüksek duygusal yoğunlukta ama durumu önemsiz gösteriyor. "Bu duygu gerçek ve önemli" mesajını ver.');

    return kurallar.join(' ');
};

// L5: Sessizlik & Ritim
const buildLayer5Rules = (silenceDuration, sessizlikTipi, dominantDuygu) => {
    if (!silenceDuration || silenceDuration < 8) return '';
    const kurallar = [];

    // #10 SESSIZLIK KALİTESİ ANALİZİ
    if (sessizlikTipi === 'donmus') {
        kurallar.push('[#10 DONMUŞ SESSİZLİK] Kullanıcı donmuş/bloke durumda. Hiçbir baskı yapma. "Şu an kelimeler gelmiyorsa, o da tamam. Seninleyim." de, sabırlı bekle.');
    } else if (sessizlikTipi === 'dusunceli' && silenceDuration < 20) {
        kurallar.push('[#10 DÜŞÜNCELI SESSİZLİK] Kullanıcı rahat düşünüyor — bu iyi bir sessizlik. Bozma, sabırla bekle, kendi hızında konuşmasını sağla.');
    } else if (sessizlikTipi === 'rahat') {
        kurallar.push('[#10 RAHAT SESSİZLİK] Sağlıklı bir sessizlik kalitesi. Kullanıcı kendisinde rahat — baskı yapma.');
    } else if (sessizlikTipi === 'bloke') {
        kurallar.push('[#10 BLOKELİ SESSİZLİK] Kullanıcı tıkanmış hissediyor — zarar riski olabilir. "Bedenine sor, ne yaşamak istiyor" tekniği uygula.');
        // #16 — REHBERLİ GÖRSELLEŞTIRME: bloke durumda görselleştirme teklif et
        kurallar.push('[#16 VİZUALİZASYON] <call>visualizationStart()</call> Bloke durumda olduğu için rehberli görselleştirme teklif et: "Şu an seni bir görselleştirme rehberine almak ister misin? Zihnini biraz hızlandırmaya çalışabiliriz."');
    }

    if (silenceDuration >= 25)
        kurallar.push('Çok uzun sessizlik (25+ saniye). Nazikçe açılmasını sağla: "Şu an ne hissediyorsun, söylemek zor mu?"');
    else if (silenceDuration >= 8 && !kurallar.length)
        kurallar.push('Sessizlik (8+ saniye). "Hazır olduğunda devam edebiliriz, acele yok." de.');

    // #16 — Kaygı/endişe durumunda görselleştirme
    if ((dominantDuygu === 'endişeli' || dominantDuygu === 'korkmuş') && silenceDuration >= 12) {
        kurallar.push('[#16 VİZUALİZASYON - KAYGı] <call>visualizationStart()</call> Yüksek kaygı + uzun sessizlik → rehberli görselleştirme öner: "Seni sakinleştirici bir deneyime davet etmek istiyorum. İsteğe bağlı."');
    }

    return kurallar.join(' ');
};

// L6: Seanslar Arası Pattern
const buildLayer6Rules = (patternMemory, sonAnaliz, dominantDuygu, sessionHistory) => {
    if (!patternMemory || !sonAnaliz) return '';
    const kurallar = [];

    // #13 — İlerleme Zaman Çizelgesi: son seanslar karşılaştırması
    if (sessionHistory && sessionHistory.length >= 3) {
        const ilkSeans = sessionHistory[sessionHistory.length - 1];
        const sonSeans = sessionHistory[0];
        const ilkTarih = new Date(ilkSeans.tarih).toLocaleDateString('tr-TR');
        const sonTarih = new Date(sonSeans.tarih).toLocaleDateString('tr-TR');

        const ilkAylar = Math.floor((Date.now() - new Date(ilkSeans.tarih).getTime()) / (30 * 24 * 60 * 60 * 1000));
        if (sessionHistory.length >= 2 && sonSeans.bas_yaygin && !ilkSeans.bas_yaygin && ilkAylar >= 1) {
            kurallar.push(`[#13 İLERLEME] ${ilkAylar} ay önceye (${ilkTarih}) göre çok daha iyi durumdasın! Bu dönemde yaşadığın değişime bak, kendini takdir et.`);
        }
    }

    const trendi = patternMemory.seans_trendi || [];
    if (trendi.length >= 3) {
        const son3 = trendi.slice(-3);
        if (son3.every(t => t === 'kötüleşiyor'))
            kurallar.push('Kullanıcı son 3 seanstır kötüleşiyor. Bu trendi nazikçe paylaş: "Birkaç süredir zor bir dönemdesin, fark ediyor musun?"');
        if (son3[son3.length - 1] === 'iyileşiyor' && son3[0] === 'kötüleşiyor')
            kurallar.push('Kullanıcı kötü bir dönemden iyileşmeye başlıyor. Bu ilerlemeyi kutla.');
    }

    const dominantKonu = Object.entries(patternMemory.konular || {})
        .sort(([, a], [, b]) => b.frekans - a.frekans)[0];
    if (dominantKonu && dominantKonu[1].frekans >= 3)
        kurallar.push(`Kullanıcı daha önce de "${dominantKonu[0]}" konusunu sık konuşmuş. Bu konuya duyarlı yaklaş.`);

    const basarili = patternMemory.basarili_mudahaleler || [];
    if (basarili.includes('nefes') && sonAnaliz.yogunluk === 'yüksek')
        kurallar.push('Geçmişte nefes egzersizi bu kullanıcıya yaramış. Yüksek yoğunlukta nefes tekniği öner.');

    // #12 TETİKLEYİCİ HARİTA (Trigger Mapping)
    const tetKonular = patternMemory.tetikleyici_konular || {};
    if (Object.keys(tetKonular).length > 0) {
        const siralanmis = Object.entries(tetKonular)
            .sort(([,a],[,b]) => b.hit - a.hit)
            .slice(0, 2); // top 2 triggers

        for (const [konu, data] of siralanmis) {
            const duygular = data.duygu || [];
            const sonDuygu = duygular[duygular.length - 1] || 'bilinmiyor';
            if (data.hit >= 2) {
                kurallar.push(`[#12 TETİKLEYİCİ] "${konu}" konusu bu kullanıcıyı sıkça etkiliyor (${data.hit} seans, son duygu: ${sonDuygu}). Bu konuda özellikle yavaş, nazik, sabırlı ol.`);
            }
        }
    }

    // İLERLEME ZAMAN ÇİZELGESİ
    if (sessionHistory && sessionHistory.length >= 3) {
        const ilkTarih = new Date(sessionHistory[0].tarih);
        const gunFarki = Math.round((Date.now() - ilkTarih) / (1000*60*60*24));
        if (gunFarki >= 14 && trendi.slice(-2).every(t => t !== 'kötüleşiyor'))
            kurallar.push(`Kullanıcı ${gunFarki} gündür Lyra ile çalışıyor ve genel seyir iyi. Bunu fark et: "Son haftalarda gerçekten bir şeyler değişiyor, görüyorum."`);
    }

    // #17 — DÜŞÜNCE KAYDI (CBT): Mutlak/olumsuz düşünce tespit edildiğinde
    if (sonAnaliz?.duygu && ['üzgün','korkmuş','endişeli','sinirli'].includes(sonAnaliz.duygu) && patternMemory.absolute_words_detected) {
        kurallar.push('[#17 CBT] <call>openCBT()</call> Mutlak düşünceler ("asla", "hiç", "her zaman") tespit edildi. Kullanıcıya düşünce kaydı tekniği öner: "Aklındaki şu düşünceyi biraz daha derinlemesine bakalım mı? Kanıtlarını ve alternatif görüşlerini not etmek ister misin?"');
    }

    return kurallar.join(' ');
};

// L7: Seans Momentum & Adaptasyon
const buildLayer7Rules = (userProfile, sonAnaliz, gecmis, transcriptData) => {
    if (!sonAnaliz) return '';
    const kurallar = [];

    // Günlük kapasite hesapla
    const ilkYogunluk = gecmis?.[0]?.yogunluk;
    const sonYogunluk = sonAnaliz.yogunluk;
    const dusukKapasite = ilkYogunluk === 'yüksek' || sonYogunluk === 'yüksek';

    if (dusukKapasite && gecmis?.length <= 3)
        kurallar.push('Kullanıcı bugün zor bir günde görünüyor. Ağır konulara girme, hafif ve destekleyici kal.');

    // Profil bazlı adaptasyon
    if (userProfile?.soru_toleransi === 'düşük')
        kurallar.push('Bu kullanıcı çok soru sormaktan rahatsız oluyor. Maksimum 1 soru sor, sonra bekle.');

    if (userProfile?.iletisim_tarzi === 'kapalı')
        kurallar.push('Bu kullanıcı kapalı iletişim tarzına sahip. Zorlamadan, nazikçe açılmasını bekle.');

    if (userProfile?.sessizlik_konforu === true)
        kurallar.push('Bu kullanıcı sessizliğe alışkın — 15 saniyeye kadar bekleyebilirsin, doldurmak zorunda değilsin.');

    // #12 — Seans İçinde Tetikleyici Konu Geçti mi?
    const transcript = transcriptData?.fullTranscript?.toLowerCase() || '';
    const patternTetikleyiciler = patternMemory?.tetikleyici_konular || {};
    const aktifTetikleyici = Object.entries(patternTetikleyiciler)
        .filter(([konu]) => transcript.includes(konu))
        .sort(([,a],[,b]) => b.hit - a.hit)[0];
    if (aktifTetikleyici && aktifTetikleyici[1].hit >= 2) {
        const [konu, data] = aktifTetikleyici;
        const duygular = data.duygu || [];
        const sonDuygu = duygular[duygular.length - 1] || 'bilinmiyor';
        kurallar.push(`[#12 SEANS İÇİ TETİKLEYİCİ] "${konu}" konusu bu seansta da geçti — bu konuda her açılışında zorluk yaşıyor (${data.hit} seans, genellikle ${sonDuygu} oluyor). Özellikle yavaş, nazik, sabırlı ol. Baskı yapma.`);
    }

    // DUYGU GEÇİŞ HIZI — duygusal labilite tespiti (#5)
    if (gecmis && gecmis.length >= 10) {
        const son10 = gecmis.slice(-10);
        const benzersizDuygular = [...new Set(son10.map(a => a.duygu))];
        const sayi = benzersizDuygular.length;
        if (sayi >= 5) {
            kurallar.push(`[#5 EMOSYONEL LABİLİTE] Son 10 dakikada ${sayi} farklı duygu: ${benzersizDuygular.join(', ')}. Çok hızlı değişme sinyali. Stabilizasyon moduna geç: zemine in, nefes ver, yavaşlat, soru sorma, derin dinle.`);
        }
    }

    return kurallar.join(' ');
};

const buildLayer1Rules = (sonAnaliz, aktifSinyaller, userId, transcriptData) => {
    if (!sonAnaliz || !sonAnaliz.yuz_var) return '';
    const kurallar = [];
    const { duygu, yogunluk, enerji, jestler, guven, ortam, gorunum_ozeti } = sonAnaliz;

    // ── TEHLİKE & ZARAR PROTOKOLÜ (en yüksek öncelik) ─────
    if (ortam?.tehlike_var === true) {
        const nesne = ortam.tehlikeli_nesne || 'tehlikeli nesne';
        kurallar.push(`KRİZ PROTOKOLÜ: Kullanıcının elinde/yakınında "${nesne}" tespit edildi. Hemen nazikçe sor: "Şu an elinde bir şey var, iyi misin?" Sakin kal, yargılama, güvenliğini önce sorgula.`);
        // Kriz log kaydet — fire and forget
        if (userId) supabase.from('memories').upsert({ user_id: userId, kriz_log: { tarih: new Date().toISOString(), tip: 'tehlikeli_nesne', nesne }, updated_at: new Date().toISOString() }).then(()=>{}).catch(()=>{});
    }

    if (ortam?.zarar_sinyali === true) {
        if (yogunluk === 'yüksek')
            kurallar.push('KRİZ: Kullanıcı kendine zarar veriyor olabilir. Hemen: "Şu an kendine iyi davranıyor musun? Seninle buradayım." Sakin kal, suçlama yapma, güvenli alan yarat.');
        else
            kurallar.push('Kullanıcının hareketi dikkat çekici. Nazikçe sor: "Şu an kendine iyi bakıyor musun?" — baskı yapma, sadece fark ettiğini göster.');
        // Kriz log kaydet
        if (userId) supabase.from('memories').upsert({ user_id: userId, kriz_log: { tarih: new Date().toISOString(), tip: 'zarar_sinyali' }, updated_at: new Date().toISOString() }).then(()=>{}).catch(()=>{});
    }

    // ── ORTAM OLAYI ────────────────────────────────────────
    if (ortam?.arkaplan_kisi === true && ortam?.ani_degisim === true)
        kurallar.push('Arka planda biri var veya yeni geldi ve kullanıcının yüzü ani değişti. Nazikçe sor: "Az önce bir şey mi oldu? Yüzün birden değişti."');

    if (ortam?.ortam_gerilimi === 'var' && ortam?.ani_degisim === true)
        kurallar.push('Ortamda gerilim var ve kullanıcı etkilendi. "Şu an bulunduğun ortam güvenli mi?" diye sor.');

    // ── GÖRME FARKINDALĞI — Lyra görebildiğini bilsin ──────
    if (gorunum_ozeti && guven > 70) {
        kurallar.push(`Kullanıcının görünümü: "${gorunum_ozeti}". Kullanıcı sana "beni görüyor musun", "nasıl görünüyorum", "mutlu muyum" gibi bir şey sorarsa bu bilgiyi kullanarak doğal şekilde cevap ver. Asla "göremiyorum" deme.`);
    }

    // ── DUYGU KURALLARI ─────────────────────────────────────
    if (duygu === 'korkmuş' && guven > 80 && jestler?.gozyasi_izi === true)
        kurallar.push('Kullanıcı korkmuş ve gözyaşı izi var. Önce güven ver, hiç soru sorma. Sessiz, kısa, destekleyici cümleler kur.');

    if (duygu === 'sinirli' || duygu === 'iğnelenmiş' || duygu === 'küçümseyen')
        kurallar.push(`Kullanıcı sinirli/rahatsız görünüyor (guven: ${guven}). Önce duyguyu doğrula: "Seni bir şey rahatsız ediyor gibi, söylemek ister misin?" — çözüm önerme, tavsiye verme.`);

    if (duygu === 'sinirli' && jestler?.cene_gerginligi === 'yüksek')
        kurallar.push('Yüksek çene gerginliği — ciddi öfke sinyali. Sakin kal, yavaş konuş, zemine in.');

    if (duygu === 'yorgun' && jestler?.goz_kirpma_hizi === 'yavaş' && enerji === 'yorgun')
        kurallar.push('Kullanıcı çok yorgun. Seansı kısalt, enerjik sorular sorma.');

    if (duygu === 'üzgün' && jestler?.genel_vucut_dili === 'kapalı')
        kurallar.push('Kullanıcı üzgün ve kapalı beden dili. Daha az soru, daha çok yansıtma ve empati.');

    if (jestler?.gozyasi_izi === true)
        kurallar.push('Gözyaşı izi tespit edildi. Çok dikkatli ol, sessizlik ver, yargılama.');

    if (yogunluk === 'yüksek' && jestler?.kas_catma === true)
        kurallar.push('Yüksek yoğunluk ve kaş çatma. Yavaş konuş, kısa cümleler kur.');

    // ── MİKRO İFADE ─────────────────────────────────────────
    const mikro = sonAnaliz.mikro_duygu;
    if (mikro && mikro !== 'yok') {
        const mikroMap = {
            'gizli_öfke':    'Kullanıcı yüzünde anlık öfke sinyali var ama bunu gizliyor. "Seni gerçekten ne rahatsız etti?" diye sor.',
            'gizli_üzüntü':  'Kullanıcı gülümsüyor ama gizli bir üzüntü var. "Gerçekten nasılsın, içten söyle?" diye sor.',
            'gizli_korku':   'Kullanıcıda gizli korku var. Güven ver, yargılama, "Burada güvendesin" de.',
            'gizli_tiksinme':'Kullanıcı bir konudan/kişiden tiksinme hissediyor ama söylemek istemiyor. Nazikçe aç.'
        };
        if (mikroMap[mikro]) kurallar.push(mikroMap[mikro]);
    }

    // ── NEFES & TİTREME ─────────────────────────────────────
    if (jestler?.nefes_hizi === 'hızlı' || jestler?.nefes_hizi === 'yüzeysel')
        kurallar.push('Nefes hızlanmış/yüzeysel — kaygı artıyor. 4-7-8 nefes tekniği öner: "Birlikte nefes alalım mı?"');

    if (jestler?.nefes_hizi === 'tutuyor')
        kurallar.push('Kullanıcı nefesini tutuyor — yüksek stres veya şok. "Bir nefes al" de, hemen yavaşlat.');

    if (jestler?.el_titreme === true)
        kurallar.push('El titremesi var — yüksek kaygı veya korku. Zemine in, güvenli alan yarat, soru sormayı bırak.');

    // ── GÖZ YASI BİRİKİMİ ───────────────────────────────────
    if (jestler?.goz_yasi_birikimi === 'başlıyor')
        kurallar.push('Göz yaşı birikiyor ama henüz akmadı. Sessiz kal, alan tanı. "Buradayım" de, devam etmesini zorlamaz.');

    if (jestler?.goz_yasi_birikimi === 'belirgin')
        kurallar.push('Belirgin göz yaşı birikimi — ağlamak üzere. Hiç soru sorma, sadece "Seninle buradayım, devam et" de.');

    // ── AĞLAMA TESPİTİ (#1) ──────────────────────────────────
    const aglayorMu = jestler?.goz_yasi_birikimi === 'belirgin' ||
        (jestler?.goz_yasi_birikimi === 'başlıyor' && jestler?.gozyasi_izi === true);
    const aglamaSesi = transcriptData?.sesTitreme === true && (transcriptData?.konusmaTempo || 0) < 1.5;
    if (aglayorMu || aglamaSesi)
        kurallar.push('[#1 AĞLAMA TESPİTİ] Kullanıcı ağlıyor veya ağlamak üzere. HİÇ SORU SORMA. Sadece: "Seninle buradayım. Devam et." de, sessizlik ver. Yapıştırma, hızlı yanıt, çözüm önerme.');

    // ── YORGUNLUK & UYKU ────────────────────────────────────
    if (jestler?.goz_kapagi_agirlik === 'belirgin_agir' && enerji === 'yorgun')
        kurallar.push('Kullanıcı çok yorgun — göz kapakları belirgin şekilde düşük. "Bugün çok yorgun görünüyorsun, hafif konuşalım" de, ağır konulara girme.');
    if (jestler?.goz_kapagi_agirlik === 'hafif_agir' && yogunluk !== 'yüksek')
        kurallar.push('Kullanıcı yorgun ama konuşabilir durumda. Enerji gerektiren egzersizler verme, tempo düşük tut.');
    if (sonAnaliz?.yuz_soluklugu === true && (duygu === 'yorgun' || enerji === 'yorgun'))
        kurallar.push('Yüz soluk ve enerjisiz görünüyor — aşırı yorgunluk, uyku eksikliği veya hastalık sinyali. "Son zamanlarda iyi uyuyabiliyor musun?" diye sor, dinlendirici konulara geç.');

    // ── NEFES EGZERSİZİ MODU (#6) ───────────────────────────
    const nefesGerekli = (duygu === 'endişeli' || duygu === 'korkmuş') &&
        yogunluk === 'yüksek' &&
        (jestler?.nefes_hizi === 'hızlı' || jestler?.nefes_hizi === 'yüzeysel' || jestler?.nefes_hizi === 'tutuyor');
    if (nefesGerekli) {
        kurallar.push('[#6 NEFES_EGZERSIZI_BASLAT] Kullanıcı yüksek kaygıda (endişeli/korkmuş), nefesi hızlanmış/yüzeysel/tutuyor. Hemen 4-7-8 nefes tekniği: "Seninle birlikte nefes alalım mı? Dört say nefes al, yedi say tut, sekiz say ver. Başlayalım..."');
    }

    // ── NESNE FARKINDALĞI ───────────────────────────────────
    if (ortam?.nesneler?.length > 0 && !ortam.tehlike_var) {
        const ilginc = ortam.nesneler.filter(n => !['bardak', 'telefon', 'masa', 'sandalye', 'koltuk'].includes(n.toLowerCase()));
        if (ilginc.length > 0)
            kurallar.push(`Kullanıcının elinde/yakınında şunlar görünüyor: ${ilginc.join(', ')}. Eğer konuşmayla bağlantılıysa doğal şekilde değinebilirsin.`);
    }

    return kurallar.join(' ');
};

const buildLayer2Rules = (trend, dominantDuygu, gecmis, transcriptData) => {
    if (!gecmis || gecmis.length < 2) return '';
    const kurallar = [];

    if (trend === 'kötüleşiyor' && dominantDuygu === 'endişeli')
        kurallar.push('Kullanıcının endişe seviyesi artıyor. Tempo düşür, kısa cümleler kur, uygun yerlerde sessizlik bırak.');

    if (trend === 'iyileşiyor')
        kurallar.push('Kullanıcı sakinleşiyor. Bu ilerlemeyi nazikçe yansıt, zorlamadan teşvik et.');

    // ── SES ZEKASI KURALLARI ────────────────────────────────
    if (transcriptData) {
        const { sesTitreme, sesYogunlukOrt, tempoTrend, konusmaTempo, hume_scores } = transcriptData;

        if (sesTitreme && (dominantDuygu === 'üzgün' || dominantDuygu === 'korkmuş'))
            kurallar.push('Kullanıcının sesi titriyor ve duygusal. "Sesin biraz titriyor,괜찮아mısın?" diyebilirsin. Ağlamak üzere olabilir, nazik ol.');

        if (sesTitreme && dominantDuygu === 'sinirli')
            kurallar.push('Ses titremesi + sinirli = öfke kontrolünü zorlanıyor. Sakin ve yavaş konuş, ses tonunu düşür.');

        if (tempoTrend === 'azalıyor' && konusmaTempo < 1.5)
            kurallar.push('Konuşma hızı giderek azalıyor — enerji düşüyor veya kapanıyor. Enerjik sorular sorma, hafif kal.');

        if (sesYogunlukOrt > 0.7 && dominantDuygu === 'sinirli')
            kurallar.push('Yüksek ses şiddeti + sinirli = öfke dorukta. Sesin tonunu düşür, kısa cümleler kur, zemine in.');

        if (tempoTrend === 'artıyor' && konusmaTempo > 3)
            kurallar.push('Kullanıcı çok hızlı konuşuyor — kaygı veya acelesi var. Nazikçe yavaşlat: "Bir nefes alalım mı?"');

        if (transcriptData.sesMonotonluk && (dominantDuygu === 'üzgün' || dominantDuygu === 'yorgun')) {
            const depresyonUyarı = dominantDuygu === 'üzgün' && transcriptData.sesMonotonluk ? 'Depresyon sinyali olabilir. ' : '';
            kurallar.push(`[#7 SES MONOTONLUĞU] Sesi monoton ve düz — içinde ağırlık/boşluk sinyali. ${depresyonUyarı}"Sesin çok düz, içinde bir ağırlık var gibi hissediyorum" diyebilirsin. Yavaş konuş, destekleyici kal.`);
        }

        // ── HUME AI PROSODY INJECT ──
        if (hume_scores && hume_scores.top_emotions) {
            const { dominant, valence, arousal, top_emotions } = hume_scores;

            // Valence çelişkisi: yüz olumsuz gösteriyor ama ses pozitif
            if (valence > 0.3 && ['üzgün', 'korkmuş', 'endişeli', 'sinirli'].includes(dominantDuygu))
                kurallar.push(`[HUME SES ÇELIŞKÜ] Ses analizi pozitif enerji gösteriyor (valence:${valence}) ama yüz "${dominantDuygu}". Duygusunu gizliyor olabilir. "Sesin bana positif enerji gösteriyor ama yüzün farklı duruyor, gerçekten iyimisin?"`);

            // Arousal çelişkisi: yüz sakin gösteriyor ama ses enerjik
            if (arousal > 0.4 && ['sakin', 'yorgun'].includes(dominantDuygu))
                kurallar.push(`[HUME SES ENERJI] Ses enerjisi yüksek (arousal:${arousal}) ama yüz ${dominantDuygu}. Baskılanmış enerji olabilir. "Sende bir enerji var ama bunu söylemekte zorlanıyor gibisin."`);

            // Top duygu-spesifik eğitim
            const HUME_EMOTION_GUIDE = {
                'Sadness': 'Seste derin üzüntü belirlendi. Tempo düşür, destekleyici kal. Çözüm önerme, dinle.',
                'Fear': 'Seste korku/kaygı. "Burada güvendesin. Yavaşça anlat" de, sakinleştir.',
                'Anger': 'Seste öfke. Öfkenin sebebini anlama, zemine in. Uzlaşmacı ol.',
                'Anxiety': 'Seste kaygı/gerilim. Tempo düşür, nefes egzersizi öner, sakinleştir.',
                'Shame': 'Seste utanç/mahcubiyet. "Bu hissi taşımak zor" de, yargılama.',
                'Guilt': 'Seste suçluluk. "Kendini suçlamak yerine ne olduğuna bakalım" de.',
                'Calmness': 'Ses rahat ve sakin. Derin/önemli konulara girebilirsin, kullanıcı hazır.',
                'Distress': 'Seste yoğun sıkıntı. Kısa cümleler kur, aceleyle gitme.',
                'Neutral': 'Ses nötr/kontrollü. Duygusunu aydınlatmak için açık sorular sor.',
                'Contentment': 'Ses memnun/tatmin. İlerlemeyi fark et ve küçük ama samimi bir şekilde kutla.'
            };

            if (top_emotions.length > 0 && HUME_EMOTION_GUIDE[top_emotions[0].name]) {
                kurallar.push(`[HUME — ${top_emotions[0].name} %${Math.round(top_emotions[0].score * 100)}]: ${HUME_EMOTION_GUIDE[top_emotions[0].name]}`);
            }
        }
    }

    const son5 = gecmis.slice(-5);
    const hepsiYogun = son5.length === 5 && son5.every(a => a.yogunluk === 'yüksek' || a.yogunluk === 'orta');
    if (hepsiYogun)
        kurallar.push(`Kullanıcı uzun süredir ${dominantDuygu} hissediyor. Bu duyguyu doğrudan nazikçe ele almayı düşün.`);

    const yogunlukOrt = gecmis.reduce((s, a) => s + yogunlukToNum(a.yogunluk), 0) / gecmis.length;
    if (yogunlukOrt > 75 && gecmis.length >= 5)
        kurallar.push('Kullanıcı bu seans boyunca yüksek duygusal yoğunlukta. Sabırlı ve yavaş ol.');

    // #5 — EMPATİ KALİTESİ SKORU
    // Olumsuz duygu + ard arda 3+ = yeterli empati gösterilmemiş olabilir
    if (gecmis.length >= 4) {
        const sonDortNegatif = gecmis.slice(-4).filter(a =>
            ['üzgün', 'korkmuş', 'sinirli', 'endişeli', 'yorgun'].includes(a.duygu) &&
            (a.yogunluk === 'yüksek' || a.yogunluk === 'orta')
        );
        if (sonDortNegatif.length >= 3)
            kurallar.push('EMPATİ UYARISI: Kullanıcı uzun süredir olumsuz duygular yaşıyor ve henüz rahatlamıyor. Terapötik teknik kullanmayı bırak — sadece "Bunu yaşamak çok zor olmalı" gibi basit, içten bir empati cümlesi kur. Sonra sessiz kal.');
    }

    return kurallar.join(' ');
};

const buildLayer3Rules = (hafizaMetni, sonAnaliz, userId) => {
    const kurallar = [];

    // Hafıza bazlı kurallar
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

    // Seans içi örüntü
    const transcriptData = userId ? sessionTranscriptStore.get(userId) : null;
    if (transcriptData?.fullTranscript) {
        const konular = trackSessionTopics(transcriptData.fullTranscript);
        const tekrarlayan = Object.entries(konular).filter(([, v]) => v >= 2).map(([k]) => k);
        if (tekrarlayan.length > 0)
            kurallar.push(`Bu seansta "${tekrarlayan.join(', ')}" konusuna defalarca döndünüz. Burada önemli bir şey olabilir, nazikçe derinleş.`);

        const kacınma = detectAvoidance(transcriptData.fullTranscript);
        if (kacınma.includes('konu_degistirme'))
            kurallar.push('Kullanıcı az önce konuyu değiştirdi. Nazikçe önceki konuya geri dön: "Az önce farklı bir şeyden bahsediyorduk, oraya dönebilir miyiz?"');
        if (kacınma.includes('kucumseme'))
            kurallar.push('Kullanıcı yaşadığını küçümsüyor. Nazikçe önem ver: "Bunu küçümsüyor olsan da, hissetmen önemli."');
        if (kacınma.includes('savunma'))
            kurallar.push('Kullanıcı savunmaya geçti. Baskı yapma, güvenli alan yarat, yavaşla.');

        // KONUŞMA DENGESİ — Lyra çok fazla konuşuyorsa uyar
        const satirlar = transcriptData.fullTranscript.split('\n').filter(Boolean);
        const assistantSatir = satirlar.filter(s => s.startsWith('assistant:')).length;
        const userSatir = satirlar.filter(s => s.startsWith('user:')).length;
        const toplamSatir = assistantSatir + userSatir;
        const assistantOrani = toplamSatir > 0 ? assistantSatir / toplamSatir : 0;
        if (toplamSatir > 8 && assistantOrani > 0.45) {
            const sayi = Math.round(assistantOrani * 100);
            kurallar.push(`[#8 KONUŞMA DENGESİ] Bu seansta %${sayi} konuşuyorsun — çok fazla! Şimdi kısa cevap ver, kullanıcıyı daha fazla konuştur. Dinle, soru sor, açılmasını sağla.`);
        }

        // ABSOLüT KELİMELER — bilişsel çarpıtma tespiti (#9)
        const absKelimeler = [
            'asla', 'hep böyle', 'her zaman böyle', 'hiç kimse', 'kimse beni', 'hiçbir zaman',
            'tamamen mahvoldum', 'hiçbir şey işe yaramıyor', 'her şey berbat', 'hep benim hatam',
            'kimse beni sevmez', 'yalnız olacağım', 'asla başaramayacağım', 'her zaman böyle kalacak',
            'hiç mutlu olmayacağım', 'kimse anlayamıyor', 'daima yalnız', 'her şey imkansız'
        ];
        const lastSeg = (transcriptData.lastSegment || '').toLowerCase();
        const absHit = absKelimeler.find(k => lastSeg.includes(k));
        if (absHit && sonAnaliz?.yogunluk && sonAnaliz.yogunluk !== 'düşük') {
            kurallar.push(`[#9 ABSOLüT KÖŞEBENDİLİK] Kullanıcı "${absHit}" gibi absolüt/katı bir ifade kullandı — bilişsel çarpıtma sinyali. Nazikçe sorgula: "Az önce '${absHit}' dedin — gerçekten hiç mi? Ara yollar, istisnaları beraber bulalım."`);
        }

        // #3 — KELIME TEKRAR TESPİTİ
        const tekrarlar = detectWordRepetition(transcriptData.fullTranscript);
        if (tekrarlar.length > 0) {
            const [kelime, sayi] = tekrarlar[0];
            kurallar.push(`Kullanıcı "${kelime}" kelimesini bu seansta ${sayi} kez kullandı — takıntı noktası olabilir. Nazikçe derinleş: "Bu konuya birkaç kez döndün, sana ne hissettiriyor?"`);
        }

        // #6 — RÜYA & METAFOR ANALİZİ
        const { ruya, metafor, icerik } = detectDreamMetaphor(transcriptData.fullTranscript);
        if (ruya)
            kurallar.push(`Kullanıcı rüyasından bahsetti. Bu sembolü derinleştir: "Bu rüya sana ne anlatıyor? Uyandığında nasıl hissettin?" Direkt yorum yapma, kullanıcıya bırak.`);
        else if (metafor && icerik)
            kurallar.push(`Kullanıcı metaforik dil kullanıyor ("${icerik}"). Bu metaforu genişlet: "Bunu biraz daha açar mısın, bu benzetme çok ilginç." Sembolü derinleştir.`);

        // #8 — ÇOCUKLUK TETİKLEYİCİ
        if (detectChildhoodTrigger(transcriptData.fullTranscript, sonAnaliz?.yogunluk))
            kurallar.push('Kullanıcı çocukluk/aile referansları veriyor ve duygusal yoğunluk yüksek — travma bölgesi sinyali. Çok yavaş ve nazik ol, zorlamadan dinle. "Bunu anlatmak zor olabilir, ne kadar paylaşmak istersen." de.');

        // #10 — BAĞIMLILIK DİLİ
        const bagimlilik = detectDependencyLanguage(transcriptData.lastSegment);
        if (bagimlilik && sonAnaliz?.yogunluk !== 'düşük')
            kurallar.push(`Kullanıcı bilişsel çaresizlik/bağımlılık dili kullandı ("${bagimlilik}"). Nazikçe sorgulat: "Gerçekten başka hiç yol yok mu? Bunu birlikte düşünelim." Çözüm önerme, soruyla açılmasını sağla.`);

        // #2 — KONUŞMA RİTMİ
        if (transcriptData.konusmaTempo > 4.5)
            kurallar.push('Kullanıcı çok hızlı konuşuyor — panik/kaygı sinyali. Nazikçe yavaşlat: "Seninle birlikte nefes alalım mı, biraz yavaşlayalım."');
        else if (transcriptData.konusmaTempo > 0 && transcriptData.konusmaTempo < 0.8)
            kurallar.push('Konuşma ritmi çok yavaşladı — enerji çöküşü veya depresif dönem sinyali. Enerjik sorular sorma, hafif ve destekleyici kal.');
    }

    return kurallar.join(' ');
};

// ─── AES-256-GCM ŞİFRELEME ────────────────────────────────
const ENC_KEY = process.env.ENCRYPTION_KEY
    ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
    : crypto.randomBytes(32); // fallback: her restart'ta yeni key (prod'da env ekle)

const encryptField = (text) => {
    if (!text) return text;
    try {
        const iv  = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
        const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `ENC:${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
    } catch { return text; }
};

const decryptField = (text) => {
    if (!text || !String(text).startsWith('ENC:')) return text;
    try {
        const [, ivHex, encHex, tagHex] = String(text).split(':');
        const iv  = Buffer.from(ivHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch { return text; }
};

// ─── ERROR LOGLAMA ─────────────────────────────────────────
const logError = async (endpoint, errorMessage, userId = null) => {
    try {
        await supabase.from('error_logs').insert({
            user_id: userId,
            endpoint,
            error_message: errorMessage,
            timestamp: new Date().toISOString()
        });
    } catch { /* loglama başarısız olsa da devam et */ }
};

// ─── YENİ KURAL MOTORU FONKSİYONLARI ──────────────────────

// Kelime tekrar tespiti
const detectWordRepetition = (transcript) => {
    if (!transcript) return [];
    const stopWords = new Set(['ve', 'ama', 'için', 'bir', 'bu', 'da', 'de', 'ki', 'ile', 'ben', 'sen', 'o', 'biz', 'siz', 'ne', 'var', 'yok', 'mi', 'mı', 'çok', 'daha', 'gibi', 'ya', 'şey', 'şu', 'nasıl', 'çünkü', 'ise', 'bile', 'hem', 'veya']);
    const userLines = transcript.split('\n').filter(l => l.startsWith('user:')).join(' ').replace(/user:/g, '');
    const kelimeler = userLines.toLowerCase().replace(/[^a-zçğıöşüa-z\s]/gi, '').split(/\s+/).filter(k => k.length > 3 && !stopWords.has(k));
    const sayac = {};
    kelimeler.forEach(k => { sayac[k] = (sayac[k] || 0) + 1; });
    return Object.entries(sayac).filter(([, s]) => s >= 3).sort(([, a], [, b]) => b - a).slice(0, 3);
};

// Rüya & Metafor tespiti
const detectDreamMetaphor = (transcript) => {
    if (!transcript) return { ruya: false, metafor: false, icerik: '' };
    const lower = transcript.toLowerCase();
    const ruyaKelimeler = ['rüyamda', 'rüya gördüm', 'düşümde', 'nightmare', 'kâbusumda', 'hayalimde'];
    const metaforKelimeler = ['sanki bir', 'gibi hissediyorum', 'adeta', 'tam olarak şuna benziyor', 'benim için bu şu anlama'];
    const ruya = ruyaKelimeler.some(k => lower.includes(k));
    const metafor = metaforKelimeler.some(k => lower.includes(k));
    const hit = [...ruyaKelimeler, ...metaforKelimeler].find(k => lower.includes(k)) || '';
    return { ruya, metafor, icerik: hit };
};

// Çocukluk tetikleyici tespiti
const detectChildhoodTrigger = (transcript, yogunluk) => {
    if (!transcript || yogunluk === 'düşük') return false;
    const lower = transcript.toLowerCase();
    const tetikler = ['çocukken', 'küçükken', 'çocukluğumda', 'annem', 'babam', 'okul yılları', 'ilkokulda', 'ortaokulda', 'lisede', 'çocukluğumda', 'büyürken'];
    const hitler = tetikler.filter(k => lower.includes(k));
    return hitler.length >= 2;
};

// Bağımlılık dili tespiti
const detectDependencyLanguage = (segment) => {
    if (!segment) return null;
    const lower = segment.toLowerCase();
    const kaliplar = ['yapamam', 'yapamıyorum', 'zorundayım', 'mecburum', 'başka seçeneğim yok', 'kaçış yok', 'çaresizim', 'elimde değil', 'her zaman böyle olacak', 'hiçbir zaman değişmeyecek'];
    return kaliplar.find(k => lower.includes(k)) || null;
};

// --- DUYGU DURUMU TAKİBİ ---
const userEmotions = new Map(); // userId -> { gecmis, trend, dominant_duygu, ... }

// --- SEANS TRANSCRIPT STORE ---
const sessionTranscriptStore = new Map();
// userId → { fullTranscript, silenceDuration, lastSegment, updatedAt }

// --- AKTİF OTURUM ---
let activeSessionUserId = null;
let activeSessionId = null;

// ─── HAFIZA YÖNETİMİ (Supabase) ───────────────────────────
const getMemory = async (userId) => {
    if (!userId) return '';
    try {
        const { data } = await supabase.from('memories').select('content').eq('user_id', userId).single();
        const raw = data?.content || '';
        return decryptField(raw); // şifreli ise çöz
    } catch { return ''; }
};

const saveMemory = async (userId, content) => {
    if (!userId) return;
    try {
        const { data: existing } = await supabase.from('memories').select('session_history').eq('user_id', userId).single();
        const eskiGecmis = existing?.session_history || [];

        // #13 — İlerleme Zaman Çizelgesi: seans özetini geçmişe ekle
        const yeniSeans = {
            tarih: new Date().toISOString(),
            ozet: content.substring(0, 200), // İlk 200 char özet
            bas_yaygin: content.toLowerCase().includes('iyileş') || content.toLowerCase().includes('daha iyi')
        };
        const guncelGecmis = [yeniSeans, ...eskiGecmis].slice(0, 5); // Son 5 seansı tut

        await supabase.from('memories').upsert({
            user_id: userId,
            content: encryptField(content), // AES şifrele
            session_history: guncelGecmis,
            updated_at: new Date().toISOString()
        });
    } catch (e) {
        console.error('[MEMORY] Kaydetme hatası:', e.message);
        await logError('/save-memory', e.message, userId);
    }
};

const updateUserProfile = async (userId, transcript, emotionState) => {
    if (!userId || !transcript || transcript.length < 50) return;
    try {
        const { data } = await supabase.from('memories').select('user_profile').eq('user_id', userId).single();
        const mevcutProfil = data?.user_profile || {};

        const profilGuncelleme = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'system',
                content: `Sen bir klinik psikolog asistanısın. Bu seans transcript'ini analiz et ve kullanıcının kişilik profilini güncelle.

Mevcut profil: ${JSON.stringify(mevcutProfil)}
Baskın duygu bu seansta: ${emotionState?.dominant_duygu || 'bilinmiyor'}
Duygu trendi: ${emotionState?.trend || 'stabil'}

Şunları belirle ve JSON olarak döndür:
{
  "savunma_mekanizmalari": ["espri yapma", "konu değiştirme", "küçümseme"],
  "tetikleyiciler": ["aile", "iş", "gelecek"],
  "guclu_yonler": ["öz-farkındalık", "cesaret"],
  "iletisim_tarzi": "açık|kapalı|savunmacı|işbirlikçi",
  "duygusal_tepki_hizi": "hızlı|yavaş|orta",
  "sessizlik_konforu": true,
  "soru_toleransi": "düşük|orta|yüksek",
  "basarili_mudahaleler": ["nefes", "sokratik_soru"],
  "degerler_haritasi": ["aile", "özgürlük", "başarı"],
  "ozel_isimler": {"patron": "Ahmet", "sevgili": "Ayşe"},
  "haftalik_gorev": "verildiyse görevi yaz, verilmediyse boş string",
  "ozet": "1 cümle kişilik özeti"
}
Sadece JSON döndür.`
            }, {
                role: 'user',
                content: `Transcript:\n${transcript.slice(-2000)}`
            }],
            max_tokens: 300
        });

        let yeniProfil = mevcutProfil;
        try {
            const raw = profilGuncelleme.choices[0].message.content.trim().replace(/```json|```/g, '');
            const parsed = JSON.parse(raw);
            // #15 — Özel İsimler Hafızası: isimler birleştirme
            const ozelIsimler = { ...(mevcutProfil.ozel_isimler || {}), ...(parsed.ozel_isimler || {}) };

            // Mevcut profille birleştir
            yeniProfil = {
                ...mevcutProfil,
                ...parsed,
                tetikleyiciler: [...new Set([...(mevcutProfil.tetikleyiciler || []), ...(parsed.tetikleyiciler || [])])],
                savunma_mekanizmalari: [...new Set([...(mevcutProfil.savunma_mekanizmalari || []), ...(parsed.savunma_mekanizmalari || [])])],
                basarili_mudahaleler: [...new Set([...(mevcutProfil.basarili_mudahaleler || []), ...(parsed.basarili_mudahaleler || [])])],
                degerler_haritasi: [...new Set([...(mevcutProfil.degerler_haritasi || []), ...(parsed.degerler_haritasi || [])])],
                ozel_isimler: ozelIsimler,
                guncelleme_tarihi: new Date().toISOString()
            };
        } catch { /* parse hatası → mevcut profil korunur */ }

        // ÖZEL İSİM ÇIKARIMI — GPT-4o-mini ile
        try {
            const isimCikar = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: `Bu konuşmadan bahsedilen kişilerin adlarını ve rollerini çıkar. JSON döndür: {"isimler": {"patron": "Ahmet", "sevgili": "Ayşe"}}. Sadece açıkça belirtilen isimler. Yoksa: {"isimler": {}}\n\nKonuşma:\n${transcript.slice(-1500)}` }],
                max_tokens: 100
            });
            const rawIsim = isimCikar.choices[0].message.content.trim().replace(/```json|```/g, '');
            const isimData = JSON.parse(rawIsim);
            if (isimData.isimler && Object.keys(isimData.isimler).length > 0) {
                yeniProfil.ozel_isimler = { ...(mevcutProfil.ozel_isimler || {}), ...isimData.isimler };
                console.log(`[PROFİL] İsimler güncellendi: ${JSON.stringify(isimData.isimler)}`);
            }
        } catch { /* isim çıkarımı başarısız → geç */ }

        await supabase.from('memories').upsert({ user_id: userId, user_profile: yeniProfil, updated_at: new Date().toISOString() });
        console.log(`[PROFİL] ✅ Kişilik profili güncellendi: ${userId}`);
    } catch (e) { console.error('[PROFİL] Hata:', e.message); }
};

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

        existing.seans_trendi = [...(existing.seans_trendi || []), sessionData.trend].slice(-10);
        existing.toplam_seans = (existing.toplam_seans || 0) + 1;
        existing.son_seans_tarihi = new Date().toISOString();

        for (const [konu, sayi] of Object.entries(sessionData.konular || {})) {
            if (sayi > 0) {
                if (!existing.konular[konu]) existing.konular[konu] = { frekans: 0, duygu: sessionData.dominantDuygu };
                existing.konular[konu].frekans += sayi;
                existing.konular[konu].duygu = sessionData.dominantDuygu;
            }
        }

        // TETİKLEYİCİ HARİTA — kötü duygu + konu = tetikleyici kaydet
        const olumsuzDuygular = ['üzgün', 'sinirli', 'korkmuş', 'endişeli'];
        if (olumsuzDuygular.includes(sessionData.dominantDuygu)) {
            if (!existing.tetikleyici_konular) existing.tetikleyici_konular = {};
            for (const [konu, sayi] of Object.entries(sessionData.konular || {})) {
                if (sayi > 0) {
                    if (!existing.tetikleyici_konular[konu]) existing.tetikleyici_konular[konu] = { hit: 0, duygu: [] };
                    existing.tetikleyici_konular[konu].hit++;
                    existing.tetikleyici_konular[konu].duygu = [...(existing.tetikleyici_konular[konu].duygu || []), sessionData.dominantDuygu].slice(-5);
                }
            }
        }

        // SESSION HISTORY — son 5 seans özeti
        if (!existing.session_history) existing.session_history = [];
        const seansEntry = {
            tarih: new Date().toISOString(),
            trend: sessionData.trend,
            dominant_duygu: sessionData.dominantDuygu
        };

        // #27 — BEDEN DİLİ PUANI
        if (sessionData.bedenDiliPuan !== undefined) {
            seansEntry.aciklik_skoru = sessionData.bedenDiliPuan;
            existing.son_aciklik_skoru = sessionData.bedenDiliPuan;
        }

        existing.session_history = [...existing.session_history, seansEntry].slice(-5);

        await supabase.from('memories').upsert({
            user_id: userId,
            pattern_memory: existing,
            updated_at: new Date().toISOString()
        });
        console.log(`[PATTERN] ✅ Pattern memory güncellendi: ${userId}`);
    } catch (e) { console.error('[PATTERN] Güncelleme hatası:', e.message); }
};

// ─── CONFIG (Frontend için Supabase bilgileri) ──────────────
app.get('/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// ─── PING ──────────────────────────────────────────────────
app.get('/ping', (req, res) => {
    res.send('Lyra Brain is ALIVE! 🌌');
});

// ─── FRONTEND ERROR LOGLAMA (#43) ──────────────────────────
app.post('/log-error', async (req, res) => {
    const { userId, error, source, line, col } = req.body;
    if (!error) return res.sendStatus(400);
    await logError('/frontend', `${error} | ${source}:${line}:${col}`, userId || null);
    res.sendStatus(200);
});

// ─── TRANSCRIPT GÜNCELLEME ────────────────────────────────
app.post('/update-transcript', (req, res) => {
    const { userId, fullTranscript, silenceDuration, lastSegment, sesYogunlukOrt, sesTitreme, konusmaTempo, tempoTrend, sesMonotonluk, sessizlikTipi, hume_scores } = req.body;
    if (!userId) return res.sendStatus(400);
    sessionTranscriptStore.set(userId, {
        fullTranscript: fullTranscript || '',
        silenceDuration: silenceDuration || 0,
        lastSegment: lastSegment || '',
        sesYogunlukOrt: sesYogunlukOrt || 0,
        sesTitreme: sesTitreme || false,
        sesMonotonluk: sesMonotonluk || false,
        konusmaTempo: konusmaTempo || 0,
        tempoTrend: tempoTrend || 'stabil',
        sessizlikTipi: sessizlikTipi || 'normal',
        hume_scores: hume_scores || null,
        updatedAt: Date.now()
    });
    res.sendStatus(200);
});

// ─── OTURUM BAŞLAT (Token doğrulama ile) ───────────────────
app.post('/session-start', async (req, res) => {
    const { token } = req.body;
    if (token) {
        try {
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                activeSessionUserId = user.id;
                activeSessionId = crypto.randomUUID();
                console.log(`[SESSION] Aktif kullanıcı: ${user.id} | sessionId: ${activeSessionId}`);
            }
        } catch (e) {
            console.error('[SESSION] Token doğrulama hatası:', e.message);
        }
    }
    res.sendStatus(200);
});

// ─── HAFIZA OKUMA ───────────────────────────────────────────
app.get('/memory', async (req, res) => {
    const userId = req.query.userId;
    const memory = await getMemory(userId);
    console.log(`[MEMORY READ] userId: ${userId}, hasMemory: ${!!memory}`);
    res.json({ memory });
});

// ─── VAPI WEBHOOK (Arama bitince hafızayı kaydet) ──────────
app.post('/vapi-webhook', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.json({});

    const msgType = message.type;
    console.log(`[VAPI WEBHOOK] Type: ${msgType}`);

    if (msgType === 'end-of-call-report') {
        const transcript = message.transcript || '';
        const userId = activeSessionUserId;

        if (!transcript || transcript.length < 50) {
            console.log('[END OF CALL] Konuşma çok kısa, özetlenmiyor.');
            return res.json({});
        }

        console.log(`[END OF CALL] Özetleniyor... userId: ${userId}`);
        try {
            const summaryResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Kullanıcı ile yapılan konuşmayı analiz et ve şu bilgileri kısa maddeler halinde özetle:\n- Kullanıcının adı (varsa)\n- Temel endişeleri ve sorunları\n- Kişilik özellikleri ve ruh hali\n- Lyra'nın bir dahaki seferde hatırlaması gereken önemli detaylar\nMaksimum 150 kelime.`
                    },
                    { role: 'user', content: `Konuşma:\n${transcript}` }
                ],
                max_tokens: 250
            });

            // Seans emotion özetini çek ve hafızaya ekle
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
                        const dominant = Object.keys(sayac).sort((a, b) => sayac[b] - sayac[a])[0];
                        const ortGuven = Math.round(logs.reduce((s, l) => s + (l.guven || 0), 0) / logs.length);
                        const sonTrend = logs[logs.length - 1]?.trend || 'stabil';
                        emotionOzeti = `\n\nBu seanstaki duygu analizi: Baskın duygu "${dominant}", ortalama güven %${ortGuven}, seans sonu trendi "${sonTrend}".`;
                    }
                }
            } catch (e) { console.error('[EMOTION OZET] Hata:', e.message); }

            // #9 — SEANS SONU DUYGU KARŞILAŞTIRMASI
            let seansKarsilastirma = '';
            try {
                if (activeSessionId) {
                    const { data: allLogs } = await supabase
                        .from('emotion_logs')
                        .select('duygu, yogunluk, guven, timestamp')
                        .eq('session_id', activeSessionId)
                        .order('timestamp', { ascending: true });

                    if (allLogs && allLogs.length >= 4) {
                        const ilkCeyrek = allLogs.slice(0, Math.floor(allLogs.length / 4));
                        const sonCeyrek = allLogs.slice(-Math.floor(allLogs.length / 4));
                        const ilkYogunluk = ilkCeyrek.reduce((s, l) => s + yogunlukToNum(l.yogunluk), 0) / ilkCeyrek.length;
                        const sonYogunluk = sonCeyrek.reduce((s, l) => s + yogunlukToNum(l.yogunluk), 0) / sonCeyrek.length;
                        const fark = sonYogunluk - ilkYogunluk;
                        const sonDuygu = sonCeyrek[sonCeyrek.length - 1]?.duygu || 'bilinmiyor';
                        const ilkDuygu = ilkCeyrek[0]?.duygu || 'bilinmiyor';
                        if (Math.abs(fark) > 15) {
                            seansKarsilastirma = `\nSeans duygu değişimi: "${ilkDuygu}" → "${sonDuygu}" (${fark > 0 ? '+' : ''}${Math.round(fark)} puan yoğunluk ${fark > 0 ? 'artışı' : 'düşüşü'}).`;
                        } else {
                            seansKarsilastirma = `\nSeans boyunca duygu stabil kaldı (${ilkDuygu} → ${sonDuygu}).`;
                        }
                    }
                }
            } catch (e) { console.error('[SEANS KARSILASTIRMA] Hata:', e.message); }

            // #7 — GÜVEN İNŞA SKORU
            let guvenSkoru = '';
            try {
                const { data: patternData } = await supabase
                    .from('user_profiles')
                    .select('pattern_memory')
                    .eq('user_id', userId)
                    .single();

                const pattern = patternData?.pattern_memory || {};
                const seansCount = (pattern.toplam_seans || 0) + 1;
                const pozitifSeans = (pattern.pozitif_seans || 0) + (emotionOzeti.includes('iyileşiyor') ? 1 : 0);
                const guvenSkor = Math.min(100, Math.round((pozitifSeans / Math.max(seansCount, 1)) * 60 + Math.min(seansCount * 4, 40)));
                guvenSkoru = `\nGüven inşa skoru: ${guvenSkor}/100 (${seansCount}. seans).`;

                // Skoru pattern_memory'ye kaydet
                await supabase.from('user_profiles').upsert({
                    user_id: userId,
                    pattern_memory: {
                        ...pattern,
                        toplam_seans: seansCount,
                        pozitif_seans: pozitifSeans,
                        guven_skoru: guvenSkor,
                        son_guncelleme: new Date().toISOString()
                    }
                }, { onConflict: 'user_id' });
            } catch (e) { console.error('[GÜVEN SKORU] Hata:', e.message); }

            const summary = summaryResponse.choices[0].message.content + emotionOzeti + seansKarsilastirma + guvenSkoru;
            await saveMemory(userId, summary);
            console.log(`[BRAIN ASCENSION] ✅ Hafıza mühürlendi! userId: ${userId}`);
            console.log(`[BRAIN ASCENSION] Özet: ${summary.substring(0, 100)}...`);

            // Kişilik profili güncelle
            const emotionStateForProfile = userEmotions.get(userId);
            await updateUserProfile(userId, transcript, emotionStateForProfile);

            // Pattern memory güncelle
            const transcriptDataForPattern = sessionTranscriptStore.get(userId);
            if (transcriptDataForPattern) {
                const konular = trackSessionTopics(transcriptDataForPattern.fullTranscript);
                const emotionState = userEmotions.get(userId);

                // #27 — BEDEN DİLİ PUANI hesapla (emotion_logs jestlerinden)
                let bedenDiliPuan = 50; // başlangıç nötr
                try {
                    if (activeSessionId) {
                        const { data: jestLogs } = await supabase
                            .from('emotion_logs')
                            .select('jestler')
                            .eq('session_id', activeSessionId);
                        if (jestLogs && jestLogs.length > 0) {
                            let puan = 50;
                            jestLogs.forEach(log => {
                                const j = log.jestler || {};
                                if (j.kas_catma)                         puan -= 1;
                                if (j.gozyasi_izi)                       puan -= 2;
                                if (j.dudak_sikistirma)                  puan -= 1;
                                if (j.bas_egme)                          puan -= 1;
                                if (j.goz_temasi === 'düşük')            puan -= 2;
                                if (j.omuz_durusu === 'düşük')           puan -= 2;
                                if (j.goz_temasi === 'yüksek')           puan += 2;
                                if (j.omuz_durusu === 'yüksek')          puan += 2;
                                if (j.genel_vucut_dili === 'açık')       puan += 3;
                                if (j.genel_vucut_dili === 'kapalı')     puan -= 3;
                            });
                            bedenDiliPuan = Math.max(0, Math.min(100, Math.round(50 + (puan - 50) / jestLogs.length * 10)));
                        }
                    }
                } catch (e) { /* beden dili hesap hatası → 50 kullan */ }

                await updatePatternMemory(userId, {
                    trend: emotionState?.trend || 'stabil',
                    konular,
                    dominantDuygu: emotionState?.dominant_duygu || 'sakin',
                    bedenDiliPuan
                });
                sessionTranscriptStore.delete(userId);
            }
        } catch (err) {
            console.error('[BRAIN ASCENSION] ❌ Özetleme hatası:', err.message);
        }

        // Seans bitti, ID'yi sıfırla
        activeSessionId = null;
    }

    res.json({});
});

// ─── LOCAL MEMORY ENDPOINT ─────────────────────────────────
app.post('/save-local-memory', async (req, res) => {
    const { userId, transcript, bodyLanguageData } = req.body;

    if (!userId || !transcript || transcript.length < 50) {
        return res.sendStatus(200);
    }

    console.log(`[LOCAL MEMORY] Özetleniyor... userId: ${userId}`);
    try {
        // #4 — AÇIKLIK SKORU HESAPLA
        let aciklikSkoru = 50; // baseline
        if (bodyLanguageData) {
            const { goz_temasi, omuz_durusu, genel_vucut_dili, gulume_tipi, bas_egme } = bodyLanguageData;
            if (genel_vucut_dili === 'kapalı') aciklikSkoru -= 2;
            if (goz_temasi === 'düşük') aciklikSkoru -= 1;
            if (gulume_tipi === 'gerçek' || gulume_tipi === 'sosyal') aciklikSkoru += 2;
            if (genel_vucut_dili === 'açık') aciklikSkoru += 2;
            if (omuz_durusu === 'yüksek') aciklikSkoru += 1;
        }
        aciklikSkoru = Math.max(0, Math.min(100, aciklikSkoru)); // 0-100 arasında tut

        const summaryResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Kullanıcı ile yapılan konuşmayı analiz et ve şu bilgileri kısa maddeler halinde özetle:\n- Kullanıcının adı (varsa)\n- Temel endişeleri ve sorunları\n- Kişilik özellikleri ve ruh hali\n- Lyra'nın bir dahaki seferde hatırlaması gereken önemli detaylar\nMaksimum 150 kelime.`
                },
                { role: 'user', content: `Konuşma:\n${transcript}` }
            ],
            max_tokens: 250
        });

        const summary = summaryResponse.choices[0].message.content;
        const memoryWithScore = `${summary}\n\n[Bu Seansta Açıklık Skoru: ${aciklikSkoru}/100]`;
        await saveMemory(userId, memoryWithScore);
        console.log(`[LOCAL MEMORY] ✅ Hafıza başarıyla kaydedildi! (Açıklık: ${aciklikSkoru}/100)`);
        console.log(`[LOCAL MEMORY] Özet: ${summary.substring(0, 100)}...`);
    } catch (err) {
        console.error('[LOCAL MEMORY] ❌ Özetleme hatası:', err.message);
    }

    res.sendStatus(200);
});

// ─── CUSTOM LLM ENDPOINT (VAPI BEYİN) ─────────────────────
app.post('/api/chat/completions', async (req, res) => {
    try {
        const { messages, model, temperature, max_tokens, call } = req.body;
        console.log(`[CUSTOM LLM] İstek alındı! Gelen mesaj sayısı: ${messages?.length}`);

        // Serverless ortamda activeSessionUserId güvenilmez — Vapi'nin call.assistantOverrides'ından al
        const userId = call?.assistantOverrides?.variableValues?.userId || activeSessionUserId;
        console.log(`[CUSTOM LLM] Kullanıcı ID: ${userId}`);

        const userMemory = await getMemory(userId);
        const enrichedMessages = [...messages];

        // #15 — Özel İsimler Hafızasını inject et
        let isimInjection = '';
        try {
            const { data: profileRow } = await supabase.from('memories').select('user_profile').eq('user_id', userId).single();
            const ozelIsimler = profileRow?.user_profile?.ozel_isimler || {};
            if (Object.keys(ozelIsimler).length > 0) {
                const isimStr = Object.entries(ozelIsimler).map(([k, v]) => `${k}: ${v}`).join(', ');
                isimInjection = `\n\n[KULLANICININ YAKIN KİŞİLERİ]: ${isimStr}. Bu isimleri sohbette doğal şekilde kullan, kişisel bağlantı kur.`;
            }
        } catch { /* profil yükleme başarısız */ }

        // RAG — Bilgi Bankası Knowledge Injection (Advanced)
        let knowledgeInjection = '';
        try {
            const lastUserMsg = messages?.[messages.length - 1]?.content || '';
            if (lastUserMsg.length > 10) {
                // Retrieve relevant knowledge from knowledge_sources table
                const response = await fetch(`http://localhost:${port}/retrieve-knowledge-advanced?userId=${userId}&query=${encodeURIComponent(lastUserMsg.substring(0, 100))}&limit=5`);
                const { insights } = await response.json();

                if (insights && insights.length > 0) {
                    const insightTexts = insights.map((i, idx) => {
                        const srcEmoji = {
                            'book': '📚',
                            'video': '🎥',
                            'technique': '🧠',
                            'article': '📄',
                            'wiki': '📖',
                            'research': '🔬'
                        }[i.source_type] || '📌';

                        const relevanceBar = '█'.repeat(Math.ceil(i.relevance * 5)) + '░'.repeat(5 - Math.ceil(i.relevance * 5));
                        return `${srcEmoji} ${i.title} (${i.author})\n   ${i.summary}\n   Relevance: ${relevanceBar} ${Math.round(i.relevance * 100)}%`;
                    }).join('\n\n');

                    knowledgeInjection = `\n\n[LYRA'NIN BILGI BANKASI — Önerilen Kaynaklar]:\nSon konunuzla ilgili bu kaynakları tavsiye ediyorum:\n\n${insightTexts}\n\nBu kaynakları önerdiğiniz soruna uygulamaya çalışalım mı?`;
                    console.log(`[RAG] ${insights.length} bilgi kaynağı inject edildi (avg relevance: ${(insights.reduce((s, i) => s + i.relevance, 0) / insights.length).toFixed(2)})`);
                }
            }
        } catch (e) {
            console.warn('[RAG INJECTION] Hata:', e.message);
        }

        const systemIdx = enrichedMessages.findIndex(m => m.role === 'system');
        if (userMemory) {
            let fullInjection = `\n\n[BU KULLANICI HAKKINDAKİ HAFIZA]:\n${userMemory}\n\nBu bilgileri doğal şekilde kullan, asla "seni hatırlıyorum" diyerek açıkça belirtme.${isimInjection}`;

            // Knowledge bankası ekle
            if (knowledgeInjection) {
                fullInjection += knowledgeInjection;
            }

            if (systemIdx !== -1) {
                enrichedMessages[systemIdx] = { ...enrichedMessages[systemIdx], content: enrichedMessages[systemIdx].content + fullInjection };
            } else {
                enrichedMessages.unshift({ role: 'system', content: fullInjection });
            }
            console.log(`[CUSTOM LLM] 🧠 Hafıza inject edildi! userId: ${userId}${isimInjection ? ' + isimler' : ''}${knowledgeInjection ? ' + RAG' : ''}`);
        } else if (isimInjection || knowledgeInjection) {
            let combined = isimInjection + (knowledgeInjection || '');
            if (systemIdx !== -1) {
                enrichedMessages[systemIdx] = { ...enrichedMessages[systemIdx], content: enrichedMessages[systemIdx].content + combined };
            } else {
                enrichedMessages.unshift({ role: 'system', content: combined });
            }
        }

        // userId eşleşmezse activeSessionUserId ile de dene
        const userState = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);
        console.log(`[KURAL MOTORU] userState var mı: ${!!userState} | userEmotions boyutu: ${userEmotions.size} | userId: ${userId}`);
        if (userState) {
            const { son_analiz, trend, dominant_duygu, aktif_sinyal, gecmis, yogunluk_ort } = userState;
            console.log(`[KURAL MOTORU] son_analiz: ${son_analiz?.duygu} | yogunluk: ${son_analiz?.yogunluk} | guven: ${son_analiz?.guven}`);

            // Transcript verileri hepsi için gerekli
            const transcriptState = sessionTranscriptStore.get(userId);

            const l1 = buildLayer1Rules(son_analiz, aktif_sinyal, userId, transcriptState);
            const l2 = buildLayer2Rules(trend, dominant_duygu, gecmis || [], transcriptState);
            const l3 = buildLayer3Rules(userMemory, son_analiz, userId);

            // L4: Söz-yüz çelişkisi
            const l4 = buildLayer4Rules(transcriptState?.lastSegment, son_analiz, gecmis);

            // L5: Sessizlik
            const l5 = buildLayer5Rules(transcriptState?.silenceDuration, transcriptState?.sessizlikTipi, son_analiz?.duygu);

            // L6: Seanslar arası pattern
            let l6 = '';
            try {
                const { data: memRow } = await supabase
                    .from('memories')
                    .select('pattern_memory, session_history')
                    .eq('user_id', userId)
                    .single();
                const patternMemory = memRow?.pattern_memory || {};
                const sessionHistory = memRow?.session_history || [];
                l6 = buildLayer6Rules(patternMemory, son_analiz, dominant_duygu, sessionHistory);
            } catch { /* pattern_memory yoksa geç */ }

            // L7: Seans momentum & profil adaptasyonu
            let l7 = '';
            try {
                const { data: profileRow } = await supabase
                    .from('memories')
                    .select('user_profile')
                    .eq('user_id', userId)
                    .single();
                const userProfile = profileRow?.user_profile || {};
                l7 = buildLayer7Rules(userProfile, son_analiz, gecmis, transcriptState);
            } catch { /* profil yoksa geç */ }

            const tumKurallar = [l1, l2, l3, l4, l5, l6, l7].filter(Boolean).join(' ');

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

        const response = await openai.chat.completions.create({
            model: model || 'gpt-4o',
            messages: enrichedMessages,
            stream: true,
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 500,
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for await (const chunk of response) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
        console.log(`[CUSTOM LLM] 🧠 Cevap başarıyla akıtıldı.`);
    } catch (error) {
        console.error("[CUSTOM LLM] ❌ Hata:", error);
        res.status(500).json({ error: error.message });
    }
});

// ─── HIPOTEZ MOTORU (Davranış Tahmini) ────────────────────────────────
app.post('/hypothesis', async (req, res) => {
    try {
        const { userId, currentTopic, currentDuygu, sessionId } = req.body;
        if (!userId || !currentTopic) {
            return res.json({ error: 'userId ve currentTopic gerekli' });
        }

        // Pattern memory ve history getir
        const { data: memRow } = await supabase
            .from('user_profile')
            .select('pattern_memory')
            .eq('user_id', userId)
            .single();

        const patternMemory = memRow?.pattern_memory || {};

        // Son 10 duygu analizi getir
        const { data: emotionHistory } = await supabase
            .from('emotion_logs')
            .select('duygu, yogunluk')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(10);

        const gecmis = emotionHistory || [];

        // Hipotez yap
        const hypothesis = buildHypothesis(userId, currentTopic, currentDuygu, patternMemory, gecmis);

        // Emotion log'a kaydet (fire-and-forget)
        if (sessionId) {
            supabase.from('emotion_logs')
                .update({
                    hypothesis_data: hypothesis,
                    hypothesis_id: crypto.randomUUID()
                })
                .eq('session_id', sessionId)
                .then(() => {});
        }

        console.log(`[HYPOTHESIS] Konu: ${currentTopic} | Tahmin: ${hypothesis.predicted_emotion} (${Math.round(hypothesis.confidence*100)}%) | Risk: ${hypothesis.risk_score} | Müdahale: ${hypothesis.suggested_intervention}`);
        res.json({ hypothesis });
    } catch (err) {
        console.error('[HYPOTHESIS] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── HIPOTEZ DOĞRULUĞU TRACKING ────────────────────────────────────────
app.post('/hypothesis-accuracy', async (req, res) => {
    try {
        const { userId, predicted_emotion, actual_emotion, confidence } = req.body;
        if (!userId || !predicted_emotion || !actual_emotion) {
            return res.json({ error: 'userId, predicted_emotion, actual_emotion gerekli' });
        }

        const was_correct = predicted_emotion.toLowerCase() === actual_emotion.toLowerCase();

        const { error } = await supabase.from('hypothesis_accuracy').insert([{
            user_id: userId,
            predicted_emotion,
            actual_emotion,
            confidence: confidence || 0.5,
            was_correct,
            created_at: new Date().toISOString()
        }]);

        if (error) {
            console.error('[HYPOTHESIS ACCURACY] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        // Accuracy hesapla (son 10)
        const { data: recentAccuracy } = await supabase
            .from('hypothesis_accuracy')
            .select('was_correct')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        const accuracy = recentAccuracy
            ? (recentAccuracy.filter(a => a.was_correct).length / recentAccuracy.length * 100).toFixed(1)
            : 0;

        console.log(`[HYPOTHESIS ACCURACY] ${predicted_emotion} vs ${actual_emotion}: ${was_correct ? '✓' : '✗'} | Genel: ${accuracy}%`);
        res.json({ success: true, was_correct, accuracy });
    } catch (err) {
        console.error('[HYPOTHESIS ACCURACY] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── RAG: INSIGHT KAYIT + EMBEDDING ─────────────────────────────────────
app.post('/save-insight', async (req, res) => {
    try {
        const { userId, insights } = req.body;
        if (!userId || !Array.isArray(insights) || insights.length === 0) {
            return res.json({ error: 'userId ve insights array gerekli', saved: 0 });
        }

        let savedCount = 0;
        for (const insight of insights) {
            try {
                // Embedding yap (ada-002)
                const embeddingResp = await openai.embeddings.create({
                    model: 'text-embedding-ada-002',
                    input: `${insight.title}. ${insight.content}`
                });

                const embedding = embeddingResp.data[0].embedding;

                // Supabase'e kaydet
                const { error } = await supabase.from('knowledge_bank').insert([{
                    user_id: userId,
                    content_type: insight.type || 'insight',
                    title: insight.title,
                    content: insight.content,
                    embedding: embedding,
                    relevance_score: insight.relevance_score || 0.7,
                    tags: insight.tags || [],
                    emotion_context: insight.emotion_context || 'neutral',
                    created_at: new Date().toISOString()
                }]);

                if (!error) {
                    savedCount++;
                }
            } catch (e) {
                console.warn(`[RAG] Insight kayıt hatası: ${e.message}`);
            }
        }

        console.log(`[RAG] ${savedCount}/${insights.length} insight kaydedildi`);
        res.json({ success: savedCount > 0, saved: savedCount, total: insights.length });
    } catch (err) {
        console.error('[RAG SAVE] Hata:', err.message);
        res.json({ error: err.message, saved: 0 });
    }
});

// ─── RAG: VECTOR SIMILARITY SEARCH ──────────────────────────────────────
app.get('/retrieve-knowledge', async (req, res) => {
    try {
        const { userId, query, limit } = req.query;
        if (!userId || !query) {
            return res.json({ insights: [] });
        }

        const queryLimit = Math.min(parseInt(limit) || 3, 10);

        // Query'yi embedding'e çevir
        const queryEmbeddingResp = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: query
        });

        const queryEmbedding = queryEmbeddingResp.data[0].embedding;

        // Vector similarity search (pgvector)
        const { data: results } = await supabase.rpc('match_knowledge_bank', {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: queryLimit,
            p_user_id: userId
        }).then(d => ({ data: d || [], error: null }))
          .catch(() => {
              // Fallback: embedding olmadan doğrudan ara (vector index yoksa)
              return supabase.from('knowledge_bank')
                  .select('*')
                  .eq('user_id', userId)
                  .like('content', `%${query}%`)
                  .limit(queryLimit)
                  .then(d => ({ data: d.data || [], error: null }));
          });

        // Response format
        const insights = (results || []).map(item => ({
            id: item.id,
            title: item.title,
            content: item.content,
            type: item.content_type,
            relevance: item.similarity || item.relevance_score || 0.7,
            emotion: item.emotion_context,
            source_session: item.created_at
        }));

        console.log(`[RAG] ${insights.length} insight döndürüldü (query: "${query}")`);
        res.json({ insights, query });
    } catch (err) {
        console.error('[RAG RETRIEVE] Hata:', err.message);
        res.json({ insights: [], error: err.message });
    }
});

// ─── RAG: AUTO-EXTRACTION AT SESSION END ────────────────────────────────
app.post('/end-session', async (req, res) => {
    try {
        const { userId, sessionId, transcript } = req.body;
        if (!userId || !transcript || transcript.length < 100) {
            return res.json({ insights_extracted: 0 });
        }

        // Get latest emotion analysis
        const { data: lastEmotion } = await supabase
            .from('emotion_logs')
            .select('duygu')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        const lastDuygu = lastEmotion?.duygu || 'sakin';

        // Extract knowledge automatically
        const insights = await extractKnowledge(transcript, null, lastDuygu);

        if (insights.length > 0) {
            // Save insights with embedding
            const saveResp = await fetch(`http://localhost:${port}/save-insight`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    insights: insights.map(i => ({
                        ...i,
                        type: i.type || 'insight'
                    }))
                })
            });
            const { saved } = await saveResp.json();
            console.log(`[RAG END-SESSION] ${saved} insight extract ve kaydedildi`);
            return res.json({ insights_extracted: saved, total: insights.length });
        }

        res.json({ insights_extracted: 0 });
    } catch (err) {
        console.error('[RAG END-SESSION] Hata:', err.message);
        res.json({ error: err.message, insights_extracted: 0 });
    }
});

// ─── KRİZ SONRASI KONTROL + PATTERN LEARNING (Cron) ──────────────────
app.get('/cron-checkin', async (req, res) => {
    try {
        const onceki24h = new Date(Date.now() - 24*60*60*1000).toISOString();
        const { data: krizKayitlari } = await supabase
            .from('memories')
            .select('user_id, kriz_log')
            .not('kriz_log', 'is', null)
            .gte('updated_at', onceki24h);

        const kontrol = (krizKayitlari || []).filter(k => k.kriz_log?.tarih);
        console.log(`[CRON] ${kontrol.length} kriz kaydı kontrol edildi.`);

        // PATTERN LEARNING: Tüm kullanıcılar için
        const { data: users } = await supabase.from('user_profile').select('user_id');
        let patternUpdated = 0;

        for (const user of users || []) {
            const userId = user.user_id;
            // Son 10 seansı oku
            const { data: emotions } = await supabase
                .from('emotion_logs')
                .select('konu, duygu, yogunluk')
                .eq('user_id', userId)
                .order('timestamp', { ascending: false })
                .limit(10);

            if (!emotions || emotions.length < 2) continue;

            // Konu → duygu frequency mapping
            const topicEmotions = {};
            const trends = [];
            let prevYogunluk = null;

            emotions.reverse().forEach((e, idx) => {
                if (e.konu) {
                    if (!topicEmotions[e.konu]) {
                        topicEmotions[e.konu] = { duygu: [], hit: 0, yogunluk: [] };
                    }
                    topicEmotions[e.konu].duygu.push(e.duygu);
                    topicEmotions[e.konu].hit += 1;
                    topicEmotions[e.konu].yogunluk.push(yogunlukToNum(e.yogunluk));
                }

                // Trend: yogunluk arttı mı?
                if (prevYogunluk !== null) {
                    const currentYog = yogunlukToNum(e.yogunluk);
                    if (currentYog > prevYogunluk + 10) trends.push('kötüleşiyor');
                    else if (currentYog < prevYogunluk - 10) trends.push('iyileşiyor');
                    else trends.push('stabil');
                }
                prevYogunluk = yogunlukToNum(e.yogunluk);
            });

            // Pattern memory güncelle
            const updatedPattern = {
                tetikleyici_konular: topicEmotions,
                seans_trendi: trends,
                updated_at: new Date().toISOString()
            };

            await supabase.from('user_profile')
                .update({ pattern_memory: updatedPattern })
                .eq('user_id', userId);

            patternUpdated++;
        }

        console.log(`[CRON] ${patternUpdated} kullanıcı için pattern learning tamamlandı.`);
        res.json({ kontrol_edilen: kontrol.length, patterns_learned: patternUpdated, tarih: new Date().toISOString() });
    } catch (e) {
        console.error('[CRON] Hata:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── YÜZDEN DUYGU ANALİZİ (GPT-4o Vision — Zengin) ────────
// Rate limiter: max 30 istek/dk per userId veya IP
const emotionRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.body?.userId || req.ip,
    handler: (req, res) => {
        res.status(429).json({ duygu: 'sakin', guven: 0, yuz_var: false, rate_limited: true });
    },
    skip: (req) => !req.body?.userId // userId yoksa atla
});

// ── HUME SES YAKALAMA RATE LIMITER ──
const humeRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.body?.userId || req.ip,
    handler: (req, res) => {
        res.status(429).json({ hume_scores: null });
    },
    skip: (req) => !req.body?.userId
});

// ── MULTER SES DOSYASI YÜKLEMESİ ──
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB max
});

// ── MEDİAPİPE LANDMARK CONTEXT BUILDER ──
const buildLandmarkContext = (lm) => {
    if (!lm) return '';

    const signals = [];
    let emotionScore = {};

    // Kaş analizi
    if (lm.brow_down_left > 0.5 || lm.brow_down_right > 0.5) {
        signals.push('🤨 KAŞLAR BELIRGIN ÇATIKç: Öfke/sinir/konsantrasyon');
        emotionScore['anger'] = (emotionScore['anger'] || 0) + 0.3;
        emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + 0.2;
    }

    // Göz açıklığı
    const eyeAvg = (lm.eye_openness_left + lm.eye_openness_right) / 2;
    if (eyeAvg < 0.2) {
        signals.push('😴 GÖZLER KAPALI: Çok ağır yorgunluk, uyku deprivation');
        emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.25;
    } else if (eyeAvg < 0.35) {
        signals.push('😔 GÖZLER YARALI AÇIK: Hafif yorgunluk/melankolik/üzüntü');
        emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.15;
    } else if (eyeAvg > 0.8) {
        signals.push('😲 GÖZLER GENIŞ AÇIK: Şok/korku/inanmamışlık');
        emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.3;
        emotionScore['surprise'] = (emotionScore['surprise'] || 0) + 0.25;
    }

    // Ağız analizi
    if (lm.mouth_openness > 0.4) {
        signals.push('😮 AĞIZ AÇIK: Şok/korku/ağlama başlangıcı');
        emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.2;
        emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.15;
    } else if (lm.mouth_openness < 0.02) {
        signals.push('😠 AĞIZ KAPALI/SIKI: Kontrole çalışma/bastırma/determinasyon');
        emotionScore['anger'] = (emotionScore['anger'] || 0) + 0.2;
        emotionScore['determination'] = (emotionScore['determination'] || 0) + 0.2;
    }

    // Gülümseme analizi
    if (lm.lip_corner_pull > 0.6 && lm.cheek_raise > 0.4) {
        signals.push('😊 GERÇEKEKLİ GÜLÜMSEME: Joyeux authentique (Duchenne gülümsemesi)');
        emotionScore['joy'] = (emotionScore['joy'] || 0) + 0.35;
    } else if (lm.lip_corner_pull > 0.4 && lm.cheek_raise < 0.1) {
        signals.push('😐 ZORUNLU GÜLÜMSEME: Sosyal, içinde boşluk hissediyor');
        emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.1;
    }

    // Çene analizi
    if (lm.jaw_drop > 0.7) {
        signals.push('😢 ÇENEċ DÜŞÜK: Ağlama/şok/travma tepkisi');
        emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.3;
        emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.15;
    }

    // Baş hareketi
    if (Math.abs(lm.head_tilt) > 0.06) {
        const dir = lm.head_tilt > 0 ? 'sola' : 'sağa';
        signals.push(`🔄 BAŞ EĞİKçL İ (${dir}): Şüphe/merak/savunma/sorgulanma`);
        emotionScore['uncertainty'] = (emotionScore['uncertainty'] || 0) + 0.15;
    }

    // Burun kıvırma
    if (lm.nose_wrinkle > 0.35) {
        signals.push('😒 BURUN KIVRMA: Tiksinme/iğrenme/hoşlanmama');
        emotionScore['disgust'] = (emotionScore['disgust'] || 0) + 0.3;
    }

    // Kaş indirme (endişe)
    if ((lm.brow_down_left > 0.3 || lm.brow_down_right > 0.3) && eyeAvg > 0.4) {
        signals.push('😟 KAŞ-GÖZ KOMBİNASYONU: Endişe/kaygı/stres');
        emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + 0.25;
    }

    // Advanced facial analysis signals (micro-expressions, hand-face, blink)
    if (lm.micro_expressions) {
        const me = lm.micro_expressions;
        if (me.dominant_emotion !== 'neutral' && me.emotion_intensity > 0.3) {
            signals.push(`🎭 MİKRO İFADE: ${me.dominant_emotion.toUpperCase()} (${(me.emotion_intensity * 100).toFixed(0)}% yoğunluk) - ${me.authenticity_score}`);
            emotionScore[me.dominant_emotion] = (emotionScore[me.dominant_emotion] || 0) + me.emotion_intensity;
        }
    }

    if (lm.hand_face_interaction) {
        const hfi = lm.hand_face_interaction;
        if (hfi.stress_indicators && hfi.stress_indicators.length > 0) {
            signals.push(`🤚 EL HAREKETİ: ${hfi.stress_indicators.join(' | ')}`);
            if (hfi.stress_score > 0.5) {
                emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + hfi.stress_score;
            }
        }
        if (hfi.deception_likelihood === 'high') {
            signals.push(`⚠️ YALAN SINYALI ÇOK YÜKSEK: El yüze yakın (mouth/nose)`);
            emotionScore['deception'] = (emotionScore['deception'] || 0) + 0.4;
        }
    }

    if (lm.blink_analysis) {
        const ba = lm.blink_analysis;
        if (ba.signals && ba.signals.length > 0) {
            signals.push(`👁️ KIRPıŞ ANALIZI: ${ba.signals.join(' | ')}`);
            if (ba.cognitive_load > 0.6) {
                emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + 0.2;
            }
        }
    }

    if (signals.length === 0) return '';

    // En yüksek duyguyu bul
    const topEmotion = Object.entries(emotionScore)
        .sort((a, b) => b[1] - a[1])[0];

    return `\n\n🔍 MEDİAPİPE FACIAL LANDMARK ANALİZİ (GERÇEKLİ ZAMAN, KAMERAYI İNCELEME):\n${signals.join('\n')}\n\n💡 PREDICTED EMOTION: ${topEmotion ? topEmotion[0].toUpperCase() : 'neutral'} (confidence: ${topEmotion ? (topEmotion[1] * 100).toFixed(0) : 0}%)\n\n⚠️ KURAL: Landmark analizi GPT-4o görüntü analizinden DAHAvü GÜVENİLİR. Çelişki varsa landmarks'a öncelik ver.`;
};

app.post('/analyze-emotion', emotionRateLimit, async (req, res) => {
    try {
        const { imageBase64, userId, sessionId, landmarks } = req.body;

        if (!imageBase64) return res.json({ duygu: 'sakin', guven: 0, yuz_var: false });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Sen bir yüz analizi sistemisin. Görüntüde bir insan yüzü var mı yok mu — bunu dürüstçe belirle.

YÜZ VAR MI KURALI (EN ÖNEMLİ):
- Görüntüde NET olarak bir insan yüzü (göz, burun, ağız) görünmüyorsa → yuz_var: false, guven: 0
- Kamera kapalı, karanlık, el kapatmış, nesne var → yuz_var: false
- Sadece gerçekten yüz görünüyorsa → yuz_var: true
- Şüphe durumunda → yuz_var: false (uydurma, güvenilir ol)

DUYGU ANALİZİ (sadece yuz_var: true ise):
- Kaş çatma, dar gözler, sıkılmış çene = sinirli
- Sarkık yüz, düşük göz teması = üzgün/yorgun
- Geniş gözler, gergin alın = endişeli/korkmuş
- Rahat yüz, açık göz teması = sakin
- Gülümseme (yanak kası aktifse gerçek, değilse sosyal) = mutlu

GÜVEN SKORU:
- Net yüz, iyi ışık → 75-95
- Biraz bulanık/karanlık ama yüz var → 50-74
- Yüz yok → 0

${buildLandmarkContext(landmarks)}

Yalnızca geçerli JSON döndür:
{"duygu":"mutlu|üzgün|endişeli|korkmuş|sakin|şaşırmış|sinirli|yorgun","yogunluk":"düşük|orta|yüksek","enerji":"canlı|normal|yorgun","jestler":{"kas_catma":false,"goz_temasi":"yüksek|normal|düşük","goz_kirpma_hizi":"hızlı|normal|yavaş","gulümseme_tipi":"gerçek|sosyal|yok","omuz_durusu":"yüksek|normal|düşük","cene_gerginligi":"yüksek|orta|düşük","dudak_sikistirma":false,"kasin_pozisyonu":"yukari|normal|asagi|catan","goz_kapagi_agirlik":"normal|hafif_agir|belirgin_agir"},"genel_vucut_dili":"açık|nötr|kapalı","yuz_soluklugu":false,"ortam":{"mekan":"ev|ofis|dışarı|araba|bilinmiyor","tehlike_var":false,"zarar_sinyali":false},"gorunum_ozeti":"kısa bir cümle","guven":85,"yuz_var":true,"timestamp":0}`
                    },
                    {
                        type: 'image_url',
                        image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'auto' }
                    }
                ]
            }],
            max_tokens: 600
        });

        let result = { duygu: 'sakin', guven: 0, yuz_var: false };
        try {
            let raw = response.choices[0].message.content.trim().replace(/```json|```/g, '');
            // Truncate olan JSON'ı düzelt: ilk { ile son } arasını al
            const jsonStart = raw.indexOf('{');
            const jsonEnd = raw.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                raw = raw.slice(jsonStart, jsonEnd + 1);
            }
            result = JSON.parse(raw);
            result.timestamp = Date.now();
            console.log(`[DUYGU PARSE] OK: ${result.duygu} yuz:${result.yuz_var} guven:${result.guven}`);
        } catch (parseErr) {
            console.warn('[DUYGU PARSE] Hata:', parseErr.message, '| raw:', response.choices[0]?.message?.content?.slice(0, 100));
        }

        // ────── ADVANCED FACIAL ANALYSIS (Micro-expressions, Hand-Face, Blink) ──────
        let advancedAnalysis = null;
        if (landmarks) {
            try {
                // Extract advanced features from landmarks if available
                // Note: In production, these would come from MediaPipe detection
                // For now, we use the basic landmarks to compute advanced signals
                const testHandLandmarks = landmarks.hand_landmarks || null;
                const testEyeData = {
                    blink_rate: landmarks.blink_detected ? 0.25 : 0.18,
                    pupil_dilation: 0.08,
                    gaze_direction: { x: 0, y: 0 }
                };
                advancedAnalysis = advancedFacialAnalysis(
                    landmarks, // Array would come from MediaPipe in production
                    testHandLandmarks,
                    testEyeData
                );
                result.advanced_facial = advancedAnalysis;
                console.log(`[ADVANCED-FACIAL] stress:${(advancedAnalysis.overall_stress_level*100).toFixed(0)}% | confidence:${(advancedAnalysis.confidence*100).toFixed(0)}%`);
            } catch (advErr) {
                console.warn('[ADVANCED-FACIAL] Analiz hatası:', advErr.message);
            }
        }

        if (userId && result.yuz_var) {
            // userEmotions Map'i güncelle (gecmis: tam analiz objesi, jestler dahil)
            const mevcut = userEmotions.get(userId) || { gecmis: [] };
            const yeniGecmis = [...mevcut.gecmis, {
                duygu: result.duygu,
                yogunluk: result.yogunluk,
                enerji: result.enerji,
                guven: result.guven,
                jestler: result.jestler || null,
                timestamp: result.timestamp
            }].slice(-10);

            const guncel = {
                gecmis: yeniGecmis,
                trend: calculateTrend(yeniGecmis),
                dominant_duygu: getDominantDuygu(yeniGecmis),
                yogunluk_ort: Math.round(yeniGecmis.reduce((s, a) => s + yogunlukToNum(a.yogunluk), 0) / yeniGecmis.length),
                aktif_sinyal: getAktifSinyaller(result.jestler),
                son_analiz: result
            };
            userEmotions.set(userId, guncel);
            console.log(`[DUYGU] ${userId}: ${result.duygu} | yogunluk:${result.yogunluk} | trend:${guncel.trend} | sinyaller:${guncel.aktif_sinyal.join(',') || '-'}`);

            // emotion_logs'a kaydet — fire-and-forget
            const sid = sessionId || activeSessionId;
            if (sid) {
                supabase.from('emotion_logs').insert({
                    user_id: userId,
                    session_id: sid,
                    duygu: result.duygu,
                    yogunluk: result.yogunluk,
                    enerji: result.enerji,
                    jestler: result.jestler || null,
                    trend: guncel.trend,
                    guven: result.guven,
                    mediapipe_landmarks: landmarks || null,
                    yuz_soluklugu: result.yuz_soluklugu || false,
                    advanced_facial: advancedAnalysis || null
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

// ─── HUME SES ANALİZİ (48 Duygu, Prosody) ────────────────────────
app.post('/analyze-hume-voice', upload.single('audio'), humeRateLimit, async (req, res) => {
    try {
        const { userId } = req.body;
        const buf = req.file?.buffer;

        if (!buf || buf.length < 1000) {
            return res.json({ hume_scores: null });
        }

        const HUME_API_KEY = process.env.HUME_API_KEY;
        if (!HUME_API_KEY) {
            console.warn('[HUME] API key yoksa, skip.');
            return res.json({ hume_scores: null });
        }

        // FormData ile Hume'a gönder
        const fd = new FormData();
        fd.append('file', new Blob([buf], { type: req.file.mimetype }), 'audio.webm');
        fd.append('models', JSON.stringify({ prosody: { granularity: 'utterance' } }));

        const humeResp = await fetch('https://api.hume.ai/v0/stream/models', {
            method: 'POST',
            headers: { 'X-Hume-Api-Key': HUME_API_KEY },
            body: fd,
            signal: AbortSignal.timeout(8000)
        });

        if (!humeResp.ok) {
            console.warn(`[HUME] API error: ${humeResp.status}`);
            return res.json({ hume_scores: null });
        }

        const data = await humeResp.json();
        const emotions = data?.prosody?.predictions?.[0]?.emotions || [];

        if (!emotions.length) {
            return res.json({ hume_scores: null });
        }

        // Top 10 duyguyu sırayla say
        const sorted = [...emotions].sort((a, b) => b.score - a.score);

        // Valence (pozitif - negatif): mutluluk, merak, memnuniyet vs üzüntü, korku, öfke
        const posEmotions = ['Joy', 'Excitement', 'Contentment', 'Amusement', 'Pride', 'Love', 'Interest'];
        const negEmotions = ['Sadness', 'Fear', 'Anger', 'Disgust', 'Anxiety', 'Shame', 'Guilt'];
        const posScore = emotions
            .filter(e => posEmotions.includes(e.name))
            .reduce((s, e) => s + e.score, 0);
        const negScore = emotions
            .filter(e => negEmotions.includes(e.name))
            .reduce((s, e) => s + e.score, 0);

        // Arousal (enerji): Excitement, Anger, Fear, Surprise vs Calmness, Contentment
        const highArousal = ['Excitement', 'Anger', 'Fear', 'Surprise'];
        const arousScore = emotions
            .filter(e => highArousal.includes(e.name))
            .reduce((s, e) => s + e.score, 0);

        const round = (v) => Math.round(v * 100) / 100;

        const humeScores = {
            top_emotions: sorted.slice(0, 10).map(e => ({
                name: e.name,
                score: round(e.score)
            })),
            all_scores: Object.fromEntries(
                emotions.map(e => [e.name, round(e.score)])
            ),
            dominant: sorted[0]?.name || 'Neutral',
            valence: round(posScore - negScore),           // -1.0 to +1.0
            arousal: round(arousScore),                     // 0 to +1.0
            analyzed_at: Date.now()
        };

        // Supabase emotion_logs'a hume_scores ekle (fire-and-forget)
        if (userId) {
            supabase
                .from('emotion_logs')
                .select('id')
                .eq('user_id', userId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single()
                .then(({ data: row, error: selectErr }) => {
                    if (selectErr) {
                        console.warn('[HUME] Son emotion_log bulunamadı:', selectErr.message);
                        return;
                    }
                    if (row?.id) {
                        supabase
                            .from('emotion_logs')
                            .update({ hume_scores: humeScores })
                            .eq('id', row.id)
                            .then(({ error: updateErr }) => {
                                if (updateErr) console.error('[HUME SAVE] Hata:', updateErr.message);
                            });
                    }
                })
                .catch(err => console.error('[HUME] Query error:', err.message));
        }

        console.log(`[HUME] ${humeScores.dominant} | valence:${humeScores.valence} | arousal:${humeScores.arousal}`);
        res.json({ hume_scores: humeScores });
    } catch (err) {
        console.error('[HUME] Hata:', err.message);
        res.json({ hume_scores: null });
    }
});

// ─── #17: DÜŞÜNCE KAYDI (CBT — Bilişsel Davranışçı Terapi) ─────────
app.post('/record-thought', async (req, res) => {
    try {
        const { userId, automatic_thought, evidence_for, evidence_against, realistic_response } = req.body;
        if (!userId || !automatic_thought) {
            return res.json({ error: 'userId ve automatic_thought gerekli' });
        }

        // Supabase'e CBT kaydı ekle (thought_records tablosu)
        const { data, error } = await supabase.from('thought_records').insert([{
            user_id: userId,
            automatic_thought: automatic_thought,
            evidence_for: evidence_for || '',
            evidence_against: evidence_against || '',
            realistic_response: realistic_response || '',
            recorded_at: new Date().toISOString()
        }]);

        if (error) {
            console.error('[CBT] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        // Son eklenen kaydı döndür
        console.log(`[#17 CBT] Düşünce kaydedildi: "${automatic_thought.substring(0,50)}..."`);
        res.json({ success: true, record: data?.[0] || {} });
    } catch (err) {
        console.error('[#17 CBT] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #17: DÜŞÜNCE KAYITLARINI GETIR ─────────────────────────────────
app.get('/thought-records/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('thought_records')
            .select('*')
            .eq('user_id', userId)
            .order('recorded_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('[CBT] Supabase hata:', error.message);
            return res.json({ records: [] });
        }

        console.log(`[#17 CBT] ${data?.length || 0} düşünce kaydı döndürüldü`);
        res.json({ records: data || [] });
    } catch (err) {
        console.error('[#17 CBT] Hata:', err.message);
        res.json({ records: [] });
    }
});

// ─── #18: DEĞERLER KEŞFI (Values Discovery) ─────────────────────────
app.post('/discover-values', async (req, res) => {
    try {
        const { userId, selectedValues } = req.body;
        if (!userId || !Array.isArray(selectedValues)) {
            return res.json({ error: 'userId ve selectedValues gerekli' });
        }

        // Supabase'e değerler kaydet
        const { data, error } = await supabase.from('user_values').insert([{
            user_id: userId,
            values: selectedValues,
            discovered_at: new Date().toISOString()
        }]);

        if (error) {
            console.error('[#18 VALUES] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        // Profili güncelle: values_discovered = true
        await supabase.from('user_profile')
            .update({ values_discovered: true })
            .eq('user_id', userId);

        console.log(`[#18 VALUES] ${selectedValues.length} değer kaydedildi: ${selectedValues.slice(0,3).join(', ')}`);
        res.json({ success: true, values_saved: selectedValues.length });
    } catch (err) {
        console.error('[#18 VALUES] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #18: KULLANICININ DEĞERLERINI GETIR ────────────────────────────
app.get('/user-values/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('user_values')
            .select('*')
            .eq('user_id', userId)
            .order('discovered_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            return res.json({ values: [] });
        }

        res.json({ values: data?.values || [] });
    } catch (err) {
        res.json({ values: [] });
    }
});

// ─── #19: HAFTALIK MİNİ GÖREVLER (Homework) ──────────────────────────
app.post('/assign-homework', async (req, res) => {
    try {
        const { userId, sessionId, dominantEmotion, homework } = req.body;
        if (!userId || !homework) {
            return res.json({ error: 'userId ve homework gerekli' });
        }

        const homeworkTask = {
            title: homework.title || 'Mini Görev',
            description: homework.description || '',
            due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString(), // 7 gün
            emotion_context: dominantEmotion,
            difficulty: homework.difficulty || 'orta',
            completed: false
        };

        const { data, error } = await supabase.from('homework_tasks').insert([{
            user_id: userId,
            session_id: sessionId,
            task: homeworkTask,
            assigned_at: new Date().toISOString()
        }]);

        if (error) {
            console.error('[#19 HW] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        console.log(`[#19 HW] Görev atandı: "${homeworkTask.title}"`);
        res.json({ success: true, homework: homeworkTask });
    } catch (err) {
        console.error('[#19 HW] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #19: HAFTA GÖREVLERINI GETIR ────────────────────────────────────
app.get('/homework/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('homework_tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('completed', false)
            .order('assigned_at', { ascending: false })
            .limit(5);

        if (error) {
            return res.json({ tasks: [] });
        }

        console.log(`[#19 HW] ${data?.length || 0} görev döndürüldü`);
        res.json({ tasks: data || [] });
    } catch (err) {
        res.json({ tasks: [] });
    }
});

// ─── #19: GÖREVI TAMAMLA ─────────────────────────────────────────────
app.post('/complete-homework/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { error } = await supabase.from('homework_tasks')
            .update({ completed: true, completed_at: new Date().toISOString() })
            .eq('id', taskId);

        if (error) {
            return res.json({ error: error.message });
        }

        console.log(`[#19 HW] Görev tamamlandı: ${taskId}`);
        res.json({ success: true });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ─── #20: KRİZ SONRASI PROTOKOL (24-Hour Check-in) ──────────────────
app.post('/log-crisis', async (req, res) => {
    try {
        const { userId, severity, description, triggerTopic } = req.body;
        if (!userId) return res.json({ error: 'userId gerekli' });

        const crisis_record = {
            severity: severity || 'orta', // düşük/orta/yüksek/çok_yüksek
            description: description || 'Kriz tespit edildi',
            trigger_topic: triggerTopic,
            detected_at: new Date().toISOString(),
            followup_scheduled: true,
            followup_due: new Date(Date.now() + 24*60*60*1000).toISOString() // 24 saat sonra
        };

        const { error } = await supabase.from('crisis_logs').insert([{
            user_id: userId,
            crisis_data: crisis_record
        }]);

        if (error) {
            console.error('[#20 CRISIS] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        console.log(`[#20 CRISIS] Kriz kaydedildi (${severity}): ${description?.substring(0,40)}`);
        res.json({ success: true, followup_due: crisis_record.followup_due });
    } catch (err) {
        console.error('[#20 CRISIS] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #20: KRİZ TAKIBI ÖNEMLİ (Cron Job'ta kullanılır) ─────────────────
app.get('/crisis-followups-due/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const now = new Date().toISOString();

        const { data, error } = await supabase.from('crisis_logs')
            .select('*')
            .eq('user_id', userId)
            .lte('crisis_data->followup_due', now)
            .eq('crisis_data->followup_done', false)
            .order('crisis_data->detected_at', { ascending: false });

        if (error) {
            return res.json({ followups: [] });
        }

        console.log(`[#20 CRISIS] ${data?.length || 0} takip gerekli`);
        res.json({ followups: data || [] });
    } catch (err) {
        res.json({ followups: [] });
    }
});

// ─── #20: KRİZ TAKIP TAMAMLA ──────────────────────────────────────────
app.post('/complete-crisis-followup/:crisisId', async (req, res) => {
    try {
        const { crisisId } = req.params;
        const { followupResponse } = req.body;

        const { data: crisisData, error: fetchErr } = await supabase
            .from('crisis_logs').select('*').eq('id', crisisId).single();

        if (fetchErr || !crisisData) return res.json({ error: 'Kriz kaydı bulunamadı' });

        const updatedCrisis = { ...crisisData.crisis_data, followup_done: true, followup_response: followupResponse || '' };

        const { error } = await supabase.from('crisis_logs')
            .update({ crisis_data: updatedCrisis })
            .eq('id', crisisId);

        if (error) return res.json({ error: error.message });

        console.log(`[#20 CRISIS] Takip tamamlandı: ${crisisId}`);
        res.json({ success: true });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ─── BILGI BANKASI: BAŞLANGIÇ KAYNAKLARI SEEDING ──────────────────────────────
app.post('/seed-knowledge', async (req, res) => {
    try {
        console.log('[SEED] Başlangıç kaynakları yükleniyor...');

        // Önceki kaynakları sil (duplicates'i önle)
        const { data: existing } = await supabase.from('knowledge_sources').select('id');
        if (existing && existing.length > 0) {
            console.log(`[SEED] ${existing.length} mevcut kaynak bulundu, yeni yüklemeye hazırlanıyor...`);
        }

        const initialSources = [
            // ═══ KİTAPLAR (Books) ═══
            { source_type: 'book', title: 'The Body Keeps the Score', author: 'Bessel van der Kolk', url: 'https://www.besselvanderkolk.com/', summary: 'Travma ve bedenin hafızası hakkında kapsamlı rehber', content: 'Travmanın beyni ve bedeni nasıl etkilediğini açıklayan monumental çalışma. PTSD, beyin plastisitesi, somatic terapi.', category: 'trauma', subcategory: 'ptsd', tags: ['trauma', 'neuroscience', 'body-based', 'recovery'], credibility_score: 0.95, relevance_score: 0.95 },
            { source_type: 'book', title: 'Emotional Intelligence', author: 'Daniel Goleman', url: 'https://www.danielgoleman.info/', summary: 'Duygu kontrolü ve kişilerarası becerilerin gücü', content: 'Duygusal zeka nedir, neden IQ\'dan önemli, ve nasıl geliştirebileceğimiz. Öz-farkındalık, empati, ilişki yönetimi.', category: 'general', subcategory: 'emotional-regulation', tags: ['emotions', 'relationships', 'self-awareness'], credibility_score: 0.92, relevance_score: 0.90 },
            { source_type: 'book', title: 'Mindfulness for Beginners', author: 'Jon Kabat-Zinn', url: 'https://www.mindfulnesstapes.com/', summary: 'Meditasyon ve şimdiki ana odaklanma tekniği', content: 'Mindfulness nedir, nasıl uygulanır, faydaları. Stres azaltma, kaygı yönetimi, yaşam kalitesi iyileştirme.', category: 'general', subcategory: 'mindfulness', tags: ['meditation', 'stress-reduction', 'mindfulness'], credibility_score: 0.94, relevance_score: 0.92 },
            { source_type: 'book', title: 'Man\'s Search for Meaning', author: 'Viktor Frankl', url: 'https://www.meaningbook.com/', summary: 'Yaşamın anlamı ve amaç bulma', content: 'Konsantrasyon kamplarında tutulma deneyimi ve logoterapy. Acı içinde anlam bulma, yaşam amaçı keşfi.', category: 'general', subcategory: 'meaning-purpose', tags: ['purpose', 'meaning', 'resilience', 'philosophy'], credibility_score: 0.96, relevance_score: 0.88 },
            { source_type: 'book', title: 'Feeling Good: The New Mood Therapy', author: 'David D. Burns', url: 'https://www.davidburnsmd.com/', summary: 'Bilişsel Davranışçı Terapi (CBT) pratik rehberi', content: 'Depresyon ve kaygıyı CBT teknikleriyle yönetme. Düşünce kaydı, davranışsal aktivasyon, radikal turist.', category: 'depression', subcategory: 'cbt', tags: ['cbt', 'cognitive-therapy', 'depression'], credibility_score: 0.93, relevance_score: 0.94 },
            { source_type: 'book', title: 'The Anxiety and Phobia Workbook', author: 'Edmund J. Bourne', url: 'https://www.anxietybook.com/', summary: 'Kaygı bozuklukları için pratik egzersiz rehberi', content: 'Bilişsel davranışçı teknikleri, gevşeme egzersizleri, sosyal kaygı, fobiler. Adım adım kılavuz.', category: 'anxiety', subcategory: 'workbook', tags: ['anxiety', 'cbt', 'self-help', 'practical'], credibility_score: 0.91, relevance_score: 0.92 },
            { source_type: 'book', title: 'Get Out of Your Mind and Into Your Life', author: 'Steven C. Hayes', url: 'https://stevenchayes.com/', summary: 'Kabul ve Adanmışlık Terapisi (ACT) halkçı rehberi', content: 'ACT ilkeleri, düşünceleri bırakmak, değerlere göre yaşamak, duygusal esneklik. Depresyon, kaygı, kronik ağrı için.', category: 'general', subcategory: 'act', tags: ['act', 'acceptance', 'values', 'psychology'], credibility_score: 0.93, relevance_score: 0.91 },
            { source_type: 'book', title: 'DBT Skills Training Manual', author: 'Marsha M. Linehan', url: 'https://www.mha.org/', summary: 'Diyalektik Davranış Terapisi (DBT) pratik beceriler', content: 'Uyum (Distress Tolerance, Emotion Regulation, Mindfulness, Interpersonal Effectiveness). İntihar riski, BPD, kronik depresyon için.', category: 'general', subcategory: 'dbt', tags: ['dbt', 'skills', 'emotion-regulation', 'distress-tolerance'], credibility_score: 0.94, relevance_score: 0.93 },
            { source_type: 'book', title: 'The Sleep Solution', author: 'Dr. W. Chris Winter', url: 'https://www.thesleepbook.com/', summary: 'Uyku sorunu çözümü ve uyku hijyeni', content: 'İnsomnia, uyku apnesi, yorgunluk. Tıbbi ve psikolojik yaklaşımlar. Uyku kalitesi iyileştirme stratejileri.', category: 'sleep', subcategory: 'insomnia', tags: ['sleep', 'insomnia', 'health', 'practical'], credibility_score: 0.92, relevance_score: 0.89 },
            { source_type: 'book', title: 'Hold Me Tight: Relationships in Motion', author: 'Sue Johnson', url: 'https://www.sueJohnsonrelationships.com/', summary: 'Romantik ilişkilerde duygusal bağlılık', content: 'Bağlanma teorisi, ilişki dinamikleri, çiftler terapisi. Çatışma çözümü, yakınlık inşa etme, güven kurma.', category: 'relationships', subcategory: 'couples', tags: ['relationships', 'attachment', 'couples', 'communication'], credibility_score: 0.92, relevance_score: 0.88 },

            // ═══ YOUTUBE KANALLAR (YouTube) ═══
            { source_type: 'video', title: 'TED-Ed Psychology Playlist', author: 'TED-Ed', url: 'https://www.youtube.com/playlist?list=PLJicmE8fK0EiFnM9KLvwShtUXEqLlYvtQ', summary: 'Psikoloji konularının animasyonlu açıklaması', content: 'Anksiyete, depresyon, memori, duygular, ilişkiler, stres, uyku. Her video 5-10 dakika.', category: 'general', subcategory: 'education', tags: ['psychology', 'education', 'video', 'animated'], credibility_score: 0.92, relevance_score: 0.88 },
            { source_type: 'video', title: 'Psychology Today - Mental Health Videos', author: 'Psychology Today', url: 'https://www.youtube.com/user/PsychologyToday', summary: 'Profesyonel psikologlar tarafından mental sağlık rehberi', content: 'Depresyon, kaygı, ilişkiler, kişisel gelişim. Uzman görüşleri ve pratik öneriler.', category: 'general', subcategory: 'expert-advice', tags: ['mental-health', 'expert', 'video'], credibility_score: 0.91, relevance_score: 0.90 },
            { source_type: 'video', title: 'The Therapy Collective', author: 'Licensed Therapists', url: 'https://www.youtube.com/c/TheTherapyCollective', summary: 'Gerçek terapistler tarafından bilişsel davranışçı teknikler', content: 'CBT, kaygı, depresyon, ilişkiler. Pratik egzersizler ve stratejiler.', category: 'general', subcategory: 'cbt', tags: ['cbt', 'therapy', 'expert', 'techniques'], credibility_score: 0.93, relevance_score: 0.92 },
            { source_type: 'video', title: 'Psych2Go', author: 'Psych2Go Team', url: 'https://www.youtube.com/c/Psych2Go', summary: 'Kısa animasyonlu psikoloji dersleri', content: 'Duygular, stres, kaygı, depresyon, ilişkiler. 5-10 dakikalık hızlı öğrenme.', category: 'general', subcategory: 'education', tags: ['psychology', 'animation', 'education', 'mental-health'], credibility_score: 0.88, relevance_score: 0.85 },
            { source_type: 'video', title: 'Therapist Uncensored - Nicole LePera', author: 'Nicole LePera', url: 'https://www.youtube.com/c/TherapistUncensored', summary: 'Travma, kalıtsal ağır koşullar, bedensel terapiklik', content: 'Travma tedavisi, HPA aksı, dissosiyasyon. Holistic sağlık yaklaşımı.', category: 'trauma', subcategory: 'therapy', tags: ['trauma', 'therapy', 'holistic', 'expert'], credibility_score: 0.90, relevance_score: 0.89 },
            { source_type: 'video', title: 'BetterHelp - Expert Therapist Videos', author: 'Licensed Therapists', url: 'https://www.youtube.com/user/BetterHelpSupportme', summary: 'Online terapi uzmanlarından pratik rehberler', content: 'Depresyon, kaygı, ilişkiler, öz-saygı. Hızlı ipuçları ve teknikler.', category: 'general', subcategory: 'expert-advice', tags: ['therapy', 'expert', 'mental-health', 'video'], credibility_score: 0.89, relevance_score: 0.87 },
            { source_type: 'video', title: 'Actualizing from the Heart', author: 'Shona Vertue', url: 'https://www.youtube.com/c/ActualizingfromtheHeart', summary: 'Yoga, meditasyon, duygusal iyileştirme', content: 'Bedensel farkındalık, meditasyon, esneklik, stres azaltma.', category: 'general', subcategory: 'mindfulness', tags: ['yoga', 'meditation', 'body-based', 'mindfulness'], credibility_score: 0.87, relevance_score: 0.85 },
            { source_type: 'video', title: 'Andrew Huberman - Neuroscience & Mental Health', author: 'Andrew Huberman', url: 'https://www.youtube.com/c/AndrewHubermanLab', summary: 'Beyin bilimi, stres, uyku, dikkat, duygu', content: 'Nörobiyoloji temelli pratik stratejiler. Melatonin, cortisol, amygdala. Bilimsel açıklama.', category: 'general', subcategory: 'neuroscience', tags: ['neuroscience', 'research', 'brain', 'stress'], credibility_score: 0.94, relevance_score: 0.91 },

            // ═══ TEKNIKLER (Techniques) ═══
            { source_type: 'technique', title: '4-7-8 Nefes Egzersizi', author: 'Andrew Weil', url: 'https://www.drweil.com/', summary: 'Panik ve kaygıyı hızlı kontrol eden nefes tekniği', content: '4 saniye nal, 7 saniye tut, 8 saniye ver. Parasempatik sinir sistemi aktive eder. Panik atak, uyku, stres için.', category: 'anxiety', subcategory: 'breathing', tags: ['breathing', 'relaxation', 'quick-technique', 'evidence-based'], credibility_score: 0.92, relevance_score: 0.94 },
            { source_type: 'technique', title: 'Grounding Exercise (5-4-3-2-1)', author: 'Various Therapists', url: 'https://www.mayoclinic.org/', summary: 'Flashback ve disosiyatif durumlardan çıkma', content: 'Beş duyu kullanarak şimdiki ana çekme. 5 şey gör, 4 dokunabilir, 3 işit, 2 kokla, 1 tat. PTSD, panik için.', category: 'trauma', subcategory: 'grounding', tags: ['grounding', 'sensory', 'trauma', 'flashback'], credibility_score: 0.93, relevance_score: 0.95 },
            { source_type: 'technique', title: 'Thought Record (CBT)', author: 'Albert Ellis', url: 'https://www.therapistaid.com/', summary: 'Olumsuz düşünceleri sorgulamak', content: 'Durumu not et → Otomatik düşünce → Kanıtı for/against → Gerçekçi cevap. Depresyon, kaygı için temel.', category: 'general', subcategory: 'cbt', tags: ['cbt', 'cognitive', 'thought-challenging'], credibility_score: 0.94, relevance_score: 0.96 },
            { source_type: 'technique', title: 'Exposure Therapy', author: 'Joseph Wolpe', url: 'https://en.wikipedia.org/wiki/Exposure_therapy', summary: 'Korku ve kaygıyı kademeli maruziyetle yönetme', content: 'Kaçınma döngüsünü kırma. Hiyerarşi oluştur → Maruz kal → Alışma. Fobiler, OKB, PTSD için.', category: 'anxiety', subcategory: 'phobia', tags: ['exposure', 'behavioral', 'anxiety', 'phobia'], credibility_score: 0.95, relevance_score: 0.94 },
            { source_type: 'technique', title: 'Progressive Muscle Relaxation (PMR)', author: 'Edmund Jacobson', url: 'https://www.mayoclinic.org/', summary: 'Kasları sıkıp gevşeterek stres azaltma', content: 'Baştan ayağa kaslara odaklan, sık, sonra gevşet. Gerginlik farkındalığı, bedeni sakinleştirme. Kaygı, uyku için.', category: 'anxiety', subcategory: 'relaxation', tags: ['relaxation', 'body-based', 'anxiety', 'sleep'], credibility_score: 0.91, relevance_score: 0.90 },
            { source_type: 'technique', title: 'ACT Values Clarification', author: 'Steven C. Hayes', url: 'https://stevenchayes.com/', summary: 'Yaşamda önemli olan şeyleri bulma', content: 'Hangi alanlarda (ilişkiler, iş, sağlık, kişilik) neyi istiyorum? Değerleri tanımla, seçimler yap. Depresyon, kaygı, anlamsızlık için.', category: 'general', subcategory: 'act', tags: ['act', 'values', 'meaning', 'clarification'], credibility_score: 0.92, relevance_score: 0.91 },
            { source_type: 'technique', title: 'DBT TIPP Skills (Temperature, Intense Exercise, Paced Breathing)', author: 'Marsha M. Linehan', url: 'https://www.mha.org/', summary: 'Acil durumlarda duygusal kontrol', content: 'Yüze soğuk su sürü, yoğun egzersiz, hızlı nefes. Duygusal fırıltıyı hızlı kontrol. Kriz, özürlü davranış için.', category: 'general', subcategory: 'dbt', tags: ['dbt', 'crisis', 'emotion-regulation', 'quick-technique'], credibility_score: 0.93, relevance_score: 0.92 },
            { source_type: 'technique', title: 'EMDR Eye Movement Desensitization', author: 'Francine Shapiro', url: 'https://en.wikipedia.org/wiki/Eye_movement_desensitization_and_reprocessing', summary: 'Göz hareketleriyle travma hafızasını işleme', content: 'Bilateral stimülasyon kullanarak travma belleği yeniden işle. PTSD, fobiler, intrusive memories için.', category: 'trauma', subcategory: 'emdr', tags: ['emdr', 'trauma', 'memory-processing', 'evidence-based'], credibility_score: 0.94, relevance_score: 0.93 },
            { source_type: 'technique', title: 'Havening - Şimşek Terapisi', author: 'Ronald Ruden', url: 'https://www.havening.org/', summary: 'Hafif dokunuşla travma ve fobia azaltma', content: 'Beyin tarafından oluşturulan ağrı ve travma semptomlarını hedef alan terapeutic dokunuş.', category: 'trauma', subcategory: 'touch-therapy', tags: ['trauma', 'touch-based', 'alternative', 'relaxation'], credibility_score: 0.88, relevance_score: 0.85 },
            { source_type: 'technique', title: 'Sleep Hygiene Protocol', author: 'Matthew Walker', url: 'https://www.sleepdiplomat.com/', summary: 'Uyku kalitesini artıran pratik kurallar', content: 'Uyku saati, ortam, koffein, egzersiz, ışık. Circadian rhythm, REM, derin uyku. İnsomniya, uyku apnesi için.', category: 'sleep', subcategory: 'hygiene', tags: ['sleep', 'insomnia', 'health', 'practical'], credibility_score: 0.93, relevance_score: 0.91 },

            // ═══ ARAŞTIRMA MAKALELERİ (Articles) ═══
            { source_type: 'article', title: 'The Efficacy of Cognitive Behavioral Therapy', author: 'American Psychiatric Association', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'CBT\'nin kaygı bozukluğu tedavisi etkinliği %70-85', content: 'Sistematik gözden geçirme: CBT, SSRIs\'den daha kalıcı iyileşme. Panik, sosyal kaygı, OKB için kanıtlanmış.', category: 'anxiety', subcategory: 'evidence-based', tags: ['research', 'cbt', 'efficacy', 'anxiety'], credibility_score: 0.96, relevance_score: 0.95 },
            { source_type: 'article', title: 'Mindfulness-Based Stress Reduction: A Literature Review', author: 'Journal of Alternative Medicine', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'MBSR stres, kaygı, depresyon azaltmada etkili', content: '3000+ çalışmanın metaanalizi: cortisol azalması, amygdala inaktivasyonu, iyileşme oranları.', category: 'general', subcategory: 'mindfulness', tags: ['research', 'mindfulness', 'stress', 'neuroscience'], credibility_score: 0.94, relevance_score: 0.92 },
            { source_type: 'article', title: 'EMDR for PTSD: Mechanisms and Clinical Applications', author: 'Frontiers in Psychology', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'Göz Hareketli Duyarsızlaştırma ve Yeniden İşleme', content: 'Travma hafızasının işlenmesi. Bilateral stimülasyon nörobiyolojisi. Etkinlik oranları %50-80.', category: 'trauma', subcategory: 'emdr', tags: ['research', 'emdr', 'ptsd', 'trauma'], credibility_score: 0.93, relevance_score: 0.91 },
            { source_type: 'article', title: 'Acceptance and Commitment Therapy: A Meta-Analytic Review', author: 'Journal of Contextual Behavioral Science', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'ACT\'nin depresyon, kaygı, kronik ağrı tedavisi', content: 'ACT vs CBT karşılaştırması. Duygusal esneklik, değer yönlendirmeli yaşam. Etkinlik 70%+ tüm bozukluklarda.', category: 'general', subcategory: 'act', tags: ['research', 'act', 'efficacy', 'depression', 'anxiety'], credibility_score: 0.94, relevance_score: 0.92 },
            { source_type: 'article', title: 'Dialectical Behavior Therapy: Evidence and Applications', author: 'American Journal of Psychiatry', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'DBT\'nin borderline personality disorder, intihar riski tedavisi', content: 'DBT modülleri, grup terapisi, kovılık. İntihar girişimlerinde %50 azalma. Kronik depresyon, bağımlılık için.', category: 'general', subcategory: 'dbt', tags: ['research', 'dbt', 'efficacy', 'bpd', 'suicide'], credibility_score: 0.95, relevance_score: 0.93 },
            { source_type: 'article', title: 'The Neurobiology of Sleep and Wakefulness', author: 'Nature Neuroscience', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'Uyku, beyin, hafızası, duyguların nörobiyolojisi', content: 'REM, derin uyku, circadian rhythm, melatonin. Uyku yoksunluğunun ruh sağlığı etkisi. İmplantlar ve intervansiyonlar.', category: 'sleep', subcategory: 'neuroscience', tags: ['research', 'sleep', 'neuroscience', 'brain'], credibility_score: 0.96, relevance_score: 0.90 },
            { source_type: 'article', title: 'Attachment Theory and Adult Relationships', author: 'Journal of Personality Psychology', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'John Bowlby\'nin bağlanma teorisi ve ilişkiler', content: 'Güvenli, kaygılı, kaçınan bağlanma stilleri. İlişki dinamikleri, çatışma çözümü, yakınlık.', category: 'relationships', subcategory: 'attachment', tags: ['research', 'attachment', 'relationships', 'psychology'], credibility_score: 0.95, relevance_score: 0.91 },
            { source_type: 'article', title: 'Social Anxiety Disorder: Current Perspectives', author: 'Clinical Psychology Review', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'Sosyal kaygı bozukluğu, sosyal fobiler, öz-farkındalık', content: 'Etiyoloji, mekanizmalar, tedavi (CBT, MAOI). Maruziyete karşı bilişsel yeniden yapılandırma. Recovery oranları.', category: 'anxiety', subcategory: 'social-anxiety', tags: ['research', 'social-anxiety', 'cbt', 'anxiety'], credibility_score: 0.94, relevance_score: 0.92 },
            { source_type: 'article', title: 'Trauma-Informed Care: Principles and Implementation', author: 'Psychological Services', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'Travma-bilgili yaklaşım, güvenlik, güven, seçim', content: '5 prensip: fiziksel/psikolojik güvenlik, güven, seçim, işbirliği, güçlendirilme. Ruh sağlığı ve sosyal hizmetler.', category: 'trauma', subcategory: 'care', tags: ['research', 'trauma', 'care', 'implementation'], credibility_score: 0.93, relevance_score: 0.90 },
            { source_type: 'article', title: 'Depression and Cognitive Distortions', author: 'Cognitive Therapy and Research', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'Depresyondaki otomatik düşünceler ve bilişsel hatalar', content: 'Felaketleştirme, genelleme, tüm-ya-da-hiç, aşırı kişiselleştirme. Düşünce kaydı, test kanıt. Recovery için kritik.', category: 'depression', subcategory: 'cognitive', tags: ['research', 'depression', 'cbt', 'cognitive-distortions'], credibility_score: 0.94, relevance_score: 0.93 },

            // ═══ WIKI (Wiki) ═══
            { source_type: 'wiki', title: 'Cognitive Behavioral Therapy - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Cognitive_behavioral_therapy', summary: 'CBT türleri, tarihçesi, kanıt tabanı', content: 'Başlangıç, rasyonel duygusal davranış terapisi, yapı, verimliliği. Kapsamlı gözden geçirme.', category: 'general', subcategory: 'cbt', tags: ['wiki', 'education', 'cbt', 'overview'], credibility_score: 0.87, relevance_score: 0.85 },
            { source_type: 'wiki', title: 'Generalized Anxiety Disorder - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Generalized_anxiety_disorder', summary: 'GAD tanısı, semptomlar, tedavi seçenekleri', content: 'Tanı kriterleri, prognoz, tedavi (ilaç, psikoterapi), komorbiditeler.', category: 'anxiety', subcategory: 'generalized-anxiety', tags: ['wiki', 'diagnosis', 'anxiety', 'education'], credibility_score: 0.85, relevance_score: 0.84 },
            { source_type: 'wiki', title: 'Major Depressive Disorder - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Major_depressive_disorder', summary: 'MDD tanısı, semptomlar, etyoloji, tedavi', content: 'DSM-5 kriterleri, prognoz, antidepresanlar, psikoterapi, risk faktörleri.', category: 'depression', subcategory: 'diagnosis', tags: ['wiki', 'diagnosis', 'depression', 'education'], credibility_score: 0.86, relevance_score: 0.84 },
            { source_type: 'wiki', title: 'Post-Traumatic Stress Disorder - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Post-traumatic_stress_disorder', summary: 'PTSD tanısı, semptomlar, travma yönetimi', content: 'Tanı kriterleri, risk faktörleri, komorbidite, tedavi modelleri (EMDR, CBT, ilaç).', category: 'trauma', subcategory: 'ptsd', tags: ['wiki', 'diagnosis', 'trauma', 'ptsd'], credibility_score: 0.87, relevance_score: 0.85 },
            { source_type: 'wiki', title: 'Panic Disorder - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Panic_disorder', summary: 'Panik bozukluğu, panik atak, agorafobik kaçınma', content: 'Tanı kriterleri, agorafobi, nörobiyoloji, tedavi (maruziyete, ilaç), prognoz.', category: 'anxiety', subcategory: 'panic', tags: ['wiki', 'diagnosis', 'panic', 'anxiety'], credibility_score: 0.86, relevance_score: 0.84 },
            { source_type: 'wiki', title: 'Obsessive-Compulsive Disorder - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Obsessive%E2%80%93compulsive_disorder', summary: 'OKB tanısı, obsesyonlar, kompulsiyonlar, tedavi', content: 'Tanı kriterleri, obsesyon türleri, kompülsif davranışlar, maruziyete tepki engelleme, SSRI.', category: 'anxiety', subcategory: 'ocd', tags: ['wiki', 'diagnosis', 'ocd', 'anxiety'], credibility_score: 0.87, relevance_score: 0.86 },
            { source_type: 'wiki', title: 'Insomnia - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Insomnia', summary: 'İnsomniya tanısı, nedenler, tedavi seçenekleri', content: 'Tanı kriterleri, uyku hijyeni, kognitif davranışçı terapi, ilaçlar, doktor kontrol.', category: 'sleep', subcategory: 'insomnia', tags: ['wiki', 'diagnosis', 'insomnia', 'sleep'], credibility_score: 0.85, relevance_score: 0.83 },
            { source_type: 'wiki', title: 'Attachment Theory - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Attachment_theory', summary: 'John Bowlby\'nin bağlanma teorisi, bağlanma stilleri', content: 'Güvenli, kaygılı, kaçınan bağlanma. Çocukluk deneyimleri, ilişkiler, terapi.', category: 'relationships', subcategory: 'attachment', tags: ['wiki', 'attachment', 'relationships', 'theory'], credibility_score: 0.88, relevance_score: 0.86 },
            { source_type: 'wiki', title: 'Emotion Regulation - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Emotion_regulation', summary: 'Duygu düzenleme stratejileri, kaçınma, sıkıştırma, yeniden değerlendirme', content: 'Uyumlu ve uyumsuz stratejiler, DBT becerileri, bilişsel yeniden yapılandırma.', category: 'general', subcategory: 'emotion-regulation', tags: ['wiki', 'emotion', 'regulation', 'psychology'], credibility_score: 0.86, relevance_score: 0.84 },
            { source_type: 'wiki', title: 'Mindfulness - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Mindfulness', summary: 'Mindfulness tanımı, meditasyon, uygulamalar, araştırma', content: 'Budizm kökenleri, seküler uygulamalar, MBSR, faydalı, bilimsel kanıt.', category: 'general', subcategory: 'mindfulness', tags: ['wiki', 'mindfulness', 'meditation', 'education'], credibility_score: 0.85, relevance_score: 0.82 },

            // ═══ İNSAN ANALİZİ & BİLİNÇALTI PSİKOLOJİ ═══
            { source_type: 'book', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', url: 'https://www.kahneman.com/', summary: 'İnsan karar verme, önyargılar, bilinçaltı düşünce', content: 'Nobel ödüllü psikolog. İki sistem: hızlı (otomatik/bilinçaltı) vs yavaş (mantıksal). Bilişsel önyargılar, heuristics, insan davranışı.', category: 'human-analysis', subcategory: 'decision-making', tags: ['psychology', 'bias', 'subconscious', 'decision-making'], credibility_score: 0.96, relevance_score: 0.94 },
            { source_type: 'book', title: 'Influence: The Psychology of Persuasion', author: 'Robert Cialdini', url: 'https://www.influenceatwork.com/', summary: 'İnsanları etkileyen bilinçaltı faktörler ve ikna mekanizmaları', content: '6 ilke: Karşılıklılık, tutarlılık, sosyal kanıt, otorite, sevgi, kıtlık. Bilinçaltı etkiler, satış, manipülasyon teknikleri.', category: 'human-analysis', subcategory: 'persuasion', tags: ['influence', 'persuasion', 'psychology', 'subconscious'], credibility_score: 0.94, relevance_score: 0.92 },
            { source_type: 'book', title: 'Predictably Irrational', author: 'Dan Ariely', url: 'https://danariely.com/', summary: 'İnsan davranışı mantığı: neden hep aynı hataları yaparız?', content: 'Sistematik olarak mantıksız kararlar verişimiz. Anchor effects, sunk cost, loss aversion. Ekonomi + psikoloji. Bilinçaltı motifler.', category: 'human-analysis', subcategory: 'irrational-behavior', tags: ['psychology', 'behavior', 'bias', 'economics'], credibility_score: 0.93, relevance_score: 0.91 },
            { source_type: 'book', title: 'The Interpretation of Dreams', author: 'Sigmund Freud', url: 'https://en.wikipedia.org/wiki/The_Interpretation_of_Dreams', summary: 'Rüyalar ve bilinçaltı arzuları açığa çıkaran kural motoru', content: 'Freud\'ün klasik eseri. Rüyalar bilinçaltı istemlerin göstergesi. Sembolik anlam, latent content, manifest content. Bilinçaltı analizi temeleri.', category: 'human-analysis', subcategory: 'dreams-unconscious', tags: ['freud', 'dreams', 'unconscious', 'psychology'], credibility_score: 0.89, relevance_score: 0.87 },
            { source_type: 'book', title: 'Man and His Symbols', author: 'Carl Jung', url: 'https://en.wikipedia.org/wiki/Man_and_His_Symbols', summary: 'Jung\'un semboller, arketiper, kolektif bilinçaltı teorisi', content: 'Kollektif bilinçaltı, arketiper (gölge, anima, akela). Sembollerin evrensel anlamı. Rüyalar, mitoloji, psikolojik gelişim.', category: 'human-analysis', subcategory: 'archetypes', tags: ['jung', 'archetypes', 'unconscious', 'symbols'], credibility_score: 0.91, relevance_score: 0.89 },
            { source_type: 'book', title: 'Mindset: The New Psychology of Success', author: 'Carol Dweck', url: 'https://mindsetonline.com/', summary: 'Sabit vs Büyüme Zihniyeti: İnsan potansiyeli ve inançlar', content: 'Sabit zihniyeti vs büyüme zihniyeti. İnançlar davranışı belirler. Başarı, motivasyon, potansiyel açığa çıkarma. Bilinçaltı inançların etkisi.', category: 'human-analysis', subcategory: 'beliefs', tags: ['mindset', 'psychology', 'growth', 'success'], credibility_score: 0.93, relevance_score: 0.91 },
            { source_type: 'book', title: 'Incognito: The Secret Lives of the Brain', author: 'David Eagleman', url: 'https://www.davidaglemanm.com/', summary: 'Bilinçaltı beyin: Bilincin dışında neler oluyor?', content: 'Beynin %99\'u bilinçsiz çalışır. Algı, karar verme, davranış çoğunlukla bilinçaltında oluşur. Nörobiyoloji, farkındalık, kontrol illüzyonu.', category: 'human-analysis', subcategory: 'neuroscience', tags: ['brain', 'unconscious', 'consciousness', 'neuroscience'], credibility_score: 0.94, relevance_score: 0.92 },
            { source_type: 'article', title: 'Unconscious Processes in Therapy and Daily Life', author: 'Journal of Consciousness Studies', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: 'Bilinçaltı süreçler: terapi, karar verme, davranış', content: 'Priming, implicit associations, automatic processes. Terapi sırasında bilinçaltı direnci. Farkındalık ve değişim mekanizmaları.', category: 'human-analysis', subcategory: 'research', tags: ['research', 'unconscious', 'therapy', 'psychology'], credibility_score: 0.92, relevance_score: 0.90 },
            { source_type: 'article', title: 'Cognitive Biases in Human Decision Making', author: 'Psychological Review', url: 'https://pubmed.ncbi.nlm.nih.gov/', summary: '20+ bilişsel önyargı: İnsan düşünce hataları', content: 'Confirmation bias, availability heuristic, anchoring, sunk cost fallacy, availability cascade, backfire effect. Kararlar nasıl çarpıtılır.', category: 'human-analysis', subcategory: 'biases', tags: ['research', 'bias', 'cognition', 'psychology'], credibility_score: 0.93, relevance_score: 0.91 },
            { source_type: 'technique', title: 'Free Association Technique', author: 'Psychoanalytic Tradition', url: 'https://en.wikipedia.org/wiki/Free_association', summary: 'Bilinçaltı düşünceleri çıkartma: kontrol edilmeyen söz', content: 'Freud\'ün klasik tekniği. Filtresiz konuşma = bilinçaltı ortaya çıkar. Travma, baskılı duygular, gizli motivler. Terapide kullanım.', category: 'human-analysis', subcategory: 'technique', tags: ['freud', 'technique', 'unconscious', 'therapy'], credibility_score: 0.90, relevance_score: 0.88 },
            { source_type: 'technique', title: 'Shadow Work - Jung Method', author: 'Jungian Psychology', url: 'https://en.wikipedia.org/wiki/Shadow_(psychology)', summary: 'Gölge Self: Olumsuz kişiliği tanıma ve entegre etme', content: 'Jung\'ün gölge konsepti. Bastırılmış, reddedilen kişilik yönleri. Farkındalık, kabul, entegrasyon. Kendini tanıma yöntemi.', category: 'human-analysis', subcategory: 'jungian', tags: ['jung', 'shadow', 'self-awareness', 'integration'], credibility_score: 0.89, relevance_score: 0.87 },
            { source_type: 'technique', title: 'Implicit Association Test (IAT)', author: 'Greenwald & Banaji', url: 'https://implicit.harvard.edu/', summary: 'Bilinçaltı önyargıları ölçme: Gizli İnsan Önyargıları', content: 'Ceplerle, ırk, cinsiyet hakkında açık olmayan tutumları ölçer. Bilinçaltı bias\'ı ortaya çıkarır. Farkındalık için tool.', category: 'human-analysis', subcategory: 'assessment', tags: ['test', 'unconscious', 'bias', 'assessment'], credibility_score: 0.91, relevance_score: 0.89 },
            { source_type: 'wiki', title: 'Cognitive Biases - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Cognitive_bias', summary: '50+ bilişsel önyargı: Kapsamlı liste ve açıklamalar', content: 'Confirmation bias, availability bias, anchoring, dunning-kruger, sunk cost, false consensus. Her bias açıklanmış.', category: 'human-analysis', subcategory: 'education', tags: ['wiki', 'bias', 'cognition', 'education'], credibility_score: 0.87, relevance_score: 0.85 },
            { source_type: 'wiki', title: 'Unconscious Mind - Wikipedia', author: 'Wikipedia Contributors', url: 'https://en.wikipedia.org/wiki/Unconscious_mind', summary: 'Bilinçaltı zihin: Tarih, teori, araştırma', content: 'Freud, Jung, modern nörobiyoloji. Bilinçaltı süreçler, implicit memory, automaticity. Terapi teorisinin temelleri.', category: 'human-analysis', subcategory: 'education', tags: ['wiki', 'unconscious', 'psychology', 'education'], credibility_score: 0.86, relevance_score: 0.84 },
        ];

        // Embedding oluştur ve kaydet
        let savedCount = 0;
        for (const source of initialSources) {
            try {
                // Ada-002 embedding
                const embResponse = await openai.embeddings.create({
                    model: 'text-embedding-ada-002',
                    input: `${source.title} ${source.summary} ${source.content}`.substring(0, 2000)
                });
                const embedding = embResponse.data[0].embedding;

                // Supabase'e kaydet
                const { data, error } = await supabase.from('knowledge_sources').insert([{
                    source_type: source.source_type,
                    title: source.title,
                    author: source.author,
                    url: source.url,
                    summary: source.summary,
                    content: source.content,
                    embedding,
                    category: source.category,
                    subcategory: source.subcategory,
                    tags: source.tags,
                    credibility_score: source.credibility_score,
                    relevance_score: source.relevance_score,
                    is_active: true
                }]);

                if (!error) savedCount++;
                else console.warn(`[SEED] Kayıt hatası "${source.title}":`, error.message);

            } catch (err) {
                console.warn(`[SEED] Embedding hatası "${source.title}":`, err.message);
            }
        }

        console.log(`[SEED] ✅ ${savedCount}/${initialSources.length} kaynak kaydedildi.`);
        res.json({ success: true, saved: savedCount, total: initialSources.length });
    } catch (err) {
        console.error('[SEED] Hata:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── BILGI BANKASI: KAYNAK BULMA (İlk sürüm — Text search + Manual relevance) ────────────────────────
app.get('/retrieve-knowledge-advanced', async (req, res) => {
    try {
        const { query, category, limit = 5, userId } = req.query;

        if (!query) {
            return res.json({ error: 'query parametresi gerekli' });
        }

        console.log(`[RAG] Aranıyor: "${query}"${category ? ` (kategori: ${category})` : ''}`);

        // Query değiştir
        const searchQuery = `%${query.substring(0, 50)}%`.toLowerCase();

        // Supabase'de basic text search
        let supabaseQuery = supabase
            .from('knowledge_sources')
            .select('id, source_type, title, author, url, summary, category, subcategory, tags, credibility_score, relevance_score')
            .eq('is_active', true);

        // Kategori filtresi
        if (category && category !== 'all') {
            supabaseQuery = supabaseQuery.eq('category', category);
        }

        const { data: allSources, error: selectError } = await supabaseQuery.limit(50);

        if (selectError) {
            console.warn('[RAG] Supabase error:', selectError.message);
            return res.json({ error: selectError.message });
        }

        if (!allSources || allSources.length === 0) {
            return res.json({ insights: [], method: 'text-search', query, message: 'Kaynak bulunamadı' });
        }

        // Manual text relevance scoring
        const scored = allSources
            .map(source => {
                // Title, summary, tags'ında arama sözcüğünü bul
                const titleMatch = source.title?.toLowerCase().includes(query.toLowerCase()) ? 3 : 0;
                const summaryMatch = source.summary?.toLowerCase().includes(query.toLowerCase()) ? 2 : 0;
                const tagsMatch = source.tags?.some(t => t.toLowerCase().includes(query.toLowerCase())) ? 2 : 0;

                const relevance = (titleMatch + summaryMatch + tagsMatch) / 7;
                return { ...source, relevance };
            })
            .filter(s => s.relevance > 0) // En az bir match
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, parseInt(limit));

        // Format response
        const formatted = scored.map(s => ({
            id: s.id,
            source_type: s.source_type,
            title: s.title,
            author: s.author,
            url: s.url,
            summary: s.summary,
            category: s.category,
            subcategory: s.subcategory,
            tags: s.tags,
            relevance: Math.round(s.relevance * 100) / 100,
            credibility: s.credibility_score
        }));

        // Usage log (fire-and-forget)
        if (userId && formatted.length > 0) {
            formatted.forEach(insight => {
                supabase.from('knowledge_usage_logs').insert([{
                    user_id: userId,
                    knowledge_id: insight.id,
                    used_context: `Arama: "${query}"`,
                    used_at: new Date().toISOString()
                }]).catch(() => {});
            });
        }

        console.log(`[RAG] ${formatted.length}/${allSources.length} kaynak döndürüldü`);
        res.json({
            insights: formatted,
            method: 'text-search',
            query,
            count: formatted.length,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('[RAG] Hata:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── OTONOM LEARNING AGENT (Cron Jobs) ────────────────────────────────────────────
import cron from 'node-cron';

// 1️⃣ GÜNLÜK: Yeni kaynakları keşfet (02:00)
async function autonomousSourceDiscovery() {
    try {
        console.log('[AGENT] Günlük kaynak keşfi başladı (02:00)');

        const newSources = [];

        // 1. Medium RSS'den psikoloji yazılarını çek
        try {
            const Parser = (await import('rss-parser')).default;
            const parser = new Parser();
            const mediumFeed = await parser.parseURL('https://medium.com/feed/tag/psychology');
            const mediumArticles = mediumFeed.items.slice(0, 3).map(item => ({
                source_type: 'article',
                title: item.title.substring(0, 100),
                author: item.creator || 'Medium',
                url: item.link,
                summary: item.contentSnippet?.substring(0, 200) || item.title,
                content: item.content?.substring(0, 500) || item.contentSnippet?.substring(0, 500) || item.title,
                category: 'general',
                subcategory: 'article',
                tags: ['medium', 'psychology', 'article', 'latest'],
                credibility_score: 0.82,
                relevance_score: 0.80
            }));
            newSources.push(...mediumArticles);
            console.log(`[AGENT] Medium RSS: ${mediumArticles.length} makale bulundu`);
        } catch (err) {
            console.warn('[AGENT] Medium RSS hatası:', err.message);
        }

        // 2. Psychology Today RSS'den yazıları çek (alternative feeds)
        try {
            const Parser = (await import('rss-parser')).default;
            const parser = new Parser();
            const feeds = [
                'https://www.psychologytoday.com/basics/rss.xml',
                'https://feeds.psychologytoday.com/home'
            ];

            for (const feedUrl of feeds) {
                try {
                    const ptFeed = await parser.parseURL(feedUrl);
                    if (ptFeed.items && ptFeed.items.length > 0) {
                        const ptArticles = ptFeed.items.slice(0, 3).map(item => ({
                            source_type: 'article',
                            title: item.title?.substring(0, 100) || 'Psychology Today Article',
                            author: item.creator || 'Psychology Today',
                            url: item.link || 'https://www.psychologytoday.com',
                            summary: item.contentSnippet?.substring(0, 200) || item.title || 'Psychology article',
                            content: item.content?.substring(0, 500) || item.contentSnippet?.substring(0, 500) || item.title || 'Content',
                            category: 'general',
                            subcategory: 'expert-article',
                            tags: ['psychology-today', 'expert', 'article', 'latest'],
                            credibility_score: 0.89,
                            relevance_score: 0.85
                        }));
                        newSources.push(...ptArticles);
                        console.log(`[AGENT] Psychology Today RSS: ${ptArticles.length} makale bulundu`);
                        break; // İlk başarılı feed'i kullan
                    }
                } catch (feedErr) {
                    // Sonraki feed'i dene
                }
            }
        } catch (err) {
            console.warn('[AGENT] Psychology Today RSS hatası:', err.message);
        }

        // 3. Google Scholar API'den (SearchAPI)
        try {
            if (process.env.SEARCHAPI_KEY) {
                const axios = (await import('axios')).default;
                const scholarResp = await axios.get('https://www.searchapi.io/api/v1/search', {
                    params: {
                        engine: 'google_scholar',
                        q: 'psychology anxiety therapy',
                        api_key: process.env.SEARCHAPI_KEY
                    }
                });

                const scholarArticles = (scholarResp.data.organic_results || []).slice(0, 3).map(item => ({
                    source_type: 'research',
                    title: item.title.substring(0, 100),
                    author: item.publication || 'Google Scholar',
                    url: item.link || 'https://scholar.google.com',
                    summary: item.snippet?.substring(0, 200) || item.title,
                    content: item.snippet?.substring(0, 500) || item.title,
                    category: 'general',
                    subcategory: 'research',
                    tags: ['google-scholar', 'research', 'latest'],
                    credibility_score: 0.90,
                    relevance_score: 0.85
                }));
                newSources.push(...scholarArticles);
                console.log(`[AGENT] Google Scholar: ${scholarArticles.length} araştırma bulundu`);
            } else {
                console.log('[AGENT] SearchAPI key bulunamadı, Google Scholar atlandı');
            }
        } catch (err) {
            console.warn('[AGENT] Google Scholar API hatası:', err.message);
        }

        // Embedding oluştur ve kaydet
        let addedCount = 0;
        for (const source of newSources) {
            try {
                // Duplicate check
                let existing = null;
                try {
                    const { data } = await supabase
                        .from('knowledge_sources')
                        .select('id')
                        .eq('title', source.title)
                        .single();
                    existing = data;
                } catch (e) {
                    // Duplicate yok
                }

                if (existing) {
                    console.log(`[AGENT] Duplicate: "${source.title}" atlandı`);
                    continue;
                }

                const embResponse = await openai.embeddings.create({
                    model: 'text-embedding-ada-002',
                    input: `${source.title} ${source.summary}`.substring(0, 2000)
                });

                const { error } = await supabase.from('knowledge_sources').insert([{
                    source_type: source.source_type,
                    title: source.title,
                    author: source.author,
                    url: source.url,
                    summary: source.summary,
                    content: source.content,
                    embedding: embResponse.data[0].embedding,
                    category: source.category,
                    subcategory: source.subcategory,
                    tags: source.tags,
                    credibility_score: source.credibility_score,
                    relevance_score: source.relevance_score,
                    is_active: true
                }]);

                if (!error) {
                    addedCount++;
                    console.log(`[AGENT] ✅ Eklendi: "${source.title}"`);
                }
            } catch (err) {
                console.warn(`[AGENT] "${source.title}" hatası:`, err.message);
            }
        }

        console.log(`[AGENT] ✅ ${addedCount}/${newSources.length} yeni kaynak eklendi (günlük keşif)`);
    } catch (err) {
        console.error('[AGENT] Günlük keşif hatası:', err.message);
    }
}

// 2️⃣ HAFTALIK: Kalite değerlendirmesi (Pazartesi 03:00)
async function assessKnowledgeQuality() {
    try {
        console.log('[AGENT] Haftalık kalite değerlendirmesi başladı');

        const { data: allSources } = await supabase
            .from('knowledge_sources')
            .select('id, title, credibility_score, is_active')
            .eq('is_active', true);

        if (!allSources || allSources.length === 0) return;

        // Credibility score'a göre kaynakları değerlendir
        let deactivatedCount = 0;
        for (const source of allSources) {
            if (source.credibility_score < 0.7) {
                await supabase
                    .from('knowledge_sources')
                    .update({ is_active: false })
                    .eq('id', source.id);
                deactivatedCount++;
            }
        }

        console.log(`[AGENT] ✅ Kalite kontrolü: ${deactivatedCount} düşük kaliteli kaynak deaktive edildi`);
    } catch (err) {
        console.error('[AGENT] Kalite değerlendirmesi hatası:', err.message);
    }
}

// 3️⃣ ÇİFT HAFTALIK: Bilgi boşluğu tespiti (Cuma 02:00)
async function detectKnowledgeGaps() {
    try {
        console.log('[AGENT] Bilgi boşluğu tespiti başladı');

        const { data: sources } = await supabase
            .from('knowledge_sources')
            .select('category')
            .eq('is_active', true);

        if (!sources) return;

        // Kategorilerin dağılımını analiz et
        const categoryCount = {};
        sources.forEach(s => {
            categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
        });

        const gaps = Object.entries(categoryCount)
            .filter(([cat, count]) => count < 5)
            .map(([cat]) => cat);

        if (gaps.length > 0) {
            console.log(`[AGENT] ⚠️ Bilgi boşluğu bulundu: ${gaps.join(', ')}`);
        } else {
            console.log(`[AGENT] ✅ Tüm kategorilerde yeterli bilgi var`);
        }
    } catch (err) {
        console.error('[AGENT] Bilgi boşluğu tespiti hatası:', err.message);
    }
}

// 4️⃣ AYLIK: Güvenilirlik doğrulaması (1. gün, 04:00)
async function verifySourceCredibility() {
    try {
        console.log('[AGENT] Aylık güvenilirlik doğrulaması başladı');

        const { data: sources } = await supabase
            .from('knowledge_sources')
            .select('id, credibility_score')
            .eq('is_active', true)
            .limit(20); // Ayda tümü kontrol etmek yerine örnek al

        if (!sources) return;

        const avgCredibility = sources.reduce((sum, s) => sum + (s.credibility_score || 0), 0) / sources.length;

        console.log(`[AGENT] ✅ Ortalama güvenilirlik skoru: ${(avgCredibility * 100).toFixed(1)}%`);

        if (avgCredibility < 0.75) {
            console.log('[AGENT] ⚠️ Düşük güvenilirlik! İyileştirme gerekli.');
        }
    } catch (err) {
        console.error('[AGENT] Güvenilirlik doğrulaması hatası:', err.message);
    }
}

// Cron Jobs Zamanlaması
try {
    // Her gün 02:00 - Kaynak keşfi
    cron.schedule('0 2 * * *', autonomousSourceDiscovery);
    console.log('[CRON] ✅ Günlük kaynak keşfi zamanlandı (02:00)');

    // Pazartesi 03:00 - Kalite kontrolü
    cron.schedule('0 3 * * 1', assessKnowledgeQuality);
    console.log('[CRON] ✅ Haftalık kalite kontrolü zamanlandı (Pazartesi 03:00)');

    // Cuma 02:00 - Bilgi boşluğu tespiti
    cron.schedule('0 2 * * 5', detectKnowledgeGaps);
    console.log('[CRON] ✅ Bilgi boşluğu tespiti zamanlandı (Cuma 02:00)');

    // Ayın 1. günü 04:00 - Güvenilirlik doğrulaması
    cron.schedule('0 4 1 * *', verifySourceCredibility);
    console.log('[CRON] ✅ Aylık güvenilirlik doğrulaması zamanlandı');
} catch (err) {
    console.error('[CRON] Zamanlandırma hatası:', err.message);
}

// ─── HAND-FACE INTERACTION DETECTION (Stress & Deception Indicators) ────────────────
// El yüze dokunma = kaygı, stres, yalan göstergesi

const analyzeHandFaceInteraction = (handLandmarks, faceLandmarks) => {
    if (!handLandmarks || !faceLandmarks) return null;

    const stressIndicators = [];
    let stressScore = 0;

    // Hand regions
    const hand = handLandmarks; // 21 points per hand
    const face = faceLandmarks;

    if (!hand || hand.length < 21 || !face || face.length < 468) return null;

    // Hand position (wrist + palm center)
    const handCenter = {
        x: (hand[5].x + hand[9].x + hand[13].x) / 3,
        y: (hand[5].y + hand[9].y + hand[13].y) / 3
    };

    // Face regions
    const faceCenter = {
        x: (face[1].x + face[34].x + face[264].x) / 3,
        y: (face[1].y + face[34].y + face[264].y) / 3
    };

    const mouthRegion = {
        x: (face[13].x + face[14].x) / 2,
        y: (face[13].y + face[14].y) / 2
    };

    const noseRegion = face[1];
    const neckRegion = { x: faceCenter.x, y: faceCenter.y + 0.15 };

    // Distance calculation
    const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    // 1. HAND TO MOUTH (Mouth covering = lying/secrecy)
    const distToMouth = dist(handCenter, mouthRegion);
    if (distToMouth < 0.1) {
        stressIndicators.push('🤐 El ağza yakın: Sekreti saklama/yalan/endişe');
        stressScore += 0.35;
    }

    // 2. HAND TO NOSE (Nose touch = lying/deception)
    const distToNose = dist(handCenter, noseRegion);
    if (distToNose < 0.12) {
        stressIndicators.push('👃 El buruna yakın: Yalan/endişe/kaygı (Pinocchio effect)');
        stressScore += 0.3;
    }

    // 3. HAND TO NECK (Neck touch = discomfort/lying/stress)
    const distToNeck = dist(handCenter, neckRegion);
    if (distToNeck < 0.15) {
        stressIndicators.push('🫀 El boyna yakın: Rahatsızlık/iğrenme/yalan/stres');
        stressScore += 0.25;
    }

    // 4. HAND TO FACE (Face touch = anxiety/stress)
    const distToFace = dist(handCenter, faceCenter);
    if (distToFace < 0.15) {
        stressIndicators.push('😰 El yüze yakın: Kaygı/stres/konsantrasyon');
        stressScore += 0.2;
    }

    // 5. SELF-TOUCH FREQUENCY (Tekrarlı dokunma = nervous habit)
    // (Bu real-time tracking gerekir, frame-to-frame comparison)

    // 6. HAND CLOSEDNESS (Kapalı el = defensiveness)
    const fingerSpread = dist(hand[4], hand[8]) + dist(hand[12], hand[16]); // Thumb-to-pinky spread
    if (fingerSpread < 0.05) {
        stressIndicators.push('✊ El kapalı: Savunma/kontrol/sıkı tutma');
        stressScore += 0.15;
    }

    return {
        stress_indicators: stressIndicators,
        stress_score: Math.min(stressScore, 1),
        hand_to_mouth: distToMouth,
        hand_to_nose: distToNose,
        hand_to_neck: distToNeck,
        hand_to_face: distToFace,
        deception_likelihood: stressScore > 0.5 ? 'high' : stressScore > 0.25 ? 'medium' : 'low',
        notes: stressScore > 0.6
            ? '⚠️ Yüksek stres/yalan göstergesi. Açık konuşmaya teşvik et.'
            : stressScore > 0.3
            ? '⚠️ Orta düzey rahatsızlık. Güven ortamı oluştur.'
            : '✅ Normal, rahat görünüyor.'
    };
};

// ─── MICRO-EXPRESSION DETECTION (Ekman Method) ──────────────────────────────────
// 43 Facial Action Units → 7 temel duygu

const detectMicroExpressions = (lm, blendshapes = []) => {
    if (!lm) return null;

    const aus = {}; // Facial Action Units

    // Ekman Action Units Mapping
    // AU1: Inner Brow Raiser
    aus['AU1'] = lm.brow_down_left > 0.2 ? 0 : Math.max(lm.brow_angle_left * 0.3, 0);

    // AU2: Outer Brow Raiser
    aus['AU2'] = lm.brow_down_right > 0.2 ? 0 : Math.max(lm.brow_angle_right * 0.3, 0);

    // AU4: Brow Lowerer (anger, concentration)
    aus['AU4'] = Math.max(lm.brow_down_left, lm.brow_down_right);

    // AU5: Upper Eyelid Raiser (surprise, fear)
    aus['AU5'] = Math.max(lm.eye_openness_left, lm.eye_openness_right) - 0.5;

    // AU6: Cheek Raiser (genuine smile)
    aus['AU6'] = lm.cheek_raise;

    // AU7: Lid Tightener (tension, sadness)
    aus['AU7'] = Math.max(0.5 - Math.max(lm.eye_openness_left, lm.eye_openness_right), 0);

    // AU9: Nose Wrinkler (disgust)
    aus['AU9'] = lm.nose_wrinkle;

    // AU12: Lip Corner Puller (smile)
    aus['AU12'] = lm.lip_corner_pull;

    // AU15: Lip Corner Depressor (sadness)
    aus['AU15'] = Math.max(0.3 - lm.lip_corner_pull, 0);

    // AU17: Chin Raiser (sadness, doubt)
    aus['AU17'] = Math.max(0.5 - lm.jaw_drop, 0);

    // AU20: Lip Stretcher (fear)
    aus['AU20'] = Math.abs(lm.head_yaw || 0) * 0.2;

    // AU25: Lips Part (surprise, pain)
    aus['AU25'] = Math.max(lm.mouth_openness - 0.2, 0);

    // AU26: Jaw Drop (sadness, shock)
    aus['AU26'] = lm.jaw_drop;

    // AU43: Eyes Closed (blink, sleep, death feign)
    aus['AU43'] = Math.max(0.5 - Math.max(lm.eye_openness_left, lm.eye_openness_right), 0);

    // ─── EKMAN 7 BASIC EMOTIONS ───
    const emotions = {
        anger:    Math.min(aus['AU4'] * 0.8 + aus['AU5'] * 0.2, 1),      // Brow lower + eye tighten
        fear:     Math.min(aus['AU5'] * 0.6 + aus['AU20'] * 0.4, 1),     // Eyes wide + lips stretched
        sadness:  Math.min(aus['AU15'] * 0.5 + aus['AU17'] * 0.3 + aus['AU7'] * 0.2, 1), // Lip down + chin raised
        joy:      Math.min(aus['AU12'] * 0.7 + aus['AU6'] * 0.3, 1),     // Lip smile + cheek raise
        surprise: Math.min(aus['AU5'] * 0.6 + aus['AU25'] * 0.4, 1),     // Eyes wide + mouth open
        disgust:  Math.min(aus['AU9'] * 0.7 + aus['AU15'] * 0.3, 1),     // Nose wrinkle + lip down
        contempt: Math.min(Math.abs(aus['AU12'] - aus['AU15']) * 0.5, 1) // Asymmetrical smile
    };

    // Normalize
    const maxEmotion = Math.max(...Object.values(emotions));
    Object.keys(emotions).forEach(e => {
        emotions[e] = maxEmotion > 0 ? emotions[e] / maxEmotion : 0;
    });

    // Find dominant emotion
    const dominant = Object.entries(emotions)
        .sort((a, b) => b[1] - a[1])[0];

    // ─── MICRO-EXPRESSION TIMING ───
    // (Real emotions: 0.5-4 seconds, Fake: 1-5 seconds)
    const isMicroExpression = maxEmotion > 0.3 && maxEmotion < 0.7;

    return {
        action_units: aus,
        emotions,
        dominant_emotion: dominant ? dominant[0] : 'neutral',
        emotion_intensity: dominant ? dominant[1] : 0,
        is_micro_expression: isMicroExpression,
        authenticity_score: maxEmotion > 0.8 ? 'likely_real' : maxEmotion < 0.3 ? 'suppressed' : 'mixed'
    };
};

// ─── BLINK RATE & PUPIL ANALYSIS (Cognitive Load, Stress, Arousal) ──────────────
// Blink rate: Normal 15-20/min, Stress 20-26/min, Yalan 25-30/min

const analyzeBlink = (eyeData = {}) => {
    // eyeData format:
    // { left_eye_openness: 0-1, right_eye_openness: 0-1, frames: [...] }

    if (!eyeData.left_eye_openness) return null;

    const eyeAvg = (eyeData.left_eye_openness + eyeData.right_eye_openness) / 2;
    const signals = [];
    let cognitiveLoad = 0;

    // 1. BLINK DETECTION (EAR < 0.2 = blink)
    const isBlinking = eyeAvg < 0.2;

    // 2. BLINK RATE ANALYSIS (requires frame history)
    // Normal: 15-20/min = 0.25-0.33/sec
    // Stress: 20-26/min = 0.33-0.43/sec
    // Lying: 25-30/min = 0.41-0.5/sec

    if (eyeData.blink_rate) {
        if (eyeData.blink_rate > 0.5) {
            signals.push('👀 ÇOK HIZLI GÖZ KIRMASI: Yalan/derin stres/uyarı');
            cognitiveLoad += 0.4;
        } else if (eyeData.blink_rate > 0.35) {
            signals.push('👁️ HIZLI GÖZ KIRMASI: Stres/kaygı/zihinsel yük');
            cognitiveLoad += 0.25;
        } else if (eyeData.blink_rate < 0.15) {
            signals.push('🔍 ÇOK DÜŞÜK GÖZ KIRMASI: Yoğun konsantrasyon/odaklanma');
            cognitiveLoad += 0.15;
        }
    }

    // 3. PUPIL DILATION (Requires iris tracking)
    if (eyeData.pupil_dilation !== undefined) {
        if (eyeData.pupil_dilation > 0.15) {
            signals.push('🔆 PÜPİLLER GENİŞ: Arousal/ilgi/emosyonel reaksiyon');
            cognitiveLoad += 0.2;
        } else if (eyeData.pupil_dilation < -0.1) {
            signals.push('🔅 PÜPİLLER DARAMLAMIS: Boredom/rahatsızlık');
            cognitiveLoad += 0.1;
        }
    }

    // 4. EYE GAZE DIRECTION (Looking away = uncertainty/shame/lying)
    if (eyeData.gaze_direction) {
        const { x, y } = eyeData.gaze_direction;
        if (Math.abs(x) > 0.3) {
            signals.push(`👀 YANYANA BAKIŞLAR (${x > 0 ? 'sağa' : 'sola'}): Şüphe/kaçış/yalan`);
            cognitiveLoad += 0.15;
        }
        if (y > 0.3) {
            signals.push('⬆️ YUKARIYA BAKIŞLAR: Hatırlamaya çalışma/hayal kurma');
            cognitiveLoad += 0.1;
        }
        if (y < -0.2) {
            signals.push('⬇️ AŞAĞIYA BAKIŞLAR: Utanç/suçluluk/acı');
            cognitiveLoad += 0.15;
        }
    }

    // 5. BLINK SUPPRESSION (Normally suppressed during lying)
    const blinkSuppressed = eyeData.blink_rate ? eyeData.blink_rate < 0.2 : false;

    return {
        is_blinking: isBlinking,
        signals,
        cognitive_load: Math.min(cognitiveLoad, 1),
        blink_rate: eyeData.blink_rate || null,
        pupil_dilation: eyeData.pupil_dilation || null,
        gaze_direction: eyeData.gaze_direction || null,
        blink_suppressed: blinkSuppressed,
        interpretation: cognitiveLoad > 0.6
            ? '🚨 Yüksek zihinsel yük / Stres / Olası yalan'
            : cognitiveLoad > 0.3
            ? '⚠️ Orta düzey stres / Konsantrasyon'
            : '✅ Normal, rahat'
    };
};

// ─── COMBINED FACIAL ANALYSIS (Micro + Hand + Blink) ─────────────────────────────

const advancedFacialAnalysis = (landmarks, handLandmarks, eyeData) => {
    const microExpressions = detectMicroExpressions(landmarks);
    const handInteraction = analyzeHandFaceInteraction(handLandmarks, landmarks);
    const blinkAnalysis = analyzeBlink(eyeData);

    // Combine signals
    const allSignals = [];
    if (microExpressions) allSignals.push(`[MICRO] ${microExpressions.dominant_emotion.toUpperCase()} (${(microExpressions.emotion_intensity * 100).toFixed(0)}%)`);
    if (handInteraction && handInteraction.stress_indicators.length > 0) {
        allSignals.push(...handInteraction.stress_indicators);
    }
    if (blinkAnalysis && blinkAnalysis.signals.length > 0) {
        allSignals.push(...blinkAnalysis.signals);
    }

    // Final assessment
    const stressLevel = {
        micro: microExpressions?.emotion_intensity || 0,
        hand: handInteraction?.stress_score || 0,
        blink: blinkAnalysis?.cognitive_load || 0
    };

    const avgStress = (stressLevel.micro + stressLevel.hand + stressLevel.blink) / 3;

    return {
        micro_expressions: microExpressions,
        hand_face_interaction: handInteraction,
        blink_analysis: blinkAnalysis,
        combined_signals: allSignals,
        overall_stress_level: avgStress,
        confidence: Math.min(
            (microExpressions ? 0.4 : 0) +
            (handInteraction ? 0.3 : 0) +
            (blinkAnalysis ? 0.3 : 0),
            1
        ),
        recommendation: avgStress > 0.7
            ? '🚨 YÜKSEK STRES / OLASI YALAN: Derin konuşmaya ihtiyaç. Güven ortamı oluştur.'
            : avgStress > 0.4
            ? '⚠️ ORTA STRES: Rahatlama tekniği öner (nefes, mindfulness). Açık konuşmayı teşvik et.'
            : '✅ DÜŞÜK STRES: Rahat, uyumlu. Derinlemesine konuşabilirsin.'
    };
};

// Test Landmark Analysis
app.get('/test-landmarks', async (req, res) => {
    const testLandmarks = {
        brow_down_left: 0.6,
        brow_down_right: 0.5,
        eye_openness_left: 0.3,
        eye_openness_right: 0.25,
        mouth_openness: 0.15,
        lip_corner_pull: 0.2,
        cheek_raise: 0.05,
        jaw_drop: 0.1,
        head_tilt: 0.02,
        nose_wrinkle: 0.15,
        ear: 0.27
    };

    const context = buildLandmarkContext(testLandmarks);
    res.json({
        landmarks: testLandmarks,
        analysis: context
    });
});

// ─── TEST ENDPOINT: ADVANCED FACIAL ANALYSIS ──────────────────────
app.get('/test-advanced-facial', async (req, res) => {
    try {
        // Test Case 1: High Stress (Anxiety) + Deception Signals
        const testLandmarks1 = [
            // Simplified: 468-point array, we'll use indices directly
            ...Array(468).fill({ x: 0.5, y: 0.5 }),
        ];
        // Override key points with stress indicators
        testLandmarks1[107] = { x: 0.4, y: 0.3 }; // L_BROW_INNER (raised)
        testLandmarks1[105] = { x: 0.4, y: 0.35 }; // L_BROW_MID
        testLandmarks1[336] = { x: 0.6, y: 0.3 }; // R_BROW_INNER (raised)
        testLandmarks1[334] = { x: 0.6, y: 0.35 }; // R_BROW_MID
        testLandmarks1[159] = { x: 0.35, y: 0.4 }; // L_EYE_TOP (wide open)
        testLandmarks1[145] = { x: 0.35, y: 0.5 }; // L_EYE_BOT
        testLandmarks1[386] = { x: 0.65, y: 0.4 }; // R_EYE_TOP
        testLandmarks1[374] = { x: 0.65, y: 0.5 }; // R_EYE_BOT
        testLandmarks1[13] = { x: 0.5, y: 0.55 }; // MOUTH_TOP
        testLandmarks1[14] = { x: 0.5, y: 0.65 }; // MOUTH_BOT (open)
        testLandmarks1[61] = { x: 0.3, y: 0.6 }; // MOUTH_L
        testLandmarks1[291] = { x: 0.7, y: 0.6 }; // MOUTH_R

        const testBlendshapes1 = [{
            categories: [
                { categoryName: 'browDownLeft', score: 0.7 },
                { categoryName: 'browDownRight', score: 0.6 },
                { categoryName: 'cheekSquintLeft', score: 0.3 },
                { categoryName: 'cheekSquintRight', score: 0.3 }
            ]
        }];

        const testHandLandmarks1 = Array(21).fill({ x: 0.25, y: 0.45 }); // Hand near mouth (deception)
        const testEyeData1 = {
            blink_rate: 0.27, // High blink rate (stress/lying)
            pupil_dilation: 0.12,
            gaze_direction: { x: 0.3, y: 0 } // Gaze left (doubt/deception)
        };

        const analysis1 = advancedFacialAnalysis(testLandmarks1, testHandLandmarks1, testEyeData1);

        // Test Case 2: Calm/Content (Low Stress)
        const testLandmarks2 = [...Array(468).fill({ x: 0.5, y: 0.5 })];
        testLandmarks2[107] = { x: 0.4, y: 0.35 }; // L_BROW_INNER (neutral)
        testLandmarks2[105] = { x: 0.4, y: 0.35 }; // L_BROW_MID
        testLandmarks2[159] = { x: 0.35, y: 0.45 }; // L_EYE_TOP (normal)
        testLandmarks2[145] = { x: 0.35, y: 0.5 }; // L_EYE_BOT
        testLandmarks2[13] = { x: 0.5, y: 0.6 }; // MOUTH_TOP
        testLandmarks2[14] = { x: 0.5, y: 0.62 }; // MOUTH_BOT (slightly open, smile)

        const testBlendshapes2 = [{
            categories: [
                { categoryName: 'mouthSmileLeft', score: 0.6 },
                { categoryName: 'mouthSmileRight', score: 0.6 },
                { categoryName: 'cheekSquintLeft', score: 0.4 }
            ]
        }];

        const testHandLandmarks2 = Array(21).fill({ x: 0.8, y: 0.8 }); // Hand far from face (open)
        const testEyeData2 = {
            blink_rate: 0.18, // Normal blink rate
            pupil_dilation: 0.05,
            gaze_direction: { x: 0, y: 0 } // Straight ahead (confident)
        };

        const analysis2 = advancedFacialAnalysis(testLandmarks2, testHandLandmarks2, testEyeData2);

        res.json({
            test_cases: [
                {
                    name: 'High Stress / Deception Signals',
                    description: 'Raised eyebrows, wide eyes, open mouth, hand near mouth, high blink, gaze avoidance',
                    analysis: analysis1
                },
                {
                    name: 'Calm / Content',
                    description: 'Relaxed face, genuine smile, hand away from face, normal blink, direct gaze',
                    analysis: analysis2
                }
            ],
            summary: {
                test1_stress: (analysis1.overall_stress_level * 100).toFixed(1) + '%',
                test1_recommendation: analysis1.recommendation,
                test2_stress: (analysis2.overall_stress_level * 100).toFixed(1) + '%',
                test2_recommendation: analysis2.recommendation
            }
        });
    } catch (err) {
        console.error('[TEST-ADVANCED-FACIAL] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Bilgi Bankası Durumu Endpoint
app.get('/knowledge-stats', async (req, res) => {
    try {
        const { count: totalSources } = await supabase
            .from('knowledge_sources')
            .select('*', { count: 'exact', head: true });

        const { count: activeSources } = await supabase
            .from('knowledge_sources')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        const { data: byCategory } = await supabase
            .from('knowledge_sources')
            .select('category');

        const categoryCount = {};
        (byCategory || []).forEach(s => {
            categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
        });

        const { data: avgCredibility } = await supabase
            .from('knowledge_sources')
            .select('credibility_score')
            .eq('is_active', true);

        const avgScore = avgCredibility && avgCredibility.length > 0
            ? (avgCredibility.reduce((s, x) => s + (x.credibility_score || 0), 0) / avgCredibility.length).toFixed(3)
            : 0;

        res.json({
            total_sources: totalSources || 0,
            active_sources: activeSources || 0,
            average_credibility: parseFloat(avgScore),
            by_category: categoryCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── İNSAN ANALİZİ MOTORU (Bilinçaltı Tetikleyicileri) ────────────────────────
// Kullanıcının gizli motivleri, önyargıları, tetikleyicileri tespit et

async function analyzeHumanBehavior(userId, transcript, emotions) {
    try {
        // Geçmiş seanslardan patterns çek
        const { data: sessions } = await supabase
            .from('emotion_logs')
            .select('transcript, emotion_intensity, dominant_emotion')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(10);

        if (!sessions || sessions.length === 0) return null;

        // Şu anki emotion
        const currentEmotion = emotions?.dominant || 'unknown';
        const currentIntensity = emotions?.intensity || 0.5;

        // 1️⃣ TETIKLEYICI TESPITI
        const triggers = {};
        sessions.forEach(s => {
            const words = (s.transcript || '').toLowerCase().split(/\s+/);
            const emotion = s.dominant_emotion;
            words.forEach(word => {
                if (word.length > 3) {
                    triggers[word] = triggers[word] || { count: 0, emotions: {} };
                    triggers[word].count++;
                    triggers[word].emotions[emotion] = (triggers[word].emotions[emotion] || 0) + 1;
                }
            });
        });

        // En sık tetikleyicileri bul
        const topTriggers = Object.entries(triggers)
            .filter(([word, data]) => data.count >= 2)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([word, data]) => ({
                trigger: word,
                frequency: data.count,
                associated_emotions: data.emotions
            }));

        // 2️⃣ DUYGUSAL TRENDLER
        const emotionTrend = {};
        sessions.forEach(s => {
            const emotion = s.dominant_emotion;
            emotionTrend[emotion] = (emotionTrend[emotion] || 0) + 1;
        });
        const dominantPattern = Object.entries(emotionTrend)
            .sort((a, b) => b[1] - a[1])[0];

        // 3️⃣ BİLİNÇALTI ÖNYARGILARı
        const biases = [];

        // All-or-nothing (tüm ya da hiç)
        if (transcript?.includes('hep') || transcript?.includes('asla')) {
            biases.push({
                type: 'all-or-nothing',
                indicator: 'Uç ifadeler kullanıyor',
                pattern: 'Gri alanları görmüyor',
                suggestion: 'Ara yollar var. Nuansa bakalım.'
            });
        }

        // Catastrophizing (felaketleştirme)
        if (transcript?.includes('berbat') || transcript?.includes('olmaz') ||
            transcript?.includes('imkansız')) {
            biases.push({
                type: 'catastrophizing',
                indicator: 'Negatif projeksiyonlar',
                pattern: 'Kötü senaryoları abartıyor',
                suggestion: 'Gerçekçi sonuçlar neler olabilir?'
            });
        }

        // Personalization (kişiselleştirme)
        if (transcript?.includes('benim hata') || transcript?.includes('benim suçum')) {
            biases.push({
                type: 'personalization',
                indicator: 'Aşırı sorumluluk hissi',
                pattern: 'Kontrol etmediği şeylerden sorumlu hissediyor',
                suggestion: 'Hangi kısım senin kontrolünde?'
            });
        }

        // Mind reading (okuma)
        if (transcript?.includes('biliyorum ki') || transcript?.includes('kesin') ||
            transcript?.includes('düşünüyor')) {
            biases.push({
                type: 'mind-reading',
                indicator: 'Diğerlerinin düşüncelerini biliyor sanıyor',
                pattern: 'Kanıt olmadan varsayımlarda bulunuyor',
                suggestion: 'Bunu nasıl biliyorsun? Gerçeği kontrol et.'
            });
        }

        // 4️⃣ DEĞER-DAVRANILIŞ ÇATIŞMASI
        const { data: profile } = await supabase
            .from('user_profile')
            .select('pattern_memory')
            .eq('user_id', userId)
            .single();

        let valueConflict = null;
        if (profile?.pattern_memory?.values) {
            const values = profile.pattern_memory.values;
            // Eğer değer "sağlık" ama davranış "uyumuyor"...
            if (values.includes('health') && currentIntensity > 0.7) {
                valueConflict = {
                    stated_value: 'Sağlık önemli',
                    observed_behavior: 'Ama stresli/endişeli',
                    gap: 'Değerler ile davranışlar uyumlu değil',
                    insight: 'Bu alanda çatışma var. Uyumlaştırmak ister misin?'
                };
            }
        }

        // 5️⃣ KAÇINMA DÖNGÜLERI
        const avoidancePatterns = [];
        if (currentIntensity > 0.6 && transcript?.length < 100) {
            avoidancePatterns.push({
                pattern: 'Kısacık cevaplar + yüksek duygu',
                meaning: 'Konudan kaçıyor olabilir',
                intervention: 'Daha derine gidelim mi? Rahatsız edici ne?'
            });
        }

        return {
            top_triggers: topTriggers,
            dominant_emotion_pattern: dominantPattern ? dominantPattern[0] : null,
            cognitive_biases: biases,
            value_behavior_conflict: valueConflict,
            avoidance_patterns: avoidancePatterns,
            analysis_timestamp: new Date().toISOString()
        };

    } catch (err) {
        console.error('[HUMAN-ANALYSIS] Hata:', err.message);
        return null;
    }
}

// Endpoint: İnsan analizi sonuçları
app.post('/analyze-human-behavior', async (req, res) => {
    try {
        const { userId, transcript, emotions } = req.body;

        if (!userId || !transcript) {
            return res.status(400).json({ error: 'userId ve transcript gerekli' });
        }

        const analysis = await analyzeHumanBehavior(userId, transcript, emotions);

        // Fire-and-forget: analytics'e kaydet
        if (analysis) {
            supabase.from('behavior_analysis').insert([{
                user_id: userId,
                analysis_data: analysis,
                created_at: new Date().toISOString()
            }]).catch(() => {});
        }

        res.json({ success: true, analysis });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ANALYTICS: KAYNAK ETKİSİ ANALİZİ ────────────────────────────────────────
// Hangi kaynaklar kullanıcıya yardımcı oluyor?

app.get('/analytics/source-effectiveness/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Kullanılan kaynaklar + feedback
        const { data: usageLogs } = await supabase
            .from('knowledge_usage_logs')
            .select('knowledge_id, was_helpful, used_context, used_at')
            .eq('user_id', userId)
            .order('used_at', { ascending: false })
            .limit(100);

        if (!usageLogs || usageLogs.length === 0) {
            return res.json({ message: 'Henüz kaynak kullanım verisi yok', data: {} });
        }

        // Kaynakları getir
        const knowledgeIds = [...new Set(usageLogs.map(l => l.knowledge_id))];
        const { data: sources } = await supabase
            .from('knowledge_sources')
            .select('id, title, category, source_type')
            .in('id', knowledgeIds);

        // Effectiveness hesapla
        const sourceStats = {};
        usageLogs.forEach(log => {
            const source = sources?.find(s => s.id === log.knowledge_id);
            if (!source) return;

            const key = source.id;
            if (!sourceStats[key]) {
                sourceStats[key] = {
                    id: source.id,
                    title: source.title,
                    category: source.category,
                    type: source.source_type,
                    used_count: 0,
                    helpful_count: 0,
                    not_helpful_count: 0,
                    effectiveness: 0
                };
            }

            sourceStats[key].used_count++;
            if (log.was_helpful === true) sourceStats[key].helpful_count++;
            else if (log.was_helpful === false) sourceStats[key].not_helpful_count++;
        });

        // Effectiveness % hesapla
        Object.values(sourceStats).forEach(stat => {
            stat.effectiveness = stat.used_count > 0
                ? (stat.helpful_count / stat.used_count * 100).toFixed(1)
                : 0;
        });

        // Sırala
        const sorted = Object.values(sourceStats)
            .sort((a, b) => b.used_count - a.used_count);

        // Top performers
        const topByEffectiveness = [...sorted]
            .filter(s => s.used_count >= 2)
            .sort((a, b) => parseFloat(b.effectiveness) - parseFloat(a.effectiveness))
            .slice(0, 5);

        // Summary
        const summary = {
            total_sources_used: Object.keys(sourceStats).length,
            total_uses: usageLogs.length,
            helpful_total: usageLogs.filter(l => l.was_helpful === true).length,
            effectiveness_overall: usageLogs.length > 0
                ? ((usageLogs.filter(l => l.was_helpful === true).length / usageLogs.length) * 100).toFixed(1)
                : 0,
            by_category: {},
            top_performers: topByEffectiveness
        };

        // Kategoriye göre
        sorted.forEach(stat => {
            if (!summary.by_category[stat.category]) {
                summary.by_category[stat.category] = {
                    count: 0,
                    helpful: 0,
                    effectiveness: 0
                };
            }
            summary.by_category[stat.category].count += stat.used_count;
            summary.by_category[stat.category].helpful += stat.helpful_count;
        });

        Object.keys(summary.by_category).forEach(cat => {
            const data = summary.by_category[cat];
            data.effectiveness = data.count > 0
                ? (data.helpful / data.count * 100).toFixed(1)
                : 0;
        });

        res.json({
            summary,
            all_sources: sorted
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ANALYTICS: USER BEHAVIOR TIMELINE ───────────────────────────────────────

app.get('/analytics/behavior-timeline/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { days = 30 } = req.query;

        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - parseInt(days));

        // Seans geçmişi
        const { data: sessions } = await supabase
            .from('emotion_logs')
            .select('timestamp, dominant_emotion, emotion_intensity')
            .eq('user_id', userId)
            .gte('timestamp', sinceDate.toISOString())
            .order('timestamp', { ascending: true });

        if (!sessions || sessions.length === 0) {
            return res.json({ message: `Son ${days} günde seans yok`, timeline: [] });
        }

        // Timeline oluştur
        const timeline = sessions.map(s => ({
            date: new Date(s.timestamp).toLocaleDateString('tr-TR'),
            emotion: s.dominant_emotion,
            intensity: s.emotion_intensity,
            timestamp: s.timestamp
        }));

        // Trend analizi
        const emotionTrend = {};
        sessions.forEach(s => {
            const emotion = s.dominant_emotion;
            emotionTrend[emotion] = (emotionTrend[emotion] || 0) + 1;
        });

        // Intensity trend
        const avgIntensity = (sessions.reduce((sum, s) => sum + (s.emotion_intensity || 0), 0) / sessions.length).toFixed(2);

        res.json({
            period_days: days,
            session_count: sessions.length,
            emotion_distribution: emotionTrend,
            average_intensity: avgIntensity,
            timeline
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ANALYTICS: RECOMMENDATION EFFECTIVENESS ─────────────────────────────────

app.post('/analytics/rate-recommendation', async (req, res) => {
    try {
        const { userId, knowledgeId, wasHelpful, context } = req.body;

        if (!userId || !knowledgeId) {
            return res.status(400).json({ error: 'userId ve knowledgeId gerekli' });
        }

        await supabase.from('knowledge_usage_logs').insert([{
            user_id: userId,
            knowledge_id: knowledgeId,
            was_helpful: wasHelpful === true,
            used_context: context || 'Rating provided',
            used_at: new Date().toISOString()
        }]);

        res.json({ success: true, message: 'Feedback kaydedildi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test endpoint — Cron jobs'ları manuel çalıştırma
app.get('/cron-test/:job', async (req, res) => {
    const { job } = req.params;
    try {
        console.log(`[CRON-TEST] ${job} manuel başlatılıyor...`);

        if (job === 'discovery') await autonomousSourceDiscovery();
        else if (job === 'quality') await assessKnowledgeQuality();
        else if (job === 'gaps') await detectKnowledgeGaps();
        else if (job === 'credibility') await verifySourceCredibility();
        else return res.status(400).json({ error: 'Geçersiz job: discovery|quality|gaps|credibility' });

        res.json({ status: 'success', job, message: `${job} tamamlandı` });
    } catch (err) {
        console.error(`[CRON-TEST] Hata:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── SUNUCU BAŞLAT ─────────────────────────────────────────
// Vercel serverless için app export ediliyor, lokal için listen
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    app.listen(port, () => {
        console.log('-------------------------------------------');
        console.log('🚀 Lyra Brain Sunucusu Çalışıyor!');
        console.log(`📍 Port: ${port}`);
        console.log('🧠 Mimari: Vapi + Supabase Memory + Auth');
        console.log('🤖 Otonom Agent: Aktif (4 cron job)');
        console.log('-------------------------------------------');
    });
}

export default app;
