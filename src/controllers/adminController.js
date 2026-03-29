// routes/admin.js
import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAdmin } from '../lib/helpers.js';

const router = express.Router();

// ─── INLINE HELPERS ──────────────────────────────────────────────────

const yogunlukToNum = (y) => ({ 'düşük': 30, 'orta': 60, 'yüksek': 90 }[y] ?? 60);

const buildLandmarkContext = (lm) => {
    if (!lm) return '';
    const signals = [];
    let emotionScore = {};

    if (lm.brow_down_left > 0.5 || lm.brow_down_right > 0.5) {
        signals.push('🤨 KAŞLAR BELİRGİN ÇATIK: Öfke/sinir/konsantrasyon');
        emotionScore['anger'] = (emotionScore['anger'] || 0) + 0.3;
        emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + 0.2;
    }
    const eyeAvg = (lm.eye_openness_left + lm.eye_openness_right) / 2;
    if (eyeAvg < 0.2) { signals.push('😴 GÖZLER KAPALI: Çok ağır yorgunluk, uyku deprivation'); emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.25; }
    else if (eyeAvg < 0.35) { signals.push('😔 GÖZLER YARALI AÇIK: Hafif yorgunluk/melankolik/üzüntü'); emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.15; }
    else if (eyeAvg > 0.8) { signals.push('😲 GÖZLER GENİŞ AÇIK: Şok/korku/inanmamışlık'); emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.3; emotionScore['surprise'] = (emotionScore['surprise'] || 0) + 0.25; }

    if (lm.mouth_openness > 0.4) { signals.push('😮 AĞIZ AÇIK: Şok/korku/ağlama başlangıcı'); emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.2; emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.15; }
    else if (lm.mouth_openness < 0.02) { signals.push('😠 AĞIZ KAPALI/SIKI: Kontrole çalışma/bastırma/determinasyon'); emotionScore['anger'] = (emotionScore['anger'] || 0) + 0.2; }

    if (lm.lip_corner_pull > 0.6 && lm.cheek_raise > 0.4) { signals.push('😊 GERÇEKLİ GÜLÜMSEME: Joyeux authentique (Duchenne gülümsemesi)'); emotionScore['joy'] = (emotionScore['joy'] || 0) + 0.35; }
    else if (lm.lip_corner_pull > 0.4 && lm.cheek_raise < 0.1) { signals.push('😐 ZORUNLU GÜLÜMSEME: Sosyal, içinde boşluk hissediyor'); emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.1; }

    if (lm.jaw_drop > 0.7) { signals.push('😢 ÇENE DÜŞÜK: Ağlama/şok/travma tepkisi'); emotionScore['sadness'] = (emotionScore['sadness'] || 0) + 0.3; emotionScore['fear'] = (emotionScore['fear'] || 0) + 0.15; }
    if (Math.abs(lm.head_tilt) > 0.06) { const dir = lm.head_tilt > 0 ? 'sola' : 'sağa'; signals.push(`🔄 BAŞ EĞİKLİ (${dir}): Şüphe/merak/savunma/sorgulanma`); emotionScore['uncertainty'] = (emotionScore['uncertainty'] || 0) + 0.15; }
    if (lm.nose_wrinkle > 0.35) { signals.push('😒 BURUN KIVRMA: Tiksinme/iğrenme/hoşlanmama'); emotionScore['disgust'] = (emotionScore['disgust'] || 0) + 0.3; }
    if ((lm.brow_down_left > 0.3 || lm.brow_down_right > 0.3) && eyeAvg > 0.4) { signals.push('😟 KAŞ-GÖZ KOMBİNASYONU: Endişe/kaygı/stres'); emotionScore['anxiety'] = (emotionScore['anxiety'] || 0) + 0.25; }

    if (signals.length === 0) return '';

    const topEmotion = Object.entries(emotionScore).sort((a, b) => b[1] - a[1])[0];
    return `\n\n🔍 MEDİAPİPE FACIAL LANDMARK ANALİZİ:\n${signals.join('\n')}\n\n💡 PREDICTED EMOTION: ${topEmotion ? topEmotion[0].toUpperCase() : 'neutral'} (confidence: ${topEmotion ? (topEmotion[1] * 100).toFixed(0) : 0}%)`;
};

