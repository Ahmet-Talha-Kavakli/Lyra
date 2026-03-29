// lib/positivePsychology.js
// Pozitif Psikoloji — PERMA Modeli, 24 Karakter Gücü, Minnet, Flourishing
// Hastalık tedavisi (defisit modeli) yerine güçlere odaklı (pozitif model)
//
// Amaç: Güçleri tespit, mutluluk faktörlerini artırma, anlamlı yaşam inşası

// ─── PERMA MODELİ (Martin Seligman) ────────────────────────────────────────────

/**
 * P — Positive Emotion (Pozitif Duygu)
 * E — Engagement (Katılım/Flow)
 * R — Relationships (İlişkiler)
 * M — Meaning (Anlam)
 * A — Accomplishment (Başarı)
 */

const PERMA_DIMENSIONS = {
    positive_emotion: {
        dimension: '😊 P — Pozitif Duygu (Positive Emotion)',
        definition: 'Hayattan zevk alma, sevinç, mutluluk hissi',
        components: ['haz (şu an)', 'minnet (geçmiş)', 'iyimizm (gelecek)'],
        indicators: [
            'Günde yüksek anlar var mı?',
            'Güzelliği fark edebiliyor musun?',
            'Sevdiğin şeyleri doyasıya yaşıyorsun?',
        ],
        boost_strategies: [
            'Beş duyu deneyimi (lezzet, müzik, doğa)',
            'Minnet günlüğü (günde 3 şey)',
            'Pozitif anılar gözden geçir',
            'Komik şeyler izle/oku',
            'Zevk alacağın şeyleri planla',
        ],
    },
    engagement: {
        dimension: '🎯 E — Katılım / Flow (Engagement)',
        definition: 'Aktivitede tamamen kapılma, saatin unutma, flow state',
        components: ['flow deneyimi', 'zorluk-beceri dengesi', 'amaç odaklılık'],
        indicators: [
            'Kaybolan şeyler var mı (saati unutursun)?',
            'Yapmakta sevdiğin hobi var mı?',
            'Iş/aktivitede flow duyuyor musun?',
        ],
        boost_strategies: [
            'Flow aktivitesi tanımla (sanat, spor, oyun, programlama)',
            'Günlük minimum 30 dakika flow zaman ayır',
            'Zorluk seviyesini artırarak yetenek geliştir',
            'Oyun/hobi ciddiye al (hobiden profesyonele)',
            'İş içinde flow kaynakları bul',
        ],
    },
    relationships: {
        dimension: '🤝 R — İlişkiler (Relationships)',
        definition: 'Anlamlı sosyal bağlantı, sevgi, ait olma',
        components: ['yakın bağlantılar', 'topluluk', 'empati ve destek'],
        indicators: [
            'Samimi insanlarla düzenli kontak kuruyorsun?',
            'Seviliyorsun ve seviyor musun hissiyatı var mı?',
            'Bir topluluğa aitsiz hissediyor musun?',
        ],
        boost_strategies: [
            'Yakın kişilerle kaliteli vakit (haftada minimum)',
            'Yeni bağlantılar kur (hobi grubu, gönüllü)',
            'Aktif dinleme/empati pratiği',
            'Seçilmiş aile (chosen family) inşa et',
            'Bağlantısız hisseden insanlarla iletişim kur',
        ],
    },
    meaning: {
        dimension: '✨ M — Anlam (Meaning)',
        definition: 'Yaşamın amacı, değerler, kendinden büyük bir şeye bağlı olma',
        components: ['yaşam amacı', 'değerler hizalanması', 'aşkınlık'],
        indicators: [
            'Yaşamında amaç hissediyor musun?',
            'Eylemleriniz değerlerine uyumlu mu?',
            'Senden büyük bir şeyi destekliyorsun?',
        ],
        boost_strategies: [
            'Yaşam amaçını tanımla (ikigai, logoterapi)',
            'Değerler açıklığını yap ve eylem uyumunu kontrol et',
            'Gönüllülük/sosyal etki (başkalarına yardım)',
            'Manevi/felsefik pratikler (meditasyon, dua, diyaloji)',
            'Seçilmiş "büyük amaç" için çalış',
        ],
    },
    accomplishment: {
        dimension: '🏆 A — Başarı (Accomplishment)',
        definition: 'Hedeflere ulaşma, yetkinlik, ilerleme, başarı',
        components: ['hedef ayarlama', 'progress tracking', 'başarı kutlama'],
        indicators: [
            'Kısa/uzun vadeli hedefler var mı?',
            'İlerlemeni ölçebiliyor musun?',
            'Başarıları kutluyorsun?',
        ],
        boost_strategies: [
            'Haftada/ayda spesifik hedefler koy (SMART)',
            'Progress günlüğü tut, ilerlemeni görün',
            'Başarıları yazılı kutla (minnet + vizüalizasyon)',
            'Yetkinlik artırma (öğrenme, beceri geliştirme)',
            'Mastery progression tanımla (novice → expert)',
        ],
    },
};

