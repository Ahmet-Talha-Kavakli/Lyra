// lib/resilienceBuilding.js
// Dayanıklılık İnşası — Zorluktan Çıkma ve Büyüme
// APA Resilience Model + Posttraumatic Growth + Antifragility (Nassim Taleb)
//
// Amaç: Zorluk ve travmadan kurtulma, eksiliği güçe çevirme

const RESILIENCE_FACTORS = {
    social_support: {
        name: 'Sosyal Destek (Social Support)',
        description: 'Güvenebileceğin insan ağı, yardım ve düşündürme',
        components: ['aile', 'arkadaş', 'toplum', 'profesyoneller'],
        indicators: [
            'Zor zamanlarda arayan insanlar var',
            'Dinleme ve anlayan birisi',
            'Grup aktivitelerine katılma kapasitesi',
            'Bağlantı ve ait hissi',
        ],
        building_strategy: [
            'Mevcut ilişkileri derinleştir (haftada bir buluş)',
            'Grup aktivitelerine katıl (spor, kurs, topluluk)',
            'Profesyonel destek ara (terapist, danışman)',
            'Online topluluklar bul (ilgi alanı temelli)',
        ],
    },

    self_efficacy: {
        name: 'Öz-yeterlik (Self-Efficacy)',
        description: 'Kendi becerilerine güven, zorlukları çözebilme',
        components: ['kontrol hissi', 'başarı deneyimi', 'problem çözme', 'öz-şüphe azalma'],
        indicators: [
            'Zor görevleri "yapabilirim" diye başlamak',
            'Başarısızlıktan çıkabilirim inancı',
            'Beceri geliştirme işveya',
            'Başarı deneyimlerini hatırlamak',
        ],
        building_strategy: [
            'Başarılı deneyimler yaşa (minik) başarılar',
            'Beceri geliştir (sınıf, mentorlik)',
            'Kendine konuş (öz-yardım cümleler)',
            'Başarı defteri tut (ne başardım)',
        ],
    },

    sense_of_purpose: {
        name: 'Amaç Hissi (Sense of Purpose)',
        description: 'Yaşam amacı, "niye yaşıyorum" cevabı',
        components: ['değerler', 'hedefler', 'anlam', 'yönü'],
        indicators: [
            'Yaşamda anlamlı hedefleri var',
            'Değerlerine sadık kalma',
            'Zorluk: geçici, amaca bağlı değil',
            'Başarısızlık: sırada bir adım, başarısız değil',
        ],
        building_strategy: [
            'Yaşam değerlerini belirle (valuesClarification)',
            'Uzun vadeli hedefler koy (5-10 yıl)',
            'Günlük eylemleri amaca bağla',
            'Anlam meditasyonu yap (Frankl)',
        ],
    },

    emotional_regulation: {
        name: 'Duygu Düzenlemesi (Emotional Regulation)',
        description: 'Zor duyguları kaldırma, uyum sağlama',
        components: ['duygularını tanı', 'tolerans', 'kontrol', 'yeniden çerçeveleme'],
        indicators: [
            'Üzüntüyü yaşayabilir, sıkışmıyor',
            'Öfkeyi başkasına zarar vermeden ekspres edebilir',
            'Korku ile oynamaya tolerans',
            'Mindfulness: duyguları gözlemleme',
        ],
        building_strategy: [
            'Duygu tanıma (taşla, adlandır)',
            'Somatic grounding (5-4-3-2-1)',
            'CBT (duygular = düşünceler)',
            'Meditasyon (gözlemlemek vs. tepki)',
        ],
    },

    cognitive_flexibility: {
        name: 'Bilişsel Esneklik (Cognitive Flexibility)',
        description: 'Perspektif değiştirme, alternatif bakış açısı',
        components: ['esneklik', 'problem çözme', 'uyum', 'öğrenme'],
        indicators: [
            'Başarısızlıktan: "İşlememdi, deneyim kazandım"',
            'Sorunun birden fazla çözümü var',
            'Setback: geçici, spesifik, değiştirebilir',
            'Başarılı kimseleri gözlemleme (rol model)',
        ],
        building_strategy: [
            'Bilişsel reframing (çerçeve değiştir)',
            'Hikaye yeniden yazma (trauma → büyüme)',
            'Rol model yarat (nasıl kurtuldu?)',
            'Journaling: farklı perspektifler',
        ],
    },

    proactive_coping: {
        name: 'Proaktif Baş Etme (Proactive Coping)',
        description: 'Sorunları önceden görebilme, hazırlıklı olma',
        components: ['planlama', 'hazırlık', 'uyarı işaretleri', 'eylem planı'],
        indicators: [
            'Stresörleri önceden görme',
            'Backup planı var',
            'Erken uyarı sinyallerini bilme',
            'Krize hazırlı (mental, fiziksel)',
        ],
        building_strategy: [
            'Stres kaynakları tanı',
            'Plan B, C oluştur',
            'Risk faktörlerini azalt',
            'Erken uyarı sistemini kur',
        ],
    },

    positive_growth_mindset: {
        name: 'Büyüme Zihniyeti (Growth Mindset)',
        description: 'Zorluktan öğrenme, kişisel gelişim',
        components: ['öğrenme', 'büyüme', 'duygulanma', 'kendini aşma'],
        indicators: [
            'Zorluk = keşif fırsatı',
            'Başarısızlık = ders',
            'Başkalarının başarısında sevinç (kıskançlık yok)',
            'Kendini geliştirmeye açık',
        ],
        building_strategy: [
            'Growth mindset (Dweck): öğren, bil değil',
            'Post-traumatic growth (yeni anlayış)',
            'Mentorship (başkalıdan öğren)',
            'Reflect journaling: ne öğrendim?',
        ],
    },
};

