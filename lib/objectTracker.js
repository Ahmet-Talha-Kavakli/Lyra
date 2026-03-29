/**
 * objectTracker.js
 * GPT vision analizinden gelen nesneleri frame'ler arası takip eder.
 * Her kullanıcı için nesne geçmişini hafızada tutar ve risk değerlendirmesi yapar.
 */

// Risk seviyesi öncelik sırası: yuksek > orta > davranissal > dusuk > yok
const RISK_PRIORITY = {
  yuksek: 4,
  orta: 3,
  davranissal: 2,
  dusuk: 1,
  yok: 0,
};

// Nesnenin "aktif görünür" sayılması için maksimum süre (ms)
const VISIBILITY_TIMEOUT_MS = 15_000;

// Bir nesnenin "kalıcı tehdit" sayılması için minimum süre (ms)
const PERSISTENT_THREAT_THRESHOLD_MS = 10_000;

// Otomatik temizlik için kullanıcı inaktivite süresi (ms) — 30 dakika
const USER_INACTIVITY_TIMEOUT_MS = 30 * 60_000;

// Otomatik temizlik interval süresi — 15 dakika
const CLEANUP_INTERVAL_MS = 15 * 60_000;

/**
 * Kullanıcı başına nesne geçmişini tutan ana Map.
 * Yapı: userId → { objects: Map(nesne_ad → NesneKayit), lastActivity: timestamp }
 *
 * NesneKayit yapısı:
 * {
 *   firstSeen: number,        — ilk görülme zamanı (ms)
 *   lastSeen: number,         — son görülme zamanı (ms)
 *   seenCount: number,        — kaç frame'de görüldüğü
 *   riskLevel: string,        — 'yuksek' | 'orta' | 'davranissal' | 'dusuk' | 'yok'
 *   currentlyVisible: bool,   — son 15 saniyede görüldü mü
 *   zarar_sinyali: bool,      — zarar sinyali taşıyor mu
 *   kategori: string,         — nesne kategorisi
 *   visibleSince: number|null — sürekli görünürlüğün başlangıcı (ms)
 * }
 */
const userObjectHistory = new Map();

/**
 * Kullanıcının nesne geçmiş kaydını döner, yoksa oluşturur.
 * @param {string} userId
 * @returns {{ objects: Map, lastActivity: number }}
 */
function getOrCreateUserRecord(userId) {
  if (!userObjectHistory.has(userId)) {
    userObjectHistory.set(userId, {
      objects: new Map(),
      lastActivity: Date.now(),
    });
  }
  return userObjectHistory.get(userId);
}

/**
 * Belirtilen kullanıcının nesne takibini günceller.
 * Yeni nesneleri ekler, mevcut nesneleri günceller, kaybolanlarda görünürlüğü kapatır.
 *
 * @param {string} userId — kullanıcı kimliği
 * @param {Array<{ad: string, kategori: string, risk: string, zarar_sinyali: boolean}>} nesneler — GPT vision sonucu
 * @param {number} [timestamp=Date.now()] — analiz zaman damgası
 * @returns {{
 *   newHighRisk: Array<{ad: string, riskLevel: string, firstSeen: number}>,
 *   persistentThreats: Array<{ad: string, durationSec: number, riskLevel: string}>,
 *   activeObjects: Array<object>
 * }}
 */
export function updateObjectTracker(userId, nesneler = [], timestamp = Date.now()) {
  const userRecord = getOrCreateUserRecord(userId);
  userRecord.lastActivity = timestamp;

  const { objects } = userRecord;
  const newHighRisk = [];

  // Bu frame'de görülen nesne adları (tekrar işlemeyi önlemek için Set)
  const seenThisFrame = new Set();

  for (const nesne of nesneler) {
    const { ad, kategori, risk, zarar_sinyali } = nesne;

    // Geçersiz nesne adlarını atla
    if (!ad || typeof ad !== 'string') continue;

    const key = ad.toLowerCase().trim();
    seenThisFrame.add(key);

    if (objects.has(key)) {
      // Mevcut nesneyi güncelle
      const kayit = objects.get(key);
      const wasVisible = kayit.currentlyVisible;

      kayit.lastSeen = timestamp;
      kayit.seenCount += 1;
      kayit.currentlyVisible = true;
      kayit.zarar_sinyali = zarar_sinyali ?? kayit.zarar_sinyali;
      kayit.kategori = kategori ?? kayit.kategori;

      // Sürekli görünürlük başlangıcını koru; eğer önceden kaybolmuşsa sıfırla
      if (!wasVisible) {
        kayit.visibleSince = timestamp;
      }

      // Risk seviyesi yükselmişse güncelle
      const yeniRiskPriority = RISK_PRIORITY[risk] ?? 0;
      const mevcutRiskPriority = RISK_PRIORITY[kayit.riskLevel] ?? 0;
      if (yeniRiskPriority > mevcutRiskPriority) {
        kayit.riskLevel = risk;
      }
    } else {
      // Yeni nesne — ilk kez görüldü
      const yeniKayit = {
        firstSeen: timestamp,
        lastSeen: timestamp,
        seenCount: 1,
        riskLevel: risk ?? 'yok',
        currentlyVisible: true,
        zarar_sinyali: zarar_sinyali ?? false,
        kategori: kategori ?? 'bilinmiyor',
        visibleSince: timestamp,
      };
      objects.set(key, yeniKayit);

      // Yüksek veya orta riskli yeni nesne → raporla
      const riskPriority = RISK_PRIORITY[yeniKayit.riskLevel] ?? 0;
      if (riskPriority >= RISK_PRIORITY['orta']) {
        newHighRisk.push({
          ad: key,
          riskLevel: yeniKayit.riskLevel,
          firstSeen: timestamp,
        });
      }
    }
  }

  // Bu frame'de görülmeyen nesneleri işle
  for (const [key, kayit] of objects.entries()) {
    if (!seenThisFrame.has(key)) {
      if (kayit.currentlyVisible) {
        // Timeout kontrolü: son görülmeden bu yana 15 saniye geçtiyse gizle
        if (timestamp - kayit.lastSeen >= VISIBILITY_TIMEOUT_MS) {
          kayit.currentlyVisible = false;
          kayit.visibleSince = null;
        }
      }
    }
  }

  // Kalıcı tehditleri hesapla
  const persistentThreats = getPersistentThreatsInternal(objects, timestamp);

  // Aktif nesneler listesi
  const activeObjects = [];
  for (const [ad, kayit] of objects.entries()) {
    if (kayit.currentlyVisible) {
      activeObjects.push({ ad, ...kayit });
    }
  }

  return { newHighRisk, persistentThreats, activeObjects };
}

