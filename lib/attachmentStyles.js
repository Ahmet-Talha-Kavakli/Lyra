// lib/attachmentStyles.js
// Attachment Styles — Bowlby & Ainsworth modeli
// Güvenli/Kaygılı/Kaçıngan/Korkulu bağlanma tipleri
// İlişkilerdeki davranış patternleri ve iyileştirme

/**
 * Bağlanma Tipleri
 */
const ATTACHMENT_TYPES = {
  secure: {
    name: 'Güvenli Bağlanma',
    description: 'İlişkide rahat, ihtiyaç göstermekte açık, uzaklaşmadan korkmaz',
    indicators: [
      'Duygularını açıkça söyleyebilir',
      'Yalnızlığa tolerans var',
      'Eşine güvenir',
      'Çatışmayı açık şekilde ele alır',
      'Bağlılık ve özerklik arasında denge',
    ],
    behaviors: [
      'Gerektiğinde destek isteme',
      'Sınırları açık koyma',
      'Açık iletişim',
      'Empati gösterme',
    ],
  },

  anxious: {
    name: 'Kaygılı/Dörtlü Bağlanma',
    description: 'Abanndonment korkusu, aşırı ihtiyaç gösterme, kontrol isteme',
    indicators: [
      'Sürekli onay arama',
      'Ayrılık = çöküş',
      'Eşinin yapıp yapmadığını kontrol etme',
      '"Beni yeterince sevmiyor mu?" kaygısı',
      'Çatışma sonrası aşırı stres',
    ],
    behaviors: [
      'Mesaj yağmurlaması',
      'Arayan ol / ara',
      'Celalı olma / sessiz kalma',
      'Eşinin hareketlerini izleme',
    ],
    roots: [
      'Çocuklukta ebeveynden inconsistent ilgi',
      'Bazen sevilmiş, bazen yoksayılmış',
      'Unpredictable care (anne bazen var bazen yok)',
    ],
  },

  avoidant: {
    name: 'Kaçıngan Bağlanma',
    description: 'İntimacy korkusu, bağımsızlık öne çıkma, duygularını gizleme',
    indicators: [
      'Duygularını ifade etmekte zorluk',
      'Yakınlık uncomfortable hissi',
      '"Yalnız olmak daha iyi" inancı',
      'Sorunları "geçecek" diye görmezden gelme',
      'Eşine duygusal destek verme konusunda çekingenlik',
    ],
    behaviors: [
      'İlişkide geri çekilme',
      'Duygularını bastırma',
      'İş / hobby'ye aşırı odaklanma',
      'Üst perdede kalmaya çalışma',
    ],
    roots: [
      'Çocuklukta ebeveyn duygularını görmezden gelmiş',
      '"Ağlama", "Erkekler duygusallaşmaz"',
      'Bağımsızlığa aşırı vurgu',
    ],
  },

  fearful: {
    name: 'Korkulu/Dalgalanmalı Bağlanma',
    description: 'Hem yakınlık hem ayrılık korkusu, çelişkili davranışlar',
    indicators: [
      'Yaklaş / uzaklaş döngüsü',
      'Eşine ihtiyaç duymaktan nefret ama yalnız kalamaz',
      'Yüksek çatışma, aşırı reaksiyonlar',
      'Güvensizlik + utanç',
      'Travmatik geçmiş sinyalleri',
    ],
    behaviors: [
      'Sudden outbursts (aniden öfke)',
      'Romantik idealizasyon ardından hızlı hayal kırıklığı',
      'Eşine bağlanma ardından sudden withdrawal',
      'Karışık sinyaller gönderme',
    ],
    roots: [
      'Çocuklukta ebeveynin unpredictable davranışı',
      'Bakım alan kişi aynı zamanda tehdit kaynağı',
      'Travma / abuse geçmişi',
    ],
  },
};

/**
 * Attachment stilini tespit et — konuşmadan
 * @param {string} userMessage
 * @param {Array} relationshipMessages — ilişki hakkında konuştukları
 * @returns {{ likelyStyle: string, confidence: number, indicators: Array }}
 */