/**
 * Dayanıklılık faktörlerini tespit et
 * @param {string} userMessage
 * @param {Array} traumaHistory — geçmiş travmalar
 * @returns {{ resilientFactors: Array, vulnerableAreas: Array, overallResilience: string }}
 */
export function assessResilienceFactors(userMessage = '', traumaHistory = []) {
    const text = userMessage.toLowerCase();
    const factors = [];
    const vulnerable = [];

    // Social support
    if (/arkadaş|ailesi|grup|destek|insanlar|bağlantı|dinleme|yardım/i.test(text)) {
        factors.push('social_support');
    } else {
        vulnerable.push('social_support');
    }

    // Self-efficacy
    if (/yapabilir|başarılı|beceri|kontrol|yönetilebilir|yapıyorum|çözüm/i.test(text)) {
        factors.push('self_efficacy');
    } else {
        vulnerable.push('self_efficacy');
    }

    // Purpose
    if (/amaç|anlam|hedef|niye|yapıyorum|değer|yön/i.test(text)) {
        factors.push('sense_of_purpose');
    } else {
        vulnerable.push('sense_of_purpose');
    }

    // Emotional regulation
    if (/duygu|tolerans|yaşayabiliyor|katlaş|nefes|mindfulness|gözlem/i.test(text)) {
        factors.push('emotional_regulation');
    } else {
        vulnerable.push('emotional_regulation');
    }

    // Cognitive flexibility
    if (/perspektif|farklı|esneklik|alternatif|başka açı|deneme|öğrenme/i.test(text)) {
        factors.push('cognitive_flexibility');
    } else {
        vulnerable.push('cognitive_flexibility');
    }

    // Proactive coping
    if (/hazır|plan|önceden|uyar|dikkat|kontrol|hazırlık/i.test(text)) {
        factors.push('proactive_coping');
    } else {
        vulnerable.push('proactive_coping');
    }

    // Growth mindset
    if (/öğren|büyü|geliştir|başarısız ama|ders|tecrübe|ilerleme/i.test(text)) {
        factors.push('positive_growth_mindset');
    } else {
        vulnerable.push('positive_growth_mindset');
    }

    const resilience =
        factors.length >= 5
            ? 'Yüksek'
            : factors.length >= 3
              ? 'Orta'
              : factors.length >= 1
                ? 'Düşük'
                : 'Çok Düşük';

    return {
        resilientFactors: factors.slice(0, 3),
        vulnerableAreas: vulnerable.slice(0, 3),
        overallResilience: resilience,
        hasTrauma: traumaHistory.length > 0,
        resilienceScore: factors.length,
    };
}

