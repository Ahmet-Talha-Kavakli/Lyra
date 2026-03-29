// lib/safetyMonitoring.js
// Safety Monitoring — self-harm, suicide risk, crisis escalation tespiti
// Türkiye'deki kaynaklara başvuru (ruh sağlığı hattı, acil yardım, vs)
//
// KRITIK: Bu modül terapötik değil, güvenlik-odaklıdır

import { supabase } from './supabase.js';

const SAFETY_RISK_LEVELS = {
  // Riski seviyeleri
  low: { color: 'green', action: 'monitoring' },
  moderate: { color: 'yellow', action: 'increased_monitoring + resources' },
  high: { color: 'orange', action: 'immediate_intervention + resources' },
  critical: { color: 'red', action: 'emergency_escalation' },
};

const SELF_HARM_INDICATORS = {
  direct: [
    /kesiyorum|budamıyorum|kan|kanayan|yara|izler|duvara vuruyor|aşağı inemiyor/gi,
    /hapı|uyuşturucu|alkol|zehir|ölüm|sonu|bitiş/gi,
  ],

  ideation: [
    /ölmek istiyorum|kendimi bitirmek|kurtulmak istiyorum|dayanamıyorum|hiç değer yok/gi,
    /kimse umursamıyor|ben var miyim|yaşamaya değmez|yok edilmek/gi,
  ],

  planning: [
    /planlıyorum|hazırlanıyor|yazılı bıraktım|not yazdım|veda|biliyorum nasıl/gi,
  ],

  means: [
    /baltam var|ilaç topladım|ip aldım|yüksek yere|akıntı|tren|araba/gi,
  ],
};

const PSYCHOLOGICAL_CRISIS_INDICATORS = {
  psychosis: [/sesler|görüntüler|zihin okunuyor|kontrol ediliyorum|gözleyen/gi],
  severe_dissociation: [/hiçbir şey gerçek değil|ben ölüyüm|ölü topuklu|gerçek dişarıda/gi],
  uncontrollable_panic: [
    /nefes alamıyorum|ölüyorum|beynim yolda|kontrol edemiyorum/gi,
  ],
};

/**
 * Self-harm riski tespit et
 * @param {string} userMessage
 * @param {Object} voiceData — ses analizi
 * @param {Array} recentMessages — önceki mesajlar
 * @returns {{ riskLevel: string, indicators: Array, immediateAction: string }}
 */
