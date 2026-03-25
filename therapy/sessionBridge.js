// therapy/sessionBridge.js
// Önceki seans özetlerini alır ve mevcut seansa köprü bağlamı oluşturur

/**
 * Son N seansın özetini Supabase'den çeker.
 * @param {string} userId
 * @param {Object} supabase — Supabase istemci örneği
 * @param {number} limit — kaç seans
 * @returns {Promise<Array>}
 */
export async function getRecentSessionSummaries(userId, supabase, limit = 3) {
    if (!userId || !supabase) return [];
    try {
        const { data, error } = await supabase
            .from('session_records')
            .select('session_id, created_at, summary, topics, emotional_end_score, crisis_flag')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error || !data) return [];
        return data;
    } catch {
        return [];
    }
}

/**
 * Önceki seans özetlerinden prompt inject metni oluşturur.
 * @param {string} userId
 * @param {Object} supabase
 * @returns {Promise<string>} — Prompt bölümü veya boş string
 */
export async function buildSessionBridgeContext(userId, supabase) {
    const sessions = await getRecentSessionSummaries(userId, supabase, 3);
    if (!sessions || sessions.length === 0) return '';

    const lines = ['## ÖNCEKİ SEANSLARIN ÖZETİ (Bağlam İçin — Kullanıcıya Söyleme)'];

    for (const s of sessions) {
        const date = s.created_at ? new Date(s.created_at).toLocaleDateString('tr-TR') : '?';
        const parts = [`[${date}]`];

        if (s.summary) parts.push(s.summary);
        if (s.topics?.length) parts.push(`Konular: ${s.topics.join(', ')}`);
        if (s.crisis_flag) parts.push('⚠ Kriz sinyali alınmıştı');
        if (s.emotional_end_score != null) {
            const emoji = s.emotional_end_score >= 6 ? '↑' : s.emotional_end_score <= 3 ? '↓' : '→';
            parts.push(`Duygu: ${emoji}${s.emotional_end_score}/10`);
        }

        lines.push('- ' + parts.join(' | '));
    }

    lines.push('Bu bilgileri, kullanıcı geçmişini aklında tutarak konuşmak için kullan. Seansları dile getirme — sadece bağlam olarak kullan.');
    return lines.join('\n');
}
