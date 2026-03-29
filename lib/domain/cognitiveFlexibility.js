// lib/cognitiveFlexibility.js
// Bilişsel Esneklik — Katı Düşüncelerden Çıkış ve Perspektif Alma
// ACT (Acceptance & Commitment Therapy) + Cognitive Reframing
//
// Amaç: Düşünce sertliğini azaltmak, birden fazla perspektiften bakma

const COGNITIVE_RIGIDITY_PATTERNS = {
    absolute_thinking: {
        name: 'Mutlak Düşünce (Absolutistic Thinking)',
        description: '"Her zaman", "Hiçbir zaman", "Kesinlikle" gibi katı ifadeler',
        examples: [
            '"Hiçbir zaman başarılı olamayacağım"',
            '"Herkes beni sevmiyor"',
            '"Bu hata bunu bitirir"',
            '"Daima yalnız kalacağım"',
        ],
        belief_pattern: 'Bir olay = kalıcı durum',
        cognitive_flexibility_score: 0,
    },

    catastrophizing_extremes: {
        name: 'Felaketleştirme (Catastrophizing Extremes)',
        description: 'Kötü bir sonuç → en kötü sonuç (skala atlaması)',
        examples: [
            '"Hata yaptım, işimi kaybedeceğim, evsiz kalacağım"',
            '"Bayılmama belirtileri, ölüm kesin"',
            '"Reddet = hiçbir zaman sevmeyecek"',
        ],
        belief_pattern: '1 → 10 skala sıçraması',
        cognitive_flexibility_score: 0,
    },

    all_or_nothing: {
        name: 'Siyah-Beyaz Düşünce (All-or-Nothing)',
        description: 'Ortası yok: mükemmel veya başarısız',
        examples: [
            '"Diyeti bozdum, artık tüm çabaları boş"',
            '"70/100 alan = başarısız"',
            '"Bir şey yanlış gitti, tüm plan bozuldu"',
        ],
        belief_pattern: 'Gri yok, sadece siyah veya beyaz',
        cognitive_flexibility_score: 0,
    },

    mind_reading: {
        name: 'Zihin Okuma (Mind Reading)',
        description: 'Başkasının ne düşündüğünü bildiğini varsayma',
        examples: [
            '"Bana bakıyor, beni sevmiyor olmalı"',
            '"Sesinde tono yok, öfkeli olmalı"',
            '"Yanıt vermiyor, beni unutmuş"',
        ],
        belief_pattern: 'Spekülasyon → Gerçek inanç',
        cognitive_flexibility_score: 0,
    },

    should_statements: {
        name: 'Gerekli İfadeler (Should Statements)',
        description: '"Yapmalıydım", "Etmeli", "Gerekir" ile kendine baskı',
        examples: [
            '"Daha çalışkan olmalıydım"',
            '"İnsanlar beni beğenmeliler"',
            '"Bu kadar az saatli asla olmamalı"',
        ],
        belief_pattern: 'Beklenti → Suçluluk / Öfke',
        cognitive_flexibility_score: 0,
    },

    overgeneralization: {
        name: 'Aşırı Genelleme (Overgeneralization)',
        description: 'Bir olay → tüm durumlara genelleme',
        examples: [
            '"Sınavı kaybettim, akademik olarak başarısız"',
            '"Sosyal etkinlikte hiçbir konuştum, sosyal becerilerim yok"',
            '"Bir ilişki başarısız oldu, hiçbir zaman sevmeyecek"',
        ],
        belief_pattern: 'Spesifik → Evrensel',
        cognitive_flexibility_score: 0,
    },

    labeling: {
        name: 'Etiketleme (Labeling)',
        description: 'Kişiyi veya eylemi sınıflandırma, etiket yapıştırma',
        examples: [
            '"Başarısız bir insanım"',
            '"Ben kaygılıyım"',
            '"Narsisistim" (hata yaptı)',
            '"Hiçbir kimim" (olumsuz olay)',
        ],
        belief_pattern: 'Eylem → Kimlik',
        cognitive_flexibility_score: 0,
    },
};

