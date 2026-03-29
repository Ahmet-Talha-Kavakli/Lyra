// lib/culturalSensitivity.js
// Cultural Sensitivity — kültürel bağlam, değerler, tabu konular
// Türkiye'deki sosyal norm, din, aile yapısı, cinsiyet rolleri vs.
//
// Terapötik ilişkinin temel: Kullanıcının dünyasını onun çerçevesinden anlamak

import { supabase } from './supabase.js';

const CULTURAL_CONTEXTS = {
  // Türkiye'deki temel kültürel faktörler
  family: {
    significance: 'Aile çekirdek sosyal birim, bağlılık güçlü',
    taboos: ['ailenin adını kirletme', 'ebeveyne karşı gelme', 'gizli saklı kalmak'],
    values: ['aile onuru', 'ahlaklılık', 'bağlılık', 'saygı'],
    therapeutic_note: 'Birey-odaklı terapiden ziyade aile sisteminin gücü ve zorlukları görülmeli',
  },

  religion: {
    significance: 'İslam kültür ve kimliğin merkezinde (çoğu için)',
    taboos: ['dinin eleştirisi', 'dinsizlik', 'helal-haram ihlali'],
    values: ['kader inancı', 'sabır', 'dua', 'kişisel sorumluluk'],
    therapeutic_note: 'Çatışma: Modern bireycilik vs dinsel otorite. Entegrasyon, değiştirme değil',
  },

  gender: {
    significance: 'Geleneksel cinsiyet rolleri hala güçlü (değişiyor ama)',
    taboos_male: ['emosiyon göstermek', 'yardım almak', 'zayıflık'],
    taboos_female: ['bağımsızlık arzusu', 'cinsel özerklik', 'evliliğe karşı durmak'],
    values: ['erkeklik onuru', 'kadın namusu', 'aile repütasyonu'],
    therapeutic_note: 'Cinsiyete göre farklı tepkiler olabilir. Rolleri sorgulamadan önce bağlantı kur',
  },

  shame: {
    significance: 'Kültür: Utanç-temelli (guilt-based değil, shame-based)',
    examples: ['komşu ne der', 'ailenin itibarı', 'çocuğun adı', 'dış görünüş'],
    protective: 'Sosyal baskı aslında stabilite sağlayabilir (ama da tuzak olabilir)',
    therapeutic_note: 'Utancı eleştirme, entegre etme. Kimin için utanç hissiyor?',
  },

  communication: {
    style: 'İndirekt, nazik, hoşgörüsü olan (özellikle erkekler için)',
    taboos: ['doğrudan çatışma', 'duygusal ifade', 'konuyu değiştirme'],
    norms: ['tatlı laf', 'çay kahve içerken', 'başka yoldan söylemek'],
    therapeutic_note: 'Naziklığin arkasında ne yatıyor? Gerçek duygular çıkaramıyor mu?',
  },
};

/**
 * Kullanıcının kültürel profili çıkart (mesajlardan)
 * @param {string} userId
 * @param {Array} recentMessages
 * @returns {{ religiosity: string, familyOrientation: string, genderRole: string, shameLevel: string }}
 */
export function assessCulturalProfile(userId, recentMessages = []) {
  const profile = {
    religiosity: 'unknown',
    familyOrientation: 'moderate',
    genderRole: 'modern',
    shameLevel: 'moderate',
    cultureSpecificConcerns: [],
  };

  if (!recentMessages || recentMessages.length === 0) return profile;

  const userMessages = recentMessages.filter(m => m.role === 'user').map(m => m.content);
  const fullText = userMessages.join(' ').toLowerCase();

  // ─── DİNİYET SEVIYESI ───────────────────────────────────────────────────

  const religiousKeywords = [
    'dua',
    'namaz',
    'haram',
    'helal',
    'kur\'an',
    'peygamber',
    'islam',
    'günahkâr',
  ];
  const secularKeywords = ['dini değil', 'inanmıyorum', 'ateist', 'rasyonal', 'bilim'];

  const religiousCount = religiousKeywords.filter(w => fullText.includes(w)).length;
  const secularCount = secularKeywords.filter(w => fullText.includes(w)).length;

  if (religiousCount > secularCount && religiousCount >= 2) {
    profile.religiosity = 'high';
  } else if (secularCount > religiousCount && secularCount >= 2) {
    profile.religiosity = 'low';
  } else if (religiousCount + secularCount >= 1) {
    profile.religiosity = 'moderate';
  }

  // ─── AİLE YÖNELIMI ──────────────────────────────────────────────────────

  const familyKeywords = [
    'aile',
    'anne',
    'baba',
    'kardeş',
    'ebeveyn',
    'evin',
    'aile desteği',
  ];
  const independenceKeywords = [
    'kendi',
    'bağımsız',
    'evden çıkmak',
    'ayrılmak',
    'özerk',
  ];

  const familyCount = familyKeywords.filter(w => fullText.includes(w)).length;
  const independenceCount = independenceKeywords.filter(w => fullText.includes(w)).length;

  if (familyCount > independenceCount * 2) {
    profile.familyOrientation = 'high_dependence';
  } else if (independenceCount > familyCount) {
    profile.familyOrientation = 'independence_seeking';
  }

  // ─── CİNSİYET ROLÜ ─────────────────────────────────────────────────────

  const traditionalKeywords = ['erkek rolü', 'kadın rolü', 'aile reisi', 'namussuz'];
  const modernKeywords = ['eşitlik', 'kendi kararım', 'feminist', 'cinsiyet tarafsız'];

  const traditionalCount = traditionalKeywords.filter(w => fullText.includes(w)).length;
  const modernCount = modernKeywords.filter(w => fullText.includes(w)).length;

  if (traditionalCount > modernCount) {
    profile.genderRole = 'traditional';
  } else if (modernCount > traditionalCount) {
    profile.genderRole = 'modern';
  }

  // ─── UTANÇ SEVİYESİ ─────────────────────────────────────────────────────

  const shameKeywords = [
    'utanç',
    'komşu ne der',
    'itibar',
    'namus',
    'dedikodu',
    'ayıp',
  ];
  const shameCount = shameKeywords.filter(w => fullText.includes(w)).length;

  if (shameCount >= 3) {
    profile.shameLevel = 'high';
  } else if (shameCount >= 1) {
    profile.shameLevel = 'moderate';
  } else {
    profile.shameLevel = 'low';
  }

  return profile;
}

