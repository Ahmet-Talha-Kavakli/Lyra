// lib/sessionContinuity.js
// Session Continuity — seanslar arası bağlantı, "son sefer nerede bırakmıştık"
// Duygusal fir'a (momentum), açık konular, yarıda kalan diyaloglar
//
// Terapötik ilişkinin mihenk taşı: "Seni hatırladım, son seferde buradaydın"

import { supabase } from './supabase.js';

/**
 * Son seansın önemli momentlerini çek (duygusal dip, kopuş, keşif)
 * @param {string} userId
 * @returns {Promise<{ lastSession, emotionalArc, openTopics, breakthrough, unfinishedBusiness }|null}}
 */
export async function recallLastSession(userId) {
  try {
    const { data: lastSessionRecord } = await supabase
      .from('session_records')
      .select(`
        id, created_at, dominant_emotion, session_quality,
        breakthrough_moment, topics, session_summary,
        closing_state, key_insight
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastSessionRecord) return null;

    // Son seansta kaçıncı seans olduğunu bul
    const { data: allSessions } = await supabase
      .from('session_records')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    const sessionNumber = allSessions?.findIndex(s => s.id === lastSessionRecord.id) + 1 || 0;

    return {
      lastSession: {
        id: lastSessionRecord.id,
        sessionNumber,
        date: lastSessionRecord.created_at,
        dominantEmotion: lastSessionRecord.dominant_emotion,
        quality: lastSessionRecord.session_quality,
      },
      emotionalArc: {
        breakthrough: lastSessionRecord.breakthrough_moment,
        keyInsight: lastSessionRecord.key_insight,
        closingState: lastSessionRecord.closing_state,
      },
      openTopics: lastSessionRecord.topics || [],
      unfinishedBusiness: lastSessionRecord.session_summary
        ? extractUnfinishedBusiness(lastSessionRecord.session_summary)
        : [],
    };
  } catch (err) {
    console.error('[sessionContinuity] Hata:', err.message);
    return null;
  }
}

/**
 * Seanslar arası gelişmeleri tespit et
 * @param {string} userId
 * @param {number} daysSinceLastSession
 * @returns {Promise<{ hasProgressMade, challengesFaced, positiveChanges, stillStruggles }|null>}
 */
export async function detectInterSessionDevelopments(userId, daysSinceLastSession = 0) {
  try {
    const { data: lastSession } = await supabase
      .from('session_records')
      .select('id, created_at, key_insight, dominant_emotion')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastSession) return null;

    // Aralarında hafta geçtiyse, yapı değişebilir
    const daysElapsed = daysSinceLastSession ||
      Math.floor((new Date() - new Date(lastSession.created_at)) / (1000 * 60 * 60 * 24));

    return {
      daysElapsed,
      hasTime: daysElapsed > 3, // 3+ gün = önemli arası
      lastEmotionalState: lastSession.dominant_emotion,
      lastKeyInsight: lastSession.key_insight,
      // Kullanıcının bu seansda söyledikleri ile son seans karşılaştırılacak
      // (analyzeCurrentSessionOpening içinde)
    };
  } catch (err) {
    console.error('[sessionContinuity] Arası gelişme hatası:', err.message);
    return null;
  }
}

/**
 * Seansın başında: "Seni hatırladım, geçen sefer neredeydik" bağlamı oluştur
 * @param {string} userId
 * @param {string} currentUserMessage
 * @param {number} daysElapsed
 * @returns {Promise<string>}
 */
export async function buildSessionContinuityContext(userId, currentUserMessage, daysElapsed = 0) {
  const lastSession = await recallLastSession(userId);
  if (!lastSession) return ''; // İlk seans, bağlam yok

  const parts = [];

  // ─── HAZIRLAMA ───────────────────────────────────────────────────────────

  const { emotionalArc, openTopics, lastSession: sessionInfo } = lastSession;

  // Seanslar arası zaman
  let timingContext = '';
  if (daysElapsed > 7) {
    timingContext = `${daysElapsed} gün ardan sonra — arada ne oldu, hatırlatır mısın?`;
  } else if (daysElapsed > 3) {
    timingContext = `Birkaç gün geçti. Geçen sefer bıraktığımız yerden devam edelim.`;
  } else if (daysElapsed > 0) {
    timingContext = `Dün bıraktığımız yerden başlayalım.`;
  } else {
    timingContext = `Aynı gün içinde devam ediyoruz.`;
  }

  // ─── SON SEANSıN DOMİNANT EMOSYONu ──────────────────────────────────────

  if (sessionInfo?.dominantEmotion) {
    parts.push(
      `[SESSION CONTINUITY — SON SEANSıN DUYGUSu]\n` +
      `Geçen sefer seni ${sessionInfo.dominantEmotion} halde buldum. Bugün nerede?`
    );
  }

  // ─── AÇIK KONULAR ──────────────────────────────────────────────────────

  if (openTopics && openTopics.length > 0) {
    const topicsList = openTopics.slice(0, 3).join(', ');
    parts.push(
      `[SESSION CONTINUITY — AÇIK KONULAR]\n` +
      `Geçen sefer bu konuları tartışıyorduk: ${topicsList}\n` +
      `Bunlardan hangisine dönmek istersin?`
    );
  }

  // ─── BREAKTHROUGH VEYA KEY INSIGHT ────────────────────────────────────

  if (emotionalArc?.breakthrough) {
    parts.push(
      `[SESSION CONTINUITY — KEŞIF]\n` +
      `Geçen sefer önemli bir şey fark ettik: "${emotionalArc.breakthrough}"\n` +
      `Bu bugünü nasıl etkiliyor?`
    );
  }

  if (emotionalArc?.keyInsight) {
    parts.push(
      `[SESSION CONTINUITY — DERS]\n` +
      `Geçen sefer bunu öğrendik: "${emotionalArc.keyInsight}"\n` +
      `Bu bilgiyi nasıl kullanıyorsun?`
    );
  }

  // ─── KAPANIŞ DURUMU ────────────────────────────────────────────────────

  if (emotionalArc?.closingState) {
    const stateContext =
      emotionalArc.closingState === 'resolved'
        ? 'Geçen sefer huzurlu bittik.'
        : emotionalArc.closingState === 'exploring'
        ? 'Geçen sefer keşfe devam ediyorduk.'
        : emotionalArc.closingState === 'breakthrough'
        ? 'Geçen sefer dış dünyaya açılmıştın.'
        : emotionalArc.closingState === 'unresolved'
        ? 'Geçen sefer açık konular vardı.'
        : '';

    if (stateContext) {
      parts.push(`[SESSION CONTINUITY — KAPANIŞ]\n${stateContext}`);
    }
  }

  // ─── ZAMANıN ETKISI ──────────────────────────────────────────────────────

  parts.push(`[SESSION CONTINUITY — ZAMAN]\n${timingContext}`);

  // ─── DURUMUN DEĞİŞİP DEĞİŞMEDİĞİNİ SORGULAMAK ────────────────────────

  const currentEmotionalHint = detectEmotionalShift(currentUserMessage, sessionInfo?.dominantEmotion);
  if (currentEmotionalHint) {
    parts.push(currentEmotionalHint);
  }

  return parts.filter(p => p).join('\n\n');
}

/**
 * Geçen sefer ile bugün arasında duygusal kayma var mı?
 * @param {string} currentMessage
 * @param {string} lastEmotion
 * @returns {string|null}
 */
function detectEmotionalShift(currentMessage, lastEmotion) {
  if (!lastEmotion || !currentMessage) return null;

  const lowerMsg = currentMessage.toLowerCase();

  // Geçen sefer üzgün, bugün umutlu
  const positiveShift = ['daha iyi', 'geçti', 'iyileşti', 'umut', 'heyecan', 'güven'].some(w =>
    lowerMsg.includes(w),
  );

  // Geçen sefer iyi, bugün kötüleşmiş
  const negativeShift = ['daha kötü', 'geri', 'tekrar', 'umulsuz', 'başarısız'].some(w =>
    lowerMsg.includes(w),
  );

  if (positiveShift && lastEmotion.includes('üzgün')) {
    return `[SESSION CONTINUITY — İLERLEME]\nGeçen sefer üzgündün, bugün daha pozitif görünüyorsun. Ne değişti?`;
  }

  if (negativeShift && lastEmotion.includes('umut')) {
    return `[SESSION CONTINUITY — GERILEME]\nGeçen sefer daha umutluydun. Bugün ne oldu?`;
  }

  return null;
}

/**
 * Seansın açılış momentini analiz et (continuity vs reset)
 * @param {string} userId
 * @param {string} firstUserMessage
 * @param {number} sessionNumber
 * @returns {Promise<{ isContinuation: boolean, resumeType: string, context: string }>}
 */
export async function analyzeSessionOpening(userId, firstUserMessage, sessionNumber) {
  const lastSession = await recallLastSession(userId);

  // İlk seans veya 7+ gün arası = "yeni başlangıç" (reset)
  const isNewBeginning = !lastSession || sessionNumber <= 1;

  if (isNewBeginning) {
    return {
      isContinuation: false,
      resumeType: 'new_beginning',
      context: '[SESSION OPENING] İlk seans veya uzun aradan sonra yeni başlangıç.',
    };
  }

  // Daysını hesapla
  const lastDate = new Date(lastSession.lastSession.date);
  const daysElapsed = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));

  // Kullanıcının açılış mesajı "geçen sefer" içeriyor mu?
  const referencesLastSession = [
    'geçen',
    'dün',
    'son',
    'hatırla',
    'konuştuk',
    'bıraktık',
  ].some(word => firstUserMessage.toLowerCase().includes(word));

  // Aynı konunun devamı mı?
  const lastTopics = lastSession.openTopics || [];
  const continuesSameTopic = lastTopics.some(topic =>
    firstUserMessage.toLowerCase().includes(topic.toLowerCase()),
  );

  let resumeType = 'continuation';
  if (daysElapsed > 7) resumeType = 'long_gap_reconnection';
  else if (daysElapsed > 3) resumeType = 'weekly_check_in';
  else if (daysElapsed > 0) resumeType = 'same_week_continuation';
  else resumeType = 'same_session_continuation';

  return {
    isContinuation: true,
    resumeType,
    daysElapsed,
    referencesLastSession,
    continuesSameTopic,
    context: await buildSessionContinuityContext(userId, firstUserMessage, daysElapsed),
  };
}

/**
 * Yarıda kalan iş (unfinished business) çıkart
 * @param {string} sessionSummary
 * @returns {string[]}
 */
function extractUnfinishedBusiness(sessionSummary) {
  const patterns = [
    /henüz çözmemiş|çözmediğimiz|açık kaldı|yarıda kaldı/gi,
    /devam etmeliyiz|devam edebiliriz|sonra konuşabiliriz/gi,
    /tamamlanmadı|tamamlamamış/gi,
  ];

  const issues = [];
  patterns.forEach(pattern => {
    const matches = sessionSummary.match(pattern);
    if (matches) issues.push(...matches);
  });

  return [...new Set(issues)]; // dedupe
}
