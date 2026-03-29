// lib/helpers.js — Shared helper functions extracted from server.js
import { supabase } from './supabase.js';

// ─── INPUT SANİTİZASYON ─────────────────────────────────────────────────────
export function sanitizeMessage(content) {
    if (typeof content !== 'string') return '';
    if (content.length > 4000) content = content.substring(0, 4000);
    content = content.replace(/\0/g, ''); // Null byte
    content = content.replace(/[\u202A-\u202E\u2066-\u2069]/g, ''); // Unicode direction override
    return content.trim();
}

export function sanitizeMessages(messages) {
    if (!Array.isArray(messages)) return [];
    if (messages.length > 100) messages = messages.slice(-100);
    return messages.map(m => ({
        role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user',
        content: sanitizeMessage(m.content || '')
    }));
}

// ─── DUYGU TESPİTİ ─────────────────────────────────────────────────────────
export const EMOTION_MAP = {
    üzüntü: {
        phrases: ['çok üzgünüm', 'ağlıyorum', 'kırıldım', 'içim sıkıştı', 'boğuluyorum', 'gözyaşlarım'],
        keywords: ['üzgün', 'üzüldüm', 'ağladım', 'keder', 'mutsuz', 'hüzün', 'acı', 'kırık', 'hayal kırıklığı'],
        weight: 1.0
    },
    kaygı: {
        phrases: ['panik atak', 'nefes alamıyorum', 'her şeyden korkuyorum', 'sürekli endişeleniyorum', 'içim daralıyor'],
        keywords: ['kaygı', 'endişe', 'korku', 'korkuyorum', 'panik', 'tedirgin', 'stres', 'anksiyete', 'gergin'],
        weight: 1.0
    },
    öfke: {
        phrases: ['çok sinirleniyorum', 'dayanamıyorum buna', 'nefret ediyorum', 'çıldıracağım'],
        keywords: ['sinirli', 'kızgın', 'öfkeli', 'kızdım', 'bezdim', 'bıktım', 'nefret', 'rahatsız'],
        weight: 1.0
    },
    utanç: {
        phrases: ['çok utandım', 'yerin dibine geçtim', 'mahcup hissediyorum', 'rezil oldum', 'kendimden iğrendim'],
        keywords: ['utanç', 'utandım', 'mahcup', 'rezil', 'küçüldüm', 'değersiz', 'aşağılandım', 'onursuz'],
        weight: 1.0
    },
    yalnızlık: {
        phrases: ['kimse anlamıyor beni', 'yapayalnızım', 'kimsem yok', 'hiç kimse yok', 'konuşacak kimse yok'],
        keywords: ['yalnız', 'izole', 'dışlanmış', 'görünmez', 'terk', 'kimsesiz', 'yalnızım'],
        weight: 1.0
    },
    tükenmişlik: {
        phrases: ['artık devam edemiyorum', 'her şeyden bıktım', 'enerjim kalmadı', 'içim boş', 'dayanacak gücüm kalmadı'],
        keywords: ['tükendim', 'yoruldum', 'bitik', 'enerjisiz', 'motivasyonsuz', 'hevessiz', 'tükenmiş'],
        weight: 1.0
    },
    umut: {
        phrases: ['daha iyi hissediyorum', 'bir şeyler değişti', 'umut var', 'çıkış yolu gördüm', 'kendimi daha iyi hissediyorum'],
        keywords: ['iyi', 'güzel', 'mutlu', 'sevinçli', 'heyecanlı', 'umutlu', 'rahatladım'],
        weight: 0.8
    },
    karmaşa: {
        phrases: ['ne hissettiğimi bilmiyorum', 'kafam çok karışık', 'anlayamıyorum kendimi', 'ne yapacağımı bilmiyorum'],
        keywords: ['karmaşık', 'karışık', 'belirsiz', 'anlamıyorum', 'boş hissediyorum', 'kafam karışık'],
        weight: 0.9
    },
    // ── YENİ DUYGULAR ──────────────────────────────────────────────────────────
    suçluluk: {
        phrases: ['benim yüzümden oldu', 'hep ben mahvediyorum', 'affedilmek istiyorum', 'keşke yapmasaydım', 'suçlu hissediyorum'],
        keywords: ['suçlu', 'suçluluk', 'pişman', 'pişmanlık', 'affet', 'özür', 'hata yaptım', 'mahvettim', 'vicdanım'],
        weight: 1.0
    },
    hayal_kırıklığı: {
        phrases: ['beklediğim gibi olmadı', 'umduğum çıkmadı', 'boşa gitti', 'hep böyle oluyor'],
        keywords: ['hayal kırıklığı', 'hayal kırıklığına', 'beklemiyordum', 'umursamadı', 'boşuna', 'boşa', 'hüsran', 'hayal'],
        weight: 0.9
    },
    korku: {
        phrases: ['çok korkuyorum', 'dehşete düştüm', 'içim titredi', 'felç oldum korkudan'],
        keywords: ['korku', 'korktum', 'ürktüm', 'dehşet', 'panikledim', 'ürperdi', 'titredim', 'korkudan'],
        weight: 1.0
    },
    çaresizlik: {
        phrases: ['hiçbir şey yapamıyorum', 'elim kolum bağlı', 'çıkış yolu göremiyorum', 'her şey kontrolümden çıktı'],
        keywords: ['çaresiz', 'çaresizlik', 'yapamıyorum', 'beceremiyorum', 'güçsüz', 'aciz', 'elimden gelmiyor'],
        weight: 1.0
    },
};

