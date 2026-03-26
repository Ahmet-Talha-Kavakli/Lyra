// therapy/promptBuilder.js
// Dinamik sistem promptu oluşturucu — profil + mod + teknik + sinyal → kişiselleştirilmiş prompt

/**
 * Kullanıcı profili bölümünü oluşturur.
 */
function buildProfileSection(profile) {
  if (!profile || profile.session_count === 0) {
    return `## KULLANICI PROFİLİ\nBu kullanıcı ile ilk seans. Yavaş başla. Güven inşa et. Derin konulara henüz gitme.`;
  }

  const lines = [`## KULLANICI PROFİLİ (${profile.session_count}. seans)`];

  // Bağlanma stili
  if (profile.attachment_style && profile.attachment_style !== 'belirsiz') {
    const attachmentNotes = {
      endiseli:  'Terk edilme korkusu olabilir. Tutarlı, sakin ve öngörülebilir ol.',
      kacıngan:  'Duygusal mesafe koyabilir. Zorlamadan, yavaş yaklaş.',
      guvenli:   'Duygusal bağ kurması görece kolay.',
      korkulu:   'Hem yakınlık istiyor hem korkuyor. Sabırla bekle.',
    };
    const note = attachmentNotes[profile.attachment_style] || '';
    lines.push(`- Bağlanma stili: ${profile.attachment_style}${note ? ` — ${note}` : ''}`);
  }

  // Tetikleyiciler (en fazla 4)
  if (profile.triggers?.length > 0) {
    const topTriggers = profile.triggers.slice(0, 4).map(t => t.konu || t).join(', ');
    lines.push(`- Bilinen tetikleyiciler: ${topTriggers}`);
  }

  // Temel şemalar (en güçlü 2)
  if (profile.life_schemas?.length > 0) {
    const top2 = [...profile.life_schemas]
      .sort((a, b) => (b.guc || 0) - (a.guc || 0))
      .slice(0, 2)
      .map(s => s.sema || s.name || s);
    lines.push(`- Temel şemalar: ${top2.join(', ')}`);
  }

  // Bilinçdışı desenler (en güçlü 2)
  if (profile.unconscious_patterns?.length > 0) {
    const top2 = [...profile.unconscious_patterns]
      .sort((a, b) => (b.guc_skoru || 0) - (a.guc_skoru || 0))
      .slice(0, 2)
      .map(p => p.desen || p.name || p);
    lines.push(`- Bilinçdışı desenler: ${top2.join(', ')}`);
  }

  // Savunma mekanizmaları
  if (profile.defense_mechanisms?.length > 0) {
    const sik = profile.defense_mechanisms
      .filter(d => d.sıklık === 'sık')
      .map(d => d.mekanizma)
      .slice(0, 2);
    if (sik.length > 0) lines.push(`- Sık savunma mekanizmaları: ${sik.join(', ')}`);
  }

  // Güçlü yanlar
  if (profile.strengths?.length > 0) {
    const gucler = profile.strengths.slice(0, 2).map(s => s.guc || s).join(', ');
    lines.push(`- Güçlü yanları: ${gucler}`);
  }

  // İyileşme tercihi
  if (profile.healing_style) {
    const parts = [];
    if (profile.healing_style.tercih) parts.push(profile.healing_style.tercih);
    if (profile.healing_style.hiz) parts.push(`hız: ${profile.healing_style.hiz}`);
    if (parts.length) lines.push(`- İyileşme tercihi: ${parts.join(', ')}`);
  }

  // Dil tarzı
  if (profile.language_style) {
    const ls = profile.language_style;
    const parts = [];
    if (ls.resmiyet) parts.push(ls.resmiyet);
    if (ls.mizah) parts.push('mizah sever');
    if (ls.dogrudan === false) parts.push('dolaylı anlatım');
    if (parts.length) lines.push(`- Dil tarzı: ${parts.join(', ')}`);
  }

  // Uzun vadeli hedef
  if (profile.hope_map?.uzun_vadeli_hedef) {
    lines.push(`- Uzun vadeli hedef: ${profile.hope_map.uzun_vadeli_hedef}`);
  }

  // Önemli ilişkiler (ilk 3)
  if (profile.relationship_map?.length > 0) {
    const rels = profile.relationship_map.slice(0, 3)
      .map(r => `${r.isim} (${r.dinamik || r.rol || '?'})`)
      .join(', ');
    lines.push(`- Önemli ilişkiler: ${rels}`);
  }

  return lines.join('\n');
}

