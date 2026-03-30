// routes/therapy.js
import express from 'express';
import { databasePool } from '../lib/infrastructure/databasePool.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireOwnership } from '../lib/shared/helpers.js';

const router = express.Router();

// ─── #17: DÜŞÜNCE KAYDI (CBT) ────────────────────────────────────────
router.post('/v1/record-thought', authMiddleware, async (req, res) => {
    try {
        const { userId, automatic_thought, evidence_for, evidence_against, realistic_response } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!automatic_thought) {
            return res.json({ error: 'automatic_thought gerekli' });
        }

        try {
            const result = await databasePool.query(
                `INSERT INTO thought_records (user_id, automatic_thought, evidence_for, evidence_against, realistic_response, recorded_at)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [userId, automatic_thought, evidence_for || '', evidence_against || '', realistic_response || '', new Date().toISOString()]
            );

            console.log(`[#17 CBT] Düşünce kaydedildi: "${automatic_thought.substring(0,50)}..."`);
            res.json({ success: true, record: result.rows[0] || {} });
        } catch (error) {
            console.error('[CBT] Database hata:', error.message);
            return res.json({ error: error.message });
        }
    } catch (err) {
        console.error('[#17 CBT] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #17: DÜŞÜNCE KAYITLARINI GETIR ─────────────────────────────────
router.get('/v1/thought-records/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
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
router.post('/v1/discover-values', authMiddleware, async (req, res) => {
    try {
        const { userId, selectedValues } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!Array.isArray(selectedValues)) {
            return res.json({ error: 'selectedValues gerekli' });
        }

        try {
            await databasePool.query(
                `INSERT INTO user_values (user_id, values, discovered_at)
                 VALUES ($1, $2, $3)`,
                [userId, JSON.stringify(selectedValues), new Date().toISOString()]
            );

            await databasePool.query(
                `UPDATE user_profile SET values_discovered = true WHERE user_id = $1`,
                [userId]
            );

            console.log(`[#18 VALUES] ${selectedValues.length} değer kaydedildi: ${selectedValues.slice(0,3).join(', ')}`);
            res.json({ success: true, values_saved: selectedValues.length });
        } catch (error) {
            console.error('[#18 VALUES] Database hata:', error.message);
            return res.json({ error: error.message });
        }
    } catch (err) {
        console.error('[#18 VALUES] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #18: KULLANICININ DEĞERLERINI GETIR ────────────────────────────
router.get('/v1/user-values/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
        const data = await databasePool.queryOne(
            `SELECT * FROM user_values WHERE user_id = $1 ORDER BY discovered_at DESC LIMIT 1`,
            [userId]
        );

        if (!data) {
            return res.json({ values: [] });
        }

        res.json({ values: data?.values || [] });
    } catch (err) {
        res.json({ values: [] });
    }
});

// ─── #19: HAFTALIK MİNİ GÖREVLER (Homework) ──────────────────────────
router.post('/v1/assign-homework', authMiddleware, async (req, res) => {
    try {
        const { userId, sessionId, dominantEmotion, homework } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!homework) {
            return res.json({ error: 'homework gerekli' });
        }

        const homeworkTask = {
            title: homework.title || 'Mini Görev',
            description: homework.description || '',
            due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
            emotion_context: dominantEmotion,
            difficulty: homework.difficulty || 'orta',
            completed: false
        };

        try {
            await databasePool.query(
                `INSERT INTO homework_tasks (user_id, session_id, task, assigned_at)
                 VALUES ($1, $2, $3, $4)`,
                [userId, sessionId, JSON.stringify(homeworkTask), new Date().toISOString()]
            );

            console.log(`[#19 HW] Görev atandı: "${homeworkTask.title}"`);
            res.json({ success: true, homework: homeworkTask });
        } catch (error) {
            console.error('[#19 HW] Database hata:', error.message);
            return res.json({ error: error.message });
        }
    } catch (err) {
        console.error('[#19 HW] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #19: HAFTA GÖREVLERINI GETIR ────────────────────────────────────
router.get('/v1/homework/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
        const data = await databasePool.queryAll(
            `SELECT * FROM homework_tasks WHERE user_id = $1 AND completed = false
             ORDER BY assigned_at DESC LIMIT 5`,
            [userId]
        );

        console.log(`[#19 HW] ${data?.length || 0} görev döndürüldü`);
        res.json({ tasks: data || [] });
    } catch (err) {
        res.json({ tasks: [] });
    }
});

// ─── #19: GÖREVI TAMAMLA ─────────────────────────────────────────────
router.post('/v1/complete-homework/:taskId', authMiddleware, async (req, res) => {
    try {
        const { taskId } = req.params;
        const result = await databasePool.query(
            `UPDATE homework_tasks SET completed = true, completed_at = $1
             WHERE id = $2 AND user_id = $3`,
            [new Date().toISOString(), taskId, req.userId]
        );

        if (result.rowCount === 0) {
            return res.json({ error: 'Görev bulunamadı' });
        }

        console.log(`[#19 HW] Görev tamamlandı: ${taskId}`);
        res.json({ success: true });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ─── #20: KRİZ SONRASI PROTOKOL (24-Hour Check-in) ──────────────────
router.post('/v1/log-crisis', authMiddleware, async (req, res) => {
    try {
        const { userId, severity, description, triggerTopic } = req.body;
        if (!requireOwnership(userId, req, res)) return;

        const crisis_record = {
            severity: severity || 'orta',
            description: description || 'Kriz tespit edildi',
            trigger_topic: triggerTopic,
            detected_at: new Date().toISOString(),
            followup_scheduled: true,
            followup_due: new Date(Date.now() + 24*60*60*1000).toISOString()
        };

        try {
            await databasePool.query(
                `INSERT INTO crisis_logs (user_id, crisis_data) VALUES ($1, $2)`,
                [userId, JSON.stringify(crisis_record)]
            );

            console.log(`[#20 CRISIS] Kriz kaydedildi (${severity}): ${description?.substring(0,40)}`);
            res.json({ success: true, followup_due: crisis_record.followup_due });
        } catch (error) {
            console.error('[#20 CRISIS] Database hata:', error.message);
            return res.json({ error: error.message });
        }
    } catch (err) {
        console.error('[#20 CRISIS] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #20: KRİZ TAKIBI ÖNEMLİ ─────────────────────────────────────────
router.get('/v1/crisis-followups-due/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
        const now = new Date().toISOString();

        const data = await databasePool.queryAll(
            `SELECT * FROM crisis_logs WHERE user_id = $1
             AND (crisis_data->>'followup_due')::timestamp <= $2
             AND (crisis_data->>'followup_done')::boolean IS NOT TRUE
             ORDER BY (crisis_data->>'detected_at')::timestamp DESC`,
            [userId, now]
        );

        if (!data) {
            return res.json({ followups: [] });
        }

        console.log(`[#20 CRISIS] ${data?.length || 0} takip gerekli`);
        res.json({ followups: data || [] });
    } catch (err) {
        res.json({ followups: [] });
    }
});

// ─── #20: KRİZ TAKIP TAMAMLA ──────────────────────────────────────────
router.post('/v1/complete-crisis-followup/:crisisId', authMiddleware, async (req, res) => {
    try {
        const { crisisId } = req.params;
        const { followupResponse } = req.body;

        const crisisData = await databasePool.queryOne(
            `SELECT * FROM crisis_logs WHERE id = $1 AND user_id = $2`,
            [crisisId, req.userId]
        );

        if (!crisisData) return res.json({ error: 'Kriz kaydı bulunamadı' });

        const updatedCrisis = { ...crisisData.crisis_data, followup_done: true, followup_response: followupResponse || '' };

        await databasePool.query(
            `UPDATE crisis_logs SET crisis_data = $1 WHERE id = $2`,
            [JSON.stringify(updatedCrisis), crisisId]
        );

        console.log(`[#20 CRISIS] Takip tamamlandı: ${crisisId}`);
        res.json({ success: true });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ─── AVATAR: AZURE TTS + VİSEME SENTEZİ ──────────────────────────────────
router.post('/v1/synthesize', authMiddleware, async (req, res) => {
    const { text, userId } = req.body;
    if (!text) return res.status(400).json({ error: 'text zorunlu' });

    const azureKey    = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;

    if (!azureKey || !azureRegion) {
        return res.status(503).json({ error: 'Azure TTS yapılandırılmamış — AZURE_SPEECH_KEY ve AZURE_SPEECH_REGION gerekli' });
    }

    try {
        const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="tr-TR">
  <voice name="tr-TR-EmelNeural">
    <mstts:viseme type="FacialExpression"/>
    ${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  </voice>
</speak>`.trim();

        const ttsResponse = await fetch(
            `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
            {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': azureKey,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
                    'X-Microsoft-Viseme': 'true',
                },
                body: ssml,
            }
        );

        if (!ttsResponse.ok) {
            const errText = await ttsResponse.text();
            console.error('[/synthesize] Azure hata:', errText);
            return res.status(502).json({ error: 'Azure TTS hatası', detail: errText });
        }

        const visemeHeader = ttsResponse.headers.get('x-microsoft-viseme');
        let visemes = [];
        if (visemeHeader) {
            try { visemes = JSON.parse(visemeHeader); } catch { /* ignore */ }
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');

        res.json({
            audio: audioBase64,
            audioMimeType: 'audio/mp3',
            visemes,
        });
    } catch (err) {
        console.error('[/synthesize] Hata:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
