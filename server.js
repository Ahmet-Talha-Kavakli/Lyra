
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import multer from 'multer';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// ─── ROOT (Basit Hoşgeldin) ─────────────────────────
app.get('/', (req, res) => {
    res.send('<h1>Lyra Brain is Running 🌌</h1><p>Visit <a href="/ping">/ping</a> to check status.</p>');
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── DUYGU ANALİZİ YARDIMCILARI ─────────────────────────────
const yogunlukToNum = (y) => ({ 'düşük': 30, 'orta': 60, 'yüksek': 90 }[y] ?? 60);

const calculateTrend = (gecmis) => {
    if (gecmis.length < 3) return 'stabil';
    const son3 = gecmis.slice(-3).map(a => yogunlukToNum(a.yogunluk));
    const fark = son3[2] - son3[0];
    if (fark > 10) return 'kötüleşiyor';
    if (fark < -10) return 'iyileşiyor';
    return 'stabil';
};

const getAktifSinyaller = (jestler) => {
    if (!jestler) return [];
    const sinyaller = [];
    if (jestler.kas_catma === true)           sinyaller.push('kas_catma');
    if (jestler.gozyasi_izi === true)         sinyaller.push('gozyasi_izi');
    if (jestler.dudak_sikistirma === true)    sinyaller.push('dudak_sikistirma');
    if (jestler.bas_egme === true)            sinyaller.push('bas_egme');
    if (jestler.goz_temasi === 'düşük')       sinyaller.push('goz_temasi:düşük');
    if (jestler.omuz_durusu === 'düşük')      sinyaller.push('omuz_durusu:düşük');
    if (jestler.cene_gerginligi === 'yüksek') sinyaller.push('cene_gerginligi:yüksek');
    if (jestler.goz_kirpma_hizi === 'yavaş')  sinyaller.push('goz_kirpma_hizi:yavaş');
    return sinyaller;
};

const getDominantDuygu = (gecmis) => {
    if (!gecmis.length) return 'sakin';
    const sayac = {};
    gecmis.forEach(a => { sayac[a.duygu] = (sayac[a.duygu] || 0) + 1; });
    const maxSayi = Math.max(...Object.values(sayac));
    const adaylar = Object.keys(sayac).filter(d => sayac[d] === maxSayi);
    if (adaylar.length === 1) return adaylar[0];
    for (let i = gecmis.length - 1; i >= 0; i--) {
        if (adaylar.includes(gecmis[i].duygu)) return gecmis[i].duygu;
    }
    return adaylar[0];
};

// ─── SEANS İÇİ ÖRÜNTÜ YARDIMCILARI ──────────────────────
const KONU_GRUPLARI = {
    'aile': ['anne', 'baba', 'kardeş', 'aile', 'ebeveyn', 'çocuk', 'family', 'mother', 'father'],
    'iş': ['iş', 'patron', 'çalışma', 'işyeri', 'kariyer', 'meslek', 'müdür', 'work', 'job', 'boss'],
    'ilişki': ['sevgili', 'eş', 'partner', 'ilişki', 'ayrılık', 'yalnız', 'relationship', 'lonely'],
    'gelecek': ['gelecek', 'plan', 'kaygı', 'endişe', 'belirsiz', 'ne olacak', 'future', 'anxious'],
    'geçmiş': ['geçmiş', 'eskiden', 'çocukken', 'hatıra', 'travma', 'past', 'trauma', 'childhood'],
    'beden': ['uyku', 'yeme', 'ağrı', 'yorgunluk', 'hastalık', 'beden', 'sleep', 'tired', 'pain'],
};

const trackSessionTopics = (transcript) => {
    if (!transcript) return {};
    const lower = transcript.toLowerCase();
    const counts = {};
    for (const [konu, kelimeler] of Object.entries(KONU_GRUPLARI)) {
        counts[konu] = kelimeler.filter(k => lower.includes(k)).length;
    }
    return counts;
};

const detectAvoidance = (transcript) => {
    if (!transcript) return [];
    const lower = transcript.toLowerCase();
    const sinyaller = [];
    const konuDegistirme = ['neyse', 'geçelim', 'başka bir şey', 'farklı bir konu', 'bırakalım', 'anyway', "let's move on"];
    if (konuDegistirme.some(k => lower.includes(k))) sinyaller.push('konu_degistirme');
    const kucumseme = ['önemli değil', 'abartmıyorum', 'saçma', 'gülünç', 'ne fark eder', "doesn't matter", 'not important'];
    if (kucumseme.some(k => lower.includes(k))) sinyaller.push('kucumseme');
    const savunma = ['ama şu var ki', 'aslında', 'anlayamazsın', 'you wouldn\'t understand', 'but actually'];
    if (savunma.some(k => lower.includes(k))) sinyaller.push('savunma');
    return sinyaller;
};

// ─── KURAL MOTORU ─────────────────────────────────────────
// L4: Söz-Yüz Çelişkisi
const OLUMLU_KELIMELER = ['iyiyim', 'iyi', 'tamam', 'sorun yok', 'normalim', 'mutluyum', 'güzel', 'harika', 'fena değil', "i'm fine", 'fine', 'okay', 'good'];
const OLUMSUZ_KAMERA_DUYGULAR = ['üzgün', 'endişeli', 'korkmuş', 'sinirli', 'yorgun'];

const buildLayer4Rules = (lastSegment, sonAnaliz) => {
    if (!lastSegment || !sonAnaliz || !sonAnaliz.yuz_var) return '';
    const kurallar = [];
    const segLower = lastSegment.toLowerCase();

    const sozluOlumlu = OLUMLU_KELIMELER.some(k => segLower.includes(k));
    const kameraOlumsuz = OLUMSUZ_KAMERA_DUYGULAR.includes(sonAnaliz.duygu) &&
        ['orta', 'yüksek'].includes(sonAnaliz.yogunluk);

    if (sozluOlumlu && kameraOlumsuz && sonAnaliz.guven > 65)
        kurallar.push(`Kullanıcı olumlu kelimeler söylüyor ama yüzü "${sonAnaliz.duygu}" ifadesi gösteriyor. Nazikçe sorgula: "Bunu söylerken sesin biraz farklıydı, gerçekten nasılsın?"`);

    if (sozluOlumlu && sonAnaliz.genel_vucut_dili === 'kapalı' && sonAnaliz.jestler?.goz_temasi === 'düşük')
        kurallar.push('Kullanıcı olumlu konuşuyor ama beden dili kapalı ve göz teması düşük. "Biraz daha anlatır mısın bunu?" diye sor.');

    if (sonAnaliz.yogunluk === 'yüksek' && (segLower.includes('önemli değil') || segLower.includes('saçma') || segLower.includes("doesn't matter")))
        kurallar.push('Kullanıcı yüksek duygusal yoğunlukta ama durumu önemsiz gösteriyor. "Bu duygu gerçek ve önemli" mesajını ver.');

    return kurallar.join(' ');
};

// L5: Sessizlik & Ritim
const buildLayer5Rules = (silenceDuration, sessizlikTipi) => {
    if (!silenceDuration || silenceDuration < 8) return '';
    if (sessizlikTipi === 'donmus')
        return 'Kullanıcı donmuş/bloke bir sessizlikte. "Şu an kelimeler gelmiyorsa, o da tamam. Seninleyim." de, hiç baskı yapma.';
    if (sessizlikTipi === 'dusunceli' && silenceDuration < 20)
        return 'Kullanıcı düşünüyor gibi görünüyor — rahat bir sessizlik. Bozma, sabırla bekle.';
    if (silenceDuration >= 25)
        return 'Çok uzun sessizlik. Nazikçe sor: "Şu an ne hissediyorsun, söylemek zor mu?"';
    if (silenceDuration >= 8)
        return 'Kullanıcı sessiz. "Hazır olduğunda devam edebiliriz, acele yok." de.';
    return '';
};

// L6: Seanslar Arası Pattern
const buildLayer6Rules = (patternMemory, sonAnaliz, dominantDuygu) => {
    if (!patternMemory || !sonAnaliz) return '';
    const kurallar = [];

    const trendi = patternMemory.seans_trendi || [];
    if (trendi.length >= 3) {
        const son3 = trendi.slice(-3);
        if (son3.every(t => t === 'kötüleşiyor'))
            kurallar.push('Kullanıcı son 3 seanstır kötüleşiyor. Bu trendi nazikçe paylaş: "Birkaç süredir zor bir dönemdesin, fark ediyor musun?"');
        if (son3[son3.length - 1] === 'iyileşiyor' && son3[0] === 'kötüleşiyor')
            kurallar.push('Kullanıcı kötü bir dönemden iyileşmeye başlıyor. Bu ilerlemeyi kutla.');
    }

    const dominantKonu = Object.entries(patternMemory.konular || {})
        .sort(([, a], [, b]) => b.frekans - a.frekans)[0];
    if (dominantKonu && dominantKonu[1].frekans >= 3)
        kurallar.push(`Kullanıcı daha önce de "${dominantKonu[0]}" konusunu sık konuşmuş. Bu konuya duyarlı yaklaş.`);

    const basarili = patternMemory.basarili_mudahaleler || [];
    if (basarili.includes('nefes') && sonAnaliz.yogunluk === 'yüksek')
        kurallar.push('Geçmişte nefes egzersizi bu kullanıcıya yaramış. Yüksek yoğunlukta nefes tekniği öner.');

    // TETİKLEYİCİ HARİTA
    const tetKonular = patternMemory.tetikleyici_konular || {};
    const yuksekHitKonu = Object.entries(tetKonular).sort(([,a],[,b]) => b.hit - a.hit)[0];
    if (yuksekHitKonu && yuksekHitKonu[1].hit >= 3)
        kurallar.push(`"${yuksekHitKonu[0]}" konusu bu kullanıcı için her açıldığında zorlanıyor (${yuksekHitKonu[1].hit} seans). Bu konuda özellikle yavaş, nazik ve dikkatli ol.`);

    // İLERLEME ZAMAN ÇİZELGESİ
    const sessionHistory = patternMemory.session_history || [];
    if (sessionHistory.length >= 3) {
        const ilkTarih = new Date(sessionHistory[0].tarih);
        const gunFarki = Math.round((Date.now() - ilkTarih) / (1000*60*60*24));
        if (gunFarki >= 14 && trendi.slice(-2).every(t => t !== 'kötüleşiyor'))
            kurallar.push(`Kullanıcı ${gunFarki} gündür Lyra ile çalışıyor ve genel seyir iyi. Bunu fark et: "Son haftalarda gerçekten bir şeyler değişiyor, görüyorum."`);
    }

    return kurallar.join(' ');
};

// L7: Seans Momentum & Adaptasyon
const buildLayer7Rules = (userProfile, sonAnaliz, gecmis, transcriptData) => {
    if (!sonAnaliz) return '';
    const kurallar = [];

    // Günlük kapasite hesapla
    const ilkYogunluk = gecmis?.[0]?.yogunluk;
    const sonYogunluk = sonAnaliz.yogunluk;
    const dusukKapasite = ilkYogunluk === 'yüksek' || sonYogunluk === 'yüksek';

    if (dusukKapasite && gecmis?.length <= 3)
        kurallar.push('Kullanıcı bugün zor bir günde görünüyor. Ağır konulara girme, hafif ve destekleyici kal.');

    // Profil bazlı adaptasyon
    if (userProfile?.soru_toleransi === 'düşük')
        kurallar.push('Bu kullanıcı çok soru sormaktan rahatsız oluyor. Maksimum 1 soru sor, sonra bekle.');

    if (userProfile?.iletisim_tarzi === 'kapalı')
        kurallar.push('Bu kullanıcı kapalı iletişim tarzına sahip. Zorlamadan, nazikçe açılmasını bekle.');

    if (userProfile?.sessizlik_konforu === true)
        kurallar.push('Bu kullanıcı sessizliğe alışkın — 15 saniyeye kadar bekleyebilirsin, doldurmak zorunda değilsin.');

    // Tetikleyici konu tespiti
    const tetikleyiciler = userProfile?.tetikleyiciler || [];
    const transcript = transcriptData?.fullTranscript?.toLowerCase() || '';
    const aktifTetikleyici = tetikleyiciler.find(t => transcript.includes(t));
    if (aktifTetikleyici)
        kurallar.push(`"${aktifTetikleyici}" bu kullanıcı için bilinen bir tetikleyici. Bu konuda özellikle yavaş ve dikkatli ol.`);

    // DUYGU GEÇİŞ HIZI — duygusal labilite tespiti
    if (gecmis && gecmis.length >= 8) {
        const son8 = gecmis.slice(-8);
        const benzersizDuygular = new Set(son8.map(a => a.duygu)).size;
        if (benzersizDuygular >= 5)
            kurallar.push('Kullanıcı son birkaç dakikada çok hızlı duygu değiştiriyor (duygusal labilite sinyali). Stabilizasyon moduna geç: zemine in, nefes ver, yavaşlat. Soru sorma.');
    }

    return kurallar.join(' ');
};

const buildLayer1Rules = (sonAnaliz, aktifSinyaller, userId) => {
    if (!sonAnaliz || !sonAnaliz.yuz_var) return '';
    const kurallar = [];
    const { duygu, yogunluk, enerji, jestler, guven, ortam, gorunum_ozeti } = sonAnaliz;

    // ── TEHLİKE & ZARAR PROTOKOLÜ (en yüksek öncelik) ─────
    if (ortam?.tehlike_var === true) {
        const nesne = ortam.tehlikeli_nesne || 'tehlikeli nesne';
        kurallar.push(`KRİZ PROTOKOLÜ: Kullanıcının elinde/yakınında "${nesne}" tespit edildi. Hemen nazikçe sor: "Şu an elinde bir şey var, iyi misin?" Sakin kal, yargılama, güvenliğini önce sorgula.`);
        // Kriz log kaydet — fire and forget
        if (userId) supabase.from('memories').upsert({ user_id: userId, kriz_log: { tarih: new Date().toISOString(), tip: 'tehlikeli_nesne', nesne }, updated_at: new Date().toISOString() }).then(()=>{}).catch(()=>{});
    }

    if (ortam?.zarar_sinyali === true) {
        if (yogunluk === 'yüksek')
            kurallar.push('KRİZ: Kullanıcı kendine zarar veriyor olabilir. Hemen: "Şu an kendine iyi davranıyor musun? Seninle buradayım." Sakin kal, suçlama yapma, güvenli alan yarat.');
        else
            kurallar.push('Kullanıcının hareketi dikkat çekici. Nazikçe sor: "Şu an kendine iyi bakıyor musun?" — baskı yapma, sadece fark ettiğini göster.');
        // Kriz log kaydet
        if (userId) supabase.from('memories').upsert({ user_id: userId, kriz_log: { tarih: new Date().toISOString(), tip: 'zarar_sinyali' }, updated_at: new Date().toISOString() }).then(()=>{}).catch(()=>{});
    }

    // ── ORTAM OLAYI ────────────────────────────────────────
    if (ortam?.arkaplan_kisi === true && ortam?.ani_degisim === true)
        kurallar.push('Arka planda biri var veya yeni geldi ve kullanıcının yüzü ani değişti. Nazikçe sor: "Az önce bir şey mi oldu? Yüzün birden değişti."');

    if (ortam?.ortam_gerilimi === 'var' && ortam?.ani_degisim === true)
        kurallar.push('Ortamda gerilim var ve kullanıcı etkilendi. "Şu an bulunduğun ortam güvenli mi?" diye sor.');

    // ── GÖRME FARKINDALĞI — Lyra görebildiğini bilsin ──────
    if (gorunum_ozeti && guven > 70) {
        kurallar.push(`Kullanıcının görünümü: "${gorunum_ozeti}". Kullanıcı sana "beni görüyor musun", "nasıl görünüyorum", "mutlu muyum" gibi bir şey sorarsa bu bilgiyi kullanarak doğal şekilde cevap ver. Asla "göremiyorum" deme.`);
    }

    // ── DUYGU KURALLARI ─────────────────────────────────────
    if (duygu === 'korkmuş' && guven > 80 && jestler?.gozyasi_izi === true)
        kurallar.push('Kullanıcı korkmuş ve gözyaşı izi var. Önce güven ver, hiç soru sorma. Sessiz, kısa, destekleyici cümleler kur.');

    if (duygu === 'sinirli' || duygu === 'iğnelenmiş' || duygu === 'küçümseyen')
        kurallar.push(`Kullanıcı sinirli/rahatsız görünüyor (guven: ${guven}). Önce duyguyu doğrula: "Seni bir şey rahatsız ediyor gibi, söylemek ister misin?" — çözüm önerme, tavsiye verme.`);

    if (duygu === 'sinirli' && jestler?.cene_gerginligi === 'yüksek')
        kurallar.push('Yüksek çene gerginliği — ciddi öfke sinyali. Sakin kal, yavaş konuş, zemine in.');

    if (duygu === 'yorgun' && jestler?.goz_kirpma_hizi === 'yavaş' && enerji === 'yorgun')
        kurallar.push('Kullanıcı çok yorgun. Seansı kısalt, enerjik sorular sorma.');

    if (duygu === 'üzgün' && jestler?.genel_vucut_dili === 'kapalı')
        kurallar.push('Kullanıcı üzgün ve kapalı beden dili. Daha az soru, daha çok yansıtma ve empati.');

    if (jestler?.gozyasi_izi === true)
        kurallar.push('Gözyaşı izi tespit edildi. Çok dikkatli ol, sessizlik ver, yargılama.');

    if (yogunluk === 'yüksek' && jestler?.kas_catma === true)
        kurallar.push('Yüksek yoğunluk ve kaş çatma. Yavaş konuş, kısa cümleler kur.');

    // ── MİKRO İFADE ─────────────────────────────────────────
    const mikro = sonAnaliz.mikro_duygu;
    if (mikro && mikro !== 'yok') {
        const mikroMap = {
            'gizli_öfke':    'Kullanıcı yüzünde anlık öfke sinyali var ama bunu gizliyor. "Seni gerçekten ne rahatsız etti?" diye sor.',
            'gizli_üzüntü':  'Kullanıcı gülümsüyor ama gizli bir üzüntü var. "Gerçekten nasılsın, içten söyle?" diye sor.',
            'gizli_korku':   'Kullanıcıda gizli korku var. Güven ver, yargılama, "Burada güvendesin" de.',
            'gizli_tiksinme':'Kullanıcı bir konudan/kişiden tiksinme hissediyor ama söylemek istemiyor. Nazikçe aç.'
        };
        if (mikroMap[mikro]) kurallar.push(mikroMap[mikro]);
    }

    // ── NEFES & TİTREME ─────────────────────────────────────
    if (jestler?.nefes_hizi === 'hızlı' || jestler?.nefes_hizi === 'yüzeysel')
        kurallar.push('Nefes hızlanmış/yüzeysel — kaygı artıyor. 4-7-8 nefes tekniği öner: "Birlikte nefes alalım mı?"');

    if (jestler?.nefes_hizi === 'tutuyor')
        kurallar.push('Kullanıcı nefesini tutuyor — yüksek stres veya şok. "Bir nefes al" de, hemen yavaşlat.');

    if (jestler?.el_titreme === true)
        kurallar.push('El titremesi var — yüksek kaygı veya korku. Zemine in, güvenli alan yarat, soru sormayı bırak.');

    // ── GÖZ YASI BİRİKİMİ ───────────────────────────────────
    if (jestler?.goz_yasi_birikimi === 'başlıyor')
        kurallar.push('Göz yaşı birikiyor ama henüz akmadı. Sessiz kal, alan tanı. "Buradayım" de, devam etmesini zorlamaz.');

    if (jestler?.goz_yasi_birikimi === 'belirgin')
        kurallar.push('Belirgin göz yaşı birikimi — ağlamak üzere. Hiç soru sorma, sadece "Seninle buradayım, devam et" de.');

    // ── AĞLAMA TESPİTİ ──────────────────────────────────────
    const aglayorMu = jestler?.goz_yasi_birikimi === 'belirgin' ||
        (jestler?.goz_yasi_birikimi === 'başlıyor' && jestler?.gozyasi_izi === true);
    if (aglayorMu)
        kurallar.push('Kullanıcı ağlıyor veya ağlamak üzere. Hiç soru sorma. Sadece kısa "Buradayım, devam et." de ve sessizlik ver.');

    // ── YORGUNLUK & UYKU ────────────────────────────────────
    if (jestler?.goz_kapagi_agirlik === 'belirgin_agir' && enerji === 'yorgun')
        kurallar.push('Kullanıcı çok yorgun — göz kapakları belirgin şekilde düşük. "Bugün çok yorgun görünüyorsun, hafif konuşalım" de, ağır konulara girme.');
    if (jestler?.goz_kapagi_agirlik === 'hafif_agir' && yogunluk !== 'yüksek')
        kurallar.push('Kullanıcı yorgun ama konuşabilir durumda. Enerji gerektiren egzersizler verme, tempo düşük tut.');

    // ── NEFES EGZERSİZİ MODU ────────────────────────────────
    const nefesGerekli = (duygu === 'endişeli' || duygu === 'korkmuş') &&
        yogunluk === 'yüksek' &&
        (jestler?.nefes_hizi === 'hızlı' || jestler?.nefes_hizi === 'yüzeysel');
    if (nefesGerekli)
        kurallar.push('NEFES_EGZERSIZI_BASLAT: Kullanıcı yüksek kaygıda, nefesi hızlanmış. Hemen 4-7-8 nefes tekniği uygulat: "Seninle birlikte nefes alalım mı? 4 say nefes al, 7 say tut, 8 say ver."');

    // ── NESNE FARKINDALĞI ───────────────────────────────────
    if (ortam?.nesneler?.length > 0 && !ortam.tehlike_var) {
        const ilginc = ortam.nesneler.filter(n => !['bardak', 'telefon', 'masa', 'sandalye', 'koltuk'].includes(n.toLowerCase()));
        if (ilginc.length > 0)
            kurallar.push(`Kullanıcının elinde/yakınında şunlar görünüyor: ${ilginc.join(', ')}. Eğer konuşmayla bağlantılıysa doğal şekilde değinebilirsin.`);
    }

    return kurallar.join(' ');
};

const buildLayer2Rules = (trend, dominantDuygu, gecmis, transcriptData) => {
    if (!gecmis || gecmis.length < 2) return '';
    const kurallar = [];

    if (trend === 'kötüleşiyor' && dominantDuygu === 'endişeli')
        kurallar.push('Kullanıcının endişe seviyesi artıyor. Tempo düşür, kısa cümleler kur, uygun yerlerde sessizlik bırak.');

    if (trend === 'iyileşiyor')
        kurallar.push('Kullanıcı sakinleşiyor. Bu ilerlemeyi nazikçe yansıt, zorlamadan teşvik et.');

    // ── SES ZEKASI KURALLARI ────────────────────────────────
    if (transcriptData) {
        const { sesTitreme, sesYogunlukOrt, tempoTrend, konusmaTempo, hume_scores } = transcriptData;

        if (sesTitreme && (dominantDuygu === 'üzgün' || dominantDuygu === 'korkmuş'))
            kurallar.push('Kullanıcının sesi titriyor ve duygusal. "Sesin biraz titriyor,괜찮아mısın?" diyebilirsin. Ağlamak üzere olabilir, nazik ol.');

        if (sesTitreme && dominantDuygu === 'sinirli')
            kurallar.push('Ses titremesi + sinirli = öfke kontrolünü zorlanıyor. Sakin ve yavaş konuş, ses tonunu düşür.');

        if (tempoTrend === 'azalıyor' && konusmaTempo < 1.5)
            kurallar.push('Konuşma hızı giderek azalıyor — enerji düşüyor veya kapanıyor. Enerjik sorular sorma, hafif kal.');

        if (sesYogunlukOrt > 0.7 && dominantDuygu === 'sinirli')
            kurallar.push('Yüksek ses şiddeti + sinirli = öfke dorukta. Sesin tonunu düşür, kısa cümleler kur, zemine in.');

        if (tempoTrend === 'artıyor' && konusmaTempo > 3)
            kurallar.push('Kullanıcı çok hızlı konuşuyor — kaygı veya acelesi var. Nazikçe yavaşlat: "Bir nefes alalım mı?"');

        if (transcriptData.sesMonotonluk && (dominantDuygu === 'üzgün' || dominantDuygu === 'yorgun'))
            kurallar.push('Kullanıcının sesi monoton ve düz — içinde ağırlık/boşluk sinyali. "Sesin çok düz, içinde bir ağırlık var gibi hissediyorum" diyebilirsin. Depresyon sinyali olabilir, dikkatli ol.');

        // ── HUME AI PROSODY INJECT ──
        if (hume_scores && hume_scores.top_emotions) {
            const { dominant, valence, arousal, top_emotions } = hume_scores;

            // Valence çelişkisi: yüz olumsuz gösteriyor ama ses pozitif
            if (valence > 0.3 && ['üzgün', 'korkmuş', 'endişeli', 'sinirli'].includes(dominantDuygu))
                kurallar.push(`[HUME SES ÇELIŞKÜ] Ses analizi pozitif enerji gösteriyor (valence:${valence}) ama yüz "${dominantDuygu}". Duygusunu gizliyor olabilir. "Sesin bana positif enerji gösteriyor ama yüzün farklı duruyor, gerçekten iyimisin?"`);

            // Arousal çelişkisi: yüz sakin gösteriyor ama ses enerjik
            if (arousal > 0.4 && ['sakin', 'yorgun'].includes(dominantDuygu))
                kurallar.push(`[HUME SES ENERJI] Ses enerjisi yüksek (arousal:${arousal}) ama yüz ${dominantDuygu}. Baskılanmış enerji olabilir. "Sende bir enerji var ama bunu söylemekte zorlanıyor gibisin."`);

            // Top duygu-spesifik eğitim
            const HUME_EMOTION_GUIDE = {
                'Sadness': 'Seste derin üzüntü belirlendi. Tempo düşür, destekleyici kal. Çözüm önerme, dinle.',
                'Fear': 'Seste korku/kaygı. "Burada güvendesin. Yavaşça anlat" de, sakinleştir.',
                'Anger': 'Seste öfke. Öfkenin sebebini anlama, zemine in. Uzlaşmacı ol.',
                'Anxiety': 'Seste kaygı/gerilim. Tempo düşür, nefes egzersizi öner, sakinleştir.',
                'Shame': 'Seste utanç/mahcubiyet. "Bu hissi taşımak zor" de, yargılama.',
                'Guilt': 'Seste suçluluk. "Kendini suçlamak yerine ne olduğuna bakalım" de.',
                'Calmness': 'Ses rahat ve sakin. Derin/önemli konulara girebilirsin, kullanıcı hazır.',
                'Distress': 'Seste yoğun sıkıntı. Kısa cümleler kur, aceleyle gitme.',
                'Neutral': 'Ses nötr/kontrollü. Duygusunu aydınlatmak için açık sorular sor.',
                'Contentment': 'Ses memnun/tatmin. İlerlemeyi fark et ve küçük ama samimi bir şekilde kutla.'
            };

            if (top_emotions.length > 0 && HUME_EMOTION_GUIDE[top_emotions[0].name]) {
                kurallar.push(`[HUME — ${top_emotions[0].name} %${Math.round(top_emotions[0].score * 100)}]: ${HUME_EMOTION_GUIDE[top_emotions[0].name]}`);
            }
        }
    }

    const son5 = gecmis.slice(-5);
    const hepsiYogun = son5.length === 5 && son5.every(a => a.yogunluk === 'yüksek' || a.yogunluk === 'orta');
    if (hepsiYogun)
        kurallar.push(`Kullanıcı uzun süredir ${dominantDuygu} hissediyor. Bu duyguyu doğrudan nazikçe ele almayı düşün.`);

    const yogunlukOrt = gecmis.reduce((s, a) => s + yogunlukToNum(a.yogunluk), 0) / gecmis.length;
    if (yogunlukOrt > 75 && gecmis.length >= 5)
        kurallar.push('Kullanıcı bu seans boyunca yüksek duygusal yoğunlukta. Sabırlı ve yavaş ol.');

    // #5 — EMPATİ KALİTESİ SKORU
    // Olumsuz duygu + ard arda 3+ = yeterli empati gösterilmemiş olabilir
    if (gecmis.length >= 4) {
        const sonDortNegatif = gecmis.slice(-4).filter(a =>
            ['üzgün', 'korkmuş', 'sinirli', 'endişeli', 'yorgun'].includes(a.duygu) &&
            (a.yogunluk === 'yüksek' || a.yogunluk === 'orta')
        );
        if (sonDortNegatif.length >= 3)
            kurallar.push('EMPATİ UYARISI: Kullanıcı uzun süredir olumsuz duygular yaşıyor ve henüz rahatlamıyor. Terapötik teknik kullanmayı bırak — sadece "Bunu yaşamak çok zor olmalı" gibi basit, içten bir empati cümlesi kur. Sonra sessiz kal.');
    }

    return kurallar.join(' ');
};

const buildLayer3Rules = (hafizaMetni, sonAnaliz, userId) => {
    const kurallar = [];

    // Hafıza bazlı kurallar
    if (hafizaMetni) {
        const lower = hafizaMetni.toLowerCase();
        if ((lower.includes('üzgün') || lower.includes('uzgun')) &&
            (lower.includes('seans') || lower.includes('hafta') || lower.includes('süre')))
            kurallar.push('Hafızaya göre kullanıcı bir süredir üzgün. Bu tekrarlayan durumu nazikçe gündeme getirmeyi düşün.');
        if (lower.includes('iyileş') || lower.includes('daha iyi') || lower.includes('güzel geçt'))
            kurallar.push('Önceki seanslarda iyileşme kaydedilmiş. Bu ilerlemeyi fark et ve kutla.');
        if (sonAnaliz?.yogunluk === 'yüksek' && sonAnaliz?.guven > 80 &&
            !lower.includes('yoğun') && !lower.includes('kriz'))
            kurallar.push('Bu seansta ilk kez yüksek yoğunluk görülüyor. Daha dikkatli yaklaş, acele etme.');
    }

    // Seans içi örüntü
    const transcriptData = userId ? sessionTranscriptStore.get(userId) : null;
    if (transcriptData?.fullTranscript) {
        const konular = trackSessionTopics(transcriptData.fullTranscript);
        const tekrarlayan = Object.entries(konular).filter(([, v]) => v >= 2).map(([k]) => k);
        if (tekrarlayan.length > 0)
            kurallar.push(`Bu seansta "${tekrarlayan.join(', ')}" konusuna defalarca döndünüz. Burada önemli bir şey olabilir, nazikçe derinleş.`);

        const kacınma = detectAvoidance(transcriptData.fullTranscript);
        if (kacınma.includes('konu_degistirme'))
            kurallar.push('Kullanıcı az önce konuyu değiştirdi. Nazikçe önceki konuya geri dön: "Az önce farklı bir şeyden bahsediyorduk, oraya dönebilir miyiz?"');
        if (kacınma.includes('kucumseme'))
            kurallar.push('Kullanıcı yaşadığını küçümsüyor. Nazikçe önem ver: "Bunu küçümsüyor olsan da, hissetmen önemli."');
        if (kacınma.includes('savunma'))
            kurallar.push('Kullanıcı savunmaya geçti. Baskı yapma, güvenli alan yarat, yavaşla.');

        // KONUŞMA DENGESİ — Lyra çok fazla konuşuyorsa uyar
        const satirlar = transcriptData.fullTranscript.split('\n').filter(Boolean);
        const assistantSatir = satirlar.filter(s => s.startsWith('assistant:')).length;
        const userSatir = satirlar.filter(s => s.startsWith('user:')).length;
        const toplamSatir = assistantSatir + userSatir;
        if (toplamSatir > 8 && assistantSatir / toplamSatir > 0.33)
            kurallar.push('DİKKAT: Bu seansta çok fazla konuşuyorsun. Şimdi kısa cevap ver veya sadece soru sor, kullanıcıyı konuştur.');

        // ABSOLüT KELİMELER — bilişsel çarpıtma tespiti
        const absKelimeler = ['asla', 'hep böyle', 'her zaman böyle', 'hiç kimse', 'kimse beni', 'hiçbir zaman', 'tamamen mahvoldum', 'hiçbir şey işe yaramıyor', 'her şey berbat'];
        const lastSeg = (transcriptData.lastSegment || '').toLowerCase();
        const absHit = absKelimeler.find(k => lastSeg.includes(k));
        if (absHit && sonAnaliz?.yogunluk && sonAnaliz.yogunluk !== 'düşük')
            kurallar.push(`Kullanıcı "${absHit}" gibi absolüt bir ifade kullandı — bilişsel çarpıtma sinyali. Nazikçe sorgula: "Az önce '${absHit}' dedin — gerçekten hiç mi, hiçbir zaman mı?"`);

        // #3 — KELIME TEKRAR TESPİTİ
        const tekrarlar = detectWordRepetition(transcriptData.fullTranscript);
        if (tekrarlar.length > 0) {
            const [kelime, sayi] = tekrarlar[0];
            kurallar.push(`Kullanıcı "${kelime}" kelimesini bu seansta ${sayi} kez kullandı — takıntı noktası olabilir. Nazikçe derinleş: "Bu konuya birkaç kez döndün, sana ne hissettiriyor?"`);
        }

        // #6 — RÜYA & METAFOR ANALİZİ
        const { ruya, metafor, icerik } = detectDreamMetaphor(transcriptData.fullTranscript);
        if (ruya)
            kurallar.push(`Kullanıcı rüyasından bahsetti. Bu sembolü derinleştir: "Bu rüya sana ne anlatıyor? Uyandığında nasıl hissettin?" Direkt yorum yapma, kullanıcıya bırak.`);
        else if (metafor && icerik)
            kurallar.push(`Kullanıcı metaforik dil kullanıyor ("${icerik}"). Bu metaforu genişlet: "Bunu biraz daha açar mısın, bu benzetme çok ilginç." Sembolü derinleştir.`);

        // #8 — ÇOCUKLUK TETİKLEYİCİ
        if (detectChildhoodTrigger(transcriptData.fullTranscript, sonAnaliz?.yogunluk))
            kurallar.push('Kullanıcı çocukluk/aile referansları veriyor ve duygusal yoğunluk yüksek — travma bölgesi sinyali. Çok yavaş ve nazik ol, zorlamadan dinle. "Bunu anlatmak zor olabilir, ne kadar paylaşmak istersen." de.');

        // #10 — BAĞIMLILIK DİLİ
        const bagimlilik = detectDependencyLanguage(transcriptData.lastSegment);
        if (bagimlilik && sonAnaliz?.yogunluk !== 'düşük')
            kurallar.push(`Kullanıcı bilişsel çaresizlik/bağımlılık dili kullandı ("${bagimlilik}"). Nazikçe sorgulat: "Gerçekten başka hiç yol yok mu? Bunu birlikte düşünelim." Çözüm önerme, soruyla açılmasını sağla.`);

        // #2 — KONUŞMA RİTMİ
        if (transcriptData.konusmaTempo > 4.5)
            kurallar.push('Kullanıcı çok hızlı konuşuyor — panik/kaygı sinyali. Nazikçe yavaşlat: "Seninle birlikte nefes alalım mı, biraz yavaşlayalım."');
        else if (transcriptData.konusmaTempo > 0 && transcriptData.konusmaTempo < 0.8)
            kurallar.push('Konuşma ritmi çok yavaşladı — enerji çöküşü veya depresif dönem sinyali. Enerjik sorular sorma, hafif ve destekleyici kal.');
    }

    return kurallar.join(' ');
};

// ─── AES-256-GCM ŞİFRELEME ────────────────────────────────
const ENC_KEY = process.env.ENCRYPTION_KEY
    ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
    : crypto.randomBytes(32); // fallback: her restart'ta yeni key (prod'da env ekle)

const encryptField = (text) => {
    if (!text) return text;
    try {
        const iv  = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
        const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `ENC:${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
    } catch { return text; }
};

const decryptField = (text) => {
    if (!text || !String(text).startsWith('ENC:')) return text;
    try {
        const [, ivHex, encHex, tagHex] = String(text).split(':');
        const iv  = Buffer.from(ivHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch { return text; }
};

// ─── ERROR LOGLAMA ─────────────────────────────────────────
const logError = async (endpoint, errorMessage, userId = null) => {
    try {
        await supabase.from('error_logs').insert({
            user_id: userId,
            endpoint,
            error_message: errorMessage,
            timestamp: new Date().toISOString()
        });
    } catch { /* loglama başarısız olsa da devam et */ }
};

// ─── YENİ KURAL MOTORU FONKSİYONLARI ──────────────────────

// Kelime tekrar tespiti
const detectWordRepetition = (transcript) => {
    if (!transcript) return [];
    const stopWords = new Set(['ve', 'ama', 'için', 'bir', 'bu', 'da', 'de', 'ki', 'ile', 'ben', 'sen', 'o', 'biz', 'siz', 'ne', 'var', 'yok', 'mi', 'mı', 'çok', 'daha', 'gibi', 'ya', 'şey', 'şu', 'nasıl', 'çünkü', 'ise', 'bile', 'hem', 'veya']);
    const userLines = transcript.split('\n').filter(l => l.startsWith('user:')).join(' ').replace(/user:/g, '');
    const kelimeler = userLines.toLowerCase().replace(/[^a-zçğıöşüa-z\s]/gi, '').split(/\s+/).filter(k => k.length > 3 && !stopWords.has(k));
    const sayac = {};
    kelimeler.forEach(k => { sayac[k] = (sayac[k] || 0) + 1; });
    return Object.entries(sayac).filter(([, s]) => s >= 3).sort(([, a], [, b]) => b - a).slice(0, 3);
};

// Rüya & Metafor tespiti
const detectDreamMetaphor = (transcript) => {
    if (!transcript) return { ruya: false, metafor: false, icerik: '' };
    const lower = transcript.toLowerCase();
    const ruyaKelimeler = ['rüyamda', 'rüya gördüm', 'düşümde', 'nightmare', 'kâbusumda', 'hayalimde'];
    const metaforKelimeler = ['sanki bir', 'gibi hissediyorum', 'adeta', 'tam olarak şuna benziyor', 'benim için bu şu anlama'];
    const ruya = ruyaKelimeler.some(k => lower.includes(k));
    const metafor = metaforKelimeler.some(k => lower.includes(k));
    const hit = [...ruyaKelimeler, ...metaforKelimeler].find(k => lower.includes(k)) || '';
    return { ruya, metafor, icerik: hit };
};

// Çocukluk tetikleyici tespiti
const detectChildhoodTrigger = (transcript, yogunluk) => {
    if (!transcript || yogunluk === 'düşük') return false;
    const lower = transcript.toLowerCase();
    const tetikler = ['çocukken', 'küçükken', 'çocukluğumda', 'annem', 'babam', 'okul yılları', 'ilkokulda', 'ortaokulda', 'lisede', 'çocukluğumda', 'büyürken'];
    const hitler = tetikler.filter(k => lower.includes(k));
    return hitler.length >= 2;
};

// Bağımlılık dili tespiti
const detectDependencyLanguage = (segment) => {
    if (!segment) return null;
    const lower = segment.toLowerCase();
    const kaliplar = ['yapamam', 'yapamıyorum', 'zorundayım', 'mecburum', 'başka seçeneğim yok', 'kaçış yok', 'çaresizim', 'elimde değil', 'her zaman böyle olacak', 'hiçbir zaman değişmeyecek'];
    return kaliplar.find(k => lower.includes(k)) || null;
};

// --- DUYGU DURUMU TAKİBİ ---
const userEmotions = new Map(); // userId -> { gecmis, trend, dominant_duygu, ... }

// --- SEANS TRANSCRIPT STORE ---
const sessionTranscriptStore = new Map();
// userId → { fullTranscript, silenceDuration, lastSegment, updatedAt }

// --- AKTİF OTURUM ---
let activeSessionUserId = null;
let activeSessionId = null;

// ─── HAFIZA YÖNETİMİ (Supabase) ───────────────────────────
const getMemory = async (userId) => {
    if (!userId) return '';
    try {
        const { data } = await supabase.from('memories').select('content').eq('user_id', userId).single();
        const raw = data?.content || '';
        return decryptField(raw); // şifreli ise çöz
    } catch { return ''; }
};

const saveMemory = async (userId, content) => {
    if (!userId) return;
    try {
        const { data: existing } = await supabase.from('memories').select('session_history').eq('user_id', userId).single();
        const eskiGecmis = existing?.session_history || [];
        await supabase.from('memories').upsert({
            user_id: userId,
            content: encryptField(content), // AES şifrele
            session_history: eskiGecmis,
            updated_at: new Date().toISOString()
        });
    } catch (e) {
        console.error('[MEMORY] Kaydetme hatası:', e.message);
        await logError('/save-memory', e.message, userId);
    }
};

const updateUserProfile = async (userId, transcript, emotionState) => {
    if (!userId || !transcript || transcript.length < 50) return;
    try {
        const { data } = await supabase.from('memories').select('user_profile').eq('user_id', userId).single();
        const mevcutProfil = data?.user_profile || {};

        const profilGuncelleme = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'system',
                content: `Sen bir klinik psikolog asistanısın. Bu seans transcript'ini analiz et ve kullanıcının kişilik profilini güncelle.

Mevcut profil: ${JSON.stringify(mevcutProfil)}
Baskın duygu bu seansta: ${emotionState?.dominant_duygu || 'bilinmiyor'}
Duygu trendi: ${emotionState?.trend || 'stabil'}

Şunları belirle ve JSON olarak döndür:
{
  "savunma_mekanizmalari": ["espri yapma", "konu değiştirme", "küçümseme"],
  "tetikleyiciler": ["aile", "iş", "gelecek"],
  "guclu_yonler": ["öz-farkındalık", "cesaret"],
  "iletisim_tarzi": "açık|kapalı|savunmacı|işbirlikçi",
  "duygusal_tepki_hizi": "hızlı|yavaş|orta",
  "sessizlik_konforu": true,
  "soru_toleransi": "düşük|orta|yüksek",
  "basarili_mudahaleler": ["nefes", "sokratik_soru"],
  "degerler_haritasi": ["aile", "özgürlük", "başarı"],
  "haftalik_gorev": "verildiyse görevi yaz, verilmediyse boş string",
  "ozet": "1 cümle kişilik özeti"
}
Sadece JSON döndür.`
            }, {
                role: 'user',
                content: `Transcript:\n${transcript.slice(-2000)}`
            }],
            max_tokens: 300
        });

        let yeniProfil = mevcutProfil;
        try {
            const raw = profilGuncelleme.choices[0].message.content.trim().replace(/```json|```/g, '');
            const parsed = JSON.parse(raw);
            // Mevcut profille birleştir
            yeniProfil = {
                ...mevcutProfil,
                ...parsed,
                tetikleyiciler: [...new Set([...(mevcutProfil.tetikleyiciler || []), ...(parsed.tetikleyiciler || [])])],
                savunma_mekanizmalari: [...new Set([...(mevcutProfil.savunma_mekanizmalari || []), ...(parsed.savunma_mekanizmalari || [])])],
                basarili_mudahaleler: [...new Set([...(mevcutProfil.basarili_mudahaleler || []), ...(parsed.basarili_mudahaleler || [])])],
                degerler_haritasi: [...new Set([...(mevcutProfil.degerler_haritasi || []), ...(parsed.degerler_haritasi || [])])],
                guncelleme_tarihi: new Date().toISOString()
            };
        } catch { /* parse hatası → mevcut profil korunur */ }

        // ÖZEL İSİM ÇIKARIMI — GPT-4o-mini ile
        try {
            const isimCikar = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: `Bu konuşmadan bahsedilen kişilerin adlarını ve rollerini çıkar. JSON döndür: {"isimler": {"patron": "Ahmet", "sevgili": "Ayşe"}}. Sadece açıkça belirtilen isimler. Yoksa: {"isimler": {}}\n\nKonuşma:\n${transcript.slice(-1500)}` }],
                max_tokens: 100
            });
            const rawIsim = isimCikar.choices[0].message.content.trim().replace(/```json|```/g, '');
            const isimData = JSON.parse(rawIsim);
            if (isimData.isimler && Object.keys(isimData.isimler).length > 0) {
                yeniProfil.ozel_isimler = { ...(mevcutProfil.ozel_isimler || {}), ...isimData.isimler };
                console.log(`[PROFİL] İsimler güncellendi: ${JSON.stringify(isimData.isimler)}`);
            }
        } catch { /* isim çıkarımı başarısız → geç */ }

        await supabase.from('memories').upsert({ user_id: userId, user_profile: yeniProfil, updated_at: new Date().toISOString() });
        console.log(`[PROFİL] ✅ Kişilik profili güncellendi: ${userId}`);
    } catch (e) { console.error('[PROFİL] Hata:', e.message); }
};

const updatePatternMemory = async (userId, sessionData) => {
    if (!userId) return;
    try {
        const { data } = await supabase
            .from('memories')
            .select('pattern_memory')
            .eq('user_id', userId)
            .single();

        const existing = data?.pattern_memory || {
            konular: {}, seans_trendi: [], toplam_seans: 0,
            basarili_mudahaleler: [], son_seans_tarihi: null
        };

        existing.seans_trendi = [...(existing.seans_trendi || []), sessionData.trend].slice(-10);
        existing.toplam_seans = (existing.toplam_seans || 0) + 1;
        existing.son_seans_tarihi = new Date().toISOString();

        for (const [konu, sayi] of Object.entries(sessionData.konular || {})) {
            if (sayi > 0) {
                if (!existing.konular[konu]) existing.konular[konu] = { frekans: 0, duygu: sessionData.dominantDuygu };
                existing.konular[konu].frekans += sayi;
                existing.konular[konu].duygu = sessionData.dominantDuygu;
            }
        }

        // TETİKLEYİCİ HARİTA — kötü duygu + konu = tetikleyici kaydet
        const olumsuzDuygular = ['üzgün', 'sinirli', 'korkmuş', 'endişeli'];
        if (olumsuzDuygular.includes(sessionData.dominantDuygu)) {
            if (!existing.tetikleyici_konular) existing.tetikleyici_konular = {};
            for (const [konu, sayi] of Object.entries(sessionData.konular || {})) {
                if (sayi > 0) {
                    if (!existing.tetikleyici_konular[konu]) existing.tetikleyici_konular[konu] = { hit: 0, duygu: [] };
                    existing.tetikleyici_konular[konu].hit++;
                    existing.tetikleyici_konular[konu].duygu = [...(existing.tetikleyici_konular[konu].duygu || []), sessionData.dominantDuygu].slice(-5);
                }
            }
        }

        // SESSION HISTORY — son 5 seans özeti
        if (!existing.session_history) existing.session_history = [];
        const seansEntry = {
            tarih: new Date().toISOString(),
            trend: sessionData.trend,
            dominant_duygu: sessionData.dominantDuygu
        };

        // #27 — BEDEN DİLİ PUANI
        if (sessionData.bedenDiliPuan !== undefined) {
            seansEntry.aciklik_skoru = sessionData.bedenDiliPuan;
            existing.son_aciklik_skoru = sessionData.bedenDiliPuan;
        }

        existing.session_history = [...existing.session_history, seansEntry].slice(-5);

        await supabase.from('memories').upsert({
            user_id: userId,
            pattern_memory: existing,
            updated_at: new Date().toISOString()
        });
        console.log(`[PATTERN] ✅ Pattern memory güncellendi: ${userId}`);
    } catch (e) { console.error('[PATTERN] Güncelleme hatası:', e.message); }
};

// ─── CONFIG (Frontend için Supabase bilgileri) ──────────────
app.get('/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// ─── PING ──────────────────────────────────────────────────
app.get('/ping', (req, res) => {
    res.send('Lyra Brain is ALIVE! 🌌');
});

// ─── FRONTEND ERROR LOGLAMA (#43) ──────────────────────────
app.post('/log-error', async (req, res) => {
    const { userId, error, source, line, col } = req.body;
    if (!error) return res.sendStatus(400);
    await logError('/frontend', `${error} | ${source}:${line}:${col}`, userId || null);
    res.sendStatus(200);
});

// ─── TRANSCRIPT GÜNCELLEME ────────────────────────────────
app.post('/update-transcript', (req, res) => {
    const { userId, fullTranscript, silenceDuration, lastSegment, sesYogunlukOrt, sesTitreme, konusmaTempo, tempoTrend, sesMonotonluk, sessizlikTipi, hume_scores } = req.body;
    if (!userId) return res.sendStatus(400);
    sessionTranscriptStore.set(userId, {
        fullTranscript: fullTranscript || '',
        silenceDuration: silenceDuration || 0,
        lastSegment: lastSegment || '',
        sesYogunlukOrt: sesYogunlukOrt || 0,
        sesTitreme: sesTitreme || false,
        sesMonotonluk: sesMonotonluk || false,
        konusmaTempo: konusmaTempo || 0,
        tempoTrend: tempoTrend || 'stabil',
        sessizlikTipi: sessizlikTipi || 'normal',
        hume_scores: hume_scores || null,
        updatedAt: Date.now()
    });
    res.sendStatus(200);
});

// ─── OTURUM BAŞLAT (Token doğrulama ile) ───────────────────
app.post('/session-start', async (req, res) => {
    const { token } = req.body;
    if (token) {
        try {
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                activeSessionUserId = user.id;
                activeSessionId = crypto.randomUUID();
                console.log(`[SESSION] Aktif kullanıcı: ${user.id} | sessionId: ${activeSessionId}`);
            }
        } catch (e) {
            console.error('[SESSION] Token doğrulama hatası:', e.message);
        }
    }
    res.sendStatus(200);
});

// ─── HAFIZA OKUMA ───────────────────────────────────────────
app.get('/memory', async (req, res) => {
    const userId = req.query.userId;
    const memory = await getMemory(userId);
    console.log(`[MEMORY READ] userId: ${userId}, hasMemory: ${!!memory}`);
    res.json({ memory });
});

// ─── VAPI WEBHOOK (Arama bitince hafızayı kaydet) ──────────
app.post('/vapi-webhook', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.json({});

    const msgType = message.type;
    console.log(`[VAPI WEBHOOK] Type: ${msgType}`);

    if (msgType === 'end-of-call-report') {
        const transcript = message.transcript || '';
        const userId = activeSessionUserId;

        if (!transcript || transcript.length < 50) {
            console.log('[END OF CALL] Konuşma çok kısa, özetlenmiyor.');
            return res.json({});
        }

        console.log(`[END OF CALL] Özetleniyor... userId: ${userId}`);
        try {
            const summaryResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Kullanıcı ile yapılan konuşmayı analiz et ve şu bilgileri kısa maddeler halinde özetle:\n- Kullanıcının adı (varsa)\n- Temel endişeleri ve sorunları\n- Kişilik özellikleri ve ruh hali\n- Lyra'nın bir dahaki seferde hatırlaması gereken önemli detaylar\nMaksimum 150 kelime.`
                    },
                    { role: 'user', content: `Konuşma:\n${transcript}` }
                ],
                max_tokens: 250
            });

            // Seans emotion özetini çek ve hafızaya ekle
            let emotionOzeti = '';
            try {
                if (activeSessionId) {
                    const { data: logs } = await supabase
                        .from('emotion_logs')
                        .select('duygu, yogunluk, trend, guven')
                        .eq('session_id', activeSessionId)
                        .order('timestamp', { ascending: true });

                    if (logs && logs.length > 0) {
                        const sayac = {};
                        logs.forEach(l => { sayac[l.duygu] = (sayac[l.duygu] || 0) + 1; });
                        const dominant = Object.keys(sayac).sort((a, b) => sayac[b] - sayac[a])[0];
                        const ortGuven = Math.round(logs.reduce((s, l) => s + (l.guven || 0), 0) / logs.length);
                        const sonTrend = logs[logs.length - 1]?.trend || 'stabil';
                        emotionOzeti = `\n\nBu seanstaki duygu analizi: Baskın duygu "${dominant}", ortalama güven %${ortGuven}, seans sonu trendi "${sonTrend}".`;
                    }
                }
            } catch (e) { console.error('[EMOTION OZET] Hata:', e.message); }

            // #9 — SEANS SONU DUYGU KARŞILAŞTIRMASI
            let seansKarsilastirma = '';
            try {
                if (activeSessionId) {
                    const { data: allLogs } = await supabase
                        .from('emotion_logs')
                        .select('duygu, yogunluk, guven, timestamp')
                        .eq('session_id', activeSessionId)
                        .order('timestamp', { ascending: true });

                    if (allLogs && allLogs.length >= 4) {
                        const ilkCeyrek = allLogs.slice(0, Math.floor(allLogs.length / 4));
                        const sonCeyrek = allLogs.slice(-Math.floor(allLogs.length / 4));
                        const ilkYogunluk = ilkCeyrek.reduce((s, l) => s + yogunlukToNum(l.yogunluk), 0) / ilkCeyrek.length;
                        const sonYogunluk = sonCeyrek.reduce((s, l) => s + yogunlukToNum(l.yogunluk), 0) / sonCeyrek.length;
                        const fark = sonYogunluk - ilkYogunluk;
                        const sonDuygu = sonCeyrek[sonCeyrek.length - 1]?.duygu || 'bilinmiyor';
                        const ilkDuygu = ilkCeyrek[0]?.duygu || 'bilinmiyor';
                        if (Math.abs(fark) > 15) {
                            seansKarsilastirma = `\nSeans duygu değişimi: "${ilkDuygu}" → "${sonDuygu}" (${fark > 0 ? '+' : ''}${Math.round(fark)} puan yoğunluk ${fark > 0 ? 'artışı' : 'düşüşü'}).`;
                        } else {
                            seansKarsilastirma = `\nSeans boyunca duygu stabil kaldı (${ilkDuygu} → ${sonDuygu}).`;
                        }
                    }
                }
            } catch (e) { console.error('[SEANS KARSILASTIRMA] Hata:', e.message); }

            // #7 — GÜVEN İNŞA SKORU
            let guvenSkoru = '';
            try {
                const { data: patternData } = await supabase
                    .from('user_profiles')
                    .select('pattern_memory')
                    .eq('user_id', userId)
                    .single();

                const pattern = patternData?.pattern_memory || {};
                const seansCount = (pattern.toplam_seans || 0) + 1;
                const pozitifSeans = (pattern.pozitif_seans || 0) + (emotionOzeti.includes('iyileşiyor') ? 1 : 0);
                const guvenSkor = Math.min(100, Math.round((pozitifSeans / Math.max(seansCount, 1)) * 60 + Math.min(seansCount * 4, 40)));
                guvenSkoru = `\nGüven inşa skoru: ${guvenSkor}/100 (${seansCount}. seans).`;

                // Skoru pattern_memory'ye kaydet
                await supabase.from('user_profiles').upsert({
                    user_id: userId,
                    pattern_memory: {
                        ...pattern,
                        toplam_seans: seansCount,
                        pozitif_seans: pozitifSeans,
                        guven_skoru: guvenSkor,
                        son_guncelleme: new Date().toISOString()
                    }
                }, { onConflict: 'user_id' });
            } catch (e) { console.error('[GÜVEN SKORU] Hata:', e.message); }

            const summary = summaryResponse.choices[0].message.content + emotionOzeti + seansKarsilastirma + guvenSkoru;
            await saveMemory(userId, summary);
            console.log(`[BRAIN ASCENSION] ✅ Hafıza mühürlendi! userId: ${userId}`);
            console.log(`[BRAIN ASCENSION] Özet: ${summary.substring(0, 100)}...`);

            // Kişilik profili güncelle
            const emotionStateForProfile = userEmotions.get(userId);
            await updateUserProfile(userId, transcript, emotionStateForProfile);

            // Pattern memory güncelle
            const transcriptDataForPattern = sessionTranscriptStore.get(userId);
            if (transcriptDataForPattern) {
                const konular = trackSessionTopics(transcriptDataForPattern.fullTranscript);
                const emotionState = userEmotions.get(userId);

                // #27 — BEDEN DİLİ PUANI hesapla (emotion_logs jestlerinden)
                let bedenDiliPuan = 50; // başlangıç nötr
                try {
                    if (activeSessionId) {
                        const { data: jestLogs } = await supabase
                            .from('emotion_logs')
                            .select('jestler')
                            .eq('session_id', activeSessionId);
                        if (jestLogs && jestLogs.length > 0) {
                            let puan = 50;
                            jestLogs.forEach(log => {
                                const j = log.jestler || {};
                                if (j.kas_catma)                         puan -= 1;
                                if (j.gozyasi_izi)                       puan -= 2;
                                if (j.dudak_sikistirma)                  puan -= 1;
                                if (j.bas_egme)                          puan -= 1;
                                if (j.goz_temasi === 'düşük')            puan -= 2;
                                if (j.omuz_durusu === 'düşük')           puan -= 2;
                                if (j.goz_temasi === 'yüksek')           puan += 2;
                                if (j.omuz_durusu === 'yüksek')          puan += 2;
                                if (j.genel_vucut_dili === 'açık')       puan += 3;
                                if (j.genel_vucut_dili === 'kapalı')     puan -= 3;
                            });
                            bedenDiliPuan = Math.max(0, Math.min(100, Math.round(50 + (puan - 50) / jestLogs.length * 10)));
                        }
                    }
                } catch (e) { /* beden dili hesap hatası → 50 kullan */ }

                await updatePatternMemory(userId, {
                    trend: emotionState?.trend || 'stabil',
                    konular,
                    dominantDuygu: emotionState?.dominant_duygu || 'sakin',
                    bedenDiliPuan
                });
                sessionTranscriptStore.delete(userId);
            }
        } catch (err) {
            console.error('[BRAIN ASCENSION] ❌ Özetleme hatası:', err.message);
        }

        // Seans bitti, ID'yi sıfırla
        activeSessionId = null;
    }

    res.json({});
});

