
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

// --- DUYGU DURUMU TAKİBİ ---
const userEmotions = new Map(); // userId -> { duygu, guven, timestamp }

// --- AKTİF OTURUM ---
let activeSessionUserId = null;

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
                console.log(`[SESSION] Aktif kullanıcı: ${user.id} (${user.email})`);
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

            const summary = summaryResponse.choices[0].message.content;
            await saveMemory(userId, summary);
            console.log(`[BRAIN ASCENSION] ✅ Hafıza mühürlendi! userId: ${userId}`);
            console.log(`[BRAIN ASCENSION] Özet: ${summary.substring(0, 100)}...`);
        } catch (err) {
            console.error('[BRAIN ASCENSION] ❌ Özetleme hatası:', err.message);
        }
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

        const latestEmotion = userEmotions.get(userId);
        if (latestEmotion) {
            console.log(`[CUSTOM LLM] 🎭 Duygu Enjeksiyonu: ${latestEmotion.duygu} (%${latestEmotion.guven})`);
            const sysIdx = enrichedMessages.findIndex(m => m.role === 'system');
            if (sysIdx !== -1) {
                enrichedMessages[sysIdx] = {
                    ...enrichedMessages[sysIdx],
                    content: enrichedMessages[sysIdx].content + `\n\n[GİZLİ DUYGU VERİSİ - Kamera Analizi]: Kullanıcı şu an ${latestEmotion.duygu} görünüyor (%${latestEmotion.guven} güven). Bu duyguyu cevaba doğal şekilde yansıt (örn: sakinse sen de sakin kal, çok korkmuşsa teselli et).`
                };
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

// ─── YÜZDEN DUYGU ANALİZİ (GPT-4o Vision) ─────────────────
app.post('/analyze-emotion', async (req, res) => {
    try {
        const { imageBase64, userId } = req.body;
        if (!imageBase64) return res.json({ duygu: 'sakin', guven: 0 });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Bu yüzün duygusunu analiz et. Sadece JSON döndür: {"duygu":"mutlu|üzgün|endişeli|korkmuş|sakin|şaşırmış|sinirli","guven":80}' },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' } }
                ]
            }],
            max_tokens: 60
        });

        let result = { duygu: 'sakin', guven: 50 };
        try {
            const raw = response.choices[0].message.content.trim().replace(/```json|```/g, '');
            result = JSON.parse(raw);
        } catch { }

        if (userId) {
            userEmotions.set(userId, { ...result, timestamp: Date.now() });
        }

        console.log(`[DUYGU] ${userId || '?'}: ${result.duygu} %${result.guven}`);
        res.json(result);
    } catch (err) {
        console.error('[DUYGU] Hata:', err.message);
        res.json({ duygu: 'sakin', guven: 0 });
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
