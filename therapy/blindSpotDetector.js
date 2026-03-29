// therapy/blindSpotDetector.js
// Kör Nokta Dedektörü — Lyra'nın sistematik olarak atladığı konuları ve
// kullanıcının kaçındığı psikolojik alanları tespit eder.
//
// İki ayrı kör nokta türü:
//   A) KONU kör noktası — kullanıcı bir kişi/konu tekrar ediyor ama hiç derinleştirilmedi
//   B) DESEN kör noktası — kullanıcı tutarsız bir bilişsel desen sergiliyor (sürekli dışsallaştırma,
//      hep "iyiyim" deyip kaçınma, vs.)

// ─── A) KONU KÖR NOKTASI ─────────────────────────────────────────────────────

/**
 * Seans geçmişinde tekrarlayan ama hiç derinleştirilmemiş konuları bulur.
 *
 * Mantık:
 *   - Son N seanstaki topics listelerini say
 *   - Aynı konu 3+ seansta geçiyorsa ve breakthrough_moment hiç yoksa → kör nokta
 *
 * @param {Array} recentSessions — session_records [{topics, breakthrough_moment}]
 * @returns {string[]} — kör nokta olarak işaretlenen topic isimleri
 */
export function detectTopicBlindSpots(recentSessions) {
    if (!recentSessions || recentSessions.length < 3) return [];

    // Konu frekansı
    const topicCount = {};
    for (const session of recentSessions) {
        for (const topic of (session.topics || [])) {
            topicCount[topic] = (topicCount[topic] || 0) + 1;
        }
    }

    // Hiçbir seansta breakthrough yoksa bu konular asla derinleştirilmemiş demektir
    const hasBreakthrough = recentSessions.some(s => s.breakthrough_moment);

    return Object.entries(topicCount)
        .filter(([, count]) => count >= 3)
        .filter(([topic]) => {
            // Eğer breakthrough olan seanslarda bu konu varsa → zaten işlendi
            if (!hasBreakthrough) return true;
            const processedInBreakthrough = recentSessions
                .filter(s => s.breakthrough_moment)
                .some(s => (s.topics || []).includes(topic));
            return !processedInBreakthrough;
        })
        .map(([topic]) => topic);
}

// ─── B) DESEN KÖR NOKTASI ────────────────────────────────────────────────────

