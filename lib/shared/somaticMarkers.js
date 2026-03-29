// lib/somaticMarkers.js
// Somatic Markers — beden sinyalleri ve duygusal materyalle ilgili fiziksel tepkiler
// Göğsü sıkması, midem gerilmesi, titreme, yüz sıcaklığı, kas gerilimi vs.
//
// Antonio Damasio'nun somatic marker hipotezine dayalı:
// Duygusal deneyim → beden tepkisi → duygusal hafıza (marker)
// Hassas konuya yaklaşınca vücut "bilir" ve sinyali verir

const SOMATIC_MARKER_CONFIG = {
  // Beden bölgeleri ve sinyalleri
  markers: {
    chest: {
      name: 'Göğüs sıkması',
      detection: 'voice_tremor + breath_rapid + face_flush',
      severity: 'high',
      meaning: 'Duygusal baskı, travma aktivasyonu',
      response: 'Nefese dön, güvenli yerin haritasını çiz',
    },
    stomach: {
      name: 'Midem gerildi',
      detection: 'voice_change + gaze_away + breath_shallow',
      severity: 'high',
      meaning: 'Kaygı, utanç, güvensizlik hissi',
      response: 'Midin nedir söyle, somatik harita yap',
    },
    throat: {
      name: 'Boğazım düğümlendi',
      detection: 'voice_tremor + voice_monotone + breathing_holding',
      severity: 'high',
      meaning: 'Sesini bastırma, söylenememiş sözler',
      response: 'Tam olarak nedir bu duygu? Sesini duydum.',
    },
    limbs: {
      name: 'Titreme / Kas gerilimi',
      detection: 'voice_tremor + breath_rapid + arousal_high',
      severity: 'high',
      meaning: 'Dövüş/kaçış sistemi aktivasyonu',
      response: 'Vücudunun haritasını çiz, hareket özgürlüğünü kur',
    },
    skin: {
      name: 'Yüz kızarması / Ürperti',
      detection: 'face_blush + voice_tremor + gaze_away',
      severity: 'medium',
      meaning: 'Utanç, haya, utangaçlık',
      response: 'Utancı isimlendir, neye utanıyorsun?',
    },
  },

  // Somatik marker kombinasyonları (multi-signal patterns)
  patterns: {
    high_activation: {
      signals: ['breath_rapid', 'voice_tempo_increase', 'voice_loudness_increase', 'face_blush'],
      state: 'hyperarousal',
      meaning: 'Travma açılmış, sistem fırlamak üzere',
    },
    freeze_response: {
      signals: ['breath_holding', 'voice_tremor', 'gaze_away', 'voice_monotone'],
      state: 'freeze',
      meaning: 'Tuzak hissi, hareket edememe, disosiyasyon başladı',
    },
    shame_response: {
      signals: ['face_blush', 'gaze_down', 'voice_quieter', 'breath_shallow'],
      state: 'shutdown',
      meaning: 'Utanç kontraktüsü, içine çekilme, özür ödülü beklenti',
    },
  },
};

/**
 * Somatik marker tespiti ve bağlam oluşturma
 * @param {Object} signals — { breathData, voiceData, gazeData, colorData, arousalState }
 * @returns {{ markers: Array, activePatterns: Array, prompt: string }}
 */
