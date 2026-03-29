// lib/habitTracking.js
// Alışkanlık Takibi ve Değiştirme — Davranış Zinciri Analizi
// James Clear "Atomic Habits" modeli, BehaviorChange Science, Habit Loop (BJ Fogg)
//
// Amaç: Alışkanlık tetikleyicisini bul, davranış zincirini kes, alternatif oluştur

const HABIT_TYPES = {
    cue_triggered: {
        name: 'Tetikleyici Tabanlı Alışkanlık',
        description: 'Belirli bir ortam veya duyguda otomatik tetiklenme',
        examples: [
            'Stres → telefon aç',
            'Sıkıntı → sosyal medya scroll',
            'Boredom → snack ye',
            'Yatış saati → sosyal medya',
            'Mutsuzluk → alışveriş / yemek sipariş',
        ],
        loop: 'CUE (Tetik) → ROUTINE (Rutinin) → REWARD (Ödül)',
    },

    habit_stacking: {
        name: 'Yapıştırılmış Alışkanlık',
        description: 'Mevcut alışkanlığa yeni davranış ekleme',
        examples: [
            'Sabah kahve SONRA: meditasyon',
            'Lunch SONRA: 10 dakika yürüyüş',
            'TV SONRA: 10 pushup',
            'Toothbrush SONRA: diyafram nefes',
        ],
        loop: 'Var olan alışkanlık = tetik + ödül yeri',
    },

    dopamine_seeking: {
        name: 'Dopamine Arama Alışkanlığı',
        description: 'Kısa vadeli ödül peşinde, uzun vadeli zarar',
        examples: [
            'Telefon (notification dopamine)',
            'Alkol / tütün (immediate relief)',
            'Gambling (uncertainty, risk)',
            'Fast food (taste dopamine)',
            'Retail therapy (dopamine spike)',
        ],
        loop: 'Streş / Boş → Kısa ödül → Sonrasında daha kötü → Loop tekrar',
    },

    avoidance_habit: {
        name: 'Kaçış Alışkanlığı',
        description: 'Hoş olmayan görevi erteleme, kaçındırıcı davranış',
        examples: [
            'İş var → netflix',
            'Çatışma gelecek → yok sayma',
            'Buro / dişçi → excuse bulma',
            'Duygulanmak → distraction',
            'Yüz yüze → mesaj tercih',
        ],
        loop: 'Kaygı / Görev → Kaçış → Kısa rahatlama → Ama sonra daha kötü',
    },

    identity_habit: {
        name: 'Kimlik Tabanlı Alışkanlık',
        description: '"Ben kahve adamıyım" veya "Ben tembel kişiyim" — self-image',
        examples: [
            '"Ben erken kalkan" / "Ben gece kuşu"',
            '"Ben uyuşturucu kullanmam" / "Ben kullanırım"',
            '"Ben çalışkan" / "Ben tembel"',
            '"Ben sağlıklı" / "Ben şeker düşkünü"',
        ],
        loop: 'Kimlik inancı → Tutarlı davranış → Davranış → Kimlik güçlenir',
    },
};

