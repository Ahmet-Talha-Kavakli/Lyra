// lib/dbtEmotionRegulation.js
// DBT Emotion Regulation — duygularını yönet, aşırı tepkileri azalt
// Dialektik Davranış Terapisi modeli (Linehan)
//
// Amaç: Duygusal istikrar, tepki verme yerine cevap verme

const EMOTION_REGULATION_SKILLS = {
  // ABC PLEASE — Temel bakım
  abc_please: {
    name: 'ABC PLEASE — Duygusal İstikrar Temeli',
    skills: {
      A: {
        name: 'Accumulate positive experiences (Olumlu deneyim topla)',
        description: 'Her gün küçük güzel şeyler yap',
        examples: [
          'Güzel bir müzik dinle',
          'Arkadaşla kısa sohbet',
          'Sevdiğin yemek yap',
          'Bahçeye çık 5 dakika',
        ],
      },
      B: {
        name: 'Build positive experiences (İnşa et)',
        description: 'Gelecekte güzel anlar planla',
        examples: [
          'Yarın arkadaşla buluş planla',
          'Sonu ne olur bilerek planla (kaygı azalır)',
          'Sevdiğin aktiviteyi şimdi planla',
        ],
      },
      C: {
        name: 'Cope ahead (Zor durumlara hazırlan)',
        description: 'Stresli durumlarda ne yapacağını önceden kararlaştır',
        examples: [
          'Zor konuşmadan önce nefes tut',
          'Eşinle tartışmadan önce "sakin konuş" de kendine',
          'Kotarası gireceğine biliyorsan, o bölgede grounding planla',
        ],
      },
      P: {
        name: 'PLEase physical self-care',
        description: 'Vücuduna bakım yap',
        actions: [
          'Uyku: 7-8 saat',
          'Egzersiz: Hergün 20 dakika (yürüyüş yeter)',
          'Beslenme: Protein, su, meyve',
          'Hastalığa dikkat: Grip/tıbbi sorun tedavi et',
        ],
      },
      L: {
        name: 'Let go of destructive coping (Yıkıcı başetmeyi bırak)',
        description: 'Alkol, uyuşturucu, kendine zarar — bunları azalt',
        why: 'Kısa vadede rahatça hissediyor ama duyguları daha da kötü yapıyor',
      },
      E: {
        name: 'Eating',
        description: 'Normal beslenmeyi devam ettir',
        note: 'Diyet yapmayı bırak stres zamanında',
      },
      S: {
        name: 'Sleep',
        description: 'Uyku rutini kur',
        tips: [
          'Hergün aynı saatte yat',
          'Yatmadan 1 saat önce telefonu kapat',
          'Oda soğuk ve karanlık olsun',
        ],
      },
    },
  },

  // Opposite Action — Duygusal tepkinin tersini yap
  opposite_action: {
    name: 'Opposite Action — Duyguya Karşı Hareket Et',
    description: 'Depresyifsen aktivite yap, öfkeliysen bırak ve uzaklaş',
    examples: {
      sadness: {
        feeling: 'Üzgün, hareket etmek istemiyorum',
        opposite_action: 'Biliyor bile olsan, kalk ve hareket et',
        specific: [
          'Yataktan çık',
          'Duş al',
          'Dışarı çık',
          'Arkadaşla konuş',
          'Spor yap',
        ],
        why: 'Duygular davranışı kontrol eder, ama davranış duygularını da kontrol eder',
      },
      anger: {
        feeling: 'Kızgın, vurma/söyleme isteği',
        opposite_action: 'Durulara el koymamak, yakınlaşmamak',
        specific: [
          'Odayı terk et',
          'Yürüyüşe çık',
          'Nefes al',
          'Soğuk su yüzüne döküt',
          'Yastığa vur (eşine değil)',
        ],
      },
      anxiety: {
        feeling: 'Endişeli, kaçmak istiyorum',
        opposite_action: 'Korkunun içine gir, kaçma',
        specific: [
          'Korktuğun yere git (terapist eşliğinde)',
          'Canlı kal (kaçma)',
          'Nefes al, panic geçecek',
        ],
      },
      shame: {
        feeling: 'Utanç, saklan',
        opposite_action: 'Başı kaldır, insanlarla bağlant kur',
        specific: [
          'Dışarı çık',
          'Biri ile konuş',
          'Gözlerini aç',
          'Cesur hareket et',
        ],
      },
    },
  },

  // Check the Facts — Duygusal gerçekliği kontrol et
  check_the_facts: {
    name: 'Check the Facts — Düşüncelerine İnan mı?',
    description: 'Beynin duygusal zamanında yalan söylüyor. Gerçekleri kontrol et.',
    steps: [
      '1. Duygunu isimlendir: "Acaba başarısız mıyım?"',
      '2. Kanıtları ara: Gerçekten başarısız mısın?',
      '3. Karşı kanıtları ara: Neyi başardın?',
      '4. Gerçekçi düşünceye geç: "Zorlanıyorum ama gelişiyorum"',
    ],
    examples: {
      thought: 'Kimse beni sevmiyor',
      emotional_truth: 'Hissiyim bu, çünkü depresyifim',
      facts: [
        'Arkadaşım dün benimle konuştu',
        'Anne beni aradı',
        'Eşim yanımda yatıyor',
      ],
      realistic_thought: 'Depresyonda hissediyorum sevilmediğimi, ama kanıt gösteriyor ki sevilen biriyim',
    },
  },

  // ABC SKIP — Olumsuz spiral kır
  abc_skip: {
    name: 'ABC SKIP — Duyguların Spirali Kır',
    description: 'A=Activating event, B=Belief, C=Consequence → Duyguyu değiştir',
    example: {
      A: 'Eşim mesaj yazmadı',
      B: 'Beni sevmiyor, terk edecek (düşünce)',
      C: 'Endişeli, ağlamak istiyorum',
      intervention: 'B\'yi değiştir',
      new_B: 'Meşgul olabilir, sevgi mesaj sayısıyla ölçülmez',
      new_C: 'Daha sakin, biraz endişeli ama yönetilebilir',
    },
  },
};

