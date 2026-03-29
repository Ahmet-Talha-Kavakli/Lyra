// lib/lgbtqInclusion.js
// LGBTQ+ Kapsayıcı Terapi — Coming Out, Güvenlik, Topluluk, Aile Reddi
// Cinsiyet kimliği, cinsel yönelim, validasyon, güvenli ortam
//
// Amaç: LGBTQ+ kişilere affirming (destekleyici) terapi, coming out yardımı, güvenlik planı

// ─── LGBTQ+ KİMLİK SPEKTRUMU ──────────────────────────────────────────────────

const LGBTQ_PLUS_IDENTITIES = {
    lesbian: {
        identity: 'Lezbiyen (Lesbian)',
        definition: 'Kadın kimliği ile kadınlara romantik/cinsel çekim',
        unique_challenges: ['toplum damgası', 'görünürlük eksikliği', 'aile reddi riski', 'heteronormativity basığı'],
        strengths: ['kadın güç ağları', 'feminist değerler', 'güçlü topluluk'],
        therapeutic_focus: 'İçleştirilmiş homofobi, aile dinamikleri, ilişki inşası',
    },
    gay: {
        identity: 'Eşcinsel Erkek (Gay)',
        definition: 'Erkek kimliği ile erkeklere romantik/cinsel çekim',
        unique_challenges: ['erkeklik sorgulaması', 'AIDS damgası (tarihi)', 'aile reddi, özellikle ataerkil kültürlerde', 'güvenlik riski'],
        strengths: ['queer sanat/kültür', 'topluluk dayanışması', 'yaratıcılık'],
        therapeutic_focus: 'Maskulinite yeniden tanımı, aile baskısı, güvenlik stratejileri',
    },
    bisexual: {
        identity: 'Biseksüel (Bisexual)',
        definition: 'Birden fazla cinsiyete romantik/cinsel çekim',
        unique_challenges: ['her iki taraftan reddetilme', 'erase edilme ("karar ver")', 'ilişki şüpheleri'],
        strengths: ['kimlik esnekliği', 'geniş bakış', 'grup aidiyeti'],
        therapeutic_focus: 'Biseksüel hayalet varlığı, ilişki güveni, seçim validasyonu',
    },
    transgender: {
        identity: 'Transgender',
        definition: 'Doğum sertifikasındaki cinsiyet ≠ cinsiyet kimliği',
        unique_challenges: ['cinsiyeti geçiş süreci (tıbbi/sosyal)', 'hukuki değişiklikler', 'aile reddi', 'dysphoria', 'şiddet riski'],
        strengths: ['kendini yeniden yaratma', 'bireysel cesaret', 'kendi hakikat', 'trans topluluk'],
        therapeutic_focus: 'Gender dysphoria, geçiş planlaması, aile ilişkileri, güvenlik, travma (eğer var)',
    },
    non_binary: {
        identity: 'Non-Binary/Genderqueer',
        definition: 'Cinsiyetin erkek/kadın ikilikinin dışında, spektrumdaki konumlanma',
        unique_challenges: ['dil eksikliği (zamirler)', 'sosyal tanınması zor', 'hukuki tanınma', 'medikallaştırma baskısı'],
        strengths: ['cinsiyeti yeniden tasarlama', 'ötesi olmak gücü'],
        therapeutic_focus: 'Kendini tanımla, sosyal validasyon, beden ilişkisi, özerklik',
    },
    ace_asexual: {
        identity: 'Aseksüel / Ace Spectrum',
        definition: 'Cinsel çekim yok veya düşük, cinsel arzu eksikliği veya nadire',
        unique_challenges: ['cinselliğin normalleştirilmesi', 'ilişki beklentileri', 'tıbbi "tedavi" önerileri', 'toplum baskısı'],
        strengths: ['cinsellik dışı bağlantı', 'bağımsızlık', 'kendi şartları'],
        therapeutic_focus: 'Cinsellik normalleştirmesi, ilişki tasarımı, sosyal baskıya karşı korunma',
    },
    queer: {
        identity: 'Queer',
        definition: 'Umbrella term: LGBTQ+ kimlikler + cinselliğin sıvılığı + normatif karşıtlık',
        unique_challenges: ['kimlik tanımsızlığı rahatız', 'toplum kategorileştirmesi', 'aktivizm baskısı'],
        strengths: ['kimlik özgürlüğü', 'normatif reddi', 'siyasi bilince'],
        therapeutic_focus: 'Kimlik arayışı, toplum baskısı, aktivizm dengesi',
    },
};

