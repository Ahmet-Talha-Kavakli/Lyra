// lib/immigrantExperience.js
// Göçmen Deneyimi — Kültür Şoku, Yerçekimi, Kimlik Karması, Adaptasyon
// İç göçmen, uluslararası göçmen, mülteci deneyimi
//
// Amaç: Göçmen psikolojisini anlama, yerçekimi hissi, kültür şoku, uyum faz

// ─── KÜLTÜR ŞOKU 4 AŞAMASI (Oberg Modeli) ──────────────────────────────────────

/**
 * Geçişte yaşanan psikolojik deneyim aşamaları
 */

const CULTURE_SHOCK_STAGES = {
    honeymoon: {
        stage: '1️⃣ Bal Ayı (Honeymoon)',
        duration: 'İlk 2-4 hafta',
        characteristics: [
            'Heyecan, merak, iyimizm',
            'Yeni kültürün her şeyi harika görünür',
            'Farkları "ilginç" olarak algılama',
            'Enerji yüksek, moral yüksek',
        ],
        mood: '😊 Pozitif ama pozan',
        risk: 'Düşüş gelecek bilmeyen başlar ağlama',
    },
    frustration: {
        stage: '2️⃣ Hayal Kırıklığı (Frustration)',
        duration: '1-2 ay',
        characteristics: [
            'Gerçeklik dayak: Dil anlaşılmıyor, kurallar tuhaf',
            'Ev özlemi artıyor, batıyor, depresyon',
            'Kültür farkı tüketici olur: Çok zor, çok farklı',
            'Yalnızlık, yabancılık, eğersizlik',
            'İnsanların "tuhaf" göründüğünü/dinlemediğini hisseder',
        ],
        mood: '😞 Depresyon, öfke, umutsuzluk',
        risk: 'YÜKSEK: İntihar riski, geri dönme köktü isteği',
    },
    adaptation: {
        stage: '3️⃣ Uyum (Adjustment)',
        duration: '3-6 ay',
        characteristics: [
            'Farkları anlamaya başlıyor, kabulleniyor',
            'Ev yeniden çıkıyor artık kültürle (hibrit)',
            'Dil geliştiriliyor, ilişki inşası',
            'Mizah ve perspektif geliyor',
            'Kimliği "burada + orada" ikilikinde kuruluş',
        ],
        mood: '🟡 Dönem dönem iyi, dönem dönem zor',
        risk: 'Orta: Yoğunlaşma gerekliyse',
    },
    acceptance: {
        stage: '4️⃣ Kabulleniş (Acceptance)',
        duration: '6-12 ay+',
        characteristics: [
            'Yeni kültürü benimsemiş ama kökeğini unutmadı',
            'Hibrit kimlik: "İkisi arasında yaşıyor"',
            'Evim 2 yer var, ait olduğum 2 grup var',
            'Kültürel değerler karışıyor (olumlu)',
            'Adaptasyon başarısı, yeni sosyal ağ',
        ],
        mood: '🟢 Sakin, ait, özgüvenli',
        risk: 'Düşük: Entegrasyon sağlandı',
    },
};

// ─── GÖÇMEN PSIKOLOJIK ZORLUKLAR ──────────────────────────────────────────────

