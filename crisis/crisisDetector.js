// crisis/crisisDetector.js

const CRISIS_SIGNALS = {
  HIGH: [
    'intihar', 'ölmek istiyorum', 'yaşamak istemiyorum', 'kendime zarar vereceğim',
    'herkese yük oluyorum', 'daha iyi olurdu olmasaydım'
  ],
  MEDIUM: [
    'dayanamıyorum artık', 'bırakmak istiyorum', 'hiçbir çıkış yok',
    'umut yok', 'ne fark eder artık', 'anlamsız her şey'
  ],
  LOW: [
    'çok yoruldum', 'her şeyden bıktım', 'devam edemiyorum',
    'artık istemiyorum', 'tükendim'
  ]
};

/**
 * Mesajdaki kriz seviyesini tespit et.
 * Döner: { level: 'HIGH' | 'MEDIUM' | 'LOW' | null, signals: [] }
 */
export const detectCrisisLevel = (message) => {
  if (!message) return { level: null, signals: [] };
  const lower = message.toLowerCase();

  for (const signal of CRISIS_SIGNALS.HIGH) {
    if (lower.includes(signal)) return { level: 'HIGH', signals: [signal] };
  }

  const mediumFound = CRISIS_SIGNALS.MEDIUM.filter(s => lower.includes(s));
  if (mediumFound.length >= 2) return { level: 'MEDIUM', signals: mediumFound };
  if (mediumFound.length === 1) return { level: 'LOW', signals: mediumFound };

  const lowFound = CRISIS_SIGNALS.LOW.filter(s => lower.includes(s));
  if (lowFound.length >= 2) return { level: 'LOW', signals: lowFound };

  return { level: null, signals: [] };
};