/**
 * Bilişsel sertlik / rigidity tespit et
 * @param {string} userMessage
 * @returns {{ rigidPatterns: Array, rigidityScore: number, primaryPattern: string, flexibility: string }}
 */
export function detectCognitiveRigidity(userMessage = '') {
    const text = userMessage.toLowerCase();
    const detected = [];

    // Absolute thinking keywords
    if (/hiçbir|kesinlikle|asla|her zaman|daima|hiçbir zaman|imkansız|olamaz/i.test(text)) {
        detected.push('absolute_thinking');
    }

    // Catastrophizing
    if (/sonra|sonrasında|sonuçta|başarısız|kaybedecek|öleceğim|bitecek|diye/i.test(text)) {
        detected.push('catastrophizing_extremes');
    }

    // All-or-nothing
    if (/başarısız|mükemmel|hep|tamamen|tüm|başladı|bitiyor/i.test(text)) {
        detected.push('all_or_nothing');
    }

    // Mind reading
    if (/düşünüyor|bakış|ses tonu|şekilde|hissediyor|olmalı|olmasını/i.test(text)) {
        detected.push('mind_reading');
    }

    // Should statements
    if (/yapmalı|etmeli|gerekir|lazım|olmam lazım|yapmalıydım|olmalı/i.test(text)) {
        detected.push('should_statements');
    }

    // Overgeneralization
    if (/asla|her şey|hep böyle|hiç|başarılı değil/i.test(text)) {
        detected.push('overgeneralization');
    }

    // Labeling
    if (/ben\s+(\w+|[a-zçğıöşü]+)( insan| insanım| kim| var)?/i.test(text)) {
        detected.push('labeling');
    }

    // Rigidity skoru hesapla (0-100)
    const rigidityScore = Math.min(detected.length * 15, 100);
    const flexibility =
        rigidityScore > 60
            ? 'Çok katı — perspektif değiştirme zor'
            : rigidityScore > 40
              ? 'Orta katı — biraz esneklik var'
              : 'Nispeten esnek — iyiye gidişi var';

    return {
        rigidPatterns: detected.slice(0, 3),
        rigidityScore,
        primaryPattern: detected[0] || null,
        flexibility,
        hasCognitiveRigidity: detected.length > 0,
    };
}

/**
 * Bilişsel esneklik bağlamı
 * @param {string} patternName — absolute_thinking, catastrophizing_extremes, etc.
 * @returns {string}
 */