export function assessAttachmentStyle(userMessage, relationshipMessages = []) {
  const text = (userMessage + ' ' + relationshipMessages.join(' ')).toLowerCase();

  const scores = {
    secure: 0,
    anxious: 0,
    avoidant: 0,
    fearful: 0,
  };

  // ─── KAYGILI BAĞLANMA SİNYALLERİ ─────────────────────────────────────

  const anxiousPatterns = [
    /abanndonment|terk|ayrılık|beni terk|yalnız|mesaj|neden cevap|ne zaman|beni seviyor mu/gi,
    /kontrol|neredesin|kime|görmek istiyorum|her zaman|hep|durum|takip|celalı|sessiz/gi,
  ];

  anxiousPatterns.forEach(p => {
    if (p.test(text)) scores.anxious += 2;
  });

  // ─── KAÇINGAN BAĞLANMA SİNYALLERİ ─────────────────────────────────────

  const avoidantPatterns = [
    /duygular|söylemek istemiyorum|özel değil|yalnız daha iyi|bağımsız|iş|hobby/gi,
    /uzaklaş|sorun|geçecek|önemli değil|sakin|kontrol|profes|kariyer/gi,
  ];

  avoidantPatterns.forEach(p => {
    if (p.test(text)) scores.avoidant += 2;
  });

  // ─── KORKULU BAĞLANMA SİNYALLERİ ─────────────────────────────────────

  const fearfulPatterns = [
    /biraz yaklaş biraz uzaklaş|çelişkili|kızıyorum|ağlıyorum|hızlı değişme|solucan kuta/gi,
    /travma|korku|şok|güvenilmez|tahmin|sudden|aniden|alarm/gi,
  ];

  fearfulPatterns.forEach(p => {
    if (p.test(text)) scores.fearful += 2;
  });

  // ─── GÜVENLI BAĞLANMA SİNYALLERİ ────────────────────────────────────

  const securePatterns = [
    /açık|söyle|anla|eşim|ortaklaşa|denge|güven|iletişim|çatışma|sağlık/gi,
  ];

  securePatterns.forEach(p => {
    if (p.test(text)) scores.secure += 2;
  });

  // En yüksek skor
  const maxScore = Math.max(...Object.values(scores));
  const likelyStyle = Object.keys(scores).find(k => scores[k] === maxScore) || 'unknown';
  const confidence = maxScore > 0 ? Math.min(maxScore / 10, 1) : 0;

  return {
    likelyStyle,
    confidence: Math.round(confidence * 100),
    scores,
  };
}

/**
 * Bağlanma stili bağlamı — terapötik insight
 * @param {string} style — secure | anxious | avoidant | fearful
 * @returns {string}
 */
export function buildAttachmentContext(style = '') {
  const info = ATTACHMENT_TYPES[style];

  if (!info) return '';

  let context = `[BAĞLANMA STİLİ — ${info.name.toUpperCase()}]\n`;
  context += `${info.description}\n\n`;

  // İndikatorlar
  context += `Bu stilin belirtileri:\n`;
  info.indicators.slice(0, 3).forEach(ind => {
    context += `• ${ind}\n`;
  });

  // Kökler (eğer varsa)
  if (info.roots && info.roots.length > 0) {
    context += `\nBu çoğunlukla:\n`;
    info.roots.forEach(root => {
      context += `• ${root}\n`;
    });
  }

  // Davranışlar (eğer varsa)
  if (info.behaviors && info.behaviors.length > 0) {
    context += `\nEtkileri (ilişkide nasıl görünür):\n`;
    info.behaviors.forEach(b => {
      context += `• ${b}\n`;
    });
  }

  context += `\n→ Bunu anlaman, ilişkideki patternleri çözmek için ilk adım.`;

  return context;
}

/**
 * Bağlanma stili iyileştirme stratejileri
 * @param {string} style
 * @returns {string}
 */
