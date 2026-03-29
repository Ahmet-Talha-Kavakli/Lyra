// routes/therapy.js
import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireOwnership } from '../lib/helpers.js';

const router = express.Router();

// ─── #17: DÜŞÜNCE KAYDI (CBT) ────────────────────────────────────────
router.post('/record-thought', authMiddleware, async (req, res) => {
    try {
        const { userId, automatic_thought, evidence_for, evidence_against, realistic_response } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!automatic_thought) {
            return res.json({ error: 'automatic_thought gerekli' });
        }

        const { data, error } = await supabase.from('thought_records').insert([{
            user_id: userId,
            automatic_thought: automatic_thought,
            evidence_for: evidence_for || '',
            evidence_against: evidence_against || '',
            realistic_response: realistic_response || '',
            recorded_at: new Date().toISOString()
        }]);

        if (error) {
            console.error('[CBT] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        console.log(`[#17 CBT] Düşünce kaydedildi: "${automatic_thought.substring(0,50)}..."`);
        res.json({ success: true, record: data?.[0] || {} });
    } catch (err) {
        console.error('[#17 CBT] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #17: DÜŞÜNCE KAYITLARINI GETIR ─────────────────────────────────
router.get('/thought-records/:userId', authMiddleware, async (req, res) => {
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
router.post('/discover-values', authMiddleware, async (req, res) => {
    try {
        const { userId, selectedValues } = req.body;
        if (!requireOwnership(userId, req, res)) return;
        if (!Array.isArray(selectedValues)) {
            return res.json({ error: 'selectedValues gerekli' });
        }

        const { data, error } = await supabase.from('user_values').insert([{
            user_id: userId,
            values: selectedValues,
            discovered_at: new Date().toISOString()
        }]);

        if (error) {
            console.error('[#18 VALUES] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        await supabase.from('user_profile')
            .update({ values_discovered: true })
            .eq('user_id', userId);

        console.log(`[#18 VALUES] ${selectedValues.length} değer kaydedildi: ${selectedValues.slice(0,3).join(', ')}`);
        res.json({ success: true, values_saved: selectedValues.length });
    } catch (err) {
        console.error('[#18 VALUES] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #18: KULLANICININ DEĞERLERINI GETIR ────────────────────────────
router.get('/user-values/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
        const { data, error } = await supabase
            .from('user_values')
            .select('*')
            .eq('user_id', userId)
            .order('discovered_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            return res.json({ values: [] });
        }

        res.json({ values: data?.values || [] });
    } catch (err) {
        res.json({ values: [] });
    }
});

// ─── #19: HAFTALIK MİNİ GÖREVLER (Homework) ──────────────────────────
router.post('/assign-homework', authMiddleware, async (req, res) => {
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

        const { data, error } = await supabase.from('homework_tasks').insert([{
            user_id: userId,
            session_id: sessionId,
            task: homeworkTask,
            assigned_at: new Date().toISOString()
        }]);

        if (error) {
            console.error('[#19 HW] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        console.log(`[#19 HW] Görev atandı: "${homeworkTask.title}"`);
        res.json({ success: true, homework: homeworkTask });
    } catch (err) {
        console.error('[#19 HW] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #19: HAFTA GÖREVLERINI GETIR ────────────────────────────────────
router.get('/homework/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
        const { data, error } = await supabase
            .from('homework_tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('completed', false)
            .order('assigned_at', { ascending: false })
            .limit(5);

        if (error) {
            return res.json({ tasks: [] });
        }

        console.log(`[#19 HW] ${data?.length || 0} görev döndürüldü`);
        res.json({ tasks: data || [] });
    } catch (err) {
        res.json({ tasks: [] });
    }
});

// ─── #19: GÖREVI TAMAMLA ─────────────────────────────────────────────
router.post('/complete-homework/:taskId', authMiddleware, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { error } = await supabase.from('homework_tasks')
            .update({ completed: true, completed_at: new Date().toISOString() })
            .eq('id', taskId)
            .eq('user_id', req.userId);

        if (error) {
            return res.json({ error: error.message });
        }

        console.log(`[#19 HW] Görev tamamlandı: ${taskId}`);
        res.json({ success: true });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ─── #20: KRİZ SONRASI PROTOKOL (24-Hour Check-in) ──────────────────
router.post('/log-crisis', authMiddleware, async (req, res) => {
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

        const { error } = await supabase.from('crisis_logs').insert([{
            user_id: userId,
            crisis_data: crisis_record
        }]);

        if (error) {
            console.error('[#20 CRISIS] Supabase hata:', error.message);
            return res.json({ error: error.message });
        }

        console.log(`[#20 CRISIS] Kriz kaydedildi (${severity}): ${description?.substring(0,40)}`);
        res.json({ success: true, followup_due: crisis_record.followup_due });
    } catch (err) {
        console.error('[#20 CRISIS] Hata:', err.message);
        res.json({ error: err.message });
    }
});

// ─── #20: KRİZ TAKIBI ÖNEMLİ ─────────────────────────────────────────
router.get('/crisis-followups-due/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!requireOwnership(userId, req, res)) return;
        const now = new Date().toISOString();

        const { data, error } = await supabase.from('crisis_logs')
            .select('*')
            .eq('user_id', userId)
            .lte('crisis_data->followup_due', now)
            .eq('crisis_data->followup_done', false)
            .order('crisis_data->detected_at', { ascending: false });

        if (error) {
            return res.json({ followups: [] });
        }

        console.log(`[#20 CRISIS] ${data?.length || 0} takip gerekli`);
        res.json({ followups: data || [] });
    } catch (err) {
        res.json({ followups: [] });
    }
});

// ─── #20: KRİZ TAKIP TAMAMLA ──────────────────────────────────────────
router.post('/complete-crisis-followup/:crisisId', authMiddleware, async (req, res) => {
    try {
        const { crisisId } = req.params;
        const { followupResponse } = req.body;

        const { data: crisisData, error: fetchErr } = await supabase
            .from('crisis_logs').select('*').eq('id', crisisId).eq('user_id', req.userId).single();

        if (fetchErr || !crisisData) return res.json({ error: 'Kriz kaydı bulunamadı' });

        const updatedCrisis = { ...crisisData.crisis_data, followup_done: true, followup_response: followupResponse || '' };

        const { error } = await supabase.from('crisis_logs')
            .update({ crisis_data: updatedCrisis })
            .eq('id', crisisId);

        if (error) return res.json({ error: error.message });

        console.log(`[#20 CRISIS] Takip tamamlandı: ${crisisId}`);
        res.json({ success: true });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ─── AVATAR: AZURE TTS + VİSEME SENTEZİ ──────────────────────────────────
router.post('/synthesize', authMiddleware, async (req, res) => {
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
