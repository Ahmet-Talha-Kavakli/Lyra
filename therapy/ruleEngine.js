// therapy/ruleEngine.js
// L4-L6 kural motoru: söz-yüz çelişkisi, sessizlik müdahalesi, seanslar arası trend

// ─── L4: SÖZ-YÜZ ÇELİŞKİSİ ─────────────────────────────────────────────────
/**
 * Kullanıcı "iyiyim" diyorken duygusal ağırlık taşıyan kelimeler kullanıyor mu?
 * Vapi ses analiziyle entegrasyon için hazır — şimdilik metin tabanlı çelişki tespiti.
 *
 * @param {string} content — son kullanıcı mesajı
 * @param {{ primary, intensity }} emotionResult
 * @returns {string|null} — L4 kural talimatı veya null
 */
export function buildLayer4Rules(content, emotionResult) {
    if (!content) return null;
    const lower = content.toLowerCase();

    // "iyiyim /괜찮아요" kalıpları — yüzeysel olumlu beyan
    const okPhrases = ['iyiyim', 'iyi hissediyorum', 'sorun yok', '괜찮아', 'tamam', 'hallettim', 'geçti'];
    const hasOkClaim = okPhrases.some(p => lower.includes(p));
    if (!hasOkClaim) return null;

    // Aynı mesajda duygusal ağırlık — çelişki sinyali
    const heavyInSameMsg = [
        'ama', 'fakat', 'sadece', 'biraz', 'aslında', 'bilmiyorum', 'yine de',
        'üzgün', 'sıkıntı', 'yorgun', 'zor', 'ağır', 'kötü', 'endişe', 'kaygı'
    ];
    const hasConflict = heavyInSameMsg.some(w => lower.includes(w));

    // Duygu yüksek ama içerik "iyiyim" diyor → çelişki
    const emotionConflict = (emotionResult?.intensity === 'yüksek' || emotionResult?.intensity === 'orta') &&
        (emotionResult?.primary !== 'umut') && hasOkClaim;

    if (hasConflict || emotionConflict) {
        return `[L4 — SÖZ/DUYGU ÇELİŞKİSİ]: Kullanıcı "iyiyim" diyor ama mesajında çelişki sinyalleri var. Bunu zorlamadan yumuşakça aç: "İyiyim diyorsun, ama bir şeylerin hâlâ içinde kaldığını hissediyorum — yanılıyor muyum?" tarzında.`;
    }

    return null;
}

// ─── L5: SESSİZLİK MÜDAHALESİ ──────────────────────────────────────────────
/**
 * Kullanıcı çok kısa mesaj gönderdiyse — kapanma veya sessizlik sinyali.
 * Gerçek ses sessizliğine hazır (Vapi'den silenceDuration gelebilir).
 *
 * @param {number} messageLength — karakter sayısı
 * @param {number|null} silenceDurationSeconds — Vapi'den gelen ses sessizliği (opsiyonel)
 * @param {number} messageCount
 * @returns {string|null}
 */
export function buildLayer5Rules(messageLength, silenceDurationSeconds, messageCount) {
    // Gerçek ses sessizliği (Vapi entegrasyonu)
    if (silenceDurationSeconds !== null && silenceDurationSeconds !== undefined) {
        if (silenceDurationSeconds >= 20) {
            return `[L5 — DERİN SESSİZLİK (${silenceDurationSeconds}s)]: Kullanıcı uzun süre sessiz kaldı. "Sessizlik de bir cevap. Buradayım, acele etme." söyle. Yeni soru sorma.`;
        }
        if (silenceDurationSeconds >= 10) {
            return `[L5 — SESSİZLİK (${silenceDurationSeconds}s)]: "Seninle buradayım, hazır olduğunda konuşabiliriz." de.`;
        }
        // 0-10s arası: müdahale yok
        return null;
    }

    // Metin bazlı kısa mesaj — sessizlik analogu
    // İlk 2 mesajda kısa mesaj normaldir, müdahale etme
    if (messageCount <= 2) return null;

    if (messageLength <= 5) {
        // Sadece "." veya "k" veya emoji gibi
        return `[L5 — ÇOK KISA MESAJ]: Kullanıcı neredeyse hiçbir şey yazmadı. Baskı yapma. "Buradayım." veya "İstersen sessizce de olsa seninle vakit geçirebilirim." de.`;
    }

    if (messageLength <= 20 && messageCount >= 5) {
        return `[L5 — KISALAN MESAJLAR]: Kullanıcı giderek daha az yazıyor. Nazikçe sor: "Bir şey mi oldu, yoksa sadece dinlemek mi istiyorsun şu an?"`;
    }

    return null;
}

