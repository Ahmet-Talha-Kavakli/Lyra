// lib/valuesClarification.js
// Değer Belirleme — Yaşam Değerleri ve Amaç Bulma
// ACT (Acceptance & Commitment Therapy) Değerler Modeli + Viktor Frankl Logoterapi
//
// Amaç: Yaşamda gerçekten önemli olanı bulma, değer-eylem hizalaması

const CORE_VALUE_DOMAINS = {
    family: {
        name: 'Aile (Family)',
        description: 'Aile üyeleriyle bağlantı, bakım, sadakat, sevgi',
        subcategories: ['ebeveyn-çocuk', 'eş/partner', 'kardeş', 'geniş aile', 'aile gelenekleri'],
        examples: [
            'Ebeveynlerimle kaliteli vakit geçirmek',
            'Çocuklarımın büyümesini desteklemek',
            'Aile toplantılarında hazır olmak',
        ],
        red_flag: 'Aile hayatı görmezden gelinince: mutsuzluk, pişmanlık, yalnızlık hissi',
    },

    friendship: {
        name: 'Dostluk (Friendship)',
        description: 'Anlamlı ilişkiler, sosyal bağlantı, destek ağı',
        subcategories: ['yakın arkadaş', 'sosyal grup', 'mentor ilişkiler', 'topluluk'],
        examples: [
            'Samimi arkadaş ilişkileri geliştirmek',
            'Grup aktivitelerine katılmak',
            'Başkalarını dinlemek ve anlamak',
        ],
        red_flag: 'Sosyal izolasyon: depresyon, anksiyete, boşluk hissi',
    },

    love_intimacy: {
        name: 'Aşk & İntimite (Love & Intimacy)',
        description: 'Romantik ilişki, cinsel/duygusal bağlantı, eş/partner',
        subcategories: ['romantik bağlantı', 'cinsel tatmin', 'duygusal yakınlık'],
        examples: [
            'Eşle derinden bağlanmak',
            'Cinsel hayata saygı göstermek',
            'Duygusal desteği almak ve vermek',
        ],
        red_flag: 'İlişki eksikliği: yalnızlık, anlamı kaybı, düşük motivasyon',
    },

    career_work: {
        name: 'Kariyer & İş (Career & Work)',
        description: 'Profesyonel başarı, kabiliyetleri geliştirme, maddi güvenlik',
        subcategories: ['başarı', 'uzmanlaşma', 'liderlik', 'finansal güvenlik'],
        examples: [
            'Alandımda ahli olmak',
            'Sağlam gelir elde etmek',
            'Menajer/lider pozisyonuna gelmek',
        ],
        red_flag: 'İş tatminsizliği: stresi, bireyin değeini düşürmesi, işkolik olma',
    },

    health_fitness: {
        name: 'Sağlık & Spor (Health & Fitness)',
        description: 'Fiziksel sağlık, egzersiz, beslenme, enerji',
        subcategories: ['fiziksel fitness', 'sağlıklı beslenme', 'uyku', 'stress management'],
        examples: [
            'Düzenli egzersiz yapmak',
            'Sağlıklı yemek kültürü',
            'Enerji ve vitaliteyi korumak',
        ],
        red_flag: 'Sağlık değeri görmezden: hastalanma, yaşam kalitesi düşme, depresyon',
    },

    creativity_expression: {
        name: 'Yaratıcılık & Ekspresyon (Creativity & Expression)',
        description: 'Sanat, yazı, müzik, kendini ifade, keşif',
        subcategories: ['sanat', 'müzik', 'yazı', 'hobi', 'öz-ekspresyon'],
        examples: [
            'Resim, müzik veya yazıyla kendimi ifade etmek',
            'Yeni şeyler öğrenmek ve keşfetmek',
            'Yaratıcı projeler yürütmek',
        ],
        red_flag: 'Yaratıcılık bastırılması: sıkıntı, rutinik hayat, mutsuzluk',
    },

    spirituality_meaning: {
        name: 'Maneviyat & Anlam (Spirituality & Meaning)',
        description: 'Din, maneviyat, hayat anlamı, aşkınlık',
        subcategories: ['din/inanç', 'meditasyon', 'felsefi sorgulama', 'hayat anlamı'],
        examples: [
            'Din pratiklerini yaşamak',
            'Meditasyon ve ruh sağlığı',
            'Hayatımın anlamını sorgulamak',
        ],
        red_flag: 'Manevi boşluk: anlamsızlık hissi, varoluşsal depresyon, kaybolmuşluk',
    },

    learning_growth: {
        name: 'Öğrenme & Büyüme (Learning & Growth)',
        description: 'Kişisel gelişim, eğitim, beceri öğrenme, öz-gelişim',
        subcategories: ['eğitim', 'kişisel gelişim', 'beceri öğrenme', 'entelektüel ilgi'],
        examples: [
            'Yeni beceriler öğrenmek',
            'Kitap okumak ve araştırma',
            'Kurslar ve sertifikalar almak',
        ],
        red_flag: 'Öğrenme durdurulması: stagnasyon, motivasyon kaybı, zeka alt-uyarımı',
    },

    community_contribution: {
        name: 'Toplum & Katkı (Community & Contribution)',
        description: 'Başkalarına yardım, gönüllülük, sosyal sorumluluk',
        subcategories: ['gönüllülük', 'hayırseverlik', 'sosyal adalet', 'mentor olma'],
        examples: [
            'Gönüllü çalışmak',
            'Başkalarını mentorluk etmek',
            'Toplumda değişim yaratmak',
        ],
        red_flag: 'Katkı eksikliği: anlamın kaybı, benmerkezcilik, toplumdan ayrılma',
    },

    adventure_experience: {
        name: 'Macera & Deneyim (Adventure & Experience)',
        description: 'Yeni deneyimler, seyahat, macera, keşif',
        subcategories: ['seyahat', 'risk almak', 'yeni ortamlar', 'kültür keşfi'],
        examples: [
            'Yeni ülkeler ziyaret etmek',
            'Yeni aktiviteler denemek',
            'Emniyetinin dışına çıkmak ve keşfetmek',
        ],
        red_flag: 'Monotoni ve stagnasyon: sıkıntı, yaşam cansız hissi, depresyon',
    },

    autonomy_freedom: {
        name: 'Özerklik & Özgürlük (Autonomy & Freedom)',
        description: 'Bağımsızlık, kendi kararlar alma, kontrol',
        subcategories: ['kararlar alma', 'finansal bağımsızlık', 'öz-belirlelik'],
        examples: [
            'Kendi kararlarımı almak',
            'Finansal olarak bağımsız olmak',
            'Hayatımdaki kontrol sahibi olmak',
        ],
        red_flag: 'Özerklik eksikliği: baskı, mutsuzluk, kimlik kaybı',
    },
};

