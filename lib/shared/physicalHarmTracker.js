/**
 * physicalHarmTracker.js
 * Fiziksel zarar göstergelerini Supabase üzerinden seanslar arası takip eder.
 * GPT vision analizinden gelen fiziksel_zarar ve ortam verilerini kalıcı olarak saklar,
 * geçmiş seanslarla karşılaştırarak değişimi saptar.
 */

import { supabase } from './supabase.js';

// Seanslar arası karşılaştırma için kaç önceki seans alınacağı
const GECMIS_SEANS_SAYISI = 3;

// Karşılaştırma için minimum risk skoru eşiği
const MINIMUM_HARM_SKOR = 0;

/**
 * Bir seans için fiziksel zarar anlık görüntüsünü veritabanına kaydeder.
 * Aynı userId+sessionId çifti için tekrar kayıt oluşturmaz (upsert).
 *
 * @param {string} userId — kullanıcı kimliği
 * @param {string} sessionId — oturum kimliği
 * @param {object} fiziksel_zarar — GPT analizinden gelen fiziksel zarar objesi
 * @param {object} [ortam] — GPT analizinden gelen ortam objesi
 * @returns {Promise<object|null>} — kaydedilen kayıt veya null
 */
export async function savePhysicalHarmSnapshot(userId, sessionId, fiziksel_zarar, ortam) {
  if (!fiziksel_zarar) return null;

  // Kaydetmeye değer bir bulgu var mı kontrol et
  const skorVar = (fiziksel_zarar.fiziksel_zarar_skor ?? 0) > MINIMUM_HARM_SKOR;
  const booleanAlanVar = Object.values(fiziksel_zarar).some(
    (deger) => deger === true
  );

  if (!skorVar && !booleanAlanVar) {
    // Kayda değer fiziksel zarar göstergesi yok
    return null;
  }

  // Veritabanına yazılacak snapshot objesi
  const snapshot = {
    ...fiziksel_zarar,
    ortam_mekan: ortam?.mekan ?? null,
    ortam_aydinlik: ortam?.aydinlik ?? null,
  };

  const { data, error } = await supabase
    .from('physical_harm_logs')
    .upsert(
      {
        userId,
        sessionId,
        snapshot,
        detected_at: new Date().toISOString(),
      },
      {
        onConflict: 'userId,sessionId',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    console.error('[physicalHarmTracker] Snapshot kaydedilemedi:', error.message);
    return null;
  }

  return data;
}

/**
 * Geçmiş seanslarla karşılaştırarak fiziksel zarardaki değişimi tespit eder.
 * Son 3 seansın verisiyle mevcut seans karşılaştırılır.
 *
 * @param {string} userId — kullanıcı kimliği
 * @param {object} currentHarm — mevcut seanstaki fiziksel zarar objesi
 * @returns {Promise<{
 *   isNew: boolean,
 *   previousSessions: number,
 *   worsening: boolean,
 *   prompt: string|null
 * }>}
 */
export async function detectCrossSessionHarmChange(userId, currentHarm) {
  // Varsayılan dönüş değeri
  const varsayilan = { isNew: false, previousSessions: 0, worsening: false, prompt: null };

  if (!currentHarm) return varsayilan;

  const mevcutSkor = currentHarm.fiziksel_zarar_skor ?? 0;
  const mevcutZararVar = mevcutSkor > 0 || Object.values(currentHarm).some((v) => v === true);

  if (!mevcutZararVar) return varsayilan;

  // Geçmiş seansları çek (en yeni önce)
  const { data: gecmisKayitlar, error } = await supabase
    .from('physical_harm_logs')
    .select('snapshot, detected_at, sessionId')
    .eq('userId', userId)
    .order('detected_at', { ascending: false })
    .limit(GECMIS_SEANS_SAYISI);

  if (error) {
    console.error('[physicalHarmTracker] Geçmiş seanslar alınamadı:', error.message);
    return varsayilan;
  }

  const gecmisSeansSayisi = gecmisKayitlar?.length ?? 0;

  // Hiç geçmiş kayıt yoksa bu sefer ilk tespit
  if (gecmisSeansSayisi === 0) {
    const zarar_bolge = currentHarm.zarar_bolgesi ?? currentHarm.bolge ?? 'belirsiz';
    return {
      isNew: true,
      previousSessions: 0,
      worsening: false,
      prompt: `[FİZİKSEL ZARAR — YENİ TESPİT]: Önceki seanslarda görülmemişti, bu seansta ${zarar_bolge} bölgesinde iz tespit edildi. Nazikçe ve doğrudan sormadan fark et.`,
    };
  }

  // Geçmişte zarar var mıydı?
  const gecmisteFizikselZararVarMi = gecmisKayitlar.some((kayit) => {
    const snap = kayit.snapshot ?? {};
    const gecmisSkor = snap.fiziksel_zarar_skor ?? 0;
    const gecmisBoolean = Object.values(snap).some((v) => v === true);
    return gecmisSkor > 0 || gecmisBoolean;
  });

  if (!gecmisteFizikselZararVarMi) {
    // Geçmişte hiç zarar yoktu, yeni tespit
    const zarar_bolge = currentHarm.zarar_bolgesi ?? currentHarm.bolge ?? 'belirsiz';
    return {
      isNew: true,
      previousSessions: gecmisSeansSayisi,
      worsening: false,
      prompt: `[FİZİKSEL ZARAR — YENİ TESPİT]: Önceki seanslarda görülmemişti, bu seansta ${zarar_bolge} bölgesinde iz tespit edildi. Nazikçe ve doğrudan sormadan fark et.`,
    };
  }

  // Skorlar karşılaştırılarak kötüleşme tespiti yapılır
  const gecmisSkorlar = gecmisKayitlar
    .map((k) => k.snapshot?.fiziksel_zarar_skor ?? 0)
    .filter((s) => s > 0);

  let kotulesiyor = false;
  if (gecmisSkorlar.length > 0 && mevcutSkor > 0) {
    const enYuksekGecmisSkor = Math.max(...gecmisSkorlar);
    kotulesiyor = mevcutSkor > enYuksekGecmisSkor;
  }

  if (kotulesiyor) {
    const zarar_bolge = currentHarm.zarar_bolgesi ?? currentHarm.bolge ?? 'belirsiz';
    return {
      isNew: false,
      previousSessions: gecmisSeansSayisi,
      worsening: true,
      prompt: `[FİZİKSEL ZARAR — ARTIYOR]: Önceki seanslara kıyasla ${zarar_bolge} bölgesindeki iz belirginleşiyor. Son ${gecmisSeansSayisi} seanstaki değişimi göz önünde bulundur, yargılamadan yanında ol.`,
    };
  }

  // Geçmişte de vardı, şimdi de var ama kötüleşme yok — dikkate değer bir değişim yok
  return varsayilan;
}

/**
 * Fiziksel zarar bağlamını oluşturur; snapshot kaydeder ve seanslar arası karşılaştırma yapar.
 * Terapi promptuna enjekte edilmek üzere hazır bir string döner.
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {object} fiziksel_zarar — GPT analizinden gelen fiziksel zarar objesi
 * @param {object} [ortam] — GPT analizinden gelen ortam objesi
 * @returns {Promise<string>} — prompt satırı ya da boş string
 */
export async function buildPhysicalHarmContext(userId, sessionId, fiziksel_zarar, ortam) {
  if (!fiziksel_zarar) return '';

  // Zarar varsa kaydet
  const skorVar = (fiziksel_zarar.fiziksel_zarar_skor ?? 0) > 0;
  const booleanAlanVar = Object.values(fiziksel_zarar).some((v) => v === true);

  if (skorVar || booleanAlanVar) {
    await savePhysicalHarmSnapshot(userId, sessionId, fiziksel_zarar, ortam);
  }

  // Seanslar arası değişimi tespit et
  const degisim = await detectCrossSessionHarmChange(userId, fiziksel_zarar);

  return degisim.prompt ?? '';
}

// -----------------------------------------------------------------------------
// SQL Migration
// -----------------------------------------------------------------------------
/*
-- Migration: physical_harm_logs tablosu oluşturma
-- Bu tabloyu Supabase SQL editöründe veya migration dosyasında çalıştırın.

CREATE TABLE IF NOT EXISTS physical_harm_logs (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    TEXT          NOT NULL,
  "sessionId" TEXT          NOT NULL,
  snapshot    JSONB         NOT NULL DEFAULT '{}',
  detected_at TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Aynı kullanıcı+seans çifti için tek kayıt (upsert hedefi)
  CONSTRAINT physical_harm_logs_user_session_unique UNIQUE ("userId", "sessionId")
);

-- Hızlı sorgular için indeksler
CREATE INDEX IF NOT EXISTS idx_physical_harm_logs_userId
  ON physical_harm_logs ("userId");

CREATE INDEX IF NOT EXISTS idx_physical_harm_logs_detected_at
  ON physical_harm_logs (detected_at DESC);

-- Eski kayıtları otomatik temizlemek isterseniz (opsiyonel, 90 gün):
-- ALTER TABLE physical_harm_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Kullanıcı kendi kayıtlarını okuyabilir"
--   ON physical_harm_logs FOR SELECT
--   USING (auth.uid()::text = "userId");
*/