const BEHAVIOR_CHANGE_STRATEGIES = {
    cue_elimination: {
        name: 'Tetik Eleme',
        description: 'Tetikleyiciyi çevreden çıkart',
        example: 'Telefon başka odada → scroll alışkanlığı kırıldı',
        best_for: ['cue_triggered', 'dopamine_seeking'],
    },

    substitute_behavior: {
        name: 'Davranış Ikamesi',
        description: 'Aynı tetik, farklı rutine → aynı ödül sistem',
        example: 'Stres → telefon YERINE 5 dakika yürüyüş',
        best_for: ['cue_triggered', 'avoidance_habit'],
    },

    delay_technique: {
        name: 'Geciktirme Tekniği (Urge Surfing)',
        description: 'Arzuyu bastırmak değil, 15 dakika geciktirmek',
        example: 'Sosyal medya açmak istiyorum → 15 dakika bekle, sürge geçer',
        best_for: ['dopamine_seeking'],
    },

    habit_stacking: {
        name: 'Alışkanlık Yığını (Habit Stacking)',
        description: 'Zaten yapılan rutine ekle',
        example: 'Sabah kahve SONRA: 2 dakika meditasyon (her gün)',
        best_for: ['habit_stacking', 'identity_habit'],
    },

    implementation_intention: {
        name: 'Uygulama Niyeti ("If-Then" Planı)',
        description: 'Tetik gelince ne yapacağını önceden karar ver',
        example: 'IF stres THEN: 3 derin nefes AL, THEN: 5 dakika spor YAP',
        best_for: ['all'],
    },

    environmental_design: {
        name: 'Ortam Tasarımı',
        description: 'İstediğin davranışı kolay, istemediğini zor yap',
        example: 'Temiz havuç buzdolabında, kek 3 komşuda',
        best_for: ['dopamine_seeking', 'cue_triggered'],
    },

    social_commitment: {
        name: 'Sosyal Taahhüt',
        description: 'Başkasına söyle, public commitment',
        example: '"Bu hafta spora gideceğim" → arkadaşla SMS',
        best_for: ['avoidance_habit', 'dopamine_seeking'],
    },

    reward_substitution: {
        name: 'Ödül İkamesi',
        description: 'Eski ödülün yerini sağlıklı ödül al',
        example: 'Fast food yerine: sağlıklı yemek + masaj / müzik',
        best_for: ['dopamine_seeking'],
    },
};

/**
 * Alışkanlık türü ve tetikleyici tespit et
 * @param {string} userMessage
 * @returns {{ habitType: string, triggers: Array, frequency: string, severity: string }}
 */
export function detectHabitPattern(userMessage = '') {
    const text = userMessage.toLowerCase();
    const detected = [];
    const triggers = [];

    // Cue-triggered
    if (/yapıyor|otomatik|farketmeden|alışkanlık|her zaman|tetik/i.test(text)) {
        detected.push('cue_triggered');
    }

    // Dopamine seeking
    if (/telefon|sosyal|scroll|gambling|alkol|tütün|yemek|alışveriş|hızlı|immediate/i.test(text)) {
        detected.push('dopamine_seeking');
    }

    // Avoidance
    if (/kaçış|erteleme|çekiniyorum|yapamıyor|korkuyorum|engel|amaç|avoid/i.test(text)) {
        detected.push('avoidance_habit');
    }

    // Identity
    if (/ben\s+(\w+|[a-zçğıöşü]+)(\s+insanıyım|\s+kişiyim)?|doğam gereği|aslında|gerçekten/i.test(text)) {
        detected.push('identity_habit');
    }

    // Habit stacking
    if (/sonra|yapınca|zaman|her|saat|rutini|günlük/i.test(text)) {
        detected.push('habit_stacking');
    }

    // Trigger detection
    if (/stres|kaygı|sıkıntı|boredom|yalnız|mutsuz|yorgun|başarısız|kötü|gece/i.test(text)) {
        triggers.push('emotional_state');
    }
    if (/saat|sabah|akşam|yatış|kalkış|iş sonrası|okuldan|yemek/i.test(text)) {
        triggers.push('time_based');
    }
    if (/ortam|oda|sosyal|medya|telefon|bilgisayar|yatak|masada/i.test(text)) {
        triggers.push('environmental');
    }
    if (/insan|arkadaş|eş|grup|yalnız|herkesle|izleme/i.test(text)) {
        triggers.push('social');
    }

    const frequency =
        /her|her zaman|hergün|saatı|her saat|non-stop/.test(text)
            ? 'Çok sık'
            : /günde|haftada|bayağı|çoğu|tanıyor/.test(text)
              ? 'Sık'
              : 'Zaman zaman';
    const severity =
        text.includes('kontrol') || text.includes('alamıyor')
            ? 'Yüksek'
            : detected.length > 1
              ? 'Orta'
              : 'Düşük';

    return {
        habitType: detected[0] || null,
        allTypes: detected,
        triggers: triggers.slice(0, 3),
        frequency,
        severity,
        hasHabitIssue: detected.length > 0,
    };
}

