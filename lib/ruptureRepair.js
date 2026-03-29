// lib/ruptureRepair.js
// Rupture & Repair — terapötik ilişkideki kopuşu tespit ve onarma
// "Sana kızdığını hissettim", "Beni anlamıyorsun", vs.
//
// Stern & Slade: Rupture'lar terapinin en güçlü öğretme anlarıdır

import { supabase } from './supabase.js';

const RUPTURE_SIGNALS = {
  // Doğrudan işaret
  direct: [
    /kızgın|öfke|sinir/gi,
    /işe yaramıyor|yardım etmiyor/gi,
    /anlamıyorsun|yanlış|hata yaptın/gi,
  ],

  // Dolaylı işaret
  indirect: [
    /kısa cevaplar|tek kelime|...|hmm/gi,
    /no longer need|goodbye|leave/gi,
    /mesafe|uzak|soğuk/gi,
  ],

  // Protesto
  protest: [
    /niye bunu|niye yalan|niye aşağılanıyorum/gi,
    /sen benim|hakkında|düşün|sen mi/gi,
  ],
};

/**
 * Rupture (terapötik ilişkide kopuş) tespit et
 * @param {Array} recentMessages — son 5-10 mesaj
 * @param {Object} lastSessionNote — "Lyra'nın söylediği" önceki seanstan
 * @returns {{ hasRupture: boolean, severity: string, triggers: Array, signals: Array }}
 */
export function detectRupture(recentMessages = [], lastSessionNote = {}) {
  if (!recentMessages || recentMessages.length === 0) {
    return {
      hasRupture: false,
      severity: 'none',
      triggers: [],
      signals: [],
    };
  }

  let signalCount = 0;
  const triggers = [];
  const signals = [];

  // Son kullanıcı mesajlarını analiz et
  const userMessages = recentMessages.filter(m => m.role === 'user').map(m => m.content);

  // ─── DOĞRUDAN RUPTURE İŞARETLERİ ──────────────────────────────────────

  userMessages.forEach(msg => {
    RUPTURE_SIGNALS.direct.forEach(pattern => {
      if (pattern.test(msg)) {
        signalCount++;
        signals.push({
          type: 'direct',
          indicator: msg.substring(0, 50),
        });
        triggers.push('direct_anger_or_criticism');
      }
    });
  });

  // ─── DOLAYLІ RUPTURE İŞARETLERİ ───────────────────────────────────────

  userMessages.forEach(msg => {
    const wordCount = msg.split(' ').length;
    const avgWordLength = msg.length / wordCount;

    if (wordCount < 5 || avgWordLength < 3) {
      signalCount++;
      signals.push({
        type: 'indirect_withdrawal',
        indicator: 'Short, clipped responses',
      });
      triggers.push('emotional_withdrawal');
    }

    RUPTURE_SIGNALS.indirect.forEach(pattern => {
      if (pattern.test(msg)) {
        signalCount++;
        signals.push({
          type: 'indirect',
          indicator: msg.substring(0, 50),
        });
        triggers.push('distancing_or_dismissal');
      }
    });
  });

  // ─── PROTESTO RUPTURESİ ─────────────────────────────────────────────────

  userMessages.forEach(msg => {
    RUPTURE_SIGNALS.protest.forEach(pattern => {
      if (pattern.test(msg)) {
        signalCount++;
        signals.push({
          type: 'protest',
          indicator: msg.substring(0, 50),
        });
        triggers.push('protest_or_blame');
      }
    });
  });

  // Severity belirle
  let severity = 'none';
  if (signalCount >= 3) severity = 'severe';
  else if (signalCount >= 2) severity = 'moderate';
  else if (signalCount >= 1) severity = 'mild';

  return {
    hasRupture: severity !== 'none',
    severity,
    triggers: [...new Set(triggers)],
    signals,
  };
}

/**
 * Rupture'ın kaynağını tahmin et
 * @param {string} lastLyraMessage — Lyra'nın son söylediği
 * @param {string} currentUserMessage — Kullanıcı'nın tepkisi
 * @param {Object} sessionContext
 * @returns {{ likelySource: string, hypothesis: string }}
 */
export function hypothesizeRuptureSource(
  lastLyraMessage = '',
  currentUserMessage = '',
  sessionContext = {}
) {
  const hypothesis = [];

  // Lyra'nın son mesajı çok yönlendirici mi?
  if (lastLyraMessage.length > 300 || lastLyraMessage.match(/yapmalısın|demeliysin|öneriyorum/gi)) {
    hypothesis.push({
      source: 'directiveness',
      explanation: 'Lyra çok yönlendirici davrandı, otorite pozisyonunu aldı',
    });
  }

  // Lyra challenge çok erken mi geldi?
  if (lastLyraMessage.match(/ama|ancak|fakat|yanlış/gi)) {
    hypothesis.push({
      source: 'premature_challenge',
      explanation: 'Lyra daha erken challenge yaptı, kullanıcı henüz hazır değildi',
    });
  }

  // Lyra yanlış anlama gösterdi mi?
  if (
    lastLyraMessage.match(/galiba|sanırım|belki/gi) &&
    currentUserMessage.match(/hayır|değil|yanlış/gi)
  ) {
    hypothesis.push({
      source: 'misunderstanding',
      explanation: 'Lyra yanlış anlamış, kullanıcı bunu düzeltmek için kızdı',
    });
  }

  // Transference tetiklendi mi?
  if (
    lastLyraMessage.match(/sadece|hep|kimse|sen|sana/gi) &&
    currentUserMessage.match(/kendin|benim hakkımda/gi)
  ) {
    hypothesis.push({
      source: 'transference_trigger',
      explanation: 'Lyra'nın sözü transference tetikledi, kullanıcı şimdi Lyra'ya bakarak görüyor',
    });
  }

  const likelySource = hypothesis.length > 0
    ? hypothesis[0].source
    : 'unknown';

  return {
    likelySource,
    hypotheses: hypothesis,
  };
}

