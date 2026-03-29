// lib/sleepHygiene.js
// Uyku Hijyeni — Uyku Kalitesi ve Ruh Sağlığı Bağlantısı
// Sleep Science, Circadian Rhythm, CBT-I (Cognitive Behavioral Therapy for Insomnia)
//
// Amaç: Uyku patternlerini analiz, kalitesini arttırma, duygu ruh dengesini sağlama

const SLEEP_ISSUES = {
    insomnia: {
        name: 'Uykusuzluk (Insomnia)',
        description: 'Uyku başlatma veya devamlılığı problemi',
        subtypes: ['sleep_onset', 'sleep_maintenance', 'early_morning_awakening'],
        indicators: [
            'Yatmak için 30+ dakika harcıyor',
            'Gece uyanıp tekrar uyuyamıyor',
            'Sabah 4-5te uyanıyor, tekrar uyuyamıyor',
            'Zihin hızlı çalışıyor (rumination)',
        ],
        emotional_impact: 'Kaygı, depresyon, irritabilite, düşük odaklanma',
    },

    oversleeping: {
        name: 'Aşırı Uyku (Hypersomnia)',
        description: '9+ saate rağmen sürekli uyku açlığı',
        indicators: [
            '10+ saat uyuyorum ama hala yorgun',
            'Sabah çok zor kalkıyor',
            'Gün boyunca uyku hali devam ediyor',
            'Depresif dönemde daha kötü',
        ],
        emotional_impact: 'Depresyon, enerji yoksunluğu, gün kaybı hissi',
    },

    fragmented_sleep: {
        name: 'Parçalanmış Uyku',
        description: 'Gece sık sık uyanma, derin uyku yok',
        indicators: [
            'Her 1-2 saat uyanıyor',
            'Rüya gördüğünü hiç hatırlamıyor veya çok fazla hatırıyor',
            'Sabah "kötü uyku" hissi',
            'Fiziksel hiç rahatlama yok',
        ],
        emotional_impact: 'Kaygı, konsantrasyon bozukluğu, mood düşüklüğü',
    },

    reversed_schedule: {
        name: 'Uyku-Uyanma Döngüsü Tersine (Phase Shift)',
        description: 'Gece uyanık, gün uyku — circadian ritim kaosu',
        indicators: [
            'Gece 2-4 saatlerde uyuyor',
            'Gündüz uyuyor',
            'Güneş görmüyor',
            'Sosyal / iş yaşam etkileniyor',
        ],
        emotional_impact: 'Depresyon, sosyal izolasyon, vitamin D eksikliği',
    },

    parasomnia: {
        name: 'Parasomniya (Uyku Davranışları)',
        description: 'Uyku sırasında anormal davranışlar',
        subtypes: ['sleep_walking', 'sleep_talking', 'nightmare', 'night_terror', 'sleep_paralysis'],
        indicators: [
            'Sabah kısmi hatırlamayan davranış',
            'Korkunç rüyalar (sık)',
            'Uyarılmadan hareket etme',
            'Gürültü yapma',
        ],
        emotional_impact: 'Travma, kaygı, uyku korkusu, istirahat eksikliği',
    },

    sleep_apnea: {
        name: 'Uyku Apnesi (Tıbbi Durum)',
        description: 'Uyku sırasında nefes kesintileri',
        indicators: [
            'Horlama (eş söyler)',
            'Gece nefes boşluğu',
            'Sabah baş ağrısı',
            'Aşırı uyku açlığı',
        ],
        emotional_impact: 'Kaygı, depresyon, dikkat sorunu',
    },
};