const IMMIGRANT_CHALLENGES = {
    identity_confusion: {
        challenge: 'Kimlik Karması (Identity Confusion)',
        description: 'Yeni ülkede kim miyim? Buraya ait miyim? Eski kimlik geçti mi?',
        examples: [
            'Dil ile kimlik değişiyor (Türkçede başkası, İngilizcede başkası)',
            'Giyim/davranış yeni kültürü taklit vs orijinalimi kaybet',
            'Aile baskısı: "Köktüğün unutma" vs "Burada yaşıyorsun"',
        ],
        impact: 'Dissosiasyon, kimlik kaybı, depresyon',
        healing: 'Hibrit kimlik (both/and) yap. Hepsi senin parçası.',
    },
    language_barrier: {
        challenge: 'Dil Engeli',
        description: 'Yeni dili konuşmakta zorluk, sosyal izolasyon, yetersizlik hissi',
        examples: [
            'Sürüde gülüşler anlaşılmıyor, hariç hissediliyor',
            'Profesyonel eksiklik: Ülkeden daha düşük pozisyon',
            'Telefonla konuşma, bürokratik prosesler anlaşılmıyor',
        ],
        impact: 'Sosyal kaygı, özgüven kaybı, izolasyon',
        healing: 'Dil kursları, topluluk pratikleri, sabır kendine',
    },
    discrimination: {
        challenge: 'Ayrımcılık (Discrimination)',
        description: 'Irk, aksent, kültür nedeniyle marjinalleştirme, şiddet riski',
        examples: [
            'İş/barınma reddedilir aksent/isimsiz',
            'Caddede yüzüne bakmamalar, tekme/sözel saldırı',
            'Kültürel pratikler (başörtüsü, dua) dışlanıyor/sorgulanıyor',
        ],
        impact: 'Travma, içleştirilmiş ırkcılık, PTSD, korku',
        healing: 'Güvenli topluluk bulma, savunma, terapileme',
    },
    economic_hardship: {
        challenge: 'Ekonomik Zorluk',
        description: 'Kaynaklar düşük, vasıflı işler kabul edilmiyor, maddi stres',
        examples: [
            'İç göçmen: Başkentte ev pahalı, işsiz',
            'Uluslararası: Kredileri kabul edilmiyor, paralı işler',
            'Eğitim: Tanınan değil, yeniden eğitim maliyeti',
        ],
        impact: 'Stres, anksiyete, bağımlılık riski, aile kopuşu',
        healing: 'Ekonomik planlama, kaynak bulma, çalışma danışmanlığı',
    },
    homesickness: {
        challenge: 'Ev Özlemi (Homesickness)',
        description: 'Derin nostalji, sevdikleri özleme, geçmiş yaşamın kaybı',
        examples: [
            'Belirli yerler/sezonlar çok ağrı: Bayram, doğum günü',
            'Ebeveyn yaşlanıyor, ziyaret imkansız',
            'Arkadaş, sosyal çevre yok, telefonla iletişim yeterli değil',
        ],
        impact: 'Depresyon, yalnızlık, suçuluk (gitmişsin)',
        healing: 'Ev ile bağlantı (kültür, dil), yeni aile inşa, kabulleniş',
    },
    status_insecurity: {
        challenge: 'Durum İnsecurity\'si (Status Insecurity)',
        description: 'Yasal/sosyal durum belirsiz, deportation riski, haklarsızlık',
        examples: [
            'Belgesiz göçmen: Gözüne kolay almış, polis korkusu',
            'Vize belirsiz: Nereler yapabilir, risk nedir?',
            'Çalışma izni yok: Siyah pazarda çalışmak',
        ],
        impact: '⚠️ KRITIK: Sürekli korku, paranoia, tuzak hissi',
        healing: 'Hukuki danışman, haklar bilgisi, güvenli topluluk',
    },
};

// ─── GÖÇMEN PSIKOLOJI TÜRLERİ ──────────────────────────────────────────────────

const MIGRANT_TYPES = {
    voluntary_migrant: {
        type: 'Seçmeli Göçmen (Seçti gitti)',
        motivation: 'Yüksek eğitim, kariyer, para, macera',
        advantage: 'Motivasyon yüksek, amaç açık',
        challenge: 'Başarı baskısı, ebeveyn korkusu, geri dönme şartı',
    },
    forced_migrant: {
        type: 'Zorla Göçmen (Mecbur kaldı)',
        motivation: 'Çatışma, işsizlik, temiz değilim, gözünde olmamak',
        advantage: 'Hiçbiri, sadece hayatta kalış',
        challenge: '⚠️ TRAVMALı: Travma + adaptasyon=double burden',
    },
    refugee: {
        type: 'Mülteci (Ülkeden kaçtı)',
        motivation: 'Savaş, gözetim, soykırım, fiziksel tehlike',
        advantage: 'Sağında kalması başarı sayılır',
        challenge: '🔴 ÇOK TRAVMALı: Ülke öfkesi, kaybı, suçuluk, PTSD',
    },
    internal_migrant: {
        type: 'İç Göçmen (Ülke içinde değişti)',
        motivation: 'Daha iyi yaşam, iş, okul, özbeklik',
        advantage: 'Aynı ülke, dil kolay',
        challenge: 'Kültür farkı (bölgeler), sosyal köpsüz, aile mesafe',
    },
};

