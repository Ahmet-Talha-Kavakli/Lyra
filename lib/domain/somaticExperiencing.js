// lib/somaticExperiencing.js
// Somatic Experiencing (SE) — travma + vücut bağlantısı
// Porges Polyvagal, Levine modeli

const NERVOUS_SYSTEM_STATES = {
  parasympathetic: {
    name: 'Güvenli (Parasempatik)',
    signals: ['Nefes sakin', 'Kalp normal', 'Kas gevşek'],
  },
  sympathetic: {
    name: 'Tehlike (Sempatik)',
    signals: ['Hızlı nefes', 'Hızlı kalp', 'Kas gerilim', 'Titreme'],
  },
  freeze: {
    name: 'Donma (Vagal Freeze)',
    signals: ['Nefes tutuluyor', 'Kalp yavaş', 'Kas çöküyor'],
  },
};

const SOMATIC_MARKERS = {
  chest_tightness: {
    name: 'Göğüs Sıkması',
    trigger: 'Kaygı, panik',
    meaning: 'Sinir sistemi tehlike algılıyor',
  },
  throat_knot: {
    name: 'Boğazda Düğüm',
    trigger: 'Duygusal bastırma',
    meaning: 'Ses bastırılıyor',
  },
  stomach_tension: {
    name: 'Midem Geriliyor',
    trigger: 'Endişe, kaygı',
    meaning: 'Güvenlik kaybı',
  },
};

export function detectFreezeState(userState = {}) {
  const { tempo = 0, breathing = {}, gaze = {} } = userState;
  const freezeIndicators = {
    breathHolding: breathing.pattern === 'holding',
    heartSlow: tempo < 40,
    voiceQuiet: tempo === 0,
  };
  const freezeCount = Object.values(freezeIndicators).filter(Boolean).length;
  return {
    isFrozen: freezeCount >= 2,
    severity: freezeCount / 3,
  };
}

export function buildSomaticGroundingContext(somaticMarkers = {}) {
  let context = `[SOMATIC GROUNDİNG]\n\n`;
  context += `5-AYAKLI GROUNDING (5-4-3-2-1):\n`;
  context += `🟢 5 şey görüyorum\n`;
  context += `🔵 4 şey dokunuyorum\n`;
  context += `🟡 3 şey işitiyorum\n`;
  context += `🟣 2 şey kokluyorum\n`;
  context += `⚫ 1 şey tadıyorum\n\n`;
  context += `Pendulation: Güvenlik → Travma → Güvenlik\n`;
  return context;
}

export function detectTraumaTriggers(userMessage = '') {
  const text = userMessage.toLowerCase();
  const triggerPatterns = {
    sudden: /ani|birdenbire|şok/i,
    helplessness: /yapamadım|güçsüz|duramadım/i,
    mortality: /ölüm|öldüm|öleceğim/i,
  };
  const detected = Object.entries(triggerPatterns)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  return {
    hasTraumaTriggers: detected.length > 0,
    detectedTypes: detected,
  };
}

export function assessTraumaLevel(userMessage = '') {
  const text = userMessage.toLowerCase();
  const level = 
    /ani|şok/.test(text) ? 2 :
    /her gün|hep|uzun/.test(text) ? 2 :
    /gerçeklik|uzak|uyuşukluk/.test(text) ? 3 : 1;
  return {
    traumaLevel: ['mild', 'moderate', 'severe'][Math.min(level - 1, 2)],
    isComplex: level >= 2,
  };
}