/**
 * Alışkanlık zinciri analizi ve stratejisi
 * @param {string} habitType
 * @returns {string}
 */
export function buildHabitChangeContext(habitType = '') {
    if (!habitType || !HABIT_TYPES[habitType]) {
        return '';
    }

    const habit = HABIT_TYPES[habitType];
    let context = `[ALIŞKANLIK DEĞİŞTİRME — Davranış Zinciri Analizi]\n\n`;
    context += `Tür: ${habit.name}\n`;
    context += `Tanım: ${habit.description}\n\n`;

    context += `Örnekler:\n`;
    habit.examples.slice(0, 2).forEach(ex => {
        context += `  • ${ex}\n`;
    });

    context += `\nDavranış Döngüsü: ${habit.loop}\n\n`;

    if (habitType === 'cue_triggered') {
        context += `[TETIK KIRIL]\n`;
        context += `1️⃣ TEPİŞ BULUT\n`;
        context += `   Ne tetikliyor? (Durum, saat, duygu, yer)\n\n`;
        context += `2️⃣ RUTİNİ DEĞİŞTİR\n`;
        context += `   Aynı tetik → Farklı rutine (ama aynı ödül sistem)\n\n`;
        context += `3️⃣ ÖDÜLİ KONTROL ET\n`;
        context += `   Ödülün ne? (Kaçış, hazlama, rahatlaıma)\n`;
        context += `   Yeni rutinde aynı ödülü al\n\n`;
    } else if (habitType === 'dopamine_seeking') {
        context += `[DOPAMINE DÜZENLE]\n`;
        context += `1️⃣ İHTİYÇ ÇÖZÜMLE\n`;
        context += `   Gerçek ihtiyaç nedir? (Rahatlaıma, kaçış, stimülasyon)\n\n`;
        context += `2️⃣ ORTAM TASARLA\n`;
        context += `   Tetikleyiciyi çıkar (telefon başka oda, kek evde yok)\n\n`;
        context += `3️⃣ ALTERNATİF HAZIRLA\n`;
        context += `   Sağlıklı dopamine hit: egzersiz, hobi, arkadaş\n\n`;
    } else if (habitType === 'avoidance_habit') {
        context += `[KAÇIŞ KIRI]\n`;
        context += `1️⃣ KAYGIYIT TANIMA\n`;
        context += `   Ne kaçıyorsun? Neden korkuyorsun?\n\n`;
        context += `2️⃣ EN KÜÇÜK ADIM\n`;
        context += `   Tüm görev değil, 5 dakika başla\n\n`;
        context += `3️⃣ MOKtum BAŞLAMA\n`;
        context += `   "Başladıktan sonra iyileşiyor" (Not bitti, başlandı)\n\n`;
    } else if (habitType === 'identity_habit') {
        context += `[KİMLİĞİ YENİDE YAZMA]\n`;
        context += `1️⃣ İNANÇ SORGUIA\n`;
        context += `   "Ben [alışkanlık] insanıyım" → Kanıt ne?\n\n`;
        context += `2️⃣ BAŞARIY BULT\n`;
        context += `   Geçmiş başarılar: bu inanışa karşı kanıt\n\n`;
        context += `3️⃣ YENİ KİMLİK PRATIĞI\n`;
        context += `   "Ben sağlıklı kişi → sağlıklı davranış" başla\n`;
        context += `   Davranış → Kimlik → Davranış (loop)\n\n`;
    }

    context += `→ Alışkanlık değişiminin en hızlı yolu: ortamı düzenlemek.`;

    return context;
}

/**
 * 30 Günlük Alışkanlık Değiştirme Planı
 * @param {string} currentHabit — yapılan alışkanlık
 * @param {string} desiredHabit — istenen alışkanlık
 * @returns {string}
 */
