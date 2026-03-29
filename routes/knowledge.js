// routes/knowledge.js
import express from 'express';
import { supabase } from '../lib/supabase.js';
import { openai } from '../lib/openai.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireOwnership, requireAdmin } from '../lib/helpers.js';

const router = express.Router();

// Helper: retrieveKnowledge
async function retrieveKnowledge(query, opts = {}) {
    const { limit = 3, category } = opts;
    if (!query || query.length < 3) return [];

    try {
        let queryEmbedding = null;
        try {
            const embRes = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: query.substring(0, 500)
            });
            queryEmbedding = embRes.data[0].embedding;
        } catch (_) { /* keyword fallback */ }

        let q = supabase
            .from('knowledge_sources')
            .select('id, source_type, title, author, summary, category, subcategory, tags, credibility_score, embedding')
            .eq('is_active', true);
        if (category && category !== 'all') q = q.eq('category', category);
        const { data: sources, error } = await q.limit(80);
        if (error || !sources?.length) return [];

        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

        const scored = sources.map(source => {
            let score = 0;
            if (queryEmbedding && source.embedding) {
                const a = queryEmbedding;
                const b = source.embedding;
                let dot = 0, normA = 0, normB = 0;
                for (let i = 0; i < a.length; i++) {
                    dot += a[i] * b[i];
                    normA += a[i] * a[i];
                    normB += b[i] * b[i];
                }
                score = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
            } else {
                const titleLower = (source.title || '').toLowerCase();
                const summaryLower = (source.summary || '').toLowerCase();
                const tagsLower = (source.tags || []).join(' ').toLowerCase();
                for (const word of queryWords) {
                    if (titleLower.includes(word)) score += 0.4;
                    if (summaryLower.includes(word)) score += 0.25;
                    if (tagsLower.includes(word)) score += 0.2;
                }
                score += (source.credibility_score || 0.8) * 0.05;
                score = Math.min(score, 1);
            }
            return { ...source, relevance: Math.round(score * 100) / 100 };
        });

        return scored
            .filter(s => s.relevance > 0.1)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit)
            .map(({ embedding: _e, ...rest }) => rest);
    } catch (err) {
        console.warn('[retrieveKnowledge] Hata:', err.message);
        return [];
    }
}

// Helper: buildHypothesis
const yogunlukToNum = (y) => ({ 'düşük': 30, 'orta': 60, 'yüksek': 90 }[y] ?? 60);

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

    let predictedEmotion = currentDuygu;
    let confidence = 0.4;

    if (konuDuygular.length > 0) {
        const duyguFreq = {};
        konuDuygular.forEach(d => { duyguFreq[d] = (duyguFreq[d] || 0) + 1; });
        const siralanmis = Object.entries(duyguFreq).sort(([,a],[,b]) => b - a);
        predictedEmotion = siralanmis[0][0];
        confidence = (siralanmis[0][1] / konuDuygular.length) * 0.95;
    }

    const trendi = patternMemory.seans_trendi || [];
    let riskSkoru = 0;
    let trendYonu = 'stabil';

    if (trendi.length >= 3) {
        const son3 = trendi.slice(-3);
        if (son3.every(t => t === 'kötüleşiyor')) { riskSkoru = 0.8; trendYonu = 'kötüleşiyor'; }
        else if (son3[son3.length - 1] === 'kötüleşiyor') { riskSkoru = 0.6; trendYonu = 'kötüleşiyor'; }
        else if (son3.every(t => t === 'iyileşiyor')) { riskSkoru = 0.1; trendYonu = 'iyileşiyor'; }
    }

    let isLoop = false;
    let loopStrength = 0;
    if (hit >= 3 && predictedEmotion === gecmis?.[gecmis.length - 1]?.duygu) {
        isLoop = true;
        loopStrength = Math.min(hit / 5, 1);
        riskSkoru = Math.max(riskSkoru, 0.5 + loopStrength * 0.3);
    }

    const sonYogunluk = yogunlukToNum(currentDuygu === 'şaşkın' ? 'orta' :
                                       ['yüksek', 'öfkeli', 'panikleme'].includes(currentDuygu) ? 'yüksek' : 'orta');
    const ortalamaYogunluk = gecmis?.length > 0
        ? gecmis.map(a => yogunlukToNum(a.yogunluk)).reduce((s,v) => s+v, 0) / gecmis.length
        : 60;

    if (sonYogunluk > ortalamaYogunluk + 20) riskSkoru = Math.max(riskSkoru, 0.7);

    let suggestedIntervention = 'gözlemle';
    let interventionTiming = 'devam_et';

    if (riskSkoru >= 0.7) {
        if (['endişeli', 'korkmuş', 'panik'].includes(predictedEmotion)) { suggestedIntervention = 'nefes_egzersizi_4_7_8'; interventionTiming = 'şimdi'; }
        else if (['öfkeli', 'sinirli'].includes(predictedEmotion)) { suggestedIntervention = 'kontrol_analizi'; interventionTiming = 'şimdi'; }
        else if (predictedEmotion === 'üzgün') { suggestedIntervention = 'vizualizasyon'; interventionTiming = 'şimdi'; }
    } else if (riskSkoru >= 0.5) {
        if (isLoop) { suggestedIntervention = 'döngü_kır_farklı_soru'; interventionTiming = '2_3_cumle'; }
        else { suggestedIntervention = 'empati_ve_doğrulama'; interventionTiming = 'devam_et'; }
    }

    let reasoning = `Konu "${currentTopic}" → duygu "${predictedEmotion}" (${Math.round(confidence*100)}% emin)`;
    if (hit >= 2) reasoning += `. Geçmiş ${hit} seansda bu konuda aynı duygular görüldü.`;
    if (trendYonu === 'kötüleşiyor') reasoning += ` Trend kötüleşiyor, risk yüksek.`;
    if (isLoop) reasoning += ` Döngü tespit: aynı konu aynı duyguya yol açıyor.`;

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

