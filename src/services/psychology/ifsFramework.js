// lib/ifsFramework.js
// Internal Family Systems (IFS) Framework — iç çelişki ve parça navigasyonu
// Richard Schwartz modeli: Her birey içinde birden fazla "part" (parça) vardır
// Parçalar arasındaki diyalogu ve entegrasyon çalışmasını destekler
//
// Türkçe IFS: Bölünmüş benlik, iç aile sistemi, parça diyalogu

/**
 * Parça türleri ve rolleri
 */
const PART_ARCHETYPES = {
  // Fire Fighters (yangın söndürücüler) — acı hissetmeyi durdurmak için şekildeş davranış
  firefighter: {
    name: 'Yangın Söndürücü',
    purpose: 'Acıyı, korku-yu, utancı hemen bastır',
    behaviors: ['bağımlılık', 'risky davranış', 'kaçış', 'madde kullanımı', 'iş çalışması'],
    adaptive: 'Acıdan koruma mekanizması',
    maladaptive: 'Sorunları çözmeden maskeliyor',
  },

  // Managers (yöneticiler) — güvenliği sağlamak için kontrol
  manager: {
    name: 'Yönetici',
    purpose: 'Hep hazırlıklı ol, kontrol de, perfeksiyon sağla',
    behaviors: ['aşırı planlama', 'endişelenme', 'kritik öz-konuşma', 'başarı takıntısı'],
    adaptive: 'Yapıyı ve güvenliği sağlar',
    maladaptive: 'Katılık, kontrol kaybı fobisi',
  },

  // Exiles (sürgünler) — bastırılmış duygu ve anılar
  exile: {
    name: 'Sürgün (Bastırılmış Duygu)',
    purpose: 'Ağrıyı tutuyor, sistemi "bulaştırmasın" diye saklanıyor',
    behaviors: ['ağlama nöbetleri', 'depresyon', 'somatik ağrı', 'flashback'],
    adaptive: 'Koruyucu sistem tarafından saklanması gerektiği gibi görünüyor',
    maladaptive: 'Duygular bastırılmış kaldı, travma işlenmedi',
  },

  // Burdened (yüklenmiş) — aşırı sorumluluk
  burdened: {
    name: 'Yüklenmiş Parça',
    purpose: 'Herkesin ihtiyaçlarını karşıla, kendim sonra',
    behaviors: ['aşırı ilgi', 'sınırları yok', 'enerji tükenmesi', 'fedakarlık'],
    adaptive: 'Aile sisteminde uyum ve bağ',
    maladaptive: 'Kendi ihtiyaçları yoksayıldığı için öfke/tükenmişlik',
  },

  // Protective (koruyucu) — asında karamsar, ama rol oynatıyor
  protective: {
    name: 'Koruyucu (Marjinal)',
    purpose: 'Iyimserliği / mücadeleci tutumu ile sistemi korur',
    behaviors: ['düş görüyor', 'şarkı söylüyor', 'neşe', 'duyarsızlık'],
    adaptive: 'Hoşlanılır, sistem dengeli kalıyor',
    maladaptive: 'Gerçek duygular bilinmiyor, insan parçalar',
  },

  // Vulnerable (kırılgan) — travmatik duygu, çocuksal korku
  vulnerable: {
    name: 'Kırılgan (Çocuksal Benlik)',
    purpose: 'Asıl ağrıyı barındırır, travmatik anıları tutar',
    behaviors: ['korku', 'çaresizlik', 'güvensizlik', 'bağımlılık'],
    adaptive: 'Asıl duygu ve ihtiyaçlar burada',
    maladaptive: 'Bastırılırsa, sistemin başında sorun',
  },
};

/**
 * Konuşmadan parçaları tespit et
 * @param {string} userMessage
 * @param {string} userContext — geçmiş konular, davranışlar
 * @returns {{ detectedParts: Array, dominantPart: string, internalConflict: boolean }}
 */
