// lib/meaningAndPurpose.js
// Yaşam Amacı ve Anlam — Ikigai, Purpose, Existential Fulfillment
// Viktor Frankl Logotherapy + Ikigai (Japanese philosophy) + Positive Psychology
//
// Amaç: Hayatın anlamını bulma, varoluşsal sorguları yanıtlama, amaç inşası

const MEANING_SOURCES = {
    love_connection: {
        name: 'Sevgi & Bağlantı (Love & Connection)',
        description: 'Başkasını sevme ve sevilme deneyimi',
        significance: 'Maslow: bağlantı insan ihtiyacının tabanı',
        examples: [
            'Eş/partner sevgisi',
            'Çocuklara unconditional love',
            'Derin dostluk',
            'Ebeveyn sevgisi ve bakımı',
        ],
        activation: 'Başkasını sevme kararı verme → Eylem → Bağlantı → Anlam',
    },

    contribution_service: {
        name: 'Katkı & Hizmet (Contribution & Service)',
        description: 'Başkalarına yardım etme, sosyal etki',
        significance: 'Hayatın anlamı başkasına fayda vermekten gelir (Frankl)',
        examples: [
            'Gönüllü çalışma',
            'Mentor/öğretmen olma',
            'Toplumsal değişim',
            'Sosyal adalet mücadelesi',
        ],
        activation: 'Sorun tanıma → Çözüm hayal etme → Eylem → Etki → Anlam',
    },

    creativity_expression: {
        name: 'Yaratıcılık & Sanat (Creativity & Art)',
        description: 'Özgün ifade ve yaratıcı çalışma',
        significance: 'Kendini dünyaya ifade etmek, kalıcı miraz oluşturmak',
        examples: [
            'Yazı / şiir',
            'Müzik veya dans',
            'Sanat (resim, heykeltıraşlık)',
            'Bilim / araştırma',
            'Girişimcilik',
        ],
        activation: 'İç veri dinleme → Yaratıcı kaynak bulma → İfade → Anlam',
    },

    growth_mastery: {
        name: 'Büyüme & Ustalık (Growth & Mastery)',
        description: 'Beceri geliştirme, ekspertiz, kendini aşma',
        significance: 'İnsan büyümeye programlanmıştır (Csikszentmihalyi Flow)',
        examples: [
            'Sporda ustalık',
            'Bilim veya sanat tekniğinde derin yetkinlik',
            'Entelektüel keşif',
            'Kendi limitlerin aşması',
        ],
        activation: 'Challenge seç → Beceri geliştir → Flow → Mastery → Anlam',
    },

    transcendence_spirituality: {
        name: 'Aşkınlık & Maneviyat (Transcendence & Spirituality)',
        description: 'Kendinden büyük bir şeye bağlanma',
        significance: 'Din, inanç, doğa ile bağlantı, mistik deneyim',
        examples: [
            'Din ve ibadet',
            'Meditasyon / yoga',
            'Doğa bağlantısı',
            'Felsefe ve varoluş sorgusu',
            'Evrensel sevgi / kökü çıkma',
        ],
        activation: 'Meditasyon / sakin → İç kalmak → Bağlantı → Anlam',
    },

    legacy_immortality: {
        name: 'Miras & Kalıcılık (Legacy & Immortality)',
        description: 'Kendinden sonra kalan eser / etki',
        significance: 'Ölüm bilinci: "Ne bırakacağım?" sorusu anlamı verir',
        examples: [
            'Çocukları yetiştirmek',
            'Bilim / sanat yapıtı',
            'Aile geleneği / değerleri aktarma',
            'Vakıf / kuruluş kurmak',
            'Öğrenci / jenerasyon yetiştirmek',
        ],
        activation: 'Ölümlülüğü kabul → Hedef koy → Bugünü aksiyona dönüştür → Miras',
    },

    pleasure_joy: {
        name: 'Zevk & Sevinç (Pleasure & Joy)',
        description: 'Yaşama niyetine eğlenme, güzellik, lezzet',
        significance: 'Hayat acı olsa da anları tadına varma (Epicurus vs Hedonism)',
        examples: [
            'Doğa güzelliğini görmek',
            'Sevdikleriniz ile gülmek',
            'Lezzetli yemek',
            'Müzik, sanat, kültür',
            'Bedensel zevkler (makul)',
        ],
        activation: 'Farkındalık → Duyusal deneyim → Minnet → Anlam',
    },

    understanding_knowledge: {
        name: 'Anlama & Bilgi (Understanding & Knowledge)',
        description: 'Dünyayı anlamak, merak, keşif',
        significance: 'İnsan bilgi ihtiyacına sahip (Socrates: "Bilmek iyidir")',
        examples: [
            'Bilim araştırması',
            'Tarihi anlamak',
            'İnsan doğasını keşfetmek',
            'Kozmik ölçekte düşünmek',
            'Felsefe / varoluş soruları',
        ],
        activation: 'Merak → Araştırma → Anlama → Anlam',
    },
};