// Tespit edilecek bilişsel/davranışsal desenler
const PATTERN_DETECTORS = [
    {
        id: 'externalization',
        label: 'Dışsallaştırma',
        description: 'Sorumluluk sürekli başkalarına atfediliyor',
        check(messages) {
            const others = ['o yüzünden', 'onun hatası', 'o yaptı', 'herkes böyle', 'kimse anlamıyor',
                'hep böyle yapıyorlar', 'bana hep böyle davranıyorlar'];
            const selfWords = ['benim hatam', 'ben yaptım', 'benim yüzümden', 'kendim'];
            const userText = messages.filter(m => m.role === 'user').map(m => m.content || '').join(' ').toLowerCase();
            const otherScore = others.filter(w => userText.includes(w)).length;
            const selfScore = selfWords.filter(w => userText.includes(w)).length;
            return otherScore >= 3 && selfScore === 0;
        },
        hint: 'Kullanıcı sorumluluğu sürekli dışsallaştırıyor — kendi rolünü nazikçe ve yargılamadan keşfetmeye davet et.',
    },
    {
        id: 'avoidance_loop',
        label: 'Kaçınma Döngüsü',
        description: 'Belirli konular gündeme gelince hep yön değiştiriyor',
        check(messages) {
            // Kullanıcı mesajları: "neyse", "geçelim", "önemli değil" ardından konu değişimi
            const avoidWords = ['neyse', 'geçelim', 'önemli değil', 'bırak', 'konu değiştireyim', 'başka şey konuşalım'];
            const userMsgs = messages.filter(m => m.role === 'user').map(m => (m.content || '').toLowerCase());
            const avoidCount = userMsgs.filter(msg => avoidWords.some(w => msg.includes(w))).length;
            return avoidCount >= 2;
        },
        hint: 'Kullanıcı belirli noktalarda konuyu kapatıyor — bu geçişlerin altında ne olduğunu merak et, ama zorlamadan.',
    },
    {
        id: 'minimization',
        label: 'Küçümseme',
        description: 'Ağır duyguları sürekli küçümsüyor',
        check(messages) {
            const miniWords = ['çok büyük şey değil', 'abartmıyorum', 'saçma geliyor biliyorum',
                'herkesin başına geliyor', 'benden daha kötüler var', 'şikayet etmemeli'];
            const userText = messages.filter(m => m.role === 'user').map(m => m.content || '').join(' ').toLowerCase();
            return miniWords.filter(w => userText.includes(w)).length >= 2;
        },
        hint: 'Kullanıcı acısını sürekli küçümsüyor — "Benden daha kötüsü var" düşüncesi altında ne yatıyor, bunu yumuşakça yüzleştir.',
    },
    {
        id: 'intellectualization',
        label: 'Entelektüelleştirme',
        description: 'Duyguları analiz ederek uzaklaştırıyor',
        check(messages) {
            const intellWords = ['psikolojik açıdan', 'bilimsel olarak', 'aslında mantıklı',
                'rasyonel bakınca', 'teorik olarak', 'nesnel değerlendirirsem'];
            const userText = messages.filter(m => m.role === 'user').map(m => m.content || '').join(' ').toLowerCase();
            return intellWords.filter(w => userText.includes(w)).length >= 2;
        },
        hint: 'Kullanıcı duygularını analiz ederek mesafe koyuyor — "Bunu anlıyorsun, peki bu seni nasıl hissettiriyor?" diye sor.',
    },
    {
        id: 'catastrophizing',
        label: 'Felaketleştirme',
        description: 'Her şeyi en kötü senaryoya bağlıyor',
        check(messages) {
            const catWords = ['hep böyle olacak', 'hiçbir zaman düzelmez', 'sonunda hep böyle bitiyor',
                'kesinlikle olmayacak', 'mahvoldum', 'artık bitti'];
            const userText = messages.filter(m => m.role === 'user').map(m => m.content || '').join(' ').toLowerCase();
            return catWords.filter(w => userText.includes(w)).length >= 2;
        },
        hint: 'Kullanıcı felaket senaryolarına kilitleniyor — "En kötü senaryo gerçekleşseydi ne olurdu?" yerine "Şimdiye kadar bu korkudan çıktığın oldu mu?" diye sor.',
    },
];

/**
 * Mevcut seans mesajlarından desen kör noktalarını tespit eder.
 * @param {Array} messages — tüm seans mesajları
 * @returns {Array<{id, label, hint}>}
 */
export function detectPatternBlindSpots(messages) {
    if (!messages || messages.length < 6) return [];
    return PATTERN_DETECTORS.filter(d => d.check(messages));
}

// ─── PROMPT INJECT YARDIMCISI ─────────────────────────────────────────────────

/**
 * Kör nokta tespitlerini sistem promptuna eklenecek metin olarak döner.
 * Çok fazla kör nokta aynı anda inject edilmez — en önemlisi seçilir.
 *
 * @param {Array} topicBlindSpots — detectTopicBlindSpots() çıktısı
 * @param {Array} patternBlindSpots — detectPatternBlindSpots() çıktısı
 * @returns {string} — prompt eki (boş olabilir)
 */
export function buildBlindSpotContext(topicBlindSpots, patternBlindSpots) {
    const lines = [];

    // En fazla 2 konu kör noktası
    if (topicBlindSpots.length > 0) {
        const topTopics = topicBlindSpots.slice(0, 2).join(', ');
        lines.push(`Tekrarlayan ama hiç derinleştirilmemiş konular: ${topTopics}. Uygun anda bu alana yavaşça gir.`);
    }

    // En fazla 1 desen kör noktası — en güçlü tespit edileni
    if (patternBlindSpots.length > 0) {
        lines.push(patternBlindSpots[0].hint);
    }

    if (lines.length === 0) return '';

    return `\n\n[KÖR NOKTA RADAR]\n${lines.join('\n')}\nBunları zorla açma — uygun bağlam oluştuğunda nazikçe dokunabilirsin.`;
}
