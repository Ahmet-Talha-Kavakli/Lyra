// lib/dbtInterpersonal.js
// DBT Interpersonal Effectiveness — ilişkide ne istediğini al, ama ilişkiyi koru
// GIVE, DEAR MAN, GIVE FAST protokolleri
//
// Amaç: Kişisel hedefler vs ilişki bakımı arasında denge

const INTERPERSONAL_EFFECTIVENESS = {
  // GIVE — İlişkiyi Koru (Her zaman)
  give: {
    name: 'GIVE — İlişkiyi Koru',
    description: 'İlişkinin kendi içinde sağlığı var. Şu kaliteler sağla:',
    skills: {
      G: {
        name: 'Gentle (Nazik)',
        description: 'Yumuşak söyle, eleştirme, hakaret yok',
        examples: [
          'Kızgın olmayan ton',
          'Yüz ifadesi sakin',
          'Fırçalarım asla, eleştirim asla',
        ],
      },
      I: {
        name: 'Interested (İlgili)',
        description: 'Eşinin duygularına ilgi göster',
        examples: [
          'Dinle, cep telefonu tutma',
          'Soru sor ("Bu hakkında nasıl hissettiniz?")',
          'Onun isteklerini sor, sadece kendi isteklerin değil',
        ],
      },
      V: {
        name: 'Validate (Doğrula)',
        description: 'Duyguların mantıklı olduğunu söyle',
        examples: [
          '"Öfken haklı, bunu söyle"',
          '"Bu durumda herkes öfkeli olurdu"',
          '"Duygularını anlıyorum"',
        ],
      },
      E: {
        name: 'Easy manner (Rahat)',
        description: 'Sanki problem yokmuş gibi davran',
        examples: [
          'Sorun çözmek için acele etme',
          'Esprili ol, gulünsün',
          'Baskı oluşturma',
        ],
      },
    },
  },

  // DEAR MAN — Arzularını İfade Et
  dear_man: {
    name: 'DEAR MAN — Arzularını İfade Et',
    description: 'Ne istiyorsan, açık ve doğrudan iste',
    skills: {
      D: {
        name: 'Describe (Tanımla)',
        description: 'Durumu tarafsız tanımla',
        example: 'Dün sana mesaj attığım halde cevap vermemedin',
      },
      E: {
        name: 'Express (İfade Et)',
        description: 'Duygularını ve isteklerini söyle',
        example: 'Bundan dolayı kırıldım, çünkü değerli hissettirmedi',
      },
      A: {
        name: 'Assert (Kat\'ı Ol)',
        description: 'Net ve doğrudan iste',
        example: 'Lütfen 1 saat içinde cevap vermeye çalış',
      },
      R: {
        name: 'Reinforce (Ödüllendir)',
        description: 'Eşin kabul etmesi halinde ödüllendir',
        example: 'Bunu yaptığında çok mutlu olurum, teşekkürler',
      },
      M: {
        name: 'Stay Mindful (Dikkat Kalı)',
        description: 'İstediğin hedeften sapma, tuzaklara girme',
        example: 'Eşi "hayır" dese bile, tepkileriniz tutarlı kal',
      },
      A: {
        name: 'Appear (Görünüş)',
        description: 'Ciddiyeti yüzünde göster (gülümseme değil)',
        example: 'Ciddi, rahat, göz teması',
      },
      N: {
        name: 'Negotiate (Müzakere)',
        description: 'Esnek ol, eşinin konuşmasını dinle',
        example: 'Haklı bir noktası var mı? Ortasını bul',
      },
    },
  },

  // GIVE FAST — Kişisel Özsaygını Koru (Kendini Koruma)
  give_fast: {
    name: 'GIVE FAST — Kişisel Özsaygını Koru',
    description: 'İlişkiye zarar veri değil, kendine iyi davran',
    skills: {
      G: {
        name: 'Gentle with yourself',
        description: 'Kendine agresif olma, özsaygını koru',
      },
      I: {
        name: 'Interested in yourself',
        description: 'Kendi duygularını dinle, ihtiyaçlarını önemse',
      },
      V: {
        name: 'Validate yourself',
        description: '"Duygularım mantıklı, haklıyım"',
      },
      E: {
        name: 'Easy manner',
        description: 'Rahat ol, self-pitty değil',
      },
      F: {
        name: 'Fair (Adil)',
        description: 'Sadece kendi tarafını görmek değil, iki tarafı da yargı-sız',
      },
      A: {
        name: 'Approve (Onay)',
        description: 'Kendini onayla, eş onaylanmadığında',
      },
      S: {
        name: 'Stick to values',
        description: 'Değerlerine sadık kal, hatta ilişkinin pahasına',
      },
      T: {
        name: 'Truth (Gerçek)',
        description: 'Dürüst ol kendine, rağmen başarısızlığa uğraman',
      },
    },
  },
};

