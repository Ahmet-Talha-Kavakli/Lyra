// lib/traumaInformed.js
// Trauma-Informed Approach — travma güvenliği, tetikleyiciler, grounding teknikler
// SAMHSA modeli: Safety, Trustworthiness, Choice, Collaboration, Empowerment
//
// Lyra'nın her seans trauma-bilinçli şekilde başlaması ve ilerlemesi

const TRAUMA_INFORMED_PILLARS = {
  safety: {
    principle: 'Fiziksel ve emosyonal güvenlik sağla',
    practices: ['öngörülebilir yapı', 'sınırlar jel', 'flaş-back uyarısı', 'pause hakkı'],
  },
  trustworthiness: {
    principle: 'Şeffaflık ve tutarlılık',
    practices: ['açık iletişim', 'söz verip tutma', 'sapık davranışlar yok', 'tahmin edilebilir'],
  },
  choice: {
    principle: 'Kontrol ve özerklik',
    practices: ['seçim hakkı', 'hayır diyebilme', 'hızı kendisi ayarlama'],
  },
  collaboration: {
    principle: 'Ortak karar alma',
    practices: ['beraber plan yapma', 'kullanıcı önerisi dinleme', 'partnership'],
  },
  empowerment: {
    principle: 'Güç geri verme',
    practices: ['kendi gücünü fark ettirme', 'başarıları kutlama', 'özerklik'],
  },
};

/**
 * Tetikleyici (trigger) tespit et — travmatik malzemenin işareti
 * @param {string} userMessage
 * @param {Array} previousSessionTopics — önceki travma konuları
 * @returns {{ hasTrigger: boolean, triggerType: string, severity: string, grounding: string }}
 */
export function detectTrigger(userMessage, previousSessionTopics = []) {
  if (!userMessage) {
    return {
      hasTrigger: false,
      triggerType: 'none',
      severity: 'none',
      grounding: '',
    };
  }

  const lowerMsg = userMessage.toLowerCase();
  let triggerDetected = false;
  let severity = 'none';
  let triggerType = 'none';

  // ─── TRAVMA IŞARETI DESENLERI ──────────────────────────────────────────

  // Emosyonel flood
  const floodPatterns = [
    /titreme|nefes alınamıyor|panikte|şaşkın|dondum|korkudan|çok hızlı/gi,
  ];

  // Flash-back (geçmişte kaldı gibi hissetme)
  const flashbackPatterns = [
    /anımsıyor|geri dönüş|şimdi yaşıyor|sanki|tekrar|aynı|olabilir mi|emin değil/gi,
  ];

  // Ayrılma (disosiyasyon)
  const dissocPatterns = [
    /ruh çıkıyor|boş|uyuşuk|uzakta|beden değilmiş|ben değilim|sesler duyuyorum/gi,
  ];

  // Esneme/Çökmüşlük
  const collapsePatterns = [
    /tükenmiş|güçsüz|bitmişim|ne yapacağım|başaramam|umut yok|boşluk/gi,
  ];

  // ─── TETIKLEYICI TESPITI ────────────────────────────────────────────────

  if (floodPatterns.some(p => p.test(lowerMsg))) {
    triggerDetected = true;
    triggerType = 'flooding';
    severity = 'moderate';
  }

  if (flashbackPatterns.some(p => p.test(lowerMsg))) {
    triggerDetected = true;
    triggerType = 'flashback';
    severity = 'high';
  }

  if (dissocPatterns.some(p => p.test(lowerMsg))) {
    triggerDetected = true;
    triggerType = 'dissociation';
    severity = 'high';
  }

  if (collapsePatterns.some(p => p.test(lowerMsg))) {
    triggerDetected = true;
    triggerType = 'collapse';
    severity = 'high';
  }

  // ─── GROUNDING TEKNİĞİ ──────────────────────────────────────────────────

  let groundingTechnique = '';

  if (triggerType === 'flooding') {
    groundingTechnique =
      '[GROUNDING — FLOODING]\n' +
      'Beynin alarm çalıyor. Burada ve şimdi olduğunu hatırlayalım.\n' +
      '5-4-3-2-1 tekniği:\n' +
      '• 5 şey gör (etrafında ne var?)\n' +
      '• 4 şey dokunun (masayı, koltuğu, vb.)\n' +
      '• 3 ses dinle (kuş, araba, ses)\n' +
      '• 2 koku al\n' +
      '• 1 tat (su, tatlı, limon)\n' +
      '→ Beynin kalçtan öne gelişini sağla.';
  }

  if (triggerType === 'flashback') {
    groundingTechnique =
      '[GROUNDING — FLASHBACK]\n' +
      'Geçmiş şimdiyle karışıyor. Şimdi güvenli.\n' +
      '→ Tarih kontrolü: "Bugün ay/gün/yıl nedir? Nerede oturuyorsun? Kim yanındadır?"\n' +
      '→ Parmak uçlarında buz tut (15 saniye) — beyin "şimdi" sinyal alır.';
  }

  if (triggerType === 'dissociation') {
    groundingTechnique =
      '[GROUNDING — DİSOSİYASYON]\n' +
      'Beden-benlik bağlantısı kopmuş. Geri dön.\n' +
      '→ Adını yüksek sesle söyle, doğum tarihinizi söyle, temel bilgileri hatırla.\n' +
      '→ Vücut taraması: Ayaklarından başla, her bölümü hisset, yukarı çık.';
  }

  if (triggerType === 'collapse') {
    groundingTechnique =
      '[GROUNDING — ÇÖKMÜŞLÜK]\n' +
      'Enerji tükenmiş, boşluk var. Beden harekete alındı.\n' +
      '→ Bacakları hareket ettir, yürü, esneyiş yap, soğuk su yüzüne döküt.\n' +
      '→ Canlılık hissi arttır (aktivasyon).';
  }

  return {
    hasTrigger: triggerDetected,
    triggerType,
    severity,
    grounding: groundingTechnique,
  };
}

