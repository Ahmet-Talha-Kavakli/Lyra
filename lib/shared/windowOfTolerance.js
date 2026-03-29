// lib/windowOfTolerance.js
// Window of Tolerance (Tolerans Penceresi) — hypo vs hyperarousal tespiti
// Nefes, gaze, ses tonu ve hızından gerçek zamanlı durum analizi
//
// Normal (Window): Dengeli, uyumlu, öğrenebilme kapasitesi
// Hyperarousal: Aşırı uyarılmış, ofansif tepki, hızlı nefes, yüksek ses
// Hypoarousal: Az uyarılmış, savunmacı, yavaş nefes, fısıltı, bakışa yanıt yok

const TOLERANCE_WINDOW_CONFIG = {
  // Nefes kriterleri (breath.bpm, breath.pattern)
  breath: {
    normal: { min: 12, max: 20 },           // Dingin nefes
    rapid: { min: 20, max: 100 },           // Hyperarousal sinyali
    holding: { duration: 8 },               // Apne (ikilemde, hassas konuda)
    shallow: { amplitude: 0.004 },          // Hypoarousal sinyali
  },

  // Ses kriterleri (voice.tempo, voice.loudness)
  voice: {
    hyperarousal: {
      tempoIncrease: 0.4,                   // %40+ hızlanma
      loudnessIncrease: 0.3,                // %30+ ses yükselmesi
      tremor: true,                         // Titreme (korku/sinir)
    },
    hypoarousal: {
      tempoDecrease: 0.4,                   // %40+ yavaşlama
      loudnessDecrease: 0.3,                // %30+ ses alçalması (fısıltı)
      monotone: true,                       // Duygusuz konuşma
    },
  },

  // Gaze kriterleri (gaze.psychological)
  gaze: {
    normal: ['dusunce', 'ic_ses'],          // Normal iç gözlem
    hyperarousal: ['kacis', 'hatirlama'],   // Kaçış veya hızlı tarıflı anı
    hypoarousal: ['kacis'],                 // Dışarıya bakış (disosiyasyon)
  },

  // Arousal seviyeleri
  arousalLevels: {
    normal: 0,
    mild_hyper: 1,
    severe_hyper: 2,
    mild_hypo: -1,
    severe_hypo: -2,
  },
};

/**
 * Nefes, ses, gaze verilerinden Window of Tolerance durumunu analiz et
 * @param {Object} voiceData — { tempo, loudness, tremor, monotone }
 * @param {Object} breathData — { bpm, pattern, amplitude }
 * @param {Object} gazeData — { psychological, confidence }
 * @param {Object} baseline — { avgTempo, avgLoudness }
 * @returns {{ arousalLevel: number, state: 'normal'|'hyperarousal'|'hypoarousal', signals: [], prompt: string }}
 */
