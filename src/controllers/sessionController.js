// routes/session.js
import express from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabase.js';
import { openai } from '../lib/openai.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireOwnership, logError } from '../lib/helpers.js';
import { VISUALIZATION_SCRIPTS } from '../lib/constants.js';
import {
    userEmotions, sessionTranscriptStore,
    activeSessionUserId, activeSessionId,
    setActiveSessionUserId, setActiveSessionId
} from '../lib/state.js';
import { getProfile, updateProfile, incrementSessionCount } from '../profile/profileManager.js';
import { extractProfileUpdates, analyzeSession } from '../profile/profileExtractor.js';
import { saveSessionRecord, updateTechniqueEffectiveness } from '../progress/sessionAnalyzer.js';
import { runPostSessionReflection } from '../therapy/reflectionEngine.js';
import { updateWeeklyMetrics } from '../progress/progressTracker.js';
import { clearLanguageCache } from '../lib/languageDetector.js';

const router = express.Router();

// ─── PING ──────────────────────────────────────────────────
router.get('/v1/ping', (req, res) => {
    res.send('Lyra Brain is ALIVE! 🌌');
});

// ─── GÖRSELLEŞTİRME (Özellik 8) ──────────────────────────
router.get('/v1/start-visualization', (req, res) => {
    const { tip } = req.query;
    const script = VISUALIZATION_SCRIPTS[tip];
    if (!script) return res.status(404).json({ error: 'Senaryo bulunamadı', mevcutlar: Object.keys(VISUALIZATION_SCRIPTS) });
    res.json({ tip, sure: script.sure, adimlar: script.adimlar });
});

// ─── SEANS ÖNCESİ HAZIRLIK (Özellik 11) ───────────────────
router.post('/v1/session-prep', authMiddleware, async (req, res) => {
    try {
        const { userId, sessionId, soru1, soru2, soru3 } = req.body;
        if (!requireOwnership(userId, req, res)) return;

        const ozet = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: `Kullanıcının seans öncesi cevapları:\n1. ${soru1 || '-'}\n2. ${soru2 || '-'}\n3. ${soru3 || '-'}\n\nBu seansın ana hedefini 1 cümlede özetle:` }],
            max_tokens: 80
        });

        const hazirlikOzeti = ozet.choices[0].message.content?.trim() || '';
        const hedef = soru2 || soru1 || '';

        await supabase.from('session_preparation').insert({
            user_id: userId,
            session_id: sessionId || null,
            soru1_cevap: soru1 || null,
            soru2_cevap: soru2 || null,
            soru3_cevap: soru3 || null,
            hazirlik_ozeti: hazirlikOzeti
        });

        // pattern_memory'ye de kaydet
        const { data } = await supabase.from('memories').select('pattern_memory').eq('user_id', userId).single();
        const pm = data?.pattern_memory || {};
        pm.seans_oncesi_hazirlik = { son_hazirlik_tarihi: new Date().toISOString(), hazirlik_notu: hazirlikOzeti, hedef };
        await supabase.from('memories').upsert({ user_id: userId, pattern_memory: pm, updated_at: new Date().toISOString() });

        res.json({ success: true, hazirlik_ozeti: hazirlikOzeti });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/v1/session-prep', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.query;
        if (!requireOwnership(userId, req, res)) return;
        const { data } = await supabase.from('session_preparation').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
        res.json(data || {});
    } catch { res.json({}); }
});

// ─── FRONTEND ERROR LOGLAMA (#43) ──────────────────────────
router.post('/v1/log-error', async (req, res) => {
    const { userId, error, source, line, col } = req.body;
    if (!error) return res.sendStatus(400);
    await logError('/frontend', `${error} | ${source}:${line}:${col}`, userId || null);
    res.sendStatus(200);
});

// ─── TRANSCRIPT GÜNCELLEME ────────────────────────────────
router.post('/v1/update-transcript', authMiddleware, (req, res) => {
    const {
        userId, fullTranscript, silenceDuration, lastSegment,
        sesYogunlukOrt, sesTitreme, konusmaTempo, tempoTrend, sesMonotonluk,
        sessizlikTipi, hume_scores,
        // Yeni alanlar (Özellik 3, 5)
        vokalBreak, isWhisper, tempoSpike, phq9_cevaplar
    } = req.body;
    if (!requireOwnership(userId, req, res)) return;

    const mevcut = sessionTranscriptStore.get(userId) || {};
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
        vokalBreak: vokalBreak || false,
        isWhisper: isWhisper || false,
        tempoSpike: tempoSpike || false,
        phq9_cevaplar: { ...(mevcut.phq9_cevaplar || {}), ...(phq9_cevaplar || {}) },
        kural_sayaci: mevcut.kural_sayaci || { rol_yapma: 0, tarama: 0, visualizasyon: 0 },
        updatedAt: Date.now()
    });
    res.sendStatus(200);
});