// Türkçe negasyon ekleri ve kelimeleri
export const NEGATIONS = [
    // Bağımsız negasyon kelimeleri
    'değil', 'yok', 'hayır', 'istemiyorum', 'etmiyorum', 'hissetmiyorum', 'olmaz', 'olmadım',
    // Türkçe fiil olumsuzluk ekleri (kelime sonları)
    'mıyor', 'miyor', 'muyor', 'müyor', 'madım', 'medim', 'mamış', 'memış', 'maz', 'mez',
];

export function hasNegationBefore(words, idx, window = 4) {
    const start = Math.max(0, idx - window);
    for (let i = start; i < idx; i++) {
        const w = words[i];
        // Bağımsız negasyon kelimesi
        if (NEGATIONS.slice(0, 8).some(n => w === n)) return true;
        // Türkçe olumsuz ek içeriyor mu (fiil sonları)
        if (NEGATIONS.slice(8).some(suffix => w.endsWith(suffix))) return true;
    }
    return false;
}

// Aynı kelimede olumsuz ek var mı? ("ağlamadım", "gelmiyorum" gibi)
export function hasNegationInWord(word) {
    const suffixes = ['madım', 'medim', 'mamış', 'memış', 'mıyor', 'miyor', 'muyor', 'müyor', 'maz', 'mez', 'mayacak', 'meyecek'];
    return suffixes.some(s => word.includes(s));
}

// Döndürür: { primary, secondary, intensity }
// primary/secondary: duygu adı (string), intensity: 'düşük'|'orta'|'yüksek'
export function detectEmotion(message) {
    if (!message) return { primary: 'sakin', secondary: null, intensity: 'düşük' };
    const lower = message.toLowerCase();
    const words = lower.split(/\s+/);
    const scores = {};

    for (const [emotion, data] of Object.entries(EMOTION_MAP)) {
        let score = 0;

        // Phrase matching — daha güvenilir, 2.5x ağırlık
        for (const phrase of data.phrases) {
            if (lower.includes(phrase)) score += 2.5 * data.weight;
        }

        // Keyword matching — negasyon kontrolü ile
        for (const keyword of data.keywords) {
            const idx = words.findIndex(w => w.includes(keyword));
            if (idx !== -1) {
                // Kelimenin kendisinde olumsuz ek var mı? ("ağlamadım")
                if (hasNegationInWord(words[idx])) continue;
                // Önceki 4 kelimede negasyon var mı?
                if (hasNegationBefore(words, idx)) continue;
                score += 1.0 * data.weight;
            }
        }

        if (score > 0) scores[emotion] = score;
    }

    if (Object.keys(scores).length === 0) return { primary: 'sakin', secondary: null, intensity: 'düşük' };

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primary = sorted[0][0];
    const secondary = sorted[1]?.[0] || null;
    const topScore = sorted[0][1];
    const intensity = topScore >= 4 ? 'yüksek' : topScore >= 2 ? 'orta' : 'düşük';

    return { primary, secondary, intensity };
}

// ─── KONU TESPİTİ ───────────────────────────────────────────────────────────
export const TOPIC_MAP = {
    aile:       ['anne', 'baba', 'kardeş', 'aile', 'ebeveyn', 'çocuk', 'evlilik', 'boşanma'],
    ilişki:     ['sevgili', 'eş', 'partner', 'ayrılık', 'ilişki', 'kıskançlık', 'aldatma'],
    iş:         ['iş', 'patron', 'meslektaş', 'işten', 'kariyer', 'çalışma', 'görev', 'proje'],
    özgüven:    ['kendime güvenmiyorum', 'yetersiz', 'başaramıyorum', 'beceremiyor', 'özgüven'],
    kayıp:      ['kaybettim', 'vefat', 'ölüm', 'yas', 'ayrılık', 'gitmiş'],
    gelecek:    ['gelecek', 'hedef', 'plan', 'ne olacak', 'üniversite', 'kariyer'],
    geçmiş:     ['çocukluğum', 'geçmiş', 'eskiden', 'o zaman', 'hatıra', 'travma'],
    sağlık:     ['hastalık', 'ağrı', 'doktor', 'tedavi', 'ilaç', 'fiziksel'],
    yalnızlık:  ['yalnız', 'arkadaş yok', 'kimsem', 'sosyal', 'izolasyon'],
};

export function extractTopics(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    return Object.entries(TOPIC_MAP)
        .filter(([, keywords]) => keywords.some(k => lower.includes(k)))
        .map(([topic]) => topic);
}

// ─── ADMİN KORUMA YARDIMCISI ────────────────────────────────
export function requireAdmin(req, res) {
    const secret = req.headers['x-admin-secret'] || req.query.adminSecret;
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
        res.status(403).json({ error: 'Admin yetkisi gerekli' });
        return false;
    }
    return true;
}

// ─── BOLA KORUMA YARDIMCISI ─────────────────────────────────
export function requireOwnership(reqUserId, req, res) {
    if (!reqUserId) {
        res.status(400).json({ error: 'userId zorunlu' });
        return false;
    }
    if (req.userId !== reqUserId) {
        res.status(403).json({ error: 'Bu kaynağa erişim yetkiniz yok' });
        return false;
    }
    return true;
}

// ─── ERROR LOGLAMA ─────────────────────────────────────────
export const logError = async (endpoint, errorMessage, userId = null) => {
    try {
        await supabase.from('error_logs').insert({
            user_id: userId,
            endpoint,
            error_message: errorMessage,
            timestamp: new Date().toISOString()
        });
    } catch { /* loglama başarısız olsa da devam et */ }
};
