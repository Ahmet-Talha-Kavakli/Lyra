// therapy/hypothesisEngine.js
// Terapötik Hipotez Motoru — Lyra, birden fazla seans verisi birikmişken
// kullanıcı hakkında derinlikli bir psikolojik hipotez üretir ve profilde saklar.
//
// Çalışma mantığı:
//   1. session_count % 3 === 0 olduğunda (her 3 seansta bir) tetiklenir
//   2. Son 8 seansın verisi + psikolojik profil → GPT'ye gönderilir
//   3. GPT → kısa, somut, terapötik bir hipotez döner (Türkçe)
//   4. Hipotez psychological_profiles.therapeutic_hypothesis alanına yazılır
//   5. Bir sonraki seans başında promptBuilder bunu inject eder

import { supabase } from '../lib/supabase.js';
import { openai } from '../lib/openai.js';

// ─── VERİ TOPLAMA ────────────────────────────────────────────────────────────

/**
 * Son N seansın ham verisini çeker.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function fetchRecentSessionData(userId, limit = 8) {
    const { data, error } = await supabase
        .from('session_records')
        .select('dominant_emotion, topics, breakthrough_moment, emotional_start_score, emotional_end_score, session_quality, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !data) return [];
    return data;
}

// ─── GPT HİPOTEZ ÇAĞRISI ────────────────────────────────────────────────────

/**
 * Profil + seans geçmişinden terapötik hipotez üretir.
 * @param {Object} profile — psychological_profiles kaydı
 * @param {Array} sessions — son seans kayıtları
 * @returns {Promise<string>} — Ham GPT çıktısı
 */
async function callHypothesisGPT(profile, sessions) {
    // Profil özeti
    const profileSummary = [
        profile.attachment_style !== 'belirsiz' ? `Bağlanma stili: ${profile.attachment_style}` : null,
        profile.triggers?.length > 0 ? `Tetikleyiciler: ${profile.triggers.slice(0, 4).map(t => t.konu || t).join(', ')}` : null,
        profile.life_schemas?.length > 0 ? `Yaşam şemaları: ${profile.life_schemas.slice(0, 3).map(s => s.sema || s).join(', ')}` : null,
        profile.unconscious_patterns?.length > 0 ? `Bilinçdışı desenler: ${profile.unconscious_patterns.slice(0, 3).map(p => p.desen || p).join(', ')}` : null,
        profile.defense_mechanisms?.filter(d => d.sıklık === 'sık').length > 0
            ? `Sık savunmalar: ${profile.defense_mechanisms.filter(d => d.sıklık === 'sık').slice(0, 2).map(d => d.mekanizma).join(', ')}`
            : null,
    ].filter(Boolean).join('\n');

    // Seans geçmişi özeti
    const sessionSummary = sessions.map((s, i) => {
        const parts = [`Seans ${i + 1}`];
        if (s.dominant_emotion) parts.push(`duygu: ${s.dominant_emotion}`);
        if (s.topics?.length > 0) parts.push(`konular: ${s.topics.slice(0, 3).join(', ')}`);
        if (s.breakthrough_moment) parts.push('kırılım: evet');
        if (s.session_quality !== null && s.session_quality !== undefined) {
            parts.push(`kalite: ${s.session_quality}`);
        }
        return parts.join(' | ');
    }).join('\n');

    const prompt = `Sen deneyimli bir psikoterapistsin. Aşağıdaki veriler bir hastana ait. Bu verileri analiz ederek kısa, somut, terapötik bir hipotez üret.

## Psikolojik Profil
${profileSummary || 'Henüz profil bilgisi yok.'}

## Son Seans Verileri (yeniden eskiye)
${sessionSummary || 'Henüz seans verisi yok.'}

## Görev
Aşağıdaki formatta TEK bir hipotez üret. Hipotez:
- Türkçe olmalı
- 1-2 cümle, maksimum 200 karakter
- Somut bir psikolojik desen veya çatışmayı işaret etmeli
- "Belki...", "Sanki...", "Görünen o ki..." tarzında başlamalı — yargılayıcı değil, meraklı ton
- Terapiste (Lyra'ya) yönelik bir içgörü, kullanıcıya söylenecek bir şey değil

Sadece hipotezi yaz, başka hiçbir şey yazma.`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.4,
    });

    return response.choices[0]?.message?.content?.trim() || '';
}

