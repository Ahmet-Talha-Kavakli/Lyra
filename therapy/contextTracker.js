// therapy/contextTracker.js
// Seans içi bağlam takibi: isimler, tekrarlayan konular, duygusal ark

const TOPIC_KEYWORDS = {
    'anne/baba': ['annem', 'babam', 'ailem', 'ebeveyn', 'anne', 'baba'],
    'iş': ['işim', 'patronum', 'meslek', 'kariyer', 'işyeri', 'çalışıyorum'],
    'ilişki': ['sevgilim', 'eşim', 'partner', 'ayrılık', 'sevgili', 'flört'],
    'özgüven': ['başaramıyorum', 'yetersiz', 'değersiz', 'güvenemiyorum kendime'],
    'gelecek': ['gelecek', 'hedef', 'plan', 'üniversite', 'karar vermek'],
    'yas/kayıp': ['kaybettim', 'vefat', 'öldü', 'yas', 'özlüyorum'],
    'yalnızlık': ['yalnızım', 'kimsem yok', 'dışlandım', 'arkadaş yok'],
    'travma': ['çocukluğumda', 'geçmişte', 'o zaman', 'travma', 'o günden beri'],
};

function detectEmotionQuick(text) {
    const l = text.toLowerCase();
    if (['üzgün', 'ağlı', 'kırıl', 'hüzün'].some(k => l.includes(k))) return 'üzüntü';
    if (['kaygı', 'endişe', 'korku', 'panik'].some(k => l.includes(k))) return 'kaygı';
    if (['sinirli', 'kızgın', 'öfke'].some(k => l.includes(k))) return 'öfke';
    if (['tükend', 'yorul', 'bitik'].some(k => l.includes(k))) return 'tükenmişlik';
    if (['iyi', 'güzel', 'mutlu', 'sevinç'].some(k => l.includes(k))) return 'umut';
    return 'sakin';
}

/**
 * Son N mesajdan seans bağlamı çıkarır.
 * @param {Array} messages
 * @param {number} maxMessages
 * @returns {string} Sistem promptuna eklenecek bağlam
 */
export function buildSessionContext(messages, maxMessages = 20) {
    if (!messages?.length) return '';

    const recent = messages.slice(-maxMessages);
    const userMessages = recent.filter(m => m.role === 'user').map(m => m.content || '');
    if (userMessages.length === 0) return '';

    const allText = userMessages.join(' ');
    const lower = allText.toLowerCase();

    // Özel isim tespiti (büyük harfle başlayan, 3-12 karakter Türkçe isimler)
    const namePattern = /\b([A-ZÇĞİÖŞÜ][a-zçğışöüa-z]{2,11})\b/g;
    const rawNames = [...allText.matchAll(namePattern)].map(m => m[1]);
    // Yaygın kelimeleri filtrele
    const COMMON_WORDS = ['Ben', 'Sen', 'Biz', 'Siz', 'Onlar', 'Bir', 'Bu', 'Şu', 'Ama', 'Ve', 'Ya', 'Ne', 'Nasıl', 'Neden', 'Çok', 'Daha', 'Her', 'Hiç', 'Zaten', 'Lyra'];
    const uniqueNames = [...new Set(rawNames)].filter(n => !COMMON_WORDS.includes(n)).slice(0, 5);

    // Tekrarlayan konular
    const mentionedTopics = Object.entries(TOPIC_KEYWORDS)
        .filter(([, keys]) => keys.some(k => lower.includes(k)))
        .map(([topic]) => topic);

    // Duygusal ark
    const firstEmotion = detectEmotionQuick(userMessages[0] || '');
    const lastEmotion = detectEmotionQuick(userMessages[userMessages.length - 1] || '');
    const emotionArc = firstEmotion !== lastEmotion
        ? `${firstEmotion} → ${lastEmotion}`
        : firstEmotion;

    const parts = [];
    if (uniqueNames.length > 0) parts.push(`Seansta bahsedilen isimler: ${uniqueNames.join(', ')}`);
    if (mentionedTopics.length > 0) parts.push(`Bu seansta konular: ${mentionedTopics.join(', ')}`);
    if (emotionArc && emotionArc !== 'sakin') parts.push(`Duygusal seyir: ${emotionArc}`);

    if (parts.length === 0) return '';
    return `## SEANS BAĞLAMI (GİZLİ — SESLE AKTARMA, SADECE BAĞLAM İÇİN KULLAN)\n${parts.map(p => `- ${p}`).join('\n')}`;
}
