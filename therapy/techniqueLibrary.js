/**
 * Lyra Terapi Teknik Kütüphanesi
 * 40 kanıtlanmış terapi tekniği — 8 kategoride
 */

export const TECHNIQUES = [
  // ─── Bilişsel / Düşünce ───────────────────────────────────────────────────
  {
    id: 'CBT',
    name: 'Bilişsel Davranışçı Terapi',
    category: 'bilissel',
    description: 'Olumsuz düşünce kalıplarını sorgulayarak duygusal tepkileri dönüştürür.',
    when_to_use: ['negatif_düşünce', 'felaket_senaryosu', 'siyah_beyaz_düşünce', 'öz_eleştiri'],
    prompt_hint: 'GİRİŞ: Otomatik düşünce dile geldiğinde nazikçe ama doğrudan gir. DİL: "Bu düşüncenin seni nasıl etkilediğini görüyorum. Acaba... bu durumun başka bir açıklaması da olabilir mi?" ÇIKIŞ: Savunmaya geçerse dur — PCT\'ye dön, güveni pekiştir. Zorlamak kapatır.',
    contraindicated: ['akut_kriz', 'yoğun_üzüntü_ilk_dakikalar'],
  },
  {
    id: 'REBT',
    name: 'Rasyonel Duygusal Davranış Terapisi',
    category: 'bilissel',
    description: 'İrrasyonel inançları ve "zorunda" cümlelerini sorgulayarak duygusal esneklik geliştirir.',
    when_to_use: ['mutlak_düşünce', 'zorunda_cümleleri', 'kendini_suçlama'],
    prompt_hint: '"Kesinlikle böyle olmalı" gibi kalıpları fark ettirip sorgulat.',
    contraindicated: ['stabilizasyon_modu'],
  },
  {
    id: 'MBCT',
    name: 'Farkındalık Tabanlı Bilişsel Terapi',
    category: 'bilissel',
    description: 'Ruminasyonu ve tekrarlayan depresif döngüleri farkındalıkla kırar.',
    when_to_use: ['tekrarlayan_depresyon', 'ruminasyon', 'geçmişte_takılma'],
    prompt_hint: 'Şu ana getir. "Şu an bu düşünceyi gözlemliyorsun — sen o düşünce değilsin."',
    contraindicated: [],
  },
  {
    id: 'CPT',
    name: 'Bilişsel İşleme Terapisi',
    category: 'bilissel',
    description: 'Travmadan kaynaklanan suçluluk ve utanç inançlarını yeniden işler.',
    when_to_use: ['travma', 'PTSD', 'suçluluk_travmadan', 'utanç_travmadan'],
    prompt_hint: 'Travma ile ilgili "kendi hatam" düşüncelerini nazikçe sorgula.',
    contraindicated: ['stabilizasyon_modu', 'yeni_kullanici'],
  },
  {
    id: 'SFBT',
    name: 'Çözüm Odaklı Kısa Terapi',
    category: 'bilissel',
    description: 'Sorun yerine çözüme odaklanarak var olan güçlü yönleri harekete geçirir.',
    when_to_use: ['çıkmaz_hissi', 'ne_yapacağını_bilmeme', 'motivasyon_eksikliği'],
    prompt_hint: '"Bu hafta az da olsa daha iyi gittiği bir an var mıydı?" diye sor.',
    contraindicated: [],
  },

  // ─── Konuşma / İlişki ────────────────────────────────────────────────────
  {
    id: 'PCT',
    name: 'Kişi Merkezli Terapi',
    category: 'iliskisel',
    description: 'Koşulsuz kabul ve empatiyle güvenli terapötik ittifak kurar.',
    when_to_use: ['her_zaman', 'güven_inşası', 'yeni_kullanici'],
    prompt_hint: 'GİRİŞ: Her zaman aktif — bu temel zemin. DİL: Söyleneni kendi kelimelerinle yansıt: "Yani... böyle mi hissediyorsun?" Yorum yok, ekleme yok, çözüm yok. ÇIKIŞ: Hiç çıkma. Diğer teknikler bu zeminin üzerine inşa edilir.',
    contraindicated: [],
  },
  {
    id: 'MI',
    name: 'Motivasyonel Görüşme',
    category: 'iliskisel',
    description: 'Değişime karşı ambivalansı keşfederek içsel motivasyonu güçlendirir.',
    when_to_use: ['degisim_direnci', 'ambivalans', 'yok_ne_fark_eder'],
    prompt_hint: 'GİRİŞ: Kişi değişmek istiyor ama aynı anda istemiyor — ikisi bir arada. DİL: "Değişmek istemek ile değişmemek istemek — ikisi de var gibi görünüyor. Bu çatışma nasıl hissettiriyor?" ÇIKIŞ: Kişi kendi motivasyonunu bulduğunda güçlendir — yönlendirme değil, kişinin kendi sesiyle devam etmesini sağla.',
    contraindicated: [],
  },
  {
    id: 'NARRATIVE',
    name: 'Anlatı Terapisi',
    category: 'iliskisel',
    description: 'Kişiyi sorundan ayırarak yeni, güçlendirici bir yaşam hikayesi oluşturur.',
    when_to_use: ['kimlik_sorunu', 'etiketlenme', 'ben_böyleyim_diyenler'],
    prompt_hint: 'GİRİŞ: Kişi kendini sorunla özdeşleştiriyor ("ben böyleyim", "hep böyle olur"). DİL: "Sen sorunun kendisi değilsin. Sorun dışarıda bir şey — ve sende onu gören bir parça var." ÇIKIŞ: "Sen kim değilsin?" sorusu bazen "sen kimsin?"den daha güçlüdür — oradan aç.',
    contraindicated: [],
  },
  {
    id: 'IPT',
    name: 'Kişilerarası Terapi',
    category: 'iliskisel',
    description: 'İlişki sorunlarını, yası ve rol geçişlerini ele alarak ruh sağlığını iyileştirir.',
    when_to_use: ['ilişki_sorunu', 'yas_kayıp', 'rol_geçişi', 'yalnızlık'],
    prompt_hint: 'İlişki haritasına bak. O kişiyle bu dinamiği keşfet.',
    contraindicated: [],
  },
  {
    id: 'TA',
    name: 'Transaksiyonel Analiz',
    category: 'iliskisel',
    description: 'Ego durumlarını ve ilişki örüntülerini fark ettirerek sağlıklı iletişim geliştirir.',
    when_to_use: ['ilişki_döngüleri', 'tekrar_eden_çatışmalar', 'otorite_sorunları'],
    prompt_hint: 'Şu an hangi ego durumundan konuştuğunu nazikçe fark ettir.',
    contraindicated: ['yeni_kullanici'],
  },
  {
    id: 'ATTACHMENT',
    name: 'Bağlanma Temelli Terapi',
    category: 'iliskisel',
    description: 'Bağlanma stillerini keşfederek güvenli ilişki kurma kapasitesini güçlendirir.',
    when_to_use: ['ilişki_döngüleri', 'terk_korkusu', 'bağlanma_sorunu'],
    prompt_hint: 'Bağlanma stilini kullan. "Bu ilişkide kendinle ilgili ne düşünüyorsun?" diye sor.',
    contraindicated: [],
  },

  // ─── Duygu Odaklı ────────────────────────────────────────────────────────
  {
    id: 'DBT',
    name: 'Diyalektik Davranış Terapisi',
    category: 'duygu',
    description: 'Yoğun duyguları düzenlemek için somut beceriler ve distres toleransı sunar.',
    when_to_use: ['yoğun_duygu', 'öfke_patlaması', 'panik', 'kendine_zarar'],
    prompt_hint: 'Somut bir beceri öner: TIPP, STOP, TIP tekniklerinden uygun olanı.',
    contraindicated: [],
  },
  {
    id: 'ACT',
    name: 'Kabul ve Kararlılık Terapisi',
    category: 'duygu',
    description: 'Duyguları kabul ederek değerler doğrultusunda psikolojik esneklik kazandırır.',
    when_to_use: ['duygudan_kaçma', 'kontrolü_kaybetme_korkusu', 'bastırma'],
    prompt_hint: 'GİRİŞ: Kişi duyguyu yok etmeye, bastırmaya ya da "düzeltmeye" çalışıyor. DİL: "Bu duyguyu yok etmek zorunda değilsin. Onunla birlikte olmak nasıl bir şey?" ÇIKIŞ: Kabul geldikten sonra değerlere yönel — "Bu his varken bile ne yapmak istersin?"',
    contraindicated: [],
  },
  {
    id: 'EFT',
    name: 'Duygusal Odaklı Terapi',
    category: 'duygu',
    description: 'Temel duygulara ulaşarak ilişkisel bağı ve duygusal işlemeyi derinleştirir.',
    when_to_use: ['ilişki_sorunu', 'bağ_kurma_zorluğu', 'duygusal_kopukluk'],
    prompt_hint: 'GİRİŞ: Yüzey duygusu var ama asıl duygu farklı (öfkenin altında acı, mesafenin altında korku). DİL: "Bunun altında ne var? En derininde ne hissediyorsun?" / "Bu his sana başka ne hatırlatıyor?" ÇIKIŞ: Temel duyguya ulaşıldığında valide et — hemen çözmeye çalışma.',
    contraindicated: [],
  },
  {
    id: 'CFT',
    name: 'Şefkat Odaklı Terapi',
    category: 'duygu',
    description: 'Öz-şefkat geliştirerek utanç ve öz-eleştiri döngüsünü kırar.',
    when_to_use: ['öz_eleştiri', 'mükemmeliyetçilik', 'kendini_suçlama', 'utanç'],
    prompt_hint: 'GİRİŞ: Öz eleştiri veya utanç var — kişi kendine çok sert davranıyor. DİL: "Bir arkadaşın aynı şeyi yaşasaydı, ona ne söylerdin?" / "Bu sesi duyduğunda bedeninde nerede hissediyorsun?" ÇIKIŞ: Kişi kendine şefkat göstermeye başladığında pekiştir — "Bu bakış açısı nasıl hissettiriyor?"',
    contraindicated: [],
  },
  {
    id: 'GRIEF',
    name: 'Yas ve Kayıp Çalışması',
    category: 'duygu',
    description: 'Kaybın yasını doğal sürecinde destekler ve anlam bulmaya yardımcı olur.',
    when_to_use: ['kayıp', 'yas', 'ayrılık', 'iş_kaybı', 'kimlik_kaybı'],
    prompt_hint: 'GİRİŞ: Kayıp söz konusu — ilk anda sadece varlık. DİL: "Buradayım." / "[isim] hakkında bir şey anlatmak ister misin?" / "İstersen sessizce de oturabiliriz." ÇIKIŞ: Yasın aşamalarına sokma. "Zamanla geçer", "şimdi iyi yerlerde", "güçlü ol" — hiçbiri. Sadece eşlik et.',
    contraindicated: [],
  },
  {
    id: 'INNER_CHILD',
    name: 'İç Çocuk Çalışması',
    category: 'duygu',
    description: 'Çocukluk yaralarına şefkatle yaklaşarak değersizlik ve utanç izlerini iyileştirir.',
    when_to_use: ['çocukluk_travması', 'ebeveyn_yarası', 'değersizlik_hissi'],
    prompt_hint: 'O küçük çocuğa ne söylemek isterdin? Nazikçe sor.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu'],
  },

  // ─── Derin Psikoloji ─────────────────────────────────────────────────────
  {
    id: 'PSYCHODYNAMIC',
    name: 'Psikanalitik / Psikdinamik Terapi',
    category: 'derin',
    description: 'Bilinçdışı örüntüleri ve geçmiş ilişki temsillerini keşfeder.',
    when_to_use: ['tekrarlayan_desenler', 'anlamsız_tepkiler', 'geçmiş_bağlantısı'],
    prompt_hint: '"Bu tepki seni başka bir zamana, başka bir yere götürüyor mu?" diye sor.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu'],
  },
  {
    id: 'SCHEMA',
    name: 'Şema Terapisi',
    category: 'derin',
    description: 'Erken dönem uyumsuz şemaları keşfederek köklü inanç sistemlerini dönüştürür.',
    when_to_use: ['derin_inanç_sistemi', 'yeterli_değilim', 'terk_edilme_korkusu'],
    prompt_hint: 'GİRİŞ: Kişi köklü bir inançtan konuşuyor ("hep böyle olur", "kimse sevmez beni", "başaramam"). DİL: "Bu inanç ne zamandan beri sende? İlk ne zaman böyle hissettin?" ÇIKIŞ: Yeni kullanıcıda veya kriz anında bu tekniğe girme — zemin henüz yok.',
    contraindicated: ['yeni_kullanici'],
  },
  {
    id: 'IFS',
    name: 'İç Aile Sistemi',
    category: 'derin',
    description: 'İç parçaları keşfederek çatışan dürtüleri bütünleştirir.',
    when_to_use: ['çatışan_duygular', 'iç_ses', 'çelişki'],
    prompt_hint: 'GİRİŞ: Çatışan duygular var — "bir yandan istiyorum, bir yandan korkuyorum." DİL: "Sende şu an bu kararı veren parça kim? O parça ne diyor?" / "Karşı çıkan parçaya sor: \'Seni ne endişelendiriyor?\'" ÇIKIŞ: Yeni kullanıcıda veya kriz anında girme. Zemin ve güven şart.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu'],
  },
  {
    id: 'GESTALT',
    name: 'Gestalt Terapisi',
    category: 'derin',
    description: 'Şu anki farkındalığı ve tamamlanmamış yaşantıları işlemek için anlık deneyimi kullanır.',
    when_to_use: ['şu_an_odaklanma', 'tamamlanmamış_iş', 'bastırılmış_duygu'],
    prompt_hint: '"Şu an, bu anda ne oluyor? Ne hissediyorsun tam şu an?"',
    contraindicated: [],
  },
  {
    id: 'EXISTENTIAL',
    name: 'Varoluşçu Terapi',
    category: 'derin',
    description: 'Anlam, özgürlük ve ölümlülük temalarını keşfederek varoluşsal kaygıyı dönüştürür.',
    when_to_use: ['anlamsızlık', 'varoluş_kaygısı', 'ölüm_korkusu', 'özgürlük_sorunu'],
    prompt_hint: '"Sence hayatında neyin önemi var? Gerçekten?" diye sor.',
    contraindicated: ['stabilizasyon_modu'],
  },
  {
    id: 'LOGOTHERAPY',
    name: 'Logoterapi (Frankl)',
    category: 'derin',
    description: 'Acı ve zorluğun içinde anlam bularak yaşam gücünü yeniden keşfeder.',
    when_to_use: ['anlamsızlık', 'umutsuzluk', 'neden_yaşıyorum'],
    prompt_hint: '"Bu acıdan bir anlam çıkarılabilse, ne olurdu?" diye sor.',
    contraindicated: ['stabilizasyon_modu', 'akut_kriz'],
  },

  // ─── Beden / Fizyoloji ───────────────────────────────────────────────────
  {
    id: 'SOMATIC',
    name: 'Somatik Deneyimleme',
    category: 'beden',
    description: 'Travmanın bedende tutulumunu serbest bırakarak sinir sistemini düzenler.',
    when_to_use: ['bedensel_semptom', 'travma', 'donma_tepkisi', 'panik'],
    prompt_hint: '"Bu duyguyu şu an bedeninde nerede hissediyorsun?" diye sor.',
    contraindicated: [],
  },
  {
    id: 'MINDFULNESS',
    name: 'Farkındalık & Beden Taraması',
    category: 'beden',
    description: 'Beden taraması ve farkındalık pratiğiyle zihni şu ana getirir.',
    when_to_use: ['dağınıklık', 'kaygı', 'zihinden_uzaklaşma'],
    prompt_hint: 'GİRİŞ: Kaygı, dağınıklık ya da şu andan kopukluk var. DİL: "Şu an ayaklarını yere bas. Bir nefes al. Bedeninde ne hissediyorsun?" ÇIKIŞ: 2-3 cümle yeter — uzun rehberlik yapma. Kişi geri geldiğinde konuya dön.',
    contraindicated: [],
  },
  {
    id: 'BREATHING',
    name: 'Nefes Protokolleri',
    category: 'beden',
    description: 'Nefes egzersizleriyle otonom sinir sistemini sakinleştirir.',
    when_to_use: ['panik', 'anksiyete', 'nefes_sıkışması', 'stabilizasyon_gerekli'],
    prompt_hint: '"Şu an benimle birlikte bir nefes alalım mı? Dörde kadar say..." şeklinde yönlendir.',
    contraindicated: [],
  },
  {
    id: 'EMDR',
    name: 'EMDR Prensipleri',
    category: 'beden',
    description: 'Göz hareketleri ve bilateral uyarım yoluyla travmatik anıları yeniden işler.',
    when_to_use: ['travma', 'PTSD', 'takılı_kalmış_anı'],
    prompt_hint: 'O anıya nazikçe git. "O an aklına geldiğinde bedeninde ne oluyor?" diye sor.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu'],
  },
  {
    id: 'SOMATIC_EMDR',
    name: 'Somatik EMDR',
    category: 'beden',
    description: 'Somatik farkındalığı EMDR ile birleştirerek bedensel travma tutulumunu işler.',
    when_to_use: ['travma', 'bedensel_travma_tutulumu'],
    prompt_hint: 'Hem anıya hem bedene odaklan. Travmatik anı + beden hissi birlikte işle.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu'],
  },

  // ─── Davranış / Eylem ────────────────────────────────────────────────────
  {
    id: 'BEHAVIORAL_ACTIVATION',
    name: 'Davranışsal Aktivasyon',
    category: 'davranis',
    description: 'Eylemsizlik döngüsünü kırarak küçük aktivitelerle ruh halini iyileştirir.',
    when_to_use: ['depresyon', 'eylemsizlik', 'çekilme', 'motivasyon_yok'],
    prompt_hint: '"Bugün çok küçük bir şey — gerçekten çok küçük — ne yapabilirsin?" diye sor.',
    contraindicated: [],
  },
  {
    id: 'EXPOSURE',
    name: 'Maruz Kalma Prensipleri',
    category: 'davranis',
    description: 'Kaçınma döngüsünü kademeli maruz kalmayla kırarak korkuyu söndürür.',
    when_to_use: ['fobi', 'kaçınma', 'OCD', 'sosyal_anksiyete'],
    prompt_hint: '"Bu durumdan kaçmak onu daha büyük yapıyor. Küçük bir adım atmak nasıl hissettirirdi?" diye sor.',
    contraindicated: ['stabilizasyon_modu'],
  },
  {
    id: 'PROBLEM_SOLVING',
    name: 'Problem Çözme Terapisi',
    category: 'davranis',
    description: 'Pratik sorunları adım adım çözme becerisi geliştirerek çaresizliği azaltır.',
    when_to_use: ['pratik_sorun', 'karar_verememe', 'çıkmaz'],
    prompt_hint: '"Bu sorunu küçük parçalara ayıralım. İlk adım ne olabilir?" diye sor.',
    contraindicated: [],
  },
  {
    id: 'SPACED_REPETITION',
    name: 'Aralıklı Tekrar',
    category: 'davranis',
    description: 'Yeni becerilerin pekişmesi için aralıklı tekrar planı oluşturur.',
    when_to_use: ['yeni_beceri', 'alışkanlık_oluşturma'],
    prompt_hint: '"Bu beceriyi 3 gün sonra, sonra 7 gün sonra tekrar deneyelim." şeklinde plan yap.',
    contraindicated: [],
  },
  {
    id: 'HABIT_REDESIGN',
    name: 'Alışkanlık Yeniden Tasarımı',
    category: 'davranis',
    description: 'Alışkanlık döngüsünü (tetikleyici-tepki-ödül) analiz ederek olumsuz kalıpları değiştirir.',
    when_to_use: ['kötü_alışkanlık', 'döngü_kırma', 'tekrarlayan_davranış'],
    prompt_hint: '"Bu döngüde tetikleyici ne? Tepki ne? Ödül ne? Ödülü koruyup tepkiyi değiştirebilir miyiz?"',
    contraindicated: [],
  },

  // ─── Pozitif / Anlam ─────────────────────────────────────────────────────
  {
    id: 'POSITIVE_PSYCH',
    name: 'Pozitif Psikoloji',
    category: 'pozitif',
    description: 'Güçlü yönlere, minnete ve anlam duygusu geliştirmeye odaklanır.',
    when_to_use: ['güç_odaklı', 'minnet', 'anlam_arayışı'],
    prompt_hint: '"Bu hafta seni küçük de olsa iyi hissettiren bir an var mıydı?" diye sor.',
    contraindicated: [],
  },
  {
    id: 'PTG',
    name: 'Travma Sonrası Büyüme',
    category: 'pozitif',
    description: 'Travmatik deneyimlerin ardından kişisel büyüme ve anlam bulmayı destekler.',
    when_to_use: ['iyileşme_sürecinde', 'travma_sonrası', 'anlam_arayışı'],
    prompt_hint: '"Bu deneyim sana bir şey öğrettiyse, ne öğretti?" diye sor — sadece kişi hazırsa.',
    contraindicated: ['akut_kriz', 'taze_travma'],
  },
  {
    id: 'VALUES_CLARIFICATION',
    name: 'Değerler Netleştirme',
    category: 'pozitif',
    description: 'Kişisel değerleri netleştirerek yön kaybı ve karar krizlerini çözer.',
    when_to_use: ['yön_kaybı', 'anlamsızlık', 'karar_krizleri'],
    prompt_hint: '"Hayatında gerçekten önemli olan 3 şey olsaydı, ne olurdu?"',
    contraindicated: [],
  },
  {
    id: 'FUTURE_SELF',
    name: 'Gelecek Benlik Görselleştirme',
    category: 'pozitif',
    description: 'Gelecekteki olumlu benliği görselleştirerek motivasyon ve umut oluşturur.',
    when_to_use: ['motivasyon_eksikliği', 'yön_kaybı', 'büyüme_modu'],
    prompt_hint: '"5 yıl sonra, bu sorunları aşmış biri olarak ne yapıyorsun?" diye sor.',
    contraindicated: ['stabilizasyon_modu'],
  },
  {
    id: 'STRENGTHS_BASED',
    name: 'Güç Temelli Terapi',
    category: 'pozitif',
    description: 'Kişinin güçlü yönlerini ve geçmiş başarılarını kullanarak özgüveni yeniden inşa eder.',
    when_to_use: ['özgüven_sorunu', 'güçsüzlük_hissi'],
    prompt_hint: 'Profildeki güçlü yönleri kullan. "Bu durumu daha önce aşmıştın — nasıl yapmıştın?"',
    contraindicated: [],
  },

  // ─── Kriz & Travma ───────────────────────────────────────────────────────
  {
    id: 'TRAUMA_INFORMED',
    name: 'Travma Bilinçli Yaklaşım',
    category: 'kriz',
    description: 'Travma geçmişine duyarlı, güvenli ve kontrollü bir terapötik ortam oluşturur.',
    when_to_use: ['her_zaman'],
    prompt_hint: 'GİRİŞ: Her zaman arka planda aktif — travma açılmasında öne çık. DİL: "Anlatmana gerek yok. Ama buradayım." / "Kontrol sende — ne kadar anlatmak istersen." ÇIKIŞ: Ayrıntı isteme. Pace\'i kişi belirler. Travmayı çözdürmeye çalışma.',
    contraindicated: [],
  },
  {
    id: 'CRISIS_STABILIZATION',
    name: 'Kriz Stabilizasyonu',
    category: 'kriz',
    description: 'Akut kriz anında güvenli alan ve stabilizasyon sağlar.',
    when_to_use: ['akut_kriz', 'yoğun_duygu', 'stabilizasyon_modu'],
    prompt_hint: 'GİRİŞ: Kriz sinyali geldiğinde hemen devreye gir. DİL: "Şu an buradayım. Nefes alalım mı birlikte?" / "Güvende misin şu an?" ÇIKIŞ: Stabilizasyon sağlandıktan sonra — kişi hazırsa çok yavaşça ilerle. Çözüm veya analiz değil.',
    contraindicated: [],
  },
];

