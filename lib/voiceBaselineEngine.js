// voiceBaselineEngine.js
// Kullanıcı başına kişisel ses baseline'ı oluşturur (ilk 5 oturumdan)
// Mevcut oturumda sapmaları tespit eder ve Lyra'ya bağlam sağlar

import { supabase } from './supabase.js';

// Ses baseline tablosu: voice_baselines
// Sütunlar: user_id TEXT PK, avg_tempo FLOAT, avg_loudness FLOAT,
//           avg_tremor_rate FLOAT, typical_pitch_pattern TEXT,
//           baseline_sessions INTEGER, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ

// Baseline oluşturmak için gereken minimum oturum sayısı
const BASELINE_MIN_SESSIONS = 1;
// Baseline güncellemeyi durduracak maksimum oturum sayısı
const BASELINE_MAX_SESSIONS = 5;

// Anlamlı sapma eşikleri
const TEMPO_DEVIATION_THRESHOLD = 0.4;    // %40 değişim
const LOUDNESS_DEVIATION_THRESHOLD = 0.3; // %30 değişim

/**
 * Kullanıcının ses baseline'ını günceller.
 * İlk 5 oturumdan koşan ortalamalar hesaplanır; 5 sonrasında güncelleme durur.
 * @param {string} userId
 * @param {{ tempo: number, loudness: number, tremor: boolean, monotone: boolean, vokalBreak: boolean, isWhisper: boolean }} voiceParams
 */
export async function updateVoiceBaseline(userId, voiceParams) {
  const { tempo, loudness, tremor } = voiceParams;

  // Mevcut baseline'ı getir
  const { data: existing, error } = await supabase
    .from('voice_baselines')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = kayıt yok (beklenen durum)
    console.error('[voiceBaselineEngine] Baseline getirme hatası:', error.message);
    return;
  }

  // 5 oturumu aştıysa güncelleme yapma
  if (existing && existing.baseline_sessions >= BASELINE_MAX_SESSIONS) {
    return;
  }

  if (!existing) {
    // İlk oturum — yeni kayıt oluştur
    const { error: insertError } = await supabase.from('voice_baselines').insert({
      user_id: userId,
      avg_tempo: tempo ?? null,
      avg_loudness: loudness ?? null,
      avg_tremor_rate: tremor ? 1.0 : 0.0,
      typical_pitch_pattern: voiceParams.monotone ? 'monotone' : 'expressive',
      baseline_sessions: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[voiceBaselineEngine] Baseline ekleme hatası:', insertError.message);
    }
    return;
  }

  // Mevcut oturumla koşan ortalama güncelle
  const n = existing.baseline_sessions;
  const newN = n + 1;

  // Ağırlıklı koşan ortalama: (eski_ort * n + yeni_değer) / (n + 1)
  const newAvgTempo =
    tempo != null
      ? ((existing.avg_tempo ?? tempo) * n + tempo) / newN
      : existing.avg_tempo;

  const newAvgLoudness =
    loudness != null
      ? ((existing.avg_loudness ?? loudness) * n + loudness) / newN
      : existing.avg_loudness;

  const newAvgTremor =
    ((existing.avg_tremor_rate ?? 0) * n + (tremor ? 1.0 : 0.0)) / newN;

  // Pitch pattern: çoğunlukla monoton mu ekspresif mi?
  const prevMonotoneCount =
    existing.typical_pitch_pattern === 'monotone' ? n : 0;
  const newMonotoneCount = prevMonotoneCount + (voiceParams.monotone ? 1 : 0);
  const typicalPitchPattern =
    newMonotoneCount / newN > 0.5 ? 'monotone' : 'expressive';

  const { error: updateError } = await supabase
    .from('voice_baselines')
    .update({
      avg_tempo: newAvgTempo,
      avg_loudness: newAvgLoudness,
      avg_tremor_rate: newAvgTremor,
      typical_pitch_pattern: typicalPitchPattern,
      baseline_sessions: newN,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('[voiceBaselineEngine] Baseline güncelleme hatası:', updateError.message);
  }
}

/**
 * Mevcut ses parametrelerini kullanıcının baseline'ıyla karşılaştırır.
 * @param {string} userId
 * @param {{ tempo: number, loudness: number, tremor: boolean, monotone: boolean, vokalBreak: boolean, isWhisper: boolean }} voiceParams
 * @returns {Promise<{ deviations: Array, overallAlert: boolean } | null>}
 */
export async function detectVoiceDeviation(userId, voiceParams) {
  const { data: baseline, error } = await supabase
    .from('voice_baselines')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !baseline) {
    // Baseline henüz yok — null döndür
    return null;
  }

  // Yeterli oturum birikmediyse henüz sapma tespiti yapma
  if (baseline.baseline_sessions < BASELINE_MIN_SESSIONS) {
    return null;
  }

  const deviations = [];

  // ── Tempo sapması ────────────────────────────────────────────────────────
  if (voiceParams.tempo != null && baseline.avg_tempo != null && baseline.avg_tempo > 0) {
    const tempoRatio = voiceParams.tempo / baseline.avg_tempo;
    const tempoDelta = tempoRatio - 1; // negatif = düşüş, pozitif = artış

    if (Math.abs(tempoDelta) >= TEMPO_DEVIATION_THRESHOLD) {
      const direction = tempoDelta < 0 ? 'drop' : 'rise';
      const magnitude = Math.abs(tempoDelta);

      let prompt = '';
      if (direction === 'drop') {
        prompt = `[SES BASELİNE — TEMPO DÜŞTÜ]: Normalde ${Math.round(baseline.avg_tempo)} kelime/dk konuşuyor, şu an ${Math.round(voiceParams.tempo)}. Yavaşlama ciddi — ne ağırlaştı?`;
      } else {
        prompt = `[SES BASELİNE — TEMPO ARTTI]: Normalde ${Math.round(baseline.avg_tempo)} kelime/dk konuşuyor, şu an ${Math.round(voiceParams.tempo)}. Hızlanma var — ne tetikledi?`;
      }

      deviations.push({ type: 'tempo', direction, magnitude, prompt });
    }
  }

  // ── Ses şiddeti sapması ──────────────────────────────────────────────────
  if (voiceParams.loudness != null && baseline.avg_loudness != null && baseline.avg_loudness > 0) {
    const loudnessRatio = voiceParams.loudness / baseline.avg_loudness;
    const loudnessDelta = loudnessRatio - 1;

    if (Math.abs(loudnessDelta) >= LOUDNESS_DEVIATION_THRESHOLD) {
      const direction = loudnessDelta < 0 ? 'drop' : 'rise';
      const magnitude = Math.abs(loudnessDelta);

      let prompt = '';
      if (direction === 'drop') {
        prompt = `[SES BASELİNE — SES KISALDI]: Normalde daha yüksek sesle konuşuyor. Bugün fısıltıya yakın — içe çekilme olabilir.`;
      } else {
        prompt = `[SES BASELİNE — SES YÜKSELDİ]: Normalde daha sakin konuşuyor. Bugün ses yükseldi — duygu yoğunluğu artmış.`;
      }

      deviations.push({ type: 'loudness', direction, magnitude, prompt });
    }
  }

  // ── Yeni titreme sinyali ─────────────────────────────────────────────────
  // Baseline'da titreme yoktu (oran < 0.2), şu an var
  if (voiceParams.tremor && (baseline.avg_tremor_rate ?? 0) < 0.2) {
    deviations.push({
      type: 'tremor_new',
      direction: 'new',
      magnitude: 1.0,
      prompt:
        '[SES BASELİNE — TİTREME YENİ]: Bu kişi normalde titremez. Bugün ilk kez — hassas bir şeye dokunuluyor.',
    });
  }

  // ── Yeni monotonluk sinyali ──────────────────────────────────────────────
  // Baseline'da ekspresif konuşuyordu, şu an düzleşme var
  if (voiceParams.monotone && baseline.typical_pitch_pattern === 'expressive') {
    deviations.push({
      type: 'monotone_new',
      direction: 'new',
      magnitude: 1.0,
      prompt:
        '[SES BASELİNE — MONOTON YENİ]: Bu kişi normalde duygulu konuşur. Bugün düzleşme — disosiyasyon veya kapanma.',
    });
  }

  // ── Vokal kırılma sinyali ────────────────────────────────────────────────
  if (voiceParams.vokalBreak) {
    deviations.push({
      type: 'vokal_break',
      direction: 'new',
      magnitude: 0.8,
      prompt:
        '[SES BASELİNE — VOKAL KIRILMA]: Ses kırılması tespit edildi — duygu kontrolü zorlanıyor olabilir.',
    });
  }

  // ── Fısıltı modu ────────────────────────────────────────────────────────
  if (voiceParams.isWhisper) {
    deviations.push({
      type: 'whisper',
      direction: 'drop',
      magnitude: 0.9,
      prompt:
        '[SES BASELİNE — FISIRTI]: Neredeyse duyulmaz konuşuyor — savunma, utanç veya derin kırılganlık işareti.',
    });
  }

  const overallAlert = deviations.length > 0;
  return { deviations, overallAlert };
}

