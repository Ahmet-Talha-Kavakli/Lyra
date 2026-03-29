// lib/analyticsEngine.js
// Analytics & Progress Tracking — iyileşme metriksleri, terapötik hızlanma, insight tracking
// Kullanıcının ilerlemesini görselleştir, motivasyon artır
//
// Türkçe Metrikler: Duygusal stabilite, kaygı seviyesi, başetme becerisi artışı

import { supabase } from './supabase.js';

/**
 * Seans metrikleri hesapla — her seansın sağlığını ölçüle
 * @param {Object} sessionData — { emotion, duration, messageCount, breakthrough, topics }
 * @returns {{ emotionalShift: number, engagement: number, depth: number, breakthroughMoment: boolean }}
 */
export function calculateSessionMetrics(sessionData = {}) {
  const {
    emotion = 'neutral',
    duration = 0,
    messageCount = 0,
    breakthrough = false,
    topics = [],
    intensity = 50,
  } = sessionData;

  // ─── DUYGUSAL KAYMA (Emotional Shift) ────────────────────────────────────

  const emotionValues = {
    depressed: 10,
    sad: 20,
    anxious: 30,
    neutral: 50,
    hopeful: 70,
    optimistic: 90,
  };

  const emotionScore = emotionValues[emotion] || 50;
  const emotionalShift = emotionScore / 50; // 0.2 (çok kötü) to 1.8 (çok iyi)

  // ─── KATILIM (Engagement) ───────────────────────────────────────────────

  const engagement = Math.min((messageCount / 10) * 100, 100); // 10+ mesaj = 100%

  // ─── DERINLIK (Depth) ────────────────────────────────────────────────────

  const hasHighIntensity = intensity > 70;
  const hasMultipleTopics = (topics || []).length > 2;
  const depth = (hasHighIntensity ? 50 : 0) + (hasMultipleTopics ? 50 : 0);

  // ─── BREAKTHROUGH MOMENT ────────────────────────────────────────────────

  const breakthroughMoment = breakthrough || (depth > 80 && engagement > 70);

  return {
    emotionalShift: Math.round(emotionalShift * 100),
    engagement: Math.round(engagement),
    depth: Math.round(depth),
    breakthroughMoment,
    score: Math.round((emotionalShift + engagement / 100 + depth / 100) * 33.3),
  };
}

/**
 * Haftalık ilerleme analizi
 * @param {string} userId
 * @param {number} weeks — kaç hafta geriye git (default: 4)
 * @returns {Promise<{ emotionalTrend: Array, coping: number, insights: number, overallProgress: number }>}
 */
export async function analyzeWeeklyProgress(userId, weeks = 4) {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7 * weeks);

    const { data: sessions } = await supabase
      .from('session_records')
      .select('dominant_emotion, session_quality, created_at, key_insight')
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!sessions || sessions.length === 0) {
      return {
        emotionalTrend: [],
        coping: 0,
        insights: 0,
        overallProgress: 0,
      };
    }

    // Duygu trendi
    const emotionScore = {
      depressed: 20,
      sad: 40,
      anxious: 50,
      neutral: 60,
      hopeful: 80,
      optimistic: 100,
    };

    const emotionalTrend = sessions.map(s => ({
      date: s.created_at,
      score: emotionScore[s.dominant_emotion] || 50,
      quality: s.session_quality,
    }));

    // Başetme becerisi artışı (session quality trend)
    const coping = sessions.length > 0 ? sessions[sessions.length - 1].session_quality * 10 : 0;

    // İçgörü sayısı
    const insights = sessions.filter(s => s.key_insight).length;

    // Genel ilerleme = (son hafta - ilk hafta duygusal score)
    const startScore = emotionScore[sessions[0]?.dominant_emotion] || 50;
    const endScore = emotionScore[sessions[sessions.length - 1]?.dominant_emotion] || 50;
    const overallProgress = endScore - startScore;

    return {
      emotionalTrend,
      coping: Math.round(coping),
      insights,
      overallProgress,
      trendDirection: overallProgress > 0 ? 'improving' : overallProgress < 0 ? 'declining' : 'stable',
    };
  } catch (err) {
    console.error('[analyticsEngine] Haftalık analiz hatası:', err.message);
    return {
      emotionalTrend: [],
      coping: 0,
      insights: 0,
      overallProgress: 0,
    };
  }
}

/**
 * Terapötik hızlanma endeksi — terapi ne kadar hızlı ilerliyaor?
 * @param {string} userId
 * @returns {Promise<{ velocityScore: number, speedCategory: string, nextMilestone: string }>}
 */
