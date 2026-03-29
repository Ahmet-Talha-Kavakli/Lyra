// lib/executiveFunction.js
// Executive Function — ADHD Yönetimi, Odaklanma, Zaman Yönetimi, Planlama
// Barkley ADHD modeli, Pomodoro Tekniği, Time Blocking
//
// Amaç: Bilişsel yönetim — görevleri organize etme, overwhelm engelleme, dikkat yönetimi

const EXECUTIVE_FUNCTION_AREAS = {
    working_memory: {
        name: 'Çalışan Bellek (Working Memory)',
        description: 'Aynı anda birden fazla bilgiyi tutma kapasitesi',
        symptoms: [
            'Bir cümlenin ortasında unuttum ne söyleyecektim',
            'Talimatı unutuyorum (iki işlem var, biri yapınca diğeri)',
            'Zihni dolu hissediyorum',
            'Not tutmak zorunlu, aksi halde kayboluyor',
        ],
        deficit_level: 0,
    },

    response_inhibition: {
        name: 'Tepki İnhibisyonu (Çabuk Davranma)',
        description: 'Bir düşünceyi doğrudan davranışa dönüştürme',
        symptoms: [
            'Konuşmadan önce düşünmüyorum, pişman oluyorum',
            'Cep telefonumu kontrol etmekten alamıyorum',
            'Yüksek sesle konuşuyorum, durduramıyorum',
            'Duygu → Davranış direkt, hiç filtre yok',
        ],
        deficit_level: 0,
    },

    task_initiation: {
        name: 'Görev Başlatma (Task Initiation)',
        description: 'Zor, sıkıcı veya belirsiz görevleri başlatma',
        symptoms: [
            'Başlamakta zorlanıyorum, başladıktan sonra iyiyim',
            'Son dakika telef — "sürü" duygu hissediyorum',
            'Hazırlık aşamasında takılıyorum',
            'Başlama yerine başka şeyler yapıyorum',
        ],
        deficit_level: 0,
    },

    task_persistence: {
        name: 'Görev Devamlılığı (Task Persistence)',
        description: 'Görevde kalma, dışarıdan distraksiyon yönetimi',
        symptoms: [
            'Kolayca dağılıyorum',
            'Bir seste, bildirimde odaklanma gidiyor',
            'Görev zor/sıkıcı olunca vazgeçiyorum',
            'Nihai hedefe uzaksa motivasyon yok',
        ],
        deficit_level: 0,
    },

    planning_organization: {
        name: 'Planlama & Organizasyon',
        description: 'Projeyi adımlara bölme, sırası belirleme, resource tahsisi',
        symptoms: [
            'Nereden başlayacağımı bilmiyorum',
            'Adımlar karmaşık görünüyor',
            'Zamanını yanlış tahmin ediyorum',
            'Her şey acil, hiçbir şey önceliklendirmiyorum',
        ],
        deficit_level: 0,
    },

    emotional_regulation: {
        name: 'Duygusal Düzenleme',
        description: 'Frustration, impatience, low tolerance for boredom',
        symptoms: [
            'Hızla öfkeleniyorum, soğumakta uzun sürüyor',
            'Sıkıcı şeyler dayanılmaz geliyor',
            'Küçük hatalar büyük reaksiyonlar',
            'Ruh hali dalgalı, sabit değil',
        ],
        deficit_level: 0,
    },
};

/**
 * Executive function deficit alanlarını tespit et
 * @param {string} userMessage
 * @returns {{ detectedDeficits: Array, primaryDeficit: string, severity: string, overallImpact: string }}
 */
export function detectExecutiveFunction(userMessage = '') {
    const text = userMessage.toLowerCase();
    const detected = [];

    // Working Memory
    if (/unutt|hafız|unuttum|ne dedin|bilgi tutu|haftır/i.test(text)) {
        detected.push('working_memory');
    }

    // Task Initiation
    if (/başla|başlamak|başlamak istiyorum ama|tedirgin|çekiniyorum|daha sonra|erteliy/i.test(text)) {
        detected.push('task_initiation');
    }

    // Task Persistence / Distraction
    if (/dağılıyorum|odaklan|distraksiyon|telefonum|bildirim|açmayı aç|dikkat|kayboluyor/i.test(text)) {
        detected.push('task_persistence');
    }

    // Planning
    if (/nereden başlamalı|adımlar|plan|organize|projem|hangi sıra|kronoloji/i.test(text)) {
        detected.push('planning_organization');
    }

    // Emotional Regulation
    if (/öfke|sinir|sabırsız|küçük şey|niye|kızıyorum|ruh halim|hızlı|duygu|kızan/i.test(text)) {
        detected.push('emotional_regulation');
    }

    // Response Inhibition
    if (/söylememeliyim|kontrol|impuls|açmamı kapat|kapamıyor|bağlanamıyor|direkt|filtre/i.test(text)) {
        detected.push('response_inhibition');
    }

    const severity = detected.length === 0 ? 'low' : detected.length <= 2 ? 'moderate' : 'high';
    const overallImpact =
        severity === 'high'
            ? 'Eklenmiş çaba lazım, günlük rutine sistematik yardım'
            : severity === 'moderate'
              ? 'Bazı alanlar zorluk, stratejiler yardımcı olabilir'
              : 'Minimal etkilenme, ufak optimizasyonlar faydalı';

    return {
        detectedDeficits: detected.slice(0, 3),
        primaryDeficit: detected[0] || null,
        severity,
        overallImpact,
        hasExecutiveFunctionDeficit: detected.length > 0,
    };
}

