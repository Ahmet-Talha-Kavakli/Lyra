// lib/relationshipTherapy.js
// Çift Terapisi — Gottman Modeli, 4 Horsemen, Mütemmim İletişim
// Romantik ilişkide çatışma patternleri, duygusal bağlantı, iyileşme
//
// Amaç: Çift çatışması tespit, komunikasyon iyileştirme, ilişki onarma

// ─── GOTTMAN 4 HORSEMEN ────────────────────────────────────────────────────────

/**
 * John Gottman'ın araştırması: Bu 4 davranış %91 doğruluk ile ayrılmayı öngörür
 */

const GOTTMAN_FOUR_HORSEMEN = {
    criticism: {
        name: 'Eleştiri (Criticism)',
        definition: 'Eşi bireysel kusur olarak saldırı — sadece davranış değil, kişiliğe',
        examples: [
            '"Sen asla düşünmüyorsün" (genelleme + kişi)',
            '"Her zaman çöpü çıkarmazsın" (her zaman, asla)',
            '"Senin yüzünden geç kaldık" (suçlandırma)',
        ],
        vs_complaint: 'Şikayet = davranış (OK). Eleştiri = karakter (TOX)',
        impact: 'Eş defensif hale gelir, kapanır, anlaşma imkansız',
        gottman_score: 4,
    },
    defensiveness: {
        name: 'Savunmacılık (Defensiveness)',
        definition: 'Eleştiriye cevap olarak kendi savunma / karşı saldırı',
        examples: [
            '"O zaman sen de..." (karşı saldırı)',
            '"Ben bunu yapamam, sen yapsaydın..." (başka sorumlu)',
            '"Hep beni suçlamış...(doğru hissetme isteği)',
        ],
        pattern: 'Eleştiri → Savunma → Döngü (çözüm yok)',
        impact: 'Problem çözülmez, gerginlik artar',
        gottman_score: 3,
    },
    contempt: {
        name: 'Küçümseme (Contempt)',
        definition: 'Eşi düşük görmek, horlama, cinsiyete/özür alanına saldırı',
        examples: [
            '"Senin kadar aptal başka kimseyi görmedim"',
            '"Erkekler hiç ne yapabilir?" (cinsiyete saldırı)',
            'Gülüş, alaycı sesle konuşma',
        ],
        tone: 'Küçümseme tonu EN TEHLİKELİ — kötülük işareti',
        impact: '❌ TEHLİKELİ: Bu çok kalıp ilişkinin ölüsüdür',
        gottman_score: 5,
    },
    stonewalling: {
        name: 'Duvar Örme (Stonewalling)',
        definition: 'Sessizlik, kaçış, konuşmayı reddetme, iletişimi kesme',
        examples: [
            'Tartışma sırasında konuşmayı kesmek',
            'Oradan ayrılmak, "konuşacak halim yok"',
            'Telefona bakmak, izin vermemek',
        ],
        usually: 'Genellikle eleştiri + savunma → tükenmişlik → duvar',
        impact: 'Problem çözülmez, iletişim kaynıyor',
        gottman_score: 2,
    },
};

const GOTTMAN_ANTIDOTES = {
    criticism: 'Davranışa odaklan (BESTECİ NOT → GÖZLEM + TALEP): "Saat 19:00\'de çöpü çıkarmazsan bana stres verir" ✓',
    defensiveness: 'Sorumluluğu al, yapıcı cevapla: "Haklısın, çöp konusunda dikkat etmeliyim"',
    contempt: 'Saygı ve takdir: "Saygı duyuyorum ve yardım istiyorum. Bu konuda bana yardım edebilir misin?" + Hümor',
    stonewalling: 'Duvarı fark et, ara ver (15 dakika), sonra devam et (sakin halde): "Şu anda konuşamıyorum, biraz bekle"',
};

// ─── İLİŞKİ BAĞLANMA SEVİYESİ ─────────────────────────────────────────────────

const ATTACHMENT_IN_RELATIONSHIPS = {
    secure: {
        name: 'Güvenli Bağlanma',
        description: 'Partnerle konfortlu ve istikrarlı bağ',
        patterns: ['açık iletişim', 'çatışma sonrası onarma', 'güven ve özerklik dengesi'],
        partners_feels: 'Güvenli, sevilen, desteklenen',
    },
    anxious: {
        name: 'Kaygılı Bağlanma',
        description: 'Terk edilme korkusu, partnerden aşırı bağımlılık',
        patterns: ['çok mesaj/takip', 'aşırı tepki verdirme isteme', 'kendini sorumlu tutma'],
        partners_feels: 'Boğucu, kontrol edici, zorlayıcı',
    },
    avoidant: {
        name: 'Kaçıngan Bağlanma',
        description: 'İntimacy korkusu, duygusal mesafe, özerkliğe aşırı değer',
        patterns: ['duygusal kapalılık', 'sorun görmezden gelme', 'sevgiye cevap vermeme'],
        partners_feels: 'Reddedilmiş, yalnız, anlayılmayan',
    },
    fearful: {
        name: 'Korkulu Bağlanma',
        description: 'Hem kaygılı hem avoidant (çelişkili)',
        patterns: ['yaklaş-uzaklaş döngüsü', 'tutarsız davranış', 'karışık sinyaller'],
        partners_feels: 'Kafası karışık, bağlı ama stresli',
    },
};

