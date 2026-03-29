// lib/homeworkRecall.js
// Homework Recall — ödev hatırlaması, yapılıp yapılmadığı, zorluklar
// "Ödev nasıl gitti?", başarılar kutlama, dirençleri aşma
//
// Terapötik: Arası işin (intersession work) tanılanması ve değerlendirilmesi

import { supabase } from './supabase.js';

/**
 * Bekleyen ödevleri çek (son seansdan beri)
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getPendingHomeworkFromLastSession(userId) {
  try {
    const { data: pendingHomework } = await supabase
      .from('homework')
      .select('id, title, description, assigned_at, due_date, difficulty_level, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('assigned_at', { ascending: false })
      .limit(5);

    return pendingHomework || [];
  } catch (err) {
    console.error('[homeworkRecall] Hata:', err.message);
    return [];
  }
}

/**
 * Kullanıcı ödevi belirtmişse, başarısını kaydet
 * @param {string} userId
 * @param {string} homeworkId
 * @param {Object} result — { completed: boolean, timesAttempted: number, obstacles: string, insight: string }
 */
export async function recordHomeworkResult(userId, homeworkId, result) {
  try {
    const { error } = await supabase
      .from('homework')
      .update({
        status: result.completed ? 'completed' : 'attempted',
        completion_date: result.completed ? new Date().toISOString() : null,
        attempts: result.timesAttempted || 1,
        obstacles: result.obstacles || null,
        insight: result.insight || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', homeworkId)
      .eq('user_id', userId);

    if (error) {
      console.error('[homeworkRecall] Kayıt hatası:', error.message);
    }
  } catch (err) {
    console.error('[homeworkRecall] Hata:', err.message);
  }
}

/**
 * Tamamlanmış ödevlerden ögrenilen dersleri çıkart
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function extractHomeworkInsights(userId) {
  try {
    const { data: completedHomework } = await supabase
      .from('homework')
      .select('title, insight, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5);

    return (completedHomework || [])
      .filter(h => h.insight)
      .map(h => ({
        task: h.title,
        learning: h.insight,
      }));
  } catch (err) {
    console.error('[homeworkRecall] Insight çıkarma hatası:', err.message);
    return [];
  }
}

/**
 * Ödev direnci tespit et (atanmış ama yapılmayan)
 * @param {string} userId
 * @returns {Promise<{ hasResistance: boolean, abandonedTasks: Array, patterns: Array }>}
 */
export async function detectHomeworkResistance(userId) {
  try {
    const { data: allHomework } = await supabase
      .from('homework')
      .select('id, title, assigned_at, status, difficulty_level, assigned_reason')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false })
      .limit(20);

    if (!allHomework) {
      return {
        hasResistance: false,
        abandonedTasks: [],
        patterns: [],
      };
    }

    // Yapılmayan ödevler (pending > 2 hafta)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const abandoned = allHomework.filter(hw => {
      const assignedDate = new Date(hw.assigned_at);
      return hw.status === 'pending' && assignedDate < twoWeeksAgo;
    });

    // Patterni bul (ne tür ödevler atlanıyor)
    const patterns = [];
    const difficultyPattern = {};
    const reasonPattern = {};

    abandoned.forEach(hw => {
      difficultyPattern[hw.difficulty_level] = (difficultyPattern[hw.difficulty_level] || 0) + 1;
      reasonPattern[hw.assigned_reason] = (reasonPattern[hw.assigned_reason] || 0) + 1;
    });

    Object.entries(difficultyPattern).forEach(([level, count]) => {
      if (count >= 2) {
        patterns.push(`${level} seviye görevler atlanıyor`);
      }
    });

    Object.entries(reasonPattern).forEach(([reason, count]) => {
      if (count >= 2) {
        patterns.push(`"${reason}" nedenli görevlerde direniş`);
      }
    });

    return {
      hasResistance: abandoned.length > 0,
      abandonedTasks: abandoned.map(h => ({
        title: h.title,
        daysAgo: Math.floor((new Date() - new Date(h.assigned_at)) / (1000 * 60 * 60 * 24)),
        difficulty: h.difficulty_level,
      })),
      patterns,
    };
  } catch (err) {
    console.error('[homeworkRecall] Direniş tespiti hatası:', err.message);
    return {
      hasResistance: false,
      abandonedTasks: [],
      patterns: [],
    };
  }
}

/**
 * Ödev hatırlaması ve geri bildirim bağlamı oluştur
 * @param {string} userId
 * @param {boolean} userMentionedHomework — kullanıcı ödevi kendisi bahsetti mi?
 * @returns {Promise<string>}
 */
export async function buildHomeworkRecallContext(userId, userMentionedHomework = false) {
  const parts = [];

  // Bekleyen ödevleri çek
  const pendingHomework = await getPendingHomeworkFromLastSession(userId);

  if (!userMentionedHomework && pendingHomework.length > 0) {
    // Kullanıcı ödevi kendi bahsetmedi, hatırlat
    const nextTask = pendingHomework[0];
    parts.push(
      `[HOMEWORK RECALL — HATIRLATMA]\n` +
      `Geçen sefer sana bir ödev vermiştim: "${nextTask.title}"\n` +
      `Bununla nasıl ilerliyorsun?`
    );
  }

  // Tamamlanmış ödevlerden dersleri çıkart ve kutla
  const insights = await extractHomeworkInsights(userId);
  if (insights.length > 0) {
    const lastInsight = insights[0];
    parts.push(
      `[HOMEWORK RECALL — DERS]\n` +
      `"${lastInsight.task}" ödevinden öğrendin: "${lastInsight.learning}"\n` +
      `Bu bilgiyi bugün nasıl kullanabiliriz?`
    );
  }

  // Direniş tespit et
  const resistance = await detectHomeworkResistance(userId);
  if (resistance.hasResistance && resistance.abandonedTasks.length > 0) {
    const firstAbandoned = resistance.abandonedTasks[0];
    parts.push(
      `[HOMEWORK RECALL — DİRENÇ]\n` +
      `"${firstAbandoned.title}" ${firstAbandoned.daysAgo} gün önce atandı, ama hala yapılmadı.\n` +
      `Bu görev seni neden korkutuyor? Hep birlikte başlayabilir miyiz?`
    );

    if (resistance.patterns.length > 0) {
      parts.push(
        `[HOMEWORK RECALL — PATTERN]\n` +
        `Fark ettim: ${resistance.patterns.join(', ')}\n` +
        `Bu dirençi anlamalıyız.`
      );
    }
  }

  return parts.filter(p => p).join('\n\n');
}

/**
 * Başarılı ödevleri kutla ve güven artır
 * @param {Array} completedTasks — { title, timesTaken, insight }
 * @returns {string}
 */
export function buildHomeworkCelebrationContext(completedTasks = []) {
  if (!completedTasks || completedTasks.length === 0) return '';

  const parts = [];

  completedTasks.forEach(task => {
    const effortContext =
      task.timesTaken > 3
        ? `${task.timesTaken} kez denedin, öğrendin — bu dayanıklılık!`
        : task.timesTaken > 1
        ? `Biraz zorlansa da yaptın — güzel!`
        : `Direkt yaptın — harika!`;

    parts.push(
      `[HOMEWORK CELEBRATION]\n` +
      `"${task.title}" ödevini tamamladın. ${effortContext}\n` +
      `Öğrendin: "${task.insight}"`
    );
  });

  return parts.join('\n\n');
}