/**
 * Executive function bağlamı oluştur
 * @param {string} deficitName — working_memory, task_initiation, etc.
 * @returns {string}
 */
export function buildExecutiveFunctionContext(deficitName = '') {
    if (!deficitName || !EXECUTIVE_FUNCTION_AREAS[deficitName]) {
        return '';
    }

    const deficit = EXECUTIVE_FUNCTION_AREAS[deficitName];
    let context = `[EXECUTIVE FUNCTION — Bilişsel Yönetim]\n\n`;
    context += `Zorluk: ${deficit.name}\n`;
    context += `Tanım: ${deficit.description}\n\n`;

    context += `Semptomlağın:\n`;
    deficit.symptoms.slice(0, 3).forEach(sym => {
        context += `  • ${sym}\n`;
    });

    context += `\n[HEMEN UYGULANABILIR STRATEJİLER]\n\n`;

    if (deficitName === 'working_memory') {
        context += `1️⃣ YAZDI TUTAT\n  • Mental not değil, yazılı\n  • Telefon notları, post-it\n  • Tekrar oku (ses + görsel)\n\n`;
        context += `2️⃣ TEKRAR EDILME\n  • Birileri verdiğinde, tekrar söyle\n  • "Anladığım kadarıyla..."\n\n`;
        context += `3️⃣ AZALT\n  • Bir seferde bir talimati (tek iş)\n  • Kompleks görevleri sadeleştir\n\n`;
    } else if (deficitName === 'task_initiation') {
        context += `1️⃣ ZEMİN HAZIRLA\n  • Materyali önceden koy\n  • Odayı hazırla\n  • Başlama adımı net, yazılı\n\n`;
        context += `2️⃣ ZAMANI BELGE\n  • "Saat 10:00'de başlayacağız" (somut)\n  • Alarm koy\n  • Başladıktan 2 dakika = zoru geçti\n\n`;
        context += `3️⃣ İLK ADIM ÇOK KÜÇÜK\n  • Tüm görev değil, sadece 5 dakika\n  • Momentum başladı mı, devam et\n\n`;
    } else if (deficitName === 'task_persistence') {
        context += `1️⃣ POMODORO TEKNİĞİ\n  • 25 dakika çalış\n  • 5 dakika dinlen\n  • 4 döngüden sonra 15 dakika uzun dinlenme\n\n`;
        context += `2️⃣ ÇEVRE DÜZENİ\n  • Telefonun öteki odada\n  • Bilgisayarda sosyal medya kapat\n  • Boğazını telefona haber ver ("Şimdi çalışıyorum")\n\n`;
        context += `3️⃣ ÖDÜL SİSTEMİ\n  • 25 dakika = 5 dakika sevdiğin şey\n  • Beyin motivasyon lazım\n\n`;
    } else if (deficitName === 'planning_organization') {
        context += `1️⃣ PROJEYI KÜÇÜK PARÇALARA BÖL\n  • Tüm görev: 1000 kelime yazı\n  • Böl: Başlık (5 dk) → Ana 1 (10 dk) → Ana 2 (10 dk) → Edit (5 dk)\n\n`;
        context += `2️⃣ SIRAYI BELİRLE\n  • Hangi adım ilk? (Genelde en basit)\n  • Bağımlılık var mı? (B'yi yapmadan A bitiyor mu?)\n\n`;
        context += `3️⃣ ZAMANı TAHMIN ET\n  • ADHD sahiplerinin tahmini %40% eksik (kuralı: x2)\n  • Bence 20 dakika → Plandan 40 dakika al\n\n`;
    } else if (deficitName === 'emotional_regulation') {
        context += `1️⃣ FRAMED BREATHING\n  • Siniri çıktığında: 4-6-8 nefes\n  • Kalbin yavaşla, neokorteks açılır\n\n`;
        context += `2️⃣ SOĞUT\n  • Yüzüne soğuk su\n  • Gümüş döl (5-10 dakika yürüyüş)\n  • Fiziksel aktivite öfkeyi yakıyor\n\n`;
        context += `3️⃣ ISMI KOY\n  • "Şu anda öfkeliyim" demek, hafifletiyor\n  • Beyin duygularını adlandırırsa kontrol ediyor\n\n`;
    } else if (deficitName === 'response_inhibition') {
        context += `1️⃣ DURAKLAT (2-3 saniye)\n  • Her konuşmadan / davranıştan 3 saniye bekle\n  • "Bunu söylememeliyim mi?"\n\n`;
        context += `2️⃣ YAZDIRMA\n  • Kızgın cevabı yazma (göndermeme)\n  • Ertesi gün oku, sil\n\n`;
        context += `3️⃣ ÇEVRE FİLTRESİ\n  • Cep telefonunu gör açabilecek yerden uzaklaştır\n  • Başka odada çalış\n\n`;
    }

    context += `→ Seçme birbirinden başla. Hafta 1'de dene, sonra değerlendir.`;

    return context;
}

