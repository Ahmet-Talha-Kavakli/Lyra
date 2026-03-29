// lib/dbtDistressTolerance.js
// DBT Distress Tolerance — krizde hızlı teknikleri, kendine zarar etmemeyi öğret
// İçinde kalmayı tolere et, geçişini bekle
//
// 4 başlık: Distract, Self-Soothe, TIPP, Radical Acceptance

const DISTRESS_TOLERANCE_SKILLS = {
  // DISTRACT — Dikkati başka yere çek
  distract: {
    name: 'DISTRACT — Dikkat Çek',
    description: 'Acı anlık, dikkatini başka yere çek, geçecek',
    methods: {
      activities: {
        title: 'Aktiviteler',
        examples: [
          'Spor yap (koş, yüz, bisiklet)',
          'Ev temizliği yap (enerji tüket)',
          'Müzik dinle ve dans et',
          'Kitap oku (aksiyon romanı)',
          'Video oyunu oyna',
          'Sanat yap (resim, yazı)',
        ],
      },
      people: {
        title: 'İnsanlarla Vakit Geçir',
        examples: [
          'Arkadaşa mesaj at',
          'Ailenin yanına git',
          'Telefonla konuş',
          'Grup aktivitesine katıl',
        ],
      },
      thoughts: {
        title: 'Düşünceleri Değiştir',
        examples: [
          'İlerlemesi: 1\'den 100\'e say',
          'Alfabe oyunu: Her harf için kelime bul (A=Apple, B=Ball)',
          'Hafızadan Şarkı söyle: Tüm sözleri hatırlamaya çalış',
          'Matematik: 2 ile çarp (100, 200, 400...)',
        ],
      },
      sensations: {
        title: 'Duyusal Dikkat',
        examples: [
          'Dış sesleri sayıyordum (kuş, araba)',
          'Nesnelerin renklerini bak',
          '5 duyunu aç: Gör, işit, kokla, tad, hisset',
        ],
      },
    },
  },

  // SELF-SOOTHE — Kendini yatıştır (5 duyu)
  self_soothe: {
    name: 'SELF-SOOTHE — Kendini Yatıştır',
    description: 'Canlı kalma sistemi açılmışsa, sakinleştir',
    senses: {
      vision: {
        sense: 'GÖRME',
        examples: [
          'Güzel fotoğraf bak',
          'Sanat müzesi (online)',
          'Doğa (ağaç, gökyüzü)',
          'Mum yaktığını izle',
        ],
      },
      sound: {
        sense: 'İŞİTME',
        examples: [
          'Sakinleştirici müzik (lo-fi, ambient)',
          'Doğa sesleri (orman, deniz)',
          'ASMR (fısıltı, tıkırtı)',
        ],
      },
      smell: {
        sense: 'KOKLAMA',
        examples: [
          'Lavanta (yastık, çiçek)',
          'Çay (chamomile, çiçek çayı)',
          'Doğal kokular (çam, ağaç)',
        ],
      },
      taste: {
        sense: 'TAD',
        examples: [
          'Sıcak çay (rahatlatıcı)',
          'Çikolata (bolbul)',
          'Meyve (tatlandırıcı)',
        ],
      },
      touch: {
        sense: 'DOKUNUŞ',
        examples: [
          'Yumuşak battaniye',
          'Sıcak duş',
          'Rahatlatıcı masaj',
          'Köpek/kedi sarılma',
        ],
      },
    },
  },

  // TIPP — Acil Teknikler (TIP = Vagus Siniri Etkinleştir)
  tipp: {
    name: 'TIPP — Acil Teknikler',
    description: 'Fiziksel paniği 10 dakika içinde durdur',
    techniques: {
      T: {
        name: 'Temperature — Sıcaklık Şoku',
        how: 'Buz tut yüzüne veya soğuk suya dalış',
        specific: [
          'Buz torbasını yüzüne 15-30 saniye tut',
          'Soğuk su yüzüne dökü',
          'Dondurucu çeşitliliğe gir (eğer varsa)',
        ],
        why: 'Vagus siniri uyarır, kalp hızı düşer, panic durur',
      },
      I: {
        name: 'Intense exercise — Yoğun Hareket',
        how: 'Kısa sürede çok enerji tüket',
        specific: [
          '100 birleşmiş (push-up gibi)',
          'Çok hızlı koş (2 dakika)',
          'Halı üzerinde dans (müzik eşliğinde)',
        ],
        why: 'Adrenalin sistemini dengeleme, yorgun kal',
      },
      P: {
        name: 'Paced breathing — Kontrollü Nefes',
        how: '4-6-8 nefes: 4 saniye içeri, 6 saniye tut, 8 saniye dışarı',
        specific: [
          'Uygulamayı öğren (hergün)',
          'Panic zamanında kullan',
        ],
        why: 'Parasempatik sistem aktivasyonu, sakinleşme',
      },
      P2: {
        name: 'Paired muscle relaxation — Kas Gevşetme',
        how: 'Kasları gerip gevşet',
        specific: [
          '5 saniye eller yumruk, gevşet',
          'Omuzları kaldır kulağa, gevşet',
          'Diğer tüm kas grupları',
        ],
      },
    },
  },

  // RADICAL ACCEPTANCE — Kabul
  radical_acceptance: {
    name: 'Radical Acceptance — Gerçeği Kabul Et',
    description: 'Değiştiremeyeceğini kabul et, acı azalır',
    principle: 'Direniş acıyı artırır. Kabullenme acıyı azaltır.',
    examples: {
      loss: {
        situation: 'Eşim ayrıldı (değiştiremez)',
        resistance: 'Bunu reddetme, "adil değil" diyerek ısrar',
        acceptance: '"Bu gerçek. Ağlayacağım ama yaşayacağım."',
        result: 'Acı var ama katlaşmaz, depresyon gelmez',
      },
      failure: {
        situation: 'Sınavı kaybettim (geçmiş)',
        resistance: '"Bunu değiştirebilseydim..." Pişmanlık spirali',
        acceptance: '"Kötü oldu. Bundan öğrendim. Devam."',
        result: 'Hüzün var ama panik yok',
      },
      health: {
        situation: 'Kronik hastalığım var (tedavi sınırlı)',
        resistance: '"Neden ben? Bu haksız!"',
        acceptance: '"Bununla yaşamayı öğrenmeliyim."',
        result: 'Depresyon azalır, öz-merhamet artar',
      },
    },
    steps: [
      '1. Gerçeği söyle: "Bu X değişmez"',
      '2. Dirençi gözlemle: "Bunu reddetmek istiyorum ama"',
      '3. Kabul et: "Kabul ediyorum, acı olsa da"',
      '4. Yaşa: Acının içinde kal, tepki verme',
    ],
  },
};

