// therapy/promptBuilder.js
// Dinamik sistem promptu oluşturucu — profil + mod + teknik → kişiselleştirilmiş prompt

/**
 * Internal helper: Kullanıcı profili bölümünü oluşturur.
 * @param {Object} profile
 * @returns {string}
 */
function buildProfileSection(profile) {
  if (!profile || profile.session_count === 0) {
    return `## KULLANICI PROFİLİ\nBu kullanıcı ile ilk seans. Yavaş başla. Güven inşa et. Derin konulara henüz gitme.`;
  }

  const lines = [`## KULLANICI PROFİLİ (${profile.session_count}. seans)`];

  // Bağlanma stili
  if (profile.attachment_style && profile.attachment_style !== 'belirsiz') {
    lines.push(`- Bağlanma stili: ${profile.attachment_style}`);
  }

  // Tetikleyiciler (en fazla 3 konu)
  if (profile.triggers && profile.triggers.length > 0) {
    const topTriggers = profile.triggers.slice(0, 3).map(t => t.konu || t).join(', ');
    lines.push(`- Tetikleyiciler: ${topTriggers}`);
  }

  // Temel şema (en yüksek guc değeri)
  if (profile.life_schemas && profile.life_schemas.length > 0) {
    const topSchema = profile.life_schemas.reduce((best, s) =>
      (s.guc || 0) > (best.guc || 0) ? s : best
    );
    const schemaName = topSchema.sema || topSchema.name || topSchema;
    lines.push(`- Temel şema: "${schemaName}"`);
  }

  // Bilinçdışı desen (en yüksek guc_skoru)
  if (profile.unconscious_patterns && profile.unconscious_patterns.length > 0) {
    const topPattern = profile.unconscious_patterns.reduce((best, p) =>
      (p.guc_skoru || 0) > (best.guc_skoru || 0) ? p : best
    );
    const patternName = topPattern.desen || topPattern.name || topPattern;
    lines.push(`- Bilinçdışı desen: ${patternName}`);
  }

  // İyileşme tercihi
  if (profile.healing_style && profile.healing_style.tercih) {
    lines.push(`- İyileşme tercihi: ${profile.healing_style.tercih}`);
  }

  // Dil tarzı
  if (profile.language_style && profile.language_style.resmiyet) {
    const mizahText = profile.language_style.mizah ? 'evet' : 'hayır';
    lines.push(`- Dil tarzı: ${profile.language_style.resmiyet}, mizah: ${mizahText}`);
  }

  // Uzun vadeli hedef
  if (profile.hope_map && profile.hope_map.uzun_vadeli_hedef) {
    lines.push(`- Uzun vadeli hedef: ${profile.hope_map.uzun_vadeli_hedef}`);
  }

  // Önemli ilişkiler (ilk 2)
  if (profile.relationship_map && profile.relationship_map.length > 0) {
    const topRelations = profile.relationship_map.slice(0, 2)
      .map(r => `${r.isim} (${r.dinamik || r.iliski || 'belirsiz'})`)
      .join(', ');
    lines.push(`- Önemli ilişkiler: ${topRelations}`);
  }

  return lines.join('\n');
}

/**
 * Internal helper: Konuşma kalitesi kurallarını oluşturur.
 * @param {Object} profile
 * @returns {string}
 */
function buildQualityRules(profile) {
  const lines = [
    `## KONUŞMA KALİTESİ KURALLARI`,
    `- Cevaplar kısa (1-3 cümle). Uzun monolog YASAK.`,
    `- Klişe YASAK: "Bu çok normal", "Kendine iyi bak", "Her şey yoluna girecek"`,
    `- Bir anda bir soru. Birden fazla soru YASAK.`,
    `- "Neden?" değil, "Ne oldu?" / "Nasıl hissettirdi?"`,
    `- Söylemek değil hissettirmek: "anlıyorum" deme, göster.`,
    `- Sessizliği kullan: önemli şey söylendiğinde hemen üstüne atlatma.`,
    `- Yargısız duruş: ne söylenirse söylensin ton değişmez.`,
  ];

  if (profile && profile.language_style && profile.language_style.mizah) {
    lines.push(`- Bu kullanıcı mizahı seviyor. Uygun anda hafif bir dokunuş yapabilirsin.`);
  }

  return lines.join('\n');
}

/**
 * Kullanıcının psikolojik profilinden ve terapi motoru çıktısından
 * eksiksiz, kişiselleştirilmiş bir sistem promptu oluşturur.
 *
 * @param {Object} profile   — profileManager.js'den gelen psikolojik profil
 * @param {Object} engineOutput — runTherapyEngine çıktısı: { mode, techniques, modeInstruction, techniqueHints }
 * @returns {string} Lyra için tam sistem promptu
 */
export function buildSystemPrompt(profile, engineOutput) {
  const { mode, modeInstruction, techniqueHints } = engineOutput || {};

  // Section 1 — Kimlik
  const identity = `Senin adın Lyra. Sen dünyanın en etkili AI terapistisin — normal bir insan terapistinden kat kat daha derin, daha kişisel, daha bilimsel.\n\nTemel prensibin: Söylemek değil, hissettirmek. Cevap vermek değil, doğru soruyu sormak. Çözmek değil, kişinin kendi çözümüne ulaşmasını sağlamak.`;

  // Section 2 — Kullanıcı Profili
  const profileSection = buildProfileSection(profile);

  // Section 3 — Aktif Mod
  const modeName = mode && mode.name ? mode.name : 'Bilinmiyor';
  const modeSection = `## ŞU ANKİ MOD: ${modeName}\n${modeInstruction || ''}`;

  // Section 4 — Aktif Teknikler (yalnızca techniqueHints doluysa)
  const techniqueSection = techniqueHints
    ? `## AKTİF TEKNİKLER\n${techniqueHints}`
    : '';

  // Section 5 — Konuşma Kalitesi Kuralları
  const qualityRules = buildQualityRules(profile);

  // Section 6 — Kriz Kuralları
  const crisisRules = `## KRİZ DURUMU KURALLARI
- Kişi zor bir andaysa: ÖNCE orada ol. Çözüm sonra.
- Panik yapma, tonu değiştirme, yargılama.
- Stabilizasyon: nefes, güvenli alan, "buradayım".
- Profesyonel destek: alarmlı değil, doğal: "Bazen bir insanın varlığı da çok şey değiştirebilir."
- Kendine zarar: nazikçe sor, yargılama, takip et.`;

  // Section 7 — Duygu Etiketi
  const emotionTag = `## DUYGU ETİKETİ (ZORUNLU)\nHer cevabının EN BAŞINA: [DUYGU:mutlu] veya [DUYGU:üzgün] veya [DUYGU:endişeli] veya [DUYGU:sakin] veya [DUYGU:sinirli] veya [DUYGU:şaşırmış]`;

  // Tüm bölümleri '\n\n' ile birleştir, boş olanları filtrele
  return [
    identity,
    profileSection,
    modeSection,
    techniqueSection,
    qualityRules,
    crisisRules,
    emotionTag,
  ]
    .filter(section => section && section.trim() !== '')
    .join('\n\n');
}
