// therapy/voiceAnalyzer.js
// Ses Analiz Motoru — Vapi'den gelen ses parametrelerini terapötik sinyallere dönüştürür.
//
// Vapi'den gelen veriler (/update-transcript endpoint'i üzerinden):
//   sesYogunlukOrt    — ortalama ses yoğunluğu (0-100)
//   sesTitreme        — ses titremesi tespit edildi mi (bool)
//   sesMonotonluk     — monoton konuşma (bool) — duygusal uyuşma sinyali
//   konusmaTempo      — kelime/dakika
//   tempoTrend        — 'hızlanıyor' | 'yavaşlıyor' | 'stabil'
//   tempoSpike        — ani tempo artışı (bool) — ajitasyon
//   vokalBreak        — ses kırılması (bool) — kırılganlık
//   isWhisper         — fısıldama (bool) — utanç veya derin ifşa
//   silenceDuration   — son sessizlik süresi (saniye)
//   hume_scores       — Hume AI duygu skorları { sadness, fear, anger, joy, ... }
//
// Çıktı: terapötik prompt eki + Lyra yanıt stili önerisi

// ─── SES PARAMETRELERİNİ NORMALİZE ET ────────────────────────────────────────

/**
 * sessionTranscriptStore'dan ses verilerini alır.
 * @param {Object|null} transcriptState — sessionTranscriptStore.get(userId)
 * @returns {Object} — normalize edilmiş ses parametreleri
 */
export function extractVoiceParams(transcriptState) {
    if (!transcriptState) return {};
    return {
        loudness:      transcriptState.sesYogunlukOrt || 0,
        tremor:        !!transcriptState.sesTitreme,
        monotone:      !!transcriptState.sesMonotonluk,
        tempo:         transcriptState.konusmaTempo || 0,
        tempoTrend:    transcriptState.tempoTrend || 'stabil',
        tempoSpike:    !!transcriptState.tempoSpike,
        vokalBreak:    !!transcriptState.vokalBreak,
        isWhisper:     !!transcriptState.isWhisper,
        silence:       transcriptState.silenceDuration || 0,
        hume:          transcriptState.hume_scores || null,
    };
}

// ─── SES-METİN ÇELİŞKİSİ TESPİTİ ────────────────────────────────────────────

/**
 * Kullanıcı sakin görünüyor ama ses onu ele veriyor mu?
 * Örnek: "iyiyim" diyor ama sesi titriyor.
 *
 * @param {Object} voiceParams — extractVoiceParams() çıktısı
 * @param {{ primary, intensity }} emotionResult — metin tabanlı duygu tespiti
 * @returns {string|null} — prompt sinyali veya null
 */
export function detectVoiceTextConflict(voiceParams, emotionResult) {
    if (!voiceParams || Object.keys(voiceParams).length === 0) return null;

    const signals = [];

    // Ses titriyor + metin duygusu düşük → gizli distress
    if (voiceParams.tremor && emotionResult?.intensity === 'düşük') {
        signals.push('ses titremesi var ama mesajı sakin görünüyor — gizli bir gerginlik olabilir');
    }

    // Fısıldama → utanç veya çok özel bir şey ifşa ediyor
    if (voiceParams.isWhisper) {
        signals.push('fısıldıyor — bu an için özel alan aç, alçak sesle, yavaş yanıt ver');
    }

    // Ses kırılması → kırılganlık doruk noktası
    if (voiceParams.vokalBreak) {
        signals.push('sesi kırıldı — tam burada, zorlamadan dur ve fark et');
    }

    // Monoton konuşma + yüksek yoğunluklu metin duygusu → duygusal donma / disosiyasyon
    if (voiceParams.monotone && emotionResult?.intensity === 'yüksek') {
        signals.push('monoton konuşuyor ama metin yoğun duygu taşıyor — duygusal uyuşma olabilir, bunu nazikçe işaret et');
    }

    // Hume skorları varsa — Hume'un tespit ettiği ama metinde görünmeyen duygular
    if (voiceParams.hume) {
        const hume = voiceParams.hume;
        if ((hume.sadness || 0) > 0.6 && emotionResult?.primary !== 'üzüntü') {
            signals.push(`Hume üzüntü skoru yüksek (${Math.round((hume.sadness || 0) * 100)}%) ama bunu sözle ifade etmiyor — duyguyu nazikçe yansıt`);
        }
        if ((hume.fear || 0) > 0.6 && emotionResult?.primary !== 'korku') {
            signals.push(`Hume korku skoru yüksek (${Math.round((hume.fear || 0) * 100)}%) — bu anksiyeyi fark et`);
        }
        if ((hume.anger || 0) > 0.6 && emotionResult?.primary !== 'öfke') {
            signals.push(`Hume öfke skoru yüksek (${Math.round((hume.anger || 0) * 100)}%) — öfkeyi bastırıyor olabilir`);
        }
    }

    if (signals.length === 0) return null;

    return `[SES ANALİZİ — Metin-ses çelişkisi]\n${signals.map(s => `• ${s}`).join('\n')}`;
}

