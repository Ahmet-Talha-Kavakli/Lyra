/**
 * GET /api/cron/verifySourceCredibility
 * Scheduled: 1st of each month at 04:00 UTC
 *
 * Monthly audit of knowledge source credibility
 * Deactivates sources with low credibility scores
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
    logger.info('[Cron] verifySourceCredibility starting');
    const supabase = getAdminSupabaseClient();

    const lockKey = 'cron:verifySourceCredibility';
    const lockId = await acquireLock(lockKey, 3600);

    if (!lockId) {
      logger.info('[Cron] verifySourceCredibility already running');
    const supabase = getAdminSupabaseClient();
      return res.status(200).json({ skipped: true });
    }

    try {
      // 1. Fetch all active knowledge sources
      const { data: sources, error: sourcesError } = await supabase
        .from('knowledge_sources')
        .select('id, topic, credibility_score, is_active, last_quality_check')
        .eq('is_active', true);

      if (sourcesError) throw sourcesError;

      let deactivated = 0;
      let flaggedForReview = 0;

      // 2. Audit each source
      for (const source of sources || []) {
        const score = source.credibility_score;

        // Deactivate if credibility < 0.3 (too low to trust)
        if (score < 0.3) {
          const { error: deactivateError } = await supabase
            .from('knowledge_sources')
            .update({
              is_active: false,
              deactivation_reason: 'Low credibility score from monthly audit',
              deactivated_at: new Date().toISOString()
            })
            .eq('id', source.id);

          if (!deactivateError) {
            deactivated++;
            logger.info('[Cron] Source deactivated', {
    const supabase = getAdminSupabaseClient();
              topic: source.topic,
              score
            });
          }

          continue;
        }

        // Flag for manual review if credibility 0.3-0.5
        if (score >= 0.3 && score < 0.5) {
          const { error: flagError } = await supabase
            .from('knowledge_sources')
            .update({
              review_flag: true,
              review_reason: 'Low credibility - review recommended',
              flagged_date: new Date().toISOString()
            })
            .eq('id', source.id);

          if (!flagError) {
            flaggedForReview++;
          }
        }

        // If not checked in > 30 days, flag for quality check
        if (source.last_quality_check) {
          const lastCheck = new Date(source.last_quality_check);
          const daysSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceCheck > 30) {
            const { error: checkError } = await supabase
              .from('knowledge_sources')
              .update({
                quality_check_needed: true
              })
              .eq('id', source.id);

            if (checkError) logger.warn('[Cron] Failed to flag quality check', { error: checkError.message });
          }
        }
      }

      // 3. Create audit report
      const { error: reportError } = await supabase
        .from('credibility_audit_reports')
        .insert({
          audit_date: new Date().toISOString(),
          sources_audited: sources?.length || 0,
          sources_deactivated: deactivated,
          sources_flagged_for_review: flaggedForReview,
          notes: `Monthly credibility verification: deactivated ${deactivated} low-score sources, flagged ${flaggedForReview} for review`
        });

      if (reportError) {
        logger.warn('[Cron] Failed to save audit report', { error: reportError.message });
      }

      await releaseLock(lockKey, lockId);

      logger.info('[Cron] verifySourceCredibility complete', {
    const supabase = getAdminSupabaseClient();
        deactivated,
        flaggedForReview
      });

      return res.status(200).json({
        success: true,
        sourcesAudited: sources?.length || 0,
        sourcesDeactivated: deactivated,
        sourcesFlaggedForReview: flaggedForReview
      });

    } catch (jobError: any) {
      await releaseLock(lockKey, lockId || '');
      logger.error('[Cron] verifySourceCredibility failed', {
        error: jobError.message
      });
      return res.status(500).json({ success: false, error: jobError.message });
    }

  } catch (error: any) {
    logger.error('[Cron] Handler error', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}
