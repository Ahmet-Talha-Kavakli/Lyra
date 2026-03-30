// routes/analysis.js
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { databasePool } from '../lib/infrastructure/databasePool.js';
import { openai } from '../lib/shared/openai.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireOwnership } from '../lib/shared/helpers.js';
import { getUserEmotion, getActiveSession } from '../src/services/cache/redisService.js';
import { getRedisClient } from '../lib/shared/redis.js';
import { updateObjectTracker, buildObjectContext, clearObjectTracker } from '../lib/shared/objectTracker.js';
import { buildPhysicalHarmContext } from '../lib/shared/physicalHarmTracker.js';
import { buildColorContext } from '../lib/shared/colorAnalyzer.js';
import { buildVoiceBaselineContext } from '../lib/shared/voiceBaselineEngine.js';

const router = express.Router();
const redis = await getRedisClient();

// ─── ADAPTİF FRAME THROTTLE ──────────────────────────────────
// Kullanıcı başına son analiz zamanını tutar — MIN_INTERVAL_MS içinde gelen
// istekler cache'den döner, GPT çağrısı yapılmaz.
const lastAnalysisTime = new Map();   // userId → timestamp
const lastAnalysisResult = new Map(); // userId → result
const MIN_INTERVAL_MS = 8000;         // minimum 8 saniye aralık (routine)
const HIGH_EMOTION_INTERVAL_MS = 4000; // yüksek yoğunlukta 4 saniye

// Periyodik temizlik — 10 dakika aktif olmayan kayıtları sil
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, ts] of lastAnalysisTime.entries()) {
        if (ts < cutoff) { lastAnalysisTime.delete(key); lastAnalysisResult.delete(key); }
    }
}, 5 * 60 * 1000);

// ─── RATE LIMITERS ──────────────────────────────────────────
const emotionRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 15, // 30 → 15: server-side throttle zaten var
    handler: (req, res) => {
        res.status(429).json({ duygu: 'sakin', guven: 0, yuz_var: false, rate_limited: true });
    },
});

const humeRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    handler: (req, res) => {
        res.status(429).json({ hume_scores: null, rate_limited: true });
    },
});

// ─── MULTER SES DOSYASI YÜKLEMESİ ──────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB max
});

// ─── HELPERS ────────────────────────────────────────────────
const yogunlukToNum = (y) => ({ 'düşük': 30, 'orta': 60, 'yüksek': 90 }[y] ?? 60);

