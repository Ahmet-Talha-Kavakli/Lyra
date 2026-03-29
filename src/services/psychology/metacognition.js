// lib/metacognition.js
// Metakognisyon — Düşünce Hakkında Düşünme Farkındası
// Wells & Cartwright-Hatton modeli, Metacognitive Therapy (MCT)
//
// Amaç: Düşünce processinin kendisini gözlemlemek, düşünce halkalarından kurtulmak

const METACOGNITIVE_PROCESSES = {
    rumination: {
        name: 'Ruminasyon (Düşünce Çemberi)',
        description: 'Aynı sorunun üstüne defalarca dönüp durma',
        indicators: [
            'Saat boyunca aynı şey düşünme',
            '"Neden böyle?" sorusunun cevabı yok ama devam ediyorum',
            'Sorunu çözmüyor ama yapmayı bırakamıyor',
            'Uyku öncesi, sabah ilk duygu',
        ],
        triggers: ['Stres', 'Belirsizlik', 'İş başarısızlığı', 'İlişki çatışması'],
    },

    overthinking: {
        name: 'Aşırı Düşünme (Analiz Paralizi)',
        description: 'Her durumun tüm olasılıklarını analiz etmeye çalışma',
        indicators: [
            'Karar vermede çok uzun zaman alıyor',
            'Her alternativin "ya ama" riski var',
            'Mükemmellik arayışı paralyze ediyor',
            'Başlamadan önce sonucu bilmek istiyor',
        ],
        triggers: ['Büyük kararlar', 'Sosyal durumlar', 'Yeni projeler'],
    },

    thought_looping: {
        name: 'Düşünce Döngüsü (Pinging)',
        description: 'Düşünceler arası sıçrama, odaklanma yok, sakin zihin yok',
        indicators: [
            'Zihin sakin olamıyor, sürekli atlıyor',
            'Bir düşüncü tamamlamadan diğerine geçme',
            'Rahatsızlık, sabırsızlık, huzursuzluk',
            'Meditasyonda başarısızlık',
        ],
        triggers: ['Kaygı', 'ADHD', 'Uyku yoksunluğu'],
    },

    metacognitive_trap: {
        name: 'Metakognitive Tuzak (Kendi İçinde Kaybolma)',
        description: 'Düşüncenin hakkında düşünce → düşüncenin hakkında düşüncenin hakkında düşünce (sonsuz loop)',
        indicators: [
            '"Neden böyle düşünüyorum?" sorduğunda, "Neden bunu soruyorum?" diye soruyor',
            'Öz-gözlemde takılma',
            'Kontrol etme çabası kontrol kaybetme (paradoks)',
        ],
        triggers: ['Bilinçli farkındalık pratikleri (yanlış yönde)', 'Aşırı introspeksiyon'],
    },

    worry: {
        name: 'Endişe (Future-Focused Threat)',
        description: 'Gelecekte olabilecek kötü şeyleri önceden endişeyle düşünme',
        indicators: [
            '"Ya X olursa?" senaryoları',
            'Kontrol edilemez akıp gitme',
            'Fiziksel kaygı belirtileri (sıkı göğüs, kalp)',
            'Yatmadan önce endişe patlattığında uyku yok',
        ],
        triggers: ['Belirsizlik', 'Kontrol kaybetme', 'Sağlık korkuları'],
    },
};

/**
 * Metakognitive süreci tespit et
 * @param {string} userMessage
 * @param {Array} conversationHistory — önceki seanslar
 * @returns {{ detectedProcesses: Array, primaryProcess: string, severity: string }}
 */
export function detectMetacognitiveProcess(userMessage = '', conversationHistory = []) {
    const text = userMessage.toLowerCase();
    const detected = [];

    // Rumination patterns
    if (/neden|niçin|nasıl|hep|sürekli|aynı|düşünüyorum|geçmiyor|çıkamıyorum/i.test(text)) {
        detected.push('rumination');
    }

    // Overthinking patterns
    if (/ama|ya ama|olabilir|riski|ya da|hangisini|karar|seçmek|mükemmel/i.test(text)) {
        detected.push('overthinking');
    }

    // Thought looping patterns
    if (/zihinim|hızlı|kaos|kontrol|sakin|odaklan|düşünc|atl/i.test(text)) {
        detected.push('thought_looping');
    }

    // Worry patterns
    if (/ya olursa|korku|korkuyorum|endişe|gelecek|olacak|yapabilirim mi/i.test(text)) {
        detected.push('worry');
    }

    // Metacognitive trap (soru içinde soru)
    if ((text.match(/neden/g) || []).length > 2 || /düşün.*düşün|nedenin nedeni/i.test(text)) {
        detected.push('metacognitive_trap');
    }

    // Severity hesapla: geçmiş seanslardan tekrar pattern varsa artar
    let severity = 'low';
    if (detected.length >= 2) severity = 'moderate';
    if (detected.length >= 3 || (conversationHistory && conversationHistory.length > 5 && detected.length > 0)) {
        severity = 'high';
    }

    return {
        detectedProcesses: detected.slice(0, 3),
        primaryProcess: detected[0] || null,
        severity,
        hasMetacognition: detected.length > 0,
    };
}

/**
 * Metakognitive bilinçlendirme bağlamı
 * @param {string} processName — rumination, overthinking, thought_looping, etc.
 * @returns {string}
 */
