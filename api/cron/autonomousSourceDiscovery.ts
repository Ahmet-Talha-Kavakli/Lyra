/**
 * GET /api/cron/autonomousSourceDiscovery
 * Scheduled by: vercel.json crons
 *
 * Runs daily at 02:00 UTC
 * Discovers new knowledge sources via GPT-4 analysis
 *
 * Vercel automatically sends X-Vercel-Cron header on scheduled invocations
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/shared/supabase';
import { logger } from '../../lib/infrastructure/logger';
import { verifyCronSecret } from '../../lib/infrastructure/authMiddleware';
import { acquireLock, releaseLock } from '../../lib/shared/upstashRedis';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only GET allowed (Vercel cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a legitimate Vercel cron call
  if (!verifyCronSecret(req)) {
    logger.warn('[Cron] Unauthorized cron attempt', {
      headers: Object.keys(req.headers)
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logger.info('[Cron] autonomousSourceDiscovery starting');

    // Acquire distributed lock (prevent multiple instances running simultaneously)
    const lockKey = 'cron:autonomousSourceDiscovery';
    const lockId = await acquireLock(lockKey, 3600); // 1 hour lock

    if (!lockId) {
      logger.info('[Cron] autonomousSourceDiscovery already running, skipping');
      return res.status(200).json({
        message: 'Cron already running on another instance',
        skipped: true
      });
    }

    try {
      // ==========================================
      // MAIN LOGIC: Discover knowledge sources
      // ==========================================

      // 1. Fetch current knowledge base statistics
      const { data: stats, error: statsError } = await supabase
        .from('knowledge_sources')
        .select('id, topic, credibility_score')
        .order('created_at', { ascending: false })
        .limit(100);

      if (statsError) throw statsError;

      // 2. Analyze gaps and recommend new sources
      const prompt = `
You are a knowledge curator for an AI therapy assistant.
Analyze the following knowledge base topics and recommend 5 new topics that would improve therapeutic value.

Current topics (${stats?.length || 0}):
${stats?.map((s: any) => `- ${s.topic} (credibility: ${s.credibility_score})`).join('\n')}

Recommend new topics that:
1. Fill therapeutic knowledge gaps
2. Are evidence-based and credible
3. Complement existing topics
4. Improve therapy outcomes

Format response as JSON array:
[
  { "topic": "...", "description": "...", "priority": "high|medium|low" }
]
`;

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      let recommendations: any[] = [];
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          recommendations = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        logger.warn('[Cron] Failed to parse GPT response', {
          error: parseError
        });
      }

      // 3. Insert recommended sources into knowledge_sources table
      if (recommendations.length > 0) {
        const { error: insertError } = await supabase
          .from('knowledge_sources')
          .insert(
            recommendations.map((rec: any) => ({
              topic: rec.topic,
              description: rec.description,
              source_type: 'auto-discovered',
              credibility_score: 0.5, // Start low, increase as evidence accumulates
              is_active: false, // Requires manual review before activation
              created_at: new Date().toISOString()
            }))
          );

        if (insertError) throw insertError;

        logger.info('[Cron] autonomousSourceDiscovery complete', {
          discovered: recommendations.length
        });
      }

      // 4. Release lock
      await releaseLock(lockKey, lockId);

      return res.status(200).json({
        success: true,
        sourcesDiscovered: recommendations.length,
        timestamp: new Date().toISOString()
      });

    } catch (jobError: any) {
      // Release lock on error
      await releaseLock(lockKey, lockId || '');

      logger.error('[Cron] autonomousSourceDiscovery failed', {
        error: jobError.message
      });

      return res.status(500).json({
        success: false,
        error: jobError.message
      });
    }

  } catch (error: any) {
    logger.error('[Cron] Handler error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