export function build30DayHabitChangePlan(currentHabit = '', desiredHabit = '') {
    let plan = `[30 GÜNLÜK ALIŞKANLIK DEĞİŞTİRM PLANI]\n\n`;

    plan += `❌ ESKI: ${currentHabit}\n`;
    plan += `✅ YENİ: ${desiredHabit}\n\n`;

    plan += `[HAFTA 1 — HAZIRLIK]\n`;
    plan += `  • Tetik tanı\n`;
    plan += `  • Rutini tasarla\n`;
    plan += `  • Ortamı hazırla\n`;
    plan += `  • Hedefi sosyal commit (arkadaşa söyle)\n\n`;

    plan += `[HAFTA 2 — BAŞLANGIC]\n`;
    plan += `  • Yeni rutine başla (her gün)\n`;
    plan += `  • Başarılar not et\n`;
    plan += `  • Zorlukları yazı\n`;
    plan += `  • Ödül ver kendin (küçük ödül)\n\n`;

    plan += `[HAFTA 3 — MOMENTUM]\n`;
    plan += `  • Alışkanlık otomatik hale geliyor\n`;
    plan += `  • Direnç yavaşlıyor\n`;
    plan += `  • Konsistans kritik (hiç kaçmama)\n`;
    plan += `  • Başarıyı paylaş (sosyal accountability)\n\n`;

    plan += `[HAFTA 4 — ENTEGR)\n`;
    plan += `  • Yeni alışkanlık = bağımsız\n`;
    plan += `  • Döngünün gücü hissediyorsun\n`;
    plan += `  • Sonraki alışkanlığı hazırla\n`;
    plan += `  • Başarıyı kutla\n\n`;

    plan += `[30 GÜNÜN SONUNDA]\n`;
    plan += `  • Eski alışkanlık: %80 azalmış\n`;
    plan += `  • Yeni alışkanlık: otomatik\n`;
    plan += `  • Kimlik shift: "Ben [yeni insanım]"\n`;
    plan += `  • Sonraki hedef: hazırlan\n\n`;

    plan += `KURALL:\n`;
    plan += `  1️⃣ Hiç günü kaçırma (kuralını kır → baştan başla)\n`;
    plan += `  2️⃣ Tetik ve ödülün sabit (farklı değişme)\n`;
    plan += `  3️⃣ Ortamı kontrol et (iradeye güvenme)\n`;
    plan += `  4️⃣ Sosyal baskı kullan (başkasıyla yap)\n\n`;

    plan += `→ 66 gün = tam alışkanlık olabilecek ama 30 gün = başı anlamlı değişim.`;

    return plan;
}

/**
 * Davranış değiştirme stratejisi önerme
 * @param {string} habitType
 * @returns {string}
 */
export function suggestBehaviorChangeStrategy(habitType = '') {
    const strategies = {
        cue_triggered: ['cue_elimination', 'substitute_behavior', 'environmental_design'],
        dopamine_seeking: ['cue_elimination', 'delay_technique', 'reward_substitution'],
        avoidance_habit: ['implementation_intention', 'substitute_behavior', 'social_commitment'],
        identity_habit: ['habit_stacking', 'implementation_intention'],
        habit_stacking: ['habit_stacking', 'reward_substitution'],
    };

    const applicableStrategies = strategies[habitType] || Object.keys(BEHAVIOR_CHANGE_STRATEGIES);
    let result = `[DAVRANIŞSAL DEĞİŞKE STRATEJİLERİ]\n\n`;

    applicableStrategies.slice(0, 2).forEach((strat, i) => {
        const s = BEHAVIOR_CHANGE_STRATEGIES[strat];
        if (s) {
            result += `${i + 1}. ${s.name}\n`;
            result += `   ${s.description}\n`;
            result += `   Örnek: ${s.example}\n\n`;
        }
    });

    result += `→ Seç biri ile başla. 30 günde etkinliğini değerle.`;

    return result;
}