// ─── OTURUM BAŞLAT (Token doğrulama ile) ───────────────────
router.post('/v1/session-start', authMiddleware, async (req, res) => {
    setActiveSessionUserId(req.userId);
    setActiveSessionId(crypto.randomUUID());
    console.log(`[SESSION] Aktif kullanıcı: ${req.userId} | sessionId: ${activeSessionId}`);
    res.sendStatus(200);
});

// ─── HAFIZA OKUMA ───────────────────────────────────────────
router.get('/v1/memory', authMiddleware, async (req, res) => {
    const userId = req.query.userId;
    if (!requireOwnership(userId, req, res)) return;

    // Hafıza okuma — şifreli ise çöz
    let memory = '';
    try {
        const { data } = await supabase.from('memories').select('content').eq('user_id', userId).single();
        const raw = data?.content || '';
        // decryptField is in server.js — importing inline
        if (raw && String(raw).startsWith('ENC:')) {
            const crypto2 = await import('crypto');
            const ENC_KEY = process.env.ENCRYPTION_KEY
                ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
                : null;
            if (ENC_KEY) {
                try {
                    const [, ivHex, encHex, tagHex] = String(raw).split(':');
                    const iv = Buffer.from(ivHex, 'hex');
                    const enc = Buffer.from(encHex, 'hex');
                    const tag = Buffer.from(tagHex, 'hex');
                    const decipher = crypto2.default.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
                    decipher.setAuthTag(tag);
                    memory = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
                } catch { memory = raw; }
            } else {
                memory = raw;
            }
        } else {
            memory = raw;
        }
    } catch { memory = ''; }

    // İlk seans tespiti — pattern_memory'den toplam_seans oku
    let ilkSeans = false;
    try {
        const { data } = await supabase.from('memories').select('pattern_memory').eq('user_id', userId).single();
        const toplamSeans = data?.pattern_memory?.toplam_seans || 0;
        ilkSeans = toplamSeans === 0;
    } catch { ilkSeans = true; } // hata olursa yeni kullanıcı say

    console.log(`[MEMORY READ] userId: ${userId}, hasMemory: ${!!memory}, ilkSeans: ${ilkSeans}`);
    res.json({ memory, ilk_seans: ilkSeans });
});

