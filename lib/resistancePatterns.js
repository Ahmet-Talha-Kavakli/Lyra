// lib/resistancePatterns.js
// Resistance Patterns — terapötik kaçış mekanizmaları ve savunma stilleri
// Konudan kaçış, defleksyon, entellektüalizasyon, minimizasyon, mizah savunması vb.
//
// Freud'dan Cramer'e, savunma mekanizmaları kişiliğin yapı taşıdır.
// Lyra bunları tespit eder, isimlendirir, nazikçe karşı durur.

const RESISTANCE_CONFIG = {
  // Tespit edilecek savunma mekanizmaları
  defenses: {
    intellectualization: {
      name: 'Entellektüalizasyon',
      meaning: 'Duygusal içeriği akademik yapıya dönüştürme',
      indicators: ['tempo_increase', 'monotone', 'technical_language', 'gaze_away'],
      counterMove: 'Buradayım, duygular önemli, sözlerinin arkasına dön',
    },
    minimization: {
      name: 'Minimizasyon',
      meaning: '"Önemli değil", "sorun yok", "iyiyim ben"',
      indicators: ['voice_quieter', 'gaze_away', 'shallow_breath', 'monotone'],
      counterMove: 'Sizin için önemli gözüküyor, tekrar seç',
    },
    deflection: {
      name: 'Defleksyon (Sapmacılık)',
      meaning: 'Konudan başka yere sıçrama, başkası hakkında konuşma',
      indicators: ['topic_change', 'voice_tempo_increase', 'gaze_shift'],
      counterMove: 'Seni duydum, ama sen için ne demek bunu konuş',
    },
    humor_defense: {
      name: 'Mizah Savunması',
      meaning: 'Ağır konuyu espriye döndürme, ciddiyeti kırmak',
      indicators: ['laughter_timing', 'tempo_increase', 'voice_change'],
      counterMove: 'Espri dinledim, ama duygular içinde ne var?',
    },
    denial: {
      name: 'İnkar',
      meaning: '"Olmadı", "yalan", "yanılıyorsun"',
      indicators: ['voice_tempo_increase', 'gaze_away', 'voice_loudness_increase'],
      counterMove: 'Anladım inandığını, ancak…',
    },
    dissociation: {
      name: 'Disosiyasyon',
      meaning: 'Bağlantı kopma, "ruh çıkıyor", boş bakış',
      indicators: ['gaze_away', 'monotone', 'breath_shallow', 'voice_quieter'],
      counterMove: 'Seni geri istiyorum, nerede sen?',
    },
    projection: {
      name: 'Projeksiyon',
      meaning: '"O öfkeli", "Siz yargılıyorsunuz" (kendi duygularını dışa atma)',
      indicators: ['other_blame', 'voice_loudness_increase', 'gaze_shift'],
      counterMove: 'O duygular senin içinde, haklı. Buraya bir bak.',
    },
    rumination: {
      name: 'Ruminas (Düşünce Döngüsü)',
      meaning: 'Aynı konuda dönüp durmak, bir yere gitmeyen fikir çemberi',
      indicators: ['repetitive_speech', 'tempo_normal', 'topic_loop'],
      counterMove: 'Döngü görüyorum, bu durumu duygusallaştıralım',
    },
  },

  // Konuşma patternleri
  speechPatterns: {
    hesitation: ['um', 'ee', 'şey', 'yani'],         // Kuşku, kaygı
    repetition: 'aynı cümleyi 2+ kez söylemek',      // Ruminas, endişe
    abstraction: ['şey', 'bir tür', 'hani'],         // Bulanıklaştırma
    acceleration: 'tempo > 120 bpm',                  // Kaçış öfkesi
  },
};

/**
 * Konuşma verilerinden direnç (resistance) patternini tespit et
 * @param {Object} sessionData — { text, voiceData, gazeData, breathData, previousTopics }
 * @returns {{ activeDefense: string|null, signals: Array, prompt: string, recommendation: string }}
 */
