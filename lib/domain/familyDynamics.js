// lib/familyDynamics.js
// Aile Dinamikleri — Murray Bowen Teorisi, Aile Sistemleri
// Nesiller arası örüntüler, diferansiasyon, entanglement, seçilmiş çocuk
//
// Amaç: Aile çatışması, rol çakışması, sınır ihlallerini tespit ve iyileştirme stratejileri

// ─── BOWEN AILE SİSTEMLERİ TEORİSİ ─────────────────────────────────────────

/**
 * Diferansiasyon Seviyeleri (Bowen):
 * 25-40: Çok entangle (enmeshed) — kimlik aile tarafından tanımlanır
 * 40-60: Orta — bazı sınırlar var
 * 60-75: İyi — kendi kimliği bağımsız
 * 75+: Çok yüksek — sağlıklı bağlantı + özerklik
 */

const DIFFERENTIATION_LEVELS = {
    very_low: {
        range: [0, 40],
        label: 'Çok Düşük (Entangle)',
        indicators: ['kimlik aile tarafından belirlenir', 'duygusal reaktivite', 'fusion (eritilme)', 'trianguilation'],
        risks: 'ruhsal çöküş, kaygı seçilmiş çocuğa aktarılır',
        healing: 'Sınır inşası, "ben" ifadeleri, duygusal detachment',
    },
    low: {
        range: [40, 55],
        label: 'Düşük',
        indicators: ['sınırlar belirsiz', 'aile kararları bireysel kararı etkiler', 'duygusal enmeshment'],
        risks: 'depresyon, anksiyete, kimlik karmaşası',
        healing: 'Sınır tanımla, aile beklentilerini kabullen',
    },
    medium: {
        range: [55, 70],
        label: 'Orta',
        indicators: ['kendi görüşü var ama aile etkisine açık', 'duygusal bağlantı dengeli'],
        risks: 'durum bağımlı reaktivite',
        healing: 'Duygusal düzen, sağlıklı iletişim',
    },
    good: {
        range: [70, 85],
        label: 'İyi',
        indicators: ['kendi kimliği açık', 'seçici duygusal bağlantı', 'sınırlar saygılı'],
        risks: 'minimal',
        healing: 'Devam et, derinleştir',
    },
    excellent: {
        range: [85, 100],
        label: 'Mükemmel',
        indicators: ['aile ile sağlıklı ilişki', 'duygusal bağımsızlık + yakınlık', 'kendi değerleri bağımsız'],
        risks: 'none',
        healing: 'Mentor ol, diğerlerine model ol',
    },
};

// ─── AILE ROLLER VE ÖRÜNTÜLER ──────────────────────────────────────────────

const FAMILY_ROLES = {
    parentified_child: {
        name: 'Ebeveynleştirilmiş Çocuk (Parentified)',
        description: 'Çocuk erken yaşta ebeveyn rolünü üstlenir',
        signs: ['erişkinleştirilmiş davranış', 'ek taşıyıcı', 'sınırları belirsiz'],
        impacts: 'Anksiyete, kontrol ihtiyacı, ilişkilerde sağlık kaygısı',
        healing: 'Çocukluğu geri al, sorumluluğu aile versin',
    },
    scapegoat: {
        name: 'Seçilmiş Çocuk (Scapegoat)',
        description: 'Aile sorumluluğu bu çocuğa yüklenir',
        signs: ['aile tarafından suçlanır', 'uygunsuzluk etiketi', 'öfke nesnesi'],
        impacts: 'Düşük öz-değer, depresyon, suçluluk',
        healing: 'Bireysel kimlik kuruluş, ailede yeniden konumlandırma',
    },
    golden_child: {
        name: 'Altın Çocuk (Golden Child)',
        description: 'Mükemmeli, başarılı, aile prestiji',
        signs: ['yüksek beklenti', 'şartlı sevgi', 'kendi arzuları ikinci'],
        impacts: 'Perfeksiyonizm, panik, impostor sendromu',
        healing: 'Ebeveynleri hayal kırıklığına uğratma korkusunu çöz',
    },
    peacekeeper: {
        name: 'Barışçı (Peacekeeper)',
        description: 'Aile çatışmasını önlemek için rol oynar',
        signs: ['enerji çatışması çözmede', 'kimlik aile uyumunun etrafında'],
        impacts: 'Kendi ihtiyaçlarının yok sayılması, huysuzluk',
        healing: 'Çatışma kabul et, kendi ihtiyaçların basın',
    },
    lost_child: {
        name: 'Kayıp Çocuk (Lost Child)',
        description: 'Aile dinamiğinde görülmeyen, sessiz',
        signs: ['aile dramatisinde yer almaz', 'bağlantı arzusu ama korku', 'yalnızlık'],
        impacts: 'Sosyal izolasyon, depresyon, adanmışlık eksikliği',
        healing: 'Görünürlük, kimlik, bağlantı kurma',
    },
};

