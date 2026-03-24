// progress/progressTracker.js
import { supabase } from '../lib/supabase.js';

export const updateWeeklyMetrics = async (userId, sessionAnalysis) => {
  if (!userId || !sessionAnalysis) return;
  const weekStart = getWeekStart(new Date());

  const { data: existing } = await supabase
    .from('progress_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();

  if (existing) {
    const newAvg = ((existing.avg_emotional_score * existing.session_count) +
      (sessionAnalysis.emotional_end_score || 5)) / (existing.session_count + 1);

    await supabase
      .from('progress_metrics')
      .update({
        avg_emotional_score: Math.round(newAvg * 10) / 10,
        session_count: existing.session_count + 1,
        breakthroughs: existing.breakthroughs + (sessionAnalysis.breakthrough_moment ? 1 : 0)
      })
      .eq('user_id', userId)
      .eq('week_start', weekStart);
  } else {
    await supabase
      .from('progress_metrics')
      .insert({
        user_id: userId,
        week_start: weekStart,
        avg_emotional_score: sessionAnalysis.emotional_end_score || 5,
        session_count: 1,
        breakthroughs: sessionAnalysis.breakthrough_moment ? 1 : 0
      });
  }
};

export const getProgressSummary = async (userId, weeks = 4) => {
  if (!userId) return [];
  const { data } = await supabase
    .from('progress_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(weeks);
  return data || [];
};

export const buildProgressContext = async (userId) => {
  const metrics = await getProgressSummary(userId, 3);
  if (!metrics.length) return '';

  const latest = metrics[0];
  const trend = metrics.length >= 2
    ? latest.avg_emotional_score - metrics[1].avg_emotional_score
    : 0;

  const trendText = trend > 0.5 ? 'iyileşiyor' : trend < -0.5 ? 'zorlanıyor' : 'stabil';
  const totalBreakthroughs = metrics.reduce((s, m) => s + m.breakthroughs, 0);

  return `## İLERLEME BAĞLAMI\n- Bu hafta ${latest.session_count} seans, ortalama duygu skoru: ${latest.avg_emotional_score}/10\n- Trend: ${trendText}\n- Toplam breakthrough: ${totalBreakthroughs}`;
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};