export function detectSomaticMarkers(signals) {
  const {
    breathData = {},
    voiceData = {},
    gazeData = {},
    colorData = {},
    arousalState = 'normal',
  } = signals;

  const detectedMarkers = [];
  const activePatterns = [];

  // ─── GÖĞÜSÜŞÜ DÜŞÜN ──────────────────────────────────────────────────────

  const chestIndicators = [
    voiceData.tremor,
    breathData.bpm > 25,
    colorData?.type === 'blush',
  ].filter(Boolean).length;

  if (chestIndicators >= 2) {
    detectedMarkers.push({
      location: 'chest',
      confidence: chestIndicators / 3,
      prompt: `[SOMATIK MARKER — GÖĞÜS SIKIŞTI]\nSistemi bastırıyor, duygusal enerji sıkışmış.\n${SOMATIC_MARKER_CONFIG.markers.chest.response}`,
    });
  }

  // ─── MİDEM GERİLDİ ──────────────────────────────────────────────────────

  const stomachIndicators = [
    voiceData.tempo && voiceData.tempo < 80, // yavaş konuşma
    breathData.pattern === 'shallow',
    gazeData?.looking_away,
  ].filter(Boolean).length;

  if (stomachIndicators >= 2) {
    detectedMarkers.push({
      location: 'stomach',
      confidence: stomachIndicators / 3,
      prompt: `[SOMATIK MARKER — MİDEM GERİLDİ]\nKaygı ve endişe fizyolojiye döndü. Midin ne söylüyor?\n${SOMATIC_MARKER_CONFIG.markers.stomach.response}`,
    });
  }

  // ─── BOĞAZIM DÜĞÜMLENDI ──────────────────────────────────────────────────

  const throatIndicators = [
    voiceData.tremor,
    voiceData.monotone,
    breathData.pattern === 'holding',
  ].filter(Boolean).length;

  if (throatIndicators >= 2) {
    detectedMarkers.push({
      location: 'throat',
      confidence: throatIndicators / 3,
      prompt: `[SOMATIK MARKER — BOĞAZIM DÜĞÜMLENDI]\nSesini bastırmaya çalışıyor. Söylenememiş bir şey var.\n${SOMATIC_MARKER_CONFIG.markers.throat.response}`,
    });
  }

  // ─── TİTREME / KAS GERİLİMİ ──────────────────────────────────────────────

  const limbIndicators = [
    voiceData.tremor,
    breathData.bpm > 25,
    arousalState.includes('hyper'),
  ].filter(Boolean).length;

  if (limbIndicators >= 2) {
    detectedMarkers.push({
      location: 'limbs',
      confidence: limbIndicators / 3,
      prompt: `[SOMATIK MARKER — TİTREME / KAS GERİLİMİ]\nDövüş/kaçış sistemi uyandı. Vücud tetiktedir.\n${SOMATIC_MARKER_CONFIG.markers.limbs.response}`,
    });
  }

  // ─── YÜZ KIZARMASI / ÜRPERTİ ────────────────────────────────────────────

  const skinIndicators = [
    colorData?.type === 'blush',
    voiceData.tremor,
    gazeData?.looking_away,
  ].filter(Boolean).length;

  if (skinIndicators >= 2) {
    detectedMarkers.push({
      location: 'skin',
      confidence: skinIndicators / 3,
      prompt: `[SOMATIK MARKER — YÜZ KIZARMASI / ÜRPERTİ]\nUtanç ve haya sinyali. Güvenliliği kur.\n${SOMATIC_MARKER_CONFIG.markers.skin.response}`,
    });
  }

  // ─── PATTERN TESPİTİ ────────────────────────────────────────────────────

  // High activation pattern
  const highActivationSignals = [
    breathData.bpm > 25,
    voiceData.tempo > 120,
    voiceData.loudness > 75,
    colorData?.type === 'blush',
  ].filter(Boolean).length;

  if (highActivationSignals >= 3) {
    activePatterns.push({
      pattern: 'high_activation',
      confidence: highActivationSignals / 4,
      prompt: `[SOMATIK PATTERN — YÜKSEKÜZERİ AKTİVASYON]\nTravmatik malzeme açılmış, sistem tepede. Sakinleştir, güvenlik başlamıştır.\n→ Nefes, somatiğe dön, hareket özgürlüğü.`,
    });
  }

  // Freeze pattern
  const freezeSignals = [
    breathData.pattern === 'holding',
    voiceData.tremor,
    gazeData?.looking_away,
    voiceData.monotone,
  ].filter(Boolean).length;

  if (freezeSignals >= 3) {
    activePatterns.push({
      pattern: 'freeze_response',
      confidence: freezeSignals / 4,
      prompt: `[SOMATIK PATTERN — FREEZE YANITI]\nSistem tuzaklanmış hissiyle kapandı. Hareket edemiyor, söyleyemiyor.\n→ Güvenlik ilk, sonra mikro hareketler, ses, bağlantı.`,
    });
  }

  // Shame pattern
  const shameSignals = [
    colorData?.type === 'blush',
    gazeData?.psychological === 'dusunce' || gazeData?.looking_away,
    voiceData.tempo < 80,
    breathData.pattern === 'shallow',
  ].filter(Boolean).length;

  if (shameSignals >= 3) {
    activePatterns.push({
      pattern: 'shame_response',
      confidence: shameSignals / 4,
      prompt: `[SOMATIK PATTERN — UTANÇ KONTRAKTÜRÜ]\nÖzü saklayan, kendini gizleyen, özür bekleyen bir tavır.\n→ Utancı isimlendir, neye utanıyorsun? Senin kabahat değil.`,
    });
  }

  // ─── GENEL PROMPT ───────────────────────────────────────────────────────

  let overallPrompt = '';

  if (detectedMarkers.length > 0) {
    overallPrompt = detectedMarkers.map((m) => m.prompt).join('\n\n');
  }

  if (activePatterns.length > 0 && detectedMarkers.length === 0) {
    overallPrompt = activePatterns.map((p) => p.prompt).join('\n\n');
  }

  return {
    markers: detectedMarkers,
    patterns: activePatterns,
    prompt: overallPrompt,
  };
}

/**
 * Somatik marker bağlamı oluştur
 * @param {Object} signals
 * @returns {string}
 */
export function buildSomaticMarkerContext(signals) {
  const detection = detectSomaticMarkers(signals);
  return detection.prompt;
}
