
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
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

const buildLayer4Rules = (lastSegment, sonAnaliz) => {
    if (!lastSegment || !sonAnaliz || !sonAnaliz.yuz_var) return '';
    const kurallar = [];
    const segLower = lastSegment.toLowerCase();

    const sozluOlumlu = OLUMLU_KELIMELER.some(k => segLower.includes(k));
    const kameraOlumsuz = OLUMSUZ_KAMERA_DUYGULAR.includes(sonAnaliz.duygu) &&
        ['orta', 'yüksek'].includes(sonAnaliz.yogunluk);

    if (sozluOlumlu && kameraOlumsuz && sonAnaliz.guven > 65)
        kurallar.push(`Kullanıcı olumlu kelimeler söylüyor ama yüzü "${sonAnaliz.duygu}" ifadesi gösteriyor. Nazikçe sorgula: "Bunu söylerken sesin biraz farklıydı, gerçekten nasılsın?"`);

    if (sozluOlumlu && sonAnaliz.genel_vucut_dili === 'kapalı' && sonAnaliz.jestler?.goz_temasi === 'düşük')
        kurallar.push('Kullanıcı olumlu konuşuyor ama beden dili kapalı ve göz teması düşük. "Biraz daha anlatır mısın bunu?" diye sor.');

    if (sonAnaliz.yogunluk === 'yüksek' && (segLower.includes('önemli değil') || segLower.includes('saçma') || segLower.includes("doesn't matter")))
        kurallar.push('Kullanıcı yüksek duygusal yoğunlukta ama durumu önemsiz gösteriyor. "Bu duygu gerçek ve önemli" mesajını ver.');

    return kurallar.join(' ');
};

// L5: Sessizlik & Ritim
const buildLayer5Rules = (silenceDuration) => {
    if (!silenceDuration || silenceDuration < 10) return '';
    if (silenceDuration >= 10 && silenceDuration < 20)
        return 'Kullanıcı uzun süredir sessiz. "Seninle buradayım, hazır olduğunda devam edebiliriz" de.';
    if (silenceDuration >= 20)
        return 'Kullanıcı çok uzun süredir sessiz. "Şu an kelimeler gelmiyorsa, o da tamam. Sessizlik de bir cevap." de.';
    return '';
};

// L6: Seanslar Arası Pattern
const buildLayer6Rules = (patternMemory, sonAnaliz, dominantDuygu) => {
    if (!patternMemory || !sonAnaliz) return '';
    const kurallar = [];

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

    return kurallar.join(' ');
};

const buildLayer1Rules = (sonAnaliz, aktifSinyaller) => {
    if (!sonAnaliz || !sonAnaliz.yuz_var) return '';
    const kurallar = [];
    const { duygu, yogunluk, enerji, jestler, guven } = sonAnaliz;

    if (duygu === 'korkmuş' && guven > 80 && jestler?.gozyasi_izi === true)
        kurallar.push('Kullanıcı korkmuş ve gözyaşı izi var. Önce güven ver, hiç soru sorma. Sessiz, kısa, destekleyici cümleler kur.');

    if (duygu === 'sinirli' || duygu === 'iğnelenmiş' || duygu === 'küçümseyen')
        kurallar.push('Kullanıcı sinirli/rahatsız görünüyor. Önce duyguyu doğrula: "Seni bir şey rahatsız ediyor gibi, söylemek ister misin?" — çözüm önerme, tavsiye verme.');

    if (duygu === 'sinirli' && jestler?.cene_gerginligi === 'yüksek')
        kurallar.push('Yüksek çene gerginliği var — ciddi öfke sinyali. Sakin kal, yavaş konuş, zemine in.');

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
    const hepsiYogun = son5.length === 5 && son5.every(a => a.yogunluk === 'yüksek' || a.yogunluk === 'orta');
    if (hepsiYogun)
        kurallar.push(`Kullanıcı uzun süredir ${dominantDuygu} hissediyor. Bu duyguyu doğrudan nazikçe ele almayı düşün.`);

    const yogunlukOrt = gecmis.reduce((s, a) => s + yogunlukToNum(a.yogunluk), 0) / gecmis.length;
    if (yogunlukOrt > 75 && gecmis.length >= 5)
        kurallar.push('Kullanıcı bu seans boyunca yüksek duygusal yoğunlukta. Sabırlı ve yavaş ol.');

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
    }

    return kurallar.join(' ');
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
        return data?.content || '';
    } catch { return ''; }
};

