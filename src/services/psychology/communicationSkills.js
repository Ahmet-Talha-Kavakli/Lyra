// lib/communicationSkills.js
// Communication Skills — NVC (Non-Violent Communication)
// Gözlem → Duygu → İhtiyaç → İstek framework
// Sağlıklı sınırlar, çatışma çözümü, empati

/**
 * NVC Framework — Rosenberg modeli
 * 4 Adım: Observation → Feeling → Need → Request
 */
const NVC_FRAMEWORK = {
  observation: {
    description: 'Eşiniz neler yaptı/söyledi? (Yargı değil, gözlem)',
    examples: [
      'Dün akşam mesaj yazmadın',
      'Bugün eve geç kaldın',
      'Benim fikrimi sorması',
    ],
    antiexamples: [
      'Sen beni ihmal ediyorsun (yargı)',
      'Hep sözüne göre hareket ediyorsun (genelleme)',
      'Benim için önemli değilim (kişiselleştirme)',
    ],
  },

  feeling: {
    description: 'Bu yaptığında sen ne hissettdin? (Sadece duygu)',
    validEmotions: [
      'Üzgün',
      'Korkuyla',
      'Hayal kırıklığı',
      'Endişelendim',
      'Kızgın',
      'Boş hissetim',
    ],
    antiemotions: [
      'Bana göre hareket ediyorsun (yargı)',
      'Terk edileceğim (korku ama yargı)',
      'Sevilmiyorum (düşünce)',
    ],
  },

  need: {
    description: 'Bunun arkasındaki ihtiyaç nedir? (Esas sebep)',
    universalNeeds: [
      'Sevilme / değer görme',
      'Güvenlik / tahmin edilebilirlik',
      'Özerklik / seçim',
      'Anlaşılma / empati',
      'Bağlantı / yakınlık',
      'Saygı / onay',
    ],
  },

  request: {
    description: 'Ne istiyorsun? (Konkret, uygulanabilir)',
    examples: [
      'Lütfen gece 10 suncu mesaj atsana',
      'Yarın akşam 19:00 beraber yemek yesek?',
      'Benim hissettiklerimi dinler misin?',
    ],
    antiexamples: [
      'Beni daha çok sev (muğlak)',
      'Böyle yapma (negatif)',
      'Anla beni (çok geniş)',
    ],
  },
};

/**
 * Kullanıcının yazısında NVC eksikliğini tespit et
 * @param {string} userMessage
 * @returns {{ completeNVC: boolean, missing: Array, suggestion: string }}
 */
export function analyzeNVCStructure(userMessage = '') {
  const text = userMessage.toLowerCase();

  const hasObservation =
    /yap|söy|gör|yaz|ara|git|gel|kal|dur|başla|bitiş/gi.test(text);
  const hasFeeling =
    /hissettim|üzgün|korkuyla|endişe|kızgın|boş|mutlu|sevindi|yalnız/gi.test(text);
  const hasNeed =
    /ihtiyac|sevilme|güvenlik|anlama|saygı|bağlant|özerklik|değer/gi.test(text);
  const hasRequest =
    /lütfen|istiyorum|yapabilir misin|edebilir misin|yapar mısın|senin için|olur mu/gi.test(
      text
    );

  const missing = [];
  if (!hasObservation) missing.push('gözlem');
  if (!hasFeeling) missing.push('duygu');
  if (!hasNeed) missing.push('ihtiyaç');
  if (!hasRequest) missing.push('istek');

  const completeNVC = missing.length === 0;

  let suggestion = '';
  if (missing.length > 0) {
    suggestion = `Şu eksik: ${missing.join(', ')}. NVC framework'ü dene.`;
  }

  return {
    completeNVC,
    missing,
    suggestion,
  };
}

/**
 * NVC framework'e göre yeniden çerçevele
 * @param {string} conflictStatement — "Sen beni görmezden geliyorsun" gibi
 * @returns {string}
 */
export function reframeWithNVC(conflictStatement = '') {
  if (!conflictStatement) return '';

  const text = conflictStatement.toLowerCase();

  // Tespit et ne hakkında konuşuluyor
  let context = {
    about: 'ilişki',
    emotion: 'kırgın',
    need: 'anlaşılma',
  };

  // Basit pattern matching
  if (text.includes('mesaj') || text.includes('cevap') || text.includes('görüş')) {
    context.about = 'iletişim/ilgi';
    context.emotion = 'görmezden gelindi';
    context.need = 'dikkate alınma';
  }

  if (text.includes('sev') || text.includes('kar') || text.includes('yeter')) {
    context.about = 'sevgi/kabul';
    context.emotion = 'yeterli olmama';
    context.need = 'koşulsuz sevilme';
  }

  if (text.includes('kontrol') || text.includes('karar') || text.includes('öz')) {
    context.about = 'özerklik';
    context.emotion = 'sınırlandırılma';
    context.need = 'seçim özgürlüğü';
  }

  let reframed = `[NVC YENİDEN ÇERÇEVELE]\n\n`;
  reframed += `Orijinal: "${conflictStatement}"\n\n`;
  reframed += `NVC Formatında:\n`;
  reframed += `1️⃣ Gözlem: Dün akşam benimle konuşmadın.\n`;
  reframed += `2️⃣ Duygu: Bundan dolayı $(context.emotion) hissettim.\n`;
  reframed += `3️⃣ İhtiyaç: Çünkü senin $(context.need) benim için önemli.\n`;
  reframed += `4️⃣ İstek: Lütfen bugün biraz zaman ayırıp benimle konuşur musun?\n\n`;
  reframed += `→ Böyle söylenince eşin savunmaya geçmiyor, dinlemeyi başlıyor.`;

  return reframed;
}