export function buildCognitiveFlexibilityContext(patternName = '') {
    if (!patternName || !COGNITIVE_RIGIDITY_PATTERNS[patternName]) {
        return '';
    }

    const pattern = COGNITIVE_RIGIDITY_PATTERNS[patternName];
    let context = `[BİLİŞSEL ESNEKLİK — Perspektif Değiştirme]\n\n`;
    context += `Tespit Edilen: ${pattern.name}\n`;
    context += `Açıklama: ${pattern.description}\n\n`;

    context += `Örnek İfadeler:\n`;
    pattern.examples.slice(0, 2).forEach(ex => {
        context += `  • ${ex}\n`;
    });

    context += `\n[ESNEKLIK İÇİN 3 ADIM]\n\n`;

    if (patternName === 'absolute_thinking') {
        context += `1️⃣ MUTLAK KÖPEĞİNİ BULUN\n`;
        context += `   Kelime: "Hiçbir", "Her zaman", "Asla", "Daima"\n`;
        context += `   Bunlar sektir → Kısmi söyleme çalış\n\n`;

        context += `2️⃣ ÜRETİ SÖYLE\n`;
        context += `   ❌ "Hiçbir zaman başarılı olamayacağım"\n`;
        context += `   ✅ "Şu ana kadar bu alanda başarısız oldum, ama olabilir"\n`;
        context += `   ✅ "Çoğu zaman kendimi başarısız hissediyorum"\n\n`;

        context += `3️⃣ KENDİNE SORUT\n`;
        context += `   "Harçi bu mutlak mı? Hiç istisna var mı?"\n`;
        context += `   Örnek: "Asla öğrenebilme" - ama Google nasıl öğrendin?\n\n`;
    } else if (patternName === 'catastrophizing_extremes') {
        context += `1️⃣ SUDS SKALASı (0-100 KORKU)\n`;
        context += `   Şu an hissettiğim korku: _____ / 100\n`;
        context += `   En kötü senaryo (ölüm): 100\n`;
        context += `   \n   Soru: Gerçekten 100'e mi? Yoksa 20 mi?\n\n`;

        context += `2️⃣ VERİ TOPLA\n`;
        context += `   ❌ "Hata yaptım, işim gidecek, evsiz kalacağım"\n`;
        context += `   ✅ "Bu hatanın işi gidermesi mü? Kimse hiç hata yapmıyor mu?"\n`;
        context += `   ✅ "İnsan kaynakları birincisi reddet mi, yoksa sohbet mi eder?"\n\n`;

        context += `3️⃣ EN KÖTÜ SONUÇ + KURTARMA\n`;
        context += `   İşim giderse → CV güncellerim → başka iş bulurum\n`;
        context += `   Evsiz kalsam → arkadaş yanına / barınak\n`;
        context += `   Bir hayat sonu değil, sonraki bölüm\n\n`;
    } else if (patternName === 'all_or_nothing') {
        context += `1️⃣ ÖLÇÜYÜ GÖR\n`;
        context += `   Siyah ↔ Beyaz ↔ GRİ\n`;
        context += `   Çoğu hayat GRİ'dedir\n\n`;

        context += `2️⃣ "İYİ YETERLI" BULUT\n`;
        context += `   ❌ "Mükemmel veya başarısız"\n`;
        context += `   ✅ "Eğer 70/100 yaparsam, iş görür mü? İlerleme var mı?"\n\n`;

        context += `3️⃣ KUMULAT VEYİN\n`;
        context += `   Bir hata → tüm çaba bozulmasa\n`;
        context += `   1 eksik madde → tüm plan bitmiş değil\n`;
        context += `   70% iyiye gitmiş → %30'un şansı var (yeterli)\n\n`;
    } else if (patternName === 'mind_reading') {
        context += `1️⃣ VARSAYIM BÖLMEK\n`;
        context += `   ❌ "Sesinde tono yok, öfkeli"\n`;
        context += `   ✅ "Sesinde tono yok, belki yorgun / meşgul / rahat"\n\n`;

        context += `2️⃣ DENEMELİ\n`;
        context += `   "Öfkeli misin yoksa başka bir şey mi var?"\n`;
        context += `   Gözlemlenen + Soran = Gerçek\n\n`;

        context += `3️⃣ SEÇENEKLER LİSTELE\n`;
        context += `   Bakış: Yorgun, meşgul, rahat, üzgün, mutlu, uzakta\n`;
        context += `   %20 = öfke, %80 = başka şeyler olabilir\n\n`;
    } else if (patternName === 'should_statements') {
        context += `1️⃣ "YAPMALIYIM" BULUT\n`;
        context += `   ❌ "Daha çalışkan olmalıydım"\n`;
        context += `   ✅ "İnsan doğası — bazen tembel, bazen çalışkan"\n\n`;

        context += `2️⃣ "YAPMALIYIM" → "İSTİYORUM" ÇEVIR\n`;
        context += `   ❌ "İnsanlar beni beğenmeliler" (baskı)\n`;
        context += `   ✅ "Bazı insanları etkileyebiliyorum, bazılarını etkilemiyor" (özgürlük)\n\n`;

        context += `3️⃣ BEKLENT GERÇEKÇI Mİ?\n`;
        context += `   "Ev sahibi mi mükemmel? Doktor mu hata yapmıyor?"\n`;
        context += `   Herkez hata yapıyor. Sen, ben, herkes.\n\n`;
    } else if (patternName === 'overgeneralization') {
        context += `1️⃣ ÖZELNÜ BUL\n`;
        context += `   ❌ "Sosyal etkinlikte sessiz kaldım, sosyal becerim yok"\n`;
        context += `   ✅ "Bugün (bu etkinlikte) sessiz kaldım" (spesifik)\n\n`;

        context += `2️⃣ BİR KOR BAŞARISI BULT\n`;
        context += `   "Başarı açısından konuş muş musunuz? Komik söylemiş miydin? Birini memnun ettiniz mi?"\n`;
        context += `   Bir başarı = tüm beceriler değil\n\n`;

        context += `3️⃣ "SU KATILDI" ZAMAN\n`;
        context += `   Geçmiş başarılar: "Daha önceki sosyal zamanlar iyiydi"\n`;
        context += `   Bu bir hata değil, bölüm değişikliği\n\n`;
    } else if (patternName === 'labeling') {
        context += `1️⃣ ETIKET → DAVRANIŞ ÇEVIR\n`;
        context += `   ❌ "Ben depresyonluyum" (kimlik)\n`;
        context += `   ✅ "Depresyon yaşıyorum" (geçici durum)\n\n`;

        context += `2️⃣ DAVRANIŞI ELİ TUTUT\n`;
        context += `   "Hata yapmak ≠ başarısız insan"\n`;
        context += `   "Bir yanlış ≠ tüm kişilik"\n\n`;

        context += `3️⃣ MOSAİK KIMLIĞI BULT\n`;
        context += `   Hiçbir insanın bir etiketi yok\n`;
        context += `   Sen: Bazen cesur, bazen korkan, bazen çalışkan, bazen tembel\n`;
        context += `   Bütün bunlar = tam sen\n\n`;
    }

    context += `→ Bir perspektifi değiştirmek 1 gün alır, alışkanlık olmak 3 hafta alır.`;

    return context;
}