// ─── L6: SEANSLAR ARASI TREND ────────────────────────────────────────────────
/**
 * Son N seansın duygusal gidişatına bakarak uzun vadeli desen tespiti.
 *
 * @param {Array} recentSessions — session_records'tan çekilen son seans kayıtları
 *   Her kayıt: { dominant_emotion, session_quality, breakthrough_moment, created_at }
 * @param {Object|null} psychProfile — psychological_profiles kaydı
 * @returns {string|null} — L6 prompt eki veya null
 */
export function buildLayer6Rules(recentSessions, psychProfile) {
    if (!recentSessions || recentSessions.length < 3) return null;

    const last3 = recentSessions.slice(0, 3); // En yeniden eskiye sıralı gelsin

    // Kalite trendi — son 3 seans kötüleşiyor mu?
    const qualities = last3
        .map(s => s.session_quality)
        .filter(q => q !== null && q !== undefined);

    if (qualities.length >= 3) {
        const [q1, q2, q3] = qualities; // q1 en yeni
        const worsening = q1 < q2 && q2 < q3; // giderek azalıyor
        const improving = q1 > q2 && q2 > q3; // giderek artıyor

        if (worsening && q1 < 5) {
            return `[L6 — KÖTÜLEŞEN TREND]: Son 3 seansta kullanıcının durumu giderek ağırlaşıyor (kalite: ${[q3, q2, q1].join(' → ')}). Bu seansı özellikle dikkatli yönet. Uygunsa gerçek bir terapiste yönlendirmeyi nazikçe gündeme getir.`;
        }

        if (improving) {
            return `[L6 — İYİLEŞEN TREND]: Son 3 seansta kullanıcı giderek daha iyi hissediyor (kalite: ${[q3, q2, q1].join(' → ')}). Bu ilerlemeyi fark et ve kutla — küçük de olsa söyle.`;
        }
    }

    // Tekrarlayan konu deseni
    const allTopics = last3.flatMap(s => s.topics || []);
    const topicCounts = {};
    for (const t of allTopics) {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
    }
    const recurringTopics = Object.entries(topicCounts)
        .filter(([, count]) => count >= 2)
        .map(([topic]) => topic);

    if (recurringTopics.length > 0) {
        return `[L6 — TEKRARLAYAN KONU]: "${recurringTopics.join(', ')}" konusu son ${last3.length} seansta tekrarlıyor. Bu desene dikkat çek: "Fark ettim bu konu son zamanlarda sık geliyor — derinlemesine bakmak ister misin?"`;
    }

    // Breakthrough sonrası regresyon — önceki seansta kırılım vardı ama şimdi kötü
    const hadBreakthrough = last3[1]?.breakthrough_moment || last3[2]?.breakthrough_moment;
    const currentQuality = qualities[0];
    if (hadBreakthrough && currentQuality !== undefined && currentQuality < 4) {
        return `[L6 — KIRILIM SONRASI GERILEME]: Kullanıcı önceki seansda bir kırılım yaşamıştı ama bu seans ağır. Bu normaldir. "Bazen iyi bir seanstan sonra duyguların karışabiliyor — bu bir gerileme değil, işleme." de.`;
    }

    return null;
}

// ─── KURAL MOTORUNU ÇALIŞTIR ─────────────────────────────────────────────────
/**
 * L4-L6 kurallarını çalıştırır ve dinamik prompt ekini döner.
 *
 * @param {Object} params
 * @param {string} params.content — son kullanıcı mesajı
 * @param {{ primary, intensity }} params.emotionResult
 * @param {number} params.messageLength
 * @param {number|null} params.silenceDurationSeconds
 * @param {number} params.messageCount
 * @param {Array} params.recentSessions
 * @param {Object|null} params.psychProfile
 * @returns {string} — prompt eki (boş olabilir)
 */
export function runRuleEngine({ content, emotionResult, messageLength, silenceDurationSeconds, messageCount, recentSessions, psychProfile }) {
    const rules = [
        buildLayer4Rules(content, emotionResult),
        buildLayer5Rules(messageLength, silenceDurationSeconds, messageCount),
        buildLayer6Rules(recentSessions, psychProfile),
    ].filter(Boolean);

    if (rules.length === 0) return '';

    return '\n\n' + rules.join('\n');
}