const calculateTrend = (gecmis) => {
    if (gecmis.length < 3) return 'stabil';
    const son3 = gecmis.slice(-3).map(a => yogunlukToNum(a.yogunluk));
    const fark = son3[2] - son3[0];
    if (fark > 10) return 'kötüleşiyor';
    if (fark < -10) return 'iyileşiyor';
    return 'stabil';
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

// ─── MEDİAPİPE LANDMARK CONTEXT BUILDER ──
const buildLandmarkContext = (lm) => {
    if (!lm) return '';
    const signals = [];
    let emotionScore = {};

    if (lm.brow_down_left > 0.5 || lm.brow_down_right > 0.5) {
        signals.push('🤨 KAŞLAR BELIRGIN ÇATIKç: Öfke/sinir/konsantrasyon');
        emotionScore['anger'] = (emotionScore['anger'] || 0) + 0.3;
        emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + 0.2;
    }
    const eyeAvg = (lm.eye_openness_left + lm.eye_openness_right) / 2;
    if (eyeAvg < 0.2) { signals.push('😴 GÖZLER KAPALI: Çok ağır yorgunluk, uyku deprivation'); emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.25; }
    else if (eyeAvg < 0.35) { signals.push('😔 GÖZLER YARALI AÇIK: Hafif yorgunluk/melankolik/üzüntü'); emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.15; }
    else if (eyeAvg > 0.8) { signals.push('😲 GÖZLER GENIŞ AÇIK: Şok/korku/inanmamışlık'); emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.3; emotionScore['surprise'] = (emotionScore['surprise'] || 0) + 0.25; }

    if (lm.mouth_openness > 0.4) { signals.push('😮 AĞIZ AÇIK: Şok/korku/ağlama başlangıcı'); emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.2; emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.15; }
    else if (lm.mouth_openness < 0.02) { signals.push('😠 AĞIZ KAPALI/SIKI: Kontrole çalışma/bastırma/determinasyon'); emotionScore['anger'] = (emotionScore['anger'] || 0) + 0.2; }

    if (lm.lip_corner_pull > 0.6 && lm.cheek_raise > 0.4) { signals.push('😊 GERÇEKEKLİ GÜLÜMSEME: Joyeux authentique (Duchenne gülümsemesi)'); emotionScore['joy'] = (emotionScore['joy'] || 0) + 0.35; }
    else if (lm.lip_corner_pull > 0.4 && lm.cheek_raise < 0.1) { signals.push('😐 ZORUNLU GÜLÜMSEME: Sosyal, içinde boşluk hissediyor'); emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.1; }

    if (lm.jaw_drop > 0.7) { signals.push('😢 ÇENEċ DÜŞÜK: Ağlama/şok/travma tepkisi'); emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.3; emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.15; }
    if (Math.abs(lm.head_tilt) > 0.06) { const dir = lm.head_tilt > 0 ? 'sola' : 'sağa'; signals.push(`🔄 BAŞ EĞİKçL İ (${dir}): Şüphe/merak/savunma/sorgulanma`); emotionScore['uncertainty'] = (emotionScore['uncertainty'] || 0) + 0.15; }
    if (lm.nose_wrinkle > 0.35) { signals.push('😒 BURUN KIVRMA: Tiksinme/iğrenme/hoşlanmama'); emotionScore['disgust'] = (emotionScore['disgust'] || 0) + 0.3; }
    if ((lm.brow_down_left > 0.3 || lm.brow_down_right > 0.3) && eyeAvg > 0.4) { signals.push('😟 KAŞ-GÖZ KOMBİNASYONU: Endişe/kaygı/stres'); emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + 0.25; }

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
            if (hfi.stress_score > 0.5) emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + hfi.stress_score;
        }
        if (hfi.deception_likelihood === 'high') { signals.push(`⚠️ YALAN SINYALI ÇOK YÜKSEK: El yüze yakın (mouth/nose)`); emotionScore['deception'] = (emotionScore['deception'] || 0) + 0.4; }
    }

    if (lm.blink_analysis) {
        const ba = lm.blink_analysis;
        if (ba.signals && ba.signals.length > 0) {
            signals.push(`👁️ KIRPıŞ ANALIZI: ${ba.signals.join(' | ')}`);
            if (ba.cognitive_load > 0.6) emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + 0.2;
        }
    }

    if (signals.length === 0) return '';

    const topEmotion = Object.entries(emotionScore).sort((a, b) => b[1] - a[1])[0];
    return `\n\n🔍 MEDİAPİPE FACIAL LANDMARK ANALİZİ (GERÇEKLİ ZAMAN, KAMERAYI İNCELEME):\n${signals.join('\n')}\n\n💡 PREDICTED EMOTION: ${topEmotion ? topEmotion[0].toUpperCase() : 'neutral'} (confidence: ${topEmotion ? (topEmotion[1] * 100).toFixed(0) : 0}%)\n\n⚠️ KURAL: Landmark analizi GPT-4o görüntü analizinden DAHAvü GÜVENİLİR. Çelişki varsa landmarks'a öncelik ver.`;
};