/**
 * İlişki yetkinliği değerlendir
 * @param {string} situation
 * @returns {{ needsGIVE: boolean, needsDEARMAN: boolean, needsGIVEFAST: boolean }}
 */
export function assessInterpersonalNeed(situation = '') {
  const text = situation.toLowerCase();

  const needsGIVE =
    /çatışma|kızgın|tartış|kopuş|evet demeliyim/.test(text);
  const needsDEARMAN =
    /istiyorum|talep|sınır|hayır|reddet|istek/.test(text);
  const needsGIVEFAST =
    /değerim|kendi|kendim|sınır|saygı|kişi|özerklik/.test(text);

  return {
    needsGIVE,
    needsDEARMAN,
    needsGIVEFAST,
    recommendation:
      needsGIVE && needsDEARMAN
        ? 'GIVE + DEAR MAN ikisini birleştir'
        : needsGIVE
        ? 'GIVE ile ilişkiyi koru'
        : needsDEARMAN
        ? 'DEAR MAN ile isteklerini açıkla'
        : 'GIVE FAST ile kendini koru',
  };
}

/**
 * İlişki yetkinliği bağlamı
 * @param {string} protocol — 'give' | 'dear_man' | 'give_fast'
 * @returns {string}
 */
export function buildInterpersonalEffectivenessContext(protocol = '') {
  const skill = INTERPERSONAL_EFFECTIVENESS[protocol];

  if (!skill) return '';

  let context = `[DBT — INTERPERSONAL EFFECTIVENESS]\n`;
  context += `${skill.name}\n\n`;
  context += `${skill.description}\n\n`;

  Object.entries(skill.skills).forEach(([letter, skillInfo]) => {
    context += `${letter}️⃣ ${skillInfo.name}\n`;
    context += `→ ${skillInfo.description}\n`;
    if (skillInfo.examples && skillInfo.examples[0]) {
      context += `Örnek: "${skillInfo.examples[0]}"\n`;
    }
    context += `\n`;
  });

  context += `→ Hangisini kullan? GIVE (ilişki), DEAR MAN (istekler), GIVE FAST (kendine).`;

  return context;
}

/**
 * Zor konuşma rehberi
 * @param {string} topic — ne hakkında konuşacaksın?
 * @returns {string}
 */
export function buildDifficultConversationScript(topic = '') {
  let script = `[ZOR KONUŞMA REHBERI]\n\n`;

  script += `1️⃣ HAZIRLA (Öncesinde)\n`;
  script += `• Ne istiyorsun? (1-2 cümle)\n`;
  script += `• Neden önemli? (duygu)\n`;
  script += `• Eş bunu nasıl tepki verebilir?\n`;
  script += `• Plan B: Eğer hayır derse, ne yapacaksın?\n\n`;

  script += `2️⃣ KONUŞTURma (Sırasında)\n`;
  script += `• Sessiz, sakin yer seç\n`;
  script += `• "Seninle önemli bir şey konuşmak istiyorum" de\n`;
  script += `• Gözleri ara, açık dil\n`;
  script += `• DEAR MAN: Tanımla → İfade et → İste → Ödüllendir\n\n`;

  script += `3️⃣ DİNLE (Karşılık)\n`;
  script += `• Eşin söylediğini dinle (kendi cevabını düşünme)\n`;
  script += `• GIVE: Nazik, ilgili, doğrula, rahat\n`;
  script += `• Eğer savunmaya geçerse, pause: "Bunu yanlış anlattım mı?"\n\n`;

  script += `4️⃣ KONUŞUTmaYı BİTİR\n`;
  script += `• Evet veya hayır, kabul et\n`;
  script += `• Öfke yok (GIVE FAST ile kendini koru)\n`;
  script += `• Teşekkür et (dinlediği için)\n`;
  script += `• İhtiyaç varsa, profesyonelle devam et\n\n`;

  script += `→ Konuşma başarısız gözükse bile, ilişkini korasan kazandın.`;

  return script;
}