const SLEEP_HYGIENE_FACTORS = {
    light: {
        factor: 'Işık Düzeni',
        optimal: 'Akşam az ışık, gece koyu, sabah çok ışık',
        tips: [
            '22:00 sonra: telefon / ekran ışığı kes (1-2 saat)',
            'Yatak odasında koyu perde (tam karanlık)',
            'Sabah ilk şey: dış ışığa maruz kal (pencere açık veya dışarı)',
            '09:00-11:00: güneş (circadian ritmi sıfırla)',
        ],
    },

    temperature: {
        factor: 'Sıcaklık',
        optimal: '15-19°C (soğuk oda, sıcak yatak)',
        tips: [
            'Oda sıcaklığı: 18°C ideal',
            'Önce ılık duş (vücut ısısı sonra düşer)',
            'Ağır yorgan veya battaniye (kütlelenmiş uyku etkisi)',
            'Yazda hava akışı sağla (fan)',
        ],
    },

    sound: {
        factor: 'Ses',
        optimal: 'Sakin, tahmin edilebilir, ~50dB veya sessiz',
        tips: [
            'Diş sesler: fon, kulaklık, ses derinliği',
            'Konsantre: tekrarlayan (yağmur, ormanda, şarındı)',
            'Telefonunun zilini kapat (vibrant yok)',
            'Yatak odasından dışarıdaki gürültü min',
        ],
    },

    activity: {
        factor: 'Yatış Öncesi Aktivite',
        optimal: 'Sessiz, yavaş, meditativ',
        tips: [
            '22:00 sonra: yavaş aktiviteler (okuma, meditasyon, stretching)',
            '❌ Aksiyon filmi, video oyunu, tartışma',
            '❌ Şiddetli egzersiz (yakında uyumadan 2-3 saat evvel)',
            'Yatış 30 dakika evvel: yoga, deep breathing, body scan',
        ],
    },

    food_drink: {
        factor: 'Beslenme & İçecek',
        optimal: 'Hafif, düşük kafein, az gıda 2+ saat evvel',
        tips: [
            '❌ Akşam 18:00 sonra: kahve, çay, enerji içeceği',
            '❌ Yatmadan 2 saat: ağır yemek, alkol',
            '✅ Yatış 1-2 saat evvel: hafif ısıl + karbonhidrat (hindiba, muz, süt)',
            'Gece uyanırsan: soğuk su içme (stimülansı), yavaş nefes',
        ],
    },

    schedule: {
        factor: 'Uyku Saati Tutarlılığı',
        optimal: 'Hergün aynı saat yat/kalk (haftasonu +30 min makul)',
        tips: [
            'Haftasonu 3+ saatlik sapma: circadian ritmi bozuyor',
            'Gece vardiya: tutarlı kalma (ne olursa olsun)',
            'Uyku borcu: weekende telafi değil, weekday düzeltme',
            'Sekund uyku: 20 dakika Max (1-2 saat = gece uyku bozar)',
        ],
    },

    mattress_bedding: {
        factor: 'Yatak Kalitesi',
        optimal: 'Ortez destek, rahat, temiz, kütlelenmiş hissi',
        tips: [
            'Yatak yaşı: 7-10 yıl (sonra değiştir)',
            'Yastık: tepesi koymuş, çok düşük değil',
            'Pürüzlü çarşaf: dönem sürümü ve nemlendir',
            'Kütlelenmiş battaniye: 10% vücut ağırlığı',
        ],
    },
};

/**
 * Uyku problemi ve kalitesi tespit et
 * @param {string} userMessage
 * @returns {{ detectedIssue: string, severity: string, circadianDisruption: boolean, emotionalImpact: string }}
 */
export function detectSleepIssue(userMessage = '') {
    const text = userMessage.toLowerCase();
    const detected = [];

    // Insomnia
    if (/uyku|başlayamıyor|baştamaz|yatamıyor|uyanıyor|uyuyamıyor|zihni/i.test(text)) {
        detected.push('insomnia');
    }

    // Oversleeping
    if (/çok uyuyorum|9\+|10\+|yaşlı|sabah kalkamıyor|yorgun|hala|uyku|açlığı/i.test(text)) {
        detected.push('oversleeping');
    }

    // Fragmented
    if (/parçala|sık sık|her saat|rüya|hiç rahat|kötü uyku/i.test(text)) {
        detected.push('fragmented_sleep');
    }

    // Reversed schedule
    if (/gece uyanık|gündüz uyku|tersine|sosyal|güneş|güneş görmüyor/i.test(text)) {
        detected.push('reversed_schedule');
    }

    // Parasomnia
    if (/rüya|korkulu|korkunç|yürüme|konuş|uyku paralizi|titrem|nefes/i.test(text)) {
        detected.push('parasomnia');
    }

    // Sleep apnea
    if (/horlama|nefes|sabah baş|aşırı uyku|nefes kesintisi/i.test(text)) {
        detected.push('sleep_apnea');
    }

    const primaryIssue = detected[0] || null;
    const severity =
        text.includes('haftalar') || text.includes('aylar') ? 'high' : detected.length > 2 ? 'moderate' : 'low';
    const circadianDisruption = detected.includes('reversed_schedule');

    return {
        detectedIssue: primaryIssue,
        severity,
        circadianDisruption,
        allIssues: detected,
        hasSleeIssue: detected.length > 0,
        emotionalImpact: primaryIssue ? SLEEP_ISSUES[primaryIssue]?.emotional_impact || '' : '',
    };
}

