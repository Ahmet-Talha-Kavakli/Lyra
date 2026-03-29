// lib/psychoEducation.js
// Psychoeducation — terapötik eğitim, anlaşılabilir psikoloji bilgisi
// Kullanıcının kendini ve psikolojisini anlaması güçlendir ve normalizasyon
//
// Türkçe psikoeğitim: Depresyon nedir, anksiyete nasıl çalışır, travma vs.

const PSYCHOEDUCATION_TOPICS = {
  // Depresyon
  depression: {
    title: 'Depresyon Nedir?',
    simple: 'Beynin bir bölümü (dopamin) azalınca, her şey ağırlaşıyor. Hastalık, kesin değil.',
    detailed: `Depresyon, sinir iletişiminin bozulması — dopamin, serotonin, norepinefrin düşüyor.
Sonuç: Enerji tükenmesi, gelecek umut kayıp, vücut ağır, düşünce yavaş.
Normalizasyon: %20 insan yaşamında depresyon dönem geçirir. Iyileştirilebilir.`,
    tips: [
      'Hareket: Nefes, yürüyüş, düşük yoğunluk aktivite',
      'Sosyal: Biri yanında olsun, sohbet',
      'Beslenme: Proteinli gıda, D vitamini',
      'Uyku: Ritim önemli, her gün saatte yat',
    ],
  },

  // Anksiyete
  anxiety: {
    title: 'Anksiyete Nedir?',
    simple: 'Vücudun "tehlike var" diye alarm çalması — aslında olmadığı halde.',
    detailed: `Anksiyete, amygdala (korku merkezi) aşırı duyarlı hale geliyor.
Tehdit seviyesini abartıyor, adrenalin ve kortizol yükseltir.
Sonuç: Hızlı nefes, palpitasyon, panik hissi, kaçınma davranışları.
Normalizasyon: Fizyolojik bir mekanizma — tedavi edilebilir, kötü değil.`,
    tips: [
      'Grounding: 5-4-3-2-1 tekniği, buz tuş',
      'Nefes: 4 saniye içeri, 6 saniye dışarı',
      'Hareket: Vücut gerginliğini açmak',
      'Maruz Kalma: Kaçınma yerine, çeşitli tehdit yaklaşma',
    ],
  },

  // Travma
  trauma: {
    title: 'Travma Nedir?',
    simple: 'Beyin, ağır deneyimi işleyemediğinde, anı donuyor. Hâlâ "şimdi" gibi hissediyor.',
    detailed: `Travma, amygdala aşırı aktivasyon + prefrontal korteks (mantık) devre dışı.
Anı plastisitesi kaybolur — duyu, duygu, fiziksel tepki ayrı kalmış durumda.
Sonuç: Flash-back (anı yeniden yaşanıyor), disosiyasyon (bedenle bağlantı koptu), uyarılmışlık.
Normalizasyon: Beyniniz koruma mekanizması çalıştırdı. İşleme başlanamadı.`,
    tips: [
      'Güvenlik: Ortamın gerçekten güvenli olduğunu hatırlat',
      'Beden: Vücut taraması, hisset, döndür',
      'Grounding: Şu an "şimdi" — geçmişte değil',
      'Profesyonel: EMDR, Somatic Experience, STTR gibi travma-odaklı terapi',
    ],
  },

  // PTSD
  ptsd: {
    title: 'PTSD (Travma Sonrası Stres Bozukluğu)',
    simple: 'Travmadan sonra, beyin "acı kalmıştır" modunda sıkışıp kalıyor.',
    detailed: `PTSD, öngörülebilir tetikleyiciler → otomatik alarm tepkisi.
Döngü: Tetikleyici → Flashback → Vücutsal tepki (hiperventilasyon) → Kaçınma.
Ağır düzeyde: İş, ilişki, uyku kayıp, suç duygusu, hayattan çekilme.
Normalizasyon: Travma ile karşı karşıya olan herkesin PTSD riski var (% ?).`,
    tips: [
      'Trauma-Informed Terapi: Profesyonel destekle işleme',
      'Somatic Practise: Vücut-temelli iyileşme',
      'İletişim: Destekçilere söyle "bu kontrol altında değil"',
    ],
  },

  // Korku vs Endişe
  fear_vs_worry: {
    title: 'Korku vs Endişe Nedir?',
    simple: `Korku: Şu an tehlike var (amygdala)
Endişe: Gelecekte tehlike olabilir (prefrontal korteks)`,
    detailed: `Korku: Anlık fizyolojik tepki — kısa, yoğun, acil.
Endişe: Düşünce döngüsü — uzun sürüyor, kasılı, tükeniyor.
İkisinin karması: Korku + Endişe = Panik + Kaygı + Disosiyasyon`,
    tips: [
      'Korku: Amygdala yatıştırma (grounding)',
      'Endişe: Mantık yeniden çerçeveleme, problem çözme',
    ],
  },

  // Çocuksal Travma Tepkileri
  childhood_trauma: {
    title: 'Çocuklukta Travma, Yetişkinlikte Nasıl Görünür?',
    simple: 'Erken yaşta ağır şey olduğunda, beyin kendini protekte etmeyi öğreniyor. Çoğu zaman sorunlu yollarla.',
    detailed: `Çocuklukta travma (fizik, duygusal, cinsel, ihmal):
• Parçalanmış bellek (flashback)
• Aşırı uyarılmışlık (her ses = tehlike)
• Güvensizlik ve bağlanma sorunları
• Otomatik suç duygusu ve utanç
• Kendine zarar (self-harm), risk davranışı`,
    tips: [
      'Güvenli ortam kurmak ilk adım',
      'Travma-odaklı terapi (EMDR, CPT)',
      'Beden-temelli iyileşme',
      'Bağlanma sorunu ise: Uzun süreli, tutarlı ilişki',
    ],
  },

  // Disosiyasyon
  dissociation: {
    title: 'Disosiyasyon Nedir?',
    simple: 'Beyin acıdan kurtulmak için "uyuttu" kendini — ruh bedenden çıkıyor gibi hissediyor.',
    detailed: `Disosiyasyon, otomatik protektif mekanizma:
Aşırı stress → Beyin → "Perde kapat" → Benlik hissi azalır.
Hafif: Zihni başka yerde olma hissi
Orta: "Ben bunu yapan değilim", beden yabancı
Ağır: Komplet ayırılma, bellek kaybı, çoğul kişilik`,
    tips: [
      'Grounding: 5-4-3-2-1, buz, vücut haritası',
      'Güvenlik: Şu anın güvenli olduğunu hatırla',
      'Hareket: Vücut hareketi, dans, yoga',
      'Profesyonel: Hafif ise terapi, ağır ise psikiyatrist',
    ],
  },

  // Beyin Plastisite
  neuroplasticity: {
    title: 'Beyin Plastisitesi — Değişebilir mi?',
    simple: 'Evet. Beyin "plastik" — yeni devre kurabiliyor, eski devre kapatabiliyor.',
    detailed: `Nöro-plastisite, beynin kendini yeniden yapılandırma yeteneği.
Eski düşünce / davranış devre → Tekrarlama ve farklı deneyim → Yeni devre.
Örnek: Korku (amygdala) → Grounding + Maruz Kalma → Prefrontal Korteks Güçleniyor`,
    tips: [
      'Tekrarlama: Yeni davranış, her gün tekrar (3+ ay)',
      'Farklı Deneyim: Eski korku tetikleyici + güvenli bağlam',
      'Ödül: Beyin yeni devre pekiştirmek için dopamin lazım',
    ],
  },
};

