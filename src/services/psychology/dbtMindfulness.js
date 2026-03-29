// lib/dbtMindfulness.js
// DBT Mindfulness — şu anı gözlemle, yargılamadan
// Üç temel beceri: Observe, Describe, Participate
//
// Amaç: Zihin sakinleme, duygulardan ayrı kalma

const MINDFULNESS_SKILLS = {
  // Observe — Gözlemle
  observe: {
    name: 'Observe (Gözlemle)',
    description: 'Düşüncelerini, duygularını izle ama onlara kapılma',
    technique: 'Meditasyon ve günlük farkındalık',
    practice: {
      thoughts: {
        title: 'Düşünceleri Gözlemle',
        how: 'Düşünce geldi, izle, geçişine izin ver. "Bunu düşünüyorum" de.',
        example: `Düşünce: "Başarısızım"
Gözlem: "Bu bir düşünce, gerçek değil, dopamine yoksunluğu"
Sonuç: Düşünce hafifler`,
      },
      emotions: {
        title: 'Duyguları Gözlemle',
        how: 'Duygular fiziksel sensasyonlar. Yüksek kalp atışı, tense kas. Sadece gözlemle.',
        example: `Duygular: Endişe (kalp atıyor, kas gergin)
Gözlem: "Bu fizyoloji, geçici"
Sonuç: Duygular hafifler, kontrol edersin`,
      },
      sensations: {
        title: 'Body Scan (Vücut Taraması)',
        how: '5 dakika, baştan ayaklara tüm sensasyonlar. Ağrı, ısı, hareket, uyuşukluk.',
        why: 'Beynini şimdiye tutturuyor, endişeden çekiliyor',
      },
    },
  },

  // Describe — Tanımla
  describe: {
    name: 'Describe (Tanımla)',
    description: 'Yargılamadan, sade kelimelerle tarif et',
    technique: 'Duyguları ve düşünceleri yazı ile deşif et',
    practice: {
      emotions: {
        title: 'Duyguları Tanımla',
        how: 'Renk, şekil, hız, ağırlık gibi tanımla (insani değil)',
        example: `Duygu: Üzüntü
Tanım: "Ağır, gri, yavaş, göğüs ve karın bölgesinde"
Avantajı: Uzaklaş, gözlemci konumunda kal`,
      },
      thoughts: {
        title: 'Düşünceleri Tanımla',
        how: '"Bunu düşünüyorum ama inanmak zorunda değilim"',
        example: `Düşünce: "Yalnız kalacağım"
Tanım: "Bu bir kaygı düşüncesi, depresyondan geliyor"
Sonuç: Düşüncenin gücü azalır`,
      },
      writing: {
        title: 'Yaş Kerem (Günlük Yazma)',
        how: '10 dakika, duygularını yargılamadan yaz',
        why: 'Duygular çıkarılır, artık seninle değil, kağıtta',
      },
    },
  },

  // Participate — Katıl
  participate: {
    name: 'Participate (Katıl)',
    description: 'Şu ana tamamen katıl, aklını dışarı bırak',
    technique: 'Tam dikkat, otomatik olmayan hayat',
    practice: {
      activities: {
        title: 'Mindful Aktiviteler',
        examples: [
          'Yemek yeme: Her lokmayı tat, renk, doku, aroma',
          'Yürüme: Ayakların yere değme, nefes',
          'Müzik dinleme: Her nota, hisset',
          'Konuşma: Eşine tam odaklan, cep telefonu yok',
        ],
      },
      breathing: {
        title: 'Mindful Breathing',
        how: 'Nefes al, nefesi gözlemle, yargı yok, sadece şimdiki an',
        steps: [
          '1. Rahatlat, sessiz yer seç',
          '2. Burnundan nefes al, ağzından ver',
          '3. Zihni nefese bağla',
          '4. Zihni kaydığında, tekrar getir (öfkeli olma)',
          '5. 10 dakika devam et',
        ],
      },
    },
  },

  // Mindfulness Attitudes — Tutum
  attitudes: {
    name: 'Mindfulness Tutumları',
    description: 'Mindfulness nasıl pratik edilir?',
    attitudes: {
      non_judgment: 'Yargılamama: İyi/kötü deme, sadece gözlemle',
      patience: 'Sabır: Acele etme, her şey zamanında olur',
      acceptance: 'Kabullenme: Şu anı reddetme, kabul et',
      letting_go: 'Bırakma: Kontrolü bırak, akışına izin ver',
      trust: 'Güven: Vücuduna, aklına, değerlerine güven',
      open_mind: 'Açık Zihni: Ön yargıları bırak',
      gratitude: 'Minnet: Aldığın şeye şükreet, küçük veya büyük',
    },
  },
};