const saveMemory = async (userId, content) => {
    if (!userId) return;
    try {
        await supabase.from('memories').upsert({ user_id: userId, content, updated_at: new Date().toISOString() });
    } catch (e) { console.error('[MEMORY] Kaydetme hatası:', e.message); }
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

            const summary = summaryResponse.choices[0].message.content + emotionOzeti;
            await saveMemory(userId, summary);
            console.log(`[BRAIN ASCENSION] ✅ Hafıza mühürlendi! userId: ${userId}`);
            console.log(`[BRAIN ASCENSION] Özet: ${summary.substring(0, 100)}...`);

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
    const { userId, transcript } = req.body;

    if (!userId || !transcript || transcript.length < 50) {
        return res.sendStatus(200);
    }

    console.log(`[LOCAL MEMORY] Özetleniyor... userId: ${userId}`);
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

        const summary = summaryResponse.choices[0].message.content;
        await saveMemory(userId, summary);
        console.log(`[LOCAL MEMORY] ✅ Hafıza başarıyla kaydedildi!`);
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

        const systemIdx = enrichedMessages.findIndex(m => m.role === 'system');
        if (userMemory) {
            const memoryInjection = `\n\n[BU KULLANICI HAKKINDAKİ HAFIZA]:\n${userMemory}\n\nBu bilgileri doğal şekilde kullan, asla "seni hatırlıyorum" diyerek açıkça belirtme.`;
            if (systemIdx !== -1) {
                enrichedMessages[systemIdx] = { ...enrichedMessages[systemIdx], content: enrichedMessages[systemIdx].content + memoryInjection };
            } else {
                enrichedMessages.unshift({ role: 'system', content: memoryInjection });
            }
            console.log(`[CUSTOM LLM] 🧠 Hafıza inject edildi! userId: ${userId}`);
        }

        const userState = userEmotions.get(userId);
        if (userState) {
            const { son_analiz, trend, dominant_duygu, aktif_sinyal, gecmis, yogunluk_ort } = userState;

            const l1 = buildLayer1Rules(son_analiz, aktif_sinyal);
            const l2 = buildLayer2Rules(trend, dominant_duygu, gecmis || []);
            const l3 = buildLayer3Rules(userMemory, son_analiz, userId);

            // L4: Söz-yüz çelişkisi
            const transcriptState = sessionTranscriptStore.get(userId);
            const l4 = buildLayer4Rules(transcriptState?.lastSegment, son_analiz);

            // L5: Sessizlik
            const l5 = buildLayer5Rules(transcriptState?.silenceDuration);

            // L6: Seanslar arası pattern
            let l6 = '';
            try {
                const { data: memRow } = await supabase
                    .from('memories')
                    .select('pattern_memory')
                    .eq('user_id', userId)
                    .single();
                const patternMemory = memRow?.pattern_memory || {};
                l6 = buildLayer6Rules(patternMemory, son_analiz, dominant_duygu);
            } catch { /* pattern_memory yoksa geç */ }

            const tumKurallar = [l1, l2, l3, l4, l5, l6].filter(Boolean).join(' ');

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

// ─── YÜZDEN DUYGU ANALİZİ (GPT-4o Vision — Zengin) ────────
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
                        text: `Sen deneyimli bir klinik psikolog ve yüz ifadesi uzmanısın. Görüntüdeki kişinin yüzünü ve beden dilini mikro-ifadeler dahil son derece dikkatli analiz et.

KRİTİK KURALLAR:
1. "sakin" ancak gerçekten hiçbir duygu belirtisi yoksa yaz. Şüphe durumunda en belirgin duyguyu seç.
2. Kaş çatma, çene gerginliği, sıkılmış dudaklar, dar gözler = sinirli/gergin işareti.
3. Düşük göz teması, omuz çöküklüğü, sarkık yüz = üzgün/yorgun işareti.
4. Hızlı göz kırpma, geniş gözler, gergin alın = endişeli/korkmuş işareti.
5. Yüz görünmüyorsa veya görüntü çok karanlıksa SADECE {"yuz_var":false} döndür.
6. guven değeri: gerçekten emin olduğunda 80+, tahmin ise 50-70 yaz.

Yalnızca geçerli JSON döndür, başka metin ekleme:
{"duygu":"mutlu|üzgün|endişeli|korkmuş|sakin|şaşırmış|sinirli|yorgun|iğnelenmiş|küçümseyen","yogunluk":"düşük|orta|yüksek","enerji":"canlı|normal|yorgun","jestler":{"kas_catma":true,"goz_temasi":"yüksek|normal|düşük","goz_kirpma_hizi":"hızlı|normal|yavaş","gulümseme_tipi":"gerçek|sosyal|yok","bas_egme":false,"omuz_durusu":"yüksek|normal|düşük","cene_gerginligi":"yüksek|orta|düşük","dudak_sikistirma":false,"gozyasi_izi":false,"kasin_pozisyonu":"yukari|normal|asagi|catan"},"genel_vucut_dili":"açık|nötr|kapalı","guven":85,"yuz_var":true,"timestamp":0}`
                    },
                    {
                        type: 'image_url',
                        image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' }
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

// ─── SUNUCU BAŞLAT ─────────────────────────────────────────
// Vercel serverless için app export ediliyor, lokal için listen
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    app.listen(port, () => {
        console.log('-------------------------------------------');
        console.log('🚀 Lyra Brain Sunucusu Çalışıyor!');
        console.log(`📍 Port: ${port}`);
        console.log('🧠 Mimari: Vapi + Supabase Memory + Auth');
        console.log('-------------------------------------------');
    });
}

export default app;
