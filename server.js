
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
app.use(express.static(path.join(__dirname, 'public')));

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
    const hepsiYogun = son5.length === 5 && son5.every(a => a.yogunluk === 'yüksek' || a.yogunluk === 'orta');
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

// --- DUYGU DURUMU TAKİBİ ---
const userEmotions = new Map(); // userId -> { duygu, guven, timestamp }

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