// ─── COMING OUT AŞAMALARI ──────────────────────────────────────────────────────

const COMING_OUT_PHASES = {
    preparation: {
        phase: '1️⃣ HAZIRLIK',
        duration: '2-4 hafta',
        tasks: [
            'Kendini hazırla: "Kimim, bunu niye söylüyorum?"',
            'Güvenli ortamı değerlendir: İlişki durumu, tepki riski',
            'Plan yap: Nereye/kime/nasıl/ne zaman?',
            'Destek bulun: LGBTQ+ topluluk, terapist, güvenli arkadaş',
            'Senaryo prova: "Nasıl cevaplar vereyim?"',
        ],
    },
    disclosure: {
        phase: '2️⃣ AÇIKLAMA',
        duration: 'Anında (dakika/saat)',
        tasks: [
            'Sakin ortam seç (hassas tartışma için)',
            'Basit dil kullan: Karmaşık açıklamalar kafasını karıştırır',
            '"Ben asla bu konuda değişmeyeceğim" = sınır',
            'Soruların cevaplarını bil ama çok açıklama yapma',
            'Tepki sırasında duygusal olmaktan korkma',
        ],
    },
    integration: {
        phase: '3️⃣ ENTEGRASYON',
        duration: 'Aylar',
        tasks: [
            'Yeni normalleşme: Kimliğini doğal şekilde yaşa',
            'Aile/dostların adaptasyonunu destekle (sabır)',
            'Çıkartılan çatışmaları çöz (tekrarlayan sorular)',
            'Kendi ihtiyaçları (sağlık, sosyal) karşıla',
            'Yeni bağlantılar kur (LGBTQ+ topluluk)',
        ],
    },
    ongoing: {
        phase: '4️⃣ DEVAM EDEN YÖNETİM',
        duration: 'Yaşam boyu',
        tasks: [
            'Coming out sürekli (yeni insanlara, yeni ortamlara)',
            'Kimliğini savun (sınırlar koy)',
            'Reddi işle (eğer olursa)',
            'Topluluk desteği tut',
            'Kendini sevmeyi pratikle',
        ],
    },
};

// ─── OLUMSUZ COMING OUT REAKSİYONLARI ────────────────────────────────────────

const NEGATIVE_REACTIONS = {
    denial: {
        reaction: 'Inkar',
        examples: ['"Bu bir faz, geçecek"', '"Emin misin?"', '"Belki yanlış anladım"'],
        impact: 'Kimliğin tanınmama, valid olmama hissi',
        response: 'Sakin kalarak tekrarla: "Evet, eminim. Bu ben."',
    },
    rejection: {
        reaction: 'Reddetme',
        examples: ['"Seni tanımıyorum"', '"Artık oğlum/kızım değilsin"', '"Bu aile kütüphanesine yazılmaz"'],
        impact: '⚠️ KRİTİK: Psikolojik yıkım, intihar riski artar',
        response: 'ACIL: Güvenlik planı, LGBTQ+ yardım hattı, barınma alternatifleri, yasal koruma',
    },
    conversion_attempt: {
        reaction: 'Dönüştürme Denemesi',
        examples: ['"Terapilere gideceksin"', '"Din/dua sana yardım edecek"', '"Gerçek partneri bul"'],
        impact: 'Travma, kimlik reddi, içleştirilmiş eril homofobiya',
        response: 'ACIL: Güvenlik planı, hukuki destek, profesyonel yardım, koşullu bağlantı reddi',
    },
    conditional_acceptance: {
        reaction: 'Koşullu Kabul',
        examples: ['"Tamam ama kimse bilmesin"', '"Eğer bu senin hayatını hor yapmazsa"', '"Yeter ki işini et"'],
        impact: 'Kendi içinde çelişkilmek, gizleme stres, eksik validasyon',
        response: 'Sınırlar koy: "Benim kimliğimi gizeleyecek değilim, kabul et veya bağlantı kes"',
    },
};

// ─── DETECT & ASSESS ──────────────────────────────────────────────────────────

/**
 * LGBTQ+ kimlik ve coming out stresini tespit et
 * @param {string} userMessage
 * @returns {{ isLGBTQPlus: boolean, identityTheme: string, comingOutPhase: string, riskLevel: string }}
 */
