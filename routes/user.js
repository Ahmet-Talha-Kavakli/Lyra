// routes/user.js
import express from 'express';
import { databasePool } from '../lib/infrastructure/databasePool.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireOwnership } from '../lib/shared/helpers.js';
import { updateTechniqueEffectiveness } from '../progress/sessionAnalyzer.js';

const router = express.Router();

// ─── KULLANICI ONAYI (KVKK Madde 3/5/6) ────────────────────
router.post('/v1/consent-accept', authMiddleware, async (req, res) => {
    const { userId, consentVersion = '1.0' } = req.body;
    if (!requireOwnership(userId, req, res)) return;

    try {
        await databasePool.query(
            `INSERT INTO user_consents (user_id, consent_version, ip_address, user_agent, accepted_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, consent_version) DO UPDATE SET
             ip_address = EXCLUDED.ip_address,
             user_agent = EXCLUDED.user_agent,
             accepted_at = EXCLUDED.accepted_at`,
            [userId, consentVersion, req.ip, (req.headers['user-agent'] || '').substring(0, 500), new Date().toISOString()]
        );
        console.log(`[CONSENT] Kullanıcı onayı kaydedildi: ${userId} v${consentVersion}`);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/v1/consent-status', authMiddleware, async (req, res) => {
    const userId = req.query.userId || req.userId;
    if (!requireOwnership(userId, req, res)) return;

    try {
        const data = await databasePool.queryOne(
            `SELECT accepted_at, consent_version FROM user_consents
             WHERE user_id = $1 AND consent_version = $2`,
            [userId, '1.0']
        );
        res.json({ hasConsent: !!data, acceptedAt: data?.accepted_at || null });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
        try {
            await databasePool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
            deleted.push(table);
        } catch (error) {
            errors.push(`${table}: ${error.message}`);
        }
    }
    try {
        await databasePool.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
    } catch (e) {
        // Ignore errors for user_profiles
    }

    console.log(`[DATA DELETE] userId: ${userId} — ${deleted.length} tablo temizlendi`);
    if (errors.length > 0) return res.status(207).json({ partialSuccess: true, deleted, errors });
    res.json({ success: true, deleted, message: 'Tüm verileriniz silindi.' });
});

// ─── VERİ DIŞA AKTARMA (KVKK Madde 11/ç) ───────────────────
router.get('/v1/export-my-data', authMiddleware, async (req, res) => {
    const { userId } = req.query;
    if (!requireOwnership(userId, req, res)) return;

    try {
        const exportData = {};
        for (const table of ['psychological_profiles', 'session_records', 'progress_metrics']) {
            const data = await databasePool.queryAll(`SELECT * FROM ${table} WHERE user_id = $1`, [userId]);
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
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
        const [sessions, profile, metrics] = await Promise.all([
            databasePool.queryAll(
                `SELECT session_id, created_at, dominant_emotion, topics, emotional_end_score, crisis_flag, session_quality, techniques_used, breakthrough_moment
                 FROM session_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
                [userId]
            ),
            databasePool.queryOne(
                `SELECT session_count, attachment_style, strengths, life_schemas FROM psychological_profiles WHERE user_id = $1`,
                [userId]
            ),
            databasePool.queryAll(
                `SELECT * FROM weekly_metrics WHERE user_id = $1 ORDER BY week_start DESC LIMIT 4`,
                [userId]
            ),
        ]);

        // Özet istatistikler
        const totalSessions = (profile?.session_count) || sessions.length;
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
            strengths: (profile?.strengths || []).slice(0, 3),
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
        const data = await databasePool.queryAll('SELECT * FROM emergency_contacts WHERE user_id = $1', [userId]);
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
        await databasePool.query(
            `INSERT INTO emergency_contacts (user_id, name, phone, relation, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, phone) DO UPDATE SET
             name = EXCLUDED.name,
             relation = EXCLUDED.relation,
             updated_at = EXCLUDED.updated_at`,
            [userId, name.substring(0, 100), phone.substring(0, 20), (relation || '').substring(0, 50), new Date().toISOString()]
        );
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
        await databasePool.query(
            `INSERT INTO session_feedback (user_id, session_id, rating, note, created_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, session_id) DO UPDATE SET
             rating = EXCLUDED.rating,
             note = EXCLUDED.note,
             created_at = EXCLUDED.created_at`,
            [userId, sessionId, rating, (note || '').substring(0, 500), new Date().toISOString()]
        );

        // Teknik etkinliği güncelle — kullanıcı memnuniyeti iyiyse
        if (rating >= 4) {
            const sr = await databasePool.queryOne(
                'SELECT techniques_used FROM session_records WHERE session_id = $1',
                [sessionId]
            );
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