export async function calculateTherapyVelocity(userId) {
  try {
    const { data: sessions } = await supabase
      .from('session_records')
      .select('id, created_at, session_quality, breakthrough_moment')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!sessions || sessions.length < 3) {
      return {
        velocityScore: 0,
        speedCategory: 'insufficient_data',
        nextMilestone: 'Daha fazla seans gerekli',
      };
    }

    // Breakthrough momentleri say
    const breakthroughs = sessions.filter(s => s.breakthrough_moment).length;

    // Seans kalitesi trend
    const recentQuality = sessions.slice(0, 5).reduce((a, b) => a + (b.session_quality || 0), 0) / 5;

    // Hız = Breakthrough/Hafta
    const daysElapsed = Math.max(
      (new Date() - new Date(sessions[sessions.length - 1].created_at)) / (1000 * 60 * 60 * 24),
      1
    );
    const weeksElapsed = Math.ceil(daysElapsed / 7);
    const breakthroughPerWeek = breakthroughs / weeksElapsed;

    // Velocity score
    const velocityScore = Math.round((breakthroughPerWeek * 50 + recentQuality * 50) / 100);

    let speedCategory = 'slow';
    if (breakthroughPerWeek > 1) speedCategory = 'fast';
    else if (breakthroughPerWeek > 0.5) speedCategory = 'moderate';

    const nextMilestone =
      breakthroughs < 3
        ? '3. Breakthrough'
        : breakthroughs < 5
        ? '5. Insight'
        : 'İntegrasyon & Bağımsızlaşma';

    return {
      velocityScore,
      speedCategory,
      nextMilestone,
      breakthroughCount: breakthroughs,
    };
  } catch (err) {
    console.error('[analyticsEngine] Velocity hesabı hatası:', err.message);
    return {
      velocityScore: 0,
      speedCategory: 'error',
      nextMilestone: 'Hata',
    };
  }
}

/**
 * İçgörü (Insight) takibi — öğrenilen dersler
 * @param {string} userId
 * @param {number} limit — kaç tane getir
 * @returns {Promise<Array>}
 */
export async function getInsightTimeline(userId, limit = 10) {
  try {
    const { data: sessions } = await supabase
      .from('session_records')
      .select('created_at, key_insight, breakthrough_moment, dominant_emotion')
      .eq('user_id', userId)
      .not('key_insight', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (sessions || []).map(s => ({
      date: s.created_at,
      insight: s.key_insight,
      breakthrough: s.breakthrough_moment,
      emotionalContext: s.dominant_emotion,
    }));
  } catch (err) {
    console.error('[analyticsEngine] Insight timeline hatası:', err.message);
    return [];
  }
}

/**
 * Terapötik iyileşme göstergesi (4D Model)
 * Duygusal stabil,  Bilişsel esneklik, Davranışsal başetme, Dişsal bağlantı
 * @param {Object} sessionHistory
 * @returns {{ emotional: number, cognitive: number, behavioral: number, relational: number, overall: number }}
 */
export function assessHealingProgress(sessionHistory = {}) {
  const {
    emotionalStability = 50,
    cognitiveFlexibility = 50,
    copingBehaviors = 50,
    relationships = 50,
  } = sessionHistory;

  return {
    emotional: Math.round(emotionalStability),
    cognitive: Math.round(cognitiveFlexibility),
    behavioral: Math.round(copingBehaviors),
    relational: Math.round(relationships),
    overall: Math.round((emotionalStability + cognitiveFlexibility + copingBehaviors + relationships) / 4),
    recommendation:
      'Terapötik iyileşme bir maraton. Adım adım ilerle.',
  };
}

/**
 * Analytics dashboard bağlamı — seansın özetinde göster
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function buildAnalyticsContext(userId) {
  try {
    const velocity = await calculateTherapyVelocity(userId);
    const weekly = await analyzeWeeklyProgress(userId, 2);
    const insights = await getInsightTimeline(userId, 3);

    let context = `[ANALYTICS — İLERLEME]\n`;
    context += `Terapötik Hızlanma: ${velocity.speedCategory.toUpperCase()} (${velocity.velocityScore}/100)\n`;
    context += `Sonraki Hedef: ${velocity.nextMilestone}\n`;
    context += `Haftalık Trend: ${weekly.trendDirection === 'improving' ? '📈 İyileşiyor' : weekly.trendDirection === 'declining' ? '📉 Zor geçiyor' : '→ Stabil'}\n`;
    context += `İçgörüler: ${insights.length} öğrenilen ders\n`;

    if (insights.length > 0) {
      context += `\nSon Öğrenilen:\n`;
      insights.slice(0, 2).forEach(i => {
        context += `• "${i.insight}"\n`;
      });
    }

    return context;
  } catch (err) {
    console.error('[analyticsEngine] Analytics context hatası:', err.message);
    return '';
  }
}