// ─── 24 KARAKTER GÜÇLERİ (VIA Character Strengths) ─────────────────────────────

const VIA_CHARACTER_STRENGTHS = {
    // Wisdom / Bilgelik
    creativity: { name: 'Yaratıcılık', category: 'Bilgelik', desc: 'Yeni çözümler/fikrî ortaya koymak' },
    curiosity: { name: 'Merak', category: 'Bilgelik', desc: 'Dünyaya ilgi, öğrenmeye açıklık' },
    judgment: { name: 'Yargı/Analiz', category: 'Bilgelik', desc: 'Mantıklı düşünme, farklı perspektif' },
    loveOfLearning: { name: 'Öğrenme Sevgisi', category: 'Bilgelik', desc: 'Bilgi edinmeyi sevmek, eğitim' },
    perspective: { name: 'Perspektif', category: 'Bilgelik', desc: 'Danışmanlık, bilgelik sunmak' },

    // Courage / Cesaret
    bravery: { name: 'Cesaret', category: 'Cesaret', desc: 'Korkularına karşı harekete geçme' },
    perseverance: { name: 'Sebat', category: 'Cesaret', desc: 'Hedefe giden çaba, pes etmeme' },
    honesty: { name: 'Dürüstlük', category: 'Cesaret', desc: 'Gerçeklik/saçanlık, kendine bağlılık' },
    zest: { name: 'Hareket/Hevs', category: 'Cesaret', desc: 'Hayata kapılı, enerji, canlılık' },

    // Humanity / İnsanlılık
    loveOfPeople: { name: 'İnsanları Sevme', category: 'İnsanlılık', desc: 'Başkalarını önemseyen, alaka' },
    kindness: { name: 'Iyilik', category: 'İnsanlılık', desc: 'Yardımlaşma, başkalarının iyiliğini isteme' },
    socialIntelligence: { name: 'Sosyal Zeka', category: 'İnsanlılık', desc: 'İnsan anlayışı, empatik' },

    // Justice / Adalet
    teamwork: { name: 'Takımcılık', category: 'Adalet', desc: 'Grup hedefleri için çalışma' },
    fairness: { name: 'Adil Olma', category: 'Adalet', desc: 'Tarafsız, herkese eşit davranış' },
    leadership: { name: 'Liderlik', category: 'Adalet', desc: 'Diğerlerini yönlendirme, organize etme' },

    // Temperance / İtidal
    forgiveness: { name: 'Affedicilik', category: 'İtidal', desc: 'Hataları affetme, merhamet' },
    humility: { name: 'Alçakgönüllülük', category: 'İtidal', desc: 'Övgü almadan yaptığı, modestlik' },
    prudence: { name: 'İhtiyatlılık', category: 'İtidal', desc: 'Riskleri düşünme, makul karar' },
    selfRegulation: { name: 'Öz Kontrol', category: 'İtidal', desc: 'Dürtüleri yönetme, disiplin' },

    // Transcendence / Aşkınlık
    appreciation: { name: 'Takdir/Minnet', category: 'Aşkınlık', desc: 'Güzelliği/iyiliği fark etme' },
    gratitude: { name: 'Minnet', category: 'Aşkınlık', desc: 'Sahip olduklarına şüküran' },
    hope: { name: 'Umut', category: 'Aşkınlık', desc: 'Gelecekten iyimizm, hedefe inanış' },
    humor: { name: 'Mizah', category: 'Aşkınlık', desc: 'Komikliği bulma, gülme yetenegi' },
    spirituality: { name: 'Maneviyat', category: 'Aşkınlık', desc: 'Yaşamın anlamı, büyük amaç' },
};

// ─── DETECT & ASSESS ──────────────────────────────────────────────────────────

/**
 * PERMA boyutlarını değerlendir
 * @param {string} userMessage
 * @returns {{ permaScores: Object, lowestDimension: string, highestDimension: string }}
 */
