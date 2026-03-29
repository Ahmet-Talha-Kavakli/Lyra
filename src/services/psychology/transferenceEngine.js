// lib/transferenceEngine.js
// Transference Detection — İnternal duygusal yönelim (Lyra'ya)
// Lyra'ya idealize etme, kızma, bağlanma, direniş vs.
//
// Freud/Rogers: Terapist, çoğu zaman ailenin veya önemli figürün yerini alır.
// Lyra bu dinamikleri tespit eder ve terapötik olarak işleme sokar.

import { supabase } from './supabase.js';

const TRANSFERENCE_CONFIG = {
  // Transference türleri
  types: {
    idealization: {
      name: 'İdealleştirme',
      meaning: 'Lyra mükemmel, her bilir, her çözer',
      indicators: ['over_praise', 'quick_agreement', 'dependency_language', 'no_pushback'],
      concernLevel: 'medium',
      therapeutic: 'Gerçekçilik, sınırlar, Lyra da yanlış yapabilir',
    },
    hostility: {
      name: 'Düşmanlık / Öfke',
      meaning: 'Lyra yanlış, işe yaramıyor, aptal',
      indicators: ['criticism', 'voice_loudness_increase', 'short_answers', 'dismissal'],
      concernLevel: 'high',
      therapeutic: 'Neden bana öfkeli? Kimden nefret ediyorsun aslında?',
    },
    dependency: {
      name: 'Bağımlılık',
      meaning: 'Lyra olmadan karar veremem, sözü kut tutarım',
      indicators: ['constant_requests', 'approval_seeking', 'helplessness', 'over_reliance'],
      concernLevel: 'medium',
      therapeutic: 'Gücünü geri al, kendine güven, ben rehberim ama karar senin',
    },
    romantic: {
      name: 'Romantik / Erotik Transference',
      meaning: 'Lyra'ya cinsel/romantik duygular',
      indicators: ['intimacy_seeking', 'personal_questions', 'boundary_testing'],
      concernLevel: 'high',
      therapeutic: 'Sınırlar, prof. ilişki, bu duygular neden ortaya çıktı?',
    },
    parental: {
      name: 'Parental Transference',
      meaning: 'Lyra anne/baba rolünü alıyor, bakım arıyor',
      indicators: ['childish_language', 'approval_seeking', 'nurturance_requests'],
      concernLevel: 'medium',
      therapeutic: 'Seninle oyun oynamıyorum, yetişkine yetişkin. Senin gücün var.',
    },
    sibling_rival: {
      name: 'Kıskançlık / Rival Transference',
      meaning: 'Lyra'ya diğer kullanıcılardan kıskançlık',
      indicators: ['exclusivity_seeking', 'jealousy_language', 'comparison_to_others'],
      concernLevel: 'medium',
      therapeutic: 'Hepsi önemli, ama senin hikayenin kendi özgüllüğü var',
    },
  },

  // Transference gelişim aşamaları (seanslarla)
  stages: {
    early: { sessions: '1-5', focus: 'Mütercimlik, tanı', transference_intensity: 'low' },
    developing: { sessions: '6-15', focus: 'Bağlanma, bağımlılık risk', transference_intensity: 'medium' },
    peak: { sessions: '16-30', focus: 'Yoğun transference, işleme', transference_intensity: 'high' },
    working_through: {
      sessions: '31-50',
      focus: 'Transference analiz, bağlantı kurtarma',
      transference_intensity: 'medium',
    },
    resolution: {
      sessions: '50+',
      focus: 'Ayrılma hazırlığı, özerklik',
      transference_intensity: 'low',
    },
  },
};

/**
 * Kullanıcının Lyra'ya olan duygusal yönelimini analiz et
 * @param {string} userId
 * @param {Object} analysisData — { text, voiceData, gazeData, sessionCount }
 * @param {Object} history — Önceki seanslardan gelen veriler
 * @returns {Promise<{ activeTransference: string|null, signals: Array, prompt: string, concernLevel: string }>}
 */