// ─── LOCAL MEMORY ENDPOINT ─────────────────────────────────
app.post('/save-local-memory', async (req, res) => {
    const { userId, transcript } = req.body;

    if (!userId || !transcript || transcript.length < 50) {
        return res.sendStatus(200);
    }

    console.log(`[LOCAL MEMORY] Özetleniyor... userId: ${userId}`);
    try {
        const summaryResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Kullanıcı ile yapılan konuşmayı analiz et ve şu bilgileri kısa maddeler halinde özetle:\n- Kullanıcının adı (varsa)\n- Temel endişeleri ve sorunları\n- Kişilik özellikleri ve ruh hali\n- Lyra'nın bir dahaki seferde hatırlaması gereken önemli detaylar\nMaksimum 150 kelime.`
                },
                { role: 'user', content: `Konuşma:\n${transcript}` }
            ],
            max_tokens: 250
        });

        const summary = summaryResponse.choices[0].message.content;
        await saveMemory(userId, summary);
        console.log(`[LOCAL MEMORY] ✅ Hafıza başarıyla kaydedildi!`);
        console.log(`[LOCAL MEMORY] Özet: ${summary.substring(0, 100)}...`);
    } catch (err) {
        console.error('[LOCAL MEMORY] ❌ Özetleme hatası:', err.message);
    }

    res.sendStatus(200);
});