export function buildMetacognitionContext(processName = '') {
    if (!processName || !METACOGNITIVE_PROCESSES[processName]) {
        return '';
    }

    const process = METACOGNITIVE_PROCESSES[processName];
    let context = `[METAKOGNISYON — Düşünce Hakkında Düşünme]\n\n`;
    context += `Tespit Edilen: ${process.name}\n`;
    context += `Açıklama: ${process.description}\n\n`;

    context += `Belirtiler:\n`;
    process.indicators.slice(0, 3).forEach(ind => {
        context += `  • ${ind}\n`;
    });

    context += `\nTetikleyiciler: ${process.triggers.join(', ')}\n\n`;

    if (processName === 'rumination') {
        context += `[RUMINASYON KIRŞ TEKNIĞI]\n`;
        context += `1️⃣ Fark Et: "Şu anda ruminasyon yapıyorum"\n`;
        context += `2️⃣ Ad Ver: "Bu benim düşünce döngüsü" (uzak gözlemci konumuna geç)\n`;
        context += `3️⃣ Hareket Et: Ruminasyonu kır — yürü, müzik dinle, harekete geç\n\n`;
        context += `Kural: Rumination düşünce çözüyor değil, sadece zaman harcıyor.`;
    } else if (processName === 'overthinking') {
        context += `[AŞIRI DÜŞÜNME DURDURMACI]\n`;
        context += `1️⃣ 70% Kural: 100% bilgi bekleme, %70 yeter. Hareket et.\n`;
        context += `2️⃣ Karar Süresi Limit: En fazla 10 dakika. Sonra oy ile karar ver.\n`;
        context += `3️⃣ "İyi Yeterli" Ara: Mükemmel değil, işe yarayan seç.\n\n`;
        context += `Hatırla: Hata yapma capacitesi çok yüksek, hata tolere kapasitesi daha yüksek.`;
    } else if (processName === 'thought_looping') {
        context += `[DÜŞÜNCE DÖNGÜSÜ STABILIZATÖRÜ]\n`;
        context += `1️⃣ Zihin Sabitleme: Bir konu seç, 5 dakika sadece onu düşün\n`;
        context += `2️⃣ Nefes: Derin nefes (4-6-8), zihni yavaşlat\n`;
        context += `3️⃣ Beden: Yer değiştir, hareketli ol, fiziksel stabil ol\n\n`;
        context += `Zihin sürüklenirse, "Şu anda atlıyorum" de ve tekrar geri getir.`;
    } else if (processName === 'worry') {
        context += `[ENDIŞE KONTROLÜ — "Worry Time" TEKNİĞİ]\n`;
        context += `1️⃣ Endişe Saati Belirle: "Saat 14:00-14:15 endişe saatim"\n`;
        context += `2️⃣ Diğer Zamanlar: Endişe gelirse, "Endişe saatine kaydediyorum" de\n`;
        context += `3️⃣ Endişe Saatinde: Tüm korkularını yaz, hepsi yazıldıktan sonra DUR\n\n`;
        context += `Eğer endişe yine gelirse, yazıya referans ver ("Zaten yazdık bunu").`;
    } else {
        context += `Bilimsel yaklaşım: Düşünceler gözlemlenebilir olaylar. Sende kontrol yok, kabul etme yok.`;
    }

    return context;
}

/**
 * Üç seviyeli metakognitive müdahale
 * @returns {string}
 */
export function buildMetacognitionExercise() {
    let exercise = `[METAKOGNITIVE FIRSAT EGZERSIZI — 10 DAKİKA]\n\n`;

    exercise += `1️⃣ GÖZLEMLE (3 dakika)\n`;
    exercise += `Şu anki düşüncelerinizi izleyin, tıpkı gökyüzünde bulutları izleyen gibi.\n`;
    exercise += `  • "Düşünce geldi: X"\n`;
    exercise += `  • Ama sen bulutsun, düşünce de hava.\n`;
    exercise += `  • Sadece geçişine izin ver.\n\n`;

    exercise += `2️⃣ İSMİ KOY (3 dakika)\n`;
    exercise += `Düşüncenin türünü adlandır:\n`;
    exercise += `  • "Bu bir ruminasyon düşüncesi"\n`;
    exercise += `  • "Bu bir endişe düşüncesi"\n`;
    exercise += `  • Adlandırma = uzaklaşma (defusion).\n\n`;

    exercise += `3️⃣ AYRIŞT (4 dakika)\n`;
    exercise += `Düşünceden ayrıştır:\n`;
    exercise += `  • "Ben değilim düşünceler, gözlemciyim"\n`;
    exercise += `  • "Düşüncenin gerçek olması zorunlu değil"\n`;
    exercise += `  • Fiziksel hareket: El kaldır, ayağını salla — sen hareket ettiğini biliyorsun\n\n`;

    exercise += `→ Düşünceler otomatik, ama bilinçli farkındalık seçim yeterli.`;

    return exercise;
}

/**
 * Metakognitive tuzağı analiz et
 * @param {string} userMessage
 * @returns {{ isMetacognitiveTrap: boolean, depth: number, message: string }}
 */
export function analyzeMetacognitiveTrap(userMessage = '') {
    const text = userMessage.toLowerCase();
    const whyCount = (text.match(/neden|niçin|nasıl/g) || []).length;
    const thinkCount = (text.match(/düşün|hangisi|seçme|aklıma/g) || []).length;

    const depth = Math.min(whyCount + thinkCount, 5); // maksimum 5

    if (depth >= 3) {
        return {
            isMetacognitiveTrap: true,
            depth,
            message: `⚠️ Metakognitive Tuzak Seviye ${depth}: Düşüncenin içinde sıkışmışsın.

3 adımda çık:
1. DUR — Soruşturmayı kes
2. HAREKETİ GER — Fiziksel aktivite
3. KABULLENl — "Bunun cevabı olmayabilir ve sorun değil"`,
        };
    }

    return {
        isMetacognitiveTrap: false,
        depth,
        message: '',
    };
}
