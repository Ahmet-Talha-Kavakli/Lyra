// routes/user.js
import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireOwnership } from '../lib/helpers.js';
import { updateTechniqueEffectiveness } from '../progress/sessionAnalyzer.js';

const router = express.Router();

// ─── KULLANICI ONAYI (KVKK Madde 3/5/6) ────────────────────
router.post('/v1/consent-accept', authMiddleware, async (req, res) => {
    const { userId, consentVersion = '1.0' } = req.body;
    if (!requireOwnership(userId, req, res)) return;

    const { error } = await supabase.from('user_consents').upsert({
        user_id: userId,
        consent_version: consentVersion,
        ip_address: req.ip,
        user_agent: (req.headers['user-agent'] || '').substring(0, 500),
        accepted_at: new Date().toISOString()
    }, { onConflict: 'user_id,consent_version' });

    if (error) return res.status(500).json({ error: error.message });
    console.log(`[CONSENT] Kullanıcı onayı kaydedildi: ${userId} v${consentVersion}`);
    res.json({ ok: true });
});

router.get('/v1/consent-status', authMiddleware, async (req, res) => {
    const userId = req.query.userId || req.userId;
    if (!requireOwnership(userId, req, res)) return;

    const { data } = await supabase.from('user_consents')
        .select('accepted_at, consent_version')
        .eq('user_id', userId)
        .eq('consent_version', '1.0')
        .single();

    res.json({ hasConsent: !!data, acceptedAt: data?.accepted_at || null });
});

// ─── VERİ SİLME (KVKK Madde 11/e) ──────────────────────────
router.delete('/v1/delete-my-data', authMiddleware, async (req, res) => {
    const { userId, confirmPhrase } = req.body;
    if (!requireOwnership(userId, req, res)) return;
    if (!userId || confirmPhrase !== 'VERİLERİMİ SİL') {
        return res.status(400).json({
            error: 'Silme için confirmPhrase alanına tam olarak "VERİLERİMİ SİL" yazın'
        });
    }

    const tables = [
        'psychological_profiles', 'session_records', 'emotion_logs',
        'memories', 'crisis_logs', 'knowledge_usage_logs',
        'progress_metrics', 'technique_effectiveness', 'user_consents',
        'session_feedback'
    ];
    const deleted = [], errors = [];

    for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('user_id', userId);
        if (error) errors.push(`${table}: ${error.message}`);
        else deleted.push(table);
    }
    await supabase.from('user_profiles').delete().eq('user_id', userId).catch(() => {});

    console.log(`[DATA DELETE] userId: ${userId} — ${deleted.length} tablo temizlendi`);
    if (errors.length > 0) return res.status(207).json({ partialSuccess: true, deleted, errors });
    res.json({ success: true, deleted, message: 'Tüm verileriniz silindi.' });
});

// ─── VERİ DIŞA AKTARMA (KVKK Madde 11/ç) ───────────────────
router.get('/v1/export-my-data', authMiddleware, async (req, res) => {
    const { userId } = req.query;
    if (!requireOwnership(userId, req, res)) return;

    const exportData = {};
    for (const table of ['psychological_profiles', 'session_records', 'progress_metrics']) {
        const { data } = await supabase.from(table).select('*').eq('user_id', userId);
        exportData[table] = data || [];
    }

    res.setHeader('Content-Disposition', 'attachment; filename="lyra-data-export.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json({
        export_date: new Date().toISOString(),
        user_id: userId,
        data: exportData,
        note: 'Bu dosya KVKK Madde 11/ç kapsamında kişisel veri dışa aktarımıdır.'
    });
});