/**
 * Anlam eksikliğini ve varoluşsal sorularını tespit et
 * @param {string} userMessage
 * @returns {{ hasExistentialCrisis: boolean, meaningGaps: Array, crisisType: string }}
 */
export function detectExistentialCrisis(userMessage = '') {
    const text = userMessage.toLowerCase();
    const gaps = [];
    let crisisType = 'mild';

    // Purpose/meaning questions
    if (/niye|amaç|anlam|varoluş|anlamı|niye yaşıyorum|amacım|hedef/i.test(text)) {
        gaps.push('purpose');
        crisisType = 'moderate';
    }

    // Emptiness/void
    if (/boş|anlamsız|hiç|hiçbir|yapabilirim|değeri|worthless|void|hüzün|melankoli/i.test(text)) {
        gaps.push('emptiness');
        crisisType = 'severe';
    }

    // Legacy/mortality awareness
    if (/ölüm|ölmek|bırakacağım|miras|kalıcı|genç değilim|zaman|yaşlandım|mortal/i.test(text)) {
        gaps.push('mortality');
        crisisType = 'existential';
    }

    // Belonging/connection
    if (/yalnız|bağlantı|ait|toplum|aile|şirketinde|izole|cıkıştım|parçası|bağlı|bağım/i.test(text)) {
        gaps.push('belonging');
    }

    // Authenticity/identity
    if (/kimim|gerçek|sahte|rol|yaşıyor değilim|yaşıyorum|kimliğim|kendim/i.test(text)) {
        gaps.push('authenticity');
    }

    // Freedom/autonomy
    if (/özgür|kontrolü|bağlantılı|seçim|karar|kendi|özerklik|çaresiz/i.test(text)) {
        gaps.push('freedom');
    }

    if (gaps.includes('emptiness') && gaps.includes('mortality')) {
        crisisType = 'critical';
    }

    return {
        hasExistentialCrisis: gaps.length > 0,
        meaningGaps: gaps,
        crisisType,
        isProfound: crisisType === 'critical' || crisisType === 'existential',
    };
}

/**
 * Anlam bağlamı oluştur
 * @param {string} sourceName — love_connection, contribution_service, etc.
 * @returns {string}
 */
export function buildMeaningContext(sourceName = '') {
    if (!sourceName || !MEANING_SOURCES[sourceName]) {
        return '';
    }

    const source = MEANING_SOURCES[sourceName];
    let context = `[YAŞAM ANLAMI — Anlam Kaynakları]\n\n`;
    context += `Kaynak: ${source.name}\n`;
    context += `Tanım: ${source.description}\n`;
    context += `Anlam: ${source.significance}\n\n`;

    context += `Örnekler:\n`;
    source.examples.slice(0, 2).forEach(ex => {
        context += `  • ${ex}\n`;
    });

    context += `\nAktivasyonu: ${source.activation}\n\n`;

    context += `[SORAN]\n`;
    context += `• Bu kaynak şu anda benim hayatımda var mı?\n`;
    context += `• Neden var veya neden yok?\n`;
    context += `• 1 adım atarak bu kaynağı açabilir miyin?\n\n`;

    context += `→ Anlam = doğaldır, bulunur. Eylem = anlam açtığın kapı.`;

    return context;
}

/**
 * Ikigai (Japonça: yaşamın sebebi) haritası
 * @param {Object} ikigaiData — { passion, skill, value, income }
 * @returns {string}
 */