// ─── İLİŞKİ MEMNUNİYET FAKTÖRLERİ ────────────────────────────────────────────

const RELATIONSHIP_SATISFACTION_FACTORS = {
    communication: {
        name: 'İletişim Kalitesi',
        indicators: ['açık sözlülük', 'dinleme', 'duygusal açıklık'],
        warning_signs: ['sürükleme', 'cevap vermeme', 'duvar örme'],
    },
    emotional_intimacy: {
        name: 'Duygusal İntimasy',
        indicators: ['zayıflık gösterme', 'dış paylaşma', 'kırama bekleme'],
        warning_signs: ['kapalılık', 'uzaklık', 'yalnızlık hissi'],
    },
    sexual_connection: {
        name: 'Cinsel Bağlantı',
        indicators: ['istektash', 'dışın tatmin', 'fiziksel temas'],
        warning_signs: ['ilgisizlik', 'hayal kırıklığı', 'uzaklık'],
    },
    shared_goals: {
        name: 'Ortak Hedefler',
        indicators: ['beraber plan', 'aynı yönde', 'destekle'],
        warning_signs: ['çelişkili hedefler', 'ters gitme', 'destek eksikliği'],
    },
    trust: {
        name: 'Güven',
        indicators: ['sadakat', 'tutarlılık', 'güvenilirlik'],
        warning_signs: ['şüphe', 'yalan', 'ihanet'],
    },
};

// ─── DETECT & ASSESS ──────────────────────────────────────────────────────────

/**
 * Çift çatışma patternini tespit et
 * @param {string} userMessage
 * @returns {{ hasConflict: boolean, horsemenDetected: Array, severity: string, primaryHorseman: string }}
 */
export function detectRelationshipConflict(userMessage = '') {
    const text = userMessage.toLowerCase();
    const horsemenFound = [];

    // Eleştiri (Criticism)
    if (/asla|hiçbir|her zaman|sen|aptal|tembel|eğer/i.test(text)) {
        if (/yapmıyorsun|düşünmüyorsün|dinlemiyorsün|yapamıyorsun/i.test(text)) {
            horsemenFound.push('criticism');
        }
    }

    // Savunmacılık (Defensiveness)
    if (/ama|ben|o zaman|başka|ayarını|haklı|yanılmıyor/i.test(text)) {
        if (/suçlandığım|bahane|karşı|sen de/i.test(text)) {
            horsemenFound.push('defensiveness');
        }
    }

    // Küçümseme (Contempt)
    if (/aptal|ahmak|beceriksiz|komik|gülünç|saçma|garip/i.test(text)) {
        horsemenFound.push('contempt');
    }

    // Duvar Örme (Stonewalling)
    if (/konuşmuyorum|sessiz|gitme|reddedit|dinlemiyorum|önemli değil|umurumda değil/i.test(text)) {
        horsemenFound.push('stonewalling');
    }

    // Ciddiyet
    let severity = 'low';
    if (horsemenFound.includes('contempt')) severity = 'critical';
    else if (horsemenFound.length >= 2) severity = 'high';
    else if (horsemenFound.length === 1) severity = 'medium';

    return {
        hasConflict: horsemenFound.length > 0,
        horsemenDetected: horsemenFound,
        severity,
        primaryHorseman: horsemenFound[0] || null,
    };
}

/**
 * İlişki memnuniyet alanlarını değerlendir
 * @param {string} userMessage
 * @returns {{ satisfactionAreas: Array, weakAreas: Array, overallSatisfaction: number }}
 */