/**
 * Değer eksikliğini tespit et
 * @param {string} userMessage
 * @returns {{ detectedValueGaps: Array, primaryGap: string, existentialEmpty: boolean }}
 */
export function detectValueGaps(userMessage = '') {
    const text = userMessage.toLowerCase();
    const gaps = [];

    // Aile
    if (/aile|ebeveyn|çocuk|ilişki|samimi|bağ/i.test(text) && /sorun|problem|uzak|derinde değil|mesafe/.test(text)) {
        gaps.push('family');
    }

    // Dostluk
    if (/yalnız|sosyal|arkadaş|grup|izole|kimse|bağlantı|konuş/i.test(text)) {
        gaps.push('friendship');
    }

    // Aşk & İntimite
    if (/ilişki|eş|partner|sevgi|yakınlık|romantik|cinsel/i.test(text) && /yok|eksik|hissetmiyorum|boş/.test(text)) {
        gaps.push('love_intimacy');
    }

    // İş & Kariyer
    if (/iş|kariyer|başarı|hayal|amaç|amacım|niye|anlam|purpose/.test(text)) {
        gaps.push('career_work');
    }

    // Sağlık
    if (/sağlık|enerji|yorgun|hareket|egzersiz|vücut|zihin/i.test(text) && /yok|yapamıyor|motivasyon/i.test(text)) {
        gaps.push('health_fitness');
    }

    // Yaratıcılık
    if (/sanat|müzik|yazı|resim|yaratıc|hobi|ekspres/i.test(text)) {
        gaps.push('creativity_expression');
    }

    // Maneviyat
    if (/din|anlam|amaç|niye|varoluş|boş|anlamı|ruh|maneviyat/i.test(text)) {
        gaps.push('spirituality_meaning');
    }

    // Öğrenme
    if (/öğren|kitap|kurs|gelişim|büyü|beceri|entellektuel/i.test(text)) {
        gaps.push('learning_growth');
    }

    // Toplum
    if (/toplum|yardım|gönüllü|sosyal|adalet|katkı/i.test(text)) {
        gaps.push('community_contribution');
    }

    // Macera
    if (/seyahat|macera|yeni|deneyim|keşif|monoton|sıkıntı/i.test(text)) {
        gaps.push('adventure_experience');
    }

    // Özerklik
    if (/bağımsız|kontrol|özgür|karar|baskı|kontrol/i.test(text)) {
        gaps.push('autonomy_freedom');
    }

    const existentialEmpty =
        /anlamı|niye|amaç|varoluş|boşluk|anlamsız|hiç|hiçbir|hissetmiyor|ruh|ölüm|ölmek|sorun yok/.test(text);

    return {
        detectedValueGaps: gaps.slice(0, 3),
        primaryGap: gaps[0] || null,
        existentialEmpty,
        hasValueGap: gaps.length > 0,
    };
}

/**
 * Değer açıklama bağlamı
 * @param {string} domainName
 * @returns {string}
 */