/**
 * Günlük yapılandırma planı
 * @param {Object} preferences — { startTime, breakDuration, taskCount }
 * @returns {string}
 */
export function buildDailyStructurePlan(preferences = {}) {
    const { startTime = '09:00', breakDuration = 5, taskCount = 3 } = preferences;

    let plan = `[GÜNLÜK YAPILANDIRMA — Executive Function]\n\n`;
    plan += `📅 Başlangıç: ${startTime}\n`;
    plan += `⏱️ Pomodoro: 25 çalış + ${breakDuration} ara\n`;
    plan += `📋 Görevler: ${taskCount} (en fazla)\n\n`;

    // Parse start time
    const [hours, minutes] = startTime.split(':').map(Number);
    let currentHour = hours;

    plan += `[SAAT SAAT PLAN]\n\n`;

    for (let i = 0; i < taskCount; i++) {
        const taskNumber = i + 1;
        const workStart = `${String(currentHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        currentHour += 0; // Saat sadece örneklemek
        const breakStart = `${String(currentHour + 1).padStart(2, '0')}:${String(25 + minutes).padStart(2, '0')}`;

        plan += `${taskNumber}️⃣ GÖREV ${taskNumber}\n`;
        plan += `   ⏱️ ${workStart}–${breakStart} (25 dakika çalış)\n`;
        plan += `   📌 [Görev adını yazın]\n`;
        plan += `   ☕ SONRA: ${breakDuration} dakika KÖŞESİ (yürü, su iç, nefes)\n\n`;

        currentHour += 1;
    }

    plan += `[KURAL]\n`;
    plan += `  • 4 Pomodoro (1 saat 40 dakika) → 15 dakika uzun ara\n`;
    plan += `  • Başka şey yapma, uyul yapmanın kurukları\n`;
    plan += `  • Eğer görev 25 dakikada biterse, ertesi 10 dakika ek çalış (momentum)\n\n`;
    plan += `→ Hafta sonunda: Kaç görev bitirdim? Sonraki hafta realitik midir?`;

    return plan;
}

/**
 * Executive function challenge özeti
 * @param {Array} deficits
 * @returns {string}
 */
export function buildExecutiveFunctionSummary(deficits = []) {
    if (!Array.isArray(deficits) || deficits.length === 0) {
        return '';
    }

    const summaryMap = {
        working_memory: '(Bellek) Yazı yardımcı olur',
        task_initiation: '(Başlama) Zaman ve zemin hazırla',
        task_persistence: '(Odaklanma) Pomodoro ve çevre denetimi',
        planning_organization: '(Planlama) Küçük parçalara böl',
        emotional_regulation: '(Duygu) Nefes, hareket, adlandırma',
        response_inhibition: '(Kontrol) 3 saniye duraklat',
    };

    let summary = `[EXECUTIVE FUNCTION ÖZET]\n\n`;
    summary += `Tespit Edilen Alanlar:\n`;
    deficits.slice(0, 3).forEach((d, i) => {
        summary += `${i + 1}. ${summaryMap[d] || d}\n`;
    });

    summary += `\n✅ HERHANGİ BİR ADIM İLE BAŞLA (Hepsine birden değil)\n`;

    return summary;
}
