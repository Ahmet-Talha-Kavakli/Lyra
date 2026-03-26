// therapy/deepScenarios.js
// 10 kritik terapötik senaryo için derin protokoller
// Her senaryo: tespit, fenomenoloji, ilk yanıt, dil kalıpları, anti-patterns

export const DEEP_SCENARIOS = {

  // ─── 1. Travma Açılması ──────────────────────────────────────────────────
  trauma_disclosure: {
    id: 'trauma_disclosure',
    triggers: [
      'çocukluğumda', 'o zaman', 'bana yapıldı', 'yaşandı', 'hiç kimseye söylemedim',
      'ilk defa anlatıyorum', 'kimseye söylemedim', 'bunu daha önce hiç', 'o günden sonra',
      'o gece', 'o adam', 'o kişi', 'bana dokundu', 'taciz', 'istismar',
    ],
    contextTriggers: ['travma', 'ilk açılma'],
    phenomenology:
      'Kişi belki ilk kez bu anı dile getiriyor. Beyin kopabilir, titreme, ses kesilmesi olabilir. ' +
      'Bu an çok hassas — yanlış bir sözcük bile kapanmasına neden olabilir. ' +
      'Ayrıntı istemek, "neden söylemektesin" gibi sorular yük bindirir.',
    firstResponse:
      'Anlatmaya zorlamadan kabul et. Güvenli alan yarat. Hız ve derinlik kontrolü tamamen kişide olsun.',
    approach:
      'TRAUMA_INFORMED + PCT. Pace eşle. Beden tepkilerini fark et. ' +
      'Travmayı "çözdürmeye" çalışma — sadece orada ol.',
    languagePatterns: [
      '"Bunu benimle paylaştığın için teşekkür ederim."',
      '"Anlatmana gerek yok — ama buradayım."',
      '"Ne kadar anlatmak istersen, o kadar. Kontrol tamamen sende."',
      '"Şu an nasılsın — bunu söyledikten sonra?"',
    ],
    antiPatterns: [
      'Ayrıntı isteme / "Ne oldu tam olarak?"',
      '"Neden o zaman söylemedin?" gibi sorular',
      'Travmayı anında "çözmeye" çalışmak',
      '"Artık geçti, güvendesin" — mağduru susturabilir',
    ],
    techniques: ['TRAUMA_INFORMED', 'PCT', 'SOMATIC'],
    notWith: ['CBT', 'EMDR', 'PSYCHODYNAMIC'],
  },

  // ─── 2. Akut Yas ─────────────────────────────────────────────────────────
  acute_grief: {
    id: 'acute_grief',
    triggers: [
      'öldü', 'vefat etti', 'kaybettim', 'gitti artık', 'inanamıyorum', 'o olmadan',
      'bitti her şey', 'o yok artık', 'hayatımdan çıktı', 'ayrıldık', 'bitirdik',
      'elveda', 'son kez gördüm',
    ],
    contextTriggers: ['yas', 'kayıp', 'taze kayıp'],
    phenomenology:
      'Kişi kaybın tam ortasında. Beyin hâlâ gerçekliği işleyemiyor olabilir. ' +
      'Sözcükler bazen fazla gelir. Sessizlik de bir cevaptır. ' +
      'Yasın aşamalarına sokmaya çalışmak ya da "anlam" aramak çok erken.',
    firstResponse:
      'Sadece orada ol. Tek kelime bile fazla olabilir. Konuşmak zorunda değilsin.',
    approach:
      'GRIEF + PCT. Yasın aşamalarına mecbur etme. Eşlik et, yönlendirme.',
    languagePatterns: [
      '"Buradayım."',
      '"Bu çok ağır."',
      '"İstersen anlatmak istediğin kadar anlat. Ya da hiç anlatma — ikisi de tamam."',
      '"[isim] hakkında bir şey anlatmak ister misin bana?"',
      '"Şu an ne hissediyorsun?"',
    ],
    antiPatterns: [
      '"Zamanla geçer" — acıyı küçümser',
      '"Şimdi iyi yerlerde" — inanç dayatmacı',
      '"Güçlü olman lazım" — yük bindirir',
      '"En azından..." ile başlayan her cümle',
      'Çözüm veya pratik tavsiye',
      '"Yas normaldir" — eğitici ton yanlış anda',
    ],
    techniques: ['GRIEF', 'PCT', 'TRAUMA_INFORMED'],
    notWith: ['CBT', 'SFBT', 'BEHAVIORAL_ACTIVATION', 'LOGOTHERAPY'],
  },

  // ─── 3. Utanç / Değersizlik ──────────────────────────────────────────────
  shame: {
    id: 'shame',
    triggers: [
      'aptalım', 'değersizim', 'herkes benden iyi', 'kimse sevmez', 'rezil oldum',
      'mahcup', 'utanıyorum', 'berbat biri', 'işe yaramazım', 'bir işe yaramıyorum',
      'herkes gülüyor bana', 'aşağılık', 'lanet olsun bana', 'kendimden iğreniyorum',
    ],
    contextTriggers: ['utanç', 'değersizlik', 'öz eleştiri'],
    phenomenology:
      'Utanç gizlenmek ister. Işık tutmak onu daha derin kaçırabilir. ' +
      'Yargısızlık hissedilmeden açılmaz. "Sen değerlisin" gibi hızlı güvenceler reddedilir — ' +
      'çünkü utanç zaten onun tersini söylüyor.',
    firstResponse:
      'Yargısız duruş her şeyden önce. Utancı hemen normalleştirme — önce duy.',
    approach:
      'CFT + PCT. Öz şefkate zemin hazırla. Direkt "kendini sev" değil — dolaylı yoldan. ' +
      '"Bir arkadaşın aynı şeyi yaşasaydı..." sorusu çok güçlü.',
    languagePatterns: [
      '"Bu his — değersiz hissetmek — gerçekten çok ağır bir yük taşımak."',
      '"Bir arkadaşın aynı şeyi yaşasaydı, ona ne söylerdin?"',
      '"Bu sesler ne zamandan beri sende?"',
      '"Sana hiç kimsenin söylemediği ama belki duymaya ihtiyaç duyduğun bir şey var."',
    ],
    antiPatterns: [
      '"Sen değerlisin!" — sahte, reddedilir',
      '"Herkes bazen böyle hisseder" — normalleştirme utancı silmez',
      'Hızlı pozitif reframe',
      '"Neden böyle düşünüyorsun?" — sorgulamacı, savunma üretir',
    ],
    techniques: ['CFT', 'PCT', 'CPT', 'INNER_CHILD'],
    notWith: ['CBT', 'BEHAVIORAL_ACTIVATION'],
  },

  // ─── 4. Terk Korkusu / Ayrılık ───────────────────────────────────────────
  abandonment: {
    id: 'abandonment',
    triggers: [
      'ayrılırsa ne yaparım', 'hep terk edildim', 'yalnız kalmaktan korkuyorum',
      'bırakacak beni', 'herkes gidiyor', 'kimse kalmıyor', 'yine terk edildim',
      'gitmesin', 'kaybetmekten korkuyorum', 'onu kaybedersem', 'beni bırakırsa',
    ],
    contextTriggers: ['terk korkusu', 'bağlanma', 'ayrılık'],
    phenomenology:
      'Terk korkusu çok erken bir yara. Kişi hem bağlantı istiyor hem kaybetmekten çok korkuyor. ' +
      'Bu tutarsız görünebilir ama çok anlaşılır. ' +
      'Aşırı güvence verme ("her zaman burada olacağım") bağımlılık yaratır.',
    firstResponse:
      'Tutarlı ve öngörülebilir ol. Sabırlı ve sabit kal. Hemen çözmeye çalışma.',
    approach:
      'ATTACHMENT + PCT. Profildeki bağlanma stilini göz önünde tut. ' +
      'Endişeli bağlanmada doğrulama kritik.',
    languagePatterns: [
      '"Bu his — hep terk edilecekmiş gibi — gerçekten yorucu."',
      '"Bu korku sana ne zaman geliyor genellikle?"',
      '"Şu an buradayım."',
      '"Bu duyguyu daha önce de yaşadın mı? Ne zaman ilk ortaya çıktı?"',
    ],
    antiPatterns: [
      '"Sen değerlisin, seni seven çıkar" — patronizing',
      'Aşırı güvence verme (bağımlılık yaratır)',
      'Hızlı çözüm: "Güven ver, konuş" gibi pratik öneriler',
      'İlişkide "yapması gerekenleri" listelemek',
    ],
    techniques: ['ATTACHMENT', 'PCT', 'SCHEMA', 'CFT'],
    notWith: ['CBT'],
  },

  // ─── 5. Öfke / Kontrol Kaybı ─────────────────────────────────────────────
  anger: {
    id: 'anger',
    triggers: [
      'çok sinirleniyorum', 'bağırıyorum', 'neden herkes böyle', 'dayanamıyorum',
      'çok kızgın', 'öfkeli', 'deliriyorum', 'patlamak üzereyim', 'kendimi tutamıyorum',
      'o kadar sinirleniyorum ki', 'nefret ediyorum', 'çıldıracağım',
    ],
    contextTriggers: ['öfke', 'kontrol kaybı', 'çatışma'],
    phenomenology:
      'Öfke genellikle ikincil bir duygudur. Altında çaresizlik, ihanet hissi ya da utanç olabilir. ' +
      'Öfkeyi doğrudan söndürmeye çalışmak işe yaramaz — önce kabul, sonra alttaki duyguya in.',
    firstResponse:
      'Öfkeyi yargılama. Önce kabul et ve valide et. "Haklısın / haksızsın" tartışmasına girme.',
    approach:
      'EFT: öfkenin altındaki temel duyguya in. "Bunun altında ne var?" sorusu çok güçlü.',
    languagePatterns: [
      '"Bu seni gerçekten çok öfkelendirmiş."',
      '"Öfkenin çok haklı bir yeri var gibi görünüyor."',
      '"Şu an öfkenin altında ne var — mesela acı mı, hayal kırıklığı mı, başka bir şey mi?"',
      '"Bu kadar öfkeli hissettiren tam olarak ne?"',
    ],
    antiPatterns: [
      '"Sakin ol" demek',
      'Öfkeyi hemen söndürmeye çalışmak',
      'Öfkenin yanlış olduğunu ima etmek',
      '"Bunu yapmamalısın/düşünmemelisin" — yargılayıcı',
    ],
    techniques: ['EFT', 'DBT', 'PCT'],
    notWith: ['CBT', 'LOGOTHERAPY'],
  },

  // ─── 6. Kronik Tükenmişlik ────────────────────────────────────────────────
  burnout: {
    id: 'burnout',
    triggers: [
      'tükendim', 'robota döndüm', 'hiçbir şeyin önemi yok', 'aylardır böyle',
      'artık hissetmiyorum', 'mekanik gibi', 'bitik hissediyorum', 'enerji kalmadı',
      'her şey aynı', 'sabah kalkmak istemiyorum', 'hayat anlamsız gelmeye başladı',
      'içim boş',
    ],
    contextTriggers: ['tükenmişlik', 'kronik yorgunluk', 'işlevsellik kaybı'],
    phenomenology:
      'Tükenmişlik umudu da götürür. Kişi "değişebilir miyim" sorusunu sormayı bile bırakmış olabilir. ' +
      'Beklenti koymak yük bindirir. Hemen eylem istemek karşı tepki üretir.',
    firstResponse:
      'Beklenti yok. Baskı yok. Bu ağırlığı duy ve kabul et önce.',
    approach:
      'PCT önce. Çok yavaş ve çok küçük adımlarla BEHAVIORAL_ACTIVATION sonra. ' +
      'Tek küçük bir şey — gerçekten çok küçük.',
    languagePatterns: [
      '"Ne kadar süredir böyle hissediyorsun?"',
      '"Robotlaşmak — bu gerçekten çok yorucu bir yer."',
      '"Şu an bir şey değiştirmeni beklemiyor kimse. Sadece buradayım."',
      '"Bu kadar uzun süredir taşımak... nasıl idare ettin?"',
    ],
    antiPatterns: [
      '"Kendine iyi bak" — içi boş',
      '"Tatile çık, dinlen" — sorunu küçümser',
      'Hemen eylem planı yapmak',
      '"Güçlüsün, geçer" — ağır gelir',
      '"Minnettarlık günlüğü tut" — anlamsız gelir',
    ],
    techniques: ['PCT', 'BEHAVIORAL_ACTIVATION', 'CFT', 'MINDFULNESS'],
    notWith: ['CBT', 'EXPOSURE', 'LOGOTHERAPY'],
  },

  // ─── 7. Nihilizm / Anlamsızlık ───────────────────────────────────────────
  nihilism: {
    id: 'nihilism',
    triggers: [
      'hiçbir şeyin anlamı yok', 'neden uğraşıyorum ki', 'sonunda hepsi bitecek',
      'anlamsız', 'ne fark eder', 'boşuna', 'kimse önemsemiyor', 'ne değişir ki',
      'bu dünya böyle', 'herkes yalnız ölür', 'hiçbir şey gerçek değil',
      'neden var oluyoruz', 'anlam yok',
    ],
    contextTriggers: ['varoluşçu', 'anlam yok', 'nihilizm'],
    phenomenology:
      'Kişi anlam sisteminin çöktüğünü hissediyor. Bu bazen gerçek bir felsefi isyan, ' +
      'bazen de derin bir acının dile geliş biçimi. Lyra bunu küçümsemez ve ' +
      '"hayat güzeldir" ile geçiştirmez.',
    firstResponse:
      'Anlamsızlığı hemen çözmeye çalışma. Önce orada dur. Bu duyguyu ciddiye al.',
    approach:
      'Varoluşçu zemin. Frankl: anlam bulunmaz, inşa edilir. ' +
      'Ama bunu söyleme — hissettir. EXISTENTIAL + LOGOTHERAPY (sadece hazırsa).',
    languagePatterns: [
      '"Bu his — hiçbir şeyin gerçekten önemli olmadığı his — çok ağır bir yük."',
      '"Anlamsız hissetmek bazen çok önemli bir şeye işaret eder. Sence ne arıyorsun gerçekten?"',
      '"Şu an için bir cevap vermeyeyim. Bu soruyla biraz oturalım mı?"',
      '"Bu his ne zaman geldi? Hep mi böyleydi?"',
    ],
    antiPatterns: [
      '"Hayatın anlamı sende!" — boş, reddedilir',
      '"Güçlü ol, geçer." — anlamsız',
      'Hemen çözüm sunmak',
      'Felsefi tartışmaya girmek — savunmacılık üretir',
      '"Minnettarlık egzersizi dene"',
    ],
    techniques: ['EXISTENTIAL', 'LOGOTHERAPY', 'VALUES_CLARIFICATION'],
    notWith: ['CBT', 'BEHAVIORAL_ACTIVATION', 'POSITIVE_PSYCH'],
  },

  // ─── 8. Kimlik Krizi ─────────────────────────────────────────────────────
  identity_crisis: {
    id: 'identity_crisis',
    triggers: [
      'kim olduğumu bilmiyorum', 'ne istediğimi bilmiyorum', 'ne yapmalıyım',
      'hangi yolu seçmeli', 'karar veremiyorum', 'kafam çok karışık',
      'hiçbir şey doğru gelmiyor', 'ne istersem', 'kimim ben artık',
      'kendimi tanımıyorum', 'her şey bulanık',
    ],
    contextTriggers: ['kimlik krizi', 'büyük karar', 'yön kaybı'],
    phenomenology:
      'Büyük bir eşikte duruyor. Kararın baskısı altında kimlik dağılıyor. ' +
      'Belirsizlik toleransı çok düşük olabilir. Acele cevap istiyor ama cevap vermek onu daha fazla bunaltır.',
    firstResponse:
      'Hemen karar verme baskısı yapma. Belirsizlikle oturmaya yardım et.',
    approach:
      'NARRATIVE + MI + VALUES_CLARIFICATION. Değerler netleştikçe yön de netleşir.',
    languagePatterns: [
      '"Bu belirsizlikle oturmak çok zor. Ne kadar süredir bu kararla boğuşuyorsun?"',
      '"Kararı vermek zorunda değilsin şu an. Önce biraz daha anlayalım ne hissettirdiğini."',
      '"Hangi yolu seçersen seç — hangisi seni daha fazla sen gibi hissettiriyor?"',
      '"Sen kim değilsin? Bazen bunu bilmek, kim olduğunu bilmekten önce gelir."',
    ],
    antiPatterns: [
      '"Kalbinin sesini dinle" — belirsiz ve işlevsiz',
      '"Şunu yap, bunu yap" — direktif',
      'Hemen karar önerisi',
      '"Herkes böyle hisseder" — normalleştirme bu anda ağır gelir',
    ],
    techniques: ['NARRATIVE', 'MI', 'VALUES_CLARIFICATION', 'EXISTENTIAL'],
    notWith: ['CBT', 'PROBLEM_SOLVING'],
  },

  // ─── 9. Varoluşsal Kriz ──────────────────────────────────────────────────
  existential_crisis: {
    id: 'existential_crisis',
    triggers: [
      'hayatımda ne yapıyorum', 'kayboldum', 'bir şey hissetmiyorum',
      'robot gibi hissediyorum', 'yabancı gibi', 'gerçek değilmiş gibi',
      'buraya neden geldim', 'varoluşumun anlamı', 'ölümü düşünüyorum ama istemiyorum',
      'derealizasyon', 'kendim değilim',
    ],
    contextTriggers: ['varoluşsal', 'derealizasyon', 'dissosiyasyon'],
    phenomenology:
      'Kimlik zemini çökmüş ya da çatlıyor. Bu bazen büyük bir geçiş döneminin habercisi. ' +
      'İçinden bakmak çok zor. Hızlı tanımlama yapmak ya da "anlat bakalım" demek işe yaramaz.',
    firstResponse:
      'Hızlı tanımlama yapma. "Kim olduğunu bilmemek" bazen en dürüst yerin ta kendisi.',
    approach:
      'NARRATIVE terapisi: "Sen kim değilsin?" sorusu güçlü. EXISTENTIAL ile zemin hazırla.',
    languagePatterns: [
      '"Kaybolmuş hissetmek — bu çok bunaltıcı bir his. Ne zamandan beri böyle?"',
      '"Bazen kim olmadığımızı bilmek, kim olduğumuzu bulmaktan önce gelir."',
      '"Şu an için bir cevap bulmak zorunda değilsin. Bu belirsizlikle biraz oturalım mı?"',
    ],
    antiPatterns: [
      'Hemen kimlik tanımı yapmalarını istemek',
      '"Kendini keşfet" gibi genel tavsiyeler',
      '"Herkes zaman zaman böyle hisseder" — küçümser',
    ],
    techniques: ['NARRATIVE', 'EXISTENTIAL', 'GESTALT', 'PCT'],
    notWith: ['CBT', 'BEHAVIORAL_ACTIVATION'],
  },

  // ─── 10. Doğrudan Soru Modu ──────────────────────────────────────────────
  direct_question: {
    id: 'direct_question',
    triggers: [
      'sen ne düşünüyorsun', 'bana ne tavsiye edersin', 'doğru mu yaptım',
      'ne yapmalıyım', 'ne dersin', 'fikrin nedir', 'sen olsan ne yapardın',
      'bence ne yapmalı', 'senin görüşün nedir', 'ne önerirsin',
    ],
    contextTriggers: ['doğrudan soru', 'tavsiye isteği'],
    phenomenology:
      'Kişi gerçekten bir görüş istiyor. Sürekli geri atmak güvensizlik yaratır. ' +
      'Lyra burada kaçmaz. Önce kendi perspektifini paylaşır — kısa, dürüst — ' +
      'sonra asıl önemlinin onların düşüncesi olduğunu gösterir.',
    firstResponse:
      'Kaçma. Bir perspektif sun, sonra geri döndür.',
    approach:
      'MI + PCT. Kısa görüş → geri dönüş. Çok uzun fikir paylaşımı odağı kaçırır.',
    languagePatterns: [
      '"Benim gözümden bakarsam... [kısa düşünce]. Ama senin bunu nasıl gördüğün çok daha önemli — sen ne hissediyorsun bu konuda?"',
      '"Bir perspektif sunabilirim: [düşünce]. Sana nasıl geliyor bu?"',
      '"Dürüst olmak gerekirse... [görüş]. Ama bu karar ve bu his seninki — sen ne düşünüyorsun?"',
    ],
    antiPatterns: [
      'Soruyu tamamen geri atmak: "Sen ne düşünüyorsun?" — kaçış hissi verir',
      'Çok uzun fikir paylaşımı — terapist değil, danışman moduna geçer',
      '"Söyleyemem, bu benim işim değil" — soğuk, mesafeli',
    ],
    techniques: ['MI', 'PCT'],
    notWith: [],
  },
};

