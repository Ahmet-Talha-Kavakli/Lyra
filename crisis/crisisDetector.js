// crisis/crisisDetector.js

// Negasyon kalıpları — doğrudan sinyal içinde geçenleri geçersiz sayar
// KURAL: HIGH sinyalleri için negasyon eşiği çok yüksek tutulur.
// "Ölmek istemiyorum" → negasyon ✓ (sinyal yok)
// "Ölmek istiyorum ama korkuyorum" → sinyal var, "korkuyorum" negasyon değil ✓
const NEGATION_PATTERNS = [
  'istemiyorum', 'etmiyorum', 'düşünmüyorum', 'planlamıyorum',
  'yapmayacağım', 'olmayacak', 'korkmuyorum',
];

// Negasyon kontrolü — sadece sinyalin kendisi içinde veya hemen önünde (25 karakter)
// Geniş pencere kullanmıyoruz — "Ölmek istemiyorum ama çok kötüyüm" gibi cümlelerde
// "ölmek istiyorum" sinyali tetiklenmemeli ama "ölmek istiyorum, korkmuyorum" tetiklenmeli
function hasNegationNear(text, signal) {
  const idx = text.indexOf(signal);
  if (idx === -1) return false;
  // Sinyalin 25 karakter öncesi + sinyal içi — dar pencere, kasıtlı
  const before = text.slice(Math.max(0, idx - 25), idx);
  const signalText = signal;
  const combined = before + signalText;
  return NEGATION_PATTERNS.some(neg => combined.includes(neg));
}

// HIGH sinyaller için ek güvenlik: sinyal içinde zaten negasyon varsa otomatik geçersiz
// Örn: "yaşamak istemiyorum" → signal listede ama "istemiyorum" içinde negasyon var → tetiklemez
function signalContainsNegation(signal) {
  return NEGATION_PATTERNS.some(neg => signal.includes(neg));
}

const CRISIS_SIGNALS = {
  HIGH: [
    // Doğrudan intihar niyeti — negasyon içermeyen ifadeler
    'ölmek istiyorum', 'öldürmek istiyorum kendimi',
    'intihar etmeyi düşünüyorum', 'intihar planım var',
    'kendimi öldüreceğim', 'hayatıma son vereceğim',
    'intihar edeceğim', 'canıma kıyacağım',
    // Araç/yöntem belirtme
    'ilaçları içeceğim', 'atlayacağım', 'keseceğim kendimi',
    'kendimi yaralayacağım',
    // Yük hissi + çaresizlik kombine
    'herkese yük oluyorum', 'olmadan daha iyi olurdu', 'daha iyi olurdu olmasaydım',
    'olmasaydım keşke', 'yok olmak istiyorum',
    // Veda/hazırlık sinyalleri
    'herkese veda etmek istiyorum', 'bir daha göremeyebilirsiniz',
    'son kez konuşuyoruz', 'herşeyi hallettim artık',
    // Yaşamak istememe — açık ifade
    'yaşamak istemiyorum', 'artık yaşamak istemiyorum',
  ],
  MEDIUM: [
    'dayanamıyorum artık', 'hiçbir çıkış yok', 'umut kalmadı',
    'ne fark eder artık', 'anlamsız her şey', 'bırakmak istiyorum her şeyi',
    'devam etmek istemiyorum', 'yaşamaya değmez', 'neden devam edeyim ki',
    'kimseye ihtiyacım yok artık', 'kaybolup gitmek istiyorum'
  ],
  LOW: [
    'çok yoruldum', 'her şeyden bıktım', 'tükendim',
    'artık istemiyorum', 'devam edemiyorum', 'zor geliyor her şey'
  ]
};

/**
 * Mesajdaki kriz seviyesini tespit et.
 * Negasyon içeren ifadeleri (örn: "ölmek istemiyorum") geçersiz sayar.
 * Döner: { level: 'HIGH' | 'MEDIUM' | 'LOW' | null, signals: [] }
 */
export const detectCrisisLevel = (message) => {
  if (!message) return { level: null, signals: [] };
  const lower = message.toLowerCase();

  // HIGH sinyalleri — dar pencere negasyon kontrolü
  const highFound = CRISIS_SIGNALS.HIGH.filter(signal => {
    if (!lower.includes(signal)) return false;
    // Sinyal zaten negasyon içeriyorsa (liste hatası) geçersiz say
    if (signalContainsNegation(signal)) return false;
    // Kullanıcı mesajında sinyal öncesinde negasyon var mı?
    if (hasNegationNear(lower, signal)) return false;
    return true;
  });

  if (highFound.length > 0) return { level: 'HIGH', signals: highFound };

  // MEDIUM sinyalleri — tek tanesi bile yeterli
  const mediumFound = CRISIS_SIGNALS.MEDIUM.filter(signal => {
    if (!lower.includes(signal)) return false;
    if (hasNegationNear(lower, signal)) return false;
    return true;
  });

  if (mediumFound.length >= 1) return { level: 'MEDIUM', signals: mediumFound };

  // LOW sinyalleri — en az 1 yeterli
  const lowFound = CRISIS_SIGNALS.LOW.filter(s => lower.includes(s));
  if (lowFound.length >= 1) return { level: 'LOW', signals: lowFound };

  return { level: null, signals: [] };
};