export function assessRelationshipSatisfaction(userMessage = '') {
    const text = userMessage.toLowerCase();
    const weakAreas = [];
    const strongAreas = [];

    // İletişim
    if (/konuş|dinle|açık|samimi/i.test(text)) {
        if (/ama sorun var|ama|ancak|yok|yokum|zor/i.test(text)) {
            weakAreas.push('communication');
        } else {
            strongAreas.push('communication');
        }
    }

    // Duygusal İntimasy
    if (/duygusal|yakın|samimi|açık|paylaş/i.test(text)) {
        if (/uzak|mesafe|kapalı|değer vermedi|yalnız/i.test(text)) {
            weakAreas.push('emotional_intimacy');
        } else {
            strongAreas.push('emotional_intimacy');
        }
    }

    // Cinsel Bağlantı
    if (/cinsel|fiziksel|yakın|temas|tatmin/i.test(text)) {
        if (/ilgisiz|tafilatı|tatmin|başarı/i.test(text)) {
            weakAreas.push('sexual_connection');
        }
    }

    // Ortak Hedefler
    if (/hedef|plan|gelecek|çocuk|yaşam|hayat/i.test(text)) {
        if (/çatış|ters|anlaşma|eksik|farklı/i.test(text)) {
            weakAreas.push('shared_goals');
        } else {
            strongAreas.push('shared_goals');
        }
    }

    // Güven
    if (/güven|sadakat|doğru|ihanet|yalan|şüphe/i.test(text)) {
        if (/sorunu|kırılmış|kaybettim|şüpheli|yalan/i.test(text)) {
            weakAreas.push('trust');
        } else {
            strongAreas.push('trust');
        }
    }

    // Genel memnuniyet (rough)
    const satisfactionScore = (strongAreas.length * 20) - (weakAreas.length * 25);
    const overall = Math.max(0, Math.min(100, 60 + satisfactionScore));

    return {
        satisfactionAreas: strongAreas,
        weakAreas,
        overallSatisfaction: overall,
    };
}

/**
 * Bağlanma stilleri algıla
 * @param {string} userMessage
 * @returns {{ primaryAttachmentStyle: string, secondaryStyle: string }}
 */
