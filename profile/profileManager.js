// profile/profileManager.js
// SQL schema reference: see docs/schema.sql or the task description in the repo.
// Tables required in Supabase (must be created manually via Supabase SQL Editor):
//   - psychological_profiles
//   - session_records
//   - technique_effectiveness
//   - progress_metrics
import { supabase } from '../lib/shared/supabase.js';

export const EMPTY_PROFILE = Object.freeze({
  attachment_style: 'belirsiz',
  triggers: [],
  core_values: [],
  defense_mechanisms: [],
  language_style: {},
  unconscious_patterns: [],
  relationship_map: [],
  life_schemas: [],
  healing_style: {},
  strengths: [],
  hope_map: {},
  session_count: 0
});

export const createEmptyProfile = (userId) => ({
  user_id: userId,
  attachment_style: 'belirsiz',
  triggers: [],
  core_values: [],
  defense_mechanisms: [],
  language_style: {},
  unconscious_patterns: [],
  relationship_map: [],
  life_schemas: [],
  healing_style: {},
  strengths: [],
  hope_map: {},
  session_count: 0
});

/**
 * Kullanıcı profilini getirir. Yoksa boş profil döner.
 */
export const getProfile = async (userId) => {
  if (!userId) throw new Error('userId zorunlu');

  const { data, error } = await supabase
    .from('psychological_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return createEmptyProfile(userId);
    throw new Error(`Profil okunamadı: ${error.message}`);
  }
  if (!data) return createEmptyProfile(userId);
  return data;
};

/**
 * Profili günceller. Mevcut verilerle merge yapar.
 */
export const updateProfile = async (userId, updates) => {
  if (!userId) throw new Error('userId zorunlu');

  const existing = await getProfile(userId);

  const merged = {
    user_id: userId,
    attachment_style: updates.attachment_style || existing.attachment_style,
    triggers: mergeArrayById(existing.triggers, updates.triggers || [], 'konu', 'triggers'),
    core_values: mergeArrayById(existing.core_values, updates.core_values || [], 'deger', 'core_values'),
    defense_mechanisms: mergeArrayById(existing.defense_mechanisms, updates.defense_mechanisms || [], 'mekanizma', 'defense_mechanisms'),
    language_style: { ...existing.language_style, ...(updates.language_style || {}) },
    unconscious_patterns: mergeArrayById(existing.unconscious_patterns, updates.unconscious_patterns || [], 'desen', 'unconscious_patterns'),
    relationship_map: mergeArrayById(existing.relationship_map, updates.relationship_map || [], 'isim', 'relationship_map'),
    life_schemas: mergeArrayById(existing.life_schemas, updates.life_schemas || [], 'sema', 'life_schemas'),
    healing_style: { ...existing.healing_style, ...(updates.healing_style || {}) },
    strengths: mergeArrayById(existing.strengths, updates.strengths || [], 'guc'),
    hope_map: { ...existing.hope_map, ...(updates.hope_map || {}) },
    session_count: existing.session_count || 0,
    last_updated: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('psychological_profiles')
    .upsert(merged, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw new Error(`Profil güncellenemedi: ${error.message}`);
  return data;
};

/**
 * Oturum sayısını artırır. Her seans sonunda çağrılmalı.
 */
export const incrementSessionCount = async (userId) => {
  const existing = await getProfile(userId);
  const { error } = await supabase
    .from('psychological_profiles')
    .upsert({ user_id: userId, session_count: (existing.session_count || 0) + 1, last_updated: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(`Session count güncellenemedi: ${error.message}`);
};

// Her dizi alanı için maksimum eleman sayısı
const ARRAY_LIMITS = {
  triggers: 12,
  core_values: 10,
  defense_mechanisms: 8,
  unconscious_patterns: 10,
  relationship_map: 15,
  life_schemas: 8,
  strengths: 8,
};

// Güç skoru alanları (büyükten küçüğe sırala, limitin üstündekileri at)
const SCORE_FIELDS = {
  unconscious_patterns: 'guc_skoru',
  life_schemas: 'guc',
};

/**
 * İki diziyi id alanına göre merge eder.
 * Yeni eleman varsa ekler, varsa günceller.
 * Limit aşılırsa güç skoru düşük olanlar çıkarılır.
 */
const mergeArrayById = (existing, incoming, idField, arrayKey = null) => {
  if (!incoming || incoming.length === 0) return existing;
  const map = {};
  (existing || []).forEach(item => { map[item[idField]] = item; });
  incoming.forEach(item => {
    if (!item[idField]) {
      console.warn(`[mergeArrayById] "${idField}" alanı eksik, item atlandı:`, item);
      return;
    }
    map[item[idField]] = { ...map[item[idField]], ...item };
  });

  let result = Object.values(map);

  // Limit uygula
  if (arrayKey && ARRAY_LIMITS[arrayKey]) {
    const limit = ARRAY_LIMITS[arrayKey];
    if (result.length > limit) {
      const scoreField = SCORE_FIELDS[arrayKey];
      if (scoreField) {
        // Güç skoruna göre sırala, en güçlüleri tut
        result = result.sort((a, b) => (b[scoreField] || 0) - (a[scoreField] || 0)).slice(0, limit);
      } else {
        // Skor yoksa en son eklenenler önce (map order = insertion order)
        result = result.slice(-limit);
      }
    }
  }

  return result;
};
