/**
 * Job Processor Worker
 * Runs in separate Node process
 * Picks up queued jobs and processes them asynchronously
 * Survives server crashes via Redis persistence
 */

import { optimizedQueue } from '../../infrastructure/queue/OptimizedQueue.js';
import { databasePool } from '../../infrastructure/database/DatabasePool.js';
import { logger } from '../../infrastructure/logging/logger.js';

class JobProcessor {
    async initialize() {
        // Initialize database pool
        await databasePool.initialize();

        logger.info('[Worker] Initializing job processors');

        // Register processor for session analysis
        this.registerSessionAnalysisProcessor();

        // Register processor for profile updates
        this.registerProfileUpdateProcessor();

        // Register processor for homework generation
        this.registerHomeworkGenerationProcessor();

        logger.info('[Worker] All job processors registered');
    }

    /**
     * Session Analysis Job
     * Stores conversation analysis, detects patterns
     */
    registerSessionAnalysisProcessor() {
        optimizedQueue.registerProcessor('session_analysis', async (data) => {
            const { userId, sessionId, transcript, response, modules, state, timestamp } = data;

            try {
                // Store session analysis in database
                await databasePool.query(
                    `INSERT INTO session_analysis (user_id, session_id, transcript, response, modules, emotional_state, timestamp)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (session_id) DO UPDATE SET
                       response = $4, modules = $5, emotional_state = $6, timestamp = $7`,
                    [userId, sessionId, JSON.stringify(transcript), response, JSON.stringify(modules), JSON.stringify(state), timestamp]
                );

                logger.debug('[Worker] Session analysis saved', { userId, sessionId });

                return { success: true, jobType: 'session_analysis' };
            } catch (error) {
                logger.error('[Worker] Session analysis failed', { userId, error: error.message });
                throw error;
            }
        });
    }

    /**
     * Profile Update Job
     * Updates user profile with latest interaction data
     */
    registerProfileUpdateProcessor() {
        optimizedQueue.registerProcessor('profile_update', async (data) => {
            const { userId, sessionId, updates } = data;

            try {
                // Update user profile
                const updateClauses = Object.keys(updates)
                    .map((key, idx) => `${key} = $${idx + 2}`)
                    .join(', ');

                await databasePool.query(
                    `UPDATE psychological_profiles
                     SET ${updateClauses}, updated_at = NOW()
                     WHERE user_id = $1`,
                    [userId, ...Object.values(updates)]
                );

                // Store interaction record
                await databasePool.query(
                    `INSERT INTO user_interactions (user_id, session_id, interaction_type, metadata, created_at)
                     VALUES ($1, $2, 'chat', $3, NOW())`,
                    [userId, sessionId, JSON.stringify(updates)]
                );

                logger.debug('[Worker] Profile updated', { userId });

                return { success: true, jobType: 'profile_update' };
            } catch (error) {
                logger.error('[Worker] Profile update failed', { userId, error: error.message });
                throw error;
            }
        });
    }

    /**
     * Homework Generation Job
     * Creates personalized homework based on session insights
     */
    registerHomeworkGenerationProcessor() {
        optimizedQueue.registerProcessor('homework_generation', async (data) => {
            const { userId, sessionId, response, modules, phase } = data;

            try {
                // Extract homework from response
                const homeworkItems = this.extractHomeworkItems(response);

                if (homeworkItems.length === 0) {
                    logger.debug('[Worker] No homework items extracted', { userId, sessionId });
                    return { success: true, homeworkCount: 0 };
                }

                // Store homework assignments
                for (const item of homeworkItems) {
                    await databasePool.query(
                        `INSERT INTO homework_assignments (user_id, session_id, task, modules, status, due_date, created_at)
                         VALUES ($1, $2, $3, $4, 'pending', $5, NOW())`,
                        [
                            userId,
                            sessionId,
                            item.task,
                            JSON.stringify(modules),
                            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Due in 7 days
                        ]
                    );
                }

                logger.debug('[Worker] Homework generated', {
                    userId,
                    sessionId,
                    homeworkCount: homeworkItems.length
                });

                return { success: true, homeworkCount: homeworkItems.length };
            } catch (error) {
                logger.error('[Worker] Homework generation failed', { userId, error: error.message });
                throw error;
            }
        });
    }

    /**
     * Extract homework items from response text
     */
    extractHomeworkItems(response) {
        const items = [];
        const lines = response.split('\n');

        for (const line of lines) {
            // Match bullet points, numbered lists, homework keywords
            if (/^[-•*]\s*|^\d+\.\s*|домаш|дз|задание|упражнение|дневник|практика/i.test(line)) {
                const cleaned = line.replace(/^[-•*]\s*|^\d+\.\s*/, '').trim();

                if (cleaned.length > 10 && cleaned.length < 300) {
                    items.push({ task: cleaned, type: 'behavioral' });
                }
            }
        }

        return items.slice(0, 5); // Maximum 5 homework items
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('[Worker] Shutting down...');
        await optimizedQueue.shutdown();
        await databasePool.shutdown();
        process.exit(0);
    }
}

// Initialize worker
const processor = new JobProcessor();
processor.initialize()
    .then(() => {
        logger.info('[Worker] Ready to process jobs');
    })
    .catch(err => {
        logger.error('[Worker] Initialization failed', { error: err.message });
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', () => processor.shutdown());
process.on('SIGINT', () => processor.shutdown());

export default JobProcessor;