// ─── AILE ÇATIŞMA ÖRÜNTÜLERI ────────────────────────────────────────────────

const FAMILY_CONFLICT_PATTERNS = {
    enmeshment: {
        name: 'Enmeshment (Eritilme)',
        description: 'Sınırlar bulanık, duygular karışmış, bireysellik yok',
        examples: ['ebeveyn çocuğa duygularını yükle', 'bireyin seçimi ailece sorgula'],
        resolution: 'Sınırlar tanımla, duygusal detach, kendi seçim hakkı',
    },
    disengagement: {
        name: 'Disengagement (Kopukluk)',
        description: 'Sınırlar çok katı, duygusal bağlantı yok',
        examples: ['ebeveyn-çocuk çok mesafe', 'sorunlar görmezden gelinir'],
        resolution: 'Bağlantı kuruluş, duygusal konuşmalar başlat',
    },
    triangulation: {
        name: 'Triangulation (Üçgenleşme)',
        description: 'İki kişi arasındaki gerilim üçüncü kişiye aktarılır',
        examples: ['ebeveyn çatışması çocuğa yansır', 'çocuk arabulucu olur'],
        resolution: 'Direkt konuşma, çocuğu kenara çekme, yetişkinlerin anlaşması',
    },
    scapegoating: {
        name: 'Scapegoating (Suçlamacılık)',
        description: 'Aile sorunu bir kişiye atfedilir',
        examples: ['çocuğa "sen sebeple" demek', 'sürekli suçlama'],
        resolution: 'Sistem sorunu olduğunu göster, sorumluluk dağıt',
    },
    parentification: {
        name: 'Parentification (Ebeveynleştirme)',
        description: 'Çocuk ebeveyn rolünü üstlenmiş',
        examples: ['çocuk ebeveynin danışmanı', 'kardeşleri bakar'],
        resolution: 'Roller geri ters çevir, çocuğun çocukluğu geri ver',
    },
};

// ─── NESILLER ARASI TRAVMA ────────────────────────────────────────────────────

const INTERGENERATIONAL_PATTERNS = {
    trauma_transmission: {
        name: 'Travma Aktarımı (Intergenerational Trauma)',
        description: 'Ebeveynin çözememiş travması çocuğa aktarılır',
        mechanism: 'Çocuk ebeveynin korkusunu emmiş, terapisiz bağlantı kurar',
        examples: ['ebeveynin savaş travması → çocuğun hypervigilance', 'ebeveynin suistimal geçmişi → çocuğa aşırı koruma'],
        healing: 'Ebeveyn travması çöz, çocuğu bağımsızlaştır',
    },
    repetition_compulsion: {
        name: 'Tekrarlama Zorunluluğu (Repetition Compulsion)',
        description: 'Aile örüntüsü alt nesilde tekrarlanır',
        examples: ['aile içi şiddet atası → oğlu da aynı yapsa', 'anne ihaneti yaşadı → kızı da infidel partner seçer'],
        healing: 'Örüntüyü görün, seçimi değiştirin, farkındalık',
    },
    loyalty_binds: {
        name: 'Sadakat Bağları (Loyalty Binds)',
        description: 'Çocuk ebeveyne sadakat nedeniyle kendi arzuyu ertelemiş',
        examples: ['çocuk ebeveynin başarısızlığını telafi et', 'çocuk aile geleneklerini zorunlu tutar'],
        healing: 'Sadakati ayrıştır, kendi seçimi yap, sorumluluğu bırak',
    },
};

// ─── DETECT & ASSESS ──────────────────────────────────────────────────────────

/**
 * Aile dinamiği sorunlarını tespit et
 * @param {string} userMessage
 * @returns {{ hasFamilyIssue: boolean, primaryPattern: string, severity: string, roleName: string }}
 */
