// profile/profileManager.js
// SQL schema reference: see docs/schema.sql or the task description in the repo.
// Tables required in Supabase (must be created manually via Supabase SQL Editor):
//   - psychological_profiles
//   - session_records
//   - technique_effectiveness
//   - progress_metrics
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const EMPTY_PROFILE = {
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
};

/**
 * Kullanıcı profilini getirir. Yoksa boş profil döner.
 */
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('psychological_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { ...EMPTY_PROFILE, user_id: userId };
  return data;
};

/**
 * Profili günceller. Mevcut verilerle merge yapar.
 */
export const updateProfile = async (userId, updates) => {
  const existing = await getProfile(userId);

  const merged = {
    user_id: userId,
    attachment_style: updates.attachment_style || existing.attachment_style,
    triggers: mergeArrayById(existing.triggers, updates.triggers || [], 'konu'),
    core_values: mergeArrayById(existing.core_values, updates.core_values || [], 'deger'),
    defense_mechanisms: mergeArrayById(existing.defense_mechanisms, updates.defense_mechanisms || [], 'mekanizma'),
    language_style: { ...existing.language_style, ...(updates.language_style || {}) },
    unconscious_patterns: mergeArrayById(existing.unconscious_patterns, updates.unconscious_patterns || [], 'desen'),
    relationship_map: mergeArrayById(existing.relationship_map, updates.relationship_map || [], 'isim'),
    life_schemas: mergeArrayById(existing.life_schemas, updates.life_schemas || [], 'sema'),
    healing_style: { ...existing.healing_style, ...(updates.healing_style || {}) },
    strengths: mergeArrayById(existing.strengths, updates.strengths || [], 'guc'),
    hope_map: { ...existing.hope_map, ...(updates.hope_map || {}) },
    session_count: (existing.session_count || 0) + 1,
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
 * İki diziyi id alanına göre merge eder.
 * Yeni eleman varsa ekler, varsa günceller.
 */
const mergeArrayById = (existing, incoming, idField) => {
  if (!incoming || incoming.length === 0) return existing;
  const map = {};
  (existing || []).forEach(item => { map[item[idField]] = item; });
  incoming.forEach(item => {
    if (item[idField]) {
      map[item[idField]] = { ...map[item[idField]], ...item };
    }
  });
  return Object.values(map);
};
