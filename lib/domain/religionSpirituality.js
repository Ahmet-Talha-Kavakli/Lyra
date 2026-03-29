// lib/religionSpirituality.js
// Din, Maneviyat ve Terapilerin Entegrasyonu
// İnanç sistemleri, manevi kriz, ahlaki çatışmalar, anlam kaynağı olarak din
//
// Amaç: Din/maneviyatla uyumlu terapi, inanç çatışmalarını çözmek, manevi kaynak

// ─── DİN VE MANEVIYAT BAĞLAMLAR ────────────────────────────────────────────

const RELIGIOUS_TRADITIONS = {
    islam: {
        name: 'İslam',
        key_values: ['tawakkul (güven)', 'sabır (sabır)', 'dua', 'cemaat (topluluk)', 'halal/haram'],
        therapy_alignment: 'Meditasyon = tahajjud (gece duası), dua = mindfullness, sabır = resilience',
        potential_conflicts: ['ruh sağlığının dini olduğu inanışı', 'psikolojik yardım fetva sorgusu', 'cinsel kimlik/cinsiyet'],
        affirming_approach: 'Duanın terapötik gücü, İslami kaynaklar kullan, imamla iş birliği',
    },
    christianity: {
        name: 'Hristiyanlık',
        key_values: ['affedicilik', 'sevgi', 'güven', 'şefaat', 'topluluk/kilise'],
        therapy_alignment: 'Affedicilik = duygusal serbest bırakma, sevgi = bağlantı terapisi, güven = dostoeyevski vb',
        potential_conflicts: ['suçluluk (günah)', 'cinsel kimlik/LGBTQ+ red', 'tıbbi kaynaklı soru'],
        affirming_approach: 'Affedicilik terapisi, kilisenin destekleyici tarafını kulla, teoloji danışmanı ol',
    },
    judaism: {
        name: 'Yahudilik',
        key_values: ['topluluk', 'bilge tartışma (talmudic)', 'adalet/tzedakah', 'şabat', 'geçmiş (Holokost)'],
        therapy_alignment: 'Tartışma = kognitif esneklik, topluluk = sosyal destek, tzedakah = katkı',
        potential_conflicts: ['antisemitizm ve güvenlik', 'kimlik ve asimilasyon', 'nesiller arası travma'],
        affirming_approach: 'Topluluk kaynakları, geçmiş tanıma, Holokost farkındalığı',
    },
    buddhism: {
        name: 'Budizm',
        key_values: ['meditasyon', 'acıdan kurtulma', 'metta (sevgi-kindness)', 'şimdiki an', 'karma'],
        therapy_alignment: 'Meditasyon = mindfulness terapisi, metta = empati, şimdiki = DBT aksept',
        potential_conflicts: ['fatalizm (karma)', 'kadercilik terapiye engel', 'duygular bastırma inanışı'],
        affirming_approach: 'Meditasyon rehberi, karma anlayışını açıkla, beden farkındalığı kulla',
    },
    hinduism: {
        name: 'Hinduizm',
        key_values: ['dharma (görev)', 'yoga', 'mantra', 'reinkarnasyon', 'tapasya (ascesis)'],
        therapy_alignment: 'Yoga = beden-duygu entegrasyonu, dharma = amaç, mantra = afirmasyonlar',
        potential_conflicts: ['kasta temelli suçluluk', 'karma = kendini suçlama', 'ebeveyn otoritesi'],
        affirming_approach: 'Yoga/pranayama entegrasyonu, dharma = sağlıklı görev, karma = seçim özgürlüğü',
    },
    secular: {
        name: 'Seküler/Ateist',
        key_values: ['akılcılık', 'bilim', 'özerklik', 'insan merkezcilik', 'evrim'],
        therapy_alignment: 'Akılcılık = kognitif terapisi, özerklik = seçim özgürlüğü, anlam = humanist',
        potential_conflicts: ['dini aile fertleri', 'ölüm kaygısı', 'anlam kriziş (varoluş)'],
        affirming_approach: 'Humanist değerler, akılcı davranış, existensiyel terapiye açık',
    },
    agnostic_spiritual: {
        name: 'Agnostik/Spiritüel (tanımlanmamış)',
        key_values: ['arayış', 'meditasyon', 'doğa', 'evrensel sevgi', 'bilinmeyene saygı'],
        therapy_alignment: 'Meditasyon, doğa terapisi, varoluş felsefesi, açıklık',
        potential_conflicts: ['tanımsızlık stresi', 'aile baskısı (din seç)', 'anlam bulma zor'],
        affirming_approach: 'Arayışı destekle, meditasyon rehberi, varoluş terapisini kulla',
    },
};

// ─── MANEVİ KRİZ TÜPÜ ──────────────────────────────────────────────────────

