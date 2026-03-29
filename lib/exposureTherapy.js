// lib/exposureTherapy.js
// Maruziyet Terapisi — Kademeli Maruz Kalma, Fobiler, Sosyal Anksiyete
// SUDS (Subjective Units of Distress Scale), hiyerarşi, deneyim
//
// Amaç: Kaçınma davranışını tespit, maruz kalma hiyerarşisi kurmak, anlık huzur

// ─── SUDS ÖLÇEĞİ (Subjective Units of Distress Scale) ─────────────────────────

/**
 * 0-100 SUDS ölçeği
 * 0 = Hiç rahatsız değil (rahat)
 * 50 = Orta derecede rahatsız (korkuyor ama dayanabiliyor)
 * 100 = Dayanılamayacak derecede rahatsız (panik, kaçış istemi)
 */

const SUDS_LEVELS = {
    0: { label: 'Rahatlık', desc: 'Hiç kaygı yok', behavior: 'Normal davranış' },
    10: { label: 'Minimal', desc: 'Çok hafif tedirginlik', behavior: 'Fark edilmeyecek düzeyde' },
    20: { label: 'Hafif', desc: 'Hafif kaygı, kontrol edebiyor', behavior: 'Bazen dikkat dağılır' },
    30: { label: 'Hafif-Orta', desc: 'Kaygı belirgin ama yönetilebilir', behavior: 'Mücadele var ama yapabiliyor' },
    40: { label: 'Orta', desc: 'Rahatsızlık açık, kontrol zor', behavior: 'Fizyolojik belirtiler başlar' },
    50: { label: 'Orta-Ağır', desc: 'Önemli kaygı, kişi stres altında', behavior: 'Kaçış düşüncü, terleme vb' },
    60: { label: 'Ağır', desc: 'Ciddi kaygı, kontrol güç', behavior: 'Paniğe yaklaşıyor' },
    70: { label: 'Çok Ağır', desc: 'Yoğun panik başlıyor', behavior: 'Kaçış eylemi olası' },
    80: { label: 'Panik', desc: 'Ciddi panik, kaçış istemi yüksek', behavior: 'Kaçmaya başladı' },
    90: { label: 'Ciddi Panik', desc: 'Dayanılamayacak kaygı', behavior: 'Tehlike hissi, dış dünyanın dışında' },
    100: { label: 'Aşırı Panik', desc: 'Tamamen kaçış odaklı', behavior: 'Çöküş, dissosiyasyon olası' },
};

// ─── MARUZ KALMA HİYERARŞİSİ ─────────────────────────────────────────────────

const EXPOSURE_HIERARCHY_EXAMPLES = {
    social_anxiety: {
        fear: 'Sosyal Anksiyete (Insanlar/Grup Korkusu)',
        hierarchy: [
            { level: 10, task: 'Tanımadığın birinin sosyal medya mesajı oku (yazma yok)' },
            { level: 20, task: 'Online forumda yorum oku, yazma yok' },
            { level: 30, task: 'Yazılı sohbet başlat (messenger, Discord)' },
            { level: 40, task: 'Bir arkadaşa telefon et, sohbet et' },
            { level: 50, task: 'Yeni tanıştığın birine tanış deneme yap' },
            { level: 60, task: 'Gruptaki tanıştığı birine konuş yada grup' },
            { level: 70, task: 'Üç kişilik dinlenme başlat' },
            { level: 80, task: 'Gruba katıl ve aktif konuş' },
            { level: 90, task: 'Yabancı insanlar arasında ön konuş yap' },
            { level: 100, task: 'Sunuş yap veya kalabalığın önünde konuş' },
        ],
    },
    public_speaking: {
        fear: 'Halk Karşısında Konuşma',
        hierarchy: [
            { level: 10, task: 'TED Talks izle, ses dinle' },
            { level: 20, task: 'Ayna karşısında 1 dakika konuş' },
            { level: 30, task: 'Telefonda arkadaşa 3 dakika konuş' },
            { level: 40, task: 'Kayıtta kendini konuşurken dinle' },
            { level: 50, task: 'Evde ailene 5 dakika konuş' },
            { level: 60, task: 'Arkadaş grubunda kısa sözleş yap' },
            { level: 70, task: 'Terapist/coach için 5 dakika konuş' },
            { level: 80, task: 'Ofis toplantısında görüş bil' },
            { level: 90, task: 'Tanıştığı gruba 3 dakika konuş' },
            { level: 100, task: '30+ kişilik dinleyiciyi konuş' },
        ],
    },
    flying: {
        fear: 'Uçağa Binme Korkusu',
        hierarchy: [
            { level: 10, task: 'Uçak filmleri/doku izle' },
            { level: 20, task: 'Uçak motorunun sesini dinle' },
            { level: 30, task: 'Havaalanı websitesinde uçak resmi gör' },
            { level: 40, task: 'Havaalanında yürü, uçakları gözlemle' },
            { level: 50, task: 'Havaalanında terminal gez' },
            { level: 60, task: 'Uçak parkında durmuş uçağa yaklaş' },
            { level: 70, task: 'Kargo/charter uçağına bin (test)' },
            { level: 80, task: 'Kısa uçuş yap (1 saat)' },
            { level: 90, task: 'Orta uçuş yap (3 saat)' },
            { level: 100, task: 'Uzun uçuş yap (7+ saat)' },
        ],
    },
    elevator: {
        fear: 'Asansör Korkusu (Claustrophobia)',
        hierarchy: [
            { level: 10, task: 'Asansör fotoğrafı gör' },
            { level: 20, task: 'Asansöre binenleri gözlemle' },
            { level: 30, task: 'Asansörün yanında dur, kapısı görün' },
            { level: 40, task: 'Asansöre bin, kapı açık halde' },
            { level: 50, task: 'Asansöre bin, kapı kapat ama 5 saniye' },
            { level: 60, task: 'Asansöre bin, 1 katlı yükseli' },
            { level: 70, task: 'Asansöre bin, 3 katlı yükseli' },
            { level: 80, task: 'Asansöre bin, 8+ katlı yükseli' },
            { level: 90, task: 'Asansöre bin, yavaş hareket et' },
            { level: 100, task: 'Asansöre bin, sıkışık halde, uzun gezini' },
        ],
    },
};

