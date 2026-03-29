// lib/therapeuticBond.js
// Therapeutic Bond — terapötik uyum (rapport) ve güven derinleştirme
// Lyra'nın kullanıcıyı anladığını hissetirmek, bağlantı kalitesi
//
// Bordin'in Working Alliance modeli: görev uyumu, hedef uyumu, duygusal bağlantı

import { supabase } from './supabase.js';

const BOND_INDICATORS = {
  // Uyumun göstergeleri
  alignment: {
    taskAgreement: 'Konuşma hedefleri paralel mi?',
    goalAlignment: 'Çalışma yönü uyumlu mu?',
    paceSync: 'Tempo ve hız uyumlu mu?',
  },

  // Duygusal bağlantı
  affective: {
    mirroring: 'Lyra kullanıcının ruhsal durumunu yansıtıyor mu?',
    empathy: 'Empati iletişimi var mı?',
    safetyFeeling: 'Güvenli ortam hissi?',
  },

  // Terapötik etkililiği
  efficacy: {
    helpfulness: 'Lyra yardımcı mı?',
    competenceFeling: 'Yetkinlik hissi var mı?',
    hopefulness: 'Umut artıyor mu?',
  },
};

/**
 * Seansa kadar olan etkileşimleri inceleyip bond kalitesini hesapla
 * @param {string} userId
 * @param {Array} recentMessages — son 20 mesaj
 * @returns {{ bondStrength: number, alignment: number, affection: number, efficacy: number, recommendation: string }}
 */
export function assessBondQuality(userId, recentMessages = []) {
  if (!recentMessages || recentMessages.length === 0) {
    return {
      bondStrength: 0,
      alignment: 0,
      affection: 0,
      efficacy: 0,
      recommendation: 'Henüz yeterli veri yok',
    };
  }

  let alignmentScore = 0;
  let affectionScore = 0;
  let efficacyScore = 0;

  // ─── MESAJ ANALİZİ ───────────────────────────────────────────────────────

  const userMessages = recentMessages.filter(m => m.role === 'user').map(m => m.content);
  const assistantMessages = recentMessages.filter(m => m.role === 'assistant').map(m => m.content);

  // ALIGNMENT: Kullanıcı Lyra'yı kendi amaçlarıyla hizalanmış görüyor mu?
  const alignmentIndicators = [
    /sonunda anladı|çünkü sen anlıyorsun|seni anladın|doğru diyorsun/gi,
    /bu işte yardımcı oldu|iyileşti|ilerlettik/gi,
    /seninle konuşunca|kontrol ediyor/gi,
  ];

  userMessages.forEach(msg => {
    alignmentIndicators.forEach(pattern => {
      if (pattern.test(msg)) alignmentScore += 0.5;
    });
  });

  // AFFECTION: Duygusal yakınlık göstergeleri
  const affectionIndicators = [
    /teşekkür|çok iyi|harika|seviyorum|güveniyorum/gi,
    /hiç kimse|sadece sen|anladığın tek/gi,
    /özür dilerim|utandım|korkuyorum, ama/gi, // vulnerable sharing
  ];

  userMessages.forEach(msg => {
    affectionIndicators.forEach(pattern => {
      if (pattern.test(msg)) affectionScore += 0.4;
    });
  });

  // EFFICACY: Terapötik değer hissetme
  const efficacyIndicators = [
    /yardımcı oldu|çözdüm|başardım|umut|daha iyi|kütleşti|anladım/gi,
    /test ettim|denedim|uyguladım/gi,
  ];

  userMessages.forEach(msg => {
    efficacyIndicators.forEach(pattern => {
      if (pattern.test(msg)) efficacyScore += 0.4;
    });
  });

  // Normalizasyon (0-100)
  alignmentScore = Math.min(alignmentScore / recentMessages.length * 100, 100);
  affectionScore = Math.min(affectionScore / recentMessages.length * 100, 100);
  efficacyScore = Math.min(efficacyScore / recentMessages.length * 100, 100);

  const bondStrength = (alignmentScore + affectionScore + efficacyScore) / 3;

  // ─── TAVSIYE ─────────────────────────────────────────────────────────────

  let recommendation = '';

  if (bondStrength >= 70) {
    recommendation = 'Güçlü uyum. Derin çalışmaya geç.';
  } else if (bondStrength >= 50) {
    recommendation = 'Orta uyum. Bağlantıyı derinleştir, daha fazla mirror yap.';
  } else if (bondStrength >= 30) {
    recommendation = 'Zayıf uyum. Empatiye odaklan, güvenli ortamı pekiştir.';
  } else {
    recommendation = 'Çok zayıf. Safety-first, temel ihtiyaçları karşıla.';
  }

  return {
    bondStrength: Math.round(bondStrength),
    alignment: Math.round(alignmentScore),
    affection: Math.round(affectionScore),
    efficacy: Math.round(efficacyScore),
    recommendation,
  };
}

