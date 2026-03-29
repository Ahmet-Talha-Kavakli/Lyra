// lib/standardizedAssessments.js
// Standart Klinik Değerlendirmeler — PHQ-9, GAD-7, PCL-5, AUDIT
// Klinik terapi ölçeği entegrasyonu, skor hesaplama, klinik yorum
//
// Amaç: Depresyon, kaygı, PTSD, alkol kullanımını objektif ölçümle değerlendirme
// Her seans başında veya ilerleme takibi için

// ─── PHQ-9 (Patient Health Questionnaire-9) — Depresyon ───────────────────────

const PHQ9_QUESTIONS = [
    'Son iki hafta içinde, ilgi veya zevk kaybı ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, mutsuzluk, umutsuzluk veya depresyon hissi ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, uyku sorunu (çok az veya çok fazla uyku) ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, yorgunluk veya enerji eksikliği ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, iştahınızda değişiklik (çok az veya çok fazla yeme) ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, kendinizde başarısızlık hissi veya suçluluk ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, konsantrasyonda sorun (TV izleme, okuma) ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, konuşma/hareket yavaş veya aksine hızlı/kaygılı ne sıklıkta fark ettiniz?',
    'Son iki hafta içinde, kendine zarar verme veya ölümle ilgili düşünceler ne sıklıkta yaşadınız?',
];

const PHQ9_SCALE = {
    0: 'Hiç',
    1: 'Birkaç gün',
    2: 'Yarısından fazla gün',
    3: 'Neredeyse her gün',
};

const PHQ9_SEVERITY = {
    '0-4': { level: 'minimal', label: 'Minimal Depresyon', action: 'Takip et' },
    '5-9': { level: 'mild', label: 'Hafif Depresyon', action: 'Danışman öner' },
    '10-14': { level: 'moderate', label: 'Orta Depresyon', action: 'Terapi öner' },
    '15-19': { level: 'moderately_severe', label: 'Orta-Ağır Depresyon', action: 'Yoğun terapi + ilaç danış' },
    '20-27': { level: 'severe', label: 'Ağır Depresyon', action: 'ACIL: Psikiyatrist + hospitalizasyon riski' },
};

// ─── GAD-7 (Generalized Anxiety Disorder-7) — Kaygı ────────────────────────

const GAD7_QUESTIONS = [
    'Son iki hafta içinde, endişe veya kaygı ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, endişeyi kontrol edememe hissi ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, çeşitli şeyler hakkında endişe ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, rahat olmakta zorluk ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, kaygılı olduğunuzdan dolayı hareket etmekte zorluk ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, öfkelenmek veya sinirli olmak ne sıklıkta yaşadınız?',
    'Son iki hafta içinde, tedirgince olmak (kalp çarpıntısı, nefes almakta zorluk) ne sıklıkta yaşadınız?',
];

const GAD7_SCALE = {
    0: 'Hiç',
    1: 'Birkaç gün',
    2: 'Yarısından fazla gün',
    3: 'Neredeyse her gün',
};

const GAD7_SEVERITY = {
    '0-4': { level: 'minimal', label: 'Minimal Kaygı', action: 'Takip et' },
    '5-9': { level: 'mild', label: 'Hafif Kaygı', action: 'Öz-yardım stratejileri' },
    '10-14': { level: 'moderate', label: 'Orta Kaygı', action: 'Terapi öner (CBT-Kaygı)' },
    '15-21': { level: 'severe', label: 'Ağır Kaygı', action: 'Yoğun terapi + ilaç danış' },
};

// ─── PCL-5 (PTSD Checklist-5) — Travma/PTSD ─────────────────────────────────