export function buildIkigaiMap(ikigaiData = {}) {
    const { passion = '', skill = '', value = '', income = '' } = ikigaiData;

    let map = `[İKİGAİ HARITASI — 4 Çeyrek Yaşam]\n\n`;

    map += `1️⃣ TUTKU (Passion)\n`;
    map += `   Ne yapmaktan seviyorsun? (İçsel sevinç)\n`;
    map += `   Siz: ${passion || 'Örnek: Yazı yazmak, öğretim'}\n\n`;

    map += `2️⃣ BECERİ (Skill/Craft)\n`;
    map += `   Ne konusunda iyisin? (Yetkinlik, uzmanlık)\n`;
    map += `   Siz: ${skill || 'Örnek: Yazı, yönetim, sanat'}\n\n`;

    map += `3️⃣ DEĞER (Value to World)\n`;
    map += `   Dünyaya ne katabilirsiz? (Katkı, anlam)\n`;
    map += `   Siz: ${value || 'Örnek: İnsanlara ilham, eğitim, özlü sanat'}\n\n`;

    map += `4️⃣ GELİR (Income/Sustenance)\n`;
    map += `   Bundan yaşayabilir misin? (Ekonomik hayat)\n`;
    map += `   Siz: ${income || 'Örnek: Yazı satışı, öğretim ücreti'}\n\n`;

    map += `[İKİGAİ MERKEZÎ — 4'ün Kesişimi]\n`;
    map += `Sev, yapabilir, verirsin VE geçinirsin → İKİGAİ\n`;
    map += `Yaşam AMAÇI burada bulunur.\n\n`;

    map += `[AÇIKLAMALAR]\n`;
    if (passion && skill && value && !income) {
        map += `• Tutku+Beceri+Değer ama GELİR YOK: "Hayat çalışması" (şu an para yok)\n`;
        map += `  → Para kaynağı bul, bu işi haftasonu / yan husus yap\n\n`;
    }
    if (passion && skill && income && !value) {
        map += `• Tutku+Beceri+Gelir ama DEĞER: "İstediğini yapıyorsun ama dünyaya vermiyor"\n`;
        map += `  → Artı: sosyal etki katabilir misin?\n\n`;
    }
    if (passion && value && income && !skill) {
        map += `• Tutku+Değer+Gelir ama BECERİ: "Biliyorsun amaç ama yetersiz hissediyorsun"\n`;
        map += `  → Eğitim al, mentorla, beceri geliştir\n\n`;
    }

    map += `→ Ikigai = yaşamın sebebi. Dört çeyreği hizalayan kişi, anlamlı yaşar.`;

    return map;
}

/**
 * Hayat amaçlandırma egzersizi (30 dakika)
 * @returns {string}
 */
export function buildPurposeFindingExercise() {
    return `[30 DAKİKA YAŞAM AMACI EGZERSIZI]\n\n` +
        `(Yalnız, sessiz, yazılı)\n\n` +
        `1️⃣ ÖLÜM MEDITASYONU (5 dakika)\n` +
        `"100 yaşında ölüyorum. Arkada ne bırakacağım?"\n` +
        `Sessiz otur, bu soruya odaklan.\n\n` +
        `2️⃣ YAŞAM HATIRASI (10 dakika)\n` +
        `Yaşamınızın en mutlu anlarını yazın (5-10 an):\n` +
        `• Ne yapıyordunuz?\n` +
        `• Kim vardı?\n` +
        `• Neden mutlu hissettiniz?\n\n` +
        `3️⃣ ORTAK TEMA (5 dakika)\n` +
        `Bu anların ortak özellikleri:\n` +
        `• Sevgi mi? Başarı mı? Özgürlük mü?\n` +
        `• Yaratıcılık mı? Bağlantı mı?\n\n` +
        `4️⃣ AMAÇ CÜMLESİ (10 dakika)\n` +
        `"Benim yaşam amacım..."\n` +
        `Cümleyi yazmayı deneyebilirsin (basit, kısa).\n` +
        `Mükemmel olması zorunlu değil, başlama kafi.\n\n` +
        `→ Bulduğun amaç: bunun için ne harcayacaksın?`;
}

/**
 * Hayat yazı egzersizi
 * @returns {string}
 */
export function buildLifeLetterExercise() {
    return `[BENİME MEKTUP — Kendime Söylemek İstediklerim]\n\n` +
        `Amaç: Kendi iç sesini dinlemek.\n\n` +
        `Tavalimat:\n` +
        `1. Yazı dökün (30 dakika)\n` +
        `2. Censor etmeyin (kimse görmeyecek)\n` +
        `3. Gerçek yaz (söylemek istediklerini)\n\n` +
        `Sorular (rehber):\n` +
        `• Bana söylemek istediklerin neler?\n` +
        `• Neden böyle hissediyorum?\n` +
        `• Hayatımda neyi değiştirmeliyim?\n` +
        `• Neyle ödün vermem gerekir?\n` +
        `• Neyi seviyorum (gerçekte)?\n\n` +
        `Sonra:\n` +
        `Yazıyı oku, en önemli 3 satırı altını çiz.\n` +
        `Bu 3 satır = senin iç sesinin bildirimleri.\n\n` +
        `→ İç ses dinleme = amaç bulma başlangıcı.`;
}
