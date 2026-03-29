// colorAnalyzer.js
// Yüz renk değişimi (kızarma/solukluk) ve omuz hareketinden nefes ritmi analizi
// Tarayıcının canvas analizinden gelen verileri işler

// Kullanıcı başına renk geçmişi
// colorHistory: Map(userId → { baselineR, baselineG, baselineB, samples: [], lastUpdate })
const colorHistory = new Map();

// Kullanıcı başına nefes takip verisi
// breathHistory: Map(userId → { peaks: [timestamps], lastY, direction, lastPeakY, rate: null })
const breathHistory = new Map();

// Baseline için gereken minimum örnek sayısı
const BASELINE_SAMPLE_COUNT = 10;

// Kızarma eşiği: R kanalı baseline'dan bu kadar yüksekse
const BLUSH_R_THRESHOLD = 15;
// Solukluk eşiği: tüm kanallar baseline'dan bu kadar düşükse
const PALLOR_THRESHOLD = 20;

// Nefes hız sınırları (dakika başına)
const RAPID_BPM_THRESHOLD = 20;
const HOLDING_SECONDS_THRESHOLD = 8;

/**
 * Kullanıcının renk baseline'ını günceller.
 * İlk 10 örnek baseline oluşturmak için kullanılır.
 * @param {string} userId
 * @param {{ r: number, g: number, b: number, timestamp: number }} rgbSample
 */
export function updateColorBaseline(userId, rgbSample) {
  if (!colorHistory.has(userId)) {
    colorHistory.set(userId, {
      baselineR: null,
      baselineG: null,
      baselineB: null,
      samples: [],
      lastUpdate: rgbSample.timestamp,
    });
  }

  const state = colorHistory.get(userId);
  state.samples.push(rgbSample);
  state.lastUpdate = rgbSample.timestamp;

  // İlk 10 örnekten baseline hesapla
  if (state.samples.length === BASELINE_SAMPLE_COUNT) {
    const len = state.samples.length;
    state.baselineR = state.samples.reduce((sum, s) => sum + s.r, 0) / len;
    state.baselineG = state.samples.reduce((sum, s) => sum + s.g, 0) / len;
    state.baselineB = state.samples.reduce((sum, s) => sum + s.b, 0) / len;
  }

  // Baseline sonrası örnekler birikmesin — son 30 örneği tut
  if (state.samples.length > 30) {
    state.samples.shift();
  }
}

/**
 * Mevcut RGB örneğini baseline ile karşılaştırarak renk anomalisi tespit eder.
 * @param {string} userId
 * @param {{ r: number, g: number, b: number, timestamp: number }} rgbSample
 * @returns {{ type: string, intensity: number, delta_r: number, delta_g: number, delta_b: number } | null}
 */
export function detectColorAnomalies(userId, rgbSample) {
  const state = colorHistory.get(userId);

  // Baseline henüz oluşmadıysa null döndür
  if (!state || state.baselineR === null) return null;

  const delta_r = rgbSample.r - state.baselineR;
  const delta_g = rgbSample.g - state.baselineG;
  const delta_b = rgbSample.b - state.baselineB;

  // Kızarma: R kanalı belirgin yüksek, G/B normal seyirde
  if (
    delta_r >= BLUSH_R_THRESHOLD &&
    Math.abs(delta_g) < BLUSH_R_THRESHOLD &&
    Math.abs(delta_b) < BLUSH_R_THRESHOLD
  ) {
    // Yoğunluk: 0-1 arası normalize (15 delta = 0, 45 delta = 1)
    const intensity = Math.min(1, (delta_r - BLUSH_R_THRESHOLD) / 30);
    return { type: 'kizarma', intensity, delta_r, delta_g, delta_b };
  }

  // Solukluk: tüm kanallar baseline'dan belirgin düşük
  if (
    delta_r <= -PALLOR_THRESHOLD &&
    delta_g <= -PALLOR_THRESHOLD &&
    delta_b <= -PALLOR_THRESHOLD
  ) {
    // Yoğunluk: 0-1 arası normalize (20 delta = 0, 60 delta = 1)
    const intensity = Math.min(
      1,
      (Math.abs(delta_r) - PALLOR_THRESHOLD) / 40
    );
    return { type: 'solgunluk', intensity, delta_r, delta_g, delta_b };
  }

  // Anomali yok
  return null;
}

/**
 * Renk analizine göre Lyra prompt bağlamı oluşturur.
 * @param {string} userId
 * @param {{ r: number, g: number, b: number, timestamp: number }} rgbSample
 * @returns {string} Prompt bağlamı veya boş string
 */
export function buildColorContext(userId, rgbSample) {
  // Önce baseline'ı güncelle
  updateColorBaseline(userId, rgbSample);

  const anomaly = detectColorAnomalies(userId, rgbSample);
  if (!anomaly) return '';

  if (anomaly.type === 'kizarma') {
    return '[YÜZÜ KIZARDI]: Utanç/stres/öfke tepkisi — nazikçe fark et, konuyu zorlamadan devam et.';
  }

  if (anomaly.type === 'solgunluk') {
    return '[YÜZ SOLUKLUGU]: Şok/disosiyasyon/dehşet tepkisi — yavaş, sakin, güven ver.';
  }

  return '';
}

