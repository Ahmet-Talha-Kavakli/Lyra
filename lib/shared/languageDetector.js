// lib/languageDetector.js
// Kullanıcının dilini tespit eder ve mesajı Türkçe'ye çevirir.
// Tüm NLP sistemi Türkçe üzerinde çalışmaya devam eder.
// Lyra son cevabı kullanıcının dilinde verir.

import { openai } from './openai.js';

// ─── DESTEKLENEN DİLLER ───────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = {
    tr: { name: 'Türkçe',  nativeName: 'Türkçe',  flag: '🇹🇷' },
    en: { name: 'İngilizce', nativeName: 'English', flag: '🇬🇧' },
    de: { name: 'Almanca',  nativeName: 'Deutsch',  flag: '🇩🇪' },
    ar: { name: 'Arapça',   nativeName: 'العربية',  flag: '🇸🇦' },
};

// ─── HIZLI DİL TESPİTİ (GPT'SİZ) ────────────────────────────────────────────

// Hızlı karakter/kelime bazlı dil tahmini — güvenilir değilse GPT'ye düşer
const QUICK_DETECT_PATTERNS = {
    ar: /[\u0600-\u06FF]/,  // Arapça Unicode bloku
    tr: /[çğıöşüÇĞİÖŞÜ]/,  // Türkçe özgün karakterler
    de: /[äöüßÄÖÜ]/,        // Almanca özgün karakterler
};

const TURKISH_WORDS = ['ve', 'bir', 'bu', 'da', 'de', 'ne', 'ben', 'sen', 'ama', 'için', 'çok', 'iyi', 'gibi', 'var', 'yok', 'nasıl', 'bilmiyorum'];
const ENGLISH_WORDS = ['the', 'and', 'is', 'are', 'was', 'have', 'that', 'this', 'with', 'for', 'not', 'but', 'you', 'i', 'it', 'my', 'me', 'feel'];
const GERMAN_WORDS  = ['ich', 'und', 'die', 'der', 'das', 'ist', 'nicht', 'ein', 'eine', 'mit', 'aber', 'für', 'wie', 'bin', 'du', 'sie', 'hab', 'fühle'];

function quickDetect(text) {
    if (!text || text.length < 3) return null;
    const lower = text.toLowerCase();

    // Arapça karakter varsa kesindir
    if (QUICK_DETECT_PATTERNS.ar.test(text)) return 'ar';

    // Türkçe/Almanca özgün karakterler
    const hasTurkish = QUICK_DETECT_PATTERNS.tr.test(text);
    const hasGerman  = QUICK_DETECT_PATTERNS.de.test(text);
    if (hasTurkish && !hasGerman) return 'tr';
    if (hasGerman  && !hasTurkish) return 'de';

    // Kelime frekansı
    const words = lower.split(/\s+/);
    const trScore = words.filter(w => TURKISH_WORDS.includes(w)).length;
    const enScore = words.filter(w => ENGLISH_WORDS.includes(w)).length;
    const deScore = words.filter(w => GERMAN_WORDS.includes(w)).length;

    const maxScore = Math.max(trScore, enScore, deScore);
    if (maxScore === 0) return null; // belirsiz — GPT'ye bırak

    if (trScore === maxScore) return 'tr';
    if (enScore === maxScore) return 'en';
    if (deScore === maxScore) return 'de';

    return null;
}

// ─── GPT DİL TESPİT + ÇEVİRİ ─────────────────────────────────────────────────

/**
 * Mesajın dilini tespit eder ve gerekirse Türkçe'ye çevirir.
 * Türkçe ise çeviri yapmaz — direkt döner.
 *
 * @param {string} message — son kullanıcı mesajı
 * @returns {Promise<{ lang: string, translatedToTurkish: string, isTranslated: boolean }>}
 */