export function buildValuesClarificationContext(domainName = '') {
    if (!domainName || !CORE_VALUE_DOMAINS[domainName]) {
        return '';
    }

    const domain = CORE_VALUE_DOMAINS[domainName];
    let context = `[DEĞER AÇIKLAMASI — Yaşam Alanları]\n\n`;
    context += `Alan: ${domain.name}\n`;
    context += `Tanım: ${domain.description}\n\n`;

    context += `Örnekler:\n`;
    domain.examples.slice(0, 2).forEach(ex => {
        context += `  • ${ex}\n`;
    });

    context += `\nRisk: ${domain.red_flag}\n\n`;

    context += `[SORULAR]\n`;
    context += `1. Bu alan benim için ne kadar önemli? (1-10)\n`;
    context += `2. Şu anki durumda bu değeri yaşıyor muyum?\n`;
    context += `3. Eğer hayır ise, engel nedir?\n`;
    context += `4. Değerimi yerine getirmek için 1 adım ne olabilir?\n\n`;

    context += `→ Değer = yaşamı anlamlı yapan şey. Eylem = değeri yaşamak.`;

    return context;
}

/**
 * Değer-Eylem Hizalama Planı
 * @param {string} valueDomain
 * @param {number} currentAlignment — 0-100 (ne kadar align)
 * @returns {string}
 */
export function buildValueActionAlignmentPlan(valueDomain = 'family', currentAlignment = 50) {
    if (!CORE_VALUE_DOMAINS[valueDomain]) {
        return '';
    }

    const domain = CORE_VALUE_DOMAINS[valueDomain];
    const alignmentGap = 100 - currentAlignment;

    let plan = `[DEĞER-EYLEM HARITASI]\n\n`;
    plan += `Değeriniz: ${domain.name}\n`;
    plan += `Şu Anki Hizalama: ${currentAlignment}%\n`;
    plan += `Hizalama Boşluğu: ${alignmentGap}%\n\n`;

    plan += `[HİZALAMA BOŞLUĞU KAPATMA]\n\n`;

    if (alignmentGap >= 50) {
        plan += `🔴 KRITIK: Bu değer hayatınızda eksik!\n\n`;
        plan += `Haftaya yapmanız gerekenler:\n`;
        plan += `1️⃣ TANIMA: Bu değer neden eksik? (engel ne?)\n`;
        plan += `2️⃣ EYLEM: En küçük adım (15 dakika harcayıp olur)\n`;
        plan += `3️⃣ TESKİTET: Hergün pratikte etme\n`;
    } else if (alignmentGap >= 25) {
        plan += `🟡 ORTA: Kısmen yaşanıyor ama eksik\n\n`;
        plan += `Sürdürmek için:\n`;
        plan += `1️⃣ Mevcut rutine ekle\n`;
        plan += `2️⃣ Şu anki seviyeyi iki katına çıkart\n`;
        plan += `3️⃣ Sosyal destek bul\n`;
    } else {
        plan += `🟢 İYİ: Bu değer yaşanıyor!\n`;
        plan += `Devam et, derinleştir.\n\n`;
    }

    plan += `\n[30 GÜNLÜK DEĞER ÖDÖSÜne PLANI]\n`;
    plan += `Hafta 1: Farkındalık (gözlemle, not et)\n`;
    plan += `Hafta 2: Eylem başla (hergün 15 dakika)\n`;
    plan += `Hafta 3: Artta (30 dakikaya yükselt)\n`;
    plan += `Hafta 4: Köklülük (alışkanlık oldu mu?)\n\n`;

    plan += `→ Değer + Eylem = Anlamlı Hayat. Başla.`;

    return plan;
}

/**
 * 10 Değer Alanından Hayat Dengesi Raporu
 * @param {Object} valueScores — { family: 7, friendship: 5, ... }
 * @returns {string}
 */
export function buildValueBalanceReport(valueScores = {}) {
    const domains = Object.keys(CORE_VALUE_DOMAINS);
    let report = `[HAYAT DEĞERLERİ RAPORU]\n\n`;

    const scoredDomains = domains.map(d => ({
        domain: d,
        name: CORE_VALUE_DOMAINS[d].name,
        score: valueScores[d] || 5,
    }));

    const sortedByScore = [...scoredDomains].sort((a, b) => b.score - a.score);
    const avgScore = domains.reduce((sum, d) => sum + (valueScores[d] || 5), 0) / domains.length;

    report += `📊 Genel Ortalama: ${avgScore.toFixed(1)}/10\n\n`;

    report += `🟢 GÜÇLÜ ALANLAR (7+):\n`;
    sortedByScore.filter(x => x.score >= 7).forEach(x => {
        report += `  ✓ ${x.name}: ${x.score}/10\n`;
    });
    report += `\n`;

    report += `🟡 ORTA ALANLAR (4-6):\n`;
    sortedByScore.filter(x => x.score >= 4 && x.score < 7).forEach(x => {
        report += `  • ${x.name}: ${x.score}/10\n`;
    });
    report += `\n`;

    report += `🔴 ZAYIF ALANLAR (<4):\n`;
    sortedByScore.filter(x => x.score < 4).forEach(x => {
        report += `  ⚠️ ${x.name}: ${x.score}/10\n`;
    });
    report += `\n`;

    const weakestDomainName = sortedByScore[sortedByScore.length - 1].name;
    report += `⚡ FOKUS: "${weakestDomainName}" alanına odaklan (en düşük)\n`;
    report += `→ Hayat dengesi = tüm alanların yerine getirilmesi. Zayıf alanları güçlendir.`;

    return report;
}
