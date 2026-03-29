// lib/progressDashboard.js
// İlerleme Gösterge Paneli — Seans Bazı Trend, Kazanımlar, Hedefler
// Kullanıcıya görsel ve anlaşılır ilerleme geri bildirimi
//
// Amaç: Her seansı öncekiyle karşılaştır, motivasyon ve momentum oluştur

// ─── SEANS VERİSİ YAPISI ──────────────────────────────────────────────────────

/**
 * @typedef {Object} SessionRecord
 * @property {number} sessionNumber
 * @property {Date} date
 * @property {number} moodScore — 1-10 duygu durumu
 * @property {number} anxietyScore — 1-10 kaygı düzeyi
 * @property {number} energyScore — 1-10 enerji
 * @property {string} mainTopic — ana konu
 * @property {Array<string>} breakthroughs — atılımlar
 * @property {string} homework — verilen ödev
 * @property {boolean} homeworkComplete — ödev yapıldı mı
 * @property {string} notes — terapeut notları
 */

// ─── DETECT FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * İlerleme sinyalleri tespit et
 * @param {Array<Object>} sessionHistory — seans kayıtları
 * @param {string} userMessage
 * @returns {{ hasProgress: boolean, regressionRisk: boolean, stagnationRisk: boolean, breakthoughTheme: string }}
 */
export function detectProgressSignals(sessionHistory = [], userMessage = '') {
    if (!Array.isArray(sessionHistory) || sessionHistory.length < 2) {
        return { hasProgress: false, regressionRisk: false, stagnationRisk: false, breakthoughTheme: '' };
    }

    const recent = sessionHistory.slice(-3); // Son 3 seans
    const moodScores = recent.map(s => s.moodScore || 5);
    const energyScores = recent.map(s => s.energyScore || 5);
    const anxietyScores = recent.map(s => s.anxietyScore || 5);

    // İlerleme: ortalama artıyor
    const moodTrend = moodScores[moodScores.length - 1] - moodScores[0];
    const energyTrend = energyScores[energyScores.length - 1] - energyScores[0];
    const anxietyTrend = anxietyScores[anxietyScores.length - 1] - anxietyScores[0]; // negatif iyi

    let hasProgress = moodTrend > 0 || energyTrend > 0 || anxietyTrend < 0;
    let regressionRisk = moodTrend < -2 || energyTrend < -2 || anxietyTrend > 2;
    let stagnationRisk = Math.abs(moodTrend) <= 1 && Math.abs(energyTrend) <= 1 && Math.abs(anxietyTrend) <= 1;

    // Temalar
    let breakthoughTheme = '';
    const recentTopics = recent.map(s => s.mainTopic || '').join(' ').toLowerCase();

    if (/ilişki|aile|bağlantı|sevgi/i.test(recentTopics)) {
        breakthoughTheme = 'ilişkisel_atılım';
    } else if (/kız|boy|erkek|çekicilik|özgüven/i.test(recentTopics)) {
        breakthoughTheme = 'özgüven_atılımı';
    } else if (/iş|kariyer|başarı|hedef/i.test(recentTopics)) {
        breakthoughTheme = 'kariyer_atılımı';
    } else if (/travma|korku|kaygı|panik/i.test(recentTopics)) {
        breakthoughTheme = 'travma_işlemesi';
    }

    // Regresyon tespiti (ödevleri yapılmamışsa)
    const incompletedHomework = recent.filter(s => !s.homeworkComplete).length;
    if (incompletedHomework >= 2) {
        regressionRisk = true;
    }

    return {
        hasProgress,
        regressionRisk,
        stagnationRisk,
        breakthoughTheme,
        moodTrend: moodTrend.toFixed(1),
        energyTrend: energyTrend.toFixed(1),
        anxietyTrend: anxietyTrend.toFixed(1),
    };
}

/**
 * Duruş durumu analiz et (stabil mi, kriz mi, atılım mı?)
 * @param {Array<Object>} sessionHistory
 * @returns {{ status: 'stable'|'improving'|'declining'|'crisis'|'breakthrough', confidence: number }}
 */