export async function detectAndTranslate(message) {
    if (!message || message.length < 2) {
        return { lang: 'tr', translatedToTurkish: message, isTranslated: false };
    }

    // Önce hızlı tespit dene
    const quick = quickDetect(message);
    if (quick === 'tr') {
        return { lang: 'tr', translatedToTurkish: message, isTranslated: false };
    }

    // GPT ile kesin tespit + çeviri (tek çağrı)
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: `Aşağıdaki metni analiz et.
1. Dili tespit et. Sadece şu kodlardan birini kullan: tr, en, de, ar
2. Eğer dil "tr" değilse, metni Türkçe'ye çevir. Çeviri doğal ve samimi olsun.
3. Eğer dil "tr" ise, orijinal metni aynen döndür.

Metin: "${message.slice(0, 500)}"

Sadece JSON döndür:
{"lang": "en", "turkish": "çevrilmiş metin buraya"}`,
            }],
            max_tokens: 300,
            temperature: 0,
        });

        const raw = response.choices[0]?.message?.content?.trim() || '';
        const cleaned = raw.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);

        const lang = SUPPORTED_LANGUAGES[parsed.lang] ? parsed.lang : 'tr';
        const translatedToTurkish = parsed.turkish || message;
        const isTranslated = lang !== 'tr';

        return { lang, translatedToTurkish, isTranslated };
    } catch {
        // Hata durumunda Türkçe kabul et
        return { lang: quick || 'tr', translatedToTurkish: message, isTranslated: false };
    }
}

// ─── LYRA CEVABINI KULLANICI DİLİNE ÇEVİR ────────────────────────────────────

/**
 * Lyra'nın Türkçe cevabını kullanıcının diline çevirir.
 * Türkçe ise çeviri yapmaz.
 *
 * @param {string} turkishResponse — Lyra'nın Türkçe cevabı
 * @param {string} targetLang — hedef dil kodu (en, de, ar, tr)
 * @returns {Promise<string>} — hedef dildeki cevap
 */
export async function translateResponse(turkishResponse, targetLang) {
    if (!targetLang || targetLang === 'tr') return turkishResponse;
    if (!turkishResponse) return turkishResponse;

    const langNames = {
        en: 'English',
        de: 'Deutsch',
        ar: 'العربية (Arabic)',
    };
    const targetName = langNames[targetLang] || 'English';

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'system',
                content: `You are a professional translator specializing in therapy and emotional support conversations. Translate naturally and empathetically. Preserve the tone, warmth, and therapeutic intent. Target language: ${targetName}.`,
            }, {
                role: 'user',
                content: turkishResponse,
            }],
            max_tokens: 600,
            temperature: 0.2,
        });

        return response.choices[0]?.message?.content?.trim() || turkishResponse;
    } catch {
        return turkishResponse; // Hata olursa orijinali döndür
    }
}

// ─── SEANS DİLİNİ CACHE'LE ───────────────────────────────────────────────────

// userId → { lang, expiresAt } — TTL: 4 saat
const sessionLanguageCache = new Map();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 saat

// Periyodik temizlik — her 30 dakikada bir expire olanları sil
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of sessionLanguageCache.entries()) {
        if (val.expiresAt && val.expiresAt < now) {
            sessionLanguageCache.delete(key);
        }
    }
}, 30 * 60 * 1000);

/**
 * Kullanıcının dil tercihini cache'e kaydeder.
 * @param {string} userId
 * @param {string} lang
 */
export function cacheUserLanguage(userId, lang) {
    if (userId && lang) {
        sessionLanguageCache.set(userId, { lang, expiresAt: Date.now() + CACHE_TTL_MS });
    }
}

/**
 * Cache'den kullanıcının dilini okur. Expire olmuşsa null döner.
 * @param {string} userId
 * @returns {string|null}
 */
export function getCachedLanguage(userId) {
    const entry = sessionLanguageCache.get(userId);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
        sessionLanguageCache.delete(userId);
        return null;
    }
    return entry.lang;
}

/**
 * Seans bitince cache'i temizle.
 * @param {string} userId
 */
export function clearLanguageCache(userId) {
    sessionLanguageCache.delete(userId);
}