// ─── YÜZDEN DUYGU ANALİZİ (GPT-4o Vision — Zengin) ────────
router.post('/v1/analyze-emotion', emotionRateLimit, authMiddleware, async (req, res) => {
    try {
        const { imageBase64, userId, sessionId, landmarks } = req.body;

        if (!imageBase64) return res.json({ duygu: 'sakin', guven: 0, yuz_var: false });

        // ── FRAME THROTTLE: Son analiz yeterliyse cache'den dön ──────────────
        if (userId) {
            const lastTime = lastAnalysisTime.get(userId) || 0;
            const lastResult = lastAnalysisResult.get(userId);
            const elapsed = Date.now() - lastTime;

            // Son sonuçtaki yoğunluğa göre minimum aralık belirle
            const prevIntensity = lastResult?.yogunluk;
            const minInterval = prevIntensity === 'yüksek' ? HIGH_EMOTION_INTERVAL_MS : MIN_INTERVAL_MS;

            if (lastResult && elapsed < minInterval) {
                // Cache hit — GPT çağrısı yapma, cached sonucu döndür
                console.log(`[DUYGU] ${userId}: cache hit (${elapsed}ms < ${minInterval}ms)`);
                return res.json({ ...lastResult, cached: true });
            }
        }

        // ── ADAPTİF DETAIL SEVİYESİ ───────────────────────────────────────────
        // Son sonuçta yüksek yoğunluk/kriz sinyali varsa detail:'high', aksi halde 'low'
        const prevResult = userId ? lastAnalysisResult.get(userId) : null;
        const needsHighDetail = !prevResult ||
            prevResult.yogunluk === 'yüksek' ||
            prevResult.fiziksel_zarar?.fiziksel_zarar_skor > 0 ||
            prevResult.ortam?.tehlike_var === true;
        const imageDetail = needsHighDetail ? 'high' : 'low';

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Sen bir online terapi sisteminin gelişmiş görüntü analiz modülüsün. Kameradaki TÜM sahneyi analiz et: kullanıcı, ortam, nesneler ve yakındaki kişiler dahil.\n\n── YÜZ TESPİTİ ──\n- Görüntüde NET insan yüzü (göz+burun+ağız) varsa → yuz_var: true\n- Kamera kapalı, karanlık, el önde, nesne kaplıyor → yuz_var: false, guven: 0\n- Şüphe durumunda → yuz_var: false\n\n── DUYGU ANALİZİ (yuz_var: true ise) ──\n- Kaş çatma + dar gözler + sıkılmış çene = sinirli\n- Sarkık yüz + düşük göz teması = üzgün/yorgun\n- Geniş gözler + gergin alın = endişeli/korkmuş\n- Rahat yüz + açık göz teması = sakin\n- Yanak kası + dudak köşesi = gerçek gülümseme (mutlu)\n\n── GÜVEN SKORU ──\n- Net görüntü → 75-95 | Bulanık/karanlık ama yüz var → 50-74 | Yüz yok → 0\n\n${buildLandmarkContext(landmarks)}\n\nYalnızca geçerli JSON döndür:\n{"duygu":"mutlu|üzgün|endişeli|korkmuş|sakin|şaşırmış|sinirli|yorgun","yogunluk":"düşük|orta|yüksek","enerji":"canlı|normal|yorgun","jestler":{"kas_catma":false,"goz_temasi":"yüksek|normal|düşük","goz_kirpma_hizi":"hızlı|normal|yavaş","gulümseme_tipi":"gerçek|sosyal|yok","cene_gerginligi":"yüksek|orta|düşük","dudak_sikistirma":false,"kasin_pozisyonu":"yukari|normal|asagi|catan","goz_kapagi_agirlik":"normal|hafif_agir|belirgin_agir"},"genel_vucut_dili":"açık|nötr|kapalı","yuz_soluklugu":false,"vucut_dili":{"omuz_durusu":"öne_eğik|dik|geri_yaslanmış|gergin|çökmüş","kol_pozisyonu":"çapraz_kavuşturulmuş|açık|dizde|yüzde|belirsiz","govde_yonelimi":"kameraya_dönük|yana_dönük|geri_çekilmiş","genel_gerginlik":"yüksek|orta|düşük","nefes_hizli":false,"kendine_dokunma":"saç|yüz|kol|boyun|yok","tekrarli_hareket":false,"kacis_davranisi":false},"duygu_uyumu":{"yuz_beden":"uyumlu|çelişkili|maskelenmiş|belirsiz","ani_degisim":false,"degisim_tipi":"belirsiz"},"ortam":{"mekan":"ev|ofis|dışarı|araba|bilinmiyor","mekan_detay":"yatak_odası|salon|mutfak|banyo|ofis|araba|dışarı|belirsiz","aydinlik":"karanlık|loş|normal|parlak","mahremiyet_riski":false,"stres_ortami":false,"nesneler":[{"ad":"yok","kategori":"yok","risk":"yok","zarar_sinyali":false,"emin":true}],"tehlike_var":false,"el_aktivitesi":"boşta","yakin_kisiler":[]},"gorunum_ozeti":"kısa bir cümle","guven":85,"yuz_var":true,"timestamp":0,"fiziksel_zarar":{"morluk":false,"yara_kesi":false,"sislik":false,"kan_izi":false,"fiziksel_zarar_skor":0,"zarar_bolge":"yok"}}`
                    },
                    {
                        type: 'image_url',
                        image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: imageDetail }
                    }
                ]
            }],
            max_tokens: 1200
        });

        let result = { duygu: 'sakin', guven: 0, yuz_var: false };
        try {
            let raw = response.choices[0].message.content.trim().replace(/```json|```/g, '');
            const jsonStart = raw.indexOf('{');
            const jsonEnd = raw.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                raw = raw.slice(jsonStart, jsonEnd + 1);
            }
            result = JSON.parse(raw);
            result.timestamp = Date.now();

            if (result.ortam?.nesneler?.length > 0) {
                const riskSirasi = ['yuksek','orta','davranissal','dusuk','yok'];
                const enRiskli = [...result.ortam.nesneler].sort(
                    (a,b) => riskSirasi.indexOf(a.risk) - riskSirasi.indexOf(b.risk)
                )[0];
                result.ortam.el_nesnesi = enRiskli.ad;
                result.ortam.nesne_risk_seviyesi = enRiskli.risk;
                result.ortam.nesne_kategorisi = enRiskli.kategori;
                result.ortam.zarar_sinyali = result.ortam.nesneler.some(n => n.zarar_sinyali);
            }

            console.log(`[DUYGU PARSE] OK: ${result.duygu} yuz:${result.yuz_var} guven:${result.guven} detail:${imageDetail}`);
        } catch (parseErr) {
            console.warn('[DUYGU PARSE] Hata:', parseErr.message, '| raw:', response.choices[0]?.message?.content?.slice(0, 100));
        }

        // ── SONUCU CACHE'E YAZ ───────────────────────────────────────────────
        if (userId && result.yuz_var) {
            lastAnalysisTime.set(userId, Date.now());
            lastAnalysisResult.set(userId, result);
        }

        if (userId && result.yuz_var) {
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

            const sid = sessionId || activeSessionId;
            if (sid) {
                databasePool.query(
                    `INSERT INTO emotion_logs (user_id, session_id, duygu, yogunluk, enerji, jestler, trend, guven, mediapipe_landmarks, yuz_soluklugu, advanced_facial)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [userId, sid, result.duygu, result.yogunluk, result.enerji, result.jestler ? JSON.stringify(result.jestler) : null, guncel.trend, result.guven, landmarks ? JSON.stringify(landmarks) : null, result.yuz_soluklugu || false, null]
                ).catch((error) => {
                    console.error('[EMOTION LOG] Insert hatası:', error.message);
                });
            }
        }

        // ── YENİ: Çoklu analiz modülleri — arka planda çalıştır, sonucu result'a ekle ──
        if (userId && result.yuz_var) {
            const sid = sessionId || activeSessionId;

            // 1. NESNE TAKIBI — GPT'nin tespit ettiği nesneleri frame'ler arası izle
            const nesneGuncelleme = updateObjectTracker(userId, result.ortam?.nesneler || [], result.timestamp);
            const nesneContext = buildObjectContext(userId);
            if (nesneContext) result.nesne_context = nesneContext;
            if (nesneGuncelleme.persistentThreats?.length > 0) {
                result.persistent_threats = nesneGuncelleme.persistentThreats;
            }

            // ── REDIS SET: object_tracker:${userId}:current ──
            // Chat endpoint'i bu veriye erişebilsin
            try {
                const objectTrackerData = {
                    threat_level: nesneGuncelleme.threatLevel || 'low',
                    objects: result.ortam?.nesneler || [],
                    persistent_threats: nesneGuncelleme.persistentThreats || [],
                    safe: (nesneGuncelleme.threatLevel || 'low') === 'low',
                    timestamp: result.timestamp,
                    el_nesnesi: result.ortam?.el_nesnesi || null,
                    zarar_sinyali: result.ortam?.zarar_sinyali || false
                };

                await redis.setex(
                    `object_tracker:${userId}:current`,
                    60, // 60 saniye taze kalma süresi
                    JSON.stringify(objectTrackerData)
                );

                console.log(`[REDIS] object_tracker:${userId}:current → SET (${nesneGuncelleme.threatLevel || 'low'} threat, ${objectTrackerData.objects.length} objects)`);
            } catch (redisErr) {
                console.warn(`[REDIS] ObjectTracker SET hatası:`, redisErr.message);
            }

            // 2. Landmark'tan gelen renk ve nefes verileri — client gönderdi mi?
            if (landmarks?.face_color) {
                const renkContext = buildColorContext(userId, landmarks.face_color);
                if (renkContext) result.renk_context = renkContext;
            }
            // Nefes — frontend zaten pattern'i hesapladı, direkt context üret
            if (landmarks?.breath?.pattern && landmarks.breath.pattern !== 'normal' && landmarks.breath.pattern !== 'unknown') {
                const pattern = landmarks.breath.pattern;
                const bpm = landmarks.breath.bpm;
                if (pattern === 'rapid')   result.nefes_context = `[NEFES HIZLI]: Anksiyete/panik işareti (${bpm || '?'} bpm) — yavaşlatıcı bir an yarat.`;
                else if (pattern === 'holding') result.nefes_context = '[NEFES TUTUYOR]: Derin stres/donma tepkisi — fark et, nazikçe dışarı çıkmasına izin ver.';
                else if (pattern === 'shallow') result.nefes_context = '[NEFES YÜZEYSEL]: Gergin nefes — vücudun sinyalini dinle.';
            }

            // 3. FİZİKSEL ZARAR — seanslar arası karşılaştırma
            if (result.fiziksel_zarar && sid) {
                buildPhysicalHarmContext(userId, sid, result.fiziksel_zarar, result.ortam)
                    .then(ctx => { if (ctx) console.log(`[FİZİKSEL ZARAR] ${userId}: ${ctx.slice(0, 80)}`); })
                    .catch(() => {});

                // ── REDIS SET: physical_harm:${userId}:current ──
                // Chat endpoint'i hasta bedenindeki izleri görebilsin
                try {
                    const physicalHarmData = {
                        indicators: [],
                        has_prior_harm: false,
                        recency: null,
                        max_severity: 'none',
                        timestamp: result.timestamp
                    };

                    // GPT-4o Vision'dan gelen fiziksel zarar verilerini işle
                    const harm = result.fiziksel_zarar;
                    if (harm) {
                        const severities = { morluk: 0, yara_kesi: 0, sislik: 0, kan_izi: 0 };
                        const severityOrder = ['none', 'minor', 'moderate', 'severe'];

                        if (harm.morluk) {
                            physicalHarmData.indicators.push({ type: 'bruise', location: harm.bolge || 'unknown', severity: 'moderate' });
                            severities.morluk = 2;
                        }
                        if (harm.yara_kesi) {
                            physicalHarmData.indicators.push({ type: 'cut', location: harm.bolge || 'unknown', severity: 'moderate' });
                            severities.yara_kesi = 2;
                        }
                        if (harm.sislik) {
                            physicalHarmData.indicators.push({ type: 'swelling', location: harm.bolge || 'unknown', severity: 'mild' });
                            severities.sislik = 1;
                        }
                        if (harm.kan_izi) {
                            physicalHarmData.indicators.push({ type: 'bleeding', location: harm.bolge || 'unknown', severity: 'severe' });
                            severities.kan_izi = 3;
                        }

                        // Maksimum severity belirle
                        const maxSev = Math.max(...Object.values(severities));
                        physicalHarmData.max_severity = severityOrder[Math.min(maxSev, 3)];

                        // Skordan prior harm çıkarsama
                        if (harm.fiziksel_zarar_skor && harm.fiziksel_zarar_skor > 0) {
                            physicalHarmData.has_prior_harm = true;
                            physicalHarmData.recency = harm.zarar_bolge ? 'recent' : 'unknown';
                        }
                    }

                    await redis.setex(
                        `physical_harm:${userId}:current`,
                        60, // 60 saniye taze kalma süresi
                        JSON.stringify(physicalHarmData)
                    );

                    if (physicalHarmData.indicators.length > 0) {
                        console.log(`[REDIS] physical_harm:${userId}:current → SET (${physicalHarmData.indicators.length} indicators, severity: ${physicalHarmData.max_severity})`);
                    }
                } catch (redisErr) {
                    console.warn(`[REDIS] PhysicalHarm SET hatası:`, redisErr.message);
                }
            }

            // Gaze ve nefes log
            if (landmarks?.gaze) {
                const gazeLog = landmarks.stable_gaze?.psychological || landmarks.gaze.psychological;
                if (gazeLog) console.log(`[GAZE] ${userId}: ${gazeLog} (${landmarks.gaze.horizontal}-${landmarks.gaze.vertical})`);
            }
            if (landmarks?.breath?.pattern && landmarks.breath.pattern !== 'normal' && landmarks.breath.pattern !== 'unknown') {
                console.log(`[NEFES] ${userId}: ${landmarks.breath.pattern} ${landmarks.breath.bpm ? landmarks.breath.bpm + 'bpm' : ''}`);
            }
        }

        res.json(result);
    } catch (err) {
        console.error('[DUYGU] Hata:', err.message);
        res.json({ duygu: 'sakin', guven: 0, yuz_var: false });
    }
});

