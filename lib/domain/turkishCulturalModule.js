// lib/turkishCulturalModule.js
// Türkiye Kültürü & Terapist Müdahaleler
// SAMHSA + Kültürel Duyarlılık

const TURKISH_CULTURAL_FACTORS = {
  family_pressure: {
    name: 'Aile Baskısı',
    description: 'Ebeveyn kararları, evlilik baskısı, sosyal baskı',
    intervention: 'Sınırları öğret, kendi seçimleri onay ver',
  },
  shame_culture: {
    name: 'Utanç Kültürü',
    description: 'Sosyal yargı, "ne denir" endişesi',
    intervention: 'Değer ve yargı ayrıştır, güven yarat',
  },
  religious_conflict: {
    name: 'Dini Çatışma',
    description: 'İslami değerler vs modern yaşam, günah hissi',
    intervention: 'Spritüaliteyi saygıyla karşıla',
  },
  gender_roles: {
    name: 'Cinsiyet Rolleri',
    description: 'Erkek/kadın beklentileri, başarı vs evlilik',
    intervention: 'Rollerin seçilmiş olabileceğini göster',
  },
  economic_stress: {
    name: 'Ekonomik Baskı',
    description: 'İşsizlik, borç, kariyer belirsizliği',
    intervention: 'Kontrolü ayırt et, değeri paranın ötesine koy',
  },
};

export function assessCulturalContext(userMessage = '', userId = '') {
  const text = userMessage.toLowerCase();
  const patterns = {
    family_pressure: /aile|ebeveyn|baskı|karar|ne denir/i,
    shame_culture: /utanç|rezil|ayıp|ne denir|sosyal|yargı/i,
    religious_conflict: /din|dua|haram|günah|namaz/i,
    gender_roles: /erkek|kadın|evlilik|başarı/i,
    economic_stress: /iş|para|borç|kira|maaş/i,
  };
  const detected = Object.entries(patterns)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  return {
    culturalFactors: detected,
    primary: detected[0] || null,
  };
}

export function buildTurkishSafetyContext(culturalFactors = []) {
  let context = `[TÜRKIYE KÜLTÜRÜ — Güvenli Terapist Konumu]\n\n`;
  context += `Sana söylemeliyim:\n`;
  context += `✓ Burada söylediklerin gizli\n`;
  context += `✓ Aile/toplum yargısından burada kurtulabilirsin\n`;
  context += `✓ Dinin, değerlerin, ailenin değeri var\n`;
  context += `✓ Sı kişisel seçimlerine saygı duyuyorum\n`;
  context += `✓ "Ne denir" kaygın haklı, ama seni kontrol etmemesin\n\n`;
  context += `Zorluklar:\n`;
  culturalFactors.slice(0, 2).forEach(factor => {
    const info = TURKISH_CULTURAL_FACTORS[factor];
    if (info) context += `  • ${info.name}: ${info.description}\n`;
  });
  return context;
}

export function identifyShamePatterns(userMessage = '') {
  const text = userMessage.toLowerCase();
  const shame = [];
  if (/gizli|kime söylemedim|sakla/.test(text)) shame.push('hiding');
  if (/ne denir|rezil|ayıp|yargı/.test(text)) shame.push('judgment_fear');
  if (/benim hatan|ben sebep|ben suçlu/.test(text)) shame.push('self_blame');
  if (/yalnız|arkadaş yok|sosyal|kimse/.test(text)) shame.push('isolation');
  return {
    hasShame: shame.length > 0,
    shameTypes: shame,
    severityLevel: Math.min(shame.length * 25, 100),
  };
}

export function getLocalResources() {
  return {
    emergency: {
      '177': 'Polis (herhangi bir tehlike)',
      '112': 'Ambulans/Paramedik',
      '155': 'Polis (şiddet/suistimal)',
    },
    mentalhealth: {
      'ADM': 'Aile Danışma Merkezi',
      'RSM': 'Ruh Sağlığı Merkezi (ücretsiz)',
    },
  };
}