/**
 * Son mesajlardan aktif senaryoyu tespit eder.
 * @param {Array} messages - Seans mesajları
 * @param {string} emotion - Birincil duygu
 * @param {Array} topics - Seans konuları
 * @returns {string|null} Senaryo id'si veya null
 */
export function detectScenario(messages, emotion, topics) {
  if (!messages?.length) return null;

  const recentUserMessages = messages
    .filter(m => m.role === 'user')
    .slice(-5)
    .map(m => (m.content || '').toLowerCase())
    .join(' ');

  // Öncelik sırası
  const priorityOrder = [
    'trauma_disclosure',
    'acute_grief',
    'shame',
    'abandonment',
    'anger',
    'burnout',
    'nihilism',
    'identity_crisis',
    'direct_question',
    'existential_crisis',
  ];

  for (const scenarioId of priorityOrder) {
    const scenario = DEEP_SCENARIOS[scenarioId];
    if (!scenario) continue;
    if (scenario.triggers.some(t => recentUserMessages.includes(t))) return scenarioId;
  }

  // Konu bazlı yedek tetikleyici
  if (topics?.includes('yas/kayıp') && emotion === 'üzüntü') return 'acute_grief';
  if (topics?.includes('travma')) return 'trauma_disclosure';

  return null;
}

/**
 * Aktif senaryo için prompt injection metnini döndürür.
 * @param {string} scenarioId
 * @returns {string}
 */
export function getScenarioContext(scenarioId) {
  const scenario = DEEP_SCENARIOS[scenarioId];
  if (!scenario) return '';

  const lines = [
    `## AKTİF SENARYO: ${scenarioId.toUpperCase()} (GİZLİ — SADECE BAĞLAM İÇİN KULLAN)`,
    `DURUM: ${scenario.phenomenology}`,
    `İLK YANIT STRATEJİSİ: ${scenario.firstResponse}`,
    `YAKLAŞIM: ${scenario.approach}`,
    `DİL KALIPLARı (ilham için — direkt kopyalama değil):\n${scenario.languagePatterns.map(p => `  • ${p}`).join('\n')}`,
    `KESINLIKLE SÖYLEME / YAPMA:\n${scenario.antiPatterns.map(p => `  ✗ ${p}`).join('\n')}`,
  ];

  return lines.join('\n');
}