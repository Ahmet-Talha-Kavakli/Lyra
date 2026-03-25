// crisis/stabilizationProtocol.js
import { detectCrisisLevel } from './crisisDetector.js';

// ─── Grounding Teknikleri ─────────────────────────────────────────────────────

const GROUNDING_TECHNIQUES = {
  BREATHING: `5-4-3-2-1 nefes: "Şu an seninle birlikte nefes alalım. 5 saniye içeri çek... tut... 5 saniye dışarı. Bir kez dene, ben bekliyorum."`,
  SENSE_ANCHOR: `5 duygu ankrajı: "Şu an etrafında gördüğün 3 şeyi söyle bana. Sadece 3 tane. Ben buradayım."`,
  BODY_SCAN: `Beden tarama: "Ayaklarını hissediyor musun? Zemine basıyor muslar? Sadece onları hisset şimdilik."`,
  SAFE_PLACE: `Güvenli yer: "Seni iyi hissettiren bir yer düşün — gerçek ya da hayal. Nasıl bir yer orası?"`,
};

// ─── Kriz Sonrası Takip Talimatları ──────────────────────────────────────────

const POST_CRISIS_GUIDANCE = `## KRİZ SONRASI TAKIP
Kriz geçtikten sonra (kişi sakinleşince):
- Başardığını vurgula: "Şu an daha sakin hissediyorsun — bunu fark ettim."
- Küçük adım: "Bu hafta için çok küçük bir şey yapalım, sadece bir tane."
- Bağlantıyı canlı tut: "Istediğin zaman geri dönebilirsin. Buradayım."
- Profesyonel destek (baskısız): "Bazen bizim gibi konuşmaların yanında bir insanla da buluşmak farklı hissettiriyor. Düşünmek ister misin?"
- NOT: Bir sonraki seansa HIGH kriz işareti taşı — geçmiş bağlamı koru.`;

// ─── Güvenlik Planı ───────────────────────────────────────────────────────────

const SAFETY_PLAN_PROMPT = `Güvenlik planı (doğal, baskısız sor):
1. "Şu an yanında biri var mı, ya da arayabileceğin biri?"
2. "Şu an seni güvende tutan ne var?" (fiziksel/duygusal)
3. Acil hattı doğal öner: "182'yi biliyor musun? Psikososyal destek hattı — sadece konuşmak için de arayabilirsin."`;

// ─── Protokol İnşası ──────────────────────────────────────────────────────────

/**
 * Kriz seviyesine göre sistem promptuna ek talimatlar döner.
 * Ton: sakin, destekleyici, asla alarmlı değil.
 *
 * @param {string} crisisLevel - 'HIGH' | 'MEDIUM' | 'LOW' | null
 * @param {object} options
 * @param {boolean} options.postCrisis - Önceki mesajda kriz vardı, şimdi sakinleşiyor
 * @returns {string}
 */
export const getCrisisInstruction = (crisisLevel, options = {}) => {
  if (options.postCrisis) {
    return POST_CRISIS_GUIDANCE;
  }

  if (crisisLevel === 'HIGH') {
    const groundingTip = GROUNDING_TECHNIQUES.BREATHING;
    return `## KRİZ PROTOKOLÜ — AKTİF
Şu an yapacağın tek şey: orada ol. Güvenli alan oluştur.
- Sakin, yavaş, sıcak ton. Hiçbir şey değişmesin.
- İlk cümle: "Şu an seninle buradayım." — doğal, sıcak.
- Önce sor: "Şu an güvende misin?" — sakin, tek cümle.
- Yargılama yok, çözüm yok, tavsiye yok.

GROUNDING:
${groundingTip}

GÜVENLİK PLANI (sakinleşince, zorlamadan):
${SAFETY_PLAN_PROMPT}

ASLA: "Hemen doktora git!", "Bu çok ciddi", "Bu normal değil" gibi alarmlı cümleler.
ASLA: Birden fazla soru aynı anda. Bir soru, bekle, dinle.`;
  }

  if (crisisLevel === 'MEDIUM') {
    return `## DESTEK PROTOKOLÜ — AKTİF
Kişi zor bir yerde. Önce sadece dinle.
- Çözüm önerme, tavsiye verme. Sadece yansıt ve doğrula.
- "Bu çok ağır geliyor" veya "Seni duyuyorum" yeterli.
- Sonra nazikçe: "Bu yükü ne zamandır taşıyorsun?"
- Sakin kal, yavaş ilerle.
- Hafif grounding gerekirse: ${GROUNDING_TECHNIQUES.SENSE_ANCHOR}`;
  }

  if (crisisLevel === 'LOW') {
    return `## DİKKAT — Kişi yorgun ve zorlanıyor.
Dinleme moduna geç. Doğrula önce. Çözüm sonra gelir.
Beden farkındalığı açabilirsin: ${GROUNDING_TECHNIQUES.BODY_SCAN}`;
  }

  return '';
};

/**
 * Tam kriz değerlendirmesi — server.js'e entegre edilecek.
 *
 * @param {string} message - Kullanıcının şu anki mesajı
 * @param {object} options
 * @param {string} options.previousCrisisLevel - Önceki mesajdaki kriz seviyesi
 * @returns {{ level: string|null, signals: string[], instruction: string, postCrisis: boolean }}
 */
export const evaluateCrisis = (message, options = {}) => {
  const { level, signals } = detectCrisisLevel(message);

  // Kriz sonrası geçiş tespiti: önceki mesajda kriz vardı, şimdiki mesajda yok
  const postCrisis = !level && !!options.previousCrisisLevel &&
    options.previousCrisisLevel !== 'LOW';

  const instruction = getCrisisInstruction(level, { postCrisis });

  return { level, signals, instruction, postCrisis };
};