/**
 * Kullanıcının duygusal düzeyini değerlendir
 * @param {string} userMessage
 * @returns {{ emotionalIntensity: number, volatility: string, regulations: Array }}
 */
export function assessEmotionalRegulationNeed(userMessage) {
  const text = userMessage.toLowerCase();

  // Yoğunluk
  const intensityWords = [
    /çok|aşırı|dayanamıyorum|hiç|kimse|hep|asla|ölmek/gi,
  ];
  const intensity = intensityWords.filter(p => p.test(text)).length;

  // Volatilite (çabuk değişme)
  const volatilityWords = [
    /ama|fakat|one saniye sonra|hızlı değişme|bir an önce/gi,
  ];
  const volatility = volatilityWords.length > 0 ? 'high' : 'stable';

  // Hangi düzenleme tekniklerini sunmalı?
  const regulations = [];

  if (intensity >= 3) {
    regulations.push('ABC PLEASE');
  }

  if (text.includes('kızgın') || text.includes('öfke')) {
    regulations.push('Opposite Action');
  }

  if (
    text.includes('başarısız') ||
    text.includes('kimse') ||
    text.includes('asla')
  ) {
    regulations.push('Check the Facts');
  }

  if (text.includes('depres') || text.includes('hareket etmek')) {
    regulations.push('Opposite Action');
  }

  return {
    emotionalIntensity: Math.min(intensity * 33, 100),
    volatility,
    regulations: regulations.slice(0, 2), // İlk 2 teknik sun
  };
}

/**
 * Emotion Regulation bağlamı oluştur
 * @param {string} technique — 'abc_please' | 'opposite_action' | 'check_the_facts'
 * @returns {string}
 */
export function buildEmotionRegulationContext(technique = '') {
  const skills = EMOTION_REGULATION_SKILLS[technique];

  if (!skills) return '';

  let context = `[DBT — EMOTION REGULATION]\n`;
  context += `${skills.name}\n\n`;

  if (technique === 'abc_please') {
    context += `Duygusal istikrarın temeli:\n`;
    Object.entries(skills.skills).forEach(([key, skill]) => {
      context += `\n${key.toUpperCase()}: ${skill.name}\n`;
      if (skill.description) context += `→ ${skill.description}\n`;
      if (skill.examples) {
        context += `Örnekler:\n`;
        skill.examples.slice(0, 2).forEach(ex => {
          context += `  • ${ex}\n`;
        });
      }
    });
  } else if (technique === 'opposite_action') {
    context += `Duyguna karşı hareket et:\n`;
    Object.entries(skills.examples).forEach(([emotion, data]) => {
      context += `\n${emotion.toUpperCase()}:\n`;
      context += `Hissiyeceğin: "${data.feeling}"\n`;
      context += `Yap: ${data.opposite_action}\n`;
      context += `Spesifik:\n`;
      data.specific.slice(0, 2).forEach(act => {
        context += `  • ${act}\n`;
      });
    });
  } else if (technique === 'check_the_facts') {
    context += `Gerçekleri kontrol et:\n`;
    skills.steps.forEach(step => {
      context += `${step}\n`;
    });
    context += `\nÖrnek:\n`;
    context += `Düşünce: "${skills.examples.thought}"\n`;
    context += `Gerçek kanıtlar:\n`;
    skills.examples.facts.forEach(fact => {
      context += `  ✓ ${fact}\n`;
    });
  }

  context += `\n→ Bu teknik sonraki günlerde tekrar dene.`;

  return context;
}