const PCL5_QUESTIONS = [
    'Travmatik olay sonrası, olayla ilgili istenmeyen anılar/düşünceler ne sıklıkta yaşadınız?',
    'Olayla ilgili rüyalar ne sıklıkta gördünüz?',
    'Olayla ilgili, sanki şu anda yaşanıyor gibi tepkiler ne sıklıkta yaşadınız?',
    'Olayı hatırlatan şeylere maruz kalınca, şiddetli duygusal tepki ne sıklıkta verdginiz?',
    'Olayı hatırlatan şeyleri kaçındığınız sıklık nedir?',
    'Olay sonrası, önemli şeyleri hatırlamakta zorluk ne sıklıkta yaşadınız?',
    'Olay sonrası, kendiniz/başkaları hakkında olumsuz inançlar ne sıklıkta yaşadınız?',
    'Olayı başkalarına suçlama eğilimi ne sıklıkta yaşadınız?',
    'Olay sonrası, negatif duygular (korku, öfke, suçluluk) ne sıklıkta yaşadınız?',
    'Olay sonrası, tehlikeli/becerisiz hissetme ne sıklıkta yaşadınız?',
    'Olay sonrası, çok dikkatli/uyanık olma ne sıklıkta yaşadınız?',
    'Olay sonrası, sinirli/saldırgan tepkiler ne sıklıkta verdginiz?',
    'Olay sonrası, kendi kendine zarar verme riski ne sıklıkta yaşadınız?',
    'Olay sonrası, hoşlanmadığınız şeyleri yapma ne sıklıkta yaşadınız?',
    'Olay sonrası, sosyal/aile ilişkilerinde sorun ne sıklıkta yaşadınız?',
    'Olay sonrası, iş/sosyal/aile işlerinde sorun ne sıklıkta yaşadınız?',
    'Olay sonrası, yakın kişilerle ilişkilerde sorun ne sıklıkta yaşadınız?',
    'Olay sonrası, aile içi kesinlikle sorun ne sıklıkta yaşadınız?',
    'Olay sonrası, sevdiğiniz aktivitelerde ilgi kaybı ne sıklıkta yaşadınız?',
    'Olay sonrası, başkalarından uzaklaşma/ayrılma ne sıklıkta yaşadınız?',
];

const PCL5_SCALE = {
    0: 'Hiç',
    1: 'Biraz',
    2: 'Orta düzeyde',
    3: 'Oldukça fazla',
    4: 'Çok fazla',
};

const PCL5_SEVERITY = {
    '0-10': { level: 'minimal', label: 'Minimal PTSD Semptom', action: 'Takip et' },
    '11-20': { level: 'mild', label: 'Hafif PTSD', action: 'SE (Somatic Experiencing) başla' },
    '21-35': { level: 'moderate', label: 'Orta PTSD', action: 'Yoğun travma terapisi + ilaç' },
    '36-80': { level: 'severe', label: 'Ağır PTSD', action: 'ACIL: Psikiyatrist + hospitalizasyon' },
};

// ─── AUDIT (Alcohol Use Disorders Identification Test) — Alkol ───────────────

const AUDIT_QUESTIONS = [
    'Sizce, ne sıklıkta alkol içersiniz?',
    'Alkol içtiğiniz zaman, kaç standart içecek içersiniz?',
    'Kaç içecekten fazlasını aynı anda içtiğiniz sıklık nedir?',
    'Son bir yılda, başladıktan sonra içeceği durduramamış sıklığınız nedir?',
    'Son bir yılda, içki nedeniyle sorumluluğunuzu yerine getirememiş sıklığınız nedir?',
    'Son bir yılda, sabah içkiye gereksinme duydunuz mu?',
    'Son bir yılda, içtikten sonra suçluluk/pişmanlık hissettiniz mi?',
    'Son bir yılda, içme nedeniyle yaralanma riski yaşadınız mı?',
    'Doktor veya sağlık çalışanı, içim azaltmalıyım demesi sonra, dinlediniz mi?',
];

const AUDIT_SCALE_0_8 = {
    0: 'Hiç',
    1: 'Ayda bir veya daha az',
    2: '2-4 kez ayda',
    3: '2-3 kez haftada',
    4: '4+ kez haftada',
};

const AUDIT_SCALE_9 = {
    0: 'Hiç',
    1: 'Evet, ama son yılda değil',
    2: 'Evet, son bir yılda',
    3: 'Evet, son bir ayda',
    4: 'Evet, son haftada',
};

const AUDIT_SEVERITY = {
    '0-7': { level: 'minimal', label: 'Düşük Risk', action: 'Genel öneri: alkol sınırlı kullan' },
    '8-15': { level: 'hazardous', label: 'Riskli İçme', action: 'İçmeyi azaltma danışmanlığı' },
    '16-19': { level: 'harmful', label: 'Zararlı İçme', action: 'Terapi + hastalık tarama' },
    '20-40': { level: 'dependence', label: 'Alkol Bağımlılığı', action: 'ACIL: Rehabilitasyon + ilaç' },
};

// ─── DETECT & ASSESS FUNCTIONS ────────────────────────────────────────────────

/**
 * Değerlendirme zamanı mı belirle (seans başı veya ilerleme kontrolü)
 * @param {Object} sessionData — { sessionNumber, lastAssessmentSession, userMessage }
 * @returns {{ shouldAssess: boolean, assessmentType: string, reason: string }}
 */