/**
 * Konuya uygun psikoeğitim öğesitek
 * @param {string} topic — depresyon, anksiyete, travma, ptsd, etc
 * @param {number} depth — 0 (basit) | 1 (orta) | 2 (detaylı)
 * @returns {string}
 */
export function buildPsychoeducationContext(topic = '', depth = 1) {
  const normalizedTopic = topic
    .toLowerCase()
    .replace(/[ç]/g, 'c')
    .replace(/[ğ]/g, 'g')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ş]/g, 's')
    .replace(/[ü]/g, 'u');

  const info = PSYCHOEDUCATION_TOPICS[topic] || PSYCHOEDUCATION_TOPICS['depression'];

  if (!info) return '';

  let context = `[PSİKOEĞİTİM — ${info.title}]\n`;

  if (depth === 0) {
    context += `${info.simple}\n`;
  } else if (depth === 1) {
    context += `${info.simple}\n\n${info.detailed}\n`;
  } else {
    context += `${info.detailed}\n`;
  }

  if (info.tips && info.tips.length > 0) {
    context += `\n→ Pratik İpuçları:\n`;
    info.tips.forEach(tip => {
      context += `  • ${tip}\n`;
    });
  }

  context += `\nBu terapide birlikte çalışacağız. Bilgi güç.`;

  return context;
}

/**
 * Konu tahmini — mesajdan hangi psikoeğitim konusunun uygun olduğunu çıkart
 * @param {string} userMessage
 * @returns {string|null}
 */
export function suggestPsychoeducationTopic(userMessage = '') {
  const message = userMessage.toLowerCase();

  const topicPatterns = {
    depression: /depresyon|üzgün|umutsuz|enerji|motivasyon|neşe|depresif/gi,
    anxiety: /anksiyete|endişe|panik|korku|gerginlik|huzursuzluk/gi,
    trauma: /travma|şok|ağır|olay|yaşanmış/gi,
    ptsd: /ptsd|flashback|tetikleyici|alarm/gi,
    fear_vs_worry: /korkuyor|endişelen|ne fark|arasında/gi,
    childhood_trauma: /çocukluk|anne|baba|erken|küçükken/gi,
    dissociation: /ruh çıkıyor|beden değilmiş|uzakta|gerçek değil|ben değilim/gi,
    neuroplasticity: /değişebilir|mi|iyileş|iyileşiyor|kurtarabilir|mümkün|umut/gi,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(message)) {
      return topic;
    }
  }

  return null;
}