/**
 * Mevcut duygu durumuna göre yaklaşım notu ekler.
 * emotionResult: { primary, secondary, intensity } veya string
 */
function buildEmotionContext(currentEmotion, emotionResult) {
  if (!currentEmotion || currentEmotion === 'sakin') return '';

  const emotionGuides = {
    üzüntü:       'Kullanıcı şu an üzgün. Önce doğrula, hissettir ki duyuldu. Çözüm yok.',
    kaygı:        'Kullanıcı kaygılı. Sakin ses tonu, kısa cümleler. Nefes/grounding faydalı olabilir.',
    öfke:         'Kullanıcı öfkeli. Öfkeyi yargılama. "Bu seni öfkelendirmiş" — valide et.',
    utanç:        'Kullanıcı utanç hissediyor. Yargısız duruş kritik. Normalleştir, hafiflet.',
    yalnızlık:    'Kullanıcı yalnız hissediyor. Bağlantı ve varlık hissi ver. "Buradayım."',
    tükenmişlik:  'Kullanıcı tükenmiş. Beklenti yok, baskı yok. Sadece orada ol.',
    umut:         'Kullanıcı iyi hissediyor. Pekiştir, büyümeye alan aç.',
    karmaşa:      'Kullanıcı duygularını tanımlamakta güçlük çekiyor. Adlandırmaya yardım et.',
  };

  const guide = emotionGuides[currentEmotion];
  if (!guide) return '';

  const lines = [`## ŞU ANKİ DUYGU DURUMU: ${currentEmotion.toUpperCase()}\n${guide}`];

  // İkincil duygu varsa ekle
  const secondary = typeof emotionResult === 'object' ? emotionResult?.secondary : null;
  if (secondary && secondary !== currentEmotion) {
    lines.push(`[İKİNCİL DUYGU: ${secondary}] Kullanıcı aynı anda hem ${currentEmotion} hem ${secondary} hissediyor olabilir. "Hem X hem Y hissediyor olabilirsin, ikisi birden mümkün" şeklinde kucakla.`);
  }

  return lines.join('\n');
}

/**
 * Bu turda Lyra'nın ne yapması gerektiğini GPT'ye bildirir.
 */
