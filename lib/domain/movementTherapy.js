// lib/movementTherapy.js
// Hareket Terapisi — Fiziksel Aktivite ve Ruh Sağlığı Bağlantısı
// John Ratey "Spark" modeli, Exercise Physiology, Somatic Psychology
//
// Amaç: Duygu durumuna göre optimal hareket türü önerme ve motivasyon

const MOVEMENT_TYPES = {
    high_intensity: {
        name: 'Yüksek Enerji Hareket',
        description: 'Hızlı, yoğun, adrenalin arttırıcı — kaygı, öfke, enerji yoksunluğu için',
        examples: [
            'Koşu (30 dakika)',
            'HIIT (yüksek interval antrenmanı)',
            'Tenis, futsal',
            'Kickboks, hızlı yürüyüş (5+ km/h)',
            'Zumba, dans',
        ],
        benefits: [
            'Adrenalin kontrollü şekilde harcama',
            'Seratonin boost (30+ dakika sonra)',
            'Kaygı düşürme',
            'Enerji arttırma',
        ],
        duration: '20-40 dakika',
        frequency: '3-5x/hafta',
        best_for: ['anxiety', 'energy_depletion', 'restlessness'],
    },

    moderate_steady: {
        name: 'Orta Tempolu Hareket',
        description: 'Sürdürülebilir, sosyal, zihinsel yenileme — depresyon, sosyal izolasyon için',
        examples: [
            'Yürüyüş (normal tempo, 4-5 km/h)',
            'Bisiklet (rekreasyonel)',
            'Yüzme (rahat)',
            'Ev yapılan egzersizler (45 dakika)',
            'Sosyal spor (voleybol, basketbol)',
        ],
        benefits: [
            'Seratonin artışı (30+ dakika)',
            'Sosyal bağlantı (grup aktiviteleri)',
            'Dış ortam, doğa (vitamin D)',
            'Depresyon hafiflemesi',
        ],
        duration: '30-60 dakika',
        frequency: 'Günlük veya 5-6x/hafta',
        best_for: ['depression', 'isolation', 'low_motivation'],
    },

    gentle_mindful: {
        name: 'Nazik, Bilinçli Hareket',
        description: 'Yavaş, odaklı, sinirsel sistem sakinleştirici — stress, trauma, overstimulation için',
        examples: [
            'Yoga (hatha, yin)',
            'Tai Chi',
            'Qigong',
            'Pilates',
            'Gerileme + esnetme (stretching)',
            'Yavaş yürüyüş meditasyon',
        ],
        benefits: [
            'Parasempatik sistem aktivasyon (sakinleşme)',
            'Kas gerilimi serbest bırakma',
            'Beden farkındası',
            'Kaygı düşürme (öfkeden farklı olarak)',
        ],
        duration: '20-45 dakika',
        frequency: 'Günlük veya her gün',
        best_for: ['stress', 'trauma', 'overstimulation', 'insomnia'],
    },

    dance_expressive: {
        name: 'Dansa Dayalı Hareket',
        description: 'Yaratıcı, emosyonel ekspresyon — bastırılmış duygular, yaratıcılık, neşe için',
        examples: [
            'Özgür dans (müziğe göre hareket)',
            'Zumba',
            'Hiphop, kontemporer dans',
            'Müzik terapisi + hareket',
            'Kardiyak dans fitness (sektilerin dansı)',
        ],
        benefits: [
            'Emosyonel ekspresyon',
            'Yaratıcılık ve keşif',
            'Sosyal bağlantı',
            'Seratonin ve endorfin boost',
            'Beden bütünlüğü hissi',
        ],
        duration: '20-60 dakika',
        frequency: '2-3x/hafta',
        best_for: ['suppressed_emotions', 'creativity', 'anhedonia', 'isolation'],
    },

    nature_outdoor: {
        name: 'Doğa Tabanlı Hareket',
        description: 'Açık havada, doğa ortamında — depresyon, anksiyete, doğa bağlantısı eksikliği',
        examples: [
            'Orman yürüyüşü',
            'Dağcılık',
            'Kamp',
            'Bahçecilik (bahçe işleri)',
            'Su sporları (kayak, sörf)',
            'Kuş gözlemciliği',
        ],
        benefits: [
            'Vitamin D ve ışık terapisi',
            'Stres hormonu kortizol düşürme',
            'Doğa bağlantısı (biophilia)',
            'Zihinsel yenileme (ART — Attention Restoration)',
        ],
        duration: '30-120 dakika',
        frequency: '2-3x/hafta minimum',
        best_for: ['depression', 'anxiety', 'seasonal_affective_disorder', 'burnout'],
    },
};