// ─── TEMPO ANALİZİ → YANIT STİLİ ─────────────────────────────────────────────

/**
 * Konuşma temposuna göre Lyra'nın yanıt uzunluğunu ve stilini önerir.
 *
 * @param {Object} voiceParams
 * @returns {string|null}
 */
export function buildTempoGuidance(voiceParams) {
    if (!voiceParams || Object.keys(voiceParams).length === 0) return null;

    const { tempo, tempoTrend, tempoSpike } = voiceParams;

    // Ani ajitasyon — çok hızlı konuşmaya başladı
    if (tempoSpike) {
        return `[TEMPO — AJİTASYON]: Kullanıcı aniden hızlandı. Kısa, sakin, çaplı bir cevap ver. Soru sorma — sadece "buradayım" enerjisi yay.`;
    }

    // Hızlı tempo (>160 kelime/dk) → kısa cevap
    if (tempo > 160) {
        return `[TEMPO — HIZLI]: Kullanıcı hızlı konuşuyor. Kısa cevap ver (1-2 cümle), ritmine ayak uydur. Uzun açıklamalardan kaçın.`;
    }

    // Yavaş tempo (<80 kelime/dk) veya yavaşlama trendi → alan ver
    if (tempo > 0 && tempo < 80) {
        return `[TEMPO — YAVAŞ]: Kullanıcı yavaş ve dikkatli konuşuyor. Sessizliğe yer bırak. Cevabından sonra bekle.`;
    }

    if (tempoTrend === 'yavaşlıyor') {
        return `[TEMPO — YAVAŞLIYOR]: Tempo düşüyor — ağırlaşıyor ya da yoruluyor olabilir. Seans kapanmaya yaklaşıyor, nazikçe toparla.`;
    }

    return null;
}

// ─── SESSIZLIK ANALİZİ ────────────────────────────────────────────────────────

/**
 * Sessizlik süresine göre müdahale tipi döner.
 * L5 kural motoruyla aynı mantık ama ses verisi üzerinden daha kesin.
 *
 * @param {Object} voiceParams
 * @returns {string|null}
 */
export function buildSilenceGuidance(voiceParams) {
    if (!voiceParams) return null;
    const { silence } = voiceParams;
    if (!silence || silence < 8) return null;

    if (silence >= 25) {
        return `[SESSİZLİK — ${silence}s]: Çok uzun sessizlik. "Sessizlik de bir cevap — seninle buradayım, acele etme" de ve bekle. Yeni konu açma.`;
    }
    if (silence >= 12) {
        return `[SESSİZLİK — ${silence}s]: Orta sessizlik. "Hazır olduğunda devam edebiliriz" de.`;
    }
    return null;
}

// ─── ANA ÇIKIŞ: PROMPT EKİ ───────────────────────────────────────────────────

/**
 * Tüm ses analizini tek prompt ekine birleştirir.
 *
 * @param {Object|null} transcriptState — sessionTranscriptStore.get(userId)
 * @param {{ primary, intensity }} emotionResult
 * @returns {string} — prompt eki (boş olabilir)
 */
export function buildVoiceContext(transcriptState, emotionResult) {
    if (!transcriptState) return '';

    const params = extractVoiceParams(transcriptState);
    if (Object.keys(params).length === 0) return '';

    const parts = [
        detectVoiceTextConflict(params, emotionResult),
        buildTempoGuidance(params),
        buildSilenceGuidance(params),
    ].filter(Boolean);

    if (parts.length === 0) return '';

    return '\n\n' + parts.join('\n');
}