/**
 * Mindfulness egzersizi öner
 * @param {Object} state — { stress_level, anxiety, racing_thoughts }
 * @returns {{ exercise: string, duration: number, steps: Array }}
 */
export function recommendMindfulnessExercise(state = {}) {
  const { stress_level = 'moderate', anxiety, racing_thoughts } = state;

  let exercise = 'observe';
  let duration = 10;
  let steps = [];

  if (racing_thoughts) {
    exercise = 'observe';
    duration = 15;
    steps = [
      '1. Rahat et, sessiz yer',
      '2. Düşünceleri gelişi görmek için (video izliyormuş gibi)',
      '3. Yargı yok, sadece izle',
      '4. "Bunu düşünüyorum" de, ama bu ben değilim',
      '5. Tekrar aklına döndükçe hafif çek (öfkeli olma)',
    ];
  } else if (anxiety) {
    exercise = 'breathing';
    duration = 5;
    steps = [
      '1. Burnundan nefes (4 saniye)',
      '2. Tut (4 saniye)',
      '3. Ağızdan ver (6 saniye)',
      '4. 10 kez tekrar',
      '5. Bitir, rahat ol',
    ];
  } else if (stress_level === 'high') {
    exercise = 'body_scan';
    duration = 20;
    steps = [
      '1. Yat, göz kapat',
      '2. Sol ayaktan başla, tüm sensasyonları hisset',
      '3. Sol bacak, sağ bacak, karın, göğüs, omuzlar',
      '4. Hiçbir ağrı yok, sadece gözlemle',
      '5. Vücut hafif hissedecek',
    ];
  }

  return {
    exercise,
    duration,
    steps,
    note: 'Her gün 10 dakika mindfulness beynini değiştirir (8 hafta sonra)',
  };
}

/**
 * Mindfulness bağlamı oluştur
 * @param {string} skillName — 'observe' | 'describe' | 'participate'
 * @returns {string}
 */
export function buildMindfulnessContext(skillName = '') {
  const skill = MINDFULNESS_SKILLS[skillName];

  if (!skill) return '';

  let context = `[DBT — MINDFULNESS]\n`;
  context += `${skill.name}\n\n`;
  context += `${skill.description}\n\n`;

  if (skillName === 'observe') {
    context += `Gözlemle (Yargı yok):\n`;
    Object.entries(skill.practice).forEach(([key, practice]) => {
      context += `\n${practice.title}:\n${practice.how}\n`;
      if (practice.example) context += `\nÖrnek:\n${practice.example}\n`;
    });
  } else if (skillName === 'describe') {
    context += `Tanımla (Sade kelimelerle):\n`;
    Object.entries(skill.practice).forEach(([key, practice]) => {
      context += `\n${practice.title}:\n${practice.how}\n`;
      if (practice.example) context += `\nÖrnek:\n${practice.example}\n`;
    });
  } else if (skillName === 'participate') {
    context += `Katıl (Şu ana):\n`;
    Object.entries(skill.practice).forEach(([key, practice]) => {
      context += `\n${practice.title}:\n`;
      if (practice.examples) {
        practice.examples.slice(0, 2).forEach(ex => {
          context += `  • ${ex}\n`;
        });
      }
    });
  }

  context += `\n→ Mindfulness zihin antrenmanıdır. Her gün alıştır.`;

  return context;
}

/**
 * Basit 5-dakika meditasyon rehberi
 * @returns {string}
 */
export function buildQuickMeditationGuide() {
  return `[5-DAKİKA MEDITASYON]\n\n` +
    `1️⃣ Rahat et (0:00-0:30)\n` +
    `Sessiz yer seç, otur veya yat.\n\n` +
    `2️⃣ Nefes Al (0:30-4:00)\n` +
    `• Burnundan nefes (4 saniye)\n` +
    `• Tut (4 saniye)\n` +
    `• Ağızdan ver (6 saniye)\n` +
    `• 20 kez tekrar\n\n` +
    `3️⃣ Gözlemle (4:00-4:45)\n` +
    `Zihin kaydığında, hafif getir. Öfkeli olma.\n\n` +
    `4️⃣ Bitir (4:45-5:00)\n` +
    `Gözünü aç, yavaşça hareket et.\n\n` +
    `→ Hergün 5 dakika, 8 hafta sonra beynin değişti`;
}