export function assessSelfHarmRisk(userMessage, voiceData = {}, recentMessages = []) {
  let riskLevel = 'low';
  const indicators = [];

  // ─── DOĞRUDAN UYARI IŞARETI ──────────────────────────────────────────────

  SELF_HARM_INDICATORS.direct.forEach(pattern => {
    if (pattern.test(userMessage)) {
      riskLevel = 'critical';
      indicators.push('direct_self_harm_description');
    }
  });

  // ─── İDEASYON (DÜŞÜNCE) ──────────────────────────────────────────────────

  SELF_HARM_INDICATORS.ideation.forEach(pattern => {
    if (pattern.test(userMessage)) {
      if (riskLevel !== 'critical') riskLevel = 'high';
      indicators.push('suicidal_ideation');
    }
  });

  // ─── PLAN (DETAY) ───────────────────────────────────────────────────────

  SELF_HARM_INDICATORS.planning.forEach(pattern => {
    if (pattern.test(userMessage)) {
      riskLevel = 'critical';
      indicators.push('suicide_planning');
    }
  });

  // ─── ARAÇ (MEANS) ───────────────────────────────────────────────────────

  SELF_HARM_INDICATORS.means.forEach(pattern => {
    if (pattern.test(userMessage)) {
      if (riskLevel === 'low') riskLevel = 'high';
      indicators.push('access_to_means');
    }
  });

  // ─── SES ANALİZİ ────────────────────────────────────────────────────────

  // Monoton, sessiz, "vedat" hissi
  if (voiceData.monotone && voiceData.loudness < 50) {
    if (riskLevel === 'low') riskLevel = 'moderate';
    indicators.push('voice_pattern_depressive');
  }

  // Hopelessness sesi (yavaş, düz, boş)
  if (voiceData.tempo < 70 && voiceData.loudness < 60) {
    if (riskLevel === 'low' || riskLevel === 'moderate') riskLevel = 'moderate';
    indicators.push('voice_pattern_hopelessness');
  }

  // ─── ÖNCEKİ SEANSLAR ────────────────────────────────────────────────────

  if (recentMessages && recentMessages.length > 0) {
    const patternCount = recentMessages.filter(m => {
      return (
        m.role === 'user' &&
        (SELF_HARM_INDICATORS.ideation.some(p =>
          p.test(m.content),
        ) ||
          SELF_HARM_INDICATORS.direct.some(p =>
            p.test(m.content),
          ))
      );
    }).length;

    if (patternCount >= 3) {
      riskLevel = 'high';
      indicators.push('recurring_ideation');
    }
  }

  // ─── HEMEN YAPILACAK ────────────────────────────────────────────────────

  let immediateAction = '';

  if (riskLevel === 'critical') {
    immediateAction =
      `[SAFETY — ACIL KRİZ]\n` +
      `Senin güvenliğin en önemli.\n\n` +
      `🚨 HEMENŞİMDİ:\n` +
      `1. Türkiye İntihar Önleme Derneği (TÜIÖK): 0.800.273.8255 (ücretsiz 24/7)\n` +
      `2. Ruh Sağlığı Uzmanı: 0533 xxx xxxx (hastanizin hattı)\n` +
      `3. İtfaiye/Ambulans: 112\n` +
      `4. Acil Servis: En yakın hastane\n\n` +
      `Veya Lyra'ya söyle: "Yardıma ihtiyacım var" — hemen kriz protokolü başlayacağız.`;
  } else if (riskLevel === 'high') {
    immediateAction =
      `[SAFETY — YÜKSEK RİSK]\n` +
      `Ciddi düşünceler var. Kontrol alanlarını kur:\n\n` +
      `• Terapist/doktor: Bugün ulaş, acil randevu al\n` +
      `• Güvenli kişi: Birine söyle (aile, arkadaş), yanında kal\n` +
      `• Araçları uzaklaştır: Ağır ilaçları, keskin nesneleri saf bir yer dışarı koy\n` +
      `• 24/7 Hat: 0.800.273.8255\n` +
      `• Söyle bana: Bugün nasıl güvende kalacaksın?`;
  } else if (riskLevel === 'moderate') {
    immediateAction =
      `[SAFETY — ORTA RİSK]\n` +
      `Endişe haklı, ama kontrol altında. Yapılması gerekenler:\n` +
      `• Bu seansı başkasına söyle\n` +
      `• Terapist/doktor ile görüş (birkaç gün içinde)\n` +
      `• Kendini destekleyen etkinliklere katıl\n` +
      `• Düşünceler yoğunlaşırsa hemen 112.`;
  }

  return {
    riskLevel,
    indicators,
    immediateAction,
  };
}

/**
 * Psikolojik kriz tespit et (psikoz, şiddetli disosiyasyon, kontrol edilemez panik)
 * @param {string} userMessage
 * @returns {{ hasCrisis: boolean, crisisType: string, severity: string, intervention: string }}
 */