/**
 * Uyku hijyeni bağlamı oluştur
 * @param {string} issueName
 * @returns {string}
 */
export function buildSleepHygieneContext(issueName = '') {
    if (!issueName || !SLEEP_ISSUES[issueName]) {
        return '';
    }

    const issue = SLEEP_ISSUES[issueName];
    let context = `[UYKU HİJYENİ — Uyku Kalitesi Düzeltme]\n\n`;
    context += `Problem: ${issue.name}\n`;
    context += `Tanım: ${issue.description}\n\n`;

    context += `Belirtiler:\n`;
    issue.indicators.slice(0, 3).forEach(ind => {
        context += `  • ${ind}\n`;
    });

    context += `\nRuh Sağlığı Etkisi: ${issue.emotional_impact}\n\n`;

    context += `[7 GÜNLÜK UYKU DÜZELTMESİ]\n`;
    context += `Gün 1-3: Saati sabitle (her gün aynı saat yat/kalk)\n`;
    context += `Gün 4-5: Işık düzenini düzelt (akşam az, sabah çok)\n`;
    context += `Gün 6-7: Oda sıcaklığı + yatmadan aktivitesi ayarla\n\n`;

    context += `→ Uyku beynin reinisyalizasyonudur. Uyku = sağlık temeldir.`;

    return context;
}

/**
 * Kişisel uyku hijyeni planı
 * @param {Object} preferences — { bedtime, wakeTime, issues }
 * @returns {string}
 */
export function buildPersonalSleepPlan(preferences = {}) {
    const { bedtime = '22:00', wakeTime = '07:00', issues = [] } = preferences;

    let plan = `[KİŞİSEL UYKU PLANI]\n\n`;
    plan += `Uyku Saati: ${bedtime}\n`;
    plan += `Uyanış Saati: ${wakeTime}\n`;
    plan += `Toplam: ~8 saat (ideal)\n\n`;

    plan += `[HERGÜN RUTİN]\n\n`;
    plan += `📱 ${wakeTime}: Uyan\n`;
    plan += `  • 5 dakika: pencere aç, doğal ışık\n`;
    plan += `  • 15 dakika: hareket (yürüyüş, streç)\n\n`;

    plan += `☕ ${wakeTime} + 1 saat: Kahve (bu soğuktan sonra)\n`;
    plan += `  • ❌ Kahvenin öncesinde hiç kafein\n\n`;

    const bedtimeHour = parseInt(bedtime.split(':')[0]);
    const hour2Before = bedtimeHour - 2;
    const hour1Before = bedtimeHour - 1;
    const min30Before = bedtimeHour - 0.5;

    plan += `🕐 ${String(hour2Before).padStart(2, '0')}:00: İlk uyarı\n`;
    plan += `  • ❌ Kahve sonlanıyor\n`;
    plan += `  • ✅ Hafif yemek yemişsen\n\n`;

    plan += `🕐 ${String(hour1Before).padStart(2, '0')}:00: Sakinleşme başla\n`;
    plan += `  • Ekranları kapat (telefon, laptop, TV)\n`;
    plan += `  • Okuma, meditasyon, yoga başla\n`;
    plan += `  • Sıcak su içebilirsin\n\n`;

    plan += `🕐 ${String(Math.floor(min30Before)).padStart(2, '0')}:30: Hazırlık\n`;
    plan += `  • Gece rutini (diş fırçala, yüz yıka)\n`;
    plan += `  • Oda soğuk mu? Check\n`;
    plan += `  • Telefonun sessiz mi? Check\n\n`;

    plan += `😴 ${bedtime}: Yatış\n`;
    plan += `  • Işığı kapat, karanlık tamamen\n`;
    plan += `  • 4-6-8 nefes başla (sakinleşme)\n`;
    plan += `  • Vücut scan: baş → ayaklar relaksiyon\n\n`;

    plan += `[GECE UYANIRSAN]\n`;
    plan += `  • 15 dakika: yatakta kal, nefes al\n`;
    plan += `  • 15+ dakika: yataktan kalk, sessiz aktivite\n`;
    plan += `  • ❌ Telefon, TV, ışık (melatonin daha da düşer)\n`;
    plan += `  • Tekrar uyku gelirse yatağa dön\n\n`;

    plan += `→ 3 hafta tuttuğunda otomatik hale gelir.`;

    return plan;
}