/**
 * Verilen duruma uygun teknikleri filtreler.
 *
 * @param {string} situation - Boşlukla ayrılmış durum etiketleri
 *   (örn. "tekrarlayan_desenler kaygı yeni_kullanici")
 * @param {string} [healingStyle] - Opsiyonel: kişisel iyileşme stili etiketi
 * @returns {Object[]} Uygun teknikler dizisi
 */
export function getTechniquesForSituation(situation, healingStyle) {
  const tags = situation
    ? situation.split(/\s+/).filter(Boolean)
    : [];

  return TECHNIQUES.filter((technique) => {
    // Kontrendike mi? Herhangi bir tag eşleşiyorsa hariç tut.
    const isContraindicated = technique.contraindicated.some((contra) =>
      tags.includes(contra)
    );
    if (isContraindicated) return false;

    // "her_zaman" teknikleri her zaman dahil et (kontrendike değilse).
    if (technique.when_to_use.includes('her_zaman')) return true;

    // Durum etiketlerinden herhangi biri when_to_use ile eşleşiyor mu?
    return technique.when_to_use.some((tag) => tags.includes(tag));
  });
}

/**
 * Teknikleri etkinlik verilerine göre sıralar (azalan oran).
 *
 * @param {Object[]} techniquesList - Teknik nesneleri dizisi
 * @param {Array<{technique_id: string, used_count: number, positive_responses: number}>} effectivenessData
 * @returns {Object[]} Sıralanmış teknikler dizisi
 */
export function rankTechniques(techniquesList, effectivenessData = []) {
  const ratioMap = new Map();

  for (const entry of effectivenessData) {
    if (entry.used_count > 0) {
      ratioMap.set(entry.technique_id, entry.positive_responses / entry.used_count);
    }
  }

  return [...techniquesList].sort((a, b) => {
    const ratioA = ratioMap.has(a.id) ? ratioMap.get(a.id) : 0.5;
    const ratioB = ratioMap.has(b.id) ? ratioMap.get(b.id) : 0.5;
    return ratioB - ratioA; // azalan sıralama
  });
}