export function detectFamilyDynamics(userMessage = '') {
    const text = userMessage.toLowerCase();
    const patterns = [];
    let severity = 'low';

    // Enmeshment sinyalleri
    if (/aile|ebeveyn|annesi|babası|kontrol|karar|izin|bağımsız|özerklik/i.test(text)) {
        if (/söylemedi|izin verdi|hayal kırıklığı|kızıyor|öfkelendi|yapamaz/i.test(text)) {
            patterns.push('enmeshment');
            severity = 'high';
        }
    }

    // Disengagement sinyalleri
    if (/mesafe|konuşmuyoruz|konuş|yalnız|görülmeyen|değerli değilim/i.test(text)) {
        patterns.push('disengagement');
        severity = 'medium';
    }

    // Triangulation sinyalleri
    if (/çatışma|arabulucu|ortasında|kardeş|taraf|iki tarafta|çatış/i.test(text)) {
        patterns.push('triangulation');
        severity = 'high';
    }

    // Scapegoating sinyalleri
    if (/suçlu|benim yüzüm|sen sebeple|hep ben|aile bana|aileye|kızıyor hep bana/i.test(text)) {
        patterns.push('scapegoating');
        severity = 'high';
    }

    // Parentification sinyalleri
    if (/erken|bakmak|kardeş|ebeveyn|destek|sorun çöz|sorumlu|çok ciddiyim|yetişkinliğim|çocukluğum/i.test(text)) {
        patterns.push('parentification');
        severity = 'medium';
    }

    // Rol tanımlaması
    let roleName = '';
    if (/mükemmel|başarı|beklenti|baskı|hayal kırıklığı|perfekt/i.test(text)) {
        roleName = 'golden_child';
    } else if (/seçilmiş|suçlu|uygunsuz|damga|sorun|taraf/i.test(text)) {
        roleName = 'scapegoat';
    } else if (/barış|uyum|çatışma|ara|sessiz|sesim/i.test(text)) {
        roleName = 'peacekeeper';
    } else if (/bakmak|destek|yetişkin|sorumlu|çocukluğum yok/i.test(text)) {
        roleName = 'parentified_child';
    } else if (/yalnız|görülmeyen|kimse|bağlantı|adanmışlık/i.test(text)) {
        roleName = 'lost_child';
    }

    return {
        hasFamilyIssue: patterns.length > 0,
        primaryPattern: patterns[0] || null,
        patterns,
        severity,
        roleName,
    };
}

/**
 * Diferansiasyon seviyesi tahmin et
 * @param {string} userMessage
 * @returns {{ estimatedLevel: number, levelName: string, isDifferentiated: boolean }}
 */