/**
 * Bond kalitesine göre Lyra'nın tutumunu ayarla
 * @param {number} bondStrength — 0-100
 * @returns {{ mode: string, emphasis: string, riskLevel: string }}
 */
export function adaptToBondStrength(bondStrength) {
  if (bondStrength >= 80) {
    return {
      mode: 'deep_work',
      emphasis: 'Challenge, growth, deeper exploration',
      riskLevel: 'can_go_deeper',
    };
  }
  if (bondStrength >= 60) {
    return {
      mode: 'collaborative',
      emphasis: 'Partnership, validation, gradual challenge',
      riskLevel: 'moderate',
    };
  }
  if (bondStrength >= 40) {
    return {
      mode: 'supportive',
      emphasis: 'Safety, understanding, validation',
      riskLevel: 'low',
    };
  }
  return {
    mode: 'stabilization',
    emphasis: 'Safety first, basic trust, no challenge',
    riskLevel: 'very_low',
  };
}

/**
 * Bond güçlendirme stratejileri
 * @param {Object} bondAssessment — assessBondQuality() sonucu
 * @returns {string}
 */
export function buildBondStrengtheningContext(bondAssessment) {
  const { bondStrength, alignment, affection, efficacy, recommendation } = bondAssessment;

  if (bondStrength < 30) {
    return (
      `[BOND — FOUNDATION]\n` +
      `Henüz temel güven kuruluyor. Ön plan: Güven, anlaşılmak, güvenli ortam.\n` +
      `→ Stratejiler: Aktif dinle, validate, açık soru sorma (directive değil).\n` +
      `→ Kaçın: Challenge, joking, rushing.`
    );
  }

  const strengthAreas = [];
  if (alignment >= 70) strengthAreas.push('✓ Hedef uyumu güçlü');
  if (affection >= 70) strengthAreas.push('✓ Duygusal bağlantı güçlü');
  if (efficacy >= 70) strengthAreas.push('✓ Terapötik etkinlik hissi güçlü');

  const weakAreas = [];
  if (alignment < 50) weakAreas.push('→ Hedef uyumu artır');
  if (affection < 50) weakAreas.push('→ Duygusal açılımı teşvik et');
  if (efficacy < 50) weakAreas.push('→ Konkret başarılar göster');

  let context = `[BOND — ASSESSMENT]\n`;
  context += `Bond Gücü: ${bondStrength}/100\n`;

  if (strengthAreas.length > 0) {
    context += `\nGüçlü Noktalar:\n${strengthAreas.join('\n')}\n`;
  }

  if (weakAreas.length > 0) {
    context += `\nOdaklanılması Gereken:\n${weakAreas.join('\n')}\n`;
  }

  context += `\n→ ${recommendation}`;

  return context;
}

/**
 * Rapor (mirroring) teknikleri ile empati yoğunluğu
 * @param {string} userEmotionalState — "sad", "anxious", "hopeful", vb.
 * @param {string} userMessage
 * @returns {string}
 */
export function buildMirroringContext(userEmotionalState, userMessage) {
  const mirrors = {
    sad: `Bunu söylerken üzüntüyü duydum. Bu duygu ne kadar süredir içinde?`,
    anxious: `Endişe var sesinde. Korkan ne senin içinde?`,
    angry: `Öfke hissettim. Neye karşı kızgın?`,
    hopeful: `Biraz umut duymaya başlamışsın. Bu iyi bir haber.`,
    ashamed: `Utanç hissettim sözlerinden. Bunu paylaştığın için cesur oldum.`,
    alone: `Yalnız hissettiğini duydun. Ama burada birlikteiz şu an.`,
  };

  if (mirrors[userEmotionalState]) {
    return `[MIRRORING]\n${mirrors[userEmotionalState]}`;
  }

  return '';
}

/**
 * Bond derinleştirme: Akışkan ve tutarlı seans geçişi
 * @param {Object} lastSessionSummary
 * @param {string} currentUserMessage
 * @returns {string}
 */
export function buildBondContinuityContext(lastSessionSummary = {}, currentUserMessage = '') {
  if (!lastSessionSummary || Object.keys(lastSessionSummary).length === 0) {
    return '';
  }

  const { closingMoment, emotionalThread, nextStep } = lastSessionSummary;

  let context = '';

  if (emotionalThread) {
    context += `[BOND — THREAD]\nGeçen sefer "${emotionalThread}" ana konu başında durmuştuk. Bugün bunu sürdürelim.\n`;
  }

  if (nextStep) {
    context += `[BOND — CONTINUITY]\nSonra bunu çalışmak için kalmıştık: "${nextStep}". Hala önemli mi?\n`;
  }

  if (closingMoment && closingMoment.type === 'breakthrough') {
    context += `[BOND — MOMENTUM]\nGeçen sefer önemli bir keşif yaptın. Bugün bunu daha derinleştir.\n`;
  }

  return context;
}