/**
 * Ruh durumuna göre optimal hareket türü tespit et
 * @param {string} userMessage
 * @returns {{ detectedEmotions: Array, recommendedMovement: string, intensity: string, urgency: string }}
 */
export function detectMovementNeed(userMessage = '') {
    const text = userMessage.toLowerCase();
    const detected = [];

    // Anxiety detection
    if (/kaygı|endişe|huzursuz|titrem|nefes|kalp|korkuyorum|sinir/i.test(text)) {
        detected.push({ emotion: 'anxiety', movement: 'high_intensity' });
    }

    // Depression detection
    if (/depres|umutsuz|amaç|motivasyon|yalnız|boş|anlamı|değer/i.test(text)) {
        detected.push({ emotion: 'depression', movement: 'moderate_steady' });
    }

    // Stress & overstimulation
    if (/stress|overstim|yorgun|uyku|kopma|dayanamı|sakin|huzur|parasempatik/i.test(text)) {
        detected.push({ emotion: 'stress', movement: 'gentle_mindful' });
    }

    // Suppressed emotions / blocked feelings
    if (/bastırıl|blok|expres|yaratıc|neşe|coşku|ruhsal/i.test(text)) {
        detected.push({ emotion: 'suppressed', movement: 'dance_expressive' });
    }

    // Isolation & burnout
    if (/yalnız|izole|sosyal|grup|dostluk|insanlar|doğa|sakinlik/i.test(text)) {
        detected.push({ emotion: 'isolation', movement: 'nature_outdoor' });
    }

    // Seasonal / weather sensitivity
    if (/mevsim|kış|karanlık|güneş|hava|dış ortam|açık/i.test(text)) {
        detected.push({ emotion: 'seasonal', movement: 'nature_outdoor' });
    }

    // Restlessness & excess energy
    if (/rahatlanmıyor|dalgalı|hareket|mekik|titreş|enerji|fiziksel|hareketsiz/i.test(text)) {
        detected.push({ emotion: 'restlessness', movement: 'high_intensity' });
    }

    const primaryDetection = detected[0] || null;
    const recommendedMovement = primaryDetection?.movement || 'moderate_steady';
    const urgency = detected.length > 0 ? 'high' : 'low';
    const intensity =
        recommendedMovement === 'high_intensity'
            ? 'Yüksek (20-40 dakika)'
            : recommendedMovement === 'moderate_steady'
              ? 'Orta (30-60 dakika)'
              : 'Nazik (20-45 dakika)';

    return {
        detectedEmotions: detected.map(d => d.emotion),
        recommendedMovement,
        intensity,
        urgency,
        hasMovementNeed: detected.length > 0,
    };
}

/**
 * Hareket terapisi bağlamı oluştur
 * @param {string} movementType — high_intensity, moderate_steady, gentle_mindful, dance_expressive, nature_outdoor
 * @returns {string}
 */
export function buildMovementContext(movementType = '') {
    if (!movementType || !MOVEMENT_TYPES[movementType]) {
        return '';
    }

    const movement = MOVEMENT_TYPES[movementType];
    let context = `[HAREKET TERAPİSİ — Fiziksel Aktivite]\n\n`;
    context += `Tür: ${movement.name}\n`;
    context += `Açıklama: ${movement.description}\n\n`;

    context += `Örnekler:\n`;
    movement.examples.slice(0, 3).forEach(ex => {
        context += `  • ${ex}\n`;
    });

    context += `\nFaydalı Etkiler:\n`;
    movement.benefits.slice(0, 3).forEach(benefit => {
        context += `  • ${benefit}\n`;
    });

    context += `\nSüre: ${movement.duration}\n`;
    context += `Sıklık: ${movement.frequency}\n\n`;

    context += `[HEMEN BAŞLA]\n`;
    context += `Bugün: 15 dakika ile başla. Momentum başlarsa uzat.\n`;
    context += `Sonra: Rutin haline getir (7-14 gün sonra otomatik olur).\n\n`;

    context += `→ Beyin değişiminin en hızlı yolu: hareket.`;

    return context;
}

/**
 * Haftasal hareket planı
 * @param {string} movementType
 * @returns {string}
 */
