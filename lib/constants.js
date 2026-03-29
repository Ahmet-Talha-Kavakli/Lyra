// lib/constants.js — Shared constants extracted from server.js

// ─── FEATURE FLAGS ─────────────────────────────────────────
export const FEATURE_FLAGS = {
    CROSS_SESSION_LINKS: true,
    TOPIC_DEPTH: true,
    PARALINGUISTIC: true,
    ROLEPLAY: true,
    CLINICAL_SCREENING: true,
    REFERRAL_PROTOCOL: true,
    SILENCE_MANAGEMENT: true,
    GUIDED_IMAGERY: true,
    CULTURAL_NUANCE: true,
    OBSERVATIONAL_EMPATHY: true,
    SESSION_PREP: true,
    CYCLE_DETECTION: true,
    VOICE_BASELINE: true,
    IFS: true,
    NARRATIVE_THERAPY: true,
};

// ─── GÖRSELLEŞTIRME SCRİPTLERİ ───────────────────────────
export const VISUALIZATION_SCRIPTS = {
    guvenli_yer: {
        sure: '5-7 dakika',
        tetikleyici: ['endişeli', 'korkmuş'],
        adimlar: [
            'Gözlerini yavaşça kapat. Omuzlarını düşür. Bir nefes al.',
            'Kendini tamamen güvende hissettiğin bir yeri hayal et. Gerçek ya da düşsel, fark etmez.',
            'O yerde ne görüyorsun? Renkleri, ışığı, etrafındaki şeyleri fark et.',
            'O yerde ne duyuyorsun? Sessizlik mi, doğa sesleri mi, müzik mi?',
            'O yerde nasıl hissediyorsun? O hissin vücudunda nerede oturduğunu fark et.',
            'Burada güvendesin. İstediğin zaman buraya dönebilirsin.',
            'Hazır olduğunda gözlerini yavaşça aç.'
        ]
    },
    nehir_seyri: {
        sure: '4-5 dakika',
        tetikleyici: ['bloke', 'donmus'],
        adimlar: [
            'Gözlerini kapat. Bir nehrin kıyısında oturduğunu hayal et.',
            'Nehir sakin akıyor. Sesi var, ama sert değil.',
            'Aklına gelen her düşünceyi bir yaprak gibi suya bırak. Gitmesine izin ver.',
            'Sen sadece izliyorsun. Yapraklar geliyor, gidiyor. Sen burada, güvendesin.',
            'Şu an sadece bu an var. Nehir akıyor, sen burada oturuyorsun.',
            'Hazır olduğunda derin bir nefes al ve gözlerini aç.'
        ]
    },
    ic_huzur: {
        sure: '5-6 dakika',
        tetikleyici: ['sinirli', 'öfkeli'],
        adimlar: [
            'Gözlerini kapat. Ellerini kucağına koy, avuçların yukarı baksın.',
            'Şu an ne hissediyorsan, onu reddetmene gerek yok. Sadece fark et.',
            'Dört say nefes al. Yedi say tut. Sekiz say ver. Birlikte.',
            'Bir kez daha. Dört, yedi, sekiz.',
            'O duygunun vücudunda nerede oturduğunu fark et. Ona biraz alan ver.',
            'Alan verilince, duygular geçer. Sen ondan büyüksün.',
            'Hazır olduğunda gözlerini aç.'
        ]
    },
    kaynak_arama: {
        sure: '6-7 dakika',
        tetikleyici: ['yorgun', 'tükenmiş'],
        adimlar: [
            'Gözlerini kapat. Sırtını dik tut ama rahat.',
            'Şu an yorgunluğun tam olarak nerede hissediyorsun? Omuzlarda mı, kafanda mı, göğsünde mi?',
            'O yere nazikçe nefes gönder. Çıkarken birlikte biraz yorgunluk da gitsin.',
            'Hayatında seni dolduran, güç veren bir şey var. Küçük de olur.',
            'O şeyi aklına getir. Bir renk, bir yer, bir insan, bir an.',
            'O hissin içinden sana bir enerji kaynağı gibi aktığını hayal et.',
            'Sen yorulabilirsin, ama tükenmiş değilsin. Kaynak hâlâ orada.',
            'Hazır olduğunda derin bir nefes al ve gözlerini aç.'
        ]
    }
};

// ─── KLİNİK TARAMA SABİTLERİ ─────────────────────────────
export const PHQ9_QUESTIONS = [
    { id: 'phq1', soru: 'Son iki haftada bir şeylerden zevk almakta ya da ilgi duymakta zorlandın mı?', tetikleyici: ['zevk almıyorum', 'ilgim kalmadı', 'hiçbir şey istemiyorum', 'keyif almıyorum'] },
    { id: 'phq2', soru: 'Son iki haftada kendini umutsuz, mutsuz ya da çaresiz hissettin mi?', tetikleyici: ['umutsuz', 'mutsuz', 'çaresiz', 'bunalım', 'sıkıntı'] },
    { id: 'phq3', soru: 'Son iki haftada uyumakta zorlandın mı ya da çok mu uyudun?', tetikleyici: ['uyuyamıyorum', 'çok uyuyorum', 'uyku sorunu', 'uykusuzluk', 'gece kalkıyorum'] },
    { id: 'phq4', soru: 'Son iki haftada kendin hakkında olumsuz düşünceler yaşadın mı?', tetikleyici: ['kendimi suçluyorum', 'değersizim', 'başarısızım', 'işe yaramaz'] },
    { id: 'phq5', soru: 'Son iki haftada konsantrasyon güçlüğü çekiyor musun?', tetikleyici: ['odaklanamıyorum', 'konsantre olamıyorum', 'dikkatim dağılıyor', 'düşünemiyorum'] },
];

export const GAD7_QUESTIONS = [
    { id: 'gad1', soru: 'Son iki haftada sinirli, gergin ya da gergin hissediyor musun?', tetikleyici: ['gerginim', 'sinirli', 'huzursuzum', 'rahat değilim'] },
    { id: 'gad2', soru: 'Son iki haftada endişelerini kontrol etmekte zorlanıyor musun?', tetikleyici: ['durduramıyorum', 'sürekli düşünüyorum', 'kafamı meşgul ediyor', 'endişe'] },
    { id: 'gad3', soru: 'Son iki haftada kötü bir şey olacakmış gibi hissediyor musun?', tetikleyici: ['kötü bir şey olacak', 'felaket', 'korku', 'kaygı', 'tehlike'] },
];

export const CLINICAL_SCREENING_INDICATORS = {
    PHQ9_QUESTIONS,
    GAD7_QUESTIONS,
};