const SPIRITUAL_CRISIS_TYPES = {
    dark_night_of_soul: {
        name: 'Ruhun Karanlık Gecesi (Dark Night)',
        description: 'Derin manevi boşluk, Tanrı/anlam kaybı, imanın sorgulanması',
        examples: ['dua işe yaramıyor hissi', 'inanç sisteminden uzaklaşma', 'ölüm/acı "niçin" sorusu'],
        response: 'Sabrı, evre açıkla, dini danışman ile iş birliği, varoluş terapisi',
    },
    crisis_of_faith: {
        name: 'İnanç Krizi',
        description: 'Dini öğretilerin sorgulanması, dogma vs bilim çatışması',
        examples: ['din namazı yalamaz hissi', 'bilim vs inanç çatışması', 'aile inancını reddetme'],
        response: 'Her iki tarafı saygıyla dinle, çatışma çöz, seçim özgürlüğü tut',
    },
    moral_injury: {
        name: 'Ahlaki Yaralanma (Moral Injury)',
        description: 'Dini/ahlaki değerleri ihlal etti hissi (örn. günah), derin suçluluk',
        examples: ['premarital seks yaptı', 'dini kurallı çığ dönüştü', 'dini otoriteyi reddetti'],
        response: 'Affedicilik terapisi, dini lider ile tuzlaşma, kendini affet',
    },
    identity_conflict: {
        name: 'Kimlik Çatışması',
        description: 'Dini kimlik vs modern/LGBTQ+ kimlik çatışması',
        examples: ['İslam vs eşcinsel kimlik', 'Hristiyan vs agnostik', 'dini vs laik yaşam'],
        response: 'Her iki tarafı validle, bütünleştir, gurur kaynağı bul',
    },
    doubt_and_questioning: {
        name: 'Kuşku ve Sorgulama',
        description: 'Dini doktrin hakkında ciddi şüpheler, öğretilere karşı sorular',
        examples: ['Tanrı neden bu yaptı?', 'dini kitabın çelişkili yerleri', 'diğer dinler hakkında soru'],
        response: 'Sorgulamayı destekle, teolojik tartışma, imanını yeniden bul',
    },
};

// ─── DETECT & ASSESS ──────────────────────────────────────────────────────────

/**
 * Dini/manevi durum tespit et
 * @param {string} userMessage
 * @returns {{ hasReligiousConcern: boolean, religiousTheme: string, crisisType: string, faith: string }}
 */