export function buildWeeklyMovementPlan(movementType = 'moderate_steady') {
    const movement = MOVEMENT_TYPES[movementType] || MOVEMENT_TYPES.moderate_steady;

    let plan = `[HAFTASAL HAREKET PLANI]\n\n`;
    plan += `Tür: ${movement.name}\n`;
    plan += `Toplam Süresi: ${movement.frequency}\n\n`;

    plan += `📅 HAFTALı TAKVIM:\n\n`;

    const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const frequency = movement.frequency.includes('Günlük')
        ? 7
        : movement.frequency.includes('5-6')
          ? 5
          : movement.frequency.includes('3-5')
            ? 3
            : movement.frequency.includes('2-3')
              ? 2
              : 1;

    for (let i = 0; i < days.length; i++) {
        const isActive = i < frequency;
        if (isActive) {
            plan += `✅ ${days[i]}: ${movement.duration}\n`;
        } else {
            plan += `⏸️ ${days[i]}: Dinlenme / Hafif streç (10 dakika)\n`;
        }
    }

    plan += `\n[MOTIVASYON TUYOLU]\n`;
    plan += `1. Başlama başarısı > Performans\n`;
    plan += `2. Aynı saatte her gün (rutinleştir)\n`;
    plan += `3. Başına: "Ne yapacağım?" değil "Başlıyorum" (minik adım)\n`;
    plan += `4. Birlikte yap (arkadaş, grup, uygulama)\n`;
    plan += `5. Hava durusu bahane değil (iç ortamda, hava nasıl olursa olsun)\n\n`;

    plan += `→ 14 gün sonra otomatik hale gelecek. 30 gün sonra seratonin artışı hissedeceksin.`;

    return plan;
}

/**
 * Hareket bariyerleri ve çözümleri
 * @param {string} barrier — e.g., "yorgunluk", "motivasyon_yok", "vücut_sorunu"
 * @returns {string}
 */
export function buildMovementBarrierSolution(barrier = '') {
    const barriers = {
        fatigue: {
            problem: 'Çok yorgun, hareket edemiyorum',
            solutions: [
                '5 dakika başla (seratonin artış başlıyor)',
                'Hafif hareket: yürüyüş, streç, yoga',
                'Sabah güneş (vitamin D) → enerji artışı',
                'Uyku kalitesini iyileştir önce',
            ],
        },
        motivation: {
            problem: 'Motivasyonum yok, başlamak istenmiyorum',
            solutions: [
                'Amaç ört (sağlık değil, ruh hallı olma)',
                'Minik adım: 5 dakika → 10 → 20',
                'Sosyal: arkadaş çağır veya grup sınıfı',
                'Müzik: seç favorite playlistini',
            ],
        },
        pain_injury: {
            problem: 'Fiziksel ağrı veya yaralanma',
            solutions: [
                'Doktor konsultasyonu (gerekli)',
                'Alternatif: yüzme, yoga, pilates (düşük etki)',
                'Fizyoterapist ile özel plan',
                'Beden farkındası (yoga) yaralanma onarabilir',
            ],
        },
        time: {
            problem: 'Zamanım yok',
            solutions: [
                '5-10 dakika hergün > 60 dakika haftada bir',
                'Çok kısa: merdiven çık, ayakta çalış, ev egzersizleri',
                'İş ortamında: ofiste yürü, masada esnet',
                'Ulaşım: araba yerine yürü veya bisiklet',
            ],
        },
        weather: {
            problem: 'Hava kötü, dışarı çıkamıyorum',
            solutions: [
                'İç ortam: ev egzersizleri, uygulama (YouTube)',
                'Sosyal: dışarı çıkma zorunlu (grup, ders)',
                'Hava diye şey yok, sadece uygunsuz kıyafet var',
                'Saç / makyaj kaygısı: egzersizin yüzde 1i',
            ],
        },
    };

    const solution = barriers[barrier];
    if (!solution) return '';

    let result = `[HAREKET BARİYERİ — ${solution.problem}]\n\n`;
    result += `Çözümler:\n`;
    solution.solutions.forEach((sol, i) => {
        result += `${i + 1}. ${sol}\n`;
    });
    result += `\n→ Bariyerin kaldırılması = başlama. Başladıktan sonra momentum otomatik.`;

    return result;
}

/**
 * Hareket sonrası duygusal durum
 * @returns {string}
 */
export function buildMovementMoodBoost() {
    return `[HAREKET SONRASI DUYGU DEĞIŞIMI]\n\n` +
        `0-5 dakika: Kaygı, direnç ("İstenim yok")\n` +
        `5-15 dakika: Başladım, momentum başlıyor\n` +
        `15-20 dakika: Endorfin ilk dalgası (hafif iyi)\n` +
        `20-40 dakika: Seratonin artışı (daha iyi, net düşünce)\n` +
        `40+ dakika: Flow state, mutluluk hissi\n` +
        `Sonrasında: 4-12 saat daha iyi ruh hali\n\n` +
        `Kurallı olan şey: Başlama. Hissin değişmesi otomatik olacak.`;
}
