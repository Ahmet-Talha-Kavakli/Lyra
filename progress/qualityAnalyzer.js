// progress/qualityAnalyzer.js
// Lyra'nın cevap kalitesini otomatik değerlendirir — klişe, uzunluk, soru sayısı

const CLICHE_PHRASES = [
    'bu çok normal', 'kendine iyi bak', 'her şey yoluna girecek',
    'merak etme', 'geçer bu da', 'güçlüsün', 'yapabilirsin bunu',
    'seni anlıyorum', 'haklısın', 'tabii ki', 'elbette',
    'endişelenme', 'üzülme', 'her şey yoluna girer',
];

const REFLECTIVE_PHRASES = [
    'hissettirmiş', 'duyuyorum seni', 'anlıyorum ki', 'demek ki',
    'fark ettim ki', 'söylediğine göre', 'şu an', 'bu an',
];

const MAX_RESPONSE_CHARS = 400;

/**
 * Lyra'nın cevaplarını analiz eder, kalite skoru döner.
 * @param {Array} messages — tüm seans mesajları
 * @returns {{ score: number|null, issues: string[], strengths: string[] }}
 */
export function analyzeResponseQuality(messages) {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) return { score: null, issues: [], strengths: [] };

    const issueMap = {};
    const strengthSet = new Set();
    let penaltyTotal = 0;

    for (const msg of assistantMessages) {
        // Duygu etiketini çıkar
        const content = (msg.content || '').replace(/\[DUYGU:\w+\]/gi, '').trim();
        const lower = content.toLowerCase();

        // Klişe kontrolü
        for (const phrase of CLICHE_PHRASES) {
            if (lower.includes(phrase)) {
                issueMap[`Klişe: "${phrase}"`] = true;
                penaltyTotal += 4;
            }
        }

        // Uzunluk kontrolü
        if (content.length > MAX_RESPONSE_CHARS) {
            const key = `Uzun cevap (${content.length} karakter, max ${MAX_RESPONSE_CHARS})`;
            issueMap[key] = true;
            penaltyTotal += 6;
        }

        // Birden fazla soru
        const qCount = (content.match(/\?/g) || []).length;
        if (qCount > 1) {
            issueMap[`Birden fazla soru (${qCount} adet)`] = true;
            penaltyTotal += 8;
        }

        // "Neden?" kullanımı
        if (/\bneden\b|\bniye\b/i.test(content)) {
            issueMap['"Neden?" yerine "Ne oldu?" / "Nasıl hissettirdi?" kullanılmalı'] = true;
            penaltyTotal += 4;
        }

        // Yansıtıcı dinleme (olumlu)
        if (REFLECTIVE_PHRASES.some(p => lower.includes(p))) {
            strengthSet.add('Yansıtıcı dinleme');
        }

        // Kısa, odaklı cevap (olumlu)
        if (content.length > 10 && content.length <= 200) {
            strengthSet.add('Kısa ve odaklı cevap');
        }

        // Tek soru (olumlu)
        if (qCount === 1) {
            strengthSet.add('Tek soru kullanımı');
        }
    }

    const score = Math.max(0, Math.min(100, 100 - penaltyTotal));
    return {
        score,
        issues: Object.keys(issueMap).slice(0, 5),
        strengths: [...strengthSet],
    };
}