// ─── KAÇINMA DAVRANIŞI PATERNLERİ ─────────────────────────────────────────────

const AVOIDANCE_PATTERNS = {
    complete_avoidance: {
        pattern: 'Tam Kaçınma',
        description: 'Korkulu durumu tamamen kaçınma',
        example: 'Sosyal anksiyete → Sosyal etkinliklere gitme yok',
        impact: 'Korku artar, hayat kısıtlanır, depresyon',
        exposure_level: 'Başlangıç: En düşük (10-20 SUDS)',
    },
    safety_behaviors: {
        pattern: 'Güvenlik Davranışları',
        description: 'Kaçırma yerine, "korumaya alınma" davranışları',
        example: 'Sosyal etkinlikte kalabalıktan uzak durma, cep telefonu başı incelemesi',
        impact: 'Korku kalıcı, avantajın altında durur',
        exposure_level: 'Orta: Davranışları geri çek (50-60 SUDS)',
    },
    avoidance_thinking: {
        pattern: 'Kaçınma Düşüncesi',
        description: 'Kaçınma fikriyle ruh haline kapılma',
        example: 'Konuşma: "Yana yapamayacağım, aptal görünürüm"',
        impact: 'Fizyolojik kaygı tetikler, kısır döngü',
        exposure_level: 'Bilişsel: Düşüncü test et (30-40 SUDS)',
    },
};

// ─── DETECT & ASSESS ──────────────────────────────────────────────────────────

/**
 * Fobik kaçınma ve başlangıç SUDS tahmin et
 * @param {string} userMessage
 * @returns {{ hasPhobia: boolean, phobiaType: string, estimatedBaseSUDS: number, avoidancePattern: string }}
 */