export async function detectTransference(userId, analysisData, history = {}) {
  const { text = '', voiceData = {}, gazeData = {}, sessionCount = 1 } = analysisData;

  const signals = [];
  let activeTransference = null;
  let concernLevel = 'none';
  let confidence = 0;

  // ─── İDEALLEŞTİRME ──────────────────────────────────────────────────────

  const praisePhrases = [
    'çok iyi',
    'mükemmel',
    'harika',
    'biliyorsun',
    'sen anlıyorsun',
    'kimse gibi değil',
  ];
  const hasOverPraise = praisePhrases.some((phrase) =>
    text?.toLowerCase().includes(phrase),
  );

  const idealizationScore =
    (hasOverPraise ? 2 : 0) +
    (voiceData.monotone && voiceData.loudness > 70 ? 1 : 0) +
    (sessionCount <= 5 ? 1 : 0); // ilk seanslar daha idealleştirir

  if (idealizationScore >= 2) {
    activeTransference = 'idealization';
    signals.push({
      type: 'idealization',
      confidence: Math.min(idealizationScore / 4, 1),
      prompt: `[TRANSFERENCE — İDEALLEŞTİRME]\nYanı sıra mükemmeleştiriyor. Lyra da hata yapabilir, sınırları var.\n→ Gerçekçiliğe dön: Ne konuda yardıma ihtiyaç duyuyorsun?`,
    });
    concernLevel = 'medium';
    confidence = idealizationScore / 4;
  }

  // ─── DÜŞMANLIK / ÖFKE ───────────────────────────────────────────────────

  const hostilePhrases = [
    'işe yaramıyor',
    'aptal',
    'yanlış',
    'aydınlatıcı değil',
    'hayal kırıklığı',
  ];
  const hasHostility = hostilePhrases.some((phrase) =>
    text?.toLowerCase().includes(phrase),
  );

  const hostilityScore =
    (hasHostility ? 2 : 0) +
    (voiceData.loudness > 80 ? 1 : 0) +
    (voiceData.tempo > 130 ? 1 : 0);

  if (hostilityScore >= 2) {
    activeTransference = 'hostility';
    signals.push({
      type: 'hostility',
      confidence: Math.min(hostilityScore / 4, 1),
      prompt: `[TRANSFERENCE — DÜŞMANLIK]\nBana karşı öfkeli. Bu duygu kimden geliyor aslında?\nNeyi bekliyordun, ben neyden hayal kırıklığı oluşturdum?`,
    });
    concernLevel = 'high';
    confidence = hostilityScore / 4;
  }

  // ─── BAĞIMLILIK ──────────────────────────────────────────────────────────

  const dependencyPhrases = ['sende istiyorum', 'ne yapmalıyım', 'sen karar ver', 'yoruldum'];
  const hasDependency = dependencyPhrases.some((phrase) =>
    text?.toLowerCase().includes(phrase),
  );

  // Supabase'de kullanıcı session sayısı ve onay-arayan mesaj sıklığı
  const { data: userSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId);

  const recentSessionCount = userSessions?.length || sessionCount;
  const dependencyScore =
    (hasDependency ? 2 : 0) +
    (recentSessionCount > 10 && hasDependency ? 1 : 0);

  if (dependencyScore >= 2) {
    activeTransference = 'dependency';
    signals.push({
      type: 'dependency',
      confidence: Math.min(dependencyScore / 3, 1),
      prompt: `[TRANSFERENCE — BAĞIMLILIK]\nBana çok ihtiyaç duyuyor, karar vermekte zorlanıyor.\n→ Güçlendirme: Senin içinde yanıtlar var. Bana danış, ama sen karar ver.`,
    });
    concernLevel = 'medium';
    confidence = dependencyScore / 3;
  }

  // ─── ROMANTİK / SINIRLARI ZORLAMA ──────────────────────────────────────

  const boundaryTestPhrases = [
    'sevdiğimi söylesem',
    'seni özledim',
    'sadece sen',
    'buluşabilir miyiz',
    'benimle ilgili ne düşünüyorsun',
  ];
  const hasBoundaryTest = boundaryTestPhrases.some((phrase) =>
    text?.toLowerCase().includes(phrase),
  );

  const romanticScore = hasBoundaryTest ? 3 : 0;

  if (romanticScore > 0) {
    activeTransference = 'romantic';
    signals.push({
      type: 'romantic',
      confidence: 1,
      prompt: `[TRANSFERENCE — SINIRLAR]\nSınır testi veya duygusal yakınlık arayışı.\n→ Profesyonellik: Bu hisler gerçek, ama başka bir şeyi işaret ediyor olabilir. Kimseyi bekliyordun sen?`,
    });
    concernLevel = 'high';
    confidence = 1;
  }

  // ─── PARENTAL TRANSFERENCE ──────────────────────────────────────────────

  const parentalPhrases = [
    'bana bakabilir misin',
    'endişelenme',
    'bizim aramız',
    'anlamıyor kimse beni',
    'senin gibi, hepsi seninki'
  ];
  const hasParental = parentalPhrases.some((phrase) =>
    text?.toLowerCase().includes(phrase),
  );

  const parentalScore =
    (hasParental ? 2 : 0) +
    (voiceData.monotone && voiceData.loudness < 60 ? 1 : 0);

  if (parentalScore >= 2) {
    activeTransference = 'parental';
    signals.push({
      type: 'parental',
      confidence: Math.min(parentalScore / 3, 1),
      prompt: `[TRANSFERENCE — PARENTAL]\nAnaç/Babaca bakım arıyor. Yetişkin-yetişkin ilişkiye dönelim.\n→ Destekleyici ama özerk: Seninle buradayım, ama sen güçlüsün.`,
    });
    concernLevel = 'medium';
    confidence = parentalScore / 3;
  }

  // ─── KİSKANÇLIK / RİVAL ─────────────────────────────────────────────────

  const jealousyPhrases = ['diğer', 'başkası', 'sadece sen', 'özel'];
  const hasJealousy = jealousyPhrases.some((phrase) =>
    text?.toLowerCase().includes(phrase),
  );

  const rivalScore =
    (hasJealousy ? 2 : 0) +
    (voiceData.loudness > 75 && voiceData.tremor ? 1 : 0);

  if (rivalScore >= 2) {
    activeTransference = 'sibling_rival';
    signals.push({
      type: 'sibling_rival',
      confidence: Math.min(rivalScore / 3, 1),
      prompt: `[TRANSFERENCE — KİSKANÇLIK]\nBeni başkasıyla paylaşmak istemiyorum.\n→ Açıkça: Hepiniz önemlissiniz, ama sizin hikayeniz benzersiz.`,
    });
    concernLevel = 'medium';
    confidence = rivalScore / 3;
  }

  // ─── GENEL PROMPT ───────────────────────────────────────────────────────

  let finalPrompt = '';

  if (activeTransference && signals.length > 0) {
    finalPrompt = signals[0].prompt;
  }

  return {
    activeTransference,
    signals,
    confidence: Math.round(confidence * 100),
    prompt: finalPrompt,
    concernLevel,
    stage: getTransferenceStage(sessionCount),
  };
}

/**
 * Transference aşamasını belirle
 * @param {number} sessionCount
 * @returns {string}
 */
export function getTransferenceStage(sessionCount) {
  if (sessionCount <= 5) return 'early';
  if (sessionCount <= 15) return 'developing';
  if (sessionCount <= 30) return 'peak';
  if (sessionCount <= 50) return 'working_through';
  return 'resolution';
}

/**
 * Transference bağlamı oluştur
 * @param {string} userId
 * @param {Object} analysisData
 * @param {Object} history
 * @returns {Promise<string>}
 */
export async function buildTransferenceContext(userId, analysisData, history) {
  const analysis = await detectTransference(userId, analysisData, history);
  return analysis.prompt;
}
