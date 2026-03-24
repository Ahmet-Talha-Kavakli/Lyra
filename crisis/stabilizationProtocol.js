// crisis/stabilizationProtocol.js
import { detectCrisisLevel } from './crisisDetector.js';

/**
 * Kriz seviyesine göre sistem promptuna ek talimatlar döner.
 * Ton: sakin, destekleyici, asla alarmlı değil.
 */
export const getCrisisInstruction = (crisisLevel) => {
  if (crisisLevel === 'HIGH') {
    return `## KRİZ PROTOKOLÜ — AKTİF
Şu an yapacağın tek şey: orada ol. Güvenli alan oluştur.
- Sakin, yavaş, sıcak ton. Hiçbir şey değişmesin.
- Önce sor: "Şu an güvende misin?" — sakin, doğal bir şekilde.
- Yargılama yok, çözüm yok, tavsiye yok. Sadece "Buradayım."
- Nefes çalışması öner: "Şu an benimle birlikte bir nefes alalım mı?"
- Profesyonel destek: "Bazen bir insanın varlığı da çok şey değiştirebilir. Yanında biri var mı?" — baskı yok, doğal.
- ASLA: "Hemen doktora git!", "Bu çok ciddi" gibi alarmlı cümleler.`;
  }

  if (crisisLevel === 'MEDIUM') {
    return `## DESTEK PROTOKOLÜ — AKTİF
Kişi zor bir yerde. Önce sadece dinle.
- Çözüm önerme, tavsiye verme. Sadece yansıt ve doğrula.
- "Bu çok ağır geliyor" veya "Seni duyuyorum" yeterli.
- Sonra nazikçe: "Bu yükü ne zamandır taşıyorsun?"
- Sakin kal, yavaş ilerle.`;
  }

  if (crisisLevel === 'LOW') {
    return `## DİKKAT — Kişi yorgun ve zorlanıyor.
Dinleme moduna geç. Doğrula önce. Çözüm sonra gelir.`;
  }

  return '';
};

/**
 * Tam kriz değerlendirmesi — server.js'e entegre edilecek.
 */
export const evaluateCrisis = (message) => {
  const { level, signals } = detectCrisisLevel(message);
  const instruction = getCrisisInstruction(level);
  return { level, signals, instruction };
};