// ─── KAYDETME ────────────────────────────────────────────────────────────────

/**
 * Hipotezi psychological_profiles tablosuna yazar.
 * @param {string} userId
 * @param {string} hypothesis
 * @param {number} basedOnSessionCount — kaç seans verisiyle üretildi
 */
async function saveHypothesis(userId, hypothesis, basedOnSessionCount) {
    const { error } = await supabase
        .from('psychological_profiles')
        .update({
            therapeutic_hypothesis: hypothesis,
            hypothesis_updated_at: new Date().toISOString(),
            hypothesis_session_count: basedOnSessionCount,
            last_updated: new Date().toISOString(),
        })
        .eq('user_id', userId);

    if (error) throw new Error(`Hipotez kaydedilemedi: ${error.message}`);
}

// ─── TETIKLEME KONTROLÜ ──────────────────────────────────────────────────────

/**
 * Bu seans hipotez motoru çalışmalı mı?
 * Her 3 seansta bir tetiklenir, minimum 5 seans gerekir.
 * @param {number} sessionCount — profilden gelen session_count
 * @returns {boolean}
 */
export function shouldRunHypothesisEngine(sessionCount) {
    if (!sessionCount || sessionCount < 5) return false;
    return sessionCount % 3 === 0;
}

// ─── ANA GİRİŞ NOKTASI ───────────────────────────────────────────────────────

/**
 * Hipotez motorunu çalıştırır. Hata yaymaz — arka planda sessizce çalışır.
 * @param {string} userId
 * @param {Object} profile — mevcut psikolojik profil
 */
export async function runHypothesisEngine(userId, profile) {
    if (!userId || !profile) return;
    if (!shouldRunHypothesisEngine(profile.session_count)) return;

    try {
        const sessions = await fetchRecentSessionData(userId, 8);
        if (sessions.length < 3) {
            console.log('[HYPOTHESIS] Yetersiz seans verisi, atlanıyor.');
            return;
        }

        const hypothesis = await callHypothesisGPT(profile, sessions);
        if (!hypothesis || hypothesis.length < 10) {
            console.log('[HYPOTHESIS] GPT boş hipotez döndü, atlanıyor.');
            return;
        }

        await saveHypothesis(userId, hypothesis, sessions.length);
        console.log(`[HYPOTHESIS] ✅ Hipotez güncellendi | userId: ${userId} | seans: ${profile.session_count}`);
        console.log(`[HYPOTHESIS] Hipotez: ${hypothesis}`);
    } catch (err) {
        console.error('[HYPOTHESIS] Hata (ana akış etkilenmedi):', err.message);
    }
}

// ─── PROMPT INJECT YARDIMCISI ────────────────────────────────────────────────

/**
 * Mevcut hipotezi sistem promptuna eklenecek metin olarak döner.
 * @param {Object} profile — psychological_profiles kaydı
 * @returns {string} — prompt eki (boş olabilir)
 */
export function buildHypothesisContext(profile) {
    if (!profile?.therapeutic_hypothesis) return '';
    const age = profile.hypothesis_updated_at
        ? Math.floor((Date.now() - new Date(profile.hypothesis_updated_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    // 30 günden eski hipotezleri inject etme — stale olabilir
    if (age !== null && age > 30) return '';

    return `\n\n[TERAPÖTİK HİPOTEZ — ${profile.hypothesis_session_count || '?'} seans verisinden]\n${profile.therapeutic_hypothesis}\nBu bir kesinlik değil, bir içgörü — seansı bu perspektifle yönet.`;
}