/**
 * Dayanıklılık faktörü bağlamı
 * @param {string} factorName
 * @returns {string}
 */
export function buildResilienceContext(factorName = '') {
    if (!factorName || !RESILIENCE_FACTORS[factorName]) {
        return '';
    }

    const factor = RESILIENCE_FACTORS[factorName];
    let context = `[DAYANAKILIK İNŞASI — Zorluktan Güç]\n\n`;
    context += `Faktör: ${factor.name}\n`;
    context += `Tanım: ${factor.description}\n\n`;

    context += `Belirtileri:\n`;
    factor.indicators.slice(0, 2).forEach(ind => {
        context += `  • ${ind}\n`;
    });

    context += `\nGeliştirme Stratejileri:\n`;
    factor.building_strategy.slice(0, 2).forEach(strat => {
        context += `  1. ${strat}\n`;
    });

    context += `\n→ Her faktör bir kasım: düzenli pratik = güçlü dayanıklılık.`;

    return context;
}

/**
 * Post-traumatic growth planı
 * @param {string} traumaType — e.g., "loss", "betrayal", "failure", "abuse"
 * @returns {string}
 */
export function buildPostTraumaticGrowthPlan(traumaType = '') {
    const growthPaths = {
        loss: {
            challenge: 'Sevilen birini kaybetme / yas',
            growth: [
                'Yaşamın kıymeti daha yakından',
                'Başkalarının acısına empati',
                'Hayatı "sonsuza" harcamadığını görme',
                'Geriye kalan insanları kıymetlendir',
            ],
        },
        betrayal: {
            challenge: 'Güvene ihanet / başkası tarafından incitilme',
            growth: [
                'İnsan yargısı gelişir',
                'Sınırlar koyma',
                'Öz-saygı ve kendine bağlılık',
                'Kötü ilişkilerden kaçışı öğren',
            ],
        },
        failure: {
            challenge: 'Başarısızlık / projesinin başarısız olması',
            growth: [
                'Mükemmeliyetçiliğin bırakılması',
                'Başarısızlık = ciddiye alınmaz ders',
                'Denemeye cesaret',
                'Başkalarının başarısızlıkları ile empati',
            ],
        },
        abuse: {
            challenge: 'İstismar / şiddet / travma',
            growth: [
                'Sağlığı/güvenliği priyoritize etme',
                'Sınırlar ve kişisel güvenlik',
                'Destek ağını kurma',
                'Başkalarını koruma istekleri',
            ],
        },
        illness: {
            challenge: 'Ciddi hastalık / engelli olma',
            growth: [
                'Beden ve zihinle yeni ilişki',
                'Yaşam baskısı azalma (muhasebat)',
                'Başka işlere odaklanma (amaç)',
                'Başkalarının çilelerine empati',
            ],
        },
    };

    const path = growthPaths[traumaType] || growthPaths.loss;

    let plan = `[TRAVMADAN SONRA BÜYÜME]\n\n`;
    plan += `Zorluk: ${path.challenge}\n\n`;
    plan += `Mümkün Büyümeler:\n`;
    path.growth.forEach((g, i) => {
        plan += `${i + 1}. ${g}\n`;
    });

    plan += `\n[5 AŞAMASAL IYILEŞTIRME]\n`;
    plan += `1️⃣ İLK ŞOK (1-2 ay): Değişim, uyum yok\n`;
    plan += `2️⃣ KAFA KARIŞIKLIĞI (2-6 ay): "Niye ben?" sorgusu\n`;
    plan += `3️⃣ KABULLENİŞ (6-12 ay): Gerçeği kabul, "şimdi ne yapacağım?"\n`;
    plan += `4️⃣ ANLAMA (1-2 yıl): Kişisel anlam çıkarma, anlaşma\n`;
    plan += `5️⃣ BÜYÜME (2+ yıl): Yeni kendiniz, daha güçlü\n\n`;

    plan += `→ Travma = seçilmez. Ama büyüme = seçilir. Bugün ne seçiyorsun?`;

    return plan;
}