export function buildAttachmentHealingStrategy(style = '') {
  const strategies = {
    secure: `Güvenli bağlanman var — bu sağlıklı ilişkilerin temeli. Bunu korumayı devam et.`,

    anxious: `Kaygılı bağlanma iyileştirmek:\n• Nefes: Abanndonment korkusu geldiğinde grounding yap\n• Affirmation: "Ben yeterli değil mi?" yerine "Eşim bana değer veriyor"\n• Bağımsızlık: Kendi hobiler, arkadaşlar, hayat\n• Konuşma: Eşine "Abandonment korkusu hissediyorum" de — saklamama\n→ Amacı: Aranan değil, kendini yeterli hisset`,

    avoidant: `Kaçıngan bağlanma iyileştirmek:\n• Duygular: Duygularını yazarak ifade etme (canlı konuşma zor ise)\n• Yakınlık: Küçük Steps (elle tutuş → sarılma → duygularını söyleme)\n• Güven: Eşine "Yakınlık korkutuyor ama çalışıyorum" de\n• Terapötik: Çocuklukta neler olduğunu işle\n→ Amacı: Duygusal erişilebilir olmayı öğren`,

    fearful: `Korkulu bağlanma iyileştirmek:\n• Güvenlik: Stabil, tahmin edilebilir eş bulma (varsa)\n• Tetikleyiciler: Neyin "yaklaş/uzaklaş" döngüsünü başlattığını bul\n• Travma: Geçmiş travmayı profesyonelle işle (EMDR, CPT)\n• Yavaşlık: İlişkide hızlı kararlar verme — hiç acele yok\n→ Amacı: Güvenli bağlanmaya yavaşça geç`,
  };

  return strategies[style] || 'Bağlanma stilini tanımak ilk adım.';
}

/**
 * Eşin attachment stilini tahmin etme (single input'tan)
 * Kullanıcının eşi hakkında konuştukları
 * @param {string} aboutPartnerMessage
 * @returns {{ partnerStyle: string, relationshipDynamics: string }}
 */
export function assessPartnerAttachment(aboutPartnerMessage = '') {
  const text = aboutPartnerMessage.toLowerCase();

  // Eş kaygılı mı?
  const partnerAnxious = /çok isteme|mesaj|kontrol|cealı|paylaş|söyle|neden/gi.test(text);

  // Eş kaçıngan mı?
  const partnerAvoidant = /söylemiyor|kapalı|işte|uzak|soğuk|konuşmaz|katı/gi.test(text);

  // Eş korkulu mu?
  const partnerFearful = /biraz yakın biraz uzak|değişken|duygusal|sert sonra yumuşak/gi.test(text);

  let partnerStyle = 'unknown';
  if (partnerAnxious) partnerStyle = 'anxious';
  else if (partnerAvoidant) partnerStyle = 'avoidant';
  else if (partnerFearful) partnerStyle = 'fearful';

  // Dinamik analizi
  const dynamics = analyzeAttachmentDynamics(text);

  return {
    partnerStyle,
    relationshipDynamics: dynamics,
  };
}

/**
 * İlişki dinamiğini analiz et
 * @param {string} relationshipText
 * @returns {string}
 */
function analyzeAttachmentDynamics(relationshipText = '') {
  const text = relationshipText.toLowerCase();

  // Anxious-Avoidant döngüsü (klasik çatışma)
  if (
    /(çok istiyorum|ihtiyaç|kontrol).*\b(söylemiyor|uzak|kapalı)/.test(text) ||
    /(söylemiyor|uzak|kapalı).*\b(çok istiyorum|ihtiyaç)/.test(text)
  ) {
    return 'Anxious-Avoidant Döngüsü: Biri isteme/kontrol, diğeri kaçış. Çatışma artar.';
  }

  // Anxious-Anxious (iki kişi de çekişiyor)
  if (/(ikimiz de|her ikimiz|ben ve o).*\b(mesaj|kontrol|cealı)/.test(text)) {
    return 'Anxious-Anxious: İkisi de sevilmek istiyor ama güvensiz. Aşırı duygusal.';
  }

  // Secure-Anxious (iyi dinamik)
  if (/(açık|anladı|destekliyor).*\b(kaygılı|endişe)/.test(text)) {
    return 'Secure-Anxious: Stabil eş, endişeli taraf. İyileşme mümkün.';
  }

  return 'İlişki dinamiği analiz etmek için daha fazla bilgi lazım.';
}