// ─── Nefes Takibi ───────────────────────────────────────────────────────────

/**
 * Omuz Y pozisyonundan nefes ritmini takip eder ve günceller.
 * @param {string} userId
 * @param {number} shoulderY - Normalize edilmiş omuz Y pozisyonu (0-1)
 * @param {number} timestamp - Unix ms
 * @returns {{ bpm: number|null, pattern: 'normal'|'rapid'|'shallow'|'holding'|'unknown' }}
 */
export function updateBreathTracker(userId, shoulderY, timestamp) {
  if (!breathHistory.has(userId)) {
    breathHistory.set(userId, {
      peaks: [],
      lastY: shoulderY,
      direction: 'unknown',
      lastPeakY: null,
      peakAmplitudes: [],
      rate: null,
    });
  }

  const state = breathHistory.get(userId);
  const prevY = state.lastY;
  const prevDirection = state.direction;

  // Hareket yönünü belirle (yukarı = omuz yükseliyor)
  let currentDirection = state.direction;
  if (shoulderY < prevY - 0.002) {
    currentDirection = 'up';
  } else if (shoulderY > prevY + 0.002) {
    currentDirection = 'down';
  }

  // Yön değişimi: yukarıdan aşağıya → nefes tepe noktası (soluk verme başlangıcı)
  if (prevDirection === 'up' && currentDirection === 'down') {
    state.peaks.push(timestamp);

    // Tepe genliğini kaydet (shallow nefes tespiti için)
    if (state.lastPeakY !== null) {
      const amplitude = Math.abs(shoulderY - state.lastPeakY);
      state.peakAmplitudes.push(amplitude);
      if (state.peakAmplitudes.length > 10) state.peakAmplitudes.shift();
    }
    state.lastPeakY = shoulderY;

    // 30 saniyeden eski peaks'leri temizle
    const cutoff = timestamp - 30000;
    state.peaks = state.peaks.filter((t) => t > cutoff);
  }

  state.lastY = shoulderY;
  state.direction = currentDirection;

  // BPM hesapla (son 30 saniyedeki tepe sayısına göre)
  let bpm = null;
  const windowMs = 30000;
  const cutoff = timestamp - windowMs;
  const recentPeaks = state.peaks.filter((t) => t > cutoff);

  if (recentPeaks.length >= 2) {
    // Son 30 saniyedeki nefes sayısını dakikaya normalize et
    const spanSeconds = (timestamp - recentPeaks[0]) / 1000;
    if (spanSeconds > 0) {
      bpm = Math.round((recentPeaks.length / spanSeconds) * 60);
    }
  }

  // Nefes tutma tespiti: son tepe noktasından bu yana >8 saniye
  const lastPeakTime = state.peaks[state.peaks.length - 1] ?? 0;
  const secondsSinceLastPeak = (timestamp - lastPeakTime) / 1000;
  const isHolding = secondsSinceLastPeak > HOLDING_SECONDS_THRESHOLD;

  // Yüzeysel nefes: ortalama genlik çok küçük
  let isShallow = false;
  if (state.peakAmplitudes.length >= 3) {
    const avgAmp =
      state.peakAmplitudes.reduce((s, a) => s + a, 0) /
      state.peakAmplitudes.length;
    isShallow = avgAmp < 0.015; // 0-1 normalize aralığında çok küçük hareket
  }

  // Pattern belirle
  let pattern = 'unknown';
  if (isHolding) {
    pattern = 'holding';
  } else if (bpm !== null && bpm > RAPID_BPM_THRESHOLD) {
    pattern = 'rapid';
  } else if (isShallow) {
    pattern = 'shallow';
  } else if (bpm !== null) {
    pattern = 'normal';
  }

  state.rate = bpm;
  return { bpm, pattern };
}

/**
 * Nefes analizi için Lyra prompt bağlamı oluşturur.
 * @param {string} userId
 * @param {number} shoulderY - Normalize edilmiş omuz Y pozisyonu (0-1)
 * @param {number} timestamp - Unix ms
 * @returns {string} Prompt bağlamı veya boş string
 */
export function buildBreathContext(userId, shoulderY, timestamp) {
  const { pattern } = updateBreathTracker(userId, shoulderY, timestamp);

  if (pattern === 'rapid') {
    return '[NEFES HIZLI]: Anksiyete/panik işareti — yavaşlatıcı bir an yarat.';
  }

  if (pattern === 'holding') {
    return '[NEFES TUTUYOR]: Derin stres/donma tepkisi — fark et ve nazikçe dışarı çıkmasına izin ver.';
  }

  if (pattern === 'shallow') {
    return '[NEFES YÜZEYSEL]: Gergin nefes — vücudun sinyalini dinle.';
  }

  return '';
}