/**
 * Perspektif alma egzersizi
 * @param {string} rigidBelief
 * @returns {string}
 */
export function buildPerspectiveTakingExercise(rigidBelief = '') {
    let exercise = `[PERSPEKTİF ALMA EGZERSIZI — 5 DAKİKA]\n\n`;

    exercise += `Katı İnanç: "${rigidBelief || 'Hiçbir zaman başarılı olamayacağım'}"\n\n`;

    exercise += `1️⃣ DEĞİŞTİRİLMİŞ VERSİYON (Kısmi)\n`;
    exercise += `   "Şu anki durum / çoğu zaman / bazı alanlar / henüz bulamadım"\n\n`;

    exercise += `2️⃣ DÖRDANCİ KIŞI PERSPEKTİFİ (Empati)\n`;
    exercise += `   "Eğer best friend bu söylese, ne derdin?"\n`;
    exercise += `   "En sevdiğim kişi bu inanış hakkında ne derdi?"\n\n`;

    exercise += `3️⃣ 5 YIL SONRA PERSPEKTİFİ (Zaman)\n`;
    exercise += `   "5 yıl sonra bu şu anki olay önemli mi olacak?"\n`;
    exercise += `   "Hayat kursam, bunu hatırlayan mı olacak?"\n\n`;

    exercise += `4️⃣ VERİ KARŞIS BULUT (Kanıtlar)\n`;
    exercise += `   Katı inanışa karşı ÜÇ kanıt bul:\n`;
    exercise += `   "Aslında önceki başarılarımı hatırladığımda..."\n\n`;

    exercise += `5️⃣ BALIN AÇIKLAMA YAZ\n`;
    exercise += `   Katı inanışın yeni versiyonunu az cümlede yaz\n`;
    exercise += `   Oku, hergün 3 defa tekrar et (10 gün)\n\n`;

    exercise += `→ Zihin değişikliği = tekrarlama. Sabırlı ol.`;

    return exercise;
}