/**
 * Ses baseline bağlamı oluşturur ve baseline'ı arka planda günceller.
 * @param {string} userId
 * @param {{ tempo: number, loudness: number, tremor: boolean, monotone: boolean, vokalBreak: boolean, isWhisper: boolean }} voiceParams
 * @returns {Promise<string>} Prompt bağlamı veya boş string
 */
export async function buildVoiceBaselineContext(userId, voiceParams) {
  // Sapmaları tespit et
  const result = await detectVoiceDeviation(userId, voiceParams);

  // Arka planda baseline güncelle — await etme
  updateVoiceBaseline(userId, voiceParams).catch((err) => {
    console.error('[voiceBaselineEngine] Arka plan baseline güncelleme hatası:', err.message);
  });

  if (!result || !result.overallAlert) return '';

  // Tüm sapma promptlarını birleştir
  return result.deviations.map((d) => d.prompt).join('\n');
}

// ─── SQL Migration ───────────────────────────────────────────────────────────
//
// Supabase SQL editöründe çalıştır:
//
// CREATE TABLE IF NOT EXISTS voice_baselines (
//   user_id             TEXT PRIMARY KEY,
//   avg_tempo           FLOAT,
//   avg_loudness        FLOAT,
//   avg_tremor_rate     FLOAT,
//   typical_pitch_pattern TEXT,
//   baseline_sessions   INTEGER NOT NULL DEFAULT 0,
//   created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// -- Güncelleme zamanını otomatik tazele
// CREATE OR REPLACE FUNCTION update_updated_at_column()
// RETURNS TRIGGER AS $$
// BEGIN
//   NEW.updated_at = NOW();
//   RETURN NEW;
// END;
// $$ LANGUAGE plpgsql;
//
// CREATE TRIGGER voice_baselines_updated_at
//   BEFORE UPDATE ON voice_baselines
//   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