/**
 * Repair (onarma) stratejisini oluştur
 * @param {Object} ruptureAssessment — detectRupture() sonucu
 * @param {Object} sourceHypothesis — hypothesizeRuptureSource() sonucu
 * @returns {string}
 */
export function buildRepairContext(ruptureAssessment = {}, sourceHypothesis = {}) {
  const { hasRupture, severity, triggers } = ruptureAssessment;
  const { likelySource } = sourceHypothesis;

  if (!hasRupture) return '';

  // ─── REPAIR STRATEJILERI ───────────────────────────────────────────────

  const repairs = {
    directiveness: `Yeni yaklaşım: Daha çok danış, daha az söyle. "Ne düşünüyorsun?" ile başla.`,
    premature_challenge: `Yeni yaklaşım: Önce validate, sonra gentle challenge. Hızını yavaşlat.`,
    misunderstanding: `Yeni yaklaşım: "Yanlış anladığım" itiraf et, açıklaması için sor.`,
    transference_trigger: `Yeni yaklaşım: Transference'ı isimlendir. "Belki seni başkasıyla karıştırıyorsun?"`,
    unknown: `Yeni yaklaşım: Açık sor, "Beni yanlış anladım mı? Nedir?"`,
  };

  const repairStrategy = repairs[likelySource] || repairs.unknown;

  // ─── REPAIR MESSAGE ──────────────────────────────────────────────────

  let context = '';

  if (severity === 'severe') {
    context += `[RUPTURE — ŞİDDETLİ]\nDerinden kırıldığını hissettim. Bunu konuşmalıyız.\n`;
    context += `→ Açılış: "Seni hayal kırıklığına uğrattığım için üzgünüm. Ne oldu?\n`;
  } else if (severity === 'moderate') {
    context += `[RUPTURE — ORTA]\nAraya biraz mesafe girmiş. Onu kapatmalıyız.\n`;
    context += `→ Açılış: "Biraz ters gitti sanırım. Anlatsana?\n`;
  } else {
    context += `[RUPTURE — HAFIF]\nUfak bir gerilim. Şeffaflık ile düzeltebiliriz.\n`;
    context += `→ Açılış: "Ses tonundan biraz uzak hissetim. Tamam mısın?\n`;
  }

  context += `\n${repairStrategy}\n`;
  context += `\n→ Görev: Güvenliği geri kurmak, uyumu restore etmek.`;

  return context;
}

/**
 * Repair'ı takip et — kopuş iyileştirme prosesi
 * @param {string} userId
 * @param {Object} ruptureEvent
 * @param {string} repairAction — "acknowledged" | "validated" | "resolved"
 */
export async function recordRuptureRepairProcess(userId, ruptureEvent, repairAction) {
  try {
    const { error } = await supabase
      .from('rupture_repair_log')
      .insert({
        user_id: userId,
        detected_at: new Date().toISOString(),
        severity: ruptureEvent.severity,
        triggers: JSON.stringify(ruptureEvent.triggers),
        repair_action: repairAction,
        resolved: repairAction === 'resolved',
      });

    if (error) {
      console.error('[ruptureRepair] Log hatası:', error.message);
    }
  } catch (err) {
    console.error('[ruptureRepair] Hata:', err.message);
  }
}

/**
 * Geçmiş rupture'lar hesap et ve pattern bul
 * @param {string} userId
 * @returns {Promise<{ frequencyPerMonth: number, patterns: Array, riskAreas: Array }>}
 */
export async function analyzeRupturePatterns(userId) {
  try {
    const { data: ruptureLog } = await supabase
      .from('rupture_repair_log')
      .select('severity, triggers, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!ruptureLog || ruptureLog.length === 0) {
      return {
        frequencyPerMonth: 0,
        patterns: [],
        riskAreas: [],
      };
    }

    // Sıklık (son 30 gün)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRuptures = ruptureLog.filter(r => new Date(r.created_at) > thirtyDaysAgo);
    const frequencyPerMonth = Math.round((recentRuptures.length / 30) * 30);

    // Trigger patternleri
    const triggerCounts = {};
    ruptureLog.forEach(r => {
      if (r.triggers) {
        try {
          const triggers = JSON.parse(r.triggers);
          triggers.forEach(t => {
            triggerCounts[t] = (triggerCounts[t] || 0) + 1;
          });
        } catch (_) {
          /* JSON parse hatası — devam et */
        }
      }
    });

    const patterns = Object.entries(triggerCounts)
      .filter(([, count]) => count >= 2)
      .map(([trigger, count]) => `${trigger} (${count}x)`);

    // Risk alanları (sık gelen severity'ler)
    const severityDist = {};
    ruptureLog.forEach(r => {
      severityDist[r.severity] = (severityDist[r.severity] || 0) + 1;
    });

    const riskAreas = Object.entries(severityDist)
      .sort(([, a], [, b]) => b - a)
      .map(([level, count]) => `${level}: ${count} olay`);

    return {
      frequencyPerMonth,
      patterns,
      riskAreas,
    };
  } catch (err) {
    console.error('[ruptureRepair] Pattern analizi hatası:', err.message);
    return {
      frequencyPerMonth: 0,
      patterns: [],
      riskAreas: [],
    };
  }
}