export function detectAssessmentTiming(sessionData = {}) {
    const { sessionNumber = 0, lastAssessmentSession = 0, userMessage = '' } = sessionData;

    const sesionsSinceAssess = sessionNumber - lastAssessmentSession;

    // Tetikleyiciler
    let assessmentType = null;
    let reason = '';

    // İlk seans → tam tarama
    if (sessionNumber === 1) {
        assessmentType = 'baseline';
        reason = 'İlk seans — taban ölçüsü';
    }
    // Her 4 seansda bir → ilerleme kontrolü
    else if (sesionsSinceAssess >= 4) {
        assessmentType = 'progress';
        reason = '4 seansda bir ilerleme kontrolü';
    }
    // Kullanıcı isterse
    else if (/değerlendir|test|ölçüm|nasıl gidiyorum|ilerleme/i.test(userMessage)) {
        assessmentType = 'on_demand';
        reason = 'Kullanıcı istedi';
    }
    // Kriz veya ağır semptom → hemen
    else if (/kriz|ölüm|intihar|çok kötü|dayanamıyorum/i.test(userMessage)) {
        assessmentType = 'crisis';
        reason = 'Kriz durumu — acil değerlendirme';
    }

    return {
        shouldAssess: !!assessmentType,
        assessmentType,
        reason,
        sesionsSinceAssess,
    };
}

/**
 * PHQ-9 skorunu hesapla ve klinik yorum yap
 * @param {Array<number>} scores — 9 soru için 0-3 puanları
 * @returns {{ totalScore: number, severity: string, label: string, action: string }}
 */
export function scorePHQ9(scores = []) {
    if (!Array.isArray(scores) || scores.length !== 9) {
        return { totalScore: 0, severity: 'invalid', label: 'Geçersiz skor', action: '' };
    }

    const totalScore = scores.reduce((a, b) => a + (b || 0), 0);
    const range = Object.keys(PHQ9_SEVERITY).find(r => {
        const [min, max] = r.split('-').map(Number);
        return totalScore >= min && totalScore <= max;
    });

    const result = PHQ9_SEVERITY[range] || PHQ9_SEVERITY['0-4'];

    return {
        totalScore,
        severity: result.level,
        label: result.label,
        action: result.action,
    };
}

/**
 * GAD-7 skorunu hesapla ve klinik yorum yap
 * @param {Array<number>} scores — 7 soru için 0-3 puanları
 * @returns {{ totalScore: number, severity: string, label: string, action: string }}
 */
export function scoreGAD7(scores = []) {
    if (!Array.isArray(scores) || scores.length !== 7) {
        return { totalScore: 0, severity: 'invalid', label: 'Geçersiz skor', action: '' };
    }

    const totalScore = scores.reduce((a, b) => a + (b || 0), 0);
    const range = Object.keys(GAD7_SEVERITY).find(r => {
        const [min, max] = r.split('-').map(Number);
        return totalScore >= min && totalScore <= max;
    });

    const result = GAD7_SEVERITY[range] || GAD7_SEVERITY['0-4'];

    return {
        totalScore,
        severity: result.level,
        label: result.label,
        action: result.action,
    };
}

/**
 * PCL-5 skorunu hesapla ve klinik yorum yap
 * @param {Array<number>} scores — 20 soru için 0-4 puanları
 * @returns {{ totalScore: number, severity: string, label: string, action: string }}
 */
export function scorePCL5(scores = []) {
    if (!Array.isArray(scores) || scores.length !== 20) {
        return { totalScore: 0, severity: 'invalid', label: 'Geçersiz skor', action: '' };
    }

    const totalScore = scores.reduce((a, b) => a + (b || 0), 0);
    const range = Object.keys(PCL5_SEVERITY).find(r => {
        const [min, max] = r.split('-').map(Number);
        return totalScore >= min && totalScore <= max;
    });

    const result = PCL5_SEVERITY[range] || PCL5_SEVERITY['0-10'];

    return {
        totalScore,
        severity: result.level,
        label: result.label,
        action: result.action,
    };
}

/**
 * AUDIT skorunu hesapla ve klinik yorum yap
 * @param {Array<number>} scores — 10 soru için değişken ölçekler
 * @returns {{ totalScore: number, severity: string, label: string, action: string }}
 */
export function scoreAUDIT(scores = []) {
    if (!Array.isArray(scores) || scores.length !== 10) {
        return { totalScore: 0, severity: 'invalid', label: 'Geçersiz skor', action: '' };
    }

    const totalScore = scores.reduce((a, b) => a + (b || 0), 0);
    const range = Object.keys(AUDIT_SEVERITY).find(r => {
        const [min, max] = r.split('-').map(Number);
        return totalScore >= min && totalScore <= max;
    });

    const result = AUDIT_SEVERITY[range] || AUDIT_SEVERITY['0-7'];

    return {
        totalScore,
        severity: result.level,
        label: result.label,
        action: result.action,
    };
}

// ─── BUILD CONTEXT FUNCTIONS ──────────────────────────────────────────────────

/**
 * Değerlendirme sonuç bağlamı oluştur (çoklu test)
 * @param {Object} assessments — { phq9Score, gad7Score, pcl5Score, auditScore }
 * @returns {string}
 */
