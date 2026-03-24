// profile/profileExtractor.js
// Extracts psychological profile updates and session analysis from therapy transcripts using OpenAI.

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extracts a partial psychological profile update from a therapy session transcript.
 * @param {string} transcript - The session transcript text.
 * @param {object} currentProfile - The user's current profile object.
 * @returns {object|null} Partial profile update, or null if transcript too short or on error.
 */
export const extractProfileUpdates = async (transcript, currentProfile) => {
  if (!transcript || transcript.length < 100) return null;

  const excerpt = transcript.slice(0, 2000);

  const systemPrompt = `Sen bir psikolog asistanısın. Verilen terapi seansı transkripsiyonundan kullanıcı hakkında psikolojik profil güncellemeleri çıkar.
Yalnızca konuşmadan çıkarılabilecek alanları döndür. Çıkarılamayan alanları tamamen atla (null kullanma, sadece atla).
Yanıtı sadece geçerli JSON olarak döndür, başka açıklama ekleme.`;

  const userPrompt = `Mevcut profil özeti: ${JSON.stringify(currentProfile || {}, null, 2).slice(0, 500)}

Seans transkripsiyonu:
${excerpt}

Konuşmadan çıkarılabilen alanları içeren JSON döndür. Yalnızca kanıta dayalı alanları ekle:
{
  "attachment_style": "guvenli|kacıngan|endiseli|belirsiz (opsiyonel)",
  "triggers": [{ "konu": "string", "etki": "string", "ornek": "string" }],
  "core_values": [{ "deger": "string", "oncelik": "yüksek|orta|düşük" }],
  "defense_mechanisms": [{ "mekanizma": "string", "sıklık": "sık|ara sıra|nadir" }],
  "language_style": { "resmiyet": "resmi|samimi", "mizah": true/false, "dogrudan": true/false },
  "unconscious_patterns": [{ "desen": "string", "ornekler": ["string"], "guc_skoru": 0.0-1.0 }],
  "relationship_map": [{ "isim": "string", "rol": "string", "dinamik": "string", "duygusal_ton": "string" }],
  "life_schemas": [{ "sema": "string", "kaynak": "string", "guc": 0.0-1.0 }],
  "healing_style": { "mod": "konuşarak|sessizlik|eylemle", "hiz": "yavaş|orta|hızlı", "tercih": "duygusal_doğrulama|çözüm_odaklı" },
  "strengths": [{ "guc": "string", "ornek": "string" }],
  "hope_map": { "uzun_vadeli_hedef": "string", "kisa_adimlar": ["string"], "degerler": ["string"] }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const text = response.choices[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn('[extractProfileUpdates] AI yanıtından JSON çıkarılamadı.');
      return null;
    }

    return JSON.parse(match[0]);
  } catch (err) {
    console.warn('[extractProfileUpdates] Hata:', err.message);
    return null;
  }
};

/**
 * Analyzes a therapy session and returns structured session insights.
 * @param {string} transcript - The session transcript text.
 * @param {object} profile - The user's current profile object.
 * @returns {object|null} Session analysis object, or null if transcript too short or on error.
 */
export const analyzeSession = async (transcript, profile) => {
  if (!transcript || transcript.length < 50) return null;

  const excerpt = transcript.slice(0, 2000);

  const systemPrompt = `Sen bir psikolog asistanısın. Verilen terapi seansını analiz et ve yapılandırılmış bir özet çıkar.
Yanıtı sadece geçerli JSON olarak döndür, başka açıklama ekleme.`;

  const userPrompt = `Kullanıcı profili özeti: ${JSON.stringify(profile || {}, null, 2).slice(0, 300)}

Seans transkripsiyonu:
${excerpt}

Aşağıdaki formatta JSON döndür:
{
  "dominant_emotion": "seansın baskın duygusu (string)",
  "emotional_start_score": 1-10 (seansın başındaki duygusal durum, 1=çok kötü, 10=çok iyi),
  "emotional_end_score": 1-10 (seansın sonundaki duygusal durum),
  "topics": ["konuşulan ana konular listesi"],
  "breakthrough_moment": true/false,
  "breakthrough_note": "kırılma anı varsa açıklama, yoksa null",
  "homework": "önerilen ödev veya pratik adım, yoksa null"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const text = response.choices[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn('[analyzeSession] AI yanıtından JSON çıkarılamadı.');
      return null;
    }

    return JSON.parse(match[0]);
  } catch (err) {
    console.warn('[analyzeSession] Hata:', err.message);
    return null;
  }
};
