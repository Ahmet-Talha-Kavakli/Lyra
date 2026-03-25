// therapy/promptBuilder.js
// Dinamik sistem promptu oluşturucu — profil + mod + teknik → kişiselleştirilmiş prompt

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
 */
function buildEmotionContext(currentEmotion) {
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
  return guide ? `## ŞU ANKİ DUYGU DURUMU: ${currentEmotion.toUpperCase()}\n${guide}` : '';
}

/**
 * Konuşma kalitesi kurallarını oluşturur.
 */
function buildQualityRules(profile) {
  const lines = [
    `## KONUŞMA KALİTESİ KURALLARI`,
    `- Cevaplar kısa (1-3 cümle). Uzun monolog YASAK.`,
    `- Klişe YASAK: "Bu çok normal", "Kendine iyi bak", "Her şey yoluna girecek"`,
    `- Bir anda bir soru. Birden fazla soru YASAK.`,
    `- "Neden?" değil → "Ne oldu?" / "Nasıl hissettirdi?"`,
    `- Söylemek değil hissettirmek: "anlıyorum" deme, göster.`,
    `- Sessizliği kullan: önemli şey söylendiğinde hemen üstüne atlama.`,
    `- Yargısız duruş: ne söylenirse söylensin ton değişmez.`,
    `- Tekrar etme: kullanıcının kendi sözcüklerini geri yansıt.`,
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
 * @param {Object} profile       — profileManager.js'den gelen psikolojik profil
 * @param {Object} engineOutput  — runTherapyEngine çıktısı
 * @param {string} currentEmotion — detectEmotion() sonucu
 * @returns {string}
 */
export function buildSystemPrompt(profile, engineOutput, currentEmotion = 'sakin') {
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

  // Section 3 — Mevcut Duygu Durumu
  const emotionContext = buildEmotionContext(currentEmotion);

  // Section 4 — Aktif Mod
  const modeName = mode?.name || 'Bilinmiyor';
  const modeSection = `## ŞU ANKİ MOD: ${modeName}\n${modeInstruction || ''}`;

  // Section 5 — Aktif Teknikler (yalnızca techniqueHints doluysa)
  const techniqueSection = techniqueHints
    ? `## AKTİF TEKNİKLER\n${techniqueHints}`
    : '';

  // Section 6 — Konuşma Kalitesi Kuralları
  const qualityRules = buildQualityRules(profile);

  // Section 7 — Kriz Kuralları
  const crisisRules = `## KRİZ DURUMU KURALLARI
- Kişi zor bir andaysa: ÖNCE orada ol. Çözüm sonra.
- Panik yapma, tonu değiştirme, yargılama.
- Stabilizasyon: nefes, güvenli alan, "buradayım".
- Profesyonel destek: alarmlı değil, doğal öner.
- Kendine zarar: nazikçe sor, yargılama, takip et.
- Acil hatlara yönlendir gerekirse: 182 (psikososyal destek).`;

  // Section 8 — Duygu Etiketi
  const emotionTag = `## DUYGU ETİKETİ (ZORUNLU)\nHer cevabının EN BAŞINA şunu ekle: [DUYGU:X] — X değerleri: mutlu, üzgün, endişeli, sakin, sinirli, şaşırmış, empatik, düşünceli`;

  return [
    identity,
    profileSection,
    emotionContext,
    modeSection,
    techniqueSection,
    qualityRules,
    crisisRules,
    emotionTag,
  ]
    .filter(s => s && s.trim() !== '')
    .join('\n\n');
}