/**
 * Uyku kalitesi skoru
 * @param {Object} sleepData — { bedtime, wakeTime, interruptions, mood, energy }
 * @returns {{ score: number, rating: string, feedback: Array }}
 */
export function calculateSleepQualityScore(sleepData = {}) {
    const {
        bedtime = 23,
        wakeTime = 7,
        interruptions = 0,
        mood = 5,
        energy = 5,
        sleepDuration = 8,
    } = sleepData;

    let score = 0;

    // Duration (0-25)
    if (sleepDuration >= 7 && sleepDuration <= 9) {
        score += 25;
    } else if (sleepDuration >= 6 && sleepDuration < 10) {
        score += 20;
    } else {
        score += 10;
    }

    // Consistency (0-25)
    const timeVariance = Math.abs(bedtime - 22) + Math.abs(wakeTime - 7);
    if (timeVariance < 1) {
        score += 25;
    } else if (timeVariance < 3) {
        score += 15;
    } else {
        score += 5;
    }

    // Interruptions (0-20)
    if (interruptions === 0) {
        score += 20;
    } else if (interruptions <= 2) {
        score += 10;
    } else {
        score += 0;
    }

    // Mood & Energy (0-30)
    const avgSurvey = (mood + energy) / 2;
    score += Math.min(30, avgSurvey * 3);

    const rating =
        score >= 80
            ? 'Mükemmel'
            : score >= 60
              ? 'İyi'
              : score >= 40
                ? 'Orta'
                : 'Düşük';

    const feedback = [];
    if (sleepDuration < 7) feedback.push('Uyku süreniz kısa. 7-9 saat hedefle.');
    if (sleepDuration > 9) feedback.push('Çok uyuyorsunuz. Depresyon sinyali olabilir.');
    if (timeVariance > 2) feedback.push('Uyku saati tutarsız. Aynı saatte yat/kalk.');
    if (interruptions > 0) feedback.push(`Gece ${interruptions} kez uyandınız. Ortamı kontrol et.`);
    if (mood < 4) feedback.push('Ruh haliniz düşük. Uyku kalitesi artırılsın.');

    return {
        score: Math.min(100, Math.round(score)),
        rating,
        feedback,
    };
}

/**
 * Circadian ritim güvenleştirme
 * @returns {string}
 */
export function buildCircadianRhythmReset() {
    return `[CIRCADIAN RİTİM SIFIRLAMA — 3 Günlük Protokol]\n\n` +
        `1️⃣ GÜN 1 — SıFıR Noktası\n` +
        `• Bugün sabah ilk iş: 15 dakika doğal ışık (pencere açık veya dışarı)\n` +
        `• Saat 22:00: Oda koyu, yatak sıcak, hava soğuk\n` +
        `• Saat 07:00: Uyan, ışık, hareket\n\n` +
        `2️⃣ GÜN 2-3 — TESBİT\n` +
        `• Sabah: Aynı saat, aynı ışık\n` +
        `• Akşam: Aynı hazırlık, aynı yatış saati\n` +
        `• Hiç istisna yok (haftasonu da değil)\n\n` +
        `3️⃣ İKİ HAFTA SONRA\n` +
        `• Melatonin düzeyi normalize oldu\n` +
        `• Doğal uyku-uyanma döngüsü başladı\n` +
        `• Ruh haliniz stabil, enerji normal\n\n` +
        `→ Circadian ritim = biyolojik saat. Uyar, öğretir, otomatik hale gelir.`;
}