export function detectAttachmentStyle(userMessage = '') {
    const text = userMessage.toLowerCase();
    let scores = {
        secure: 0,
        anxious: 0,
        avoidant: 0,
        fearful: 0,
    };

    // Güvenli
    if (/açık|samimi|dinlerim|konuş|anlaş/i.test(text)) scores.secure += 3;

    // Kaygılı
    if (/terk|ayrıl|mesaj|takip|kontrol|bağımlı/i.test(text)) scores.anxious += 3;
    if (/aşırı|çok|hep|endişe|korku|mesafe/i.test(text)) scores.anxious += 2;

    // Kaçıngan
    if (/uzak|mesafe|kapı|duygusal|bağımsız|kendime/i.test(text)) scores.avoidant += 3;
    if (/intimit|yakın|difficult|çok yakın/i.test(text)) scores.avoidant += 2;

    // Korkulu (kaygılı + avoidant)
    if (/tutarsız|çelişkili|hızlı|değiş|bilemiyorum/i.test(text)) scores.fearful += 2;

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    return {
        primaryAttachmentStyle: sorted[0][0],
        secondaryStyle: sorted[1][0],
    };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * Gottman 4 Horsemen bağlamı
 * @param {string} horsemanName — 'criticism', 'defensiveness', 'contempt', 'stonewalling'
 * @returns {string}
 */
export function buildGottmanContext(horsemanName = '') {
    if (!horsemanName || !GOTTMAN_FOUR_HORSEMEN[horsemanName]) {
        return '';
    }

    const horseman = GOTTMAN_FOUR_HORSEMEN[horsemanName];
    const antidote = GOTTMAN_ANTIDOTES[horsemanName];

    let context = `[GOTTMAN 4 HORSEMEN — Ayrılma Öngörücüsü]\n\n`;
    context += `🐴 ${horseman.name}\n`;
    context += `Tanım: ${horseman.definition}\n\n`;

    context += `Örnekler:\n`;
    horseman.examples.forEach(ex => {
        context += `  ❌ "${ex}"\n`;
    });

    context += `\n✅ ANTIDOTE (İLAÇ):\n`;
    context += `${antidote}\n\n`;

    context += `[ETKİSİ]\n`;
    context += `${horseman.impact}\n\n`;

    if (horsemanName === 'contempt') {
        context += `⚠️ GOTTMAN ÖNERİSİ: Küçümseme = en kötü işaret.\n`;
        context += `Bu davranış görülürse hemen müdahale gerekli.\n`;
    }

    context += `→ Çift terapisi = Horsemen'i tespit ve antidot uygula.`;

    return context;
}

/**
 * İlişki onarma rehberi
 * @param {Array<string>} weakAreas — ['communication', 'emotional_intimacy', etc.]
 * @returns {string}
 */
export function buildRelationshipRepairGuide(weakAreas = []) {
    let guide = `[İLİŞKİ ONARMA REHBERİ]\n\n`;

    if (weakAreas.length === 0) {
        guide += `Güçlü alanlar görülüyor — devam et.\n`;
        return guide;
    }

    weakAreas.slice(0, 2).forEach(area => {
        const factor = RELATIONSHIP_SATISFACTION_FACTORS[area];
        if (!factor) return;

        guide += `🔧 ${factor.name}\n`;
        guide += `Uyarı işaretleri:\n`;
        factor.warning_signs.forEach(sign => {
            guide += `  ⚠️ ${sign}\n`;
        });

        guide += `İyileşme adımları:\n`;
        factor.indicators.forEach(ind => {
            guide += `  ✓ ${ind}\n`;
        });
        guide += `\n`;
    });

    guide += `[ÇIFT TERAPISI SÜRECI]\n`;
    guide += `1️⃣ Güvenli ortam: Yargısız dinleme\n`;
    guide += `2️⃣ Problemlerin altındaki ihtiyaçları bul\n`;
    guide += `3️⃣ Stratejiler: Nasıl anlaşma sağlanır?\n`;
    guide += `4️⃣ Pratik: Her hafta uygulamalar\n`;
    guide += `5️⃣ Bağlantı: Sevgi ve yakınlık inşa\n\n`;

    guide += `→ İlişki = beceri. Kötü başladıysa çok iyi bitirebilir.`;

    return guide;
}

/**
 * Bağlanma stiline göre tavsiyeleri
 * @param {string} attachmentStyle
 * @param {string} partnerStyle
 * @returns {string}
 */
export function buildAttachmentHealing(attachmentStyle = '', partnerStyle = '') {
    let healing = `[BAĞLANMA STİLİ UYUMLULUK]\n\n`;
    healing += `Senin stil: ${attachmentStyle}\n`;
    if (partnerStyle) {
        healing += `Partnerin stili: ${partnerStyle}\n`;
    }

    healing += `\n`;

    // Açıklamalar
    if (attachmentStyle === 'anxious') {
        healing += `📌 Kaygılı Bağlanma Tavsiyeleri:\n`;
        healing += `1️⃣ Partnerle terk edilme korkusunu açıkça konuş\n`;
        healing += `2️⃣ Bağımsız aktiviteler yap (sağlık ve özerklik)\n`;
        healing += `3️⃣ Partnere sürekli talep değil, açık iletişim kur\n`;
        healing += `4️⃣ Kendi ihtiyaçlarını tanı ve dile getir\n`;
    } else if (attachmentStyle === 'avoidant') {
        healing += `📌 Kaçıngan Bağlanma Tavsiyeleri:\n`;
        healing += `1️⃣ İntimacy'den kaçışını fark et\n`;
        healing += `2️⃣ Duygularını partnerle paylaş (zor olsa da)\n`;
        healing += `3️⃣ Partnerin ihtiyaçlarını dinle, reddetme\n`;
        healing += `4️⃣ Fiziksel temas ve duygusal açıklık pratiği yap\n`;
    } else if (attachmentStyle === 'fearful') {
        healing += `📌 Korkulu Bağlanma Tavsiyeleri:\n`;
        healing += `1️⃣ Tutarsız örüntüyü tanı\n`;
        healing += `2️⃣ Partnere açıklama yap: "Çelişkili hissediyorum"\n`;
        healing += `3️⃣ Profesyonel destek al (çift terapisi önemli)\n`;
        healing += `4️⃣ Duygusal regülasyon pratiği yap\n`;
    } else {
        healing += `📌 Güvenli Bağlanma — Sürdür:\n`;
        healing += `✓ Açık iletişim\n`;
        healing += `✓ Çatışma sonrası onarma\n`;
        healing += `✓ Duygusal bağlantı\n`;
    }

    healing += `\n→ Bağlanma stili = çocukluktan öğrenildi. Terapiyle değişebilir.`;

    return healing;
}

/**
 * Seçici Kaçınma Taktikleri (Conflict resolution)
 * @returns {string}
 */
export function buildConflictResolutionTactics() {
    return `[ÇATIŞMA ÇÖZÜM TAKTİKLERİ]\n\n` +
        `1️⃣ DURUNUN ÖZELSILIĞINI BELİRLE\n` +
        `"Bu konuda gözlem: ... (davranış, duygusal etki)\n` +
        `İstek: ... (ne istiyorsun)\n` +
        `Duygu: ... (ne hissediyorsun)"\n\n` +
        `2️⃣ DINLE (Savunma olmadan)\n` +
        `Partnerin perspektifini tam anla.\n` +
        `Konuş: "Seni anladığım kadarıyla... Doğru mu?"\n\n` +
        `3️⃣ ÇÖZÜM BULMADA İŞ BİRLİĞİ\n` +
        `"Nasıl bir çözüm seni mutlu eder?"\n` +
        `Her iki tarafın ihtiyaçlarını dengele.\n\n` +
        `4️⃣ BAĞLANTIYA DÖN\n` +
        `Çatışma bittikten sonra: Sarıl, konuş, saygı göster.\n` +
        `Bağlantı = iyileşme.\n\n` +
        `→ Çatışma = ilişkinin sağlığını kontrol etme şansı. Kaçma, çöz.`;
}