export function analyzeWindowOfTolerance(voiceData, breathData, gazeData, baseline = {}) {
  const signals = [];
  let arousalScore = 0; // -2 to +2

  // ─── NEFES ANALİZİ ───────────────────────────────────────────────────────

  if (breathData?.bpm) {
    if (breathData.bpm > TOLERANCE_WINDOW_CONFIG.breath.rapid.min) {
      signals.push({
        type: 'breath_rapid',
        severity: 'high',
        value: breathData.bpm,
        context: `${Math.round(breathData.bpm)} nefes/dk — korku/sinir`,
      });
      arousalScore += 1;
    } else if (breathData.bpm < TOLERANCE_WINDOW_CONFIG.breath.normal.min) {
      signals.push({
        type: 'breath_slow',
        severity: 'high',
        value: breathData.bpm,
        context: `${Math.round(breathData.bpm)} nefes/dk — kapanma/disosiyasyon`,
      });
      arousalScore -= 1;
    }
  }

  // Breath holding
  if (breathData?.pattern === 'holding') {
    signals.push({
      type: 'breath_holding',
      severity: 'medium',
      context: 'Nefes tutma — hassas konuya giriliyor',
    });
    arousalScore += 0.5;
  }

  // Shallow breathing
  if (breathData?.pattern === 'shallow') {
    signals.push({
      type: 'breath_shallow',
      severity: 'medium',
      context: 'Sığ nefes — kaygı/çekinme',
    });
    arousalScore -= 0.5;
  }

  // ─── SES ANALİZİ ─────────────────────────────────────────────────────────

  const { tempo, loudness, tremor, monotone } = voiceData || {};
  const { avgTempo = 0, avgLoudness = 0 } = baseline;

  if (tempo && avgTempo > 0) {
    const tempoRatio = tempo / avgTempo;
    const tempoDelta = tempoRatio - 1;

    if (tempoDelta >= TOLERANCE_WINDOW_CONFIG.voice.hyperarousal.tempoIncrease) {
      signals.push({
        type: 'voice_tempo_increase',
        severity: 'high',
        value: `${Math.round(tempoRatio * 100 - 100)}%`,
        context: `Konuşma hızlandı — hyperarousal sinyali`,
      });
      arousalScore += 1;
    } else if (tempoDelta <= -TOLERANCE_WINDOW_CONFIG.voice.hypoarousal.tempoDecrease) {
      signals.push({
        type: 'voice_tempo_decrease',
        severity: 'high',
        value: `${Math.round(tempoDelta * 100)}%`,
        context: `Konuşma yavaşladı — hypoarousal sinyali`,
      });
      arousalScore -= 1;
    }
  }

  if (loudness && avgLoudness > 0) {
    const loudnessRatio = loudness / avgLoudness;
    const loudnessDelta = loudnessRatio - 1;

    if (loudnessDelta >= TOLERANCE_WINDOW_CONFIG.voice.hyperarousal.loudnessIncrease) {
      signals.push({
        type: 'voice_loudness_increase',
        severity: 'high',
        value: `${Math.round(loudnessDelta * 100)}%`,
        context: `Ses yükseldi — öfke/uyarılma`,
      });
      arousalScore += 0.5;
    } else if (loudnessDelta <= -TOLERANCE_WINDOW_CONFIG.voice.hypoarousal.loudnessDecrease) {
      signals.push({
        type: 'voice_loudness_decrease',
        severity: 'high',
        value: `${Math.round(loudnessDelta * 100)}%`,
        context: `Ses kısıldı — geri çekilme/fısıltı`,
      });
      arousalScore -= 0.5;
    }
  }

  if (tremor) {
    signals.push({
      type: 'voice_tremor',
      severity: 'medium',
      context: 'Ses titreyerek çıkıyor — duygu kontrolünde zorlanma',
    });
    arousalScore += 0.5;
  }

  if (monotone) {
    signals.push({
      type: 'voice_monotone',
      severity: 'medium',
      context: 'Monoton konuşma — duygusal anestezi/disosiyasyon',
    });
    arousalScore -= 0.5;
  }

  // ─── GAZE ANALİZİ ────────────────────────────────────────────────────────

  const psychGaze = gazeData?.psychological;

  if (psychGaze) {
    if (TOLERANCE_WINDOW_CONFIG.gaze.hyperarousal.includes(psychGaze)) {
      signals.push({
        type: 'gaze_hyperarousal',
        severity: 'medium',
        value: psychGaze,
        context: `Bakış yönü (${psychGaze}) — kaçış/uyarılma tepkisi`,
      });
      arousalScore += 0.5;
    } else if (TOLERANCE_WINDOW_CONFIG.gaze.hypoarousal.includes(psychGaze)) {
      signals.push({
        type: 'gaze_hypoarousal',
        severity: 'medium',
        value: psychGaze,
        context: `Bakış yönü (${psychGaze}) — disosiyasyon/geri çekilme`,
      });
      arousalScore -= 0.5;
    }
  }

  // ─── DURUMUN BELİRLENMESİ ────────────────────────────────────────────────

  let state = 'normal';
  if (arousalScore >= 1.5) state = 'severe_hyperarousal';
  else if (arousalScore >= 0.5) state = 'mild_hyperarousal';
  else if (arousalScore <= -1.5) state = 'severe_hypoarousal';
  else if (arousalScore <= -0.5) state = 'mild_hypoarousal';

  // ─── PROMPT ÜRETİMİ ──────────────────────────────────────────────────────

  let prompt = '';

  if (state === 'severe_hyperarousal') {
    prompt = `[WINDOW OF TOLERANCE — ŞİDDETLİ HYPERAROUSAL]\n`;
    prompt += `Sistem aşırı uyarılmış durumda — ofansif tepki hazırlığında.\n`;
    prompt += `Nefes hızlı, ses yüksek, vücut gergin. Tehdit algılanıyor.\n`;
    prompt += `Strateji: Sakinleştir, güvenlik sağla, tempo yavaşlat, iyileştirici fokus.\n`;
    signals.forEach((s) => {
      prompt += `• ${s.context}\n`;
    });
  } else if (state === 'mild_hyperarousal') {
    prompt = `[WINDOW OF TOLERANCE — HAFIF HYPERAROUSAL]\n`;
    prompt += `Uyarılma seviyesi yüksekçe — dikkat ve heyecan karışık.\n`;
    prompt += `Strateji: Akademik çerçeve, hareket özgürlüğü, seçim kontrol.\n`;
    signals.forEach((s) => {
      prompt += `• ${s.context}\n`;
    });
  } else if (state === 'severe_hypoarousal') {
    prompt = `[WINDOW OF TOLERANCE — ŞİDDETLİ HYPOAROUSAL]\n`;
    prompt += `Sistem kapanmış — disosiyatif savunma aktif.\n`;
    prompt += `Nefes yavaş/sığ, ses fısıltıya yakın, bakış boş. Bağlantı koparılmış.\n`;
    prompt += `Strateji: Beden farkındalığı, emniyetli uyarılma, somut gözlemler.\n`;
    signals.forEach((s) => {
      prompt += `• ${s.context}\n`;
    });
  } else if (state === 'mild_hypoarousal') {
    prompt = `[WINDOW OF TOLERANCE — HAFIF HYPOAROUSAL]\n`;
    prompt += `Uyarılma seviyesi düşük — sakınma/geri çekilme başladı.\n`;
    prompt += `Strateji: Uyarılmayı iyice artırmadan bağlantı kur, somatiği aktive et.\n`;
    signals.forEach((s) => {
      prompt += `• ${s.context}\n`;
    });
  }

  return {
    arousalLevel: arousalScore,
    state,
    signals,
    prompt: prompt || '',
  };
}

/**
 * Window of Tolerance bağlamı oluştur (her seansta çağrılabilir)
 * @param {Object} voiceData
 * @param {Object} breathData
 * @param {Object} gazeData
 * @param {Object} baseline
 * @returns {string} Prompt konteksti
 */
export function buildWindowOfToleranceContext(voiceData, breathData, gazeData, baseline) {
  const analysis = analyzeWindowOfTolerance(voiceData, breathData, gazeData, baseline);
  return analysis.prompt;
}
