// lib/cbtCognitiveBehavioral.js
// Bilişsel Davranış Terapisi (CBT) — olumsuz düşünceler → kanıt → yeni düşünce
// Ellis & Beck modeli

const COGNITIVE_DISTORTIONS = {
  catastrophizing: {
    name: 'Felaketleştirme (Catastrophizing)',
    description: 'En kötü senaryoyu varsay',
    examples: ['Bir hata yaptım, işimi kaybedeceğim', 'Ağrım var, kanserim olabilir'],
    challenge: 'Bu en kötü senaryo ne kadar olasılıklı?',
  },
  all_or_nothing: {
    name: 'Siyah-Beyaz Düşünce (All-or-Nothing)',
    description: 'Ortası yok: başarısız veya mükemmel',
    examples: ['Hata yaptım, başarısızım', 'Diyeti bozdum, tüm çabalar boş'],
    challenge: 'Arası var mı?',
  },
  should_statements: {
    name: 'Gerekli İfadeler (Should Statements)',
    description: '"Yapmalıydım" ile kendine kızıyorsun',
    examples: ['Çalışkanlığımla ilgilenmeliyim'],
    challenge: 'Bu "gerekli" ne kadar gerçekçi?',
  },
  emotional_reasoning: {
    name: 'Duygusal Akıl Yürütme',
    description: '"Hissediyorsam, doğru olmalı"',
    examples: ['Endişeli hissediyorum, bir şey kötü olacak'],
    challenge: 'Hisler gerçek mi?',
  },
  overgeneralization: {
    name: 'Aşırı Genelleme',
    description: 'Bir olay = her şey bu şekilde',
    examples: ['Sınavda başarısız oldum, hiç başaramayacağım'],
    challenge: 'Bunun başka açıklaması var mı?',
  },
};

export function detectAutomaticThoughts(userMessage = '') {
  const text = userMessage.toLowerCase();
  const detected = [];
  const patterns = {
    catastrophizing: /olacak|kesin|mutlaka|başarısız|kaybedecek/i,
    all_or_nothing: /hiç|asla|her zaman|hep|tamamen/i,
    should_statements: /yapmalı|etmeli|gerekir|lazım/i,
    emotional_reasoning: /hissediyorum|korkuyorum|endişe/i,
    overgeneralization: /her|her zaman|hiçbir|tüm/i,
  };
  for (const [distortion, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) detected.push(distortion);
  }
  return {
    detectedDistortions: detected.slice(0, 3),
    primaryDistortion: detected[0] || null,
  };
}

export function buildThoughtRecord(situation = '', feeling = '', thought = '') {
  let record = `[ZİHİN KAYIDI]\n\n`;
  record += `1️⃣ DURUM: "${situation}"\n`;
  record += `2️⃣ OTOMATİK DÜŞÜNCE: "${thought}"\n`;
  record += `3️⃣ DUYGULAR: ${feeling}\n\n`;
  record += `4️⃣ KANIT:\n  • Bundan önce böyle mi oldu?\n  • Başka açıklaması var mı?\n\n`;
  record += `5️⃣ YENİ DÜŞÜNCE:\n  • "Bu zor, ama yönetilebilir"\n  • "Başarısız olabilirim, ama değersiz değilim"\n`;
  return record;
}

export function assessCognitiveDistortion(userMessage = '') {
  const detected = detectAutomaticThoughts(userMessage);
  if (!detected.primaryDistortion) {
    return { hasDistortion: false, distortion: null, severity: 'low' };
  }
  const distortion = COGNITIVE_DISTORTIONS[detected.primaryDistortion];
  return {
    hasDistortion: true,
    distortion: detected.primaryDistortion,
    name: distortion.name,
    challenge: distortion.challenge,
    severity: 'moderate',
  };
}

export function buildBehavioralActivationPlan() {
  return `[DAVRANIŞSAL AKTİVASYON]\n\nPazartesi: Yürüyüş (30 dk)\nSalı: Hobi\nÇarşamba: Sosyal\nPerşembe: Ev\nCuma: Kendine\nCumartesi: Keşif\nPazar: Aile\n\nKural: Başla küçükten. Enerji SONRA gelir.`;
}

export function buildCBTContext(technique = '') {
  let context = `[CBT — BİLİŞSEL DAVRANIŞSAL TERAPİ]\n`;
  context += `Olumsuz düşünceler → Kanıt → Yeni düşünceler\n\n`;
  if (technique === 'thought_record') context += buildThoughtRecord();
  else if (technique === 'behavioral_activation') context += buildBehavioralActivationPlan();
  else context += `3 temel: Zihin Kaydı, Davranışsal Aktivasyon, Korkunun Basamakları`;
  return context;
}