const analyzeHandFaceInteraction = (handLandmarks, faceLandmarks) => {
    if (!handLandmarks || !faceLandmarks) return null;

    const stressIndicators = [];
    let stressScore = 0;

    const hand = handLandmarks;
    const face = faceLandmarks;

    if (!hand || hand.length < 21 || !face || face.length < 468) return null;

    const handCenter = {
        x: (hand[5].x + hand[9].x + hand[13].x) / 3,
        y: (hand[5].y + hand[9].y + hand[13].y) / 3
    };

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

    const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    const distToMouth = dist(handCenter, mouthRegion);
    if (distToMouth < 0.1) { stressIndicators.push('🤐 El ağza yakın: Sekreti saklama/yalan/endişe'); stressScore += 0.35; }

    const distToNose = dist(handCenter, noseRegion);
    if (distToNose < 0.12) { stressIndicators.push('👃 El buruna yakın: Yalan/endişe/kaygı (Pinocchio effect)'); stressScore += 0.3; }

    const distToNeck = dist(handCenter, neckRegion);
    if (distToNeck < 0.15) { stressIndicators.push('🫀 El boyna yakın: Rahatsızlık/iğrenme/yalan/stres'); stressScore += 0.25; }

    const distToFace = dist(handCenter, faceCenter);
    if (distToFace < 0.15) { stressIndicators.push('😰 El yüze yakın: Kaygı/stres/konsantrasyon'); stressScore += 0.2; }

    const fingerSpread = dist(hand[4], hand[8]) + dist(hand[12], hand[16]);
    if (fingerSpread < 0.05) { stressIndicators.push('✊ El kapalı: Savunma/kontrol/sıkı tutma'); stressScore += 0.15; }

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

const detectMicroExpressions = (lm, blendshapes = []) => {
    if (!lm) return null;

    const aus = {};
    aus['AU1'] = lm.brow_down_left > 0.2 ? 0 : Math.max((lm.brow_angle_left || 0) * 0.3, 0);
    aus['AU2'] = lm.brow_down_right > 0.2 ? 0 : Math.max((lm.brow_angle_right || 0) * 0.3, 0);
    aus['AU4'] = Math.max(lm.brow_down_left || 0, lm.brow_down_right || 0);
    aus['AU5'] = Math.max(lm.eye_openness_left || 0, lm.eye_openness_right || 0) - 0.5;
    aus['AU6'] = lm.cheek_raise || 0;
    aus['AU7'] = Math.max(0.5 - Math.max(lm.eye_openness_left || 0, lm.eye_openness_right || 0), 0);
    aus['AU9'] = lm.nose_wrinkle || 0;
    aus['AU12'] = lm.lip_corner_pull || 0;
    aus['AU15'] = Math.max(0.3 - (lm.lip_corner_pull || 0), 0);
    aus['AU17'] = Math.max(0.5 - (lm.jaw_drop || 0), 0);
    aus['AU20'] = Math.abs(lm.head_yaw || 0) * 0.2;
    aus['AU25'] = Math.max((lm.mouth_openness || 0) - 0.2, 0);
    aus['AU26'] = lm.jaw_drop || 0;
    aus['AU43'] = Math.max(0.5 - Math.max(lm.eye_openness_left || 0, lm.eye_openness_right || 0), 0);

    const emotions = {
        anger:    Math.min(aus['AU4'] * 0.8 + aus['AU5'] * 0.2, 1),
        fear:     Math.min(aus['AU5'] * 0.6 + aus['AU20'] * 0.4, 1),
        sadness:  Math.min(aus['AU15'] * 0.5 + aus['AU17'] * 0.3 + aus['AU7'] * 0.2, 1),
        joy:      Math.min(aus['AU12'] * 0.7 + aus['AU6'] * 0.3, 1),
        surprise: Math.min(aus['AU5'] * 0.6 + aus['AU25'] * 0.4, 1),
        disgust:  Math.min(aus['AU9'] * 0.7 + aus['AU15'] * 0.3, 1),
        contempt: Math.min(Math.abs(aus['AU12'] - aus['AU15']) * 0.5, 1)
    };

    const maxEmotion = Math.max(...Object.values(emotions));
    Object.keys(emotions).forEach(e => {
        emotions[e] = maxEmotion > 0 ? emotions[e] / maxEmotion : 0;
    });

    const dominant = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0];
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

const analyzeBlink = (eyeData = {}) => {
    if (!eyeData.left_eye_openness) return null;

    const eyeAvg = (eyeData.left_eye_openness + eyeData.right_eye_openness) / 2;
    const signals = [];
    let cognitiveLoad = 0;

    const isBlinking = eyeAvg < 0.2;

    if (eyeData.blink_rate) {
        if (eyeData.blink_rate > 0.5) { signals.push('👀 ÇOK HIZLI GÖZ KIRMASI: Yalan/derin stres/uyarı'); cognitiveLoad += 0.4; }
        else if (eyeData.blink_rate > 0.35) { signals.push('👁️ HIZLI GÖZ KIRMASI: Stres/kaygı/zihinsel yük'); cognitiveLoad += 0.25; }
        else if (eyeData.blink_rate < 0.15) { signals.push('🔍 ÇOK DÜŞÜK GÖZ KIRMASI: Yoğun konsantrasyon/odaklanma'); cognitiveLoad += 0.15; }
    }

    if (eyeData.pupil_dilation !== undefined) {
        if (eyeData.pupil_dilation > 0.15) { signals.push('🔆 PÜPİLLER GENİŞ: Arousal/ilgi/emosyonel reaksiyon'); cognitiveLoad += 0.2; }
        else if (eyeData.pupil_dilation < -0.1) { signals.push('🔅 PÜPİLLER DARALMIS: Boredom/rahatsızlık'); cognitiveLoad += 0.1; }
    }

    if (eyeData.gaze_direction) {
        const { x, y } = eyeData.gaze_direction;
        if (Math.abs(x) > 0.3) { signals.push(`👀 YANYANA BAKIŞLAR (${x > 0 ? 'sağa' : 'sola'}): Şüphe/kaçış/yalan`); cognitiveLoad += 0.15; }
        if (y > 0.3) { signals.push('⬆️ YUKARIYA BAKIŞLAR: Hatırlamaya çalışma/hayal kurma'); cognitiveLoad += 0.1; }
        if (y < -0.2) { signals.push('⬇️ AŞAĞIYA BAKIŞLAR: Utanç/suçluluk/acı'); cognitiveLoad += 0.15; }
    }

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

const advancedFacialAnalysis = (landmarks, handLandmarks, eyeData) => {
    const microExpressions = detectMicroExpressions(landmarks);
    const handInteraction = analyzeHandFaceInteraction(handLandmarks, landmarks);
    const blinkAnalysis = analyzeBlink(eyeData);

    const allSignals = [];
    if (microExpressions) allSignals.push(`[MICRO] ${microExpressions.dominant_emotion.toUpperCase()} (${(microExpressions.emotion_intensity * 100).toFixed(0)}%)`);
    if (handInteraction && handInteraction.stress_indicators.length > 0) {
        allSignals.push(...handInteraction.stress_indicators);
    }
    if (blinkAnalysis && blinkAnalysis.signals.length > 0) {
        allSignals.push(...blinkAnalysis.signals);
    }

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

// ─── CRON CHECK-IN ────────────────────────────────────────────────────
router.get('/v1/cron-checkin', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const onceki24h = new Date(Date.now() - 24*60*60*1000).toISOString();
        const { data: krizKayitlari } = await supabase
            .from('memories')
            .select('user_id, kriz_log')
            .not('kriz_log', 'is', null)
            .gte('updated_at', onceki24h);

        const kontrol = (krizKayitlari || []).filter(k => k.kriz_log?.tarih);
        console.log(`[CRON] ${kontrol.length} kriz kaydı kontrol edildi.`);

        const { data: users } = await supabase.from('user_profile').select('user_id');
        let patternUpdated = 0;

        for (const user of users || []) {
            const userId = user.user_id;
            const { data: emotions } = await supabase
                .from('emotion_logs')
                .select('konu, duygu, yogunluk')
                .eq('user_id', userId)
                .order('timestamp', { ascending: false })
                .limit(10);

            if (!emotions || emotions.length < 2) continue;

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

                if (prevYogunluk !== null) {
                    const currentYog = yogunlukToNum(e.yogunluk);
                    if (currentYog > prevYogunluk + 10) trends.push('kötüleşiyor');
                    else if (currentYog < prevYogunluk - 10) trends.push('iyileşiyor');
                    else trends.push('stabil');
                }
                prevYogunluk = yogunlukToNum(e.yogunluk);
            });

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

// ─── TEST LANDMARK ANALYSIS ──────────────────────────────────────────
router.get('/v1/test-landmarks', async (req, res) => {
    if (!requireAdmin(req, res)) return;
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
router.get('/v1/test-advanced-facial', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const testLandmarks1 = [
            ...Array(468).fill({ x: 0.5, y: 0.5 }),
        ];
        testLandmarks1[107] = { x: 0.4, y: 0.3 };
        testLandmarks1[105] = { x: 0.4, y: 0.35 };
        testLandmarks1[336] = { x: 0.6, y: 0.3 };
        testLandmarks1[334] = { x: 0.6, y: 0.35 };
        testLandmarks1[159] = { x: 0.35, y: 0.4 };
        testLandmarks1[145] = { x: 0.35, y: 0.5 };
        testLandmarks1[386] = { x: 0.65, y: 0.4 };
        testLandmarks1[374] = { x: 0.65, y: 0.5 };
        testLandmarks1[13]  = { x: 0.5, y: 0.55 };
        testLandmarks1[14]  = { x: 0.5, y: 0.65 };
        testLandmarks1[61]  = { x: 0.3, y: 0.6 };
        testLandmarks1[291] = { x: 0.7, y: 0.6 };

        const testHandLandmarks1 = Array(21).fill({ x: 0.25, y: 0.45 });
        const testEyeData1 = {
            blink_rate: 0.27,
            pupil_dilation: 0.12,
            gaze_direction: { x: 0.3, y: 0 }
        };

        const analysis1 = advancedFacialAnalysis(testLandmarks1, testHandLandmarks1, testEyeData1);

        const testLandmarks2 = [...Array(468).fill({ x: 0.5, y: 0.5 })];
        testLandmarks2[107] = { x: 0.4, y: 0.35 };
        testLandmarks2[105] = { x: 0.4, y: 0.35 };
        testLandmarks2[159] = { x: 0.35, y: 0.45 };
        testLandmarks2[145] = { x: 0.35, y: 0.5 };
        testLandmarks2[13]  = { x: 0.5, y: 0.6 };
        testLandmarks2[14]  = { x: 0.5, y: 0.62 };

        const testHandLandmarks2 = Array(21).fill({ x: 0.8, y: 0.8 });
        const testEyeData2 = {
            blink_rate: 0.18,
            pupil_dilation: 0.05,
            gaze_direction: { x: 0, y: 0 }
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

// ─── CRON TEST ──────────────────────────────────────────────────────
router.get('/v1/cron-test/:job', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { job } = req.params;
    try {
        console.log(`[CRON-TEST] ${job} manuel başlatılıyor...`);

        // Lazy-import cron functions
        const { autonomousSourceDiscovery, assessKnowledgeQuality, detectKnowledgeGaps, verifySourceCredibility } = await import('../lib/cronJobs.js');

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

export default router;
