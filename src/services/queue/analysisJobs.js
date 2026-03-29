// [ANALYSIS JOBS — Background Processing for Chat Analysis]
// Post-response profile updates, technique effectiveness, session records
// These run async after LLM response is sent to user

import { jobQueue } from './jobQueue.js';
import { logger } from '../logging/logger.js';

/**
 * Queue profile update job
 * Runs: extractProfileUpdates → updateProfile
 */
export function queueProfileUpdate(userId, transcript, currentProfile, extractProfileUpdates, updateProfile) {
    return jobQueue.enqueue({
        id: `profile_${userId}_${Date.now()}`,
        type: 'profile_update',
        handler: async () => {
            try {
                const updates = await extractProfileUpdates(transcript, currentProfile);
                if (updates && Object.keys(updates).length > 0) {
                    await updateProfile(userId, updates);
                    logger.info('[ProfileUpdate] Profile updated', { userId, fields: Object.keys(updates) });
                }
            } catch (err) {
                logger.warn('[ProfileUpdate] Error', { userId, error: err.message });
            }
        }
    });
}

/**
 * Queue session record save + metrics update
 * Runs: analyzeSession → saveSessionRecord → updateWeeklyMetrics → incrementSessionCount
 */
export function queueSessionAnalysis(userId, sessionId, transcript, currentProfile, analysisData,
    analyzeSession, saveSessionRecord, updateWeeklyMetrics, incrementSessionCount) {
    return jobQueue.enqueue({
        id: `session_${sessionId}_${Date.now()}`,
        type: 'session_analysis',
        handler: async () => {
            try {
                const analysis = await analyzeSession(transcript, currentProfile);
                if (analysis && userId) {
                    await saveSessionRecord(userId, sessionId, analysis, [], null);
                    await updateWeeklyMetrics(userId, analysis);
                    await incrementSessionCount(userId);
                    logger.info('[SessionAnalysis] Session recorded', { userId, sessionId });
                }
            } catch (err) {
                logger.warn('[SessionAnalysis] Error', { userId, sessionId, error: err.message });
            }
        }
    });
}

/**
 * Queue technique effectiveness tracking
 * Runs: updateTechniqueEffectiveness for each used technique
 */
export function queueTechniqueTracking(userId, techniques, sessionAnalysis, updateTechniqueEffectiveness) {
    if (!techniques || !sessionAnalysis) return null;

    return jobQueue.enqueue({
        id: `technique_${userId}_${Date.now()}`,
        type: 'technique_tracking',
        handler: async () => {
            try {
                const improved = (sessionAnalysis.emotional_end_score || 0) > (sessionAnalysis.emotional_start_score || 5);
                for (const technique of techniques) {
                    await updateTechniqueEffectiveness(userId, technique.id, improved);
                }
                logger.info('[TechniqueTracking] Updated', { userId, count: techniques.length });
            } catch (err) {
                logger.warn('[TechniqueTracking] Error', { userId, error: err.message });
            }
        }
    });
}

/**
 * Queue hypothesis engine (runs every 3 sessions)
 */
export function queueHypothesisEngine(userId, currentProfile, runHypothesisEngine) {
    return jobQueue.enqueue({
        id: `hypothesis_${userId}_${Date.now()}`,
        type: 'hypothesis_engine',
        handler: async () => {
            try {
                await runHypothesisEngine(userId, currentProfile);
                logger.info('[HypothesisEngine] Run complete', { userId });
            } catch (err) {
                logger.warn('[HypothesisEngine] Error', { userId, error: err.message });
            }
        }
    });
}

/**
 * Queue semantic memory engine (embed critical moments)
 */
export function queueSemanticMemory(userId, sessionId, messages, runSemanticMemoryEngine) {
    return jobQueue.enqueue({
        id: `semantic_${userId}_${Date.now()}`,
        type: 'semantic_memory',
        handler: async () => {
            try {
                await runSemanticMemoryEngine(userId, sessionId, messages);
                logger.info('[SemanticMemory] Embedded', { userId, sessionId });
            } catch (err) {
                logger.warn('[SemanticMemory] Error', { userId, error: err.message });
            }
        }
    });
}

/**
 * Queue homework generation (end of session)
 */
export function queueHomeworkGeneration(userId, sessionId, transcript, currentProfile, emotionDominant, runHomeworkEngine) {
    return jobQueue.enqueue({
        id: `homework_${userId}_${Date.now()}`,
        type: 'homework_generation',
        handler: async () => {
            try {
                await runHomeworkEngine(userId, sessionId, transcript, currentProfile, emotionDominant);
                logger.info('[HomeworkEngine] Generated', { userId, sessionId });
            } catch (err) {
                logger.warn('[HomeworkEngine] Error', { userId, error: err.message });
            }
        }
    });
}

/**
 * Get queue status
 */
export function getQueueStatus() {
    return jobQueue.getStatus();
}