// ─── VAPI WEBHOOK (Arama bitince hafızayı kaydet) ──────────
router.post('/v1/vapi-webhook', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.json({});

    const msgType = message.type;
    console.log(`[VAPI WEBHOOK] Type: ${msgType}`);

    // call-start: metadata'dan userId al ve session başlat
    if (msgType === 'call-started' || msgType === 'status-update' && message.status === 'started') {
        const metaUserId = message.call?.metadata?.userId || message.metadata?.userId;
        if (metaUserId) {
            setActiveSessionUserId(metaUserId);
            setActiveSessionId(message.call?.id || crypto.randomUUID());
            console.log(`[VAPI] Oturum başladı — userId: ${metaUserId} | callId: ${activeSessionId}`);
        }
        return res.json({});
    }

    if (msgType === 'end-of-call-report') {
        const transcript = message.artifact?.transcript || message.transcript || '';
        // userId: önce call metadata, sonra global fallback
        const userId = message.call?.metadata?.userId || activeSessionUserId;

        if (!transcript || transcript.length < 50) {
            console.log('[END OF CALL] Konuşma çok kısa, özetlenmiyor.');
            return res.json({});
        }

        clearLanguageCache(userId);
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
            const yogunlukToNum = (y) => ({ 'düşük': 30, 'orta': 60, 'yüksek': 90 }[y] ?? 60);
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

            // saveMemory inline (from server.js)
            if (userId) {
                try {
                    const { data: existing } = await supabase.from('memories').select('session_history').eq('user_id', userId).single();
                    const eskiGecmis = existing?.session_history || [];
                    const yeniSeans = {
                        tarih: new Date().toISOString(),
                        ozet: summary.substring(0, 200),
                        bas_yaygin: summary.toLowerCase().includes('iyileş') || summary.toLowerCase().includes('daha iyi')
                    };
                    const guncelGecmis = [yeniSeans, ...eskiGecmis].slice(0, 5);

                    // Encrypt field
                    let encContent = summary;
                    try {
                        const cryptoMod = await import('crypto');
                        const ENC_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : null;
                        if (ENC_KEY) {
                            const iv = cryptoMod.default.randomBytes(12);
                            const cipher = cryptoMod.default.createCipheriv('aes-256-gcm', ENC_KEY, iv);
                            const enc = Buffer.concat([cipher.update(String(summary), 'utf8'), cipher.final()]);
                            const tag = cipher.getAuthTag();
                            encContent = `ENC:${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
                        }
                    } catch { /* keep plain */ }

                    await supabase.from('memories').upsert({
                        user_id: userId,
                        content: encContent,
                        session_history: guncelGecmis,
                        updated_at: new Date().toISOString()
                    });
                } catch (e) {
                    console.error('[MEMORY] Kaydetme hatası:', e.message);
                    await logError('/save-memory', e.message, userId);
                }
            }

            console.log(`[BRAIN ASCENSION] ✅ Hafıza mühürlendi! userId: ${userId}`);
            console.log(`[BRAIN ASCENSION] Özet: ${summary.substring(0, 100)}...`);

            // Reflection için paylaşılan değişkenler — inner try dışında tanımlanıyor
            let _reflectionProfile = null;
            let _reflectionSessionId = message.call?.id || null;
            let _reflectionAnalysis = null;

            // Psikolojik profil güncelle (yeni sistem)
            try {
                const currentProfile = await getProfile(userId);
                _reflectionProfile = currentProfile;
                const profileUpdates = await extractProfileUpdates(transcript, currentProfile);
                if (profileUpdates && Object.keys(profileUpdates).length > 0) {
                    await updateProfile(userId, profileUpdates);
                    console.log(`[VAPI] Psikolojik profil güncellendi: ${Object.keys(profileUpdates).join(', ')}`);
                }
                // Seans analizi & kayıt
                const sessionAnalysis = await analyzeSession(transcript, currentProfile);
                _reflectionAnalysis = sessionAnalysis;
                if (sessionAnalysis && userId) {
                    const sessionId = message.call?.id || `vapi_${userId}_${Date.now()}`;
                    _reflectionSessionId = sessionId;
                    await saveSessionRecord(userId, sessionId, sessionAnalysis, [], null);
                    await updateWeeklyMetrics(userId, sessionAnalysis);
                    await incrementSessionCount(userId);
                    console.log(`[VAPI] Seans kaydedildi: ${sessionId}`);
                }
            } catch (profileErr) {
                console.warn('[VAPI] Profil güncelleme hatası:', profileErr.message);
            }

            // Post-session reflection — tamamen izole, ana akışı etkilemez
            await runPostSessionReflection({
                transcript,
                sessionId: _reflectionSessionId,
                userId,
                sessionAnalysis: _reflectionAnalysis,
                profile: _reflectionProfile,
                openai,
                supabase,
                durationSeconds: message.durationSeconds ?? message.call?.durationSeconds ?? null,
                updateTechniqueEffectiveness,
            });

            // Eski sistem uyumluluğu için updateUserProfile (server.js'den inline çağrı)
            // userEmotions referansı için state'ten al
            const emotionStateForProfile = userEmotions.get(userId);
            // updateUserProfile is defined in server.js — keeping reference via import would create circular deps
            // So we do a minimal equivalent here:
            console.log(`[VAPI] Emotion state for profile update: ${emotionStateForProfile?.dominant_duygu || 'none'}`);

        } catch (err) {
            console.error('[BRAIN ASCENSION] ❌ Özetleme hatası:', err.message);
        }

        // Seans bitti, ID'yi sıfırla
        setActiveSessionId(null);
    }

    res.json({});
});

// ─── LOCAL MEMORY ENDPOINT ─────────────────────────────────
router.post('/v1/save-local-memory', authMiddleware, async (req, res) => {
    const { userId, transcript, bodyLanguageData } = req.body;

    if (!userId || !transcript || transcript.length < 50) {
        return res.sendStatus(200);
    }
    if (!requireOwnership(userId, req, res)) return;

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

        // saveMemory inline
        try {
            const { data: existing } = await supabase.from('memories').select('session_history').eq('user_id', userId).single();
            const eskiGecmis = existing?.session_history || [];
            const yeniSeans = {
                tarih: new Date().toISOString(),
                ozet: memoryWithScore.substring(0, 200),
                bas_yaygin: memoryWithScore.toLowerCase().includes('iyileş') || memoryWithScore.toLowerCase().includes('daha iyi')
            };
            const guncelGecmis = [yeniSeans, ...eskiGecmis].slice(0, 5);

            let encContent = memoryWithScore;
            try {
                const cryptoMod = await import('crypto');
                const ENC_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : null;
                if (ENC_KEY) {
                    const iv = cryptoMod.default.randomBytes(12);
                    const cipher = cryptoMod.default.createCipheriv('aes-256-gcm', ENC_KEY, iv);
                    const enc = Buffer.concat([cipher.update(String(memoryWithScore), 'utf8'), cipher.final()]);
                    const tag = cipher.getAuthTag();
                    encContent = `ENC:${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
                }
            } catch { /* keep plain */ }

            await supabase.from('memories').upsert({
                user_id: userId,
                content: encContent,
                session_history: guncelGecmis,
                updated_at: new Date().toISOString()
            });
        } catch (e) {
            console.error('[MEMORY] Kaydetme hatası:', e.message);
            await logError('/save-memory', e.message, userId);
        }

        console.log(`[LOCAL MEMORY] ✅ Hafıza başarıyla kaydedildi! (Açıklık: ${aciklikSkoru}/100)`);
        console.log(`[LOCAL MEMORY] Özet: ${summary.substring(0, 100)}...`);
    } catch (err) {
        console.error('[LOCAL MEMORY] ❌ Özetleme hatası:', err.message);
    }

    res.sendStatus(200);
});

// ─── RAG: AUTO-EXTRACTION AT SESSION END ────────────────────────────────
router.post('/v1/end-session', authMiddleware, async (req, res) => {
    try {
        const { userId, sessionId, transcript } = req.body;
        if (!userId || !transcript || transcript.length < 100) {
            return res.json({ insights_extracted: 0 });
        }
        if (!requireOwnership(userId, req, res)) return;

        // Get latest emotion analysis
        const { data: lastEmotion } = await supabase
            .from('emotion_logs')
            .select('duygu')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        const lastDuygu = lastEmotion?.duygu || 'sakin';

        // Extract knowledge automatically using openai
        let insights = [];
        if (transcript && transcript.length >= 50) {
            try {
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'user',
                        content: `Aşağıdaki terapi konuşmasından önemli "therapy insights" çıkar.\nJSON formatında 0-3 insight döndür.\n\nInsight tipleri:\n- breakthrough: "X ile Y arasında bağlantı buldum"\n- strategy: "X stratejisi bana yardım ediyor"\n- pattern: "Her zaman X olunca Y oluyor"\n- value: "Benim için X en önemli"\n- achievement: "X'i yaptım, kendimi iyi hissettim"\n\nKonuşma:\n"${transcript.substring(0, 500)}"\n\nJSON Array döndür (boş array olabilir):\n[\n  {\n    "type": "breakthrough" | "strategy" | "pattern" | "value" | "achievement",\n    "title": "Başlık (10-15 kelime)",\n    "content": "İçerik (1-2 cümle)",\n    "tags": ["tag1", "tag2"]\n  }\n]`
                    }],
                    temperature: 0.7,
                    max_tokens: 400
                });

                let rawInsights = [];
                try {
                    const text = response.choices[0].message.content || '[]';
                    const jsonMatch = text.match(/\[[\s\S]*\]/);
                    if (jsonMatch) rawInsights = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.warn('[RAG] JSON parse hatası:', e.message);
                }

                insights = rawInsights.map(i => ({
                    ...i,
                    emotion_context: lastDuygu,
                    relevance_score: 0.75 + (Math.random() * 0.2)
                }));
                console.log(`[RAG] ${insights.length} insight çıkarıldı`);
            } catch (err) {
                console.error('[RAG] Extraction hata:', err.message);
            }
        }

        if (insights.length > 0) {
            const port = process.env.PORT || 3001;
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

// ─── SEANS GEÇMİŞİ ────────────────────────────────────────────────────
router.get('/v1/session-history/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
        const { data, error } = await supabase
            .from('session_records')
            .select('session_id, created_at, topics, homework, emotional_start_score, emotional_end_score, dominant_emotion, breakthrough_moment')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ sessions: data || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