export function detectPhobiaAvoidance(userMessage = '') {
    const text = userMessage.toLowerCase();
    let phobiaType = '';
    let avoidancePattern = '';
    let estimatedSUDS = 50; // orta başlangıç

    // Fobia tespiti
    if (/sosyal|insan|grup|konuş|halk|party|etkinlik|toplul/i.test(text)) {
        if (/korku|anksiyete|kaygı|endişe|panik|kızar/i.test(text)) {
            phobiaType = 'social_anxiety';
            estimatedSUDS = 65;
        }
    }
    if (/sunuş|konuş|halk|konuşm|sahne|ses/i.test(text)) {
        if (/korku|anksiyete|kaygı|panik/i.test(text)) {
            phobiaType = 'public_speaking';
            estimatedSUDS = 75;
        }
    }
    if (/uçak|uç|havatarafı|hava yolları|uçmak/i.test(text)) {
        if (/korku|anksiyete|kaygı|panik|korkuyor/i.test(text)) {
            phobiaType = 'flying';
            estimatedSUDS = 80;
        }
    }
    if (/asansör|kapı|kapalı|sıkışık|dar|claustrophobia/i.test(text)) {
        if (/korku|anksiyete|kaygı|panik|nefes/i.test(text)) {
            phobiaType = 'elevator';
            estimatedSUDS = 70;
        }
    }

    // Kaçınma paterni
    if (/gitmiyorum|yapmıyorum|kaçıyorum|yapamam|olmaz|hayır/i.test(text)) {
        avoidancePattern = 'complete_avoidance';
    } else if (/ama yapıyorum|çok zor|takma|korkuyla|zorlukla/i.test(text)) {
        avoidancePattern = 'safety_behaviors';
        estimatedSUDS -= 10;
    }

    return {
        hasPhobia: !!phobiaType,
        phobiaType,
        estimatedBaseSUDS: estimatedSUDS,
        avoidancePattern,
    };
}

/**
 * SUDS seviyesi tahmin et metin içeriğinden
 * @param {string} userMessage
 * @returns {{ estimatedSUDS: number, sudsLabel: string }}
 */
