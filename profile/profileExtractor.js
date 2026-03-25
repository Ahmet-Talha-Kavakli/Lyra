// profile/profileExtractor.js
// Terapi transkriptlerinden psikolojik profil güncellemeleri ve seans analizi çıkarır.

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Transkriptten başlangıç + orta + son olmak üzere 3 bölüm örneği alır.
 * Kısa transkriplerde tamamını döner.
 */
function sampleTranscript(transcript, maxChars = 3000) {
  if (!transcript || transcript.length <= maxChars) return transcript || '';

  const third = Math.floor(transcript.length / 3);
  const chunkSize = Math.floor(maxChars / 3);

  const start  = transcript.slice(0, chunkSize);
  const middle = transcript.slice(third - Math.floor(chunkSize / 2), third + Math.floor(chunkSize / 2));
  const end    = transcript.slice(transcript.length - chunkSize);

  return `[BAŞLANGIÇ]\n${start}\n\n[ORTA]\n${middle}\n\n[SON]\n${end}`;
}

/**
 * Seans transkriptinden psikolojik profil güncellemeleri çıkarır.
 * @param {string} transcript
 * @param {object} currentProfile
 * @returns {object|null}
 */
export const extractProfileUpdates = async (transcript, currentProfile) => {
  if (!transcript || transcript.length < 100) return null;

  const excerpt = sampleTranscript(transcript, 3000);

  const systemPrompt = `Sen bir psikolog asistanısın. Verilen terapi seansı transkripsiyonundan kullanıcı hakkında psikolojik profil güncellemeleri çıkar.
Yalnızca konuşmadan doğrudan çıkarılabilecek alanları döndür. Spekülatif veya varsayımsal sonuçlar ekleme.
Yanıtı sadece geçerli JSON olarak döndür, başka açıklama ekleme.`;

  // Mevcut profil özetini güvenli şekilde hazırla (injection riski olmadan)
  const safeProfileSummary = JSON.stringify({
    attachment_style: currentProfile?.attachment_style,
    session_count: currentProfile?.session_count,
    healing_style: currentProfile?.healing_style,
  });

  const userPrompt = `Mevcut profil özeti: ${safeProfileSummary}

Seans transkripsiyonu:
${excerpt}

Konuşmadan kanıta dayalı olarak çıkarılabilen alanları içeren JSON döndür.
Çıkarılamayan alanları tamamen atla (null kullanma, sadece dahil etme):
{
  "attachment_style": "guvenli|kacıngan|endiseli|korkulu (opsiyonel)",
  "triggers": [{ "konu": "string", "etki": "string" }],
  "core_values": [{ "deger": "string", "oncelik": "yüksek|orta|düşük" }],
  "defense_mechanisms": [{ "mekanizma": "string", "sıklık": "sık|ara sıra|nadir" }],
  "language_style": { "resmiyet": "resmi|samimi", "mizah": true/false, "dogrudan": true/false },
  "unconscious_patterns": [{ "desen": "string", "guc_skoru": 0.0-1.0 }],
  "relationship_map": [{ "isim": "string", "rol": "string", "dinamik": "string" }],
  "life_schemas": [{ "sema": "string", "guc": 0.0-1.0 }],
  "healing_style": { "mod": "konuşarak|sessizlik|eylemle", "hiz": "yavaş|orta|hızlı", "tercih": "duygusal_doğrulama|çözüm_odaklı" },
  "strengths": [{ "guc": "string" }],
  "hope_map": { "uzun_vadeli_hedef": "string", "kisa_adimlar": ["string"] }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content || '';
    return JSON.parse(text);
  } catch (err) {
    console.warn('[extractProfileUpdates] Hata:', err.message);
    return null;
  }
};

/**
 * Seans transkriptini analiz edip yapılandırılmış özet döner.
 * @param {string} transcript
 * @param {object} profile
 * @returns {object|null}
 */
export const analyzeSession = async (transcript, profile) => {
  if (!transcript || transcript.length < 50) return null;

  // Başlangıç ve sonu al — duygusal ark için ikisi de önemli
  const startExcerpt = transcript.slice(0, 1200);
  const endExcerpt   = transcript.slice(-1200);
  const excerpt = transcript.length > 2400
    ? `[SEANS BAŞLANGICI]\n${startExcerpt}\n\n[SEANS SONU]\n${endExcerpt}`
    : transcript;

  const systemPrompt = `Sen bir psikolog asistanısın. Verilen terapi seansını analiz et ve yapılandırılmış bir özet çıkar.
Yanıtı sadece geçerli JSON olarak döndür, başka açıklama ekleme.`;

  const userPrompt = `Seans transkripsiyonu:
${excerpt}

Aşağıdaki formatta JSON döndür:
{
  "dominant_emotion": "seansın baskın duygusu (string)",
  "emotional_start_score": 1-10,
  "emotional_end_score": 1-10,
  "topics": ["konuşulan ana konular — maksimum 5 madde"],
  "breakthrough_moment": true/false,
  "breakthrough_note": "kırılma anı varsa kısa açıklama, yoksa null",
  "homework": "önerilen somut bir pratik adım, yoksa null",
  "session_quality": "productive|neutral|difficult"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content || '';
    return JSON.parse(text);
  } catch (err) {
    console.warn('[analyzeSession] Hata:', err.message);
    return null;
  }
};