export function detectLGBTQPlusContext(userMessage = '') {
    const text = userMessage.toLowerCase();
    let identityTheme = '';
    let comingOutPhase = '';
    let riskLevel = 'low';

    // Kimlik tespiti
    if (/eşcinsel|gay|erkek|seviyor/i.test(text)) identityTheme = 'gay';
    else if (/lezbiyen|kadın|kız|kız seviyor/i.test(text)) identityTheme = 'lesbian';
    else if (/biseksüel|erkek|kadın|her iki|çekim/i.test(text)) identityTheme = 'bisexual';
    else if (/trans|cinsiyet|erkek değilim|kadın değilim|dişi|erkek|değiş/i.test(text)) identityTheme = 'transgender';
    else if (/genderqueer|non-binary|cinsiyet yok|ötesi/i.test(text)) identityTheme = 'non_binary';
    else if (/aseksüel|ace|cinsel çekim|arzu yok/i.test(text)) identityTheme = 'ace_asexual';
    else if (/queer|sapkın|öteki/i.test(text)) identityTheme = 'queer';

    // Coming Out aşaması
    if (/söyleyeyim|söyleseydim|söylemeliyim|nasıl söylü/i.test(text)) comingOutPhase = 'preparation';
    else if (/söyledim|dediğim|anlattım|açık/i.test(text)) comingOutPhase = 'disclosure';
    else if (/şimdi nasıl|artık|aile biliyor|dostlar biliyor|yeni yaşam/i.test(text)) comingOutPhase = 'integration';

    // Risk değerlendirmesi
    if (/kızacaklar|reddetecek|ayrılacak|şiddet|korku|tehlike|kaçmak/i.test(text)) {
        riskLevel = 'high';
    }
    if (/ama güvenli|anne baba anlıyor|destekli|iyi|arkadaş var/i.test(text)) {
        riskLevel = 'low';
    }

    return {
        isLGBTQPlus: !!identityTheme,
        identityTheme,
        comingOutPhase,
        riskLevel,
    };
}

/**
 * Aile reddini tespit et (kritik durum)
 * @param {string} userMessage
 * @returns {{ hasFamilyRejection: boolean, rejectionType: string, safetyRisk: boolean }}
 */