/**
 * Kültürel hassasiyet bağlamı oluştur
 * @param {Object} culturalProfile
 * @returns {string}
 */
export function buildCulturalSensitivityContext(culturalProfile = {}) {
  const parts = [];

  // ─── DİNİ BAĞLAM ────────────────────────────────────────────────────────

  if (culturalProfile.religiosity === 'high') {
    parts.push(
      `[CULTURAL — DİNİ BAĞLAM]\n` +
      `Dinini ciddiye alıyor. Din-hayat entegrasyonuna dikkat. Terapiye dini çerçeve ekleyebiliriz.`
    );
  } else if (culturalProfile.religiosity === 'low') {
    parts.push(
      `[CULTURAL — SEKÜLERİZM]\n` +
      `Dinden bağımsız yaklaşıyor. Anlamlandırma başka kaynaklardan geliyor (felsefe, bilim, kültür).`
    );
  }

  // ─── AİLE BAĞLAMI ───────────────────────────────────────────────────────

  if (culturalProfile.familyOrientation === 'high_dependence') {
    parts.push(
      `[CULTURAL — AİLE BAĞIMLILIĞI]\n` +
      `Aile entegre bir sistem. Bireysel karar vermek zor, aile önemli. ` +
      `Sistemi değil, birey-aile ilişkisini çalış.`
    );
  } else if (culturalProfile.familyOrientation === 'independence_seeking') {
    parts.push(
      `[CULTURAL — BAĞIMSIZLIK ARZUSU]\n` +
      `Aile baskısından kurtulmak istiyor. Çatışma: aidiyat vs özerklik. Entegrasyon ara.`
    );
  }

  // ─── CİNSİYET ROLÜ ──────────────────────────────────────────────────────

  if (culturalProfile.genderRole === 'traditional') {
    parts.push(
      `[CULTURAL — TRADİSYONEL CİNSİYET ROLLERI]\n` +
      `Geleneksel roller önemli. Rol dışı davranış kaygı oluşturuyor. ` +
      `Rolleri eleştirme değil, içinde esnek olmayı bulma.`
    );
  } else if (culturalProfile.genderRole === 'modern') {
    parts.push(
      `[CULTURAL — MODERN CİNSİYET GÖRÜŞÜ]\n` +
      `Roller konusunda esnek. Geleneksel baskılara karşı direniş olabilir. ` +
      `Aile çatışması mümkün.`
    );
  }

  // ─── UTANÇ ──────────────────────────────────────────────────────────────

  if (culturalProfile.shameLevel === 'high') {
    parts.push(
      `[CULTURAL — YÜKSEK UTANÇ]\n` +
      `"Komşu ne der?" hissi güçlü. Sosyal itibar kritik. ` +
      `Utancı düşürme değil, neyin onu tetiklediğini anla.`
    );
  }

  return parts.filter(p => p).join('\n\n');
}

/**
 * Tabu konuları tespit et ve uyarla
 * @param {Object} culturalProfile
 * @returns {Object} — { topics: Array, approaches: Object }
 */
export function identifyTabuTopics(culturalProfile = {}) {
  const tabus = [];
  const approaches = {};

  // Din
  if (culturalProfile.religiosity === 'high') {
    tabus.push('dini sorgulamak');
    approaches['dini_konular'] = 'Dini sistem içinde çalış, eleştirme yok';
  }

  // Aile
  if (culturalProfile.familyOrientation === 'high_dependence') {
    tabus.push('aileyi suçlamak', 'aile karşıtı kararlar');
    approaches['aile_konuları'] = 'Aile sistemi var sayıl, ama bireysel sınırlar kur';
  }

  // Cinsiyet
  if (culturalProfile.genderRole === 'traditional') {
    tabus.push('cinsiyeti sorgulamak', 'rol dışı davranış');
    approaches['cinsiyet_konuları'] = 'Rolleri değil, içindeki esnekliği bul';
  }

  // Utanç
  if (culturalProfile.shameLevel === 'high') {
    tabus.push('sosyal itibarı tehdit etmek');
    approaches['gizlilik'] = 'Gizliliğe saygı göster, "kimse bilmezse OK" mantığını anlayan ol';
  }

  return {
    tabuTopics: tabus,
    approaches,
    note: 'Tabuları eleştirme, onlarla çalış. Entegrasyon, değiştirme değil.',
  };
}