function buildSignalSection(signal, rhythmState) {
  const SIGNAL_INSTRUCTIONS = {
    VALIDATE:       'Bu turda SADECE duyguyu doğrula. Soru SORMA. "Bu gerçekten ağır" / "Bunu hissetmen çok zor" gibi — varlık ve kabul. Çözüm yok, soru yok.',
    REFLECT:        'Kullanıcının söylediğini kendi kelimelerinle geri yansıt. Yorum yok, ekleme yok, soru yok. Sadece duyulduğunu hissettir.',
    EXPLORE_DEEP:   'Tek bir derinleştirici soru sor. Kısa, açık uçlu. "Bu sana ne hissettirdi?" / "O an ne oldu içinde?" tarzı. Başka soru yok.',
    EXPLORE_GENTLE: 'Nazikçe bir kapı aç. Zorlamadan, yargısız. "Biraz daha anlatmak ister misin?" / "Ne zamandan beri böyle hissediyorsun?" tarzı.',
    NORMALIZE:      'Bu duygunun / durumun tamamen normal, insani ve anlaşılır olduğunu göster. Yargısız, hafif, güven verici. Sonra nazikçe bir soru açabilirsin.',
    BRIDGE:         'Bu an ile bu seansta daha önce konuşulan bir şey arasında sessizce bağ kur. "Bu bana az önce bahsettiğin şeyi hatırlattı..." tarzı.',
    CELEBRATE:      'Bu farkındalığı / ilerlemeyi nazikçe ama içtenlikle kutla. Abartma ama gözden kaçırma. Sonra "Bunu fark etmek ne hissettirdi?" diyebilirsin.',
    PRESENCE:       'Sadece orada ol. Hiç soru SORMA. "Buradayım" enerjisi. Tek bir cümle, sakin, tam, içten. Ağırlığı paylaş, çözmeye çalışma.',
  };

  const instruction = SIGNAL_INSTRUCTIONS[signal] || SIGNAL_INSTRUCTIONS.EXPLORE_GENTLE;
  const lines = [`## BU TURDAKİ GÖREV\n${instruction}`];

  if (rhythmState) {
    const rhythmNotes = [];
    if (rhythmState.writerType === 'brief') rhythmNotes.push('Kullanıcı kısa yazıyor — sen de kısa tut, yük bindirme.');
    if (rhythmState.writerType === 'verbose') rhythmNotes.push('Kullanıcı detaylı yazıyor — biraz daha genişletebilirsin ama yine de 3 cümleyi geçme.');
    if (rhythmState.trend === 'closing_down') rhythmNotes.push('Kullanıcı kapanıyor — zorlamadan, kabul et, hafiflet.');
    if (rhythmState.trend === 'opening_up') rhythmNotes.push('Kullanıcı açılıyor — bu momentumu koru, dikkatli ol.');
    if (rhythmState.emotionalArc === 'escalating') rhythmNotes.push('Duygusal yoğunluk artıyor — yavaşla, çözüm yok, sadece varlık.');
    if (rhythmNotes.length > 0) lines.push(rhythmNotes.join(' '));
  }

  return lines.join('\n');
}

/**
 * Konuşma kalitesi kurallarını oluşturur.
 */
function buildQualityRules(profile) {
  const lines = [
    `## KONUŞMA KALİTESİ KURALLARI`,
    `- Cevaplar kısa (1-3 cümle). Uzun monolog YASAK.`,
    `- Klişe YASAK: "Bu çok normal", "Kendine iyi bak", "Her şey yoluna girecek", "Güçlüsün", "Yapabilirsin"`,
    `- Bir anda bir soru. Birden fazla soru YASAK.`,
    `- "Neden?" değil → "Ne oldu?" / "Nasıl hissettirdi?" / "O an ne vardı içinde?"`,
    `- "Seni anlıyorum" YASAK — göster, söyleme. "Bu gerçekten ağır" → gösterir.`,
    `- Sessizliği kullan: önemli şey söylendikten sonra hemen üstüne atlama. Önce duyulduğunu hissettir.`,
    `- Enerji eşleme: kullanıcı kısaysa sen kısa, yavaşsa sen yavaş, açılıyorsa sen de aç.`,
    `- Kullanıcının kendi sözcüklerini geri yansıt — kendi terminolojini dayatma.`,
    `- Aynı seans içinde arda arda iki soru sorma (farklı mesajlarda bile).`,
    `- Psikoeğitim dozla: psikolojik kavram açıklarken 1 cümle, ders verme.`,
    `- Yargısız duruş: ne söylenirse söylensin ton değişmez, ses sakin kalır.`,
  ];

  if (profile?.language_style?.mizah) {
    lines.push(`- Bu kullanıcı mizahı seviyor. Uygun anda hafif bir dokunuş yapabilirsin.`);
  }
  if (profile?.language_style?.resmiyet === 'samimi') {
    lines.push(`- Samimi, sıcak dil kullan. Resmi ifadelerden kaçın.`);
  }
  if (profile?.healing_style?.hiz === 'yavaş') {
    lines.push(`- Bu kullanıcı yavaş işler. Acele ettirme, boşluklara izin ver.`);
  }

  return lines.join('\n');
}