// ─── CUSTOM LLM ENDPOINT (VAPI BEYİN) ─────────────────────
app.post('/api/chat/completions', async (req, res) => {
    try {
        const { messages, model, temperature, max_tokens, call } = req.body;
        console.log(`[CUSTOM LLM] İstek alındı! Gelen mesaj sayısı: ${messages?.length}`);

        // Serverless ortamda activeSessionUserId güvenilmez — Vapi'nin call.assistantOverrides'ından al
        const userId = call?.assistantOverrides?.variableValues?.userId || activeSessionUserId;
        console.log(`[CUSTOM LLM] Kullanıcı ID: ${userId}`);

        const userMemory = await getMemory(userId);
        const enrichedMessages = [...messages];

        const systemIdx = enrichedMessages.findIndex(m => m.role === 'system');
        if (userMemory) {
            const memoryInjection = `\n\n[BU KULLANICI HAKKINDAKİ HAFIZA]:\n${userMemory}\n\nBu bilgileri doğal şekilde kullan, asla "seni hatırlıyorum" diyerek açıkça belirtme.`;
            if (systemIdx !== -1) {
                enrichedMessages[systemIdx] = { ...enrichedMessages[systemIdx], content: enrichedMessages[systemIdx].content + memoryInjection };
            } else {
                enrichedMessages.unshift({ role: 'system', content: memoryInjection });
            }
            console.log(`[CUSTOM LLM] 🧠 Hafıza inject edildi! userId: ${userId}`);
        }

        // userId eşleşmezse activeSessionUserId ile de dene
        const userState = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);
        console.log(`[KURAL MOTORU] userState var mı: ${!!userState} | userEmotions boyutu: ${userEmotions.size} | userId: ${userId}`);
        if (userState) {
            const { son_analiz, trend, dominant_duygu, aktif_sinyal, gecmis, yogunluk_ort } = userState;
            console.log(`[KURAL MOTORU] son_analiz: ${son_analiz?.duygu} | yogunluk: ${son_analiz?.yogunluk} | guven: ${son_analiz?.guven}`);

            const l1 = buildLayer1Rules(son_analiz, aktif_sinyal, userId);
            const l2 = buildLayer2Rules(trend, dominant_duygu, gecmis || [], transcriptState);
            const l3 = buildLayer3Rules(userMemory, son_analiz, userId);

            // L4: Söz-yüz çelişkisi
            const transcriptState = sessionTranscriptStore.get(userId);
            const l4 = buildLayer4Rules(transcriptState?.lastSegment, son_analiz);

            // L5: Sessizlik
            const l5 = buildLayer5Rules(transcriptState?.silenceDuration, transcriptState?.sessizlikTipi);

            // L6: Seanslar arası pattern
            let l6 = '';
            try {
                const { data: memRow } = await supabase
                    .from('memories')
                    .select('pattern_memory')
                    .eq('user_id', userId)
                    .single();
                const patternMemory = memRow?.pattern_memory || {};
                l6 = buildLayer6Rules(patternMemory, son_analiz, dominant_duygu);
            } catch { /* pattern_memory yoksa geç */ }

            // L7: Seans momentum & profil adaptasyonu
            let l7 = '';
            try {
                const { data: profileRow } = await supabase
                    .from('memories')
                    .select('user_profile')
                    .eq('user_id', userId)
                    .single();
                const userProfile = profileRow?.user_profile || {};
                l7 = buildLayer7Rules(userProfile, son_analiz, gecmis, transcriptState);
            } catch { /* profil yoksa geç */ }

            const tumKurallar = [l1, l2, l3, l4, l5, l6, l7].filter(Boolean).join(' ');

            if (tumKurallar) {
                const sysIdx = enrichedMessages.findIndex(m => m.role === 'system');
                const enjeksiyon = `\n\n[GİZLİ TALIMAT — Kamera & Trend Analizi]:\n${tumKurallar}\nBu talimatları doğal şekilde uygula, asla "kamerayı görüyorum" ya da "analiz ediyorum" deme.`;
                if (sysIdx !== -1) {
                    enrichedMessages[sysIdx] = {
                        ...enrichedMessages[sysIdx],
                        content: enrichedMessages[sysIdx].content + enjeksiyon
                    };
                }
                console.log(`[KURAL MOTORU] Katman1:${!!l1} Katman2:${!!l2} Katman3:${!!l3} | trend:${trend} | dominant:${dominant_duygu}`);
            }
        }

        const response = await openai.chat.completions.create({
            model: model || 'gpt-4o',
            messages: enrichedMessages,
            stream: true,
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 500,
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for await (const chunk of response) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
        console.log(`[CUSTOM LLM] 🧠 Cevap başarıyla akıtıldı.`);
    } catch (error) {
        console.error("[CUSTOM LLM] ❌ Hata:", error);
        res.status(500).json({ error: error.message });
    }
});

// ─── KRİZ SONRASI KONTROL (Cron) ──────────────────────────
app.get('/cron-checkin', async (req, res) => {
    try {
        const onceki24h = new Date(Date.now() - 24*60*60*1000).toISOString();
        const { data: krizKayitlari } = await supabase
            .from('memories')
            .select('user_id, kriz_log')
            .not('kriz_log', 'is', null)
            .gte('updated_at', onceki24h);

        const kontrol = (krizKayitlari || []).filter(k => k.kriz_log?.tarih);
        console.log(`[CRON] ${kontrol.length} kriz kaydı kontrol edildi.`);
        res.json({ kontrol_edilen: kontrol.length, tarih: new Date().toISOString() });
    } catch (e) {
        console.error('[CRON] Hata:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── YÜZDEN DUYGU ANALİZİ (GPT-4o Vision — Zengin) ────────
// Rate limiter: max 30 istek/dk per userId veya IP
const emotionRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.body?.userId || req.ip,
    handler: (req, res) => {
        res.status(429).json({ duygu: 'sakin', guven: 0, yuz_var: false, rate_limited: true });
    },
    skip: (req) => !req.body?.userId // userId yoksa atla
});

// ── HUME SES YAKALAMA RATE LIMITER ──
const humeRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.body?.userId || req.ip,
    handler: (req, res) => {
        res.status(429).json({ hume_scores: null });
    },
    skip: (req) => !req.body?.userId
});

// ── MULTER SES DOSYASI YÜKLEMESİ ──
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB max
});