// ─── HUME SES ANALİZİ (48 Duygu, Prosody) ────────────────────────
router.post('/v1/analyze-hume-voice', upload.single('audio'), humeRateLimit, authMiddleware, async (req, res) => {
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

        const sorted = [...emotions].sort((a, b) => b.score - a.score);

        const posEmotions = ['Joy', 'Excitement', 'Contentment', 'Amusement', 'Pride', 'Love', 'Interest'];
        const negEmotions = ['Sadness', 'Fear', 'Anger', 'Disgust', 'Anxiety', 'Shame', 'Guilt'];
        const posScore = emotions.filter(e => posEmotions.includes(e.name)).reduce((s, e) => s + e.score, 0);
        const negScore = emotions.filter(e => negEmotions.includes(e.name)).reduce((s, e) => s + e.score, 0);

        const highArousal = ['Excitement', 'Anger', 'Fear', 'Surprise'];
        const arousScore = emotions.filter(e => highArousal.includes(e.name)).reduce((s, e) => s + e.score, 0);

        const round = (v) => Math.round(v * 100) / 100;

        const humeScores = {
            top_emotions: sorted.slice(0, 10).map(e => ({ name: e.name, score: round(e.score) })),
            all_scores: Object.fromEntries(emotions.map(e => [e.name, round(e.score)])),
            dominant: sorted[0]?.name || 'Neutral',
            valence: round(posScore - negScore),
            arousal: round(arousScore),
            analyzed_at: Date.now()
        };

        if (userId) {
            (async () => {
                try {
                    const row = await databasePool.queryOne(
                        `SELECT id FROM emotion_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1`,
                        [userId]
                    );
                    if (row?.id) {
                        await databasePool.query(
                            `UPDATE emotion_logs SET hume_scores = $1 WHERE id = $2`,
                            [JSON.stringify(humeScores), row.id]
                        );
                    }
                } catch (err) {
                    console.error('[HUME] Query error:', err.message);
                }
            })();
        }

        console.log(`[HUME] ${humeScores.dominant} | valence:${humeScores.valence} | arousal:${humeScores.arousal}`);
        res.json({ hume_scores: humeScores });
    } catch (err) {
        console.error('[HUME] Hata:', err.message);
        res.json({ hume_scores: null });
    }
});