export function estimateSUDS(userMessage = '') {
    const text = userMessage.toLowerCase();
    let suds = 50;

    // Rahatlık işaretleri
    if (/rahat|yapabilir|yönetebil|kontrol|normal/i.test(text)) suds -= 20;
    if (/şimdi|güvenli|temiz|sorun yok/i.test(text)) suds -= 10;

    // Kaygı işaretleri
    if (/endişe|kaygı|tedirgin|çekil|zorluk/i.test(text)) suds += 10;
    if (/panik|korku|kaçmak|yapamam|ölecek/i.test(text)) suds += 30;
    if (/şimdi|acil|çöküş|hafif|aile|hastal|ölüm|intihar/i.test(text)) suds += 40;

    suds = Math.max(0, Math.min(100, suds));

    let label = 'Orta';
    if (suds < 20) label = 'Hafif';
    else if (suds < 40) label = 'Hafif-Orta';
    else if (suds < 60) label = 'Orta';
    else if (suds < 80) label = 'Ağır';
    else label = 'Panik';

    return {
        estimatedSUDS: suds,
        sudsLabel: label,
    };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * Maruz kalma hiyerarşisi inşa et
 * @param {string} phobiaType — 'social_anxiety', 'public_speaking', 'flying', 'elevator'
 * @returns {string}
 */
export function buildExposureHierarchy(phobiaType = '') {
    if (!phobiaType || !EXPOSURE_HIERARCHY_EXAMPLES[phobiaType]) {
        return '';
    }

    const example = EXPOSURE_HIERARCHY_EXAMPLES[phobiaType];
    let hierarchy = `[MARUZ KALMA HİYERARŞİSİ — Kademeli Adımlar]\n\n`;
    hierarchy += `Korku: ${example.fear}\n\n`;

    hierarchy += `10 Aşamalı Plan (SUDS 10 → 100):\n`;
    example.hierarchy.forEach((step, idx) => {
        const sudsData = SUDS_LEVELS[step.level];
        hierarchy += `${idx + 1}. SUDS ${step.level} — ${sudsData.label}\n`;
        hierarchy += `   Task: ${step.task}\n`;
        hierarchy += `   Hedef: Bu görev rahat yapılana kadar\n\n`;
    });

    hierarchy += `[MARUZ KALMA KURSU]\n`;
    hierarchy += `1️⃣ SUDS ölçümü: Başlangıçta, her step'te, sonrasında not et\n`;
    hierarchy += `2️⃣ Habituation: Korku zamanla azalır (30-45 min)\n`;
    hierarchy += `3️⃣ Güvenlik davranışlarını ÇIKAR: "Korumaya alınma" yapma\n`;
    hierarchy += `4️⃣ Tekrarlama: Her adımı 3-5 kez yap, SUDS 20 altına düşene kadar\n`;
    hierarchy += `5️⃣ Hız: Çok hızlı ilerleme yapma, sabrını tut\n\n`;

    hierarchy += `→ Maruz kalma = korkunun test edilmesi. "Korku saçma" öğrenme.`;

    return hierarchy;
}

/**
 * SUDS tracking ve geri bildirim
 * @param {number} sudsScore — 0-100
 * @returns {string}
 */
export function buildSUDSFeedback(sudsScore = 50) {
    const level = SUDS_LEVELS[Math.round(sudsScore / 10) * 10] || SUDS_LEVELS[50];

    let feedback = `[SUDS GERI BİLDİRİM]\n\n`;
    feedback += `Anında SUDS: ${sudsScore}/100\n`;
    feedback += `Seviye: ${level.label}\n`;
    feedback += `Tanım: ${level.desc}\n`;
    feedback += `Davranış: ${level.behavior}\n\n`;

    if (sudsScore < 30) {
        feedback += `✅ HARIKA: Kontrol altında. Devam et!\n`;
    } else if (sudsScore < 50) {
        feedback += `🟡 ORTA: Zor ama yönetilebilir. Kalıcı kal.\n`;
    } else if (sudsScore < 70) {
        feedback += `🟠 AĞIR: Panik başlıyor. Derin nefes, grounding yap.\n`;
    } else {
        feedback += `🔴 ÇOK AĞIR: Panik seviyesi. Güvenli yer bul, terapiste ulaş.\n`;
    }

    feedback += `\n[SONRASI]\n`;
    feedback += `Bu görev tekrar et → SUDS daha düşük olacak\n`;
    feedback += `Tekrarlama = alışkanlık = korku azalır\n`;
    feedback += `→ Sabır + tekrarlama = maruz kalmanın gücü.`;

    return feedback;
}

/**
 * Maruziyet terapisi rehberi (pratik adımlar)
 * @returns {string}
 */
export function buildExposureTherapyGuide() {
    return `[MARUZ KALMA TERAPİSİ REHBERİ]\n\n` +
        `🎯 AMAÇ: Kaçınma döngüsünü kır, korkunun gerçek olmadığını öğren\n\n` +
        `5 ADIM:\n` +
        `1️⃣ BAŞLANGIÇ SUDS: Korkulu durumda SUDS ölç (biraz sonra)\n` +
        `2️⃣ MARUZ KAL: 30-45 dakika durumda kal, kaçma\n` +
        `3️⃣ SUDS TRACKİNG: 5 dakikada bir SUDS not et\n` +
        `   - Başlangıç: Yüksek (ör: 70)\n` +
        `   - Ortası: Stabil veya azalıyor\n` +
        `   - Sonu: Düşük (ör: 30)\n` +
        `4️⃣ İSTERSE KAÇMA (son çare): Eğer panik → güvenli yer, sakinleş\n` +
        `   ama hedef = sonuna kadar durmak\n` +
        `5️⃣ TEKRARLA: 3-5 gün sonra tekrar et\n` +
        `   - Her tekrarlamada SUDS daha düşük başlıyor\n` +
        `   - 3-5 tekrarlama = SUDS 20 altında kalır\n` +
        `   - Ardından yeni seviye başla\n\n` +
        `⚠️ HATA YAPMA:\n` +
        `❌ Güvenlik davranışları: Korkmamak için takma taktiği\n` +
        `❌ Çok hızlı: Adım atlama\n` +
        `❌ Çok az tekrarlama: Sadece 1x yapma\n\n` +
        `→ Maruz kalma = korkunun "asılsız" olduğunu kanıtla.`;
}

/**
 * Kaçınma döngüsü ve alternatif
 * @returns {string}
 */
export function buildAvoidanceCycleDiagram() {
    return `[KAÇINMA DÖNGÜSÜ]\n\n` +
        `❌ KIR DÖNGÜ (Korku Artar):\n` +
        `Tetikleyici (durumu görmek)\n` +
        `     ↓\n` +
        `Kaygı/Korku (SUDS artar)\n` +
        `     ↓\n` +
        `Kaçış Davranışı (saka, kaçış, güvenlik)\n` +
        `     ↓\n` +
        `Rahatış (anında, ama yanılış!)\n` +
        `     ↓\n` +
        `Döngü Tekrarlama → Korku SÜRKLİ ARTAR\n\n` +
        `✅ MARUZ KALMA DÖNGÜSÜ (Korku Azalır):\n` +
        `Tetikleyici (durumda kal)\n` +
        `     ↓\n` +
        `Kaygı/Korku (SUDS artar, ama kal)\n` +
        `     ↓\n` +
        `Adaptasyon (beyin: "hayır, güvenli")\n` +
        `     ↓\n` +
        `Habituation (SUDS azalır, rahatş)\n` +
        `     ↓\n` +
        `Kaçış Gerekmez → Korku KALICISIZ AZALIR\n\n` +
        `→ Kaçış = korkuyu pekiştirir. Kalış = iyileştirir.`;
}
