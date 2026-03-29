// therapy/reflectionEngine.js
// Lyra seans sonu öz-değerlendirme motoru
// Her seans bitince çalışır — ana akıştan izole, hata yaymaz.

/**
 * GPT çıktısını güvenli şekilde parse eder ve doğrular.
 * @param {string} raw — GPT'nin döndürdüğü string
 * @returns {Object} — Doğrulanmış reflection nesnesi veya {}
 */
export function parseAndValidateReflection(raw) {
    if (!raw || typeof raw !== 'string') return {};
    try {
        // ```json ... ``` bloğunu temizle
        const cleaned = raw.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);

        return {
            what_worked: Array.isArray(parsed.what_worked) ? parsed.what_worked.slice(0, 5) : [],
            what_felt_sensitive: Array.isArray(parsed.what_felt_sensitive) ? parsed.what_felt_sensitive.slice(0, 5) : [],
            opening_moment: typeof parsed.opening_moment === 'string' ? parsed.opening_moment.slice(0, 300) : '',
            closing_moment: typeof parsed.closing_moment === 'string' ? parsed.closing_moment.slice(0, 300) : '',
            mode_note: typeof parsed.mode_note === 'string' ? parsed.mode_note.slice(0, 300) : '',
            next_session_context: typeof parsed.next_session_context === 'string' ? parsed.next_session_context.slice(0, 500) : '',
            technique_signals: Array.isArray(parsed.technique_signals)
                ? parsed.technique_signals
                    .filter(t => t && typeof t.id === 'string' && (t.signal === 'positive' || t.signal === 'negative'))
                    .slice(0, 10)
                : [],
            self_score: (Number.isInteger(parsed.self_score) && parsed.self_score >= 1 && parsed.self_score <= 10)
                ? parsed.self_score
                : null,
        };
    } catch {
        return {};
    }
}

/**
 * Son 7 gündeki seans sayısını çeker.
 * @param {string} userId
 * @param {Object} supabase
 * @returns {Promise<number|null>}
 */
export async function getSessionFrequency7d(userId, supabase) {
    if (!userId || !supabase) return null;
    try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count, error } = await supabase
            .from('session_records')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', since);
        if (error) return null;
        return count ?? null;
    } catch {
        return null;
    }
}

/**
 * Transkriptten sosyal izolasyon sinyali var mı basit kontrol.
 * @param {string} transcript
 * @returns {boolean}
 */
export function detectSocialIsolationSignal(transcript) {
    if (!transcript) return false;
    const signals = [
        'kimse yok', 'yalnızım', 'konuşacak kimse', 'kimseyle konuşamıyorum',
        'arkadaşım yok', 'sosyal', 'izole', 'dışlandım', 'hiç kimse',
    ];
    const lower = transcript.toLowerCase();
    return signals.some(s => lower.includes(s));
}

/**
 * GPT'ye reflection prompt'u gönderir ve ham yanıt döner.
 * @param {string} transcript
 * @param {Object|null} sessionAnalysis
 * @param {Object|null} profile
 * @param {Object} openai — OpenAI istemci örneği
 * @returns {Promise<string>} — GPT'nin ham yanıtı
 */