/**
 * Travma güvenliği bağlamı oluştur (her seansın başında)
 * @param {boolean} isFirstSession
 * @returns {string}
 */
export function buildTraumaSafetyContext(isFirstSession = false) {
  if (isFirstSession) {
    return (
      `[TRAUMA-INFORMED — İLK SEANS]\n` +
      `Güvenli bir ortam kuruluyor. Kurallar:\n` +
      `• Kontrol senin — istersen durmak, hız değiştirmek, başka gitmek tamam\n` +
      `• Ağrılı anılar gelirse, ayrıntı vermek zorunda değilsin\n` +
      `• "Pause" de, dinlenebiliriz\n` +
      `• Hiçbir şey kötü değil, hepsi işleniyor\n` +
      `• Sırlarınız güvende — sadece seninle`
    );
  }

  return (
    `[TRAUMA-INFORMED — GÜVENLIK]\n` +
    `Önceki seanslarda kuralları hatırla: Hız senin, kontrol senin, pause hakkı var.\n` +
    `Bugün neye odaklanmak istiyorsun? Hangi hız rahat?`
  );
}

/**
 * Tetikleyici uyarı — önceden uyararak consent al
 * @param {string} topic — konunun adı
 * @param {string} severity — "mild" | "moderate" | "high"
 * @returns {string}
 */
export function buildTriggerWarning(topic = '', severity = 'moderate') {
  let warning = `[TRIGGER WARNING — ${topic.toUpperCase()}]\n`;

  if (severity === 'high') {
    warning += `Bu konuşmanın çok ağrılı olabilir.\n`;
  } else if (severity === 'moderate') {
    warning += `Bu konuda biraz zor olabilir.\n`;
  }

  warning += `Devam etmek ister misin? Hızı yavaşlatabilir, pause edebiliriz.\n`;
  warning += `→ Kararını söyle.`;

  return warning;
}

/**
 * Travma sonrası (post-session) stabilizasyon
 * @param {Object} sessionContent — { topics, deepness, emotionalPeak }
 * @returns {string}
 */
export function buildTraumaStabilizationContext(sessionContent = {}) {
  const { topics = [], deepness = 'moderate', emotionalPeak = false } = sessionContent;

  if (!emotionalPeak && deepness !== 'deep') {
    return '';
  }

  let stabilization =
    `[TRAUMA-INFORMED — STABILIZASYON]\n` +
    `Derin iş yaptık. Vücudunu sakinleştir:\n` +
    `• Soğuk su içiyor\n` +
    `• Yavaş nefes al (4 saniye içeri, 6 saniye dışarı)\n` +
    `• Ayakları yere bas, beden konumu değiştir\n` +
    `• Güvenli kişiye mesaj at (bilgilendirme)\n` +
    `• Bugün şirret aktivite yap (kitap, müzik, yürüyüş — ağır değil)\n`;

  if (emotionalPeak) {
    stabilization +=
      `\n→ Psikolojist olarak söylemek istiyorum: Bugün cesurca bir adım attın.\n` +
      `Vücudu sakinleştir, kendine iyi bak, akşam iyi uyu.`;
  }

  return stabilization;
}

/**
 * Travma yeniden tetiklenme riski
 * @param {string} userId
 * @param {Array} recentMessages
 * @returns {{ riskLevel: string, triggers: Array, recommendation: string }}
 */
export function assessTraumaRetraumatizationRisk(userId, recentMessages = []) {
  if (!recentMessages || recentMessages.length === 0) {
    return {
      riskLevel: 'none',
      triggers: [],
      recommendation: '',
    };
  }

  const userMessages = recentMessages.filter(m => m.role === 'user').map(m => m.content);
  let riskLevel = 'none';
  const triggers = [];

  // ─── RİSK FAKTÖRLERI ────────────────────────────────────────────────────

  // 1. Anılar çok hızlı ortaya çıkıyor
  const intensityPatterns = [
    /dehşet|korku|panik|hiçbir şey|başaramam|öleceğim/gi,
  ];

  userMessages.forEach(msg => {
    intensityPatterns.forEach(p => {
      if (p.test(msg)) {
        riskLevel = 'moderate';
        triggers.push('high_intensity_language');
      }
    });
  });

  // 2. Disosiyasyon belirtileri
  const dissocPatterns = [/boş|uyuşuk|ruh çıkıyor|ben değilim/gi];
  userMessages.forEach(msg => {
    if (dissocPatterns.some(p => p.test(msg))) {
      riskLevel = 'high';
      triggers.push('dissociation_risk');
    }
  });

  // 3. Sistem yükü (çok sayıda tetikleyici)
  if (triggers.length >= 3) {
    riskLevel = 'high';
  }

  // ─── TAVSIYE ────────────────────────────────────────────────────────────

  let recommendation = '';
  if (riskLevel === 'high') {
    recommendation = 'Sistem aşırı yüklenmiş. Hızını yavaşlat, grounding önem kazandı.';
  } else if (riskLevel === 'moderate') {
    recommendation = 'Tetikleyiciler ortaya çıkıyor. Dikkatli ol, stabilizasyon artır.';
  } else {
    recommendation = 'Kontrol içinde. Normal hızda devam et.';
  }

  return {
    riskLevel,
    triggers,
    recommendation,
  };
}