// ─── HIPOTEZ MOTORU (Davranış Tahmini) ────────────────────────────────
router.post('/hypothesis', authMiddleware, async (req, res) => {
    try {
        const { userId, currentTopic, currentDuygu, sessionId } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!currentTopic) {
            return res.json({ error: 'currentTopic gerekli' });
        }

        const { data: memRow } = await supabase
            .from('user_profile')
            .select('pattern_memory')
            .eq('user_id', userId)
            .single();

        const patternMemory = memRow?.pattern_memory || {};

        const { data: emotionHistory } = await supabase
            .from('emotion_logs')
            .select('duygu, yogunluk')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(10);

        const gecmis = emotionHistory || [];

        const hypothesis = buildHypothesis(userId, currentTopic, currentDuygu, patternMemory, gecmis);

        if (sessionId) {
            const { default: crypto } = await import('crypto');
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
router.post('/hypothesis-accuracy', authMiddleware, async (req, res) => {
    try {
        const { userId, predicted_emotion, actual_emotion, confidence } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!predicted_emotion || !actual_emotion) {
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
router.post('/save-insight', authMiddleware, async (req, res) => {
    try {
        const { userId, insights } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!Array.isArray(insights) || insights.length === 0) {
            return res.json({ error: 'userId ve insights array gerekli', saved: 0 });
        }

        let savedCount = 0;
        for (const insight of insights) {
            try {
                const embeddingResp = await openai.embeddings.create({
                    model: 'text-embedding-ada-002',
                    input: `${insight.title}. ${insight.content}`
                });

                const embedding = embeddingResp.data[0].embedding;

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
router.get('/retrieve-knowledge', authMiddleware, async (req, res) => {
    try {
        const { userId, query, limit } = req.query;
        if (!requireOwnership(userId, req, res)) return;
        if (!query) {
            return res.json({ insights: [] });
        }

        const queryLimit = Math.min(parseInt(limit) || 3, 10);

        const queryEmbeddingResp = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: query
        });

        const queryEmbedding = queryEmbeddingResp.data[0].embedding;

        const { data: results } = await supabase.rpc('match_knowledge_bank', {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: queryLimit,
            p_user_id: userId
        }).then(d => ({ data: d || [], error: null }))
          .catch(() => {
              return supabase.from('knowledge_bank')
                  .select('*')
                  .eq('user_id', userId)
                  .like('content', `%${query}%`)
                  .limit(queryLimit)
                  .then(d => ({ data: d.data || [], error: null }));
          });

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

// ─── BILGI BANKASI: BAŞLANGIÇ KAYNAKLARI SEEDING ──────────────────────────────
router.post('/seed-knowledge', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        console.log('[SEED] Başlangıç kaynakları yükleniyor...');

        const { data: existing } = await supabase.from('knowledge_sources').select('id');
        if (existing && existing.length > 0) {
            console.log(`[SEED] ${existing.length} mevcut kaynak bulundu, yeni yüklemeye hazırlanıyor...`);
        }

        const initialSources = [
            { source_type: 'book', title: 'The Body Keeps the Score', author: 'Bessel van der Kolk', url: 'https://www.besselvanderkolk.com/', summary: 'Travma ve bedenin hafızası hakkında kapsamlı rehber', content: 'Travmanın beyni ve bedeni nasıl etkilediğini açıklayan monumental çalışma. PTSD, beyin plastisitesi, somatic terapi.', category: 'trauma', subcategory: 'ptsd', tags: ['trauma', 'neuroscience', 'body-based', 'recovery'], credibility_score: 0.95, relevance_score: 0.95 },
            { source_type: 'book', title: 'Emotional Intelligence', author: 'Daniel Goleman', url: 'https://www.danielgoleman.info/', summary: 'Duygu kontrolü ve kişilerarası becerilerin gücü', content: 'Duygusal zeka nedir, neden IQ\'dan önemli, ve nasıl geliştirebileceğimiz. Öz-farkındalık, empati, ilişki yönetimi.', category: 'general', subcategory: 'emotional-regulation', tags: ['emotions', 'relationships', 'self-awareness'], credibility_score: 0.92, relevance_score: 0.90 },
            { source_type: 'book', title: 'Mindfulness for Beginners', author: 'Jon Kabat-Zinn', url: 'https://www.mindfulnesstapes.com/', summary: 'Meditasyon ve şimdiki ana odaklanma tekniği', content: 'Mindfulness nedir, nasıl uygulanır, faydaları. Stres azaltma, kaygı yönetimi, yaşam kalitesi iyileştirme.', category: 'general', subcategory: 'mindfulness', tags: ['meditation', 'stress-reduction', 'mindfulness'], credibility_score: 0.94, relevance_score: 0.92 },
        ];

        let seededCount = 0;
        for (const source of initialSources) {
            try {
                let embedding = null;
                try {
                    const embRes = await openai.embeddings.create({
                        model: 'text-embedding-ada-002',
                        input: `${source.title}. ${source.summary}. ${source.content}`.substring(0, 500)
                    });
                    embedding = embRes.data[0].embedding;
                } catch (embErr) {
                    console.warn(`[SEED] Embedding hatası: ${embErr.message}`);
                }

                const { error } = await supabase.from('knowledge_sources').insert([{
                    ...source,
                    embedding,
                    is_active: true,
                    created_at: new Date().toISOString()
                }]);

                if (!error) seededCount++;
            } catch (e) {
                console.warn(`[SEED] Kaynak kayıt hatası: ${e.message}`);
            }
        }

        console.log(`[SEED] ✅ ${seededCount}/${initialSources.length} kaynak yüklendi`);
        res.json({ success: true, seeded: seededCount, total: initialSources.length });
    } catch (err) {
        console.error('[SEED] Hata:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── RAG: ADVANCED KNOWLEDGE RETRIEVAL ──────────────────────────────────────
router.get('/retrieve-knowledge-advanced', authMiddleware, async (req, res) => {
    try {
        const { query, category, limit = 5, userId } = req.query;
        if (!requireOwnership(userId, req, res)) return;
        if (!query) return res.json({ error: 'query parametresi gerekli' });

        const insights = await retrieveKnowledge(query, { limit: parseInt(limit), category });

        if (userId && insights.length > 0) {
            insights.forEach(insight => {
                supabase.from('knowledge_usage_logs').insert([{
                    user_id: userId,
                    knowledge_id: insight.id,
                    used_context: `Arama: "${query}"`,
                    used_at: new Date().toISOString()
                }]).catch(() => {});
            });
        }

        console.log(`[RAG] ${insights.length} kaynak döndürüldü`);
        res.json({ insights, query, count: insights.length, timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('[RAG] Hata:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Bilgi Bankası Durumu Endpoint
router.get('/knowledge-stats', async (req, res) => {
    if (!requireAdmin(req, res)) return;
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

export default router;
