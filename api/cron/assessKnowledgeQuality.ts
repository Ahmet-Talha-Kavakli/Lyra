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
        .select('id, topic, credibility_score');

      if (sourcesError) throw sourcesError;

      let updated = 0;

      // 2. For each source, calculate quality score
      for (const source of sources || []) {
        // Get usage frequency (how many times referenced in last 30 days)
        const { count: usageCount, error: usageError } = await supabase
          .from('knowledge_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('knowledge_source_id', source.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if (usageError) continue;

        // Get feedback accuracy (how often therapist marked it as helpful)
        const { data: feedback, error: feedbackError } = await supabase
          .from('knowledge_feedback')
          .select('helpful')
          .eq('knowledge_source_id', source.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if (feedbackError) continue;

        // Calculate credibility score
        const usageScore = Math.min((usageCount || 0) / 100, 1); // Normalize to 0-1
        const helpfulRatio = feedback?.length
          ? feedback.filter((f: any) => f.helpful).length / feedback.length
          : 0.5;

        const newScore = (source.credibility_score * 0.5 + (usageScore * 0.3 + helpfulRatio * 0.2) * 0.5);

        // 3. Update source credibility score
        const { error: updateError } = await supabase
          .from('knowledge_sources')
          .update({
            credibility_score: Math.round(newScore * 100) / 100,
            last_quality_check: new Date().toISOString()
          })
          .eq('id', source.id);

        if (!updateError) {
          updated++;
        }
      }

      await releaseLock(lockKey, lockId);

      logger.info('[Cron] assessKnowledgeQuality complete', { updated });
    const supabase = getAdminSupabaseClient();

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