/**
 * Dayanıklılık egzersizi: Zor zamanlarda kurtarma
 * @returns {string}
 */
export function buildResilienceExercise() {
    return `[DAYANAKILIK EGZERSIZI — Zor Zamanlardaki Kaynak]\n\n` +
        `Amaç: Kriz anında "nereye gideceğim?" bilmek.\n\n` +
        `ADIM 1: DESTEK AĞINI YAZMA (10 dakika)\n` +
        `Zor zamanımda aruyorum kişiler:\n` +
        `  1. [İsim] — [neden yardımcı]\n` +
        `  2. [İsim] — [neden yardımcı]\n` +
        `  3. [İsim] — [neden yardımcı]\n` +
        `  4. Profesyonel: [terapist, danışman, doktor]\n\n` +
        `ADIM 2: BECERİ ENVANTERİ (10 dakika)\n` +
        `Sorunları çözerken kullandığım beceriler:\n` +
        `  • Problem çözme: [örnek başarı]\n` +
        `  • Duygu ile baş etme: [nasıl yapıyorum]\n` +
        `  • Yardım arama: [kimden aldım]\n` +
        `  • Yaratıcı çözümler: [ne işe yaradı]\n\n` +
        `ADIM 3: AMAÇ HATIRLATMASI (5 dakika)\n` +
        `Kriz anında okumak için:\n` +
        `"Şu anki zorluk geçici. Benim amaçım [yaz amacını].\n` +
        `Zorluk: sırada bir adım, yolun sonu değil.\n` +
        `Kurtuldum: [eski zorluk]. Kurtulacağım: bu da."\n\n` +
        `ADIM 4: GÜVENLI YER HAZIRLA\n` +
        `Kriz anında gideceğim yer:\n` +
        `  • Fiziksel: [ev, kütüphane, dış ortam]\n` +
        `  • Sosyal: [arkadaş, grup, topluluk]\n` +
        `  • Kültürel: [müzik, sanat, doğa]\n\n` +
        `→ Krizi önceden tanıman = yarısı çözüm.`;
}

/**
 * Dayanıklılık özet raporu
 * @param {Object} resilience — { factors: [], vulnerable: [], overallScore }
 * @returns {string}
 */
export function buildResilienceReport(resilience = {}) {
    const { factors = [], vulnerable = [], overallScore = 3 } = resilience;

    let report = `[DAYANAKILIK RAPORU]\n\n`;
    report += `Genel Skor: ${overallScore}/7 faktör\n`;
    report += `Durumu: ${overallScore >= 5 ? 'GÜÇLÜ' : overallScore >= 3 ? 'ORTA' : 'GELİŞTİRİLMELİ'}\n\n`;

    report += `🟢 GÜÇ ALANLARINIZ:\n`;
    factors.forEach(f => {
        report += `  ✓ ${RESILIENCE_FACTORS[f]?.name || f}\n`;
    });

    report += `\n🔴 GELİŞTİRİLMESİ GEREKEN:\n`;
    vulnerable.forEach(f => {
        report += `  ⚠️ ${RESILIENCE_FACTORS[f]?.name || f}\n`;
    });

    report += `\n⚡ FOKUSLANACak ALAN:\n`;
    if (vulnerable.length > 0) {
        const focus = vulnerable[0];
        report += `Şu anda "${RESILIENCE_FACTORS[focus]?.name || focus}" geliştir.\n`;
        report += `Bu tek alanın güçlendirilmesi: tüm dayanıklılığı arttırır.\n`;
    }

    report += `\n→ Dayanıklılık = uzmanlık. Pratikle gelişir. Başla.`;

    return report;
}
