// crisis/crisisDetector.js

// Negasyon kalıpları — bunlar varsa sinyal geçersiz sayılır
const NEGATION_PATTERNS = [
  'istemiyorum', 'değil', 'yok', 'olmaz', 'etmem', 'yapmam',
  'hayır', 'asla', 'hiç', 'korkmuyorum', 'düşünmüyorum'
];

// Mesajda negasyon var mı kontrol et (sinyal öncesinde veya sonrasında 6 kelime içinde)
function hasNegationNear(text, signal) {
  const idx = text.indexOf(signal);
  if (idx === -1) return false;
  const window = text.slice(Math.max(0, idx - 60), idx + signal.length + 60);
  return NEGATION_PATTERNS.some(neg => window.includes(neg));
}

const CRISIS_SIGNALS = {
  HIGH: [
    // Doğrudan intihar niyeti
    'ölmek istiyorum', 'yaşamak istemiyorum', 'öldürmek istiyorum kendimi',
    'intihar etmeyi düşünüyorum', 'intihar planım var',
    'kendimi öldüreceğim', 'hayatıma son vereceğim',
    // Araç/yöntem belirtme
    'ilaçları içeceğim', 'atlayacağım', 'keseceğim kendimi',
    // Yük hissi + çaresizlik kombine
    'herkese yük oluyorum', 'olmadan daha iyi olurdu', 'daha iyi olurdu olmasaydım',
    // Veda/hazırlık sinyalleri
    'herkese veda etmek istiyorum', 'bir daha göremeyebilirsiniz'
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

  // HIGH sinyalleri — negasyon kontrolü ile
  const highFound = CRISIS_SIGNALS.HIGH.filter(signal => {
    if (!lower.includes(signal)) return false;
    // Negasyon varsa bu sinyal geçersiz
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
