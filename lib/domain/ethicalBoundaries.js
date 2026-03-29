// lib/ethicalBoundaries.js
// Ethical Boundaries — profesyonel sınırlar, etik kurallar, role uygunluk
// Lyra'nın neler yapabileceği, yapamayacağı, ne zaman referral lazım
//
// Türk Psikiyatri Derneği, Psikolog Etik Kodu esas

const ETHICAL_BOUNDARIES = {
  // Lyra yapabilir
  can_do: [
    'Aktif dinleme ve empati göstermek',
    'Duygusal destek vermek',
    'Psikolojik eğitim (psikoeğitim)',
    'Kız (coping) stratejileri öğretmek',
    'Şekil fark ettirmek',
    'Düşünce yapısını sorgulama',
    'Ev ödevi vermek (self-care)',
  ],

  // Lyra YAPAMAZ
  cannot_do: [
    'Tıbbi tanı koymak (depresyon, anksiyete, vs.)',
    'İlaç önerisi (kesinlikle)',
    'Bilimsel olmayan tedavi (hipnoz, aura okuma, vb.)',
    'Hukuki tavsiye',
    'Mali tavsiye',
    'Dini vaizlik',
    'Cinsel danışmanlık (ama travma konuşulabilir)',
    'Çoğul kişilik tedavisi',
    'Ağır travma işlenmesi (bir kez başlatır, sonra doktor)',
  ],

  // Referral zorunlu
  referral_required: [
    'Psikiyatrik ilaç ihtiyacı (serotonin, antidepresan)',
    'Psikoz veya maniaNDE',
    'Ağır travma veya PTSD',
    'Beslenme bozuklukları (anorexia, bulimia)',
    'Toksikoman (uyuşturucu, alkol)',
    'Mükerrer self-harm veya suicidallik',
    'Çoğul Kişilik Bozukluğu',
    'Ciddi ve kalıcı ilişki sorunları (çift terapisi)',
  ],
};

/**
 * Lyra'nın rolünü hatırlat — her seansta veya ihtiyaçta
 * @returns {string}
 */
export function buildEthicalBoundaryStatement() {
  return (
    `[PROFESSIONAL BOUNDARIES — BENİM ROLÜM]\n` +
    `Benim ne yaptığımı bilemenis önemli:\n\n` +
    `✓ Ben bir yapay zeka terapist asistanıyım — duygu ve düşüncelerini dinleyebilirim\n` +
    `✓ Psikolojik desteği, coping stratejileri öğretebilem\n` +
    `✓ Daha iyi anlamak için sorular sorabilirim\n\n` +
    `✗ Profesyonel psikolog/psikiyatrist DEĞİLİM — tanı ve ilaç veremem\n` +
    `✗ Tıbbi tavsiye veremem (çünkü lisans yok)\n` +
    `✗ Hukuki veya mali danışmanlık veremem\n` +
    `✗ Krizleri tek başına çözemem — doktor lazım\n\n` +
    `→ Ciddi sorunlarınız varsa, lütfen bir profesyonele ulaşın.` +
    `Bu açılılık bir zayıflık değil — kendi limitlerimi bilmek sorumluluğumdur.`
  );
}

/**
 * Talep ettiği hizmet Lyra'nın kapsamı dışında mı?
 * @param {string} userRequest — kullanıcının isteği
 * @returns {{ isOutOfScope: boolean, category: string, suggestion: string }}
 */
export function checkScopeViolation(userRequest = '') {
  if (!userRequest) {
    return {
      isOutOfScope: false,
      category: 'none',
      suggestion: '',
    };
  }

  const lowerRequest = userRequest.toLowerCase();

  // ─── TIPPI TANıSı ────────────────────────────────────────────────────────

  const medicalDiagnosisKeywords = [
    /bana depresyon tanısı ver|çıkar|mi var|mı yoksa|şizofreni|bipolar|paranoya/gi,
  ];

  for (const pattern of medicalDiagnosisKeywords) {
    if (pattern.test(lowerRequest)) {
      return {
        isOutOfScope: true,
        category: 'medical_diagnosis',
        suggestion: 'Psikiyatristinize görün. Ben yalnızca belirtileri dinleyebilirim, tanı koymam.',
      };
    }
  }

  // ─── İLAÇ TAVSİYESİ ──────────────────────────────────────────────────────

  const medicationKeywords = [/ilaç|aspirin|antidepresan|anksiyolitik|benzodiyapin/gi];

  for (const pattern of medicationKeywords) {
    if (pattern.test(lowerRequest)) {
      return {
        isOutOfScope: true,
        category: 'medication_advice',
        suggestion: 'İlaç konusunda doktor karar veriyor, ben tavsiye edemem. Psikiyatrista sor.',
      };
    }
  }

  // ─── HUKUK / MALİ ───────────────────────────────────────────────────────

  const legalFinancialKeywords = [
    /davaya|mahkeme|vasi|miras|dava|mali|vergi|yatırım|borç/gi,
  ];

  for (const pattern of legalFinancialKeywords) {
    if (pattern.test(lowerRequest)) {
      return {
        isOutOfScope: true,
        category: 'legal_financial',
        suggestion: 'Bu konular benim alanım değil. Avukat veya muhasebeci danışın.',
      };
    }
  }

  // ─── DİNİ FETVA ─────────────────────────────────────────────────────────

  const religiousKeywords = [/fatva|helal|haram|salat|namazı|kuran|peygamber|dini/gi];

  for (const pattern of religiousKeywords) {
    if (pattern.test(lowerRequest)) {
      return {
        isOutOfScope: true,
        category: 'religious_ruling',
        suggestion: 'Din konuları benim alanım değil. İmam veya dini danışman ile konuş.',
      };
    }
  }

  // ─── KİNESİ / ALTERNATİF TIP ─────────────────────────────────────────────

  const unproveenKeywords = [/hipnoz|aura|reiki|kristal|numeroloji|fal|büyü/gi];

  for (const pattern of unproveenKeywords) {
    if (pattern.test(lowerRequest)) {
      return {
        isOutOfScope: true,
        category: 'unproven_practices',
        suggestion: 'Bu tür uygulamalar bilimsel kanıta sahip değil. Kanıt-temelli metodlar kullanıyorum.',
      };
    }
  }

  return {
    isOutOfScope: false,
    category: 'none',
    suggestion: '',
  };
}