// ─── DETECT & ASSESS ──────────────────────────────────────────────────────────

/**
 * Göçmen deneyimi ve kültür şoku aşamasını tespit et
 * @param {string} userMessage
 * @param {Object} userProfile — { migrationTime, origin, currentLocation }
 * @returns {{ isMigrant: boolean, migrantType: string, cultureShockStage: string, severity: string }}
 */
export function detectImmigrantExperience(userMessage = '', userProfile = {}) {
    const text = userMessage.toLowerCase();
    let severity = 'low';
    let stage = '';
    let migrantType = '';

    // Göçmen tespiti
    const isMigrant = /göçmen|mülteci|kaçtım|geldim|yurtdışında|ayrıldım|yeni ülke|başkentte|ülke değiş/i.test(text);

    if (!isMigrant) {
        return { isMigrant: false, migrantType: '', cultureShockStage: '', severity: '' };
    }

    // Kültür şoku aşaması
    const migrationMonths = userProfile?.migrationMonths || 0;
    if (migrationMonths <= 1) {
        if (/heyecanlı|meraklı|güzel|harika/i.test(text)) {
            stage = 'honeymoon';
            severity = 'low';
        } else {
            stage = 'honeymoon_to_frustration';
            severity = 'medium';
        }
    } else if (migrationMonths <= 6) {
        if (/depresyon|yalnız|ev|özle|zor|zorluk|kaygı|panik/i.test(text)) {
            stage = 'frustration';
            severity = 'high';
        } else {
            stage = 'adaptation';
            severity = 'medium';
        }
    } else {
        if (/alıştım|ait|hibrit|2 yer/i.test(text)) {
            stage = 'acceptance';
            severity = 'low';
        } else {
            stage = 'frustration_stuck';
            severity = 'high';
        }
    }

    // Göçmen türü
    if (/kaçtım|savaş|tehlike|güvenlik/i.test(text)) migrantType = 'refugee';
    else if (/seçtim|hayat|kariyer|okul|para/i.test(text)) migrantType = 'voluntary_migrant';
    else if (/mecbur|aile|evli|is/i.test(text)) migrantType = 'forced_migrant';
    else if (/başkentte|ülke içi|taşındım|kentsel/i.test(text)) migrantType = 'internal_migrant';

    // Zorlukları tespit
    if (/dil|anlama|konuş|sorun|zorluğu/i.test(text)) severity = 'high';
    if (/ayrımcılık|ırkçılık|şiddet|tehlike|korku/i.test(text)) severity = 'critical';

    return {
        isMigrant: true,
        migrantType: migrantType || 'unknown',
        cultureShockStage: stage,
        severity,
    };
}

/**
 * Mülteci/kaçtı deneyimi tespit et (kritik)
 * @param {string} userMessage
 * @returns {{ isRefugee: boolean, traumaRisk: boolean, urgency: string }}
 */