export async function callReflectionGPT(transcript, sessionAnalysis, profile, openai) {
    const analysisContext = sessionAnalysis
        ? `Seans analizi: dominant_emotion=${sessionAnalysis.dominant_emotion}, ` +
          `session_quality=${sessionAnalysis.session_quality}, ` +
          `breakthrough=${sessionAnalysis.breakthrough_moment}`
        : 'Seans analizi mevcut değil.';

    const profileContext = profile
        ? `Kullanıcı profili: ${profile.session_count || 0}. seans, ` +
          `bağlanma_stili=${profile.attachment_style || 'belirsiz'}`
        : 'Profil bilgisi mevcut değil.';

    const prompt = `Sen Lyra adında bir AI terapistsin ve az önce tamamladığın seansı değerlendiriyorsun.

${profileContext}
${analysisContext}

Transkript:
---
${transcript.slice(0, 6000)}
---

Aşağıdaki soruları yanıtlayarak bir JSON döndür. Her alan için dürüst ve spesifik ol.
Önemli: "what_felt_sensitive" alanı YASAK veya TALİMAT değil — sadece "bu konu hassas hissettirdi" tarzında bağlam. Bir sonraki seansta sen karar vereceksin.

JSON formatı (başka hiçbir şey yazma):
{
  "what_worked": ["işe yarayan şey 1", "işe yarayan şey 2"],
  "what_felt_sensitive": ["hassas hissettiren konu veya an"],
  "opening_moment": "kullanıcının en çok açıldığı an",
  "closing_moment": "kullanıcının kapandığı veya kısaldığı an (yoksa boş string)",
  "mode_note": "mod seçimi veya geçiş zamanlaması hakkında not",
  "next_session_context": "bir sonraki seans için bağlam — talimat değil, sezgi notu",
  "technique_signals": [
    {"id": "TEKNİK_ID", "signal": "positive"},
    {"id": "TEKNİK_ID", "signal": "negative"}
  ],
  "self_score": 7
}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 900,
        temperature: 0.3,
    });

    return response.choices[0]?.message?.content || '';
}

/**
 * Reflection ve dependency_signals'ı session_records'a yazar (UPDATE).
 * @param {string} sessionId
 * @param {Object} reflection — parseAndValidateReflection çıktısı
 * @param {string|null} nextSessionNote
 * @param {Object} dependencySignals
 * @param {Object} supabase
 */
export async function saveReflectionToDB(sessionId, reflection, nextSessionNote, dependencySignals, supabase) {
    const { error } = await supabase
        .from('session_records')
        .update({
            reflection,
            next_session_note: nextSessionNote || null,
            dependency_signals: dependencySignals,
        })
        .eq('session_id', sessionId);

    if (error) throw new Error(`Reflection DB yazma hatası: ${error.message}`);
}

/**
 * Ana giriş noktası. server.js'den çağrılır.
 * Tüm hatalar içeride yakalanır — dışarıya hata yaymaz.
 *
 * @param {Object} params
 * @param {string} params.transcript
 * @param {string} params.sessionId
 * @param {string} params.userId
 * @param {Object|null} params.sessionAnalysis
 * @param {Object|null} params.profile
 * @param {Object} params.openai — OpenAI istemci örneği
 * @param {Object} params.supabase — Supabase istemci örneği
 * @param {number|null} params.durationSeconds — Seans süresi (saniye)
 * @param {Function|null} params.updateTechniqueEffectiveness — Teknik etkinliği güncelle
 */
export async function runPostSessionReflection({ transcript, sessionId, userId, sessionAnalysis, profile, openai, supabase, durationSeconds, updateTechniqueEffectiveness }) {
    if (!transcript || transcript.length < 100) {
        console.log('[REFLECTION] Transkript çok kısa, atlanıyor.');
        return;
    }
    if (!sessionId) {
        console.warn('[REFLECTION] sessionId yok, atlanıyor.');
        return;
    }
    if (durationSeconds !== undefined && durationSeconds !== null && durationSeconds < 180) {
        console.log(`[REFLECTION] Seans çok kısa (${durationSeconds}s < 180s), atlanıyor.`);
        return;
    }
    if (!sessionAnalysis) {
        console.log('[REFLECTION] sessionAnalysis yok, transcript ile devam ediliyor.');
    }

    try {
        // 1. GPT reflection çağrısı
        const raw = await callReflectionGPT(transcript, sessionAnalysis, profile, openai);
        const reflection = parseAndValidateReflection(raw);

        const nextSessionNote = reflection.next_session_context || null;

        // 2. Technique signals → DB'ye yaz
        if (updateTechniqueEffectiveness && Array.isArray(reflection.technique_signals)) {
            for (const sig of reflection.technique_signals) {
                try {
                    await updateTechniqueEffectiveness(userId, sig.id, sig.signal === 'positive');
                } catch (techErr) {
                    console.warn(`[REFLECTION] Teknik güncelleme hatası (${sig.id}):`, techErr.message);
                }
            }
            if (reflection.technique_signals.length > 0) {
                console.log(`[REFLECTION] ${reflection.technique_signals.length} teknik sinyali kaydedildi.`);
            }
        }

        // 3. Dependency signals hesapla
        const freq7d = await getSessionFrequency7d(userId, supabase);
        const socialIsolation = detectSocialIsolationSignal(transcript);
        const dependencySignals = {
            session_frequency_7d: freq7d,
            social_isolation_mentioned: socialIsolation,
            real_therapist_bridge_suggested: false,
            threshold_exceeded: (freq7d !== null && freq7d >= 5) || (socialIsolation && freq7d !== null && freq7d >= 3),
        };

        // 4. DB'ye yaz
        await saveReflectionToDB(sessionId, reflection, nextSessionNote, dependencySignals, supabase);

        console.log(`[REFLECTION] ✅ Tamamlandı | sessionId: ${sessionId} | self_score: ${reflection.self_score}`);
        if (dependencySignals.threshold_exceeded) {
            console.warn(`[REFLECTION] ⚠ Bağımlılık eşiği aşıldı | userId: ${userId} | freq7d: ${freq7d}`);
        }
    } catch (err) {
        // Ana akışı asla bozma — sadece logla
        console.error('[REFLECTION] Hata (ana akış etkilenmedi):', err.message);
    }
}