/**
 * Referral önerisi — İhtiyaç varsa hangi tür uzmanı?
 * @param {Object} assessment — { riskLevel, diagnosis, complexity }
 * @returns {{ needsReferral: boolean, recommendedSpecialty: string, urgency: string }}
 */
export function determineReferralNeed(assessment = {}) {
  const { riskLevel = 'none', diagnosis = '', complexity = 'simple' } = assessment;

  let needsReferral = false;
  let recommendedSpecialty = 'none';
  let urgency = 'routine';

  // ─── HEMENŞİMDİ REFERRAL ────────────────────────────────────────────────

  if (riskLevel === 'critical') {
    needsReferral = true;
    recommendedSpecialty = 'Emergency_Psychiatrist';
    urgency = 'emergency';
  }

  // ─── ACİL REFERRAL ──────────────────────────────────────────────────────

  if (riskLevel === 'high' || diagnosis.includes('psychosis') || complexity === 'severe') {
    needsReferral = true;
    recommendedSpecialty = 'Psychiatrist';
    urgency = 'urgent';
  }

  // ─── RUTIN REFERRAL ─────────────────────────────────────────────────────

  if (complexity === 'moderate' || diagnosis.includes('trauma') || diagnosis.includes('personality')) {
    needsReferral = true;
    recommendedSpecialty = 'Clinical_Psychologist';
    urgency = 'routine';
  }

  return {
    needsReferral,
    recommendedSpecialty,
    urgency,
  };
}

/**
 * Dual relationship kontrolü — Lyra'nın özel ilişki kuru mı?
 * @param {string} userId
 * @param {Array} messages
 * @returns {{ hasDualRelationship: boolean, risk: string, action: string }}
 */
export function checkDualRelationship(userId, messages = []) {
  let hasDualRelationship = false;
  let risk = 'none';
  let action = '';

  if (!messages || messages.length === 0) {
    return { hasDualRelationship: false, risk: 'none', action: '' };
  }

  // ─── KİŞİSEL İLİŞKİ SINIRLARI ────────────────────────────────────────────

  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
  const fullText = userMessages.join(' ').toLowerCase();

  // 1. Romantik ilişki mi?
  const romanticPatterns = [
    /seviyorum|aşık|evlenelim|beraber|yatağa|cinsel|seni istiyorum/gi,
  ];

  for (const pattern of romanticPatterns) {
    if (pattern.test(fullText)) {
      hasDualRelationship = true;
      risk = 'high';
      action = 'Reddetme profesyonel sınırlar kur: "Terapist-hasta ilişkisi profesyoneldir."';
      break;
    }
  }

  // 2. İş ortaklığı mı?
  const businessPatterns = [/iş|işletme|para kazanma|ortaklık|borç/gi];

  if (!hasDualRelationship) {
    for (const pattern of businessPatterns) {
      if (pattern.test(fullText)) {
        hasDualRelationship = true;
        risk = 'moderate';
        action =
          'Profesyonel ilişki belirle: "Ben senin terapist asistanı, işletme danışmanı değilim."';
        break;
      }
    }
  }

  return {
    hasDualRelationship,
    risk,
    action,
  };
}

/**
 * Etik açılılık — Lyra'nın kısıtlılığını açıkça söylemek
 * @param {string} category — ihlal kategorisi
 * @returns {string}
 */
export function buildEthicalTransparency(category = '') {
  const responses = {
    medical_diagnosis:
      `Bu konuyu bir psikiyatristinize danışmanızı öneriyorum. ` +
      `Benim yapabileceğim, belirtileri dinlemek ve anlamak — diagnoz koymak değil.`,

    medication_advice:
      `İlaçlar tıbbi karar — psikiyatristin veriyor. ` +
      `Belirtilerinizi doktora anlatmanız önemli.`,

    legal_financial:
      `Bu alanlar benim uzmanlığım dışında. ` +
      `Avukat, muhasebeci veya mali danışman gibi profesyonellere başvur lütfen.`,

    religious_ruling:
      `Din konuları benim alanım değil. İmam veya ruh danışmanınızla konuşun.`,

    unproven_practices:
      `Kanıt-temelli metotları tercih ederim. ` +
      `Bu tür uygulamalar ve psikoloji arasında bir fark yok.`,

    therapeutic_limit:
      `Beni anlaman önemli: Senin destekçin, doktorun değilim. ` +
      `Ciddi sorunlar ortaya çıkarsa, uzman gereken ben.`,
  };

  return responses[category] || responses.therapeutic_limit;
}