export function assessPERMA(userMessage = '') {
    const text = userMessage.toLowerCase();
    const scores = {
        positive_emotion: 50,
        engagement: 50,
        relationships: 50,
        meaning: 50,
        accomplishment: 50,
    };

    // Pozitif Duygu
    if (/mutlu|sevinç|güzel|zevk|duygu|iyi/i.test(text)) scores.positive_emotion += 10;
    if (/depresif|üzgün|boş|mutsuz|hüzün/i.test(text)) scores.positive_emotion -= 15;

    // Engagement (Flow)
    if (/hobi|oyun|sanat|spor|yazı|müzik|kodla|programla|sık kaybolu/i.test(text)) scores.engagement += 15;
    if (/sıkılı|monoton|yapacak yok|ilgi yok|verim yok/i.test(text)) scores.engagement -= 10;

    // İlişkiler
    if (/arkadaş|aile|sevgi|bağlantı|samimi|yakın|konuş|destek/i.test(text)) scores.relationships += 10;
    if (/yalnız|izole|bağlantı yok|kimse|aile sorun|çatış/i.test(text)) scores.relationships -= 15;

    // Anlam
    if (/amaç|değer|niye|anlamı|manevi|ibadet|dua|ödül|katkı|öğretim/i.test(text)) scores.meaning += 15;
    if (/anlamsız|amaçsız|neden|varoluş/i.test(text)) scores.meaning -= 15;

    // Başarı
    if (/hedef|başarı|ilerleme|tamamladım|kazandım|başardım|öğrendim/i.test(text)) scores.accomplishment += 15;
    if (/başarısız|becerilemedim|imkansız|durdu|pes/i.test(text)) scores.accomplishment -= 15;

    // Normalize
    Object.keys(scores).forEach(key => {
        scores[key] = Math.max(0, Math.min(100, scores[key]));
    });

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    return {
        permaScores: scores,
        lowestDimension: sorted[sorted.length - 1][0],
        highestDimension: sorted[0][0],
    };
}

/**
 * Karakter güçlerini tespit et
 * @param {string} userMessage
 * @returns {{ topStrengths: Array, weakStrengths: Array }}
 */
