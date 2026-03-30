/**
 * GET /api/cron/detectKnowledgeGaps
 * Scheduled: Fridays at 02:00 UTC
 *
 * Analyzes knowledge usage logs to identify gaps:
 * - Topics patients ask about but aren't in knowledge base
 * - Questions that result in low satisfaction
 * - Emergency hotspot topics
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminSupabaseClient } from '../../lib/shared/supabaseAdmin';
import { logger } from '../../lib/infrastructure/logger';
import { verifyCronSecret } from '../../lib/infrastructure/authMiddleware';
import { acquireLock, releaseLock } from '../../lib/shared/upstashRedis';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyCronSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logger.info('[Cron] detectKnowledgeGaps starting');
    const supabase = getAdminSupabaseClient();

    const lockKey = 'cron:detectKnowledgeGaps';
    const lockId = await acquireLock(lockKey, 3600);

    if (!lockId) {
      logger.info('[Cron] detectKnowledgeGaps already running');
    const supabase = getAdminSupabaseClient();
      return res.status(200).json({ skipped: true });
    }

    try {
      // 1. Fetch message logs from past 7 days (unanswered or low-confidence)
      const { data: problemMessages, error: messagesError } = await supabase
        .from('message_logs')
        .select('content, confidence_score, therapy_outcome')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .lt('confidence_score', 0.7); // Low confidence responses

      if (messagesError) throw messagesError;

      // 2. Extract topics mentioned but not in knowledge base
      const { data: existingSources, error: sourcesError } = await supabase
        .from('knowledge_sources')
        .select('topic');

      if (sourcesError) throw sourcesError;

      const existingTopics = new Set(
        (existingSources || []).map((s: any) => s.topic.toLowerCase())
      );

      const gaps: Map<string, number> = new Map();

      // Simple NLP: extract nouns from low-confidence messages
      for (const msg of problemMessages || []) {
        // TODO: Use Anthropic Claude for proper NLP extraction
        // For now, use simple keyword detection

        if (msg.content.includes('suicide') || msg.content.includes('harm')) {
          const key = 'Crisis Intervention Techniques';
          gaps.set(key, (gaps.get(key) || 0) + 2); // Higher weight for safety-critical
        }

        if (msg.content.includes('panic') || msg.content.includes('anxiety')) {
          const key = 'Anxiety Management';
          gaps.set(key, (gaps.get(key) || 0) + 1);
        }

        if (msg.content.includes('depression') || msg.content.includes('sad')) {
          const key = 'Depression Treatment';
          gaps.set(key, (gaps.get(key) || 0) + 1);
        }

        if (msg.content.includes('relationship') || msg.content.includes('family')) {
          const key = 'Relational Therapy';
          gaps.set(key, (gaps.get(key) || 0) + 1);
        }
      }

      // 3. Filter to only gaps (not already in knowledge base)
      const newGaps = Array.from(gaps.entries())
        .filter(([topic]) => !existingTopics.has(topic.toLowerCase()))
        .sort((a, b) => b[1] - a[1]) // Sort by frequency
        .slice(0, 10); // Top 10 gaps

      // 4. Create knowledge gap report
      if (newGaps.length > 0) {
        const { error: reportError } = await supabase
          .from('knowledge_gap_reports')
          .insert({
            report_date: new Date().toISOString(),
            gaps: newGaps.map(([topic, count]) => ({ topic, mentions: count })),
            total_low_confidence_messages: problemMessages?.length || 0,
            recommendation: 'Review prioritized gaps and consider adding to knowledge base'
          });

        if (reportError) logger.warn('[Cron] Failed to save gap report', { error: reportError.message });
      }

      await releaseLock(lockKey, lockId);

      logger.info('[Cron] detectKnowledgeGaps complete', { gapsFound: newGaps.length });
    const supabase = getAdminSupabaseClient();

      return res.status(200).json({
        success: true,
        knowledgeGapsDetected: newGaps.length,
        topGaps: newGaps.slice(0, 5)
      });

    } catch (jobError: any) {
      await releaseLock(lockKey, lockId || '');
      logger.error('[Cron] detectKnowledgeGaps failed', {
        error: jobError.message
      });
      return res.status(500).json({ success: false, error: jobError.message });
    }

  } catch (error: any) {
    logger.error('[Cron] Handler error', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}