export function detectResistancePattern(sessionData) {
  const {
    text = '',
    voiceData = {},
    gazeData = {},
    breathData = {},
    previousTopics = [],
  } = sessionData;

  let activeDefense = null;
  const signals = [];
  let confidence = 0;

  // ─── ENTELLEKTÜALİZASYON ─────────────────────────────────────────────────

  const isAcademic =
    (text?.match(/[Ss]istem|[Ff]oğu|[Hh]angi|[Dd]iğer|[Yy]anı|[Gg]enerally?/g) || [])
      .length > 2;
  const academicScore =
    (isAcademic ? 1 : 0) +
    (voiceData.monotone ? 1 : 0) +
    (voiceData.tempo > 100 ? 1 : 0) +
    (gazeData?.looking_away ? 1 : 0);

  if (academicScore >= 3) {
    activeDefense = 'intellectualization';
    signals.push({
      type: 'intellectualization',
      indicators: ['academic_language', 'monotone_voice', 'fast_speech', 'gaze_away'],
      confidence: academicScore / 4,
      prompt: `[DİRENÇ — ENTELLEKTÜALİZASYON]\nDuygularını sözlere sığdırıyor, akademik dille koruyacak.\nNerede duygusal gerçek? Başında gitmişiz akademi yolunda.`,
    });
    confidence = academicScore / 4;
  }

  // ─── MİNİMİZASYON ───────────────────────────────────────────────────────

  const hasMinimizingLanguage = /\b(sorun yok|iyiyim|önemli değil|normal|basit)\b/i.test(
    text,
  );
  const minimizingScore =
    (hasMinimizingLanguage ? 1 : 0) +
    (voiceData.tempo < 80 ? 1 : 0) +
    (voiceData.loudness < 50 ? 1 : 0) +
    (gazeData?.looking_away ? 1 : 0);

  if (minimizingScore >= 2) {
    activeDefense = 'minimization';
    signals.push({
      type: 'minimization',
      confidence: minimizingScore / 4,
      prompt: `[DİRENÇ — MİNİMİZASYON]\n"Sorun yok" diyor ama sesi, nefesi, bakışı başka söylüyor.\nSenin için önemli görünüyor, tekrar seç.`,
    });
    confidence = Math.max(confidence, minimizingScore / 4);
  }

  // ─── DEFLEKSYON ──────────────────────────────────────────────────────────

  const hasTopicChange =
    previousTopics.length > 0 &&
    !previousTopics.some((topic) => text?.toLowerCase().includes(topic.toLowerCase()));
  const deflectionScore =
    (hasTopicChange ? 1 : 0) +
    (voiceData.tempo > 100 ? 1 : 0) +
    (gazeData?.psychological === 'hayal' ? 1 : 0);

  if (deflectionScore >= 2) {
    activeDefense = 'deflection';
    signals.push({
      type: 'deflection',
      confidence: deflectionScore / 3,
      prompt: `[DİRENÇ — DEFLEKSYON]\nKonuyu değiştirdin. Biraz önce önemli bir yerdeydin, geri döner misin?`,
    });
    confidence = Math.max(confidence, deflectionScore / 3);
  }

  // ─── MİZAH SAVUNMASI ────────────────────────────────────────────────────

  const hasHumor = /[😂🤣😄😆:)]/i.test(text) || /\b(aha|haha|şaka|müzik|komik)\b/i.test(text);
  const humorScore = hasHumor ? 1 : 0 + (voiceData.tempo > 110 ? 1 : 0);

  if (humorScore >= 1 && previousTopics.some((t) => t.includes('ağır'))) {
    activeDefense = 'humor_defense';
    signals.push({
      type: 'humor_defense',
      confidence: humorScore / 2,
      prompt: `[DİRENÇ — MIZAH SAVUNMASI]\nEspriye mi döndürdün? Dinledim gülüşünü, ama duyguların nerede?`,
    });
    confidence = Math.max(confidence, humorScore / 2);
  }

  // ─── İNKAR ──────────────────────────────────────────────────────────────

  const hasDenial = /\b(olmadı|yalan|hayır|değil|yanılıyorsun)\b/i.test(text);
  const denialScore =
    (hasDenial ? 1 : 0) +
    (voiceData.tempo > 120 ? 1 : 0) +
    (voiceData.loudness > 70 ? 1 : 0) +
    (gazeData?.looking_away ? 1 : 0);

  if (denialScore >= 2) {
    activeDefense = 'denial';
    signals.push({
      type: 'denial',
      confidence: denialScore / 4,
      prompt: `[DİRENÇ — İNKAR]\nİnandığını anlıyorum, ama… ne kadar kesin?`,
    });
    confidence = Math.max(confidence, denialScore / 4);
  }

  // ─── DİSOSİYASYON ───────────────────────────────────────────────────────

  const dissocScore =
    (gazeData?.looking_away ? 1 : 0) +
    (voiceData.monotone ? 1 : 0) +
    (breathData.pattern === 'shallow' ? 1 : 0) +
    (voiceData.loudness < 50 ? 1 : 0);

  if (dissocScore >= 3) {
    activeDefense = 'dissociation';
    signals.push({
      type: 'dissociation',
      confidence: dissocScore / 4,
      prompt: `[DİRENÇ — DİSOSİYASYON]\nSeni geri istiyorum. Nerede sen şu an? Burada mısın?`,
    });
    confidence = Math.max(confidence, dissocScore / 4);
  }

  // ─── RUMİNAS ────────────────────────────────────────────────────────────

  const hasSentenceRepeat =
    (text?.match(/\b(\w+)\b.*\b\1\b/g) || []).length > 2;
  const ruminasScore = hasSentenceRepeat ? 1 : 0;

  if (ruminasScore > 0) {
    activeDefense = 'rumination';
    signals.push({
      type: 'rumination',
      confidence: ruminasScore,
      prompt: `[DİRENÇ — RUMINAS]\nAynı dönüşe dönüyor. Bu döngüyü duygusallaştıralım mı?`,
    });
    confidence = Math.max(confidence, ruminasScore);
  }

  // ─── PROJEKSIYON ────────────────────────────────────────────────────────

  const hasBlaming = /\b(o|sen|siz|onlar|kişi)\b.*\b(yargılama|öfke|nefret|suçla)\b/i.test(
    text,
  );
  const projectionScore =
    (hasBlaming ? 1 : 0) +
    (voiceData.tempo > 120 ? 1 : 0) +
    (voiceData.loudness > 75 ? 1 : 0);

  if (projectionScore >= 2) {
    activeDefense = 'projection';
    signals.push({
      type: 'projection',
      confidence: projectionScore / 3,
      prompt: `[DİRENÇ — PROJEKSİYON]\nDuygularını başkasına atıyor. O duygu senin içinde, haklı. Buraya bir bak.`,
    });
    confidence = Math.max(confidence, projectionScore / 3);
  }

  // ─── GENEL PROMPT ───────────────────────────────────────────────────────

  let finalPrompt = '';
  let recommendation = '';

  if (activeDefense) {
    const defense = RESISTANCE_CONFIG.defenses[activeDefense];
    finalPrompt = signals[0]?.prompt || '';
    recommendation = defense.counterMove;
  }

  return {
    activeDefense,
    signals,
    confidence: Math.round(confidence * 100),
    prompt: finalPrompt,
    recommendation,
  };
}

/**
 * Direnç bağlamı oluştur
 * @param {Object} sessionData
 * @returns {string}
 */
export function buildResistanceContext(sessionData) {
  const analysis = detectResistancePattern(sessionData);
  if (!analysis.prompt) return '';

  let context = analysis.prompt;
  if (analysis.recommendation) {
    context += `\n→ Lyra'nın hareketi: ${analysis.recommendation}`;
  }

  return context;
}