export function identifyCharacterStrengths(userMessage = '') {
    const text = userMessage.toLowerCase();
    const strengthScores = {};

    Object.entries(VIA_CHARACTER_STRENGTHS).forEach(([key, strength]) => {
        strengthScores[key] = 0;

        // Güçlü göstergeler
        if (strength.name === 'Yaratıcılık' && /yaratıc|yeni fikir|tasarım|yazı|sanat|icat/i.test(text)) strengthScores[key] += 3;
        if (strength.name === 'Merak' && /niye|nasıl|sorular|öğrenme|ilgi|araştır/i.test(text)) strengthScores[key] += 3;
        if (strength.name === 'Iyilik' && /yardım|destek|verme|başkası|gönüllü|yardımcı/i.test(text)) strengthScores[key] += 3;
        if (strength.name === 'Cesaret' && /korkusuz|devam|çaba|pes etme|kalp/i.test(text)) strengthScores[key] += 3;
        if (strength.name === 'Minnet' && /teşekkür|seviniç|minnet|bereket|şansı/i.test(text)) strengthScores[key] += 3;
        if (strength.name === 'Umut' && /umut|gelecek|iyimizm|olacak|başarı/i.test(text)) strengthScores[key] += 3;
        if (strength.name === 'Liderlik' && /öncü|yönetme|organize|grup|takım|rehber/i.test(text)) strengthScores[key] += 3;

        // Zayıf göstergeler
        if (strength.name === 'Affedicilik' && /öfke|intikam|unutmama|rancor/i.test(text)) strengthScores[key] -= 2;
        if (strength.name === 'İnsanları Sevme' && /yalnız|sosyal|izole/i.test(text)) strengthScores[key] -= 2;
    });

    const sorted = Object.entries(strengthScores).sort((a, b) => b[1] - a[1]);

    return {
        topStrengths: sorted.slice(0, 3).map(([key, score]) => VIA_CHARACTER_STRENGTHS[key]),
        weakStrengths: sorted.slice(-3).reverse().map(([key, score]) => VIA_CHARACTER_STRENGTHS[key]),
    };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * PERMA raporu
 * @param {Object} permaScores
 * @returns {string}
 */
export function buildPERMAReport(permaScores = {}) {
    if (Object.keys(permaScores).length === 0) {
        return '';
    }

    let report = `[POZİTİF PSİKOLOJİ — PERMA MODELİ]\n\n`;

    Object.entries(permaScores).forEach(([dimension, score]) => {
        const dimensionData = PERMA_DIMENSIONS[dimension];
        if (!dimensionData) return;

        const filled = Math.round(score / 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        report += `${dimensionData.dimension}: ${bar} ${score}/100\n`;
        report += `  → ${dimensionData.definition}\n`;
        report += `  Stratejiler: ${dimensionData.boost_strategies[0]}\n\n`;
    });

    report += `[PERMA HAKKINDAKİ DÜŞÜNCELER]\n`;
    report += `Mutluluk = 5 boyut dengesidir.\n`;
    report += `Zayıf boyutlara odaklan, güçlü boyutları devam ettir.\n`;
    report += `→ Flourishing = PERMA dengesi. İnşa et.`;

    return report;
}

/**
 * Karakter güçleri profiçi
 * @param {Array} topStrengths
 * @returns {string}
 */
export function buildCharacterStrengthsProfile(topStrengths = []) {
    if (topStrengths.length === 0) {
        return '';
    }

    let profile = `[KARAKTER GÜÇLERİ PROFİLİ — 24 VIA Güçleri]\n\n`;
    profile += `Senin En İyi 3 Gücün:\n\n`;

    topStrengths.slice(0, 3).forEach((strength, idx) => {
        profile += `${idx + 1}. ${strength.name}\n`;
        profile += `   Kategori: ${strength.category}\n`;
        profile += `   Tanım: ${strength.desc}\n\n`;
    });

    profile += `[GÜÇLERİ YAŞAM İÇİNDE KULLAN]\n`;
    profile += `Bu güçler senin "iç rütinler"in.\n`;
    profile += `Meslekte, ilişkilerde, hobilerde bu güçleri uygula.\n`;
    profile += `Zayıf güçlerin değişemez (gen), ama dengele.\n`;
    profile += `→ Güçler = senin yetenek tabanı. Bunlara odaklan.`;

    return profile;
}

/**
 * Minnet pratiği (günlük)
 * @returns {string}
 */
export function buildGratitudePractice() {
    return `[MİNNET PRATİĞİ — Günlük Pozitif Psikoloji]\n\n` +
        `Neden Minnet?\n` +
        `• Beyni pozitif tarama moduna çevirir\n` +
        `• Depresyon/kaygı riski azalır\n` +
        `• İlişkiler derinleşir\n` +
        `• Mutluluk +25% artar (araştırma)\n\n` +
        `3 Seçenek:\n\n` +
        `1️⃣ GÜNDE 3 ŞÜKRAN (5 dakika)\n` +
        `   Her sabah/akşam 3 şey yaz:\n` +
        `   - Büyük: "Sevdiğim insanlar"\n` +
        `   - Küçük: "Bugün kahvenin tadı güzeldi"\n` +
        `   - Taş: "Sağlığım olması"\n\n` +
        `2️⃣ MİNNET TELEFONU (haftalık)\n` +
        `   Sevilene zaman telefon/mesaj yap:\n` +
        `   "Senden ne kadar minnettar olduğumu söylemek istedim"\n\n` +
        `3️⃣ SAVORING (anında minnet)\n` +
        `   Güzel andayken durdur:\n` +
        `   "Bu anda ne kadar bereket dolu!"\n` +
        `   Bilinçli o anı tadına var.\n\n` +
        `→ Minnet = mutluluk kapısı.`;
}

/**
 * Flourishing (Refah) Rehberi — PERMA + Güçler
 * @returns {string}
 */
export function buildFlourishingGuide() {
    return `[FLOURISHING — YAŞAM REFAHININ BAŞARISI]\n\n` +
        `Seligman'ın 5 Boyutu:\n\n` +
        `1️⃣ Pozitif Duygu (Her gün en az 1 neşeli şey)\n` +
        `2️⃣ Engagement (Günde 1 flow aktivite)\n` +
        `3️⃣ İlişkiler (Haftada 2x samimi bağlantı)\n` +
        `4️⃣ Anlam (Aylık 1 gönüllülük/amaçlı eylem)\n` +
        `5️⃣ Başarı (Haftaya 1 hedef + progress)\n\n` +
        `+ Karakter Güçleri:\n` +
        `Çalışlarda güçlerini kullan, zayıflıkları dengele.\n\n` +
        `Flourishing Kontrol Listesi:\n` +
        `☐ Günümde mutluk an var mı?\n` +
        `☐ Saatin unuttum dönem yaşıyor muyum?\n` +
        `☐ Yakın insanlarla iyi konuşuyorum?\n` +
        `☐ Yaşamım anlam dolu mu?\n` +
        `☐ Hedefime doğru ilerliyorum?\n\n` +
        `Hepsi "evet" = Flourishing\n` +
        `Bazıları "hayır" = Potansiyel\n\n` +
        `→ Flourishing = sağlık, mutsuzluk değil. İnşa et.`;
}