// ─── CONFIG (Frontend için Supabase bilgileri) ──────────────
router.get('/v1/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// ─── İLERLEME VERİSİ (D1) ─────────────────────────────────
router.get('/v1/my-progress', authMiddleware, async (req, res) => {
    const { userId } = req.query;
    if (!requireOwnership(userId, req, res)) return;
    try {
        const [sessionsResp, profileResp, metricsResp] = await Promise.all([
            supabase.from('session_records')
                .select('session_id, created_at, dominant_emotion, topics, emotional_end_score, crisis_flag, session_quality, techniques_used, breakthrough_moment')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20),
            supabase.from('profiles').select('session_count, attachment_style, strengths, life_schemas').eq('user_id', userId).single(),
            supabase.from('weekly_metrics').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(4),
        ]);

        const sessions = sessionsResp.data || [];
        const profile = profileResp.data || {};
        const metrics = metricsResp.data || [];

        // Özet istatistikler
        const totalSessions = profile.session_count || sessions.length;
        const avgQuality = sessions.length
            ? Math.round(sessions.reduce((s, r) => s + (r.session_quality || 0), 0) / sessions.filter(r => r.session_quality).length) || null
            : null;
        const breakthroughCount = sessions.filter(r => r.breakthrough_moment).length;
        const crisisCount = sessions.filter(r => r.crisis_flag).length;

        // En sık görülen konular
        const topicFreq = {};
        for (const s of sessions) {
            for (const t of (s.topics || [])) {
                topicFreq[t] = (topicFreq[t] || 0) + 1;
            }
        }
        const topTopics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

        // Duygusal seyir (son 10 seans)
        const emotionalArc = sessions.slice(0, 10).reverse().map(s => ({
            date: s.created_at,
            score: s.emotional_end_score,
            emotion: s.dominant_emotion,
        }));

        res.json({
            summary: { totalSessions, avgQuality, breakthroughCount, crisisCount },
            topTopics,
            emotionalArc,
            weeklyMetrics: metrics,
            strengths: (profile.strengths || []).slice(0, 3),
            recentSessions: sessions.slice(0, 5).map(s => ({
                date: s.created_at,
                topics: s.topics,
                quality: s.session_quality,
                breakthrough: s.breakthrough_moment,
            })),
        });
    } catch (e) {
        console.error('[MY-PROGRESS]', e.message);
        res.status(500).json({ error: 'İlerleme verisi alınamadı' });
    }
});

// ─── ACİL KİŞİLER (D3) ────────────────────────────────────
router.get('/v1/emergency-contacts', authMiddleware, async (req, res) => {
    const { userId } = req.query;
    if (!requireOwnership(userId, req, res)) return;
    try {
        const { data } = await supabase.from('emergency_contacts').select('*').eq('user_id', userId);
        res.json({ contacts: data || [] });
    } catch (e) {
        res.status(500).json({ error: 'Acil kişiler alınamadı' });
    }
});

router.post('/v1/emergency-contacts', authMiddleware, async (req, res) => {
    const { userId, name, phone, relation } = req.body;
    if (!requireOwnership(userId, req, res)) return;
    if (!name || !phone) return res.status(400).json({ error: 'name ve phone zorunlu' });
    try {
        const { error } = await supabase.from('emergency_contacts').upsert({
            user_id: userId,
            name: name.substring(0, 100),
            phone: phone.substring(0, 20),
            relation: (relation || '').substring(0, 50),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,phone' });
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Acil kişi kaydedilemedi' });
    }
});

// ─── SEANS GERİ BİLDİRİMİ (D4) ───────────────────────────
router.post('/v1/session-feedback', authMiddleware, async (req, res) => {
    const { userId, sessionId, rating, note } = req.body;
    if (!requireOwnership(userId, req, res)) return;
    if (!sessionId || rating == null) {
        return res.status(400).json({ error: 'sessionId ve rating zorunlu' });
    }
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating 1-5 arası olmalı' });
    }
    try {
        const { error } = await supabase.from('session_feedback').upsert({
            user_id: userId,
            session_id: sessionId,
            rating,
            note: (note || '').substring(0, 500),
            created_at: new Date().toISOString(),
        }, { onConflict: 'user_id,session_id' });
        if (error) throw error;

        // Teknik etkinliği güncelle — kullanıcı memnuniyeti iyiyse
        if (rating >= 4) {
            const { data: sr } = await supabase.from('session_records')
                .select('techniques_used').eq('session_id', sessionId).single();
            if (sr?.techniques_used?.length) {
                for (const tid of sr.techniques_used) {
                    await updateTechniqueEffectiveness(userId, tid, true);
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('[SESSION-FEEDBACK]', e.message);
        res.status(500).json({ error: 'Geri bildirim kaydedilemedi' });
    }
});

export default router;