/**
 * Empati egzersizi — eşin perspektifinden konuş
 * @param {string} conflictAbout
 * @returns {string}
 */
export function buildEmpathyExercise(conflictAbout = '') {
  let exercise = `[EMPATİ EGZERSİZİ — EŞİNİN GÖZLERİNDEN BAK]\n\n`;
  exercise += `Çatışmanın diğer tarafı:\n`;

  if (conflictAbout.includes('mesaj') || conflictAbout.includes('iletişim')) {
    exercise += `Eşin perspektifi: "Beni baskı altında hissediyorum. `;
    exercise += `Sürekli mesaj istemi kaygı veriyor. Bana nefes alma şansı ver."\n\n`;
    exercise += `Ortak çözüm: İkisi de ihtiyaçlarını açıkla, birlikte zaman belirle.`;
  } else if (conflictAbout.includes('sev') || conflictAbout.includes('aşk')) {
    exercise += `Eşin perspektifi: "Seviyorum ama benimle olmak kolay değil. `;
    exercise += `Bence sevgi sadece söz değil, davranış da."\n\n`;
    exercise += `Ortak çözüm: Sevginin ne demek olduğunu konuş.`;
  } else if (conflictAbout.includes('özerklik') || conflictAbout.includes('karar')) {
    exercise += `Eşin perspektifi: "Senin bağımsız olmak istemeni anlıyorum. `;
    exercise += `Ama beraber karar verdiğimiz konularda beni de dinle."\n\n`;
    exercise += `Ortak çözüm: Hangi konularda beraber, hangilerinde bireysel karar verileceğini belirle.`;
  } else {
    exercise += `Eşin perspektifi: Ne olduğunu anlamak için "Eğer sen olsaydın?" sorusu sor.\n`;
    exercise += `Sonra eşine dinleme fırsatı ver.`;
  }

  return exercise;
}

/**
 * Sağlıklı Sınırlar Koyma
 * @param {string} boundaryIssue — ne konusunda sınır koymak istiyorsun?
 * @returns {string}
 */
export function buildHealthyBoundaryScript(boundaryIssue = '') {
  if (!boundaryIssue) return '';

  const scripts = {
    time: `"Aile zamanım benim için önemli. Her salı akşam bizimle geçirmek istiyorum. Bunu yapabilir misin?"`,
    money: `"Parasını nasıl harcadığı senin seçimin. Ama ortak giderleri birlikte planlayalım."`,
    family: `"Aileni seviyorum ama bize de özel zaman lazım. Haftada 1 gün sadece bizim olsun?"`,
    friends: `"Arkadaşlarınla zaman geçirmek harika. Ben de kendi zamanımı istiyorum."`,
    phone: `"Telefon konuşmamız güzel. Ama yatarken telefon olmadan uyumak istiyorum."`,
    work: `"Kariyerin önemli. Ama çalışmamızı eve getirmeden ayırabilir miyiz?"`,
    intimacy: `"Seni seviyorum ama bugün başını çekemiyorum. Hayır, bunu anlayıp kabul edebilir misin?"`,
  };

  let script = `[SAĞLIKLI SINIR KOYMA]\n\n`;
  script += `"${scripts[boundaryIssue] || scripts.time}"\n\n`;
  script += `Bu senin hakkın. Sınır koymak sevgisizlik değil, kendi ihtiyaçlarını görmek.`;

  return script;
}

/**
 * Çatışma Çözüm Adımları
 * @returns {string}
 */
export function buildConflictResolutionSteps() {
  return `[ÇATIŞMA ÇÖZÜMÜ — ADIM ADIM]\n\n` +
    `1️⃣ PAUSE: Kızgın iken konuşma. "Şu an stresli, biraz sonra konuşalım?" de.\n\n` +
    `2️⃣ LISTEN: Önce eşini dinle. Kendi açıklamalarını sonra yap.\n\n` +
    `3️⃣ NVC: Kendi ihtiyaçlarını NVC'de söyle (gözlem → duygu → ihtiyaç → istek).\n\n` +
    `4️⃣ PROBLEM-SOLVING: "Nasıl bu sorunu beraber çözebiliriz?" sorusu sor.\n\n` +
    `5️⃣ AGREEMENT: Somut bir anlaşmaya varın. "Sonraki seferde bunu yapalım" de.\n\n` +
    `6️⃣ REPAIR: Çatışmadan sonra bağlantıya dön. Kontakt, özür, affetme.`;
}