// ── MEDİAPİPE LANDMARK CONTEXT BUILDER ──
const buildLandmarkContext = (lm) => {
    if (!lm) return '';
    const s = [];
    if (lm.brow_down_left > 0.4 || lm.brow_down_right > 0.4)
        s.push('KAŞLAR AŞAĞI ÇATIK: güçlü kaş kasılması');
    const eyeAvg = (lm.eye_openness_left + lm.eye_openness_right) / 2;
    if (eyeAvg < 0.25) s.push('GÖZLER NEREDEYSE KAPALI: aşırı yorgunluk/gözyaşı');
    else if (eyeAvg > 0.85) s.push('Gözler çok geniş açık: şaşkınlık/korku');
    if (lm.mouth_openness > 0.35) s.push('Ağız açık: şaşkınlık/korku/ağlama');
    else if (lm.mouth_openness < 0.03) s.push('Ağız sıkı kapalı: gerilim');
    if (lm.lip_corner_pull > 0.5 && lm.cheek_raise > 0.3)
        s.push('Gerçek gülümseme (Duchenne): dudak köşesi + yanak kası aktif');
    else if (lm.lip_corner_pull > 0.4 && lm.cheek_raise < 0.15)
        s.push('Sosyal/zorunlu gülümseme: yanak kası pasif');
    if (lm.jaw_drop > 0.65) s.push('Çene belirgin düşük: şok/ağlama');
    if (Math.abs(lm.head_tilt) > 0.04)
        s.push(`Baş ${lm.head_tilt > 0 ? 'sola' : 'sağa'} eğik — beden dili sinyali`);
    if (lm.nose_wrinkle > 0.3) s.push('Burun kıvırma: tiksinme/rahatsızlık');
    if (!s.length) return '';
    return `\n\nMEDİAPİPE LANDMARK ANALİZİ (piksel geometrisi — GPT görüntü analizinden daha güvenilir):\n${s.join('\n')}\nÇelişki varsa landmark verilerine öncelik ver.`;
};