export function detectPsychologicalCrisis(userMessage) {
  let crisisDetected = false;
  let crisisType = 'none';
  let severity = 'none';

  // ─── PSİKOZ İŞARETLERİ ──────────────────────────────────────────────────

  PSYCHOLOGICAL_CRISIS_INDICATORS.psychosis.forEach(pattern => {
    if (pattern.test(userMessage)) {
      crisisDetected = true;
      crisisType = 'psychosis';
      severity = 'high';
    }
  });

  // ─── ŞİDDETLİ DİSOSİYASYON ──────────────────────────────────────────────

  PSYCHOLOGICAL_CRISIS_INDICATORS.severe_dissociation.forEach(pattern => {
    if (pattern.test(userMessage)) {
      crisisDetected = true;
      crisisType = 'severe_dissociation';
      severity = 'high';
    }
  });

  // ─── KONTROL EDİLEMEZ PANİK ──────────────────────────────────────────────

  PSYCHOLOGICAL_CRISIS_INDICATORS.uncontrollable_panic.forEach(pattern => {
    if (pattern.test(userMessage)) {
      crisisDetected = true;
      crisisType = 'uncontrollable_panic';
      severity = 'moderate';
    }
  });

  // ─── MÜDAHALE ───────────────────────────────────────────────────────────

  let intervention = '';

  if (crisisType === 'psychosis') {
    intervention =
      `[CRISIS — PSİKOZ]\n` +
      `Zihinde anormal şeyler oluyor. Bu tıbbi bir durum.\n\n` +
      `HEMENŞİMDİ:\n` +
      `1. Hastaneye git / 112 ara\n` +
      `2. Psikiyatr ve sağlık göz: Test, teşhis, ilaç\n` +
      `3. Eğer güvenlikli hissetmiyorsan: Acil kabul\n\n` +
      `Bu Lyra'nın alanı değil — tıbbi yardım lazım.`;
  } else if (crisisType === 'severe_dissociation') {
    intervention =
      `[CRISIS — ŞİDDETLİ DİSOSİYASYON]\n` +
      `Beden-benlik bağlantısı çok kopmuş. Grounding önemli.\n\n` +
      `HEMEN:\n` +
      `1. 5-4-3-2-1 tekniği (aşağı bak)\n` +
      `2. Buz tuş (parmakların ucunda)\n` +
      `3. Ses çıkar, vücudu hareket ettir\n` +
      `4. Bir insana söyle (arkadaş, aile)\n` +
      `5. Hala kopuksa: Hastaneye git\n`;
  } else if (crisisType === 'uncontrollable_panic') {
    intervention =
      `[CRISIS — KONTROL EDİLEMEZ PANİK]\n` +
      `Panik cezası değil, fizyoloji. Kontrol edilebilir.\n\n` +
      `HEMEN:\n` +
      `1. Yer değiştir (kapat → aç)\n` +
      `2. Soğuk su yüzüne döküt\n` +
      `3. Ayakları yere bas, hava al\n` +
      `4. Nefes sayma: 4 saniye içeri, 6 saniye dışarı\n` +
      `5. Hala yoğunsa: Arama 112 ambulans`;
  }

  return {
    hasCrisis: crisisDetected,
    crisisType,
    severity,
    intervention,
  };
}

/**
 * Güvenlik planı oluştur (self-harm riski olduğunda)
 * @param {string} userId
 * @param {Object} riskAssessment
 */
export async function recordSafetyPlan(userId, riskAssessment) {
  try {
    const { error } = await supabase.from('safety_plans').insert({
      user_id: userId,
      risk_level: riskAssessment.riskLevel,
      indicators: JSON.stringify(riskAssessment.indicators),
      created_at: new Date().toISOString(),
      status: 'active',
    });

    if (error) {
      console.error('[safetyMonitoring] Güvenlik planı hatası:', error.message);
    }
  } catch (err) {
    console.error('[safetyMonitoring] Hata:', err.message);
  }
}

/**
 * Türkiye'deki yardım kaynakları
 * @returns {Object}
 */
export function getTurkishMentalHealthResources() {
  return {
    crisis: {
      name: 'Türkiye İntihar Önleme Derneği',
      phone: '0.800.273.8255',
      hours: '24/7',
      free: true,
    },
    emergency: {
      ambulance: '112',
      police: '155',
      emergency: '112',
    },
    hotlines: [
      {
        name: 'Aile, Çalışma ve Sosyal Hizmetler Bakanlığı — Sosyal Destek Hattı',
        phone: '157',
      },
      {
        name: 'Sabahat Akkiraz — Çocuk İstismarı İhbar Hattı',
        phone: '0212 555 22 00',
      },
    ],
    online: {
      TalkLife: 'https://www.talklife.co',
      BetterHelp: 'https://www.betterhelp.com',
    },
  };
}