export function assessSessionStatus(sessionHistory = []) {
    if (!Array.isArray(sessionHistory) || sessionHistory.length === 0) {
        return { status: 'stable', confidence: 0 };
    }

    const recent = sessionHistory.slice(-5).map(s => s.moodScore || 5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const volatility = Math.sqrt(recent.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / recent.length);

    let status = 'stable';
    let confidence = 0.5;

    if (recent[recent.length - 1] > avg + 2) {
        status = 'breakthrough';
        confidence = 0.9;
    } else if (recent[recent.length - 1] < 3) {
        status = 'crisis';
        confidence = 0.95;
    } else if (recent[recent.length - 1] > avg + 1) {
        status = 'improving';
        confidence = 0.7;
    } else if (recent[recent.length - 1] < avg - 1) {
        status = 'declining';
        confidence = 0.7;
    }

    return { status, confidence, volatility: volatility.toFixed(2), avgMood: avg.toFixed(1) };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * Seans ilerleme gösterge paneli
 * @param {Array<Object>} sessionHistory — tüm seans kayıtları
 * @param {number} sessionNumber — şu anki seans numarası
 * @returns {string}
 */
export function buildProgressDashboard(sessionHistory = [], sessionNumber = 0) {
    if (!Array.isArray(sessionHistory) || sessionHistory.length === 0) {
        return '';
    }

    const signals = detectProgressSignals(sessionHistory);
    const status = assessSessionStatus(sessionHistory);
    const recent = sessionHistory.slice(-5);

    let dashboard = `[SEANS İLERLEME GÖSTERGE PANELİ]\n`;
    dashboard += `Seans ${sessionNumber} — Trendler ve Kazanımlar\n\n`;

    // ─── MOD DÜZEYİ TRENDİ ────────────────────────────────────
    dashboard += `📊 DUYGU DURUMU TRENDİ\n`;

    // Grafik (ASCII)
    const maxScore = 10;
    const minScore = 1;
    recent.forEach((session, idx) => {
        const mood = session.moodScore || 5;
        const filled = Math.round((mood / maxScore) * 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        dashboard += `  S${session.sessionNumber || idx + 1}: ${bar} ${mood}/10\n`;
    });

    dashboard += `  Trend: ${signals.moodTrend > 0 ? '📈 ' : signals.moodTrend < 0 ? '📉 ' : '→ '}${signals.moodTrend}\n\n`;

    // ─── ENERJİ VE KAYGI ──────────────────────────────────────
    dashboard += `⚡ ENERJİ TRENDI\n`;
    const energyRecent = recent.map(s => s.energyScore || 5);
    const energyTrendArrow = signals.energyTrend > 0 ? '📈' : signals.energyTrend < 0 ? '📉' : '→';
    dashboard += `  ${energyRecent.map(e => e).join(' → ')} (${energyTrendArrow} ${signals.energyTrend})\n\n`;

    dashboard += `😰 KAYGI TRENDI\n`;
    const anxietyRecent = recent.map(s => s.anxietyScore || 5);
    const anxietyTrendArrow = signals.anxietyTrend < 0 ? '📉 İYİ' : signals.anxietyTrend > 0 ? '📈 DİKKAT' : '→';
    dashboard += `  ${anxietyRecent.map(a => a).join(' → ')} (${anxietyTrendArrow})\n\n`;

    // ─── DURUŞ DURUMU ─────────────────────────────────────────
    dashboard += `🎯 DURUŞ DURUMU: `;

    if (status.status === 'crisis') {
        dashboard += `🔴 KRİZ — Acil müdahale gerekli\n`;
    } else if (status.status === 'declining') {
        dashboard += `🟠 DÜŞÜŞ — Yoğunlaştır\n`;
    } else if (status.status === 'stable') {
        dashboard += `🟡 SABIT — Devam et\n`;
    } else if (status.status === 'improving') {
        dashboard += `🟢 İYİLEŞİYOR — Momentum koruya\n`;
    } else if (status.status === 'breakthrough') {
        dashboard += `🔥 ATILIM! — Büyük dönüş noktası\n`;
    }

    dashboard += `  Güven: %${(status.confidence * 100).toFixed(0)}\n\n`;

    // ─── KAZANIMLAR ───────────────────────────────────────────
    dashboard += `🏆 KAZANIMLAR (Son 5 Seans)\n`;
    let breakthroughCount = 0;
    recent.forEach(session => {
        if (session.breakthroughs && Array.isArray(session.breakthroughs)) {
            session.breakthroughs.forEach(bt => {
                dashboard += `  ✓ ${bt}\n`;
                breakthroughCount++;
            });
        }
    });

    if (breakthroughCount === 0) {
        dashboard += `  (Kayıt yok — katılım devam et)\n`;
    }

    dashboard += `\n`;

    // ─── ÖDEV UYUMU ───────────────────────────────────────────
    dashboard += `📝 ÖDEV UYUMU\n`;
    const completedHomework = recent.filter(s => s.homeworkComplete).length;
    const totalHomework = recent.filter(s => !!s.homework).length;
    const compliance = totalHomework > 0 ? Math.round((completedHomework / totalHomework) * 100) : 0;

    dashboard += `  Tamamlanan: ${completedHomework}/${totalHomework} (${compliance}%)\n`;
    if (compliance >= 80) {
        dashboard += `  🟢 Mükemmel uyum — hız kat!\n`;
    } else if (compliance >= 50) {
        dashboard += `  🟡 Orta uyum — artır\n`;
    } else {
        dashboard += `  🔴 Düşük uyum — engelleri tespit et\n`;
    }

    dashboard += `\n`;

    // ─── SONRAKI HEDEFLER ─────────────────────────────────────
    dashboard += `🎯 SONRAKI HEDEFLER\n`;
    dashboard += `1️⃣ Momentum oluştur (devam et)\n`;
    dashboard += `2️⃣ Ödevleri %100 tamamla\n`;
    dashboard += `3️⃣ Atılım alanını derinleştir\n`;
    dashboard += `4️⃣ Kazanımları yaşama entegre et\n`;

    return dashboard;
}

/**
 * Atılım/Kriz Raporu (detaylı)
 * @param {Array<Object>} sessionHistory
 * @param {Object} options — { focusArea: '', timeframe: 4 }
 * @returns {string}
 */
export function buildBreakthroughReport(sessionHistory = [], options = {}) {
    const { focusArea = '', timeframe = 4 } = options;

    if (!Array.isArray(sessionHistory) || sessionHistory.length === 0) {
        return '';
    }

    const recent = sessionHistory.slice(-timeframe);
    let report = `[SEANS ATILIM RAPORU]\n\n`;

    // Tema
    report += `🎯 FOKUS ALANI\n`;
    if (focusArea) {
        report += `  ${focusArea}\n`;
    } else {
        const topics = recent.map(s => s.mainTopic).filter(Boolean);
        report += `  ${topics.join(' → ')}\n`;
    }

    report += `\n`;

    // Dönüm noktaları
    report += `🔑 DÖNÜM NOKTALARI\n`;
    recent.forEach((session, idx) => {
        if (session.breakthroughs && session.breakthroughs.length > 0) {
            report += `  Seans ${session.sessionNumber || idx + 1}:\n`;
            session.breakthroughs.forEach(bt => {
                report += `    • ${bt}\n`;
            });
        }
    });

    report += `\n`;

    // Psikoedukatif not
    report += `💡 SEANS KURSU\n`;
    report += `Atılımlar müdahale + bağlantı + zaman birleşimiyle oluşur.\n`;
    report += `Şu anda hedefine yaklaşıyorsun — momentum koruya.\n`;
    report += `→ Devam et, ödevleri yap, terapisti dinle.`;

    return report;
}

/**
 * Genel sağlık skorları raporu (PSYİ gibi — 0-10)
 * @param {Array<Object>} sessionHistory
 * @returns {string}
 */
export function buildHealthScoresReport(sessionHistory = []) {
    if (!Array.isArray(sessionHistory) || sessionHistory.length === 0) {
        return '';
    }

    const recent = sessionHistory.slice(-5);

    // Ortalamalar
    const avgMood = (recent.reduce((sum, s) => sum + (s.moodScore || 5), 0) / recent.length).toFixed(1);
    const avgAnxiety = (recent.reduce((sum, s) => sum + (s.anxietyScore || 5), 0) / recent.length).toFixed(1);
    const avgEnergy = (recent.reduce((sum, s) => sum + (s.energyScore || 5), 0) / recent.length).toFixed(1);

    // Composite sağlık skoru
    const healthScore = ((avgMood * 0.4 + (10 - avgAnxiety) * 0.3 + avgEnergy * 0.3) / 10).toFixed(1);

    let report = `[GENEL SAĞLIK SKORLARI]\n\n`;

    report += `🏥 BILEŞKE SAĞLIK SKORU: ${healthScore}/10\n`;
    if (healthScore >= 7.5) {
        report += `  🟢 İYİ — Yaşam kalitesi yüksek\n`;
    } else if (healthScore >= 5) {
        report += `  🟡 ORTA — Müdahale devam et\n`;
    } else {
        report += `  🔴 DÜŞÜk — Yoğun destek gerekli\n`;
    }

    report += `\n`;

    report += `📋 BILEŞENLER\n`;
    report += `  Duygu Durumu: ${avgMood}/10\n`;
    report += `  Kaygı (ters): ${avgAnxiety}/10 → ${(10 - avgAnxiety).toFixed(1)}/10\n`;
    report += `  Enerji: ${avgEnergy}/10\n`;

    report += `\n`;

    report += `[FORMÜL]\n`;
    report += `Duygu Durumu (%40) + (10 - Kaygı) (%30) + Enerji (%30) = Sağlık Skoru\n`;
    report += `→ 7.5+ İYİ, 5-7.5 ORTA, <5 DÜŞÜK`;

    return report;
}

/**
 * Tavsiye ve Motivasyon (seansa göre özel)
 * @param {Object} signals — detectProgressSignals sonucu
 * @param {Object} status — assessSessionStatus sonucu
 * @returns {string}
 */
export function buildProgressMotivation(signals = {}, status = {}) {
    let motivation = `[SEANS KAPANISı — MOTIVASYON]\n\n`;

    if (status.status === 'breakthrough') {
        motivation += `🔥 HARIKA! Bu seansı bir dönüm noktası olarak hatırla.\n`;
        motivation += `Beyin değişiyor, sinir yolları yeniden programlanıyor.\n`;
        motivation += `Şimdi momentum koruya, ödevleri yap, uzun vadeli başarı kuracak.\n`;
    } else if (status.status === 'improving') {
        motivation += `📈 İLERLEME VAR! Pekçe fark etmeyebilirsin ama veriler gösteriyor.\n`;
        motivation += `Devam et, her seans seni hedefine yaklaştırıyor.\n`;
    } else if (status.status === 'stable') {
        motivation += `🟡 SABIT DURUM — Bu normal, platoları herkes yaşar.\n`;
        motivation += `Devam et, kısa zamanda atılım gelecek.\n`;
        motivation += `Eğer 2-3 hafta devam ederse, müdahaleyi yoğunlaştıralım.\n`;
    } else if (status.status === 'declining') {
        motivation += `🟠 DÜŞÜŞ YAŞANIYOR — Hemen çözelim.\n`;
        motivation += `Engeller neler? Ödev yapılmadı mı? Stres mi artı?\n`;
        motivation += `Yardım iste, kendin çözmeye çalışma.\n`;
    } else if (status.status === 'crisis') {
        motivation += `🔴 KRİZ — ACIL DESTEK GEREKLI.\n`;
        motivation += `Hemen terapistin çağır, güvenlik planı yap.\n`;
        motivation += `Yalnız değilsin, bu geçecek.\n`;
    }

    motivation += `\n→ Terapi = dayanıklılık + beceri = güçlü ben.`;

    return motivation;
}