export function detectReligionSpirituality(userMessage = '') {
    const text = userMessage.toLowerCase();
    let faith = '';
    let theme = '';
    let crisisType = '';

    // Din tespiti
    if (/dua|namaz|quran|kur'an|ahmet|müslüman|islam/i.test(text)) faith = 'islam';
    else if (/tanrı|deus|kilise|mesih|hristiyanlık|incil/i.test(text)) faith = 'christianity';
    else if (/allah|muhammet|ezan|camii|vb/i.test(text)) faith = 'islam';
    else if (/yoga|dharma|karma|mantra|brahman|hindu/i.test(text)) faith = 'hinduism';
    else if (/meditasyon|budha|bodhi|nirvana|dharma/i.test(text)) faith = 'buddhism';
    else if (/ruh|spiritüel|evren|tanrısal|holistik|çakra/i.test(text)) faith = 'agnostic_spiritual';
    else if (/ateist|seküler|bilim|akılcı|din yok/i.test(text)) faith = 'secular';

    // Tema tespiti
    if (/dua|ibadet|namaz|ayın/i.test(text) && /yapamıyor|işe yaramıyor|boş/i.test(text)) {
        theme = 'spiritual_emptiness';
        crisisType = 'dark_night_of_soul';
    }
    if (/inanç|din|inandığım|tanrı|kuşku|soruş|gerçekmiş/i.test(text)) {
        theme = 'faith_questioning';
        crisisType = 'crisis_of_faith';
    }
    if (/suçlu|günah|haram|ahlak|yanlış|yapmasaydım/i.test(text)) {
        theme = 'moral_guilt';
        crisisType = 'moral_injury';
    }
    if (/kimlik|gay|lezbiyen|trans|eşcinsel|cinsel|kimim/i.test(text)) {
        theme = 'identity_conflict';
        crisisType = 'identity_conflict';
    }

    return {
        hasReligiousConcern: !!faith || !!theme,
        religiousTheme: theme,
        crisisType,
        faith,
    };
}

/**
 * Din aile baskısı tespit et
 * @param {string} userMessage
 * @returns {{ hasFamilyReligionPressure: boolean, pressureType: string, severity: string }}
 */
export function detectReligionFamilyPressure(userMessage = '') {
    const text = userMessage.toLowerCase();

    let pressureType = '';
    let severity = 'low';

    if (/aile|ebeveyn|anne|baba|istiyorlar|söylemişler|yapmalısın/i.test(text)) {
        if (/dua|ibadet|din|dindar|geleneksel/i.test(text)) {
            pressureType = 'religious_practice_pressure';
            severity = 'medium';
        }
        if (/evlilik|partner|seç|izin/i.test(text) && /dine|dini|imam|haham/i.test(text)) {
            pressureType = 'marriage_pressure';
            severity = 'high';
        }
        if (/kızacak|azarlayacak|reddetecek|ayrılacak/i.test(text)) {
            severity = 'critical';
        }
    }

    return {
        hasFamilyReligionPressure: !!pressureType,
        pressureType,
        severity,
    };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * Din/maneviyat bağlamı oluştur
 * @param {string} faithTradition — 'islam', 'christianity', 'buddhism', etc.
 * @returns {string}
 */
export function buildReligionSpiritualityContext(faithTradition = '') {
    if (!faithTradition || !RELIGIOUS_TRADITIONS[faithTradition]) {
        return '';
    }

    const tradition = RELIGIOUS_TRADITIONS[faithTradition];
    let context = `[DİN & MANEVİYAT — Terapi Entegrasyonu]\n\n`;
    context += `Din/Yaşam Tarzı: ${tradition.name}\n\n`;

    context += `📖 Temel Değerler:\n`;
    tradition.key_values.forEach(val => {
        context += `  • ${val}\n`;
    });

    context += `\n🔄 Terapilere Entegrasyon:\n`;
    context += `${tradition.therapy_alignment}\n\n`;

    context += `⚠️ Olası Çatışmalar:\n`;
    tradition.potential_conflicts.forEach(conf => {
        context += `  • ${conf}\n`;
    });

    context += `\n✅ Yaklaşım:\n`;
    context += `${tradition.affirming_approach}\n\n`;

    context += `[TERAPİ KURSU]\n`;
    context += `Dinin terapileme gücü var. Terapi inanç sistemine karşı değil, onunla birlikte.\n`;
    context += `Seninki saygılı, ama senin seçim hakkın vardır.\n`;
    context += `→ Manevi + psikolojik sağlık = bütün.`;

    return context;
}

/**
 * Manevi kriz müdahalesi
 * @param {string} crisisType — 'dark_night_of_soul', 'crisis_of_faith', etc.
 * @returns {string}
 */
export function buildSpiritualCrisisMudahale(crisisType = '') {
    if (!crisisType || !SPIRITUAL_CRISIS_TYPES[crisisType]) {
        return '';
    }

    const crisis = SPIRITUAL_CRISIS_TYPES[crisisType];
    let mudahale = `[MANEVİ KRİZ — Müdahale]\n\n`;
    mudahale += `Kriz Türü: ${crisis.name}\n`;
    mudahale += `Tanım: ${crisis.description}\n\n`;

    mudahale += `Örnekler:\n`;
    crisis.examples.forEach(ex => {
        mudahale += `  • ${ex}\n`;
    });

    mudahale += `\nTerapötik Yaklaşım:\n`;
    mudahale += `${crisis.response}\n\n`;

    mudahale += `[DİNİ KRİZLERDE BİLGİLER]\n`;
    mudahale += `Manevi kriz = yeniden inşa dönemedir.\n`;
    mudahale += `Bu acı, eski inancı ölümüne, yenisini doğumuna yol açabilir.\n`;
    mudahale += `Bir dini lider (imam/rahip/rabb) ile iş birliği önemli.\n`;
    mudahale += `→ Kriz = varoluş terapisinin kapısı.`;

    return mudahale;
}

/**
 * Din-aile-kimlik hizalama rehberi
 * @returns {string}
 */
export function buildReligionFamilyIdentityGuide() {
    return `[DİN-AİLE-KİMLİK HIZALAMA]\n\n` +
        `3 Taraf: Dini Kimlik + Aile Beklentileri + Kişisel Seçim\n\n` +
        `Çatışma Ne Zaman Oluşur?\n` +
        `• Din ≠ Aile beklentileri (ör: İslam ama modern yaşamak istiyorum)\n` +
        `• Din ≠ Kişisel kimlik (ör: Müslüman ama eşcinsel)\n` +
        `• Aile ≠ Kişisel seçim (ör: Aile ibadet istiyor, ben istemiyor)\n\n` +
        `Üç Seçenek:\n` +
        `1️⃣ BÜTÜNLEŞTIR: Dini kültürü modern yaşamla harmanda kur\n` +
        `   Örnek: "İslam'ın kalp merkezini tutarım ama formlar değişebilir"\n` +
        `2️⃣ SEÇ: Yeni bir yol bul (modernist/reformist yorumlama)\n` +
        `   Örnek: "Benim İslam'ım kalbımde, toplum değilse sorun değil"\n` +
        `3️⃣ BRÉK: Din/aile ile yolunu ayır (radikal seçim)\n` +
        `   Örnek: "Atam ateist oldum, güvenli ortamda yaşayacağım"\n\n` +
        `Hangi Seçim?\n` +
        `Senin değerlerin + seçim özgürlüğü + Aileyle ilişki kalitesi\n` +
        `Hiçbir seçim yanlış, seninki doğru.\n` +
        `→ Dış baskıdan BAĞIMSIZ seç, sonra sonuçları kabullen.`;
}
