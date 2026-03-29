// lib/multilingualEngine.js
// Multilingual Support — Türkçe + İngilizce
// Auto-detect language, çok dilli duygu analizi, bağlam korunması

import { supabase } from './supabase.js';

/**
 * Dil tespit et (Türkçe / İngilizce)
 * @param {string} text
 * @returns {{ language: string, confidence: number }}
 */
export function detectLanguage(text = '') {
  if (!text || text.length < 3) {
    return { language: 'unknown', confidence: 0 };
  }

  // Türkçe karakterler
  const turkishChars = (text.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length;
  const turkishRatio = turkishChars / text.length;

  // Türkçe kelimeler
  const turkishWords = [
    'ben',
    'sen',
    'o',
    'biz',
    'siz',
    'onlar',
    've',
    'var',
    'yok',
    'için',
    'ile',
    'ama',
    'çünkü',
    'mı',
    'mi',
  ];
  const turkishWordCount = turkishWords.filter(w =>
    text.toLowerCase().includes(w),
  ).length;

  // İngilizce kelimeler
  const englishWords = [
    'the',
    'and',
    'is',
    'it',
    'to',
    'of',
    'in',
    'for',
    'that',
    'have',
    'but',
    'or',
  ];
  const englishWordCount = englishWords.filter(w =>
    text.toLowerCase().includes(w),
  ).length;

  let language = 'unknown';
  let confidence = 0;

  if (turkishRatio > 0.05 || turkishWordCount >= 3) {
    language = 'tr';
    confidence = Math.min((turkishRatio * 10 + turkishWordCount * 0.1) / 2, 1);
  } else if (englishWordCount >= 3) {
    language = 'en';
    confidence = Math.min(englishWordCount / 15, 1);
  }

  return { language, confidence: Math.round(confidence * 100) };
}

/**
 * Duygu kelimeleri — Türkçe ↔ İngilizce
 */
const EMOTION_TRANSLATIONS = {
  sadness: {
    tr: ['üzgün', 'depresif', 'mutsuz', 'ağlamak istiyorum'],
    en: ['sad', 'depressed', 'unhappy', 'feeling down'],
  },
  anxiety: {
    tr: ['endişe', 'kaygı', 'korkuyla', 'stresli'],
    en: ['anxious', 'worried', 'scared', 'stressed'],
  },
  anger: {
    tr: ['kızgın', 'öfkeli', 'sinir'],
    en: ['angry', 'furious', 'irritated'],
  },
  hopeful: {
    tr: ['umutlu', 'iyileşiyor', 'daha iyi'],
    en: ['hopeful', 'improving', 'better'],
  },
  lonely: {
    tr: ['yalnız', 'terk', 'abanndonment'],
    en: ['lonely', 'alone', 'abandoned'],
  },
  loved: {
    tr: ['seviliyorum', 'değerliyim', 'kabul'],
    en: ['loved', 'valued', 'accepted'],
  },
};

/**
 * Duygu analizi — dil-bağımsız
 * @param {string} text
 * @param {string} language — 'tr' | 'en'
 * @returns {Object} — detected emotions
 */
export function analyzeEmotionsMultilingual(text, language = 'unknown') {
  if (language === 'unknown') {
    const detected = detectLanguage(text);
    language = detected.language;
  }

  const lowerText = text.toLowerCase();
  const emotions = {};

  for (const [emotion, translations] of Object.entries(EMOTION_TRANSLATIONS)) {
    const words = translations[language] || translations.en; // fallback to English

    const count = words.filter(w => lowerText.includes(w)).length;
    if (count > 0) {
      emotions[emotion] = count;
    }
  }

  // En baskın duygu
  const dominantEmotion = Object.keys(emotions).reduce((a, b) =>
    emotions[a] > emotions[b] ? a : b,
  );

  return {
    dominantEmotion: dominantEmotion || 'neutral',
    detectedEmotions: emotions,
    language,
  };
}

/**
 * Kullanıcının tercih dili ayarla
 * @param {string} userId
 * @param {string} language — 'tr' | 'en'
 */
export async function setUserLanguagePreference(userId, language) {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ preferred_language: language })
      .eq('user_id', userId);

    if (error) {
      console.error('[multilingual] Dil ayarı hatası:', error.message);
    }
  } catch (err) {
    console.error('[multilingual] Hata:', err.message);
  }
}

/**
 * Kullanıcının tercih dilini getir
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function getUserLanguagePreference(userId) {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('preferred_language')
      .eq('user_id', userId)
      .single();

    return data?.preferred_language || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

/**
 * Çok dilli sistem metrikleri
 * Türkçe: daha uzun kelimeler, ekler, agglutinative
 * İngilizce: daha kısa, basit kelimeler
 */
export const LANGUAGE_CONFIGS = {
  tr: {
    name: 'Türkçe',
    tokenEstimate: 3.0, // Türkçe 3 karakter/token
    greeting: 'Hoş geldin',
    affirmation: 'Haklısın',
    validation: 'Duygularını anlıyorum',
  },
  en: {
    name: 'English',
    tokenEstimate: 3.5, // İngilizce 3.5 karakter/token
    greeting: 'Welcome',
    affirmation: "You're right",
    validation: 'I understand your feelings',
  },
};

/**
 * Yanıt dil-sensitive uyarla
 * @param {string} baseResponse
 * @param {string} language
 * @returns {string}
 */
export function adaptResponseToLanguage(baseResponse, language = 'tr') {
  // Basit adaptasyon: İngilizce ise İngilizce tut, Türkçe ise Türkçe tut
  // Daha karmaşık: OpenAI'ye çevir (ama cost'u artırır)

  if (language === 'tr' && baseResponse.includes('understand')) {
    // Response İngilizce, user Türkçe ise çevir
    // TODO: OpenAI translation
    return baseResponse; // şimdilik olduğu gibi gönder
  }

  return baseResponse;
}

/**
 * Çok dilli seans bağlamı
 * @param {string} userId
 * @param {string} userLanguage
 * @returns {string}
 */
export function buildMultilingualContext(userId, userLanguage = 'tr') {
  const config = LANGUAGE_CONFIGS[userLanguage] || LANGUAGE_CONFIGS.tr;

  return `[MULTILINGUAL — ${config.name}]\n` +
    `Kullanıcı dili: ${config.name}\n` +
    `Token tahmini: ${config.tokenEstimate} karakter/token\n` +
    `Yanıtlar ${config.name}'de verilecek.`;
}

/**
 * Dil değiştirme istek tespiti
 * @param {string} userMessage
 * @returns {{ wantsToDchangeLanguage: boolean, targetLanguage: string }}
 */
export function detectLanguageSwitchRequest(userMessage = '') {
  const text = userMessage.toLowerCase();

  const turkishRequest = /türkçe|türkiye|türk|dil değiştir|türkçe ol/i.test(text);
  const englishRequest = /english|ingilizce|dil değiştir|english ol/i.test(text);

  if (turkishRequest && !englishRequest) {
    return { wantsToDchangeLanguage: true, targetLanguage: 'tr' };
  }

  if (englishRequest && !turkishRequest) {
    return { wantsToDchangeLanguage: true, targetLanguage: 'en' };
  }

  return { wantsToDchangeLanguage: false, targetLanguage: 'unknown' };
}