app.post('/analyze-emotion', emotionRateLimit, async (req, res) => {
    try {
        const { imageBase64, userId, sessionId, landmarks } = req.body;
        if (!imageBase64) return res.json({ duygu: 'sakin', guven: 0, yuz_var: false });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Sen deneyimli bir klinik psikolog, yüz ifadesi uzmanı ve çevre analisti olarak çalışıyorsun. Görüntüdeki kişiyi VE ortamı aynı anda analiz et.

BÖLÜM 1 — YÜZ & DUYGU ANALİZİ:
1. "sakin" ancak gerçekten hiçbir duygu belirtisi yoksa yaz. Şüphe durumunda en belirgin duyguyu seç.
2. Kaş çatma, çene gerginliği, sıkılmış dudaklar, dar gözler = sinirli/gergin.
3. Düşük göz teması, omuz çöküklüğü, sarkık yüz = üzgün/yorgun.
4. Hızlı göz kırpma, geniş gözler, gergin alın = endişeli/korkmuş.
5. HAYALET YÜZ MODU: Görüntü karanlık, bulanık, grenli veya aşırı parlak olsa bile — siluet, saç çizgisi, omuz, göz yuvası gölgesi, ten tonu izi, herhangi bir insan şekli görünüyorsa yuz_var:true YAZ. Tahmin et, çıkarım yap. guven:40-55 ver.
6. Görüntü TAMAMEN siyah piksel veya boş bir ekran değilse yuz_var:true yaz. Şüphe durumunda her zaman true. Sadece %100 insan olmayan bir görüntüde yuz_var:false döndür.
7. YORGUNLUK & UYKU: goz_kapagi_agirlik ekle — "normal|hafif_agir|belirgin_agir". Göz kapakları düşükse belirgin_agir.
8. guven: net görüntü=80+, karanlık/bulanık=40-65, siluet/hayalet=40-52. ASLA 40 altına düşürme.

BÖLÜM 2 — ORTAM & NESNE & OLAY ANALİZİ:
- Elinde/yakınında görünen nesneleri tespit et.
- Kesici/tehlikeli alet (bıçak, makas, cam, iğne) varsa tehlike_var:true yaz.
- Mekan: ev, ofis, dışarı, araba.

ZARAR VERME SINYALI:
Elindeki herhangi bir nesne (kalem, cisim dahil) kendi cildine tekrarlı temas veya baskı uyguluyorsa, ya da kişi kolunu/bedenini çiziyor/kazıyorsa: zarar_sinyali:true yaz.

ORTAM OLAYI:
- Arka planda başka biri var mı? arkaplan_kisi:true/false
- Kişinin yüzü/postu ani değişti mi? ani_degisim:true/false
- Ortamda gerilim/hareket var mı? ortam_gerilimi:"yok|var|belirsiz"

${buildLandmarkContext(landmarks)}

Yalnızca geçerli JSON döndür, başka metin ekleme:
{"duygu":"mutlu|üzgün|endişeli|korkmuş|sakin|şaşırmış|sinirli|yorgun|iğnelenmiş|küçümseyen","yogunluk":"düşük|orta|yüksek","enerji":"canlı|normal|yorgun","jestler":{"kas_catma":true,"goz_temasi":"yüksek|normal|düşük","goz_kirpma_hizi":"hızlı|normal|yavaş","gulümseme_tipi":"gerçek|sosyal|yok","bas_egme":false,"omuz_durusu":"yüksek|normal|düşük","cene_gerginligi":"yüksek|orta|düşük","dudak_sikistirma":false,"gozyasi_izi":false,"kasin_pozisyonu":"yukari|normal|asagi|catan","nefes_hizi":"normal|hızlı|yüzeysel|tutuyor","el_titreme":false,"goz_yasi_birikimi":"yok|başlıyor|belirgin","goz_kapagi_agirlik":"normal|hafif_agir|belirgin_agir"},"genel_vucut_dili":"açık|nötr|kapalı","ortam":{"mekan":"ev|ofis|dışarı|araba|bilinmiyor","nesneler":["kalem"],"tehlike_var":false,"tehlikeli_nesne":"","zarar_sinyali":false,"arkaplan_kisi":false,"ani_degisim":false,"ortam_gerilimi":"yok|var|belirsiz"},"mikro_duygu":"yok|gizli_öfke|gizli_üzüntü|gizli_korku|gizli_tiksinme","gorunum_ozeti":"kısa bir cümle","guven":85,"yuz_var":true,"timestamp":0}`
                    },
                    {
                        type: 'image_url',
                        image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' }
                    }
                ]
            }],
            max_tokens: 600
        });

        let result = { duygu: 'sakin', guven: 0, yuz_var: false };
        try {
            let raw = response.choices[0].message.content.trim().replace(/```json|```/g, '');
            // Truncate olan JSON'ı düzelt: ilk { ile son } arasını al
            const jsonStart = raw.indexOf('{');
            const jsonEnd = raw.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                raw = raw.slice(jsonStart, jsonEnd + 1);
            }
            result = JSON.parse(raw);
            result.timestamp = Date.now();
            console.log(`[DUYGU PARSE] OK: ${result.duygu} yuz:${result.yuz_var} guven:${result.guven}`);
        } catch (parseErr) {
            console.warn('[DUYGU PARSE] Hata:', parseErr.message, '| raw:', response.choices[0]?.message?.content?.slice(0, 100));
        }

        if (userId && result.yuz_var) {
            // userEmotions Map'i güncelle (gecmis: tam analiz objesi, jestler dahil)
            const mevcut = userEmotions.get(userId) || { gecmis: [] };
            const yeniGecmis = [...mevcut.gecmis, {
                duygu: result.duygu,
                yogunluk: result.yogunluk,
                enerji: result.enerji,
                guven: result.guven,
                jestler: result.jestler || null,
                timestamp: result.timestamp
            }].slice(-10);

            const guncel = {
                gecmis: yeniGecmis,
                trend: calculateTrend(yeniGecmis),
                dominant_duygu: getDominantDuygu(yeniGecmis),
                yogunluk_ort: Math.round(yeniGecmis.reduce((s, a) => s + yogunlukToNum(a.yogunluk), 0) / yeniGecmis.length),
                aktif_sinyal: getAktifSinyaller(result.jestler),
                son_analiz: result
            };
            userEmotions.set(userId, guncel);
            console.log(`[DUYGU] ${userId}: ${result.duygu} | yogunluk:${result.yogunluk} | trend:${guncel.trend} | sinyaller:${guncel.aktif_sinyal.join(',') || '-'}`);

            // emotion_logs'a kaydet — fire-and-forget
            const sid = sessionId || activeSessionId;
            if (sid) {
                supabase.from('emotion_logs').insert({
                    user_id: userId,
                    session_id: sid,
                    duygu: result.duygu,
                    yogunluk: result.yogunluk,
                    enerji: result.enerji,
                    jestler: result.jestler || null,
                    trend: guncel.trend,
                    guven: result.guven,
                    mediapipe_landmarks: landmarks || null
                }).then(({ error }) => {
                    if (error) console.error('[EMOTION LOG] Insert hatası:', error.message);
                });
            }
        }

        res.json(result);
    } catch (err) {
        console.error('[DUYGU] Hata:', err.message);
        res.json({ duygu: 'sakin', guven: 0, yuz_var: false });
    }
});

// ─── HUME SES ANALİZİ (48 Duygu, Prosody) ────────────────────────
app.post('/analyze-hume-voice', upload.single('audio'), humeRateLimit, async (req, res) => {
    try {
        const { userId } = req.body;
        const buf = req.file?.buffer;

        if (!buf || buf.length < 1000) {
            return res.json({ hume_scores: null });
        }

        const HUME_API_KEY = process.env.HUME_API_KEY;
        if (!HUME_API_KEY) {
            console.warn('[HUME] API key yoksa, skip.');
            return res.json({ hume_scores: null });
        }

        // FormData ile Hume'a gönder
        const fd = new FormData();
        fd.append('file', new Blob([buf], { type: req.file.mimetype }), 'audio.webm');
        fd.append('models', JSON.stringify({ prosody: { granularity: 'utterance' } }));

        const humeResp = await fetch('https://api.hume.ai/v0/stream/models', {
            method: 'POST',
            headers: { 'X-Hume-Api-Key': HUME_API_KEY },
            body: fd,
            signal: AbortSignal.timeout(8000)
        });

        if (!humeResp.ok) {
            console.warn(`[HUME] API error: ${humeResp.status}`);
            return res.json({ hume_scores: null });
        }

        const data = await humeResp.json();
        const emotions = data?.prosody?.predictions?.[0]?.emotions || [];

        if (!emotions.length) {
            return res.json({ hume_scores: null });
        }

        // Top 10 duyguyu sırayla say
        const sorted = [...emotions].sort((a, b) => b.score - a.score);

        // Valence (pozitif - negatif): mutluluk, merak, memnuniyet vs üzüntü, korku, öfke
        const posEmotions = ['Joy', 'Excitement', 'Contentment', 'Amusement', 'Pride', 'Love', 'Interest'];
        const negEmotions = ['Sadness', 'Fear', 'Anger', 'Disgust', 'Anxiety', 'Shame', 'Guilt'];
        const posScore = emotions
            .filter(e => posEmotions.includes(e.name))
            .reduce((s, e) => s + e.score, 0);
        const negScore = emotions
            .filter(e => negEmotions.includes(e.name))
            .reduce((s, e) => s + e.score, 0);

        // Arousal (enerji): Excitement, Anger, Fear, Surprise vs Calmness, Contentment
        const highArousal = ['Excitement', 'Anger', 'Fear', 'Surprise'];
        const arousScore = emotions
            .filter(e => highArousal.includes(e.name))
            .reduce((s, e) => s + e.score, 0);

        const round = (v) => Math.round(v * 100) / 100;

        const humeScores = {
            top_emotions: sorted.slice(0, 10).map(e => ({
                name: e.name,
                score: round(e.score)
            })),
            all_scores: Object.fromEntries(
                emotions.map(e => [e.name, round(e.score)])
            ),
            dominant: sorted[0]?.name || 'Neutral',
            valence: round(posScore - negScore),           // -1.0 to +1.0
            arousal: round(arousScore),                     // 0 to +1.0
            analyzed_at: Date.now()
        };

        // Supabase emotion_logs'a hume_scores ekle (fire-and-forget)
        if (userId) {
            supabase
                .from('emotion_logs')
                .select('id')
                .eq('user_id', userId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single()
                .then(({ data: row, error: selectErr }) => {
                    if (selectErr) {
                        console.warn('[HUME] Son emotion_log bulunamadı:', selectErr.message);
                        return;
                    }
                    if (row?.id) {
                        supabase
                            .from('emotion_logs')
                            .update({ hume_scores: humeScores })
                            .eq('id', row.id)
                            .then(({ error: updateErr }) => {
                                if (updateErr) console.error('[HUME SAVE] Hata:', updateErr.message);
                            });
                    }
                })
                .catch(err => console.error('[HUME] Query error:', err.message));
        }

        console.log(`[HUME] ${humeScores.dominant} | valence:${humeScores.valence} | arousal:${humeScores.arousal}`);
        res.json({ hume_scores: humeScores });
    } catch (err) {
        console.error('[HUME] Hata:', err.message);
        res.json({ hume_scores: null });
    }
});

// ─── SUNUCU BAŞLAT ─────────────────────────────────────────
// Vercel serverless için app export ediliyor, lokal için listen
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    app.listen(port, () => {
        console.log('-------------------------------------------');
        console.log('🚀 Lyra Brain Sunucusu Çalışıyor!');
        console.log(`📍 Port: ${port}`);
        console.log('🧠 Mimari: Vapi + Supabase Memory + Auth');
        console.log('-------------------------------------------');
    });
}

export default app;