// ─── İNSAN ANALİZİ MOTORU (Bilinçaltı Tetikleyicileri) ────────────────────────
async function analyzeHumanBehavior(userId, transcript, emotions) {
    try {
        const { data: sessions } = await supabase
            .from('emotion_logs')
            .select('transcript, emotion_intensity, dominant_emotion')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(10);

        if (!sessions || sessions.length === 0) return null;

        const currentEmotion = emotions?.dominant || 'unknown';
        const currentIntensity = emotions?.intensity || 0.5;

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

        const topTriggers = Object.entries(triggers)
            .filter(([word, data]) => data.count >= 2)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([word, data]) => ({ trigger: word, frequency: data.count, associated_emotions: data.emotions }));

        const emotionTrend = {};
        sessions.forEach(s => { const emotion = s.dominant_emotion; emotionTrend[emotion] = (emotionTrend[emotion] || 0) + 1; });
        const dominantPattern = Object.entries(emotionTrend).sort((a, b) => b[1] - a[1])[0];

        const biases = [];
        if (transcript?.includes('hep') || transcript?.includes('asla')) {
            biases.push({ type: 'all-or-nothing', indicator: 'Uç ifadeler kullanıyor', pattern: 'Gri alanları görmüyor', suggestion: 'Ara yollar var. Nuansa bakalım.' });
        }
        if (transcript?.includes('berbat') || transcript?.includes('olmaz') || transcript?.includes('imkansız')) {
            biases.push({ type: 'catastrophizing', indicator: 'Negatif projeksiyonlar', pattern: 'Kötü senaryoları abartıyor', suggestion: 'Gerçekçi sonuçlar neler olabilir?' });
        }
        if (transcript?.includes('benim hata') || transcript?.includes('benim suçum')) {
            biases.push({ type: 'personalization', indicator: 'Aşırı sorumluluk hissi', pattern: 'Kontrol etmediği şeylerden sorumlu hissediyor', suggestion: 'Hangi kısım senin kontrolünde?' });
        }
        if (transcript?.includes('biliyorum ki') || transcript?.includes('kesin') || transcript?.includes('düşünüyor')) {
            biases.push({ type: 'mind-reading', indicator: 'Diğerlerinin düşüncelerini biliyor sanıyor', pattern: 'Kanıt olmadan varsayımlarda bulunuyor', suggestion: 'Bunu nasıl biliyorsun? Gerçeği kontrol et.' });
        }

        const profile = await databasePool.queryOne('SELECT pattern_memory FROM user_profile WHERE user_id = $1', [userId]);

        let valueConflict = null;
        if (profile?.pattern_memory?.values) {
            const values = profile.pattern_memory.values;
            if (values.includes('health') && currentIntensity > 0.7) {
                valueConflict = { stated_value: 'Sağlık önemli', observed_behavior: 'Ama stresli/endişeli', gap: 'Değerler ile davranışlar uyumlu değil', insight: 'Bu alanda çatışma var. Uyumlaştırmak ister misin?' };
            }
        }

        const avoidancePatterns = [];
        if (currentIntensity > 0.6 && transcript?.length < 100) {
            avoidancePatterns.push({ pattern: 'Kısacık cevaplar + yüksek duygu', meaning: 'Konudan kaçıyor olabilir', intervention: 'Daha derine gidelim mi? Rahatsız edici ne?' });
        }

        return { top_triggers: topTriggers, dominant_emotion_pattern: dominantPattern ? dominantPattern[0] : null, cognitive_biases: biases, value_behavior_conflict: valueConflict, avoidance_patterns: avoidancePatterns, analysis_timestamp: new Date().toISOString() };
    } catch (err) {
        console.error('[HUMAN-ANALYSIS] Hata:', err.message);
        return null;
    }
}

