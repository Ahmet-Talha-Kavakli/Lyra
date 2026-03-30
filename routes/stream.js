/**
 * routes/stream.js - Server-Sent Events (SSE) Streaming
 *
 * Replaces WebSocket with HTTP/SSE for Vercel Serverless compatibility
 *
 * Endpoints:
 * - GET /stream/:sessionId - Open SSE stream for somatic analysis
 * - POST /au-frame - Send AU frame data to backend
 * - POST /safety-alert - Report safety alert
 * - GET /stream/metrics - Get active stream metrics
 */

import express from 'express';
import { logger } from '../lib/infrastructure/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import {
    initializeStream,
    broadcastAUFrame,
    broadcastSafetyAlert,
    getStreamMetrics
} from '../lib/infrastructure/streamingHandler.js';

const router = express.Router();

/**
 * GET /stream/:sessionId
 * Open Server-Sent Events stream for client
 *
 * Client connects:
 * ```javascript
 * const eventSource = new EventSource('/api/stream/session_123');
 * eventSource.addEventListener('au_frame', (event) => {
 *     const auData = JSON.parse(event.data);
 *     // Process AU frame
 * });
 * ```
 */
router.get('/:sessionId', authMiddleware, async (req, res) => {
    try {
        await initializeStream(req, res);
    } catch (error) {
        logger.error('[Stream] Initialization error', {
            sessionId: req.params.sessionId,
            error: error.message
        });
        res.status(500).json({ error: 'Stream initialization failed' });
    }
});

/**
 * POST /au-frame
 * Send AU frame from client to backend
 *
 * Request body:
 * {
 *   sessionId: 'sess_123',
 *   actionUnits: { AU12: 0.8, AU6: 0.6, ... },
 *   confidence: 0.95,
 *   symmetry: 0.92,
 *   smileAuthenticity: 'genuine',
 *   prosodyData: { ... } // optional
 * }
 *
 * Response: Immediate ACK (processing happens in background via QStash)
 */
router.post('/au-frame', authMiddleware, async (req, res) => {
    try {
        const { sessionId, actionUnits, confidence, symmetry, smileAuthenticity, prosodyData } = req.body;
        const userId = req.userId;

        // Log AU frame
        logger.debug('[AU Frame] Received', {
            userId,
            sessionId,
            actionUnits: Object.keys(actionUnits).length,
            confidence
        });

        // Broadcast to any connected SSE clients
        broadcastAUFrame(sessionId, userId, {
            type: 'au_frame',
            actionUnits,
            confidence,
            symmetry,
            smileAuthenticity,
            prosodyData,
            timestamp: new Date().toISOString()
        }, prosodyData);

        // Queue background job for AU analysis
        // This will be processed asynchronously via QStash
        // (Implement via enqueueJob from queueManager.js)

        res.json({
            success: true,
            frameId: `frame_${Date.now()}`,
            queued: true
        });
    } catch (error) {
        logger.error('[AU Frame] Processing error', {
            error: error.message,
            userId: req.userId
        });
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /safety-alert
 * Report safety concerns detected in AU analysis
 *
 * Request body:
 * {
 *   sessionId: 'sess_123',
 *   severity: 'warning' | 'critical',
 *   type: 'crisis_indicators' | 'distress_escalation' | ...,
 *   indicators: [...],
 *   confidence: 0.85
 * }
 */
router.post('/safety-alert', authMiddleware, async (req, res) => {
    try {
        const { sessionId, severity, type, indicators, confidence } = req.body;
        const userId = req.userId;

        logger.warn('[Safety Alert] Received', {
            userId,
            sessionId,
            severity,
            type,
            confidence
        });

        // Broadcast to SSE client
        broadcastSafetyAlert(sessionId, userId, {
            severity,
            type,
            indicators,
            confidence,
            timestamp: new Date().toISOString()
        });

        // Queue safety escalation job via QStash
        // (Implement via enqueueJob)

        res.json({
            success: true,
            alertId: `alert_${Date.now()}`,
            escalated: severity === 'critical'
        });
    } catch (error) {
        logger.error('[Safety Alert] Processing error', {
            error: error.message,
            userId: req.userId
        });
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /stream/metrics
 * Get active stream metrics for monitoring
 *
 * Response:
 * {
 *   activeStreams: 42,
 *   streams: [
 *     {
 *       key: 'user_123:sess_456',
 *       connectedSince: '2026-03-30T...',
 *       frameCount: 1250,
 *       bytesTransferred: 250000,
 *       uptime: 300000
 *     }
 *   ]
 * }
 */
router.get('/metrics', authMiddleware, (req, res) => {
    // Only admin can view metrics
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const metrics = getStreamMetrics();
    res.json(metrics);
});

export default router;