export function assessDifferentiationLevel(userMessage = '') {
    const text = userMessage.toLowerCase();
    let score = 50; // orta başlangıç

    // Düşük diferansiasyon işaretleri
    if (/aile|ebeveyn|söylemedi|izin|hayal kırıklığı/i.test(text)) score -= 15;
    if (/duygusal|reaktif|öfkelendi|şok|panik/i.test(text)) score -= 10;
    if (/kontrol|yapamaz|bağlı|özgür|bağımsız|seçim/i.test(text)) score -= 10;

    // Yüksek diferansiasyon işaretleri
    if (/anlar|seçim yap|sınır|kendi|mesafe|bağımsız|duygusal|dingin/i.test(text)) score += 15;
    if (/sağlıklı|ayırt|düşün|refleksi|tepkiye|baş edebildi/i.test(text)) score += 10;
    if (/kendi değerler|bireysel|seçim|seçmeliyim|ben|kararımı/i.test(text)) score += 10;

    score = Math.max(0, Math.min(100, score));

    let levelName = 'medium';
    if (score < 40) levelName = 'very_low';
    else if (score < 55) levelName = 'low';
    else if (score < 70) levelName = 'medium';
    else if (score < 85) levelName = 'good';
    else levelName = 'excellent';

    return {
        estimatedLevel: score,
        levelName,
        isDifferentiated: score >= 60,
    };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * Aile dinamiği bağlamı oluştur
 * @param {string} patternName — 'enmeshment', 'scapegoating', etc.
 * @returns {string}
 */
export function buildFamilyDynamicsContext(patternName = '') {
    if (!patternName || !FAMILY_CONFLICT_PATTERNS[patternName]) {
        return '';
    }

    const pattern = FAMILY_CONFLICT_PATTERNS[patternName];
    let context = `[AİLE DİNAMİKLERİ — Bowen Teorisi]\n\n`;
    context += `Örüntü: ${pattern.name}\n`;
    context += `Tanım: ${pattern.description}\n\n`;

    context += `Örnekler:\n`;
    pattern.examples.forEach(ex => {
        context += `  • ${ex}\n`;
    });

    context += `\nÇözüm Yaklaşımı:\n`;
    context += `${pattern.resolution}\n\n`;

    context += `[BOWEN ÇERÇEVESI]\n`;
    context += `Aile sistem = birbirle bağlı. Bir kişinin değişimi tüm sistemi etkiler.\n`;
    context += `Sen değiştiğinde, aile tepki verir (dirençli olabilir). Sağlıklı sınır = sağlık.\n`;
    context += `→ Diferansiasyon = kendi "ben" bulmak + aileyle bağlantı tutmak = terapi.`;

    return context;
}

/**
 * Rol analiz bağlamı
 * @param {string} roleName — 'parentified_child', 'scapegoat', etc.
 * @returns {string}
 */
export function buildFamilyRoleAnalysis(roleName = '') {
    if (!roleName || !FAMILY_ROLES[roleName]) {
        return '';
    }

    const role = FAMILY_ROLES[roleName];
    let analysis = `[AİLE ROLÜ ANALIZI]\n\n`;
    analysis += `Rolün: ${role.name}\n`;
    analysis += `Tanım: ${role.description}\n\n`;

    analysis += `Bu Rolün Belirtileri:\n`;
    role.signs.forEach(sign => {
        analysis += `  ⚠️ ${sign}\n`;
    });

    analysis += `\nEtkileri:\n`;
    analysis += `  ${role.impacts}\n\n`;

    analysis += `İyileşme Yolu:\n`;
    analysis += `  ${role.healing}\n\n`;

    analysis += `[BU ROLÜ TESPİT ETTİK]\n`;
    analysis += `Bu rol çocukluğunda gerekli miydi? Şu anda ihtiyacın var mı?\n`;
    analysis += `Rolü seçmedin — aile sistemi sana atadı.\n`;
    analysis += `Şu anda bu rolü oynamayı bırakabilirsin.\n`;
    analysis += `→ Rol = geçici çözüm. Artık sen seçebilirsin.`;

    return analysis;
}

/**
 * Diferansiasyon haritası
 * @param {number} currentLevel — 0-100
 * @returns {string}
 */
export function buildDifferentiationMap(currentLevel = 50) {
    let map = `[DİFERANSİASYON HARİTASI]\n\n`;
    map += `Şu Anki Seviye: ${currentLevel}/100\n\n`;

    const levels = [
        { range: [0, 40], label: '🔴 Çok Düşük (Eritilme)', advice: 'Sınır inşası kritik — aile beklentilerinden ayrıl' },
        { range: [40, 55], label: '🟠 Düşük', advice: 'Sınırlar belirsiz — tanımla ve savun' },
        { range: [55, 70], label: '🟡 Orta', advice: 'Dengeli — biraz daha sınır gücü kaz' },
        { range: [70, 85], label: '🟢 İyi', advice: 'Sağlıklı — bu dengel devam et' },
        { range: [85, 100], label: '🟢🟢 Mükemmel', advice: 'Otonomı tanımışsın — model ol' },
    ];

    levels.forEach(({ range, label, advice }) => {
        const [min, max] = range;
        if (currentLevel >= min && currentLevel <= max) {
            map += `${label}\n`;
            map += `Tavsiyeleri: ${advice}\n\n`;
        }
    });

    map += `[BOWEN BILGİSİ]\n`;
    map += `Diferansiasyon = duygusal + entelektüel iki "ben" ayrılması.\n`;
    map += `Duygusal ben = aile tepkilerine hızlı cevap (oto pilot).\n`;
    map += `Entelektüel ben = düşün, seç, cevapla (kontrollü).\n`;
    map += `Terapi = entelektüel "ben"ini güçlendirmek.\n`;
    map += `→ Aileyle bağlı kal ama duygusal entanglement'tan çık.`;

    return map;
}

/**
 * Nesiller arası travma ve sınırlar
 * @param {string} patternName — 'trauma_transmission', 'repetition_compulsion', 'loyalty_binds'
 * @returns {string}
 */
export function buildIntergenerationalHealing(patternName = '') {
    if (!patternName || !INTERGENERATIONAL_PATTERNS[patternName]) {
        return '';
    }

    const pattern = INTERGENERATIONAL_PATTERNS[patternName];
    let healing = `[NESlLLER ARASI TRAVMA — Sıkılmayı Kır]\n\n`;
    healing += `Örüntü: ${pattern.name}\n`;
    healing += `Mekanizması: ${pattern.mechanism}\n\n`;

    healing += `Örnekler:\n`;
    pattern.examples.forEach(ex => {
        healing += `  • ${ex}\n`;
    });

    healing += `\nİyileşme:\n`;
    healing += `${pattern.healing}\n\n`;

    healing += `[TARİHİ KIRMA]\n`;
    healing += `Sen = nesil "kesme noktası" olabilirsin.\n`;
    healing += `Ebeveynin çözemediği: sen çözebilirsin.\n`;
    healing += `Bu farkındalık = zaten yarı yol.\n`;
    healing += `→ Tercihli hamle = kadim döngüyü kesme.`;

    return healing;
}