router.post('/v1/analyze-human-behavior', authMiddleware, async (req, res) => {
    try {
        const { userId, transcript, emotions } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!transcript) {
            return res.status(400).json({ error: 'userId ve transcript gerekli' });
        }

        const analysis = await analyzeHumanBehavior(userId, transcript, emotions);

        if (analysis) {
            databasePool.query(
                `INSERT INTO behavior_analysis (user_id, analysis_data, created_at)
                 VALUES ($1, $2, $3)`,
                [userId, JSON.stringify(analysis), new Date().toISOString()]
            ).catch(() => {});
        }

        res.json({ success: true, analysis });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ANALYTICS: KAYNAK ETKİSİ ANALİZİ ────────────────────────────────────────
router.get('/v1/analytics/source-effectiveness/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;

        const usageLogs = await databasePool.queryAll(
            `SELECT knowledge_id, was_helpful, used_context, used_at FROM knowledge_usage_logs
             WHERE user_id = $1 ORDER BY used_at DESC LIMIT 100`,
            [userId]
        );

        if (!usageLogs || usageLogs.length === 0) {
            return res.json({ message: 'Henüz kaynak kullanım verisi yok', data: {} });
        }

        const knowledgeIds = [...new Set(usageLogs.map(l => l.knowledge_id))];
        const placeholders = knowledgeIds.map((_, i) => `$${i + 1}`).join(',');
        const sources = await databasePool.queryAll(
            `SELECT id, title, category, source_type FROM knowledge_sources WHERE id IN (${placeholders})`,
            knowledgeIds
        );

        const sourceStats = {};
        usageLogs.forEach(log => {
            const source = sources.find(s => s.id === log.knowledge_id);
            if (!source) return;
            const key = source.id;
            if (!sourceStats[key]) {
                sourceStats[key] = { id: source.id, title: source.title, category: source.category, type: source.source_type, used_count: 0, helpful_count: 0, not_helpful_count: 0, effectiveness: 0 };
            }
            sourceStats[key].used_count++;
            if (log.was_helpful === true) sourceStats[key].helpful_count++;
            else if (log.was_helpful === false) sourceStats[key].not_helpful_count++;
        });

        Object.values(sourceStats).forEach(stat => {
            stat.effectiveness = stat.used_count > 0 ? (stat.helpful_count / stat.used_count * 100).toFixed(1) : 0;
        });

        const sorted = Object.values(sourceStats).sort((a, b) => b.used_count - a.used_count);
        const topByEffectiveness = [...sorted].filter(s => s.used_count >= 2).sort((a, b) => parseFloat(b.effectiveness) - parseFloat(a.effectiveness)).slice(0, 5);

        const summary = {
            total_sources_used: Object.keys(sourceStats).length,
            total_uses: usageLogs.length,
            helpful_total: usageLogs.filter(l => l.was_helpful === true).length,
            effectiveness_overall: usageLogs.length > 0 ? ((usageLogs.filter(l => l.was_helpful === true).length / usageLogs.length) * 100).toFixed(1) : 0,
            by_category: {},
            top_performers: topByEffectiveness
        };

        sorted.forEach(stat => {
            if (!summary.by_category[stat.category]) summary.by_category[stat.category] = { count: 0, helpful: 0, effectiveness: 0 };
            summary.by_category[stat.category].count += stat.used_count;
            summary.by_category[stat.category].helpful += stat.helpful_count;
        });

        Object.keys(summary.by_category).forEach(cat => {
            const data = summary.by_category[cat];
            data.effectiveness = data.count > 0 ? (data.helpful / data.count * 100).toFixed(1) : 0;
        });

        res.json({ summary, all_sources: sorted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ANALYTICS: USER BEHAVIOR TIMELINE ───────────────────────────────────────
router.get('/v1/analytics/behavior-timeline/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
        const { days = 30 } = req.query;

        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - parseInt(days));

        const { data: sessions } = await supabase
            .from('emotion_logs')
            .select('timestamp, dominant_emotion, emotion_intensity')
            .eq('user_id', userId)
            .gte('timestamp', sinceDate.toISOString())
            .order('timestamp', { ascending: true });

        if (!sessions || sessions.length === 0) {
            return res.json({ message: `Son ${days} günde seans yok`, timeline: [] });
        }

        const timeline = sessions.map(s => ({
            date: new Date(s.timestamp).toLocaleDateString('tr-TR'),
            emotion: s.dominant_emotion,
            intensity: s.emotion_intensity,
            timestamp: s.timestamp
        }));

        const emotionTrend = {};
        sessions.forEach(s => { const emotion = s.dominant_emotion; emotionTrend[emotion] = (emotionTrend[emotion] || 0) + 1; });

        const avgIntensity = (sessions.reduce((sum, s) => sum + (s.emotion_intensity || 0), 0) / sessions.length).toFixed(2);

        res.json({ period_days: days, session_count: sessions.length, emotion_distribution: emotionTrend, average_intensity: avgIntensity, timeline });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ANALYTICS: RECOMMENDATION EFFECTIVENESS ─────────────────────────────────
router.post('/v1/analytics/rate-recommendation', authMiddleware, async (req, res) => {
    try {
        const { userId, knowledgeId, wasHelpful, context } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!knowledgeId) {
            return res.status(400).json({ error: 'userId ve knowledgeId gerekli' });
        }

        await databasePool.query(
            `INSERT INTO knowledge_usage_logs (user_id, knowledge_id, was_helpful, used_context, used_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, knowledgeId, wasHelpful === true, context || 'Rating provided', new Date().toISOString()]
        );

        res.json({ success: true, message: 'Feedback kaydedildi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
