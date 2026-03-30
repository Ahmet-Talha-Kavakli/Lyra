/**
 * Somatic Analysis Route
 * Integration point for 4-layer Somatic Intelligence System
 * Real-time multimodal analysis during therapy session
 */

import express from 'express';
import { logger } from '../../../infrastructure/logging/logger.js';
import { authMiddleware } from '../../../middleware/auth.js';
import { dataAcquisitionEngine } from '../../../infrastructure/multimodal/DataAcquisitionEngine.js';
import { facsAnalyzer } from '../../../infrastructure/multimodal/FACSAnalyzer.js';
import { prosodyAnalyzer } from '../../../infrastructure/multimodal/ProsodyAnalyzer.js';
import { multimodalFusionEngine } from '../../../infrastructure/multimodal/MultimodalFusionEngine.js';
import { clinicalSomaticInterpreter } from '../../../application/services/ClinicalSomaticInterpreter.js';
import { databasePool } from '../../../infrastructure/database/DatabasePool.js';
import { optimizedQueue } from '../../../infrastructure/queue/OptimizedQueue.js';

const router = express.Router();

/**
 * POST /v1/somatic/session/start
 * Initialize somatic monitoring for therapy session
 */
router.post('/v1/somatic/session/start', authMiddleware, async (req, res) => {
    const { sessionId, userId } = req.body;

    if (!sessionId || !userId) {
        return res.status(400).json({ error: 'sessionId and userId required' });
    }

    try {
        logger.info('[SomaticAnalysis] Starting session', { sessionId, userId });

        // Initialize data acquisition (camera + mic)
        await dataAcquisitionEngine.initialize();

        // Initialize FACS analyzer
        await facsAnalyzer.initialize();

        // Initialize Prosody analyzer
        const audioStream = dataAcquisitionEngine.audioStream;
        await prosodyAnalyzer.initialize(audioStream);

        // Create session record in database
        await databasePool.query(
            `INSERT INTO somatic_sessions (session_id, user_id, started_at, status)
             VALUES ($1, $2, NOW(), 'active')
             ON CONFLICT (session_id) DO UPDATE SET status = 'active', started_at = NOW()`,
            [sessionId, userId]
        );

        // Start analysis loop
        startAnalysisLoop(sessionId, userId);

        // Send WebSocket connection info
        res.json({
            status: 'monitoring_started',
            sessionId: sessionId,
            message: 'Real-time somatic analysis active'
        });

    } catch (error) {
        logger.error('[SomaticAnalysis] Start failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * Analysis Loop: 1 analysis per second
 */
const analysisLoops = new Map();

function startAnalysisLoop(sessionId, userId) {
    if (analysisLoops.has(sessionId)) {
        logger.warn('[SomaticAnalysis] Loop already running', { sessionId });
        return;
    }

    let frameCount = 0;

    const analysisInterval = setInterval(async () => {
        try {
            frameCount++;

            // ============================================
            // LAYER 1: Get raw data
            // ============================================
            const currentFrame = dataAcquisitionEngine.getCurrentFrame();
            const currentAudioChunk = dataAcquisitionEngine.getCurrentAudioChunk();

            if (!currentFrame || !currentAudioChunk) {
                return; // Not ready yet
            }

            // ============================================
            // LAYER 2A: FACS Analysis
            // ============================================
            const facsData = await facsAnalyzer.analyzeFrame(currentFrame.data);

            if (!facsData.detected) {
                logger.debug('[SomaticAnalysis] Face not detected', { frameCount });
                return;
            }

            // ============================================
            // LAYER 2B: Prosody Analysis
            // ============================================
            const prosodyData = prosodyAnalyzer.analyzeAudioChunk(currentAudioChunk);

            // ============================================
            // LAYER 3: Multimodal Fusion
            // ============================================
            const fusedState = multimodalFusionEngine.fuseModalities(
                facsData,
                prosodyData,
                { sessionId, userId }
            );

            // ============================================
            // LAYER 4: Clinical Interpretation
            // ============================================
            const clinicalInterpretation = clinicalSomaticInterpreter.interpretSomaticState(fusedState);

            // ============================================
            // STORE & EMIT
            // ============================================

            // Store full analysis in database
            await storeAnalysis(sessionId, userId, clinicalInterpretation);

            // Emit real-time update to therapist
            emitTherapistUpdate(sessionId, clinicalInterpretation);

            // Log periodic summary
            if (frameCount % 30 === 0) { // Every 30 seconds
                logger.info('[SomaticAnalysis] Heartbeat', {
                    sessionId,
                    frameCount,
                    currentEmotion: clinicalInterpretation.emotionalState?.emotionalState?.primary,
                    autonomicState: clinicalInterpretation.autonomicState?.vagalState
                });
            }

        } catch (error) {
            logger.error('[SomaticAnalysis] Loop error', { error: error.message });
        }
    }, 1000); // 1 analysis per second

    analysisLoops.set(sessionId, analysisInterval);

    logger.info('[SomaticAnalysis] Loop started', { sessionId });
}

/**
 * Store analysis in database
 */
async function storeAnalysis(sessionId, userId, interpretation) {
    try {
        await databasePool.query(
            `INSERT INTO somatic_analysis
             (session_id, user_id, facs_action_units, prosody_pitch_hz,
              emotional_state_primary, autonomic_state, analysis_data, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
                sessionId,
                userId,
                interpretation.emotionalState?.emotionalState?.primary || 'unknown',
                interpretation.emotionalState?.emotionalState?.primaryScore || 0,
                interpretation.autonomicState?.vagalState || 'unknown',
                interpretation.timestamp,
                JSON.stringify(interpretation)
            ]
        );

        // Every 60 seconds, queue long-term storage job
        if (Math.random() < 1/60) {
            await optimizedQueue.addJob('somatic_analysis_archive', {
                sessionId,
                userId,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        logger.error('[SomaticAnalysis] Store failed', { error: error.message });
    }
}

/**
 * Emit real-time update to therapist dashboard
 */
function emitTherapistUpdate(sessionId, interpretation) {
    // TODO: Implement WebSocket/Socket.io emission
    // io.to(sessionId).emit('somatic-update', {
    //     autonomicState: interpretation.autonomicState,
    //     emotionalState: interpretation.emotionalState?.emotionalState,
    //     recommendations: interpretation.recommendations,
    //     therapistGuidance: interpretation.therapistGuidance,
    //     timestamp: interpretation.timestamp
    // });
}

/**
 * POST /v1/somatic/session/stop
 * Stop somatic monitoring
 */
router.post('/v1/somatic/session/stop', authMiddleware, async (req, res) => {
    const { sessionId } = req.body;

    try {
        // Stop analysis loop
        const interval = analysisLoops.get(sessionId);
        if (interval) {
            clearInterval(interval);
            analysisLoops.delete(sessionId);
        }

        // Stop data acquisition
        dataAcquisitionEngine.stop();

        // Update session status
        await databasePool.query(
            `UPDATE somatic_sessions SET status = 'completed', ended_at = NOW()
             WHERE session_id = $1`,
            [sessionId]
        );

        logger.info('[SomaticAnalysis] Session stopped', { sessionId });

        res.json({ status: 'monitoring_stopped', sessionId });

    } catch (error) {
        logger.error('[SomaticAnalysis] Stop failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /v1/somatic/session/:sessionId/summary
 * Get session somatic summary (for therapist review)
 */
router.get('/v1/somatic/session/:sessionId/summary', authMiddleware, async (req, res) => {
    const { sessionId } = req.params;

    try {
        // Get all analyses from this session
        const analyses = await databasePool.queryAll(
            `SELECT analysis_data, timestamp FROM somatic_analysis
             WHERE session_id = $1
             ORDER BY timestamp ASC`,
            [sessionId]
        );

        if (analyses.length === 0) {
            return res.json({ status: 'no_data', sessionId });
        }

        // Calculate aggregate statistics
        const summary = this.calculateSessionSummary(analyses);

        res.json({
            sessionId,
            analysisCount: analyses.length,
            summary: summary
        });

    } catch (error) {
        logger.error('[SomaticAnalysis] Summary failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * Calculate session summary from analyses
 */
function calculateSessionSummary(analyses) {
    const data = analyses.map(a => JSON.parse(a.analysis_data));

    const emotionCounts = {};
    const autonomicCounts = {};
    let totalTime = 0;

    for (const analysis of data) {
        const emotion = analysis.emotionalState?.emotionalState?.primary;
        const autonomic = analysis.autonomicState?.vagalState;

        if (emotion) {
            emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
        }
        if (autonomic) {
            autonomicCounts[autonomic] = (autonomicCounts[autonomic] || 0) + 1;
        }
    }

    const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) =>
        emotionCounts[a] > emotionCounts[b] ? a : b
    );

    const dominantAutonomic = Object.keys(autonomicCounts).reduce((a, b) =>
        autonomicCounts[a] > autonomicCounts[b] ? a : b
    );

    return {
        dominantEmotion: dominantEmotion,
        emotionDistribution: emotionCounts,
        dominantAutonomicState: dominantAutonomic,
        autonomicDistribution: autonomicCounts,
        sessionDurationSeconds: analyses.length, // Approximately
        clinicalNote: `Therapist should review: ${dominantEmotion} with ${dominantAutonomic} activation.`
    };
}

/**
 * GET /v1/somatic/status
 * Real-time status of somatic system
 */
router.get('/v1/somatic/status', async (req, res) => {
    try {
        const stats = dataAcquisitionEngine.getStats();
        const prosodyStats = prosodyAnalyzer.getStats();

        res.json({
            status: 'healthy',
            dataAcquisition: stats,
            prosody: prosodyStats,
            activeSessions: analysisLoops.size
        });
    } catch (error) {
        logger.error('[SomaticAnalysis] Status check failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