export function detectFamilyRejection(userMessage = '') {
    const text = userMessage.toLowerCase();

    let rejectionType = '';
    let safetyRisk = false;

    if (/söyled|dedi|reacted|reaction/i.test(text)) {
        if (/artık|kimse değilsin|kütüphane|ayrılacak|görmeyin|reddet|inkar/i.test(text)) {
            rejectionType = 'severe_rejection';
            safetyRisk = true;
        } else if (/ama|koşul|gizle|kimse bilmesin/i.test(text)) {
            rejectionType = 'conditional_acceptance';
        } else if (/tedavi|dönüştür|din|terapi|değişmeli/i.test(text)) {
            rejectionType = 'conversion_attempt';
            safetyRisk = true;
        }
    }

    return {
        hasFamilyRejection: !!rejectionType,
        rejectionType,
        safetyRisk,
    };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * LGBTQ+ affirming (destekleyici) terapi bağlamı
 * @param {string} identityType
 * @returns {string}
 */
export function buildLGBTQAffirmingContext(identityType = '') {
    if (!identityType || !LGBTQ_PLUS_IDENTITIES[identityType]) {
        return '';
    }

    const identity = LGBTQ_PLUS_IDENTITIES[identityType];
    let context = `[LGBTQ+ AFFIRMING (DESTEKLEYİCİ) TERAPİ]\n\n`;
    context += `Senin Kimliği: ${identity.identity}\n`;
    context += `Tanım: ${identity.definition}\n\n`;

    context += `⚠️ Benzersiz Zorluklar:\n`;
    identity.unique_challenges.forEach(ch => {
        context += `  • ${ch}\n`;
    });

    context += `\n💪 Güçler:\n`;
    identity.strengths.forEach(str => {
        context += `  • ${str}\n`;
    });

    context += `\n🎯 Terapide Odak:\n`;
    context += `${identity.therapeutic_focus}\n\n`;

    context += `[AFFIRMING KURSU]\n`;
    context += `Senin kimliğin doğal, normal ve güzel.\n`;
    context += `Terapi: Kimliğin değiştirilmesi değil, onu kabullenme.\n`;
    context += `İçleştirilmiş homofobi/transfobi ile çalışırız.\n`;
    context += `→ Kendini sevmek = en iyi tedavi.`;

    return context;
}

/**
 * Coming Out rehberi
 * @param {string} phase — 'preparation', 'disclosure', 'integration'
 * @returns {string}
 */
export function buildComingOutGuide(phase = '') {
    if (!phase || !COMING_OUT_PHASES[phase]) {
        return '';
    }

    const phaseData = COMING_OUT_PHASES[phase];
    let guide = `[COMING OUT REHBERİ]\n\n`;
    guide += `${phaseData.phase}\n`;
    guide += `Süre: ${phaseData.duration}\n\n`;

    guide += `Yapman Gerekenler:\n`;
    phaseData.tasks.forEach((task, idx) => {
        guide += `${idx + 1}. ${task}\n`;
    });

    guide += `\n[COMING OUT BİLGİSİ]\n`;
    guide += `Coming out = yaşam boyu işi (her yeni insana, yeni ortamda).\n`;
    guide += `Kimlik = gizlenecek şey DEĞİL, müstehak özel ortamlar seç.\n`;
    guide += `Güvenlik = öncelik. Tepki riski yüksekse planla, geciktirebilirsin.\n`;
    guide += `→ Coming out = öz-saygı + güvenlik dengeleme.`;

    return guide;
}

/**
 * Aile Reddi Krizi — Acil Yardım
 * @param {string} rejectionType
 * @returns {string}
 */
export function buildRejectionCrisisGuide(rejectionType = '') {
    if (!rejectionType || !NEGATIVE_REACTIONS[rejectionType]) {
        return '';
    }

    const reaction = NEGATIVE_REACTIONS[rejectionType];
    let guide = `[AİLE REDDİ KRİZİ — ACIL YARDIM]\n\n`;
    guide += `Reaksiyon Türü: ${reaction.reaction}\n\n`;

    guide += `Örnekler:\n`;
    reaction.examples.forEach(ex => {
        guide += `  • "${ex}"\n`;
    });

    guide += `\nPsikolojik Etki:\n`;
    guide += `${reaction.impact}\n\n`;

    guide += `💪 ŞU ANDA YAPMAN GEREKENLER:\n`;
    guide += `1️⃣ GÜVENLIK: Fiziksel güvenlik tehdidi var mı? Planla/kaç\n`;
    guide += `2️⃣ DESTEK: LGBTQ+ yardım hattı, arkadaş, terapist\n`;
    guide += `3️⃣ HUKUKİ: Yaşında senin hakların neler? Aile desteği gerekli mi?\n`;
    guide += `4️⃣ KAYNAKLAR: Barınma, finans, sağlık sigortası alternatif\n`;
    guide += `5️⃣ PSIKIYATRIK: Bunalım/intihar riski? ACIL YARDIM ÇAĞIR\n\n`;

    guide += `[YAŞAM BOYU YOLCULUK]\n`;
    guide += `Bu reddi işlemek zaman alır. Uzun vadeli terapi önemli.\n`;
    guide += `Yeni "aileler" inşa edebilirsin (seçilmiş aile — queer chosen family).\n`;
    guide += `→ Reddi kabullenme ≠ Kimliğini reddetme. Onlar seçimini yaptı, sen istediğini yap.`;

    return guide;
}

/**
 * LGBTQ+ Güvenli Ortam İşaretleri
 * @returns {string}
 */
export function buildLGBTQSafetyMarkers() {
    return `[LGBTQ+ GÜVENLI ORTAM İŞARETLERİ]\n\n` +
        `✅ Güvenli Ortam Göstergesi:\n` +
        `  • Zamirler sorulur ve saygılanır\n` +
        `  • Kişinin kimliği sorgulanmaz\n` +
        `  • LGBTQ+ temsili (gökkuşağı sembolü, poster, vs)\n` +
        `  • Terapist LGBTQ+ tarihi/bağlamı biliyor\n` +
        `  • Seçilmiş aile da hoş karşılandı\n` +
        `  • Cinsiyet/cinsellik açık şekilde tartışılabilir\n\n` +
        `❌ Tehlikeli İşaretler (KAÇI!):\n` +
        `  • "Bunu değiştirebiliriz" — konversiyon terapi\n` +
        `  • "Fase/geçicilik" — kimlik tanımama\n` +
        `  • "Heterosexual olsan daha mutlu olursun" — homo-negatif\n` +
        `  • Zamirler yanlış kullanılır — disrespect\n` +
        `  • Din/kültür "bunu onaylamaz" — baskılı terapi\n` +
        `  • Terapist LGBTQ+ haline karşı zayıf (kınama)\n\n` +
        `→ Terapi = güvenli yer. Hissetmezsen terapisti değiştir.`;
}
