/**
 * Lyra Terapi Motoru
 * 5 mod + otomatik teknik seçimi
 */

import { TECHNIQUES, getTechniquesForSituation, rankTechniques } from './techniqueLibrary.js';

// ─── Modlar ──────────────────────────────────────────────────────────────────

export const MODES = {
  LISTENING: {
    id: 'LISTENING',
    name: 'Dinleme Modu',
    description: 'Sadece dinle, yansıt, doğrula. Çözüm yok, tavsiye yok.',
    when: ['ilk_kez_açılıyor', 'yoğun_duygu', 'ağlama', 'ihtiyaç_duyulmak'],
    prompt_instruction:
      'SADECE dinle ve yansıt. Kısa cümleler. "Devam et, dinliyorum" enerjisi. Çözüm SUNMA.',
  },
  EXPLORATION: {
    id: 'EXPLORATION',
    name: 'Keşif Modu',
    description: 'Derinleştirici sorularla içe açılmayı sağla.',
    when: ['merak', 'yüzeysel_kalıyor', 'daha_fazla_var'],
    prompt_instruction:
      'Açık uçlu, derinleştirici sorular sor. Bir anda bir soru. Acele etme.',
  },
  WORKING: {
    id: 'WORKING',
    name: 'Çalışma Modu',
    description: 'Aktif teknik uygula. Kişi açılmış, hazır.',
    when: ['hazır', 'güven_kuruldu', 'değişim_istiyor'],
    prompt_instruction: 'Seçilen tekniği uygula. Aktif çalışma zamanı.',
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Büyüme Modu',
    description: 'Kazanımları pekiştir, ileriyi planla.',
    when: ['iyi_hissediyor', 'breakthrough_sonrası', 'ilerliyor'],
    prompt_instruction: 'Kazanımları kutla ve pekiştir. Bir sonraki adımı planla.',
  },
  STABILIZATION: {
    id: 'STABILIZATION',
    name: 'Stabilizasyon Modu',
    description: 'Zor anlarda önce güvenli alan oluştur.',
    when: ['kriz', 'panik', 'çöküş', 'kendine_zarar_düşüncesi'],
    prompt_instruction:
      'Önce güvenli alan. Nefes. Sakin ton. Hiçbir şey çok ağır değil. Yavaş.',
  },
};

// ─── Mod Seçimi ───────────────────────────────────────────────────────────────

/**
 * Mevcut duruma göre terapi modunu seçer.
 *
 * @param {string} currentEmotion - Tespit edilen mevcut duygu
 * @param {string} messageContent - Kullanıcının mesajı
 * @param {Array}  sessionHistory  - Oturum geçmişi dizisi
 * @param {Object} profile         - Kullanıcı profili
 * @returns {Object} Seçilen MODES nesnesi
 */
export function selectMode(currentEmotion, messageContent, sessionHistory, profile) {
  const content = (messageContent || '').toLowerCase();

  // 1. Stabilizasyon — kriz sinyalleri
  const stabilizationTriggers = [
    'intihar',
    'ölmek istiyorum',
    'kendime zarar',
    'dayanamıyorum artık',
    'bırakmak istiyorum',
    'anlamsız',
    'hiçbir şeyin önemi yok',
  ];
  if (stabilizationTriggers.some((trigger) => content.includes(trigger))) {
    return MODES.STABILIZATION;
  }

  // 2. Dinleme — yoğun duygusal ifadeler
  const listeningTriggers = [
    'ağlıyorum',
    'çok üzgün',
    'kırıldım',
    'dayanamıyorum',
    'çok ağır',
  ];
  if (listeningTriggers.some((trigger) => content.includes(trigger))) {
    return MODES.LISTENING;
  }

  // 3. Büyüme — ilerleme ve farkındalık ifadeleri
  const growthTriggers = [
    'daha iyi hissediyorum',
    'anladım',
    'fark ettim',
    'değişti',
  ];
  if (growthTriggers.some((trigger) => content.includes(trigger))) {
    return MODES.GROWTH;
  }

  // 4. Keşif — kısa oturum geçmişi veya kısa mesaj
  if ((sessionHistory || []).length < 3 || (messageContent || '').length < 50) {
    return MODES.EXPLORATION;
  }

  // 5. Varsayılan: Çalışma Modu
  return MODES.WORKING;
}

// ─── Teknik Seçimi ────────────────────────────────────────────────────────────

/**
 * Moda ve profile göre uygulanacak teknikleri seçer.
 *
 * @param {Object} mode              - Seçilen mod nesnesi (MODES.X)
 * @param {Object} profile           - Kullanıcı profili
 * @param {string} currentEmotion    - Tespit edilen mevcut duygu
 * @param {Array}  topics            - Oturumdaki konular
 * @param {Array}  effectivenessData - Teknik etkinlik verisi
 * @returns {Object[]} Seçilen teknik nesneleri dizisi
 */
export function selectTechniques(mode, profile, currentEmotion, topics, effectivenessData) {
  // Stabilizasyon modu — sabit kriz teknikleri
  if (mode.id === 'STABILIZATION') {
    return ['CRISIS_STABILIZATION', 'BREATHING', 'MINDFULNESS']
      .map((id) => TECHNIQUES.find((t) => t.id === id))
      .filter(Boolean);
  }

  // Dinleme modu — ilişkisel / güvenli teknikler
  if (mode.id === 'LISTENING') {
    return ['PCT', 'TRAUMA_INFORMED']
      .map((id) => TECHNIQUES.find((t) => t.id === id))
      .filter(Boolean);
  }

  // Diğer modlar — profile özgü teknik seçimi
  const situationTags = [currentEmotion, ...(topics || [])].filter(Boolean);

  if (profile?.life_schemas?.length > 0) {
    situationTags.push('derin_inanç_sistemi');
  }

  if (profile?.attachment_style === 'endiseli') {
    situationTags.push('terk_korkusu');
  }

  if ((profile?.session_count ?? 0) < 3) {
    situationTags.push('yeni_kullanici');
  }

  const candidates = getTechniquesForSituation(
    situationTags.join(' '),
    profile?.healing_style
  );

  const ranked = rankTechniques(candidates, effectivenessData);

  return ranked.slice(0, 3);
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

/**
 * Terapi motorunu çalıştırır — mod ve teknikleri belirler.
 *
 * @param {Object} params
 * @param {string} params.currentEmotion    - Tespit edilen mevcut duygu
 * @param {string} params.messageContent    - Kullanıcının mesajı
 * @param {Array}  params.sessionHistory    - Oturum geçmişi
 * @param {Object} params.profile           - Kullanıcı profili
 * @param {Array}  params.topics            - Oturumdaki konular
 * @param {Array}  params.effectivenessData - Teknik etkinlik verisi
 * @returns {{
 *   mode: Object,
 *   techniques: Object[],
 *   primaryTechnique: Object,
 *   modeInstruction: string,
 *   techniqueHints: string
 * }}
 */
export function runTherapyEngine({
  currentEmotion,
  messageContent,
  sessionHistory,
  profile,
  topics,
  effectivenessData,
}) {
  const mode = selectMode(currentEmotion, messageContent, sessionHistory, profile);

  const techniques = selectTechniques(
    mode,
    profile,
    currentEmotion,
    topics,
    effectivenessData
  );

  const primaryTechnique =
    techniques[0] || TECHNIQUES.find((t) => t.id === 'PCT');

  const modeInstruction = mode.prompt_instruction;

  const techniqueHints = techniques.map((t) => t.prompt_hint).join('\n');

  return {
    mode,
    techniques,
    primaryTechnique,
    modeInstruction,
    techniqueHints,
  };
}
