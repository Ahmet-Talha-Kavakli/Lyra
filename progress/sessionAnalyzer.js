// progress/sessionAnalyzer.js
import { supabase } from '../lib/supabase.js';

/**
 * Seans kaydını Supabase'e yazar.
 * crisis_flag ve session_quality alanları eklendi.
 */
export const saveSessionRecord = async (userId, sessionId, analysis, techniquesUsed, crisisLevel = null) => {
  const { error } = await supabase
    .from('session_records')
    .upsert({
      user_id: userId,
      session_id: sessionId,
      dominant_emotion: analysis.dominant_emotion,
      topics: analysis.topics || [],
      techniques_used: techniquesUsed || [],
      breakthrough_moment: analysis.breakthrough_moment || false,
      breakthrough_note: analysis.breakthrough_note || null,
      emotional_start_score: analysis.emotional_start_score,
      emotional_end_score: analysis.emotional_end_score,
      homework: analysis.homework || null,
      session_quality: analysis.session_quality || 'neutral',
      crisis_flag: crisisLevel || null,
      created_at: new Date().toISOString()
    }, { onConflict: 'session_id' });

  if (error) console.warn('[SessionAnalyzer] Kayıt hatası:', error.message);
};

export const updateTechniqueEffectiveness = async (userId, techniqueId, wasPositive) => {
  if (!userId || !techniqueId) return;

  const { data: existing } = await supabase
    .from('technique_effectiveness')
    .select('*')
    .eq('user_id', userId)
    .eq('technique_id', techniqueId)
    .single();

  if (existing) {
    await supabase
      .from('technique_effectiveness')
      .update({
        used_count: existing.used_count + 1,
        positive_responses: existing.positive_responses + (wasPositive ? 1 : 0),
        last_used: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('technique_id', techniqueId);
  } else {
    await supabase
      .from('technique_effectiveness')
      .insert({
        user_id: userId,
        technique_id: techniqueId,
        used_count: 1,
        positive_responses: wasPositive ? 1 : 0,
        last_used: new Date().toISOString()
      });
  }
};

export const getTechniqueEffectiveness = async (userId) => {
  if (!userId) return [];
  const { data } = await supabase
    .from('technique_effectiveness')
    .select('*')
    .eq('user_id', userId);
  return data || [];
};
