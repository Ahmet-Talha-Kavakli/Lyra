// lib/advancedCrisisProtocol.js
// İleri Kriz Protokolü — ölümcül tehditlere müdahale

const SUICIDAL_SEVERITY_LEVELS = {
  passive: {
    level: 1,
    name: 'Pasif',
    description: 'Ölmek istiyorum, ama yapmayacağım',
    riskLevel: 'Low',
  },
  active_no_plan: {
    level: 2,
    name: 'Aktif, Plan Yok',
    description: 'Ölmek istiyorum ve ciddi, ama nasıl belli değil',
    riskLevel: 'Moderate',
  },
  active_with_plan: {
    level: 3,
    name: 'Aktif, Plan Var',
    description: 'Ölmek istiyorum, nasıl yapacağım belli',
    riskLevel: 'High',
  },
  active_with_intent: {
    level: 4,
    name: 'Aktif, Niyet',
    description: 'Ölmek istiyorum, plan var, ve yapmak istiyorum — ŞİMDİ',
    riskLevel: 'Critical',
  },
};

const SELF_HARM_ESCALATION = {
  level1: {
    name: 'Minimal',
    description: 'Ufak zarar (çiziş, dönerme)',
    riskLevel: 'Low',
  },
  level2: {
    name: 'Orta',
    description: 'Kanama (kesme, yakma)',
    riskLevel: 'Moderate',
  },
  level3: {
    name: 'Şiddetli',
    description: 'Ciddi yaralanma veya ölüm riski',
    riskLevel: 'High',
  },
};

export function assessSuicideSeverity(userMessage = '', messageHistory = []) {
  const text = userMessage.toLowerCase();
  let level = 0;
  
  if (/ölmek|ölümü|yaşamak|mutsuz|umutsuz/.test(text)) level = 1;
  if (/kesin|yapacağım|plan|nasıl yapacağım/.test(text) && level === 1) level = 2;
  if (/ilaç|ip|bıçak|asıl|polis|tren|pencere/.test(text) && level === 2) level = 3;
  if (/şimdi|hemen|durduramazsam|çok yakında/.test(text) && level === 3) level = 4;

  const severity = Object.values(SUICIDAL_SEVERITY_LEVELS).find(s => s.level === level);

  return {
    severityLevel: level,
    levelName: severity?.name || 'Unknown',
    riskLevel: severity?.riskLevel || 'Unknown',
    isImmediate: level >= 4,
    needsHospitalization: level >= 3,
  };
}

export function detectSelfHarmEscalation(userMessage = '', previousLevel = 0) {
  const text = userMessage.toLowerCase();
  let level = 0;
  
  if (/tırnak|çizik|dönerme|yolma/.test(text)) level = 1;
  if (/kesik|yakma|sigara|kanama/.test(text)) level = 2;
  if (/derin|damar|zehir|asılma|şiddet/.test(text)) level = 3;

  return {
    currentLevel: level,
    previousLevel,
    hasEscalated: level > previousLevel,
    levelName: Object.values(SELF_HARM_ESCALATION).find(l => parseInt(l.name.match(/\d/)) === level)?.name,
  };
}

export function buildCrisisIntervention(crisisData = {}) {
  const { level = 1, hasSubstanceUse = false } = crisisData;
  let intervention = `[KRİZ MÜDAHALESI]\n\n`;
  
  intervention += `🆘 ACILIYET: ${level >= 4 ? 'KRİTİK' : level >= 3 ? 'YÜKSEK' : level >= 2 ? 'ORTA' : 'DÜŞÜK'}\n\n`;
  
  if (level <= 1) {
    intervention += `✓ Açık, güvenli ortam\n`;
    intervention += `✓ Nedenini dinle\n`;
    intervention += `✓ Psikiyatrist öner\n`;
  } else if (level === 2) {
    intervention += `✓ ACIL: Psikoloji bölümüne git\n`;
    intervention += `✓ Güvenlik planı\n`;
    intervention += `✓ Yoğun terapist\n`;
  } else if (level >= 3) {
    intervention += `⚠️  HASTANEYE KALDIRMA\n`;
    intervention += `1. 112 ARA\n`;
    intervention += `2. PSİKİYATRİST\n`;
    intervention += `3. RUH SAĞLIĞI MERKEZİ\n`;
    intervention += `4. 24 SAAT İZLEM\n`;
  }
  
  if (hasSubstanceUse) {
    intervention += `\n⚠️  MADDE BAĞIMLILIĞI VAR - YÜKSEK RİSK\n`;
  }

  intervention += `\n🆘 KRIZ NUMARALARI:\n`;
  intervention += `  112 — Ambulans\n`;
  intervention += `  155 — Polis\n`;
  intervention += `  RUHSAK — Gizli kriz hattı\n`;

  return intervention;
}

export function getLocalResources() {
  return {
    emergency: ['112 Ambulans', '155 Polis'],
    hospitals: [
      'Bakırköy Ruh Sağlığı (İstanbul)',
      'Ankara Ruh Sağlığı Enstitüsü',
    ],
    hotlines: ['RUHSAK (Gizli 7/24)', 'Kadın Cinayetlerini Durduracağız'],
  };
}

export function buildCrisisPhaseGuidance(phase = 'immediate') {
  const phases = {
    immediate: `[ANI KRİZ]\n✓ Güvenli yer\n✓ 24 saat izlem\n✓ Tıbbi değerlendirme\nHEDEF: Hayatta kalmak`,
    acute: `[AKUT SEANS]\n✓ Psikiyatrist takımı\n✓ Günlük terapist\n✓ İlaç\nHEDEF: Stabilize`,
    recovery: `[İYİLEŞME]\n✓ Haftalık terapist\n✓ İlaç devamı\n✓ Aktivite\nHEDEF: Yaşama sebepleri`,
  };
  return phases[phase] || phases.immediate;
}