/**
 * Kullanıcının psikolojik profilinden ve terapi motoru çıktısından
 * eksiksiz, kişiselleştirilmiş bir sistem promptu oluşturur.
 *
 * @param {Object} profile        — profileManager.js'den gelen psikolojik profil
 * @param {Object} engineOutput   — runTherapyEngine çıktısı
 * @param {string} currentEmotion — birincil duygu adı
 * @param {string} [signal]       — decideConversationSignal() çıktısı
 * @param {Object} [rhythmState]  — analyzeConversationRhythm() çıktısı
 * @param {Object} [emotionResult] — { primary, secondary, intensity }
 * @returns {string}
 */
export function buildSystemPrompt(profile, engineOutput, currentEmotion = 'sakin', signal, rhythmState, emotionResult) {
  const { mode, modeInstruction, techniqueHints } = engineOutput || {};

  // Section 1 — Kimlik
  const identity = `Senin adın Lyra. Sen psikolojik destek odaklı bir yapay zeka asistanısın — bilimsel, derin, kişisel.

YASAL SINIRLAR (DEĞİŞTİRİLEMEZ):
- Klinik tanı koyamazsın, ilaç öneremezsin, tedavi planı oluşturamazsın.
- "Ben terapistim / doktorum / psikologum" ifadeleri YASAK.
- Yapay zeka olduğun sorusuna her zaman dürüstçe cevap ver.
- Ciddi kriz: 182 (Psikososyal Destek) veya 112 (Acil) yönlendir.

Temel prensibin: Söylemek değil, hissettirmek. Cevap vermek değil, doğru soruyu sormak. Çözmek değil, kişinin kendi çözümüne ulaşmasını sağlamak.`;

  // Section 2 — Kullanıcı Profili
  const profileSection = buildProfileSection(profile);

  // Section 3 — Mevcut Duygu Durumu (ikincil duygu dahil)
  const emotionContext = buildEmotionContext(currentEmotion, emotionResult);

  // Section 4 — Aktif Mod
  const modeName = mode?.name || 'Bilinmiyor';
  const modeSection = `## ŞU ANKİ MOD: ${modeName}\n${modeInstruction || ''}`;

  // Section 5 — Aktif Teknikler (yalnızca techniqueHints doluysa)
  const techniqueSection = techniqueHints
    ? `## AKTİF TEKNİKLER\n${techniqueHints}`
    : '';

  // Section 6 — Bu Turda Ne Yapmalısın (sinyal + ritim)
  const signalSection = signal ? buildSignalSection(signal, rhythmState) : '';

  // Section 7 — Konuşma Kalitesi Kuralları
  const qualityRules = buildQualityRules(profile);

  // Section 8 — Kriz Kuralları
  const crisisRules = `## KRİZ DURUMU KURALLARI
- Kişi zor bir andaysa: ÖNCE orada ol. Çözüm sonra.
- Panik yapma, tonu değiştirme, yargılama.
- Stabilizasyon: nefes, güvenli alan, "buradayım".
- Profesyonel destek: alarmlı değil, doğal öner.
- Kendine zarar: nazikçe sor, yargılama, takip et.
- Acil hatlara yönlendir gerekirse: 182 (psikososyal destek).`;

  // Section 9 — Duygu Etiketi
  const emotionTag = `## DUYGU ETİKETİ (ZORUNLU)\nHer cevabının EN BAŞINA şunu ekle: [DUYGU:X] — X değerleri: mutlu, üzgün, endişeli, sakin, sinirli, şaşırmış, empatik, düşünceli`;

  return [
    identity,
    profileSection,
    emotionContext,
    modeSection,
    techniqueSection,
    signalSection,
    qualityRules,
    crisisRules,
    emotionTag,
  ]
    .filter(s => s && s.trim() !== '')
    .join('\n\n');
}