export function buildAssessmentsContext(assessments = {}) {
    const { phq9Scores = [], gad7Scores = [], pcl5Scores = [], auditScores = [] } = assessments;

    let context = `[STANDART KLİNİK DEĞERLENDİRME]\n\n`;

    // PHQ-9
    if (phq9Scores.length === 9) {
        const phq9 = scorePHQ9(phq9Scores);
        context += `📋 DEPRESYONDEĞERLENDİRMESİ (PHQ-9)\n`;
        context += `  Skor: ${phq9.totalScore}/27\n`;
        context += `  Düzey: ${phq9.label}\n`;
        context += `  Yorum: ${phq9.action}\n\n`;
    }

    // GAD-7
    if (gad7Scores.length === 7) {
        const gad7 = scoreGAD7(gad7Scores);
        context += `📋 KAYGI DEĞERLENDİRMESİ (GAD-7)\n`;
        context += `  Skor: ${gad7.totalScore}/21\n`;
        context += `  Düzey: ${gad7.label}\n`;
        context += `  Yorum: ${gad7.action}\n\n`;
    }

    // PCL-5
    if (pcl5Scores.length === 20) {
        const pcl5 = scorePCL5(pcl5Scores);
        context += `📋 TRAVMA DEĞERLENDİRMESİ (PCL-5)\n`;
        context += `  Skor: ${pcl5.totalScore}/80\n`;
        context += `  Düzey: ${pcl5.label}\n`;
        context += `  Yorum: ${pcl5.action}\n\n`;
    }

    // AUDIT
    if (auditScores.length === 10) {
        const audit = scoreAUDIT(auditScores);
        context += `📋 ALKOL KULLANIMDEĞERLENDİRMESİ (AUDIT)\n`;
        context += `  Skor: ${audit.totalScore}/40\n`;
        context += `  Düzey: ${audit.label}\n`;
        context += `  Yorum: ${audit.action}\n\n`;
    }

    context += `[SEANS KURSU]\n`;
    context += `Bu değerlendirmeler, tedavi ilerlemenizi objektif olarak ölçer.\n`;
    context += `Klinik psikolojide standart kullanılan araçlardır (DSM-5 uyumlu).\n`;
    context += `→ İlerleme ölçümü = artış sinyali = motivasyon ve uyum.`;

    return context;
}

/**
 * Değerlendirme sorusu seti döndür (AI soran için)
 * @param {string} assessmentType — 'phq9'|'gad7'|'pcl5'|'audit'
 * @returns {Array<string>}
 */
export function getAssessmentQuestions(assessmentType = '') {
    const questions = {
        phq9: PHQ9_QUESTIONS,
        gad7: GAD7_QUESTIONS,
        pcl5: PCL5_QUESTIONS,
        audit: AUDIT_QUESTIONS,
    };

    return questions[assessmentType] || [];
}

/**
 * Trend analizi — önceki değerlendirmelerle karşılaştır
 * @param {Object} current — { phq9, gad7, pcl5, audit }
 * @param {Object} previous — { phq9, gad7, pcl5, audit }
 * @returns {string}
 */
export function buildTrendAnalysis(current = {}, previous = {}) {
    let analysis = `[SEANS BAZLI İLERLEME TRENDİ]\n\n`;

    const metrics = [
        { key: 'phq9', label: 'Depresyon (PHQ-9)', max: 27 },
        { key: 'gad7', label: 'Kaygı (GAD-7)', max: 21 },
        { key: 'pcl5', label: 'Travma (PCL-5)', max: 80 },
        { key: 'audit', label: 'Alkol (AUDIT)', max: 40 },
    ];

    metrics.forEach(({ key, label, max }) => {
        const curr = current[key] || 0;
        const prev = previous[key] || 0;
        const change = curr - prev;
        const percent = prev > 0 ? ((change / prev) * 100).toFixed(0) : 0;

        let arrow = '→';
        let status = '';

        if (change < 0) {
            arrow = '📉';
            status = `İYİ: ${Math.abs(change)} puan düştü (%${Math.abs(percent)})`;
        } else if (change > 0) {
            arrow = '📈';
            status = `DİKKAT: ${change} puan arttı (%${percent})`;
        } else {
            arrow = '→';
            status = 'Değişim yok — takip et';
        }

        analysis += `${arrow} ${label}: ${prev} → ${curr} (${status})\n`;
    });

    analysis += `\n[YORUMLAR]\n`;
    analysis += `Düşüş = iyileşme, Artış = kötüleşme\n`;
    analysis += `Düz = durağan — müdahale yoğunlaştır\n`;
    analysis += `→ Trendler = terapi etkinliğinin göstergesi`;

    return analysis;
}