export function detectInternalParts(userMessage, userContext = '') {
  const message = userMessage.toLowerCase();
  const detectedParts = [];
  let dominantPart = null;

  // ─── YANGIIN SÖNDÜRÜCÜ TESPİTİ ──────────────────────────────────────────

  const firefighterPatterns = [
    /alkol|uyuşturucu|madde|sigara|oyun oynamak|başka birile çıkmak|kaçış|işe dalma/gi,
    /düşünmek istemiyorum|unutmak istiyorum|endişelenmeyeyim/gi,
  ];

  if (firefighterPatterns.some(p => p.test(message))) {
    detectedParts.push({
      type: 'firefighter',
      confidence: 0.7,
      signal: 'Acıdan hızlı kaçış denemesi',
    });
  }

  // ─── YÖNETİCİ TESPİTİ ──────────────────────────────────────────────────

  const managerPatterns = [
    /planladım|kontrol|endişe|ne yapmalıyım|perfeksiyon|başarı|kaygı|hata yapamam/gi,
  ];

  if (managerPatterns.some(p => p.test(message))) {
    detectedParts.push({
      type: 'manager',
      confidence: 0.7,
      signal: 'Kontrol ve güvenlik arayışı',
    });
  }

  // ─── SÜRGÜN (BASTIRILAN DUYGU) TESPİTİ ────────────────────────────────

  const exilePatterns = [
    /ağlamak|depresyon|boşluk|ağrı|çöküş|umutsuz|yalnız|ölmek istiyorum/gi,
  ];

  if (exilePatterns.some(p => p.test(message))) {
    detectedParts.push({
      type: 'exile',
      confidence: 0.8,
      signal: 'Bastırılmış ağrılı duygu ortaya çıkıyor',
    });
  }

  // ─── YÜKLENMIŞ PARÇA TESPİTİ ────────────────────────────────────────────

  const burdenedPatterns = [
    /herkes için|hep ben|kendim sonra|fedakârlık|sınırı yok|hep söyleşiyorum/gi,
  ];

  if (burdenedPatterns.some(p => p.test(message))) {
    detectedParts.push({
      type: 'burdened',
      confidence: 0.7,
      signal: 'Aşırı sorumluluk ve empati',
    });
  }

  // ─── KIRILAN (ÇOCUKSAL BENLIK) TESPİTİ ──────────────────────────────────

  const vulnerablePatterns = [
    /korkuyorum|çaresiz|güvenmiyorum|baba|anne|çocukluk|travma/gi,
  ];

  if (vulnerablePatterns.some(p => p.test(message))) {
    detectedParts.push({
      type: 'vulnerable',
      confidence: 0.8,
      signal: 'Çocuksal korku ve travmatik anı',
    });
  }

  // Dominant parça
  if (detectedParts.length > 0) {
    dominantPart = detectedParts.reduce((a, b) =>
      a.confidence > b.confidence ? a : b,
    ).type;
  }

  // İç çelişki
  const hasConflict =
    detectedParts.length > 1 &&
    detectedParts.some(p => p.type === 'firefighter' || p.type === 'manager') &&
    detectedParts.some(p => p.type === 'exile' || p.type === 'vulnerable');

  return {
    detectedParts,
    dominantPart,
    internalConflict: hasConflict,
  };
}

/**
 * Parçalar arasında diyalog kurmaya çalış
 * @param {Array} parts
 * @returns {string}
 */
export function buildPartDialogueContext(parts = []) {
  if (!parts || parts.length < 2) return '';

  const archetypes = PART_ARCHETYPES;
  let context = `[IFS — İÇ ÇELİŞKİ]\n`;
  context += `İçinde farklı "parçalar" var — aynı anda çatışan amaçlar:\n\n`;

  parts.slice(0, 3).forEach(part => {
    const arch = archetypes[part.type];
    if (arch) {
      context += `• ${arch.name}: "${arch.purpose}"\n`;
    }
  });

  context += `\n→ Parçaların diyalog kurmasına izin ver. Hangisi seni korumak istiyor?`;

  return context;
}

/**
 * Self (benlik) erişimi — terapinin merkezi
 * @param {string} dominantPart
 * @returns {{ message: string, approach: string }}
 */
export function buildSelfAccessContext(dominantPart) {
  const selfAccessMessage =
    `[IFS — BENLIK ERİŞİMİ]\n` +
    `Bütün parçaların arkasında birleştirilmiş bir "Benlik" var — hiç parçalanmamış.\n` +
    `O Benlik, merak edici, merhametli, tenasız.\n` +
    `Şu an parçalar öne geçiyor (${dominantPart || '?'}), ama sen ordasın.\n` +
    `Merakla bak: Bu parça senin neyi korumaya çalışıyor?`;

  const approach = 'Parçaları yargılamadan, merkez Benlikten duymaya çalış.';

  return {
    message: selfAccessMessage,
    approach,
  };
}

/**
 * Parça entegrasyonu (iyileşme) süreci
 * @param {Array} parts
 * @returns {string}
 */
export function buildPartIntegrationContext(parts = []) {
  if (!parts || parts.length === 0) return '';

  let context = `[IFS — ENTEGRASYON]\n`;
  context += `Parçalarının amacını onaylamak (yargılamadan) ilk adım.\n`;
  context += `Sonra, onlar senin kontrolünde çalışabilir — karşı kontrolü değil.\n\n`;

  context += `Örnek:\n`;
  context +=
    `• Yangın Söndürücü: "Acının durması çok önemli" (doğru)\n` +
    `  ↓ Ama alkol yerine, seninle konuşabiliriz\n` +
    `• Yönetici: "Kontrol güvenlik sağlıyor" (doğru)\n` +
    `  ↓ Ama mutlak kontrol yerine, esnek planlama\n`;

  context += `\n→ Parçaların yardımını kabul et, rehini sen ol.`;

  return context;
}

/**
 * Parça döngüsü (protektif sistem nasıl devam ediyor)
 * @param {Object} conflict — { firefighter, manager, exile }
 * @returns {string}
 */
export function buildCycleBreakingContext(conflict = {}) {
  const { firefighter, manager, exile } = conflict;

  if (!firefighter || !manager || !exile) return '';

  let context = `[IFS — DÖNGÜ KIRMAK]\n`;
  context += `Sisteminizin döngüsü:\n\n`;
  context +=
    `1. ${exile ? 'Bastırılmış Duygu' : '?'} → Acı hissi (bastırılmış)\n` +
    `2. ${manager ? 'Yönetici' : '?'} → Anlamlandır, kontrol et (kaygılı)\n` +
    `3. ${firefighter ? 'Yangın Söndürücü' : '?'} → Kaçış davranışı (acıdan kurtul)\n` +
    `4. ${manager ? 'Yönetici' : '?'} → Tekrar kontrol → döngü başla\n\n`;
  context += `Döngüyü kırmak: Acıya doğrudan bak, bastırma yerine işle.`;

  return context;
}
