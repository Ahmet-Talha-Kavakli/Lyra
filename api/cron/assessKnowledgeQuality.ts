/**
 * GET /api/cron/assessKnowledgeQuality
 * Scheduled: Mondays at 03:00 UTC
 *
 * Evaluates credibility of knowledge sources based on:
 * - Usage frequency
 * - Therapist feedback accuracy
 * - Patient outcome correlation
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
    logger.info('[Cron] assessKnowledgeQuality starting');
    const supabase = getAdminSupabaseClient();

    const lockKey = 'cron:assessKnowledgeQuality';
    const lockId = await acquireLock(lockKey, 3600);

    if (!lockId) {
      logger.info('[Cron] assessKnowledgeQuality already running');
    const supabase = getAdminSupabaseClient();
      return res.status(200).json({ skipped: true });
    }

    try {
      // 1. Fetch all knowledge sources
      const { data: sources, error: sourcesError } = await supabase
        .from('knowledge_sources')
        .select('id, credibility_score, usage_count, helpful_feedback_count');

      if (sourcesError) throw sourcesError;

      let updated = 0;

      // 2. For each source, calculate relevance score
      for (const source of sources || []) {
        // Calculate relevance based on usage and feedback
        const usageScore = Math.min((source.usage_count || 0) / 100, 1);
        const helpfulRatio = source.helpful_feedback_count && source.usage_count
          ? Math.min(source.helpful_feedback_count / source.usage_count, 1)
          : 0.5;

        const newScore = (source.credibility_score * 0.5 + (usageScore * 0.3 + helpfulRatio * 0.2) * 0.5);

        // 3. Update source relevance score
        const { error: updateError } = await supabase
          .from('knowledge_sources')
          .update({
            relevance_score: Math.round(newScore * 100) / 100,
            last_updated: new Date().toISOString()
          })
          .eq('id', source.id);

        if (!updateError) {
          updated++;
        }
      }

      await releaseLock(lockKey, lockId);

      logger.info('[Cron] assessKnowledgeQuality complete', { updated });

      return res.status(200).json({
        success: true,
        sourceEvaluated: sources?.length || 0,
        updatedScores: updated
      });

    } catch (jobError: any) {
      await releaseLock(lockKey, lockId || '');
      logger.error('[Cron] assessKnowledgeQuality failed', {
        error: jobError.message
      });
      return res.status(500).json({ success: false, error: jobError.message });
    }

  } catch (error: any) {
    logger.error('[Cron] Handler error', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}