/**
 * Dahili: Map üzerinden kalıcı tehditleri hesaplar.
 * @param {Map} objects
 * @param {number} now
 * @returns {Array}
 */
function getPersistentThreatsInternal(objects, now = Date.now()) {
  const threats = [];

  for (const [ad, kayit] of objects.entries()) {
    if (!kayit.currentlyVisible) continue;

    const riskPriority = RISK_PRIORITY[kayit.riskLevel] ?? 0;
    if (riskPriority < RISK_PRIORITY['orta']) continue;

    const visibleStart = kayit.visibleSince ?? kayit.firstSeen;
    const durationMs = now - visibleStart;

    if (durationMs >= PERSISTENT_THREAT_THRESHOLD_MS) {
      threats.push({
        ad,
        kategori: kayit.kategori,
        riskLevel: kayit.riskLevel,
        durationSec: Math.round(durationMs / 1000),
        zarar_sinyali: kayit.zarar_sinyali,
      });
    }
  }

  // Risk seviyesine göre sırala (en tehlikeli önce)
  threats.sort(
    (a, b) => (RISK_PRIORITY[b.riskLevel] ?? 0) - (RISK_PRIORITY[a.riskLevel] ?? 0)
  );

  return threats;
}

/**
 * Kullanıcının 10 saniyeden uzun süredir görünen yüksek/orta riskli nesnelerini döner.
 *
 * @param {string} userId
 * @returns {Array<{ad: string, kategori: string, riskLevel: string, durationSec: number, zarar_sinyali: boolean}>}
 */
export function getPersistentThreats(userId) {
  const userRecord = userObjectHistory.get(userId);
  if (!userRecord) return [];

  return getPersistentThreatsInternal(userRecord.objects, Date.now());
}

/**
 * Terapi promptuna enjekte edilmek üzere nesne takip bağlamı oluşturur.
 * Kalıcı tehditler veya yeni yüksek riskli nesneler varsa ilgili metni döner.
 *
 * @param {string} userId
 * @returns {string} — prompt satırı ya da boş string
 */
export function buildObjectContext(userId) {
  const userRecord = userObjectHistory.get(userId);
  if (!userRecord) return '';

  const now = Date.now();
  const { objects } = userRecord;
  const lines = [];

  // Kalıcı tehditler — 10 saniyeden uzun süre görünen yüksek/orta riskli nesneler
  const persistentThreats = getPersistentThreatsInternal(objects, now);
  if (persistentThreats.length > 0) {
    lines.push('[NESNE TAKİBİ — KRİTİK]');
    for (const tehdit of persistentThreats) {
      const riskEtiketi = tehdit.riskLevel === 'yuksek' ? 'yüksek risk' : 'orta risk';
      lines.push(`• ${tehdit.ad} ${tehdit.durationSec} saniyedir görünür — ${riskEtiketi}`);
    }
  }

  // Bu frame'de ilk kez görülen yüksek riskli nesneler
  // (firstSeen son 2 saniye içinde olan yüksek riskli nesneler)
  for (const [ad, kayit] of objects.entries()) {
    if (!kayit.currentlyVisible) continue;
    const riskPriority = RISK_PRIORITY[kayit.riskLevel] ?? 0;
    if (riskPriority < RISK_PRIORITY['orta']) continue;

    const isNewlyDetected = now - kayit.firstSeen < 2000 && kayit.seenCount === 1;
    if (isNewlyDetected) {
      lines.push(`[NESNE — İLK TESPİT]: ${ad} ilk kez görüldü`);
    }
  }

  return lines.join('\n');
}

/**
 * Kullanıcının tüm nesne takip verilerini temizler.
 * Genellikle oturum sonunda çağrılır.
 *
 * @param {string} userId
 */
export function clearObjectTracker(userId) {
  userObjectHistory.delete(userId);
}

/**
 * 30 dakikadır aktif olmayan kullanıcıların verilerini siler.
 * Her 15 dakikada bir çalışır.
 */
function cleanupInactiveUsers() {
  const now = Date.now();
  let temizlenenSayisi = 0;

  for (const [userId, userRecord] of userObjectHistory.entries()) {
    if (now - userRecord.lastActivity >= USER_INACTIVITY_TIMEOUT_MS) {
      userObjectHistory.delete(userId);
      temizlenenSayisi++;
    }
  }

  if (temizlenenSayisi > 0) {
    console.log(`[objectTracker] Otomatik temizlik: ${temizlenenSayisi} inaktif kullanıcı silindi.`);
  }
}

// Periyodik temizlik başlat
setInterval(cleanupInactiveUsers, CLEANUP_INTERVAL_MS);