export function detectRefugeeTrauma(userMessage = '') {
    const text = userMessage.toLowerCase();

    const indicators = [
        /savaş|çatışma|bomba|atış|kurşun|öldü|baskı|işkence|gözetim/i,
        /kaçtım|menem|güvenlik|korkuyor|tehlike|hayatım/i,
        /aile kayıp|evsiz|belgesi|status/i,
    ];

    const hasIndicator = indicators.some(reg => reg.test(text));

    let traumaRisk = false;
    let urgency = 'routine';

    if (/intihar|ölmek|kütüp|neden yaşıyorum|dayanamıyorum/i.test(text)) {
        traumaRisk = true;
        urgency = 'critical';
    } else if (hasIndicator) {
        traumaRisk = true;
        urgency = 'high';
    }

    return {
        isRefugee: hasIndicator,
        traumaRisk,
        urgency,
    };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * Kültür şoku aşaması bağlamı
 * @param {string} stageName — 'honeymoon', 'frustration', 'adaptation', 'acceptance'
 * @returns {string}
 */
export function buildCultureShockContext(stageName = '') {
    if (!stageName || !CULTURE_SHOCK_STAGES[stageName]) {
        return '';
    }

    const stage = CULTURE_SHOCK_STAGES[stageName];
    let context = `[KÜLTÜR ŞOKU — 4 AŞAMA (Oberg)]\n\n`;
    context += `${stage.stage}\n`;
    context += `Tipik Süre: ${stage.duration}\n\n`;

    context += `Karakteristikler:\n`;
    stage.characteristics.forEach(char => {
        context += `  • ${char}\n`;
    });

    context += `\nDuygu Durumu: ${stage.mood}\n`;
    context += `Risk Seviyesi: ${stage.risk}\n\n`;

    context += `[KÜLTÜR ŞOKU NORMALDİR]\n`;
    context += `Bu evreleri yaşamak doğal. Seni "zayıf" yapan değil, insani yaptığın.\n`;
    context += `Aşama sonunda, hibrit kimlik ve yeni eve sahip olacaksın.\n`;
    context += `→ Kültür şoku = büyüme fırsat.`;

    return context;
}

/**
 * Göçmen özlemi ve ev bağlantı stratejisi
 * @returns {string}
 */
export function buildHomesicknessHealing() {
    return `[EV ÖZLEMİ VE BAĞLANTIV SABRITİ]\n\n` +
        `1️⃣ EV İLE BAĞLANTINI TUT:\n` +
        `  • Dilin konuş (ebeveynle haftada 1x)\n` +
        `  • Kültürel yiyecekleri yap/bul\n` +
        `  • Müzik/film kültürüne dönüş\n` +
        `  • Başka göçmenlerle bağlantı kur\n\n` +
        `2️⃣ YENİ EVE BAĞLANTINI KUR:\n` +
        `  • Yerel aktivitelere katıl\n` +
        `  • Seçilmiş aile (new friends) inşa et\n` +
        `  • Yeni yerleri keşfet (evin parçaları olur)\n` +
        `  • Kültür melez kültür (2 tarafın en iyisi)\n\n` +
        `3️⃣ KABULLENIŞ FAZI:\n` +
        `  • 6-12 aydan sonra nostalji hafifler\n` +
        `  • Evi ziyaret etmek tatil olur, eve dönme değil\n` +
        `  • Kendinizi 2 yerde aitmek normal/güzel\n` +
        `  • Ev tarafı kalp, yeni tarafı yaşam\n\n` +
        `→ Ev özlemi = sevgidir. Geçecek, ama hafifçe kalacak.`;
}

/**
 * Mülteci/Travmalı Göçmen Acil Müdahalesi
 * @returns {string}
 */
export function buildRefugeeTraumaCare() {
    return `[MÜLTECI/KAÇTI TRAVMA — ACİL MÜDAHALE]\n\n` +
        `🔴 DURUM: Savaş/gözetim/işkence deneyimi\n` +
        `Psikiyatrik Durum: PTSD olasılığı %60-80\n\n` +
        `ŞU ANDA YAPMAN GEREKENLER:\n` +
        `1️⃣ GÜVENLIK: Fiziksel güvenlik sağlandı mı? İhtiyacınız ne?\n` +
        `2️⃣ İLETİŞİM: Sevilenlere ulaşan var mı? Başka seçim?\n` +
        `3️⃣ SAĞLIK: Tıbbi durum? İlaç? Konsultasyon?\n` +
        `4️⃣ HUKUK: Sınaması status? Havaliman/vize?\n` +
        `5️⃣ TOPLULUK: Mülteci/göçmen destek ağı\n` +
        `6️⃣ RUHSAL: Travma terapisti (EMDR, CPT)\n\n` +
        `TEKNİK DESTEK:\n` +
        `• Uluslararası Kızılhaç / UNHCR\n` +
        `• Yerel mülteci merkezleri\n` +
        `• Terapist: Travma eğitimi, LGBTQ+ friendly (eğer var)\n` +
        `• Dil: Tercüman bulma\n\n` +
        `[BU GEÇECEĞİNİ BİL]\n` +
        `Travma derin ama iyileşme mümkün.\n` +
        `Hayatta kaldın = güç var. Terapileme = hayat yeniden inşası.\n` +
        `→ Mülteciliğinden sonraki yaşam = devam edebilen yaşam.`;
}
