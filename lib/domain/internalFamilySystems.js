// lib/internalFamilySystems.js
// Internal Family Systems (IFS) — İç Parçalar Sistemi
// Schwartz modeli, Self liderliği

const PART_ARCHETYPES = {
  firefighter: {
    name: 'Yanıcı (Firefighter)',
    purpose: 'Acıyı çıkar, hemen rahatlamak',
    behaviors: ['Alkol/uyuşturucu', 'Bağımlılıklar', 'Risk'],
    belief: '"Acı kat edemem, şimdi rahatlamalı"',
  },
  manager: {
    name: 'Yönetici (Manager)',
    purpose: 'Problemi kontrol et',
    behaviors: ['Obsesif planlama', 'Mükemmeliyetçilik'],
    belief: '"Hazırlıksız kalırsam çökerim"',
  },
  exile: {
    name: 'Sürgün (Exile)',
    purpose: 'Korkuyu, ağrıyı kaldırıyor',
    behaviors: ['Gizlilik', 'Baskılama', 'Utanç'],
    belief: '"Benim acım çok, gizli tutmalı"',
  },
  vulnerable_child: {
    name: 'Kırılgan Çocuk',
    purpose: 'İhtiyaçlarını ifade ediyor',
    behaviors: ['Bakım ihtiyacı', 'Sevilmek isteme'],
  },
  protector: {
    name: 'Koruyucu (Protector)',
    purpose: 'Yaraları koruyup, gelecekteki acıyı önle',
    behaviors: ['Duygusal mesafe', 'İzolasyon'],
    belief: '"İnsanlar inciten, kendimi uzak tutmalıyım"',
  },
};

export function identifyActiveParts(userMessage = '') {
  const text = userMessage.toLowerCase();
  const patterns = {
    firefighter: /içip|uyuştur|kaçmak|rahatla/i,
    manager: /plan|kontrol|mükemmel|başarı|endişe/i,
    exile: /utanç|gizli|kimse/i,
    vulnerable_child: /yalnız|korunasız|yardım|sevilme/i,
    protector: /uzak|mesafe|güvenme|yalnız/i,
  };
  const detected = Object.entries(patterns)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  return {
    activeParts: detected.slice(0, 3),
    primaryPart: detected[0] || null,
  };
}

export function buildPartDialogueScript(partName = '') {
  const part = PART_ARCHETYPES[partName];
  if (!part) return '';
  let script = `[PARÇA DİYALOGU — ${part.name} ile Konuş]\n\n`;
  script += `1️⃣ TANIŞMA:\n`;
  script += `   "Merhaba ${part.name}, seni görüyorum. Ne yapıyorsun?\n`;
  script += `   ${part.belief}\n\n`;
  script += `2️⃣ MERAK:\n`;
  script += `   "Neden bunu yapıyorsun? Neyi korumaya çalışıyorsun?\n\n`;
  script += `3️⃣ DİNLE:\n`;
  script += `   (Çocuksuğu, korkusu, amacı duy)\n`;
  script += `   "Anladım. Teşekkür ederim.\n\n`;
  script += `4️⃣ ANLAŞMA:\n`;
  script += `   "Başka bir anlaşma yapalım. İkimize yardım edecek şekilde.\n`;
  return script;
}

export function buildIFSContext(partName = '') {
  if (!partName || !PART_ARCHETYPES[partName]) return '';
  const part = PART_ARCHETYPES[partName];
  let context = `[IFS — İÇSEL PARÇALAR]\n\n`;
  context += `Parça: ${part.name}\n`;
  context += `Amacı: ${part.purpose}\n`;
  context += `İnanışı: ${part.belief}\n\n`;
  context += `Davranışlar:\n`;
  part.behaviors.forEach(b => context += `  • ${b}\n`);
  return context;
}

export function buildSelfLeadershipGuide() {
  return `[SELF LİDERLİĞİ]\n\n` +
    `Self = Senin özü, parçaların lideri\n\n` +
    `8C Özellikleri:\n` +
    `🟢 Merakçı (Curious)\n` +
    `🔵 Sakin (Calm)\n` +
    `🟡 Bağlantılı (Connected)\n` +
    `🟣 İtimatlı (Confident)\n` +
    `⚫ Dikkatli (Clear)\n` +
    `🟢 Cesur (Courageous)\n` +
    `🔵 Merhamet (Compassionate)\n` +
    `🟡 Yaratıcı (Creative)\n`;
}
