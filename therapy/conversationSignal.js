// therapy/conversationSignal.js
// Konuşma sinyali: her mesajda Lyra'nın o turda ne yapması gerektiğine karar verir.
// Konuşma ritmi: kullanıcının yazım desenini takip eder.

// ─── KONUŞMA RİTMİ ──────────────────────────────────────────────────────────

/**
 * Son mesajlardan kullanıcının yazım ritmini ve duygusal yönelimini çıkarır.
 * @param {Array} messages — tüm seans mesajları
 * @returns {{ writerType, trend, emotionalArc, sessionMomentum }}
 */
export function analyzeConversationRhythm(messages) {
    const userMessages = (messages || [])
        .filter(m => m.role === 'user')
        .map(m => m.content || '');

    if (userMessages.length === 0) {
        return { writerType: 'medium', trend: 'stable', emotionalArc: 'stable', sessionMomentum: 'building' };
    }

    // Yazım tipi — son 5 mesajın ortalama uzunluğu
    const recent = userMessages.slice(-5);
    const avgLength = recent.reduce((sum, m) => sum + m.length, 0) / recent.length;
    const writerType = avgLength < 60 ? 'brief' : avgLength > 200 ? 'verbose' : 'medium';

    // Uzunluk trendi — açılıyor mu kapanıyor mu
    let trend = 'stable';
    if (recent.length >= 3) {
        const half = Math.floor(recent.length / 2);
        const firstHalf = recent.slice(0, half);
        const secondHalf = recent.slice(half);
        const firstAvg = firstHalf.reduce((s, m) => s + m.length, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((s, m) => s + m.length, 0) / secondHalf.length;
        if (secondAvg > firstAvg * 1.3) trend = 'opening_up';
        else if (secondAvg < firstAvg * 0.7) trend = 'closing_down';
    }

    // Duygusal ark — ağır kelimeler artıyor mu azalıyor mu
    const HEAVY_WORDS = ['ağlıyorum', 'dayanamıyorum', 'tükendim', 'yalnızım', 'korku', 'panik', 'üzgün', 'bitik'];
    const half = Math.ceil(userMessages.length / 2);
    const firstMsgs = userMessages.slice(0, half);
    const lastMsgs = userMessages.slice(half);
    const countHeavy = (msgs) => msgs.join(' ').toLowerCase().split(/\s+/)
        .filter(w => HEAVY_WORDS.some(h => w.includes(h))).length;
    const firstHeavy = countHeavy(firstMsgs);
    const lastHeavy = countHeavy(lastMsgs);
    let emotionalArc = 'stable';
    if (lastHeavy > firstHeavy + 1) emotionalArc = 'escalating';
    else if (firstHeavy > lastHeavy + 1) emotionalArc = 'de-escalating';

    // Seans momentumu
    const total = userMessages.length;
    const sessionMomentum = total <= 3 ? 'building' : total >= 12 ? 'winding_down' : 'plateau';

    return { writerType, trend, emotionalArc, sessionMomentum };
}

// ─── SON LYRA AKSİYONU ──────────────────────────────────────────────────────

/**
 * Son asistan mesajından ne yaptığını çıkarır.
 * @param {Array} messages
 * @returns {'asked_question' | 'validated' | 'reflected' | 'other' | null}
 */
export function getLastLyraAction(messages) {
    const lastAssistant = [...(messages || [])]
        .reverse()
        .find(m => m.role === 'assistant');

    if (!lastAssistant?.content) return null;
    // Duygu etiketini temizle — Türkçe karakterler dahil
    const content = lastAssistant.content.replace(/\[DUYGU:[^\]]+\]/gi, '').trim();
    const questionCount = (content.match(/\?/g) || []).length;
    if (questionCount >= 1) return 'asked_question';
    const validateWords = ['hissettirmiş', 'gerçekten ağır', 'çok zor', 'anlıyorum ki', 'buradayım'];
    if (validateWords.some(w => content.toLowerCase().includes(w))) return 'validated';
    return 'other';
}

// ─── KONUŞMA SİNYALİ ────────────────────────────────────────────────────────

/**
 * Bu turda Lyra'nın ne yapması gerektiğine karar verir.
 * @param {Object} params
 * @param {{ primary, secondary, intensity }} params.emotionResult
 * @param {number} params.messageLength — karakter sayısı
 * @param {number} params.messageCount — bu seanstaki kullanıcı mesaj sayısı
 * @param {string|null} params.lastLyraAction — önceki turda ne yaptı
 * @param {string[]} params.dominantTopics — seanstaki konular
 * @param {Object} params.rhythmState — analyzeConversationRhythm() çıktısı
 * @param {string} params.messageContent — son kullanıcı mesajı
 * @returns {string} — sinyal adı
 */
export function decideConversationSignal({
    emotionResult,
    messageLength,
    messageCount,
    lastLyraAction,
    dominantTopics,
    rhythmState,
    messageContent,
}) {
    const { primary, intensity } = emotionResult || {};
    const content = (messageContent || '').toLowerCase();

    // 1. Kriz — PRESENCE
    const crisisWords = ['intihar', 'ölmek istiyorum', 'kendime zarar'];
    if (crisisWords.some(w => content.includes(w))) return 'PRESENCE';

    // 2. Breakthrough — CELEBRATE
    const breakthroughWords = ['fark ettim', 'anladım şimdi', 'değişti bir şey', 'ilk kez böyle'];
    if (breakthroughWords.some(w => content.includes(w))) return 'CELEBRATE';

    // 3. Yüksek yoğunluk + erken tur → VALIDATE (soru sorma)
    if (intensity === 'yüksek' && messageCount <= 4) return 'VALIDATE';

    // 4. Yüksek yoğunluk genel → VALIDATE
    if (intensity === 'yüksek' && (primary === 'üzüntü' || primary === 'tükenmişlik' || primary === 'yalnızlık')) return 'VALIDATE';

    // 5. Utanç veya yalnızlık (orta+) → NORMALIZE
    if ((primary === 'utanç' || primary === 'yalnızlık') && intensity !== 'düşük') return 'NORMALIZE';

    // 6. Tükenmişlik + kısa mesaj → PRESENCE
    if (primary === 'tükenmişlik' && (messageLength || 0) < 50) return 'PRESENCE';

    // 7. Önceki turda soru soruldu → REFLECT (arka arkaya soru yok)
    if (lastLyraAction === 'asked_question') return 'REFLECT';

    // 8. Kapanma trendi → VALIDATE (zorlamadan kabul et)
    if (rhythmState?.trend === 'closing_down') return 'VALIDATE';

    // 9. Tekrarlayan konu + konuşma yerleşmiş → BRIDGE
    if ((dominantTopics || []).length >= 2 && messageCount >= 6) return 'BRIDGE';

    // 10. Açılıyor + konuşma yerleşmiş → EXPLORE_DEEP
    if (rhythmState?.trend === 'opening_up' && messageCount >= 4) return 'EXPLORE_DEEP';

    // 11. İlk seanslar veya karmaşa → EXPLORE_GENTLE
    if (messageCount < 4 || primary === 'karmaşa') return 'EXPLORE_GENTLE';

    // 12. Varsayılan
    return 'EXPLORE_DEEP';
}