/**
 * Distress çok yüksekse, acil teknik öner
 * @param {Object} crisisIndicators — { suicidal, selfHarm, panic, dissociation }
 * @returns {{ technique: string, steps: Array, urgency: string }}
 */
export function recommendUrgentDistressTechnique(crisisIndicators = {}) {
  const { suicidal, selfHarm, panic, dissociation } = crisisIndicators;

  let technique = 'TIPP';
  let urgency = 'high';
  let steps = [];

  if (panic) {
    technique = 'TIPP';
    steps = [
      '1. Soğuk su yüzüne dök (15 saniye)',
      '2. Ağır nefes: 4-6-8 (3 döngü)',
      '3. 30 saniye koş veya zıpla',
      '4. İçinde kal, acı geçecek',
    ];
  }

  if (dissociation) {
    technique = 'DISTRACT + Self-Soothe';
    steps = [
      '1. 5-4-3-2-1 grounding (sensalar)',
      '2. Beden taraması (hisset)',
      '3. Müzik ve hareket',
    ];
  }

  if (selfHarm) {
    technique = 'DISTRACT + TIPP';
    steps = [
      '1. Buz tut (alternatif)',
      '2. Spor / yoğun hareket',
      '3. Arkadaşa mesaj at',
      '4. Hattı ara (0.800.273.8255)',
    ];
    urgency = 'critical';
  }

  if (suicidal) {
    urgency = 'emergency';
    steps = ['112 ara veya Hastaneye git — bunu Lyra yapamazsın'];
  }

  return {
    technique,
    steps,
    urgency,
  };
}

/**
 * Distress Tolerance bağlamı oluştur
 * @param {string} skillName — 'distract' | 'self_soothe' | 'tipp' | 'radical_acceptance'
 * @returns {string}
 */
export function buildDistressToleranceContext(skillName = '') {
  const skill = DISTRESS_TOLERANCE_SKILLS[skillName];

  if (!skill) return '';

  let context = `[DBT — DISTRESS TOLERANCE]\n`;
  context += `${skill.name}\n\n`;
  context += `${skill.description}\n\n`;

  if (skillName === 'distract') {
    context += `Seçenekler:\n`;
    Object.entries(skill.methods).forEach(([key, method]) => {
      context += `\n${method.title}:\n`;
      method.examples.slice(0, 2).forEach(ex => {
        context += `  • ${ex}\n`;
      });
    });
  } else if (skillName === 'self_soothe') {
    context += `5 Duyunu Kullan:\n`;
    Object.entries(skill.senses).forEach(([key, sense]) => {
      context += `\n${sense.sense}:\n`;
      sense.examples.slice(0, 2).forEach(ex => {
        context += `  • ${ex}\n`;
      });
    });
  } else if (skillName === 'tipp') {
    context += `Acil Teknikler:\n`;
    Object.entries(skill.techniques).forEach(([key, tech]) => {
      context += `\n${tech.name}: ${tech.how}\n`;
      context += `Neden: ${tech.why}\n`;
    });
  } else if (skillName === 'radical_acceptance') {
    context += `${skill.principle}\n\n`;
    context += `Örnekler:\n`;
    Object.entries(skill.examples).forEach(([key, ex]) => {
      context += `\n${ex.situation}\n`;
      context += `→ Kabullenme: "${ex.acceptance}"\n`;
    });
  }

  context += `\n→ Bu krizi geçeceksin. Acı geçici.`;

  return context;
}
